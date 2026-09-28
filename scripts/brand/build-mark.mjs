// Builds the Aristo mark (R1 "The Column", decisions.md V8.0) as flat vector
// paths: the ARISTO wordmark in spaced capitals with the column as the I, the
// standalone column at full detail, and the column redrawn on a 16px grid.
//
// The letters are Archivo's own outlines (SIL OFL 1.1, the landing display
// face), instanced at wdth 112 / wght 600 as on the round-two canvas, so the
// mark needs no font at runtime. The column is drawn here from rectangles and
// circles at the letters' stroke weight: abacus, two volutes, echinus, three
// flutes (the middle one lit) and a plinth. At 16px the volutes and echinus
// drop out.
//
//   node scripts/brand/build-mark.mjs [archivo.woff2] [outDir]
//
// With no font argument it takes the Archivo file next/font already downloaded
// into .next/static/media (run `yarn build` once first). It writes
// src/components/brand/markPaths.ts and public/brand/*.svg by default.

import { createRequire } from "node:module";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const fontkit = require(
  resolve("node_modules/next/dist/compiled/@next/font/dist/fontkit/index.js")
).default;

// ---------------------------------------------------------------- settings

export const DEFAULTS = {
  wdth: 112,
  wght: 600,
  tracking: 220, // font units (0.22em at 1000 upm)
  // Column, in font units against Archivo's 686 cap height.
  column: {
    width: 470, // abacus and plinth
    abacus: 96, // about the letters' horizontal stroke (118 to 123)
    volute: 52, // radius
    echinus: 56,
    echinusInset: 92, // each side, from the abacus edge
    neck: 34, // gap between the echinus and the flutes
    flute: 80, // three flutes plus two gaps come to about two stems (141)
    fluteGap: 38,
    baseGap: 34, // gap between the flutes and the base
    torus: 0, // an upper base step; 0 leaves the plinth alone (sub-pixel at nav size otherwise)
    torusInset: 44,
    plinthGap: 14,
    plinth: 96,
    radius: 14,
    side: 60, // side bearing each side of the column
  },
};

export const INK = { dark: "#ECEDEF", light: "#0E1117" };
export const ACCENT = { dark: "#E98A52", light: "#B4521F" };

// ---------------------------------------------------------------- geometry

const r1 = (n) => Math.round(n * 10) / 10;

/** A rectangle as an SVG subpath, y down, with optional rounded corners. */
function rect(x, y, w, h, rad = 0) {
  const r = Math.min(rad, w / 2, h / 2);
  if (r <= 0) return `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`;
  return (
    `M${r1(x + r)} ${r1(y)}h${r1(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}` +
    `v${r1(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${r1(-(w - 2 * r))}` +
    `a${r} ${r} 0 0 1 ${-r} ${-r}v${r1(-(h - 2 * r))}a${r} ${r} 0 0 1 ${r} ${-r}Z`
  );
}

function circle(cx, cy, r) {
  return `M${r1(cx - r)} ${r1(cy)}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0Z`;
}

/**
 * The full column between y = 0 (cap height) and y = H (baseline), x from 0.
 * Returns the ink and the lit flute separately so they can take two colours.
 */
export function columnPaths(c, H) {
  const W = c.width;
  const shaft = 3 * c.flute + 2 * c.fluteGap;
  const sx = (W - shaft) / 2;
  const fluteTop = c.abacus + c.echinus + c.neck;
  const plinthTop = H - c.plinth;
  const torusTop = c.torus ? plinthTop - c.plinthGap - c.torus : plinthTop;
  const fluteBottom = torusTop - c.baseGap;
  const ink = [
    rect(0, 0, W, c.abacus, c.radius),
    circle(c.volute, c.abacus + c.volute * 0.55, c.volute),
    circle(W - c.volute, c.abacus + c.volute * 0.55, c.volute),
    rect(c.echinusInset, c.abacus - 1, W - 2 * c.echinusInset, c.echinus + 1),
    rect(sx, fluteTop, c.flute, fluteBottom - fluteTop, c.radius / 2),
    rect(sx + 2 * (c.flute + c.fluteGap), fluteTop, c.flute, fluteBottom - fluteTop, c.radius / 2),
    c.torus ? rect(c.torusInset, torusTop, W - 2 * c.torusInset, c.torus) : "",
    rect(0, plinthTop, W, c.plinth, c.radius),
  ];
  const lit = rect(sx + c.flute + c.fluteGap, fluteTop, c.flute, fluteBottom - fluteTop, c.radius / 2);
  return { ink: ink.join(""), lit, width: W };
}

