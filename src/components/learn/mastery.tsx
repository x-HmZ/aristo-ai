/**
 * Mastery tiers in the learner UI (V8.6): the course map.
 *
 * Each tier is a word and an icon, never a hue alone (as the lesson phases and
 * Bloom levels since V8.4a/b). One accent: every started tier is `accent-text`,
 * Not started is `muted`. The icon fills up as the tier rises, ending on a solid
 * star so Mastered never reads as Learned at 14px. Thresholds live in
 * `getMasteryTier` (spec §3.5).
 */

import { Circle, CircleCheck, CircleDotDashed, Star, type LucideIcon } from "lucide-react";
import { getMasteryTier, type MasteryTier } from "@/lib/mastery/thresholds";
import { cn } from "@/lib/utils";

export const MASTERY_TIER: Record<MasteryTier, { label: string; Icon: LucideIcon; tone: string; solid?: boolean }> = {
  not_learned: { label: "Not started", Icon: Circle,          tone: "text-muted" },
  in_progress: { label: "In progress", Icon: CircleDotDashed, tone: "text-accent-text" },
  learned:     { label: "Learned",     Icon: CircleCheck,     tone: "text-accent-text" },
  mastered:    { label: "Mastered",    Icon: Star,            tone: "text-accent-text", solid: true },
};

/** The legend's order, lowest tier first. */
export const MASTERY_ORDER: MasteryTier[] = ["not_learned", "in_progress", "learned", "mastered"];

/** A tier's icon, coloured by its tone. Decorative: the word goes with it. */
export function MasteryIcon({ tier, className }: { tier: MasteryTier; className?: string }) {
  const { Icon, tone, solid } = MASTERY_TIER[tier];
  return <Icon aria-hidden className={cn("size-4 shrink-0", tone, solid && "fill-current", className)} />;
}

/** Icon and word for a score, in `text-xs`. The word is `muted`, the icon carries the tone. */
export function MasteryBadge({ score, className }: { score: number; className?: string }) {
  const tier = getMasteryTier(score);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted", className)}>
      <MasteryIcon tier={tier} className="size-3.5" />
      {MASTERY_TIER[tier].label}
    </span>
  );
}
