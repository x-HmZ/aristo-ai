// The /demo widget topic Hmz picked (2026-10-15): "steepness is speed", the idea behind differentiation framed for
// grade 8. One live lesson (interactive flag on for this run only), its widget, the segment images (fal
// nano-banana-2, "fast" tier) and the desk quiz. Loads only ANTHROPIC_API_KEY and FAL_KEY; usage is captured here,
// nothing is written to the database. Stops before a call that could take the run past MAX_USD.
// Usage: yarn vitest run --config .claude/eval/2026-10-15-steepness/scripts/vitest.config.mts
import fs from "node:fs";
import path from "node:path";
import { expect, it, vi } from "vitest";

const usage = vi.hoisted(() => [] as Array<{ cost_usd_micros?: number; feature: string }>);
vi.mock("@/lib/llm/usage", () => ({ logUsage: (e: (typeof usage)[number]) => { usage.push(e); } }));
vi.mock("@/lib/llm/fal", () => ({ logFalGeneration: () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => { throw new Error("no DB in this script"); } }));

const ROOT = path.resolve(__dirname, "../../../..");
const OUT = path.resolve(__dirname, "..");
const SLUG = "steepness-speed";
const MAX_USD = 0.6;
const IMAGE_USD = 0.08;

const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const read = (k: string) => (env.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m")) || [])[1];
process.env.ANTHROPIC_API_KEY = read("ANTHROPIC_API_KEY");
process.env.FAL_KEY = read("FAL_KEY");
process.env.NEXT_PUBLIC_ADAPTIVE_VISUALS = read("NEXT_PUBLIC_ADAPTIVE_VISUALS");
process.env.NEXT_PUBLIC_INTERACTIVE_VISUALS = "true";

const concept = {
  id: SLUG,
  name: "Steepness is speed: reading a distance-time graph",
  domain: "math",
  description:
    "On a distance-time graph the steepness of the line at a moment is the speed at that moment. A straight line means a steady speed; a curve means the speed is changing, and the slope of the line that just touches the curve there (the tangent) is the speed right then. Flat means stopped.",
  learning_objectives: [
    "Read speed as the steepness of a distance-time graph, not its height",
    "Tell steady speed (straight line) from changing speed (curve)",
    "Estimate the speed at one moment from the steepness of the touching line",
  ],
  common_misconceptions: ["A higher point on the graph means going faster", "A curve on the graph means the path was curved"],
  prerequisites: ["slope as rise over run", "speed = distance / time"],
};

const spentUsd = (images: number) => usage.reduce((s, e) => s + (e.cost_usd_micros ?? 0), 0) / 1e6 + images * IMAGE_USD;

it("makes the steepness demo lesson, widget, images and quiz", { timeout: 20 * 60_000 }, async () => {
  const { generateLesson } = await import("@/lib/agents/teaching");
  const { generateInteractive } = await import("@/lib/agents/interactive");
  const { generateInfographic } = await import("@/lib/imagegen/banana");
  const { generateLessonQuiz } = await import("@/lib/agents/assessment");

  const lesson = await generateLesson(concept, null, []);
  fs.writeFileSync(path.join(OUT, "lesson.json"), JSON.stringify(lesson, null, 2));
  const spec = lesson.metadata.interactive;
  expect(spec, "the lesson should ask for a widget").toBeTruthy();
  fs.writeFileSync(path.join(OUT, "spec.json"), JSON.stringify(spec, null, 2));

  const parts = await generateInteractive({ topic: concept.name, spec: spec! });
  fs.writeFileSync(path.join(OUT, "widget.json"), JSON.stringify(parts, null, 2));

  const pub = path.join(ROOT, "public", "demo", SLUG);
  fs.mkdirSync(pub, { recursive: true });
  const images: Record<string, string> = {};
  for (const seg of (lesson.segments ?? []).filter((s) => s.visual)) {
    if (spentUsd(Object.keys(images).length + 1) > MAX_USD) break;
    const { imageUrl } = await generateInfographic({
      prompt: seg.visual!.prompt, style: seg.visual!.style, tier: "fast", bypassCache: true, feature: "demo.segment_visual",
    });
    const res = await fetch(imageUrl);
    expect(res.ok).toBe(true);
    fs.writeFileSync(path.join(pub, `${seg.id}.png`), Buffer.from(await res.arrayBuffer()));
    images[seg.id] = `/demo/${SLUG}/${seg.id}.png`;
  }

  const quiz = spentUsd(Object.keys(images).length) < MAX_USD - 0.05
    ? await generateLessonQuiz({ id: SLUG, name: concept.name, description: concept.description, domain: "math" }, 0.3, 4)
    : [];

  const out = { images, quiz, usd: spentUsd(Object.keys(images).length), calls: usage.map((u) => u.feature) };
  fs.writeFileSync(path.join(OUT, "assets.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ images: Object.keys(images), quiz: quiz.map((q) => q.question_type), usd: out.usd }));
  expect(out.usd).toBeLessThan(MAX_USD);
});
