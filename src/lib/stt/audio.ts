/** Shared limits and helpers for server speech-to-text (route and client). */

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
/** Hard stop for a recording, in seconds. */
export const MAX_RECORD_SECONDS = 30;

const EXT_BY_TYPE: Record<string, string> = {
  "audio/webm":  "webm",
  "audio/ogg":   "ogg",
  "audio/mp4":   "mp4",
  "audio/wav":   "wav",
  "audio/x-wav": "wav",
  "audio/wave":  "wav",
};

/** File extension for an audio MIME type a MediaRecorder produces (codecs parameter ignored); null if not accepted. */
export function audioExtension(mime: string): string | null {
  const base = mime.split(";")[0].trim().toLowerCase();
  return EXT_BY_TYPE[base] ?? null;
}

/**
 * Duration estimate from size, for the cost row only: assumes about 16 KB per second (128 kbit/s),
 * which over-estimates the usual 32 to 64 kbit/s Opus, so cost errs high rather than low.
 */
export function estimateSeconds(bytes: number): number {
  return Math.max(1, Math.round(bytes / 16_000));
}
