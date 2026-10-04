// Converts PNG captures to WebP (quality 0.85, alpha kept) in place, deleting each PNG once written.
// Usage: node webp.cjs <dir> [<dir> ...]
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const dir of process.argv.slice(2)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".png"))) {
      const src = path.join(dir, f);
      const url = await p.evaluate(async (b64) => {
        const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        c.getContext("2d").drawImage(img, 0, 0);
        return c.toDataURL("image/webp", 0.85);
      }, fs.readFileSync(src).toString("base64"));
      if (!url.startsWith("data:image/webp")) throw new Error("no webp for " + f);
      fs.writeFileSync(src.replace(/\.png$/, ".webp"), Buffer.from(url.split(",")[1], "base64"));
      fs.unlinkSync(src);
      console.log(f);
    }
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
