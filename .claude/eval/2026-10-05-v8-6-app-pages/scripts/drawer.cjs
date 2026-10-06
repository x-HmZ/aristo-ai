// V8.6 review fix: the admin drawer closes on a link to the page already open, and when the viewport grows past md.
// Harness only (/hx/admin), every fetch mocked in the page.
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi, themedContext } = require("./common.cjs");
const base = process.argv[2] || "http://localhost:3000";
const open = (p) => p.evaluate(() => !!document.querySelector('[role="dialog"][data-state="open"]'));

(async () => {
  const browser = await chromium.launch(LAUNCH);
  // themedContext hides the Next dev overlay (the harness route is client-rendered after a server error in dev).
  const ctx = await themedContext(browser, "light", { width: 360, height: 780 });
  const page = await ctx.newPage();
  const report = { api: [], paid: [], checks: {} };
  await guardApi(page, report);
  await page.goto(`${base}/hx/admin/overview`, { waitUntil: "load" });
  await page.waitForSelector('button[aria-label="Open navigation"]', { timeout: 60000 });
  await sleep(500);

  await page.click('button[aria-label="Open navigation"]'); await sleep(600);
  report.checks.opens = await open(page);
  // The current page's own link: no route change, the drawer still closes.
  // In the harness that link points at the real /admin route; cancel its navigation in the test (as a same-page
  // link would not navigate) and check the drawer still closes.
  await page.evaluate(() => { const l = document.querySelector('[role="dialog"] a[aria-current="page"]'); l.addEventListener("click", (e) => e.preventDefault()); l.click(); });
  await sleep(600);
  report.checks.closedOnCurrentLink = !(await open(page));
  report.checks.stillOnPage = new URL(page.url()).pathname;

  await page.click('button[aria-label="Open navigation"]'); await sleep(600);
  await page.keyboard.press("Escape"); await sleep(400);
  report.checks.closedOnEscape = !(await open(page));

  await page.click('button[aria-label="Open navigation"]'); await sleep(600);
  await page.setViewportSize({ width: 1024, height: 780 }); await sleep(600);
  report.checks.closedPastMd = !(await open(page));
  report.checks.sidebarVisiblePastMd = await page.evaluate(() => { const a = document.querySelector("aside"); return !!a && getComputedStyle(a).display !== "none"; });

  await browser.close();
  fs.writeFileSync(path.join(__dirname, "..", "after", "report-drawer.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.checks), `api ${report.api.length} paid ${report.paid.length}`);
})();
