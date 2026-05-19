/**
 * BrandButton — Aristo-flavored variants over the shadcn Button.
 * Delegates to the registry Button via the asChild-style composition,
 * so we inherit accessibility + focus rings for free.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const brandButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aristo-orange/50 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-aristo-orange text-white hover:bg-aristo-orange/90 shadow-aristo-sm",
        secondary:
          "bg-white/80 border border-white/60 text-aristo-brown hover:bg-white",
        purple:
          "bg-violet-500 text-white hover:bg-violet-600 shadow-sm",
        success:
          "bg-green-500 text-white hover:bg-green-600 shadow-sm",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 shadow-sm",
        ghost:
          "text-aristo-brown/70 hover:text-aristo-brown hover:bg-white/60",
        outline:
          "border border-aristo-orange/40 text-aristo-orange hover:bg-aristo-orange/10",
      },
      size: {
        sm: "text-xs px-3 py-1.5",
        md: "text-sm px-4 py-2",
        lg: "text-base px-5 py-2.5",
        icon: "h-9 w-9 p-0",
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
