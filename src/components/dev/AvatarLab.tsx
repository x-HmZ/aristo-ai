"use client";

/**
 * V9.1 avatar lab — judge a candidate teacher in the engine that ships, not in
 * a Blender render.
 *
 * A render can hide three things a browser will not: whether Draco decodes,
 * whether the morph target names survived the export into
 * `morphTargetDictionary`, and whether the retargeted clips actually play on
 * the CC4 skeleton. So this page loads the GLB exactly as `/learn` does and
 * drives the mouth from the same module the lesson uses
 * (`src/lib/lipsync/visemes.ts`) against the pre-rendered demo narration and
 * its ElevenLabs alignment sidecars.
 *
 * Dev-only: no auth, and `pages/dev/avatar-lab.tsx` 404s in production.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Side-effecting: points drei's GLTFLoader at the self-hosted Draco decoder.
// Both V9 teachers are Draco-compressed, so without this they never load.
import "@/components/three/dracoDecoder";
import {
  alignmentUrlFor,
  parseAlignment,
  visemeAt,
  type VisemeSpan,
} from "@/lib/lipsync/visemes";
import { FADE, overlayBlend, overlayWeight } from "@/lib/avatar/director";
import { LID_REST, SMILE_REST } from "@/lib/avatar/face";
import { maskTrackNames, skeletonMasks, type BoneInfo } from "@/lib/avatar/skeletonMasks";
import { AVATAR_ASSETS } from "@/components/three/Teacher";
import { BRAND_HEX } from "@/lib/brandColors";
import { DEV_MONO, DEV_PANEL, DevButton, DevSection } from "@/components/dev/devKit";
import { cn } from "@/lib/utils";

const CANDIDATES = {
  jake:   { file: "Teacher_Jake.glb",   label: "Jake (Canino, CC4)", pack: "Teacher_Jake_clips.glb" },
  mj:     { file: "Teacher_MJ.glb",     label: "MJ (Canino, CC4)",   pack: "Teacher_MJ_clips.glb" },
  marcus: { file: "Teacher_Marcus.glb", label: "Marcus (shipping control)", pack: null },
} as const;
type CandidateKey = keyof typeof CANDIDATES;

/**
 * Base clips. Thinking is here so OneMoment can be judged over the loop it
 * hands over to; PointNear (V9.8) is a full-body base clip that lives in the
 * pack, not the base GLB, so the base player looks there too.
 */
const CLIPS = ["Idle", "Talking", "Thinking", "Pointing", "PointNear"] as const;

/**
 * Overlay gestures to review in motion (V9.6), with the mask each plays under.
 * Played the way Teacher.tsx plays an overlay: a masked copy of the pack clip
 * over the base, weighted by the director's own fade and dominance curve. The
 * V9.6 clips are not in the manifest until Hmz approves them; the last three
 * are shipped overlays, for comparison.
 */
const GESTURES = [
  { name: "PresentModel",  mask: "upper", note: "V9.6, hands redone in V9.7: the model appears" },
  { name: "Encourage",     mask: "upper", note: "V9.6, hands redone in V9.7: quiz not passed" },
  { name: "Almost",        mask: "upper", note: "V9.6, hands redone in V9.7: wrong answer" },
  { name: "Exactly",       mask: "upper", note: "V9.6, hands redone in V9.7: right answer" },
  { name: "WellDone",      mask: "upper", note: "V9.6, hands redone in V9.7: quiz passed" },
  { name: "ThatsIt",       mask: "upper", note: "V9.6, hands redone in V9.7: lesson complete" },
  { name: "GlanceBoard",   mask: "upper", note: "V9.6: long quiet wait" },
  { name: "Imagine",       mask: "upper", note: "V9.7: hook" },
  { name: "HoldIdea",      mask: "upper", note: "V9.7: explain" },
  { name: "StepBeat",      mask: "upper", note: "V9.7: demo step" },
  { name: "MoveOn",        mask: "upper", note: "V9.7, picked (was B): transition" },
  { name: "YourTurn",      mask: "upper", note: "V9.7, picked (was B), play at 0.85: challenge" },
  { name: "BringTogether", mask: "upper", note: "V9.7: connect" },
  { name: "OneMoment",     mask: "upper", note: "V9.8: preparing (try over Thinking)" },
  { name: "PatientTilt",   mask: "head",  note: "V9.8: waiting for the answer" },
  { name: "BackToBoard",   mask: "upper", note: "V9.8: wrong answer, image up" },
  { name: "Nodding",      mask: "head",  note: "shipped" },
  { name: "ShakeNo",      mask: "head",  note: "shipped" },
  { name: "Talking6M",    mask: "upper", note: "shipped (greeting)" },
] as const;
type GestureName = (typeof GESTURES)[number]["name"];
interface GestureCue { name: GestureName; id: number; loop: boolean; speed: number }

