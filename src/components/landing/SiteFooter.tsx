import Link from "next/link";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS } from "@/components/landing/shape";
import { Wordmark } from "@/components/landing/Wordmark";
import { ThemeToggle } from "@/components/landing/ThemeToggle";

const CONTACT_EMAIL = "aitchemmzi@gmail.com";

const PRODUCT_LINKS = [
  { href: "/demo", label: "Live demo" },
  { href: "/sign-in", label: "Sign in" },
  { href: "/sign-up", label: "Create an account" },
];

/**
 * Legal pages do not exist yet. Add entries here once /privacy and /terms are
 * real routes; the row renders nothing while the list is empty rather than
 * shipping links that go nowhere.
 */
const LEGAL_LINKS: { href: string; label: string }[] = [];

/**
 * Column headings are plain small-bold text, not uppercase wide-tracked
 * labels. They used to be the latter, which made them read as two more section
 * eyebrows on a page that only gets three.
 */
function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[13px] font-semibold text-lp-muted">
      {children}
    </span>
  );
}

const linkClass = cn(
  "rounded-sm text-sm text-lp-body transition-colors hover:text-lp-ink",
  FOCUS
);

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-lp-line bg-lp-sunk">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-8 pt-12 sm:px-8 sm:pt-14 lg:grid-cols-[2fr_1fr_1fr] lg:gap-12">
        <div className="flex flex-col items-start gap-3">
          <Link
            href="/"
            aria-label="Aristo home"
            className={cn("rounded-sm", FOCUS)}
          >
            <Wordmark className="text-xl" />
          </Link>
          <p className="max-w-[300px] text-sm leading-relaxed text-lp-muted">
            An immersive AI teacher for middle school. Built by one person, in
            the open.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <ColumnHeading>Product</ColumnHeading>
          {PRODUCT_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          <ColumnHeading>Get in touch</ColumnHeading>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className={cn(linkClass, "inline-flex items-center gap-2 break-all")}
          >
            <Mail className="size-[15px] shrink-0 text-lp-muted" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 border-t border-lp-line px-5 py-6 text-[13px] text-lp-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
        <div className="flex items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} Aristo</span>
          {/* The nav hides its toggle below sm; this is where it lives there. */}
          <ThemeToggle className="sm:hidden" />
        </div>
        {LEGAL_LINKS.length > 0 && (
          <div className="flex items-center gap-4">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
