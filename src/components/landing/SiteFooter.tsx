import Link from "next/link";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS } from "@/lib/design/shape";
import { Wordmark } from "@/components/landing/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { JAKE_CREDIT } from "@/components/landing/credit";

const CONTACT_EMAIL = "aitchemmzi@gmail.com";

const PRODUCT_LINKS = [
  { href: "/demo", label: "Try a lesson" },
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
    <span className="text-[13px] font-semibold text-muted">
      {children}
    </span>
  );
}

// 44px tall rows: these are the footer's only targets (V8.3 found them at 20px).
const linkClass = cn(
  "inline-flex min-h-[44px] items-center rounded-sm text-sm text-body transition-colors hover:text-ink",
  FOCUS
);
// Inline links in the credit sentence: exempt from the target size (WCAG 2.5.8), with the focus ring.
const creditLink = cn("underline decoration-dotted underline-offset-2 hover:text-ink rounded-sm", FOCUS);

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-line bg-sunk">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-8 pt-12 sm:px-8 sm:pt-14 lg:grid-cols-[2fr_1fr_1fr] lg:gap-12">
        <div className="flex flex-col items-start gap-3">
          <Link
            href="/"
            aria-label="Aristo home"
            className={cn("inline-flex min-h-[44px] items-center rounded-sm", FOCUS)}
          >
            <Wordmark />
          </Link>
          <p className="max-w-[300px] text-sm leading-relaxed text-muted">
            A 3D AI teacher for grades 6 to 8. Built by one person, in the open.
          </p>
        </div>

        <div className="flex flex-col gap-0.5">
          <ColumnHeading>Product</ColumnHeading>
          {PRODUCT_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          <ColumnHeading>Get in touch</ColumnHeading>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className={cn(linkClass, "inline-flex items-center gap-2 break-all")}
          >
            <Mail className="size-[15px] shrink-0 text-muted" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 border-t border-line px-5 py-6 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
        <div className="flex items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} Aristo</span>
          {/* The nav hides its toggle below sm; this is where it lives there. */}
          <ThemeToggle className="sm:hidden" />
        </div>
        {/* The teacher on this page is a third-party model (CC BY 4.0): the credit sits where he is shown. */}
        <p className="max-w-[640px] leading-snug">
          Teacher model:{" "}
          <a href={JAKE_CREDIT.sourceUrl} target="_blank" rel="noopener noreferrer" className={creditLink}>&ldquo;{JAKE_CREDIT.title}&rdquo;</a>{" "}
          by{" "}
          <a href={JAKE_CREDIT.authorUrl} target="_blank" rel="noopener noreferrer" className={creditLink}>{JAKE_CREDIT.author}</a>,{" "}
          <a href={JAKE_CREDIT.licenseUrl} target="_blank" rel="license noopener noreferrer" className={creditLink}>{JAKE_CREDIT.license}</a>
          {JAKE_CREDIT.modified ? ", modified" : ""}
        </p>
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
