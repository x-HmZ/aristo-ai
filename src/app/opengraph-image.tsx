import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { OgCard } from "@/components/brand/OgCard";

/**
 * The link-preview image for `/` (and every route that does not set its own):
 * the wordmark, the headline and a still of the lit classroom. Statically
 * rendered at build, so it costs nothing at request time. The card is
 * `components/brand/OgCard.tsx`.
 *
 * ImageResponse only emits PNG, and with a photo in it the PNG is about 510 KB,
 * over the roughly 300 KB some chat apps accept for a preview. So the card is
 * rendered as before and re-encoded as a JPEG here, with full-resolution colour
 * (4:4:4) so the orange outlined words stay crisp.
 */
export const alt = "Aristo. One teacher. One student. Every kid.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

export default async function OpenGraphImage() {
  const still = await readFile(join(process.cwd(), "public/images/og/room.jpg"));
  const stillSrc = `data:image/jpeg;base64,${still.toString("base64")}`;
  const png = await new ImageResponse(<OgCard stillSrc={stillSrc} />, size).arrayBuffer();
  const jpeg = await sharp(Buffer.from(png))
    .jpeg({ quality: 85, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": contentType } });
}
