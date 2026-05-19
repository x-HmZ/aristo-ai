/**
 * POST /api/teach
 *
 * Free-mode chat companion. The user types a free-form topic in InputBox; this
 * route returns a single structured card (definition / explanation / example /
 * fun_fact + optional 3D generation prompt) shaped by the learner's
 * DynamicProfile from learner_profiles.
 *
 * NOTE: This is the lightweight free-mode path. Course-mode lessons go through
 * the full 5-phase TeachingAgent at /api/learn/lesson/[conceptId].
 */

import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient }             from "@/lib/supabase/server";
import type { DynamicProfile }      from "@/store/useAristoStore";
import { MODELS }                   from "@/lib/agents/models";
import { getAnthropic }             from "@/lib/llm/anthropic";

const client = getAnthropic();

// ─── Tool ─────────────────────────────────────────────────────────────────────

const structuredTool: Anthropic.Tool = {
  name: "teach_topic",
  description: "Return a structured teaching card for a free-form topic.",
  input_schema: {
    type: "object",
    properties: {
      definition: {
        type: "string",
        description: "Concise, accurate definition of the topic.",
      },
      explanation: {
        type: "string",
        description: "Core explanation, 2-4 sentences, age-appropriate.",
      },
      example: {
        type: "string",
        description: "A concrete example that grounds the explanation.",
      },
      fun_fact: {
        type: "string",
        description: "An engaging fact related to the topic.",
      },
      should_generate_model: {
        type: "boolean",
        description:
          "True only for physical/tangible subjects that benefit from 3D visualization (organs, molecules, planets, machines). False for abstract concepts, processes, math, history.",
      },
      model_image_prompt: {
        type: "string",
        description:
          "If should_generate_model is true: rich educational infographic prompt for FLUX — include labeled diagram style, cross-sections, annotations, vivid colors, educational poster aesthetic. Empty string if false.",
      },
      model_3d_prompt: {
        type: "string",
        description:
          "If should_generate_model is true: SHORT clean object description for 3D reconstruction — single isolated object, no text, no labels, plain white background. E.g. 'human heart, anatomically accurate, red muscle tissue, isolated, centered'. Empty string if false.",
      },
      annotation_hints: {
        type: "array",
        items: { type: "string" },
        description: "3-5 key parts to label on a 3D model. Empty if no model.",
      },
    },
    required: [
      "definition",
      "explanation",
      "example",
      "fun_fact",
      "should_generate_model",
      "model_image_prompt",
      "model_3d_prompt",
      "annotation_hints",
    ],
  },
};

// ─── Profile-shaped system prompt ─────────────────────────────────────────────

function buildSystemPrompt(profile: DynamicProfile | null): string {
  const p = profile ?? {
    expertise_level: "beginner",
    explanation_depth: "moderate",
    pace: "moderate",
    example_preference: "concrete",
  };

  return `You are Aristo, a warm and enthusiastic AI tutor for middle-school students answering a free-form question.

<learner_profile>
Expertise level: ${p.expertise_level}
Explanation depth: ${p.explanation_depth}
Pace: ${p.pace}
Example preference: ${p.example_preference}
</learner_profile>

How to write each field:
- definition: Plain and accurate. Match the depth preference above.
- explanation: 2-4 sentences. Ground the idea in a concrete analogy or scenario before introducing precise terms. If "concise", keep it tight; if "detailed", include the underlying mechanism.
- example: An ${p.example_preference === "abstract" ? "abstract or principle-level" : p.example_preference === "mixed" ? "example that mixes a concrete scenario with the underlying principle" : "concrete, vivid"} example.
- fun_fact: One engaging, accurate fact that connects the topic to something the learner likely knows.

Rules:
- Age-appropriate for grades 6-8.
- Set should_generate_model true ONLY for physical/tangible subjects that genuinely benefit from 3D visualization. NOT for abstract concepts, processes, code, math formulas, emotions, or historical events.
- annotation_hints: 3-5 key physical parts to label on a 3D model.`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as {
      topic?: string;
      history?: string[];
    };

    const { topic, history = [] } = body;

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    // Load learner profile (best-effort)
    const { data: lpRow } = await supabase
      .from("learner_profiles")
      .select("expertise_level, pace, explanation_depth, example_preference")
      .eq("user_id", user.id)
      .maybeSingle();

    const profile: DynamicProfile | null = lpRow
      ? {
          expertise_level:    lpRow.expertise_level    ?? "beginner",
          pace:               lpRow.pace               ?? "moderate",
          explanation_depth:  lpRow.explanation_depth  ?? "moderate",
          example_preference: lpRow.example_preference ?? "concrete",
        }
      : null;

    const historyContext =
      history.length > 0
        ? `\n\nTopics already covered this session: ${history.join(", ")}`
        : "";

    const response = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(profile),
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [structuredTool],
      tool_choice: { type: "any" },
      messages: [
        {
          role: "user",
          content: `Teach me about: ${topic}${historyContext}`,
        },
      ],
    }, { feature: "teach.chat", userId: user.id, metadata: { topic } });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No structured response from model");
    }

    return NextResponse.json(toolUse.input);
  } catch (error) {
    console.error("Teaching API error:", error);
    return NextResponse.json(
      { error: "Failed to generate teaching response" },
      { status: 500 }
    );
  }
}
