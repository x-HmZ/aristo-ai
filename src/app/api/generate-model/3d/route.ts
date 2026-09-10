/**
 * POST /api/generate-model/3d
 *
 * Tripo3D v2.5 — image-to-3D reconstruction.  Caller passes the clean FLUX
 * source image URL from /api/generate-model and gets back a textured GLB.
 *
 * All fal.ai transport + the in-memory cache lives in
 * `src/lib/imagegen/banana.ts`.  This route is a thin auth gate + logger.
 *
 * Caching: keyed by source imageUrl.  Two students viewing the same lesson
 * on the same Vercel Fluid Compute instance share a single Tripo3D call.
 * Since T06 the cache is durable (Supabase Storage), so the first student to
 * view a concept pays the $0.30 once and every student after inherits it —
 * which is what makes a model at this price affordable at all.
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

    const body = await req.json().catch(() => ({}));
    const { imageUrl, conceptId, needsMultiview } = body ?? {};
    if (typeof imageUrl !== "string" || !imageUrl.trim()) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }
    if (conceptId !== undefined && conceptId !== null && typeof conceptId !== "string") {
      return NextResponse.json({ error: "conceptId must be a string" }, { status: 400 });
    }
    if (needsMultiview !== undefined && typeof needsMultiview !== "boolean") {
      return NextResponse.json({ error: "needsMultiview must be a boolean" }, { status: 400 });
    }
    const resolvedConceptId: string | null = typeof conceptId === "string" && conceptId.trim() ? conceptId : null;

    const { modelUrl, cached } = await generate3dModel(imageUrl, user.id, false, resolvedConceptId, {
      multiview: needsMultiview === true,
    });

    return NextResponse.json({ modelUrl, cached });
  } catch (error) {
    console.error("[generate-model/3d] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "3D generation failed" },
      { status: 500 }
    );
  }
}
