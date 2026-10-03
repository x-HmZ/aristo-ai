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
import { Color, Group, MeshBasicMaterial, SRGBColorSpace, Vector3 } from "three";
import { Classroom } from "@/components/three/Classroom";
import { PAPER_ANCHOR, PAPER_DISTANCE_FACTOR, deskFraming } from "@/components/three/deskFraming";
import { QuizView } from "@/components/quiz/QuizView";
import { quiz as BRAIN_QUIZ } from "@/data/demo/brain";
import { BRAND_HEX } from "@/lib/brandColors";
import { clockOf } from "../play";
import { host, roomReady as emit } from "./host";
import { shared } from "./shared";
import { MODEL_LABELS, ROOM_PICTURE, ROOM_PICTURE_URL, ROOM_T, roomModel, roomStateAt, turnAt } from "./room";
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

/**
 * The brain's model, the lesson's own, placed from the presenting hand (room.ts roomModel), turning on the tour's clock
 * so its back comes round as the cerebellum and the brainstem are named; their labels come in then, each shown only
 * while its part faces the camera.
 */
function RoomModel() {
  const teacher = useSyncExternalStore(subscribeTeacher, getTeacher, getServerTeacher);
  const place = useMemo(() => roomModel(teacher), [teacher]);
  const { scene } = useGLTF(place.url);
  const camera = useThree((st) => st.camera);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const v = useMemo(() => ({ n: new Vector3(), p: new Vector3(), c: new Vector3() }), []);
  const model = useMemo(() => {
    const m = scene.clone(true);
    // The model alone, without its ring, for the verification's bounds (Probe).
    m.name = "landing-room-model-solid";
    return m;
  }, [scene]);
  const group = useRef<Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const now = t(), since = now - ROOM_T.model;
    const k = Math.min(1, Math.max(0, since / GROW_S));
    // Ease out, as the product's model settles in.
    const s = place.scale * (1 - Math.pow(1 - k, 3));
    g.visible = s > 1e-3;
    g.scale.setScalar(Math.max(s, 1e-4));
    g.rotation.y = turnAt(Math.max(now, ROOM_T.model));
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
      const o = (inRoom() && g.visible ? facing * timed : 0).toFixed(2);
      if (el.style.opacity !== o) el.style.opacity = o;
    });
  });
  return (
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
      {/* The product's glow ring at its base (GeneratedModel). */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <ringGeometry args={[0.6, 0.8, 32]} />
        <meshBasicMaterial color={BRAND_HEX.orangeMain} transparent opacity={0.15} />
      </mesh>
    </group>
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
