// Shows every generated widget saved by live.run.ts in /dev/interactive (frame view) and screenshots it:
// light and dark at 560 px (the board card's scale) and light at 360 px (a phone). Same quality checks as
// frame.cjs: ready, text AA, 44 px targets, no horizontal scroll, no page errors, nothing left the frame.
// 0 API calls. Usage: node shots.cjs [baseUrl=http://localhost:3000]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const base = process.argv[2] || "http://localhost:3000";
const DIR = path.join(__dirname, "..");
const report = { checks: [], problems: [] };
const ok = (name, pass, extra = "") => { report.checks.push({ name, pass, extra }); if (!pass) report.problems.push(`${name} ${extra}`); console.log(pass ? "PASS" : "FAIL", name, extra); };

const AA = () => {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0.99) return c; } return [255, 255, 255, 1]; };
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const el = n.parentElement; if (!el || !n.textContent.trim() || el.closest("canvas,svg,[disabled]")) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    out.push({ t: n.textContent.trim().slice(0, 24), r: +ratio(parse(getComputedStyle(el).color), bgOf(el)).toFixed(2) });
  }
  return out.filter((x) => x.r < 4.5).map((x) => `${x.t} ${x.r}`);
};
const SMALL = () => [...document.querySelectorAll("button,select,input[type=range]")].filter((e) => !e.disabled).map((e) => [e.id || e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const slugs = fs.readdirSync(DIR).filter((d) => fs.existsSync(path.join(DIR, d, "widget.json")));
  for (const slug of slugs) {
    const parts = JSON.parse(fs.readFileSync(path.join(DIR, slug, "widget.json"), "utf8"));
    for (const [theme, w] of [["light", 560], ["dark", 560], ["light", 360]]) {
      const ctx = await browser.newContext({ viewport: { width: w <= 400 ? 420 : 1100, height: 760 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [], outbound = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("response", (res) => { const f = res.request().frame(); if ((f.url() === "about:srcdoc" || f.parentFrame()) && !/^(about|data|blob):/.test(res.url())) outbound.push(res.url()); });
      await page.goto(`${base}/dev/interactive?theme=${theme}&w=${w}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => typeof window.__showWidget === "function", null, { timeout: 60000 });
      await page.evaluate((p) => window.__showWidget(p), parts);
      await page.waitForFunction(() => /ready|failed|rejected/.test(document.querySelector('[data-testid="status"]')?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
      const st = await page.textContent('[data-testid="status"]');
      const tag = `${slug} ${theme} ${w}`;
      ok(`${tag}: ready`, /ready/.test(st), st);
      const frame = page.frames().find((f) => f.parentFrame());
      if (frame && /ready/.test(st)) {
        await page.waitForTimeout(400);
        ok(`${tag}: text AA`, (await frame.evaluate(AA)).length === 0, (await frame.evaluate(AA)).join(" | "));
        const small = await frame.evaluate(SMALL);
        ok(`${tag}: targets >= 44px`, small.length === 0, JSON.stringify(small));
        const sw = await frame.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok(`${tag}: no horizontal scroll`, sw <= 0, `${sw}`);
        const sh = await frame.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
        report.checks.push({ name: `${tag}: vertical overflow px`, pass: true, extra: `${sh}` });
      }
      ok(`${tag}: no page errors`, errors.length === 0, errors.join(" | ").slice(0, 200));
      ok(`${tag}: nothing left the frame`, outbound.length === 0, outbound.join(" "));
      await page.locator('[data-testid="frame-box"]').screenshot({ path: path.join(DIR, slug, `widget-${theme}-${w}.png`) });
      if (frame && /ready/.test(st) && theme === "light" && w === 560) {
        // Played: every slider to about three quarters, the first button pressed twice, then the state each control reads.
        await frame.evaluate(() => {
          for (const r of document.querySelectorAll("input[type=range]")) {
            const lo = +r.min || 0, hi = +(r.max || 100), step = +r.step || 1;
            r.value = String(Math.round((lo + (hi - lo) * 0.75) / step) * step);
            r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true }));
          }
          const b = document.querySelector("button:not([disabled])"); if (b) { b.click(); b.click(); }
        });
        await page.waitForTimeout(500);
        report.checks.push({ name: `${tag}: played state`, pass: true, extra: await frame.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 300)) });
        const after = await page.textContent('[data-testid="status"]');
        ok(`${tag}: still ready after playing`, /ready/.test(after), after);
        await page.locator('[data-testid="frame-box"]').screenshot({ path: path.join(DIR, slug, `widget-${theme}-${w}-played.png`) });
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(DIR, "shots-report.json"), JSON.stringify(report, null, 2));
  console.log(`\n${report.checks.filter((c) => c.pass).length} / ${report.checks.length} passed`);
})().catch((e) => { console.error(e); process.exit(2); });
