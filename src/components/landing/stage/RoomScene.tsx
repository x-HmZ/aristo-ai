"use client";

/**
 * Step Into the Classroom's room (V8.3b; the brain lesson since V8.3c): the product's own classroom, with the lesson's
 * picture, its model and the quiz on your desk, each shown on the tour's clock (room.ts). Its own chunk, imported only once the
 * reader is near the section (LandingStage): Classroom preloads the room's GLB when its module loads, so nothing of
 * the room is fetched before then. It warms up hidden (shaders compiled, textures uploaded, each mesh drawn once in
 * an idle moment), and is drawn only while the canvas serves the room.
 */
import { Html, useGLTF, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  BufferAttribute, BufferGeometry, Color, Group, Matrix4, MeshBasicMaterial, Points, Quaternion, SRGBColorSpace, ShaderMaterial,
  Vector2, Vector3, type Material, type Mesh, type MeshStandardMaterial, type Object3D,
} from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { Classroom } from "@/components/three/Classroom";
import { PAPER_ANCHOR, PAPER_DISTANCE_FACTOR, deskFraming } from "@/components/three/deskFraming";
import { QuizView } from "@/components/quiz/QuizView";
import { quiz as BRAIN_QUIZ } from "@/data/demo/brain";
import { BRAND_HEX } from "@/lib/brandColors";
import { clockOf } from "../play";
import { host, roomReady as emit } from "./host";
import { shared } from "./shared";
import {
  MODEL_BUILD, MODEL_LABELS, PICTURE_BRAIN, ROOM_PICTURE, ROOM_PICTURE_URL, ROOM_T, modelBuildAt, modelTurnAt, onPicture, roomModel,
  roomStateAt,
} from "./room";
import { POINTS_FRAG, POINTS_VERT } from "./shaders";
import { getServerTeacher, getTeacher, subscribeTeacher } from "../teacher";
import { drawEach, warmUp } from "./warm";

const SIZE = ROOM_PICTURE.size;
/** The product's white frame around a lesson picture (Experience FRAME_SIZE 1.525 for IMG_SIZE 1.455), at its scale. */
const FRAME = SIZE + 0.07 * ROOM_PICTURE.k;
/** The product's picture fades in over 200 ms; the landing's swap to the model takes a little longer. */
const FADE_S = 0.25;
/** The model scales in over this, as the picture goes. */
const GROW_S = 0.5;
/** A label fades in over this once its word is said. */
const LABEL_IN_S = 0.35;

/** React 18 passes `inert` through only as a string (a boolean is a React 19 prop). */
const INERT = { inert: "" } as Record<string, string>;

const inRoom = () => host.active === "room";
const t = () => clockOf("room").t;

/** The lesson's picture on the board, as the classroom shows it (a crisp plane in a white frame). */
function RoomPicture() {
  const tex = useTexture(ROOM_PICTURE_URL);
  tex.colorSpace = SRGBColorSpace;
  const group = useRef<Group>(null);
  const pic = useMemo(() => new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, toneMapped: false }), [tex]);
  const frame = useMemo(() => new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, toneMapped: false }), []);
  useEffect(() => () => { pic.dispose(); frame.dispose(); }, [pic, frame]);
  const shown = useRef(0);
  useFrame((_, dt) => {
    const on = roomStateAt(t()).picture;
    shown.current = Math.min(1, Math.max(0, shown.current + (on ? dt : -dt) / FADE_S));
    // A jump (a tab) lands on the new state at once.
    if (Math.abs(t() - ROOM_T.picture[0]) > 1 && Math.abs(t() - ROOM_T.picture[1]) > 1) shown.current = on ? 1 : 0;
    pic.opacity = shown.current;
    frame.opacity = shown.current;
    if (group.current) group.current.visible = shown.current > 0.001;
  });
  return (
    <group ref={group} name="landing-room-picture" position={ROOM_PICTURE.position as unknown as [number, number, number]}>
      <mesh position={[0, 0, -0.004]} material={frame}>
        <planeGeometry args={[FRAME, FRAME]} />
      </mesh>
      <mesh material={pic}>
        <planeGeometry args={[SIZE, SIZE]} />
      </mesh>
    </group>
  );
}

