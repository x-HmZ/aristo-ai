import { WORDMARK } from "@/components/brand/markPaths";
import { OG_HEADLINE, OG_SUB } from "@/components/brand/ogPaths";

/**
 * The link-preview card (1200x630) as ImageResponse markup: the wordmark, the
 * headline and the sub line on ink, and a wide panel with a still of the lit
 * classroom (Jake and the 3D brain), the product's selling point, which melts
 * into the ink on its left edge. Picked by Hmz from three layouts in V8.7
 * (decisions.md).
 *
 * Every word is an outline (see ogPaths.ts), so there is no font to load. The
 * colours are the landing page's dark "Night Class" tokens as literals: an
 * ImageResponse cannot read the CSS variables that hold them (register in
 * brand-system.md). The still is `public/images/og/room.jpg`, passed in as a
 * data URL (scripts/brand/og-still.mjs makes it).
 */

const BG = "#0E1117";
const INK = "#ECEDEF";
const BODY = "#B7BDC7";
const ACCENT = "#E98A52";
const ACCENT_TEXT = "#EF9A66";

const CAP = 686; // Archivo's cap height in the path units
const PAD = 56;
const HEADLINE_CAP = 32;
const HEADLINE_PITCH = 48;
const SUB_CAP = 20;
const WORDMARK_H = 30;
const STILL = { width: 680, height: 630 };
const FADE = 200; // the still's left edge melts into the ink over this many pixels

type Paths = { readonly viewBox: readonly number[]; readonly d: string };

/** An outlined line of text, `cap` pixels tall from baseline to cap height. */
function Line({ paths, cap, fill }: { paths: Paths; cap: number; fill: string }) {
  const [, , w, h] = paths.viewBox;
  const scale = cap / CAP;
  return (
    <svg width={w * scale} height={h * scale} viewBox={paths.viewBox.join(" ")} style={{ display: "flex" }}>
      <path d={paths.d} fill={fill} />
    </svg>
  );
}

export function OgCard({ stillSrc }: { stillSrc: string }) {
  const [, , wordW, wordH] = WORDMARK.viewBox.split(" ").map(Number);

  return (
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
      <div style={{ position: "absolute", display: "flex", right: 0, top: 0, ...STILL }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stillSrc} width={STILL.width} height={STILL.height} alt="" />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: FADE,
            height: STILL.height,
            backgroundImage: `linear-gradient(to right, ${BG}, rgba(14,17,23,0))`,
          }}
        />
      </div>

      <svg
        width={(wordW / wordH) * WORDMARK_H}
        height={WORDMARK_H}
        viewBox={WORDMARK.viewBox}
        style={{ position: "relative" }}
      >
        <path d={WORDMARK.ink} fill={INK} />
        <path d={WORDMARK.lit} fill={ACCENT} />
      </svg>

      <div style={{ display: "flex", flexDirection: "column", gap: HEADLINE_PITCH - HEADLINE_CAP, position: "relative" }}>
        {OG_HEADLINE.map((line, i) => (
          <Line key={i} paths={line} cap={HEADLINE_CAP} fill={i === OG_HEADLINE.length - 1 ? ACCENT_TEXT : INK} />
        ))}
      </div>

      <div style={{ display: "flex", position: "relative" }}>
        <Line paths={OG_SUB} cap={SUB_CAP} fill={BODY} />
      </div>
    </div>
  );
}
