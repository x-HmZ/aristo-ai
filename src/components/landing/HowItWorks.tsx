import Image from "next/image";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/Reveal";
import { SHAPE } from "@/components/landing/shape";

const PHASES = ["Activate", "Explain", "Demonstrate", "Challenge", "Connect"];

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className={cn(
        SHAPE.control,
        "lp-display inline-flex size-9 items-center justify-center border border-lp-tint-line bg-lp-tint text-[15px] font-extrabold text-lp-accent-text"
      )}
    >
      {n}
    </span>
  );
}

function Shot({
  src,
  alt,
  sizes,
}: {
  src: string;
  alt: string;
  sizes: string;
}) {
  return (
    <div
      className={cn(
        SHAPE.surface,
        "lp-shadow overflow-hidden border border-lp-line"
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={1760}
        height={990}
        sizes={sizes}
        className="block h-auto w-full"
      />
    </div>
  );
}

/**
 * Four steps, four different layout families, on purpose.
 *
 * The first cut of this section was four consecutive text-and-image splits,
 * which reads as one long zigzag and makes every step feel identical in
 * weight. Now: a compact text band, a split, a full-width band that lets the
 * 3D model be big, then a reversed split. No two adjacent steps share a shape,
 * and the section never runs three splits in a row.
 */
export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-16 px-5 pt-20 sm:px-8 lg:pt-28"
    >
      <Reveal>
        <h2 className="lp-display max-w-[920px] text-balance text-[26px] font-extrabold leading-[1.05] tracking-[-0.015em] sm:text-4xl lg:text-[40px]">
          Four steps, and none of them are &ldquo;read this wall of text&rdquo;
        </h2>
      </Reveal>

      <div className="mt-10 flex flex-col gap-6 lg:mt-14 lg:gap-8">
        {/* 1 - compact text band. No visual: this step is one sentence of
            setup, and giving it a screenshot would inflate it to match the
            steps that have something to show. */}
        <Reveal>
          <div
            className={cn(
              SHAPE.surface,
              "flex flex-col gap-4 border border-lp-line bg-lp-surface p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-9"
            )}
          >
            <div className="flex items-center gap-4 sm:shrink-0">
              <StepNumber n={1} />
              <h3 className="text-xl font-bold tracking-[-0.02em] text-lp-ink sm:text-2xl">
                Pick anything you are curious about
              </h3>
            </div>
            <p className="text-base leading-relaxed text-lp-body sm:border-l sm:border-lp-line sm:pl-8">
              Type a topic or follow a course Aristo lays out for you. It works
              out what you already know first, so you are not sat through the
              easy part again.
            </p>
          </div>
        </Reveal>

        {/* 2 - split, text left. */}
        <Reveal>
          <div
            className={cn(
              SHAPE.surface,
              "grid items-center gap-8 border border-lp-line bg-lp-surface p-6 sm:p-9 lg:grid-cols-2 lg:gap-12 lg:p-12"
            )}
          >
            <div className="flex flex-col items-start gap-3.5">
              <StepNumber n={2} />
              <h3 className="text-2xl font-bold tracking-[-0.02em] text-lp-ink sm:text-[27px]">
                Your teacher explains it out loud
              </h3>
              <p className="text-base leading-relaxed text-lp-body">
                Hook it to something you know, explain it, demonstrate it,
                challenge you, connect it forward. Diagrams are generated as the
                lesson goes, so what is on the board is what is being said.
              </p>
              <ul className="flex flex-wrap gap-2 pt-1">
                {PHASES.map((phase) => (
                  <li
                    key={phase}
                    className={cn(
                      SHAPE.pill,
                      "border border-lp-line px-3 py-1.5 text-xs font-semibold text-lp-body"
                    )}
                  >
                    {phase}
                  </li>
                ))}
              </ul>
            </div>
            <Shot
              src="/images/landing/classroom-lesson.webp"
              alt="The teacher points at a labelled cross-section of a volcano generated for this lesson, while the lesson panel highlights the sentence being spoken."
              sizes="(max-width: 1023px) 100vw, 504px"
            />
          </div>
        </Reveal>

        {/* 3 - full-width band. Breaks the split rhythm and gives the model
            the width it needs to read at all. */}
        <Reveal>
          <div
            className={cn(
              SHAPE.band,
              "overflow-hidden border border-lp-tint-line bg-gradient-to-br from-lp-tint to-lp-surface"
            )}
          >
            <div className="flex flex-col gap-4 p-6 sm:p-9 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:p-12 lg:pb-10">
              <div className="flex flex-col items-start gap-3.5 lg:max-w-[440px]">
                <StepNumber n={3} />
                <h3 className="text-2xl font-bold tracking-[-0.02em] text-lp-ink sm:text-[27px]">
                  See the thing itself, not a picture of it
                </h3>
              </div>
              <p className="text-base leading-relaxed text-lp-body lg:max-w-[420px]">
                When a topic has a shape, Aristo builds a 3D model of it and
                stands it in the room. Turn it, zoom in, and read the labels
                where they actually sit.
              </p>
            </div>
            <div className="px-6 pb-6 sm:px-9 sm:pb-9 lg:px-12 lg:pb-12">
              <Shot
                src="/images/landing/classroom-3d-model.webp"
                alt="The generated 3D heart standing in the classroom beside the teacher, with its chambers and the aorta labelled in place."
                sizes="(max-width: 1023px) 100vw, 1056px"
              />
            </div>
          </div>
        </Reveal>

        {/* 4 - split, image left. Non-adjacent to step 2's split. */}
        <Reveal>
          <div
            className={cn(
              SHAPE.surface,
              "grid items-center gap-8 border border-lp-line bg-lp-surface p-6 sm:p-9 lg:grid-cols-2 lg:gap-12 lg:p-12"
            )}
          >
            <Shot
              src="/images/landing/classroom-desk-quiz.webp"
              alt="The classroom camera looks down at the desk, where the quiz card lies flat with four answer options."
              sizes="(max-width: 1023px) 100vw, 504px"
            />
            <div className="flex flex-col items-start gap-3.5 lg:order-first">
              <StepNumber n={4} />
              <h3 className="text-2xl font-bold tracking-[-0.02em] text-lp-ink sm:text-[27px]">
                Answer, and get it brought back later
              </h3>
              <p className="text-base leading-relaxed text-lp-body">
                Look down and the quiz is on your desk. Aristo scores each
                concept separately, notices the ones you half-know, and
                schedules them to come round again just before you would have
                forgotten them.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
