import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape"
import { cn } from "@/lib/utils"

// Styled to the design system (V8.2, .claude/docs/brand-system.md): control
// radius, 44px default height (the touch target), press feedback and the
// accent focus ring from src/lib/design/shape.ts. One solid accent per view.
const buttonVariants = cva(
  cn(
    SHAPE.control,
    PRESS,
    FOCUS,
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold duration-fast ease-out-soft disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
  ),
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-ink hover:bg-accent/90",
        destructive: "bg-danger text-accent-ink hover:bg-danger/90",
        outline:
          "border border-line bg-surface text-ink hover:border-muted/50 hover:bg-sunk",
        secondary: "bg-sunk text-ink hover:bg-sunk/70",
        ghost: "text-ink hover:bg-sunk",
        link: "text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
