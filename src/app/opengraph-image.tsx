import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OgCard } from "@/components/brand/OgCard";

/**
 * The link-preview image for `/` (and every route that does not set its own):
 * the wordmark, the headline and a still of the lit classroom. Statically
 * rendered at build, so it costs nothing at request time. The card is
 * `components/brand/OgCard.tsx`.
 */
export const alt = "Aristo. One teacher. One student. Every kid.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const still = await readFile(join(process.cwd(), "public/images/og/room.jpg"));
  const stillSrc = `data:image/jpeg;base64,${still.toString("base64")}`;
  return new ImageResponse(<OgCard stillSrc={stillSrc} />, size);
}
