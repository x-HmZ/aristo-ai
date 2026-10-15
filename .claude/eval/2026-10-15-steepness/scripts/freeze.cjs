// Writes src/data/demo/steepness-speed.ts from this folder: lesson.json (as generated), spec-curated.json as its
// metadata.interactive, widget-demo.json (curate.cjs) as its frozen widget, the images and the quiz from assets.json
// (true/false and multiple choice only: /demo grades on the client by exact match). Segments keep only their typed
// fields. Run curate.cjs first. Usage: node freeze.cjs
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..");
const ROOT = path.join(DIR, "../../..");
const SLUG = "steepness-speed";
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));

const lesson = read("lesson.json");
const assets = read("assets.json");
const KEEP = ["id", "phase", "role", "text", "visual", "gesture", "pause_after"];
lesson.segments = lesson.segments.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => KEEP.includes(k))));
for (const s of lesson.segments) if (assets.images[s.id]) s.visual.imageUrl = assets.images[s.id];
lesson.concept_id = SLUG;
lesson.metadata.interactive = read("spec-curated.json");
lesson.metadata.demo_interactive = read("widget-demo.json");
const quiz = assets.quiz
  .filter((q) => q.question_type === "true_false" || q.question_type === "multiple_choice")
  .map((q, i) => ({ ...q, id: `${SLUG}-q${i + 1}`, concept_id: SLUG }));

const header = `/**
 * FROZEN DEMO CONTENT: the V10 interactive-visual topic (Hmz, 2026-10-15): steepness is speed, the idea behind
 * differentiation framed for grade 8. Written by .claude/eval/2026-10-15-steepness/scripts/freeze.cjs from that run:
 * the lesson as generated, the curated spec (the lesson's worked example plus a curve for the tangent) and the widget
 * made from it with the edits in curate.cjs. The quiz keeps its true/false and multiple-choice questions: /demo grades
 * on the client by exact match. Served with zero API calls (public/demo/steepness-speed/). Do not hand-edit.
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";
`;
const src = `${header}\nexport const lesson: LessonPayload = ${JSON.stringify(lesson, null, 2)};\n\nexport const quiz: QuizQuestion[] = ${JSON.stringify(quiz, null, 2)};\n`;
fs.writeFileSync(path.join(ROOT, "src/data/demo", `${SLUG}.ts`), src);
console.log(`ok: ${lesson.segments.length} segments, ${Object.keys(assets.images).length} images, ${quiz.length} questions`);
