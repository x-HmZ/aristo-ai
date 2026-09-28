import { ImageResponse } from "next/og";
import { COLUMN, WORDMARK } from "@/components/brand/markPaths";
import { OG_HEADLINE, OG_SUB } from "@/components/brand/ogPaths";

/**
 * The link-preview image for `/` (and every route that does not set its own).
 * Statically rendered at build, so it costs nothing at request time.
 *
 * Every word is an outline (see ogPaths.ts), so there is no font to load. The
 * colours are the landing page's dark "Night Class" tokens as literals: an
 * ImageResponse cannot read the CSS variables that hold them.
 */
export const alt = "Aristo. One teacher. One student. Every kid.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0E1117";
const INK = "#ECEDEF";
const BODY = "#B7BDC7";
const ACCENT = "#E98A52";
const ACCENT_TEXT = "#EF9A66";

const PAD = 72;
const HEADLINE_CAP = 56;
const HEADLINE_PITCH = 80;
const SUB_CAP = 25.5;
const CAP = 686; // Archivo's cap height in the path units

type Paths = { readonly viewBox: readonly number[]; readonly d: string };

/** An outlined line of text, `cap` pixels tall from baseline to cap height. */
function Line({ paths, cap, fill }: { paths: Paths; cap: number; fill: string }) {
  const [, , w, h] = paths.viewBox;
  const scale = cap / CAP;
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={paths.viewBox.join(" ")}
      style={{ display: "flex" }}
    >
      <path d={paths.d} fill={fill} />
    </svg>
  );
}

export default function OpenGraphImage() {
  const [, , wordW, wordH] = WORDMARK.viewBox.split(" ").map(Number);
  const wordmarkH = 34;
  const columnH = 330;
  const columnW = (columnH * 430) / 686;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: PAD,
          position: "relative",
        }}
      >
        <svg
          width={(wordW / wordH) * wordmarkH}
          height={wordmarkH}
          viewBox={WORDMARK.viewBox}
        >
          <path d={WORDMARK.ink} fill={INK} />
          <path d={WORDMARK.lit} fill={ACCENT} />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: HEADLINE_PITCH - HEADLINE_CAP }}>
          {OG_HEADLINE.map((line, i) => (
            <Line
              key={i}
              paths={line}
              cap={HEADLINE_CAP}
              fill={i === OG_HEADLINE.length - 1 ? ACCENT_TEXT : INK}
            />
          ))}
        </div>

        <Line paths={OG_SUB} cap={SUB_CAP} fill={BODY} />

        <svg
          width={columnW}
          height={columnH}
          viewBox={COLUMN.viewBox}
          style={{ position: "absolute", right: PAD, top: (630 - columnH) / 2 }}
        >
          <path d={COLUMN.ink} fill={INK} />
          <path d={COLUMN.lit} fill={ACCENT} />
        </svg>
      </div>
    ),
    size
  );
}
