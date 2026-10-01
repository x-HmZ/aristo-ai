// One Lesson, Five Moves: each move's peak frame, from a track.cjs run (bones and the [data-track] marks per frame).
// The peak is chosen from his bones, not by eye; each graphic is measured against the hand that holds or sets it:
// - Activate (Imagine): the widest spread of the palms; each ring's top against the lowest point of the hand above it.
// - Explain (HoldIdea): the orb held, palms closest to level; the gap between the palms, the orb, its offset and the
//   clearance each side.
// - Demonstrate (StepBeat): each step's landing; the step's top against the chopping hand's lowest point.
// - Challenge (YourTurn): the palms highest while the card shows; the card's bottom edge against the palms' centres,
//   and where the palms are along it.
// - Connect (BringTogether): the hands closest; each end of the link against its palm.
// Writes moves-peaks.json and a marked frame per move, and a sheet of them.
// Usage: node moves-peaks.cjs <trackdir> <outdir>
const fs = require("fs");
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , dir, outDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const { samples } = require(path.resolve(dir, "track.json"));
const T = { at: [0.6, 4.2, 7.8, 13.0, 16.6], steps: [7.8, 9.5, 11.2], length: 20.4 };
const within = (a, b) => samples.filter((s) => s.t >= a && s.t < b);
const palm = (s, side) => { const w = s.page[`CC_Base_${side}_Hand`], k = s.page[`CC_Base_${side}_Index1`]; return { x: (w.x + k.x) / 2, y: (w.y + k.y) / 2 }; };
const low = (s, side) => ["Hand", "Index3", "Mid3", "Pinky3", "Thumb3"].map((n) => s.page[`CC_Base_${side}_${n}`]).filter((p) => p && Number.isFinite(p.y)).reduce((a, b) => (b.y > a.y ? b : a));
const centre = (m) => ({ x: m.x + m.w / 2, y: m.y + m.h / 2 });
const r1 = (v) => +v.toFixed(1);
const best = (list, f) => list.reduce((a, b) => (f(b) > f(a) ? b : a));

const peaks = [];
// Activate: the widest spread while both rings show.
{
  const list = within(T.at[0], T.at[1]).filter((s) => s.marks.ring0 && s.marks.ring1 && s.bones.CC_Base_L_Hand[1] > -0.02);
  const s = best(list, (x) => Math.hypot(palm(x, "L").x - palm(x, "R").x, palm(x, "L").y - palm(x, "R").y));
  const m = [["R", s.marks.ring0], ["L", s.marks.ring1]].map(([side, ring]) => {
    const lo = low(s, side), p = palm(s, side), c = centre(ring);
    return { side, ringTopBelowHandPx: r1(ring.y - lo.y), ringOffPalmXPx: r1(c.x - p.x), ringPx: r1(ring.w) };
  });
  peaks.push({ move: "activate", gesture: "Imagine", t: r1(s.t), s, measures: m, marks: ["ring0", "ring1"] });
}
// Explain: the orb fully shown, the palms most level.
{
  const list = within(T.at[1], T.at[2]).filter((s) => s.marks.orb && s.marks.orb.o > 0.95);
  const s = best(list, (x) => -Math.abs(palm(x, "L").y - palm(x, "R").y));
  const l = palm(s, "L"), r = palm(s, "R"), o = s.marks.orb, c = centre(o);
  peaks.push({ move: "explain", gesture: "HoldIdea", t: r1(s.t), s, marks: ["orb"], measures: {
    palmGapPx: r1(Math.hypot(l.x - r.x, l.y - r.y)), orbPx: r1(o.w), centreOffPx: r1(Math.hypot(c.x - (l.x + r.x) / 2, c.y - (l.y + r.y) / 2)), clearEachSidePx: r1((Math.abs(l.x - r.x) - o.w) / 2),
  } });
}
// Demonstrate: each step, the first frame it shows (the chop's landing).
for (let k = 0; k < 3; k++) {
  const s = samples.find((x) => x.t >= T.steps[k] && x.marks[`step${k}`]);
  if (!s) { peaks.push({ move: "demonstrate", step: k, missing: true }); continue; }
  const lo = low(s, "R"), d = s.marks[`step${k}`], c = centre(d);
  peaks.push({ move: "demonstrate", gesture: "StepBeat", step: k, t: r1(s.t), s, marks: [`step${k}`], measures: { stepTopBelowHandPx: r1(d.y - lo.y), stepOffHandXPx: r1(c.x - lo.x), handLift: r1(s.bones.CC_Base_R_Hand[1]) } });
}
// Challenge: the card shown, the palms highest.
{
  const list = within(T.at[3], T.at[4]).filter((s) => s.marks.card && s.marks.card.o > 0.95);
  const s = best(list, (x) => -(palm(x, "L").y + palm(x, "R").y));
  const l = palm(s, "L"), r = palm(s, "R"), c = s.marks.card;
  const along = (p) => r1((p.x - c.x) / c.w);
  peaks.push({ move: "challenge", gesture: "YourTurn", t: r1(s.t), s, marks: ["card"], measures: {
    cardBottomAbovePalmsPx: r1((l.y + r.y) / 2 - (c.y + c.h)), palmsAlongCard: [along(r), along(l)], cardPx: [r1(c.w), r1(c.h)],
  } });
}
// Connect: the hands closest while both ends show.
{
  const list = within(T.at[4], T.length + 1).filter((s) => s.marks.known && s.marks.idea && s.bones.CC_Base_L_Hand[1] > -0.1);
  const s = best(list, (x) => -Math.hypot(palm(x, "L").x - palm(x, "R").x, palm(x, "L").y - palm(x, "R").y));
  const l = palm(s, "L"), r = palm(s, "R"), a = centre(s.marks.known), b = centre(s.marks.idea);
  peaks.push({ move: "connect", gesture: "BringTogether", t: r1(s.t), s, marks: ["known", "idea", "next"], measures: {
    palmGapPx: r1(Math.hypot(l.x - r.x, l.y - r.y)), ringToRightPalmPx: r1(Math.hypot(a.x - r.x, a.y - r.y)), ideaToLeftPalmPx: r1(Math.hypot(b.x - l.x, b.y - l.y)), nextShown: !!s.marks.next,
  } });
}

