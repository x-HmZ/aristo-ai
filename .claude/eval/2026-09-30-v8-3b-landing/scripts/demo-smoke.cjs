// /demo after the landing's changes to shared classroom code (SceneLights moved to three/SceneBits): the page loads,
// the classroom and the teacher draw, no console errors, 0 API and 0 paid calls. Usage: node demo-smoke.cjs <out.png> [base]
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi, sceneReady } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "build/demo-smoke.png", base = "http://localhost:3000"] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], errors: [] };
  const ctx = await themedContext(b, "light", { width: 1280, height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  p.on("console", (m) => { if (m.type() === "error" && !/api\/|Failed to load resource/.test(m.text())) report.errors.push(m.text().slice(0, 200)); });
  p.on("pageerror", (e) => report.errors.push(String(e).slice(0, 200)));
  await p.goto(base + "/demo", { waitUntil: "load" });
  await sceneReady(p);
  await sleep(4000);
  await p.screenshot({ path: path.resolve(__dirname, "..", out) });
  console.log(JSON.stringify({ errors: report.errors, api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
