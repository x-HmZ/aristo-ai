import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
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
// React 18 passes the attribute through only in lowercase (fetchPriority is a React 19 prop).
const HIGH = { fetchpriority: "high" } as Record<string, string>;

export function Spot({
  id, still, start, alt, className, style, pool, priority, under, children,
}: {
  id: SpotId;
  /** Jake in this spot's pose, on a transparent ground (`/images/landing/v3b/<id>.webp`): the section's end. */
  still?: string;
  /**
   * The section's first frame (`<id>-start.webp`: him at rest, nothing built yet), shown instead on the live path,
   * so the poster before he is live is exactly what the canvas then starts from. Unset: `still` on every path.
   */
  start?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  /** Above the fold: fetched at high priority (it can measure as the LCP). */
  priority?: boolean;
  /** A thing he presents or points at that must be drawn behind him (under the still and the canvas). */
  under?: ReactNode;
  /** The warm pool of light under him, positioned by the caller. */
  pool?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? registerSpot(id, ref.current) : undefined), [id]);
  return (
    <div ref={ref} data-spot={id} className={cn("landing-spot relative", className)} style={style}>
      {pool && <div aria-hidden className={cn("glow-pool pointer-events-none absolute", pool)} />}
      {under}
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element -- a fixed-size box; next/image adds nothing here
        <img src={still} alt={alt} className={cn("landing-spot-still landing-fade absolute inset-0 h-full w-full object-cover", start && "landing-still-end")} style={{ objectPosition: `${SPOTS[id].fx * 100}% 0` }} decoding="async" loading={priority ? undefined : "lazy"} {...(priority ? HIGH : {})} />
      ) : (
        <span role="img" aria-label={alt} className="absolute inset-0" />
      )}
      {start && (
        // The live path's poster (globals.css swaps the two by data-mode; a lazy image that is not displayed never loads).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={start} alt="" aria-hidden className="landing-spot-still landing-still-start landing-fade absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${SPOTS[id].fx * 100}% 0` }} decoding="async" loading="lazy" />
      )}
      {children}
    </div>
  );
}
