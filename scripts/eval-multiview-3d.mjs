/**
 * Multi-view 3D experiment, volcano only.
 *
 * Tests the hypothesis that the demo models look bad because Tripo's
 * single-image path textures only what one view can see (measured: the volcano
 * albedo atlas is mostly flat near-white, with rock and lava only in
 * fragments) rather than because the mesh or the generator is weak.
 *
 * Pipeline under test:
 *   1. one strong FRONT view                     nano-banana-pro   $0.15
 *   2. back / left / right, by EDITING that view flux-pro/kontext  $0.04 x3
 *   3. tripo3d v2.5 multiview-to-3d, texture HD
 *
 * Calls fal directly rather than through banana.ts: this is an eval, and the
 * precedent set by the T07 and pipeline-eval sessions is that evals stay out
 * of usage_events so the cost dashboard keeps meaning production spend.
 *
 * Run: node mv-experiment.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI";
const KEY = (readFileSync(`${ROOT}/.env.local`, "utf8").match(/^FAL_KEY=(.*)$/m) || [])[1]?.trim();
if (!KEY) throw new Error("FAL_KEY missing");
const DRY = process.argv.includes("--dry-run");

/**
 * Three-quarter framing, matte, evenly lit, no cutaway. The shipped prompt
 * asks for a cross-section, which forces the reconstructor to invent interior
 * geometry it cannot see; and a front elevation shows one face where a 3/4
 * view shows three.
 */
const FRONT_PROMPT =
  "A single volcano, three-quarter view from slightly above, rocky dark grey and " +
  "brown basalt surface, dry matte texture, glowing orange lava at the summit crater only, " +
  "one solid isolated object, complete and unbroken, plain flat white background, " +
  "even neutral studio lighting, no shadows on the background, no text, no labels, " +
  "no cutaway, product photograph of a museum model";

const VIEWS = [
  { name: "left",  instruction: "Rotate the object 90 degrees to show its LEFT side." },
  { name: "back",  instruction: "Rotate the object 180 degrees to show its BACK." },
  { name: "right", instruction: "Rotate the object 270 degrees to show its RIGHT side." },
];

const EDIT_SUFFIX =
  " Keep the exact same object, the same rock colours and materials, the same size in frame, " +
  "the same even lighting and the same plain flat white background. Do not change the style. " +
  "Do not add text or labels.";

async function fal(endpoint, input) {
  const res = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Key ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${endpoint} HTTP ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const imageUrlOf = (r) => r?.images?.[0]?.url ?? r?.image?.url ?? r?.data?.images?.[0]?.url;

async function main() {
  const spend = [];
  const note = (what, usd) => { spend.push({ what, usd }); console.log(`    ~$${usd.toFixed(3)}  ${what}`); };

  if (DRY) {
    console.log("DRY RUN. Would spend about $0.67:\n");
    console.log("  front  nano-banana-pro        $0.150");
    console.log("  x3     flux-pro/kontext edit  $0.120");
    console.log("  3d     tripo multiview HD     ~$0.400");
    console.log("\nFRONT PROMPT:\n" + FRONT_PROMPT);
    return;
  }

  console.log("1/3  front view (nano-banana-pro)");
  const front = await fal("fal-ai/nano-banana-pro", {
    prompt: FRONT_PROMPT,
    num_images: 1,
    output_format: "png",
  });
  const frontUrl = imageUrlOf(front);
  if (!frontUrl) throw new Error("no front image: " + JSON.stringify(front).slice(0, 300));
  note("front view", 0.15);
  console.log(`     ${frontUrl}`);

  console.log("\n2/3  three rotated views (flux-pro/kontext)");
  const urls = { front_image_url: frontUrl };
  for (const v of VIEWS) {
    const r = await fal("fal-ai/flux-pro/kontext", {
      prompt: v.instruction + EDIT_SUFFIX,
      image_url: frontUrl,
      num_images: 1,
      output_format: "png",
    });
    const u = imageUrlOf(r);
    if (!u) throw new Error(`no ${v.name} image: ` + JSON.stringify(r).slice(0, 300));
    urls[`${v.name}_image_url`] = u;
    note(`${v.name} view`, 0.04);
    console.log(`     ${u}`);
  }

  console.log("\n3/3  tripo3d v2.5 multiview-to-3d (texture HD)");
  const model = await fal("tripo3d/tripo/v2.5/multiview-to-3d", {
    ...urls,
    texture: "HD",
    pbr: true,
    texture_alignment: "original_image",
    orientation: "align_image",
    face_limit: 120000,
  });
  const modelUrl = model?.pbr_model?.url ?? model?.model_mesh?.url ?? model?.data?.pbr_model?.url;
  if (!modelUrl) throw new Error("no model: " + JSON.stringify(model).slice(0, 500));
  note("multiview 3d (HD)", 0.4);

  writeFileSync("mv-result.json", JSON.stringify({ urls, modelUrl, spend }, null, 2));
  console.log(`\nmodel: ${modelUrl}`);
  console.log(`total ~$${spend.reduce((a, b) => a + b.usd, 0).toFixed(2)}`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