/** Playback rates to try; the one Hmz picks becomes the clip's `timeWarp`. */
const SPEEDS = [1, 0.85, 0.75, 0.65] as const;

/** Where the generated 3D model appears in the classroom (Experience.tsx SCENE_X/Y/Z). */
const MODEL_SPOT: [number, number, number] = [0.37, 0.18, -3];

/** Loads a teacher's lazy clip pack and hands its clips up. */
function ClipPack({ url, onClips }: { url: string; onClips: (c: THREE.AnimationClip[]) => void }) {
  const { animations } = useGLTF(url);
  useEffect(() => { onClips(animations); }, [animations, onClips]);
  return null;
}

/** The 15 the app drives, cleared every frame so none stick on. */
const VISEMES = [
  "viseme_sil", "viseme_PP", "viseme_FF", "viseme_TH", "viseme_DD",
  "viseme_kk", "viseme_CH", "viseme_SS", "viseme_nn", "viseme_RR",
  "viseme_aa", "viseme_E", "viseme_I", "viseme_O", "viseme_U",
];

const DEMO = "heart";

// Review overrides from the query string (?who=jake&view=face&clip=Idle&smile=0.5&lid=0.1&blink=0): the resting
// smile and lid (the product's by default, face.ts), for comparing idle faces side by side (V8.3b). Read once.
const QS = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
const qsNum = (k: string, d: number) => {
  const v = Number(QS?.get(k));
  return QS?.has(k) && Number.isFinite(v) ? v : d;
};
const REST_SMILE = qsNum("smile", SMILE_REST.neutral);
const REST_LID = qsNum("lid", LID_REST);
const NO_BLINK = QS?.get("blink") === "0"; // stills only

const SEGMENTS = Array.from({ length: 15 }, (_, i) =>
  `/demo/${DEMO}/seg_${String(i + 1).padStart(3, "0")}.mp3`);

