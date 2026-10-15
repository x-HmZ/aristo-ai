// Regenerates ONLY the steepness widget, from the curated spec (spec-curated.json: the lesson's own worked example
// plus a curved stretch for the tangent line). Approved by Hmz 2026-10-15; one Anthropic call. Writes widget-v2.json.
// Usage: yarn vitest run --config .claude/eval/2026-10-15-steepness/scripts/vitest.widget.config.mts
import fs from "node:fs";
import path from "node:path";
import { expect, it, vi } from "vitest";

const usage = vi.hoisted(() => [] as Array<{ cost_usd_micros?: number }>);
vi.mock("@/lib/llm/usage", () => ({ logUsage: (e: (typeof usage)[number]) => { usage.push(e); } }));

const ROOT = path.resolve(__dirname, "../../../..");
const OUT = path.resolve(__dirname, "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
process.env.ANTHROPIC_API_KEY = (env.match(/^ANTHROPIC_API_KEY\s*=\s*"?([^"\r\n]*)"?/m) || [])[1];

it("regenerates the steepness widget from the curated spec", { timeout: 10 * 60_000 }, async () => {
  const { parseInteractiveSpec } = await import("@/lib/interactive/spec");
  const { generateInteractive } = await import("@/lib/agents/interactive");
  const spec = parseInteractiveSpec(JSON.parse(fs.readFileSync(path.join(OUT, "spec-curated.json"), "utf8")));
  expect(spec, "curated spec must parse").not.toBeNull();
  const parts = await generateInteractive({ topic: "Steepness is speed: reading a distance-time graph", spec: spec! });
  fs.writeFileSync(path.join(OUT, "widget-v2.json"), JSON.stringify(parts, null, 2));
  const usd = usage.reduce((s, e) => s + (e.cost_usd_micros ?? 0), 0) / 1e6;
  fs.writeFileSync(path.join(OUT, "widget-v2-usage.json"), JSON.stringify({ usd, calls: usage.length }, null, 2));
  expect(usd).toBeLessThan(0.15);
});
