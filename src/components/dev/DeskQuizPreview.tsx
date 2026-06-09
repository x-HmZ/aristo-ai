"use client";

/**
 * DeskQuizPreview — dev-only tuning harness for the in-scene desk quiz.
 *
 * Mounts the full AristoCanvas with the classroom + teacher, stubs the
 * activeQuiz slice in the Zustand store, and surfaces a sidebar of sliders
 * for the three camera/anchor knobs that govern desk-quiz placement:
 *   • DESK_POS     — where the camera sits during the quiz framing
 *   • DESK_TARGET  — what point in world space the camera looks at
 *   • PAPER_ANCHOR — where the <Html> quiz paper anchors in world space
 *
 * The sliders write through props to AristoCanvas → Experience →
 * CameraController / DeskQuiz, so live values appear in the scene without
 * a refresh.  Saved snapshots persist to localStorage so the tuned numbers
 * survive a reload.
 *
 * Iterate cost-free: no API calls, no LLM generation, no real auth.
 */

import { useEffect, useMemo, useState } from "react";
import { AristoCanvas } from "@/components/learn/AristoCanvas";
import { SceneProbe } from "@/components/dev/SceneProbe";
import { useAristoStore } from "@/store/useAristoStore";
import type { QuizQuestion } from "@/lib/agents/assessment";

// ─── Tunable type ────────────────────────────────────────────────────────────

type Triple = [number, number, number];

interface Tunables {
  deskPos:     Triple;
  deskTarget:  Triple;
  paperAnchor: Triple;
  lambda:      number;
}

// Mirror the production constants in CameraController.tsx / DeskQuiz.tsx so
// the dev route's "Reset" button restores the values that ship to /learn.
const DEFAULT_TUNABLES: Tunables = {
  deskPos:     [0,    0.2,  -0.05],
  deskTarget:  [0,   -1.05, -0.6],
  paperAnchor: [0,   -0.878, -0.5],
  lambda:      3.2,
};

const STORAGE_KEY = "aristo:dev:desk-quiz-tunables";

function loadTunables(): Tunables {
  if (typeof window === "undefined") return DEFAULT_TUNABLES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TUNABLES;
    const parsed = JSON.parse(raw);
    return {
      deskPos:     parsed.deskPos     ?? DEFAULT_TUNABLES.deskPos,
      deskTarget:  parsed.deskTarget  ?? DEFAULT_TUNABLES.deskTarget,
      paperAnchor: parsed.paperAnchor ?? DEFAULT_TUNABLES.paperAnchor,
      lambda:      parsed.lambda      ?? DEFAULT_TUNABLES.lambda,
    };
  } catch {
    return DEFAULT_TUNABLES;
  }
}

// ─── Stub quiz data ──────────────────────────────────────────────────────────

const STUB_QUESTIONS: QuizQuestion[] = [
  {
    id: "stub-1",
    concept_id: "stub-concept",
    question_type: "multiple_choice",
    bloom_level: "remember",
    difficulty: 0.3,
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    correct_answer: "4",
    explanation_correct: "Basic arithmetic.",
  },
  {
    id: "stub-2",
    concept_id: "stub-concept",
    question_type: "true_false",
    bloom_level: "understand",
    difficulty: 0.3,
    question: "The sky is blue on a clear day.",
    options: ["True", "False"],
    correct_answer: "True",
    explanation_correct: "Rayleigh scattering of sunlight.",
  },
  {
    id: "stub-3",
    concept_id: "stub-concept",
    question_type: "multiple_choice",
    bloom_level: "apply",
    difficulty: 0.4,
    question: "Which planet is closest to the sun?",
    options: ["Venus", "Earth", "Mercury", "Mars"],
    correct_answer: "Mercury",
    explanation_correct: "Orbital order.",
  },
  {
    id: "stub-4",
    concept_id: "stub-concept",
    question_type: "multiple_choice",
    bloom_level: "analyze",
    difficulty: 0.5,
    question: "Pick the odd one out.",
    options: ["Triangle", "Square", "Circle", "Pentagon"],
    correct_answer: "Circle",
    explanation_correct: "Circle has no straight sides.",
  },
];

// ─── Knob — single slider row with current numeric value ─────────────────────

function Knob({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ opacity: 0.85 }}>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: "#F97B2F" }}>
          {value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%" }}
      />
    </label>
  );
}

