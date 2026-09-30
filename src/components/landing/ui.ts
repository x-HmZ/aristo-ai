import { cn } from "@/lib/utils";
import { FOCUS, PRESS, SHAPE } from "@/lib/design/shape";

/**
 * The landing's shared classes (V8.3b): the page column and the buttons, so every section reads as one system. The
 * column is mockup E's `.wrap`: 1180px, a 16px gutter on phones and 32px from md.
 */
export const WRAP = "mx-auto w-full max-w-[1180px] px-4 md:px-8";

const BTN = cn(SHAPE.control, PRESS, FOCUS, "inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap font-semibold");
export const BTN_PRIMARY = cn(BTN, "bg-accent px-[18px] text-[15px] text-accent-ink hover:bg-accent-hover");
export const BTN_OUTLINE = cn(BTN, "border border-line bg-surface px-[18px] text-[15px] text-ink hover:bg-sunk");
export const BTN_GHOST = cn(BTN, "px-3.5 text-[15px] text-body hover:bg-sunk hover:text-ink");
/** The hero's and the close's large calls to action: 52px. */
export const BTN_LG = "min-h-[52px] px-6 text-base font-bold";

/** A section heading: Title Case Geist, 30px on phones and 44px from md. */
export const H2 = "text-balance text-[30px] font-[650] leading-[1.1] tracking-[-0.02em] text-ink md:text-[44px]";
export const LEDE = "max-w-[34rem] text-[17px] leading-relaxed text-body";
/** The "real output" label under anything taken from the heart demo lesson. */
export const REAL = "text-[13px] leading-snug text-muted";
