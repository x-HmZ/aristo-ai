// V8.6: /admin/* through the local-only /hx/admin harness (the real pages and AdminShell, every fetch mocked
// in the page; the network layer aborts the rest). LOCK=1 adds the pre-V8.6 lock meta (the honest "before").
//   node admin.cjs <label> [baseUrl]      SIZES=360,768,1280  THEMES=light,dark  ONLY=overview,users,...
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("./common.cjs");
const { AA, TARGETS } = require("./check.cjs");

const label = process.argv[2] || "after";
const base = process.argv[3] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", label);
fs.mkdirSync(OUT, { recursive: true });
const H = { 360: 780, 768: 1024, 1280: 800 };
const SIZES = (process.env.SIZES || "360,768,1280").split(",").map(Number);
const THEMES = (process.env.THEMES || "light,dark").split(",");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const LOCK = process.env.LOCK === "1";

const clickSel = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) { el.click(); return true; } return false; }, sel);
// [name, slug, action(page)] — actions only open views (a drawer, the nav); nothing is ever submitted.
const STATES = [
  ["admin-overview", "overview"],
  ["admin-users", "users"],
  ["admin-user-drawer", "users?userId=00000000-0000-4000-8000-000000000001"],
  ["admin-courses", "courses"],
  ["admin-course-detail", "courses/course-earth"],
  ["admin-course-new", "courses/new"],
  ["admin-kg", "knowledge-graph"],
  ["admin-rag", "rag"],
  ["admin-misconceptions", "misconceptions"],
  ["admin-quiz", "quiz-analytics"],
  ["admin-cost", "cost"],
  ["admin-moderation", "moderation"],
  ["admin-lesson-cache", "lesson-cache"],
  ["admin-audit", "audit-log"],
  ["admin-system", "system"],
  ["admin-nav-open", "overview", async (p) => { if (!(await clickSel(p, 'button[aria-label="Open navigation"]'))) throw new Error("no menu button"); await sleep(700); }],
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], shots: {} };
  for (const theme of THEMES) for (const w of SIZES) {
    const ctx = await themedContext(browser, theme, { width: w, height: H[w] });
    const page = await ctx.newPage();
    await guardApi(page, report);
    for (const [name, slug, action] of STATES) {
      if (ONLY && !ONLY.includes(name.replace(/^admin-/, ""))) continue;
      if (name === "admin-nav-open" && w >= 768) continue;
      const key = `${name}-${w}-${theme}`;
      try {
        await page.goto(`${base}/hx/admin/${slug}${LOCK ? (slug.includes("?") ? "&" : "?") + "lock=1" : ""}`, { waitUntil: "load" });
        await sleep(1800);
        if (action) await action(page);
        await page.screenshot({ path: path.join(OUT, `${key}.jpg`), type: "jpeg", quality: 74, fullPage: !action });
        const aa = [], small = [];
        await page.evaluate(() => { window.__occl = true; });
        const total = action ? H[w] : await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < total; y += H[w]) {
          if (!action) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await sleep(150); }
          aa.push(...(await page.evaluate(AA, "")));
          small.push(...(await page.evaluate(TARGETS, "")).s);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        report.shots[key] = {
          n: aa.length,
          min: aa.length ? Math.min(...aa.map((r) => r.ratio)) : null,
          fails: [...new Set(aa.filter((r) => r.ratio < r.need).map((r) => `${r.t} | ${r.ratio} | ${r.fg} on ${r.bg} | ${r.size}px`))],
          small: [...new Set(small)],
          overflow,
        };
        const s = report.shots[key];
        console.log(`${key}: n=${s.n} min=${s.min} fails=${s.fails.length} small=${s.small.length} overflow=${overflow}`);
      } catch (e) {
        report.shots[key] = { error: String(e.message || e) };
        console.log(`${key}: ERROR ${e.message}`);
      }
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `report-admin.json`), JSON.stringify(report, null, 1));
  console.log(`api at network: ${report.api.length}, paid: ${report.paid.length}`);
})();
