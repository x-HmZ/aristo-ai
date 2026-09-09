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
              className="text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <Link
            href="/sign-in"
            className="rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground/60 transition-colors hover:text-foreground sm:px-3.5"
          >
            Sign in
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-aristo-sm transition-all hover:bg-primary/90 hover:shadow-aristo sm:px-[18px]"
          >
            Try a lesson
            <ArrowRight className="size-[15px]" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
