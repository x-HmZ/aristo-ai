"use client";

/**
 * The landing's live 3D stage (V8.3b). Loaded only on the full path, after first paint (LandingRoot), never on a
 * phone, a weak GPU or under reduced motion (gate.ts).
 *
 * One transparent canvas carries Jake between the section spots: LandingRoot places it over the active spot's box
 * (host.ts), and this renders him there with that spot's framing (spots.ts: a crop of the classroom's own lesson
 * view, so he is exactly the lesson's Jake) and that spot's script (scripts.ts). It renders only while the active
 * spot is on screen. No room here: the classroom loads only for the Immersive section.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Group, Vector3, type Object3D, type PerspectiveCamera } from "three";
import { useAristoStore } from "@/store/useAristoStore";
import { RendererConfig, SceneLights } from "@/components/three/Experience";
import { AVATAR_ASSETS, Teacher, type LookTargets, type TeacherDriver } from "@/components/three/Teacher";
import { PAPER_ANCHOR } from "@/components/three/deskFraming";
import { clockOf } from "../play";
import { SLOW_SAMPLE_FRAMES, isSlow } from "./gate";
import { host, setLive, subscribe } from "./host";
import { createAim } from "./aim";
import { damp } from "./timeline";
import { Diagram } from "./Diagram";
import { HeartBuild } from "./HeartBuild";
import { Probe } from "./Probe";
import { AIM_PICTURE, LOOK_PITCH, LOOK_YAW, ROOM_T, VOLCANO, roomAimAt, roomFov, roomSignals, shotAt } from "./room";
import { lookAround, roomCameraAt } from "./roomCamera";
import { GESTURE_Z, HEART, PICTURE_AIM, PICTURE_T, REMEMBER_T, VIEWER_Z, WAVE_COOLDOWN_S, signalsFor } from "./scripts";
import { shared } from "./shared";
import { visemeNow } from "./sound";
import { EYE, PLANE_Z, SPOTS, TEACHER, frustumFor, type FramedSpotId, type SpotId } from "./spots";
import { drawEach, warmUp } from "./warm";

const NEAR = 0.05;
const FAR = 60;
/** The section clock each spot's script reads. */
const SECTION_OF: Record<SpotId, string> = { hero: "hero", idea: "idea", picture: "picture", model: "model", moves: "moves", remember: "remember", room: "room", close: "close" };
/**
 * Step Into the Classroom's room: its own chunk (Classroom preloads the room's GLB when its module loads), imported
 * only once the reader is near the section.
 */
const RoomScene = lazy(() => import("./RoomScene"));

const useHost = () => useSyncExternalStore(
  subscribe,
  () => `${host.active}|${host.onScreen}|${shared.hero.greet}|${shared.moves.run}|${shared.room.near}|${shared.room.ready}`,
  () => "null|false|0|0|false|false",
);

/** The verification's still captures (`?still`, and `?still&start` for a section's first frame). */
const stillParams = () => {
  if (typeof window === "undefined") return { hold: false, start: false };
  const q = new URLSearchParams(window.location.search);
  return { hold: q.has("still"), start: q.has("still") && q.has("start") };
};

/**
 * Runs first each frame: the camera stays at the classroom's eye, looking straight ahead, and the active spot's
 * frustum is applied for the canvas's aspect. Then the stage's own speed check.
 */
