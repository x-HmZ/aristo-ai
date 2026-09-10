/**
 * One-off: build the "heart" demo topic, which replaces "black-holes".
 *
 * Deliberately makes ZERO fal.ai calls. Both visual assets already exist,
 * paid for by the 2026-09-09 pipeline eval (see
 * .claude/eval/2026-09-09-pipeline/README.md):
 *
 *   public/demo/heart/model.glb    the 3D heart, Draco-compressed
 *   public/demo/heart/teaching.jpg the NB Pro teaching image
 *
 * So the only spend here is the Anthropic call that writes the lesson.
 *
 * No per-segment visuals are generated. useLessonPlayback holds the last
 * visible image when a segment supplies none ("sticky semantics", so the
 * avatar never points at empty air), so attaching the teaching image to the
 * first segment that wanted a visual carries it through the whole lesson.
 * The trade is that the heart lesson shows one board where the volcano
 * changes twice; adding segment visuals later costs ~$0.08 each and does not
 * touch the narration.
 *
 * Run: npx tsx scripts/generate-demo-heart.ts [--dry-run]
 */

import dotenv from "dotenv";
import { existsSync, writeFileSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = "C:\\Users\\Pc\\Desktop\\Empire\\Artisto\\Aristo 2.0\\Aristo-AI";

dotenv.config({ path: path.join(ROOT, ".env.local") });
process.env.NEXT_PUBLIC_ADAPTIVE_VISUALS = "true";

const DRY = process.argv.includes("--dry-run");

const SLUG = "heart";
const MODEL_URL = `/demo/${SLUG}/model.glb`;
const TEACHING_IMAGE = `/demo/${SLUG}/teaching.jpg`;

const concept = {
  id:          "human-heart",
  name:        "How the Heart Pumps Blood",
  description:
    "How the four chambers of the heart move blood through the body and the lungs, and why it flows in one direction only.",
  domain:      "biology",
  learning_objectives: [
    "Name the four chambers of the heart and what each one does",
    "Trace the path blood takes through the heart, the lungs and the body",
    "Explain why the valves make blood flow in only one direction",
  ],
  key_terms: ["atrium", "ventricle", "valve", "aorta", "oxygen", "circulation"],
  common_misconceptions: [
    "The heart is a single pump rather than two pumps working side by side",
    "Blood in veins is blue until it touches air",
    "The heart oxygenates blood itself, rather than sending it to the lungs",
  ],
};

/**
 * Hand-written rather than generated, matching how the other two demo topics
 * do it: the quiz is the one part a visitor is graded on, so it is worth
 * knowing exactly what it says.
 */
const quiz = [
  {
    question_type: "multiple_choice" as const,
    bloom_level:   "remember" as const,
    question:      "Which chamber pushes blood out to the rest of the body?",
    options:       ["Left ventricle", "Right atrium", "Left atrium", "Right ventricle"],
    correct_answer: "Left ventricle",
    explanation_correct:
      "The left ventricle has the thickest muscle because it has to push blood all the way around the body through the aorta.",
    explanation_wrong: {
      "Right atrium":    "The right atrium receives blood coming back from the body; it does not push it out again.",
      "Left atrium":     "The left atrium receives blood returning from the lungs and passes it down to the left ventricle.",
      "Right ventricle": "The right ventricle pumps blood to the lungs, not to the rest of the body.",
    },
    difficulty: 0.35,
  },
  {
    question_type: "true_false" as const,
    bloom_level:   "understand" as const,
    question:      "The valves in the heart are what stop blood flowing backwards.",
    options:       ["True", "False"],
    correct_answer: "True",
    explanation_correct:
      "Each valve opens one way only. When the pressure behind it drops, it snaps shut, which is what makes blood travel in a single direction and what you hear as a heartbeat.",
    difficulty: 0.4,
  },
];

async function main() {
  for (const [label, rel] of [["model", MODEL_URL], ["teaching image", TEACHING_IMAGE]] as const) {
    const abs = path.join(ROOT, "public", rel.replace(/^\//, ""));
    if (!existsSync(abs)) throw new Error(`${label} missing at ${abs} — nothing to point the lesson at.`);
    console.log(`found ${label}: ${rel}`);
  }

  if (DRY) {
    console.log("\nDRY RUN. Would make one Anthropic call (generateLesson) and zero fal calls.");
    console.log(`Concept: ${concept.name}`);
    return;
  }

  const { generateLesson } = await import(
    pathToFileURL(path.join(ROOT, "src/lib/agents/teaching.ts")).href
  );

  const profile = {
    expertise_level:    "beginner" as const,
    pace:               "moderate" as const,
    explanation_depth:  "moderate" as const,
    example_preference: "concrete" as const,
  };

  console.log(`\n=== Generating lesson: ${concept.name} ===`);
  const lesson = await generateLesson(concept, profile, []);
  const segments = lesson.segments ?? [];
  console.log(`  segments: ${segments.length}`);

  // Attach the one image we already own to the first segment that asked for a
  // visual. Every later segment without its own visual inherits it.
  const firstWanting = segments.find((s: { visual?: { prompt?: string } }) => s.visual?.prompt);
  if (firstWanting) {
    firstWanting.visual.imageUrl = TEACHING_IMAGE;
    console.log(`  visual -> ${firstWanting.id} gets ${TEACHING_IMAGE} (sticky for the rest)`);
  } else {
    console.warn("  no segment requested a visual; the board will stay empty");
  }
  const wanted = segments.filter((s: { visual?: { prompt?: string } }) => s.visual?.prompt).length;
  console.log(`  ${wanted} segment(s) wanted a visual; ${Math.max(0, wanted - 1)} will inherit it`);

  lesson.metadata.should_generate_model = true;
  lesson.metadata.demo_model_url        = MODEL_URL;
  // The heart's sides and back differ from its front, so if this topic were
  // ever regenerated live it should take the four-view path.
  lesson.metadata.model_needs_multiview = true;

  const finalizedQuiz = quiz.map((q, i) => ({
    id:         `${SLUG}-q${i + 1}`,
    concept_id: concept.id,
    ...q,
  }));

  const tsSource = `/**
 * FROZEN DEMO CONTENT — generated once by scripts/generate-demo-heart.ts.
 * Do not hand-edit; regenerate via the script if the source concept changes.
 * Served with zero Anthropic/fal.ai calls at runtime (public/demo/${SLUG}/...).
 *
 * The 3D model and the teaching image were produced by the 2026-09-09 pipeline
 * eval, not by this script — it makes no fal calls at all.
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

export const lesson: LessonPayload = ${JSON.stringify(lesson, null, 2)};

export const quiz: QuizQuestion[] = ${JSON.stringify(finalizedQuiz, null, 2)};
`;

  const outFile = path.join(ROOT, "src", "data", "demo", `${SLUG}.ts`);
  writeFileSync(outFile, tsSource, "utf8");
  console.log(`  -> wrote ${outFile}`);
  console.log("\nDone. fal.ai spend: $0.00");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
