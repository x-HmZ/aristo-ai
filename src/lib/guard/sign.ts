/**
 * Server-side HMAC helpers. The secret is derived with HKDF-SHA256 from SUPABASE_SERVICE_ROLE_KEY and a fixed
 * label per purpose, so no new environment variable is needed and a token minted for one purpose can never be
 * replayed for another. Tokens are computed when a response is built and never stored.
 *
 * Rotating the service-role key invalidates every outstanding token: narration then falls back to "live"
 * (metered, uncached) and an old quiz must be fetched again. Neither is harmful.
 */

import { createHmac, hkdfSync, timingSafeEqual } from "crypto";

export type SignLabel = "aristo/narration-token/v1" | "aristo/quiz-answer/v1";

const keys = new Map<string, Buffer>();

function secret(label: SignLabel): Buffer {
  const root = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!root) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  const cacheKey = `${label}\u0000${root}`;
  let k = keys.get(cacheKey);
  if (!k) {
    k = Buffer.from(hkdfSync("sha256", root, Buffer.alloc(0), label, 32));
    keys.set(cacheKey, k);
  }
  return k;
}

/** HMAC-SHA256 hex of `message` under the key for `label`. Throws when the root secret is not configured. */
export function hmacHex(label: SignLabel, message: string): string {
  return createHmac("sha256", secret(label)).update(message, "utf8").digest("hex");
}

/** Timing-safe check of a presented hex signature. False for anything malformed, or when no secret is set. */
export function verifyHmacHex(label: SignLabel, message: string, presented: unknown): boolean {
  if (typeof presented !== "string" || !/^[0-9a-f]{64}$/.test(presented)) return false;
  try {
    const expected = Buffer.from(hmacHex(label, message), "hex");
    const given = Buffer.from(presented, "hex");
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}
