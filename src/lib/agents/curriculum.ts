/**
 * CurriculumAgent
 *
 * Generates a personalized course structure from the knowledge graph.
 * Implements spec §5.3 and §8.5.
 *
 * Steps:
 *  1. Load all concepts for the domain in topological order.
 *  2. Filter out already-mastered concepts (mastery ≥ 0.9).
 *  3. Call Claude Sonnet (spec §8.5) to group them into modules + lessons.
 *  4. Return a CourseStructure ready for DB storage.
 */

import type Anthropic              from "@anthropic-ai/sdk";
import type { SupabaseClient }      from "@supabase/supabase-js";
import { topologicalSort }          from "@/lib/kg/graph";
import type { Concept }             from "@/lib/kg/types";
import { MODELS }                   from "./models";
import { getAnthropic }             from "@/lib/llm/anthropic";

const client = getAnthropic();

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CourseLesson {
  id:          string;
  title:       string;
  concept_ids: string[];
}

export interface CourseModule {
  id:          string;
  title:       string;
  description: string;
  lessons:     CourseLesson[];
}

export interface CourseStructure {
  modules: CourseModule[];
}

export interface GeneratedCourse {
  id:             string;
  domain:         string;
  title:          string;
  description:    string;
  structure:      CourseStructure;
  estimated_hours: number;
}

// ─── Curriculum Agent (spec §8.5) ─────────────────────────────────────────────

export async function generateCourse(
  domain:   string,
  goal:     string,
  userId:   string,
  supabase: SupabaseClient
): Promise<GeneratedCourse> {

  // 1. Topological order of all domain concepts
  let orderedConceptIds: string[];
  try {
    const sorted: Concept[] = await topologicalSort(supabase, domain);
    orderedConceptIds = sorted.map((c) => c.id);
  } catch {
    // Fallback: query ordered by difficulty if graph has a cycle
    const { data } = await supabase
      .from("concepts")
      .select("id")
      .eq("domain", domain)
      .order("difficulty", { ascending: true });
    orderedConceptIds = (data ?? []).map((c: { id: string }) => c.id);
  }

  if (orderedConceptIds.length === 0) {
    throw new Error(`No concepts found for domain: ${domain}`);
  }

  // 2. Load concept details
  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name, description, difficulty, bloom_level, estimated_minutes")
    .in("id", orderedConceptIds);

  // Sort by topological order
  const conceptMap = new Map((concepts ?? []).map((c: { id: string }) => [c.id, c]));
  const orderedConcepts = orderedConceptIds
    .map((id) => conceptMap.get(id))
    .filter(Boolean) as Array<{
      id: string; name: string; description: string;
      difficulty: number; bloom_level: string; estimated_minutes: number;
    }>;

  // 3. Filter out mastered concepts (score ≥ 0.9) for this user
  const { data: mastered } = await supabase
    .from("user_concept_mastery")
    .select("concept_id")
    .eq("user_id", userId)
    .gte("mastery_score", 0.9);

  const masteredIds = new Set((mastered ?? []).map((m: { concept_id: string }) => m.concept_id));
  const remaining = orderedConcepts.filter((c) => !masteredIds.has(c.id));

  // If everything is mastered use all concepts (edge case)
  const toTeach = remaining.length > 0 ? remaining : orderedConcepts;

  // 4. Call Claude Sonnet to group into modules/lessons (spec §8.5)
  const conceptList = toTeach.map((c) => ({
    id:         c.id,
    name:       c.name,
    difficulty: c.difficulty,
  }));

  const prompt = `You are a curriculum designer. Given the following list of concepts (already in valid prerequisite order), group them into a course structure.

<concepts_in_order>
${JSON.stringify(conceptList, null, 2)}
</concepts_in_order>

<learner_goal>
${goal || "Learn this subject from scratch"}
</learner_goal>

Create a course with:
- 3-8 modules, each covering a coherent topic area
- 2-5 lessons per module, each containing 1-3 related concepts
- A descriptive title and 1-sentence description for each module and lesson
- Concepts should not be split across modules if they share direct prerequisites
- Every concept must appear in exactly one lesson

Return JSON only (no other text):
{
  "title": "Course title",
  "description": "1-2 sentence description",
  "estimated_hours": 0,
  "modules": [
    {
      "title": "Module title",
      "description": "one sentence",
      "lessons": [
        {
          "title": "Lesson title",
          "concept_ids": ["concept_id_1", "concept_id_2"]
        }
      ]
    }
  ]
}`;

  const response = await client.messages.create(
    {
      model:      MODELS.teaching,   // Sonnet
      max_tokens: 4096,
      messages:   [{ role: "user", content: prompt }],
    },
    { feature: "curriculum.generate", userId, metadata: { domain, goal } }
  );

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ??
                    text.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) throw new Error("CurriculumAgent: no JSON in response");

  const parsed = JSON.parse(jsonMatch[1]);

  // Build the typed structure with deterministic IDs
  const structure: CourseStructure = {
    modules: (parsed.modules ?? []).map((mod: {
      title: string; description: string;
      lessons: Array<{ title: string; concept_ids: string[] }>;
    }, mi: number) => ({
      id:          `mod_${mi + 1}`,
      title:       mod.title,
      description: mod.description ?? "",
      lessons:     (mod.lessons ?? []).map((les, li: number) => ({
        id:          `lesson_${mi + 1}_${li + 1}`,
        title:       les.title,
        concept_ids: les.concept_ids ?? [],
      })),
    })),
  };

  const courseId = `course_${domain}_${Date.now()}`;

  return {
    id:              courseId,
    domain,
    title:           parsed.title ?? `${domain} Course`,
    description:     parsed.description ?? "",
    structure,
    estimated_hours: parsed.estimated_hours ?? Math.ceil(toTeach.length * 15 / 60),
  };
}

// ─── Select next concept in a course ─────────────────────────────────────────

export function flattenCourseConceptIds(structure: CourseStructure): string[] {
  return structure.modules.flatMap((m) =>
    m.lessons.flatMap((l) => l.concept_ids)
  );
}
