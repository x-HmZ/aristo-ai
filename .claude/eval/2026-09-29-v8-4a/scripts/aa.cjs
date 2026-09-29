// AA checker for the V8.4a surfaces on /demo: each visible text node inside the
// lesson panel, the caption band, the callouts and the in-scene toolbars,
// against its composited background. Where the stack is not opaque (the 3D
// scene shows through), both a white and a black pixel are tried; the lower
// ratio counts. Disabled controls are exempt (WCAG 1.4.3).
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const [, , base = "http://localhost:3000"] = process.argv;
const SIZES = [[360, 780], [768, 1024], [1024, 768], [1280, 720]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHECK = () => {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, bottom) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1); };
  const inScope = (el) => el.closest(".aristo-scroll, .theme-ink, [data-caption-band], [data-playback]") ;
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement;
    if (!el || !n.textContent.trim()) continue;
    if (!inScope(el)) continue;
    if (el.closest(".sr-only, [disabled], [aria-disabled='true']")) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
    // Text colour, with element opacity chain folded in approximately.
    let fg = parse(cs.color);
    // Background stack from the element up.
    const layers = [];
    let e = el, opaque = false;
    while (e && e !== document.body && e !== document.documentElement) {
      const s = getComputedStyle(e);
      const bg = parse(s.backgroundColor);
      if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 0.999) { opaque = true; break; } }
      e = e.parentElement;
    }
    const grounds = opaque ? [null] : [[255, 255, 255, 1], [0, 0, 0, 1]];
    let worst = Infinity, worstBg = null;
    for (const g of grounds) {
      let c = g ? g : layers[layers.length - 1];
      const start = g ? layers.length - 1 : layers.length - 2;
      for (let i = start; i >= 0; i--) c = over(layers[i], c);
      const f = fg[3] < 1 ? over(fg, c) : fg;
      const rr = ratio(f, c);
      if (rr < worst) { worst = rr; worstBg = c; }
    }
    const size = parseFloat(cs.fontSize), weight = +cs.fontWeight;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    out.push({ t: n.textContent.trim().slice(0, 40), ratio: +worst.toFixed(2), need: large ? 3 : 4.5, fg: cs.color, bg: worstBg.slice(0, 3).map(Math.round).join(","), scene: !opaque });
  }
  return out;
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const all = [];
  for (const theme of ["light", "dark"]) for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(`${base}/demo`);
    await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
    await page.getByText("How Volcanoes Erupt").first().click();
    await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
    if (theme === "dark") await page.evaluate(() => { document.querySelector('meta[name="aristo-theme-lock"]')?.remove(); document.documentElement.setAttribute("data-theme", "dark"); });
    const click = (re) => page.evaluate(([s, f]) => { const r = new RegExp(s, f); const b = [...document.querySelectorAll("button")].find((x) => r.test(x.innerText.trim()) || r.test(x.getAttribute("aria-label") || "")); if (b && !b.disabled) { b.click(); return true; } return false; }, [re.source, re.flags]);
    const states = [
      ["activate+transcript", async () => { await click(/^Transcript$/); }],
      ["explain-image", async () => { await click(/^Transcript$/); await click(/^Next$/); await sleep(1200); await click(/Next sentence/); }],
      ["model", async () => { await click(/^(View in 3D|Show 3D)$/); await sleep(3000); }],
      ["demonstrate", async () => { await click(/^Show image$/); await click(/^Next$/); }],
      ["challenge+hint+answer", async () => { await click(/^Next$/); await sleep(1500); await click(/^Show hint$/); await sleep(300); }],
      ["challenge-answer", async () => { await click(/^I don't know$/); }],
      ["paused", async () => { await click(/^Pause$/); }],
      ["connect", async () => { await click(/^Next$/); }],
    ];
    for (const [name, act] of states) {
      await act();
      await sleep(1500);
      const res = await page.evaluate(CHECK);
      for (const r of res) all.push({ theme, w, state: name, ...r });
    }
    await ctx.close();
  }
  await browser.close();
  const fails = all.filter((r) => r.ratio < r.need);
  const min = (f) => Math.min(...all.filter(f).map((r) => r.ratio));
  console.log("checked", all.length, "fails", fails.length);
  console.log("min light", min((r) => r.theme === "light").toFixed(2), "min dark", min((r) => r.theme === "dark").toFixed(2), "min over scene", min((r) => r.scene).toFixed(2));
  const seen = new Set();
  for (const f of fails) { const k = f.theme + f.t + f.ratio; if (seen.has(k)) continue; seen.add(k); console.log("FAIL", f.theme, f.w, f.state, JSON.stringify(f.t), f.ratio, "<", f.need, f.fg, "on", f.bg, f.scene ? "(scene)" : ""); }
  // Lowest few distinct pairs
  const pairs = {};
  for (const r of all) { const k = r.theme + " " + r.fg + " on " + r.bg; if (!pairs[k] || pairs[k].ratio > r.ratio) pairs[k] = r; }
  Object.values(pairs).sort((a, b) => a.ratio - b.ratio).slice(0, 12).forEach((r) => console.log("low", r.theme, r.ratio, JSON.stringify(r.t), r.fg, "on", r.bg, r.scene ? "(scene)" : ""));
})();
