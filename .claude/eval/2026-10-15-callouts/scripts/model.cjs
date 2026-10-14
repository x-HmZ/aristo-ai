// Where the 3D model sits today: /demo heart lesson, wait for the board image, press "View in 3D". 0 API calls.
const path = require("path"); const fs = require("fs"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const OUT = path.join(__dirname, "..", "placement"); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto("http://localhost:3000/demo");
    await p.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 120000 });
    await sleep(800); await p.getByText("How the Heart Pumps Blood").first().click();
    for (let i = 0; i < 600; i++) { await sleep(200); if (await p.getByText("View in 3D").count()) break; }
    await sleep(2000);
    await p.screenshot({ path: path.join(OUT, `heart-image-${w}x${h}.jpg`), type: "jpeg", quality: 80 });
    await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /View in 3D/.test(x.innerText))?.click());
    await sleep(6000);
    await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /^Pause$/.test(x.innerText.trim()))?.click());
    await p.screenshot({ path: path.join(OUT, `heart-model-${w}x${h}.jpg`), type: "jpeg", quality: 80 });
    console.log("ok", w);
    await p.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(2); });
