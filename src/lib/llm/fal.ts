/**
 * fal.ai usage helper.
 *
 * The fal SDK is consumed in two places today:
 *   1. `src/lib/imagegen/banana.ts`           — nano-banana-pro + flux/schnell
 *   2. `src/app/api/generate-model/3d/route.ts` — triposr (image → GLB)
 *
 * fal returns *no* usage block in its responses, so cost is computed per-unit
 * from `FAL_PRICING`. Callers fire `logFalGeneration()` after a successful
 * generation; the function is fire-and-forget (never throws, never blocks).
 *
 * `feature` should describe *why* fal was called — e.g.
 *   - `lesson.segment_visual` (per-segment adaptive image)
 *   - `lesson.teaching_image` (topic-level lesson image)
 *   - `lesson.3d_source`     (FLUX image used as TripoSR input)
 *   - `lesson.3d_model`      (TripoSR GLB)
 * so the cost page can aggregate by service per provider.
 */

import { falCostMicros } from "@/lib/llm/pricing";
import { logUsage }      from "@/lib/llm/usage";

export interface LogFalOpts {
  /** Canonical fal model slug, e.g. "fal-ai/nano-banana-pro" or "fal-ai/triposr". */
  model:    string;
  /** Feature tag — see file header. */
  feature:  string;
  /** Optional learner id for per-user attribution on the cost page. */
  user_id?: string | null;
  /** How many units to bill (default 1 — most fal endpoints are per-call). */
  units?:   number;
  /** Free-form metadata, e.g. { prompt, cached, resolution }. */
  metadata?: Record<string, unknown>;
}

/** Record a single fal.ai generation event. */
export function logFalGeneration(opts: LogFalOpts): void {
  const units = opts.units ?? 1;
  const cost  = falCostMicros({ model: opts.model, units });
  logUsage({
    provider:        "fal",
    model:           opts.model,
    feature:         opts.feature,
    user_id:         opts.user_id ?? null,
    units,
    cost_usd_micros: cost,
    metadata:        opts.metadata,
  });
}
