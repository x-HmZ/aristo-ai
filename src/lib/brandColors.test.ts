import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_HEX, withAlpha } from "@/lib/brandColors";

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
const tailwindConfig = createRequire(import.meta.url)("../../tailwind.config.js");

// `--aristo-orange: 22.57 94.39% 58.04%; /* #F97B2F  main orange */`
const TOKEN_RE = /^\s*--aristo-([a-z-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%;\s*\/\*\s*#([0-9A-F]{6})\b/gim;

const tokens = [...css.matchAll(TOKEN_RE)].map(([, name, h, s, l, hex]) => ({
  name,
  hsl: [Number(h), Number(s), Number(l)] as const,
  hex: `#${hex.toUpperCase()}`,
}));

/** sRGB channels (0-255, unrounded) for an HSL colour, per CSS Color 4. */
function hslToRgb(h: number, s: number, l: number): number[] {
  const sat = s / 100;
  const lig = l / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = sat * Math.min(lig, 1 - lig);
    return 255 * (lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

const toHex = (rgb: number[]) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase()}`;

describe("--aristo-* tokens in globals.css", () => {
  it("finds a documented hex for every token", () => {
    const declared = css.match(/^\s*--aristo-[a-z-]+:/gm) ?? [];
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.length).toBe(declared.length);
  });

  it.each(tokens)("--aristo-$name renders $hex", ({ hsl, hex }) => {
    const rgb = hslToRgb(...hsl);
    expect(toHex(rgb)).toBe(hex);
    // Clear of the .5 rounding boundary, so no browser can land a unit off.
    for (const c of rgb) expect(Math.abs(c - Math.round(c))).toBeLessThan(0.45);
  });

  it.each(tokens)("--aristo-$name is exposed as the Tailwind colour aristo-$name", ({ name }) => {
    expect(tailwindConfig.theme.extend.colors.aristo[name]).toBe(`hsl(var(--aristo-${name}))`);
  });
});

describe("BRAND_HEX", () => {
  const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

  it.each(Object.entries(BRAND_HEX))("%s equals its --aristo-* token", (key, hex) => {
    const token = tokens.find((t) => t.name === kebab(key));
    expect(token, `no --aristo-${kebab(key)} token`).toBeDefined();
    expect(hex).toBe(token!.hex);
  });

  it("withAlpha formats rgba() for canvas 2D", () => {
    expect(withAlpha(BRAND_HEX.orangeMain, 0.9)).toBe("rgba(249,123,47,0.9)");
  });
});
