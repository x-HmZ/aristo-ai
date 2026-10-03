// The close's offer (V8.3b, session 3, Hmz): pointing at Try a lesson there gets the hero's palm-up offer towards it.
// After his arrival wave, the button gets a pointerenter; his bones are sampled (`?probe`) and, at the offer's peak
// (his left fingertip furthest towards the button), the page angle between shoulder-to-fingertip and
// shoulder-to-button's-centre, with a screenshot. Usage: node close-offer.cjs <outdir> [base] [theme] [width]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "build/close-offer", base = "http://localhost:3000", theme = "light", width = "1280"] = process.argv;
const OUT = path.join(__dirname, "..", out, `${theme}-${width}`);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, theme, { width: Number(width), height: 900 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/?probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
  await sleep(5000);
  const y = await p.evaluate(() => { const r = document.querySelector("[data-spot=close]").getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); });
  for (let v = 0; v <= y; v += 160) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
  await p.evaluate((q) => scrollTo(0, q), y);
  await p.waitForFunction(() => document.querySelector("[data-spot=close][data-live]") && window.__landing?.spot === "close", null, { timeout: 60000 });
  await sleep(4500);
  // A real mouse move onto it (React builds onPointerEnter from pointerover at its root; a dispatched pointerenter
  // never reaches it).
  await p.hover('#start a[href="/demo"]');
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 3200) {
    const s = await p.evaluate(() => {
      const L = window.__landing, bo = L.bones(), pg = (k) => L.toPage(bo[k]);
      const btn = document.querySelector('#start a[href="/demo"]').getBoundingClientRect();
      return { sh: pg("CC_Base_L_Upperarm"), tip: pg("CC_Base_L_Index3"), wrist: pg("CC_Base_L_Hand"), btn: { x: btn.left + btn.width / 2 + scrollX, y: btn.top + btn.height / 2 + scrollY }, liftL: bo.CC_Base_L_Hand[1] };
    });
    s.ms = Date.now() - t0;
    s.file = `f${String(samples.length).padStart(3, "0")}.png`;
    const box = await p.evaluate(() => { const r = document.querySelector("#start").getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top), width: innerWidth, height: Math.min(innerHeight, r.bottom) - Math.max(0, r.top) }; });
    await p.screenshot({ path: path.join(OUT, s.file), clip: box });
    samples.push(s);
    await sleep(40);
  }
  const ang = (a, c) => (Math.atan2(c.y - a.y, c.x - a.x) * 180) / Math.PI;
  const pk = samples.reduce((m, s) => (s.tip.x > m.tip.x ? s : m));
  const res = {
    peakMs: pk.ms, handUp: pk.liftL > -0.3, liftL: +pk.liftL.toFixed(2),
    armToButtonDeg: +Math.abs(ang(pk.sh, pk.tip) - ang(pk.sh, pk.btn)).toFixed(1),
    handToButtonDeg: +Math.abs(ang(pk.wrist, pk.tip) - ang(pk.wrist, pk.btn)).toFixed(1),
    tipToButtonPx: Math.round(Math.hypot(pk.btn.x - pk.tip.x, pk.btn.y - pk.tip.y)),
    api: report.api.length, paid: report.paid.length,
  };
  fs.copyFileSync(path.join(OUT, pk.file), path.join(OUT, "offer-peak.png"));
  fs.writeFileSync(path.join(OUT, "offer.json"), JSON.stringify({ ...res, samples }, null, 0));
  console.log(JSON.stringify(res));
  await b.close();
})();