/**
 * The column on a 16px grid, every edge on a whole pixel: capital (12x2),
 * three 2px flutes with 1px gaps, base (12x2). The favicon form.
 */
export function columnPaths16() {
  return {
    ink: rect(2, 1, 12, 2) + rect(4, 4, 2, 8) + rect(10, 4, 2, 8) + rect(2, 13, 12, 2),
    lit: rect(7, 4, 2, 8),
    size: 16,
  };
}

// ---------------------------------------------------------------- the font

function findArchivo() {
  const dir = ".next/static/media";
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".woff2")) continue;
    const font = fontkit(readFileSync(join(dir, name)));
    // next/font splits Archivo into unicode-range subsets; only the latin one
    // holds all five letters (the others map "A" but not R, S, T or O).
    const hasLetters = [..."ARSTO"].every((ch) => font.characterSet.includes(ch.codePointAt(0)));
    if (font.familyName.startsWith("Archivo") && font.fvar && hasLetters) {
      return join(dir, name);
    }
  }
  throw new Error("No Archivo in .next/static/media: run `yarn build` or pass the font path");
}

function instance(buf, settings) {
  const font = fontkit(buf);
  // getVariation() drops the cmap on WOFF2 in this fontkit build, so set the
  // coordinates on a fresh instance before any glyph is read.
  font.variationCoords = font.fvar.axis.map((a) => settings[a.axisTag.trim()] ?? a.defaultValue);
  return font;
}

/**
 * A simple glyph's outline at the instance's coordinates. This fontkit build
 * applies HVAR to advances but skips gvar on WOFF2 outlines, so the deltas are
 * applied here to the decoded points and the TrueType contours rebuilt.
 */
function variedOutline(font, glyph) {
  const decoded = glyph._decode();
  if (!decoded || decoded.numberOfContours < 0) throw new Error(`glyph ${glyph.id} is composite`);
  // transformPoints needs fontkit's own Point objects and moves them in place.
  const withPhantoms = [...decoded.points.map((p) => p.copy()), ...glyph._getPhantomPoints(decoded)];
  font._variationProcessor.transformPoints(glyph.id, withPhantoms);
  const points = withPhantoms
    .slice(0, decoded.points.length)
    .map((p) => ({ x: p.x, y: p.y, onCurve: p.onCurve, end: p.endContour }));
  const contours = [];
  let current = [];
  for (const p of points) {
    current.push(p);
    if (p.end) {
      contours.push(current);
      current = [];
    }
  }
  return contours;
}

/** TrueType contours as SVG path data, y flipped so the baseline sits at H. */
function outlinePath(contours, dx, H) {
  const X = (x) => r1(x + dx);
  const Y = (y) => r1(H - y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, onCurve: true });
  const out = [];
  for (const contour of contours) {
    // Start on an on-curve point (or the implied one between two off-curve).
    let start = contour.findIndex((p) => p.onCurve);
    const pts = start >= 0 ? [...contour.slice(start), ...contour.slice(0, start)] : contour;
    const first = start >= 0 ? pts[0] : mid(pts[pts.length - 1], pts[0]);
    const rest = start >= 0 ? pts.slice(1) : pts;
    out.push(`M${X(first.x)} ${Y(first.y)}`);
    let control = null;
    for (const p of [...rest, first]) {
      if (p.onCurve) {
        out.push(control ? `Q${X(control.x)} ${Y(control.y)} ${X(p.x)} ${Y(p.y)}` : `L${X(p.x)} ${Y(p.y)}`);
        control = null;
      } else if (control) {
        const m = mid(control, p);
        out.push(`Q${X(control.x)} ${Y(control.y)} ${X(m.x)} ${Y(m.y)}`);
        control = p;
      } else {
        control = p;
      }
    }
    out.push("Z");
  }
  return out.join("");
}

/** Bounds of the outline; control points can only overstate them by a hair. */
function outlineBox(contours) {
  const all = contours.flat();
  return {
    minX: Math.min(...all.map((p) => p.x)),
    maxX: Math.max(...all.map((p) => p.x)),
    minY: Math.min(...all.map((p) => p.y)),
    maxY: Math.max(...all.map((p) => p.y)),
  };
}

/**
 * Lays out A R [column] S T O. Returns path data in a viewBox whose top is the
 * cap height and whose bottom is the baseline, plus the overshoot of S and O.
 */
