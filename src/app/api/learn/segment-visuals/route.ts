/**
 * POST /api/learn/segment-visuals
 *
 * Batch-generate per-segment educational images for an adaptive-visual
 * lesson.  Fires every requested segment's prompt in parallel through the
 * shared Nano Banana Pro helper, returns per-segment results so the client
 * playback engine can render visuals incrementally (and proceed even when
 * an individual segment fails).
 *
 * Request body
 *   {
 *     conceptId?: string;                     // lesson.concept_id, when known
 *     segments: Array<{
 *       id:     string;                       // matches NarrationSegment.id
 *       prompt: string;                       // SegmentVisual.prompt
 *       style:  SegmentVisual["style"];       // determines style preset prefix
 *     }>
 *   }
 *
 * Response
 *   {
 *     results: Array<{
 *       id:        string;
 *       imageUrl?: string;
 *       cached?:   boolean;
 *       error?:    string;
 *     }>
 *   }
 *
 * Constraints
 *   • Auth required (Supabase user).  Bails 401 if not signed in.
 *   • Hard cap: ≤ 8 segments per request (cost ceiling).  Plan §5.1.
 *   • Per-segment failures do NOT fail the batch — playback engine treats
 *     `error` rows as "no visual for this segment" and proceeds.
 *   • maxDuration = 60s.  Nano Banana Pro typically returns in 3–6s; eight
 *     parallel requests should land in 6–10s wall clock.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApproved } from "@/lib/auth/approval";
import { GuardBlocked, spendHook } from "@/lib/guard";
import { conceptIdSchema, parseJsonBody } from "@/lib/guard/input";
import { z } from "zod";
import { generateInfographic, type ImageStyle } from "@/lib/imagegen/banana";
import type { SegmentVisual } from "@/lib/agents/teaching";

export const maxDuration = 60;

interface SegmentRequest {
  id:     string;
  prompt: string;
  style:  SegmentVisual["style"];
}

interface SegmentResult {
  id:        string;
  imageUrl?: string;
  cached?:   boolean;
  error?:    string;
}

const MAX_SEGMENTS_PER_REQUEST = 8;
const ALLOWED_STYLES: ImageStyle[] = [
  "infographic",
  "diagram",
  "comparison",
  "process_flow",
  "annotated_photo",
];

const BodySchema = z.object({
  conceptId: conceptIdSchema.nullish(),
  segments:  z.array(z.object({
    id:     z.string().min(1).max(64),
    // Prompts come from the lesson payload; 1000 characters is generous for an image prompt.
    prompt: z.string().trim().min(1).max(1000),
    style:  z.string().max(40).optional(),
  }).strict()).min(1).max(MAX_SEGMENTS_PER_REQUEST),
}).strict();

function isValidStyle(style: unknown): style is ImageStyle {
  return typeof style === "string" && (ALLOWED_STYLES as string[]).includes(style);
}

export async function POST(req: NextRequest) {
  try {
    // ─── Auth + approval gate ──────────────────────────────────────────────
    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;

    // ─── Env ───────────────────────────────────────────────────────────────
    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: "FAL_KEY not configured" },
        { status: 500 }
      );
    }

    // ─── Body validation ───────────────────────────────────────────────────
    const parsed = await parseJsonBody(req, BodySchema);
    if (!parsed.ok) return parsed.response;
    const conceptId: string | null = parsed.data.conceptId ?? null;
    const normalized: SegmentRequest[] = parsed.data.segments.map((s) => ({
      id:     s.id,
      prompt: s.prompt,
      style:  isValidStyle(s.style) ? s.style : "infographic",
    }));

    // ─── Parallel generation ───────────────────────────────────────────────
    const results: SegmentResult[] = await Promise.all(
      normalized.map(async (seg): Promise<SegmentResult> => {
        try {
          const { imageUrl, cached } = await generateInfographic({
            prompt:    seg.prompt,
            style:     seg.style,
            // Segment visuals run on the fast tier (nano-banana-2): measured
            // equal to Pro on text accuracy across real text-heavy prompts,
            // 2.1x faster and 53% of the price. Pro stays on the topic
            // teaching image only, whose labels the narration cites by name.
            tier:      "fast",
            userId:    user.id,
            feature:   "lesson.segment_visual",
            conceptId,
            // One count per image that is actually generated; cached images are free and never limited.
            beforeGenerate: spendHook(user.id, "segment_visuals"),
          });
          return { id: seg.id, imageUrl, cached };
        } catch (err) {
          if (err instanceof GuardBlocked) return { id: seg.id, error: "rate_limited" };
          const message = err instanceof Error ? err.message : "Image generation failed";
          console.error(`[segment-visuals] seg ${seg.id} failed:`, message);
          return { id: seg.id, error: message };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[segment-visuals] route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
