// With the transcript open, the highlighted sentence stays visible inside the panel scroll (above the playback row).
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const [w, h] of [[1280, 720], [768, 1024]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await p.goto("http://localhost:3000/demo");
    await p.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
    await p.getByText("How Volcanoes Erupt").first().click();
    await p.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
    await p.getByRole("button", { name: "Transcript" }).click();
    const rows = [];
    for (let i = 0; i < 9; i++) {
      await p.getByRole("button", { name: "Next sentence" }).click();
      await sleep(1200);
      rows.push(await p.evaluate(() => {
        const a = document.querySelector('#lesson-transcript [aria-current="true"]');
        const s = a?.closest(".aristo-scroll");
        if (!a || !s) return "none";
        const ar = a.getBoundingClientRect(), sr = s.getBoundingClientRect();
        return ar.top >= sr.top - 1 && ar.bottom <= sr.bottom - 90 ? "visible" : `off (${Math.round(ar.top)}..${Math.round(ar.bottom)} vs ${Math.round(sr.top)}..${Math.round(sr.bottom - 96)})`;
      }));
    }
    console.log(`${w}x${h}`, rows.join(", "));
  }
  await b.close();
})();
