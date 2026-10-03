// Where the brain model's cerebellum and brainstem are, in its own coordinates (V8.3c room labels): the grey parts
// of its base colour (low saturation), split into the stem (the lowest grey, narrow) and the cerebellum (the rest of
// the grey, behind and under the lobes). Reads the Tripo output (no Draco) and samples its texture at each vertex's uv.
// Usage: node brain-parts.mjs <file.glb>
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import { fileURLToPath } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
import { pathToFileURL } from "url";
const { NodeIO } = await import(pathToFileURL(path.join(ROOT, "node_modules", "@gltf-transform", "core", "dist", "index.js")).href);
const sharp = require(path.join(ROOT, "node_modules", "sharp"));

const file = process.argv[2];
const doc = await new NodeIO().read(file);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute("POSITION").getArray();
const uv = prim.getAttribute("TEXCOORD_0").getArray();
const tex = prim.getMaterial().getBaseColorTexture();
const { data, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
const grey = [];
for (let i = 0; i < pos.length / 3; i += 3) {
  const u = uv[2 * i] % 1, v = uv[2 * i + 1] % 1;
  const x = Math.min(info.width - 1, Math.floor(u * info.width)), y = Math.min(info.height - 1, Math.floor(v * info.height));
  const k = (y * info.width + x) * info.channels;
  const [r, g, b] = [data[k], data[k + 1], data[k + 2]];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < 18 && mx > 140) grey.push([pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]]);
}
const minY = Math.min(...grey.map((p) => p[1]));
const mean = (ps) => ps.reduce((a, p) => [a[0] + p[0] / ps.length, a[1] + p[1] / ps.length, a[2] + p[2] / ps.length], [0, 0, 0]);
// The stem: grey points in the lowest 12% of the model's height. The cerebellum: grey points above that.
const stem = grey.filter((p) => p[1] < minY + 0.11);
const cereb = grey.filter((p) => p[1] >= minY + 0.15);
const fmt = (p) => p.map((v) => +v.toFixed(3));
console.log(JSON.stringify({ greyPoints: grey.length, minY: +minY.toFixed(3), stem: { n: stem.length, centre: fmt(mean(stem)) }, cerebellum: { n: cereb.length, centre: fmt(mean(cereb)), maxY: +Math.max(...cereb.map((p) => p[1])).toFixed(3) } }));
// Surface anchors: the cerebellum's most outward grey point at its middle height (the back), the stem's lowest.
const band = cereb.filter((p) => p[1] > -0.24 && p[1] < -0.12);
const c0 = mean(cereb);
const out = band.reduce((best, p) => (Math.hypot(p[0] - c0[0], p[2] - c0[2]) > Math.hypot(best[0] - c0[0], best[2] - c0[2]) ? p : best), band[0]);
const zs = cereb.map((p) => p[2]), xs = cereb.map((p) => p[0]);
console.log(JSON.stringify({ cerebOutward: fmt(out), cerebZ: [Math.min(...zs), Math.max(...zs)].map((v) => +v.toFixed(3)), cerebX: [Math.min(...xs), Math.max(...xs)].map((v) => +v.toFixed(3)), stemLow: fmt(stem.reduce((a, p) => (p[1] < a[1] ? p : a), stem[0])) }));
