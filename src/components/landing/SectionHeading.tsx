import { Reveal } from "@/components/landing/Reveal";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  blurb?: string;
}

export function SectionHeading({ eyebrow, title, blurb }: SectionHeadingProps) {
  return (
    <Reveal>
      <div className="flex flex-col items-start gap-4 text-left lg:items-center lg:text-center">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-aristo-orange-deep sm:text-xs">
          {eyebrow}
        </span>
        <h2 className="max-w-[680px] text-balance text-3xl font-extrabold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-4xl lg:text-[42px] lg:leading-[1.1]">
          {title}
        </h2>
        {blurb && (
          <p className="max-w-[560px] text-base leading-relaxed text-foreground/70 sm:text-[17px]">
            {blurb}
          </p>
        )}
      </div>
    </Reveal>
  );
}
