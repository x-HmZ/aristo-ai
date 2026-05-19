/**
 * SRS Review Queue — Phase 6
 *
 * Queries user_concept_mastery for concepts whose srs_next_review is due
 * and whose mastery_score is high enough to warrant spaced repetition.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReviewItem {
  concept_id:              string;
  mastery_score:           number;
  srs_interval_days:       number;
  srs_consecutive_correct: number;
  srs_lapses:              number;
}

/**
 * Returns up to `limit` concepts due for review today, ordered by most overdue first.
 * Only includes concepts with mastery_score >= 0.3 (they've learned something worth reviewing).
 */
export async function getDailyReviewQueue(
  userId:   string,
  supabase: SupabaseClient,
  limit     = 15
): Promise<ReviewItem[]> {
  const { data } = await supabase
    .from("user_concept_mastery")
    .select(
      "concept_id, mastery_score, srs_interval_days, srs_consecutive_correct, srs_lapses"
    )
    .eq("user_id", userId)
    .not("srs_next_review", "is", null)
    .lte("srs_next_review", new Date().toISOString())
    .gte("mastery_score", 0.3)
    .order("srs_next_review", { ascending: true })
    .limit(limit);

  return (data ?? []).map((r) => ({
    concept_id:              r.concept_id,
    mastery_score:           r.mastery_score       ?? 0.3,
    srs_interval_days:       r.srs_interval_days   ?? 1,
    srs_consecutive_correct: r.srs_consecutive_correct ?? 0,
    srs_lapses:              r.srs_lapses          ?? 0,
  }));
}

/**
 * Returns the count of overdue review concepts (without fetching the rows).
 * Used by the "X reviews due" chip and for blending in /api/learn/next.
 */
export async function getOverdueCount(
  userId:   string,
  supabase: SupabaseClient
): Promise<number> {
  const { count } = await supabase
    .from("user_concept_mastery")
    .select("concept_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("srs_next_review", "is", null)
    .lte("srs_next_review", new Date().toISOString())
    .gte("mastery_score", 0.3);

  return count ?? 0;
}
