/**
 * GreetingAgent
 *
 * V4 "teacher who remembers you" — session-open synthesis.
 * Builds a short, warm, personalized greeting from EXISTING tables (no
 * schema change) and one suggested next action. Called once per day per
 * user by GET /api/learn/greeting (Haiku, cheap).
 *
 * Guardrails (see .claude/plans/V4-teacher-memory.md):
 *  - At most ONE specific memory back-reference.
 *  - Never state raw scores, streak counts as a threat, or "you failed" framing.
 *  - suggested_action.type must come from the caller-provided allowed list.
 */

import type Anthropic   from "@anthropic-ai/sdk";
import { MODELS }       from "./models";
import { getAnthropic } from "@/lib/llm/anthropic";

const client = getAnthropic();

export type SuggestedActionType = "resume_course" | "review" | "new_topic";

export interface GreetingResult {
  greeting_speech:  string;
  suggested_action: {
    type:  SuggestedActionType;
    label: string;
  };
}

export interface GreetingContext {
  firstName:            string;
  daysSinceLastSession: number | null;   // null when no prior session
  lastConceptsViewed:   string[];         // resolved concept names, up to 2
  topOpenMisconception: { conceptName: string; text: string } | null;
  strongConcept:        string | null;    // name of a recently-mastered concept (comeback fact)
  overdueReviewCount:   number;
  streakDays:           number;
  hasCourseInProgress:  boolean;
  allowedActions:       SuggestedActionType[];
}

// ─── Tool schema ─────────────────────────────────────────────────────────────

const greetingTool: Anthropic.Tool = {
  name: "deliver_greeting",
  description: "Return the session-open greeting the avatar will speak, plus one suggested next action.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      greeting_speech: { type: "string" },
      suggested_action: {
        type: "object",
        additionalProperties: false,
        properties: {
          type:  { type: "string", enum: ["resume_course", "review", "new_topic"] },
          label: { type: "string" },
        },
        required: ["type", "label"],
      },
    },
    required: ["greeting_speech", "suggested_action"],
  },
};

const SYSTEM_PROMPT = `You are a warm, encouraging middle-school (grades 6-8) tutor greeting a returning student as they open the app for a new session.

Write a short spoken greeting (2-3 sentences, said out loud by the avatar) plus ONE suggested next action.

RULES:
- Reference AT MOST ONE specific fact from <student_history>. Do not stack multiple memories into one greeting — it feels creepy, not warm.
- NEVER state raw scores, percentages, or counts of wrong answers. NEVER use shame framing ("you failed", "you got X wrong", "you're behind"). Frame any past struggle as a normal, expected part of learning and an opportunity for a "comeback" or "rematch" — never a deficiency.
- NEVER invent facts that are not present in <student_history>. If nothing stands out, keep the greeting generic and encouraging.
- Keep it age-appropriate, upbeat, concise. No emoji in the spoken text.
- suggested_action.type MUST be one of the values listed in <allowed_actions>. Prefer the action most relevant to the memory you referenced, otherwise follow the priority order given.
- suggested_action.label is a short (<= 6 words) call-to-action for a tappable button, written in the second person ("Continue ratios", "Catch up on reviews").

Return your response by calling the deliver_greeting tool.`;

function buildUserMessage(ctx: GreetingContext): string {
  const facts: string[] = [];

  if (ctx.daysSinceLastSession !== null) {
    facts.push(
      ctx.daysSinceLastSession <= 0
        ? "Studied earlier today already."
        : `Last studied ${ctx.daysSinceLastSession} day${ctx.daysSinceLastSession === 1 ? "" : "s"} ago.`
    );
  }
  if (ctx.lastConceptsViewed.length > 0) {
    facts.push(`Last session covered: ${ctx.lastConceptsViewed.join(", ")}.`);
  }
  if (ctx.topOpenMisconception) {
    facts.push(
      `Had a mix-up on "${ctx.topOpenMisconception.conceptName}": ${ctx.topOpenMisconception.text} — has not had a rematch on it yet.`
    );
  }
  if (ctx.strongConcept) {
    facts.push(`Recently built strong understanding of "${ctx.strongConcept}".`);
  }
  if (ctx.streakDays >= 2) {
    facts.push(`On a ${ctx.streakDays}-day learning streak.`);
  }

  return `<student>
First name: ${ctx.firstName}
</student>

<student_history>
${facts.length > 0 ? facts.map((f) => `- ${f}`).join("\n") : "No notable facts this time — keep it generic and encouraging."}
</student_history>

<situation>
Overdue spaced-repetition reviews: ${ctx.overdueReviewCount}
Has a course in progress: ${ctx.hasCourseInProgress ? "yes" : "no"}
</situation>

<allowed_actions>
${ctx.allowedActions.join(", ")}
</allowed_actions>

Write the greeting and pick one suggested action from the allowed list.`;
}

// ─── Main generator ──────────────────────────────────────────────────────────

export async function generateGreeting(ctx: GreetingContext): Promise<GreetingResult> {
  const response = await client.messages.create(
    {
      model:       MODELS.fast,
      max_tokens:  400,
      system:      SYSTEM_PROMPT,
      tools:       [greetingTool],
      tool_choice: { type: "tool", name: "deliver_greeting" },
      messages:    [{ role: "user", content: buildUserMessage(ctx) }],
    },
    { feature: "learn.greeting" }
  );

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("GreetingAgent: model did not return tool_use");
  }

  const out = toolUse.input as GreetingResult;
  if (!out.greeting_speech || !out.suggested_action?.type) {
    throw new Error("GreetingAgent: tool_use missing required fields");
  }

  return out;
}
