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
 * (all three are in deskFraming.ts; a slider overrides the production value, and a knob left alone shows the
 * production framing, which follows the canvas aspect ratio)
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
import { DEV_MONO, DEV_OVERLAY, DEV_PANEL, DevButton } from "@/components/dev/devKit";
import { cn } from "@/lib/utils";
import { useFrame } from "@react-three/fiber";
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

// Mirror the production constants in deskFraming.ts so the dev route's "Reset" button restores the values that
// ship to /learn (a knob still at its default is not passed as an override).
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

// Publishes the live camera position for the verification scripts (window.__cam), so a check can tell whether the
// camera glided or cut to the desk framing.
function CameraSpy() {
  useFrame(({ camera }) => {
    const w = window as unknown as { __cam?: number[] };
    w.__cam = camera.position.toArray(w.__cam);
  });
  return null;
}

// ─── Knob — single slider row with current numeric value ─────────────────────

function Knob({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex justify-between">
        <span className="text-body">{label}</span>
        <span className="font-semibold tabular-nums text-accent-text">
          {value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent"
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
    <fieldset className="flex flex-col gap-1.5 rounded-[10px] border border-line px-2.5 py-2">
      <legend className="px-1.5 text-xs font-semibold text-accent-text">
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
  // ?room=alt probes the alternative classroom (same switch as /dev/free-model).
  useEffect(() => {
    const s = useAristoStore.getState();
    s.setUserId("dev-mock-user");
    if (new URLSearchParams(window.location.search).get("room") === "alt") s.setClassroom("alternative");
  }, []);
  useEffect(() => {
    useAristoStore.getState().setActiveQuiz(
      quizActive ? { conceptId: "stub-concept", questions: STUB_QUESTIONS } : null
    );
  }, [quizActive]);

  // Pass an override only for a knob that has moved, so the route shows the production framing (which follows the
  // canvas aspect ratio) until you touch a slider.
  const devOverrides = useMemo(() => {
    const moved = (a: readonly number[], b: readonly number[]) => a.some((v, i) => v !== b[i]);
    const d = DEFAULT_TUNABLES;
    return {
      deskPos:     moved(tun.deskPos, d.deskPos) ? tun.deskPos : undefined,
      deskTarget:  moved(tun.deskTarget, d.deskTarget) ? tun.deskTarget : undefined,
      paperAnchor: moved(tun.paperAnchor, d.paperAnchor) ? tun.paperAnchor : undefined,
      lambda:      tun.lambda !== d.lambda ? tun.lambda : undefined,
    };
  }, [tun]);

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
`// deskFraming.ts (a dev slider overrides the pose; the shipped pose is per aspect ratio, so only paste these
// after retuning for a landscape canvas)
const DESK_POS    = new Vector3(${tun.deskPos.join(", ")});
const DESK_TARGET = new Vector3(${tun.deskTarget.join(", ")});
const LAMBDA      = ${tun.lambda}; // CameraController.tsx

const PAPER_ANCHOR: [number, number, number] = [${tun.paperAnchor.join(", ")}];`
    );
  };

  if (!hydrated) {
    return <div className="h-screen w-screen bg-bg" />;
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex" }}>
      {/* Scene — fills remaining width */}
      <div style={{ flex: 1, position: "relative" }}>
        <AristoCanvas devOverrides={devOverrides}>
          <SceneProbe />
          <CameraSpy />
        </AristoCanvas>
        {/* Marker overlay — useful sanity reference */}
        <div className={cn(DEV_OVERLAY, "absolute left-3 top-3")}>
          /dev/desk-quiz — tune until paper sits on the desk surface
        </div>
      </div>

      {/* Sidebar */}
      <aside className={cn(DEV_PANEL, "flex w-[280px] shrink-0 flex-col gap-2.5")}>
        <h2 className="text-sm font-bold">Desk Quiz tuning</h2>
        <p className="text-xs text-muted">
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
        <fieldset className="rounded-[10px] border border-line px-2.5 py-2">
          <legend className="px-1.5 text-xs font-semibold text-accent-text">
            damping
          </legend>
          <Knob label="λ" value={tun.lambda} min={0.5} max={10} step={0.1}
            onChange={(n) => setTun((t) => ({ ...t, lambda: n }))} />
        </fieldset>

        <div className="mt-1 flex gap-1.5">
          <DevButton primary onClick={save} className="flex-1">Save</DevButton>
          <DevButton onClick={reset} className="flex-1">Reset</DevButton>
          <DevButton onClick={dump} className="flex-1">Dump → console</DevButton>
        </div>
        <DevButton
          selected={quizActive}
          onClick={() => setQuizActive((q) => !q)}
          data-testid="toggle-quiz"
        >
          {quizActive ? "Hide Quiz (lesson framing)" : "Show Quiz (desk framing)"}
        </DevButton>

        <pre className={cn(DEV_MONO, "m-0 overflow-auto rounded-[10px] bg-sunk p-2 text-ink")}>
{JSON.stringify(tun, null, 2)}
        </pre>
      </aside>
    </div>
  );
}
