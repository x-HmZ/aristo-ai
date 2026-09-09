import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/landing/Wordmark";
import { FOCUS, PRESS, SHAPE } from "@/components/landing/shape";

const SECTIONS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#what-it-does", label: "What it does" },
  { href: "#for-parents", label: "For parents" },
];

export function LandingNav() {
  return (
    <nav className="relative z-10 mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between px-5 sm:px-8">
      <Link href="/" aria-label="Aristo home" className={cn("rounded-sm", FOCUS)}>
        <Wordmark className="text-2xl" />
      </Link>

      <div className="flex items-center gap-1 sm:gap-6 lg:gap-8">
        {/* Section links are the first thing to go on a narrow screen: the two
            actions matter more than the table of contents. */}
        <div className="hidden items-center gap-8 md:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className={cn(
                "inline-flex min-h-[44px] items-center rounded-lg text-sm font-medium text-foreground/60 transition-colors hover:text-foreground",
                FOCUS
              )}
            >
              {section.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <Link
            href="/sign-in"
            className={cn(
              SHAPE.control,
              PRESS,
              FOCUS,
              "inline-flex min-h-[44px] items-center px-3 text-sm font-semibold text-foreground/60 hover:text-foreground sm:px-3.5"
            )}
          >
            Sign in
          </Link>
          <Link
            href="/demo"
            className={cn(
              SHAPE.control,
              PRESS,
              FOCUS,
              "inline-flex min-h-[44px] items-center gap-1.5 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-aristo-sm hover:bg-primary/90 hover:shadow-aristo sm:px-[18px]"
            )}
          >
            Try a lesson
            <ArrowRight className="size-[15px]" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
