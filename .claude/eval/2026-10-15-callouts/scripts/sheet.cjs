// Before/after contact sheet of the callout captures. Usage: node sheet.cjs
const path = require("path"); const fs = require("fs"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const D = path.join(__dirname, "..");
const img = (f) => "data:image/jpeg;base64," + fs.readFileSync(path.join(D, f)).toString("base64");
const rows = ["light-1280x720", "dark-1280x720", "light-1920x1080", "dark-1920x1080"].map((t) =>
  `<div class="r"><h2>${t}</h2><figure><img src="${img("before/" + t + ".jpg")}"><figcaption>before</figcaption></figure><figure><img src="${img("after/" + t + ".jpg")}"><figcaption>after</figcaption></figure></div>`).join("");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1800, height: 800 } });
  await p.setContent(`<style>body{margin:0;padding:16px;background:#0e1117;color:#ecedef;font:14px system-ui}.r{display:grid;grid-template-columns:140px 1fr 1fr;gap:12px;align-items:start;margin-bottom:14px}h2{font-size:14px;margin:4px 0}figure{margin:0}img{width:100%;display:block;border-radius:6px}figcaption{opacity:.7;margin-top:4px}</style>${rows}`);
  await p.screenshot({ path: path.join(D, "before-after.jpg"), fullPage: true, type: "jpeg", quality: 82 }); await b.close();
})();
