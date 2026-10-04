// The shirt's rendered colour in a capture: the median of pixels in the torso box whose hue is near the asked colour.
// Usage: node shirt-sample.cjs <png> <hex> <x0> <y0> <x1> <y1>
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , file, hex, x0, y0, x1, y1] = process.argv;
const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, s, l]; };
(async () => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const t = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [th] = hsl(...t);
  const px = [];
  for (let y = +y0; y < +y1; y++) for (let x = +x0; x < +x1; x++) {
    const i = (y * info.width + x) * 4; if (data[i + 3] < 250) continue;
    const [h, s] = hsl(data[i], data[i + 1], data[i + 2]);
    const dh = Math.min(Math.abs(h - th), 360 - Math.abs(h - th));
    if (s > 0.12 && dh < 35) px.push([data[i], data[i + 1], data[i + 2]]);
  }
  const med = [0, 1, 2].map((c) => px.map((p) => p[c]).sort((a, b) => a - b)[px.length >> 1]);
  console.log(JSON.stringify({ n: px.length, median: "#" + med.map((v) => v.toString(16).padStart(2, "0")).join("") }));
})();
