// V10 live test (approved by Hmz 2026-10-14): six topics through generateLesson, and generateInteractive wherever the
// lesson asked for a widget. Anthropic only: only ANTHROPIC_API_KEY is loaded from .env.local (no FAL_KEY, no
// ElevenLabs), the interactive flag is switched on for this process only, and usage is captured here instead of being
// written to usage_events. A hard budget stops the run before a call that could take it past MAX_USD.
// Usage: yarn vitest run --config .claude/eval/2026-10-14-v10-live/scripts/vitest.live.config.mts
import fs from "node:fs";
import path from "node:path";
import { expect, it, vi } from "vitest";

const events = vi.hoisted(() => [] as Array<{ feature: string; model: string; input_tokens?: number; output_tokens?: number; cost_usd_micros?: number }>);
vi.mock("@/lib/llm/usage", () => ({ logUsage: (e: (typeof events)[number]) => { events.push(e); } }));

const ROOT = path.resolve(__dirname, "../../../..");
const OUT = path.resolve(__dirname, "..");
const MAX_USD = 0.9;
const NEXT_CALL_USD = 0.12; // a generous upper bound for one lesson or one widget

const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const read = (k: string) => (env.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m")) || [])[1];
process.env.ANTHROPIC_API_KEY = read("ANTHROPIC_API_KEY");
process.env.NEXT_PUBLIC_ADAPTIVE_VISUALS = read("NEXT_PUBLIC_ADAPTIVE_VISUALS");
process.env.NEXT_PUBLIC_INTERACTIVE_VISUALS = "true";

const spent = () => events.reduce((s, e) => s + (e.cost_usd_micros ?? 0), 0) / 1e6;

const TOPICS = [
  { slug: "equivalent-fractions", expect: "interactive", concept: {
    id: "live-equivalent-fractions", name: "Equivalent fractions", domain: "math",
    description: "Two fractions are equivalent when they name the same amount, such as 1/2 and 2/4; multiplying or dividing the numerator and denominator by the same number keeps the value.",
    learning_objectives: ["Explain why 1/2 = 2/4 = 4/8", "Generate equivalent fractions by scaling"], common_misconceptions: ["Adding the same number to top and bottom keeps the value"] } },
  { slug: "area-vs-perimeter", expect: "interactive", concept: {
    id: "live-area-vs-perimeter", name: "Area and perimeter of rectangles", domain: "math",
    description: "Area counts the unit squares inside a rectangle (length times width); perimeter is the distance around it. Rectangles with the same perimeter can have different areas.",
    learning_objectives: ["Compute area and perimeter", "See that equal perimeters do not mean equal areas"], common_misconceptions: ["A bigger perimeter always means a bigger area"] } },
  { slug: "experimental-probability", expect: "interactive", concept: {
    id: "live-experimental-probability", name: "Experimental vs theoretical probability", domain: "math",
    description: "Theoretical probability comes from equally likely outcomes; experimental probability comes from repeated trials and gets closer to the theoretical value as the number of trials grows.",
    learning_objectives: ["Compare experimental and theoretical probability", "Explain the effect of more trials"], common_misconceptions: ["After three heads, tails is due"] } },
  { slug: "python-for-range", expect: "interactive", concept: {
    id: "live-python-for-range", name: "Python for loops with range()", domain: "computer science",
    description: "A for loop repeats a block once for each value range() produces; range(start, stop, step) stops before stop.",
    learning_objectives: ["Predict the values range(start, stop, step) gives", "Trace a loop that accumulates a total"], common_misconceptions: ["range(1, 5) includes 5"] } },
  { slug: "python-if-elif", expect: "interactive", concept: {
    id: "live-python-if-elif", name: "Python if, elif and else", domain: "computer science",
    description: "Python checks if and elif conditions from top to bottom and runs only the first branch whose condition is true; else runs when none are.",
    learning_objectives: ["Predict which branch runs for a given value", "Order conditions correctly"], common_misconceptions: ["Every true elif branch runs"] } },
  { slug: "plant-cell", expect: "3D or image", concept: {
    id: "live-plant-cell", name: "Parts of a plant cell", domain: "biology",
    description: "A plant cell has a cell wall, cell membrane, cytoplasm, nucleus, chloroplasts and a large central vacuole, each with a job.",
    learning_objectives: ["Name the main parts of a plant cell", "Say what each part does"], common_misconceptions: ["Plant cells have no membrane because they have a wall"] } },
] as const;

it("generates six live lessons and their widgets", { timeout: 30 * 60_000 }, async () => {
  const { generateLesson } = await import("@/lib/agents/teaching");
  const { generateInteractive } = await import("@/lib/agents/interactive");
  const summary: unknown[] = [];

  for (const t of TOPICS) {
    const dir = path.join(OUT, t.slug);
    fs.mkdirSync(dir, { recursive: true });
    if (spent() + NEXT_CALL_USD > MAX_USD) { summary.push({ slug: t.slug, skipped: `budget (${spent().toFixed(3)} USD spent)` }); continue; }

    const before = events.length;
    const t0 = Date.now();
    const lesson = await generateLesson(t.concept, null, []);
    const lessonMs = Date.now() - t0;
    fs.writeFileSync(path.join(dir, "lesson.json"), JSON.stringify(lesson, null, 2));
    const meta = lesson.metadata as Record<string, unknown>;
    const spec = meta?.interactive ?? null;
    const segs = (lesson.segments ?? []) as Array<{ role?: string; phase?: string; visual?: unknown; text?: string }>;
    const row: Record<string, unknown> = {
      slug: t.slug, expected: t.expect, lessonMs,
      chose: spec ? "interactive" : meta?.should_generate_model ? "3D model" : "images only",
      should_generate_model: meta?.should_generate_model ?? null,
      segments: segs.length,
      explore: segs.findIndex((s) => s.role === "explore"),
      explorePhase: segs.find((s) => s.role === "explore")?.phase ?? null,
      imageSegments: segs.filter((s) => s.visual).length,
    };

    if (spec) {
      fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify(spec, null, 2));
      if (spent() + NEXT_CALL_USD > MAX_USD) row.widget = `skipped: budget (${spent().toFixed(3)} USD spent)`;
      else {
        const w0 = Date.now();
        try {
          const parts = await generateInteractive({ topic: t.concept.name, spec: spec as never });
          fs.writeFileSync(path.join(dir, "widget.json"), JSON.stringify(parts, null, 2));
          row.widget = { ms: Date.now() - w0, bytes: parts.markup.length + parts.css.length + parts.js.length };
        } catch (e) {
          row.widget = `failed: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
    }
    row.calls = events.slice(before).map((e) => ({ feature: e.feature, in: e.input_tokens, out: e.output_tokens, usd: (e.cost_usd_micros ?? 0) / 1e6 }));
    summary.push(row);
    console.log(JSON.stringify(row));
  }

  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ totalUsd: spent(), calls: events.length, topics: summary }, null, 2));
  console.log(`total ${spent().toFixed(4)} USD over ${events.length} calls`);
  expect(spent()).toBeLessThan(1);
});
