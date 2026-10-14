// V10 security review follow-up: can a widget take the frame (or the page) somewhere else?
// Each /dev/interactive?fail=nav-* probe tries one route to 127.0.0.1:9 (a closed local port: nothing leaves
// the machine). A PASS means no request to it was even attempted from the frame, the frame stayed on its
// srcdoc, and no popup or download opened.
// Usage: node nav.cjs [baseUrl=http://localhost:3000]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const base = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "nav");
fs.mkdirSync(OUT, { recursive: true });
const report = { checks: [], problems: [], misc: null };
const ok = (name, pass, extra = "") => { report.checks.push({ name, pass, extra }); if (!pass) report.problems.push(`${name} ${extra}`); console.log(pass ? "PASS" : "FAIL", name, extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });

  for (const kind of ["nav-location", "nav-meta", "nav-anchor", "nav-open", "nav-history"]) {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
    const page = await ctx.newPage();
    const hits = [], popups = [], downloads = [];
    ctx.on("page", (p) => popups.push(p.url()));
    page.on("download", (d) => downloads.push(d.suggestedFilename()));
    const seen = (r) => { if (/127\.0\.0\.1:9\//.test(r.url())) hits.push(r.url()); };
    page.on("request", seen);
    page.on("requestfailed", seen);
    await page.goto(`${base}/dev/interactive?fixture=slope-line&theme=light&fail=${kind}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="status"]', { timeout: 60000 });
    await sleep(3500);
    const frameUrl = page.frames().find((f) => f.parentFrame())?.url() ?? "(frame gone)";
    ok(`${kind}: no request left the frame`, hits.length === 0, hits.join(" "));
    // Blocked by frame-src, Chromium swaps in its own error page (chrome-error://); never a real http(s) document.
    ok(`${kind}: the frame never became a remote page`, !/^https?:/.test(frameUrl), frameUrl);
    ok(`${kind}: no popup`, popups.length === 0, popups.join(" "));
    ok(`${kind}: no download`, downloads.length === 0, downloads.join(" "));
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
    const page = await ctx.newPage();
    const downloads = [], hits = [];
    page.on("download", (d) => downloads.push(d.suggestedFilename()));
    page.on("request", (r) => { if (/127\.0\.0\.1:9|stun/.test(r.url())) hits.push(r.url()); });
    await page.goto(`${base}/dev/interactive?fixture=slope-line&theme=light&fail=misc`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="status"]', { timeout: 60000 });
    await sleep(2500);
    const out = JSON.parse(await page.frameLocator("iframe").locator("#out").textContent());
    report.misc = out;
    console.log(JSON.stringify(out));
    ok("misc: execCommand copy refused", out.copy === "false" || /blocked/.test(out.copy), out.copy);
    ok("misc: no download from <a download>", downloads.length === 0, downloads.join(","));
    ok("misc: picture-in-picture not enabled", /false/.test(out.pip), out.pip);
    ok("misc: fullscreen not enabled", /false/.test(out.fullscreen), out.fullscreen);
    ok("misc: WebRTC blocked", /blocked/.test(out.rtc), out.rtc);
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(report.problems.length ? `\n${report.problems.length} PROBLEMS` : "\nALL PASS");
  process.exit(report.problems.length ? 1 : 0);
})();
