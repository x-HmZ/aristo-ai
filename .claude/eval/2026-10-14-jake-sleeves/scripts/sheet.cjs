// Contact sheet of forearms.cjs shots. Usage:
//   node sheet.cjs <out.jpg> <dir>             rows = clip x side, columns = front / three4 / side
//   node sheet.cjs <out.jpg> <dir> <dir2> ...  one row per NAMES entry, one column per dir (before / options)
const fs = require("fs");
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "..", "..", "node_modules", "sharp"));
const [, , out, ...dirs] = process.argv;
const T = Number(process.env.TILE || 360);
const CLIPS = (process.env.CLIPS || "Idle,Talking,Pointing").split(",");
const VIEWS = (process.env.VIEWS || "front,three4,side").split(",");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (w, h, s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff"/><text x="8" y="${h / 2 + 7}" style="font:700 18px system-ui,sans-serif;fill:#1b1b1b">${esc(s)}</text></svg>`);

let rows, heads;
if (dirs.length === 1) {
  rows = CLIPS.flatMap((c) => ["L", "R"].map((s) => [`${c} ${s}`, VIEWS.map((v) => path.join(dirs[0], `${c}-${s}-${v}.png`))]));
  heads = VIEWS;
} else {
  rows = (process.env.NAMES || "").split(",").map((n) => [n, dirs.map((d) => path.join(d, `${n}.png`))]);
  heads = (process.env.HEADS || dirs.map((d) => path.basename(d)).join(",")).split(",");
}
const LW = 170, HH = 36;
(async () => {
  const comp = [];
  heads.forEach((h, j) => comp.push({ input: text(T, HH, h), left: LW + j * T, top: 0 }));
  for (const [i, [label, files]] of rows.entries()) {
    comp.push({ input: text(LW, T, label), left: 0, top: HH + i * T });
    for (const [j, f] of files.entries()) {
      if (fs.existsSync(f)) comp.push({ input: await sharp(f).resize(T, T).toBuffer(), left: LW + j * T, top: HH + i * T });
    }
  }
  await sharp({ create: { width: LW + T * heads.length, height: HH + T * rows.length, channels: 3, background: "#fff" } })
    .composite(comp).jpeg({ quality: 86 }).toFile(out);
  console.log(out);
})();
