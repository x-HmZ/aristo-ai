// Sheet A2 (V8.3d): pastel shirt candidates for each teacher, rendered by the live landing stage (dev only:
// `?shirt=rrggbb`, outfit.ts devShirt), on the V8.3c sheet's capture (../../2026-10-03-v8-3c-landing/scripts/shirts.cjs).
//
// What is new against sheet A:
// - Calibration. The lit shirt does not render as the hex it is given (V8.3c: about twice as light), so each candidate
//   is solved first: render the picture spot's end, take the median of the shirt's pixels (a mask from a pure green
//   render of the same frame), and correct the hex per channel in linear light, until the render matches the swatch.
//   The tile shows the colour as seen; the code hex is the solved one.
// - Separation numbers for the render, not only the swatch: WCAG ratio and CIEDE2000 against white (the diagram),
//   the light page #F3F4F6, the room wall #6B8196 and the ink #0E1117. "Separates" = ratio >= 1.3 and dE00 >= 12
//   against both white and the light page.
// - A pair panel: Jake and MJ side by side, with dE00 between their renders.
// Usage: node shirts.cjs [base] [jake|mj|both]   -> ../sheet-a2/
// ONLY=A9C6A4,C3B1E1 limits the candidates; SHEET=<dir> writes elsewhere (the picked pair, solved again on the
// shipped cloth: SHEET=sheet-a2-final).
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , base = "http://localhost:3000", which = "both"] = process.argv;
const OUT = path.join(__dirname, "..", process.env.SHEET || "sheet-a2");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const RAW = path.join(OUT, "raw");
fs.mkdirSync(RAW, { recursive: true });

const CANDIDATES = {
  jake: { A9C6A4: "sage", A6C1DD: "powder blue", "9ED2C6": "seafoam", A9B3E3: "periwinkle", EBD891: "butter", BFAED6: "dusty lilac" },
  mj: { C3B1E1: "lavender", A8DCC4: "mint", A5CDE8: "sky", A3B4E8: "periwinkle", F0DC8C: "butter", C9BEDC: "lilac grey" },
};
const REF = { white: "FFFFFF", page: "F3F4F6", wall: "6B8196", ink: "0E1117" };
const LIGHT = "#F3F4F6", INK = "#0E1117";
const PASS = { ratio: 1.3, de: 12 };

// Colour maths: sRGB <-> linear, WCAG luminance, CIELAB (D65), CIEDE2000.
const hexRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (l) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);
const lum = (h) => { const [r, g, b] = hexRgb(h).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
function lab(h) {
  const [r, g, b] = hexRgb(h).map(toLin);
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function de2000(h1, h2) {
  const [L1, a1, b1] = lab(h1), [L2, a2, b2] = lab(h2);
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b, a) => { const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const hp1 = hp(b1, ap1), hp2 = hp(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = Cp1 * Cp2 === 0 ? 0 : hp2 - hp1;
  if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * rad) / 2);
  const Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) hb = Math.abs(hp1 - hp2) > 180 ? (hp1 + hp2 + (hp1 + hp2 < 360 ? 360 : -360)) / 2 : (hp1 + hp2) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T;
  const RT = -2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

async function capture(b, report, teacher, hex, spot) {
  const room = spot === "room";
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "no-preference" });
  const p = await ctx.newPage();
  await guardApi(p, report);
  const css = room
    ? `[data-spot="room"] { width: 1200px !important; height: 675px !important; max-height: none !important; aspect-ratio: auto !important; } [data-stage-layer] { transition: none !important; }`
    : `[data-spot="picture"] { width: 600px !important; height: 462px !important; max-width: none !important; aspect-ratio: auto !important; }`;
  await ctx.addInitScript((s) => { const st = document.createElement("style"); st.textContent = s; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); }, css);
  await p.goto(base + `/?probe&full=1&still=${spot}&teacher=${teacher}&shirt=${hex}`, { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot][data-live]"), null, { timeout: 120000 });
  const y = await p.evaluate((s) => { const r = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); }, spot);
  for (let v = 0; v <= y; v += 250) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
  await p.evaluate((q) => scrollTo(0, q), y);
  await p.waitForFunction((s) => document.querySelector(`[data-spot="${s}"][data-live]`), spot, { timeout: 120000 });
  await sleep(2500);
  if (room) await p.addStyleTag({ content: `header, [data-spot="room"] ~ *, [aria-label="The tour"], [data-spot="room"] > [aria-hidden]:not(img) { visibility: hidden !important; }` });
  else await p.addStyleTag({ content: `html, body, .landing { background: transparent !important; } header, main, footer { visibility: hidden !important; } [data-stage-layer] { -webkit-mask-image: none !important; mask-image: none !important; visibility: visible !important; }` });
  await sleep(300);
  const r = await p.evaluate((s) => { const q = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return { x: q.left, y: q.top, width: q.width, height: q.height }; }, spot);
  const png = path.join(RAW, `${teacher}-${hex}-${spot}.png`);
  await p.screenshot({ path: png, clip: r, omitBackground: !room });
  await ctx.close();
  return png;
}

