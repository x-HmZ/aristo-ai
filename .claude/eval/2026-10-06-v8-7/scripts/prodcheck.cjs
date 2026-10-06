// V8.7 production check on `next start`: the public routes in both themes at 360 and 1280 (AA, overflow, API calls),
// plus the link-preview image (a 1200x630 PNG). Nothing is clicked or submitted.
//   node prodcheck.cjs <label> [baseUrl]
const fs = require("fs");
const path = require("path");
const { sleep, LAUNCH, chromium, themedContext, guardApi, sceneReady } = require("./common.cjs");
const { AA } = require("./check.cjs");

const label = process.argv[2] || "prod";
const base = process.argv[3] || "http://localhost:3100";
const OUT = path.join(__dirname, "..", label);
fs.mkdirSync(OUT, { recursive: true });
const H = { 360: 780, 1280: 800 };
const ROUTES = [
  ["landing", "/?nointro", false],
  ["demo", "/demo", true],
  ["sign-in", "/sign-in", false],
  ["sign-up", "/sign-up", false],
];

(async () => {
  // The link-preview image first: a PNG, 1200x630.
  const res = await fetch(`${base}/opengraph-image`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(OUT, "opengraph-image.png"), buf);
  const dims = { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  console.log(`opengraph-image: ${res.status} ${res.headers.get("content-type")} ${buf.length} bytes ${dims.w}x${dims.h}`);

  const browser = await chromium.launch(LAUNCH);
  const report = { og: { status: res.status, bytes: buf.length, ...dims }, api: [], paid: [], shots: {} };
  for (const theme of ["light", "dark"]) for (const w of [360, 1280]) for (const [name, url, scene] of ROUTES) {
    const key = `${name}-${w}-${theme}`;
    const ctx = await themedContext(browser, theme, { width: w, height: H[w] });
    const page = await ctx.newPage();
    await guardApi(page, report);
    try {
      await page.goto(base + url, { waitUntil: "domcontentloaded" });
      if (scene) await sceneReady(page).catch(() => {});
      await sleep(scene ? 1500 : 2500);
      await page.screenshot({ path: path.join(OUT, `${key}.jpg`), type: "jpeg", quality: 74 });
      await page.evaluate(() => { window.__occl = true; });
      const aa = await page.evaluate(AA, "");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      report.shots[key] = { n: aa.length, min: aa.length ? Math.min(...aa.map((r) => r.ratio)) : null, fails: aa.filter((r) => r.ratio < r.need).map((r) => `${r.t} | ${r.ratio} | ${r.fg} on ${r.bg}`), overflow };
      const s = report.shots[key];
      console.log(`${key}: n=${s.n} min=${s.min} fails=${s.fails.length} overflow=${overflow}`);
    } catch (e) { report.shots[key] = { error: String(e.message || e) }; console.log(`${key}: ERROR ${e.message}`); }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report-prod.json"), JSON.stringify(report, null, 1));
  console.log(`api at network: ${report.api.length}, paid: ${report.paid.length}`);
})();
