import { Fragment } from "react";
import { Reveal } from "@/components/landing/Reveal";

const CAPABILITIES = [
  "Spoken narration",
  "Generated visuals",
  "Real 3D models",
  "A quiz on your desk",
  "Reviews that come back",
];

export function CapabilityStrip() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
      <Reveal>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-[20px] border border-border/80 bg-white/55 px-5 py-5 xl:flex-nowrap xl:justify-between xl:px-8">
          <span className="w-full text-center text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 xl:w-auto xl:text-left xl:text-xs">
            In every lesson
          </span>
          {CAPABILITIES.map((capability, index) => (
            <Fragment key={capability}>
              {index > 0 && (
                <span
                  aria-hidden
                  className="hidden size-1 rounded-full bg-aristo-beige-dark xl:inline-block"
                />
              )}
              <span className="rounded-full bg-accent/45 px-3 py-1.5 text-sm font-semibold text-foreground/75 xl:bg-transparent xl:px-0 xl:py-0 xl:text-[14.5px]">
                {capability}
              </span>
            </Fragment>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
