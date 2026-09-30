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
import { Component, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Group, Vector3, type PerspectiveCamera } from "three";
import { useAristoStore } from "@/store/useAristoStore";
import { RendererConfig, SceneLights } from "@/components/three/Experience";
import { AVATAR_ASSETS, Teacher, type LookTargets, type TeacherDriver } from "@/components/three/Teacher";
import { clockOf } from "../play";
import { SLOW_SAMPLE_FRAMES, isSlow } from "./gate";
import { host, setLive, subscribe } from "./host";
import { HeartBuild } from "./HeartBuild";
import { Probe } from "./Probe";
import { GESTURE_Z, HEART, VIEWER_Z, WAVE_COOLDOWN_S, signalsFor } from "./scripts";
import { shared } from "./shared";
import { visemeNow } from "./sound";
import { EYE, SPOTS, TEACHER, frustumFor, type SpotId } from "./spots";
import { warmUp } from "./warm";

const NEAR = 0.05;
const FAR = 60;
/** The section clock each spot's script reads. */
const SECTION_OF: Record<SpotId, string> = { hero: "hero", model: "model", close: "close" };

const useHost = () => useSyncExternalStore(subscribe, () => `${host.active}|${host.onScreen}|${shared.hero.greet}`, () => "null|false|0");

/**
 * Runs first each frame: the camera stays at the classroom's eye, looking straight ahead, and the active spot's
 * frustum is applied for the canvas's aspect. Then the stage's own speed check.
 */
function Framing({ spot, onSlow, judging }: { spot: SpotId; onSlow: () => void; judging: boolean }) {
  const { camera, size } = useThree();
  const cam = camera as PerspectiveCamera;
  const samples = useRef<number[]>([]);
  const judged = useRef(false);
  useEffect(() => {
    cam.position.set(EYE[0], EYE[1], EYE[2]);
    cam.rotation.set(0, 0, 0);
    cam.near = NEAR;
    cam.far = FAR;
    cam.updateMatrixWorld();
  }, [cam]);
  useFrame((_, dt) => {
    const f = frustumFor(SPOTS[spot], size.width / Math.max(1, size.height));
    // R3F re-derives the projection from fov and aspect on a resize; this replaces it every frame, before the render.
    cam.projectionMatrix.makePerspective(f.left * NEAR, f.right * NEAR, f.top * NEAR, f.bottom * NEAR, NEAR, FAR);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    if (judging && !judged.current) {
      samples.current.push(dt * 1000);
      if (samples.current.length >= SLOW_SAMPLE_FRAMES) {
        judged.current = true;
        if (isSlow(samples.current)) onSlow();
      }
    }
  }, -2);
  return null;
}

/**
 * Jake, hidden until warm the first time (warm.ts: shaders compiled in parallel, textures uploaded in idle moments;
 * drawing him cold cost one long frame). Reports when he is ready to show.
 */
function Warmed({ onWarm, children }: { onWarm: () => void; children: React.ReactNode }) {
  const group = useRef<Group>(null);
  const { gl, scene, camera } = useThree();
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    let alive = true;
    // A failed warm-up only costs the first frame what it cost before: show him anyway.
    if (group.current) void warmUp(gl, scene, camera, group.current).catch(() => {}).then(() => { if (alive) setWarm(true); });
    return () => { alive = false; };
  }, [gl, scene, camera]);
  useEffect(() => { if (warm) onWarm(); }, [warm, onWarm]);
  return <group ref={group} visible={warm}>{children}</group>;
}

/**
 * Where the head turns when a model is shown (the director's look target); the camera otherwise. At the hero the
 * "model" is the button he offers his hand to: a point the viewer below keeps on it (Teacher reads it every frame).
 */
