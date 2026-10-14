// V10 step 3: the sandboxed widget frame on /dev/interactive. 0 API calls.
// Usage: node frame.cjs [baseUrl=http://localhost:3000]
// Checks: each fixture x theme x width renders and says ready; a slider/button
// drives a redraw; the three failure paths; and, from INSIDE the frame, that the
// sandbox holds (fetch blocked by CSP, storage and parent access throw).
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));

const base = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "frame");
fs.mkdirSync(OUT, { recursive: true });
const report = { shots: [], checks: [], problems: [] };
const ok = (name, pass, extra = "") => { report.checks.push({ name, pass, extra }); if (!pass) report.problems.push(`${name} ${extra}`); console.log(pass ? "PASS" : "FAIL", name, extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, q, w = 1100) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], outbound = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  // "request" fires before Chrome blocks a request, so count what got a RESPONSE, and keep the blocked ones apart.
  const blocked = [];
  const fromFrame = (r) => r.frame().url() === "about:srcdoc" || !!r.frame().parentFrame();
  page.on("response", (res) => { if (fromFrame(res.request()) && !/^(about|data|blob):/.test(res.url())) outbound.push(res.url()); });
  page.on("requestfailed", (r) => { if (fromFrame(r)) blocked.push(`${r.url()} ${r.failure()?.errorText}`); });
  const t0 = Date.now();
  await page.goto(`${base}/dev/interactive?${q}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="status"]', { timeout: 60000 });
  return { ctx, page, errors, outbound, blocked, t0 };
}
async function statusIs(page, re, ms = 15000) {
  await page.waitForFunction((src) => new RegExp(src).test(document.querySelector('[data-testid="status"]')?.textContent || ""), re.source, { timeout: ms }).catch(() => {});
  return page.textContent('[data-testid="status"]');
}

// Text contrast inside the frame (opaque backgrounds only; canvas pixels are not text nodes).
const AA = () => {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0.99) return c; } return [255, 255, 255, 1]; };
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const el = n.parentElement; if (!el || !n.textContent.trim() || el.closest("canvas,[disabled]")) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); const fg = parse(cs.color);
    out.push({ t: n.textContent.trim().slice(0, 24), r: +ratio(fg, bgOf(el)).toFixed(2), px: parseFloat(cs.fontSize) });
  }
  return out;
};
const fails = (rows) => rows.filter((x) => x.r < 4.5).map((x) => `${x.t} ${x.r}`);
// Targets under 44px high (buttons, selects, range inputs).
const SMALL = () => [...document.querySelectorAll("button,select,input[type=range]")].filter((e) => !e.disabled).map((e) => [e.id || e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const fixtures = ["slope-line", "fraction-bars", "for-loop"];
  let totalOutbound = 0;

  for (const fx of fixtures) for (const theme of ["light", "dark"]) for (const w of [360, 900]) {
    const { ctx, page, errors, outbound, t0 } = await open(browser, `fixture=${fx}&theme=${theme}&w=${w}`, w <= 400 ? 420 : 1280);
    const st = await statusIs(page, /ready|failed/);
    const ms = Date.now() - t0;
    ok(`${fx} ${theme} ${w}: ready`, /ready/.test(st), `${ms}ms`);
    const frame = page.frames().find((f) => f.parentFrame());
    const rows = await frame.evaluate(AA);
    ok(`${fx} ${theme} ${w}: text AA`, fails(rows).length === 0, fails(rows).join(" | "));
    const small = await frame.evaluate(SMALL);
    ok(`${fx} ${theme} ${w}: targets >= 44px`, small.length === 0, JSON.stringify(small));
    const sw = await frame.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`${fx} ${theme} ${w}: no horizontal scroll`, sw <= 0, `${sw}`);
    ok(`${fx} ${theme} ${w}: no page errors`, errors.length === 0, errors.join(" | ").slice(0, 200));
    totalOutbound += outbound.length;
    const file = `${fx}-${theme}-${w}.png`;
    await page.locator('[data-testid="frame-box"]').screenshot({ path: path.join(OUT, file) });
    report.shots.push(file);
    await ctx.close();
  }
  ok("no request left any frame", totalOutbound === 0, `${totalOutbound}`);

  // Interaction: each fixture reacts to its controls.
  {
    const { ctx, page } = await open(browser, "fixture=slope-line&theme=light");
    await statusIs(page, /ready/);
    const f = page.frameLocator("iframe");
    await f.locator("#m").fill("-3");
    ok("slope-line: slider updates the equation", /y = -3x \+ 0/.test(await f.locator("#eq").textContent()), await f.locator("#eq").textContent());
    await f.locator("#b").fill("2");
    ok("slope-line: intercept updates the equation", /\+ 2/.test(await f.locator("#eq").textContent()));
    const px = await page.frames().find((x) => x.parentFrame()).evaluate(() => { const c = document.getElementById("plot"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) n++; return n; });
    ok("slope-line: canvas drew", px > 1000, `${px}px`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, "fixture=fraction-bars&theme=light");
    await statusIs(page, /ready/);
    const f = page.frameLocator("iframe");
    await f.locator("#cuts button", { hasText: "4" }).click();
    ok("fraction-bars: cut into 4", /3\/4 = 12\/16/.test(await f.locator("#eq").textContent()), await f.locator("#eq").textContent());
    await f.locator("#den").fill("8");
    ok("fraction-bars: denominator 8", /3\/8 = 12\/32/.test(await f.locator("#eq").textContent()), await f.locator("#eq").textContent());
    const pressed = await f.locator('#cuts button[aria-pressed="true"]').count();
    ok("fraction-bars: one choice pressed", pressed === 1, `${pressed}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, "fixture=for-loop&theme=light");
    await statusIs(page, /ready/);
    const f = page.frameLocator("iframe");
    for (let i = 0; i < 8; i++) if (await f.locator("#step").isEnabled()) await f.locator("#step").click();
    ok("for-loop: ends on print(total) with output 3", (await f.locator("#vo").textContent()) === "3", await f.locator("#vo").textContent());
    ok("for-loop: step disabled at the end", await f.locator("#step").isDisabled());
    await f.locator("#n").fill("6");
    ok("for-loop: n restarts the run", (await f.locator("#vo").textContent()) === "-");
    await ctx.close();
  }

  // Failure paths.
  for (const [fail, re, label] of [["throws", /failed/, "a widget that throws is reported"], ["timeout", /failed/, "a frame that never answers fails"], ["forbidden", /rejected/, "a forbidden widget never runs"]]) {
    const { ctx, page } = await open(browser, `fixture=for-loop&theme=light&fail=${fail}`);
    const st = await statusIs(page, re);
    ok(`failure: ${label}`, re.test(st), st);
    await ctx.close();
  }

  // The sandbox, from inside.
  {
    // fail=probe loads a hostile widget (see InteractivePreview.tsx) that attacks from its own code at
    // load, with names the validator cannot see. It writes the result into #out after 900 ms; outbound
    // requests from the frame are recorded by the page-level listener in open().
    const { ctx, page, outbound, blocked } = await open(browser, "fixture=slope-line&theme=light&fail=probe");
    await statusIs(page, /ready/);
    const f = page.frameLocator("iframe");
    await page.waitForTimeout(1500);
    const probe = JSON.parse(await f.locator("#out").textContent());
    console.log(JSON.stringify(probe));
    ok("sandbox: eval blocked", /blocked/.test(probe.eval), probe.eval);
    ok("sandbox: new Function blocked", /blocked/.test(probe.newFunction), probe.newFunction);
    ok("sandbox: localStorage blocked", /blocked/.test(probe.storage), probe.storage);
    ok("sandbox: parent DOM unreachable", /blocked/.test(probe.parentDom), probe.parentDom);
    ok("sandbox: cookies unreadable", /blocked/.test(probe.cookie), probe.cookie);
    ok("sandbox: fetch blocked", /blocked/.test(probe.fetch), probe.fetch);
    ok("sandbox: CSP reported script-src (eval) violations", probe.violations.includes("script-src") || probe.violations.includes("script-src-elem"), probe.violations.join(","));
    ok("sandbox: CSP reported a connect violation (fetch/xhr)", probe.violations.includes("connect-src"), probe.violations.join(","));
    ok("sandbox: CSP reported an image violation", probe.violations.includes("img-src"), probe.violations.join(","));
    ok("sandbox: nothing got a response from the network", outbound.length === 0, outbound.join(" "));
    ok("sandbox: both outbound attempts failed as blocked by CSP", blocked.length >= 2 && blocked.every((b) => /csp/i.test(b)), blocked.join(" | "));
    report.sandboxProbe = probe;
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(report.problems.length ? `\n${report.problems.length} PROBLEMS` : "\nALL PASS");
  process.exit(report.problems.length ? 1 : 0);
})();
