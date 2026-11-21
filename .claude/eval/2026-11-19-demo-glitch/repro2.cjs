// Interaction repro: drag the room during the lesson, then hover and answer on the desk quiz.
// Free route only: every /api request is aborted. Usage: node repro2.cjs <label> <baseUrl> [WxH]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const gRoot = execSync("npm root -g").toString().trim();
const { chromium } = require(path.join(gRoot, "playwright"));

const [, , label = "prod", base = "https://aristo-ai-ten.vercel.app", vp = "1440x900"] = process.argv;
const [W, H] = vp.split("x").map(Number);
const OUT = path.join(__dirname, "drag-" + label + "-" + vp);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const shot = (page, n) => page.screenshot({ path: path.join(OUT, n + ".jpg"), type: "jpeg", quality: 60 });

async function clickText(page, re) {
  return page.evaluate(([src, fl]) => {
    const re = new RegExp(src, fl);
    const b = [...document.querySelectorAll("button")].find((x) => re.test(x.innerText.trim()) || re.test(x.getAttribute("aria-label") || ""));
    if (b && !b.disabled) { b.click(); return b.innerText.trim() || b.getAttribute("aria-label"); }
    return null;
  }, [re.source, re.flags]);
}

// Sample the paper's on-screen rect and opacity every animation frame for ms.
async function samplePaper(page, ms) {
  return page.evaluate(async (ms) => {
    const out = []; const t0 = performance.now();
    await new Promise((res) => { (function tick() {
      const p = document.querySelector(".aristo-paper");
      const host = p?.closest("[style*='matrix3d']");
      const r = p?.getBoundingClientRect();
      out.push({ t: Math.round(performance.now() - t0), rect: r ? [r.left, r.top, r.width, r.height].map(Math.round) : null,
        op: p ? getComputedStyle(p).opacity : null, anim: p ? p.getAnimations().length : null,
        mounted: !!p, hostT: host ? host.style.transform.slice(0, 40) : null });
      if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res();
    })(); });
    return out;
  }, ms);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route("**/api/**", (r) => r.abort());
  page.on("pageerror", (e) => log.push("pageerror " + e.message));
  // Count mounts of the paper element across the run.
  await page.addInitScript(() => {
    window.__paperMounts = 0;
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.(".aristo-paper") || n.querySelector?.(".aristo-paper"))) window.__paperMounts++; })
      .observe(document, { childList: true, subtree: true });
  });

  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
  await sleep(1200);
  await page.getByText("How Volcanoes Erupt").first().click();
  await sleep(3000);
  await shot(page, "10-before-drag");
  // Drag the room like turning your head: left, hold, release, then watch.
  const cx = Math.round(W * 0.3), cy = Math.round(H * 0.45);
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 15; i++) { await page.mouse.move(cx + i * 20, cy + i * 4); await sleep(30); }
  await shot(page, "11-dragging");
  await page.mouse.up();
  for (let i = 0; i < 6; i++) { await sleep(400); await shot(page, `12-after-drag-${i}`); }
  // And the other way, further.
  await page.mouse.move(cx + 200, cy); await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(cx + 200 - i * 30, cy - i * 3); await sleep(30); }
  await page.mouse.up();
  for (let i = 0; i < 6; i++) { await sleep(400); await shot(page, `13-after-drag2-${i}`); }

  log.push("quiz: " + (await clickText(page, /Take the quiz|Take quiz/i)));
  await sleep(2500);
  await shot(page, "20-quiz");
  const settled = await samplePaper(page, 2000);
  // Hover each answer, then click the first.
  const opts = await page.$$(".aristo-paper button");
  log.push("paper buttons " + opts.length);
  const hoverSamples = [];
  for (const o of opts.slice(0, 4)) { await o.hover().catch(() => {}); hoverSamples.push(...(await samplePaper(page, 300))); }
  await shot(page, "21-hovered");
  if (opts[0]) await opts[0].click().catch((e) => log.push("click " + e.message.slice(0, 80)));
  const afterClick = await samplePaper(page, 2500);
  await shot(page, "22-answered");
  // Wheel over the paper (a learner scrolling the quiz).
  await page.mouse.move(W / 2, H / 2); for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 120); await sleep(80); }
  const afterWheel = await samplePaper(page, 1500);
  await shot(page, "23-wheel");
  const mounts = await page.evaluate(() => window.__paperMounts);
  const summarise = (name, s) => {
    const rects = s.filter((x) => x.rect).map((x) => x.rect.join(","));
    const uniq = new Set(rects).size;
    const unmounted = s.filter((x) => !x.mounted).length;
    const ops = [...new Set(s.map((x) => x.op))].join("/");
    let jumps = 0; for (let i = 1; i < s.length; i++) { const a = s[i - 1].rect, b = s[i].rect; if (a && b && (Math.abs(a[0] - b[0]) > 3 || Math.abs(a[1] - b[1]) > 3)) jumps++; }
    log.push(`${name}: frames=${s.length} distinctRects=${uniq} jumps>3px=${jumps} unmountedFrames=${unmounted} opacity=${ops}`);
  };
  summarise("settled", settled); summarise("hover", hoverSamples); summarise("afterClick", afterClick); summarise("afterWheel", afterWheel);
  log.push("paper mounts " + mounts);
  fs.writeFileSync(path.join(OUT, "samples.json"), JSON.stringify({ settled, hoverSamples, afterClick, afterWheel }));
  fs.writeFileSync(path.join(OUT, "log.txt"), log.join("\n"));
  await browser.close();
  console.log(log.join("\n"));
})();
