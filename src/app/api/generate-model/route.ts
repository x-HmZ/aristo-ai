import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

fal.config({ credentials: process.env.FAL_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imagePrompt, topic } = await req.json();

    if (!imagePrompt || !topic) {
      return NextResponse.json(
        { error: "imagePrompt and topic are required" },
        { status: 400 }
      );
    }

    // Step 1: Generate image with FLUX Schnell
    console.log(`[generate-model] Generating image for: ${topic}`);
    const imageResult = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: imagePrompt,
        image_size: "square_hd",
        num_inference_steps: 4,
        num_images: 1,
      },
    }) as unknown as { images: { url: string }[] };

    const imageUrl = imageResult.images?.[0]?.url;
    if (!imageUrl) {
      throw new Error("Image generation failed — no image returned");
    }

    console.log(`[generate-model] Image ready, generating 3D model...`);

    // Step 2: Convert image to 3D with Tripo3D v2.5
    const modelResult = await fal.subscribe(
      "tripo3d/tripo/v2.5/image-to-3d",
      {
        input: {
          image_url: imageUrl,
          pivot_to_center_bottom: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            const latest = update.logs?.at(-1)?.message;
            if (latest) console.log(`[tripo3d] ${latest}`);
          }
        },
      }
    ) as unknown as { model_mesh: { url: string }; rendered_image: { url: string } };

    const modelUrl = modelResult.model_mesh?.url;
    if (!modelUrl) {
      throw new Error("3D model generation failed — no model returned");
    }

    console.log(`[generate-model] Done. Model URL: ${modelUrl}`);

    return NextResponse.json({
      modelUrl,
      imageUrl,
      previewUrl: modelResult.rendered_image?.url ?? imageUrl,
    });
  } catch (error) {
    console.error("3D generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "3D model generation failed",
      },
      { status: 500 }
    );
  }
}
