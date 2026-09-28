/**
 * Turn a raw Blender export of a Canino teacher into the GLB the app ships.
 *
 *   node .claude/eval/2026-09-18-v9-bakeoff/scripts/v9_postprocess.mjs \
 *        <raw.glb> <out.glb> [--eyelash-from <jake_raw.glb>] [--drop-material <name> ...]
 *        [--copyright "<CC BY attribution line>"]
 *
 * Run from the repo root (it resolves @gltf-transform, draco3dgltf and sharp
 * from the project's node_modules).
 *
 * What it fixes, and why each matters in three.js (the only renderer that
 * counts -- Blender's Eevee hides most of these):
 *
 * - Teeth, tongue and eyeballs arrive as BLEND. GLTFLoader turns BLEND into
 *   `transparent: true, depthWrite: false`, so those meshes are depth-sorted
 *   per object and draw in the wrong order as the head turns. None of them
 *   has real alpha, so they become OPAQUE.
 * - MJ's right eyeball is MASK with base alpha 0: every fragment is
 *   discarded. It only looked right because the cornea shell carries the same
 *   eye texture. Made OPAQUE with alpha 1 like the left one.
 * - MJ's eyelashes are an opaque black card with no opacity map -- the
 *   Sketchfab conversion dropped it -- which reads as a thick painted wing.
 *   The two Canino characters share Character Creator's base topology, so
 *   Jake's eyelash colour+opacity texture maps onto hers unchanged.
 * - Jake's trousers are metallic 1.0: black mirror-finish fabric.
 * - Every material exports with doubled specular (see the loop below).
 * - Eye-occlusion meshes are fully transparent (alpha 0) and add draw calls,
 *   and a hidden undergarment sits entirely under MJ's tee. Both are dropped
 *   by material name via --drop-material.
 * - The export carries one empty scene per scene in the .blend. The default
 *   scene is right, so three.js loads the right one, but the rest is cruft.
 *
 * Then the size pass the app expects: WebP textures at 1024, Draco geometry
 * (the app self-hosts the Draco decoder).
 *
 * Animation (V9.2):
 *
 * - Tracks that hold their node's rest value on every key are dropped. MJ's
 *   rig exports 765 channels per clip, 625-654 of them rest constants
 *   (`_scaleCompensation` bones, `_0`/`_1` leaf duplicates, every scale), and
 *   in glTF each one costs a channel, a sampler and two accessors of JSON:
 *   0.76 MB of her 1.32 MB of animation. three.js restores a node's loaded
 *   value when no action drives it, and blends it in for missing weight during
 *   a crossfade, so a dropped rest track plays exactly like a kept one. Tracks
 *   that hold an off-rest value (a curled finger) are kept.
 * - `--resample <tol>` optionally removes keys an interpolation reproduces;
 *   off by default (see resampleTol below).
 * - `--base A,B,C --pack <clips.glb>` splits the file: the output keeps the
 *   mesh and the base clips; the pack gets every other clip on the same node
 *   tree (no meshes, skins or materials), so its tracks bind to the mesh
 *   file's bones by name. The pack is meshopt-compressed: drei's useGLTF
 *   registers the meshopt decoder on every loader, so it decodes for free.
 * `v9_verify_anim.mjs` checks the result against the raw export in three.js.
 */

import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";

const require = createRequire(path.join(process.cwd(), "package.json"));
// The ESM builds, by path: require.resolve picks the CJS entry, which cannot
// load gltf-transform's ESM-only dependencies.
const imp = (p) => import(pathToFileURL(path.join(process.cwd(), "node_modules", p, "dist", "index.js")).href);
const { NodeIO } = await imp("@gltf-transform/core");
const { ALL_EXTENSIONS } = await imp("@gltf-transform/extensions");
const { cloneDocument, dedup, prune, draco, meshopt, resample, textureCompress } =
  await imp("@gltf-transform/functions");
const draco3d = require("draco3dgltf");
const sharp = require("sharp");
const { MeshoptEncoder } = require("meshoptimizer");
await MeshoptEncoder.ready;

