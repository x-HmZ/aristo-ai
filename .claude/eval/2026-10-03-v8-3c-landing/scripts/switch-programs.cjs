// V8.3c: which GL program the first switch to MJ compiles (the probe's program keys before and after).
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3000"] = process.argv;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("aristo-intro-seen", "1"); } catch {} });
  const p = await ctx.newPage();
  await guardApi(p, { api: [], paid: [] });
  await p.goto(base + "/?full=1&probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector('[data-spot="hero"][data-live]') && window.__landing, null, { timeout: 120000 });
  await sleep(3000);
  const btn = p.getByRole("button", { name: "MJ", exact: true });
  await btn.hover();
  await sleep(8000);
  const before = new Set(await p.evaluate(() => window.__landing.programKeys()));
  await btn.click();
  await sleep(3000);
  const after = await p.evaluate(() => window.__landing.programKeys());
  const fresh = after.filter((k) => !before.has(k));
  console.log("before:", [...before].map((k) => k.split("|")[0]).join(", "));
  console.log("new programs:", fresh.length);
  // Show how each new key differs from its nearest old key of the same type.
  for (const k of fresh) {
    const [name, key] = k.split("|");
    const parts = key.split(",");
    let best = null, bestDiff = Infinity;
    for (const o of before) { const [n2, k2] = o.split("|"); if (n2 !== name) continue; const q = k2.split(","); const d = parts.filter((x, i) => x !== q[i]).length; if (d < bestDiff) { bestDiff = d; best = q; } }
    const diffs = best ? parts.map((x, i) => (x !== best[i] ? `#${i}: ${best[i]} -> ${x}` : null)).filter(Boolean) : ["(no old program of this type)"];
    console.log(name, diffs.slice(0, 8).join(" | "));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
