// Contact sheets from the captures: one image per page.
//   node sheet.cjs compare <state> <title>             rows before/after x light/dark, columns 360 / 768 / 1280
//   node sheet.cjs states <title> <label> <s1,s2,...>  one row per state (light and dark at 360 and 1280)
// Shots are <label>/<state>-<w>-<theme>.jpg. Output: sheets/<name>.jpg.
const fs = require("fs");
const path = require("path");
const { chromium, LAUNCH } = require("./common.cjs");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "sheets");
fs.mkdirSync(OUT, { recursive: true });
const S = 0.42;
const H = { 360: 780, 768: 1024, 1280: 800 };
const img = (label, state, w, theme) => {
  const f = path.join(ROOT, label, `${state}-${w}-${theme}.jpg`);
  const ok = fs.existsSync(f);
  // Keep the aspect ratio; a full-page shot is clipped at twice the viewport height.
  const box = `width:${Math.round(w * S)}px;max-height:${Math.round(H[w] * S * 2)}px`;
  return ok
    ? `<div class="clip" style="${box}"><img src="data:image/jpeg;base64,${fs.readFileSync(f).toString("base64")}" style="width:100%;height:auto"></div>`
    : `<div class="missing" style="${box};height:${Math.round(H[w] * S)}px">not captured</div>`;
};
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:24px;background:#1b1e24;color:#e8e9ec;font:14px/1.4 system-ui,sans-serif}
  h1{font-size:20px;margin:0 0 4px} p.sub{margin:0 0 16px;color:#a7adb8}
  .row{display:flex;gap:14px;align-items:flex-start;margin-bottom:14px}
  .lab{width:120px;flex:none;font-weight:600;padding-top:4px} .lab small{display:block;font-weight:400;color:#a7adb8}
  .cell{display:flex;flex-direction:column;gap:4px} .cap{font-size:12px;color:#a7adb8}
  .clip,.missing{border:1px solid #3a3f4a;border-radius:6px;overflow:hidden} img{display:block} .missing{display:grid;place-items:center;color:#777}
  .before .lab{color:#f0a070}
</style></head><body><h1>${title}</h1>${body}</body></html>`;

async function render(name, html, width) {
  const browser = await chromium.launch(LAUNCH);
  const p = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: "load" });
  await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 82, fullPage: true });
  await browser.close();
  console.log("sheets/" + name + ".jpg");
}

(async () => {
  const [mode, a, b, c] = process.argv.slice(2);
  const sizes = [360, 768, 1280];
  const width = 24 * 2 + 120 + sizes.reduce((s, w) => s + Math.round(w * S) + 14, 0) + 10;
  if (mode === "compare") {
    const state = a, title = b;
    let body = `<p class="sub">Before: origin/deploy-prep. After: dev/v8-6-app-pages. Real themes (OS light / OS dark). Columns 360, 768, 1280.</p>`;
    for (const theme of ["light", "dark"]) for (const label of ["before", "after"]) {
      body += `<div class="row ${label}"><div class="lab">${label}<small>${theme}</small></div>`;
      for (const w of sizes) body += `<div class="cell"><span class="cap">${w}</span>${img(label, state, w, theme)}</div>`;
      body += `</div>`;
    }
    await render(`${state}-compare`, page(title, body), width);
  } else if (mode === "states") {
    const title = a, label = b, states = c.split(",");
    const cols = [[360, "light"], [360, "dark"], [1280, "light"], [1280, "dark"]];
    const w2 = 24 * 2 + 120 + cols.reduce((s, [w]) => s + Math.round(w * S) + 14, 0) + 10;
    let body = `<p class="sub">${label}: every state. Columns 360 light, 360 dark, 1280 light, 1280 dark.</p>`;
    for (const st of states) {
      body += `<div class="row"><div class="lab">${st}</div>`;
      for (const [w, t] of cols) body += `<div class="cell"><span class="cap">${w} ${t}</span>${img(label, st, w, t)}</div>`;
      body += `</div>`;
    }
    await render(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${label}-states`, page(`${title}: states (${label})`, body), w2);
  }
})();
