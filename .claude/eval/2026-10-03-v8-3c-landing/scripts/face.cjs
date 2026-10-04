// Note 7: Jake's idle face, today against candidate resting smiles, from /dev/avatar-lab (Idle clip).
// Face close-up and the app's classroom distance. Free route, no /api calls. Usage: node face.cjs [base]
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const BASE = process.argv.find((a) => a.startsWith("http")) || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "face");
const LAUNCH = { headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FACES = [
  { id: "a-today", smile: 0.15, lid: 0 },
  { id: "b-soft", smile: 0.5, lid: 0 },
  { id: "c-warm", smile: 0.8, lid: 0 },
  { id: "d-warm-eyes", smile: 0.8, lid: 0.12 },
  { id: "e-full-smile", smile: 1.6, lid: 0 },
];
if (!process.argv.includes("--sheet")) (async () => {
  const browser = await chromium.launch(LAUNCH);
  const api = [];
  for (const view of ["face", "classroom"]) {
    for (const f of FACES) {
      const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
      await page.addInitScript(() => { new MutationObserver(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.style.setProperty("display", "none", "important"))).observe(document, { childList: true, subtree: true }); });
      await page.route("**/api/**", (r) => { api.push(r.request().url()); return r.abort(); });
      await page.goto(`${BASE}/dev/avatar-lab?who=jake&view=${view}&clip=Idle&smile=${f.smile}&lid=${f.lid}&blink=0`, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForSelector("canvas", { timeout: 90000 });
      await sleep(6000);
      const canvas = await page.$("canvas");
      await canvas.screenshot({ path: path.join(OUT, `${view}-${f.id}.png`) });
      await page.close();
      console.log(view, f.id);
    }
  }
  console.log("api calls:", api.length);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

// Contact sheet: each face cropped to the head, labelled, in one row per view.
async function sheet() {
  const fs = require("fs");
  const b = await chromium.launch(LAUNCH);
  const page = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const img = (f) => "data:image/png;base64," + fs.readFileSync(path.join(OUT, f)).toString("base64");
  const label = { "a-today": "Today: smile 0.15", "b-soft": "Smile 0.5", "c-warm": "Smile 0.8", "d-warm-eyes": "Smile 0.8, lids 0.12", "e-full-smile": "Full smile 1.6 (greeting)" };
  const cell = (view, id, crop) => `<figure><div class="c" style="background-image:url(${img(`${view}-${id}.png`)});background-size:${crop[0]};background-position:${crop[1]}"></div><figcaption>${label[id]}</figcaption></figure>`;
  const row = (view, crop) => `<div class="r">${FACES.map((f) => cell(view, f.id, crop)).join("")}</div>`;
  await page.setContent(`<style>body{margin:0;padding:24px;background:#0E1117;color:#ECEDEF;font:15px system-ui}h2{font-size:17px;margin:8px 0 12px}.r{display:flex;gap:12px;margin-bottom:24px}figure{margin:0}.c{width:270px;height:330px;border-radius:12px;background-repeat:no-repeat;background-color:#fff}figcaption{margin-top:8px}</style>
    <h2>Face distance (dev lab, Idle clip, blink held open)</h2>${row("face", ["513px 630px", "-76px -123px"])}
    <h2>Classroom distance (the app's camera), zoomed 3x</h2>${row("classroom", ["1710px 2100px", "45px -375px"])}`);
  await page.screenshot({ path: path.join(OUT, "sheet.png"), fullPage: true });
  await b.close();
}
if (process.argv.includes("--sheet")) sheet();
