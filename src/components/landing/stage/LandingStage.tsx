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
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Group, type PerspectiveCamera } from "three";
import { useAristoStore } from "@/store/useAristoStore";
import { RendererConfig, SceneLights } from "@/components/three/Experience";
import { AVATAR_ASSETS, Teacher, type LookTargets, type TeacherDriver } from "@/components/three/Teacher";
import { clockOf } from "../play";
import { SLOW_SAMPLE_FRAMES, isSlow } from "./gate";
import { host, setLive, subscribe } from "./host";
import { Probe } from "./Probe";
import { WAVE_COOLDOWN_S, signalsFor } from "./scripts";
import { shared } from "./shared";
import { visemeNow } from "./sound";
import { EYE, SPOTS, TEACHER, frustumFor, type SpotId } from "./spots";
import { warmUp } from "./warm";

const NEAR = 0.05;
const FAR = 60;
/** The section clock each spot's script reads. */
const SECTION_OF: Record<SpotId, string> = { hero: "hero", model: "model", close: "close" };

const useHost = () => useSyncExternalStore(subscribe, () => `${host.active}|${host.onScreen}`, () => "null|false");

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

/** When each spot last waved (performance.now seconds), for the cool-down. Survives remounts. */
const lastWave: Partial<Record<SpotId, number>> = {};

/**
 * Jake at one spot: mounted fresh per visit (keyed by the spot), driven by the spot's script. Two frames after he
 * mounts he has drawn in his idle pose, and the spot goes live (its still hides and the canvas shows).
 */
function SpotTeacher({ spot, warm, lookTargets }: { spot: SpotId; warm: boolean; lookTargets?: LookTargets }) {
  const frames = useRef(0);
  const liveAt = useRef<number | null>(null);
  const mayWave = useMemo(() => {
    const now = performance.now() / 1000;
    return lastWave[spot] === undefined || now - lastWave[spot]! > WAVE_COOLDOWN_S;
  }, [spot]);
  const hold = useMemo(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("still"), []);
  const driver = useMemo<TeacherDriver>(() => ({
    signals: () => {
      const now = performance.now() / 1000;
      const liveFor = liveAt.current === null ? 0 : now - liveAt.current;
      const s = signalsFor(spot, { liveFor, t: clockOf(SECTION_OF[spot]).t, mayWave: mayWave && !hold, speaking: shared.speaking });
      if (s.sceneReady && mayWave) lastWave[spot] = now;
      return s;
    },
    viseme: visemeNow,
    clipPacks: warm,
  }), [spot, warm, mayWave, hold]);

  useFrame(() => {
    if (!warm || host.live === spot) return;
    frames.current += 1;
    if (frames.current >= 2) {
      liveAt.current = performance.now() / 1000;
      setLive(spot);
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
  const [activeKey, onScreenKey] = useHost().split("|");
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
          <SpotTeacher key={active} spot={active} warm={warm} />
        </Warmed>
      </Suspense>
      {probe && <Probe spot={active} />}
    </Canvas>
  );
}
