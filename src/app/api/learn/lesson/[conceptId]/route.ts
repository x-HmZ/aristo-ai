/**
 * GET /api/learn/lesson/:conceptId
 *
 * Returns a 5-phase LessonPayload for the given concept.
 *
 * Resolution order:
 *  1. Look up concept by ID in the `concepts` table.
 *  2. Compute the learner's profile_signature; look in `cached_lessons` for
 *     an approved/auto_approved match. Cache hit → serve cached payload
 *     and bump usage_count.
 *  3. Cache miss → call the TeachingAgent, decide moderation, insert into
 *     cache, and return the freshly generated payload (only when
 *     auto_approved). Pending rows trigger a fresh generation on every
 *     learner request until an admin approves.
 *  4. If the concept doesn't exist in the KG, fall back to a free-form
 *     generation with no caching.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireApproved }           from "@/lib/auth/approval";
import { generateLesson }            from "@/lib/agents/teaching";
import type { ConceptInput, LessonPayload } from "@/lib/agents/teaching";
import type { DynamicProfile }       from "@/store/useAristoStore";
import { retrieveContext }           from "@/lib/rag/retrieve";
import { decideModeration, profileSignature } from "@/lib/admin/moderation-rules";
import { MODELS }                    from "@/lib/agents/models";

export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conceptId: string }> }
) {
  try {
    const { conceptId: rawId } = await params;
    const conceptId = decodeURIComponent(rawId);

    // ── Auth + approval gate ──────────────────────────────────────────────────
    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;
    const supabase = await createClient();

    // ── Load learner profile + concept in parallel ────────────────────────────
    const [lpRes, conceptRes] = await Promise.all([
      supabase
        .from("learner_profiles")
        .select("expertise_level, pace, explanation_depth, example_preference, weakest_bloom_level, strongest_bloom_level")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("concepts")
        .select("id, name, description, domain, learning_objectives, key_terms, common_misconceptions")
        .eq("id", conceptId)
        .maybeSingle(),
    ]);

    const lpRow = lpRes.data;
    const profile: DynamicProfile | null = lpRow
      ? {
          expertise_level:       lpRow.expertise_level    ?? "beginner",
          pace:                  lpRow.pace               ?? "moderate",
          explanation_depth:     lpRow.explanation_depth  ?? "moderate",
          example_preference:    lpRow.example_preference ?? "concrete",
          weakest_bloom_level:   lpRow.weakest_bloom_level  ?? undefined,
          strongest_bloom_level: lpRow.strongest_bloom_level ?? undefined,
        }
      : null;

    const dbConcept = conceptRes.data;
    const signature = profileSignature(lpRow ?? null);
    const service   = createServiceClient();

    // ── Cache lookup (only for KG-resolved concepts) ──────────────────────────
    if (dbConcept) {
      const { data: hit } = await service
        .from("cached_lessons")
        .select("id, payload")
        .eq("concept_id", dbConcept.id)
        .eq("profile_signature", signature)
        .in("moderation_status", ["approved", "auto_approved"])
        .maybeSingle();

      if (hit) {
        // Bump usage_count atomically; fire-and-forget so it doesn't
        // delay the response.
        void service.rpc("increment_cached_lesson_usage", { p_id: hit.id });
        return NextResponse.json(hit.payload as LessonPayload);
      }
    }

    // ── Cache miss → resolve prereqs + RAG and generate ───────────────────────
    let concept: ConceptInput;
    let ragContext: string[] = [];

    if (dbConcept) {
      const [prereqRes, rag] = await Promise.all([
        supabase
          .from("concept_prerequisites")
          .select("prerequisite:concepts!prerequisite_id(name)")
          .eq("concept_id", conceptId),
        retrieveContext(
          {
            id:                  dbConcept.id,
            name:                dbConcept.name,
            description:         dbConcept.description,
            domain:              dbConcept.domain,
            learning_objectives: dbConcept.learning_objectives ?? [],
          },
          supabase
        ).catch(() => [] as string[]),
      ]);
      ragContext = rag;

      const prereqNames: string[] =
        (prereqRes.data ?? [])
          .map((row: { prerequisite: { name: string } | { name: string }[] | null }) => {
            const p = row.prerequisite;
            if (!p) return null;
            return Array.isArray(p) ? p[0]?.name ?? null : p.name;
          })
          .filter((n): n is string => typeof n === "string");

      concept = {
        id:                    dbConcept.id,
        name:                  dbConcept.name,
        description:           dbConcept.description,
        domain:                dbConcept.domain,
        learning_objectives:   dbConcept.learning_objectives ?? [],
        key_terms:             dbConcept.key_terms ?? [],
        common_misconceptions: dbConcept.common_misconceptions ?? [],
        prerequisites:         prereqNames,
      };
    } else {
      // Free-form fallback — never cached.
      concept = {
        id:          conceptId,
        name:        conceptId,
        description: `The topic: ${conceptId}`,
      };
    }

    const lesson = await generateLesson(concept, profile, ragContext);

    // ── Write to cache (only for KG-resolved concepts) ────────────────────────
    if (dbConcept) {
      const decision = await decideModeration(dbConcept.id, service);

      // Insert/upsert. UNIQUE(concept_id, profile_signature) makes this idempotent.
      const { error: insertErr } = await service.from("cached_lessons").upsert(
        {
          concept_id:         dbConcept.id,
          profile_signature:  signature,
          payload:            lesson,
          generated_by_model: MODELS.teaching,
          moderation_status:  decision.status,
          flagged_reason:     decision.flagged_reason ?? null,
          generated_at:       new Date().toISOString(),
          approved_at:        decision.status === "auto_approved" ? new Date().toISOString() : null,
        },
        { onConflict: "concept_id,profile_signature" }
      );

      if (insertErr) {
        console.error("[lesson cache] upsert failed (non-fatal)", insertErr);
      }

      // If the row landed in pending, we still serve the freshly generated
      // payload to the learner — the cache row is for admin review, not a
      // gate. Future requests with the same signature will continue to
      // regenerate until an admin approves.
    }

    return NextResponse.json(lesson);
  } catch (err) {
    console.error("GET /api/learn/lesson error:", err);
    return NextResponse.json(
      { error: "Failed to generate lesson" },
      { status: 500 }
    );
  }
}
