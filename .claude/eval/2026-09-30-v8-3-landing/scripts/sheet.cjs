// Contact sheet: tile a folder's PNGs (filtered by a substring) into one image, labelled.
// Usage: node sheet.cjs <folder> <out.png> [filter] [cols] [tileWidth]
const fs = require("fs");
const path = require("path");
const { chromium } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , dir, out, filter = "", cols = "4", tw = "400"] = process.argv;
(async () => {
  const files = fs.readdirSync(dir).filter((f) => (f.endsWith(".png") || f.endsWith(".webp")) && f.includes(filter) && !f.includes("-640")).sort();
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:4px;font:12px sans-serif;color:#eee">` +
    files.map((f) => `<div><img src="data:image/${f.endsWith(".webp") ? "webp" : "png"};base64,${fs.readFileSync(path.join(dir, f)).toString("base64")}" style="width:${tw}px;display:block"><div>${f}</div></div>`).join("") + "</body>";
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Number(cols) * (Number(tw) + 4), height: 400 } });
  await page.setContent(html);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(out, files.length);
})();
