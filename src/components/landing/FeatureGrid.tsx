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
          ? "border-aristo-orange-pale/80 bg-gradient-to-br from-accent/55 to-aristo-cream"
          : "border-border/70 bg-white/60",
        className
      )}
    >
      <span
        className={cn(
          SHAPE.control,
          "inline-flex size-11 items-center justify-center",
          tinted ? "bg-white/70" : "bg-accent/60"
        )}
      >
        <Icon className="size-[21px] text-primary" />
      </span>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      <p className="text-[14.5px] leading-relaxed text-foreground/70">
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
        <h2 className="max-w-[620px] text-balance text-3xl font-extrabold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-4xl lg:text-[42px] lg:leading-[1.1]">
          Built like a tutor, not like a search box
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
        <Reveal className="h-full sm:col-span-2">
          <Cell icon={Waypoints} title="Adapts, without labelling you" tinted>
            No &ldquo;visual learner&rdquo; box to be filed into. Aristo watches
            how you actually answer, how fast, how deep, how many examples you
            need, and rewrites the next lesson around it.
          </Cell>
        </Reveal>

        <Reveal className="h-full">
          <div
            className={cn(
              SHAPE.surface,
              "flex h-full flex-col overflow-hidden border border-border/70 bg-white/60"
            )}
          >
            <div className="flex flex-col items-start gap-3 p-6 sm:p-7">
              <span
                className={cn(
                  SHAPE.control,
                  "inline-flex size-11 items-center justify-center bg-accent/60"
                )}
              >
                <Box className="size-[21px] text-primary" />
              </span>
              <h3 className="text-lg font-bold text-foreground">
                Models made for the lesson
              </h3>
              <p className="text-[14.5px] leading-relaxed text-foreground/70">
                Topics with a shape get a 3D model generated on the spot and
                placed in the classroom.
              </p>
            </div>
            <div className="mt-auto h-28 overflow-hidden border-t border-border/60 sm:h-32">
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
          <Cell icon={AudioLines} title="Spoken, and listening back">
            Every segment is narrated with the teacher&rsquo;s mouth moving to
            the words, and you can answer the challenge out loud instead of
            typing.
          </Cell>
        </Reveal>

        <Reveal className="h-full sm:col-span-2">
          <Cell icon={Network} title="A map, not a playlist" tinted>
            Concepts are linked by what they depend on. Aristo teaches in an
            order that holds together, and will not start you on the hard one
            first.
          </Cell>
        </Reveal>

        <Reveal className="h-full">
          <Cell icon={CalendarClock} title="Reviews timed to your forgetting">
            Each concept comes back on its own schedule, set just before the
            point you would have lost it.
          </Cell>
        </Reveal>

        <Reveal className="h-full sm:col-span-2">
          <Cell icon={ChartLine} title="Progress you can actually read" tinted>
            Mastery per concept, every quiz answer, and what is due next, in one
            dashboard rather than a streak counter.
          </Cell>
        </Reveal>
      </div>
    </section>
  );
}
