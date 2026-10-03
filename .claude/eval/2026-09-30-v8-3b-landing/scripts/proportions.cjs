// Hmz's first hard requirement: Jake on the landing against the classroom render (public/images/landing/v3/idea.webp)
// at the same scale. Both are measured the same way on a column through his body: the top of his head (the first
// row that is not background) and his belt (the shirt's white turning to the trousers' dark). The landing still is
// scaled so head-to-belt matches, then the shirt's width is measured at the chest and at the waist in both, and a
// side-by-side sheet is written with the measured rows drawn across.
// Usage: node proportions.cjs <landing still png> <outdir>
const fs = require("fs");
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const ROOT = path.join(__dirname, "..", "..", "..", "..");
const [, , mine = path.join(__dirname, "..", "build", "stills", "hero.png"), out = "build/proportions"] = process.argv;
const OUT = path.join(__dirname, "..", out);
fs.mkdirSync(OUT, { recursive: true });

async function load(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * info.width + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  return { data, info, px };
}
const white = ([r, g, b, a]) => a > 200 && r > 185 && g > 185 && b > 185 && Math.max(r, g, b) - Math.min(r, g, b) < 28;
const dark = ([r, g, b, a]) => a > 200 && Math.max(r, g, b) < 140;

/** Head top, belt and the shirt's widths, on column `cx`; `bg(p)` says a pixel is background. */
function measure(img, cx, bg, from = 0) {
  const { info, px } = img;
  let top = from;
  while (top < info.height && bg(px(cx, top))) top++;
  // The belt: the first row below the chest where the column is trousers-dark after a run of shirt-white.
  // The shirt's front is a long run of white rows (a few antialiased rows at its edge are allowed), then trousers.
  let y = top + Math.round(info.height * 0.1), seenWhite = 0, lastWhite = -99, belt = -1;
  for (; y < info.height; y++) {
    const p = px(cx, y);
    if (white(p)) { seenWhite++; lastWhite = y; }
    else if (dark(p) && seenWhite > 60 && y - lastWhite < 8) { belt = y; break; }
    else if (y - lastWhite > 6) seenWhite = 0;
  }
  const run = (row) => {
    let l = cx, r = cx;
    while (l > 0 && !bg(px(l - 1, row))) l--;
    while (r < info.width - 1 && !bg(px(r + 1, row))) r++;
    return { l, r, w: r - l + 1 };
  };
  const h = belt - top;
  const chestRow = Math.round(top + h * 0.45), waistRow = belt - Math.round(h * 0.06);
  return { top, belt, h, chest: run(chestRow), waist: run(waistRow), chestRow, waistRow };
}

(async () => {
  // The classroom render: the wall behind him is blue-grey, the panelling tan; he stands left of the display.
  const room = await load(path.join(ROOT, "public", "images", "landing", "v3", "idea.webp"));
  const wall = ([r, g, b]) => (b > r + 8 && Math.abs(g - b) < 30 && r > 120 && r < 215) || (r > g + 15 && g > b + 15 && r > 170);
  // Below the ceiling line (about y 90), the column meets the wall first, then his hair.
  const a = measure(room, 215, wall, 120);
  // The landing: a transparent ground.
  const land = await load(mine);
  const cxL = Math.round(land.info.width * 0.44);
  const b = measure(land, cxL, (p) => p[3] < 40);
  if (process.env.DEBUG) console.log(JSON.stringify({ a, b }));
  const k = a.h / b.h;
  const r = {
    classroom: { headToBelt: a.h, chest: a.chest.w, waist: a.waist.w, chestPerHeight: +(a.chest.w / a.h).toFixed(3), waistPerHeight: +(a.waist.w / a.h).toFixed(3) },
    landing: { headToBelt: b.h, chest: b.chest.w, waist: b.waist.w, chestPerHeight: +(b.chest.w / b.h).toFixed(3), waistPerHeight: +(b.waist.w / b.h).toFixed(3), scaledBy: +k.toFixed(4) },
  };
  r.difference = { chest: +((r.landing.chestPerHeight / r.classroom.chestPerHeight - 1) * 100).toFixed(1) + "%", waist: +((r.landing.waistPerHeight / r.classroom.waistPerHeight - 1) * 100).toFixed(1) + "%" };

  // The sheet: each crop from 30px above the head to 60px below the belt, at the classroom's scale, rows drawn.
  const pad = 30, below = 90;
  const cropA = { left: Math.max(0, a.chest.l - 90), top: a.top - pad, width: Math.min(room.info.width - Math.max(0, a.chest.l - 90), a.chest.w + 180), height: a.h + pad + below };
  const scaled = await sharp(mine).resize({ width: Math.round(land.info.width * k) }).png().toBuffer();
  const s = (v) => Math.round(v * k);
  const cropB = { left: Math.max(0, s(b.chest.l) - 90), top: s(b.top) - pad, width: s(b.chest.w) + 180, height: a.h + pad + below };
  const A = await sharp(path.join(ROOT, "public", "images", "landing", "v3", "idea.webp")).extract(cropA).png().toBuffer();
  const B = await sharp(scaled).extract(cropB).flatten({ background: "#f3f4f6" }).png().toBuffer();
  const W = cropA.width + cropB.width + 40, H = cropA.height + 40;
  const line = (y, c) => `<line x1="0" x2="${W}" y1="${y + 20}" y2="${y + 20}" stroke="${c}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${line(pad, "#f97b2f")}${line(pad + a.h, "#f97b2f")}${line(pad + (a.chestRow - a.top), "#2f7cf9")}${line(pad + (a.waistRow - a.top), "#2f7cf9")}
    <text x="10" y="14" font-family="sans-serif" font-size="12" fill="#333">Classroom (idea.webp)</text><text x="${cropA.width + 50}" y="14" font-family="sans-serif" font-size="12" fill="#333">Landing (scaled x${k.toFixed(3)})</text></svg>`;
  await sharp({ create: { width: W, height: H, channels: 4, background: "#ffffff" } })
    .composite([{ input: A, left: 10, top: 20 }, { input: B, left: cropA.width + 30, top: 20 }, { input: Buffer.from(svg), left: 0, top: 0 }])
    .png().toFile(path.join(OUT, "side-by-side.png"));
  fs.writeFileSync(path.join(OUT, "proportions.json"), JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r));
})();
