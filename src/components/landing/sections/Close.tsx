import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLOSE } from "../content";
import { Spot } from "../Spot";
import { enterClose } from "../stage/host";
import { BTN_LG, BTN_PRIMARY, LEDE, WRAP } from "../ui";

/**
 * In view: at least half of Jake's box. Out of view: under a quarter of it (at the page's end about two thirds of it
 * stays in view, so it leaves only upwards; scrolled up part way it is still the active spot, with no remount of its own).
 */
const IN_VIEW = 0.5;
const OUT_OF_VIEW = 0.25;

/**
 * The close (V8.3b): the closing line in wide caps, one call to action, and Jake beside it, who waves goodbye each time
 * his box comes into view (half of it, after under a quarter of it was), unless he waved there in the last 8 s (host.ts
 * enterClose; the stage remounts him there and a fresh mount waves).
 */
export function Close() {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const box = section.current?.querySelector("[data-spot=close]");
    if (!box) return;
    let out = true, leftAt = 0;
    const io = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio < OUT_OF_VIEW) { if (!out) leftAt = performance.now() / 1000; out = true; }
      else if (out && e.intersectionRatio >= IN_VIEW) { out = false; enterClose(leftAt); }
    }, { threshold: [0, OUT_OF_VIEW, IN_VIEW] });
    io.observe(box);
    return () => io.disconnect();
  }, []);
  return (
    <section ref={section} id="start" aria-labelledby="close-title" className="overflow-x-clip py-24">
      <div className={cn(WRAP, "grid items-center gap-10 lg:grid-cols-2 lg:gap-14")}>
        <Spot id="close" still="/images/landing/v3b/close.webp" alt="Jake waves goodbye" className="order-2 mx-auto h-[470px] w-full max-w-[600px] sm:h-[600px] lg:order-1 lg:max-w-none" pool="inset-x-[8%] -bottom-[6%] h-3/5" />
        <div className="order-1 flex flex-col items-start gap-5 lg:order-2">
          <h2 id="close-title" className="display-wide text-[30px] font-extrabold leading-none tracking-[-0.02em] sm:text-[40px] lg:text-[48px]">
            {CLOSE.title}
          </h2>
          <p className={LEDE}>{CLOSE.line}</p>
          <Link href="/demo" className={cn(BTN_PRIMARY, BTN_LG, "mt-1 w-full sm:w-auto")}>
            Try a lesson
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </section>
  );
}
