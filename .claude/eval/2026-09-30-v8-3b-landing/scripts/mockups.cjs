// Captures the V8.3b direction mockups (../mockups/<id>.html) full page at 1280 and 360, light and dark, settled
// (?still=1). Also checks horizontal overflow. Usage: node mockups.cjs [a b c]
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const DIR = path.join(__dirname, "..", "mockups");
const OUT = path.join(DIR, "shots");
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["a", "b", "c"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  require("fs").mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--allow-file-access-from-files"] });
  for (const id of ids) {
    for (const [w, h] of [[1280, 800], [360, 780]]) {
      for (const theme of ["light", "dark"]) {
        const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: theme });
        await page.goto(require("url").pathToFileURL(path.join(DIR, id + ".html")).href + `?theme=${theme}&still=1`);
        await page.evaluate(() => document.fonts.ready);
        await sleep(700);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        await page.screenshot({ path: path.join(OUT, `${id}-${w}-${theme}.png`), fullPage: true });
        console.log(id, w, theme, "overflow", over);
        await page.close();
      }
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
