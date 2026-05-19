// POST /api/kg/generate/:domain
// Admin-only. Uses Claude Sonnet to generate a knowledge graph for a given
// domain. Returns the concepts array for review — does NOT auto-commit to DB.
// Caller should review then POST /api/kg/concepts to commit.
//
// Body (optional): { subject?: string }  — human-readable subject label
// The domain param is the snake_case machine identifier (e.g. "python_programming")

import { NextRequest, NextResponse } from "next/server";
import { MODELS }                    from "@/lib/agents/models";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";
import { getAnthropic }              from "@/lib/llm/anthropic";

const client = getAnthropic();

// The exact prompt from spec §2.3
const GRAPH_GENERATION_PROMPT = (subject: string, domain: string) => `
You are an expert curriculum designer. Generate a knowledge graph for the subject: ${subject}.

For each concept, provide:
- id: snake_case unique identifier prefixed with "${domain}_" (e.g. "${domain}_variables")
- name: human-readable name
- description: 1-2 sentence description
- domain: "${domain}"
- prerequisites: list of concept ids that must be learned first (empty list for foundational concepts)
- difficulty: 1-5 (1=beginner, 5=advanced)
- bloom_level: one of [remember, understand, apply, analyze, evaluate, create]
- estimated_minutes: estimated time to learn (5-30)
- key_terms: list of important terms
- learning_objectives: list of 2-4 specific, measurable objectives
- common_misconceptions: list of 2-3 things learners commonly get wrong
- tags: list of topic tags

Rules:
- Start with foundational concepts that have NO prerequisites
- Build up progressively — every concept except the foundations must list at least one prerequisite
- Aim for 40-60 concepts for an introductory course
- The graph must be a DAG (no circular dependencies)
- Group related concepts logically
- All prerequisite ids must reference other concepts in YOUR output, not external ids

Return ONLY a valid JSON array of concept objects. No explanation, no markdown, just the JSON array.
`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { domain } = await params;
    const body    = await req.json().catch(() => ({}));
    const subject = body.subject ?? domain.replace(/_/g, " ");

    const message = await client.messages.create(
      {
        model:      MODELS.teaching,
        max_tokens: 8192,
        messages: [
          { role: "user", content: GRAPH_GENERATION_PROMPT(subject, domain) },
        ],
      },
      { feature: "kg.generate", userId: user.id, metadata: { domain, subject } }
    );

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "LLM did not return a valid JSON array", raw: rawText.slice(0, 500) },
        { status: 502 }
      );
    }

    const concepts = JSON.parse(jsonMatch[0]);

    await logAdminAction({
      actorId:    user.id,
      actorEmail: user.email,
      action:     "kg.generate",
      targetType: "domain",
      targetId:   domain,
      diff:       { params: { subject, count: concepts.length } },
      request:    req,
    });

    return NextResponse.json({
      domain,
      count: concepts.length,
      concepts,
      note:  "Review these concepts before committing. POST to /api/kg/concepts to save.",
    });
  } catch (err) {
    console.error("[POST /api/kg/generate/:domain]", err);
    return NextResponse.json({ error: "Graph generation failed" }, { status: 500 });
  }
}
