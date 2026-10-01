// Step Into the Classroom's controls, in the running page (V8.3b, session 3): a tab jumps the tour (the clock lands on
// the shot's start and plays on); a drag turns the view (and the next shot eases it back); Pause holds the clock; Hear
// it fetches the line's recording (the demo's own mp3, never an API). Screenshots of each state.
// Usage: node room-play.cjs <outdir> [base] [theme] [width]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "build/room-play", base = "http://localhost:3000", theme = "light", width = "1280"] = process.argv;
const OUT = path.join(__dirname, "..", out, `${theme}-${width}`);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], mp3: [], checks: {} };
  const ctx = await themedContext(b, theme, { width: Number(width), height: 900 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  p.on("request", (r) => { if (r.url().endsWith(".mp3") || r.url().includes(".mp3#")) report.mp3.push(r.url().replace(base, "")); });
  await p.goto(base + "/?probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
  const y = await p.evaluate(() => { const r = document.querySelector("[data-spot=room]").getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); });
  for (let v = 0; v <= y; v += 160) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
  await p.evaluate((q) => scrollTo(0, q), y);
  await p.waitForFunction(() => document.querySelector("[data-spot=room][data-live]"), null, { timeout: 90000 });
  const box = await p.evaluate(() => { const r = document.querySelector("[data-spot=room]").getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  const clock = () => p.evaluate(() => window.__landing.clock());
  const shot = (n) => p.screenshot({ path: path.join(OUT, `${n}.png`), clip: { ...box, height: box.height + 120 } });
  const tab = (name) => p.click(`[aria-label="The tour"] button:has-text("${name}")`);
  // A tab: "The model" lands at its start (17.2) and plays on.
  await sleep(1500);
  await tab("The model");
  const t1 = await clock();
  await sleep(2200);
  const t2 = await clock();
  report.checks.tab = { landed: +t1.toFixed(2), after2s: +t2.toFixed(2), current: await p.evaluate(() => document.querySelector('[aria-label="The tour"] [aria-current]')?.textContent) };
  await shot("tab-model");
  // A drag to the left turns the view right (towards the bookshelves).
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(cx - i * 20, cy - i * 4); await sleep(16); }
  await p.mouse.up();
  await sleep(300);
  await shot("drag");
  // Pause holds the clock.
  await p.click('[aria-label="Pause the tour"]');
  const p1 = await clock();
  await sleep(1200);
  const p2 = await clock();
  report.checks.pause = { held: Math.abs(p2 - p1) < 1e-6, at: +p1.toFixed(2) };
  await p.click('[aria-label="Play the tour"]');
  // Hear it: on "The board", the line's recording is fetched.
  await tab("The board");
  await p.click('button:has-text("Hear it")');
  await sleep(2500);
  report.checks.hear = { pressed: await p.evaluate(() => document.querySelector('button[aria-pressed]')?.getAttribute("aria-pressed")), mp3: [...new Set(report.mp3)] };
  await shot("board-hear");
  await p.click('button:has-text("Hear it")');
  // The desk.
  await tab("Your desk");
  await sleep(1800);
  await shot("desk");
  fs.writeFileSync(path.join(OUT, "play.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report.checks, api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
