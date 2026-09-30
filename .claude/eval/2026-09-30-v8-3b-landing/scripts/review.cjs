// The first-sections review sheet for Hmz (nav, hero, the model build): section captures, the peak frames with the
// hands and the heart marked, the build strip and the proportions side by side. Reads build/*, writes
// build/review-first-sections.png. Usage: node review.cjs
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const B = (f) => path.join(__dirname, "..", "build", f);
const W = 1600, GAP = 16, LABEL = 28;
const NAME = process.argv[2] ? `review-${process.argv[2]}` : "review-first-sections";

const ROUND2 = [
  ["Hero: his head and eyes follow the pointer (the headline, the buttons, above him, below right)", ["hero-play/light/looks-faces.png"]],
  ["Hover Try a lesson: the product's 'your turn', both palms offered", ["hero-play/light/yourturn-strip.png"]],
  ["Tap on Jake: another wave", ["hero-play/light/tap-strip.png"]],
  ["Leave the page and come back: a welcome-back wave", ["hero-play/light/welcome-strip.png"]],
  ["The model build from the lesson's infographic, light and dark", ["peaks/model-light-1280/strip.png"]],
  ["", ["peaks/model-dark-1280/strip.png"]],
  ["PresentModel at its peak: fingertip 2.2 cm from the heart's real edge (green), hand at 0.37 of its height", ["peaks/model-light-1280/peak-marked.png", "peaks/model-dark-1280/peak.png"]],
];
const ROUND3 = [
  ["Hover Try a lesson: one hand offered palm up (PresentModel), head and eyes on the button; 14 degrees from shoulder-to-button (blue)", ["hero-play/light/offer-peak-marked.png"]],
  ["The offer over time", ["hero-play/light/offer-strip.png"]],
  ["The mirrored hero: 1280 light and dark, 768, 360 (lite)", ["hero-r3.png"]],
  ["He follows the pointer: the headline, the buttons, above him, below left", ["hero-play/light/looks.png"]],
  ["Tap on him: a wave; leave and come back: a welcome-back wave", ["hero-play/light/tap-strip.png", "hero-play/light/welcome-strip.png"]],
];
const ROWS = process.argv[2] === "round3" ? ROUND3 : process.argv[2] === "round2" ? ROUND2 : [
  ["Nav and hero, 1280, light and dark (Jake live, the line playing)", ["check/light-1280-top.png", "check/dark-1280-top.png"]],
  ["Phones (lite: stills), 360: hero, the model build, the nav's sheet", ["check/light-360-top.png", "check/dark-360-model.png", "nav/dark-360-sheet.png"]],
  ["The wave at its peak (hands and fingertips marked), light and dark", ["peaks/hero-light-1280/peak-marked.png", "peaks/hero-dark-1280/peak.png"]],
  ["The model build, 1280: light and dark, settled", ["check/light-1280-model.png", "check/dark-1280-model.png"]],
  ["PresentModel at its peak: fingertip (white) against the heart's real bounds (green); gap 1.8 cm, hand at 0.36 of its height", ["peaks/model-light-1280/peak-marked.png", "peaks/model-dark-1280/peak.png", "stills/model.png"]],
  ["The build over time (every third frame, about 360 ms apart)", ["peaks/model-light-1280/strip.png"]],
  ["Proportions against the classroom render at the same scale: chest -1.5%, waist +1.8%", ["proportions/side-by-side.png"]],
];

(async () => {
  const parts = [];
  let y = GAP;
  for (const [label, files] of ROWS) {
    const n = files.length;
    const cellW = Math.floor((W - GAP * (n + 1)) / n);
    const imgs = await Promise.all(files.map(async (f) => {
      const buf = await sharp(B(f)).flatten({ background: "#ffffff" }).resize({ width: cellW, withoutEnlargement: false }).png().toBuffer();
      const m = await sharp(buf).metadata();
      return { buf, h: m.height };
    }));
    const rowH = Math.max(...imgs.map((i) => i.h));
    parts.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${LABEL}"><text x="${GAP}" y="20" font-family="Segoe UI, sans-serif" font-size="17" font-weight="600" fill="#0e1117">${label}</text></svg>`), left: 0, top: y });
    y += LABEL;
    imgs.forEach((im, k) => parts.push({ input: im.buf, left: GAP + k * (cellW + GAP), top: y }));
    y += rowH + GAP * 2;
  }
  await sharp({ create: { width: W, height: y, channels: 3, background: "#e9ebef" } }).composite(parts).png().toFile(B(NAME + ".png"));
  await sharp(B(NAME + ".png")).webp({ quality: 80 }).toFile(B(NAME + ".webp"));
  console.log("ok", W, y);
})();
