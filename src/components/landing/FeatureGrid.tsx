import Image from "next/image";
import {
  AudioLines,
  Box,
  CalendarClock,
  ChartLine,
  Network,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/Reveal";
import { SHAPE } from "@/components/landing/shape";

/**
 * A bento, not three equal cards.
 *
 * Six features, six cells, three rows of three column-units (2+1, 1+2, 1+2) so
 * nothing is left half-empty and no two rows share a rhythm. Four of the six
 * carry a tint or an image rather than sitting as white-on-white text, which
 * is what makes a grid like this read as designed instead of generated.
 */

function Cell({
  icon: Icon,
  title,
  children,
  className,
  tinted = false,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
  tinted?: boolean;
}) {
  return (
    <div
      className={cn(
        SHAPE.surface,
        "flex h-full flex-col items-start gap-3 border p-6 sm:p-7",
        tinted
          ? "border-lp-tint-line bg-gradient-to-br from-lp-tint to-lp-surface"
          : "border-lp-line bg-lp-surface",
        className
      )}
    >
      <span
        className={cn(
          SHAPE.control,
          "inline-flex size-11 items-center justify-center",
          tinted ? "bg-lp-surface/70" : "border border-lp-line bg-lp-bg"
        )}
      >
        <Icon className="size-[21px] text-lp-accent-text" />
      </span>
      <h3 className="text-lg font-bold text-lp-ink">{title}</h3>
      <p className="text-[14.5px] leading-relaxed text-lp-body">
        {children}
      </p>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <section
      id="what-it-does"
      className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-16 px-5 pt-20 sm:px-8 lg:pt-28"
    >
      <Reveal>
        <h2 className="max-w-[900px] text-balance text-[28px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-4xl lg:text-[44px]">
          Your Tutor Keeps Up With You
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
        <Reveal className="h-full sm:col-span-2">
          <Cell icon={Waypoints} title="Paced by Your Answers" tinted>
            Aristo reads how you answer: how fast, how deep, how many examples
            you need. The next lesson changes its pace, depth and examples to
            match.
          </Cell>
        </Reveal>

        <Reveal className="h-full">
          <div
            className={cn(
              SHAPE.surface,
              "flex h-full flex-col overflow-hidden border border-lp-line bg-lp-surface"
            )}
          >
            <div className="flex flex-col items-start gap-3 p-6 sm:p-7">
              <span
                className={cn(
                  SHAPE.control,
                  "inline-flex size-11 items-center justify-center border border-lp-line bg-lp-bg"
                )}
              >
                <Box className="size-[21px] text-lp-accent-text" />
              </span>
              <h3 className="text-lg font-bold text-lp-ink">
                Models Made for Your Lesson
              </h3>
              <p className="text-[14.5px] leading-relaxed text-lp-body">
                Topics with a shape get a 3D model, generated for the lesson
                and placed in the classroom.
              </p>
            </div>
            <div className="mt-auto h-28 overflow-hidden border-t border-lp-line sm:h-32">
              <Image
                src="/images/landing/classroom-3d-model.webp"
                alt=""
                aria-hidden
                width={1760}
                height={990}
                sizes="(max-width: 1023px) 100vw, 352px"
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>
        </Reveal>

        <Reveal className="h-full">
          <Cell icon={AudioLines} title="Spoken, and Listening">
            Every step is spoken, with the teacher&rsquo;s mouth moving to the
            words. Answer the challenge out loud, or type it.
          </Cell>
        </Reveal>

        <Reveal className="h-full sm:col-span-2">
          <Cell icon={Network} title="A Map of What Leads to What" tinted>
            Concepts are linked by what each one builds on, so Aristo teaches
            them in an order that holds together.
          </Cell>
        </Reveal>

        <Reveal className="h-full">
          <Cell icon={CalendarClock} title="Reviews Timed to Your Memory">
            Each concept comes back on its own schedule, just before the point
            you would lose it.
          </Cell>
        </Reveal>

        <Reveal className="h-full sm:col-span-2">
          <Cell icon={ChartLine} title="Progress You Can Read" tinted>
            Mastery per concept, every quiz answer and what is due next, on one
            dashboard.
          </Cell>
        </Reveal>
      </div>
    </section>
  );
}
