/**
 * TeachingAgent
 *
 * Generates a 5-phase structured lesson for a concept using Claude Sonnet.
 * Implements spec §4.2 and §8.1-8.2.
 *
 * Phases: Activate → Explain → Demonstrate → Challenge → Connect
 *
 * When NEXT_PUBLIC_ADAPTIVE_VISUALS=true the agent also emits a `segments`
 * array — ordered 1-3 sentence narration units each carrying an optional
 * per-moment visual field.  Old phase-block fields are emitted in parallel
 * (dual-emit) so the flag can be flipped back instantly without data loss.
 */

import type Anthropic          from "@anthropic-ai/sdk";
import type { DynamicProfile } from "@/store/useAristoStore";
import { MODELS }              from "./models";
import { getAnthropic }        from "@/lib/llm/anthropic";

const client = getAnthropic();

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ConceptInput {
  id:                    string;
  name:                  string;
  description:           string;
  domain?:               string;
  learning_objectives?:  string[];
  key_terms?:            string[];
  common_misconceptions?: string[];
  prerequisites?:        string[];   // names of already-mastered prerequisites
}

export interface ModelAnnotation {
  label: string;
  bias:  "front" | "left" | "right" | "back" | "top" | "bottom";
}

// ─── Adaptive segment types ────────────────────────────────────────────────────

export type LessonPhase = "activate" | "explain" | "demonstrate" | "challenge" | "connect";

export type SegmentRole =
  | "narrate"           // generic explanatory speech
  | "hook"              // attention-grabbing opener
  | "demo_step"         // one step in a demonstration
  | "callout"           // points at a feature of an active visual
  | "challenge_setup"   // poses the challenge question
  | "challenge_reveal"  // reveals + explains the answer
  | "transition";       // bridge between sub-ideas

export interface SegmentVisual {
  /**
   * Nano Banana Pro infographic prompt scoped to THIS segment only.
   * Must be ≤ 40 words. Concrete nouns + style hint.
   */
  prompt: string;
  style: "infographic" | "diagram" | "comparison" | "process_flow" | "annotated_photo";
  callouts?: string[];        // 1–3 short labels the avatar references in speech
  persists_to_next?: boolean; // keep this image for the next segment too
  /**
   * Pre-resolved static image URL (frozen demo lessons only). When present,
   * useLessonPlayback's demoMode path uses this directly instead of firing
   * /api/learn/segment-visuals — never populated by the live generation
   * pipeline.
   */
  imageUrl?: string;
}

export interface NarrationSegment {
  id:          string;       // "seg_001", "seg_002" — stable order
  phase:       LessonPhase;
  role:        SegmentRole;
  text:        string;       // 1–3 sentences the avatar speaks
  visual?:     SegmentVisual;
  gesture?:    "idle" | "pointing" | "thinking" | "explaining";
  pause_after?: number;      // seconds of dwell after narration ends (default 0)
}

// ─── Lesson payload ────────────────────────────────────────────────────────────

export interface LessonPayload {
  concept_id:   string;
  concept_name: string;

  // ── Ordered segment list (present when NEXT_PUBLIC_ADAPTIVE_VISUALS=true) ──
  segments?: NarrationSegment[];

  // ── 5-phase blocks (always present; old pipeline reads these directly) ──
  phases: {
    activate: {
      content:                   string;
      prerequisites_referenced?: string[];
      segment_ids?:              string[];
    };
    explain: {
      analogy:            string;
      formal_explanation: string;
      key_insight:        string;
      segment_ids?:       string[];
    };
    demonstrate: {
      example_description:    string;
      narration_pre_visual?:  string;
      visual_walkthrough?:    string;
      code?:                  string;
      step_by_step:           string[];
      output?:                string;
      segment_ids?:           string[];
    };
    challenge: {
      question:      string;
      hint:          string;
      answer:        string;
      segment_ids?:  string[];
    };
    connect: {
      content:       string;
      next_concept?: string;
      segment_ids?:  string[];
    };
  };

