/**
 * Lesson cache moderation rules.
 *
 * Decides whether a freshly-generated lesson is auto-approved (served
 * immediately) or queued for admin review. Thresholds are explicit
 * constants so they can be tuned in one place.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ModerationDecision {
  status:          "auto_approved" | "pending";
  flagged_reason?: string;
}

const HIGH_MISCONCEPTION_RATE_THRESHOLD = 0.5; // ≥50% of recent attempts triggered a misconception
const MISCONCEPTION_MIN_ATTEMPTS        = 10;  // require enough data
const NEW_CONCEPT_CACHE_THRESHOLD       = 2;   // fewer than N approved cached rows → "new" concept

export async function decideModeration(
  concept_id: string,
  supabase:   SupabaseClient
): Promise<ModerationDecision> {
  try {
    // Rule 1: brand-new concept (very few approved rows in cache)
    const { count: existingApprovedRows } = await supabase
      .from("cached_lessons")
      .select("*", { count: "exact", head: true })
      .eq("concept_id", concept_id)
      .in("moderation_status", ["approved", "auto_approved"]);

    if ((existingApprovedRows ?? 0) < NEW_CONCEPT_CACHE_THRESHOLD) {
      return { status: "auto_approved" };
      // Note: we *don't* hold up brand-new concepts — admins can flag
      // explicitly via the moderation queue later if they want to gate
      // every new piece of content. Switch this branch's status to
      // "pending" if a strict-review workflow is preferred.
    }

    // Rule 2: high misconception rate in recent quiz_attempts
    const { data: recent } = await supabase
      .from("quiz_attempts")
      .select("misconception_detected, is_correct")
      .eq("concept_id", concept_id)
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = recent ?? [];
    if (rows.length >= MISCONCEPTION_MIN_ATTEMPTS) {
      const flagged = rows.filter((r) => r.misconception_detected).length;
      const rate    = flagged / rows.length;
      if (rate >= HIGH_MISCONCEPTION_RATE_THRESHOLD) {
        return {
          status: "pending",
          flagged_reason: `high_misconception_rate (${Math.round(rate * 100)}%)`,
        };
      }
    }

    return { status: "auto_approved" };
  } catch (err) {
    // On any error, fail-open: auto-approve so the learner is never blocked.
    console.error("[moderation-rules] decision error (fail-open)", err);
    return { status: "auto_approved" };
  }
}

/**
 * Stable hash of a DynamicProfile to use as cache key. Includes a version
 * suffix so a future profile-shape change invalidates old rows cleanly.
 */
const SIGNATURE_VERSION = "v1";

interface CacheableProfile {
  expertise_level?:        string | null;
  pace?:                   string | null;
  explanation_depth?:      string | null;
  example_preference?:     string | null;
  weakest_bloom_level?:    string | null;
  strongest_bloom_level?:  string | null;
}

export function profileSignature(p: CacheableProfile | null | undefined): string {
  const parts = [
    p?.expertise_level        ?? "any",
    p?.pace                   ?? "any",
    p?.explanation_depth      ?? "any",
    p?.example_preference     ?? "any",
    p?.weakest_bloom_level    ?? "any",
    p?.strongest_bloom_level  ?? "any",
    SIGNATURE_VERSION,
  ];
  return parts.join("|");
}

export { SIGNATURE_VERSION };
