/**
 * Every rate limit of the spend guard, in one table. Each feature has an hourly and a daily window per user;
 * both must pass. The numbers are set so that a normal child's session never meets them and a script or a bug
 * meets them within minutes. They sit BELOW the plan allowances (src/lib/billing) and are not a product feature:
 * they exist so that no signed-in account can spend more than a small, known amount.
 *
 * Rough worst case per user and day if every window is exhausted with the most expensive miss each time is in
 * the comment per row. The USD ceilings (breaker.ts) are the second net under these.
 *
 * Cache hits and replays never go through these: callers consult the guard only on the branch that would start
 * a paid generation.
 */

export interface RateWindow {
  /** Window length in seconds. Fixed windows (see take_rate in migration 023). */
  seconds: number;
  /** Calls allowed per window. */
  limit: number;
}

const HOUR = 3600;
const DAY  = 86400;

export const RATE_LIMITS = {
  // Sonnet, up to 8192 output tokens, two attempts: about $0.09 to $0.18 a miss. A learner works through a few
  // lessons an hour at most; 30 a day is a long school day. Worst case 30 x $0.18 = $5.4/day.
  lesson_generate: [{ seconds: HOUR, limit: 10 }, { seconds: DAY, limit: 30 }],
  // Sonnet, 3000 tokens, about $0.03 a call. One quiz per lesson, plus retakes. 60 x $0.03 = $1.8/day.
  quiz_generate:   [{ seconds: HOUR, limit: 20 }, { seconds: DAY, limit: 60 }],
  // Daily review session: up to 5 Haiku calls per request. A handful of sessions a day is plenty.
  quiz_review:     [{ seconds: HOUR, limit: 6 },  { seconds: DAY, limit: 20 }],
  // Counted only when the answer needs the Haiku evaluator (short answer, code debugging); objective questions
  // are graded locally and are free. Cents at most per call.
  quiz_submit:     [{ seconds: HOUR, limit: 120 }, { seconds: DAY, limit: 500 }],
  // Haiku, 512 tokens, under a cent. A child taps "explain more" a few times per lesson.
  explain_more:    [{ seconds: HOUR, limit: 30 }, { seconds: DAY, limit: 120 }],
  // Haiku, 256 tokens, under a cent. One per challenge question.
  challenge:       [{ seconds: HOUR, limit: 60 }, { seconds: DAY, limit: 200 }],
  // Haiku free chat, 1536 tokens: about a cent. 150 a day is a very chatty child.
  teach:           [{ seconds: HOUR, limit: 40 }, { seconds: DAY, limit: 150 }],
  // Counted per image that is actually generated (cache hits are free), $0.08 each. A lesson has up to 8, so
  // 48 an hour is six fresh lessons' pictures. Worst case 160 x $0.08 = $12.8/day, which the per-user USD
  // ceiling cuts off at $1.
  segment_visuals: [{ seconds: HOUR, limit: 48 }, { seconds: DAY, limit: 160 }],
  // Counted per teaching image actually generated ($0.15, plus FLUX source $0.003); one per lesson that wants a
  // picture or a model. Cache hits are free.
  generate_model:  [{ seconds: HOUR, limit: 15 }, { seconds: DAY, limit: 40 }],
  // Counted per model actually generated. Tripo3D $0.30 single view, about $0.52 multiview. The most expensive
  // call: 15 a day is $7.8 at worst.
  generate_3d:     [{ seconds: HOUR, limit: 6 },  { seconds: DAY, limit: 15 }],
  // Sonnet, 4096 tokens, about $0.04. A family does not build many courses.
  courses_generate: [{ seconds: HOUR, limit: 5 }, { seconds: DAY, limit: 15 }],
  // ElevenLabs. A lesson with prefetch makes about 30 calls, so 200 an hour is about six lessons of narration,
  // the same number the old in-memory throttle allowed. 600 a day is about 20 lessons; characters are bounded
  // by the 4000 per call cap and the plan's voice_chars allowance for live speech.
  tts:             [{ seconds: HOUR, limit: 200 }, { seconds: DAY, limit: 600 }],
  // OpenAI transcription, 2 MB per clip, a few cents an hour of audio. Same hourly number as before.
  stt:             [{ seconds: HOUR, limit: 60 }, { seconds: DAY, limit: 300 }],
} as const satisfies Record<string, readonly RateWindow[]>;

export type GuardFeature = keyof typeof RATE_LIMITS;

/** Default ceilings in USD; the environment variables override them (see breaker.ts). */
export const DEFAULT_DAILY_SPEND_LIMIT_USD      = 5;
export const DEFAULT_USER_DAILY_SPEND_LIMIT_USD = 1;
