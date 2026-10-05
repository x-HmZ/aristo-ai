// Peak sheets (V8.3d) from the headless renders of v9_loose_sheets.py, labelled with the QA numbers.
// Writes ../sheets/<teacher>-peaks-<n>.webp (12 clips a page: front, his left, his right at the peak frame),
// <teacher>-joints-<n>.webp (elbow, shoulder, armpit: left and right side by side, the right one mirrored so the
// pair reads as one joint), <teacher>-hem.webp (the hem through three clips), <teacher>-before-after.webp.
// Usage: node sheets.cjs <jake|mj>
const fs = require("fs");
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const T = process.argv[2] || "jake";
const Tn = T === "jake" ? "Jake" : "MJ";
const ROOT = path.join(__dirname, "..");
const R = path.join(ROOT, "renders", T);
const OUT = path.join(ROOT, "sheets");
fs.mkdirSync(OUT, { recursive: true });
const qa = JSON.parse(fs.readFileSync(path.join(ROOT, "qa", `qa-${Tn}-baseFalse.json`))).clips;
const base = JSON.parse(fs.readFileSync(path.join(ROOT, "qa", `qa-${Tn}-baseTrue.json`))).clips;
const man = JSON.parse(fs.readFileSync(path.join(R, "manifest.json")));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const label = (w, h, lines, size = 14) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff"/>${lines.map((l, i) => `<text x="8" y="${size + 4 + i * (size + 4)}" style="font:${i ? 500 : 700} ${size}px system-ui,sans-serif;fill:#1b1b1b">${esc(l)}</text>`).join("")}</svg>`);
const img = (p, w, h, flip = false) => { let s = sharp(p).resize(w, h); if (flip) s = s.flop(); return s.png().toBuffer(); };

async function grid(cells, cols, cellW, cellH, out) {
  const gap = 6, rows = Math.ceil(cells.length / cols);
  const comps = [];
  cells.forEach((c, i) => c.forEach((part) => comps.push({ ...part, left: part.left + gap + (i % cols) * (cellW + gap), top: part.top + gap + Math.floor(i / cols) * (cellH + gap) })));
  await sharp({ create: { width: cols * cellW + (cols + 1) * gap, height: rows * cellH + (rows + 1) * gap, channels: 4, background: "#cfcfcf" } })
    .composite(comps).webp({ quality: 86 }).toFile(out);
  console.log("wrote", path.relative(ROOT, out));
}

(async () => {
  const clips = Object.keys(man.peaks);
  const tw = 240, th = 293, lh = 58;
  // Peaks.
  for (let p = 0; p * 12 < clips.length; p++) {
    const cells = [];
    for (const clip of clips.slice(p * 12, p * 12 + 12)) {
      const q = qa[clip], b = base[clip];
      const f = (k) => `${q[k].L}/${q[k].R}`;
      const cell = [{ input: label(3 * tw, lh, [`${Tn} ${clip}  frame ${man.peaks[clip]}  (front, his left, his right)`, `skin ${f("skin")}  under ${f("under")}  arm ${f("arm")}  cloth ${f("cloth")} (shipped ${b.cloth.L}/${b.cloth.R})`], 13), left: 0, top: 0 }];
      for (const [k, v] of ["front", "left", "right"].entries()) cell.push({ input: await img(path.join(R, "peaks", `${clip}_${v}.png`), tw, th), left: k * tw, top: lh });
      cells.push(cell);
    }
    await grid(cells, 2, 3 * tw, th + lh, path.join(OUT, `${T}-peaks-${p + 1}.webp`));
  }
  // Joints: L and R (mirrored) side by side.
  const jw = 170;
  for (let p = 0; p * 12 < clips.length; p++) {
    const cells = [];
    for (const clip of clips.slice(p * 12, p * 12 + 12)) {
      const cell = [{ input: label(6 * jw, 26, [`${Tn} ${clip}   elbow L | R (mirrored)    shoulder L | R    armpit L | R`], 13), left: 0, top: 0 }];
      let k = 0;
      for (const j of ["elbow", "shoulder", "armpit"]) for (const s of ["L", "R"]) cell.push({ input: await img(path.join(R, "joints", `${clip}_${j}_${s}.png`), jw, jw, s === "R"), left: (k++) * jw, top: 26 });
      cells.push(cell);
    }
    await grid(cells, 2, 6 * jw, jw + 26, path.join(OUT, `${T}-joints-${p + 1}.webp`));
  }
  // Hem.
  {
    const cells = [];
    for (const [clip, frames] of Object.entries(man.hem)) {
      const cell = [{ input: label(6 * 240, 26, [`${Tn} ${clip}: the hem at frames ${frames.join(", ")}`], 13), left: 0, top: 0 }];
      for (const [k, f] of frames.entries()) cell.push({ input: await img(path.join(R, "hem", `${clip}_${f}.png`), 240, 200), left: k * 240, top: 26 });
      cells.push(cell);
    }
    await grid(cells, 1, 6 * 240, 226, path.join(OUT, `${T}-hem.webp`));
  }
  // Before / after.
  {
    const cells = [];
    for (const tag of ["before", "after"]) {
      const cell = [{ input: label(3 * 300, 26, [`${Tn} ${tag === "before" ? "before: the V8.3c shirt" : "after: the V8.3d shirt"} (Idle peak; same plain material and light)`], 13), left: 0, top: 0 }];
      for (const [k, v] of ["front", "three-quarter", "side"].entries()) cell.push({ input: await img(path.join(R, tag, `${v}.png`), 300, 371), left: k * 300, top: 26 });
      cells.push(cell);
    }
    await grid(cells, 2, 900, 397, path.join(OUT, `${T}-before-after.webp`));
  }
})().catch((e) => { console.error(e); process.exit(1); });
