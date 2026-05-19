/**
 * POST /api/learn/explain-more
 *
 * Returns a deeper explanation of a specific lesson phase (Haiku).
 * Called when the student taps "Explain more" on any phase card.
 *
 * Body: { phase, phaseContent, conceptName, profile? }
 */

import { NextRequest, NextResponse } from "next/server";
import { explainMore }               from "@/lib/agents/teaching";
import type { LessonPayload }        from "@/lib/agents/teaching";
import type { DynamicProfile }       from "@/store/useAristoStore";

export async function POST(req: NextRequest) {
  try {
    const body: {
      phase:        keyof LessonPayload["phases"];
      phaseContent: string;
      conceptName:  string;
      profile?:     DynamicProfile;
    } = await req.json();

    const { phase, phaseContent, conceptName, profile } = body;

    if (!phase || !phaseContent || !conceptName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const explanation = await explainMore(phase, phaseContent, conceptName, profile ?? null);

    return NextResponse.json({ explanation });
  } catch (err) {
    console.error("POST /api/learn/explain-more error:", err);
    return NextResponse.json({ error: "Failed to generate explanation" }, { status: 500 });
  }
}
