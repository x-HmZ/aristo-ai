/**
 * BrandCard — Aristo-flavored wrapper around the shadcn `Card`.
 *
 * Preserves the glassmorphic / cream design language while keeping the
 * registry's primitive untouched. Use this everywhere in the admin
 * surface so the look is centralised.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const brandCardVariants = cva(
  "rounded-2xl border backdrop-blur-xl transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-white/70 border-white/40 shadow-aristo-sm",
        cream:   "bg-aristo-cream/80 border-aristo-beige-dark/60",
        accent:  "bg-aristo-orange-pale/50 border-aristo-orange/30 shadow-aristo-sm",
        success: "bg-green-50/80 border-green-200",
        warning: "bg-amber-50/80 border-amber-200",
        danger:  "bg-red-50/80 border-red-200",
        muted:   "bg-white/40 border-white/40",
      },
      padding: {
        none: "",
        sm:   "p-3",
        md:   "p-5",
        lg:   "p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

export interface BrandCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof brandCardVariants> {}

export const BrandCard = React.forwardRef<HTMLDivElement, BrandCardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(brandCardVariants({ variant, padding }), className)}
      {...props}
    />
  )
);
BrandCard.displayName = "BrandCard";

export { brandCardVariants };