/** Pixels of an image, drawn small, for colour lookups by uv. */
function pixels(img: CanvasImageSource, size: number): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}
const colourAt = (px: Uint8ClampedArray, size: number, u: number, v: number, out: Color): Color => {
  const x = Math.min(size - 1, Math.max(0, Math.floor(u * size))), y = Math.min(size - 1, Math.max(0, Math.floor(v * size)));
  const i = (y * size + x) * 4;
  return out.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, SRGBColorSpace);
};

const BUILD_POINTS = 22000;

/**
 * The points of the picture becoming the model, in world space: each starts on the board's drawn brain (its pixel's
 * colour; room.ts PICTURE_BRAIN, mapped by where it will be on the model as the camera sees it) and ends on the real
 * mesh's surface (its texture's colour), where the model will be once built (placed and turned as `modelTurnAt` holds
 * it). The heart's build (HeartBuild.tsx), in the room.
 */
function buildPoints(scene: Object3D, picture: HTMLImageElement, place: ReturnType<typeof roomModel>): BufferGeometry {
  scene.updateMatrixWorld(true);
  let mesh: Mesh | null = null;
  scene.traverse((o) => { if (!mesh && (o as Mesh).isMesh) mesh = o as Mesh; });
  if (!mesh) throw new Error("the brain model has no mesh");
  const m = mesh as Mesh;
  const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as MeshStandardMaterial;
  const TS = 256, PS = 256;
  const tex = mat.map?.image ? pixels(mat.map.image as CanvasImageSource, TS) : null;
  const pic = pixels(picture, PS);
  const world = new Matrix4().compose(
    new Vector3(...place.position),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), modelTurnAt(MODEL_BUILD[1])),
    new Vector3(place.scale, place.scale, place.scale),
  ).multiply(m.matrixWorld);
  const sampler = new MeshSurfaceSampler(m).build();
  const pos = new Float32Array(BUILD_POINTS * 3), start = new Float32Array(BUILD_POINTS * 3);
  const c0 = new Float32Array(BUILD_POINTS * 3), c1 = new Float32Array(BUILD_POINTS * 3), delay = new Float32Array(BUILD_POINTS);
  const q = new Vector3(), n = new Vector3(), uv = new Vector2(), col = new Color();
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < BUILD_POINTS; i++) {
    sampler.sample(q, n, undefined, uv);
    q.applyMatrix4(world);
    pos.set([q.x, q.y, q.z], i * 3);
    xmin = Math.min(xmin, q.x); xmax = Math.max(xmax, q.x); ymin = Math.min(ymin, q.y); ymax = Math.max(ymax, q.y);
    if (tex) colourAt(tex, TS, uv.x, uv.y, col); else col.set("#c9b8d8");
    c1.set([col.r, col.g, col.b], i * 3);
  }
  const { u0, u1, v0, v1 } = PICTURE_BRAIN;
  for (let i = 0; i < BUILD_POINTS; i++) {
    const u = u0 + ((pos[i * 3] - xmin) / (xmax - xmin)) * (u1 - u0);
    const v = v0 + ((ymax - pos[i * 3 + 1]) / (ymax - ymin)) * (v1 - v0);
    start.set(onPicture(u, v), i * 3);
    colourAt(pic, PS, u, v, col);
    c0.set([col.r, col.g, col.b], i * 3);
    // The top of the drawing lifts first, with scatter, so it peels off rather than moving as a slab.
    delay[i] = 0.02 + 0.16 * v + Math.random() * 0.12;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aStart", new BufferAttribute(start, 3));
  g.setAttribute("aC0", new BufferAttribute(c0, 3));
  g.setAttribute("aC1", new BufferAttribute(c1, 3));
  g.setAttribute("aDelay", new BufferAttribute(delay, 1));
  return g;
}

/**
 * The brain's model, the lesson's own, placed from the presenting hand (room.ts roomModel). At its cue the board's
 * diagram becomes it (buildPoints); then it turns on the tour's clock so its back comes round as the cerebellum and the
 * brainstem are named; their labels come in then, each shown only while its part faces the camera.
 */
