/**
 * Everything but the shirt is the shipped file: node verify_rest.mjs <shipped.glb> <new.glb>  (from the repo root)
 * Compares decoded vertex attributes and morph targets of every primitive (the shirt's position, normal and skin
 * weights are expected to differ and are reported), every animation sampler, texture bytes, node transforms and skin
 * joints. Draco re-encoding reorders vertices within a primitive, so attributes are compared as sorted rows.
 */
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";

const require = createRequire(path.join(process.cwd(), "package.json"));
const imp = (p) => import(pathToFileURL(path.join(process.cwd(), "node_modules", p, "dist", "index.js")).href);
const { NodeIO } = await imp("@gltf-transform/core");
const { ALL_EXTENSIONS } = await imp("@gltf-transform/extensions");
const draco3d = require("draco3dgltf");
const { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(), "meshopt.decoder": MeshoptDecoder,
});
const [a, b] = await Promise.all(process.argv.slice(2).map((f) => io.read(f)));
const ra = a.getRoot(), rb = b.getRoot();
const SHIRT = "lambert3SG";
const out = { differs: [], same: 0, shirt: {} };

// Rows of all of a primitive's attributes and morph targets, joined per vertex, sorted: order-free comparison.
const rows = (p) => {
  const sem = p.listSemantics().sort();
  const n = p.getAttribute("POSITION").getCount();
  const cols = [];
  for (const s of sem) cols.push(p.getAttribute(s));
  p.listTargets().forEach((t) => t.listSemantics().sort().forEach((s) => cols.push(t.getAttribute(s))));
  const r = [];
  for (let i = 0; i < n; i++) r.push(cols.map((c) => Array.from(c.getElement(i, [])).map((x) => x.toFixed(4)).join(",")).join("|"));
  return r.sort();
};
const ma = ra.listMeshes(), mb = rb.listMeshes();
if (ma.length !== mb.length) out.differs.push("mesh count");
ma.forEach((m, i) => m.listPrimitives().forEach((p, j) => {
  const q = mb[i].listPrimitives()[j];
  const label = `${m.getName()}#${j} ${p.getMaterial()?.getName()}`;
  if (p.listTargets().length !== q.listTargets().length) out.differs.push(`${label}: morph count`);
  if (p.getMaterial()?.getName() === SHIRT) {
    for (const s of p.listSemantics()) {
      const x = p.getAttribute(s).getArray(), y = q.getAttribute(s).getArray();
      out.shirt[s] = x.length === y.length ? "same length" : "length differs";
    }
    out.shirt.vertices = [p.getAttribute("POSITION").getCount(), q.getAttribute("POSITION").getCount()];
    return;
  }
  const x = rows(p), y = rows(q);
  let d = 0;
  for (let k = 0; k < Math.max(x.length, y.length); k++) if (x[k] !== y[k]) d++;
  if (d) out.differs.push(`${label}: ${d} of ${x.length} rows`); else out.same++;
}));
const anims = (r) => r.listAnimations().map((an) => an.getName() + ":" + an.listChannels().map((c) =>
  `${c.getTargetNode()?.getName()}.${c.getTargetPath()}=${Array.from(c.getSampler().getInput().getArray()).length}/${Array.from(c.getSampler().getOutput().getArray()).map((v) => v.toFixed(5)).join(",")}`).join(";"));
const aa = anims(ra), ab = anims(rb);
out.animations = aa.length === ab.length && aa.every((s, i) => s === ab[i]) ? `identical (${aa.length})` : "DIFFER";
const tex = (r) => r.listTextures().map((t) => Buffer.from(t.getImage()).toString("base64"));
out.textures = JSON.stringify(tex(ra)) === JSON.stringify(tex(rb)) ? `identical (${tex(ra).length})` : "DIFFER";
const nodes = (r) => JSON.stringify(r.listNodes().map((n) => [n.getName(), n.getTranslation(), n.getRotation(), n.getScale()]));
out.nodes = nodes(ra) === nodes(rb) ? `identical (${ra.listNodes().length})` : "DIFFER";
const skins = (r) => JSON.stringify(r.listSkins().map((s) => s.listJoints().map((j) => j.getName())));
out.skins = skins(ra) === skins(rb) ? "identical" : "DIFFER";
out.morphNames = JSON.stringify(ma.map((m) => m.getExtras())) === JSON.stringify(mb.map((m) => m.getExtras())) ? "identical" : "DIFFER";
out.asset = JSON.stringify(a.getRoot().getAsset()) === JSON.stringify(b.getRoot().getAsset()) ? "identical" : "DIFFER";
console.log(JSON.stringify(out, null, 1));