const args = process.argv.slice(2);
const [src, out] = args;
const flag = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const eyelashFrom = flag("--eyelash-from")[0];
const dropMaterials = new Set(flag("--drop-material"));
const copyright = flag("--copyright")[0];
const base = flag("--base")[0]?.split(",");
const packOut = flag("--pack")[0];
// Off by default. Measured on MJ's 8-clip export (V9.2): 1e-4 saves 0.18 MB
// but moves bones up to 0.45 deg / 7 mm against the raw export; 1e-5 saves
// 27 KB and grows the pack, because resampled tracks lose the one shared
// time accessor per clip, which meshopt compresses well. The prune alone is
// exact (<= 0.06 deg, 0.006 mm).
const resampleTol = Number(flag("--resample")[0] ?? 0);
if (!base !== !packOut) throw new Error("--base and --pack go together");

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
  "meshopt.encoder": MeshoptEncoder,
});

// Rest-track tolerances: 0.05 deg, and 0.1 mm in the node's local units.
// Non-hip translations on these rigs wobble by float noise up to 40 um.
const ROT_TOL = Math.cos((0.05 * Math.PI) / 180 / 2);
const POS_TOL = 1e-4;

function holdsRest(channel) {
  const path = channel.getTargetPath();
  if (!["rotation", "translation", "scale"].includes(path)) return false;
  const node = channel.getTargetNode();
  const rest = path === "rotation" ? node.getRotation()
    : path === "translation" ? node.getTranslation() : node.getScale();
  const values = channel.getSampler().getOutput().getArray();
  const k = rest.length;
  for (let i = 0; i < values.length; i += k) {
    if (path === "rotation") {
      let dot = 0;
      for (let j = 0; j < 4; j++) dot += values[i + j] * rest[j];
      if (Math.abs(dot) < ROT_TOL) return false;
    } else {
      for (let j = 0; j < 3; j++) if (Math.abs(values[i + j] - rest[j]) > POS_TOL) return false;
    }
  }
  return true;
}

function pruneRestTracks(doc) {
  let dropped = 0, kept = 0;
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      if (holdsRest(ch)) {
        ch.dispose();
        dropped++;
      } else kept++;
    }
    const used = new Set(anim.listChannels().map((ch) => ch.getSampler()));
    for (const s of anim.listSamplers()) if (!used.has(s)) s.dispose();
  }
  return { dropped, kept };
}

// Rotation outputs as normalized int16, which core glTF allows for rotation
// samplers and three's GLTFLoader decodes. 1/32767 per component is about
// 0.004 deg; the base GLB carries Draco, not meshopt, so this is the only
// compression its animation gets. Translations stay float (the spec wants it).
function quantizeRotations(doc) {
  const done = new Set();
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const out = ch.getSampler().getOutput();
      if (ch.getTargetPath() !== "rotation" || done.has(out) || out.getNormalized()) continue;
      const src = out.getArray();
      const q = new Int16Array(src.length);
      for (let i = 0; i < src.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, src[i])) * 32767);
      out.setArray(q).setNormalized(true);
      done.add(out);
    }
  }
  return done.size;
}

// Animation.dispose() leaves its samplers alive, still holding their
// accessors, so prune() keeps the data: the first 17-clip split left 0.72 MB
// of pack keyframes inside each base file.
function dropAnimation(a) {
  for (const ch of a.listChannels()) ch.dispose();
  for (const s of a.listSamplers()) s.dispose();
  a.dispose();
}

