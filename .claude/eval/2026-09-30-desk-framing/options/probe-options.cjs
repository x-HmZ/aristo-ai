// Planning probes for the desk-quiz framing. /dev/desk-quiz only (stub quiz, no API).
// node probe.cjs <variant> [sizes]   variants: today | dolly | scale | narrow | flat | steep
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-09-29-v8-4c/scripts/common.cjs");
const [, , variant = "today", sizesArg] = process.argv;
const OUT = path.join(__dirname, "shots");
fs.mkdirSync(OUT, { recursive: true });
const ALL = [[360, 780], [390, 844], [768, 1024], [1024, 768], [1280, 720], [1920, 1080], [360, 640], [430, 932]];
const SIZES = sizesArg ? ALL.filter(([w, h]) => sizesArg.split(",").includes(`${w}x${h}`)) : ALL.slice(0, 6);
const PAPER = [0, -0.878, -0.5], POS0 = [0, 0.2, -0.05], TGT0 = [0, -1.05, -0.6];
const today = fs.existsSync(path.join(OUT, "today.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "today.json"))) : {};
const M = 16; // side margin

function tunables(w, h) {
  const t = today[`${w}x${h}`];
  const k = t ? Math.min(1, (w - 2 * M) / t.card.w) : 1;
  if (variant === "dolly") {
    // Move back along the paper -> camera ray by 1/k, keep the look direction.
    const d = POS0.map((v, i) => v - PAPER[i]);
    const pos = PAPER.map((p, i) => +(p + d[i] / k).toFixed(3));
    const tgt = TGT0.map((v, i) => +(v + pos[i] - POS0[i]).toFixed(3));
    return { k, t: { deskPos: pos, deskTarget: tgt, paperAnchor: PAPER, lambda: 3.2 } };
  }
  if (variant === "steep" || variant === "ray") {
    // Portrait: camera high over the paper, looking steeply down; card narrowed to the width.
    const env = JSON.parse(process.env.STEEP || "{}")[`${w}x${h}`];
    if (env) return { k, t: { deskPos: env.pos, deskTarget: env.tgt, paperAnchor: PAPER, lambda: 3.2 }, c: env.c };
  }
  return { k, t: null };
}

const MEASURE = () => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
  const card = document.querySelector(".aristo-paper-flat") || document.querySelector(".aristo-paper");
  if (!card) return null;
  const C = r(card);
  const vis = (b) => Math.max(0, Math.min(b.r, innerWidth) - Math.max(b.x, 0)) * Math.max(0, Math.min(b.b, innerHeight) - Math.max(b.y, 0)) / (b.w * b.h);
  const opts = [...card.querySelectorAll("button")].filter((b) => /^(3|4|5|6)$/.test(b.innerText.trim())).map(r);
  const labels = [...card.querySelectorAll("button span, button")].filter((b) => /^(3|4|5|6)$/.test(b.innerText.trim())).map(r);
  const q = [...card.querySelectorAll("*")].find((e) => e.children.length === 0 && /What is 2 \+ 2/.test(e.textContent));
  return {
    vw: innerWidth, vh: innerHeight, card: C, cardVisible: +vis(C).toFixed(2),
    optH: opts.map((o) => o.h), optW: opts.map((o) => o.w), optMinH: Math.min(...opts.map((o) => o.h)),
    optsFullyOn: opts.filter((o) => o.x >= 0 && o.r <= innerWidth && o.y >= 0 && o.b <= innerHeight).length + "/" + opts.length,
    labelLeftOn: labels.filter((l) => l.x >= 0).length + "/" + labels.length,
    question: q ? r(q) : null,
  };
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const res = {};
  for (const [w, h] of SIZES) {
    const { k, t, c } = tunables(w, h);
    const ctx = await themedContext(browser, "light", { width: w, height: h });
    await ctx.addInitScript((tun) => { try { tun ? localStorage.setItem("aristo:dev:desk-quiz-tunables", JSON.stringify(tun)) : localStorage.removeItem("aristo:dev:desk-quiz-tunables"); } catch {} }, t);
    const page = await ctx.newPage();
    const rep = { api: [], paid: [] };
    await guardApi(page, rep);
    await page.goto("http://localhost:3000/dev/desk-quiz" + (process.env.ROOM ? "?room=alt" : ""), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 120000 });
    // The tuning sidebar is dev UI; hide it so the canvas is the whole viewport, like /learn and /demo.
    await page.addStyleTag({ content: "aside{display:none!important} div[style*='monospace']{display:none!important}" });
    await page.waitForSelector(".aristo-paper", { timeout: 120000 });
    await sleep(5000);
    if (variant === "scale" && k < 1) await page.addStyleTag({ content: `.aristo-paper{animation:none!important;transform:scale(${k})!important}` });
    if (variant === "narrow" && k < 1) await page.addStyleTag({ content: `.aristo-paper{width:${Math.floor(520 * k)}px!important}` });
    if (process.env.EXTRA_CSS) await page.addStyleTag({ content: process.env.EXTRA_CSS });
    if (c) await page.addStyleTag({ content: `.aristo-paper{width:${c}px!important}` });
    if (variant === "flat") {
      await page.evaluate((m) => {
        const src = document.querySelector(".aristo-paper");
        const flat = src.cloneNode(true);
        flat.className = src.className.replace("aristo-paper", "aristo-paper-flat");
        Object.assign(flat.style, { position: "fixed", left: "50%", bottom: "16px", transform: "translateX(-50%)", width: `min(520px, calc(100vw - ${2 * m}px))`, animation: "none", zIndex: 999, boxShadow: "0 16px 48px rgba(30,14,6,0.45)" });
        src.style.visibility = "hidden";
        document.body.appendChild(flat);
      }, M);
    }
    await sleep(1500);
    const m = await page.evaluate(MEASURE);
    res[`${w}x${h}`] = { k: +k.toFixed(3), tun: t, c, ...m, api: rep.api.length, paid: rep.paid.length };
    await page.screenshot({ path: path.join(OUT, `${variant}${process.env.TAG||""}-${w}x${h}.jpg`), type: "jpeg", quality: 72 });
    console.log(variant, `${w}x${h}`, JSON.stringify(res[`${w}x${h}`]));
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `${variant}${process.env.TAG||""}.json`), JSON.stringify(res, null, 1));
})();
