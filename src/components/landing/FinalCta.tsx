import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";

export function FinalCta() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-primary to-aristo-orange-light px-6 py-12 text-center shadow-aristo-lg sm:px-10 sm:py-16 lg:px-14 lg:py-[68px]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-32 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.30)_0%,rgba(255,255,255,0)_68%)]"
          />
          <div className="relative flex flex-col items-center gap-5">
            <h2 className="max-w-[640px] text-balance text-[32px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl lg:text-[44px]">
              Go and meet your teacher
            </h2>
            <p className="max-w-[480px] text-base leading-relaxed text-white/90 sm:text-[17.5px]">
              One lesson runs about five minutes, right here in the browser. No
              account, nothing to install.
            </p>
            <Link
              href="/demo"
              className="mt-2 inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-7 text-base font-bold text-aristo-orange-deep shadow-[0_10px_26px_rgba(120,58,12,0.24)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary sm:w-auto"
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
