/** Display helpers for prices and allowances (pure, tested). */

export type Currency = "EUR" | "USD";

/** 1099 -> "10.99 EUR", 9900 -> "99 EUR", null -> null. Plain format, no locale guessing on the server. */
export function formatPrice(cents: number | null, currency: Currency): string | null {
  if (cents === null) return null;
  const whole = cents % 100 === 0;
  const amount = whole ? String(cents / 100) : (cents / 100).toFixed(2);
  return `${amount} ${currency}`;
}

export const METRIC_LABELS = {
  fresh_lessons: "New lessons",
  chat_turns: "Chat questions",
  replays: "Lesson replays",
  voice_chars: "Chat voice (characters)",
  models_3d: "3D models",
} as const;

export type MeterMetric = keyof typeof METRIC_LABELS;

/** "3 of 15 used" with a clamped percentage for the bar. A limit of 0 reads "Not included". */
export function meterText(used: number, limit: number): { text: string; percent: number } {
  if (limit <= 0) return { text: "Not included in this plan", percent: 0 };
  const percent = Math.min(100, Math.round((used / limit) * 100));
  return { text: `${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} used`, percent };
}

/** One line per limit for a plan card; per-seat plans say so. */
export function limitLines(
  limits: Record<MeterMetric | "learners", number>,
  perSeat: boolean,
): string[] {
  const unit = perSeat ? " per seat" : "";
  const lines: string[] = [];
  if (!perSeat) lines.push(`${limits.learners} learner profile${limits.learners === 1 ? "" : "s"}`);
  lines.push(`${limits.fresh_lessons} new lessons a month${unit}`);
  lines.push(`${limits.replays} lesson replays a month${unit}`);
  lines.push(`${limits.chat_turns} chat questions a month${unit}`);
  if (limits.voice_chars > 0) lines.push(`${limits.voice_chars.toLocaleString("en-US")} characters of chat voice${unit}`);
  lines.push(limits.models_3d > 0 ? `${limits.models_3d} generated 3D models a month${unit}` : "No on-demand 3D models");
  return lines;
}