export function buildWordmark(buf, opts = DEFAULTS) {
  const font = instance(buf, { wdth: opts.wdth, wght: opts.wght });
  const H = font.capHeight;
  const glyphs = Object.fromEntries([..."ARSTO"].map((ch) => [ch, font.glyphsForString(ch)[0]]));
  const col = columnPaths(opts.column, H);

  let pen = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = 0;
  let maxY = H;
  const ink = [];
  let lit = "";

  for (const ch of ["A", "R", "|", "S", "T", "O"]) {
    if (ch === "|") {
      const x = pen + opts.column.side;
      ink.push(translate(col.ink, x));
      lit = translate(col.lit, x);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + col.width);
      pen += col.width + 2 * opts.column.side + opts.tracking;
      continue;
    }
    const g = glyphs[ch];
    const contours = variedOutline(font, g);
    const b = outlineBox(contours);
    ink.push(outlinePath(contours, pen, H));
    minX = Math.min(minX, pen + b.minX);
    maxX = Math.max(maxX, pen + b.maxX);
    minY = Math.min(minY, H - b.maxY);
    maxY = Math.max(maxY, H - b.minY);
    pen += g.advanceWidth + opts.tracking;
  }

  // Trim to the ink so the mark has no built-in side bearing.
  const shift = -minX;
  return {
    ink: translate(ink.join(""), shift),
    lit: translate(lit, shift),
    viewBox: [0, r1(minY), r1(maxX - minX), r1(maxY - minY)],
    capHeight: H,
  };
}

/** Shifts absolute path data along x (only M/L/Q/C/H use absolute x here). */
function translate(d, dx) {
  if (!dx) return d;
  return d.replace(/([MLQCH])([^MLQCHZmlqchvaZ]*)/g, (_, cmd, body) => {
    const nums = body.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const moved = nums.map((n, i) => (cmd === "H" || i % 2 === 0 ? r1(n + dx) : n));
    return cmd + moved.join(" ");
  });
}

// ---------------------------------------------------------------- output

export function svg({ viewBox, ink, lit }, theme, extra = "") {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(" ")}"${extra}>` +
    `<path fill="${INK[theme]}" d="${ink}"/><path fill="${ACCENT[theme]}" d="${lit}"/></svg>\n`
  );
}

function main() {
  const [fontArg, outArg] = process.argv.slice(2);
  const buf = readFileSync(fontArg ?? findArchivo());
  const outDir = outArg ?? ".";

  const word = buildWordmark(buf);
  const colFull = columnPaths(DEFAULTS.column, word.capHeight);
  const col = { ...colFull, viewBox: [0, 0, colFull.width, word.capHeight] };
  const col16 = { ...columnPaths16(), viewBox: [0, 0, 16, 16] };

  const pub = join(outDir, "public/brand");
  mkdirSync(pub, { recursive: true });
  for (const theme of ["light", "dark"]) {
    writeFileSync(join(pub, `aristo-wordmark-${theme}.svg`), svg(word, theme));
    writeFileSync(join(pub, `aristo-column-${theme}.svg`), svg(col, theme));
    writeFileSync(join(pub, `aristo-column-16-${theme}.svg`), svg(col16, theme, ' shape-rendering="crispEdges"'));
  }

  const ts = join(outDir, "src/components/brand");
  mkdirSync(ts, { recursive: true });
  writeFileSync(
    join(ts, "markPaths.ts"),
    `// Generated by scripts/brand/build-mark.mjs. Do not edit by hand.
// Letters: Archivo (SIL OFL 1.1) at wdth ${DEFAULTS.wdth}, wght ${DEFAULTS.wght}, tracking ${DEFAULTS.tracking / 1000}em.

export const WORDMARK = {
  viewBox: "${word.viewBox.join(" ")}",
  ink: "${word.ink}",
  lit: "${word.lit}",
} as const;

export const COLUMN = {
  viewBox: "${col.viewBox.join(" ")}",
  ink: "${col.ink}",
  lit: "${col.lit}",
} as const;

/** The column on a 16px grid (no volutes); use it at 24px and below. */
export const COLUMN_16 = {
  viewBox: "0 0 16 16",
  ink: "${col16.ink}",
  lit: "${col16.lit}",
} as const;
`
  );
  console.log("wordmark viewBox", word.viewBox.join(" "), "column", col.viewBox.join(" "));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
