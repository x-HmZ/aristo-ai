// V8.3c: the hero's teacher switch and the room's brain, live. Shots: the hero, mid-dissolve out, mid-form in, after
// the switch; then the room's model shot (the tab), its labels. Logs console errors and any /api call.
// Usage: node switch.cjs [base] [light|dark]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3000", scheme = "light"] = process.argv;
const OUT = path.join(__dirname, "..", "switch");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, reducedMotion: "no-preference" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("aristo-intro-seen", "1"); } catch {} });
  const p = await ctx.newPage();
  const report = { api: [], paid: [] };
  await guardApi(p, report);
  const errors = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  await p.goto(base + "/?full=1", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector('[data-spot="hero"][data-live]'), null, { timeout: 120000 });
  await sleep(2500);
  await p.screenshot({ path: path.join(OUT, `${scheme}-1-hero.png`) });
  const mj = p.getByRole("button", { name: "MJ" });
  await mj.hover();
  await sleep(4000); // the prewarm
  await mj.click();
  await sleep(250);
  await p.screenshot({ path: path.join(OUT, `${scheme}-2-out.png`) });
  await sleep(700);
  await p.screenshot({ path: path.join(OUT, `${scheme}-3-in.png`) });
  await sleep(2500);
  await p.screenshot({ path: path.join(OUT, `${scheme}-4-mj.png`) });
  const href = await p.getByRole("link", { name: "Try a lesson" }).first().getAttribute("href");
  // The room: scroll near it, wait for it, jump to the model shot.
  await p.evaluate(() => document.getElementById("immersive").scrollIntoView({ block: "center" }));
  await p.waitForFunction(() => document.querySelector('[data-spot="room"][data-live]'), null, { timeout: 120000 });
  await p.getByRole("button", { name: "The model" }).click();
  await sleep(3200);
  await p.locator('[data-spot="room"]').screenshot({ path: path.join(OUT, `${scheme}-5-room-model.png`) });
  await sleep(1500);
  await p.locator('[data-spot="room"]').screenshot({ path: path.join(OUT, `${scheme}-6-room-labels.png`) });
  console.log(JSON.stringify({ href, errors: errors.slice(0, 8), api: report.api.length, paid: report.paid.length }, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
