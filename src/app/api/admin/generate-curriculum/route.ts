import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

// ─── POST /api/admin/generate-curriculum ──────────────────────────────────────
//
// Body (one of):
//   { description: string }           — AI-assisted: generate from subject desc
//   { pdfBase64: string }             — PDF: Gemini reads the PDF inline
//
// Returns: { title: string, description: string, topics: string[] }

export async function POST(req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { description, pdfBase64 } = body as {
    description?: string;
    pdfBase64?: string;
  };

  if (!description && !pdfBase64) {
    return NextResponse.json(
      { error: "Either description or pdfBase64 is required" },
      { status: 400 }
    );
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const instruction = `You are a curriculum designer for middle-school education (grades 6–8).

Return ONLY valid JSON in this exact format — no markdown, no extra text:
{
  "title": "Course Title",
  "description": "One sentence describing what students will learn",
  "topics": ["Topic 1", "Topic 2", ...]
}

Requirements for topics:
- 8 to 20 topics
- Each topic is a specific, self-contained teachable concept (e.g. "Photosynthesis", "The Water Cycle", "Newton's First Law of Motion")
- Ordered from foundational to advanced
- Each topic should be teachable in a single 15–30 minute session`;

  const parts = pdfBase64
    ? [
        { inlineData: { mimeType: "application/pdf" as const, data: pdfBase64 } },
        {
          text:
            instruction +
            "\n\nExtract a structured course curriculum from the PDF document above.",
        },
      ]
    : [
        {
          text:
            instruction +
            `\n\nCreate a curriculum for this subject: "${description!}"`,
        },
      ];

  try {
    const result = await model.generateContent(parts);
    const text = result.response.text();

    let parsed: { title?: string; description?: string; topics?: string[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      // Gemini occasionally wraps JSON in a code fence — strip it
      const match = text.match(/\{[\s\S]*\}/);
      if (!match)
        return NextResponse.json(
          { error: "Model returned unparseable output" },
          { status: 500 }
        );
      parsed = JSON.parse(match[0]);
    }

    return NextResponse.json({
      title: parsed.title ?? "Untitled Course",
      description: parsed.description ?? "",
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    });
  } catch (err) {
    console.error("generate-curriculum error:", err);
    return NextResponse.json(
      { error: "Curriculum generation failed" },
      { status: 500 }
    );
  }
}
