// Lists elements whose right edge passes the viewport at a width. Usage: node overflow.cjs <id> [width]
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
(async () => {
  const [id, w = "360"] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: 780 } });
  await p.goto(require("url").pathToFileURL(path.join(__dirname, "..", "mockups", id + ".html")).href + "?still=1");
  await p.waitForTimeout(800);
  console.log(await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5 && !e.closest(".rail")).slice(0, 12).map((e) => `${e.tagName}.${[...e.classList].join(".")} right=${Math.round(e.getBoundingClientRect().right)}`)));
  await b.close();
})();
