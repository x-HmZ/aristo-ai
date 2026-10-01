// Is a poster shifted against its live frame, or only resampled? The mean difference of two same-size captures at
// every offset within +-R px (the overlap only), and the offset where it is least. A blurred but aligned poster has
// its least at (0, 0). Usage: node shift.cjs <live.png> <poster.png> [R]
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , A, B, R = "4"] = process.argv;
(async () => {
  const load = async (f) => sharp(f).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  const a = await load(A), b = await load(B);
  const w = a.info.width, h = a.info.height, r = Number(R);
  let best = null;
  const grid = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    let s = 0, n = 0;
    for (let y = r; y < h - r; y += 2) for (let x = r; x < w - r; x += 2) { s += Math.abs(a.data[y * w + x] - b.data[(y + dy) * w + x + dx]); n++; }
    const m = s / n;
    grid.push({ dx, dy, m: +m.toFixed(2) });
    if (!best || m < best.m) best = { dx, dy, m: +m.toFixed(2) };
  }
  console.log(JSON.stringify({ atZero: grid.find((g) => g.dx === 0 && g.dy === 0).m, best }));
})();
