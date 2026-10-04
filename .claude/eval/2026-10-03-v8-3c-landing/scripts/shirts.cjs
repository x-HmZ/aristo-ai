// Sheet A (V8.3c): shirt colour candidates for each teacher, rendered by the live landing stage itself (dev only:
// `?shirt=rrggbb`, outfit.ts devShirt). Per colour, two frames:
// - the picture spot's end (the teacher pointing at the white volcano infographic), composited on the page's light
//   ground and on its dark ink;
// - the room's end (the classroom, the blue-grey front wall behind the teacher), cropped to the teacher.
// Ratios under each are WCAG contrast of the colour as given (not as lit) against white, the wall #6B8196 and the ink.
// Usage: node shirts.cjs [base] [jake|mj|both]   -> ../shirts/sheet-<teacher>.webp
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , base = "http://localhost:3000", which = "both"] = process.argv;
const OUT = path.join(__dirname, "..", "shirts");
fs.mkdirSync(path.join(OUT, "raw"), { recursive: true });

const CANDIDATES = {
  jake: ["FFFFFF", "7D9B76", "2F5D50", "1F5F6B", "7B2D3B", "B88A2E", "5E3A5E"],
  mj: ["FFFFFF", "2A7F7A", "8BA889", "3557A6", "6E3B6E", "2F5D50", "C9A13B"],
};
const NAMES = {
  FFFFFF: "white (today)", "7D9B76": "sage", "2F5D50": "forest", "1F5F6B": "deep teal", "7B2D3B": "burgundy",
  B88A2E: "ochre", "5E3A5E": "plum", "2A7F7A": "teal", "8BA889": "light sage", "3557A6": "cobalt", "6E3B6E": "plum",
  C9A13B: "mustard",
};
const LIGHT = "#F3F4F6", INK = "#0E1117", WALL = "6B8196";

const lum = (hex) => {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

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
  await sleep(room ? 2500 : 2500);
  if (room) await p.addStyleTag({ content: `header, [data-spot="room"] ~ *, [aria-label="The tour"], [data-spot="room"] > [aria-hidden]:not(img) { visibility: hidden !important; }` });
  else await p.addStyleTag({ content: `html, body, .landing { background: transparent !important; } header, main, footer { visibility: hidden !important; } [data-stage-layer] { -webkit-mask-image: none !important; mask-image: none !important; visibility: visible !important; }` });
  await sleep(300);
  const r = await p.evaluate((s) => { const q = document.querySelector(`[data-spot="${s}"]`).getBoundingClientRect(); return { x: q.left, y: q.top, width: q.width, height: q.height }; }, spot);
  const png = path.join(OUT, "raw", `${teacher}-${hex}-${spot}.png`);
  await p.screenshot({ path: png, clip: r, omitBackground: !room });
  await ctx.close();
  return png;
}

const label = (w, h, lines) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>text{font:600 15px system-ui,sans-serif;fill:#1b1b1b}</style>${lines.map((l, i) => `<text x="8" y="${20 + i * 20}">${l}</text>`).join("")}</svg>`);

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  for (const teacher of which === "both" ? ["jake", "mj"] : [which]) {
    const rows = [];
    for (const hex of CANDIDATES[teacher]) {
      const pic = await capture(b, report, teacher, hex, "picture");
      const room = await capture(b, report, teacher, hex, "room");
      const cellW = 360, cellH = 277;
      const onLight = await sharp(await sharp({ create: { width: 600, height: 462, channels: 4, background: LIGHT } }).composite([{ input: pic }]).png().toBuffer()).resize(cellW, cellH).png().toBuffer();
      const onInk = await sharp(await sharp({ create: { width: 600, height: 462, channels: 4, background: INK } }).composite([{ input: pic }]).png().toBuffer()).resize(cellW, cellH).png().toBuffer();
      // The teacher stands left of the board in the room's end frame: crop around him.
      const roomCrop = await sharp(room).extract({ left: 110, top: 70, width: 500, height: 385 }).resize(cellW, cellH).png().toBuffer();
      const text = label(cellW, cellH, [
        `${teacher.toUpperCase()}  #${hex}`, NAMES[hex] ?? "",
        `vs white ${ratio(hex, "FFFFFF").toFixed(2)}`, `vs wall ${ratio(hex, WALL).toFixed(2)}`, `vs ink ${ratio(hex, INK.slice(1)).toFixed(2)}`,
      ]);
      const swatch = await sharp({ create: { width: cellW, height: cellH, channels: 4, background: "#ffffff" } })
        .composite([{ input: { create: { width: 120, height: 60, channels: 4, background: `#${hex}` } }, left: 8, top: 200 }, { input: text, left: 0, top: 0 }]).png().toBuffer();
      rows.push([swatch, onLight, onInk, roomCrop]);
      console.log(teacher, hex, "done");
    }
    const cellW = 360, cellH = 277, gap = 6;
    const W = 4 * cellW + 5 * gap, H = rows.length * cellH + (rows.length + 1) * gap;
    const comps = [];
    rows.forEach((row, i) => row.forEach((img, j) => comps.push({ input: img, left: gap + j * (cellW + gap), top: gap + i * (cellH + gap) })));
    const out = path.join(OUT, `sheet-${teacher}.webp`);
    await sharp({ create: { width: W, height: H, channels: 4, background: "#d0d0d0" } }).composite(comps).webp({ quality: 85 }).toFile(out);
    console.log("wrote", out);
  }
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
