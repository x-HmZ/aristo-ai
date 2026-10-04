// A contact sheet of the captured Jake poses (../mockups/jake/*.webp), to pick frames for the mockups.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const DIR = path.join(__dirname, "..", "mockups", "jake");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 700 } });
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".webp"));
  await p.setContent(`<body style="margin:0;padding:16px;background:#0E1117;color:#fff;font:14px system-ui;display:flex;gap:16px;align-items:flex-end">${files.map((f) => `<figure style="margin:0"><img style="height:560px" src="data:image/webp;base64,${fs.readFileSync(path.join(DIR, f)).toString("base64")}"><figcaption>${f}</figcaption></figure>`).join("")}</body>`);
  await p.screenshot({ path: path.join(DIR, "..", "shots", "poses.png"), fullPage: true });
  await b.close();
})();
