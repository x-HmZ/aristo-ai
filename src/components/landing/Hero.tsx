import Link from "next/link";
import Image from "next/image";
import { AudioLines, Play, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";

export function Hero() {
  return (
    <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-start gap-12 px-5 pb-16 pt-8 sm:px-8 lg:flex-row lg:items-center lg:gap-14 lg:pb-24 lg:pt-14">
      <Reveal className="w-full lg:w-[486px] lg:shrink-0">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-primary/25 bg-white/70 px-3.5 py-1.5 shadow-aristo-sm">
            <span aria-hidden className="size-[7px] rounded-full bg-primary" />
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-aristo-orange-deep sm:text-xs">
              Early prototype · grades 6–8
            </span>
          </span>

          <h1 className="text-balance text-[40px] font-extrabold leading-[1.04] tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl">
            A teacher who{" "}
            <span className="text-gradient">actually teaches</span> you.
          </h1>

          <p className="max-w-[470px] text-base leading-relaxed text-foreground/70 sm:text-lg lg:text-[19px]">
            Not a chatbot that summarises. Aristo stands at the front of a 3D
            classroom, explains your topic out loud, draws it, builds it in 3D,
            then checks that it stuck.
          </p>

          <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center sm:gap-3.5">
            <Link
              href="/demo"
              className="inline-flex min-h-[56px] items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground shadow-aristo transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-aristo-lg"
            >
              <Play className="size-4 fill-current" strokeWidth={0} />
              Watch a live lesson
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex min-h-[56px] items-center justify-center rounded-2xl border border-border bg-white/70 px-6 text-base font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Create an account
            </Link>
          </div>

          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <ShieldCheck className="size-[15px] shrink-0 text-muted-foreground/70" />
            No account, no card. About five minutes.
          </p>
        </div>
      </Reveal>

      <Reveal className="w-full lg:min-w-0 lg:flex-1" delay={0.12}>
        {/* The mockup bleeds past the content column on wide screens so the
            classroom reads as big as it can. The bleed only starts at xl and
            grows at 2xl — at lg the gutter is too narrow to give away, and
            `overflow-x-hidden` on the page would clip it flush to the edge. */}
        <div className="relative xl:-mr-16 2xl:-mr-[104px]">
          <div
            aria-hidden
            className="absolute -inset-x-5 -bottom-8 -top-6 rounded-[34px] bg-gradient-to-br from-aristo-orange-pale/70 to-transparent"
          />

          <div className="relative overflow-hidden rounded-[22px] border border-white/70 bg-aristo-cream/70 shadow-[0_30px_70px_rgba(94,52,20,0.20),0_6px_18px_rgba(94,52,20,0.08)] backdrop-blur-sm lg:-rotate-[0.7deg]">
            <div className="flex items-center gap-2.5 border-b border-border/80 bg-white/60 px-3.5 py-2.5">
              <div aria-hidden className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#F1BFA0]" />
                <span className="size-2.5 rounded-full bg-[#EDD3B4]" />
                <span className="size-2.5 rounded-full bg-[#E3DDCF]" />
              </div>
              <div className="flex flex-1 justify-center">
                <span className="rounded-full border border-aristo-beige-dark/60 bg-aristo-cream/90 px-3.5 py-1 text-[11px] font-medium text-muted-foreground">
                  aristo — live lesson
                </span>
              </div>
              <span aria-hidden className="w-11" />
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

          <div className="absolute bottom-6 left-3 flex items-center gap-2.5 rounded-2xl border border-aristo-orange-pale/90 bg-aristo-cream/95 px-3.5 py-2.5 shadow-[0_12px_30px_rgba(94,52,20,0.16)] sm:-left-8">
            <AudioLines className="size-[18px] shrink-0 text-primary" />
            <span className="text-xs font-semibold text-aristo-brown sm:text-[12.5px]">
              Narrating segment 3 of 5
            </span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
