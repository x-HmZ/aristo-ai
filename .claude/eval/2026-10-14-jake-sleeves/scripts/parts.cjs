// Bytes per part of a GLB (JSON, per-mesh geometry, animation, images), to tell where two builds differ.
const fs = require("fs");
const b = fs.readFileSync(process.argv[2]);
const jl = b.readUInt32LE(12);
const j = JSON.parse(b.slice(20, 20 + jl).toString());
const bv = j.bufferViews;
const out = { json: jl, images: 0, anim: 0, meshes: {}, other: 0 };
const used = new Set();
const acc = (i) => j.accessors[i];
for (const im of j.images || []) { out.images += bv[im.bufferView].byteLength; used.add(im.bufferView); }
for (const a of j.animations || []) for (const s of a.samplers) for (const k of [s.input, s.output]) {
  const v = acc(k).bufferView; if (v !== undefined && !used.has(v)) { used.add(v); out.anim += bv[v].byteLength; }
}
for (const m of j.meshes) for (const p of m.primitives) {
  const d = p.extensions?.KHR_draco_mesh_compression;
  const views = d ? [d.bufferView] : Object.values(p.attributes).map((i) => acc(i).bufferView);
  for (const v of views) if (v !== undefined && !used.has(v)) { used.add(v); out.meshes[m.name] = (out.meshes[m.name] || 0) + bv[v].byteLength; }
}
bv.forEach((v, i) => { if (!used.has(i)) out.other += v.byteLength; });
out.animCounts = (j.animations || []).map((a) => `${a.name}:${a.channels.length}ch/${acc(a.samplers[0].input).count}k`);
console.log(JSON.stringify(out, null, 1));
