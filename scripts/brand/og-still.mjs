// The link-preview image's room still (V8.7). ImageResponse cannot read webp, so the landing's room still
// (public/images/landing/v3b/room.webp: Jake and the 3D brain in the lit classroom) is cropped to a JPEG here.
//   node scripts/brand/og-still.mjs
// The crop is the region of the 1600x900 still around Jake, the board and the brain that fits the card's
// wide right panel (680x630 in the 1200x630 card, src/components/brand/OgCard.tsx), which melts into the ink on its
// left edge. Re-run it if the landing still is re-shot.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "public/images/landing/v3b/room.webp";
const OUT = "public/images/og/room.jpg";
const CROP = { left: 250, top: 0, width: 1043, height: 900 };

mkdirSync("public/images/og", { recursive: true });
await sharp(SRC)
  .extract(CROP)
  .resize(680, 630, { fit: "fill" })
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(OUT);
console.log(`${OUT} 680x630`);