  metadata: {
    estimated_read_time_minutes: number;
    bloom_level_taught:          string;
    depth_level:                 string;
    should_generate_model:       boolean;  // kept for legacy compatibility
    should_generate_3d_model?:   boolean;  // new canonical name
    model_image_prompt?:         string;
    model_3d_prompt?:            string;
    model_annotations?:          ModelAnnotation[];
    model_callouts?:             string[];
    /**
     * Pre-resolved static GLB URL (frozen demo lessons only). When present,
     * useLessonPlayback's demoMode path wires this straight to the "View in
     * 3D" toggle instead of calling /api/generate-model + /api/generate-model/3d
     * — never populated by the live generation pipeline.
     */
    demo_model_url?: string;
  };
}

// ─── System prompt (legacy path) ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert tutor. Your job is to TEACH — not to summarize, not to lecture, not to dump information.

You follow the 5-Phase Teaching Protocol for every lesson:

PHASE 1 — ACTIVATE: Connect this concept to something the learner already knows. Reference their prior knowledge explicitly. Use phrasing like "You already understand X, so this builds on that..."

PHASE 2 — EXPLAIN: Start with a concrete, vivid analogy that makes the concept tangible. THEN give the formal/precise definition. Adjust depth to the learner's preference (see profile below). Never just give a definition without grounding it first.

PHASE 3 — DEMONSTRATE: Walk through a complete worked example. Show every step and explain WHY each step is taken, not just WHAT is done. For code topics, include runnable code with comments.

PHASE 4 — CHALLENGE: Ask a thought-provoking Socratic question. This is NOT a simple recall question. It should make the learner THINK — "What would happen if...?", "Why does this work but that doesn't?", "Can you think of a situation where this would fail?" Include a hint and a full answer.

PHASE 5 — CONNECT: Show how this concept links to the bigger picture and preview what comes next. Reinforce motivation.

RULES:
- DO NOT skip any phase.
- DO NOT give walls of text. Be clear and concise within each phase.
- DO NOT just list facts. Every explanation needs an analogy or concrete example.
- Use encouraging but not patronizing language.
- If the learner's profile says "concise", keep each phase brief. If "detailed", go deeper with edge cases, caveats, and multiple examples.
- Ground your explanations in the reference material provided. Do not fabricate facts.
- For should_generate_model: set true ONLY for physical/tangible objects that benefit from 3D visualization (molecules, organs, machines, planets, animals, geometric solids). Set false for abstract concepts, code, processes, or anything non-physical.
- When should_generate_model is true, you MUST provide BOTH image prompt fields, AND the demonstrate.visual_walkthrough must reference what is in the image:
  • model_image_prompt: A rich, educational infographic the teacher will literally point at while delivering visual_walkthrough. Annotated diagram style, labeled parts, cross-sections, educational poster aesthetic. Example: "anatomical cross-section of the human heart, labeled chambers and valves, arrows showing blood flow direction, medical illustration style, clean white background, vivid educational diagram". The labels in this image MUST match the elements you reference in visual_walkthrough.
  • model_3d_prompt: A SHORT, clean description of ONE isolated physical object suitable for 3D reconstruction — no text, no labels, no backgrounds, no scenes. Focus on shape, material, color. Example: "human heart, anatomically accurate, red and pink muscle tissue, realistic, isolated, centered, white background".
  • model_annotations: 3–6 short labels (≤3 words each) for the 3D model, with a bias hint of front/left/right/back/top/bottom describing roughly where on the object the label sits. Example for a heart: [{"label":"Left ventricle","bias":"left"},{"label":"Aorta","bias":"top"}].
  • model_callouts: 1–4 short sentences the teacher will narrate when the 3D model appears, each tied to the annotations. Example: ["Notice the left ventricle on the left — that's the strongest chamber.","The aorta exits at the top, carrying blood to the body."].

