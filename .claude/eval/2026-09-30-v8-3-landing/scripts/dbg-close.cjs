const { chromium, sleep, LAUNCH, themedContext } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await themedContext(b, "light", { width: 1280, height: 800 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("ERR", e.message));
  await p.goto("http://localhost:3000/", { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.stage === "live", null, { timeout: 60000 });
  const y = await p.evaluate(() => { const s = document.getElementById("start"); return s.getBoundingClientRect().top + scrollY + 0.8 * (s.offsetHeight - innerHeight); });
  for (let i = 1; i <= 40; i++) { await p.evaluate((v) => scrollTo(0, v), Math.round((y * i) / 40)); await sleep(40); }
  await sleep(2500);
  console.log(await p.evaluate(() => {
    const s = document.getElementById("start"); const r = s.getBoundingClientRect();
    const layer = document.querySelector(".fixed.inset-0.z-0");
    const text = document.querySelector("#close-title").closest(".landing-beat");
    const tr = text.getBoundingClientRect();
    return { scrollY, startTop: r.top, layerOp: layer.style.opacity, clip: layer.style.clipPath, textOp: text.style.opacity, textRect: [tr.left, tr.top, tr.width, tr.height] };
  }));
  await p.screenshot({ path: "../dbg-close.png" });
  await b.close();
})();
