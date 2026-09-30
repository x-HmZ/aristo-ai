import Link from "next/link";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";
import { CLOSE } from "../content";
import { Pinned, show, useStageWriter } from "../Pinned";
import { easeOut, seg } from "../stage/timeline";

/**
 * The close: the room comes back full bleed, then settles into a window again beside the closing line, and the
 * teacher waves goodbye (a fresh mount of the teacher, so the product's greeting plays; timeline.ts). One CTA.
 */
export function Close() {
  const text = useRef<HTMLDivElement>(null);
  const still = useRef<HTMLDivElement>(null);
  useStageWriter((f) => {
    const p = f.progress[6];
    const t = easeOut(seg(p, 0.45, 0.7));
    show(text.current, t, 24 * (1 - t));
    show(still.current, seg(p, 0.0, 0.1));
  }, 6);
  return (
    <Pinned id="start" labelledBy="close-title">
      <div className="mx-auto grid h-full w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-6 px-5 pb-8 pt-[92px] sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:grid-rows-1 lg:items-center lg:gap-14">
        <div data-window="start" className="relative order-2 min-h-[240px] lg:order-1 lg:h-[62svh]">
          <div aria-hidden className="glow-pool pointer-events-none absolute -inset-x-12 -bottom-16 -top-8" />
          <div ref={still} className={cn(SHAPE.surface, "landing-still shadow-e2 absolute inset-0 overflow-hidden border border-line bg-surface")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/landing/v3/close.webp" alt="" loading="lazy" className="h-full w-full object-cover" />
          </div>
        </div>
        <div ref={text} className="landing-beat relative z-10 order-1 flex flex-col items-start gap-5 lg:order-2">
          <h2 id="close-title" className="display-wide text-[30px] font-extrabold leading-none tracking-[-0.02em] sm:text-[40px] lg:text-[48px]">
            {CLOSE.title}
          </h2>
          <p className="max-w-[440px] text-base leading-relaxed text-body sm:text-[17.5px]">{CLOSE.line}</p>
          <Link
            href="/demo"
            className={cn(SHAPE.control, PRESS, FOCUS, "mt-1 inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 bg-accent px-7 text-base font-bold text-accent-ink hover:bg-accent-hover sm:w-auto")}
          >
            Try a lesson
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </Pinned>
  );
}
