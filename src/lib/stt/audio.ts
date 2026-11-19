/** Shared limits and helpers for server speech-to-text (route and client). */

/**
 * Transcription is billed by duration and the server cannot read a duration without parsing the container, so
 * the size cap is the duration cap. 512 KB holds 30 seconds at 128 kbit/s (what a recorder produces when it
 * ignores the bitrate hint below) and bounds a deliberately low-bitrate upload to a few minutes.
 */
export const MAX_AUDIO_BYTES = 512 * 1024;
/** Hard stop for a recording, in seconds. */
export const MAX_RECORD_SECONDS = 30;
/** Bitrate the client asks its recorder for: speech is fine at this rate and 30 seconds stay near 120 KB. */
export const RECORD_BITS_PER_SECOND = 32_000;

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
 * Duration estimate from size, for the cost row only: assumes 4 KB per second (32 kbit/s, the rate the client
 * asks for). A recorder that used a higher bitrate made a shorter clip than this says, so the logged cost errs
 * high rather than low.
 */
export function estimateSeconds(bytes: number): number {
  return Math.max(1, Math.round(bytes / 4_000));
}
