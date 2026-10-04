// Crops a region of a mockup capture for a close look. Usage: node crop.cjs <shot.png> <x> <y> <w> <h> <out.png>
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
(async () => {
  const [src, x, y, w, h, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  await p.setContent(`<body style="margin:0;overflow:hidden"><div style="width:${w}px;height:${h}px;background:url(data:image/png;base64,${fs.readFileSync(src).toString("base64")}) -${x}px -${y}px no-repeat"></div></body>`);
  await p.screenshot({ path: out });
  await b.close();
})();
