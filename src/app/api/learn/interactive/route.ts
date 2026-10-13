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
 *   400 bad body, 401/403 not signed in or approved, 404 switched off,
 *   429 too many generations, 500 generation failed (the lesson carries on over its image)
 *
 * Constraints
 *   - Approved learners only (`requireApproved`).
 *   - Cached in `generated_interactives` by (concept, spec) for KG-resolved concepts
 *     ONLY. A free-form topic is generated each time and never stored.
 *   - For a KG concept the model is told the concept's name from the database, never the
 *     client's `topic`: what is cached is shown to every learner, so a request must not be
 *     able to steer it. The client topic is used only for free-form, uncached requests.
 *   - Cached rows are re-validated on the way out; a row with `disabled` is a 404.
 *   - Identical in-flight requests share one generation; each learner gets a small
 *     per-window generation allowance (cache hits do not count).
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

// A first generation writes several thousand tokens; leave room for the retry.
export const maxDuration = 120;

const GENERATIONS_PER_WINDOW = 8;
const throttle = createThrottle(GENERATIONS_PER_WINDOW, 10 * 60 * 1000);
const inflight = new Map<string, Promise<InteractiveParts>>();

export async function POST(req: NextRequest) {
  try {
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
    const specHash = createHash("sha256").update(normalizeSpecForKey(conceptId ?? "", spec)).digest("hex");

    // A KG-resolved concept: its name comes from the database, and only it is cached.
    const { data: concept } = conceptId
      ? await service.from("concepts").select("id, name").eq("id", conceptId).maybeSingle()
      : { data: null };

    // ── Cache (a free-form topic has no concept and never has a row) ────────
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
      if (!throttle.take(user.id)) {
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
