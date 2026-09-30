import Link from "next/link";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { HERO } from "../content";
import { Spot } from "../Spot";
import { BTN_LG, BTN_OUTLINE, BTN_PRIMARY, LEDE, WRAP } from "../ui";

/**
 * The hero (V8.3b): the positioning line on the left, Jake on the right, who waves hello once he is live. The text
 * is not faded in by JS, so the H1 paints first and is the LCP.
 */
export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="overflow-x-clip pb-[72px] pt-[108px] lg:pb-[88px] lg:pt-[112px]">
      <div className={cn(WRAP, "grid items-center gap-10 lg:grid-cols-2 lg:gap-14")}>
        <div>
          <p className="mb-[18px] text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">{HERO.eyebrow}</p>
          <h1
            id="hero-title"
            className="display-wide text-[36px] font-extrabold leading-[0.98] tracking-[-0.02em] sm:text-[56px] lg:text-[48px] xl:text-[56px]"
          >
            {HERO.lines.map((line, i) => (
              <span
                key={line}
                className={cn("landing-rise block whitespace-nowrap", i === 2 && "text-accent-text")}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {line}
              </span>
            ))}
          </h1>
          <p className={cn(LEDE, "mt-6")}>{HERO.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className={cn(BTN_PRIMARY, BTN_LG, "max-[479px]:flex-[1_1_100%]")}>
              <Play className="size-4 fill-current" strokeWidth={0} />
              Try a lesson
            </Link>
            <Link href="/sign-up" className={cn(BTN_OUTLINE, BTN_LG, "max-[479px]:flex-[1_1_100%]")}>
              Create an account
            </Link>
          </div>
        </div>
        <Spot id="hero" alt="Jake, your teacher, waves hello" className="h-[470px] sm:h-[600px]" pool="inset-x-[8%] -bottom-[6%] h-3/5" />
      </div>
    </section>
  );
}
