import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/landing/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";

const SECTIONS = [
  { href: "#how", label: "How it works" },
  { href: "#map", label: "The map" },
  { href: "#parents", label: "For parents" },
];

/**
 * Fixed over the page (V8.3): the room goes full bleed under it, so it is a glass bar in the page theme, and its
 * links are `body` (muted fails over a bright room pixel). Try a lesson stays on screen for the whole page.
 */
export function LandingNav() {
  return (
    <div className="fixed inset-x-0 top-0 z-40 border-b border-line bg-bg/[0.9] backdrop-blur-md">
    <nav className="mx-auto flex h-[64px] w-full max-w-6xl items-center justify-between px-5 sm:px-8">
      <Link href="/" aria-label="Aristo home" className={cn("inline-flex min-h-[44px] items-center rounded-sm", FOCUS)}>
        <Wordmark />
      </Link>

      <div className="flex items-center gap-1 sm:gap-6 lg:gap-8">
        {/* Section links are the first thing to go on a narrow screen: the two
            actions matter more than the table of contents. They wait for lg
            since the theme toggle joined the row; at md they left ~11px
            between the wordmark and the first link. */}
        <div className="hidden items-center gap-8 lg:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className={cn(
                "inline-flex min-h-[44px] items-center rounded-lg text-sm font-medium text-body transition-colors hover:text-ink",
                FOCUS
              )}
            >
              {section.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* At 360px the toggle does not fit beside both actions without
              wrapping them, so below sm it moves to the footer. Phones follow
              the OS setting until someone reaches for it there. */}
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href="/sign-in"
            className={cn(
              SHAPE.control,
              PRESS,
              FOCUS,
              "inline-flex min-h-[44px] items-center whitespace-nowrap px-3 text-sm font-semibold text-body hover:text-ink sm:px-3.5"
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
              "inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover sm:px-[18px]"
            )}
          >
            Try a lesson
            <ArrowRight className="size-[15px]" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </nav>
    </div>
  );
}