(async () => {
  const tiles = [];
  for (const pk of peaks.filter((p) => !p.missing)) {
    const s = pk.s, cx = s.clip.x, cy = s.clip.y;
    const dot = (p, c, rr = 6) => `<circle cx="${p.x - cx}" cy="${p.y - cy}" r="${rr}" fill="none" stroke="${c}" stroke-width="2.5"/>`;
    let svg = "";
    for (const side of ["L", "R"]) { svg += dot(palm(s, side), "#2f7cf9"); svg += dot(low(s, side), "#1fa36a", 4); }
    for (const k of pk.marks) { const m = s.marks[k]; if (m) svg += `<rect x="${m.x - cx}" y="${m.y - cy}" width="${m.w}" height="${m.h}" fill="none" stroke="#1fa36a" stroke-width="1.5" stroke-dasharray="4 3"/>`; }
    const file = path.join(outDir, `moves-peak-${pk.move}${pk.step !== undefined ? pk.step : ""}.png`);
    await sharp(path.join(dir, s.file)).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.clip.width}" height="${s.clip.height}">${svg}</svg>`) }]).png().toFile(file);
    tiles.push({ file, label: `${pk.move}${pk.step !== undefined ? ` ${pk.step + 1}` : ""} (${pk.gesture}) t=${pk.t}` });
  }
  const tw = 300;
  const bufs = await Promise.all(tiles.map(async (t) => {
    const img = await sharp(t.file).resize({ width: tw }).toBuffer();
    const h = (await sharp(img).metadata()).height;
    const cap = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="26"><rect width="100%" height="100%" fill="#111"/><text x="8" y="18" font-family="sans-serif" font-size="13" fill="#fff">${t.label}</text></svg>`);
    return sharp({ create: { width: tw, height: h + 26, channels: 3, background: "#111" } }).composite([{ input: cap, top: 0, left: 0 }, { input: img, top: 26, left: 0 }]).png().toBuffer();
  }));
  const h = (await sharp(bufs[0]).metadata()).height;
  const cols = 4;
  await sharp({ create: { width: tw * cols, height: h * Math.ceil(bufs.length / cols), channels: 3, background: "#111" } })
    .composite(bufs.map((b, k) => ({ input: b, left: (k % cols) * tw, top: Math.floor(k / cols) * h }))).png().toFile(path.join(outDir, "moves-peaks.png"));
  const out = peaks.map(({ s, marks, ...rest }) => rest);
  fs.writeFileSync(path.join(outDir, "moves-peaks.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
