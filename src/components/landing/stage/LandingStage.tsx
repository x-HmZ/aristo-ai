"use client";

/**
 * The landing's live 3D stage (V8.3). Loaded only on the full path, after first paint (LandingRoot), never on a
 * phone, a weak GPU or under reduced motion (gate.ts). One canvas, fixed behind the page; one render loop:
 *
 *   1. `advance` the scroll driver (scene time S from the scroll position, damped);
 *   2. place the camera for S (timeline.ts cameraAt) and project the classroom display for the DOM;
 *   3. `flush` the DOM writers, so text that follows the scene moves in the same frame as the scene;
 *   4. every other part (teacher, diagram, heart, desk card) reads S in its own useFrame.
 *
 * No React state changes per frame; React re-renders only when a part mounts (lazy assets) or the teacher's act
 * changes. The room is the product's own (Classroom, the lights, the backdrop); the teacher is the product's Teacher
 * driven through its `driver` prop, so the director plays the same clips for the same signals as in a lesson.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Group, Vector3, type PerspectiveCamera } from "three";
import { Classroom } from "@/components/three/Classroom";
import { RendererConfig, SceneLights } from "@/components/three/Experience";
import { AVATAR_ASSETS, Teacher, type LookTargets, type TeacherDriver } from "@/components/three/Teacher";
import { DESK_POS, DESK_POSE, PAPER_ANCHOR, PAPER_DISTANCE_FACTOR, deskFraming } from "@/components/three/deskFraming";
import { BRAND_HEX } from "@/lib/brandColors";
import { cn } from "@/lib/utils";
import { SHAPE } from "@/lib/design/shape";
import { CHALLENGE_QUESTION } from "../content";
import { Diagram } from "./Diagram";
import { HeartBuild } from "./HeartBuild";
import { SLOW_SAMPLE_FRAMES, isSlow } from "./gate";
import { advance, flush, getFrame, setExternal } from "./scroll";
import { shared } from "./shared";
import { visemeNow } from "./sound";
import { actAt, cameraAt, roomAt, teacherSignals, teacherYaw, type Pose } from "./timeline";

const SCENE: [number, number, number] = [0.37, 0.18, -3];
const LOOK: LookTargets = { board: SCENE, model: SCENE, desk: PAPER_ANCHOR };
const TEACHER_POS: [number, number, number] = [-1, -1.7, -3];
// The classroom display (Classroom.tsx ROOM_SHELL board, a 4.2 x 2.1 plane).
const DISPLAY = { c: [0.45, 0.382, -6], w: 4.2, h: 2.1 } as const;

interface StageProps {
  /** Render frames (false while the room is faded out: the map, the parents). */
  active: boolean;
  /** The room and the teacher have painted. */
  onLive: () => void;
  /** The first frames were too slow for this machine: hand over to the lite path. */
  onSlow: () => void;
}

/** Runs first each frame: the scroll, the camera, the display projection, then the DOM writers. */
function Director({ onSlow, ready }: { onSlow: () => void; ready: boolean }) {
  const { camera, size } = useThree();
  const cam = camera as PerspectiveCamera;
  const desk = useMemo<Pose>(() => {
    const f = deskFraming(size.width, size.height, cam.fov);
    // On a landscape canvas deskFraming returns the raw DESK_POS, which OrbitControls clamps in the classroom; the
    // landing has no OrbitControls, so it uses the clamped pose the classroom actually renders (DESK_POSE).
    const pos = f.pos === DESK_POS ? DESK_POSE : ([f.pos.x, f.pos.y, f.pos.z] as const);
    return { pos, target: [f.target.x, f.target.y, f.target.z] };
  }, [size.width, size.height, cam.fov]);
  const look = useMemo(() => new Vector3(), []);
  const corner = useMemo(() => new Vector3(), []);
  const samples = useRef<number[]>([]);
  const judged = useRef(false);

  useFrame((_, dt) => {
    advance(dt);
    const { S } = getFrame();
    const pose = cameraAt(S, desk);
    cam.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    cam.lookAt(look.set(pose.target[0], pose.target[1], pose.target[2]));
    // Lens shift towards the framed window (LandingRoot sets it; last frame's value, which is a frame behind at most).
    const { x: lx, y: ly } = shared.lens;
    if (Math.abs(lx) > 0.5 || Math.abs(ly) > 0.5) cam.setViewOffset(size.width, size.height, -lx, -ly, size.width, size.height);
    else if (cam.view?.enabled) cam.clearViewOffset();
    cam.updateMatrixWorld();
    // The display's rectangle on screen, for the Idea's text.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      corner.set(DISPLAY.c[0] + (sx * DISPLAY.w) / 2, DISPLAY.c[1] + (sy * DISPLAY.h) / 2, DISPLAY.c[2]).project(cam);
      const px = ((corner.x + 1) / 2) * size.width, py = ((1 - corner.y) / 2) * size.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    shared.display = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    flush();
    // The stage's own check: once live, the first frames' times decide if this machine keeps it.
    if (ready && !judged.current) {
      samples.current.push(dt * 1000);
      if (samples.current.length >= SLOW_SAMPLE_FRAMES) {
        judged.current = true;
        if (isSlow(samples.current)) onSlow();
      }
    }
  }, -2);
  return null;
}

