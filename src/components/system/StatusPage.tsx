import Link from "next/link";
import type { ReactNode } from "react";
import { reportProblemHref } from "@/lib/legal/operator";
import { FOCUS } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

const BUTTON =
  "inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-4 text-sm font-semibold transition-colors";

/**
 * A plain full-page status screen (not found, something broke) that always offers a way out: an optional action, the
 * home page, and a report link when a contact address is configured. No hooks and no client-only imports, so the App
 * Router's error files and the Pages Router's 404 and _error can all render it.
 */
export function StatusPage({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  /** e.g. a "Try again" button; rendered first. */
  action?: ReactNode;
}) {
  const report = reportProblemHref();
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 text-ink">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="type-h2 font-bold">{title}</h1>
        <p className="text-sm leading-relaxed text-body">{message}</p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {action}
          <Link href="/" className={cn(BUTTON, "border border-line bg-surface text-ink hover:bg-sunk", FOCUS)}>
            Back to the start
          </Link>
        </div>
        {report && (
          <p className="text-sm text-muted">
            <a href={report} className="underline decoration-dotted underline-offset-2 hover:text-ink">
              Report a problem
            </a>
          </p>
        )}
      </div>
    </main>
  );
}

/** Shared by the error screens' "Try again" button. */
export const RETRY_BUTTON = cn(BUTTON, "bg-accent text-accent-ink hover:bg-accent-hover", FOCUS);
