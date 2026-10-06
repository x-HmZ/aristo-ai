/**
 * BrandBadge — pills for status (status colours) and for Bloom level and
 * expertise (neutral; the word carries them, as in the classroom since V8.4b).
 * Used across tables, cards, and drawers in the admin surface.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const brandBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-none whitespace-nowrap",
  {
    variants: {
      // Status variants carry status; the rest are neutral (V8.6: one accent,
      // no categorical hues on labels; the word carries Bloom and expertise).
      variant: {
        neutral:  "bg-sunk border-line text-body",
        orange:   "bg-tint border-tint-line text-accent-text",
        purple:   "bg-sunk border-line text-ink",
        green:    "bg-success/10 border-success/25 text-success",
        red:      "bg-danger/10 border-danger/25 text-danger",
        amber:    "bg-warning/10 border-warning/25 text-warning",
        blue:     "bg-info/10 border-info/25 text-info",
        slate:    "bg-sunk border-line text-muted",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  }
);

// ─── Colour maps (used by the rest of the admin) ──────────────────────────────

// Bloom levels and expertise are labels, not statuses: neutral, the word says it.
export const BLOOM_COLOR: Record<string, VariantProps<typeof brandBadgeVariants>["variant"]> = {
  remember:   "neutral",
  understand: "neutral",
  apply:      "neutral",
  analyze:    "neutral",
  evaluate:   "neutral",
  create:     "neutral",
};

export const EXPERTISE_COLOR: Record<string, VariantProps<typeof brandBadgeVariants>["variant"]> = {
  beginner:     "neutral",
  intermediate: "neutral",
  advanced:     "neutral",
};

export const STATUS_COLOR: Record<string, VariantProps<typeof brandBadgeVariants>["variant"]> = {
  published:     "green",
  draft:         "amber",
  pending:       "amber",
  approved:      "green",
  rejected:      "red",
  auto_approved: "blue",
  in_progress:   "blue",
  completed:     "green",
  paused:        "slate",
};

export interface BrandBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof brandBadgeVariants> {}

export const BrandBadge = React.forwardRef<HTMLSpanElement, BrandBadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(brandBadgeVariants({ variant, size }), className)}
      {...props}
    />
  )
);
BrandBadge.displayName = "BrandBadge";
