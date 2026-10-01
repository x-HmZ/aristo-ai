import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, LineBasicMaterial, LineSegments, Material, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Points, SRGBColorSpace, ShaderMaterial, Vector2, Vector3, type Object3D,
} from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { clockOf } from "../play";
import { HEART, MODEL_T, heartBuildAt } from "./scripts";
import { host } from "./host";
import { shared } from "./shared";
import { POINTS_FRAG, POINTS_VERT } from "./shaders";
import { damp, seg, smooth } from "./timeline";
import { warmUp } from "./warm";

/**
 * The demo's real Tripo model (public/demo/heart/model.glb, 1.88 MB, 501k triangles, three 2048px textures), resized
 * for the landing, where it is a few hundred pixels tall: 1024px textures, simplified to 100k triangles, Draco,
 * 624 kB (gltf-transform resize, simplify --ratio 0.2 --error 0.0005, draco; see the V8.3 eval README). Uploading
 * the original cost a 200 to 400ms frame mid-scroll.
 */
export const MODEL_URL = "/landing/heart.glb";
/** The lesson's own picture of the heart: its board infographic (Hmz, V8.3b: the picture is an infographic). */
export const SOURCE_URL = "/demo/heart/teaching.jpg";
/**
 * Where the heart itself is in the infographic, in uv (the title and the labels are around it): the model's front
 * view is mapped onto this box, so each point starts on the drawn heart, in its colour.
 */
const PICTURE_HEART = { u0: 0.24, u1: 0.75, v0: 0.24, v1: 0.9 } as const;
/** The picture card's width in model units: smaller than the model, so it stays in frame and clear of his hand. */
const CARD_W = 0.88;
/** The picture card floats this far in front of the model's centre, in model units. */
const CARD_Z = 0.45;
const POINTS = 26000;
const WIRE_TRIANGLES = 14000;

interface Built {
  points: BufferGeometry;
  wire: BufferGeometry;
  solid: Object3D;
  solidMaterials: Material[];
  card: { w: number; x: number; y: number };
}

/** The picture card's rounded corners (the system's surface radius, 16 of about 300 px), as an alpha map. */
function roundedMask(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(0, 0, 256, 256, 14);
  ctx.fill();
  return new CanvasTexture(c);
}

/** Pixels of an image, drawn small, for colour lookups by uv. */
function pixels(img: CanvasImageSource, size: number): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}
const at = (px: Uint8ClampedArray, size: number, u: number, v: number, out: Color): Color => {
  const x = Math.min(size - 1, Math.max(0, Math.floor(u * size)));
  const y = Math.min(size - 1, Math.max(0, Math.floor(v * size)));
  const i = (y * size + x) * 4;
  return out.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, SRGBColorSpace);
};

/**
 * Everything the build needs, computed once from the real assets: points sampled on the heart's surface (colour
 * from its texture) with starts on the flat picture (colour from the picture, at the pixel the front view maps to), a
 * sparse wireframe of the real mesh (every Nth triangle), and the solid model with fadeable materials.
 */
