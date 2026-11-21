// One contact row per size: its six states side by side, aspect kept. Usage: node rows.cjs <dir>
const path = require("path"), fs = require("fs");
const sharp = require(path.join(__dirname, "../../../node_modules/sharp"));
const dir = path.join(__dirname, process.argv[2]);
(async () => {
  const sizes = [...new Set(fs.readdirSync(dir).filter((f) => /-\d-/.test(f)).map((f) => f.replace(/-\d-.*$/, "")))];
  for (const s of sizes) {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(s + "-") && /^\d/.test(f.slice(s.length + 1))).sort();
    const H = 420; const imgs = await Promise.all(files.map(async (f) => { const b = await sharp(path.join(dir, f)).resize({ height: H }).toBuffer({ resolveWithObject: true }); return b; }));
    let x = 0; const comps = imgs.map((i) => { const c = { input: i.data, left: x, top: 0 }; x += i.info.width + 6; return c; });
    await sharp({ create: { width: x, height: H, channels: 3, background: "#000" } }).composite(comps).jpeg({ quality: 70 }).toFile(path.join(dir, "row-" + s + ".jpg"));
  }
  console.log(sizes.join(" "));
})();
