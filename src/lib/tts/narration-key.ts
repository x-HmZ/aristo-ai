/**
 * Client-safe pieces of the narration token scheme (no Node crypto here, so the browser can import it).
 *
 * The server attaches `narration_tokens: { [narrationKey(text)]: token }` to a lesson it returns; the browser
 * looks a text up by the same key and sends the token with `scope: "lesson"`. The key is only an index (a short
 * non-cryptographic hash); the security is the HMAC token, which /api/tts verifies against the text itself.
 */

/** Trim and collapse every run of whitespace to one space. Also the TTS cache key's normalisation. */
export function normaliseTtsText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** cyrb53: a fast 53-bit string hash, hex. An index into the token map, nothing more. */
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/** The map key for a text: stable across whitespace differences. */
export function narrationKey(text: string): string {
  return cyrb53(normaliseTtsText(text));
}

/** Pick the token for `text` out of a lesson payload's `narration_tokens`, if the payload carries one. */
export function tokenFromLesson(lesson: unknown, text: string): string | undefined {
  const map = (lesson as { narration_tokens?: unknown } | null | undefined)?.narration_tokens;
  if (!map || typeof map !== "object") return undefined;
  const t = (map as Record<string, unknown>)[narrationKey(text)];
  return typeof t === "string" ? t : undefined;
}
