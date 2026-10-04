/**
 * V8.3c: a 3D model worth turning, through the product's own pipeline (banana.ts), so the result is real output and
 * the spend lands in usage_events like any production generation (the regen-demo-3d.ts pattern).
 *
 * Budget: Hmz allowed $2.00; this script refuses any call that would take the ledger past $1.80. Prices are fal's own
 * (GET /v1/models/pricing, read 2026-10-03): FLUX Schnell $0.003 per megapixel ("square" is 512 x 512, so about
 * $0.0008, booked as $0.003), Tripo3D v2.5 $0.01 per credit (standard texture + PBR = 30 credits, $0.30).
 *
 *   npx tsx volcano-model.ts sources            # the FLUX candidates (about $0.02), then sheet B
 *   npx tsx volcano-model.ts model <id>         # Tripo3D on one candidate ($0.30)
 *   npx tsx volcano-model.ts ledger             # what has been spent
 */
import dotenv from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
dotenv.config({ path: path.join(ROOT, ".env.local") });

const OUT = path.resolve(__dirname, "..", "volcano");
const LEDGER = path.join(OUT, "ledger.json");
const CAP = 1.8;
const PRICE = { flux: 0.003, tripo: 0.3, multiview: 0.52 } as const;

/** Each written as the lesson's `model_3d_prompt` would be; the pipeline appends its own suffix (banana.ts). */
const PROMPTS = {
  block:
    "Educational geology block model of a volcano: a solid rectangular block of earth with a cone-shaped volcano rising from its top, the front face and right side face cut flat to reveal the inside, layered rock strata in browns and greys, a large glowing orange magma chamber deep in the block, a bright molten vent rising from the chamber up through the cone to the crater, three-quarter view from slightly above",
  wedge:
    "Cutaway model of a volcano with a quarter wedge removed from the cone, the two flat cut faces showing a glowing orange magma chamber at the base and a bright molten vent rising to the crater through layers of grey and brown rock, on a round rock base, three-quarter view from slightly above",
  halved:
    "Volcano diorama on a thick square earth base, the model sliced in half down the middle so the flat cut face shows the inside: a glowing orange magma chamber, a molten vent up to the crater, layers of ash and lava in the cone, three-quarter view from slightly above",
  chamber:
    "Educational geology block model of a volcano cut open: a tall square block of layered rock with a cone volcano on top, the whole front face cut flat like a cross-section, showing horizontal rock strata, a large glowing orange magma chamber in the lower middle of the block and a bright molten vent rising straight up from the chamber through the cone to the crater, three-quarter view from slightly above",
  heart:
    "Anatomical model of the human heart cut open from the front, the flat cut surface facing the camera showing the four chambers, the valves and the thick muscle walls, the right side tinted blue and the left side red, aorta and vessels on top, museum anatomy model, three-quarter view",
  brain:
    "Anatomical model of the human brain with each lobe a different solid colour: frontal lobe blue, parietal lobe yellow, temporal lobe green, occipital lobe red, cerebellum purple, brainstem grey, glossy plastic school model, three-quarter side view",
  earth2:
    "Model globe of planet Earth with a large wedge cut out, the cut showing clean concentric layers: thin brown crust, thick red-orange mantle, bright orange outer core, glowing yellow inner core, oceans and continents on the outside, three-quarter view",
  cell:
    "Plastic school model of an animal cell sliced in half, the flat cut face showing a large purple nucleus, orange bean-shaped mitochondria, blue folded endoplasmic reticulum, green golgi stacks and small vesicles inside pink cytoplasm, three-quarter view from above",
  flower:
    "Large botanical model of a flower cut in half lengthwise, the cut face showing the ovary with seeds, the style and stigma in the centre, stamens with yellow anthers around it, pink petals and green sepals, museum botany model, three-quarter view",
  eye:
    "Anatomical model of the human eye with the front quarter cut away, showing the clear cornea, the blue iris, the lens, the jelly inside, the red retina lining the back and the yellow optic nerve leaving the back, school anatomy model, three-quarter view",
  tooth:
    "Large school model of a human molar tooth cut in half, the cut face showing white enamel, cream dentin, red pulp with nerves and two long roots in pink gum and bone, three-quarter view",
  plates:
    "Geology block model of a subduction zone: a rectangular block of earth with an ocean plate sliding under a continental plate, the front face cut to show the layers, a glowing magma chamber rising to a volcano on the continent, blue ocean on top, three-quarter view from above",
  volcano2:
    "Museum-quality model of a volcano split exactly in half vertically, the flat vertical cut surface facing the camera, on the cut surface a large glowing orange magma chamber at the bottom, a bright straight conduit rising to the crater, and alternating dark grey and brown layers of ash and lava in the cone, front view",
  dna:
    "Chunky plastic school model of a DNA double helix, two twisting blue backbones joined by thick colourful rungs in red, yellow, green and orange, a short vertical segment standing on a round base, three-quarter view",
  temple:
    "Detailed model of an ancient Greek temple like the Parthenon, white marble columns around all four sides, a triangular pediment with carved figures, standing on a stepped base, three-quarter view from above",
  earth:
    "Cutaway model of planet Earth with a wedge removed, showing the thin rocky crust, the thick orange mantle, the glowing yellow outer core and a bright white-hot inner core, three-quarter view",
} as const;
type PromptKey = keyof typeof PROMPTS;
/** Two samples of each volcano prompt (the second bypasses the cache), one of the backup subject. */
const RUNS: { id: string; key: PromptKey; fresh: boolean }[] = [
  { id: "block-1", key: "block", fresh: false }, { id: "block-2", key: "block", fresh: true },
  { id: "wedge-1", key: "wedge", fresh: false }, { id: "wedge-2", key: "wedge", fresh: true },
  { id: "halved-1", key: "halved", fresh: false }, { id: "halved-2", key: "halved", fresh: true },
  { id: "earth-1", key: "earth", fresh: false },
  { id: "chamber-1", key: "chamber", fresh: false }, { id: "chamber-2", key: "chamber", fresh: true }, { id: "chamber-3", key: "chamber", fresh: true },
  { id: "heart-1", key: "heart", fresh: false }, { id: "heart-2", key: "heart", fresh: true },
  { id: "brain-1", key: "brain", fresh: false }, { id: "brain-2", key: "brain", fresh: true },
  { id: "earth2-1", key: "earth2", fresh: false }, { id: "earth2-2", key: "earth2", fresh: true },
  { id: "cell-1", key: "cell", fresh: false }, { id: "cell-2", key: "cell", fresh: true },
  { id: "flower-1", key: "flower", fresh: false }, { id: "flower-2", key: "flower", fresh: true },
  { id: "eye-1", key: "eye", fresh: false }, { id: "eye-2", key: "eye", fresh: true },
  { id: "tooth-1", key: "tooth", fresh: false }, { id: "tooth-2", key: "tooth", fresh: true },
  { id: "plates-1", key: "plates", fresh: false }, { id: "plates-2", key: "plates", fresh: true },
  { id: "volcano2-1", key: "volcano2", fresh: false }, { id: "volcano2-2", key: "volcano2", fresh: true },
  { id: "dna-1", key: "dna", fresh: false }, { id: "dna-2", key: "dna", fresh: true },
  { id: "temple-1", key: "temple", fresh: false }, { id: "temple-2", key: "temple", fresh: true },
];

