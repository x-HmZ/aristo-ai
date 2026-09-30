const { chromium, sleep, LAUNCH, themedContext } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base, Sarg = "3.1"] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await themedContext(b, "light", { width: 1280, height: 800 });
  const p = await ctx.newPage();
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.stage === "live", null, { timeout: 60000 });
  const S = Number(Sarg);
  const y = await p.evaluate((S) => { const ids = ["top","idea","how","moves","map","parents","start"]; const i = Math.floor(S); const el = document.getElementById(ids[i]); return Math.round(el.getBoundingClientRect().top + scrollY + (S - i) * (el.offsetHeight - innerHeight)); }, S);
  for (let i = 1; i <= 30; i++) { await p.evaluate((v) => scrollTo(0, v), Math.round((y * i) / 30)); await sleep(40); }
  await sleep(2500);
  console.log(await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      if (![...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
      let op = 1; for (let q = el; q && q !== document.body; q = q.parentElement) op *= +getComputedStyle(q).opacity;
      if (op > 0.02 && op < 0.98) out.push(op.toFixed(2) + " " + el.textContent.trim().slice(0, 30));
    }
    return out;
  }));
  await b.close();
})();
