// V8.3c: a video of the landing on the production build: the opening on a cold load, the hero going live, a switch to
// MJ and back, then the room's model shot. Usage: node record.cjs [base] [light|dark]   -> ../video/<theme>.webm
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3100", theme = "dark"] = process.argv;
const dir = path.join(__dirname, "..", "video");
fs.mkdirSync(dir, { recursive: true });
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: theme, recordVideo: { dir, size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage();
  await guardApi(p, { api: [], paid: [] });
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector('[data-spot="hero"][data-live]'), null, { timeout: 60000 });
  await sleep(3000);
  const mj = p.getByRole("button", { name: "MJ", exact: true });
  await mj.hover();
  await sleep(2500);
  await mj.click();
  await sleep(3500);
  await p.getByRole("button", { name: "Jake", exact: true }).click();
  await sleep(3500);
  await p.evaluate(() => document.getElementById("immersive").scrollIntoView({ block: "center", behavior: "smooth" }));
  await p.waitForFunction(() => document.querySelector('[data-spot="room"][data-live]'), null, { timeout: 60000 });
  await p.getByRole("button", { name: "The model" }).click();
  await sleep(7000);
  const video = p.video();
  await ctx.close();
  const out = path.join(dir, `${theme}.webm`);
  fs.renameSync(await video.path(), out);
  console.log(out, Math.round(fs.statSync(out).size / 1024), "kB");
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
