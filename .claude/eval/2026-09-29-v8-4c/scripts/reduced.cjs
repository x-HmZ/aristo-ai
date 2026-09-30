// Under prefers-reduced-motion every duration token is 0ms on the root, inside .theme-ink and inside
// .theme-paper (both re-declare tokens on a subtree). Checked on /demo with probe elements appended to the page.
const { chromium, LAUNCH, sceneReady } = require("./common.cjs");
const base = process.argv[2] || "http://localhost:3000";
(async () => {
  const browser = await chromium.launch(LAUNCH);
  for (const motion of ["reduce", "no-preference"]) for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: motion, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.route("**/api/**", (r) => r.abort());
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await sceneReady(page);
    const r = await page.evaluate(() => {
      const probe = (cls) => { const d = document.createElement("div"); if (cls) d.className = cls; const s = document.createElement("span"); d.appendChild(s); document.body.appendChild(d); const cs = getComputedStyle(s); const v = ["--dur-fast", "--dur-base", "--dur-slow", "--dur-reveal"].map((k) => cs.getPropertyValue(k).trim()); d.remove(); return v.join(" "); };
      return { root: probe(""), ink: probe("theme-ink"), paper: probe("theme-paper"), paperInInk: probe("theme-ink") && (() => { const o = document.createElement("div"); o.className = "theme-ink"; const i = document.createElement("div"); i.className = "theme-paper"; o.appendChild(i); document.body.appendChild(o); const v = getComputedStyle(i).getPropertyValue("--dur-base").trim(); o.remove(); return v; })() };
    });
    console.log(motion, scheme, JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})();
