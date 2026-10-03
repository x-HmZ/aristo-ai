// Jake on his own (no room), in the poses the V8.3b mockups need, as transparent PNGs trimmed to him. From
// /dev/avatar-lab ("lesson" framing, the product's resting face, blink held open). Free route, no /api calls.
// Usage: node jake-poses.cjs [base]
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const BASE = process.argv.find((a) => a.startsWith("http")) || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "mockups", "jake");
const POSES = [
  { id: "idle" },
  { id: "wave", gesture: "Talking6M", at: 700 },
  { id: "present", gesture: "PresentModel", at: 1100 },
  { id: "hold", gesture: "HoldIdea", at: 1000 },
  { id: "step", gesture: "StepBeat", at: 700 },
  { id: "point", clip: "Pointing", at: 2500 },
  { id: "think", clip: "Thinking", at: 2500 },
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const api = [];
  for (const p of POSES) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2 });
    await page.addInitScript(() => { new MutationObserver(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.style.setProperty("display", "none", "important"))).observe(document, { childList: true, subtree: true }); });
    await page.route("**/api/**", (x) => { api.push(x.request().url()); return x.abort(); });
    await page.goto(`${BASE}/dev/avatar-lab?who=jake&view=lesson&clip=${p.clip || "Idle"}&blink=0`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector("canvas", { timeout: 90000 });
    await page.waitForTimeout(7000); // the model, then the lazy clip pack
    if (p.gesture) {
      const ok = await page.evaluate((name) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === name); if (b) b.click(); return !!b; }, p.gesture);
      if (!ok) throw new Error("no gesture button " + p.gesture);
    }
    await page.waitForTimeout(p.at || 400);
    await page.addStyleTag({ content: "html,body,body *:not(canvas){background:transparent !important}" });
    const png = await (await page.$("canvas")).screenshot({ omitBackground: true });
    // Trim to Jake's alpha box, with a small margin.
    const trimmed = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(c.width - 1, x1 + m); y1 = Math.min(c.height - 1, y1 + m);
      const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
      o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
      return { url: o.toDataURL("image/webp", 0.9), w: o.width, h: o.height };
    }, png.toString("base64"));
    fs.writeFileSync(path.join(OUT, p.id + ".webp"), Buffer.from(trimmed.url.split(",")[1], "base64"));
    console.log(p.id, trimmed.w + "x" + trimmed.h);
    await page.close();
  }
  console.log("api calls:", api.length);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
