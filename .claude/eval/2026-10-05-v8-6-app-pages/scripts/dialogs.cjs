// V8.6 review fix: the mode picker, course map and dashboard behave as modal dialogs.
// For each: role and aria-modal, focus inside on open, 30 Tabs and 30 Shift+Tabs never leave, Escape closes
// (or not, for the picker), focus returns to the opener. Harness only, /api mocked in page.
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi, sceneReady, click } = require("./common.cjs");
const base = process.argv[2] || "http://localhost:3000";

const probe = (page) => page.evaluate(() => {
  const d = [...document.querySelectorAll('[role="dialog"]')].pop();
  if (!d) return { open: false };
  return { open: true, modal: d.getAttribute("aria-modal"), label: document.getElementById(d.getAttribute("aria-labelledby"))?.textContent, inside: d.contains(document.activeElement) };
});
const tabs = async (page, shift) => {
  let left = 0;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press(shift ? "Shift+Tab" : "Tab");
    const inside = await page.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].pop(); return d && d.contains(document.activeElement); });
    if (!inside) left++;
  }
  return left;
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const ctx = await themedContext(browser, "dark", { width: 1280, height: 800 });
  const page = await ctx.newPage();
  const report = { api: [], paid: [], dialogs: {} };
  await guardApi(page, report);
  await page.goto(`${base}/dev/learn-shell`, { waitUntil: "domcontentloaded" });
  await sceneReady(page);
  await sleep(800);

  const picker = { open: await probe(page), tabOut: await tabs(page, false), shiftTabOut: await tabs(page, true) };
  await page.keyboard.press("Escape"); await sleep(300);
  picker.afterEscape = await probe(page);
  report.dialogs.picker = picker;

  await click(page, /^Earth Science/); await sleep(1500);
  const map = { open: await probe(page), tabOut: await tabs(page, false), shiftTabOut: await tabs(page, true) };
  await page.keyboard.press("Escape"); await sleep(300);
  map.afterEscape = await probe(page);
  report.dialogs.map = map;

  // Open the dashboard from the keyboard-focused Progress button, so the return of focus can be checked.
  await page.goto(`${base}/dev/learn-shell`, { waitUntil: "domcontentloaded" });
  await sceneReady(page); await sleep(800);
  await click(page, /Explore [Ff]reely/); await sleep(500);
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Progress/.test(x.innerText)); b.focus(); b.click(); });
  await sleep(1200);
  const dash = { open: await probe(page), tabOut: await tabs(page, false), shiftTabOut: await tabs(page, true) };
  await page.keyboard.press("Escape"); await sleep(300);
  dash.afterEscape = await probe(page);
  dash.focusReturned = await page.evaluate(() => /Progress/.test(document.activeElement?.innerText || ""));
  report.dialogs.dash = dash;

  await browser.close();
  fs.writeFileSync(path.join(__dirname, "..", "after", "report-dialogs.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.dialogs, null, 1));
  console.log(`api at network: ${report.api.length}, paid: ${report.paid.length}`);
})();