NARRATION TIMING (always provide these on demonstrate, not just when generating a model):
- demonstrate.narration_pre_visual: 1–2 sentences the teacher says BEFORE any image appears. This bridges from Explain into Demonstrate without referencing visuals. ("Let's walk through how this actually works step by step.")
- demonstrate.visual_walkthrough: 2–4 sentences the teacher says ONCE the educational image is on screen. Reference visible parts explicitly so the narration feels grounded. ("Look at the diagram on the right — see the labeled chambers? Blood enters the right atrium here…")

Return your response by calling the deliver_lesson tool.`;

// ─── System prompt (adaptive path) ────────────────────────────────────────────

const SYSTEM_PROMPT_ADAPTIVE = `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADAPTIVE VISUAL AIDS — REQUIRED IN THIS MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In addition to the 5 phase blocks above, you MUST also populate:
  • A top-level "segments" array (the ordered narration script)
  • "segment_ids" on each phase block (which segments belong to that phase)

WHAT A SEGMENT IS
Each segment is 1–3 sentences the avatar will actually speak. Break the lesson
into segments the way a great teacher naturally pauses — at the end of a thought,
before introducing something new, before/after a visual.

VISUAL AID RULES — when to set segment.visual

DO set visual when the segment is about:
  • a physical structure or its parts (anatomy, cell, machine, gear, circuit)
  • a geometric / spatial relationship (angles, areas, vectors, coordinates)
  • a process with stages worth showing in parallel (mitosis, water cycle, algorithm)
  • a comparison between 2–3 things best understood side-by-side
  • a labeled diagram that clarifies a term that is otherwise abstract

DO NOT set visual when the segment is:
  • a transition or rhetorical question
  • a definition fully captured by the words themselves
  • a piece of code (the lesson UI renders code blocks separately)
  • a recap sentence ("So far we've seen…")
  • the answer reveal of a challenge (use challenge_reveal role; the student's
    own thinking matters more than another diagram)

VISUAL PROMPT QUALITY
  • The prompt must be specific to THIS segment's content, not the whole topic.
    Bad:  "anatomical diagram of the heart"   ← every segment in the lesson
    Good: "cross-section zoomed on the mitral valve, open position, blood flow
           arrow pointing down, left atrium above, left ventricle below"
  • Reference the elements the student will literally see while the avatar speaks.
  • Keep prompts under 40 words. Concrete nouns + style hint.

PERSISTENCE
  • If the next 1–3 segments elaborate on the same visual, set
    persists_to_next: true on each but the last in that run.
  • Do NOT generate a new image for every sentence.

SEGMENT COUNT GUIDANCE
  • Typical lesson: 8–18 segments total
  • Of those: 3–6 should have visuals (roughly 33%)
  • Don't pad. Fewer denser segments beat many fragments.
  • Each segment's text should be 1–3 complete sentences.

SEGMENT ROLES
  • hook          — opening grabber (activate phase)
  • narrate       — general explanatory speech
  • demo_step     — one step of a worked example
  • callout       — explicitly points at a feature of the current visual
  • challenge_setup   — poses the challenge question to the student
  • challenge_reveal  — reads back the answer and explains it
  • transition    — bridge sentence between sub-ideas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEW-SHOT EXAMPLE — Pythagoras' theorem
