import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent-text focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-accent text-accent-ink hover:bg-accent-hover",
        secondary:
          "border-transparent bg-sunk text-ink hover:bg-sunk/80",
        destructive:
          "border-transparent bg-danger text-status-ink hover:bg-danger/80",
        outline: "text-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
