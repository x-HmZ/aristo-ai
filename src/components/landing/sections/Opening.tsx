import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { HERO } from "../content";
import { Pinned, fade, show, useStageWriter } from "../Pinned";
import { easeOut, seg } from "../stage/timeline";
import { Still } from "./parts";
import { shared } from "../stage/shared";

/** The opening poster: the room at the opening pose, captured from the stage (see the V8.3 eval). The LCP. */
export const POSTER = "/images/landing/v3/poster.webp";

/**
 * The opening: the positioning line beside a lit window onto the classroom. The window is where the live stage
 * first shows (LandingRoot clips the fixed canvas to `[data-window="top"]`); scrolling opens it to full bleed and
 * the camera moves through it to the desk. The hero text is not faded in by JS, so it paints with the poster.
 */
export function Opening({ lite }: { lite: boolean }) {
  const text = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLDivElement>(null);

  useStageWriter((f) => {
    const p = f.progress[0];
    const o = easeOut(seg(p, 0, 0.3));
    fade(text.current, 1 - o, -56 * o);
    // The frame's own border and glow go as the window opens; the canvas takes its place.
    show(frame.current, 1 - seg(p, 0.02, 0.2));
    // Lite: no canvas opens the window, so the room still cross-fades in full bleed instead.
    show(room.current, seg(p, 0.12, 0.45));
    // The framed poster gives way to it; on the live path the stage has already replaced the poster (globals.css).
    const ps = poster.current?.style;
    if (ps) {
      // The stack (reduced motion) keeps the poster: it is the opening there.
      const v = shared.live || shared.mode === "stack" ? "" : String(1 - seg(p, 0.3, 0.5));
      if (ps.opacity !== v) ps.opacity = v;
    }
  }, 0);

  return (
    <Pinned id="top" labelledBy="hero-title">
      {/* Lite only, and only once the gate has said so: in the viewport, a lazy image would still load and compete
          with the poster for the first paint. */}
      {lite && <Still ref={room} name="how-1" className="landing-motion-only" />}
      <div className="mx-auto grid h-full w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-6 px-5 pb-6 pt-[92px] sm:px-8 lg:grid-cols-[minmax(0,470px)_minmax(0,1fr)] lg:grid-rows-1 lg:items-center lg:gap-14 lg:pb-10 lg:pt-[96px]">
        <div ref={text} className="landing-beat relative z-10 flex flex-col gap-5 lg:gap-7">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{HERO.eyebrow}</span>
          <h1
            id="hero-title"
            className="display-wide text-[33px] font-extrabold leading-[0.98] tracking-[-0.02em] sm:text-[48px] md:text-[56px] lg:text-[60px] xl:text-[68px]"
          >
            {HERO.lines.map((line, i) => (
              <span
                key={line}
                className={cn("landing-rise block", i === 2 && "text-accent-text")}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {line}
              </span>
            ))}
          </h1>
          <p className="max-w-[440px] text-base leading-relaxed text-body sm:text-lg">{HERO.sub}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className={cn(SHAPE.control, PRESS, FOCUS, "inline-flex min-h-[52px] items-center justify-center gap-2.5 bg-accent px-6 text-base font-bold text-accent-ink hover:bg-accent-hover")}
            >
              <Play className="size-4 fill-current" strokeWidth={0} />
              Try a lesson
            </Link>
            <Link
              href="/sign-up"
              className={cn(SHAPE.control, PRESS, FOCUS, "inline-flex min-h-[52px] items-center justify-center border border-line px-6 text-base font-semibold text-ink hover:bg-surface")}
            >
              Create an account
            </Link>
          </div>
        </div>

        {/* The window. Its box is what the stage's canvas is clipped to before the reader scrolls. */}
        <div data-window="top" className="relative min-h-[240px] lg:h-[64svh]">
          <div ref={frame} aria-hidden className="glow-pool pointer-events-none absolute -inset-x-12 -bottom-16 -top-8" />
          <div ref={poster} className={cn(SHAPE.surface, "landing-poster shadow-e2 absolute inset-0 overflow-hidden border border-line bg-surface")}>
            <Image
              src={POSTER}
              alt="Jake, the Aristo teacher, in the lit 3D classroom in front of the display, turned towards it."
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 640px"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </Pinned>
  );
}
