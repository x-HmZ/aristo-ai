// One contact sheet per mockup direction: 1280 light and dark (top 2120px), 360 light and dark in full, side by side.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const SHOTS = path.join(__dirname, "..", "mockups", "shots");
const NAMES = { a: "A. Lesson Objects", b: "B. The Lit Window", c: "C. Line and Light", d: "D. Lesson Objects in the Room (A with the V8.3 immersion)", e: "E. Jake Presents (A, with Jake in each section and one Immersive section)" };
const ONLY = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2000, height: 1000 } });
  for (const id of Object.keys(NAMES).filter((k) => !ONLY.length || ONLY.includes(k))) {
    const img = (f) => "data:image/png;base64," + fs.readFileSync(path.join(SHOTS, f)).toString("base64");
    const fig = (f, w, cap) => `<figure><div style="width:${w}px;max-height:${w === 640 ? 1060 : 4000}px;overflow:hidden;border-radius:10px;outline:1px solid #2a2f3a"><img src="${img(f)}" style="display:block;width:${w}px"></div><figcaption>${cap}</figcaption></figure>`;
    await p.setContent(`<style>body{margin:0;padding:28px;background:#0B0D12;color:#ECEDEF;font:15px system-ui}h1{font-size:22px;margin:0 0 18px}.r{display:flex;gap:18px;align-items:flex-start}figure{margin:0}figcaption{margin-top:8px;color:#B7BDC7}</style>
      <h1>${NAMES[id]}</h1><div class="r">${fig(`${id}-1280-light.png`, 640, "1280, light")}${fig(`${id}-1280-dark.png`, 640, "1280, dark")}${fig(`${id}-360-light.png`, 300, "360, light")}${fig(`${id}-360-dark.png`, 300, "360, dark")}</div>`);
    await p.screenshot({ path: path.join(SHOTS, `sheet-${id}.png`), fullPage: true });
    console.log("sheet", id);
  }
  await b.close();
})();
