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
import { createClient } from "@/lib/supabase/server";
import { generateInfographic, generate3dSourceImage } from "@/lib/imagegen/banana";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
    }

    const { imagePrompt, model3dPrompt, topic } = await req.json();
    if (!imagePrompt || !topic) {
      return NextResponse.json({ error: "imagePrompt and topic are required" }, { status: 400 });
    }

    console.log(`[generate-model] NB Pro (teaching) + FLUX Schnell (3D source) for: ${topic}`);

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

    console.log(`[generate-model] Images ready (cached=${teachingImage.cached})`);
    return NextResponse.json({
      imageUrl:        teachingImage.imageUrl,
      model3dImageUrl: model3dImageUrl ?? teachingImage.imageUrl,
    });
  } catch (error) {
    console.error("[generate-model] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: 500 }
    );
  }
}