function Framing({ spot, onSlow, judging, wide = 0 }: { spot: SpotId; onSlow: () => void; judging: boolean; wide?: number }) {
  const { camera, size } = useThree();
  const cam = camera as PerspectiveCamera;
  const samples = useRef<number[]>([]);
  const judged = useRef(false);
  const still = useMemo(stillParams, []);
  const tour = useRef({ shot: -1, settling: false });
  const judge = (dt: number) => {
    if (judging && !judged.current) {
      samples.current.push(dt * 1000);
      if (samples.current.length >= SLOW_SAMPLE_FRAMES) {
        judged.current = true;
        if (isSlow(samples.current)) onSlow();
      }
    }
  };
  useFrame((_, dt) => {
    if (spot !== "room") return;
    // The room: the tour's camera (room.ts) at the section's time, turned by the reader's look. Once the tour moves on
    // to a new shot, a look the reader left eases back to the tour's own direction.
    const t = still.start ? 0 : still.hold ? ROOM_T.length : clockOf("room").t;
    const pose = roomCameraAt(t);
    const look = shared.room, shot = shotAt(t);
    if (shot !== tour.current.shot) { tour.current = { shot, settling: tour.current.shot >= 0 }; }
    if (look.dragging) tour.current.settling = false;
    else if (tour.current.settling) {
      look.yaw = damp(look.yaw, 0, 2.5, dt);
      look.pitch = damp(look.pitch, 0, 2.5, dt);
      if (Math.abs(look.yaw) + Math.abs(look.pitch) < 1e-3) { look.yaw = 0; look.pitch = 0; tour.current.settling = false; }
    }
    const yaw = Math.max(-LOOK_YAW, Math.min(LOOK_YAW, look.yaw)), pitch = Math.max(-LOOK_PITCH, Math.min(LOOK_PITCH, look.pitch));
    const aim = lookAround(pose, yaw, pitch);
    cam.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    cam.up.set(0, 1, 0);
    cam.lookAt(aim[0], aim[1], aim[2]);
    const aspect = size.width / Math.max(1, size.height);
    const fov = roomFov(aspect);
    if (cam.fov !== fov || cam.aspect !== aspect || cam.near !== NEAR || cam.far !== FAR) {
      cam.fov = fov; cam.aspect = aspect; cam.near = NEAR; cam.far = FAR;
    }
    // R3F re-derives the projection on a resize, and the framed spots replace it every frame: set it each frame.
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    judge(dt);
  }, -2);
  useFrame((_, dt) => {
    if (spot === "room") return;
    cam.position.set(EYE[0], EYE[1], EYE[2]);
    cam.rotation.set(0, 0, 0);
    cam.near = NEAR;
    cam.far = FAR;
    cam.updateMatrixWorld();
    // `?probe&wide=m` (verification only): LandingRoot grows the layer past the spot's box by m of its width on each
    // side and m of its height above, and the view grows by the same, so the box shows exactly what it does live and
    // whatever of him falls outside it is drawn too, to be measured (eval scripts/bounds.cjs).
    const aspect = (size.width / (1 + 2 * wide)) / Math.max(1, size.height / (1 + wide));
    const f = frustumFor(SPOTS[spot as FramedSpotId], aspect);
    if (wide > 0) {
      const w = f.right - f.left, h = f.top - f.bottom;
      f.left -= wide * w; f.right += wide * w; f.top += wide * h;
    }
    // R3F re-derives the projection from fov and aspect on a resize; this replaces it every frame, before the render.
    cam.projectionMatrix.makePerspective(f.left * NEAR, f.right * NEAR, f.top * NEAR, f.bottom * NEAR, NEAR, FAR);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    judge(dt);
  }, -2);
  return null;
}

/**
 * Jake, hidden until warm the first time (warm.ts: shaders compiled in parallel, textures uploaded in idle moments,
 * then each mesh's first draw in an idle moment of its own; drawing him cold cost one long frame). Reports when he is
 * ready to show.
 */
function Warmed({ onWarm, children }: { onWarm: () => void; children: React.ReactNode }) {
  const group = useRef<Group>(null);
  const { gl, scene, camera } = useThree();
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    let alive = true;
    // A failed warm-up only costs the first frame what it cost before: show him anyway.
    const g = group.current;
    if (g) {
      void warmUp(gl, scene, camera, g)
        .then(() => drawEach(gl, scene, camera, g, () => alive))
        .catch(() => {})
        .then(() => { if (alive) setWarm(true); });
    }
    return () => { alive = false; };
  }, [gl, scene, camera]);
  useEffect(() => { if (warm) onWarm(); }, [warm, onWarm]);
  return <group ref={group} visible={warm}>{children}</group>;
}

