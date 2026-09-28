/**
 * Brand colours as resolved hex strings, for the places that cannot read a
 * CSS custom property:
 *
 *   - three.js materials and the R3F scene background (THREE.Color parses a
 *     colour string once; it has no idea what `var()` is),
 *   - canvas 2D textures (`ctx.fillStyle` rejects `var()` and silently keeps
 *     the previous style),
 *   - SVG chart props (recharts `fill` / `stroke`) and React Flow, which
 *     take a plain string and pass it on,
 *   - components that derive a tint by appending a hex alpha to an accent
 *     colour (`${accent}18`),
 *   - HTML email, where clients read neither CSS variables nor a stylesheet.
 *
 * Everywhere else, use the Tailwind `aristo-*` classes or
 * `hsl(var(--aristo-*))`. The source of truth is the `--aristo-*` tokens in
 * src/app/globals.css; brandColors.test.ts fails if a value here drifts from
 * the token of the same name, so a palette change edits both and nothing else.
 */
export const BRAND_HEX = {
  /** --aristo-orange-main: the classroom orange. */
  orangeMain: "#F97B2F",
  /** --aristo-orange-hover */
  orangeHover: "#E06A20",
  /** --aristo-orange-ink */
  orangeInk: "#C45A10",
  /** --aristo-wash */
  wash: "#FFF0E4",
  /** --aristo-backdrop: the classroom scene's background. */
  backdrop: "#FDF0E4",
  /** --aristo-brown-main: the classroom brown. */
  brownMain: "#3D2110",
  /** --aristo-brown-muted */
  brownMuted: "#8B6E5A",
  /** --aristo-peach */
  peach: "#FBA962",
  /** --aristo-purple */
  purple: "#8B5CF6",
  /** --aristo-purple-hover */
  purpleHover: "#7C3AED",
  /** --aristo-teal */
  teal: "#10B981",
  /** --aristo-blue */
  blue: "#3B82F6",
  /** --aristo-amber */
  amber: "#F59E0B",
} as const;

export type BrandColor = keyof typeof BRAND_HEX;

/** `rgba()` for a `#RRGGBB` colour, for canvas 2D styles. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
