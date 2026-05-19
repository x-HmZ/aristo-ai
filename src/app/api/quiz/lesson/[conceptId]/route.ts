/**
 * GET /api/quiz/lesson/:conceptId
 *
 * Generates a post-lesson quiz (3–5 questions) for a specific concept.
 * Uses AssessmentAgent with the user's current mastery score to tune difficulty.
 * Implements spec §6 + §8.3.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { generateLessonQuiz }        from "@/lib/agents/assessment";
import type { ConceptMeta }          from "@/lib/agents/assessment";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conceptId: string }> }
) {
  try {
    const { conceptId } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 1. Load concept metadata ─────────────────────────────────────────────
    const { data: concept } = await supabase
      .from("concepts")
      .select("id, name, description, domain, bloom_level, learning_objectives, common_misconceptions")
      .eq("id", conceptId)
      .maybeSingle();

    // If the conceptId is not a DB concept ID (free-mode topic string), fall back
    const meta: ConceptMeta = concept
      ? {
          id:                    concept.id,
          name:                  concept.name,
          description:           concept.description,
          domain:                concept.domain,
          bloom_level:           concept.bloom_level,
          learning_objectives:   concept.learning_objectives ?? [],
          common_misconceptions: concept.common_misconceptions ?? [],
        }
      : {
          id:          conceptId,
          name:        conceptId,
          description: `Quiz on: ${conceptId}`,
        };

    // ── 2. Load current mastery ───────────────────────────────────────────────
    const { data: masteryRow } = await supabase
      .from("user_concept_mastery")
      .select("mastery_score")
      .eq("user_id", user.id)
      .eq("concept_id", conceptId)
      .maybeSingle();

    const mastery = masteryRow?.mastery_score ?? 0.1;

    // ── 3. Generate questions ─────────────────────────────────────────────────
    const questions = await generateLessonQuiz(meta, mastery, 4);

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("GET /api/quiz/lesson error:", err);
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  }
}
