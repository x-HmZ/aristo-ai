// Step Into the Classroom (V8.3b, session 3): the room tour's two gestures at their peaks, from Jake's bones (`?probe`).
// - Pointing ("Take a look at this cross-section"): the frame his left index is highest; the angle between the finger
//   (knuckle to tip) and the line from the knuckle to its target (room.ts AIM_PICTURE), and how far the finger's line
//   passes from the target on the page.
// - PresentModel (the model appears): the frame his left fingertip reaches furthest towards the model; the gap from his
//   fingertip to the model's real bounds (`landing-room-model-solid`, without its ring), and his palm's height on it.
// Usage: node room-peaks.cjs <outdir> [base] [theme] [width]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "build/room-peaks", base = "http://localhost:3000", theme = "light", width = "1280"] = process.argv;
const OUT = path.join(__dirname, "..", out, `${theme}-${width}`);
fs.mkdirSync(OUT, { recursive: true });
const W = Number(width);
// room.ts: the picture's place (scripts.ts PICTURE_PLACE) and the finger's target on it.
const K = (0.9 + 3.3) / (0.9 + 3);
const PIC = { x: 0.37 * K, y: 0.18 * K, z: -3.3, size: 1.455 * K };
const AIM = [PIC.x + (0.51 - 0.5) * PIC.size, PIC.y + (0.5 - 0.5) * PIC.size, PIC.z];
const WINDOWS = { point: [8.3, 11.4], present: [17.4, 20.6] };

const READ = () => {
  const L = window.__landing;
  const bones = L.bones();
  return { t: L.clock(), bones, page: Object.fromEntries(Object.entries(bones).map(([k, v]) => [k, L.toPage(v)])), model: L.bounds("landing-room-model-solid"), scroll: scrollY,
    near: L.clock() > 17.4 ? L.nearest("landing-room-model-solid", bones.CC_Base_L_Index3) : null };
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], samples: [] };
  const ctx = await themedContext(b, theme, { width: W, height: 900 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/?probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
  const y = await p.evaluate(() => { const r = document.querySelector("[data-spot=room]").getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); });
  for (let v = 0; v <= y; v += 160) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
  await p.evaluate((q) => scrollTo(0, q), y);
  await p.waitForFunction(() => document.querySelector("[data-spot=room][data-live]") && window.__landing?.spot === "room", null, { timeout: 90000 });
  const box = await p.evaluate(() => { const r = document.querySelector("[data-spot=room]").getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  let i = 0;
  for (;;) {
    const f = await p.evaluate(READ);
    const inWin = Object.entries(WINDOWS).find(([, [a, c]]) => f.t >= a && f.t <= c);
    if (inWin) {
      f.file = `f${String(i).padStart(3, "0")}.png`;
      f.aimPage = await p.evaluate((a) => window.__landing.toPage(a), AIM);
      await p.screenshot({ path: path.join(OUT, f.file), clip: box });
      f.win = inWin[0];
      report.samples.push(f);
      i++;
    }
    if (f.t > WINDOWS.present[1]) break;
    await sleep(inWin ? 20 : 120);
  }
  const S = report.samples;
  const sub = (a, c) => a.map((v, k) => v - c[k]);
  const norm = (v) => Math.hypot(...v);
  const ang = (u, v) => (Math.acos(Math.max(-1, Math.min(1, u.reduce((s, x, k) => s + x * v[k], 0) / (norm(u) * norm(v))))) * 180) / Math.PI;
  // Pointing: the highest left index tip.
  const pts = S.filter((s) => s.win === "point");
  const pk = pts.reduce((a, s) => (s.bones.CC_Base_L_Index3[1] > a.bones.CC_Base_L_Index3[1] ? s : a));
  const k1 = pk.bones.CC_Base_L_Index1, k3 = pk.bones.CC_Base_L_Index3, sh = pk.bones.CC_Base_L_Upperarm;
  // The finger's line on the page, and the target's distance from it (px), with the tip's own distance.
  const a = pk.page.CC_Base_L_Index1, c = pk.page.CC_Base_L_Index3, q = pk.aimPage;
  const dx = c.x - a.x, dy = c.y - a.y, len = Math.hypot(dx, dy);
  const lineMiss = Math.abs((q.x - a.x) * dy - (q.y - a.y) * dx) / len;
  const point = {
    t: +pk.t.toFixed(2), file: pk.file,
    fingerDeg: +ang(sub(k3, k1), sub(AIM, k1)).toFixed(1),
    armDeg: +ang(sub(k3, sh), sub(AIM, sh)).toFixed(1),
    lineMissPx: +lineMiss.toFixed(1),
    tipToTargetPx: +Math.hypot(q.x - c.x, q.y - c.y).toFixed(0),
    // Where on the picture the tip is, in shares of its side (0,0 top left), seen from the camera: its page point
    // against the picture's page corners.
  };
  // PresentModel: the left index tip nearest the model's bounds.
  const prs = S.filter((s) => s.win === "present" && s.model);
  // The gap to the model's real surface: its nearest vertex to his fingertip.
  const gapOf = (s) => (s.near ? s.near.distance : Infinity);
  const pp = prs.reduce((m, s) => (gapOf(s) < gapOf(m) ? s : m));
  const m = pp.model, tip = pp.bones.CC_Base_L_Index3, palm = pp.bones.CC_Base_L_Hand;
  const present = {
    t: +pp.t.toFixed(2), file: pp.file,
    tipToSurfaceM: +gapOf(pp).toFixed(3),
    tipLeftOfBounds: +(m.min[0] - tip[0]).toFixed(3),
    nearestVertex: pp.near.point.map((v) => +v.toFixed(3)),
    tip: tip.map((v) => +v.toFixed(3)),
    tipInsideDepth: tip[2] >= m.min[2] && tip[2] <= m.max[2],
    tipZ: +tip[2].toFixed(3), modelZ: [+m.min[2].toFixed(3), +m.max[2].toFixed(3)],
    palmHeightOnModel: +((palm[1] - m.min[1]) / (m.max[1] - m.min[1])).toFixed(2),
    model: { min: m.min.map((v) => +v.toFixed(3)), max: m.max.map((v) => +v.toFixed(3)) },
  };
  const res = { theme, width: W, point, present, api: report.api.length, paid: report.paid.length };
  fs.writeFileSync(path.join(OUT, "peaks.json"), JSON.stringify({ ...res, samples: S }, null, 0));
  fs.copyFileSync(path.join(OUT, pk.file), path.join(OUT, "point-peak.png"));
  fs.copyFileSync(path.join(OUT, pp.file), path.join(OUT, "present-peak.png"));
  console.log(JSON.stringify(res));
  await b.close();
})();
