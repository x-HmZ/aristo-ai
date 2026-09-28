/**
 * Check a processed teacher (base GLB + clip pack) against the raw Blender
 * export, in three.js's own animation system.
 *
 *   node .claude/eval/2026-09-18-v9-bakeoff/scripts/v9_verify_anim.mjs \
 *        <raw.glb> <base.glb> [<pack.glb>] [--fps 24] [--fade-pairs N]
 *
 * v9_postprocess.mjs drops rest-value tracks and resamples. The claim is that
 * in three.js this changes nothing: a property no action drives is restored
 * to the node's loaded value, and in a crossfade that value is blended in for
 * the missing weight. So both files are turned into what GLTFLoader builds
 * (named Object3Ds at their node TRS, KeyframeTracks per channel) and played
 * through AnimationMixer. The processed clips play on the *base* file's node
 * tree, as they do in the app, where the pack binds to the mesh file's bones.
 *
 * Per clip, at every frame and every half frame: the largest world rotation
 * (deg) and position (mm) difference over all nodes. Then crossfades: pairs
 * of clips at weight 0.5 each, which is where a missing track would show.
 * Also checks that each processed file's node names match the raw one's.
 */

import { pathToFileURL } from "url";
import path from "path";
import { createRequire } from "module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const imp = (p) => import(pathToFileURL(path.join(process.cwd(), "node_modules", p, "dist", "index.js")).href);
const { NodeIO } = await imp("@gltf-transform/core");
const { ALL_EXTENSIONS } = await imp("@gltf-transform/extensions");
const THREE = await import(pathToFileURL(path.join(process.cwd(), "node_modules", "three", "build", "three.module.js")).href);
const draco3d = require("draco3dgltf");
const { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;

const args = process.argv.slice(2);
const files = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"));
const opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : Number(args[i + 1]); };
const [rawPath, basePath, packPath] = files;
const FPS = opt("--fps", 24);
const FADE_PAIRS = opt("--fade-pairs", 40);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "meshopt.decoder": MeshoptDecoder,
});

function tree(doc) {
  const map = new Map();
  const root = new THREE.Object3D();
  for (const n of doc.getRoot().listNodes()) {
    const o = new THREE.Object3D();
    o.name = THREE.PropertyBinding.sanitizeNodeName(n.getName());
    o.position.fromArray(n.getTranslation());
    o.quaternion.fromArray(n.getRotation());
    o.scale.fromArray(n.getScale());
    map.set(n, o);
  }
  for (const [n, o] of map) {
    const p = n.getParentNode();
    (p ? map.get(p) : root).add(o);
  }
  return { root, objects: [...map.values()] };
}

const TRACK = { rotation: THREE.QuaternionKeyframeTrack, translation: THREE.VectorKeyframeTrack,
  scale: THREE.VectorKeyframeTrack };
const PROP = { rotation: "quaternion", translation: "position", scale: "scale" };

function clips(doc) {
  return doc.getRoot().listAnimations().map((a) => {
    const tracks = a.listChannels().flatMap((ch) => {
      const p = ch.getTargetPath();
      if (!TRACK[p]) return [];
      const s = ch.getSampler();
      const name = THREE.PropertyBinding.sanitizeNodeName(ch.getTargetNode().getName());
      const interp = s.getInterpolation() === "STEP" ? THREE.InterpolateDiscrete : THREE.InterpolateLinear;
      // GLTFLoader decodes normalized outputs (int16 rotations) the same way.
      const out = s.getOutput();
      const scale = !out.getNormalized() ? 1
        : out.getArray() instanceof Int16Array ? 1 / 32767
        : out.getArray() instanceof Int8Array ? 1 / 127
        : out.getArray() instanceof Uint16Array ? 1 / 65535 : 1 / 255;
      const values = out.getNormalized()
        ? Array.from(out.getArray(), (v) => Math.max(v * scale, -1))
        : Array.from(out.getArray());
      return [new TRACK[p](`${name}.${PROP[p]}`, Array.from(s.getInput().getArray()), values, interp)];
    });
    return new THREE.AnimationClip(a.getName(), -1, tracks);
  });
}

function pose(t, root, objects, plays) {
  const mixer = new THREE.AnimationMixer(root);
  for (const [clip, time, w] of plays) {
    const act = mixer.clipAction(clip);
    act.setEffectiveWeight(w);
    act.play();
    act.time = time;
  }
  mixer.update(0);
  root.updateMatrixWorld(true);
  const out = new Map();
  for (const o of objects) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    o.matrixWorld.decompose(p, q, s);
    out.set(o.name, [p, q]);
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  return out;
}

