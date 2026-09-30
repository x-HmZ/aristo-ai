import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { registerSpot } from "./stage/host";
import { SPOTS, type SpotId } from "./stage/spots";

/**
 * A box Jake presents from (V8.3b). The live canvas moves onto whichever spot is most in view (stage/host.ts); every
 * other spot, and every spot on the lite path and under reduced motion, shows its still: Jake in that section's pose,
 * captured from the same stage, faded out at the bottom the same way. A still is captured wider than any box at the
 * same vertical range (spots.ts), so covering the box by height and pinning Jake's x at the spot's `fx` shows exactly
 * what the live canvas would. Overlays (a line card, a control) go in
 * `children` and sit above the canvas (z-20).
 */
export function Spot({
  id, still, alt, className, pool, children,
}: {
  id: SpotId;
  /** Jake in this spot's pose, on a transparent ground (`/images/landing/v3b/<id>.webp`). */
  still?: string;
  alt: string;
  className?: string;
  /** The warm pool of light under him, positioned by the caller. */
  pool?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? registerSpot(id, ref.current) : undefined), [id]);
  return (
    <div ref={ref} data-spot={id} className={cn("landing-spot relative", className)}>
      {pool && <div aria-hidden className={cn("glow-pool pointer-events-none absolute", pool)} />}
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element -- a fixed-size box; next/image adds nothing here
        <img src={still} alt={alt} className="landing-spot-still landing-fade absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${SPOTS[id].fx * 100}% 0` }} decoding="async" />
      ) : (
        <span role="img" aria-label={alt} className="absolute inset-0" />
      )}
      {children}
    </div>
  );
}
