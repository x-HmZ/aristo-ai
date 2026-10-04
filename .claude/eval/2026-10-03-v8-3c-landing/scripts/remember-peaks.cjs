// It Remembers What You Know: his finger at each review point as the line reaches it, from a track.cjs run (bones and
// the [data-track=tapN] points per frame). For each tap, the frame nearest the moment the line arrives: the angle at
// his index knuckle between the finger (knuckle to tip) and the point's centre, and the fingertip's distance from it.
// Writes remember-peaks.json, a marked frame per tap and a sheet.
// Usage: node remember-peaks.cjs <trackdir> <outdir>
const fs = require("fs");
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , dir, outDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const { samples } = require(path.resolve(dir, "track.json"));
// Mirrors scripts.ts REMEMBER_T and mapStory CURVE_REVIEWS: the line reaches day d at draw[0] + d / 21 of the draw.
const DRAW = [1.26, 6.96], DAYS = 21, TAPS = [2, 6, 13];
const arrive = (d) => DRAW[0] + (d / DAYS) * (DRAW[1] - DRAW[0]);
const r1 = (v) => +v.toFixed(1);

(async () => {
  const out = [];
  const tiles = [];
  for (let i = 0; i < TAPS.length; i++) {
    const at = arrive(TAPS[i]);
    const s = samples.filter((x) => x.marks[`tap${i}`]).reduce((a, b) => (Math.abs(b.t - at) < Math.abs(a.t - at) ? b : a));
    const m = s.marks[`tap${i}`], g = { x: m.x + m.w / 2, y: m.y + m.h / 2 };
    const k = s.page.CC_Base_L_Index1, tip = s.page.CC_Base_L_Index3;
    const a = Math.atan2(tip.y - k.y, tip.x - k.x) - Math.atan2(g.y - k.y, g.x - k.x);
    const row = { tap: i + 1, day: TAPS[i], t: r1(s.t), arrivesAt: r1(at), deg: r1(Math.abs(((a * 180) / Math.PI + 540) % 360 - 180)), tipToPointPx: r1(Math.hypot(g.x - tip.x, g.y - tip.y)), missPx: r1(Math.hypot(g.x - k.x, g.y - k.y) * Math.sin(Math.abs(a))), handUp: s.bones.CC_Base_L_Hand[1] > -0.25 };
    out.push(row);
    const cx = s.clip.x, cy = s.clip.y;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s.clip.width}" height="${s.clip.height}"><circle cx="${g.x - cx}" cy="${g.y - cy}" r="11" fill="none" stroke="#2f7cf9" stroke-width="3"/><line x1="${k.x - cx}" y1="${k.y - cy}" x2="${g.x - cx}" y2="${g.y - cy}" stroke="#2f7cf9" stroke-width="1.5" stroke-dasharray="5 4"/><circle cx="${tip.x - cx}" cy="${tip.y - cy}" r="4" fill="none" stroke="#1fa36a" stroke-width="2.5"/></svg>`;
    const file = path.join(outDir, `remember-tap${i + 1}.png`);
    await sharp(path.join(dir, s.file)).composite([{ input: Buffer.from(svg) }]).png().toFile(file);
    tiles.push({ file, label: `tap ${i + 1} (day ${TAPS[i]}) t=${row.t}: ${row.deg} deg, misses by ${row.missPx} px` });
  }
  const tw = 420;
  const bufs = await Promise.all(tiles.map(async (t) => {
    const img = await sharp(t.file).resize({ width: tw }).toBuffer();
    const h = (await sharp(img).metadata()).height;
    const cap = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="26"><rect width="100%" height="100%" fill="#111"/><text x="8" y="18" font-family="sans-serif" font-size="13" fill="#fff">${t.label}</text></svg>`);
    return sharp({ create: { width: tw, height: h + 26, channels: 3, background: "#111" } }).composite([{ input: cap, top: 0, left: 0 }, { input: img, top: 26, left: 0 }]).png().toBuffer();
  }));
  const h = (await sharp(bufs[0]).metadata()).height;
  await sharp({ create: { width: tw * bufs.length, height: h, channels: 3, background: "#111" } })
    .composite(bufs.map((b, k) => ({ input: b, left: k * tw, top: 0 }))).png().toFile(path.join(outDir, "remember-peaks.png"));
  fs.writeFileSync(path.join(outDir, "remember-peaks.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
})();
