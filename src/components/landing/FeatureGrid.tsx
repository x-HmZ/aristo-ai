import {
  AudioLines,
  Box,
  CalendarClock,
  ChartLine,
  Network,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { SectionHeading } from "@/components/landing/SectionHeading";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: Waypoints,
    title: "Adapts, without labelling you",
    body: "No “visual learner” box to be filed into. Aristo watches how you actually answer — pace, depth, how many examples you need — and rewrites the next lesson around it.",
  },
  {
    icon: Box,
    title: "Models made for the lesson",
    body: "Physical topics get a 3D model generated on the spot and placed in the classroom, close enough to walk around.",
  },
  {
    icon: AudioLines,
    title: "Spoken, and listening back",
    body: "Every segment is narrated with the teacher’s mouth moving to the words, and you can answer the challenge out loud instead of typing.",
  },
  {
    icon: Network,
    title: "A map, not a playlist",
    body: "Concepts are linked by what they depend on. Aristo teaches in an order that holds together, and will not start on the hard one first.",
  },
  {
    icon: CalendarClock,
    title: "Reviews timed to your forgetting",
    body: "Each concept comes back on its own schedule, set just before the point you would have lost it. Nothing is revised for the sake of it.",
  },
  {
    icon: ChartLine,
    title: "Progress you can actually read",
    body: "Mastery per concept, every quiz answer, and what is due next — in one dashboard rather than a streak counter.",
  },
];

export function FeatureGrid() {
  return (
    <section
      id="what-it-does"
      className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-16 px-5 pt-20 sm:px-8 lg:pt-28"
    >
      <SectionHeading
        eyebrow="What is under it"
        title="Built like a tutor, not like a search box"
      />

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Reveal key={feature.title} className="h-full" delay={(index % 3) * 0.08}>
              <div className="flex h-full flex-col items-start gap-3 rounded-[22px] border border-border/80 bg-white/65 p-6 shadow-[0_4px_20px_rgba(140,90,45,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-aristo sm:p-7">
                <span className="inline-flex size-11 items-center justify-center rounded-[14px] bg-accent/70">
                  <Icon className="size-[21px] text-primary" />
                </span>
                <h3 className="text-lg font-bold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-[14.5px] leading-relaxed text-foreground/70">
                  {feature.body}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
