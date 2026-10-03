// The teacher at each cue: approach the beat from just before it, then five frames 400ms apart (the left 60% of the
// viewport, where he stands). One strip per cue in <outdir>. Usage: node gestures.cjs <outdir> [base]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , out = "gestures", base = "http://localhost:3000", only = ""] = process.argv;
// Each cue: [name, S, where to settle first, how long to settle]. A one-shot gesture still playing blocks the next
// (the director never interrupts), so a cue is approached from a settled point after the previous one has ended.
const OUT = path.join(__dirname, "..", out);
fs.mkdirSync(OUT, { recursive: true });
const CUES = [
  ["2.03-OneMoment-Thinking", 2.03], ["2.31-HoldIdea-cards", 2.31], ["2.63-PresentModel-diagram", 2.63], ["2.66-Pointing-diagram", 2.665],
  ["2.86-PresentModel-model", 2.86], ["2.91-Imagine-hook", 2.91], ["3.21-HoldIdea-explain", 3.21], ["3.41-StepBeat-demo", 3.41],
  ["3.49-Pointing-demo", 3.49], ["3.61-YourTurn-challenge", 3.61], ["3.81-BringTogether-connect", 3.81], ["3.98-ThatsIt-end", 3.985],
  ["6.00-Wave-goodbye", 6.0, 5.5, 1800],
].map(([n, S, from, wait]) => [n, S, from ?? S - 0.03, wait ?? 1800]).filter(([n]) => !only || only.split(",").some((o) => n.startsWith(o)));
CUES.find((c) => c[0].startsWith("3.21"))[2] = 3.12; CUES.find((c) => c[0].startsWith("3.21"))[3] = 3200;
CUES.find((c) => c[0].startsWith("3.41"))[2] = 3.33; CUES.find((c) => c[0].startsWith("3.41"))[3] = 3200;
const yFor = (S) => {
  const ids = ["top", "idea", "how", "moves", "map", "parents", "start"];
  const i = Math.min(ids.length - 1, Math.floor(S));
  const el = document.getElementById(ids[i]);
  const top = el.getBoundingClientRect().top + scrollY;
  const travel = Math.max(1, ids[i] !== "parents" ? el.offsetHeight - innerHeight : el.offsetHeight);
  return Math.round(top + (S - i) * travel);
};
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, "light", { width: 1280, height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.stage === "live", null, { timeout: 90000 });
  await p.addStyleTag({ content: "header, header *, main, main *, footer, footer * { visibility: hidden !important; }" });
  await sleep(3000);
  for (const [name, S, from, wait] of CUES) {
    // Settle before the cue, then step onto it, as a reader scrolling would.
    for (const s of [from, S]) {
      const y = await p.evaluate(yFor, s);
      const from = await p.evaluate(() => scrollY);
      const steps = Math.max(1, Math.ceil(Math.abs(y - from) / 250));
      for (let i = 1; i <= steps; i++) { await p.evaluate((v) => scrollTo(0, v), Math.round(from + ((y - from) * i) / steps)); await sleep(25); }
      await sleep(s === S ? 150 : wait);
    }
    const frames = [];
    for (let k = 0; k < 5; k++) { frames.push(await p.screenshot({ clip: { x: 0, y: 0, width: 768, height: 800 } })); await sleep(400); }
    const tiles = await Promise.all(frames.map((f) => sharp(f).resize({ width: 256 }).toBuffer()));
    await sharp({ create: { width: 256 * 5, height: 267, channels: 3, background: "#222" } })
      .composite(tiles.map((t, k) => ({ input: t, left: k * 256, top: 0 }))).png().toFile(path.join(OUT, `${name}.png`));
    console.log(name);
  }
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
