// Shot 13: two before-and-after pairs from the V8.6 evidence (1280-wide captures), each cropped to one screen and
// set side by side with a plain label, as PNG into ../out.
//   node beforeafter.cjs
const fs = require("fs");
const path = require("path");
const { chromium, LAUNCH } = require("./common.cjs");

const EV = path.join(__dirname, "..", "..", "2026-10-05-v8-6-app-pages");
const OUT = path.join(__dirname, "..", "out");
// Each pair in both themes: the plain name is dark, -light is light (the before of admin was locked light in both).
const PAIRS = [
  ["aristo-13-before-after-1", "Learner dashboard, dark theme", "before/dash-1280-dark.jpg", "after/dash-1280-dark.jpg"],
  ["aristo-13-before-after-1-light", "Learner dashboard, light theme", "before/dash-1280-light.jpg", "after/dash-1280-light.jpg"],
  ["aristo-13-before-after-2", "Admin dashboard, dark theme", "before/admin-overview-1280-dark.jpg", "after/admin-overview-1280-dark.jpg"],
  ["aristo-13-before-after-2-light", "Admin dashboard, light theme", "before/admin-overview-1280-light.jpg", "after/admin-overview-1280-light.jpg"],
];
const src = (p) => `data:image/jpeg;base64,${fs.readFileSync(path.join(EV, p)).toString("base64")}`;

(async () => {
  const b = await chromium.launch(LAUNCH);
  for (const [name, title, before, after] of PAIRS) {
    // The frame follows the variant: ink for the dark set, the light page grey for -light.
    const light = name.endsWith("-light");
    const [bg, fg, sub, edge] = light ? ["#F3F4F6", "#0E1117", "#5A6170", "#DCDFE5"] : ["#16181d", "#e8e9ec", "#9aa1ad", "#2c313b"];
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:${bg};color:${fg};font:600 26px/1.3 system-ui,sans-serif}
      .wrap{display:flex;gap:32px;padding:40px}
      figure{margin:0} figcaption{margin:0 0 14px;letter-spacing:.02em} figcaption span{color:${sub};font-weight:500}
      .shot{width:1280px;height:800px;overflow:hidden;border-radius:14px;border:1px solid ${edge}}
      .shot img{display:block;width:1280px}
    </style><div class="wrap">
      <figure><figcaption>Before <span>· ${title}</span></figcaption><div class="shot"><img src="${src(before)}"></div></figure>
      <figure><figcaption>After <span>· ${title}</span></figcaption><div class="shot"><img src="${src(after)}"></div></figure>
    </div>`;
    const p = await b.newPage({ viewport: { width: 2672, height: 938 }, deviceScaleFactor: 1 });
    await p.setContent(html, { waitUntil: "load" });
    const file = path.join(OUT, `${name}.png`);
    await p.screenshot({ path: file, fullPage: true });
    await p.close();
    console.log(`${name}.png ${Math.round(fs.statSync(file).size / 1024)} KB`);
  }
  await b.close();
})();
