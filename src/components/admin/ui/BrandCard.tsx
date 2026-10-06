/**
 * BrandCard — the admin's card, on the design system since V8.6: a surface
 * with a line border, or a status tint. Use this everywhere in the admin
 * surface so the look is centralised.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const brandCardVariants = cva(
  "rounded-2xl border",
  {
    variants: {
      variant: {
        default: "bg-surface border-line",
        cream:   "bg-sunk border-line",
        accent:  "bg-tint border-tint-line",
        success: "bg-success/10 border-success/25",
        warning: "bg-warning/10 border-warning/25",
        danger:  "bg-danger/10 border-danger/25",
        muted:   "bg-bg border-line",
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
