import { ImageResponse } from "next/og";
import { COLUMN } from "@/components/brand/markPaths";

/**
 * The home-screen icon: the full column on the dark landing ink. iOS applies
 * its own corner mask, so the tile is a full-bleed square. Colours are the
 * "Night Class" tokens as literals (an ImageResponse cannot read CSS vars).
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const h = 108;
  const w = (h * 430) / 686;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E1117",
        }}
      >
        <svg width={w} height={h} viewBox={COLUMN.viewBox}>
          <path d={COLUMN.ink} fill="#ECEDEF" />
          <path d={COLUMN.lit} fill="#E98A52" />
        </svg>
      </div>
    ),
    size
  );
}
