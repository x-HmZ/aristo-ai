import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLOSE } from "../content";
import { Spot } from "../Spot";
import { enterClose, host } from "../stage/host";
import { shared } from "../stage/shared";
import { BTN_LG, BTN_PRIMARY, LEDE, WRAP } from "../ui";
import { demoHref, getServerTeacher, getTeacher, subscribeTeacher } from "../teacher";

/**
 * In view: at least half of Jake's box. Out of view: under a quarter of it (at the page's end about two thirds of it
 * stays in view, so it leaves only upwards; scrolled up part way it is still the active spot, with no remount of its own).
 */
const IN_VIEW = 0.5;
/** A call to action earns one offer at most this often; he looks at it while the offer plays (as the hero). */
const REACT_EVERY_MS = 3000;
const GESTURE_LOOK_MS = 3000;
const OUT_OF_VIEW = 0.25;

/**
 * The close (V8.3b): the closing line in wide caps, one call to action, and Jake beside it, who waves goodbye each time
 * his box comes into view (half of it, after under a quarter of it was), unless he waved there in the last 8 s (host.ts
 * enterClose; the stage remounts him there and a fresh mount waves). Pointing at or focusing Try a lesson earns the
 * hero's offer: his left palm up towards it, his head and eyes on it.
 */
export function Close() {
  const teacher = useSyncExternalStore(subscribeTeacher, getTeacher, getServerTeacher);
  const section = useRef<HTMLElement>(null);
  const lastReact = useRef(0);
  // Pointing at, or focusing, Try a lesson: his left palm offered towards it, his head and eyes on it (the hero's offer,
  // LandingStage gestureAt). Only while he is live here.
  const hover = (on: boolean) => (e: { currentTarget: HTMLElement }) => {
    if (on) {
      const now = performance.now();
      if (host.live !== "close" || now - lastReact.current < REACT_EVERY_MS) return;
      lastReact.current = now;
      shared.close.look = { el: e.currentTarget, until: now + GESTURE_LOOK_MS };
    }
    shared.close.hover = on ? "try" : null;
  };
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
        <Spot id="close" still="/images/landing/v3b/close.webp" alt="{teacher} waves goodbye" className="order-2 mx-auto h-[470px] w-full max-w-[600px] sm:h-[600px] lg:order-1 lg:max-w-none" pool="inset-x-[8%] -bottom-[6%] h-3/5" />
        <div className="order-1 flex flex-col items-start gap-5 lg:order-2">
          <h2 id="close-title" className="display-wide text-[30px] font-extrabold leading-none tracking-[-0.02em] sm:text-[40px] lg:text-[48px]">
            {CLOSE.title}
          </h2>
          <p className={LEDE}>{CLOSE.line}</p>
          <Link
            href={demoHref(teacher)}
            onPointerEnter={hover(true)} onPointerLeave={hover(false)} onFocus={hover(true)} onBlur={hover(false)}
            className={cn(BTN_PRIMARY, BTN_LG, "mt-1 w-full sm:w-auto")}
          >
            Try a lesson
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </section>
  );
}