/**
 * What his hand and eyes go to at each spot, while a gesture plays (gestureAt): the point is kept in TARGET[spot],
 * which is also the director's look target for "model" (PresentModel) and "board" (the pointing clips), so the head,
 * the eyes and the aimed hand (aim.ts) all go to the same place. The heart's place is fixed.
 */
const TARGET: Record<SpotId, [number, number, number]> = {
  hero: [0, 0, GESTURE_Z], idea: [0, 0, GESTURE_Z], picture: [...PICTURE_AIM], model: [...HEART.position], moves: [0, 0, GESTURE_Z], remember: [0, 0, PLANE_Z], room: [...AIM_PICTURE], close: [0, 0, GESTURE_Z],
};
const LOOK = Object.fromEntries(
  Object.entries(TARGET).map(([id, p]) => [id, { model: p, board: p }]),
) as unknown as Record<SpotId, LookTargets>;
// The room: his pointing (the board) as the other spots, and the classroom's own model and desk.
LOOK.room = { board: TARGET.room, model: VOLCANO.position, desk: PAPER_ANCHOR };
/** For the stills (`?still`): the section time whose gesture target a still is captured with. */
const HOLD_AT: Partial<Record<SpotId, number>> = { picture: PICTURE_T.point[0] + 1 };
/**
 * Clips the landing never asks for: Pointing, the pointing pool's Mixamo half, raises his right hand across his body,
 * away from the board on his left, past where aim.ts can bring a hand to a target. PointNear (his left index into
 * the near part of the board) lands (V8.3b eval, round 5).
 */
const WITHHELD: ReadonlySet<string> = new Set(["Pointing"]);
/**
 * The hero also never waves with his right hand (Talking6; Talking6M is the left): there he stands at the page's left
 * edge, and that hand would leave the box. His left waves towards the text, inside it (V8.3b eval, round 6).
 */
const HERO_WITHHELD: ReadonlySet<string> = new Set(["Pointing", "Talking6"]);
/** The spots where a gesture's hand is aimed at its target. */
const AIMED: ReadonlySet<SpotId> = new Set(["hero", "picture", "remember", "room"]);

/**
 * The gesture target at a spot now, or null when no gesture is aimed: an element on the page (the hero's button, the
 * idea the pointing lands on), taken at `z` along the ray from the eye through its centre, or a world point.
 */
function gestureAt(spot: SpotId, t: number): { el: Element; z: number } | { world: readonly number[] } | null {
  if (spot === "hero") {
    const look = shared.hero.look;
    return look && performance.now() < look.until ? { el: look.el, z: GESTURE_Z } : null;
  }
  if (spot === "picture" && t >= PICTURE_T.point[0] && t < PICTURE_T.point[1]) return { world: PICTURE_AIM };
  // The room: the cross-section, then its magma chamber as he names it (room.ts).
  if (spot === "room") { const aim = roomAimAt(t); return aim ? { world: aim } : null; }
  // The review point his finger is on (Remember.tsx marks the next one the line will reach).
  if (spot === "remember" && t >= REMEMBER_T.point[0] && t < REMEMBER_T.point[1]) {
    const el = document.querySelector("[data-spot=remember] [data-aim=remember]");
    return el ? { el, z: PLANE_Z } : null;
  }
  return null;
}

