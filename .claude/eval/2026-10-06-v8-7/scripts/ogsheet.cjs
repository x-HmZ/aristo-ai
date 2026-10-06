// The OG variants sheet: each card at 1200x630 and at the 600x315 a feed shows, on a neutral ground.
const fs = require("fs");
const path = require("path");
const { chromium, LAUNCH } = require("./common.cjs");
const OG = path.join(__dirname, "..", "og");
const img = (v) => `data:image/png;base64,${fs.readFileSync(path.join(OG, `card-${v}.png`)).toString("base64")}`;
const NAMES = { a: "A. Split: a full-height panel, hard seam", b: "B. Fade: a wider room that melts into the ink", c: "C. Window: the lit classroom as a framed window" };
(async () => {
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:28px;background:#2b2f38;color:#e8e9ec;font:15px/1.4 system-ui,sans-serif;width:1240px}
    h2{font-size:17px;margin:26px 0 8px} img{display:block;border-radius:10px}
    .row{display:flex;gap:20px;align-items:flex-start}.cap{font-size:12px;color:#a7adb8;margin:4px 0 0}
  </style><h1 style="font-size:20px;margin:0">Link-preview image variants (1200x630, and 600x315 as a feed shows it)</h1>
  ${["a", "b", "c"].map((v) => `<h2>${NAMES[v]}</h2><div class="row"><div><img src="${img(v)}" width="760"><p class="cap">760 wide (scaled)</p></div><div><img src="${img(v)}" width="400"><p class="cap">400 wide, about a phone feed</p></div></div>`).join("")}`;
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: 1296, height: 900 } });
  await p.setContent(html, { waitUntil: "load" });
  fs.mkdirSync(path.join(__dirname, "..", "sheets"), { recursive: true });
  await p.screenshot({ path: path.join(__dirname, "..", "sheets", "og-variants.jpg"), type: "jpeg", quality: 85, fullPage: true });
  await b.close();
  console.log("sheets/og-variants.jpg");
})();
