// 44px targets and prefers-reduced-motion on the V8.4a surfaces (/demo, 1280x720).
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const [, , base = "http://localhost:3000"] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const motion of ["no-preference", "reduce"]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: motion });
    const page = await ctx.newPage();
    await page.goto(`${base}/demo`);
    await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
    await page.getByText("How Volcanoes Erupt").first().click();
    await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
    await sleep(1500);
    const click = (re) => page.evaluate(([s, f]) => { const r = new RegExp(s, f); const b = [...document.querySelectorAll("button")].find((x) => r.test(x.innerText.trim()) || r.test(x.getAttribute("aria-label") || "")); if (b && !b.disabled) { b.click(); return true; } return false; }, [re.source, re.flags]);
    const small = new Set();
    const anims = new Set();
    const scan = () => page.evaluate(() => {
      const scope = (el) => el.closest(".aristo-scroll, .theme-ink, [data-caption-band], [data-playback]");
      const s = [];
      for (const b of document.querySelectorAll("button, a, textarea")) {
        if (!scope(b)) continue;
        const r = b.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.height < 44 || r.width < 44) s.push(`${(b.innerText || b.getAttribute("aria-label") || b.tagName).trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      const a = [];
      for (const el of document.querySelectorAll("*")) {
        if (!scope(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.animationName && cs.animationName !== "none" && cs.animationPlayState === "running") a.push(`${el.tagName}.${(el.className.baseVal ?? el.className).toString().slice(0, 40)} ${cs.animationName}`);
      }
      return { s, a };
    });
    const collect = async () => { const { s, a } = await scan(); s.forEach((x) => small.add(x)); a.forEach((x) => anims.add(x)); };
    await collect();
    await click(/^Transcript$/); await collect();
    await click(/^Next$/); await sleep(800); await collect();
    await click(/Next sentence/); await sleep(2500); await collect();
    await click(/^View in 3D$/); await sleep(2500); await collect();
    await click(/^Show image$/); await click(/^Next$/); await sleep(800); await click(/^Explain more$/); await collect();
    await click(/^Next$/); await sleep(1500); await collect();
    await click(/^Pause$/); await collect();
    console.log(`[${motion}] under-44 targets:`, [...small]);
    console.log(`[${motion}] running animations in scope:`, [...anims]);
    await ctx.close();
  }
  await browser.close();
})();