interface Entry { at: string; kind: string; id: string; cost: number; url: string; prompt?: string }
const ledger = (): Entry[] => (existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : []);
const spent = () => ledger().reduce((s, e) => s + e.cost, 0);
function book(e: Entry) {
  writeFileSync(LEDGER, JSON.stringify([...ledger(), e], null, 2));
  console.log(`  booked $${e.cost.toFixed(3)} (${e.kind} ${e.id}); total $${spent().toFixed(3)}`);
}
function guard(cost: number) {
  if (spent() + cost > CAP + 1e-9) throw new Error(`refused: $${spent().toFixed(3)} spent, +$${cost} passes the $${CAP} cap`);
}

async function download(url: string, file: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY missing from .env.local");
  mkdirSync(OUT, { recursive: true });
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "ledger") { console.log(ledger(), `total $${spent().toFixed(3)}`); return; }
  const { generate3dSourceImage, generate3dModel, generate3dModelMultiview } = await import(pathToFileURL(path.join(ROOT, "src/lib/imagegen/banana.ts")).href);

  if (cmd === "sources") {
    for (const run of RUNS) {
      const file = path.join(OUT, `${run.id}.jpg`);
      if (existsSync(file)) { console.log(`${run.id}: have it`); continue; }
      guard(PRICE.flux);
      console.log(`${run.id}: FLUX`);
      const url: string = await generate3dSourceImage(PROMPTS[run.key], null, run.fresh, null);
      book({ at: new Date().toISOString(), kind: "flux", id: run.id, cost: PRICE.flux, url, prompt: PROMPTS[run.key] });
      await download(url, file);
    }
    return;
  }

  if (cmd === "model") {
    const src = ledger().find((e) => e.kind === "flux" && e.id === arg);
    if (!src) throw new Error(`no source "${arg}" in the ledger`);
    if (ledger().some((e) => e.kind === "tripo" && e.id === arg)) throw new Error(`"${arg}" already has a model`);
    guard(PRICE.tripo);
    console.log(`${arg}: Tripo3D v2.5 (about 80 s)`);
    const { modelUrl } = await generate3dModel(src.url, null, true, null);
    book({ at: new Date().toISOString(), kind: "tripo", id: arg, cost: PRICE.tripo, url: modelUrl, prompt: src.prompt });
    await download(modelUrl, path.join(OUT, `${arg}.glb`));
    console.log(`wrote ${arg}.glb`);
    return;
  }
  if (cmd === "multiview") {
    // Three FLUX Kontext views of the front ($0.04 each) and Tripo3D v2.5 multiview HD ($0.40): the product's own
    // four-view path (banana.ts generate3dModelMultiview), for a model whose sides differ from its front. If an edit
    // fails, banana falls back to the single view ($0.30), which the $0.52 booking covers.
    const src = ledger().find((e) => e.kind === "flux" && e.id === arg);
    if (!src) throw new Error(`no source "${arg}" in the ledger`);
    guard(PRICE.multiview);
    console.log(`${arg}: multiview (three edits, then Tripo3D, a few minutes)`);
    const { modelUrl } = await generate3dModelMultiview(src.url, null, true, null);
    book({ at: new Date().toISOString(), kind: "multiview", id: arg, cost: PRICE.multiview, url: modelUrl, prompt: src.prompt });
    await download(modelUrl, path.join(OUT, `${arg}-mv.glb`));
    console.log(`wrote ${arg}-mv.glb`);
    return;
  }
  throw new Error("usage: sources | model <id> | multiview <id> | ledger");
}

main().catch((e) => { console.error(e); process.exit(1); });
