"use client";

/**
 * InteractiveRoom: the room view of /dev/interactive (V10). The real shell
 * pieces (canvas, the lesson panel with its playback hook, the widget stage) run
 * against a synthetic lesson whose Demonstrate phase ends in an explore segment.
 *
 * Nothing here talks to a paid service by itself, but the hook does call
 * /api/tts, /api/learn/interactive and /api/learn/complete: the scripted checks
 * (.claude/eval/2026-10-13-v10-interactive/scripts/room.cjs) answer those with
 * stubs and abort every other /api request, so the run costs nothing.
 */

import { useEffect } from "react";
import { AristoCanvas } from "@/components/learn/AristoCanvas";
import { MessagePanel } from "@/components/learn/MessagePanel";
import { InteractiveStage } from "@/components/learn/InteractiveStage";
import { PANEL_SLOT, panelColumn } from "@/components/learn/ClassroomChrome";
import { useAristoStore, type LessonPayload } from "@/store/useAristoStore";
import { INTERACTIVE_FIXTURES } from "@/lib/interactive/fixtures";

function lessonFor(fixtureId: string): LessonPayload {
  const f = INTERACTIVE_FIXTURES.find((x) => x.id === fixtureId) ?? INTERACTIVE_FIXTURES[0];
  return {
    concept_id:   "dev-interactive",
    concept_name: "Slope of a line",
    segments: [
      { id: "seg_001", phase: "activate",    role: "hook",      text: "You have walked up a hill before." },
      { id: "seg_002", phase: "explain",     role: "narrate",   text: "Slope says how steep a line is." },
      { id: "seg_003", phase: "explain",     role: "narrate",   text: "Rise over run, that is the whole idea." },
      { id: "seg_004", phase: "demonstrate", role: "demo_step", text: "Let us build a line and watch it move." },
      { id: "seg_005", phase: "demonstrate", role: "explore",   text: `Try the ${f.spec.controls[0].label} slider on the board and see what happens.` },
      { id: "seg_006", phase: "connect",     role: "narrate",   text: "Next we will see how two lines meet." },
    ],
    phases: {
      activate:    { content: "You have walked up a hill before.", segment_ids: ["seg_001"] },
      explain:     { analogy: "A hill.", formal_explanation: "Slope is rise over run.", key_insight: "Steeper hill, bigger slope.", segment_ids: ["seg_002", "seg_003"] },
      demonstrate: { example_description: "Move the slope slider.", step_by_step: ["Move the slider", "Watch the line"], segment_ids: ["seg_004", "seg_005"] },
      challenge:   { question: "What slope is a flat line?", hint: "No rise.", answer: "Zero" },
      connect:     { content: "Next we will see how two lines meet.", segment_ids: ["seg_006"] },
    },
    metadata: {
      estimated_read_time_minutes: 3,
      bloom_level_taught:          "understand",
      depth_level:                 "standard",
      should_generate_model:       false,
      interactive:                 f.spec,
    },
  };
}

export default function InteractiveRoom({ fixtureId }: { fixtureId: string }) {
  useEffect(() => {
    // Read by the scripted checks: the store, and the fixtures their API stubs answer with.
    Object.assign(window, { __aristoStore: useAristoStore, __aristoFixtures: INTERACTIVE_FIXTURES });
    const s = useAristoStore.getState();
    s.setUserId("dev-mock-user");
    s.setMode("course");
    s.setActiveLesson(lessonFor(fixtureId));
    return () => { s.setActiveLesson(null); };
  }, [fixtureId]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0 z-0"><AristoCanvas /></div>
      <div className={panelColumn(false)}>
        <div className={PANEL_SLOT}><MessagePanel /></div>
      </div>
      <InteractiveStage />
    </div>
  );
}
