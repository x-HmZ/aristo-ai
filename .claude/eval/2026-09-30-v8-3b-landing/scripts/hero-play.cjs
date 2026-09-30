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
  const looks = [["headline", 300, 330], ["buttons", 250, 570], ["above", 1100, 110], ["below", 940, 760]];
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
  await act("yourturn", () => p.hover("a[href='/demo'] >> nth=1").catch(() => p.mouse.move(165, 568, { steps: 6 })), (bo) => z("CC_Base_L_Hand")(bo) + z("CC_Base_R_Hand")(bo));
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