function diff(a, b) {
  let deg = 0, mm = 0, where = "";
  for (const [name, [pa, qa]] of a) {
    const r = b.get(name);
    if (!r) continue;
    // Normalize first: int16 quaternions are unit length only to ~4e-5, and
    // 2 acos(dot) near 1 turns that into a spurious ~0.7 deg. The length
    // error itself scales a bone by ~0.008%, which the mm figure bounds.
    const d = (qa.clone().normalize().angleTo(r[1].clone().normalize()) * 180) / Math.PI;
    const m = pa.distanceTo(r[0]) * 1000;
    if (d > deg) { deg = d; where = name; }
    mm = Math.max(mm, m);
  }
  return { deg, mm, where };
}

const raw = await io.read(rawPath);
const baseDoc = await io.read(basePath);
const packDoc = packPath ? await io.read(packPath) : null;

const R = tree(raw);
const P = tree(baseDoc);
const names = (d) => d.getRoot().listNodes().map((n) => n.getName()).join("|");
const report = [];
report.push(`nodes raw ${raw.getRoot().listNodes().length} base ${baseDoc.getRoot().listNodes().length}` +
  (packDoc ? ` pack ${packDoc.getRoot().listNodes().length}` : ""));
if (packDoc && names(packDoc) !== names(baseDoc)) {
  const pb = new Set(packDoc.getRoot().listNodes().map((n) => n.getName()));
  const missing = baseDoc.getRoot().listNodes().map((n) => n.getName()).filter((n) => !pb.has(n));
  report.push(`WARN pack node list differs from base (${missing.length} base nodes missing in pack)`);
}

const rawClips = new Map(clips(raw).map((c) => [c.name, c]));
const newClips = new Map([...clips(baseDoc), ...(packDoc ? clips(packDoc) : [])].map((c) => [c.name, c]));
const count = (d) => d.getRoot().listAnimations().reduce((n, a) => n + a.listChannels().length, 0);
report.push(`channels raw ${count(raw)} -> base ${count(baseDoc)}${packDoc ? ` + pack ${count(packDoc)}` : ""}`);

let worst = { deg: 0, mm: 0 };
for (const [name, rc] of rawClips) {
  const nc = newClips.get(name);
  if (!nc) { report.push(`MISSING ${name}`); worst.deg = Infinity; continue; }
  let w = { deg: 0, mm: 0, where: "", t: 0 };
  const steps = Math.round(rc.duration * FPS * 2);
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(rc.duration, i / (FPS * 2));
    const d = diff(pose(t, R.root, R.objects, [[rc, t, 1]]), pose(t, P.root, P.objects, [[nc, t, 1]]));
    if (d.deg > w.deg) w = { ...d, t };
    w.mm = Math.max(w.mm, d.mm);
  }
  report.push(`${name.padEnd(12)} ${rc.tracks.length} -> ${nc.tracks.length} tracks, ` +
    `max ${w.deg.toFixed(4)} deg (${w.where} @ ${w.t.toFixed(2)} s), ${w.mm.toFixed(3)} mm`);
  worst.deg = Math.max(worst.deg, w.deg);
  worst.mm = Math.max(worst.mm, w.mm);
}

// Crossfades: every ordered pair, a few sample times each, weights 0.5/0.5.
const list = [...rawClips.keys()].filter((n) => newClips.has(n));
let fade = { deg: 0, mm: 0 }, pairs = 0;
for (const a of list) for (const b of list) {
  if (a === b || pairs >= FADE_PAIRS) continue;
  pairs++;
  for (const f of [0.1, 0.5, 0.9]) {
    const ta = rawClips.get(a).duration * f, tb = rawClips.get(b).duration * (1 - f);
    const d = diff(
      pose(0, R.root, R.objects, [[rawClips.get(a), ta, 0.5], [rawClips.get(b), tb, 0.5]]),
      pose(0, P.root, P.objects, [[newClips.get(a), ta, 0.5], [newClips.get(b), tb, 0.5]]));
    fade.deg = Math.max(fade.deg, d.deg);
    fade.mm = Math.max(fade.mm, d.mm);
  }
}
report.push(`crossfades: ${pairs} pairs x 3 times, max ${fade.deg.toFixed(4)} deg, ${fade.mm.toFixed(3)} mm`);
report.push(`WORST single clip ${worst.deg.toFixed(4)} deg ${worst.mm.toFixed(3)} mm`);
console.log(report.join("\n"));