(12 segments, 4 with visuals — use this as a format template)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"segments": [
  {
    "id": "seg_001", "phase": "activate", "role": "hook",
    "text": "You've measured the diagonal of a TV or a room and wondered where that number comes from — today you'll know exactly why it works."
  },
  {
    "id": "seg_002", "phase": "activate", "role": "narrate",
    "text": "Whenever two walls meet at a right angle, the slanted distance across them is pinned down by a rule Pythagoras proved 2500 years ago."
  },
  {
    "id": "seg_003", "phase": "explain", "role": "narrate",
    "text": "Think of a right triangle as a ramp: the two legs are the flat ground and the vertical wall, and the hypotenuse is the ramp itself."
  },
  {
    "id": "seg_004", "phase": "explain", "role": "narrate",
    "text": "The theorem says: build a square on each of the three sides, and the two smaller squares together have exactly the same area as the big square on the hypotenuse.",
    "visual": {
      "prompt": "Right triangle, legs labeled a and b, hypotenuse c. Three squares drawn outward on each side, blue for a², green for b², orange for c². Equation a²+b²=c² below. White background, clean educational diagram.",
      "style": "diagram",
      "callouts": ["Leg a", "Leg b", "Hypotenuse c"],
      "persists_to_next": true
    },
    "gesture": "pointing"
  },
  {
    "id": "seg_005", "phase": "explain", "role": "narrate",
    "text": "Notice the two smaller squares in the diagram — blue and green together — they tile perfectly into the orange square on the hypotenuse.",
    "gesture": "pointing"
  },
  {
    "id": "seg_006", "phase": "demonstrate", "role": "demo_step",
    "text": "Let's verify it with real numbers: take legs of length 3 and 4.",
    "visual": {
      "prompt": "Right triangle with legs 3 and 4, hypotenuse 5. Squares on each side labeled 9, 16, 25. Arithmetic shown: 3²+4² = 9+16 = 25 = 5². Bold result. White background.",
      "style": "diagram",
      "callouts": ["3² = 9", "4² = 16", "5² = 25"],
      "persists_to_next": true
    },
    "gesture": "pointing"
  },
  {
    "id": "seg_007", "phase": "demonstrate", "role": "demo_step",
    "text": "3 squared is 9, 4 squared is 16 — add them and you get 25. The square root of 25 is exactly 5, so the hypotenuse is 5.",
    "gesture": "pointing"
  },
  {
    "id": "seg_008", "phase": "demonstrate", "role": "narrate",
    "text": "This 3-4-5 combination is called a Pythagorean triple. Builders have used it for millennia to lay out perfect right angles on construction sites."
  },
  {
    "id": "seg_009", "phase": "demonstrate", "role": "transition",
    "text": "Try another: legs 5 and 12 give 25+144=169, and √169 = 13. Same rule, any triangle."
  },
  {
    "id": "seg_010", "phase": "challenge", "role": "challenge_setup",
    "text": "Here's your challenge: a ladder 13 feet long leans against a wall, its base sitting 5 feet from the wall. How high up the wall does the top of the ladder reach?"
  },
  {
    "id": "seg_011", "phase": "challenge", "role": "challenge_reveal",
    "text": "12 feet. The ladder is the hypotenuse: 13² − 5² = 169 − 25 = 144, and √144 = 12.",
    "visual": {
      "prompt": "Ladder leaning on a wall. Ground labeled 5 ft, ladder labeled 13 ft, wall height labeled 12 ft with question-mark. Right-angle symbol at wall base. Equation 13²−5²=144 shown. Clean line illustration.",
      "style": "annotated_photo",
      "callouts": ["Ground: 5 ft", "Height: 12 ft", "Ladder: 13 ft"]
    },
    "gesture": "explaining"
  },
  {
    "id": "seg_012", "phase": "connect", "role": "transition",
    "text": "Pythagoras is everywhere: GPS computes distances this way, game engines use it for collision detection, and it's the stepping stone into trigonometry — exactly where we go next."
  }
],
"phases": {
  "activate":    { "content": "...", "segment_ids": ["seg_001","seg_002"] },
  "explain":     { "analogy": "...", "formal_explanation": "...", "key_insight": "a²+b²=c²: the areas of the squares on the legs equal the area on the hypotenuse", "segment_ids": ["seg_003","seg_004","seg_005"] },
  "demonstrate": { "example_description": "...", "step_by_step": ["..."], "narration_pre_visual": "...", "segment_ids": ["seg_006","seg_007","seg_008","seg_009"] },
  "challenge":   { "question": "A 13 ft ladder leans against a wall, base 5 ft away. How high does it reach?", "hint": "The ladder is the hypotenuse.", "answer": "12 feet — √(13²−5²)=12", "segment_ids": ["seg_010","seg_011"] },
  "connect":     { "content": "...", "next_concept": "Trigonometric ratios", "segment_ids": ["seg_012"] }
}

