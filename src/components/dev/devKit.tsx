/**
 * The /dev pages' shared UI (V8.7): small tools for tuning the 3D scene, on the
 * design system's tokens so they follow the theme like the rest of the app.
 * They are desktop tools, so controls are compact (36px) rather than the app's
 * 44px touch targets. What is drawn over the lit 3D scene is ink glass
 * (`DEV_OVERLAY`, with `.theme-ink`), like the classroom's own chips.
 */

import * as React from "react";
import { FOCUS, SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

/** A readout or label drawn over the scene: ink glass, in both themes. */
export const DEV_OVERLAY =
  "theme-ink pointer-events-none rounded-[10px] border border-line bg-bg/[0.86] px-2.5 py-1.5 font-mono text-xs text-ink shadow-e1 backdrop-blur-md";

/** The side panel next to the scene. */
export const DEV_PANEL = "overflow-y-auto border-l border-line bg-surface p-4 text-ink";

/** Code and numbers in a panel. */
export const DEV_MONO = "font-mono text-xs leading-normal break-words text-body";

interface DevButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** A toggle: pass its state and it is `aria-pressed`, accent when on. Omit for a plain action. */
  selected?: boolean;
  /** The one main action of a group: accent, with no pressed state. */
  primary?: boolean;
}

/** A compact control: sunk, or accent when it is the chosen one of a set. */
export const DevButton = React.forwardRef<HTMLButtonElement, DevButtonProps>(
  ({ selected, primary, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected === undefined ? undefined : selected}
      className={cn(
        SHAPE.control,
        FOCUS,
        "min-h-9 px-3 py-1 text-xs font-semibold duration-fast",
        selected || primary ? "bg-accent text-accent-ink hover:bg-accent-hover" : "bg-sunk text-body hover:bg-line hover:text-ink",
        className,
      )}
      {...props}
    />
  ),
);
DevButton.displayName = "DevButton";

/** A titled group of controls in a panel. */
export function DevSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-[18px]">
      <h3 className="mb-1.5 text-xs font-semibold text-muted">{title}</h3>
      {children}
    </section>
  );
}
