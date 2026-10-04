// V8.3c: the switch's dissolve, frame by frame (every 80 ms from the click), cropped to the hero spot, as one strip.
// Usage: node dissolve-frames.cjs [base] [to]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , base = "http://localhost:3000", to = "MJ"] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("aristo-intro-seen", "1"); } catch {} });
  const p = await ctx.newPage();
  await guardApi(p, { api: [], paid: [] });
  await p.goto(base + "/?full=1", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector('[data-spot="hero"][data-live]'), null, { timeout: 120000 });
  await sleep(2500);
  const btn = p.getByRole("button", { name: to, exact: true });
  await btn.hover();
  await sleep(4000);
  const box = await p.locator('[data-spot="hero"]').boundingBox();
  await btn.click();
  const tiles = [];
  for (let i = 0; i < 20; i++) {
    tiles.push(await p.screenshot({ clip: box }));
    await sleep(80);
  }
  const w = 220, h = Math.round((box.height / box.width) * w);
  const comps = await Promise.all(tiles.map(async (t, i) => ({ input: await sharp(t).resize(w, h).toBuffer(), left: (i % 10) * w, top: Math.floor(i / 10) * h })));
  const out = path.join(__dirname, "..", "switch", `dissolve-to-${to}.webp`);
  await sharp({ create: { width: 10 * w, height: 2 * h, channels: 3, background: "#fff" } }).composite(comps).webp({ quality: 80 }).toFile(out);
  console.log("wrote", out);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
