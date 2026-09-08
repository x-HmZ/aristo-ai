/**
 * eval-3d-models.ts — T07 throwaway eval script (image->3D model bake-off).
 *
 * NOT part of the app. Run manually, once, to gather evidence for
 * `.claude/plans/T07-REPORT.md`. Do not import this from application code.
 *
 * What it does:
 *   1. Generates one FLUX-Schnell source image per test prompt (same prompt
 *      template as `generate3dSourceImage` in src/lib/imagegen/banana.ts —
 *      duplicated here rather than imported, see note below).
 *   2. Feeds that image into the incumbent (TripoSR) plus each fal.ai
 *      candidate model.
 *   3. Downloads every resulting GLB to a local output directory.
 *   4. Writes a JSON summary (urls, latency, cost) for the report.
 *
 * Why the FLUX/TripoSR calls are NOT routed through
 * src/lib/imagegen/banana.ts + src/lib/llm/fal.ts's logFalGeneration():
 * this repo is on `deploy-prep` (the production branch) and logFalGeneration
 * -> logUsage() inserts rows into the *production* Supabase `usage_events`
 * table via the service-role client. Piping one-off eval traffic into real
 * production cost analytics would corrupt that dashboard. Cost is instead
 * tracked locally in this script (see COST_TABLE) and reported in
 * T07-REPORT.md. The prompt template and fal input params are copied
 * verbatim from banana.ts so results are representative of production
 * behavior.
 *
 * Usage:
 *   npx tsx scripts/eval-3d-models.ts
 *
 * Requires FAL_KEY in .env.local. Hard budget: stop before $5 total spend.
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fal } from "@fal-ai/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Manual .env.local load (no dotenv dependency needed for a throwaway script) ──

function loadEnvLocal(): void {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

if (!process.env.FAL_KEY) {
  console.error("FAL_KEY not found in .env.local — aborting.");
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

// ─── Output dir ─────────────────────────────────────────────────────────────

// Absolute scratch path passed in by the calling agent session. Kept as a
// constant (not derived) so this script has no dependency on the invoking
// environment's temp-dir layout beyond this one path.
const SCRATCH_DIR =
  process.env.EVAL_OUT_DIR ??
  "C:\\Users\\Pc\\AppData\\Local\\Temp\\claude\\c--Users-Pc-Desktop-Empire-Artisto-Aristo-2-0-Aristo-AI\\292f9d4b-3c54-4c11-8b10-e3ca7f61eb3e\\scratchpad\\t07-3d-eval";

fs.mkdirSync(SCRATCH_DIR, { recursive: true });

// ─── Budget guard ───────────────────────────────────────────────────────────

const HARD_BUDGET_USD = 5.0;
let spentUsd = 0;

function chargeOrAbort(label: string, usd: number): void {
  if (spentUsd + usd > HARD_BUDGET_USD) {
    throw new Error(
      `Budget guard: would exceed $${HARD_BUDGET_USD} (spent $${spentUsd.toFixed(2)}, ` +
      `next call "${label}" costs $${usd.toFixed(2)}). Aborting remaining calls.`,
    );
  }
  spentUsd += usd;
  console.log(`  [$] ${label}: $${usd.toFixed(3)} (running total: $${spentUsd.toFixed(3)})`);
}

// ─── Test prompts (reduced from 5 to 3 per budget guard — see T07-REPORT.md) ──

const PROMPTS = [
  { slug: "animal-cell",  text: "animal cell with visible organelles" },
  { slug: "volcano",      text: "volcano cross-section" },
  { slug: "human-heart",  text: "human heart" },
];

// ─── Candidate models ───────────────────────────────────────────────────────
// Prices confirmed from fal.ai model pages (2026-07-13). See T07-REPORT.md
// candidate table for the full source citation per model.

const COST_TABLE = {
  flux_schnell: 0.003,   // fal-ai/flux/schnell — source image, per prompt
  triposr:      0.07,    // fal-ai/triposr — incumbent baseline
  tripo3d_v25:  0.30,    // tripo3d/tripo/v2.5/image-to-3d — standard textures, PBR default on
  trellis2:     0.30,    // fal-ai/trellis-2 — 1024p tier
  hunyuan3d_v2: 0.48,    // fal-ai/hunyuan3d/v2 — textured_mesh:true (3x white-mesh price)
} as const;

interface ModelResult {
  promptSlug:  string;
  model:       string;
  glbUrl:      string | null;
  localPath:   string | null;
  latencyMs:   number;
  costUsd:     number;
  error?:      string;
}

const results: ModelResult[] = [];

// ─── FLUX source image (prompt template copied from generate3dSourceImage) ──

async function generateFluxSource(prompt: string): Promise<string> {
  chargeOrAbort(`flux/schnell "${prompt}"`, COST_TABLE.flux_schnell);
  const result = (await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt: `${prompt}, single isolated object, plain white background, ` +
              `centered, no text, no labels, studio product photo, vibrant colors`,
      image_size:          "square",
      num_inference_steps: 4,
      num_images:          1,
    },
  })) as unknown as { data: { images: { url: string }[] } };
  const url = result.data?.images?.[0]?.url;
  if (!url) throw new Error("FLUX Schnell returned no image");
  return url;
}

// ─── Per-model calls ────────────────────────────────────────────────────────

async function runTriposr(imageUrl: string): Promise<{ url: string | null }> {
  const result = (await fal.subscribe("fal-ai/triposr", {
    input: {
      image_url:            imageUrl,
      output_format:        "glb",
      do_remove_background: true,
      foreground_ratio:     0.85,
      mc_resolution:        256,
    },
  })) as unknown as { data: { model_mesh?: { url: string } } };
  return { url: result.data?.model_mesh?.url ?? null };
}

async function runTripo3dV25(imageUrl: string): Promise<{ url: string | null }> {
  const result = (await fal.subscribe("tripo3d/tripo/v2.5/image-to-3d", {
    input: {
      image_url: imageUrl,
      texture:   "standard",
      pbr:       true,
    },
  })) as unknown as {
    data: { model_mesh?: { url: string }; pbr_model?: { url: string } };
  };
  return { url: result.data?.pbr_model?.url ?? result.data?.model_mesh?.url ?? null };
}

async function runTrellis2(imageUrl: string): Promise<{ url: string | null }> {
  const result = (await fal.subscribe("fal-ai/trellis-2", {
    input: {
      image_url:  imageUrl,
      resolution: 1024,
    },
  })) as unknown as { data: { model_glb?: { url: string } } };
  return { url: result.data?.model_glb?.url ?? null };
}

async function runHunyuan3dV2(imageUrl: string): Promise<{ url: string | null }> {
  const result = (await fal.subscribe("fal-ai/hunyuan3d/v2", {
    input: {
      input_image_url: imageUrl,
      textured_mesh:   true,
    },
  })) as unknown as { data: { model_mesh?: { url: string } } };
  return { url: result.data?.model_mesh?.url ?? null };
}

const MODELS: Array<{
  key:  keyof typeof COST_TABLE;
  name: string;
  run:  (imageUrl: string) => Promise<{ url: string | null }>;
}> = [
  { key: "triposr",      name: "fal-ai/triposr",                 run: runTriposr },
  { key: "tripo3d_v25",  name: "tripo3d/tripo/v2.5/image-to-3d",  run: runTripo3dV25 },
  { key: "trellis2",     name: "fal-ai/trellis-2",                run: runTrellis2 },
  { key: "hunyuan3d_v2", name: "fal-ai/hunyuan3d/v2",              run: runHunyuan3dV2 },
];

// ─── Download helper ────────────────────────────────────────────────────────

async function downloadTo(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Output dir: ${SCRATCH_DIR}`);
  console.log(`Hard budget: $${HARD_BUDGET_USD}\n`);

  for (const prompt of PROMPTS) {
    console.log(`\n=== Prompt: ${prompt.slug} ("${prompt.text}") ===`);

    let sourceImageUrl: string;
    try {
      sourceImageUrl = await generateFluxSource(prompt.text);
      const imgPath = path.join(SCRATCH_DIR, `${prompt.slug}__source.png`);
      await downloadTo(sourceImageUrl, imgPath);
      console.log(`  FLUX source saved: ${imgPath}`);
    } catch (err) {
      console.error(`  FLUX source FAILED for ${prompt.slug}:`, err);
      continue;
    }

    for (const model of MODELS) {
      const label = `${model.name} <- ${prompt.slug}`;
      const t0 = Date.now();
      try {
        chargeOrAbort(label, COST_TABLE[model.key]);
        const { url } = await model.run(sourceImageUrl);
        const latencyMs = Date.now() - t0;

        if (!url) {
          results.push({
            promptSlug: prompt.slug, model: model.name, glbUrl: null,
            localPath: null, latencyMs, costUsd: COST_TABLE[model.key],
            error: "no GLB url in response",
          });
          console.error(`  ${label}: FAILED (no GLB url)`);
          continue;
        }

        const localPath = path.join(SCRATCH_DIR, `${prompt.slug}__${model.key}.glb`);
        await downloadTo(url, localPath);

        results.push({
          promptSlug: prompt.slug, model: model.name, glbUrl: url,
          localPath, latencyMs, costUsd: COST_TABLE[model.key],
        });
        console.log(`  ${label}: OK (${latencyMs}ms) -> ${localPath}`);
      } catch (err) {
        const latencyMs = Date.now() - t0;
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          promptSlug: prompt.slug, model: model.name, glbUrl: null,
          localPath: null, latencyMs, costUsd: 0, error: message,
        });
        console.error(`  ${label}: ERROR — ${message}`);
        if (message.startsWith("Budget guard")) {
          console.error("Stopping all further calls — budget guard tripped.");
          await writeSummary();
          process.exit(1);
        }
      }
    }
  }

  await writeSummary();
  console.log(`\nDone. Total spend: $${spentUsd.toFixed(3)} of $${HARD_BUDGET_USD} budget.`);
}

async function writeSummary(): Promise<void> {
  const summaryPath = path.join(SCRATCH_DIR, "summary.json");
  fs.writeFileSync(
    summaryPath,
    JSON.stringify({ spentUsd, budgetUsd: HARD_BUDGET_USD, results }, null, 2),
  );
  console.log(`\nSummary written: ${summaryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
