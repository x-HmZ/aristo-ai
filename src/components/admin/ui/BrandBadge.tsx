/**
 * BrandBadge — semantic colored pills for status, bloom level, expertise.
 * Used across tables, cards, and drawers in the admin surface.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const brandBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral:  "bg-white/70 border-white/60 text-aristo-brown/70",
        orange:   "bg-aristo-orange/15 border-aristo-orange/30 text-aristo-orange",
        purple:   "bg-violet-100 border-violet-200 text-violet-700",
        green:    "bg-green-100 border-green-200 text-green-700",
        red:      "bg-red-100 border-red-200 text-red-700",
        amber:    "bg-amber-100 border-amber-200 text-amber-700",
        blue:     "bg-blue-100 border-blue-200 text-blue-700",
        slate:    "bg-slate-100 border-slate-200 text-slate-600",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5",
        md: "text-xs px-2.5 py-0.5",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  }
);

// ─── Semantic color maps (used by the rest of the admin) ──────────────────────

export const BLOOM_COLOR: Record<string, VariantProps<typeof brandBadgeVariants>["variant"]> = {
  remember:   "slate",
  understand: "blue",
  apply:      "green",
  analyze:    "amber",
  evaluate:   "orange",
  create:     "purple",
};

export const EXPERTISE_COLOR: Record<string, VariantProps<typeof brandBadgeVariants>["variant"]> = {
  beginner:     "green",
  intermediate: "orange",
  advanced:     "purple",
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
