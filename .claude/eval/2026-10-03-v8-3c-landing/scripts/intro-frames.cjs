// V8.3c: the opening as a filmstrip, seeking its held clock (`?introdebug`) through its beats, at 1440 x 900.
// Usage: node intro.cjs [base] [light|dark] [width] [height]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , base = "http://localhost:3000", scheme = "dark", W = "1440", H = "900"] = process.argv;
const TIMES = (process.env.TIMES || "2.95,3.95").split(",").map(Number);
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, colorScheme: scheme });
  const p = await ctx.newPage();
  const report = { api: [], paid: [] };
  await guardApi(p, report);
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await p.goto(base + "/?introdebug", { waitUntil: "load" });
  await p.waitForFunction(() => window.__introSeek, null, { timeout: 60000 });
  await sleep(600);
  const tiles = [];
  for (const t of TIMES) {
    await p.evaluate((to) => window.__introSeek(to), t);
    await sleep(160);
    tiles.push({ t, buf: await p.screenshot() });
  }
  const w = +(process.env.TW || 480), h = Math.round((+H / +W) * w);
  const comps = await Promise.all(tiles.map(async ({ buf }, i) => ({ input: await sharp(buf).resize(w, h).toBuffer(), left: (i % (process.env.COLS ? +process.env.COLS : 4)) * (w + 4) + 4, top: Math.floor(i / 4) * (h + 4) + 4 })));
  const rows = Math.ceil(tiles.length / 4);
  const out = path.join(__dirname, "..", "intro", `strip-${scheme}-${W}.webp`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width: 4 * (w + 4) + 4, height: rows * (h + 4) + 4, channels: 3, background: "#777" } }).composite(comps).webp({ quality: 82 }).toFile(out);
  console.log(JSON.stringify({ out, errors, api: report.api.length, intro: await p.evaluate(() => document.documentElement.dataset.intro) }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
