import { AristoMark } from "@/components/brand/AristoMark";
import { cn } from "@/lib/utils";

/**
 * The Aristo wordmark on the landing page, drawn in the page's own tokens: ink
 * for the letters, the accent for the lit middle flute. The same
 * `AristoMark` draws it in /learn and /demo.
 *
 * Height is set here, not by the caller's font size: 14px caps below `sm` so
 * "Sign in" and "Try a lesson" stay on one line at 360px, 18px caps from `sm`.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <AristoMark
      variant="wordmark"
      className={cn("h-[14.5px] text-lp-ink sm:h-[18.6px]", className)}
      litClassName="text-lp-accent"
    />
  );
}
