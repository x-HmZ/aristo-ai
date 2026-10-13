/**
 * Interactive visuals: the types, the JSON schemas the teaching agents hand to
 * Anthropic, and the parsers that turn untrusted model output into those types.
 *
 * Pure module (no React, no three.js, no node APIs) so the lesson agent, the
 * free-mode route, the generator and the client can all import it.
 */

export type InteractiveControlKind = "slider" | "toggle" | "stepper" | "choice";

export interface InteractiveControl {
  /** Exactly what the learner sees on the control, and what the teacher says. */
  label:  string;
  kind:   InteractiveControlKind;
  /** What changing it does to the picture. */
  effect: string;
}

/** What the teaching agent decides: the case for the visual and its controls. */
export interface InteractiveSpec {
  goal:     string;
  brief:    string;
  controls: InteractiveControl[];
  /** 1 to 3 short prompts shown under the widget ("Make the slope negative"). */
  try_this: string[];
}

/** What the generator writes: the three parts of one small page. */
export interface InteractiveParts {
  title:  string;
  markup: string;
  css:    string;
  js:     string;
}

export const CONTROL_KINDS: readonly InteractiveControlKind[] = ["slider", "toggle", "stepper", "choice"];

export const SPEC_LIMITS = {
  goal:      240,
  brief:     900,
  controls:  5,
  label:     40,
  effect:    240,
  tryThis:   3,
  tryLine:   140,
} as const;

export const PARTS_LIMITS = {
  title:  80,
  /** markup + css + js, in characters. */
  total:  40_000,
} as const;

/** JSON schema for `InteractiveSpec`, shared by the lesson tool and /api/teach. */
export const INTERACTIVE_SPEC_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  description:
    "Set ONLY when the topic is understood by changing an input and watching the result. Omit for everything else.",
  properties: {
    goal:  { type: "string", description: "The one thing the learner should see for themselves." },
    brief: {
      type: "string",
      description:
        "What the picture shows and how it responds, concrete enough to build from: axes, ranges, starting values.",
    },
    controls: {
      type: "array" as const,
      description: "1 to 5 controls, in the order the teacher will mention them.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label:  { type: "string", description: "Short visible label, 40 characters or fewer." },
          kind:   { type: "string", enum: ["slider", "toggle", "stepper", "choice"] },
          effect: { type: "string", description: "What changing it does to the picture." },
        },
        required: ["label", "kind", "effect"],
      },
    },
    try_this: {
      type: "array" as const,
      description: "1 to 3 short things to try, each under 140 characters.",
      items: { type: "string" },
    },
  },
  required: ["goal", "brief", "controls", "try_this"],
};

export const INTERACTIVE_PARTS_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    title:  { type: "string", description: "Short title of the widget, 80 characters or fewer." },
    markup: { type: "string", description: "HTML for inside <body>. No script, style, link or iframe elements." },
    css:    { type: "string", description: "CSS for the widget. No @import, no external url()." },
    js:     { type: "string", description: "Vanilla JavaScript. No network, no storage, no eval." },
  },
  required: ["title", "markup", "css", "js"],
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

/** Validate an untrusted spec. Returns null on any violation (never throws). */
export function parseInteractiveSpec(raw: unknown): InteractiveSpec | null {
  if (!isRecord(raw)) return null;
  const goal  = text(raw.goal,  SPEC_LIMITS.goal);
  const brief = text(raw.brief, SPEC_LIMITS.brief);
  if (!goal || !brief) return null;

  if (!Array.isArray(raw.controls) || raw.controls.length < 1 || raw.controls.length > SPEC_LIMITS.controls) {
    return null;
  }
  const controls: InteractiveControl[] = [];
  for (const c of raw.controls) {
    if (!isRecord(c)) return null;
    const label  = text(c.label,  SPEC_LIMITS.label);
    const effect = text(c.effect, SPEC_LIMITS.effect);
    const kind   = c.kind;
    if (!label || !effect) return null;
    if (typeof kind !== "string" || !(CONTROL_KINDS as readonly string[]).includes(kind)) return null;
    controls.push({ label, kind: kind as InteractiveControlKind, effect });
  }

  if (!Array.isArray(raw.try_this) || raw.try_this.length < 1 || raw.try_this.length > SPEC_LIMITS.tryThis) {
    return null;
  }
  const try_this: string[] = [];
  for (const line of raw.try_this) {
    const t = text(line, SPEC_LIMITS.tryLine);
    if (!t) return null;
    try_this.push(t);
  }

  return { goal, brief, controls, try_this };
}

/** Validate untrusted widget parts for shape and size only; see validate.ts for content. */
export function parseInteractiveParts(raw: unknown): InteractiveParts | null {
  if (!isRecord(raw)) return null;
  const title = text(raw.title, PARTS_LIMITS.title);
  if (!title) return null;
  const { markup, css, js } = raw;
  if (typeof markup !== "string" || typeof css !== "string" || typeof js !== "string") return null;
  if (markup.trim().length === 0 || js.trim().length === 0) return null;
  if (markup.length + css.length + js.length > PARTS_LIMITS.total) return null;
  return { title, markup, css, js };
}

/**
 * Stable, order-independent text for hashing a spec into a cache key. Whitespace
 * and case are folded so a re-worded-by-whitespace spec reuses the same widget.
 */
export function normalizeSpecForKey(conceptId: string, spec: InteractiveSpec): string {
  const fold = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return JSON.stringify({
    c: conceptId,
    g: fold(spec.goal),
    b: fold(spec.brief),
    k: spec.controls.map((c) => [fold(c.label), c.kind, fold(c.effect)]),
  });
}
