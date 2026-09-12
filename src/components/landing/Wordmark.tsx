import { cn } from "@/lib/utils";

/**
 * The aristo wordmark, matching the one rendered over the 3D scene in
 * LearnClient / DemoClient so the landing page and the product agree.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-1.5", className)}>
      <span className="font-bold tracking-tight text-lp-ink">aristo</span>
      <span aria-hidden className="text-[0.82em] font-bold text-lp-accent">
        ✦
      </span>
    </span>
  );
}
