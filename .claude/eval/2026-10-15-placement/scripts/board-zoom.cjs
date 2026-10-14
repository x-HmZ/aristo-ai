// The board's in-screen zoom on /demo (brain lesson, the Explain diagram): at rest, after scrolling in over the
// frontal lobe, after a drag, after a double-click (reset), and the Expand view. Also the heart model with the
// narration's focus lighting its labels. 0 API calls. Usage: node board-zoom.cjs [baseUrl=http://localhost:3000]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const base = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "zoom");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { checks: [] };
const ok = (name, pass, extra = "") => { report.checks.push({ name, pass, extra }); console.log(pass ? "PASS" : "FAIL", name, extra); };
const pause = (p) => p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /^Pause$/.test(x.innerText.trim()))?.click());

async function open(browser, w, h, topic) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${base}/demo`);
  await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 120000 });
  await sleep(800);
  await page.getByText(topic).first().click();
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    const page = await open(browser, w, h, "How Your Brain Is Organised");
    for (let i = 0; i < 600; i++) { await sleep(200); if (await page.getByText("Expand").count()) break; }
    await sleep(1500);
    await pause(page);
    const tb = await page.getByText("Expand").first().boundingBox();
    // The toolbar sits under the screen's centre; the screen is about 0.42 of the viewport height above it.
    const cx = tb.x + tb.width / 2 - 40, cy = tb.y - h * 0.2;
    const tag = `${w}x${h}`;
    await page.screenshot({ path: path.join(OUT, `${tag}-1-rest.jpg`), type: "jpeg", quality: 85 });
    await page.mouse.move(cx - w * 0.04, cy - h * 0.05);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -240); await sleep(60); }
    await sleep(300);
    const hint = await page.evaluate(() => document.body.innerText.includes("double-click to reset"));
    ok(`${tag}: scrolling zooms the picture`, hint);
    await page.screenshot({ path: path.join(OUT, `${tag}-2-zoomed.jpg`), type: "jpeg", quality: 85 });
    await page.mouse.down(); await page.mouse.move(cx + w * 0.06, cy + h * 0.04, { steps: 8 }); await page.mouse.up();
    await sleep(300);
    await page.screenshot({ path: path.join(OUT, `${tag}-3-dragged.jpg`), type: "jpeg", quality: 85 });
    await page.mouse.dblclick(cx, cy);
    await sleep(300);
    ok(`${tag}: double-click resets`, await page.evaluate(() => document.body.innerText.includes("scroll on the screen to zoom")));
    await page.getByText("Expand").first().click();
    await sleep(800);
    await page.screenshot({ path: path.join(OUT, `${tag}-4-expand.jpg`), type: "jpeg", quality: 85 });
    await page.close();
  }
  {
    const page = await open(browser, 1920, 1080, "How the Heart Pumps Blood");
    for (let i = 0; i < 600; i++) { await sleep(200); if (await page.getByText("View in 3D").count()) break; }
    await sleep(1500);
    await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /View in 3D/.test(x.innerText))?.click());
    let lit = [];
    for (let i = 0; i < 300 && !lit.length; i++) {
      await sleep(200);
      lit = await page.evaluate(() => [...document.querySelectorAll("div")].filter((d) => d.className.includes("scale-110") && d.className.includes("bg-accent")).map((d) => d.innerText));
    }
    ok("heart: the narration lights a model label", lit.length > 0, lit.join(", "));
    await pause(page);
    await page.screenshot({ path: path.join(OUT, `heart-focus-1920x1080.jpg`), type: "jpeg", quality: 85 });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(2); });
