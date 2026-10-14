// Regenerates widgets from their saved specs with the current generator prompt (approved by Hmz 2026-10-15:
// if/elif and probability, to check the "show only what really happens" and "say each thing once" rules).
// Anthropic only; usage captured in-process. Writes <slug>-v2/widget.json beside the originals.
// Usage: yarn vitest run --config .claude/eval/2026-10-14-v10-live/scripts/vitest.regen.config.mts
import fs from "node:fs";
import path from "node:path";
import { expect, it, vi } from "vitest";

const usage = vi.hoisted(() => [] as Array<{ cost_usd_micros?: number }>);
vi.mock("@/lib/llm/usage", () => ({ logUsage: (e: (typeof usage)[number]) => { usage.push(e); } }));

const ROOT = path.resolve(__dirname, "../../../..");
const DIR = path.resolve(__dirname, "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
process.env.ANTHROPIC_API_KEY = (env.match(/^ANTHROPIC_API_KEY\s*=\s*"?([^"\r\n]*)"?/m) || [])[1];

const SLUGS: Array<[string, string]> = [
  ["python-if-elif", "Python if, elif and else"],
  ["experimental-probability", "Experimental vs theoretical probability"],
];

it("regenerates the two widgets", { timeout: 10 * 60_000 }, async () => {
  const { generateInteractive } = await import("@/lib/agents/interactive");
  for (const [slug, topic] of SLUGS) {
    const spec = JSON.parse(fs.readFileSync(path.join(DIR, slug, "spec.json"), "utf8"));
    const parts = await generateInteractive({ topic, spec });
    fs.mkdirSync(path.join(DIR, `${slug}-v2`), { recursive: true });
    fs.writeFileSync(path.join(DIR, `${slug}-v2`, "widget.json"), JSON.stringify(parts, null, 2));
  }
  const usd = usage.reduce((s, e) => s + (e.cost_usd_micros ?? 0), 0) / 1e6;
  console.log(`spent ${usd.toFixed(4)} USD over ${usage.length} calls`);
  expect(usd).toBeLessThan(0.2);
});
