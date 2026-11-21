// Phone and desktop captures of /demo (free route, /api aborted). Usage: node phones.cjs <label> <baseUrl>
const path = require("path"), fs = require("fs"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const [, , label, base] = process.argv; const OUT = path.join(__dirname, "shots-" + label); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (page, re) => page.evaluate(([s, f]) => { const r = new RegExp(s, f); const b = [...document.querySelectorAll("button")].find((x) => r.test(x.innerText.trim()) || r.test(x.getAttribute("aria-label") || "")); if (b && !b.disabled) { b.click(); return true; } return false; }, [re.source, re.flags]);
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const [name, w, h, touch] of [["phone-portrait", 390, 844, true], ["tablet", 820, 1180, true], ["laptop", 1366, 768, false], ["laptop-short", 1280, 650, false]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); await page.route("**/api/**", (r) => r.abort());
    const errs = []; page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
    await sleep(1200); await page.screenshot({ path: path.join(OUT, `${name}-1-picker.jpg`), type: "jpeg", quality: 65 });
    await page.getByText("How Volcanoes Erupt").first().click(); await sleep(3500);
    await page.screenshot({ path: path.join(OUT, `${name}-2-lesson.jpg`), type: "jpeg", quality: 65 });
    for (let i = 0; i < 2; i++) { await click(page, /^(Next →|Next)$/); await sleep(2500); }
    await page.screenshot({ path: path.join(OUT, `${name}-3-explain.jpg`), type: "jpeg", quality: 65 });
    for (let i = 0; i < 2; i++) { await click(page, /^(Next →|Next)$/); await sleep(1500); }
    const q = await click(page, /Take the quiz|Take quiz/i); await sleep(3500);
    await page.screenshot({ path: path.join(OUT, `${name}-4-quiz.jpg`), type: "jpeg", quality: 65 });
    await page.evaluate(()=>{const b=[...document.querySelectorAll("button")].filter(x=>/Magma|Lava|Ash|Pumice/.test(x.innerText));if(b[1])b[1].click();});await sleep(2500);await page.screenshot({ path: path.join(OUT, `${name}-5-answered.jpg`), type: "jpeg", quality: 65 });
    console.log(name, "quizButton=" + q, "errors=" + JSON.stringify(errs)); await ctx.close();
  }
  await browser.close();
})();