function build(scene: Object3D, photo: HTMLImageElement): Built {
  scene.updateMatrixWorld(true);
  let mesh: Mesh | null = null;
  scene.traverse((o) => { if (!mesh && (o as Mesh).isMesh) mesh = o as Mesh; });
  if (!mesh) throw new Error("heart model has no mesh");
  const m = mesh as Mesh;

  const PS = 256;
  const photoPx = pixels(photo, PS);
  const { u0, u1, v0, v1 } = PICTURE_HEART;

  const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as MeshStandardMaterial;
  const TS = 256;
  const texPx = mat.map?.image ? pixels(mat.map.image as CanvasImageSource, TS) : null;

  const sampler = new MeshSurfaceSampler(m).build();
  const pos = new Float32Array(POINTS * 3), start = new Float32Array(POINTS * 3);
  const c0 = new Float32Array(POINTS * 3), c1 = new Float32Array(POINTS * 3), delay = new Float32Array(POINTS);
  const p = new Vector3(), n = new Vector3(), uv = new Vector2(), col = new Color();
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < POINTS; i++) {
    sampler.sample(p, n, undefined, uv);
    p.applyMatrix4(m.matrixWorld);
    pos.set([p.x, p.y, p.z], i * 3);
    xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y);
    if (texPx) at(texPx, TS, uv.x, uv.y, col); else col.set("#b5433c");
    c1.set([col.r, col.g, col.b], i * 3);
  }
  // The card: the whole infographic, centred on the model's front view; the points start on its drawn heart and
  // grow onto the model as they fly.
  const cardW = CARD_W;
  const cardX = (xmin + xmax) / 2 - cardW / 2;
  const cardY = (ymin + ymax) / 2 + cardW / 2;
  for (let i = 0; i < POINTS; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1];
    const u = u0 + ((x - xmin) / (xmax - xmin)) * (u1 - u0);
    const v = v0 + ((ymax - y) / (ymax - ymin)) * (v1 - v0);
    start.set([cardX + u * cardW, cardY - v * cardW, CARD_Z], i * 3);
    at(photoPx, PS, u, v, col);
    c0.set([col.r, col.g, col.b], i * 3);
    // Top of the photo lifts first, with scatter, so it peels off rather than moving as a slab.
    delay[i] = 0.02 + 0.16 * v + Math.random() * 0.12;
  }
  const points = new BufferGeometry();
  points.setAttribute("position", new BufferAttribute(pos, 3));
  points.setAttribute("aStart", new BufferAttribute(start, 3));
  points.setAttribute("aC0", new BufferAttribute(c0, 3));
  points.setAttribute("aC1", new BufferAttribute(c1, 3));
  points.setAttribute("aDelay", new BufferAttribute(delay, 1));

  // Sparse wireframe: the three edges of every Nth triangle of the real mesh.
  const g = m.geometry;
  const src = g.getAttribute("position");
  const index = g.getIndex();
  const tris = (index ? index.count : src.count) / 3;
  const step = Math.max(1, Math.floor(tris / WIRE_TRIANGLES));
  const count = Math.floor(tris / step);
  const lines = new Float32Array(count * 18);
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let t = 0, k = 0; t < count; t++) {
    const f = t * step;
    const i0 = index ? index.getX(f * 3) : f * 3, i1 = index ? index.getX(f * 3 + 1) : f * 3 + 1, i2 = index ? index.getX(f * 3 + 2) : f * 3 + 2;
    a.fromBufferAttribute(src, i0).applyMatrix4(m.matrixWorld);
    b.fromBufferAttribute(src, i1).applyMatrix4(m.matrixWorld);
    c.fromBufferAttribute(src, i2).applyMatrix4(m.matrixWorld);
    for (const [s, e] of [[a, b], [b, c], [c, a]] as const) { lines.set([s.x, s.y, s.z, e.x, e.y, e.z], k); k += 6; }
  }
  const wire = new BufferGeometry();
  wire.setAttribute("position", new BufferAttribute(lines, 3));

  const solid = scene.clone(true);
  solid.name = "landing-heart-solid";
  const solidMaterials: Material[] = [];
  solid.traverse((o) => {
    const mm = o as Mesh;
    if (!mm.isMesh) return;
    const cloned = (Array.isArray(mm.material) ? mm.material : [mm.material]).map((x) => {
      const y = x.clone();
      y.transparent = true;
      y.opacity = 0;
      solidMaterials.push(y);
      return y;
    });
    mm.material = Array.isArray(mm.material) ? cloned : cloned[0];
  });
  return { points, wire, solid, solidMaterials, card: { w: cardW, x: cardX + cardW / 2, y: cardY - cardW / 2 } };
}

/**
 * Picture to 3D: the lesson's real infographic (`teaching.jpg`) floats where the heart will be; the pixels of its
 * drawn heart lift off as points, fly onto the real Tripo mesh (`model.glb`), a wireframe of the mesh shows through,
 * then the solid model fades in and the points fall away. An illustration of the step (the real model is made from
 * a separate generated photo), labelled so on the page. V8.3; V8.3b runs it on the model section's clock, beside
 * Jake's open hand.
 *
 * Once built it turns slowly and can be turned: `shared.heart.turn` is the reader's own turn (a drag, or Turn it),
 * eased towards; the slow turn stops once the reader has turned it. Replaying the build unwinds it to face them.
 */
