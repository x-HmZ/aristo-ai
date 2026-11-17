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
import { requireEntitlement, spendAllowance, releaseConsumed, type Consumed } from "@/lib/billing/entitlements";
import { generateLesson }            from "@/lib/agents/teaching";
import type { ConceptInput, LessonPayload } from "@/lib/agents/teaching";
import type { DynamicProfile }       from "@/store/useAristoStore";
import { loadConceptScope, retrieveChunks, type RetrievedChunk } from "@/lib/rag/retrieve";
import { formatChunk }               from "@/lib/rag/reference";
import { loadLessonSources }         from "@/lib/rag/credits";
import { decideModeration, profileSignature } from "@/lib/admin/moderation-rules";
import { MODELS }                    from "@/lib/agents/models";
import { guardSpend }                from "@/lib/guard";
import { conceptIdSchema, parseValue } from "@/lib/guard/input";

export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conceptId: string }> }
) {
  // Set once a fresh lesson is counted; released in the catch if generation then fails.
  let consumed: Consumed | null = null;
  try {
    const { conceptId: rawId } = await params;
    let decoded: string;
    try { decoded = decodeURIComponent(rawId); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    // A KG concept id or, from course mode, a topic title used as the id (free-form fallback below): bounded and
    // restricted to plain text either way.
    const idCheck = parseValue(conceptIdSchema, decoded);
    if (!idCheck.ok) return idCheck.response;
    const conceptId = idCheck.data;

    // ── Auth + approval gate ──────────────────────────────────────────────────
    const guard = await requireEntitlement();
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
        // Count the replay but never block it: a cached lesson is served even over the cap, and a failing
        // counter (503) must not stop it either, so the result is deliberately ignored.
        await spendAllowance(guard.entitlement, "replays").catch(() => undefined);
        return NextResponse.json(hit.payload as LessonPayload);
      }
    }

    // ── Cache miss → resolve prereqs + RAG and generate ───────────────────────
    const blocked = await guardSpend(user.id, "lesson_generate");
    if (blocked) return blocked;
    const spent = await spendAllowance(guard.entitlement, "fresh_lessons");
    if (spent.error) return spent.error;
    consumed = spent.consumed;

    let concept: ConceptInput;
    let ragContext: string[] = [];
    let ragChunks: RetrievedChunk[] = [];

    if (dbConcept) {
      const [prereqRes, rag] = await Promise.all([
        supabase
          .from("concept_prerequisites")
          .select("prerequisite:concepts!prerequisite_id(name)")
          .eq("concept_id", conceptId),
        (async () => {
          const scope = await loadConceptScope(supabase, dbConcept.id);
          return retrieveChunks(
            {
              id:                  dbConcept.id,
              name:                dbConcept.name,
              description:         dbConcept.description,
              domain:              dbConcept.domain,
              learning_objectives: dbConcept.learning_objectives ?? [],
            },
            supabase,
            { sourceId: scope.sourceId, pageRanges: scope.pageRanges, userId: user.id }
          );
        })().catch(() => ({ chunks: [] as RetrievedChunk[] })),
      ]);
      ragChunks  = rag.chunks;
      ragContext = ragChunks.map(formatChunk);

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

    const lesson = await generateLesson(concept, profile, ragContext, user.id);

    // Credit the sources that grounded this lesson. Stored in the cached
    // payload (so cache hits carry it) and in cached_lessons.rag_chunks_used.
    const sources = await loadLessonSources(service, ragChunks);
    if (sources.length > 0) lesson.sources = sources;

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
          rag_chunks_used:    ragChunks.length > 0
            ? { chunk_ids: ragChunks.map((c) => c.id), source_ids: sources.map((s) => s.id) }
            : null,
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
    await releaseConsumed(consumed);
    console.error("GET /api/learn/lesson error:", err);
    return NextResponse.json(
      { error: "Failed to generate lesson" },
      { status: 500 }
    );
  }
}
