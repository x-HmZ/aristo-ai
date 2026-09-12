import Link from "next/link";
import Image from "next/image";
import { AudioLines, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/components/landing/shape";

/**
 * Deliberately NOT wrapped in <Reveal>. The classroom screenshot is the LCP
 * candidate, and Reveal's start state is `opacity: 0` - Chrome does not credit
 * a transparent element as painted, so revealing the hero would push LCP out
 * by hydration time plus the transition. The hero is above the fold; there is
 * nothing to reveal on scroll.
 *
 * Four text elements, no more: one label, headline, subtext, CTAs. The
 * reassurance line that used to sit under the buttons now lives in the closing
 * CTA, where it is the only thing competing for attention.
 *
 * Layout (T04b): the headline spans the full content width above the split.
 * Archivo at 125% width needs the room, and it is what holds the headline to
 * two lines at desktop; in a 480px column it ran to three.
 */
export function Hero() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 lg:pb-24 lg:pt-14">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-lp-muted">
        Grades 6 to 8
      </span>

      {/* Sizes are measured against the content width, not guessed: at lg
          (960px) and xl (1088px) the second line "actually teaches you" fits
          at 58 / 64px and wraps at anything much larger. "teaches you" is
          bound so a near-miss drops both words rather than orphaning "you". */}
      <h1 className="lp-display mt-4 text-[34px] font-extrabold leading-none tracking-[-0.02em] sm:text-5xl lg:text-[58px] xl:text-[64px]">
        A teacher who <span className="text-lp-accent-text">actually</span>{" "}
        <span className="whitespace-nowrap">teaches you</span>
      </h1>

      <div className="mt-8 grid gap-12 lg:mt-12 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-16">
        <div className="flex flex-col gap-7 lg:pt-2">
          <p className="max-w-[440px] text-base leading-relaxed text-lp-body sm:text-lg lg:text-[19px]">
            Aristo explains your topic out loud in a 3D classroom, draws it as it
            goes, then checks that it stuck.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href="/demo"
              className={cn(
                SHAPE.control,
                PRESS,
                FOCUS,
                "inline-flex min-h-[56px] items-center justify-center gap-2.5 bg-lp-accent px-6 text-base font-bold text-lp-accent-ink hover:-translate-y-0.5 hover:bg-lp-accent/90"
              )}
            >
              <Play className="size-4 fill-current" strokeWidth={0} />
              Watch a live lesson
            </Link>
            <Link
              href="/sign-up"
              className={cn(
                SHAPE.control,
                PRESS,
                FOCUS,
                "inline-flex min-h-[56px] items-center justify-center border border-lp-line px-6 text-base font-semibold text-lp-ink hover:border-lp-muted/50 hover:bg-lp-surface"
              )}
            >
              Create an account
            </Link>
          </div>
        </div>

        {/* The shot bleeds past the content column on wide screens so the
            classroom reads as big as it can. The bleed only starts at xl and
            grows at 2xl - at lg the gutter is too narrow to give away, and
            `overflow-x-hidden` on the page would clip it flush to the edge. */}
        <div className="relative xl:-mr-16 2xl:-mr-[104px]">
          {/* The classroom is the lit window on this page: its warm light
              spills onto the surface around it. */}
          <div
            aria-hidden
            className="lp-glow-pool pointer-events-none absolute -inset-x-16 -bottom-20 -top-10"
          />

          <div
            className={cn(
              SHAPE.surface,
              "lp-shadow-lg relative overflow-hidden border border-lp-line bg-lp-surface"
            )}
          >
            <div className="flex items-center gap-2.5 border-b border-lp-line px-4 py-2.5">
              <span className="text-[11px] font-semibold tracking-wide text-lp-muted">
                aristo
              </span>
              <span aria-hidden className="h-3 w-px bg-lp-line" />
              <span className="text-[11px] text-lp-muted">live lesson</span>
            </div>

            <Image
              src="/images/landing/classroom-lesson.webp"
              alt="The Aristo classroom: the 3D teacher points at a labelled cross-section of a volcano generated for the lesson, with the lesson text following along in a panel beside it."
              width={1760}
              height={990}
              sizes="(max-width: 1023px) 100vw, 760px"
              priority
              className="block h-auto w-full"
            />
          </div>

          <div
            className={cn(
              SHAPE.control,
              "lp-shadow absolute bottom-6 left-3 flex items-center gap-2.5 border border-lp-line bg-lp-surface px-3.5 py-2.5 sm:-left-7"
            )}
          >
            <AudioLines className="size-[18px] shrink-0 text-lp-accent-text" />
            <span className="text-xs font-semibold text-lp-ink sm:text-[12.5px]">
              Narrating segment 3 of 5
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