export function HeartBuild() {
  const { scene } = useGLTF(MODEL_URL);
  const photo = useTexture(SOURCE_URL);
  photo.colorSpace = SRGBColorSpace;
  const built = useMemo(() => build(scene, photo.image as HTMLImageElement), [scene, photo]);
  const group = useRef<Group>(null);
  const spin = useRef(0);
  const turned = useRef(0);
  // `?still`: the still is captured facing the reader (the V8.3b eval, scripts/stills.cjs).
  const still = useMemo(() => new URLSearchParams(window.location.search).has("still"), []);

  const pointsMat = useMemo(() => new ShaderMaterial({
    uniforms: { t: { value: 0 }, size: { value: 9 }, pixelRatio: { value: 1 }, opacity: { value: 0 } },
    vertexShader: POINTS_VERT, fragmentShader: POINTS_FRAG, transparent: true, depthWrite: false,
  }), []);
  const wireMat = useMemo(() => new LineBasicMaterial({ color: "#f3c6a8", transparent: true, opacity: 0, depthWrite: false }), []);
  const cardMat = useMemo(() => new MeshBasicMaterial({ map: photo, alphaMap: roundedMask(), transparent: true, opacity: 0, toneMapped: false }), [photo]);
  const pointsObj = useMemo(() => new Points(built.points, pointsMat), [built, pointsMat]);
  const wireObj = useMemo(() => new LineSegments(built.wire, wireMat), [built, wireMat]);
  useEffect(() => () => { built.points.dispose(); built.wire.dispose(); built.solidMaterials.forEach((m) => m.dispose()); }, [built]);
  useEffect(() => () => { pointsMat.dispose(); wireMat.dispose(); cardMat.alphaMap?.dispose(); cardMat.dispose(); }, [pointsMat, wireMat, cardMat]);

  // Warmed before its beat (warm.ts): shaders compiled in parallel, textures uploaded in idle moments, then one
  // invisible draw for the geometry. Its first visible frame then costs what any other frame does.
  const { gl, scene: root, camera } = useThree();
  const warm = useRef(-1);
  useEffect(() => {
    let alive = true;
    const g = group.current;
    if (!g) return;
    void warmUp(gl, root, camera, g).catch(() => {}).then(() => { if (alive) warm.current = 1; });
    return () => { alive = false; };
  }, [gl, root, camera, built]);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    if (warm.current > 0) {
      warm.current = 0;
      g.visible = pointsObj.visible = wireObj.visible = built.solid.visible = true;
      pointsMat.uniforms.opacity.value = 0; wireMat.opacity = 0; cardMat.opacity = 0;
      for (const m of built.solidMaterials) { m.opacity = 0; m.transparent = true; }
      return;
    }
    if (warm.current < 0) return;
    // Only at its own spot: the picture uses the same place in the picture section.
    if (host.active !== "model") { g.visible = false; return; }
    const { build: b, show } = heartBuildAt(clockOf("model").t);
    g.visible = show > 0.001;
    if (!g.visible) return;
    const vis = smooth(show);
    pointsMat.uniforms.t.value = 0.95 * seg(b, 0.08, 0.8);
    pointsMat.uniforms.pixelRatio.value = state.gl.getPixelRatio();
    pointsMat.uniforms.opacity.value = vis * seg(b, 0.06, 0.12) * (1 - seg(b, 0.86, 0.97));
    pointsObj.visible = pointsMat.uniforms.opacity.value > 0.002;
    wireMat.opacity = vis * 0.5 * seg(b, 0.5, 0.66) * (1 - seg(b, 0.8, 0.94));
    wireObj.visible = wireMat.opacity > 0.002;
    cardMat.opacity = vis * (1 - seg(b, 0.1, 0.22));
    const solid = vis * smooth(seg(b, 0.72, 0.92));
    for (const m of built.solidMaterials) { m.opacity = solid; m.transparent = solid < 0.999; m.depthWrite = solid > 0.5; }
    built.solid.visible = solid > 0.002;
    // Turns slowly once built, until the reader turns it; unwinds to face them when the build replays.
    const h = shared.heart;
    if (b < 1) { spin.current = damp(spin.current, 0, 4, dt); h.turn = 0; h.user = false; turned.current = 0; }
    else {
      if (!h.user && !still) spin.current += dt * 0.35;
      turned.current = damp(turned.current, h.turn, 6, dt);
    }
    g.rotation.y = spin.current + turned.current;
    g.position.y = HEART.position[1] + Math.sin(state.clock.elapsedTime * 1.1) * 0.02 * smooth(seg(clockOf("model").t, MODEL_T.built, MODEL_T.length));
  });

  return (
    <group ref={group} name="landing-heart" position={HEART.position as [number, number, number]} scale={HEART.scale} visible={false}>
      <mesh position={[built.card.x, built.card.y, CARD_Z - 0.002]} material={cardMat}>
        <planeGeometry args={[built.card.w, built.card.w]} />
      </mesh>
      <primitive object={built.solid} />
      <primitive object={wireObj} />
      <primitive object={pointsObj} />
    </group>
  );
}

