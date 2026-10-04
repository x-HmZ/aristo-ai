// V8.3c follow-up: /demo's topics after the brain lesson joined and the volcano lost its model. The picker (three
// topics), then the brain lesson playing (its narration fetched, its board picture, "View in 3D" offered), then the
// volcano lesson (no "View in 3D"). Screenshots in ../demo/, a JSON report on stdout. 0 API and 0 paid calls.
// Usage: node demo-brain.cjs [base] [teacher]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi, sceneReady } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3100", teacher = "jake"] = process.argv;
const OUT = path.join(__dirname, "..", "demo");
fs.mkdirSync(OUT, { recursive: true });

async function open(b, report, slugTitle, file) {
  const ctx = await themedContext(b, "light", { width: 1280, height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  const audio = [];
  p.on("response", (r) => { if (/\/demo\/.+\.(mp3|align\.json|glb|png|webp)$/.test(r.url())) audio.push(`${r.status()} ${r.url().split("/demo/")[1]}`); });
  p.on("pageerror", (e) => report.errors.push(String(e).slice(0, 200)));
  await p.goto(base + `/demo${teacher === "jake" ? "" : `?teacher=${teacher}`}`, { waitUntil: "load" });
  await sceneReady(p);
  if (!slugTitle) {
    await sleep(800);
    const topics = await p.evaluate(() => [...document.querySelectorAll("button")].map((x) => x.textContent?.trim() ?? "").filter((t) => /Volcano|Heart|Brain/.test(t)));
    await p.screenshot({ path: path.join(OUT, file) });
    await ctx.close();
    return { topics };
  }
  await p.getByRole("button", { name: new RegExp(slugTitle) }).first().click();
  // Let the lesson run until its picture and its 3D offer (or 70 s without one).
  const view3d = await p.getByRole("button", { name: /View in 3D/i }).first().waitFor({ timeout: 70000 }).then(() => 1, () => 0);
  await sleep(1500);
  await p.screenshot({ path: path.join(OUT, file) });
  await ctx.close();
  return { view3d, assets: audio.slice(0, 12) };
}

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], errors: [] };
  const picker = await open(b, report, null, `picker-${teacher}.png`);
  const brain = await open(b, report, "Brain", `brain-${teacher}.png`);
  const volcano = await open(b, report, "Volcano", `volcano-${teacher}.png`);
  console.log(JSON.stringify({ picker, brain, volcano, api: report.api.length, paid: report.paid.length, errors: report.errors }, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
