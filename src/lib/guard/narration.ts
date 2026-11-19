/**
 * Narration tokens: proof, minted by the server, that a text came from a lesson the server returned.
 *
 * /api/tts used to believe the browser's `scope: "lesson"`, which decides what is cached in a PUBLIC bucket and
 * what is exempt from the voice_chars allowance. Now `scope: "lesson"` only counts with a valid token over the
 * normalised text; anything else is treated as live (never cached, metered).
 */

import { normaliseTtsText, narrationKey } from "@/lib/tts/narration-key";
import { hmacHex, verifyHmacHex } from "./sign";

const LABEL = "aristo/narration-token/v1" as const;

/** The token for `text`, or null when no signing secret is configured. */
export function narrationToken(text: string): string | null {
  const t = normaliseTtsText(text);
  if (!t) return null;
  try {
    return hmacHex(LABEL, t);
  } catch {
    return null;
  }
}

/** True only for a token this server minted for exactly this (normalised) text. */
export function verifyNarrationToken(text: string, token: unknown): boolean {
  const t = normaliseTtsText(text);
  return t !== "" && verifyHmacHex(LABEL, t, token);
}

type Json = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/**
 * Every string the client may narrate from a lesson payload, exactly as it will pass it to speak():
 * the segment texts, and for the legacy view each phase's spoken text (LessonView's phaseSpeakText, the
 * demonstrate card's narration_pre_visual / visual_walkthrough / example_description, and the model callouts
 * joined with a space).
 */
export function narratableTexts(lesson: Json): string[] {
  const out: Array<string | null> = [];
  const segments = lesson.segments;
  if (Array.isArray(segments)) for (const s of segments) out.push(str((s as Json | null)?.text));

  const phases = (lesson.phases ?? {}) as Record<string, Json | undefined>;
  const activate = phases.activate, explain = phases.explain, demo = phases.demonstrate;
  const challenge = phases.challenge, connect = phases.connect;
  out.push(str(activate?.content));
  const analogy = str(explain?.analogy), insight = str(explain?.key_insight);
  if (analogy && insight) out.push(`${analogy} ${insight}`);
  out.push(analogy, insight);
  out.push(str(demo?.example_description), str(demo?.narration_pre_visual), str(demo?.visual_walkthrough));
  out.push(str(challenge?.question), str(connect?.content));

  const callouts = ((lesson.metadata ?? {}) as Json).model_callouts;
  if (Array.isArray(callouts) && callouts.length > 0) out.push(callouts.join(" "));

  return out.filter((t): t is string => t !== null);
}

/**
 * A copy of the lesson with `narration_tokens: { [narrationKey(text)]: token }` added. Computed per response and
 * never written to the lesson cache: call it on the object you RETURN, after any cache write.
 * Without a signing secret the lesson is returned unchanged (narration is then live).
 */
export function attachNarrationTokens<T extends object>(lesson: T): T & { narration_tokens?: Record<string, string> } {
  const texts = narratableTexts(lesson as Json);
  if (texts.length === 0) return { ...lesson };
  const tokens: Record<string, string> = {};
  for (const text of texts) {
    const token = narrationToken(text);
    if (!token) return { ...lesson };
    tokens[narrationKey(text)] = token;
  }
  return { ...lesson, narration_tokens: tokens };
}
