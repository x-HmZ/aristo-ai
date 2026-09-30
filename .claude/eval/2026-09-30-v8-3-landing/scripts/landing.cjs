// V8.3 landing evidence. Free routes only: every /api call is aborted and recorded; `paid` must stay empty.
// Usage: node landing.cjs <label> <base> <task> [themes] [widths]
//   task: shots   viewport screenshots down the page (sections at start, middle, end) at each width and theme
//         check   AA of every visible text node, 44px targets, horizontal overflow, at each scroll stop
//         perf    cold load: LCP element and time, CLS, JS and CSS bytes, when the stage chunk starts
//         scroll  frame times while wheel-scrolling the whole page
//         record  a short scroll recording (webm) per width and theme
// Env: REDUCED=1 emulates prefers-reduced-motion; LITE=1 forces the lite path (?lite=1); NOGL=1 disables WebGL.
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const { AA, TARGETS } = require("../../2026-09-29-v8-4c/scripts/check.cjs");

const [, , label = "before", base = "http://localhost:3100", task = "shots", themesArg = "light,dark", widthsArg = "360,768,1280"] = process.argv;
const themes = themesArg.split(",");
const widths = widthsArg.split(",").map(Number);
const HEIGHT = { 360: 780, 768: 1024, 1024: 768, 1280: 800, 1440: 900 };
const OUT = path.join(__dirname, "..", label + (process.env.REDUCED ? "-reduced" : "") + (process.env.LITE ? "-lite" : "") + (process.env.NOGL ? "-nogl" : ""));
fs.mkdirSync(OUT, { recursive: true });
const url = () => base + "/" + (process.env.LITE ? "?lite=1" : "");
const launch = () => chromium.launch({ ...LAUNCH, args: LAUNCH.args.concat(process.env.NOGL ? ["--disable-webgl", "--disable-webgl2"] : []) });

// Settle: fonts, the poster, and (full path) the stage if it is going to come.
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("load");
  await sleep(1500);
  await page.waitForFunction(() => !document.documentElement.dataset.stage || document.documentElement.dataset.stage !== "loading", null, { timeout: 60000 }).catch(() => {});
  await sleep(1200);
}

// Scroll stops: the top, then for each section its start, middle and end (pinned sections are tall).
// The beats' hold points in scene time (timeline.ts): where each beat is settled on screen. The check runs here, so it
// judges text as it is meant to be read; anything still mid-fade is marked and counted apart (`fading`).
const HOLDS = [0, 0.75, 1.32, 1.55, 1.76, 2.06, 2.27, 2.4, 2.56, 2.78, 2.95, 3.1, 3.3, 3.5, 3.74, 3.9, 4.5, 4.9, 5.4, 6.85];
const yFor = (S) => {
  const ids = ["top", "idea", "how", "moves", "map", "parents", "start"];
  const i = Math.min(ids.length - 1, Math.floor(S));
  const el = document.getElementById(ids[i]);
  const top = el.getBoundingClientRect().top + scrollY;
  const travel = Math.max(1, ids[i] !== "parents" ? el.offsetHeight - innerHeight : el.offsetHeight);
  return Math.round(top + (S - i) * travel);
};
const MARK_FADING = () => {
  let n = 0;
  for (const el of document.querySelectorAll("body *")) {
    let op = 1; for (let p = el; p && p !== document.body; p = p.parentElement) op *= +getComputedStyle(p).opacity;
    // Mid-fade (and the near-transparent tail of a fade) is not text meant to be read at this instant.
    if (op < 0.98 && el.childNodes.length && [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) { el.setAttribute("data-skip", "fading"); const r = el.getBoundingClientRect(); if (op > 0.02 && r.bottom > 0 && r.top < innerHeight) n++; }
  }
  return n;
};
const UNMARK = () => document.querySelectorAll("[data-skip=fading]").forEach((e) => e.removeAttribute("data-skip"));
const STOPS = () => {
  const out = [{ name: "top", y: 0 }];
  for (const s of document.querySelectorAll("main > section[id], main > div > section[id], main section[id]")) {
    const top = s.getBoundingClientRect().top + scrollY;
    const h = s.offsetHeight;
    const travel = Math.max(0, h - innerHeight);
    out.push({ name: s.id + "-start", y: Math.round(top) });
    if (travel > innerHeight * 0.5) {
      out.push({ name: s.id + "-mid", y: Math.round(top + travel / 2) });
      out.push({ name: s.id + "-end", y: Math.round(top + travel) });
    }
  }
  const seen = new Set();
  return out.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)));
};

