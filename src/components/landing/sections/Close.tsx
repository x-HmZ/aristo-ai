import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLOSE } from "../content";
import { Spot } from "../Spot";
import { BTN_LG, BTN_PRIMARY, LEDE, WRAP } from "../ui";

/** The close (V8.3b): the closing line in wide caps, one call to action, and Jake beside it, who waves goodbye. */
export function Close() {
  return (
    <section id="start" aria-labelledby="close-title" className="overflow-x-clip py-24">
      <div className={cn(WRAP, "grid items-center gap-10 lg:grid-cols-2 lg:gap-14")}>
        <Spot id="close" alt="Jake waves goodbye" className="order-2 h-[420px] sm:h-[520px] lg:order-1" pool="inset-x-[8%] -bottom-[6%] h-3/5" />
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