const HERO_LOOK: [number, number, number] = [0, 0, VIEWER_Z];
const LOOK: Partial<Record<SpotId, LookTargets>> = { model: { model: HEART.position }, hero: { model: HERO_LOOK } };

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
  const { camera, gl } = useThree();
  const viewer = useMemo(() => new Vector3(), []);
  const ray = useMemo(() => new Vector3(), []);
  const driver = useMemo<TeacherDriver>(() => ({
    signals: () => {
      const now = performance.now() / 1000;
      const liveFor = liveAt.current === null ? 0 : now - liveAt.current;
      const h = shared.hero;
      const s = signalsFor(spot, {
        liveFor, t: clockOf(SECTION_OF[spot]).t, mayWave: mayWave && !hold, speaking: shared.speaking, hover: h.hover, seq: h.seq,
      });
      // The model's still is its end with Jake presenting: the section shows its end at once, so the model's edge comes
      // half a second after he is live instead.
      if (hold && spot === "model") s.modelShown = liveFor > 0.5;
      if (s.sceneReady && mayWave) lastWave[spot] = now;
      return s;
    },
    viseme: visemeNow,
    clipPacks: warm,
    // At the hero and the close he looks at the reader's pointer: the ray from the eye through it, where it crosses
    // a plane in front of him (VIEWER_Z). Elsewhere, and with no mouse, the camera, as in a lesson.
    viewer: () => {
      // During a gesture to an element (the hero's Try a lesson) he looks at that element; else at the pointer.
      const look = shared.hero.look;
      let p = shared.pointer;
      if (look && performance.now() < look.until) {
        const b = look.el.getBoundingClientRect();
        p = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }
      if (!p || hold || (spot !== "hero" && spot !== "close")) return null;
      const r = gl.domElement.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      ray.set(((p.x - r.left) / r.width) * 2 - 1, 1 - ((p.y - r.top) / r.height) * 2, 0.5).unproject(camera).sub(camera.position).normalize();
      if (ray.z > -1e-3) return null;
      // A gesture's target is taken beside him, at his hand's depth, so his head turns to where his hand goes; the
      // pointer is taken in front of him (VIEWER_Z), so he looks out at the reader.
      const z = look && performance.now() < look.until ? GESTURE_Z : VIEWER_Z;
      viewer.copy(camera.position).addScaledVector(ray, (z - camera.position.z) / ray.z);
      // The head's "model" target is the same point while he offers his hand to the button (HERO_LOOK).
      if (look && spot === "hero") viewer.toArray(HERO_LOOK);
      return viewer;
    },
  }), [spot, warm, mayWave, hold, camera, gl, viewer, ray]);

  useFrame(() => {
    if (!warm || liveAt.current !== null) return;
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
  const [activeKey, onScreenKey, greetKey] = useHost().split("|");
  const greet = Number(greetKey);
  const active = (activeKey === "null" ? null : activeKey) as SpotId | null;
  const onScreen = onScreenKey === "true";
  const probe = useMemo(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("probe"), []);
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
      dpr={[1, 2]}
      resize={{ scroll: false, debounce: 0 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      className="!h-full !w-full"
      aria-hidden
    >
      <Framing spot={active} onSlow={onSlow} judging={warm} />
      <RendererConfig />
      <SceneLights />
      {/* One boundary: the environment and Jake arrive together, then warm up before he is shown. */}
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.5} />
        <Warmed onWarm={onWarm}>
          <SpotTeacher key={active === "hero" ? `hero:${greet}` : active} spot={active} warm={warm} greet={active === "hero" ? greet : 0} lookTargets={LOOK[active]} />
        </Warmed>
      </Suspense>
      {/* The heart mounts in the first idle moment after Jake is warm, and warms up hidden (HeartBuild), so it is
          ready before the reader reaches its section. A heart that fails to load drops out; Jake carries on. */}
      {warm && (
        <Idle>
          <PartBoundary><Suspense fallback={null}><HeartBuild /></Suspense></PartBoundary>
        </Idle>
      )}
      {probe && <Probe spot={active} />}
    </Canvas>
  );
}