async function goTo(page, y) {
  // Step there so a scroll-driven page sees the travel, then let the damping settle.
  const from = await page.evaluate(() => scrollY);
  const steps = Math.max(1, Math.ceil(Math.abs(y - from) / 600));
  for (let i = 1; i <= steps; i++) { await page.evaluate((v) => window.scrollTo(0, v), Math.round(from + ((y - from) * i) / steps)); await sleep(60); }
  await sleep(1400);
}

(async () => {
  const browser = await launch();
  const report = { label, task, base, reduced: !!process.env.REDUCED, lite: !!process.env.LITE, nogl: !!process.env.NOGL, api: [], paid: [], rows: [] };

  for (const theme of themes) {
    for (const w of widths) {
      const viewport = { width: w, height: HEIGHT[w] || 800 };
      const extra = task === "record" ? { recordVideo: { dir: OUT, size: viewport } } : {};
      const ctx = await themedContext(browser, theme, viewport, extra);
      const page = await ctx.newPage();
      await guardApi(page, report);

      if (task === "perf") {
        await ctx.addInitScript(() => {
          window.__lcp = []; window.__cls = 0;
          new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), tag: e.element ? e.element.tagName + (e.element.getAttribute("src") ? " " + e.element.getAttribute("src").slice(0, 80) : "") : e.url, size: e.size }); }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
        });
      }

      // EXPERIMENT: extra CSS injected before any page script (e.g. CSS='*{backdrop-filter:none!important}').
      if (process.env.CSS) await ctx.addInitScript((css) => { document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }); }, process.env.CSS);
      if (process.env.THROTTLE) { const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) }); }
      await page.goto(url(), { waitUntil: "domcontentloaded" });
      await settle(page);
      const row = { theme, w, h: viewport.height, stage: await page.evaluate(() => document.documentElement.dataset.stage || null) };

      if (task === "perf") {
        // Scroll a little and back so CLS covers the first interactions too.
        await page.mouse.wheel(0, 400); await sleep(800); await page.mouse.wheel(0, -400); await sleep(800);
        Object.assign(row, await page.evaluate(() => {
          const res = performance.getEntriesByType("resource");
          const kb = (f) => +(res.filter(f).reduce((a, r) => a + r.encodedBodySize, 0) / 1024).toFixed(1);
          const nav = performance.getEntriesByType("navigation")[0];
          const three = res.filter((r) => /\.js$/.test(r.name)).map((r) => ({ n: r.name.split("/").pop(), start: Math.round(r.startTime), kb: +(r.encodedBodySize / 1024).toFixed(1) }));
          return {
            lcp: window.__lcp[window.__lcp.length - 1] || null, lcpAll: window.__lcp, cls: +window.__cls.toFixed(4),
            load: Math.round(nav.loadEventEnd), jsKB: kb((r) => r.name.endsWith(".js")), cssKB: kb((r) => r.name.endsWith(".css")),
            glbKB: kb((r) => r.name.endsWith(".glb")), imgKB: kb((r) => /\.(webp|avif|jpg|png)(\?|$)/.test(r.name) || r.name.includes("/_next/image")),
            mp3KB: kb((r) => r.name.endsWith(".mp3")), scripts: three,
          };
        }));
      }

      if (task === "shots" || task === "check") {
        const reduced = !!process.env.REDUCED;
        const stops = task === "check" && !reduced
          ? await Promise.all(HOLDS.map(async (S) => ({ name: "S" + S.toFixed(2), y: await page.evaluate(yFor, S) })))
          : await page.evaluate(STOPS);
        row.stops = [];
        for (const s of stops) {
          await goTo(page, s.y);
          const stop = { name: s.name, y: s.y };
          if (task === "shots") await page.screenshot({ path: path.join(OUT, `${theme}-${w}-${s.name}.png`) });
          if (task === "check") {
            stop.fading = await page.evaluate(MARK_FADING);
            const aa = await page.evaluate(`(${AA.toString()})("")`);
            await page.evaluate(UNMARK);
            const fails = aa.filter((a) => a.ratio < a.need);
            const t = await page.evaluate(`(${TARGETS.toString()})("")`);
            stop.nodes = aa.length; stop.min = aa.length ? Math.min(...aa.map((a) => a.ratio)) : null; stop.fails = fails.slice(0, 12);
            stop.small = t.s; stop.overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          }
          row.stops.push(stop);
        }
        if (task === "shots") await page.screenshot({ path: path.join(OUT, `${theme}-${w}-full.png`), fullPage: !process.env.NOFULL });
      }

      if (task === "scroll" || task === "record") {
        await page.evaluate(() => {
          window.__ft = []; let last = performance.now();
          const tick = (t) => { window.__ft.push(t - last); last = t; if (window.__ftOn) requestAnimationFrame(tick); };
          window.__ftOn = true; requestAnimationFrame(tick);
          window.__loaf = [];
          try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__loaf.push(Math.round(e.duration)); }).observe({ type: "long-animation-frame", buffered: false }); } catch {}
        });
        const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        // A steady wheel: 100px every 16ms (about 6000px/s would be a flick; this is 6250px/s peak, eased by the
        // browser's own smooth wheel). Recordings go slower so they are watchable.
        const stepPx = Number(process.env.STEP) || (task === "record" ? 60 : 100), stepMs = task === "record" ? 33 : 16;
        await page.mouse.move(viewport.width / 2, viewport.height / 2);
        const t0 = Date.now();
        while ((await page.evaluate(() => scrollY)) < total - 2 && Date.now() - t0 < 120000) { await page.mouse.wheel(0, stepPx); await sleep(stepMs); }
        await sleep(800);
        const ft = await page.evaluate(() => { window.__ftOn = false; return { ft: window.__ft.slice(2), loaf: window.__loaf }; });
        const v = ft.ft.slice().sort((a, b) => a - b);
        const q = (p) => +v[Math.min(v.length - 1, Math.floor(v.length * p))].toFixed(2);
        Object.assign(row, { frames: v.length, seconds: +((Date.now() - t0) / 1000).toFixed(1), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: +v[v.length - 1].toFixed(1),
          // Headless frames are vsync-paced at 60 Hz here, so a frame over 25ms is one dropped frame, over 50ms two.
          dropped: +(v.filter((x) => x > 25).length / v.length * 100).toFixed(1), dropped2: +(v.filter((x) => x > 50).length / v.length * 100).toFixed(1), loaf: ft.loaf.length, loafMax: Math.max(0, ...ft.loaf) });
      }

      report.rows.push(row);
      console.log(JSON.stringify({ theme, w, ...Object.fromEntries(Object.entries(row).filter(([k]) => !["stops", "scripts", "lcpAll"].includes(k))) }));
      if (task === "check") for (const s of row.stops) if (s.fails.length || s.small.length || s.overflow > 0) console.log("  ", s.name, "fails", s.fails.length, "small", s.small.join("; "), "overflow", s.overflow);
      const video = page.video();
      await ctx.close();
      if (video) fs.renameSync(await video.path(), path.join(OUT, `scroll-${theme}-${w}.webm`));
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `report-${task}.json`), JSON.stringify(report, null, 1));
  console.log("api", report.api.length, "paid", report.paid.length);
})();