// The pack: the same node tree, the non-base clips, nothing else.
async function writePack(doc, path) {
  const pack = cloneDocument(doc);
  const root = pack.getRoot();
  for (const a of root.listAnimations()) if (base.includes(a.getName())) dropAnimation(a);
  for (const n of root.listNodes()) {
    n.setMesh(null);
    n.setSkin(null);
  }
  for (const m of root.listMeshes()) m.dispose();
  for (const s of root.listSkins()) s.dispose();
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  for (const e of root.listExtensionsUsed()) e.dispose();
  // keepLeaves: bones with no children must survive, or their tracks lose
  // their target and the clip stops binding in the app.
  await pack.transform(prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await io.write(path, pack);
  return root.listAnimations().map((a) => `${a.getName()}(${a.listChannels().length})`);
}

const doc = await io.read(src);
const root = doc.getRoot();
const log = [];

// The GLB is publicly fetchable from /models/, so a CC BY credit has to travel
// inside the file as well as appear in the UI.
if (copyright) root.getAsset().copyright = copyright;

// Empty scenes.
const keep = root.getDefaultScene();
for (const s of root.listScenes()) if (s !== keep) s.dispose();

// Meshes that are never visible.
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const prim of mesh.listPrimitives()) {
    const name = prim.getMaterial()?.getName() ?? "";
    if ([...dropMaterials].some((d) => name.startsWith(d))) {
      mesh.removePrimitive(prim);
      log.push(`dropped primitive (${name}) on ${node.getName()}`);
    }
  }
  if (mesh.listPrimitives().length === 0) {
    node.setMesh(null);
    mesh.dispose();
  }
}

// Borrowed eyelash texture.
let lashTexture = null;
if (eyelashFrom) {
  const donor = await io.read(eyelashFrom);
  const lash = donor.getRoot().listMaterials().find((m) => /Eyelash/.test(m.getName()));
  const tex = lash?.getBaseColorTexture();
  if (!tex) throw new Error(`no eyelash texture in ${eyelashFrom}`);
  lashTexture = doc.createTexture("Std_Eyelash_Diffuse-Opacity")
    .setImage(tex.getImage()).setMimeType(tex.getMimeType());
}

for (const m of root.listMaterials()) {
  const n = m.getName();
  if (/Teeth|Tongue/.test(n) || (/Std_Eye_[LR]/.test(n) && !/Cornea/.test(n))) {
    const f = m.getBaseColorFactor();
    m.setAlphaMode("OPAQUE").setBaseColorFactor([f[0], f[1], f[2], 1]);
    log.push(`${n}: OPAQUE`);
  }
  if (/Eyelash/.test(n) && lashTexture) {
    m.setBaseColorTexture(lashTexture).setBaseColorFactor([1, 1, 1, 1]).setAlphaMode("BLEND");
    log.push(`${n}: eyelash texture from donor, BLEND`);
  }
  // Blender writes Character Creator's specular level as
  // KHR_materials_specular with specularColorFactor [2,2,2]: twice the
  // dielectric reflectance three.js assumes. It turns Jake's black trousers
  // mid-grey under the classroom's studio environment and makes skin read as
  // plastic. Dropping the extension restores the default F0; corneas keep it.
  const spec = m.getExtension("KHR_materials_specular");
  if (spec && !/Cornea/.test(n)) {
    m.setExtension("KHR_materials_specular", null);
    log.push(`${n}: default specular`);
  }
  if (m.getMetallicFactor() >= 0.99 && !m.getMetallicRoughnessTexture()) {
    m.setMetallicFactor(0).setRoughnessFactor(Math.max(m.getRoughnessFactor(), 0.85));
    log.push(`${n}: metallic 1 -> 0`);
  }
}

const diet = pruneRestTracks(doc);
log.push(`animation: dropped ${diet.dropped} rest tracks, kept ${diet.kept}`);
if (resampleTol > 0) await doc.transform(resample({ tolerance: resampleTol }));
log.push(`animation: ${quantizeRotations(doc)} rotation outputs as int16`);

if (packOut) {
  const missing = base.filter((b) => !root.listAnimations().some((a) => a.getName() === b));
  if (missing.length) throw new Error(`base clips not in the export: ${missing.join(", ")}`);
  log.push(`pack ${packOut}: ${(await writePack(doc, packOut)).join(" ")}`);
  for (const a of root.listAnimations()) if (!base.includes(a.getName())) dropAnimation(a);
}
log.push(`base: ${root.listAnimations().map((a) => `${a.getName()}(${a.listChannels().length})`).join(" ")}`);

await doc.transform(
  prune(),
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024] }),
  draco(),
);
await io.write(out, doc);
console.log(log.join("\n"));
