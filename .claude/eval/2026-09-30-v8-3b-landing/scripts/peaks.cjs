// Peak-gesture frames (build steps 5 and 7; Hmz's second hard requirement). For a spot, from the moment the teacher
// is live there: a screenshot of the spot about every 120 ms, each with Jake's bones read in the same frame
// (`?probe`, stage/Probe.tsx) and projected to the page. The gesture's peak is the frame that maximises the spot's
// measure (the wave: the raised hand's height; the present: the hand's reach towards the object). Writes the frames,
// a strip of every 3rd one, the peak frame with the hands and the target marked, and peaks.json.
// Usage: node peaks.cjs <spot> <outdir> [base] [theme] [width] [seconds]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , spot = "hero", out = "build/peaks", base = "http://localhost:3000", theme = "light", width = "1280", secs = "6"] = process.argv;
const OUT = path.join(__dirname, "..", out, `${spot}-${theme}-${width}`);
fs.mkdirSync(OUT, { recursive: true });
const W = Number(width);

const READ = () => {
  const L = window.__landing;
  const box = document.querySelector(`[data-spot="${L.spot}"]`).getBoundingClientRect();
  const bones = L.bones();
  const page = Object.fromEntries(Object.entries(bones).map(([k, v]) => [k, L.toPage(v)]));
  const target = document.querySelector("[data-peak-target]");
  const tr = target?.getBoundingClientRect();
  return {
    spot: L.spot, frame: L.frame, bones, page,
    box: { x: box.left + scrollX, y: box.top + scrollY, w: box.width, h: box.height },
    target: tr ? { x: tr.left + scrollX, y: tr.top + scrollY, w: tr.width, h: tr.height } : null,
    heart: L.bounds('landing-heart-solid'),
    flute: (() => { const f = document.querySelector('.landing-orb'); if (!f || +getComputedStyle(f).opacity < 0.5) return null; const r = f.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })(),
  };
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], frames: [] };
  const ctx = await themedContext(b, theme, { width: W, height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/?probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 90000 });
  if (spot !== "hero") {
    // Scroll the spot to the middle of the viewport in small steps, as a reader would.
    const y = await p.evaluate((s) => { const r = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); }, spot);
    for (let v = 0; v <= y; v += 160) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
    await p.evaluate((q) => scrollTo(0, q), y);
  }
  await p.waitForFunction((s) => document.querySelector(`[data-spot="${s}"][data-live]`) && window.__landing?.spot === s, spot, { timeout: 30000 });
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < Number(secs) * 1000) {
    const facts = await p.evaluate(READ);
    const r = facts.box;
    const scroll = await p.evaluate(() => scrollY);
    const clip = { x: Math.max(0, r.x - 40), y: Math.max(0, r.y - scroll - 40), width: Math.min(W, r.w + 80), height: r.h + 80 };
    const file = `f${String(i).padStart(3, "0")}.png`;
    await p.screenshot({ path: path.join(OUT, file), clip });
    report.frames.push({ i, ms: Date.now() - t0, file, clip: { ...clip, y: clip.y + scroll }, ...facts });
    i++;
  }
  // The peak: the wave raises a hand highest; the present reaches furthest towards the target's centre.
  // The wave: the raised hand at its highest. The present: the offering fingertip at its furthest reach.
  const m = (f) => {
    const L = f.page.CC_Base_L_Hand, R = f.page.CC_Base_R_Hand;
    if (spot === "model") return f.bones.CC_Base_L_Index3[0];
    // HoldIdea: both hands furthest forward (towards the reader), while the flute is held.
    if (spot === "idea") return (f.flute ? 10 : 0) + f.bones.CC_Base_L_Hand[2] + f.bones.CC_Base_R_Hand[2];
    return -Math.min(L.y, R.y);
  };
  const peak = report.frames.reduce((a, f) => (m(f) > m(a) ? f : a), report.frames[0]);
  report.peak = peak.i;
  // The peak frame, with the hands (orange) and the fingertips (white) marked, and the target's box.
  const dot = (pt, c, rr = 7) => `<circle cx="${pt.x - peak.clip.x}" cy="${pt.y - peak.clip.y}" r="${rr}" fill="none" stroke="${c}" stroke-width="3"/>`;
  // The heart's real bounds (world), projected: its near edge against the fingertip.
  let hb = "";
  if (peak.heart) {
    const [a, b2] = [peak.heart.min, peak.heart.max];
    const corners = await p.evaluate(([a, b]) => [[a[0], a[1], b[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]], [b[0], a[1], b[2]]].map((c) => window.__landing.toPage(c)), [a, b2]);
    const xs = corners.map((c) => c.x - peak.clip.x), ys = corners.map((c) => c.y - peak.clip.y);
    hb = `<rect x="${Math.min(...xs)}" y="${Math.min(...ys)}" width="${Math.max(...xs) - Math.min(...xs)}" height="${Math.max(...ys) - Math.min(...ys)}" fill="none" stroke="#1fa36a" stroke-width="2"/>`;
    report.gap = { worldM: +(a[0] - peak.bones.CC_Base_L_Index3[0]).toFixed(3), handLowerThird: +((peak.bones.CC_Base_L_Index3[1] - a[1]) / (b2[1] - a[1])).toFixed(2) };
  }
  // The flute against the palms: their centres (wrist to knuckle, halfway), the gap between them, its box.
  if (spot === "idea" && peak.flute) {
    const palm = (w, k) => ({ x: (peak.page[w].x + peak.page[k].x) / 2, y: (peak.page[w].y + peak.page[k].y) / 2 });
    const l = palm("CC_Base_L_Hand", "CC_Base_L_Index1"), r = palm("CC_Base_R_Hand", "CC_Base_R_Index1");
    const f = peak.flute, cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    report.hold = { palmGapPx: +Math.hypot(l.x - r.x, l.y - r.y).toFixed(1), orbW: f.w, orbH: f.h, centreOffsetPx: +Math.hypot(cx - (l.x + r.x) / 2, cy - (l.y + r.y) / 2).toFixed(1), clearEachSidePx: +((Math.abs(l.x - r.x) - f.w) / 2).toFixed(1) };
    hb += `<rect x="${f.x - peak.clip.x}" y="${f.y - peak.clip.y}" width="${f.w}" height="${f.h}" fill="none" stroke="#1fa36a" stroke-width="2"/><circle cx="${l.x - peak.clip.x}" cy="${l.y - peak.clip.y}" r="6" fill="none" stroke="#2f7cf9" stroke-width="3"/><circle cx="${r.x - peak.clip.x}" cy="${r.y - peak.clip.y}" r="6" fill="none" stroke="#2f7cf9" stroke-width="3"/>`;
  }
  const tb = peak.target ? `<rect x="${peak.target.x - peak.clip.x}" y="${peak.target.y - peak.clip.y}" width="${peak.target.w}" height="${peak.target.h}" fill="none" stroke="#2f7cf9" stroke-width="2" stroke-dasharray="6 4"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${peak.clip.width}" height="${peak.clip.height}">${tb}${hb}${dot(peak.page.CC_Base_L_Hand, "#f97b2f")}${dot(peak.page.CC_Base_R_Hand, "#f97b2f")}${dot(peak.page.CC_Base_L_Index3, "#fff", 4)}${dot(peak.page.CC_Base_R_Index3, "#fff", 4)}</svg>`;
  await sharp(path.join(OUT, peak.file)).composite([{ input: Buffer.from(svg) }]).png().toFile(path.join(OUT, "peak-marked.png"));
  fs.copyFileSync(path.join(OUT, peak.file), path.join(OUT, "peak.png"));
  const pick = report.frames.filter((f) => f.i % 3 === 0).slice(0, 12);
  const tw = 220;
  const tiles = await Promise.all(pick.map((f) => sharp(path.join(OUT, f.file)).resize({ width: tw }).toBuffer()));
  const th = Math.round((pick[0].clip.height / pick[0].clip.width) * tw);
  await sharp({ create: { width: tw * Math.min(6, tiles.length), height: th * Math.ceil(tiles.length / 6), channels: 3, background: "#222" } })
    .composite(tiles.map((t, k) => ({ input: t, left: (k % 6) * tw, top: Math.floor(k / 6) * th }))).png().toFile(path.join(OUT, "strip.png"));
  fs.writeFileSync(path.join(OUT, "peaks.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ frames: report.frames.length, peak: peak.i, ms: peak.ms, hands: { L: peak.bones.CC_Base_L_Hand, R: peak.bones.CC_Base_R_Hand, Li: peak.bones.CC_Base_L_Index3, Ri: peak.bones.CC_Base_R_Index3 }, target: peak.target, heart: peak.heart, gap: report.gap, hold: report.hold }));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
