// V8.3c review fix: a click back during the switch is acted on once the switch ends. Clicks MJ, then Jake 0.9 s later
// (mid "in"), waits, and reads which shirt is on stage from the hero's pixels (forest green vs plum).
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , base = "http://localhost:3100"] = process.argv;
async function shirt(p) {
  const buf = await p.locator('[data-spot="hero"]').screenshot();
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let green = 0, plum = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (g > r + 25 && g > b) green++;
    if (r > g + 25 && b > g + 25) plum++;
  }
  return green > plum ? "jake" : "mj";
}
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("aristo-intro-seen", "1"); } catch {} });
  const p = await ctx.newPage();
  await guardApi(p, { api: [], paid: [] });
  await p.goto(base + "/?full=1", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector('[data-spot="hero"][data-live]'), null, { timeout: 60000 });
  await sleep(2500);
  const start = await shirt(p);
  await p.getByRole("button", { name: "MJ", exact: true }).hover();
  await sleep(4000);
  await p.getByRole("button", { name: "MJ", exact: true }).click();
  await sleep(900);
  await p.getByRole("button", { name: "Jake", exact: true }).click();
  await sleep(4500);
  const end = await shirt(p);
  const chosen = await p.evaluate(() => document.documentElement.dataset.teacher);
  console.log(JSON.stringify({ start, chosen, onStage: end, ok: end === chosen }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
