/**
 * POST /api/generate-model
 *
 * Topic-level teaching image + 3D source image.  This is the legacy
 * topic-wide visual that fires once at lesson start (kept for non-adaptive
 * lessons and as the 3D model source).  Per-segment adaptive visuals live
 * in /api/learn/segment-visuals — both routes share the underlying fal.ai
 * helper at src/lib/imagegen/banana.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEntitlement, spendAllowance, releaseConsumed, type Consumed } from "@/lib/billing/entitlements";
import { generateInfographic, generate3dSourceImageDetailed } from "@/lib/imagegen/banana";

// NB Pro + FLUX run in parallel but NB Pro alone can take 30-60s under
// load.  Vercel's platform limit is 300s on all plans — headroom is free.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let consumed: Consumed | null = null;
  try {
    const guard = await requireEntitlement();
    if (guard.error) return guard.error;
    const { user } = guard;

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { imagePrompt, model3dPrompt, topic, conceptId } = body ?? {};
    if (typeof imagePrompt !== "string" || !imagePrompt.trim() || typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json({ error: "imagePrompt and topic are required" }, { status: 400 });
    }
    if (model3dPrompt !== undefined && model3dPrompt !== null && typeof model3dPrompt !== "string") {
      return NextResponse.json({ error: "model3dPrompt must be a string" }, { status: 400 });
    }
    if (conceptId !== undefined && conceptId !== null && typeof conceptId !== "string") {
      return NextResponse.json({ error: "conceptId must be a string" }, { status: 400 });
    }
    const resolvedConceptId: string | null = typeof conceptId === "string" && conceptId.trim() ? conceptId : null;

    // A 3D source image is what makes a 3D model, so it is the unit counted (models_3d). A request without
    // model3dPrompt makes only the teaching image and costs no allowance.
    if (model3dPrompt) {
      const spent = await spendAllowance(guard.entitlement, "models_3d");
      if (spent.error) return spent.error;
      consumed = spent.consumed;
    }

    // Both run in parallel — NB Pro for the rich educational image, FLUX for Tripo3D input.
    // user.id is threaded through so usage_events rows are attributable on the cost page;
    // conceptId (when known) is threaded onto the generated_assets row for admin tooling.
    const [teachingImage, source] = await Promise.all([
      generateInfographic({
        prompt:     imagePrompt,
        style:      "annotated_photo",
        // Explicit rather than relying on the default: this is the one image
        // the teacher points at while `visual_walkthrough` names its labels
        // aloud, so it stays on Pro even though segment visuals moved to the
        // cheaper tier.
        tier:       "pro",
        userId:     user.id,
        feature:    "lesson.teaching_image",
        conceptId:  resolvedConceptId,
      }),
      model3dPrompt
        ? generate3dSourceImageDetailed(model3dPrompt, user.id, false, resolvedConceptId)
        : Promise.resolve(null),
    ]);
    // A cached source image cost nothing: give the allowance back.
    if (source?.cached) {
      await releaseConsumed(consumed);
      consumed = null;
    }
    const model3dImageUrl = source?.url ?? null;

    void topic; // referenced only for response context; safe to drop log line above
    return NextResponse.json({
      imageUrl:        teachingImage.imageUrl,
      model3dImageUrl: model3dImageUrl ?? teachingImage.imageUrl,
    });
  } catch (error) {
    await releaseConsumed(consumed);
    console.error("[generate-model] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: 500 }
    );
  }
}
