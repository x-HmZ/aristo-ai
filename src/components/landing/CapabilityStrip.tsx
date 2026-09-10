import { Reveal } from "@/components/landing/Reveal";

const CAPABILITIES = [
  "Spoken narration",
  "Generated visuals",
  "Real 3D models",
  "A quiz on your desk",
  "Reviews that come back",
];

/**
 * No label above this row. It used to carry an "IN EVERY LESSON" eyebrow, but
 * the page only gets three of those and this row explains itself.
 *
 * Set between two hairlines rather than in a card (T04b): it is a list of
 * facts, not a surface, and on the dark theme a boxed strip read as a
 * disabled control.
 */
export function CapabilityStrip() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
      <Reveal>
        <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5 border-y border-lp-line py-5 text-sm font-medium text-lp-muted sm:gap-x-10 lg:justify-between lg:gap-x-6 lg:py-6 lg:text-[14.5px]">
          {CAPABILITIES.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
