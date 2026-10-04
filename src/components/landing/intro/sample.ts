/**
 * The opening's samplers (V8.3c): the Column mark along its outline, in drawing order; and, reading the DOM, a line of
 * text and the hero's poster, pixel for pixel where it is on the page. Each returns a Cloud (targets.ts) of `n`
 * points in CSS px from the viewport's centre.
 */
import { MARK_INK, MARK_LIT, MARK_VIEWBOX } from "./markPoints";
import { CREAM, ORANGE, fill, opaquePixels, type Cloud } from "./targets";

/**
 * The Column mark at `height` px, centred: points along its outline in the order a pen would draw it (the path's own
 * order, precomputed in markPoints.ts), the lit flute last and in orange, so the spark draws the column and then
 * lights it. The flute gets more than its length's share: it is the one lit.
 */
export function markCloud(n: number, height: number): Cloud {
  const [, , vw, vh] = MARK_VIEWBOX.split(" ").map(Number);
  const scale = height / vh;
  const ink = MARK_INK.length / 2, lit = MARK_LIT.length / 2;
  return fill(n, ink + lit, 7, 1.6, (i, p, c) => {
    const onLit = i >= ink;
    const src = onLit ? MARK_LIT : MARK_INK, j = onLit ? i - ink : i;
    p[0] = (src[j * 2] - vw / 2) * scale; p[1] = (src[j * 2 + 1] - vh / 2) * scale; p[2] = 0;
    const col = onLit ? ORANGE : CREAM;
    c[0] = col[0]; c[1] = col[1]; c[2] = col[2];
  });
}

/**
 * A line of text in the page's display face, as wide as `maxWidth` allows (two lines if it must), centred; `accent`
 * (one word of it) in orange.
 */
export function textCloud(n: number, text: string, accent: string, font: string, maxWidth: number): Cloud {
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fill(n, 1, 1, 0, (_, p, c) => { p.fill(0); c.splice(0, 3, ...CREAM); });
  let size = Math.min(88, Math.max(28, maxWidth / 11));
  const words = text.split(" ");
  const setFont = () => { ctx.font = `800 ${size}px ${font}`; };
  setFont();
  // One line if it fits at a readable size, else two.
  let lines = [text];
  if (ctx.measureText(text).width > maxWidth) {
    const half = Math.ceil(words.length / 2);
    lines = [words.slice(0, half).join(" "), words.slice(half).join(" ")];
    while (size > 24 && Math.max(...lines.map((l) => ctx.measureText(l).width)) > maxWidth) { size -= 2; setFont(); }
  }
  const lh = size * 1.08;
  const w = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))) + 8;
  const h = Math.ceil(lh * lines.length) + 8;
  cv.width = w; cv.height = h;
  setFont();
  ctx.textBaseline = "top";
  lines.forEach((line, li) => {
    let x = (w - ctx.measureText(line).width) / 2;
    for (const word of line.split(" ")) {
      ctx.fillStyle = word.replace(/[^\w]/g, "") === accent ? "#F97B2F" : "#F4ECE1";
      ctx.fillText(word, x, 4 + li * lh);
      x += ctx.measureText(`${word} `).width;
    }
  });
  const px = opaquePixels(ctx.getImageData(0, 0, w, h).data, w, h, Math.max(2, Math.round(size / 26)));
  // Left to right, so the order reads as the line does.
  px.sort((a, b) => a.x - b.x);
  return fill(n, Math.max(1, px.length), 11, 1.2, (i, p, c) => {
    const q = px[i];
    p[0] = q.x - w / 2; p[1] = q.y - h / 2; p[2] = 0;
    c[0] = q.c[0]; c[1] = q.c[1]; c[2] = q.c[2];
  });
}

/**
 * The hero's poster, where it is: its opaque pixels in their own colours, placed by the image's on-screen box (the
 * poster is laid out by container units, spots.ts stillCss) and cut to its spot's box, faded towards the foot as the
 * spot is (globals.css .landing-fade, 62% to 96%), so the points land on the picture the reader then sees.
 */
export function posterCloud(n: number, img: HTMLImageElement, spot: DOMRect): Cloud | null {
  const box = img.getBoundingClientRect();
  if (!img.complete || !img.naturalWidth || box.width < 2) return null;
  const scale = Math.min(1, 420 / box.height);
  const w = Math.max(1, Math.round(box.width * scale)), h = Math.max(1, Math.round(box.height * scale));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, w, h).data; } catch { return null; }
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const px = opaquePixels(data, w, h, 2, 150).filter((q) => {
    const x = box.left + q.x / scale, y = box.top + q.y / scale;
    if (x < spot.left || x > spot.right || y < spot.top || y > spot.bottom) return false;
    // The spot's fade at its foot: thinner towards it.
    const f = (y - spot.top) / spot.height;
    return f < 0.62 || Math.random() > (f - 0.62) / 0.34;
  });
  if (px.length < 50) return null;
  // Top to bottom: the figure forms from the head down.
  px.sort((a, b) => a.y - b.y);
  return fill(n, px.length, 13, 1 / scale, (i, p, c) => {
    const q = px[i];
    p[0] = box.left + q.x / scale - cx; p[1] = box.top + q.y / scale - cy; p[2] = 0;
    c[0] = q.c[0]; c[1] = q.c[1]; c[2] = q.c[2];
  });
}
