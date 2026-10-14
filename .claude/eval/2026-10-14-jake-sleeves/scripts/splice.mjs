/**
 * Put a rebuilt shirt into the shipped Jake GLB, and change nothing else (2026-10-14).
 *
 *   node splice.mjs <shipped.glb> <raw_shipped.glb> <raw_option.glb> <out.glb>     (from the repo root)
 *
 * The sleeve edit (v9_sleeve.tailor) moves shirt vertices only, so the shirt keeps its topology, UVs, weights and
 * normal map. Re-exporting the whole teacher from the working scene would also re-bake the base clips, and in
 * Blender 5.1 that export samples one still pose per clip (2 keys; the shipped clips have 95 to 201). So the
 * shipped file is the base: its clips, morph targets, textures and every other mesh are kept as they are, and only
 * the shirt's POSITION and NORMAL (and TANGENT, if any) are replaced.
 *
 * The shipped shirt is Draco-compressed, which reorders vertices. Each of its vertices is matched to the raw export
 * of the unchanged scene (same Blender export, uncompressed) by position and UV; the option's raw export has the same
 * order as that one, so the match carries over. The worst match distance is printed: it should be within Draco's
 * position quantisation.
 */
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";

const require = createRequire(path.join(process.cwd(), "package.json"));
const imp = (p) => import(pathToFileURL(path.join(process.cwd(), "node_modules", p, "dist", "index.js")).href);
const { NodeIO } = await imp("@gltf-transform/core");
const { ALL_EXTENSIONS } = await imp("@gltf-transform/extensions");
const { draco } = await imp("@gltf-transform/functions");
const draco3d = require("draco3dgltf");

const [shippedPath, rawShippedPath, rawOptionPath, out] = process.argv.slice(2);
const SHIRT_MATERIAL = "lambert3SG";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

const shirtOf = (doc) => {
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
    .filter((p) => p.getMaterial()?.getName() === SHIRT_MATERIAL);
  if (prims.length !== 1) throw new Error(`expected one shirt primitive, found ${prims.length}`);
  return prims[0];
};
const arr = (p, name) => p.getAttribute(name)?.getArray() ?? null;
/** The joint names of the skin the shirt's node binds to, by joint index. */
const jointsOf = (doc, prim) => {
  const node = doc.getRoot().listNodes().find((n) => n.getMesh()?.listPrimitives().includes(prim));
  return node.getSkin().listJoints().map((j) => j.getName());
};

const shipped = await io.read(shippedPath);
const rawS = shirtOf(await io.read(rawShippedPath));
const rawODoc = await io.read(rawOptionPath);
const rawO = shirtOf(rawODoc);
const sh = shirtOf(shipped);

const sp = arr(sh, "POSITION"), suv = arr(sh, "TEXCOORD_0");
const ruv = arr(rawS, "TEXCOORD_0");
// The working scene exports the shirt uniformly scaled and offset from the shipped one (a parent-transform quirk of
// the saved scene; same shape). Fit scale and offset from the bounds, report the per-axis spread, and undo it.
const bounds = (a) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a[i + k]); hi[k] = Math.max(hi[k], a[i + k]); }
  return [lo, hi]; };
const [slo, shi] = bounds(sp), [rlo, rhi] = bounds(arr(rawS, "POSITION"));
const scales = [0, 1, 2].map((k) => (shi[k] - slo[k]) / (rhi[k] - rlo[k]));
const S = scales.reduce((a, b) => a + b) / 3;
const off = [0, 1, 2].map((k) => (slo[k] + shi[k]) / 2 - S * (rlo[k] + rhi[k]) / 2);
const fit = (a) => a.map((v, i) => v * S + off[i % 3]);
const rp = fit(arr(rawS, "POSITION"));
const op = fit(arr(rawO, "POSITION"));
const n = sp.length / 3, rn = rp.length / 3;
if (rn !== op.length / 3) throw new Error("the option's shirt has a different vertex count");

