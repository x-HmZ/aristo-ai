// Step Into the Classroom's two posters (V8.3b, session 3), captured from the live stage itself at the room's own
// composition aspect (room.ts ROOM_ASPECT, 16:9), 1600 x 900:
// - room-start.webp: the tour's first frame (`?still&start`: t = 0, Jake at rest), the live path's poster, taken the
//   moment the room is live (the layer shown at once, no fade), so it is exactly what the canvas then starts from;
// - room.webp: the tour's end (`?still`: t = its length), the lite path's and the stack's still.
// The box's controls are hidden; the page around it does not matter (the box is opaque).
// Usage: node room-stills.cjs [base] [start|end|both]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , base = "http://localhost:3000", which = "both"] = process.argv;
const PUB = path.join(__dirname, "..", "..", "..", "..", "public", "images", "landing", "v3b");
const RAW = path.join(__dirname, "..", "build", "stills");
fs.mkdirSync(RAW, { recursive: true });
const W = 1600, H = 900;

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  for (const kind of which === "both" ? ["start", "end"] : [which]) {
    const ctx = await b.newContext({ viewport: { width: W, height: 1000 }, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "no-preference" });
    const p = await ctx.newPage();
    await guardApi(p, report);
    await ctx.addInitScript(([w, h]) => {
      const st = document.createElement("style");
      st.textContent = `[data-spot="room"] { width: ${w}px !important; height: ${h}px !important; max-height: none !important; aspect-ratio: auto !important; }
        [data-stage-layer] { transition: none !important; }`;
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
    }, [W, H]);
    await p.goto(base + `/?probe&full=1&still=room${kind === "start" ? "&start" : ""}`, { waitUntil: "load" });
    await p.waitForFunction(() => document.querySelector("[data-spot][data-live]"), null, { timeout: 90000 });
    const y = await p.evaluate(() => { const r = document.querySelector("[data-spot=room]").getBoundingClientRect(); return Math.max(0, r.top + scrollY - (innerHeight - r.height) / 2); });
    for (let v = 0; v <= y; v += 200) { await p.evaluate((q) => scrollTo(0, q), Math.min(v, y)); await sleep(30); }
    await p.evaluate((q) => scrollTo(0, q), y);
    await p.waitForFunction(() => document.querySelector("[data-spot=room][data-live]"), null, { timeout: 90000 });
    // The first live frame is held (`?still&start`: t stays 0, Jake at rest), so a moment later is the same picture;
    // the main thread may be busy with the room's first draw, so wait for frames to be painted.
    await sleep(kind === "start" ? 300 : 1500);
    await p.addStyleTag({ content: `header, [data-spot="room"] ~ *, [aria-label="The tour"], [data-spot="room"] > [aria-hidden]:not(img) { visibility: hidden !important; }` });
    await p.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
    await sleep(100);
    const r = await p.evaluate(() => { const q = document.querySelector("[data-spot=room]").getBoundingClientRect(); return { x: q.left, y: q.top, width: q.width, height: q.height }; });
    if (Math.round(r.width) !== W || Math.round(r.height) !== H) throw new Error(`room box is ${r.width} x ${r.height}`);
    const name = kind === "start" ? "room-start" : "room";
    const png = path.join(RAW, `${name}.png`);
    await p.screenshot({ path: png, clip: r });
    const out = path.join(PUB, `${name}.webp`);
    // A blank box (the canvas not painted yet) would pass as a poster: refuse it.
    const { channels } = await sharp(png).stats();
    if (channels.slice(0, 3).every((c) => c.stdev < 12)) throw new Error(`${name}: the box looks blank (stdev ${channels.map((c) => c.stdev.toFixed(1))})`);
    await sharp(png).webp({ quality: 78, effort: 6 }).toFile(out);
    console.log(name, `${Math.round(fs.statSync(out).size / 1024)} kB`);
    await ctx.close();
  }
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
