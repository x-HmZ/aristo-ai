/**
 * Optional Cloudflare Turnstile on sign-up. Completely inert unless BOTH keys are set:
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  (the widget, public)
 *   TURNSTILE_SECRET_KEY            (server-side verification, secret)
 * Without them no script is loaded, no widget is rendered and no request is made.
 * The visitor's IP address is not sent to Cloudflare by this code.
 */

import { z } from "zod";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileEnv {
  siteKey?: string;
  secretKey?: string;
}

export function readTurnstileEnv(env: Record<string, string | undefined> = process.env): TurnstileEnv {
  return {
    siteKey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined,
    secretKey: env.TURNSTILE_SECRET_KEY?.trim() || undefined,
  };
}

export function turnstileEnabled(env: TurnstileEnv = readTurnstileEnv()): boolean {
  return Boolean(env.siteKey && env.secretKey);
}

const VerifyResponse = z.object({ success: z.boolean() });

type FetchLike = (url: string, init: { method: string; body: URLSearchParams }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/**
 * True when the visitor may continue. With Turnstile off this is always true and makes no request. With it on, a
 * missing token, a network failure or a failed check all return false (fail closed).
 */
export async function verifyTurnstile(
  token: string | undefined,
  env: TurnstileEnv = readTurnstileEnv(),
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<boolean> {
  if (!turnstileEnabled(env)) return true;
  if (!token) return false;
  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret: env.secretKey as string, response: token }),
    });
    if (!res.ok) return false;
    const parsed = VerifyResponse.safeParse(await res.json());
    return parsed.success && parsed.data.success;
  } catch {
    return false;
  }
}
