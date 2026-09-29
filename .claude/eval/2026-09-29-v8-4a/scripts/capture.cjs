// V8.4a before/after capture. Usage: node capture.cjs <label> <baseUrl> [themes=light|light,dark]
// Free routes only: /demo (pre-rendered lesson), /dev/free-model, /dev/desk-quiz.
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const gRoot = execSync("npm root -g").toString().trim();
const { chromium } = require(path.join(gRoot, "playwright"));

const [, , label = "before", base = "http://localhost:3100", themesArg = "light", mode = "demo"] = process.argv;
const THEMES = themesArg.split(",");
const OUT = path.join("C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-09-29-v8-4a", label);
fs.mkdirSync(OUT, { recursive: true });
const ALL_SIZES = [[360, 780], [768, 1024], [1024, 768], [1280, 720], [1280, 600]];
const SIZES = process.env.SIZES ? ALL_SIZES.filter(([w, h]) => process.env.SIZES.split(",").includes(`${w}x${h}`)) : ALL_SIZES.slice(0, 3);
const PAID = /\/api\/(learn\/(challenge|explain-more|lesson|complete)|generate|tts|quiz\/generate|courses\/generate|chat)/;
const RPT = path.join(OUT, `report-${mode}.json`);
const report = { label, mode, shots: [], paid: [], rects: {} };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sceneReady(page) {
  await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
  await sleep(800);
}

async function applyTheme(page, theme) {
  if (theme !== "dark") return;
  await page.evaluate(() => {
    document.querySelector('meta[name="aristo-theme-lock"]')?.remove();
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await sleep(150);
}

// Rects of the in-scene toolbars, callouts and the caption band, for the overlap check.
async function rects(page) {
  return page.evaluate(() => {
    const pick = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    const out = {};
    for (const b of document.querySelectorAll("button, [data-callouts], [data-caption-band]")) {
      const t = (b.getAttribute("data-caption-band") !== null ? "BAND" : b.getAttribute("data-callouts") !== null ? "CALLOUTS" : b.innerText.trim());
      if (/View in 3D|Show 3D|Show image|BAND|CALLOUTS/.test(t)) {
        const s = getComputedStyle(b);
        if (s.display !== "none" && s.visibility !== "hidden" && b.getBoundingClientRect().width > 0) out[t] = pick(b);
      }
    }
    const bp = document.querySelector("[data-caption-band] p");
    if (bp) out.bandText = { len: bp.textContent.length, size: (bp.className.match(/text-(lg|base|sm)/) || [])[0], clamp: bp.style.webkitLineClamp || null, next: !!document.querySelector("[data-caption-band] p + p"), cut: bp.scrollHeight > bp.clientHeight + 1 };
    return { vw: innerWidth, vh: innerHeight, ...out };
  });
}

async function shot(page, name) {
  const file = `${name}.jpg`;
  await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 70 });
  report.shots.push(file);
  report.rects[name] = await rects(page);
}

async function clickText(page, re) {
  const ok = await page.evaluate(([src, fl]) => {
    const re = new RegExp(src, fl);
    const b = [...document.querySelectorAll("button")].find((x) => re.test(x.innerText.trim()) || re.test(x.getAttribute("aria-label") || ""));
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  }, [re.source, re.flags]);
  return ok;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const theme of THEMES) {
    for (const [w, h] of SIZES) {
      const tag = (h === 600 || w === 1024) ? `${w}x${h}-${theme}` : `${w}-${theme}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on("request", (r) => { if (PAID.test(r.url())) report.paid.push(r.url()); });

      if (mode === "demo") {
      // /demo
      await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
      await sceneReady(page);
      await applyTheme(page, theme);
      await shot(page, `demo-picker-${tag}`);
      await page.getByText("How Volcanoes Erupt").first().click();
      await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
      await sleep(2500);
      await applyTheme(page, theme);
      await shot(page, `demo-1-activate-narrating-${tag}`);

      // Explain, then skip one sentence to seg_004 (image on the board)
      await clickText(page, /^(Next →|Next)$/);
      await sleep(1500);
      await shot(page, `demo-2-explain-${tag}`);
      await clickText(page, /^(Next ⏭|Skip)$|Next sentence|Skip segment/);
      await sleep(3500);
      await shot(page, `demo-2-image-pointing-${tag}`);
      if (await clickText(page, /^(View in 3D|Show 3D)$/)) {
        await sleep(5000);
        await shot(page, `demo-2-model-${tag}`);
        await clickText(page, /^Show image$/);
        await sleep(1200);
      }
      await clickText(page, /^(Next →|Next)$/);
      await sleep(2000);
      await shot(page, `demo-3-demonstrate-${tag}`);
      await clickText(page, /^(Next →|Next)$/);
      await sleep(2500);
      await shot(page, `demo-4-challenge-${tag}`);
      await clickText(page, /^(Next →|Next)$/);
      await sleep(2000);
      await shot(page, `demo-5-connect-${tag}`);
      // Quiz on the desk (pre-rendered demo quiz, free): the band must hide.
      if (await clickText(page, /Take the quiz|Take quiz/i)) {
        await sleep(3000);
        await shot(page, `demo-quiz-desk-${tag}`);
      }
      }
      if (mode === "probes") {
      // /dev/free-model probes, both rooms
      for (const room of ["", "?room=alt"]) {
        await page.goto(`${base}/dev/free-model${room}`, { waitUntil: "domcontentloaded" });
        await sceneReady(page);
        await applyTheme(page, theme);
        for (const st of ["empty", "image", "model"]) {
          await clickText(page, new RegExp(`^${st}$`));
          await sleep(3000);
          await shot(page, `probe-free-${st}${room ? "-alt" : ""}-${tag}`);
        }
      }
      // /dev/desk-quiz: lesson and desk framing
      await page.goto(`${base}/dev/desk-quiz`, { waitUntil: "domcontentloaded" });
      await sceneReady(page);
      await applyTheme(page, theme);
      await shot(page, `probe-desk-${tag}`);
      await clickText(page, /Hide Quiz|Show Quiz/);
      await sleep(2500);
      await shot(page, `probe-desk-toggled-${tag}`);
      }
      await ctx.close();
      console.log("done", tag);
    }
  }
  await browser.close();
  fs.writeFileSync(RPT, JSON.stringify(report, null, 1));
  console.log("shots", report.shots.length, "paid", report.paid.length);
})().catch((e) => { console.error(e); fs.writeFileSync(RPT, JSON.stringify(report, null, 1)); process.exit(1); });