/** Mounts after the teacher's Suspense resolves: reports the first painted frame. */
function LiveMarker({ onLive }: { onLive: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onLive();
  });
  return null;
}

/** Jake, driven by the scroll timeline. Two acts: the page, and the close (a fresh mount, so he waves goodbye). */
function StageTeacher({ onLive }: { onLive: () => void }) {
  const turn = useRef<Group>(null);
  const readyAt = useRef<number | null>(null);
  const [act, setAct] = useState(() => actAt(getFrame().S));
  const [packs, setPacks] = useState(false);
  const clock = useRef(0);
  // `?pose=board` holds the opening pose (turned to the board, no greeting): how the poster is captured, so the
  // live stage starts exactly where the poster left off (.claude/eval/2026-09-30-v8-3-landing/scripts/stills.cjs).
  const hold = useMemo(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pose") === "board", []);
  const driver = useMemo<TeacherDriver>(() => ({
    signals: () => teacherSignals(getFrame().S, {
      greeted: !hold && readyAt.current !== null && clock.current - readyAt.current > 1.4,
      speaking: shared.speaking,
    }),
    viseme: visemeNow,
    clipPacks: packs,
  }), [packs, hold]);

  useFrame((_, dt) => {
    clock.current += dt;
    const S = getFrame().S;
    const a = actAt(S);
    if (a !== act) { setAct(a); readyAt.current = null; }
    if (readyAt.current === null && shared.live) readyAt.current = clock.current;
    // The opening turn from the board to the student, on the page act only (the close starts facing you).
    const since = readyAt.current === null || hold ? 0 : clock.current - readyAt.current;
    if (turn.current) turn.current.rotation.y = act === "page" && S < 1 ? teacherYaw(since) : 0;
  });

  return (
    <group ref={turn} position={TEACHER_POS}>
      <Suspense fallback={null}>
        <Teacher
          key={act}
          teacher="jake"
          position={[0, 0, 0]}
          scale={AVATAR_ASSETS.jake.standScale}
          rotationY={0.3}
          lookTargets={LOOK_LOCAL}
          driver={driver}
        />
        <LiveMarker onLive={() => { onLive(); setPacks(true); }} />
      </Suspense>
    </group>
  );
}
// The teacher's group sits at TEACHER_POS, so its look targets stay in world space (Teacher reads them as such).
const LOOK_LOCAL = LOOK;

/** The challenge on the desk (plan 6B), the product's paper recipe: lies flat, `.theme-paper`, sized by deskFraming. */
function DeskCard() {
  const { size, camera } = useThree();
  const width = deskFraming(size.width, size.height, (camera as PerspectiveCamera).fov).cardWidth;
  const el = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const d = roomAt(getFrame().S).desk;
    const s = el.current?.style;
    if (!s) return;
    s.opacity = d.toFixed(3);
    s.display = d > 0.001 ? "block" : "none";
  });
  return (
    <Html position={PAPER_ANCHOR} transform rotation-x={-Math.PI / 2} distanceFactor={PAPER_DISTANCE_FACTOR} zIndexRange={[20, 0]}>
      <div
        ref={el}
        className={cn(SHAPE.surface, "theme-paper border border-line bg-surface px-5 py-[18px] text-ink")}
        style={{ width, display: "none", boxShadow: "0 32px 90px rgba(30,14,6,0.65)" }}
      >
        <p className="text-xs font-semibold text-accent-text">Challenge, step 4 of 5</p>
        <p className="mt-2 text-xl font-semibold leading-snug">{CHALLENGE_QUESTION}</p>
        <p className="mt-3 text-sm text-body">Answer out loud, or type it.</p>
      </div>
    </Html>
  );
}

/** Mounts its children once scene time passes `from` (the lazy assets: the diagram, then the heart). */
function After({ from, children }: { from: number; children: React.ReactNode }) {
  const [on, setOn] = useState(() => getFrame().S >= from);
  useFrame(() => { if (!on && getFrame().S >= from) setOn(true); });
  return on ? <>{children}</> : null;
}

export default function LandingStage({ active, onLive, onSlow }: StageProps) {
  const [ready, setReady] = useState(false);
  // The render loop ticks the scroll driver while it runs; paused (the map, the parents), the driver ticks itself,
  // which is also what notices the room coming back and resumes the stage.
  useEffect(() => { setExternal(active); return () => setExternal(false); }, [active]);
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.5]}
      camera={{ position: [0.3, 0.32, 3.4], fov: 40, near: 0.01 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      className="!h-full !w-full"
      aria-hidden
    >
      <Director onSlow={onSlow} ready={ready} />
      <RendererConfig />
      <color attach="background" args={[BRAND_HEX.backdrop]} />
      <SceneLights />
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.5} />
      </Suspense>
      <Suspense fallback={null}>
        <Classroom variant="default" />
        <StageTeacher onLive={() => { setReady(true); onLive(); }} />
      </Suspense>
      <After from={1.4}>
        <Suspense fallback={null}><Diagram /></Suspense>
      </After>
      <After from={1.9}>
        <Suspense fallback={null}><HeartBuild /></Suspense>
      </After>
      <After from={3.3}>
        <DeskCard />
      </After>
    </Canvas>
  );
}