function Teacher({
  candidate, clip, audio, onReport, onViseme, gesture, classroom, onGesture,
}: {
  candidate: CandidateKey;
  clip: string;
  audio: HTMLAudioElement | null;
  onReport: (r: { morphs: string[]; clips: string[]; current: string }) => void;
  onViseme: (v: string, spans: number) => void;
  gesture: GestureCue | null;
  classroom: boolean;
  onGesture: (status: string) => void;
}) {
  const url = `/models/${CANDIDATES[candidate].file}`;
  const pack = CANDIDATES[candidate].pack;
  const { scene, animations } = useGLTF(url);
  const root = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(animations, root);
  const [packClips, setPackClips] = useState<THREE.AnimationClip[]>([]);

  // Overlay masks by structure, as Teacher.tsx finds them.
  const masks = useMemo(() => {
    const bones: BoneInfo[] = [];
    scene.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone) bones.push({ name: b.name, parent: (b.parent as THREE.Bone | null)?.isBone ? b.parent!.name : null });
    });
    return skeletonMasks(bones);
  }, [scene]);

  const clock = useRef(0);
  const play = useRef<{
    action: THREE.AnimationAction; startedAt: number; fadeIn: number; fadeOutAt: number; endsAt: number;
  } | null>(null);
  const masked = useRef(new Map<string, THREE.AnimationAction>());

  const startGesture = useCallback((name: GestureName, speed: number) => {
    const spec = GESTURES.find((g) => g.name === name)!;
    const source = packClips.find((c) => c.name === name);
    const bones = masks[spec.mask];
    if (!source || !bones || !root.current) {
      onGesture(!source ? `${name}: not in this teacher's pack` : `${name}: no ${spec.mask} mask`);
      return;
    }
    let action = masked.current.get(name);
    if (!action) {
      const keep = new Set(maskTrackNames(source.tracks.map((t) => t.name), bones));
      const tracks = source.tracks.filter((t) => keep.has(t.name)).map((t) => t.clone());
      action = mixer.clipAction(new THREE.AnimationClip(`${name}@${spec.mask}`, source.duration, tracks), root.current);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      masked.current.set(name, action);
    }
    play.current?.action.stop();
    const head = spec.mask === "head";
    const fadeOut = head ? FADE.headOut : FADE.upperOut;
    const now = clock.current;
    const length = source.duration / speed;
    action.reset().setEffectiveTimeScale(speed).setEffectiveWeight(0).play();
    play.current = {
      action, startedAt: now, fadeIn: head ? FADE.headIn : FADE.upperIn,
      fadeOutAt: now + Math.max(0, length - fadeOut), endsAt: now + length,
    };
    onGesture(`${name}@${spec.mask}: ${action.getClip().tracks.length} tracks, ${length.toFixed(2)} s at x${speed}`);
  }, [packClips, masks, mixer, onGesture]);

  // A new cue plays at once; a looping cue replays 1 s after it ends.
  const cue = useRef<GestureCue | null>(null);
  const replayAt = useRef<number | null>(null);
  useEffect(() => {
    cue.current = gesture;
    replayAt.current = null;
    if (gesture) startGesture(gesture.name, gesture.speed);
    else { play.current?.action.stop(); play.current = null; }
  }, [gesture, startGesture]);
  const [timeline, setTimeline] = useState<VisemeSpan[]>([]);
  const blink = useRef(0);
  const lastViseme = useRef("—");

  // Every skinned mesh that carries morph targets. Teacher.tsx resolves by
  // name across the whole graph, and on these rigs the set is split over the
  // head, tongue, eyelash, tearline and eye-occlusion meshes.
  const morphMeshes = useMemo(() => {
    const out: THREE.SkinnedMesh[] = [];
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh && m.morphTargetDictionary) out.push(m);
    });
    return out;
  }, [scene]);

  useEffect(() => {
    const names = new Set<string>();
    morphMeshes.forEach((m) => Object.keys(m.morphTargetDictionary ?? {}).forEach((n) => names.add(n)));
    onReport({
      morphs: [...names].sort(),
      clips: animations.map((a) => a.name),
      current: lastViseme.current,
    });
  }, [morphMeshes, animations, onReport]);

  useEffect(() => {
    const packClip = packClips.find((c) => c.name === clip);
    const a = actions[clip] ?? (packClip && root.current ? mixer.clipAction(packClip, root.current) : null);
    if (!a) return;
    a.reset().fadeIn(0.25).play();
    return () => { a.fadeOut(0.25); };
  }, [actions, packClips, mixer, clip]);

  // Pull the alignment sidecar for whatever the audio element is playing.
  useEffect(() => {
    if (!audio) return;
    let cancelled = false;
    const load = async () => {
      const src = audio.getAttribute("src");
      const alignUrl = src ? alignmentUrlFor(src) : null;
      if (!alignUrl) { setTimeline([]); return; }
      try {
        const res = await fetch(alignUrl);
        const parsed = parseAlignment(await res.json());
        if (!cancelled) setTimeline(parsed ?? []);
      } catch {
        if (!cancelled) setTimeline([]);
      }
    };
    load();
    audio.addEventListener("loadedmetadata", load);
    return () => { cancelled = true; audio.removeEventListener("loadedmetadata", load); };
  }, [audio]);

  // Report the span count as soon as the sidecar parses; `onViseme` alone
  // only fires on a change, which never happens before playback starts.
  useEffect(() => { onViseme(lastViseme.current, timeline.length); }, [timeline, onViseme]);

  const setMorph = (name: string, value: number, speed: number) => {
    for (const m of morphMeshes) {
      const i = m.morphTargetDictionary?.[name];
      if (i === undefined || !m.morphTargetInfluences) continue;
      m.morphTargetInfluences[i] = THREE.MathUtils.lerp(m.morphTargetInfluences[i] ?? 0, value, speed);
    }
  };

  useFrame((_, dt) => {
    clock.current += dt;
    const p = play.current;
    if (p) {
      if (clock.current >= p.endsAt) {
        p.action.stop();
        play.current = null;
        if (cue.current?.loop) replayAt.current = clock.current + 1;
      } else {
        // Not fadeIn/fadeOut: through the dominance ratio they pop (Teacher.tsx).
        p.action.setEffectiveWeight(overlayWeight(overlayBlend(p, clock.current)));
      }
    }
    if (replayAt.current !== null && clock.current >= replayAt.current && cue.current) {
      replayAt.current = null;
      startGesture(cue.current.name, cue.current.speed);
    }

    const t = audio && !audio.paused ? audio.currentTime : NaN;
    const v = timeline.length ? visemeAt(timeline, t) : null;
    for (const name of VISEMES) {
      setMorph(name, v && v.viseme === name ? Math.min(1, v.intensity * 1.4) : 0, 0.35);
    }
    const now = v ? v.viseme : "—";
    if (now !== lastViseme.current) {
      lastViseme.current = now;
      onViseme(now, timeline.length);   // only on change, so this is cheap
    }

    // The product's resting smile and lids plus a blink loop (face.ts), so a still face reads as in a lesson.
    setMorph("mouthSmile", v ? 0 : REST_SMILE, 0.1);
    blink.current -= dt;
    if (blink.current < -0.12) blink.current = 2 + Math.random() * 3;
    const closed = blink.current < 0 && !NO_BLINK ? 1 : REST_LID;
    setMorph("eyeBlinkLeft", closed, 0.5);
    setMorph("eyeBlinkRight", closed, 0.5);
  });

  // Centred on x so the lab frames one candidate at a time; the classroom
  // framing uses the app's own placement (Experience.tsx: x -1, standScale,
  // rotY 0.3) and marks where the generated model appears.
  const standScale = candidate === "marcus" ? 1.5 : AVATAR_ASSETS[candidate].standScale ?? 1.5;
  return (
    <>
      <primitive
        ref={root}
        object={scene}
        position={classroom ? [-1, -1.7, -3] : [0, -1.7, -3]}
        scale={classroom ? standScale : 1.5}
        rotation={[0, 0.3, 0]}
      />
      {pack && (
        <Suspense fallback={null}>
          <ClipPack url={`/models/${pack}`} onClips={setPackClips} />
        </Suspense>
      )}
      {classroom && (
        <mesh position={MODEL_SPOT}>
          <sphereGeometry args={[0.18, 24, 16]} />
          <meshStandardMaterial color={BRAND_HEX.orangeMain} transparent opacity={0.45} />
        </mesh>
      )}
    </>
  );
}