END OF FEW-SHOT EXAMPLE.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now produce the full lesson. Fill in ALL old phase-block fields as before, AND produce the segments array with segment_ids on each phase.`;

// ─── Tool schemas ──────────────────────────────────────────────────────────────

const _phaseBase = {
  activate: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      content:                  { type: "string" },
      prerequisites_referenced: { type: "array", items: { type: "string" } },
    },
    required: ["content"],
  },
  explain: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      analogy:            { type: "string" },
      formal_explanation: { type: "string" },
      key_insight:        { type: "string" },
    },
    required: ["analogy", "formal_explanation", "key_insight"],
  },
  demonstrate: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      example_description:   { type: "string" },
      narration_pre_visual:  { type: "string" },
      visual_walkthrough:    { type: "string" },
      code:                  { type: "string" },
      step_by_step:          { type: "array", items: { type: "string" } },
      output:                { type: "string" },
    },
    required: ["example_description", "step_by_step", "narration_pre_visual"],
  },
  challenge: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      question: { type: "string" },
      hint:     { type: "string" },
      answer:   { type: "string" },
    },
    required: ["question", "hint", "answer"],
  },
  connect: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      content:      { type: "string" },
      next_concept: { type: "string" },
    },
    required: ["content"],
  },
};

const _metadataSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    estimated_read_time_minutes: { type: "number" },
    bloom_level_taught:          { type: "string" },
    depth_level:                 { type: "string" },
    should_generate_model:       { type: "boolean" },
    model_image_prompt:          { type: "string" },
    model_3d_prompt:             { type: "string" },
    model_annotations: {
      type:  "array" as const,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          bias:  { type: "string", enum: ["front", "left", "right", "back", "top", "bottom"] },
        },
        required: ["label", "bias"],
      },
    },
    model_callouts: {
      type:  "array" as const,
      items: { type: "string" },
    },
  },
  required: [
    "estimated_read_time_minutes",
    "bloom_level_taught",
    "depth_level",
    "should_generate_model",
  ],
};

// Legacy tool — no segments
const lessonTool: Anthropic.Tool = {
  name: "deliver_lesson",
  description: "Return a structured 5-phase lesson payload.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      phases: {
        type: "object",
        additionalProperties: false,
        properties: _phaseBase,
        required: ["activate", "explain", "demonstrate", "challenge", "connect"],
      },
      metadata: _metadataSchema,
    },
    required: ["phases", "metadata"],
  },
};

// Adaptive tool — dual-emit: old phase-block fields + new segments array
const _segmentVisualSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    prompt:           { type: "string" },
    style:            { type: "string", enum: ["infographic", "diagram", "comparison", "process_flow", "annotated_photo"] },
    callouts:         { type: "array", items: { type: "string" } },
    persists_to_next: { type: "boolean" },
  },
  required: ["prompt", "style"],
};

const _segmentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id:          { type: "string" },
    phase:       { type: "string", enum: ["activate", "explain", "demonstrate", "challenge", "connect"] },
    role:        { type: "string", enum: ["narrate", "hook", "demo_step", "callout", "challenge_setup", "challenge_reveal", "transition"] },
    text:        { type: "string" },
    visual:      _segmentVisualSchema,
    gesture:     { type: "string", enum: ["idle", "pointing", "thinking", "explaining"] },
    pause_after: { type: "number" },
  },
  required: ["id", "phase", "role", "text"],
};

// Adaptive phase schemas: all old fields + segment_ids required
const _adaptivePhases = {
  activate: {
    ..._phaseBase.activate,
    properties: { ..._phaseBase.activate.properties, segment_ids: { type: "array", items: { type: "string" } } },
    required:   [..._phaseBase.activate.required, "segment_ids"],
  },
  explain: {
    ..._phaseBase.explain,
    properties: { ..._phaseBase.explain.properties, segment_ids: { type: "array", items: { type: "string" } } },
    required:   [..._phaseBase.explain.required, "segment_ids"],
  },
  demonstrate: {
    ..._phaseBase.demonstrate,
    properties: { ..._phaseBase.demonstrate.properties, segment_ids: { type: "array", items: { type: "string" } } },
    required:   [..._phaseBase.demonstrate.required, "segment_ids"],
  },
  challenge: {
    ..._phaseBase.challenge,
    properties: { ..._phaseBase.challenge.properties, segment_ids: { type: "array", items: { type: "string" } } },
    required:   [..._phaseBase.challenge.required, "segment_ids"],
  },
  connect: {
    ..._phaseBase.connect,
    properties: { ..._phaseBase.connect.properties, segment_ids: { type: "array", items: { type: "string" } } },
    required:   [..._phaseBase.connect.required, "segment_ids"],
  },
} as const;

const lessonToolAdaptive: Anthropic.Tool = {
  name: "deliver_lesson",
  description: "Return a structured 5-phase lesson payload with ordered narration segments.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      segments: {
        type: "array",
        description: "Ordered narration segments for the full lesson.",
        items: _segmentSchema,
      },
      phases: {
        type: "object",
        additionalProperties: false,
        properties: _adaptivePhases,
        required: ["activate", "explain", "demonstrate", "challenge", "connect"],
      },
      metadata: _metadataSchema,
    },
    required: ["segments", "phases", "metadata"],
  },
};

// ─── User message template ─────────────────────────────────────────────────────

function buildUserMessage(
  concept:    ConceptInput,
  profile:    DynamicProfile | null,
  ragContext: string[] = []
): string {
  const p = profile ?? {
    expertise_level:    "beginner",
    explanation_depth:  "moderate",
    pace:               "moderate",
    example_preference: "concrete",
  };

  const prereqs = concept.prerequisites?.length
    ? concept.prerequisites.join(", ")
    : "none yet";

  const objectives = concept.learning_objectives?.length
    ? concept.learning_objectives.join("; ")
    : "Understand this concept";

  const keyTerms = concept.key_terms?.length
    ? concept.key_terms.join(", ")
    : "N/A";

  const misconceptions = concept.common_misconceptions?.length
    ? concept.common_misconceptions.join("; ")
    : "none specified";

  return `<learner_profile>
