// /demo in the new shirts (V8.3d), both teachers: the classroom loads, the teacher draws in the loose cloth and its
// colour, no console errors, 0 API and 0 paid calls (the demo is pre-rendered). After ../../2026-10-03-v8-3c-landing/
// scripts/demo-smoke.cjs, with `?teacher=`. Usage: node demo-shirts.cjs [base]   -> ../demo/<teacher>.png
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi, sceneReady } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3000"] = process.argv;
const OUT = path.join(__dirname, "..", "demo");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(LAUNCH);
  for (const teacher of ["jake", "mj"]) {
    const report = { api: [], paid: [], errors: [] };
    const ctx = await themedContext(b, "light", { width: 1280, height: 800 });
    const p = await ctx.newPage();
    await guardApi(p, report);
    p.on("console", (m) => { if (m.type() === "error" && !/api\/|Failed to load resource/.test(m.text())) report.errors.push(m.text().slice(0, 200)); });
    p.on("pageerror", (e) => report.errors.push(String(e).slice(0, 200)));
    await p.goto(base + `/demo?teacher=${teacher}`, { waitUntil: "load" });
    await sceneReady(p);
    await sleep(2000);
    await p.screenshot({ path: path.join(OUT, `${teacher}-picker.png`) });
    // A lesson (pre-rendered, free): the teacher in front of the class, in the cloth.
    await p.getByText("How Your Brain Is Organised").click();
    await sleep(9000);
    await p.screenshot({ path: path.join(OUT, `${teacher}.png`) });
    console.log(teacher, JSON.stringify({ errors: report.errors, api: report.api.length, paid: report.paid.length }));
    await ctx.close();
  }
  await b.close();
})();
