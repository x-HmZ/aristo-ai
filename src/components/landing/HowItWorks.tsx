import Image from "next/image";
import { Sparkles } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { SectionHeading } from "@/components/landing/SectionHeading";

const PHASES = ["Activate", "Explain", "Demonstrate", "Challenge", "Connect"];

function StepNumber({ n }: { n: number }) {
  return (
    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-accent text-[15px] font-extrabold text-aristo-orange-deep">
      {n}
    </span>
  );
}

function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/80 shadow-[0_18px_40px_rgba(94,52,20,0.16)]">
      <Image
        src={src}
        alt={alt}
        width={1760}
        height={990}
        sizes="(max-width: 1023px) 100vw, 504px"
        className="block h-auto w-full"
      />
    </div>
  );
}

/** One alternating row. `flip` puts the visual on the left at lg and up. */
function Step({
  n,
  title,
  children,
  visual,
  flip = false,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <Reveal>
      <div className="grid items-center gap-8 rounded-[28px] border border-border/80 bg-white/60 p-6 shadow-[0_4px_22px_rgba(140,90,45,0.06)] sm:p-9 lg:grid-cols-2 lg:gap-12 lg:p-12">
        <div className={flip ? "lg:order-2" : undefined}>
          <div className="flex flex-col items-start gap-3.5">
            <StepNumber n={n} />
            <h3 className="text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-[27px]">
              {title}
            </h3>
            {children}
          </div>
        </div>
        <div className={flip ? "lg:order-1" : undefined}>{visual}</div>
      </div>
    </Reveal>
  );
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-16 px-5 pt-20 sm:px-8 lg:pt-28"
    >
      <SectionHeading
        eyebrow="How a lesson runs"
        title="Four steps, and none of them are “read this wall of text”"
        blurb="Every lesson follows the same five-phase shape, so the pacing feels familiar even when the subject is new."
      />

      <div className="mt-12 flex flex-col gap-8 lg:mt-16">
        <Step
          n={1}
          title="Pick something you are curious about"
          visual={
            <div className="flex flex-col gap-3 rounded-[20px] border border-primary/20 bg-[#FFF8F2] p-5 sm:p-[22px]">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                Pick a lesson
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 rounded-2xl border border-primary/25 bg-white p-4">
                  <span className="text-[15px] font-bold text-aristo-brown">
                    How volcanoes erupt
                  </span>
                  <span className="text-[12.5px] leading-snug text-muted-foreground">
                    Magma, gas pressure, and the moment a mountain lets go.
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 rounded-2xl border border-border/80 bg-white p-4">
                  <span className="text-[15px] font-bold text-aristo-brown">
                    What is a black hole
                  </span>
                  <span className="text-[12.5px] leading-snug text-muted-foreground">
                    Collapsing stars, extreme gravity, the point of no return.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-primary/35 bg-white px-4 py-3.5">
                <Sparkles className="size-4 shrink-0 text-primary" />
                <span className="text-[13.5px] text-muted-foreground">
                  … or ask for anything else
                </span>
              </div>
            </div>
          }
        >
          <p className="text-base leading-relaxed text-foreground/70">
            Type any topic, or follow a course Aristo lays out for you. Before it
            teaches anything it works out what you already know, so you are not
            sat through the easy part again.
          </p>
        </Step>

        <Step
          n={2}
          flip
          title="Your teacher explains it out loud"
          visual={
            <Shot
              src="/images/landing/classroom-lesson.webp"
              alt="The teacher points at a labelled cross-section of a volcano generated for this lesson, while the lesson panel highlights the sentence being spoken."
            />
          }
        >
          <p className="text-base leading-relaxed text-foreground/70">
            Hook it to something you already know, explain it, demonstrate it,
            challenge you, connect it forward. Diagrams are generated as the
            lesson goes, so the picture on the board is the thing being said
            right now.
          </p>
          <ul className="flex flex-wrap gap-2 pt-0.5">
            {PHASES.map((phase) => (
              <li
                key={phase}
                className="rounded-full bg-accent/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.04em] text-aristo-orange-deep"
              >
                {phase}
              </li>
            ))}
          </ul>
        </Step>

        <Step
          n={3}
          title="See the thing itself, not a picture of it"
          visual={
            <Shot
              src="/images/landing/classroom-3d-model.webp"
              alt="A generated 3D black hole standing in the classroom beside the teacher, with its accretion disk, event horizon and bent light ring labelled in place."
            />
          }
        >
          <p className="text-base leading-relaxed text-foreground/70">
            When a topic has a shape — a volcano, a heart, a black hole — Aristo
            builds a 3D model of it and stands it in the room. Turn it, zoom in,
            and read the labels where they actually sit.
          </p>
        </Step>

        <Step
          n={4}
          flip
          title="Answer — and get it brought back later"
          visual={
            <Shot
              src="/images/landing/classroom-desk-quiz.webp"
              alt="The classroom camera looks down at the desk, where the quiz card lies flat with four answer options."
            />
          }
        >
          <p className="text-base leading-relaxed text-foreground/70">
            Look down and the quiz is on your desk. Aristo scores each concept
            separately, notices the ones you half-know, and schedules them to
            come round again just before you would have forgotten them.
          </p>
        </Step>
      </div>
    </section>
  );
}
