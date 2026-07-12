/**
 * POST /api/generate-model/3d
 *
 * TripoSR — image-to-3D reconstruction.  Caller passes the clean FLUX
 * source image URL from /api/generate-model and gets back a textured GLB.
 *
 * All fal.ai transport + the in-memory cache lives in
 * `src/lib/imagegen/banana.ts`.  This route is a thin auth gate + logger.
 *
 * Caching: keyed by source imageUrl.  Two students viewing the same lesson
 * on the same Vercel Fluid Compute instance share a single TripoSR call —
 * this is the largest single fal.ai cost on the platform ($0.07/call) so
 * the cache pays for itself within a handful of repeat views.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApproved }           from "@/lib/auth/approval";
import { generate3dModel }           from "@/lib/imagegen/banana";

// Tripo3D conversion alone runs 30-40s; with queue time a 60s cap produced
// intermittent 504s that the client used to swallow silently.  Vercel's
// platform limit is 300s on all plans — use it.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const guard = await requireApproved();
    if (guard.error) return guard.error;
    const { user } = guard;

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
    }

    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });

    const { modelUrl, cached } = await generate3dModel(imageUrl, user.id);

    return NextResponse.json({ modelUrl, cached });
  } catch (error) {
    console.error("[generate-model/3d] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "3D generation failed" },
      { status: 500 }
    );
  }
}