Expertise level: ${p.expertise_level}
Explanation depth: ${p.explanation_depth}
Pace: ${p.pace}
Example preference: ${p.example_preference}
</learner_profile>

<concept_to_teach>
Name: ${concept.name}
Description: ${concept.description}
Learning objectives: ${objectives}
Key terms: ${keyTerms}
Common misconceptions: ${misconceptions}
Prerequisites (already mastered): ${prereqs}
</concept_to_teach>

<reference_material>
${ragContext.length > 0
  ? ragContext.join("\n\n---\n\n")
  : "No additional reference material available. Use your general knowledge."}
</reference_material>

Teach this concept following the 5-Phase Protocol. Tailor the depth and style to the learner profile above.`;
}

// ─── Structural validation ─────────────────────────────────────────────────────
// Guards against the observed Sonnet-5 failure mode: the model returns a
// tool_use call whose top-level `phases`/`segments` are empty because it
// stuffed the entire lesson payload into `metadata` as a JSON string blob.

const PHASE_KEYS = ["activate", "explain", "demonstrate", "challenge", "connect"] as const;

type ParsedLessonInput = {
  phases?:    Partial<LessonPayload["phases"]>;
  metadata?:  LessonPayload["metadata"];
  segments?:  NarrationSegment[];
};

/** Returns a list of human-readable problems; empty array means the payload is well-formed. */
function validateLessonInput(parsed: ParsedLessonInput, isAdaptive: boolean): string[] {
  const problems: string[] = [];

  if (!parsed.phases || typeof parsed.phases !== "object") {
    problems.push("top-level `phases` object is missing");
  } else {
    for (const key of PHASE_KEYS) {
      const block = parsed.phases[key] as Record<string, unknown> | undefined;
      if (!block || typeof block !== "object" || Object.keys(block).length === 0) {
        problems.push(`phases.${key} is missing or empty`);
      }
    }
  }

  if (isAdaptive) {
    if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) {
      problems.push("top-level `segments` array is missing or empty");
    } else {
      const badIndex = parsed.segments.findIndex(
        (s) => !s || typeof s !== "object" || !s.id || !s.phase || !s.role || !s.text
      );
      if (badIndex !== -1) {
        problems.push(`segments[${badIndex}] is missing a required field (id/phase/role/text)`);
      }
    }
  }

  return problems;
}

// ─── Main generator ────────────────────────────────────────────────────────────

export async function generateLesson(
  concept:    ConceptInput,
  profile:    DynamicProfile | null,
  ragContext: string[] = []
): Promise<LessonPayload> {
  const isAdaptive = process.env.NEXT_PUBLIC_ADAPTIVE_VISUALS === "true";
  const baseUserMessage = buildUserMessage(concept, profile, ragContext);
  const tool = isAdaptive ? lessonToolAdaptive : lessonTool;
  const systemText = isAdaptive ? SYSTEM_PROMPT_ADAPTIVE : SYSTEM_PROMPT;

  const CORRECTIVE_NOTE = `