function TripleKnob({
  label, value, ranges, onChange,
}: {
  label: string;
  value: Triple;
  ranges: { x: [number, number]; y: [number, number]; z: [number, number] };
  onChange: (next: Triple) => void;
}) {
  return (
    <fieldset style={{
      border: "1px solid rgba(249,123,47,0.3)",
      borderRadius: 8,
      padding: "8px 10px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <legend style={{ fontSize: 11, fontWeight: 700, padding: "0 6px", color: "#F97B2F" }}>
        {label}
      </legend>
      <Knob label="x" value={value[0]} min={ranges.x[0]} max={ranges.x[1]} step={0.05}
        onChange={(n) => onChange([n, value[1], value[2]])} />
      <Knob label="y" value={value[1]} min={ranges.y[0]} max={ranges.y[1]} step={0.05}
        onChange={(n) => onChange([value[0], n, value[2]])} />
      <Knob label="z" value={value[2]} min={ranges.z[0]} max={ranges.z[1]} step={0.05}
        onChange={(n) => onChange([value[0], value[1], n])} />
    </fieldset>
  );
}

// ─── Main preview component ──────────────────────────────────────────────────

export default function DeskQuizPreview() {
  const [tun, setTun] = useState<Tunables>(DEFAULT_TUNABLES);
  // True once we've read the stored snapshot client-side (after mount).
  const [hydrated, setHydrated] = useState(false);
  const [quizActive, setQuizActive] = useState(true);

  useEffect(() => {
    setTun(loadTunables());
    setHydrated(true);
  }, []);

  // Stub userId once on mount so DeskQuiz's guard passes. Sync activeQuiz
  // every time the toggle flips so the camera transition can be inspected
  // both ways without a reload.
  useEffect(() => {
    useAristoStore.getState().setUserId("dev-mock-user");
  }, []);
  useEffect(() => {
    useAristoStore.getState().setActiveQuiz(
      quizActive ? { conceptId: "stub-concept", questions: STUB_QUESTIONS } : null
    );
  }, [quizActive]);

  const devOverrides = useMemo(() => ({
    deskPos:     tun.deskPos,
    deskTarget:  tun.deskTarget,
    paperAnchor: tun.paperAnchor,
    lambda:      tun.lambda,
  }), [tun]);

  const save = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tun));
  };
  const reset = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setTun(DEFAULT_TUNABLES);
  };
  const dump = () => {
    // Print copy-pasteable constants for rolling back into source.
    // eslint-disable-next-line no-console
    console.log(
`// CameraController.tsx
const DESK_POS    = new Vector3(${tun.deskPos.join(", ")});
const DESK_TARGET = new Vector3(${tun.deskTarget.join(", ")});
const LAMBDA      = ${tun.lambda};

// DeskQuiz.tsx
const PAPER_ANCHOR: [number, number, number] = [${tun.paperAnchor.join(", ")}];`
    );
  };

  if (!hydrated) {
    return <div style={{ width: "100vw", height: "100vh", background: "#FDF0E4" }} />;
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex" }}>
      {/* Scene — fills remaining width */}
      <div style={{ flex: 1, position: "relative" }}>
        <AristoCanvas devOverrides={devOverrides}>
          <SceneProbe />
        </AristoCanvas>
        {/* Marker overlay — useful sanity reference */}
        <div style={{
          position: "absolute", top: 12, left: 12,
          background: "rgba(0,0,0,0.55)", color: "white",
          padding: "4px 8px", borderRadius: 6,
          fontSize: 11, fontFamily: "monospace", pointerEvents: "none",
        }}>
          /dev/desk-quiz — tune until paper sits on the desk surface
        </div>
      </div>

      {/* Sidebar */}
      <aside style={{
        width: 280,
        background: "#1a1a2e",
        color: "#fdf6ee",
        padding: 14,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontFamily: "system-ui, sans-serif",
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Desk Quiz tuning</h2>
        <p style={{ fontSize: 11, opacity: 0.65, margin: 0 }}>
          Sliders update in real time. Save to persist across reload.
        </p>

        <TripleKnob
          label="DESK_POS (camera)"
          value={tun.deskPos}
          ranges={{ x: [-2, 2], y: [-1.5, 1.5], z: [-4, 2] }}
          onChange={(v) => setTun((t) => ({ ...t, deskPos: v }))}
        />
        <TripleKnob
          label="DESK_TARGET (look at)"
          value={tun.deskTarget}
          ranges={{ x: [-2, 2], y: [-2, 1], z: [-5, 0] }}
          onChange={(v) => setTun((t) => ({ ...t, deskTarget: v }))}
        />
        <TripleKnob
          label="PAPER_ANCHOR (Html pos)"
          value={tun.paperAnchor}
          ranges={{ x: [-2, 2], y: [-2, 1], z: [-5, 0] }}
          onChange={(v) => setTun((t) => ({ ...t, paperAnchor: v }))}
        />
        <fieldset style={{
          border: "1px solid rgba(249,123,47,0.3)",
          borderRadius: 8, padding: "8px 10px",
        }}>
          <legend style={{ fontSize: 11, fontWeight: 700, padding: "0 6px", color: "#F97B2F" }}>
            damping
          </legend>
          <Knob label="λ" value={tun.lambda} min={0.5} max={10} step={0.1}
            onChange={(n) => setTun((t) => ({ ...t, lambda: n }))} />
        </fieldset>

        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button onClick={save}  style={btnStyle("#F97B2F")}>Save</button>
          <button onClick={reset} style={btnStyle("#333")}>Reset</button>
          <button onClick={dump}  style={btnStyle("#333")}>Dump → console</button>
        </div>
        <button
          onClick={() => setQuizActive((q) => !q)}
          data-testid="toggle-quiz"
          style={btnStyle(quizActive ? "#7e2acc" : "#1d8a47")}
        >
          {quizActive ? "Hide Quiz (lesson framing)" : "Show Quiz (desk framing)"}
        </button>

        <pre style={{
          fontSize: 10, background: "#0d0d1e", padding: 8, borderRadius: 6,
          overflow: "auto", margin: 0,
        }}>
{JSON.stringify(tun, null, 2)}
        </pre>
      </aside>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    flex: 1,
    background: bg,
    color: "white",
    border: "none",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  };
}
