// Jake's landing stills before and after the sleeve change, side by side on the light page tone.
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const B = path.join(__dirname, "..", "landing", "before"), A = path.join(__dirname, "..", "..", "..", "..", "public", "images", "landing", "v3b");
const NAMES = (process.env.NAMES || "hero,idea,close,model-start,room-start").split(",");
const H = 520;
(async () => {
  const rows = [];
  for (const n of NAMES) {
    const tiles = await Promise.all([B, A].map((d) => sharp(path.join(d, `${n}.webp`)).flatten({ background: "#F3F4F6" }).resize({ height: H }).toBuffer({ resolveWithObject: true })));
    rows.push(tiles);
  }
  const W = Math.max(...rows.map((r) => r[0].info.width + r[1].info.width + 12));
  const comp = [];
  rows.forEach((r, i) => { comp.push({ input: r[0].data, left: 0, top: i * (H + 12) }, { input: r[1].data, left: r[0].info.width + 12, top: i * (H + 12) }); });
  await sharp({ create: { width: W, height: rows.length * (H + 12), channels: 3, background: "#fff" } }).composite(comp).jpeg({ quality: 84 })
    .toFile(path.join(__dirname, "..", "sheets", "landing-before-after.jpg"));
  console.log("ok");
})();
