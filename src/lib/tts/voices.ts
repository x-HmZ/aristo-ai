/**
 * Which ElevenLabs voice and model each teacher key reads with, chosen by the account's plan.
 *
 * The table is voices.json, shared with scripts/prerender-demo-tts.mjs (plain Node, cannot import
 * TS), which repeats the one-line pick below. ELEVENLABS_PLAN is "paid" or anything else (free):
 * library voices such as Mike are refused through the API on the free plan (402), so a key's
 * "paid" entry is used only when the plan says so, and every key falls back to its "free" entry.
 */
import table from "./voices.json";

export type TtsPlan = "free" | "paid";
export type TtsVoice = { key: string; voice: string; model: string };

type Entry = { voice: string; model: string };
type Row = { free: Entry; paid?: Entry };

const VOICES = table.voices as Record<string, Row>;
const DEFAULT_KEY = table.default;

/** "paid" only when the value is exactly "paid" (trimmed, any case); unset or anything else is free. */
export function parseTtsPlan(raw: unknown): TtsPlan {
  return typeof raw === "string" && raw.trim().toLowerCase() === "paid" ? "paid" : "free";
}

/** The voice for a requested key; unknown or missing keys read with the default voice. */
export function pickVoice(requested: unknown, plan: TtsPlan): TtsVoice {
  const key = typeof requested === "string" && Object.hasOwn(VOICES, requested) ? requested : DEFAULT_KEY;
  const row = VOICES[key];
  const entry = (plan === "paid" && row.paid) || row.free;
  return { key, voice: entry.voice, model: entry.model };
}
