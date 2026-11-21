// Layout audit of /demo (free route, /api aborted). Usage: node audit.cjs <label> <baseUrl> [sizes]
// For each size it walks lesson -> explain -> quiz -> answered, screenshots each state and reports:
//   off   - visible controls or text that run past the viewport edge
//   hit   - two visible controls (buttons/links) from different containers overlapping each other
//   cover - a visible control whose centre is covered by another element (elementFromPoint)
const path = require("path"), fs = require("fs"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const [, , label, base, only] = process.argv; const OUT = path.join(__dirname, "audit-" + label); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (page, re) => page.evaluate(([s, f]) => { const r = new RegExp(s, f); const b = [...document.querySelectorAll("button")].find((x) => r.test(x.innerText.trim()) || r.test(x.getAttribute("aria-label") || "")); if (b && !b.disabled) { b.click(); return true; } return false; }, [re.source, re.flags]);
const SIZES = [["phone-portrait", 390, 844, true], ["phone-small", 360, 640, true], ["phone-landscape", 844, 390, true], ["tablet-portrait", 820, 1180, true], ["tablet-landscape", 1180, 820, true], ["laptop-short", 1280, 650, false], ["laptop", 1366, 768, false], ["desktop", 1920, 1080, false]];

function audit() {
  const W = innerWidth, H = innerHeight, out = { off: [], hit: [], cover: [] };
  const vis = (el) => { const s = getComputedStyle(el); if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const name = (el) => (el.getAttribute("aria-label") || el.innerText || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
  // Inside the 3D paper (transformed Html) the rects are projected; skip it for "off" (the paper is framed by the camera).
  const inPaper = (el) => !!el.closest(".aristo-paper");
  // A control clipped by a scrolling ancestor is fine (it scrolls); skip anything whose scroll ancestor hides it.
  const clippedByScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY + s.overflowX)) { const a = p.getBoundingClientRect(), r = el.getBoundingClientRect(); if (r.bottom > a.bottom + 1 || r.top < a.top - 1) return true; } } return false; };
  const ctrls = [...document.querySelectorAll("button, a[href], input, [role=button]")].filter(vis);
  const texts = [...document.querySelectorAll("p, h1, h2, h3, span, li")].filter((e) => vis(e) && e.children.length === 0 && e.innerText.trim());
  for (const el of [...ctrls, ...texts]) {
    if (inPaper(el) || clippedByScroller(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.off.push(`${name(el)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
  }
  const top = (el) => { let p = el; while (p.parentElement && p.parentElement !== document.body) { const s = getComputedStyle(p); if (s.position === "fixed" || s.position === "absolute") break; p = p.parentElement; } return p; };
  for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) {
    const a = ctrls[i], b = ctrls[j]; if (a.contains(b) || b.contains(a) || top(a) === top(b)) continue;
    if (clippedByScroller(a) || clippedByScroller(b)) continue;
    const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
    const ox = Math.min(x.right, y.right) - Math.max(x.left, y.left), oy = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
    if (ox > 2 && oy > 2) out.hit.push(`${name(a)} x ${name(b)}`);
  }
  for (const el of ctrls) {
    if (clippedByScroller(el)) continue;
    const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > W || cy > H || inPaper(el)) continue;
    const hitEl = document.elementFromPoint(cx, cy);
    if (hitEl && hitEl !== el && !el.contains(hitEl) && !hitEl.contains(el) && hitEl.tagName !== "CANVAS") out.cover.push(`${name(el)} under ${name(hitEl).slice(0, 30)} <${hitEl.tagName.toLowerCase()} ${String(hitEl.className).slice(0, 40)}>`);
  }
  // A sticky row taller than its scroller pokes out of it (the Back / Next row over the playback controls did).
  out.sticky = [];
  for (const el of document.querySelectorAll("*")) {
    if (getComputedStyle(el).position !== "sticky" || !vis(el)) continue;
    let p = el.parentElement; while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement;
    if (!p) continue;
    const a = p.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.bottom > a.bottom + 1 || r.top < a.top - 1) out.sticky.push(`${name(el)} [${Math.round(r.top)}-${Math.round(r.bottom)} in ${Math.round(a.top)}-${Math.round(a.bottom)}]`);
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])];
  return out;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const [name, w, h, touch] of SIZES.filter((s) => !only || only.split(",").includes(s[0]))) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); await page.route("**/api/**", (r) => r.abort());
    const errs = []; page.on("pageerror", (e) => errs.push(e.message));
    const report = {};
    const snap = async (state) => { await page.screenshot({ path: path.join(OUT, `${name}-${state}.jpg`), type: "jpeg", quality: 65 }); report[state] = await page.evaluate(audit); };
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
    await sleep(1200); await snap("1-picker");
    await page.getByText("How Volcanoes Erupt").first().click(); await sleep(3500); await snap("2-lesson");
    for (let i = 0; i < 2; i++) { await click(page, /^(Next →|Next)$/); await sleep(2500); }
    await snap("3-explain");
    for (let i = 0; i < 2; i++) { await click(page, /^(Next →|Next)$/); await sleep(1500); }
    await click(page, /Take the quiz|Take quiz/i); await sleep(3500); await snap("4-quiz");
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((x) => /^(Magma|Lava|Ash|Pumice)/.test(x.innerText.trim())); if (b[1]) b[1].click(); }); await sleep(2500); await snap("5-answered");
    // Wrong answer on question 2, to see the red bar.
    await click(page, /Next question/); await sleep(1500);
    await page.evaluate(() => { const b = [...document.querySelectorAll(".aristo-paper button")].filter((x) => x.innerText.trim() && !/Next/.test(x.innerText)); if (b[0]) b[0].click(); }); await sleep(2500); await snap("6-wrong");
    console.log(`== ${name} errors=${JSON.stringify(errs)}`);
    for (const [s, r] of Object.entries(report)) { const n = r.off.length + r.hit.length + r.cover.length + r.sticky.length; if (n) console.log(`  ${s}: ${JSON.stringify(r)}`); }
    await ctx.close();
  }
  await browser.close();
})();
