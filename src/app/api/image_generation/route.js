import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function GET(req) {
  const prompting = req.nextUrl.searchParams.get("prompting") || "photosynthesis";

  try {
    const prompt = `Create a realistic image to describe ${prompting}. Only show stuff that is visible and no conceptual thing.`;

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });

    if (imageResponse.data && imageResponse.data.length > 0) {
      const images = imageResponse.data[0].url;

      console.log(images);
      return new NextResponse(JSON.stringify({ image: images }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } else {
      throw new Error("No images generated");
    }
  } catch (error) {
    console.error("Error during image generation:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to generate images", details: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
