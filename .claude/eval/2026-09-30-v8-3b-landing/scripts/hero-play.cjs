// The hero's play (V8.3b, Hmz: a hello and some fun, no lesson). Live at 1280: after the arrival wave,
//   1. the mouse at three places (the headline, the calls to action, above him): where he looks;
//   2. hovering Try a lesson: "your turn" (peak = both hands furthest towards the reader);
//   3. hovering Create an account: the nod (peak = the head lowest);
//   4. a tap on him: the wave again (peak = a hand highest);
//   5. leaving the page for 3.5 s and coming back: the welcome-back wave.
// Each writes a strip of frames and the peak frame; play.json has the bones per frame. Usage:
// node hero-play.cjs <outdir> [base] [theme]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , out = "build/hero-play", base = "http://localhost:3000", theme = "light"] = process.argv;
const OUT = path.join(__dirname, "..", out, theme);
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], acts: {} };
  const ctx = await themedContext(b, theme, { width: 1280, height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/?probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]") && window.__landing, null, { timeout: 90000 });
  await p.mouse.move(900, 300);
  await sleep(3500);
  const box = await p.evaluate(() => { const r = document.querySelector("[data-spot=hero]").getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  const clip = { x: Math.max(0, box.x - 20), y: Math.max(0, box.y), width: Math.min(1280 - box.x + 20, box.width + 40), height: box.height };
  const bones = () => p.evaluate(() => window.__landing.bones());

  // 1. Where he looks.
  const at = (sel) => p.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const looks = [["headline", ...(await at("#hero-title"))], ["buttons", ...(await at("main a[href='/sign-up']"))], ["above", box.x + box.width * 0.3, 90], ["below-left", 40, 760]];
  const lookShots = [];
  for (const [name, x, y] of looks) {
    await p.mouse.move(x, y, { steps: 12 });
    await sleep(900);
    const f = path.join(OUT, `look-${name}.png`);
    await p.screenshot({ path: f, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    lookShots.push(f);
  }

  // 2 to 5: a strip of frames per act, each with its bones.
  async function act(name, start, measure, ms = 2600) {
    await p.mouse.move(900, 300, { steps: 4 });
    await sleep(3300); // past the per-act cool-downs
    await start();
    const t0 = Date.now(), frames = [];
    while (Date.now() - t0 < ms) {
      const bo = await bones();
      const file = path.join(OUT, `${name}-${String(frames.length).padStart(2, "0")}.png`);
      await p.screenshot({ path: file, clip });
      frames.push({ ms: Date.now() - t0, file, bones: bo });
    }
    const peak = frames.reduce((a, f) => (measure(f.bones) > measure(a.bones) ? f : a), frames[0]);
    fs.copyFileSync(peak.file, path.join(OUT, `${name}-peak.png`));
    const pick = frames.filter((_, i) => i % 2 === 0).slice(0, 8);
    const tw = 200, th = Math.round((clip.height / clip.width) * tw);
    const tiles = await Promise.all(pick.map((f) => sharp(f.file).resize({ width: tw }).toBuffer()));
    await sharp({ create: { width: tw * tiles.length, height: th, channels: 3, background: "#222" } })
      .composite(tiles.map((t, k) => ({ input: t, left: k * tw, top: 0 }))).png().toFile(path.join(OUT, `${name}-strip.png`));
    report.acts[name] = { frames: frames.length, peakMs: peak.ms, peak: peak.bones };
    console.log(name, "frames", frames.length, "peak at", peak.ms, "ms");
  }
  const z = (k) => (bo) => bo[k][2];
  // Try a lesson: the palm-up offer (PresentModel), left hand. Its peak is his left fingertip furthest towards the
  // button; there the reach
  // (shoulder to hand) is compared with the line from the shoulder to the button's centre, and the frame is marked.
  {
    await p.mouse.move(900, 300, { steps: 4 });
    await sleep(3300);
    const btn = await p.evaluate(() => { const a = [...document.querySelectorAll("main a[href='/demo']")][0]; const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.move(btn.x, btn.y, { steps: 8 });
    const t0 = Date.now(), frames = [];
    while (Date.now() - t0 < 2600) {
      const facts = await p.evaluate(() => { const L = window.__landing, bo = L.bones(); return { bo, sh: L.toPage(bo.CC_Base_L_Upperarm), hand: L.toPage(bo.CC_Base_L_Hand), tip: L.toPage(bo.CC_Base_L_Index3), head: L.toPage(bo.CC_Base_Head), sy: scrollY }; });
      const file = path.join(OUT, `offer-${String(frames.length).padStart(2, "0")}.png`);
      await p.screenshot({ path: file });
      frames.push({ ms: Date.now() - t0, file, ...facts });
    }
    const reach = (f) => Math.hypot(f.hand.x - f.sh.x, f.hand.y - f.sh.y);
    // The peak: the hand furthest from where it rested before the gesture (the reach alone cannot tell: the arm is as
    // long hanging down as held out).
    const moved = (f) => Math.hypot(f.hand.x - frames[0].hand.x, f.hand.y - frames[0].hand.y);
    // The offer's peak: his left fingertip furthest towards the button (screen right).
    const peak = frames.reduce((a, f) => (f.tip.x > a.tip.x ? f : a), frames[0]);
    report.offerTrack = frames.map((f) => ({ ms: f.ms, hand: [Math.round(f.hand.x), Math.round(f.hand.y)], tip: [Math.round(f.tip.x), Math.round(f.tip.y)], sh: [Math.round(f.sh.x), Math.round(f.sh.y)] }));
    const sy = peak.sy;
    const ang = (ax, ay, bx, by) => Math.atan2(ay, ax) - Math.atan2(by, bx);
    const d = ang(peak.tip.x - peak.sh.x, peak.tip.y - peak.sh.y, btn.x - peak.sh.x, btn.y + sy - peak.sh.y);
    const deg = Math.abs(((d * 180) / Math.PI + 540) % 360 - 180);
    const rest = frames[0];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
      <line x1="${peak.sh.x}" y1="${peak.sh.y - sy}" x2="${btn.x}" y2="${btn.y}" stroke="#2f7cf9" stroke-width="2" stroke-dasharray="6 4"/>
      <line x1="${peak.sh.x}" y1="${peak.sh.y - sy}" x2="${peak.tip.x}" y2="${peak.tip.y - sy}" stroke="#f97b2f" stroke-width="3"/>
      <circle cx="${peak.tip.x}" cy="${peak.tip.y - sy}" r="5" fill="none" stroke="#fff" stroke-width="3"/>
      <circle cx="${btn.x}" cy="${btn.y}" r="8" fill="none" stroke="#2f7cf9" stroke-width="3"/></svg>`;
    await sharp(peak.file).composite([{ input: Buffer.from(svg) }]).png().toFile(path.join(OUT, "offer-peak-marked.png"));
    const tw = 320;
    const pick = frames.filter((_, i) => i % 3 === 0).slice(0, 6);
    const tiles = await Promise.all(pick.map((f) => sharp(f.file).extract({ left: 60, top: 80, width: 1180, height: 700 }).resize({ width: tw }).toBuffer()));
    const th = Math.round((700 / 1180) * tw);
    await sharp({ create: { width: tw * tiles.length, height: th, channels: 3, background: "#222" } })
      .composite(tiles.map((t, k) => ({ input: t, left: k * tw, top: 0 }))).png().toFile(path.join(OUT, "offer-strip.png"));
    report.acts.offer = { frames: frames.length, peakMs: peak.ms, reachVsButtonDeg: +deg.toFixed(1), reachPx: +reach(peak).toFixed(0), movedPx: +moved(peak).toFixed(0), restReachPx: +reach(rest).toFixed(0) };
    console.log("offer", JSON.stringify(report.acts.offer));
  }
  await act("nod", () => p.mouse.move(356, 568, { steps: 6 }), (bo) => -bo.CC_Base_Head[1]);
  await act("tap", () => p.click("button[aria-label='Say hi to Jake']"), (bo) => Math.max(bo.CC_Base_L_Hand[1], bo.CC_Base_R_Hand[1]), 3000);
  await act("welcome", async () => {
    await p.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave")));
    await sleep(3600);
    await p.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseenter")));
  }, (bo) => Math.max(bo.CC_Base_L_Hand[1], bo.CC_Base_R_Hand[1]), 3000);

  const tiles = await Promise.all(lookShots.map((f) => sharp(f).extract({ left: 0, top: 80, width: 1280, height: 640 }).resize({ width: 400 }).toBuffer()));
  await sharp({ create: { width: 1600, height: 200, channels: 3, background: "#222" } }).composite(tiles.map((t, k) => ({ input: t, left: k * 400, top: 0 }))).png().toFile(path.join(OUT, "looks.png"));
  fs.writeFileSync(path.join(OUT, "play.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
