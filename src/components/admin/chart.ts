/**
 * Admin chart and status colours on the design system (V8.6).
 *
 * Recharts and inline styles take colour strings, not classes; these read the
 * theme's tokens through CSS variables, so axes, grids and status values
 * follow light and dark. SVG presentation attributes resolve `var()`.
 *
 * Categorical data-viz hues (providers, Bloom bars, the expertise split, the
 * misconception heat ramp, the knowledge-graph nodes) are not semantic and
 * keep their literals in the pages that draw them.
 */

const token = (name: string) => `rgb(var(--${name}))`;

export const TONE = {
  ink:     token("ink"),
  body:    token("body"),
  muted:   token("muted"),
  line:    token("line"),
  accent:  token("accent"),
  success: token("success"),
  warning: token("warning"),
  danger:  token("danger"),
  info:    token("info"),
} as const;

/** A score's status colour: success at or above `good`, warning at or above `fair`, else danger. */
export function scoreTone(value: number, good = 70, fair = 50): string {
  return value >= good ? TONE.success : value >= fair ? TONE.warning : TONE.danger;
}

/** Axis tick text: muted, 12px. */
export const AXIS_TICK = { fontSize: 12, fill: TONE.muted } as const;
/** Axis label text (the same as the ticks). */
export const AXIS_LABEL = { fontSize: 12, fill: TONE.muted } as const;
/** Grid lines. */
export const GRID = { stroke: TONE.line, strokeDasharray: "3 3" } as const;
/** Tooltip box and text. */
export const TOOLTIP = {
  contentStyle: {
    background: token("surface"),
    border: `1px solid ${TONE.line}`,
    borderRadius: 10,
    color: TONE.ink,
    fontSize: 12,
  },
  labelStyle: { color: TONE.ink, fontWeight: 600 },
  itemStyle: { color: TONE.body },
  cursor: { fill: token("sunk") },
} as const;
