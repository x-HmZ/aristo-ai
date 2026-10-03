import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { registerSpot } from "./stage/host";
import { stillCss, type FramedSpotId } from "./stage/spots";
import { LANDING_TEACHERS, TEACHER_NAME, type LandingTeacher } from "./teacher";

/** A still of the chosen teacher: Jake's at the given path, MJ's in its `mj/` folder (V8.3c). */
export const stillOf = (src: string, t: LandingTeacher): string => (t === "jake" ? src : src.replace(/\/([^/]+)$/, "/mj/$1"));
/** The alt text, with `{teacher}` as the teacher's name. */
export const altOf = (alt: string, t: LandingTeacher): string => alt.replaceAll("{teacher}", TEACHER_NAME[t]);

/**
 * A box Jake presents from (V8.3b). The live canvas moves onto whichever spot is most in view (stage/host.ts); every
 * other spot, and every spot on the lite path and under reduced motion, shows its still: Jake in that section's pose,
 * captured from the same stage, faded out at the bottom the same way. Each still is placed in the box by the same
 * framing the canvas uses (spots.ts stillCss, in container units), so at any box size the poster and the first live
 * frame are the same picture. Overlays (a line card, a control) go in `children` and sit above the canvas (z-20).
 */
// React 18 passes the attribute through only in lowercase (fetchPriority is a React 19 prop).
const HIGH = { fetchpriority: "high" } as Record<string, string>;

export function Spot({
  id, still, start, alt, className, style, pool, priority, under, children,
}: {
  id: FramedSpotId;
  /**
   * Jake in this spot's pose, on a transparent ground (`/images/landing/v3b/<id>.webp`): the section's end. MJ's is
   * the same file in `mj/`; both are rendered and globals.css shows the chosen one (`html[data-teacher]`, set before
   * the first paint), so a hidden lazy one is never fetched.
   */
  still?: string;
  /**
   * The section's first frame (`<id>-start.webp`: him at rest, nothing built yet), shown instead on the live path,
   * so the poster before he is live is exactly what the canvas then starts from. Unset: `still` on every path.
   */
  start?: string;
  /** `{teacher}` stands for the teacher's name. */
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
    <div ref={ref} data-spot={id} className={cn("landing-spot relative [container-type:size]", className)} style={style}>
      <style>{stillCss(id)}</style>
      {pool && <div aria-hidden className={cn("glow-pool pointer-events-none absolute", pool)} />}
      {under}
      {still ? (
        <div className={cn("landing-spot-still landing-fade absolute inset-0 overflow-hidden", start && "landing-still-end")}>
          {LANDING_TEACHERS.map((t) => (
            // Only Jake's (the default) is eager: MJ's is lazy, so it loads only when shown. Placed by container units;
            // next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={t} src={stillOf(still, t)} alt={altOf(alt, t)} className={`landing-still-${id} landing-teacher-${t} absolute max-w-none`} decoding="async" loading={priority && t === "jake" ? undefined : "lazy"} {...(priority && t === "jake" ? HIGH : {})} />
          ))}
        </div>
      ) : (
        <span role="img" aria-label={altOf(alt, "jake")} className="absolute inset-0" />
      )}
      {start && (
        // The live path's poster (globals.css swaps the two by data-mode; a lazy image that is not displayed never loads).
        <div aria-hidden className="landing-spot-still landing-still-start landing-fade absolute inset-0 overflow-hidden">
          {LANDING_TEACHERS.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={t} src={stillOf(start, t)} alt="" className={`landing-still-${id} landing-teacher-${t} absolute max-w-none`} decoding="async" loading="lazy" />
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
