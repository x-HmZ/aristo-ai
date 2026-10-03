const { chromium, sleep, LAUNCH } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.on("console", (m) => console.log("console:", m.type(), m.text().slice(0, 200)));
  p.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 300)));
  await p.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => new MutationObserver(() => console.log("intro=" + document.documentElement.dataset.intro + " at " + Math.round(performance.now()))).observe(document.documentElement, { attributes: true, attributeFilter: ["data-intro"] }));
  });
  await p.goto("http://localhost:3000/?introdebug", { waitUntil: "load" });
  await sleep(4000);
  console.log(await p.evaluate(() => ({ intro: document.documentElement.dataset.intro, teacher: document.documentElement.dataset.teacher, seek: typeof window.__introSeek, mj: [...document.querySelectorAll('[data-spot="hero"] img')].map((i) => i.className + " => " + getComputedStyle(i).display) })));
  await b.close();
})();
