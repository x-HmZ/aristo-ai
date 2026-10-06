// V8.6: /pending and /create-teacher through the local-only /dev/app-pages harness (presentational views, no
// session, no SDK), and /sign-in and /sign-up as they are (public; nothing is ever submitted).
//   node pages.cjs <label> [baseUrl]      SIZES=360,768,1280  THEMES=light,dark  ONLY=pending,teacher,auth
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

const STATES = [
  ["pending", "pending", "/dev/app-pages?v=pending"],
  ["pending-rejected", "pending", "/dev/app-pages?v=rejected"],
  ["teacher", "teacher", "/dev/app-pages?v=teacher"],
  ["teacher-unconfigured", "teacher", "/dev/app-pages?v=teacher-unconfigured"],
  ["teacher-saving", "teacher", "/dev/app-pages?v=teacher-saving"],
  ["teacher-saved", "teacher", "/dev/app-pages?v=teacher-saved"],
  ["teacher-downloaded", "teacher", "/dev/app-pages?v=teacher-downloaded"],
  ["teacher-error", "teacher", "/dev/app-pages?v=teacher-error"],
  ["teacher-existing", "teacher", "/dev/app-pages?v=teacher-existing"],
  ["sign-in", "auth", "/sign-in"],
  ["sign-in-error", "auth", "/sign-in?error=Invalid%20login%20credentials"],
  ["sign-in-message", "auth", "/sign-in?message=Check%20your%20email%20to%20confirm%20your%20account."],
  ["sign-up", "auth", "/sign-up"],
  ["sign-up-error", "auth", "/sign-up?error=Password%20should%20be%20at%20least%206%20characters."],
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], shots: {} };
  for (const theme of THEMES) for (const w of SIZES) {
    const ctx = await themedContext(browser, theme, { width: w, height: H[w] });
    const page = await ctx.newPage();
    await guardApi(page, report);
    for (const [name, group, url] of STATES) {
      if (ONLY && !ONLY.includes(group)) continue;
      const key = `${name}-${w}-${theme}`;
      try {
        await page.goto(base + url, { waitUntil: "load" });
        await sleep(700);
        // Full page: the create-teacher states run past one viewport.
        await page.screenshot({ path: path.join(OUT, `${key}.jpg`), type: "jpeg", quality: 78, fullPage: true });
        const aa = [], small = [];
        // Check every viewport-height band, so text below the fold counts too.
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < total; y += H[w]) {
          await page.evaluate((yy) => window.scrollTo(0, yy), y);
          await sleep(120);
          aa.push(...(await page.evaluate(AA, "")));
          small.push(...(await page.evaluate(TARGETS, "")).s);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
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
  fs.writeFileSync(path.join(OUT, "report-pages.json"), JSON.stringify(report, null, 1));
  console.log(`api at network: ${report.api.length}, paid: ${report.paid.length}`);
})();
