/**
 * One-off: regenerate ONLY the 3D model for each /demo topic.
 *
 * Why this exists rather than re-running generate-demo-content.ts: that
 * script regenerates the lessons and every segment infographic too, which is
 * roughly $0.68 of image spend per concept. The lessons and images are fine —
 * the models are not. public/demo/<slug>/model.glb was frozen on 2026-07-13,
 * when generate3dModel() still called `fal-ai/triposr`. T07 scored TripoSR
 * 1.5/5 and it was replaced by Tripo3D v2.5 on 2026-09-09, so /demo has been
 * showing the output of a generator this project already rejected.
 *
 * Cost: one FLUX source image (~$0.003) plus one Tripo3D v2.5 model ($0.30)
 * per topic. Two topics, so ~$0.61. Authorised by Hmz on 2026-09-10.
 *
 * This calls the real pipeline (banana.ts), not fal directly, so the run
 * lands in usage_events and the persistent asset cache like any other
 * production generation. That is deliberate and the opposite of the eval
 * scripts, which bypass it to keep the cost dashboard clean — this is real
 * spend on a real asset, and the dashboard should say so.
 *
 * The existing GLB is backed up next to it before being overwritten, so a
 * bad result is one `mv` away from being undone.
 *
 * Run: npx tsx scripts/regen-demo-3d.ts [--dry-run]
 */

import dotenv from "dotenv";
import { copyFileSync, existsSync, statSync, writeFileSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = "C:\\Users\\Pc\\Desktop\\Empire\\Artisto\\Aristo 2.0\\Aristo-AI";

dotenv.config({ path: path.join(ROOT, ".env.local") });

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Copied from the frozen lesson payloads (metadata.model_3d_prompt) rather
 * than imported, so this script never pulls the TS demo modules — and so the
 * exact prompt each model was built from is visible here in the diff.
 */
const TOPICS = [
  {
    slug: "volcano-eruption",
    prompt:
      "Cross-section of a volcano cone, rocky brown and gray exterior, glowing red-orange magma chamber visible inside, narrow central vent filled with molten rock, isolated, centered, white background, realistic geological model",
  },
  {
    slug: "black-holes",
    prompt:
      "A black hole with a glowing swirling accretion disk of orange and yellow hot gas surrounding a dark spherical core, warped light ring around the dark sphere, realistic, isolated, centered, black background",
  },
];

async function main() {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY missing from .env.local — nothing to do.");
  }

  const { generate3dSourceImage, generate3dModel } = await import(
    pathToFileURL(path.join(ROOT, "src/lib/imagegen/banana.ts")).href
  );

  console.log(
    DRY_RUN
      ? "DRY RUN — no fal calls, no writes.\n"
      : `Regenerating ${TOPICS.length} demo models (~$${(TOPICS.length * 0.303).toFixed(2)}).\n`
  );

  for (const { slug, prompt } of TOPICS) {
    const outPath = path.join(ROOT, "public", "demo", slug, "model.glb");
    const before = existsSync(outPath) ? statSync(outPath).size : 0;

    console.log(`[${slug}]`);
    console.log(`  existing: ${before ? `${(before / 1e6).toFixed(1)} MB` : "none"}`);
    console.log(`  prompt:   ${prompt.slice(0, 78)}...`);

    if (DRY_RUN) {
      console.log("  (dry run — skipped)\n");
      continue;
    }

    const startedAt = Date.now();
    try {
      const fluxUrl = await generate3dSourceImage(prompt, null);
      console.log(`  flux source: ${fluxUrl}`);

      const { modelUrl } = await generate3dModel(fluxUrl, null);
      console.log(`  tripo3d v2.5 model: ${modelUrl}`);

      const res = await fetch(modelUrl);
      if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

      if (before) {
        copyFileSync(outPath, `${outPath}.triposr.bak`);
        console.log(`  backed up old model -> model.glb.triposr.bak`);
      }
      writeFileSync(outPath, buf);

      console.log(
        `  -> wrote ${(buf.length / 1e6).toFixed(1)} MB in ${((Date.now() - startedAt) / 1000).toFixed(0)}s\n`
      );
    } catch (err) {
      console.error(`  !! failed for ${slug}:`, err);
      console.error("  existing model left untouched.\n");
    }
  }

  console.log("Done. Load /demo and click 'View in 3D' on each topic to check them.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
