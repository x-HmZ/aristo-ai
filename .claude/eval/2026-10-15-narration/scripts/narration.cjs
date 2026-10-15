// /demo narration: for each listed topic, pick it, let the lesson play ~25 s, and check that the recorded mp3s are what plays
// (real durations, one after another, not racing), each with its .align.json (lip sync), 0 /api requests, no teacher switcher.
// Usage: node narration.cjs [baseUrl=http://localhost:3000] [outDir]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const base = process.argv[2] || "http://localhost:3000";
const OUT = process.argv[3] || path.join(__dirname, "..");
const TOPICS = [["How the Heart Pumps Blood", "heart"], ["How Volcanoes Erupt", "volcano-eruption"], ["How Your Brain Is Organised", "brain"], ["Steepness Is Speed", "steepness-speed"]];
const problems = [];
const ok = (name, pass, extra = "") => { console.log(pass ? "PASS" : "FAIL", name, extra); if (!pass) problems.push(name + " " + extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  for (const [title, slug] of TOPICS) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    const api = [], mp3 = [], align = [];
    page.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/")) api.push(u.pathname); });
    page.on("response", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith(`/demo/${slug}/`) && u.pathname.endsWith(".mp3")) mp3.push([u.pathname, r.status()]);
      if (u.pathname.startsWith(`/demo/${slug}/`) && u.pathname.endsWith(".align.json")) align.push([u.pathname, r.status()]);
    });
    await page.addInitScript(() => {
      window.__plays = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        const rec = { src: this.currentSrc || this.src, t0: performance.now(), dur: null, ended: false };
        window.__plays.push(rec);
        this.addEventListener("loadedmetadata", () => { if (rec.dur === null) rec.dur = this.duration; }, { once: true });
        this.addEventListener("ended", () => { rec.ended = true; }, { once: true });
        return play.apply(this, arguments);
      };
    });
    await page.goto(`${base}/demo?teacher=mj`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 120000 });
    await sleep(800);
    ok(`${slug}: no teacher switcher, Jake opens even with ?teacher=mj`, (await page.getByText("Teacher", { exact: true }).count()) === 0 && !(await page.getByRole("button", { name: /^MJ$/ }).count()));
    await page.getByText(title).first().click();
    await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
    await sleep(14000);
    await page.screenshot({ path: path.join(OUT, `${slug}-talking.png`) });
    await sleep(14000);
    const plays = await page.evaluate(() => window.__plays);
    // Demo audio is fetched as a blob and played from a blob: URL, so a play() is matched to a recorded mp3 by order.
    const real = plays.filter((p) => p.src && p.dur !== null);
    ok(`${slug}: recorded mp3s play`, real.length >= 2, `${real.length} played: ${real.map((p) => (p.dur ? p.dur.toFixed(1) + "s" : "?")).join(" ")}`);
    ok(`${slug}: segments last their audio, not racing (first mp3 >= 3 s)`, real.length > 0 && real[0].dur > 3);
    ok(`${slug}: every mp3 request 200`, mp3.length > 0 && mp3.every(([, s]) => s === 200 || s === 206 || s === 304), mp3.map(([u, s]) => u.split("/").pop() + ":" + s).join(" "));
    ok(`${slug}: timings (.align.json) fetched 200 for what played`, align.length >= real.length && align.every(([, s]) => s === 200), `${align.length}`);
    ok(`${slug}: 0 /api requests`, api.length === 0, api.join(","));
    await ctx.close();
  }
  await browser.close();
  console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall pass");
  process.exit(problems.length ? 1 : 0);
})();
