/**
 * One-off: build the "brain" demo lesson (V8.3c), taught in the landing's classroom (Step Into the Classroom).
 *
 * Spend: one Anthropic call (generateLesson) and one fal call, the board's teaching image through the production
 * pipeline (`generateInfographic`, nano-banana-pro, $0.15), for the first segment that asks for a visual; later
 * segments inherit it ("sticky semantics", as the heart lesson does). The 3D model is NOT made here: it is the
 * Tripo3D v2.5 output of the FLUX source `brain-1` from the V8.3c eval
 * (.claude/eval/2026-10-03-v8-3c-landing/volcano/ledger.json), resized into public/demo/brain/model.glb.
 * The eval ledger is checked and appended to, so the session's $2 fal budget (cap $1.80) holds.
 *
 * Narration is rendered and aligned by scripts/prerender-demo-tts.mjs (2026-10-04), after which the topic was
 * listed in DEMO_TOPICS.
 *
 * Run: npx tsx scripts/generate-demo-brain.ts [--dry-run]
 */

import dotenv from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = "C:\\Users\\Pc\\Desktop\\Empire\\Artisto\\Aristo 2.0\\Aristo-AI";

dotenv.config({ path: path.join(ROOT, ".env.local") });
process.env.NEXT_PUBLIC_ADAPTIVE_VISUALS = "true";

const DRY = process.argv.includes("--dry-run");

const SLUG = "brain";
const MODEL_URL = `/demo/${SLUG}/model.glb`;
const LEDGER = path.join(ROOT, ".claude", "eval", "2026-10-03-v8-3c-landing", "volcano", "ledger.json");
const CAP = 1.8;
const IMAGE_COST = 0.15;
/** The FLUX prompt the model was made from (the eval's `brain` prompt), kept as the lesson's own model prompt. */
const MODEL_3D_PROMPT =
  "Anatomical model of the human brain with each lobe a different solid colour: frontal lobe blue, parietal lobe yellow, temporal lobe green, occipital lobe red, cerebellum purple, brainstem grey, glossy plastic school model, three-quarter side view";

const concept = {
  // MUST equal SLUG: demo audio resolves as /demo/<lesson.concept_id>/<segment>.mp3.
  id:          SLUG,
  name:        "How Your Brain Is Organised",
  description:
    "How the brain is divided into lobes and other parts, what each part is in charge of, and how they work together.",
  domain:      "biology",
  learning_objectives: [
    "Name the four lobes of the cerebrum and the main job of each",
    "Explain what the cerebellum and the brainstem do",
    "Describe how different parts of the brain work together on one everyday task",
  ],
  key_terms: ["frontal lobe", "parietal lobe", "temporal lobe", "occipital lobe", "cerebellum", "brainstem"],
  common_misconceptions: [
    "People only use 10 percent of their brain",
    "Each part of the brain works completely on its own",
    "The left brain is logical and the right brain is creative, so people are one or the other",
  ],
};

/** Hand-written, as for the other demo topics: the quiz is the part a visitor is graded on. */
const quiz = [
  {
    question_type: "multiple_choice" as const,
    bloom_level:   "remember" as const,
    question:      "Which part of the brain helps you keep your balance when you ride a bike?",
    options:       ["Cerebellum", "Frontal lobe", "Occipital lobe", "Temporal lobe"],
    correct_answer: "Cerebellum",
    explanation_correct:
      "The cerebellum, at the back under the cerebrum, coordinates your muscles so your movements stay smooth and balanced.",
    explanation_wrong: {
      "Frontal lobe":   "The frontal lobe plans and decides what to do, but the cerebellum keeps the movement balanced.",
      "Occipital lobe": "The occipital lobe, at the very back, makes sense of what your eyes see.",
      "Temporal lobe":  "The temporal lobe, at the sides, handles hearing and memory.",
    },
    difficulty: 0.35,
  },
  {
    question_type: "true_false" as const,
    bloom_level:   "understand" as const,
    question:      "You use only about 10 percent of your brain.",
    options:       ["True", "False"],
    correct_answer: "False",
    explanation_correct:
      "Brain scans show activity all over the brain across a day. Different parts are busier at different times, but none of it sits unused.",
    difficulty: 0.4,
  },
];

interface Entry { at: string; kind: string; id: string; cost: number; url: string; prompt?: string }

async function main() {
  const ledger: Entry[] = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : [];
  const spent = ledger.reduce((s, e) => s + e.cost, 0);
  console.log(`fal spent so far: $${spent.toFixed(3)} (cap $${CAP})`);
  if (spent + IMAGE_COST > CAP + 1e-9) throw new Error("refused: the teaching image would pass the cap");
  if (DRY) {
    console.log(`DRY RUN. Would make one Anthropic call and one $${IMAGE_COST} fal call for ${concept.name}.`);
    return;
  }

  const { generateLesson } = await import(pathToFileURL(path.join(ROOT, "src/lib/agents/teaching.ts")).href);
  const { generateInfographic } = await import(pathToFileURL(path.join(ROOT, "src/lib/imagegen/banana.ts")).href);

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

  const outDir = path.join(ROOT, "public", "demo", SLUG);
  mkdirSync(outDir, { recursive: true });

  const first = segments.find((s: { visual?: { prompt?: string } }) => s.visual?.prompt);
  if (!first) throw new Error("no segment asked for a visual; nothing to put on the board");
  console.log(`  [teaching image] ${first.id}: ${first.visual.prompt.slice(0, 90)}...`);
  const { imageUrl } = await generateInfographic({
    prompt:  first.visual.prompt,
    style:   first.visual.style,
    userId:  null,
    feature: "demo.segment_visual",
  });
  ledger.push({ at: new Date().toISOString(), kind: "nb-pro", id: `brain-teaching-${first.id}`, cost: IMAGE_COST, url: imageUrl, prompt: first.visual.prompt });
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`teaching image download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path.join(outDir, `${first.id}.png`), buf);
  first.visual.imageUrl = `/demo/${SLUG}/${first.id}.png`;
  console.log(`    -> saved ${first.id}.png (${buf.length} bytes); total fal $${(spent + IMAGE_COST).toFixed(3)}`);

  lesson.metadata.should_generate_model = true;
  lesson.metadata.demo_model_url        = MODEL_URL;
  lesson.metadata.model_3d_prompt       = MODEL_3D_PROMPT;
  // The brain's sides and back differ from its front: a live regeneration should take the four-view path.
  lesson.metadata.model_needs_multiview = true;

  const finalizedQuiz = quiz.map((q, i) => ({ id: `${SLUG}-q${i + 1}`, concept_id: concept.id, ...q }));
  const tsSource = `/**
 * FROZEN DEMO CONTENT — generated once by scripts/generate-demo-brain.ts (V8.3c).
 * Do not hand-edit; regenerate via the script if the source concept changes.
 * Served with zero Anthropic/fal.ai calls at runtime (public/demo/${SLUG}/...).
 *
 * The 3D model is the Tripo3D v2.5 output of the V8.3c eval's FLUX source \`brain-1\`, not made by this script.
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

export const lesson: LessonPayload = ${JSON.stringify(lesson, null, 2)};

export const quiz: QuizQuestion[] = ${JSON.stringify(finalizedQuiz, null, 2)};
`;
  const outFile = path.join(ROOT, "src", "data", "demo", `${SLUG}.ts`);
  writeFileSync(outFile, tsSource, "utf8");
  console.log(`  -> wrote ${outFile}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
