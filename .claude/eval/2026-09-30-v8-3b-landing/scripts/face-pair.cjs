// Before and after for the V8.3b idle face on both offered teachers, from /dev/avatar-lab with the product's new
// defaults (no smile/lid override) against the old values (smile 0.15, lids 0). Blink held open. Free route.
// Usage: node face-pair.cjs [base]
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const BASE = process.argv.find((a) => a.startsWith("http")) || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "face");
const LAUNCH = { headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] };
const RUNS = [];
for (const who of ["jake", "mj"]) for (const [id, q] of [["before", "&smile=0.15&lid=0"], ["after", ""]]) RUNS.push({ who, id, q });
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const api = [];
  for (const r of RUNS) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await page.addInitScript(() => { new MutationObserver(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.style.setProperty("display", "none", "important"))).observe(document, { childList: true, subtree: true }); });
    await page.route("**/api/**", (x) => { api.push(x.request().url()); return x.abort(); });
    await page.goto(`${BASE}/dev/avatar-lab?who=${r.who}&view=face&clip=Idle&blink=0${r.q}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector("canvas", { timeout: 90000 });
    await page.waitForTimeout(6000);
    await (await page.$("canvas")).screenshot({ path: path.join(OUT, `pair-${r.who}-${r.id}.png`) });
    await page.close();
    console.log(r.who, r.id);
  }
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const img = (f) => "data:image/png;base64," + fs.readFileSync(path.join(OUT, f)).toString("base64");
  const cell = (f, cap) => `<figure><div class="c" style="background-image:url(${img(f)})"></div><figcaption>${cap}</figcaption></figure>`;
  await p.setContent(`<style>body{margin:0;padding:24px;background:#0E1117;color:#ECEDEF;font:15px system-ui}.r{display:flex;gap:12px}figure{margin:0}.c{width:270px;height:330px;border-radius:12px;background-color:#fff;background-size:513px 630px;background-position:-76px -123px}figcaption{margin-top:8px}</style>
    <div class="r">${cell("pair-jake-before.png", "Jake, before (0.15)")}${cell("pair-jake-after.png", "Jake, after (0.8, lids 0.12)")}${cell("pair-mj-before.png", "MJ, before (0.15)")}${cell("pair-mj-after.png", "MJ, after (0.8, lids 0.12)")}</div>`);
  await p.screenshot({ path: path.join(OUT, "pair-sheet.png"), fullPage: true });
  console.log("api calls:", api.length);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
