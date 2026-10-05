// Sheet A2 pair panel (V8.3d): Jake and MJ side by side on the light page, for every pair of candidates that both
// separate from white and the page, ranked by CIEDE2000 between their renders (>= 20 = clearly different).
// Reads ../sheet-a2/results.json and the raw captures shirts.cjs left. Usage: node pairs.cjs [top]
const fs = require("fs");
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const DIR = path.join(__dirname, "..", "sheet-a2");
const R = JSON.parse(fs.readFileSync(path.join(DIR, "results.json")));
const top = Number(process.argv[2] || 8);

// CIEDE2000 (same as shirts.cjs).
const hexRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function lab(h) {
  const [r, g, b] = hexRgb(h).map(toLin);
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function de2000(h1, h2) {
  const [L1, a1, b1] = lab(h1), [L2, a2, b2] = lab(h2);
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b, a) => { const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const hp1 = hp(b1, ap1), hp2 = hp(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = Cp1 * Cp2 === 0 ? 0 : hp2 - hp1;
  if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * rad) / 2);
  const Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) hb = Math.abs(hp1 - hp2) > 180 ? (hp1 + hp2 + (hp1 + hp2 < 360 ? 360 : -360)) / 2 : (hp1 + hp2) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T;
  const RT = -2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

const ok = (t) => Object.values(R[t]).filter((c) => c.separates);
const pairs = [];
for (const j of ok("jake")) for (const m of ok("mj")) pairs.push({ j, m, de: de2000(j.rendered, m.rendered) });
pairs.sort((a, b) => b.de - a.de);
console.log("all pairs (render dE00):");
for (const p of pairs) console.log(`  jake ${p.j.name.padEnd(12)} mj ${p.m.name.padEnd(11)} ${p.de.toFixed(1)}${p.de >= 20 ? "" : "  (too close)"}`);

(async () => {
  const W = 300, H = 231, LIGHT = "#F3F4F6";
  const tile = async (t, c) => sharp(await sharp({ create: { width: 600, height: 462, channels: 4, background: LIGHT } })
    .composite([{ input: path.join(DIR, "raw", `${t}-${c.code}-picture.png`) }]).png().toBuffer()).resize(W, H).png().toBuffer();
  const rows = [];
  for (const p of pairs.filter((q) => q.de >= 20).slice(0, top)) {
    const txt = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${2 * W}" height="28"><rect width="100%" height="100%" fill="#fff"/><text x="8" y="19" style="font:600 15px system-ui,sans-serif;fill:#1b1b1b">Jake ${p.j.name} #${p.j.code}  +  MJ ${p.m.name} #${p.m.code}   dE ${p.de.toFixed(1)}</text></svg>`);
    rows.push([await tile("jake", p.j), await tile("mj", p.m), txt]);
  }
  const cols = 2, gap = 8, cellW = 2 * W, cellH = H + 28;
  const n = rows.length, rr = Math.ceil(n / cols);
  const comps = [];
  rows.forEach((r, i) => {
    const x = gap + (i % cols) * (cellW + gap), y = gap + Math.floor(i / cols) * (cellH + gap);
    comps.push({ input: r[2], left: x, top: y }, { input: r[0], left: x, top: y + 28 }, { input: r[1], left: x + W, top: y + 28 });
  });
  await sharp({ create: { width: cols * cellW + (cols + 1) * gap, height: rr * cellH + (rr + 1) * gap, channels: 4, background: "#d0d0d0" } })
    .composite(comps).webp({ quality: 88 }).toFile(path.join(DIR, "pairs.webp"));
  console.log("wrote pairs.webp");
})();