/**
 * Two fixed viewpoints: the lesson framing the app actually uses, and a face
 * shot close enough to judge a viseme. Lipsync cannot be assessed at lesson
 * distance, and lesson distance is the only framing that matters for casting.
 */
const VIEWS = {
  lesson:    { pos: [0, -0.2, 0.9], target: [0, -0.2, -3] },
  face:      { pos: [0, 0.82, -1.75], target: [0, 0.82, -3] },
  // The app's camera and placement (AristoCanvas.tsx, Experience.tsx).
  classroom: { pos: [0, 0, 0.9], target: [0, 0, 0.4] },
} as const;
type ViewKey = keyof typeof VIEWS;

function Framing({ view, controls }: { view: ViewKey; controls: React.RefObject<any> }) {
  const { camera } = useThree();
  useEffect(() => {
    const v = VIEWS[view];
    camera.position.set(...(v.pos as unknown as [number, number, number]));
    if (controls.current) {
      controls.current.target.set(...(v.target as unknown as [number, number, number]));
      controls.current.update();
    }
    camera.updateProjectionMatrix();
  }, [view, camera, controls]);
  return null;
}

export default function AvatarLab() {
  const [candidate, setCandidate] = useState<CandidateKey>(() => (QS?.get("who") as CandidateKey | null) ?? "mj");
  const [clip, setClip] = useState<string>(() => QS?.get("clip") ?? "Talking");
  const [seg, setSeg] = useState(0);
  const [report, setReport] = useState({ morphs: [] as string[], clips: [] as string[], current: "—" });
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [view, setView] = useState<ViewKey>(() => (QS?.get("view") as ViewKey | null) ?? "lesson");
  const [live, setLive] = useState("—");
  const [spans, setSpans] = useState(0);
  const [gesture, setGesture] = useState<GestureCue | null>(null);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [gestureStatus, setGestureStatus] = useState("—");
  // Stable identity: Teacher calls this from an effect, so a new function
  // every render would re-run that effect in a loop.
  const onViseme = useCallback((v: string, n: number) => { setLive(v); setSpans(n); }, []);
  const audioRef = useRef<HTMLAudioElement>(null);
  const controls = useRef<any>(null);

  useEffect(() => { setAudioEl(audioRef.current); }, []);

  const expected = VISEMES.filter((v) => v !== "viseme_sil");
  const missing = expected.filter((v) => !report.morphs.includes(v));

  return (
    <div className="flex h-screen bg-bg text-ink">
      <div className="min-w-0 flex-1">
        <Canvas camera={{ position: [0, 0, 0.9], fov: 40, near: 0.01 }} shadows={false}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 4, 3]} intensity={1.6} />
          <directionalLight position={[-3, 2, 1]} intensity={0.5} />
          <Suspense fallback={null}>
            <Teacher
              key={candidate}
              candidate={candidate}
              clip={clip}
              audio={audioEl}
              onReport={setReport}
              onViseme={onViseme}
              gesture={gesture}
              classroom={view === "classroom"}
              onGesture={setGestureStatus}
            />
          </Suspense>
          <Framing view={view} controls={controls} />
          <OrbitControls ref={controls} target={[0, -0.2, -3]} />
        </Canvas>
      </div>

      <aside className={cn(DEV_PANEL, "w-[330px] shrink-0 p-[18px]")}>
        <h2 className="type-h4 mb-3.5 font-semibold">V9.1 avatar lab</h2>

        <DevSection title="Candidate">
          {(Object.keys(CANDIDATES) as CandidateKey[]).map((k) => (
            <label key={k} className="mb-1 block text-[13px]">
              <input type="radio" className="accent-accent" checked={candidate === k} onChange={() => setCandidate(k)} />{" "}
              {CANDIDATES[k].label}
            </label>
          ))}
        </DevSection>

        <DevSection title="Framing">
          {(Object.keys(VIEWS) as ViewKey[]).map((v) => (
            <DevButton key={v} selected={view === v} onClick={() => setView(v)} className="mb-1.5 mr-1.5">
              {v}
            </DevButton>
          ))}
        </DevSection>

        <DevSection title="Clip">
          {CLIPS.map((c) => (
            <DevButton key={c} selected={clip === c} onClick={() => setClip(c)} className="mb-1.5 mr-1.5">
              {c}
            </DevButton>
          ))}
        </DevSection>

        <DevSection title="Gesture review (over the clip above)">
          {GESTURES.map((g) => (
            <DevButton key={g.name} title={`${g.mask} mask, ${g.note}`}
              selected={gesture?.name === g.name}
              onClick={() => setGesture({ name: g.name, id: Date.now(), loop, speed })}
              className="mb-1.5 mr-1.5">
              {g.name}
            </DevButton>
          ))}
          <div className="mt-1 text-[13px]">
            <label>
              <input type="checkbox" className="accent-accent" checked={loop}
                onChange={(e) => { setLoop(e.target.checked); setGesture((g) => g && { ...g, loop: e.target.checked, id: Date.now() }); }} />{" "}
              replay every time it ends
            </label>{" "}
            <DevButton onClick={() => setGesture(null)}>stop</DevButton>
          </div>
          <div className="mt-1.5 text-[13px]">
            speed{" "}
            {SPEEDS.map((s) => (
              <DevButton key={s} selected={speed === s}
                onClick={() => { setSpeed(s); setGesture((g) => g && { ...g, speed: s, id: Date.now() }); }}
                className="mr-1.5 px-2">
                x{s}
              </DevButton>
            ))}
          </div>
          <div className={`${DEV_MONO} mt-1.5`}>{gestureStatus}</div>
          <div className="mt-1 text-xs text-muted">
            &quot;classroom&quot; framing is the app&apos;s camera and placement; the orange ball is where the 3D model appears.
            The app also turns the head toward the model, which this page does not.
          </div>
        </DevSection>

        <DevSection title="Demo narration (heart)">
          <audio
            ref={audioRef}
            src={SEGMENTS[seg]}
            controls
            className="w-full"
            onEnded={() => setSeg((s) => Math.min(s + 1, SEGMENTS.length - 1))}
          />
          <div className="mt-2 flex gap-1.5">
            <DevButton onClick={() => setSeg((s) => Math.max(0, s - 1))}>prev</DevButton>
            <span className="self-center text-xs">seg {seg + 1}/{SEGMENTS.length}</span>
            <DevButton onClick={() => setSeg((s) => Math.min(SEGMENTS.length - 1, s + 1))}>next</DevButton>
          </div>
        </DevSection>

        <DevSection title="Live viseme">
          <div className="type-h3 font-semibold text-accent-text">{live}</div>
          <div className={`text-xs ${spans ? "text-success" : "text-danger"}`}>
            {spans ? `alignment loaded — ${spans} spans` : "no alignment timeline"}
          </div>
        </DevSection>

        <DevSection title="Loaded clips">
          <code className={DEV_MONO}>{report.clips.join(", ") || "—"}</code>
        </DevSection>

        <DevSection title="Viseme coverage">
          <div className={`text-[13px] ${missing.length ? "text-danger" : "text-success"}`}>
            {missing.length ? `missing: ${missing.join(", ")}` : "all 14 non-silent visemes present"}
          </div>
        </DevSection>

        <DevSection title={`Morph targets (${report.morphs.length})`}>
          <code className={DEV_MONO}>{report.morphs.join(", ") || "—"}</code>
        </DevSection>
      </aside>
    </div>
  );
}

Object.values(CANDIDATES).forEach((c) => useGLTF.preload(`/models/${c.file}`));
