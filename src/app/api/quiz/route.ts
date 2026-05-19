import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { MODELS }        from "@/lib/agents/models";
import { getAnthropic }  from "@/lib/llm/anthropic";

const client = getAnthropic();

const quizTool: Anthropic.Tool = {
  name: "generate_quiz",
  description: "Generate a 5-question multiple choice quiz for middle-school students.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question:    { type: "string" },
            options:     { type: "array", items: { type: "string" } },
            correct:     { type: "string", description: "Must exactly match one of the options" },
            explanation: { type: "string", description: "Brief explanation of why the answer is correct" },
          },
          required: ["question", "options", "correct", "explanation"],
        },
      },
    },
    required: ["questions"],
  },
};

export async function POST(req: NextRequest) {
  try {
    const { topics, learningStyle = "explorer" } = await req.json();

    if (!topics || topics.length === 0) {
      return NextResponse.json({ error: "Topics are required" }, { status: 400 });
    }

    const response = await client.messages.create(
      {
        model: MODELS.fast,
        max_tokens: 1024,
        tools: [quizTool],
        tool_choice: { type: "any" },
        messages: [
          {
            role: "user",
            content: `Generate exactly 5 multiple choice questions for middle-school students covering: ${topics.join(", ")}.
Each question must have exactly 4 options. The correct field must exactly match one of the options.
Learning style context: ${learningStyle}.`,
          },
        ],
      },
      { feature: "quiz.legacy", metadata: { topics, learningStyle } }
    );

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No quiz generated");
    }

    return NextResponse.json(toolUse.input);
  } catch (error) {
    console.error("Quiz API error:", error);
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  }
}
