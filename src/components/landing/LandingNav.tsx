import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/landing/Wordmark";

const SECTIONS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#what-it-does", label: "What it does" },
  { href: "#for-parents", label: "For parents" },
];

export function LandingNav() {
  return (
    <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
      <Link href="/" aria-label="Aristo home">
        <Wordmark className="text-2xl" />
      </Link>

      <div className="flex items-center gap-1 sm:gap-6 lg:gap-8">
        {/* Section links are the first thing to go on a narrow screen — the
            two actions matter more than the table of contents. */}
        <div className="hidden items-center gap-8 md:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="inline-flex min-h-[44px] items-center rounded-lg text-sm font-medium text-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {section.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <Link
            href="/sign-in"
            className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-foreground/60 transition-colors hover:text-foreground sm:px-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sign in
          </Link>
          <Link
            href="/demo"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-aristo-sm transition-all hover:bg-primary/90 hover:shadow-aristo sm:px-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Try a lesson
            <ArrowRight className="size-[15px]" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
