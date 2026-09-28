/**
 * Brand colours as resolved hex strings, for the few places that cannot read
 * a CSS custom property:
 *
 *   - three.js materials and the R3F scene background (THREE.Color parses a
 *     colour string once; it has no idea what `var()` is),
 *   - canvas 2D textures (`ctx.fillStyle` rejects `var()` and silently keeps
 *     the previous style),
 *   - components that derive a tint by appending a hex alpha to an accent
 *     colour (`${accent}18`).
 *
 * Everywhere else, use the Tailwind `aristo-*` classes or
 * `hsl(var(--aristo-*))`. The source of truth is the `--aristo-*` tokens in
 * src/app/globals.css; brandColors.test.ts fails if a value here drifts from
 * the token of the same name, so a palette change edits both and nothing else.
 */
export const BRAND_HEX = {
  /** --aristo-orange */
  orange: "#F97B2F",
  /** --aristo-backdrop: the classroom scene's background. */
  backdrop: "#FDF0E4",
} as const;

export type BrandColor = keyof typeof BRAND_HEX;

/** `rgba()` for a `#RRGGBB` colour, for canvas 2D styles. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
