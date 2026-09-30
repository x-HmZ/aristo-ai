// Dropped frames (rAF gaps over 25ms) by section while wheel-scrolling. Usage: node dbg-drops.cjs <base> [WxH] [query]
const { chromium, sleep, LAUNCH, themedContext } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base, size = "1280x800", q = ""] = process.argv;
const [w, h] = size.split("x").map(Number);
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await themedContext(b, "light", { width: w, height: h });
  const p = await ctx.newPage();
  if (process.env.CSS) await ctx.addInitScript((css) => { document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }); }, process.env.CSS);
  await p.goto(base + "/" + q, { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.stage && document.documentElement.dataset.stage !== "loading", null, { timeout: 60000 });
  await sleep(2000);
  await p.evaluate(() => {
    const ids = ["top", "idea", "how", "moves", "map", "parents", "start"];
    const S = () => { for (let i = ids.length - 1; i >= 0; i--) { const el = document.getElementById(ids[i]); const r = el.getBoundingClientRect(); if (r.top <= 0) { const tr = ids[i] === "parents" ? el.offsetHeight : el.offsetHeight - innerHeight; return i + Math.min(1, -r.top / tr); } } return 0; };
    window.__b = {}; let last = performance.now();
    const tick = (t) => { const d = t - last; last = t; const k = (Math.floor(S() * 4) / 4).toFixed(2); const e = (window.__b[k] ??= [0, 0]); e[0]++; if (d > 25) e[1]++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await p.mouse.move(w / 2, h / 2);
  while ((await p.evaluate(() => scrollY)) < total - 2) { await p.mouse.wheel(0, 100); await sleep(16); }
  const out = await p.evaluate(() => window.__b);
  console.log(Object.entries(out).sort((a, b) => a[0] - b[0]).map(([k, [n, d]]) => `${k}:${d}/${n}`).join("  "));
  await b.close();
})();