// The shirt's pixels: pure green in a render with ?shirt=00FF00 (nothing else in the frame is that green).
async function shirtMask(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const idx = [];
  for (let i = 0; i < info.width * info.height; i++) {
    const [r, g, bl, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
    if (a > 250 && g - Math.max(r, bl) > 30) idx.push(i);
  }
  return { idx, width: info.width, height: info.height };
}

// The shirt as it reads: the mean of its pixels in linear light (lit and shaded sides together), over the mask
// eroded once so the anti-aliased edge, which blends into the page, is left out.
async function median(png, mask) {
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  for (const i of mask.inner) for (let c = 0; c < 3; c++) sum[c] += toLin(data[i * 4 + c]);
  return rgbHex(sum.map((v) => toSrgb(v / mask.inner.length)));
}

function erode(mask, rounds = 1) {
  let set = new Set(mask.idx);
  const w = mask.width;
  for (let k = 0; k < rounds; k++) {
    const next = new Set();
    for (const i of set) if (set.has(i - 1) && set.has(i + 1) && set.has(i - w) && set.has(i + w)) next.add(i);
    set = next;
  }
  return [...set];
}

// One correction step per channel in linear light: input * target / rendered, clamped to the gamut.
const correct = (input, target, rendered) => rgbHex(hexRgb(input).map((v, c) => {
  const k = toLin(hexRgb(target)[c]) / Math.max(1e-4, toLin(hexRgb(rendered)[c]));
  return toSrgb(Math.min(1, toLin(v) * k));
}));

const label = (w, h, lines) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>text{font:600 14px system-ui,sans-serif;fill:#1b1b1b} .b{font-weight:800} .ok{fill:#1d6b2f} .no{fill:#a3271b}</style>${lines.map((l, i) => `<text x="8" y="${18 + i * 18}" class="${l.cls ?? ""}">${(l.t ?? l).replace(/&/g, "&amp;")}</text>`).join("")}</svg>`);

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const results = fs.existsSync(path.join(OUT, "results.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "results.json"))) : {};
  for (const teacher of which === "both" ? ["jake", "mj"] : [which]) {
    const m = await shirtMask(await capture(b, report, teacher, "00FF00", "picture"));
    m.inner = erode(m);
    const dbg = Buffer.alloc(m.width * m.height, 0);
    for (const i of m.inner) dbg[i] = 255;
    await sharp(dbg, { raw: { width: m.width, height: m.height, channels: 1 } }).png().toFile(path.join(OUT, `mask-${teacher}.png`));
    console.log(teacher, "mask", m.idx.length, "inner", m.inner.length);
    results[teacher] = {};
    const rows = [];
    for (const [swatch, name] of Object.entries(CANDIDATES[teacher]).filter(([h]) => !ONLY || ONLY.includes(h))) {
      // Solve the hex: up to four renders, stop within dE00 2 of the swatch.
      let input = swatch, rendered, pic, steps = [];
      for (let k = 0; k < 4; k++) {
        pic = await capture(b, report, teacher, input, "picture");
        rendered = await median(pic, m);
        const de = de2000(rendered, swatch);
        steps.push({ input, rendered, de: +de.toFixed(2) });
        if (de < 2) break;
        input = correct(input, swatch, rendered);
      }
      const best = steps.reduce((a, s) => (s.de < a.de ? s : a));
      if (steps[steps.length - 1].input !== best.input) pic = await capture(b, report, teacher, best.input, "picture");
      const room = await capture(b, report, teacher, best.input, "room");
      const vs = (h) => Object.fromEntries(Object.entries(REF).map(([k, r]) => [k, { ratio: +ratio(h, r).toFixed(2), de: +de2000(h, r).toFixed(1) }]));
      const sep = (v) => ["white", "page"].every((k) => v[k].ratio >= PASS.ratio && v[k].de >= PASS.de);
      const res = { name, swatch, code: best.input, rendered: best.rendered, residual: best.de, steps, swatchVs: vs(swatch), renderVs: vs(best.rendered) };
      res.separates = sep(res.renderVs);
      results[teacher][swatch] = res;
      console.log(teacher, name, JSON.stringify({ code: res.code, rendered: res.rendered, residual: res.residual, separates: res.separates }));

      const cellW = 360, cellH = 277;
      const onLight = await sharp(await sharp({ create: { width: 600, height: 462, channels: 4, background: LIGHT } }).composite([{ input: pic }]).png().toBuffer()).resize(cellW, cellH).png().toBuffer();
      const onInk = await sharp(await sharp({ create: { width: 600, height: 462, channels: 4, background: INK } }).composite([{ input: pic }]).png().toBuffer()).resize(cellW, cellH).png().toBuffer();
      const roomCrop = await sharp(room).extract({ left: 110, top: 70, width: 500, height: 385 }).resize(cellW, cellH).png().toBuffer();
      const R = res.renderVs, S = res.swatchVs;
      const text = label(cellW, cellH, [
        { t: `${teacher.toUpperCase()}  ${name}`, cls: "b" },
        `swatch #${swatch}  code #${res.code}`,
        `renders #${res.rendered}  (dE ${res.residual})`,
        `             render (swatch)`,
        `vs white  ${R.white.ratio} (${S.white.ratio})  dE ${R.white.de}`,
        `vs page   ${R.page.ratio} (${S.page.ratio})  dE ${R.page.de}`,
        `vs wall   ${R.wall.ratio} (${S.wall.ratio})  dE ${R.wall.de}`,
        `vs ink    ${R.ink.ratio} (${S.ink.ratio})`,
        { t: res.separates ? "separates from white and page" : "merges: below 1.3 or dE 12", cls: res.separates ? "ok" : "no" },
      ]);
      const sw = await sharp({ create: { width: cellW, height: cellH, channels: 4, background: "#ffffff" } })
        .composite([
          { input: { create: { width: 80, height: 60, channels: 4, background: `#${swatch}` } }, left: 8, top: 200 },
          { input: { create: { width: 80, height: 60, channels: 4, background: `#${res.rendered}` } }, left: 96, top: 200 },
          { input: text, left: 0, top: 0 },
        ]).png().toBuffer();
      rows.push([sw, onLight, onInk, roomCrop]);
    }
    const cellW = 360, cellH = 277, gap = 6;
    const W = 4 * cellW + 5 * gap, H = rows.length * cellH + (rows.length + 1) * gap;
    const comps = [];
    rows.forEach((row, i) => row.forEach((img, j) => comps.push({ input: img, left: gap + j * (cellW + gap), top: gap + i * (cellH + gap) })));
    await sharp({ create: { width: W, height: H, channels: 4, background: "#d0d0d0" } }).composite(comps).webp({ quality: 88 }).toFile(path.join(OUT, `sheet-${teacher}.webp`));
    fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  }
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
