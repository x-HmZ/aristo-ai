import Image from "next/image";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/Reveal";
import { SHAPE } from "@/lib/design/shape";

const PHASES = ["Activate", "Explain", "Demonstrate", "Challenge", "Connect"];

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className={cn(
        SHAPE.control,
        "display-wide inline-flex size-9 items-center justify-center border border-tint-line bg-tint text-[15px] font-extrabold text-accent-text"
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
        "shadow-e1 overflow-hidden border border-line"
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
        <h2 className="max-w-[920px] text-balance text-[28px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-4xl lg:text-[44px]">
          Pick It, Hear It, See It, Keep It
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
              "flex flex-col gap-4 border border-line bg-surface p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-9"
            )}
          >
            <div className="flex items-center gap-4 sm:shrink-0">
              <StepNumber n={1} />
              <h3 className="text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl">
                Pick What You Want to Learn
              </h3>
            </div>
            <p className="text-base leading-relaxed text-body sm:border-l sm:border-line sm:pl-8">
              Type any topic, or follow a course Aristo maps out for you. In a
              course, it picks up from what you have already mastered.
            </p>
          </div>
        </Reveal>

        {/* 2 - split, text left. */}
        <Reveal>
          <div
            className={cn(
              SHAPE.surface,
              "grid items-center gap-8 border border-line bg-surface p-6 sm:p-9 lg:grid-cols-2 lg:gap-12 lg:p-12"
            )}
          >
            <div className="flex flex-col items-start gap-3.5">
              <StepNumber n={2} />
              <h3 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
                Your Teacher Explains It Out Loud
              </h3>
              <p className="text-base leading-relaxed text-body">
                Every lesson moves through five phases. The board shows a
                diagram made for that lesson, in step with the words.
              </p>
              <ul className="flex flex-wrap gap-2 pt-1">
                {PHASES.map((phase) => (
                  <li
                    key={phase}
                    className={cn(
                      SHAPE.pill,
                      "border border-line px-3 py-1.5 text-xs font-semibold text-body"
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
              "overflow-hidden border border-tint-line bg-gradient-to-br from-tint to-surface"
            )}
          >
            <div className="flex flex-col gap-4 p-6 sm:p-9 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:p-12 lg:pb-10">
              <div className="flex flex-col items-start gap-3.5 lg:max-w-[440px]">
                <StepNumber n={3} />
                <h3 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
                  You Turn It Over in 3D
                </h3>
              </div>
              <p className="text-base leading-relaxed text-body lg:max-w-[420px]">
                When a topic has a shape, Aristo builds a 3D model and stands
                it in the room. Turn it, zoom in, read its labels.
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
              "grid items-center gap-8 border border-line bg-surface p-6 sm:p-9 lg:grid-cols-2 lg:gap-12 lg:p-12"
            )}
          >
            <Shot
              src="/images/landing/classroom-desk-quiz.webp"
              alt="The classroom camera looks down at the desk, where the quiz card lies flat with four answer options."
              sizes="(max-width: 1023px) 100vw, 504px"
            />
            <div className="flex flex-col items-start gap-3.5 lg:order-first">
              <StepNumber n={4} />
              <h3 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
                You Answer. It Comes Back Later
              </h3>
              <p className="text-base leading-relaxed text-body">
                The quiz lies on your desk. Aristo marks each concept, spots
                the ones you half-know, and brings them back before you would
                forget.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
