import Link from "next/link";
import type { ReactNode } from "react";
import { formatVersionDate, LEGAL_LINKS } from "@/lib/legal/documents";

/** Inline link style shared with /credits. */
export const legalLink = "underline decoration-dotted underline-offset-2 hover:text-ink";

/**
 * The shared frame of the legal pages: plain, readable, one column, same tokens as /credits.
 * `inForce` false puts a "draft, not yet in force" notice at the top, naming the settings still missing.
 */
export function LegalPage({
  title,
  version,
  inForce,
  missing,
  intro,
  children,
}: {
  title: string;
  /** ISO date of the document's version; omit for pages without one (the imprint). */
  version?: string;
  inForce: boolean;
  missing: readonly string[];
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg px-4 py-12 text-ink">
      <div className="mx-auto max-w-2xl space-y-8">
        {!inForce && (
          <div role="note" className="rounded-xl border border-line bg-surface p-4 text-sm text-body">
            <p className="font-semibold text-ink">Draft, not yet in force</p>
            <p className="mt-1">
              This page is a draft. It becomes valid only once the operator has published their details and
              reviewed the text. Do not rely on it yet.
            </p>
          </div>
        )}

        <header className="space-y-2">
          <h1 className="type-h2 font-bold">{title}</h1>
          {version && <p className="text-sm text-muted">Version of {formatVersionDate(version)}</p>}
          {intro && <div className="space-y-2 text-sm text-body">{intro}</div>}
        </header>

        {children}

        <nav aria-label="Other legal pages" className="border-t border-line pt-6 text-sm text-muted">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={legalLink}>{l.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/" className={legalLink}>Back to Aristo</Link>
            </li>
          </ul>
        </nav>
      </div>
    </main>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="type-h3 font-bold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-body">{children}</div>
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

/** A definition-style table row set: provider, what it receives, where. Stacks on a phone. */
export function Rows({ rows }: { rows: readonly { term: string; body: ReactNode }[] }) {
  return (
    <dl className="space-y-3">
      {rows.map((r) => (
        <div key={r.term} className="rounded-xl border border-line bg-surface p-4">
          <dt className="font-semibold text-ink">{r.term}</dt>
          <dd className="mt-1">{r.body}</dd>
        </div>
      ))}
    </dl>
  );
}
