import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/Reveal";
import { SHAPE } from "@/components/landing/shape";

const CAPABILITIES = [
  "Spoken narration",
  "Generated visuals",
  "Real 3D models",
  "A quiz on your desk",
  "Reviews that come back",
];

/**
 * No label above this row. It used to carry an "IN EVERY LESSON" eyebrow, but
 * the page only gets three of those and this row explains itself.
 */
export function CapabilityStrip() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
      <Reveal>
        <div
          className={cn(
            SHAPE.surface,
            "flex flex-wrap items-center justify-center gap-x-2 gap-y-2 border border-border/70 bg-white/55 px-5 py-5 xl:flex-nowrap xl:justify-between xl:px-9"
          )}
        >
          {CAPABILITIES.map((capability, index) => (
            <Fragment key={capability}>
              {index > 0 && (
                <span
                  aria-hidden
                  className="hidden h-4 w-px bg-border xl:inline-block"
                />
              )}
              <span
                className={cn(
                  SHAPE.pill,
                  "bg-accent/45 px-3 py-1.5 text-sm font-semibold text-foreground/75 xl:bg-transparent xl:px-0 xl:py-0 xl:text-[14.5px]"
                )}
              >
                {capability}
              </span>
            </Fragment>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
