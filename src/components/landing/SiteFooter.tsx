import Link from "next/link";
import { Mail } from "lucide-react";
import { Wordmark } from "@/components/landing/Wordmark";

const CONTACT_EMAIL = "aitchemmzi@gmail.com";

const PRODUCT_LINKS = [
  { href: "/demo", label: "Live demo" },
  { href: "/sign-in", label: "Sign in" },
  { href: "/sign-up", label: "Create an account" },
];

/**
 * Legal pages do not exist yet. Add entries here once /privacy and /terms
 * are real routes — the row renders nothing while the list is empty rather
 * than shipping links that go nowhere.
 */
const LEGAL_LINKS: { href: string; label: string }[] = [];

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-aristo-beige-dark/80 bg-aristo-beige/45">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-8 pt-12 sm:px-8 sm:pt-14 lg:grid-cols-[2fr_1fr_1fr] lg:gap-12">
        <div className="flex flex-col items-start gap-3">
          <Link href="/" aria-label="Aristo home">
            <Wordmark className="text-xl" />
          </Link>
          <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">
            An immersive AI teacher for middle school. Built by one person, in
            the open.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
            Product
          </span>
          {PRODUCT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-foreground/70 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
            Get in touch
          </span>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 break-all text-sm text-foreground/70 transition-colors hover:text-foreground"
          >
            <Mail className="size-[15px] shrink-0 text-muted-foreground/70" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 border-t border-aristo-beige-dark/60 px-5 py-6 text-[13px] text-muted-foreground/80 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
        <span>© {new Date().getFullYear()} Aristo</span>
        {LEGAL_LINKS.length > 0 && (
          <div className="flex items-center gap-4">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