// Spatial hash over the raw (unchanged) shirt.
let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < rn; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], rp[3 * i + k]); hi[k] = Math.max(hi[k], rp[3 * i + k]); }
const cell = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 400;
const key = (x, y, z) => `${Math.floor((x - lo[0]) / cell)},${Math.floor((y - lo[1]) / cell)},${Math.floor((z - lo[2]) / cell)}`;
const grid = new Map();
for (let i = 0; i < rn; i++) {
  const k = key(rp[3 * i], rp[3 * i + 1], rp[3 * i + 2]);
  (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
}

const match = new Int32Array(n);
let worst = 0;
for (let i = 0; i < n; i++) {
  const [x, y, z] = [sp[3 * i], sp[3 * i + 1], sp[3 * i + 2]];
  const cx = Math.floor((x - lo[0]) / cell), cy = Math.floor((y - lo[1]) / cell), cz = Math.floor((z - lo[2]) / cell);
  let best = -1, bd = Infinity, bp = 0;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
    for (const j of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
      const dp = Math.hypot(rp[3 * j] - x, rp[3 * j + 1] - y, rp[3 * j + 2] - z);
      const du = suv && ruv ? Math.hypot(ruv[2 * j] - suv[2 * i], ruv[2 * j + 1] - suv[2 * i + 1]) : 0;
      const d = dp / cell + du * 50; // a seam's twins share the position; the UV tells them apart
      if (d < bd) { bd = d; best = j; bp = dp; }
    }
  }
  if (best < 0) throw new Error(`no raw vertex near shipped vertex ${i}`);
  match[i] = best;
  worst = Math.max(worst, bp);
}

for (const name of ["POSITION", "NORMAL", "TANGENT"]) {
  const src = name === "POSITION" ? op : arr(rawO, name), dst = sh.getAttribute(name);
  if (!src || !dst) continue;
  const size = dst.getElementSize();
  const next = new Float32Array(n * size);
  for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) next[i * size + k] = src[match[i] * size + k];
  dst.setArray(next);
}
// Skin weights (v9_sleeve.hand_to_twist): JOINTS_0 indices are remapped by joint name, the raw export's order to the
// shipped file's. Only rows that differ from the unchanged export are written, so the rest keep their exact bytes.
let reweighted = 0;
{
  const rawNames = jointsOf(rawODoc, rawO), shipNames = jointsOf(shipped, sh);
  const toShip = rawNames.map((nm) => shipNames.indexOf(nm));
  const rjS = arr(rawS, "JOINTS_0"), rwS = arr(rawS, "WEIGHTS_0"), rjO = arr(rawO, "JOINTS_0"), rwO = arr(rawO, "WEIGHTS_0");
  const J = sh.getAttribute("JOINTS_0"), Wt = sh.getAttribute("WEIGHTS_0");
  const jA = J.getArray().slice(), wA = Wt.getArray().slice();
  const key = (j, w, m) => { const o = {}; for (let k = 0; k < 4; k++) if (w[4 * m + k] > 1e-4) o[rawNames[j[4 * m + k]]] = Math.round(w[4 * m + k] * 1e3); return JSON.stringify(Object.entries(o).sort()); };
  for (let i = 0; i < n; i++) {
    const m = match[i];
    if (key(rjS, rwS, m) === key(rjO, rwO, m)) continue;
    for (let k = 0; k < 4; k++) {
      const ji = toShip[rjO[4 * m + k]];
      if (ji < 0 && rwO[4 * m + k] > 0) throw new Error(`joint ${rawNames[rjO[4 * m + k]]} not in the shipped skin`);
      jA[4 * i + k] = Math.max(0, ji);
      wA[4 * i + k] = rwO[4 * m + k];
    }
    reweighted++;
  }
  J.setArray(jA);
  Wt.setArray(wA);
}
let moved = 0, maxMove = 0;
const np = arr(sh, "POSITION");
for (let i = 0; i < n; i++) {
  const d = Math.hypot(np[3 * i] - sp[3 * i], np[3 * i + 1] - sp[3 * i + 1], np[3 * i + 2] - sp[3 * i + 2]);
  if (d > cell / 100) moved++;
  maxMove = Math.max(maxMove, d);
}

await shipped.transform(draco());
await io.write(out, shipped);
console.log(JSON.stringify({ reweighted, scales, vertices: n, worstMatch: worst, cell, moved, maxMove }));
