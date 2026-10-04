// Checks for two code-review fixes (V8.3b, session 3):
// 1. The room loads only near Step Into the Classroom: no request for classroom_default.glb while the reader stays
//    at the hero (Jake live, 8 s), one once they scroll near the section.
// 2. Leaving / by a client-side link and coming back (Back) starts the page fresh: the model section, built before
//    leaving, starts again from its first step.
// Usage: node review-fixes.cjs [base] [width]
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3000", width = "1280"] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, "light", { width: Number(width), height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  const room = [];
  p.on("request", (r) => { if (r.url().includes("classroom_default.glb")) room.push(Date.now()); });
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
  await sleep(8000);
  const atHero = room.length;
  const glide = async (sel) => {
    const y = await p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); }, sel);
    const from = await p.evaluate(() => scrollY);
    const n = Math.max(1, Math.ceil(Math.abs(y - from) / 160));
    for (let i = 1; i <= n; i++) { await p.evaluate((q) => scrollTo(0, q), from + ((y - from) * i) / n); await sleep(30); }
  };
  // The model section, built.
  await glide("[data-spot=model]");
  await p.waitForFunction(() => document.querySelector('[aria-label="The build"] [aria-current]')?.textContent?.includes("The model"), null, { timeout: 30000 });
  await glide("[data-spot=room]");
  await sleep(3000);
  const nearRoom = room.length;
  // Away by a client-side link, and Back.
  await p.evaluate(() => { scrollTo(0, 0); });
  await sleep(300);
  await p.click('#top a[href="/demo"]');
  await p.waitForURL("**/demo", { timeout: 60000 });
  await sleep(2000);
  await p.goBack();
  await p.waitForFunction(() => document.querySelector("[data-spot=hero]"), null, { timeout: 60000 });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
  await glide("[data-spot=model]");
  await sleep(400);
  const stepAfterBack = await p.evaluate(() => document.querySelector('[aria-label="The build"] [aria-current]')?.textContent?.trim());
  console.log(JSON.stringify({ roomRequestsAtHero: atHero, roomRequestsNearRoom: nearRoom, modelStepJustAfterBack: stepAfterBack, api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