function RoomModel() {
  const teacher = useSyncExternalStore(subscribeTeacher, getTeacher, getServerTeacher);
  const place = useMemo(() => roomModel(teacher), [teacher]);
  const { scene } = useGLTF(place.url);
  const picture = useTexture(ROOM_PICTURE_URL);
  const camera = useThree((st) => st.camera);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const v = useMemo(() => ({ n: new Vector3(), p: new Vector3(), c: new Vector3() }), []);
  // Its own materials, to fade in as the points arrive.
  const { model, fades } = useMemo(() => {
    const m = scene.clone(true);
    // The model alone, without its ring, for the verification's bounds (Probe).
    m.name = "landing-room-model-solid";
    const list: Material[] = [];
    m.traverse((o) => {
      const mm = o as Mesh;
      if (!mm.isMesh) return;
      const copy = (Array.isArray(mm.material) ? mm.material : [mm.material]).map((x) => { const y = x.clone(); list.push(y); return y; });
      mm.material = Array.isArray(mm.material) ? copy : copy[0];
    });
    return { model: m, fades: list };
  }, [scene]);
  const points = useMemo(() => buildPoints(scene, picture.image as HTMLImageElement, place), [scene, picture, place]);
  const pointsMat = useMemo(() => new ShaderMaterial({
    uniforms: { t: { value: 0 }, size: { value: 7 }, pixelRatio: { value: 1 }, opacity: { value: 0 } },
    vertexShader: POINTS_VERT, fragmentShader: POINTS_FRAG, transparent: true, depthWrite: false,
  }), []);
  const pointsObj = useMemo(() => { const o = new Points(points, pointsMat); o.frustumCulled = false; return o; }, [points, pointsMat]);
  useEffect(() => () => { points.dispose(); }, [points]);
  useEffect(() => () => { pointsMat.dispose(); for (const f of fades) f.dispose(); }, [pointsMat, fades]);
  const group = useRef<Group>(null);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const now = t(), b = modelBuildAt(now);
    const seg = (x: number, a: number, c: number) => Math.min(1, Math.max(0, (x - a) / (c - a)));
    const shown = now >= ROOM_T.model;
    // The points: on the picture, lifting off, flying onto the mesh; gone once the solid is there.
    pointsMat.uniforms.t.value = 0.95 * seg(b, 0.04, 0.82);
    pointsMat.uniforms.pixelRatio.value = state.gl.getPixelRatio();
    pointsMat.uniforms.opacity.value = inRoom() && shown ? seg(b, 0, 0.06) * (1 - seg(b, 0.86, 1)) : 0;
    pointsObj.visible = pointsMat.uniforms.opacity.value > 0.002;
    // The solid fades in as they land.
    const solid = shown ? seg(b, 0.66, 0.94) : 0;
    for (const f of fades) { f.transparent = solid < 0.999; f.opacity = solid; f.depthWrite = solid > 0.5; }
    g.visible = solid > 0.002;
    g.scale.setScalar(place.scale);
    g.rotation.y = modelTurnAt(now);
    g.updateMatrixWorld();
    // Each label: in once its word is said (until the desk), and only while its part faces the camera.
    const said = now - ROOM_T.lines[2].at;
    MODEL_LABELS.forEach((label, i) => {
      const el = labels.current[i];
      if (!el) return;
      v.n.set(...label.facing).normalize().applyQuaternion(g.quaternion);
      v.p.set(...label.at).applyMatrix4(g.matrixWorld);
      v.c.copy(camera.position).sub(v.p).normalize();
      // Seen from the side the parts still read (they sit under and behind the lobes): out only once turned away.
      const facing = Math.min(1, Math.max(0, (v.n.dot(v.c) + 0.3) / 0.3));
      const timed = now < ROOM_T.quiz[0] ? Math.min(1, Math.max(0, (said - label.from) / LABEL_IN_S)) : 0;
      const o = (inRoom() && g.visible ? facing * timed * solid : 0).toFixed(2);
      if (el.style.opacity !== o) el.style.opacity = o;
    });
  });
  return (
    <>
      <primitive object={pointsObj} />
      <group ref={group} name="landing-room-model" position={place.position as unknown as [number, number, number]} visible={false}>
        <primitive object={model} />
        {MODEL_LABELS.map((label, i) => (
          <Html key={label.name} position={label.at as unknown as [number, number, number]} zIndexRange={[16, 0]} style={{ pointerEvents: "none" }}>
            <div
              ref={(el) => { labels.current[i] = el; }}
              {...INERT}
              aria-hidden
              className="landing-room-label theme-ink flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface/90 py-1 pl-1.5 pr-2.5 text-[13px] font-semibold text-ink shadow-e1"
              // The dot on the part, the name beside it.
              style={{ opacity: 0, transform: "translate(-9px, -50%)" }}
            >
              <span className="size-1.5 rounded-full bg-accent" />
              {label.name}
            </div>
          </Html>
        ))}
        {/* The product's glow ring, under the model (its local units: the GLB is centred, its foot at -0.454). */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.47}>
          <ringGeometry args={[0.45, 0.6, 32]} />
          <meshBasicMaterial color={BRAND_HEX.orangeMain} transparent opacity={0.15} />
        </mesh>
      </group>
    </>
  );
}

