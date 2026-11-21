// Reproduce the /demo camera slide and the desk-quiz flicker. Free route only: every /api request is aborted.
// Usage: node repro.cjs <label> <baseUrl> [WxH]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const gRoot = execSync("npm root -g").toString().trim();
const { chromium } = require(path.join(gRoot, "playwright"));

const [, , label = "prod", base = "https://aristo-ai-ten.vercel.app", vp = "1440x900"] = process.argv;
const [W, H] = vp.split("x").map(Number);
const OUT = path.join(__dirname, label + "-" + vp);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];

async function clickText(page, re) {
  return page.evaluate(([src, fl]) => {
    const re = new RegExp(src, fl);
    const b = [...document.querySelectorAll("button")].find((x) => re.test(x.innerText.trim()) || re.test(x.getAttribute("aria-label") || ""));
    if (b && !b.disabled) { b.click(); return b.innerText.trim() || b.getAttribute("aria-label"); }
    return null;
  }, [re.source, re.flags]);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const aborted = [];
  await page.route("**/api/**", (r) => { aborted.push(r.request().url()); r.abort(); });
  page.on("pageerror", (e) => log.push("pageerror " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(m.type() + " " + m.text().slice(0, 200)); });

  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, "00-picker.jpg"), type: "jpeg", quality: 70 });
  // Idle picker: does the camera drift on its own?
  for (let i = 1; i <= 4; i++) { await sleep(700); await page.screenshot({ path: path.join(OUT, `01-idle-${i}.jpg`), type: "jpeg", quality: 60 }); }

  await page.getByText("How Volcanoes Erupt").first().click();
  for (let i = 0; i < 8; i++) { await sleep(500); await page.screenshot({ path: path.join(OUT, `02-start-${i}.jpg`), type: "jpeg", quality: 60 }); }
  for (let step = 0; step < 4; step++) {
    log.push("next: " + (await clickText(page, /^(Next →|Next)$/)));
    for (let i = 0; i < 4; i++) { await sleep(600); await page.screenshot({ path: path.join(OUT, `03-phase${step}-${i}.jpg`), type: "jpeg", quality: 60 }); }
  }
  log.push("quiz: " + (await clickText(page, /Take the quiz|Take quiz/i)));
  // Track the paper element's transform and the camera container matrix for 4 s.
  const samples = await page.evaluate(async () => {
    const out = [];
    const t0 = performance.now();
    await new Promise((res) => {
      function tick() {
        const paper = document.querySelector(".aristo-paper");
        let rec = { t: Math.round(performance.now() - t0) };
        if (paper) {
          const r = paper.getBoundingClientRect();
          rec.rect = [r.left, r.top, r.width, r.height].map((v) => Math.round(v));
          let el = paper; const tr = [];
          for (let k = 0; k < 4 && el; k++) { el = el.parentElement; if (el) tr.push(getComputedStyle(el).transform.slice(0, 60) + "|" + getComputedStyle(el).opacity + "|" + getComputedStyle(el).display); }
          rec.chain = tr;
          rec.vis = getComputedStyle(paper).opacity;
        }
        out.push(rec);
        if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else res();
      }
      requestAnimationFrame(tick);
    });
    return out;
  });
  fs.writeFileSync(path.join(OUT, "paper-samples.json"), JSON.stringify(samples, null, 1));
  for (let i = 0; i < 10; i++) { await sleep(250); await page.screenshot({ path: path.join(OUT, `04-quiz-${i}.jpg`), type: "jpeg", quality: 60 }); }
  log.push("aborted " + aborted.length + " " + [...new Set(aborted.map((u) => new URL(u).pathname))].join(","));
  fs.writeFileSync(path.join(OUT, "log.txt"), log.join("\n"));
  await browser.close();
  console.log(log.join("\n"));
})();
