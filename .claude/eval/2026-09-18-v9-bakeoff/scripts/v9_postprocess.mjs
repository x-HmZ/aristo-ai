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
 * (the app self-hosts the Draco decoder and has no meshopt decoder).
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
const { dedup, prune, draco, textureCompress } = await imp("@gltf-transform/functions");
const draco3d = require("draco3dgltf");
const sharp = require("sharp");

const args = process.argv.slice(2);
const [src, out] = args;
const flag = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const eyelashFrom = flag("--eyelash-from")[0];
const dropMaterials = new Set(flag("--drop-material"));
const copyright = flag("--copyright")[0];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

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

await doc.transform(
  prune(),
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024] }),
  draco(),
);
await io.write(out, doc);
console.log(log.join("\n"));
