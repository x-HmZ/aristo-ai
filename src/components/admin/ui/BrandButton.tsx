/**
 * BrandButton — the admin's buttons, on the design system since V8.6: the
 * control radius, 44px targets, `PRESS` and `FOCUS`, the one accent for the
 * primary action and status fills for success and destructive.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { FOCUS, PRESS } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

const brandButtonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold duration-fast disabled:opacity-50 disabled:cursor-not-allowed",
    PRESS,
    FOCUS,
  ),
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-ink hover:bg-accent-hover",
        secondary:
          "bg-surface border border-line text-ink hover:bg-sunk hover:border-muted/50",
        // Kept for callers; no second hue: the same as secondary.
        purple:
          "bg-surface border border-line text-ink hover:bg-sunk hover:border-muted/50",
        success:
          "bg-success text-status-ink hover:bg-success/90",
        destructive:
          "bg-danger text-status-ink hover:bg-danger/90",
        ghost:
          "text-body hover:text-ink hover:bg-sunk",
        outline:
          "border border-tint-line text-accent-text hover:bg-tint",
      },
      size: {
        sm: "h-11 min-w-11 text-xs px-3",
        md: "h-11 min-w-11 text-sm px-4",
        lg: "h-12 text-base px-5",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface BrandButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof brandButtonVariants> {}

export const BrandButton = React.forwardRef<HTMLButtonElement, BrandButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(brandButtonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
BrandButton.displayName = "BrandButton";

export { brandButtonVariants };
