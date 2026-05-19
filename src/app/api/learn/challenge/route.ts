/**
 * POST /api/learn/challenge
 *
 * Evaluates the student's response to the Phase 4 Socratic challenge.
 * Uses Claude Haiku (spec §8.4 pattern) for fast, encouraging feedback.
 *
 * Body: { question, correctAnswer, userAnswer, conceptName }
 * Returns: { is_correct, score, feedback }
 */

import { NextRequest, NextResponse } from "next/server";
import type Anthropic                from "@anthropic-ai/sdk";
import { MODELS }                    from "@/lib/agents/models";
import { getAnthropic }              from "@/lib/llm/anthropic";

const client = getAnthropic();

export async function POST(req: NextRequest) {
  try {
    const {
      question,
      correctAnswer,
      userAnswer,
      conceptName,
    }: {
      question:      string;
      correctAnswer: string;
      userAnswer:    string;
      conceptName:   string;
    } = await req.json();

    if (!question || !correctAnswer || !userAnswer) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const response = await client.messages.create(
      {
        model:      MODELS.fast,
        max_tokens: 256,
        messages: [
          {
            role:    "user",
            content: `You are evaluating a student's answer to a Socratic challenge question. Be encouraging but accurate.

Concept: ${conceptName}
Question: ${question}
Expected answer: ${correctAnswer}
Student's answer: ${userAnswer}

Evaluate and return JSON only (no other text):
{
  "is_correct": true or false,
  "score": 0.0 to 1.0,
  "feedback": "one encouraging sentence acknowledging what they got right and gently clarifying if needed"
}`,
          },
        ],
      },
      { feature: "learn.challenge", metadata: { conceptName } }
    );

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    const jsonMatch = text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      return NextResponse.json({ is_correct: false, score: 0, feedback: "Keep thinking about it!" });
    }

    const result = JSON.parse(jsonMatch[1]);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/learn/challenge error:", err);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