/** Mounts its children in the first idle moment. */
function Idle({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const go = () => setOn(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(go, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(go, 1200);
    return () => clearTimeout(t);
  }, []);
  return on ? <>{children}</> : null;
}

/** An optional part (the heart) that fails to load drops out on its own; the stage carries on. */
class PartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

/** A wrist above this (world y) is raised in front of him. */
const RAISED_Y = -0.12;
/** Each palm's wrist and index knuckle, left then right; then each hand's fingertips and thumb tip, left then right. */
const PALM_BONES = [
  "CC_Base_L_Hand", "CC_Base_L_Index1", "CC_Base_R_Hand", "CC_Base_R_Index1",
  "CC_Base_L_Index3", "CC_Base_L_Mid3", "CC_Base_L_Pinky3", "CC_Base_L_Thumb3",
  "CC_Base_R_Index3", "CC_Base_R_Mid3", "CC_Base_R_Pinky3", "CC_Base_R_Thumb3",
] as const;

/** When each spot last waved (performance.now seconds), for the cool-down. Survives remounts. */
const lastWave: Partial<Record<SpotId, number>> = {};

/**
 * Jake at one spot: mounted fresh per visit (keyed by the spot), driven by the spot's script. Two frames after he
 * mounts he has drawn in his idle pose, and the spot goes live (its still hides and the canvas shows).
 */
function SpotTeacher({ spot, warm, greet, lookTargets }: { spot: SpotId; warm: boolean; greet: number; lookTargets?: LookTargets }) {
  const frames = useRef(0);
  const liveAt = useRef<number | null>(null);
  // A fresh mount asked for by the reader (a tap on Jake, coming back to the page) always waves: those have their
  // own cool-downs (Hero.tsx). Arriving at a spot waves unless it waved in the last WAVE_COOLDOWN_S.
  const mayWave = useMemo(() => {
    const now = performance.now() / 1000;
    return greet > 0 || lastWave[spot] === undefined || now - lastWave[spot]! > WAVE_COOLDOWN_S;
  }, [spot, greet]);
  const hold = useMemo(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("still"), []);
  // `?still&start`: a section's first frame (him at rest, nothing built yet), the poster the live path shows first.
  const start = useMemo(() => hold && new URLSearchParams(window.location.search).has("start"), [hold]);
  const { camera, gl } = useThree();
  const viewer = useMemo(() => new Vector3(), []);
  const ray = useMemo(() => new Vector3(), []);
  const aim = useRef<ReturnType<typeof createAim> | null>(null);
  const aimAt = useMemo(() => new Vector3(), []);
  const aimed = useRef(false);
  const wasAimed = useRef(false);
  // His wrists and knuckles on the page (viewport px), for what he holds at the idea and moves spots (Idea.tsx,
  // Moves.tsx).
  const hands = useRef<Object3D[] | null>(null);
  const pv = useMemo(() => new Vector3(), []);
  const reportPalms = useCallback((root: Object3D) => {
    hands.current ??= PALM_BONES.map((n) => root.getObjectByName(n)).filter((o): o is Object3D => !!o);
    if (hands.current.length !== PALM_BONES.length) return;
    root.updateMatrixWorld(true);
    const r = gl.domElement.getBoundingClientRect();
    // Up in front of him: both wrists above his belt (at rest they hang at about -0.45; HoldIdea brings them to 0.05).
    const ly = hands.current[0].getWorldPosition(pv).y, ry = hands.current[2].getWorldPosition(pv).y;
    shared.hands.raised = ly > RAISED_Y && ry > RAISED_Y;
    shared.hands.lift.l = ly;
    shared.hands.lift.r = ry;
    const page = hands.current.map((o) => {
      o.getWorldPosition(pv).project(camera);
      return { x: r.left + ((pv.x + 1) / 2) * r.width, y: r.top + ((1 - pv.y) / 2) * r.height };
    });
    const [lw, lk, rw, rk] = page;
    // A palm's centre is about halfway from the wrist to the knuckles.
    shared.hands.palms = { l: { x: (lw.x + lk.x) / 2, y: (lw.y + lk.y) / 2 }, r: { x: (rw.x + rk.x) / 2, y: (rw.y + rk.y) / 2 } };
    // The lowest point of each hand on the page (wrist, fingertips, thumb): what sits under a hand sits below it.
    const lowest = (pts: { x: number; y: number }[]) => pts.reduce((a, b) => (b.y > a.y ? b : a));
    shared.hands.low = { l: lowest([lw, ...page.slice(4, 8)]), r: lowest([rw, ...page.slice(8, 12)]) };
    shared.hands.spot = spot;
    shared.hands.onReport?.();
  }, [camera, gl, pv, spot]);
  const driver = useMemo<TeacherDriver>(() => ({
    signals: () => {
      const now = performance.now() / 1000;
      const liveFor = liveAt.current === null ? 0 : now - liveAt.current;
      const h = shared.hero;
      const s = spot === "room"
        ? roomSignals(clockOf("room").t, shared.speaking)
        : signalsFor(spot, {
          liveFor, t: clockOf(SECTION_OF[spot]).t, mayWave: mayWave && !hold, speaking: shared.speaking, hover: h.hover, seq: h.seq,
        });
      // The model's still is its end with Jake presenting: the section shows its end at once, so the model's edge comes
      // half a second after he is live instead.
      // Five Moves and It Remembers end at rest too, so their one still is this.
      // The room's stills: its first frame, and (lite) its end, both with him at rest.
      if (start || (hold && (spot === "moves" || spot === "remember" || spot === "room"))) return { ...s, modelShown: false, gesture: "idle", phase: null, role: null, segmentId: null, isLoading: false };
      if (hold && spot === "model") s.modelShown = liveFor > 0.5;
      // The other stills: at rest beside the lit column; pointing at the picture.
      if (hold && spot === "idea") { s.phase = null; s.segmentId = null; }
      if (hold && spot === "picture") s.gesture = liveFor > 0.5 ? "pointing" : "idle";
      if (s.sceneReady && mayWave) lastWave[spot] = now;
      return s;
    },
    viseme: visemeNow,
    // While a gesture is aimed (the hero's offer, the volcano sections' pointing), the hand is aimed at its target
    // (aim.ts), the same point the head and eyes go to. At the idea spot, his palms are reported for the flute he holds.
    afterPose: (root, delta) => {
      if (AIMED.has(spot)) {
        // The pointing spots aim the finger too; the hero's open palm only the arm and the wrist.
        aim.current ??= createAim(root, "L", { finger: spot !== "hero" });
        // The aimed point glides to a new target (It Remembers moves the finger from one review point to the next)
        // and is taken at once when a gesture starts.
        const [tx, ty, tz] = TARGET[spot];
        if (aimed.current && !wasAimed.current) aimAt.set(tx, ty, tz);
        else aimAt.set(damp(aimAt.x, tx, 7, delta), damp(aimAt.y, ty, 7, delta), damp(aimAt.z, tz, 7, delta));
        wasAimed.current = aimed.current;
        aim.current(aimAt, aimed.current, delta);
      }
      if (spot === "idea" || spot === "moves") reportPalms(root);
    },
    clipPacks: warm,
    withhold: spot === "hero" ? HERO_WITHHELD : WITHHELD,
    // Where he looks when the director says "the student": the gesture's target while one is aimed; at the hero and
    // the close, the reader's pointer (the ray from the eye through it, where it crosses VIEWER_Z in front of him);
    // otherwise, and with no mouse, the camera, as in a lesson.
    viewer: () => {
      const g = gestureAt(spot, start ? -1 : hold ? HOLD_AT[spot] ?? -1 : clockOf(SECTION_OF[spot]).t);
      aimed.current = !!g;
      if (g && "world" in g) { viewer.fromArray(g.world); viewer.toArray(TARGET[spot]); return viewer; }
      let p = shared.pointer, z = VIEWER_Z;
      if (g) { const b = g.el.getBoundingClientRect(); p = { x: b.left + b.width / 2, y: b.top + b.height / 2 }; z = g.z; }
      else if (spot !== "hero" && spot !== "close") return null;
      if (!p || (hold && !g)) return null;
      const r = gl.domElement.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      ray.set(((p.x - r.left) / r.width) * 2 - 1, 1 - ((p.y - r.top) / r.height) * 2, 0.5).unproject(camera).sub(camera.position).normalize();
      if (ray.z > -1e-3) return null;
      viewer.copy(camera.position).addScaledVector(ray, (z - camera.position.z) / ray.z);
      if (g) viewer.toArray(TARGET[spot]);
      return viewer;
    },
  }), [spot, warm, mayWave, hold, start, camera, gl, viewer, ray, aimAt, reportPalms]);

  useFrame(() => {
    // The room's spot keeps its poster until the room is loaded and warm (RoomScene).
    if (!warm || liveAt.current !== null || (spot === "room" && !shared.room.ready)) return;
    frames.current += 1;
    if (frames.current >= 2) {
      liveAt.current = performance.now() / 1000;
      if (host.live !== spot) setLive(spot);
    }
  });

  return (
    <Teacher
      teacher="jake"
      position={TEACHER.position}
      scale={AVATAR_ASSETS.jake.standScale}
      rotationY={TEACHER.rotationY}
      lookTargets={lookTargets}
      driver={driver}
    />
  );
}

export default function LandingStage({ onLive, onSlow }: { onLive: () => void; onSlow: () => void }) {
  const [warm, setWarm] = useState(false);
  const [activeKey, onScreenKey, greetKey, movesKey, nearKey] = useHost().split("|");
  const greet = Number(greetKey);
  const active = (activeKey === "null" ? null : activeKey) as SpotId | null;
  const onScreen = onScreenKey === "true";
  const probe = useMemo(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("probe"), []);
  const wide = useMemo(() => (probe ? Number(new URLSearchParams(window.location.search).get("wide")) || 0 : 0), [probe]);
  // The teacher reads a few transient lesson fields from the store (the thinking badge). Coming back to / from
  // /demo by a link keeps them in memory, so clear them. Persisted fields (teacher, course, progress) are untouched.
  useEffect(() => {
    useAristoStore.setState({ activeLesson: null, activeQuiz: null, isLoading: false, isSpeaking: false });
  }, []);
  const onWarm = useMemo(() => () => { setWarm(true); onLive(); }, [onLive]);
  if (!active) return null;
  return (
    <Canvas
      frameloop={onScreen ? "always" : "never"}
      shadows
      // The room fills a wide box: at most 1.5 device pixels per CSS pixel there (Jake alone, up to 2).
      dpr={active === "room" ? [1, 1.5] : [1, 2]}
      resize={{ scroll: false, debounce: 0 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      className="!h-full !w-full"
      aria-hidden
    >
      <Framing spot={active} onSlow={onSlow} judging={warm} wide={wide} />
      <RendererConfig />
      <SceneLights />
      {/* One boundary: the environment and Jake arrive together, then warm up before he is shown. */}
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.5} />
        <Warmed onWarm={onWarm}>
          <SpotTeacher key={active === "hero" ? `hero:${greet}` : active === "moves" ? `moves:${movesKey}` : active}spot={active} warm={warm} greet={active === "hero" ? greet : 0} lookTargets={LOOK[active]} />
        </Warmed>
      </Suspense>
      {/* The heart mounts in the first idle moment after Jake is warm, and warms up hidden (HeartBuild), so it is
          ready before the reader reaches its section. A heart that fails to load drops out; Jake carries on. */}
      {warm && (
        <Idle>
          <PartBoundary><Suspense fallback={null}><Diagram /></Suspense></PartBoundary>
          <PartBoundary><Suspense fallback={null}><HeartBuild /></Suspense></PartBoundary>
        </Idle>
      )}
      {/* The room, once the reader is near its section (Immersive.tsx), after Jake is warm. Loaded once, kept. */}
      {warm && nearKey === "true" && (
        <PartBoundary><Suspense fallback={null}><RoomScene /></Suspense></PartBoundary>
      )}
      {probe && <Probe spot={active} />}
    </Canvas>
  );
}
