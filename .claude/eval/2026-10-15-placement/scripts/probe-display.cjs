// Where is the classroom's display? Decodes the room GLB (Draco) and finds the display's rectangle: the front wall
// geometry at the display plane (README: z -5.574 world) whose UVs fall in the atlas tiles the room build gives the
// screen and the bezel (build_studio_room.py: "0.90,0.80" screen, "0.80,0.94" bezel). World coordinates apply the
// room's transform (Classroom.tsx ROOM_SHELL: position [0.2, -1.7, -2], scale 1, no rotation).
// Usage: node probe-display.cjs [glb=public/models/classroom_default.glb]
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "../../../..");
const draco3d = require(path.join(ROOT, "node_modules/draco3d"));
const file = process.argv[2] || path.join(ROOT, "public/models/classroom_default.glb");
const ROOM = [0.2, -1.7, -2];

(async () => {
  const buf = fs.readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  const binStart = 20 + jsonLen + 8;
  const decoder = await draco3d.createDecoderModule({});
  const prim = gltf.meshes[gltf.nodes[0].mesh].primitives[0];
  const ext = prim.extensions.KHR_draco_mesh_compression;
  const view = gltf.bufferViews[ext.bufferView];
  const data = new Int8Array(buf.buffer, buf.byteOffset + binStart + (view.byteOffset || 0), view.byteLength);
  const dec = new decoder.Decoder();
  const mesh = new decoder.Mesh();
  const st = dec.DecodeArrayToMesh(data, data.length, mesh);
  if (!st.ok()) throw new Error(st.error_msg());
  const read = (id, comps) => {
    const attr = dec.GetAttributeByUniqueId(mesh, id);
    const n = mesh.num_points() * comps;
    const ptr = decoder._malloc(n * 4);
    dec.GetAttributeDataArrayForAllPoints(mesh, attr, decoder.DT_FLOAT32, n * 4, ptr);
    const out = new Float32Array(decoder.HEAPF32.buffer, ptr, n).slice();
    decoder._free(ptr);
    return out;
  };
  const pos = read(ext.attributes.POSITION, 3);
  const uv = read(ext.attributes.TEXCOORD_0, 2);
  void uv;
  // The display stands proud of the front wall: list every depth layer above the panelling (y > -0.45) near the
  // wall, with its extent. The screen is the flat layer with a bezel layer just in front of and around it.
  const layers = new Map();
  for (let i = 0; i < pos.length / 3; i++) {
    const wx = ROOM[0] + pos[i * 3], wy = ROOM[1] + pos[i * 3 + 1], wz = ROOM[2] + pos[i * 3 + 2];
    if (wz < -5.7 || wz > -5.3 || wy < -0.45 || wy > 3) continue;
    const k = wz.toFixed(3);
    const t = layers.get(k) || { n: 0, x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
    t.n++; t.x0 = Math.min(t.x0, wx); t.x1 = Math.max(t.x1, wx); t.y0 = Math.min(t.y0, wy); t.y1 = Math.max(t.y1, wy);
    layers.set(k, t);
  }
  const r = (v) => v.toFixed(3);
  for (const [k, t] of [...layers].sort((a, b) => +b[0] - +a[0])) {
    console.log(`z ${k} n=${t.n} x ${r(t.x0)}..${r(t.x1)} (w ${r(t.x1 - t.x0)}) y ${r(t.y0)}..${r(t.y1)} (h ${r(t.y1 - t.y0)})`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