/**
 * The quiz on your desk: the product's own QuizView on the product's paper, flat on the desk (DeskQuiz's recipe),
 * showing the volcano lesson's first question. Shown, not answered: it is inert, and the page never writes to the
 * lesson store.
 */
function RoomQuiz() {
  const size = useThree((s) => s.size);
  const { cardWidth, maxHeight } = useMemo(() => deskFraming(size.width, size.height, 40), [size.width, size.height]);
  const paper = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const el = paper.current;
    if (!el) return;
    const on = inRoom() && roomStateAt(t()).quiz;
    const d = on ? "block" : "none";
    if (el.style.display !== d) el.style.display = d;
  });
  return (
    <Html position={PAPER_ANCHOR} transform rotation-x={-Math.PI / 2} distanceFactor={PAPER_DISTANCE_FACTOR} zIndexRange={[15, 0]}>
      <div
        ref={paper}
        {...INERT}
        aria-hidden
        className="theme-paper landing-room-paper pointer-events-none select-none rounded-2xl border border-line bg-surface px-5 py-[18px] text-ink"
        style={{ width: `${cardWidth}px`, maxHeight: `${maxHeight}px`, overflow: "hidden", display: "none", boxShadow: "0 32px 90px rgba(30,14,6,0.65)" }}
      >
        <QuizView conceptId="brain" questions={BRAIN_QUIZ} userId="landing" onComplete={() => {}} localOnly />
      </div>
    </Html>
  );
}

export default function RoomScene() {
  const group = useRef<Group>(null);
  const { gl, scene, camera } = useThree();
  const ready = useRef(false);
  const backdrop = useMemo(() => new Color(BRAND_HEX.backdrop), []);
  useEffect(() => {
    let alive = true;
    const g = group.current;
    if (!g) return;
    // Compiled, uploaded, then each mesh drawn once in an idle moment of its own (warm.ts), while the reader is still
    // above the section: its first frame is then an ordinary one.
    void warmUp(gl, scene, camera, g)
      .then(() => drawEach(gl, scene, camera, g, () => alive))
      .catch(() => {})
      .then(() => {
        if (!alive) return;
        ready.current = true;
        shared.room.ready = true;
        emit();
      });
    return () => { alive = false; };
  }, [gl, scene, camera]);
  useEffect(() => () => { scene.background = null; shared.room.ready = false; }, [scene]);
  useFrame(() => {
    const on = ready.current && inRoom();
    if (group.current) group.current.visible = on;
    // Past the room's windows, the classroom's own backdrop; elsewhere the canvas stays clear over the page.
    const bg = on ? backdrop : null;
    if (scene.background !== bg) scene.background = bg;
  }, -1);
  return (
    <group ref={group} visible={false}>
      <Classroom variant="default" />
      <RoomPicture />
      <RoomModel />
      <RoomQuiz />
    </group>
  );
}
