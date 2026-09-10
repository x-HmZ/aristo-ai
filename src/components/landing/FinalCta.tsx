import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/Reveal";
import { FOCUS, PRESS, SHAPE } from "@/components/landing/shape";

/**
 * T04b: this band used to be a full orange gradient, the single most
 * saturated thing on the page. It is now a surface in the page's own theme
 * with the classroom's warm light rising from its lower edge, so the button
 * is the one solid block of accent in it.
 */
export function FinalCta() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
      <Reveal>
        <div
          className={cn(
            SHAPE.band,
            "relative overflow-hidden border border-lp-tint-line bg-lp-surface px-6 py-12 text-center sm:px-10 sm:py-16 lg:px-14 lg:py-[72px]"
          )}
        >
          <div
            aria-hidden
            className="lp-glow-rise pointer-events-none absolute inset-0"
          />
          <div className="relative flex flex-col items-center gap-5">
            <h2 className="lp-display max-w-[760px] text-balance text-[30px] font-extrabold leading-none tracking-[-0.02em] sm:text-[40px] lg:text-[48px]">
              Go and meet your teacher
            </h2>
            <p className="max-w-[460px] text-base leading-relaxed text-lp-body sm:text-[17.5px]">
              About five minutes, in the browser. No account, no card, nothing
              to install.
            </p>
            <Link
              href="/demo"
              className={cn(
                SHAPE.control,
                PRESS,
                FOCUS,
                "mt-2 inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 bg-lp-accent px-7 text-base font-bold text-lp-accent-ink hover:-translate-y-0.5 hover:bg-lp-accent/90 sm:w-auto"
              )}
            >
              Watch a live lesson
              <ArrowRight className="size-4" strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
