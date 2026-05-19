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
import { requireApproved } from "@/lib/auth/approval";
import { generateInfographic, generate3dSourceImage } from "@/lib/imagegen/banana";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
    }

    const { imagePrompt, model3dPrompt, topic } = await req.json();
    if (!imagePrompt || !topic) {
      return NextResponse.json({ error: "imagePrompt and topic are required" }, { status: 400 });
    }

    // Both run in parallel — NB Pro for the rich educational image, FLUX for TripoSR input.
    // user.id is threaded through so usage_events rows are attributable on the cost page.
    const [teachingImage, model3dImageUrl] = await Promise.all([
      generateInfographic({
        prompt:  imagePrompt,
        style:   "annotated_photo",
        userId:  user.id,
        feature: "lesson.teaching_image",
      }),
      model3dPrompt
        ? generate3dSourceImage(model3dPrompt, user.id)
        : Promise.resolve(null),
    ]);

    void topic; // referenced only for response context; safe to drop log line above
    return NextResponse.json({
      imageUrl:        teachingImage.imageUrl,
      model3dImageUrl: model3dImageUrl ?? teachingImage.imageUrl,
    });
  } catch (error) {
    console.error("[generate-model] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: 500 }
    );
  }
}
