// V10 step 4: the widget in the real shell pieces, driven by the real playback hook. 0 API calls:
// every /api request is answered by a stub here or aborted and counted.
// Usage: node room.cjs [baseUrl=http://localhost:3000] [only=happy,sizes,fail,slow,frame,skip]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));

const base = process.argv[2] || "http://localhost:3000";
const only = (process.argv[3] || "happy,sizes,fits,fail,window,slow,frame,skip,reset,tab").split(",");
const OUT = path.join(__dirname, "..", "room");
fs.mkdirSync(OUT, { recursive: true });
const report = { shots: [], checks: [], problems: [], stubbed: {}, aborted: [] };
const ok = (name, pass, extra = "") => { report.checks.push({ name, pass, extra }); if (!pass) report.problems.push(`${name} ${extra}`); console.log(pass ? "PASS" : "FAIL", name, extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One second of silence, so the audio element ends and the hook advances.
function silentWav(seconds = 1, rate = 8000) {
  const n = seconds * rate, buf = Buffer.alloc(44 + n, 0x80);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34); buf.write("data", 36); buf.writeUInt32LE(n, 40);
  return buf;
}
const WAV = silentWav(1);

// afterExplore: the stub answers a fixed time AFTER the explore narration has ended (the wait window is 8 s),
// which does not depend on how fast the scene happened to load.
async function open(browser, { w, h, interactive = "ok", delayMs = 0, afterExplore = 0, q = "view=room&fixture=slope-line" }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url()).pathname;
    report.stubbed[url] = (report.stubbed[url] || 0) + 1;
    if (url === "/api/tts") return route.fulfill({ status: 200, contentType: "audio/wav", body: WAV });
    if (url === "/api/learn/complete") return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    if (url === "/api/learn/interactive") {
      if (delayMs) await sleep(delayMs);
      if (afterExplore) {
        await page.waitForFunction(() => { const s = window.__aristoStore.getState(); return s.currentSegmentId === "seg_005" && !s.isSpeaking; }, null, { timeout: 90000 });
        await sleep(afterExplore);
      }
      if (interactive === "500") return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "stub" }) });
      const fx = await page.evaluate(() => window.__aristoFixtures.find((f) => f.id === new URLSearchParams(location.search).get("fixture")) || window.__aristoFixtures[0]);
      const parts = interactive === "throws" ? { ...fx.parts, js: "throw new Error('boom');" } : fx.parts;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(parts) });
    }
    report.aborted.push(url);
    return route.abort();
  });
  await page.goto(`${base}/dev/interactive?${q}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas") && !!window.__aristoStore, null, { timeout: 120000 });
  return { ctx, page, errors };
}

const S = (page) => page.evaluate(() => { const s = window.__aristoStore.getState(); return { seg: s.currentSegmentId, exploring: s.exploring, status: s.interactive.status, shown: s.interactiveShown, expanded: s.interactiveExpanded, complete: s.lessonComplete }; });
const waitStore = (page, fn, arg, ms = 40000) => page.waitForFunction(`(${fn})(window.__aristoStore.getState(), ${JSON.stringify(arg ?? null)})`, null, { timeout: ms }).then(() => true).catch(() => false);
const card = (page) => page.locator('[data-testid="interactive-card"]');
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 72 }); report.shots.push(`${name}.jpg`); };
const screenRect = (page) => page.evaluate(() => window.__aristoStore.getState().screenRect);
// 2026-10-15: the widget plays ON the room's display (board) where the screen is at least 520 px wide on the page,
// with Expand / Hide / Continue in a strip under it; smaller screens get the large view (a dialog).
const MIN_BOARD_W = 520;
const onScreen = (c, r) => !!r && Math.abs(c.l - r.x) <= 2 && Math.abs(c.t - r.y) <= 2 && Math.abs(c.w - r.w) <= 2 && Math.abs(c.h - r.h) <= 2;
const rect = (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });

  // ── A. the happy path at 1920x1080 (the widget on the room's display) ──────
  if (only.includes("happy")) {
    const { ctx, page, errors } = await open(browser, { w: 1920, h: 1080 });
    const gated = await waitStore(page, "(s) => s.exploring === true");
    ok("happy: the lesson pauses on the explore segment", gated);
    let st = await S(page);
    ok("happy: paused on seg_005 with the widget ready", st.seg === "seg_005" && st.status === "ready" && st.shown, JSON.stringify(st));
    await sleep(1500);
    ok("happy: nothing advances while it is paused", (await S(page)).seg === "seg_005");
    await card(page).waitFor({ state: "visible", timeout: 10000 });
    const c = await rect(card(page));
    const sr = await screenRect(page);
    const panel = await rect(page.locator('[class*="w-[400px]"]').first());
    const band = await page.locator("[data-caption-band]").count() ? await rect(page.locator("[data-caption-band]").first()) : null;
    ok("happy: the widget fills the room's display", onScreen(c, sr), JSON.stringify({ c, sr }));
    ok("happy: the display is left of the panel", c.r <= panel.l, JSON.stringify({ c, panel }));
    ok("happy: the display clears the caption band", !band || c.b <= band.t + 1, JSON.stringify({ c, band }));
    const strip = await rect(page.locator('[data-testid="interactive-strip"]'));
    ok("happy: the strip sits under the screen, clear of the panel and the band", strip.t >= c.b && strip.r <= panel.l && (!band || strip.b <= band.t + 1), JSON.stringify({ strip, band }));
    ok("happy: Continue is visible", await page.getByRole("button", { name: "Continue" }).isVisible());
    await shot(page, "1920x1080-explore");

    const f = card(page).frameLocator("iframe");
    await f.locator("#m").fill("-3");
    ok("happy: the widget responds on the board", /-3x/.test(await f.locator("#eq").textContent()));

    await page.getByRole("button", { name: "Expand" }).click();
    await sleep(500);
    ok("happy: Expand opens a dialog", (await card(page).getAttribute("role")) === "dialog");
    const big = await rect(card(page));
    ok("happy: the large view is larger and centred", big.w > c.w * 1.3 && Math.abs((big.l + big.r) / 2 - 960) < 6, JSON.stringify(big));
    ok("happy: slider state survives Expand", /-3x/.test(await f.locator("#eq").textContent()));
    await shot(page, "1920x1080-large");
    await f.locator("#m").focus(); // keys now go to the widget's own document, not the page
    await page.keyboard.press("Escape");
    await sleep(500);
    ok("happy: Escape returns to the board", (await card(page).getAttribute("role")) === "group" && (await S(page)).shown);
    ok("happy: slider state survives Collapse", /-3x/.test(await f.locator("#eq").textContent()));

    await page.locator('[data-testid="interactive-strip"]').getByRole("button", { name: "Hide the interactive" }).click();
    await sleep(300);
    ok("happy: Hide shows the Open pill", await page.getByRole("button", { name: "Open interactive" }).isVisible() && !(await card(page).isVisible()));
    ok("happy: Hide leaves Continue reachable while paused", await page.getByRole("button", { name: "Continue" }).isVisible());
    await shot(page, "1920x1080-hidden");
    await page.getByRole("button", { name: "Open interactive" }).click();
    await sleep(400);
    ok("happy: Open brings it back with state kept", (await card(page).isVisible()) && /-3x/.test(await f.locator("#eq").textContent()));

    await page.getByRole("button", { name: "Continue" }).click();
    const moved = await waitStore(page, "(s) => s.currentSegmentId === 'seg_006'");
    st = await S(page);
    ok("happy: Continue resumes the lesson", moved && !st.exploring, JSON.stringify(st));
    ok("happy: the card steps aside, the pill stays", !st.shown && (await page.getByRole("button", { name: "Open interactive" }).isVisible()));
    const done = await waitStore(page, "(s) => s.lessonComplete === true");
    ok("happy: the lesson finishes", done);
    ok("happy: no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
    await ctx.close();
  }

  // ── B. other sizes ──────────────────────────────────────────────────────────
  if (only.includes("sizes")) {
    for (const [w, h] of [[1920, 1080], [1600, 900], [1440, 900], [1280, 720], [1024, 768], [768, 1024], [360, 780]]) {
      const { ctx, page } = await open(browser, { w, h });
      await waitStore(page, "(s) => s.exploring === true");
      await sleep(1200); // the framing settles before the screen's size is read
      const sr = await screenRect(page);
      const expectRole = sr && sr.w >= MIN_BOARD_W && sr.x >= 0 && sr.y >= 0 && sr.x + sr.w <= w - 420 ? "group" : "dialog";
      const role = await card(page).getAttribute("role");
      ok(`size ${w}x${h}: ${expectRole === "group" ? "on the display" : "large view"} (screen ${sr ? sr.w : "-"} px wide)`, role === expectRole, role);
      const c = await rect(card(page));
      ok(`size ${w}x${h}: inside the viewport`, c.l >= 0 && c.t >= 0 && c.r <= w && c.b <= h, JSON.stringify(c));
      if (expectRole === "group") ok(`size ${w}x${h}: fills the display`, onScreen(c, sr), JSON.stringify({ c, sr }));
      const cont = page.getByRole("button", { name: "Continue" });
      const cb = await rect(cont);
      ok(`size ${w}x${h}: Continue reachable`, (await cont.isVisible()) && cb.b <= h && cb.r <= w && cb.h >= 44, JSON.stringify(cb));
      if (expectRole === "group") {
        const panel = await rect(page.locator('[class*="w-[400px]"]').first());
        ok(`size ${w}x${h}: left of the panel`, c.r <= panel.l, JSON.stringify({ c, panel }));
        const band = await page.locator("[data-caption-band]").count() ? await rect(page.locator("[data-caption-band]").first()) : null;
        ok(`size ${w}x${h}: clears the caption band`, !band || c.b <= band.t + 1, JSON.stringify({ c, band }));
      }
      const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(`size ${w}x${h}: no horizontal overflow`, sw <= 0, `${sw}`);
      await shot(page, `${w}x${h}-explore`);
      await ctx.close();
    }
  }

  // ── B2. does each fixture fit the display without scrolling? (1920x1080, the board at its most common) ──
  if (only.includes("fits")) {
    for (const id of ["slope-line", "fraction-bars", "for-loop"]) {
      const { ctx, page } = await open(browser, { w: 1920, h: 1080, q: `view=room&fixture=${id}` });
      await waitStore(page, "(s) => s.exploring === true");
      await sleep(600);
      const frame = page.frames().find((f) => f.parentFrame());
      const m = await frame.evaluate(() => ({ scroll: document.documentElement.scrollHeight, view: document.documentElement.clientHeight }));
      ok(`fits: ${id} needs no scrolling on the display at 1920x1080`, m.scroll - m.view <= 2, JSON.stringify(m));
      await shot(page, `fits-${id}-1920x1080`);
      await ctx.close();
    }
  }

  // ── B3. the pause cannot hang: the widget disappears under it ─────────────────
  if (only.includes("reset")) {
    const { ctx, page } = await open(browser, { w: 1280, h: 720 });
    await waitStore(page, "(s) => s.exploring === true");
    await page.evaluate(() => window.__aristoStore.getState().resetInteractive()); // what a chat reset does
    const moved = await waitStore(page, "(s) => s.currentSegmentId === 'seg_006'", null, 15000);
    const st = await S(page);
    ok("reset: clearing the widget under an open pause releases it", moved && !st.exploring, JSON.stringify(st));
    await ctx.close();
  }

  // ── B4. Tab stays inside the large view ─────────────────────────────────────
  if (only.includes("tab")) {
    const { ctx, page } = await open(browser, { w: 1024, h: 768 });
    await waitStore(page, "(s) => s.exploring === true");
    await sleep(500);
    const inside = () => page.evaluate(() => { const c = document.querySelector('[data-testid="interactive-card"]'); return !!c && c.contains(document.activeElement); });
    let always = true;
    for (let i = 0; i < 9; i++) { await page.keyboard.press("Tab"); if (!(await inside())) always = false; }
    ok("tab: nine Tabs from the dialog never leave it", always);
    await page.keyboard.press("Shift+Tab");
    ok("tab: Shift+Tab stays inside too", await inside());
    await ctx.close();
  }

  // ── C. fetch fails: no card, no pause, the lesson carries on ───────────────
  if (only.includes("fail")) {
    const { ctx, page } = await open(browser, { w: 1280, h: 720, interactive: "500" });
    const done = await waitStore(page, "(s) => s.lessonComplete === true", null, 60000);
    const st = await S(page);
    ok("fail: the lesson completes without a pause", done && st.status === "failed" && !st.exploring, JSON.stringify(st));
    ok("fail: no card, no pill", (await card(page).count()) === 0 && (await page.getByRole("button", { name: "Open interactive" }).count()) === 0);
    await shot(page, "fail-500-after");
    await ctx.close();
  }

  // ── D0. a widget that lands inside the 8 s wait after the explore narration still gets its pause ──
  if (only.includes("window")) {
    const { ctx, page } = await open(browser, { w: 1280, h: 720, afterExplore: 3000 });
    const gated = await waitStore(page, "(s) => s.exploring === true", null, 60000);
    const st = await S(page);
    ok("window: a widget arriving during the wait still pauses the lesson", gated && st.seg === "seg_005" && st.shown, JSON.stringify(st));
    await ctx.close();
  }

  // ── D. slow: past the wait window, the lesson goes on without it ────────────
  if (only.includes("slow")) {
    const { ctx, page } = await open(browser, { w: 1280, h: 720, afterExplore: 12000 });
    const t0 = Date.now();
    await waitStore(page, "(s) => s.currentSegmentId === 'seg_005'", null, 60000);
    const passed = await waitStore(page, "(s) => s.currentSegmentId === 'seg_006'", null, 60000);
    const waited = Date.now() - t0;
    ok("slow: it gave up waiting and went on", passed, `${Math.round(waited / 1000)}s from start`);
    ok("slow: it never paused for the learner", !(await S(page)).exploring);
    const late = await waitStore(page, "(s) => s.interactive.status === 'ready'", null, 60000);
    ok("slow: a late widget still arrives, behind the pill", late && (await page.getByRole("button", { name: "Open interactive" }).isVisible()));
    await ctx.close();
  }

  // ── E. the widget throws: reported, skipped ─────────────────────────────────
  if (only.includes("frame")) {
    const { ctx, page } = await open(browser, { w: 1280, h: 720, interactive: "throws" });
    const done = await waitStore(page, "(s) => s.lessonComplete === true", null, 60000);
    const st = await S(page);
    ok("frame: a widget that throws never pauses the lesson", done && st.status === "failed" && !st.exploring, JSON.stringify(st));
    ok("frame: and leaves nothing on screen", (await card(page).count()) === 0);
    await ctx.close();
  }

  // ── F. skipping out of the pause with the player controls (board view: below it the dialog is modal) ──
  if (only.includes("skip")) {
    const { ctx, page } = await open(browser, { w: 1920, h: 1080 });
    await waitStore(page, "(s) => s.exploring === true");
    await page.getByRole("button", { name: "Next sentence" }).click();
    const moved = await waitStore(page, "(s) => s.currentSegmentId === 'seg_006'");
    const st = await S(page);
    ok("skip: Next sentence leaves the pause cleanly", moved && !st.exploring && !st.shown, JSON.stringify(st));
    await ctx.close();
  }

  await browser.close();
  ok("no /api request left the stubs", report.aborted.length === 0, report.aborted.join(","));
  console.log("stubbed:", JSON.stringify(report.stubbed));
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(report.problems.length ? `\n${report.problems.length} PROBLEMS` : "\nALL PASS");
  process.exit(report.problems.length ? 1 : 0);
})();
