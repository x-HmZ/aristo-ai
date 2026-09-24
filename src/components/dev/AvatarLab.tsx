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
import { maskTrackNames, skeletonMasks, type BoneInfo } from "@/lib/avatar/skeletonMasks";
import { AVATAR_ASSETS } from "@/components/three/Teacher";

const CANDIDATES = {
  jake:   { file: "Teacher_Jake.glb",   label: "Jake (Canino, CC4)", pack: "Teacher_Jake_clips.glb" },
  mj:     { file: "Teacher_MJ.glb",     label: "MJ (Canino, CC4)",   pack: "Teacher_MJ_clips.glb" },
  marcus: { file: "Teacher_Marcus.glb", label: "Marcus (shipping control)", pack: null },
} as const;
type CandidateKey = keyof typeof CANDIDATES;

const CLIPS = ["Idle", "Talking", "Pointing"] as const;

/**
 * Overlay gestures to review in motion (V9.6), with the mask each plays under.
 * Played the way Teacher.tsx plays an overlay: a masked copy of the pack clip
 * over the base, weighted by the director's own fade and dominance curve. The
 * V9.6 clips are not in the manifest until Hmz approves them; the last three
 * are shipped overlays, for comparison.
 */
const GESTURES = [
  { name: "PresentModel", mask: "upper", note: "V9.6, approved: the model appears" },
  { name: "Encourage",    mask: "upper", note: "V9.6, approved: quiz not passed" },
  { name: "Almost",       mask: "upper", note: "V9.6: wrong answer" },
  { name: "Exactly",      mask: "upper", note: "V9.6: right answer" },
  { name: "WellDone",     mask: "upper", note: "V9.6: quiz passed" },
  { name: "ThatsIt",      mask: "upper", note: "V9.6: lesson complete" },
  { name: "GlanceBoard",  mask: "upper", note: "V9.6: long quiet wait" },
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
    const a = actions[clip];
    if (!a) return;
    a.reset().fadeIn(0.25).play();
    return () => { a.fadeOut(0.25); };
  }, [actions, clip]);

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

    // A resting smile plus a blink loop, so a still face does not read as dead.
    setMorph("mouthSmile", v ? 0 : 0.15, 0.1);
    blink.current -= dt;
    if (blink.current < -0.12) blink.current = 2 + Math.random() * 3;
    const closed = blink.current < 0 ? 1 : 0;
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
          <meshStandardMaterial color="#F97B2F" transparent opacity={0.45} />
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
  const [candidate, setCandidate] = useState<CandidateKey>("mj");
  const [clip, setClip] = useState<string>("Talking");
  const [seg, setSeg] = useState(0);
  const [report, setReport] = useState({ morphs: [] as string[], clips: [] as string[], current: "—" });
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [view, setView] = useState<ViewKey>("lesson");
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
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui", background: "#FDF0E4" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
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

      <aside style={{ width: 330, padding: 18, overflowY: "auto", background: "#fff", borderLeft: "1px solid #E9D9C8" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>V9.1 avatar lab</h2>

        <Section title="Candidate">
          {(Object.keys(CANDIDATES) as CandidateKey[]).map((k) => (
            <label key={k} style={{ display: "block", marginBottom: 4, fontSize: 13 }}>
              <input type="radio" checked={candidate === k} onChange={() => setCandidate(k)} />{" "}
              {CANDIDATES[k].label}
            </label>
          ))}
        </Section>

        <Section title="Framing">
          {(Object.keys(VIEWS) as ViewKey[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              style={{ ...btn, background: view === v ? "#F97B2F" : "#F3E7DA", color: view === v ? "#fff" : "#4A3A2C" }}>
              {v}
            </button>
          ))}
        </Section>

        <Section title="Clip">
          {CLIPS.map((c) => (
            <button key={c} onClick={() => setClip(c)}
              style={{ ...btn, background: clip === c ? "#F97B2F" : "#F3E7DA", color: clip === c ? "#fff" : "#4A3A2C" }}>
              {c}
            </button>
          ))}
        </Section>

        <Section title="Gesture review (over the clip above)">
          {GESTURES.map((g) => (
            <button key={g.name} title={`${g.mask} mask, ${g.note}`}
              onClick={() => setGesture({ name: g.name, id: Date.now(), loop, speed })}
              style={{ ...btn, marginBottom: 6, background: gesture?.name === g.name ? "#F97B2F" : "#F3E7DA", color: gesture?.name === g.name ? "#fff" : "#4A3A2C" }}>
              {g.name}
            </button>
          ))}
          <div style={{ marginTop: 4, fontSize: 13 }}>
            <label>
              <input type="checkbox" checked={loop}
                onChange={(e) => { setLoop(e.target.checked); setGesture((g) => g && { ...g, loop: e.target.checked, id: Date.now() }); }} />{" "}
              replay every time it ends
            </label>{" "}
            <button style={btn} onClick={() => setGesture(null)}>stop</button>
          </div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            speed{" "}
            {SPEEDS.map((s) => (
              <button key={s}
                onClick={() => { setSpeed(s); setGesture((g) => g && { ...g, speed: s, id: Date.now() }); }}
                style={{ ...btn, padding: "3px 8px", background: speed === s ? "#F97B2F" : "#F3E7DA", color: speed === s ? "#fff" : "#4A3A2C" }}>
                x{s}
              </button>
            ))}
          </div>
          <div style={{ ...mono, marginTop: 6 }}>{gestureStatus}</div>
          <div style={{ fontSize: 11, color: "#9A8574", marginTop: 4 }}>
            &quot;classroom&quot; framing is the app&apos;s camera and placement; the orange ball is where the 3D model appears.
            The app also turns the head toward the model, which this page does not.
          </div>
        </Section>

        <Section title="Demo narration (heart)">
          <audio
            ref={audioRef}
            src={SEGMENTS[seg]}
            controls
            style={{ width: "100%" }}
            onEnded={() => setSeg((s) => Math.min(s + 1, SEGMENTS.length - 1))}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button style={btn} onClick={() => setSeg((s) => Math.max(0, s - 1))}>◀ prev</button>
            <span style={{ fontSize: 12, alignSelf: "center" }}>seg {seg + 1}/{SEGMENTS.length}</span>
            <button style={btn} onClick={() => setSeg((s) => Math.min(SEGMENTS.length - 1, s + 1))}>next ▶</button>
          </div>
        </Section>

        <Section title="Live viseme">
          <div style={{ fontSize: 22, fontWeight: 600, color: "#F97B2F" }}>{live}</div>
          <div style={{ fontSize: 12, color: spans ? "#2E7D32" : "#B23B2E" }}>
            {spans ? `alignment loaded — ${spans} spans` : "no alignment timeline"}
          </div>
        </Section>

        <Section title="Loaded clips">
          <code style={mono}>{report.clips.join(", ") || "—"}</code>
        </Section>

        <Section title="Viseme coverage">
          <div style={{ fontSize: 13, color: missing.length ? "#B23B2E" : "#2E7D32" }}>
            {missing.length ? `missing: ${missing.join(", ")}` : "all 14 non-silent visemes present"}
          </div>
        </Section>

        <Section title={`Morph targets (${report.morphs.length})`}>
          <code style={mono}>{report.morphs.join(", ") || "—"}</code>
        </Section>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: .6, color: "#9A8574", marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const btn: React.CSSProperties = {
  border: 0, borderRadius: 7, padding: "6px 11px", marginRight: 6,
  background: "#F3E7DA", color: "#4A3A2C", cursor: "pointer", fontSize: 13,
};
const mono: React.CSSProperties = {
  fontSize: 11, lineHeight: 1.5, wordBreak: "break-word", color: "#4A3A2C",
};

Object.values(CANDIDATES).forEach((c) => useGLTF.preload(`/models/${c.file}`));
