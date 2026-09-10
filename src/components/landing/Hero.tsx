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
 */
export function Hero() {
  return (
    <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-start gap-12 px-5 pb-16 pt-6 sm:px-8 lg:flex-row lg:items-center lg:gap-14 lg:pb-24 lg:pt-12">
      <div className="flex w-full flex-col items-start gap-6 lg:w-[480px] lg:shrink-0">
        <span
          className={cn(
            SHAPE.pill,
            "border border-primary/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-aristo-orange-deep shadow-aristo-sm"
          )}
        >
          Built for grades 6 to 8
        </span>

        <h1 className="text-balance text-[40px] font-extrabold leading-[1.04] tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl">
          A teacher who <span className="text-gradient">actually teaches</span>{" "}
          you.
        </h1>

        <p className="max-w-[440px] text-base leading-relaxed text-foreground/70 sm:text-lg lg:text-[19px]">
          Aristo explains your topic out loud in a 3D classroom, draws it as it
          goes, then checks that it stuck.
        </p>

        <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center sm:gap-3.5">
          <Link
            href="/demo"
            className={cn(
              SHAPE.control,
              PRESS,
              FOCUS,
              "inline-flex min-h-[56px] items-center justify-center gap-2.5 bg-primary px-6 text-base font-bold text-primary-foreground shadow-aristo hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-aristo-lg"
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
              "inline-flex min-h-[56px] items-center justify-center border border-border bg-white/70 px-6 text-base font-semibold text-foreground hover:bg-secondary"
            )}
          >
            Create an account
          </Link>
        </div>
      </div>

      {/* The mockup bleeds past the content column on wide screens so the
          classroom reads as big as it can. The bleed only starts at xl and
          grows at 2xl - at lg the gutter is too narrow to give away, and
          `overflow-x-hidden` on the page would clip it flush to the edge. */}
      <div className="relative w-full lg:min-w-0 lg:flex-1 xl:-mr-16 2xl:-mr-[104px]">
        <div
          aria-hidden
          className={cn(
            SHAPE.band,
            "absolute -inset-x-5 -bottom-8 -top-6 bg-gradient-to-br from-aristo-orange-pale/70 to-transparent"
          )}
        />

        <div
          className={cn(
            SHAPE.surface,
            "relative overflow-hidden border border-white/70 bg-aristo-cream/70 shadow-[0_30px_70px_hsl(25_60%_22%/0.18),0_6px_18px_hsl(25_60%_22%/0.07)] backdrop-blur-sm lg:-rotate-[0.7deg]"
          )}
        >
          <div className="flex items-center gap-2.5 border-b border-border/70 bg-white/60 px-4 py-2.5">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
              aristo
            </span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span className="text-[11px] text-muted-foreground/80">
              live lesson
            </span>
          </div>

          <Image
            src="/images/landing/classroom-lesson.webp"
            alt="The Aristo classroom: the 3D teacher points at a labelled cross-section of a volcano generated for the lesson, with the lesson text following along in a panel beside it."
            width={1760}
            height={990}
            sizes="(max-width: 1023px) 100vw, 620px"
            priority
            className="block h-auto w-full"
          />
        </div>

        <div
          className={cn(
            SHAPE.control,
            "absolute bottom-6 left-3 flex items-center gap-2.5 border border-aristo-orange-pale/90 bg-aristo-cream/95 px-3.5 py-2.5 shadow-[0_12px_30px_hsl(25_60%_22%/0.14)] sm:-left-8"
          )}
        >
          <AudioLines className="size-[18px] shrink-0 text-primary" />
          <span className="text-xs font-semibold text-aristo-brown sm:text-[12.5px]">
            Narrating segment 3 of 5
          </span>
        </div>
      </div>
    </section>
  );
}
