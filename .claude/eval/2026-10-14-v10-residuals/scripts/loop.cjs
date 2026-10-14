// V10 residual 1: a widget that loops forever must not freeze the tab.
// Each /dev/interactive?fail=loop* probe runs runaway code; the loop guard (src/lib/interactive/guard.ts plus the
// bridge's tick in shell.ts) must stop it, the frame must report failed, and the HOST page must keep running.
// Runs twice: default Chromium, and with sandboxed frames forced into the page's own process
// (--disable-features=IsolateSandboxedIframes), the case where a loop used to freeze everything. A control in the
// second browser shows what an unguarded loop does there.
// Usage: node loop.cjs [baseUrl=http://localhost:3000]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const base = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..");
const report = { checks: [], problems: [], runs: [] };
const ok = (name, pass, extra = "") => { report.checks.push({ name, pass, extra }); if (!pass) report.problems.push(`${name} ${extra}`); console.log(pass ? "PASS" : "FAIL", name, extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Records the longest gap between 20 ms ticks on the host page: a frozen main thread shows up as a long gap.
const HEARTBEAT = () => {
  window.__gap = 0;
  let last = performance.now();
  setInterval(() => { const t = performance.now(); window.__gap = Math.max(window.__gap, t - last); last = t; }, 20);
};

async function run(browser, label, kind, waitMs) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const page = await ctx.newPage();
  await page.addInitScript(HEARTBEAT);
  await page.goto(`${base}/dev/interactive?fixture=slope-line&theme=light&fail=${kind}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="status"]', { timeout: 60000 });
  const t0 = Date.now();
  let status = "";
  while (Date.now() - t0 < waitMs) {
    status = await page.locator('[data-testid="status"]').textContent({ timeout: 5000 });
    if (/failed/.test(status)) break;
    await sleep(100);
  }
  const failedAfter = Date.now() - t0;
  await sleep(800); // keep measuring after the stop
  const gap = await Promise.race([page.evaluate(() => Math.round(window.__gap)), sleep(5000).then(() => 99999)]);
  const text = await page.locator("body").innerText();
  const reason = (text.match(/failed: [^\n]+/) || [""])[0];
  report.runs.push({ label, kind, status, reason, failedAfterMs: failedAfter, hostMaxGapMs: gap });
  await ctx.close();
  return { status, reason, gap, failedAfter };
}

(async () => {
  const configs = [
    ["default", []],
    ["in-process", ["--disable-features=IsolateSandboxedIframes,SitePerProcess"]],
  ];
  for (const [label, extra] of configs) {
    const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu", ...extra] });

    if (label === "in-process") {
      // Control: the same loop in a bare sandboxed srcdoc frame, no guard. Does it freeze the host here?
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.setContent("<!doctype html><body></body>");
      await page.evaluate(HEARTBEAT);
      await page.evaluate(() => {
        const f = document.createElement("iframe");
        f.sandbox = "allow-scripts";
        f.srcdoc = "<script>setTimeout(function(){var t=performance.now();while(performance.now()-t<3000){}},200)</script>";
        document.body.appendChild(f);
      });
      await sleep(4500);
      const gap = await page.evaluate(() => Math.round(window.__gap));
      report.control = { hostMaxGapMs: gap, note: "a 3 s busy loop in an unguarded sandboxed frame" };
      console.log(`control (unguarded 3 s loop, ${label}): host max gap ${gap} ms`);
      await ctx.close();
    }

    for (const kind of ["loop", "loop-recursion", "loop-async", "loop-catch"]) {
      const r = await run(browser, label, kind, 6000);
      ok(`${label} ${kind}: frame failed`, /failed/.test(r.status), `${r.reason} after ${r.failedAfter} ms`);
      ok(`${label} ${kind}: stopped by the guard`, /ran too long|widget stopped|Maximum call stack/.test(r.reason), r.reason);
      ok(`${label} ${kind}: host never froze past 1.5 s`, r.gap < 1500, `${r.gap} ms`);
    }
    {
      const r = await run(browser, label, "loop-later", 8000);
      ok(`${label} loop-later: ready, then failed when it ran away`, /failed/.test(r.status) && r.failedAfter > 1000, `${r.reason} after ${r.failedAfter} ms`);
      ok(`${label} loop-later: host never froze past 1.5 s`, r.gap < 1500, `${r.gap} ms`);
    }
    {
      // A good widget must not be stopped: drag its slider for a while and watch the status.
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
      const page = await ctx.newPage();
      await page.goto(`${base}/dev/interactive?fixture=slope-line&theme=light`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="status"]', { timeout: 60000 });
      await page.waitForFunction(() => /ready|failed/.test(document.querySelector('[data-testid="status"]').textContent), null, { timeout: 15000 });
      const f = page.frameLocator("iframe");
      for (let i = 0; i < 40; i++) { await f.locator("#m").fill(String((i % 9) - 4)); await sleep(50); }
      const st = await page.locator('[data-testid="status"]').textContent();
      ok(`${label} good widget: still ready after 40 slider moves`, /ready/.test(st), st);
      ok(`${label} good widget: equation follows the slider`, /y = -?\d+x/.test(await f.locator("#eq").textContent()));
      await ctx.close();
    }
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, "loop-report.json"), JSON.stringify(report, null, 2));
  console.log(`\n${report.checks.filter((c) => c.pass).length} / ${report.checks.length} passed`);
  process.exit(report.problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
