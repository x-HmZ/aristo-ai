/**
 * The landing page's corner-radius scale, written down so it stays one system.
 *
 * The first cut of this page used twelve different radii, which is what a
 * shape system looks like when nobody decided on one. The rule now:
 *
 *   pill     full        badges, chips, anything capsule-shaped
 *   control  12px        buttons and inputs
 *   surface  20px        cards, panels, media frames
 *   band     28px        full-width feature bands and the closing CTA
 *
 * Nothing on this page uses a radius outside these four. If a new element
 * needs one, it belongs to one of these roles; pick the role first.
 */
export const SHAPE = {
  pill: "rounded-full",
  control: "rounded-xl",
  surface: "rounded-[20px]",
  band: "rounded-[28px]",
} as const;

/**
 * Shared press feedback. Every interactive control on the page uses this so a
 * tap feels physical rather than instantaneous.
 */
export const PRESS =
  "transition-all active:translate-y-px active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:translate-y-0 motion-reduce:active:scale-100";

/** Focus ring, matching the shadcn button convention already in the repo. */
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
