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

const CANDIDATES = {
  jake:   { file: "Teacher_Jake.glb",   label: "Jake (Canino, CC4)" },
  mj:     { file: "Teacher_MJ.glb",     label: "MJ (Canino, CC4)" },
  marcus: { file: "Teacher_Marcus.glb", label: "Marcus (shipping control)" },
} as const;
type CandidateKey = keyof typeof CANDIDATES;

const CLIPS = ["Idle", "Talking", "Pointing"] as const;

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
  candidate, clip, audio, onReport, onViseme,
}: {
  candidate: CandidateKey;
  clip: string;
  audio: HTMLAudioElement | null;
  onReport: (r: { morphs: string[]; clips: string[]; current: string }) => void;
  onViseme: (v: string, spans: number) => void;
}) {
  const url = `/models/${CANDIDATES[candidate].file}`;
  const { scene, animations } = useGLTF(url);
  const root = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, root);
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

  // Same placement as Experience.tsx (scale 1.5, rotY 0.3), but centred on x
  // so the lab frames one candidate at a time.
  return <primitive ref={root} object={scene} position={[0, -1.7, -3]} scale={1.5} rotation={[0, 0.3, 0]} />;
}

/**
 * Two fixed viewpoints: the lesson framing the app actually uses, and a face
 * shot close enough to judge a viseme. Lipsync cannot be assessed at lesson
 * distance, and lesson distance is the only framing that matters for casting.
 */
const VIEWS = {
  lesson: { pos: [0, -0.2, 0.9], target: [0, -0.2, -3] },
  face:   { pos: [0, 0.82, -1.75], target: [0, 0.82, -3] },
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