<correction_notice>
Your previous response was structurally invalid: the lesson fields must be
populated at the top level of the tool input (top-level "phases", each phase
block nonempty, and — when adaptive visuals are on — a nonempty top-level
"segments" array), NOT nested or serialized as a JSON string inside
"metadata" or any other field. Emit every field directly per the tool's
input schema.
</correction_notice>`;

  let lastProblems: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const isRetry = attempt === 1;
    const userMessage = isRetry ? `${baseUserMessage}${CORRECTIVE_NOTE}` : baseUserMessage;

    const response = await client.messages.create(
      {
        model:      MODELS.teaching,
        max_tokens: isAdaptive ? 8192 : 4096,
        system: [
          {
            type:          "text",
            text:          systemText,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools:       [tool],
        tool_choice: { type: "tool", name: "deliver_lesson" },
        messages:    [{ role: "user", content: userMessage }],
      },
      {
        feature:  isRetry ? "teach.lesson.retry" : "teach.lesson",
        metadata: { concept_id: concept.id, adaptive: isAdaptive },
      }
    );

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      lastProblems = ["model did not return a tool_use block"];
      console.warn(`[TeachingAgent] attempt ${attempt + 1}/2 failed: ${lastProblems[0]}`);
      continue;
    }

    const parsed = toolUse.input as ParsedLessonInput;
    const problems = validateLessonInput(parsed, isAdaptive);

    if (problems.length === 0) {
      return {
        concept_id:   concept.id,
        concept_name: concept.name,
        phases:       parsed.phases as LessonPayload["phases"],
        segments:     parsed.segments,
        metadata:     parsed.metadata ?? {
          estimated_read_time_minutes: 8,
          bloom_level_taught:          "understand",
          depth_level:                 "moderate",
          should_generate_model:       false,
        },
      };
    }

    lastProblems = problems;
    console.warn(
      `[TeachingAgent] attempt ${attempt + 1}/2 produced a structurally invalid lesson for concept "${concept.id}": ${problems.join("; ")}`
    );
  }

  throw new Error(
    `TeachingAgent: model returned a structurally invalid lesson payload after retry for concept "${concept.id}": ${lastProblems.join("; ")}`
  );
}

// ─── Explain-more helper (Haiku) ──────────────────────────────────────────────

export async function explainMore(
  phase:       keyof LessonPayload["phases"],
  phaseContent: string,
  conceptName: string,
  profile:     DynamicProfile | null
): Promise<string> {
  const depth = profile?.explanation_depth ?? "moderate";

  const response = await client.messages.create(
    {
      model:      MODELS.fast,
      max_tokens: 512,
      messages: [
        {
          role:    "user",
          content: `You are a tutor. The student wants a deeper explanation of this part of a lesson on "${conceptName}".

Phase: ${phase}
Content: ${phaseContent}

Student's depth preference: ${depth}

Give a deeper, expanded explanation of this specific phase in 2-4 sentences. Be concrete and clear. Do not repeat the original content verbatim — add value.`,
        },
      ],
    },
    { feature: "teach.explain_more", metadata: { phase, conceptName } }
  );

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");
}
