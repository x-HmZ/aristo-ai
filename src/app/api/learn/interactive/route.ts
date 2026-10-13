/**
 * POST /api/learn/interactive
 *
 * Returns the interactive widget (title, markup, css, js) for a lesson's
 * `metadata.interactive` spec. The page runs in a sandboxed iframe on the client
 * (src/lib/interactive/shell.ts); this route only produces and caches it.
 *
 * Request body
 *   { conceptId?: string, topic: string, spec: InteractiveSpec }
 *
 * Response
 *   200 { title, markup, css, js, cached: boolean }
 *   400 bad body, 401/403 not signed in or approved, 403 spec not from a lesson,
 *   404 switched off, 429 too many generations, 500 generation failed (the lesson
 *   carries on over its image)
 *
 * Constraints
 *   - Off unless NEXT_PUBLIC_INTERACTIVE_VISUALS is "true" (src/lib/interactive/flag.ts).
 *   - Approved learners only (`requireApproved`).
 *   - What is cached is shown to every learner, so for a KG concept nothing the
 *     client sends may steer it: the model is told the concept's NAME FROM THE
 *     DATABASE, and the spec must be one a stored lesson of that concept carries
 *     (so it was written by the teaching agent, not by the request). The cache key
 *     hashes every field of the spec, `try_this` included.
 *   - Cached in `generated_interactives` for KG-resolved concepts ONLY. A free-form
 *     topic is generated each time and never stored.
 *   - Cached rows are re-validated on the way out; a row with `disabled` is a 404.
 *   - Identical in-flight requests share one generation. Generations are limited per
 *     learner twice: in memory (cheap, per instance) and from `usage_events` (shared
 *     by every instance). Cache hits do not count.
 */

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/auth/approval";
import { generateInteractive } from "@/lib/agents/interactive";
import { MODELS } from "@/lib/agents/models";
import {
  normalizeSpecForKey,
  parseInteractiveParts,
  parseInteractiveSpec,
  type InteractiveParts,
} from "@/lib/interactive/spec";
import { validateWidget } from "@/lib/interactive/validate";
import { createThrottle } from "@/lib/interactive/throttle";
import { INTERACTIVE_VISUALS_ENABLED } from "@/lib/interactive/flag";

// A first generation writes several thousand tokens; leave room for the retry.
export const maxDuration = 120;

const WINDOW_MS = 10 * 60 * 1000;
const GENERATIONS_PER_WINDOW = 8;
/** The most model calls the window allows: every generation may retry once. */
const MODEL_CALLS_PER_WINDOW = GENERATIONS_PER_WINDOW * 2;
const throttle = createThrottle(GENERATIONS_PER_WINDOW, WINDOW_MS);
const inflight = new Map<string, Promise<InteractiveParts>>();

export async function POST(req: NextRequest) {
  try {
    if (!INTERACTIVE_VISUALS_ENABLED) return NextResponse.json({ error: "switched off" }, { status: 404 });

    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;

    const body = await req.json().catch(() => null);
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    if (!topic || topic.length > 200) {
      return NextResponse.json({ error: "topic must be 1 to 200 characters" }, { status: 400 });
    }
    const rawConcept: unknown = body?.conceptId;
    if (rawConcept !== undefined && rawConcept !== null && (typeof rawConcept !== "string" || rawConcept.length > 100)) {
      return NextResponse.json({ error: "conceptId must be a string of at most 100 characters" }, { status: 400 });
    }
    const conceptId = typeof rawConcept === "string" && rawConcept.trim() ? rawConcept.trim() : null;
    const spec = parseInteractiveSpec(body?.spec);
    if (!spec) return NextResponse.json({ error: "invalid spec" }, { status: 400 });

    const service = createServiceClient();

    // A KG-resolved concept: its name comes from the database, and only it is cached.
    const { data: concept } = conceptId
      ? await service.from("concepts").select("id, name").eq("id", conceptId).maybeSingle()
      : { data: null };

    // The spec must be one the teaching agent wrote: some stored lesson of this concept carries it. Any
    // moderation status but rejected counts, because a brand-new concept's lesson is stored as pending
    // and its first learner is served it anyway.
    if (concept) {
      const { count } = await service
        .from("cached_lessons")
        .select("id", { count: "exact", head: true })
        .eq("concept_id", concept.id)
        .neq("moderation_status", "rejected")
        .contains("payload", { metadata: { interactive: spec } });
      if (!count) return NextResponse.json({ error: "spec does not belong to a lesson of this concept" }, { status: 403 });
    }

    // Free-form requests are never stored, so their topic is part of what makes two requests the same.
    const specHash = createHash("sha256")
      .update(normalizeSpecForKey(concept?.id ?? "", spec) + (concept ? "" : `|${topic}`))
      .digest("hex");

    // ── Cache ───────────────────────────────────────────────────────────────
    if (concept) {
      const { data: row } = await service
        .from("generated_interactives")
        .select("title, markup, css, js, disabled")
        .eq("spec_hash", specHash)
        .maybeSingle();
      if (row?.disabled) return NextResponse.json({ error: "switched off" }, { status: 404 });
      if (row) {
        const parts = parseInteractiveParts(row);
        if (parts && validateWidget(parts).ok) return NextResponse.json({ ...parts, cached: true });
        // A row that no longer validates is regenerated and overwritten below.
      }
    }

    // ── Generate (shared with identical requests already running) ───────────
    let pending = inflight.get(specHash);
    if (!pending) {
      if (!throttle.take(user.id) || (await overBudget(service, user.id))) {
        return NextResponse.json({ error: "Too many interactives requested; try again in a few minutes" }, { status: 429 });
      }
      pending = generateInteractive({ topic: concept?.name ?? topic, spec, userId: user.id })
        .finally(() => inflight.delete(specHash));
      inflight.set(specHash, pending);
    }
    const parts = await pending;

    // ── Store, for KG-resolved concepts only; never block the learner on it ─
    if (concept) {
      const { error } = await service.from("generated_interactives").upsert(
        {
          spec_hash:    specHash,
          concept_id:   concept.id,
          title:        parts.title,
          markup:       parts.markup,
          css:          parts.css,
          js:           parts.js,
          source_model: MODELS.interactive,
        },
        { onConflict: "spec_hash" },
      );
      if (error) console.error("[interactive cache] upsert failed (non-fatal)", error);
    }

    return NextResponse.json({ ...parts, cached: false });
  } catch (error) {
    console.error("[interactive] route error:", error);
    return NextResponse.json({ error: "Could not build the interactive" }, { status: 500 });
  }
}

/** The shared limit: model calls this learner made in the window, from usage_events. Errors fail open (the in-memory limit still applies). */
async function overBudget(service: ReturnType<typeof createServiceClient>, userId: string): Promise<boolean> {
  const { count, error } = await service
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("feature", ["lesson.interactive", "lesson.interactive.retry"])
    .gte("created_at", new Date(Date.now() - WINDOW_MS).toISOString());
  if (error) {
    console.error("[interactive] budget check failed (open)", error);
    return false;
  }
  return (count ?? 0) >= MODEL_CALLS_PER_WINDOW;
}
