// V8.3c follow-up: the room's picture becoming the model, frame by frame from the model shot (the tab), as a strip.
// Usage: node room-build.cjs [base] [teacher]
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , base = "http://localhost:3100", teacher = "jake"] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await guardApi(p, { api: [], paid: [] });
  await p.goto(base + `/?nointro&teacher=${teacher}`, { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector('[data-spot="hero"][data-live]'), null, { timeout: 60000 });
  await p.evaluate(() => document.getElementById("immersive").scrollIntoView({ block: "center" }));
  await p.waitForFunction(() => document.querySelector('[data-spot="room"][data-live]'), null, { timeout: 60000 });
  await p.getByRole("button", { name: "The board" }).click();
  await sleep(3000);
  await p.getByRole("button", { name: "The model" }).click();
  const box = await p.locator('[data-spot="room"]').boundingBox();
  const tiles = [];
  for (let i = 0; i < 12; i++) { tiles.push(await p.screenshot({ clip: box })); await sleep(110); }
  await sleep(2500);
  tiles.push(await p.screenshot({ clip: box }));
  const w = 480, h = Math.round((box.height / box.width) * w);
  const comps = await Promise.all(tiles.map(async (t, i) => ({ input: await sharp(t).resize(w, h).toBuffer(), left: (i % 4) * (w + 4) + 4, top: Math.floor(i / 4) * (h + 4) + 4 })));
  const out = path.join(__dirname, "..", "switch", `room-build-${teacher}.webp`);
  await sharp({ create: { width: 4 * (w + 4) + 4, height: Math.ceil(tiles.length / 4) * (h + 4) + 4, channels: 3, background: "#777" } }).composite(comps).webp({ quality: 82 }).toFile(out);
  console.log(out);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
