/**
 * The design system's corner-radius scale (V8.2; born on the landing page in
 * T04b), written down so it stays one system. See .claude/docs/brand-system.md.
 *
 * The first cut of the landing page used twelve different radii, which is
 * what a shape system looks like when nobody decided on one. The rule now:
 *
 *   pill     full        badges, chips, anything capsule-shaped
 *   control  10px        buttons and inputs
 *   surface  16px        cards, panels, media frames
 *   band     20px        full-width feature bands and the closing CTA
 *
 * T04b tightened the values (were 12 / 20 / 28) to suit the wide display
 * type; the roles did not change. Nothing on the system uses a radius
 * outside these four (the classroom's rounded-lg is not on the system yet).
 * If a new element needs one, it belongs to one of these roles; pick the
 * role first.
 */
export const SHAPE = {
  pill: "rounded-full",
  control: "rounded-[10px]",
  surface: "rounded-2xl",
  band: "rounded-[20px]",
} as const;

/**
 * Shared press feedback. Every interactive control on the system uses this so
 * a tap feels physical rather than instantaneous.
 */
export const PRESS =
  "transition-all active:translate-y-px active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:translate-y-0 motion-reduce:active:scale-100";

/** Focus ring in the accent, offset against the page background. */
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
