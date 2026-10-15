// /demo assets for the frozen python-for-range topic (approved by Hmz 2026-10-14): its two segment images
// (fal nano-banana-2, "fast" tier, 0.08 USD each) and its desk quiz (one assessment-agent call).
// Loads only FAL_KEY and ANTHROPIC_API_KEY; usage and Supabase persistence are stubbed, nothing touches the DB.
// Writes public/demo/python-for-range/<seg>.png and demo-assets.json (image paths, quiz, cost).
// Usage: yarn vitest run --config .claude/eval/2026-10-14-v10-live/scripts/vitest.demo.config.mts
import fs from "node:fs";
import path from "node:path";
import { expect, it, vi } from "vitest";

const usage = vi.hoisted(() => [] as Array<{ cost_usd_micros?: number; feature: string }>);
vi.mock("@/lib/llm/usage", () => ({ logUsage: (e: (typeof usage)[number]) => { usage.push(e); } }));
vi.mock("@/lib/llm/fal", () => ({ logFalGeneration: () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => { throw new Error("no DB in this script"); } }));

const ROOT = path.resolve(__dirname, "../../../..");
const SLUG = "python-for-range";
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const read = (k: string) => (env.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m")) || [])[1];
process.env.FAL_KEY = read("FAL_KEY");
process.env.ANTHROPIC_API_KEY = read("ANTHROPIC_API_KEY");

it("makes the python-for-range demo images and quiz", { timeout: 10 * 60_000 }, async () => {
  const lesson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", SLUG, "lesson.json"), "utf8"));
  const { generateInfographic } = await import("@/lib/imagegen/banana");
  const { generateLessonQuiz } = await import("@/lib/agents/assessment");

  const outDir = path.join(ROOT, "public", "demo", SLUG);
  fs.mkdirSync(outDir, { recursive: true });
  const images: Record<string, string> = {};
  const withVisual = lesson.segments.filter((s: { visual?: unknown }) => s.visual);
  expect(withVisual.length).toBe(2);
  for (const seg of withVisual) {
    const { imageUrl } = await generateInfographic({
      prompt: seg.visual.prompt, style: seg.visual.style, tier: "fast", bypassCache: true, feature: "demo.segment_visual",
    });
    const res = await fetch(imageUrl);
    expect(res.ok).toBe(true);
    fs.writeFileSync(path.join(outDir, `${seg.id}.png`), Buffer.from(await res.arrayBuffer()));
    images[seg.id] = `/demo/${SLUG}/${seg.id}.png`;
  }

  const quiz = await generateLessonQuiz({
    id: SLUG, name: lesson.concept_name, domain: "python programming",
    description: "A for loop repeats a block once for each value range() produces; range(start, stop, step) stops before stop.",
  } as never, 0.3, 4);

  const out = { images, quiz, falUsd: 0.08 * withVisual.length, anthropicUsd: usage.reduce((s, e) => s + (e.cost_usd_micros ?? 0), 0) / 1e6 };
  fs.writeFileSync(path.join(__dirname, "..", SLUG, "demo-assets.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ images, quizCount: quiz.length, falUsd: out.falUsd, anthropicUsd: out.anthropicUsd }));
});
