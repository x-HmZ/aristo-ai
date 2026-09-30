import { forwardRef, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { useStageWriter } from "../Pinned";
import { isEnabled, playing, setEnabled, spokenWords, subscribe } from "../stage/sound";

/** A row of step names; the writer that owns it sets each item's `data-state` (done, now, next). */
export const StepRail = forwardRef<HTMLOListElement, { steps: readonly string[]; className?: string }>(
  function StepRail({ steps, className }, ref) {
    return (
      <ol ref={ref} className={cn("landing-motion-only theme-ink flex flex-wrap items-center gap-1.5", className)} aria-hidden>
        {steps.map((s, i) => (
          <li
            key={s}
            data-state="next"
            className={cn(
              SHAPE.pill,
              "flex items-center gap-1.5 border border-line bg-bg/[0.86] px-2.5 py-1 text-xs font-semibold text-body backdrop-blur-md transition-colors duration-base",
              "data-[state=done]:text-accent-text data-[state=now]:border-accent data-[state=now]:bg-accent data-[state=now]:text-accent-ink"
            )}
          >
            <span className="tabular-nums">{i + 1}</span>
            <span className="hidden sm:inline">{s}</span>
          </li>
        ))}
      </ol>
    );
  }
);

/** "Hear it": the opt-in sound for the whole page. Plays `segment` when turned on. */
export function HearIt({ segment }: { segment: string }) {
  const [on, setOn] = useState(false);
  const [live, setLive] = useState<string | null>(null);
  useEffect(() => subscribe(() => { setOn(isEnabled()); setLive(playing()); }), []);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setEnabled(!on, segment)}
      className={cn(
        SHAPE.control, PRESS, FOCUS,
        "inline-flex min-h-[44px] shrink-0 items-center gap-2 border border-line px-3.5 text-sm font-semibold",
        on ? "bg-accent text-accent-ink hover:bg-accent-hover" : "bg-surface text-ink hover:bg-sunk"
      )}
    >
      {on ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
      {on ? (live ? "Playing" : "Sound on") : "Hear it"}
    </button>
  );
}

/**
 * The caption band (the V8.4a recipe): the spoken line in ink glass, with "Hear it". While the sound plays this
 * line, the words already spoken turn `accent-text`.
 */
export const CaptionBand = forwardRef<HTMLDivElement, { line: string; segment: string; label: string; className?: string }>(
  function CaptionBand({ line, segment, label, className }, ref) {
    const words = line.split(" ");
    const wordEls = useRef<(HTMLSpanElement | null)[]>([]);
    const lit = useRef(-1);
    useStageWriter(() => {
      const n = spokenWords(segment);
      if (n === lit.current) return;
      lit.current = n;
      wordEls.current.forEach((el, i) => { if (el) el.dataset.spoken = n > 0 && i < n ? "1" : "0"; });
    });
    return (
      <div
        ref={ref}
        className={cn(
          SHAPE.surface,
          "theme-ink landing-beat absolute inset-x-5 bottom-14 z-10 mx-auto max-w-[880px] border border-line bg-bg/[0.86] px-5 py-4 shadow-e2 backdrop-blur-md sm:inset-x-8 sm:px-6",
          className
        )}
      >
        <p className="mb-2 text-xs font-semibold text-accent-text">{label}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
          <p className="text-base font-medium leading-snug text-ink sm:text-lg">
            {words.map((w, i) => (
              <span key={i} ref={(el) => { wordEls.current[i] = el; }} className="transition-colors duration-fast data-[spoken=0]:text-ink data-[spoken=1]:text-accent-text">
                {w}{i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          <HearIt segment={segment} />
        </div>
      </div>
    );
  }
);

/**
 * A still of the room for one beat, for the lite path and the stack (captured from the live stage; hidden while the
 * stage runs, so it never loads there). `x` is the object position across: the room stills keep Jake, who stands at
 * about a third of the frame, in view on a portrait phone.
 */
export const Still = forwardRef<HTMLDivElement, { name: string; x?: string; className?: string }>(function Still({ name, x = "32%", className }, ref) {
  return (
    <div ref={ref} className={cn("landing-still landing-beat absolute inset-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/images/landing/v3/${name}.webp`}
        srcSet={`/images/landing/v3/${name}-640.webp 640w, /images/landing/v3/${name}.webp 1280w`}
        sizes="100vw"
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        style={{ objectPosition: `${x} 50%` }}
      />
    </div>
  );
});
