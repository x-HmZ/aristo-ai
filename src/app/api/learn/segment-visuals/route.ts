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
    const body = await req.json().catch(() => ({}));
    const conceptIdRaw: unknown = body?.conceptId;
    if (conceptIdRaw !== undefined && conceptIdRaw !== null && typeof conceptIdRaw !== "string") {
      return NextResponse.json({ error: "conceptId must be a string" }, { status: 400 });
    }
    const conceptId: string | null =
      typeof conceptIdRaw === "string" && conceptIdRaw.trim() ? conceptIdRaw : null;

    const segments: unknown = body?.segments;
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: "segments must be a non-empty array" },
        { status: 400 }
      );
    }
    if (segments.length > MAX_SEGMENTS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many segments (max ${MAX_SEGMENTS_PER_REQUEST} per request)` },
        { status: 400 }
      );
    }

    const normalized: SegmentRequest[] = [];
    for (const raw of segments) {
      if (
        !raw ||
        typeof raw !== "object" ||
        typeof (raw as SegmentRequest).id !== "string" ||
        typeof (raw as SegmentRequest).prompt !== "string" ||
        !(raw as SegmentRequest).prompt.trim()
      ) {
        return NextResponse.json(
          { error: "Each segment requires id (string) and non-empty prompt (string)" },
          { status: 400 }
        );
      }
      const style = (raw as SegmentRequest).style;
      normalized.push({
        id:     (raw as SegmentRequest).id,
        prompt: (raw as SegmentRequest).prompt,
        style:  isValidStyle(style) ? style : "infographic",
      });
    }

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
          });
          return { id: seg.id, imageUrl, cached };
        } catch (err) {
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
