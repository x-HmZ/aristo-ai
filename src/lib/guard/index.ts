/**
 * The spend guard for routes that start a paid generation.
 *
 *   const blocked = await guardSpend(user.id, "lesson_generate");
 *   if (blocked) return blocked;
 *
 * Call it AFTER authentication and input validation, and only on the branch that would actually spend: a cache
 * hit, a replay or a free path never goes through it. It returns a ready-made response to send back, or null.
 *
 * Where the cache lookup lives inside a helper (the fal.ai image and 3D helpers), pass `spendHook()` as the
 * helper's `beforeGenerate`: it runs on a miss only and throws `GuardBlocked`, which the route turns into the
 * response with `blockedResponse(err)`.
 *
 * It composes with the plan allowance in src/lib/billing/entitlements.ts and does not replace it: call the guard
 * first, then `spendAllowance`, so that a refusal here never has to give an allowance back.
 */

import type { NextResponse } from "next/server";
import { breakerResponse, checkBreaker } from "./breaker";
import { enforceRate, rateLimitedResponse } from "./rate";
import type { GuardFeature } from "./limits";

export { RATE_LIMITS, type GuardFeature } from "./limits";

export async function guardSpend(userId: string, feature: GuardFeature): Promise<NextResponse | null> {
  // Spend ceilings first (cheap, cached), so a paused day does not even count against the rate windows.
  const spend = await checkBreaker(userId);
  if (!spend.ok) return breakerResponse(spend);
  const decision = await enforceRate(userId, feature);
  return decision.allowed ? null : rateLimitedResponse(decision);
}

/** Thrown by a `spendHook` when the guard refuses; carries the response to send. */
export class GuardBlocked extends Error {
  constructor(readonly response: NextResponse) {
    super("guard_blocked");
    this.name = "GuardBlocked";
  }
}

/** A `beforeGenerate` callback for helpers that look in their cache first. */
export function spendHook(userId: string, feature: GuardFeature): () => Promise<void> {
  return async () => {
    const blocked = await guardSpend(userId, feature);
    if (blocked) throw new GuardBlocked(blocked);
  };
}

/** The response of a refused call if `err` is a guard refusal, otherwise null. */
export function blockedResponse(err: unknown): NextResponse | null {
  return err instanceof GuardBlocked ? err.response : null;
}
