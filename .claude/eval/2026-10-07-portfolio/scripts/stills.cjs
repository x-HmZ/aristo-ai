// Portfolio stills, as PNG into ../out. Free routes and local harnesses only; every /api call is mocked or aborted.
//   node stills.cjs prod [baseUrl=http://localhost:3100]   06 phone classroom and quiz, 08 light and dark
//   node stills.cjs dev  [baseUrl=http://localhost:3000]   09 course map, 10 dashboard, 12 admin (x3)
const fs = require("fs");
const path = require("path");
const { sleep, LAUNCH, chromium, themedContext, guardApi, sceneReady, click } = require("./common.cjs");

const mode = process.argv[2];
const base = process.argv[3] || (mode === "dev" ? "http://localhost:3000" : "http://localhost:3100");
const OUT = path.join(__dirname, "..", "out");
fs.mkdirSync(OUT, { recursive: true });
const report = { api: [], paid: [], shots: [] };
// THEME=light makes the light set: the same shots, each name with -light (dark keeps the plain name).
const THEME = process.env.THEME || "dark";
const SUFFIX = THEME === "light" ? "-light" : "";

async function open(browser, theme, w, h, dpr, extra = {}) {
  const ctx = await themedContext(browser, theme, { width: w, height: h }, { deviceScaleFactor: dpr, ...extra });
  const page = await ctx.newPage();
  await guardApi(page, report);
  return { ctx, page };
}
async function shoot(page, name, opts = {}) {
  name = `${name}${SUFFIX}`;
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, ...opts });
  report.shots.push(name);
  console.log(`  ${name}.png ${Math.round(fs.statSync(file).size / 1024)} KB`);
}
// /demo, the brain lesson, into Explain until the board diagram is up (about 17 s in, as in the recording).
async function brainAtDiagram(page) {
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await sceneReady(page); await sleep(1500);
  await page.getByText("How Your Brain Is Organised").first().click();
  await sleep(9000);
  await click(page, /^Next$/);
  await page.waitForFunction(() => [...document.querySelectorAll("img")].some((i) => /seg_004|brain/i.test(i.src) && i.getBoundingClientRect().width > 100), null, { timeout: 40000 }).catch(() => {});
  await sleep(4000);
}

const MODES = {
  prod: async (browser) => {
    // 08: the same lesson moment, light and dark, 1440x900 at 2x.
    // 08 is a light and dark pair by itself; made only with the dark set.
    for (const theme of THEME === "light" ? [] : ["light", "dark"]) {
      const { ctx, page } = await open(browser, theme, 1440, 900, 2);
      await brainAtDiagram(page);
      await page.screenshot({ path: path.join(OUT, `aristo-08-${theme}.png`) });
      await ctx.close();
    }
    // 06: a phone, 390x844 at 3x, dark: the classroom mid-lesson, then the quiz on the desk.
    const { ctx, page } = await open(browser, THEME, 390, 844, 3, { isMobile: true, hasTouch: true });
    await brainAtDiagram(page);
    await shoot(page, "aristo-06-phone-classroom");
    if (await click(page, /Take (the )?quiz/i)) { await sleep(5000); await shoot(page, "aristo-06-phone-quiz"); }
    else console.log("  no Take the quiz on the phone layout");
    await ctx.close();
  },
  dev: async (browser) => {
    // 09 and 10 through the learn harness, 12 through the admin harness: 1440x900 at 2x, dark.
    let { ctx, page } = await open(browser, THEME, 1440, 900, 2);
    await page.goto(`${base}/dev/learn-shell`, { waitUntil: "domcontentloaded" });
    await sceneReady(page); await sleep(1500);
    await click(page, /^Earth Science/); await sleep(2500);
    await shoot(page, "aristo-09-course-map");
    await page.goto(`${base}/dev/learn-shell`, { waitUntil: "domcontentloaded" });
    await sceneReady(page); await sleep(1500);
    await click(page, /Explore [Ff]reely/); await sleep(800);
    await click(page, /Progress/); await sleep(2000);
    await shoot(page, "aristo-10-dashboard");
    await ctx.close();
    for (const [name, slug] of [["aristo-12-admin-analytics", "overview"], ["aristo-12-admin-graph", "knowledge-graph"], ["aristo-12-admin-cost", "cost"]]) {
      ({ ctx, page } = await open(browser, THEME, 1440, 900, 2));
      await page.goto(`${base}/hx/admin/${slug}`, { waitUntil: "load" });
      await page.waitForSelector("main h1", { timeout: 90000 }); await sleep(3000);
      await shoot(page, name);
      await ctx.close();
    }
  },
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  await MODES[mode](browser);
  await browser.close();
  console.log(`  api at network: ${report.api.length}, paid: ${report.paid.length}`);
})();
