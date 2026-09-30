// V8.4c before/after capture. node capture.cjs <label> <baseUrl> <themes> <mode: demo|probes|shell|toggle>
// themes: light,dark,stored-dark,stored-light (real themes; see common.cjs). SIZES=360x780,... to override.
// AUDIT=1 runs the AA, target and layout checks at every state; REDUCED=1 emulates prefers-reduced-motion.
// Free routes only: /demo, /dev/free-model, /dev/desk-quiz, and /dev/learn-shell (local harness, not in git,
// every /api call mocked in the page). Syntax-check with `node --check`, never by requiring this file.
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi, sceneReady, click, FAKE_SR, LAYOUT } = require("./common.cjs");
const { AA, TARGETS } = require("./check.cjs");
const AUDIT = !!process.env.AUDIT;
const audit = [];
const [, , label = "before", base = "http://localhost:3000", themesArg = "light", mode = "demo"] = process.argv;
const OUT = path.join(__dirname, "..", label + (process.env.REDUCED ? "-reduced" : ""));
fs.mkdirSync(OUT, { recursive: true });
const ALL = [[360, 780], [768, 1024], [1024, 768], [1280, 720], [1440, 900]];
const SIZES = process.env.SIZES ? ALL.filter(([w, h]) => process.env.SIZES.split(",").includes(`${w}x${h}`)) : [ALL[0], ALL[1], ALL[3]];
const report = { label, mode, shots: [], layout: {}, paid: [], api: [], calls: {}, notes: [] };
const NEXT = /^(Next( question)?( →)?|See [Rr]esults)$/;
// The probe pages carry a dev tuning UI that is not product: audit only the product parts there.
const SCOPE = { probes: ".aristo-paper, .theme-ink", demo: "", shell: "", toggle: "" }[mode];

async function shot(page, name) {
  const file = `${name}.jpg`;
  await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 72 });
  report.shots.push(file);
  report.layout[name] = await page.evaluate(LAYOUT);
  if (AUDIT) {
    const w = page.viewportSize().width;
    audit.push({ name, w, aa: await page.evaluate(AA, SCOPE), tg: await page.evaluate(TARGETS, SCOPE) });
  }
}

async function demo(page, tag) {
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await sceneReady(page);
  await shot(page, `demo-picker-${tag}`);
  await page.getByText("How Volcanoes Erupt").first().click();
  await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
  await sleep(2500);
  await shot(page, `demo-lesson-${tag}`);
  await click(page, /^(Next →|Next)$/); await sleep(1500);
  await click(page, /Next sentence/); await sleep(3500);
  await shot(page, `demo-image-${tag}`);
  if (await click(page, /^(View in 3D|Show 3D)$/)) {
    await sleep(5000);
    await shot(page, `demo-model-${tag}`);
    await click(page, /^Show image$/); await sleep(1200);
  }
  if (await click(page, /Take (the )?quiz/i)) {
    await sleep(3500);
    await shot(page, `demo-desk-q1-${tag}`);
    await click(page, /^Lava$/); await sleep(700);
    await click(page, NEXT); await sleep(900);
    await click(page, /^True$/); await sleep(700);
    await click(page, NEXT); await sleep(2500);
    await shot(page, `demo-results-${tag}`);
  } else report.notes.push(`${tag}: no take-quiz button`);
}

async function probes(page, tag) {
  for (const room of ["", "?room=alt"]) {
    await page.goto(`${base}/dev/free-model${room}`, { waitUntil: "domcontentloaded" });
    await sceneReady(page);
    for (const st of ["empty", "image", "model"]) {
      await click(page, new RegExp(`^${st}$`));
      await sleep(3000);
      await shot(page, `probe-free-${st}${room ? "-alt" : ""}-${tag}`);
    }
  }
  await page.goto(`${base}/dev/desk-quiz`, { waitUntil: "domcontentloaded" });
  await sceneReady(page);
  await sleep(2500);
  await shot(page, `probe-desk-${tag}`);
}

const MSGS = [
  { id: "u1", role: "user", content: "How do volcanoes erupt?", timestamp: 1 },
  { id: "a1", role: "assistant", content: "**Definition:** A volcanic eruption is when magma, gas and ash escape through an opening in the Earth's crust.\n\n**Explanation:** Magma is lighter than the rock around it, so it rises. Gas dissolved in it forms bubbles as it rises, and the pressure builds until the rock above gives way.\n\n**Example:** Shake a bottle of fizzy water and open it: the gas that was dissolved rushes out and carries the water with it.\n\n**Fun fact:** Some volcanoes erupt under the sea, and a few of them have built new islands.", timestamp: 2 },
  { id: "u2", role: "user", content: "What is lava?", timestamp: 3 },
  { id: "a2", role: "assistant", content: "Lava is magma that has reached the surface. This bubble had no sections, so it shows as one card.", timestamp: 4 },
];

async function shell(page, tag) {
  const go = async (qs) => { await page.goto(`${base}/dev/learn-shell${qs}`, { waitUntil: "domcontentloaded" }); };
  await go("?v=loading"); await sleep(1500);
  await shot(page, `shell-loading-${tag}`);
  await go("?v=stalled"); await sleep(1500);
  await shot(page, `shell-loading-stalled-${tag}`);

  await go("?courses=empty"); await sceneReady(page); await sleep(800);
  await shot(page, `shell-picker-empty-${tag}`);
  await go("?gen=hang"); await sceneReady(page); await sleep(800);
  await click(page, /Generate My Course|Build my course/); await sleep(600);
  await shot(page, `shell-picker-generating-${tag}`);
  await go("?gen=fail"); await sceneReady(page); await sleep(800);
  await click(page, /Generate My Course|Build my course/); await sleep(800);
  await shot(page, `shell-picker-error-${tag}`);

  await go(""); await sceneReady(page); await sleep(1000);
  await shot(page, `shell-picker-${tag}`);
  await click(page, /Explore [Ff]reely/); await sleep(1200);
  await shot(page, `shell-free-empty-${tag}`);
  await page.evaluate((m) => window.__store.setState({ messages: m }), MSGS); await sleep(1500);
  await page.evaluate(() => { const s = document.querySelector(".aristo-scroll"); if (s) s.scrollTop = 0; }); await sleep(300);
  await shot(page, `shell-free-cards-${tag}`);
  await page.evaluate(() => { const s = document.querySelector(".aristo-scroll"); if (s) s.scrollTop = s.scrollHeight; }); await sleep(300);
  await shot(page, `shell-free-cards-end-${tag}`);
  await page.evaluate(() => window.__store.getState().setPreviewZoomUrl("/images/landing/classroom-lesson.webp")); await sleep(1500);
  await shot(page, `shell-lightbox-${tag}`);
  await page.evaluate(() => window.__store.getState().setPreviewZoomUrl(null)); await sleep(300);

  // Daily review over the room: quiz, answers, done.
  await click(page, /due/); await sleep(1500);
  await shot(page, `shell-review-quiz-${tag}`);
  await click(page, /^Lava$/); await sleep(1200);
  await shot(page, `shell-review-answered-${tag}`);
  await click(page, NEXT); await sleep(700);
  await click(page, /^True$/); await sleep(1200);
  await click(page, NEXT); await sleep(1500);
  await shot(page, `shell-review-done-${tag}`);
  await click(page, /Continue [Ll]earning/); await sleep(800);

  // Course mode: the mocked lesson route returns the demo volcano lesson; then the desk quiz.
  await page.evaluate(() => {
    const s = window.__store.getState();
    s.setCourse({ courseId: "c-earth", title: "Earth Science: Inside the Planet", domain: "earth_science", topics: ["volcano-eruption", "heart"], currentTopicIndex: 0, sessionId: null, structure: { modules: [{ id: "m1", title: "Inside the Earth", description: "", lessons: [{ id: "l1", title: "Volcanoes", concept_ids: ["volcano-eruption", "heart"] }] }] } });
    s.setMode("course");
  });
  await sleep(4000);
  await shot(page, `shell-course-lesson-${tag}`);
  if (await click(page, /Take (the )?quiz/i)) {
    await sleep(3500);
    await shot(page, `shell-course-desk-${tag}`);
    await click(page, /^Lava$/); await sleep(1000);
    await click(page, NEXT); await sleep(900);
    await click(page, /^True$/); await sleep(1000);
    await click(page, NEXT); await sleep(2500);
    await shot(page, `shell-course-advance-${tag}`);
  } else report.notes.push(`${tag}: no course take-quiz button`);

  await go("?review=empty"); await sceneReady(page); await sleep(800);
  await click(page, /Explore [Ff]reely/); await sleep(600);
  await click(page, /due/); await sleep(1200);
  await shot(page, `shell-review-empty-${tag}`);
  await go("?review=hang"); await sceneReady(page); await sleep(800);
  await click(page, /Explore [Ff]reely/); await sleep(600);
  await click(page, /due/); await sleep(1000);
  await shot(page, `shell-review-loading-${tag}`);
  report.calls[tag] = await page.evaluate(() => window.__calls);
}

// The classroom toggle: click it, check the attribute and the stored key, reload, and read the first paint.
async function toggle(page, tag) {
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await sceneReady(page);
  const t = page.locator('button[aria-label^="Switch to"]').first();
  if (!(await t.count())) { report.notes.push(`${tag}: no toggle on /demo`); return; }
  const before = await page.evaluate(() => ({ attr: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("aristo-theme"), bg: getComputedStyle(document.body).backgroundColor }));
  const labelBefore = await t.getAttribute("aria-label");
  await t.click(); await sleep(400);
  const after = await page.evaluate(() => ({ attr: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("aristo-theme"), bg: getComputedStyle(document.body).backgroundColor }));
  await shot(page, `toggle-after-click-${tag}`);
  // First paint after a reload: the SSR loading screen, before any client JS has hydrated.
  await page.route("**/_next/static/chunks/**", (r) => r.abort());
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await sleep(500);
  const firstPaint = await page.evaluate(() => ({ attr: document.documentElement.getAttribute("data-theme"), bg: getComputedStyle(document.body).backgroundColor, loading: getComputedStyle(document.querySelector('[class*="z-[100]"] > div') || document.body).backgroundColor }));
  await page.screenshot({ path: path.join(OUT, `toggle-first-paint-${tag}.jpg`), type: "jpeg", quality: 72 });
  report.toggle = report.toggle || {};
  report.toggle[tag] = { labelBefore, before, after, firstPaint };
}

(async () => {
  const browser = await chromium.launch(LAUNCH);
  for (const theme of themesArg.split(",")) for (const [w, h] of SIZES) {
    const tag = (w === 1024 || w === 1440) ? `${w}x${h}-${theme}` : `${w}-${theme}`;
    const ctx = await themedContext(browser, theme, { width: w, height: h });
    await ctx.addInitScript(FAKE_SR);
    const page = await ctx.newPage();
    await guardApi(page, report);
    try {
      if (mode === "demo") await demo(page, tag);
      if (mode === "probes") await probes(page, tag);
      if (mode === "shell") await shell(page, tag);
      if (mode === "toggle") await toggle(page, tag);
    } catch (e) { console.error("FAILED", tag, e.message.split("\n")[0]); report.notes.push(`${tag}: FAILED ${e.message.split("\n")[0]}`); }
    await ctx.close();
    console.log("done", tag);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `report-${mode}.json`), JSON.stringify(report, null, 1));
  const L = Object.entries(report.layout);
  console.log("layout: overflow", L.filter(([, l]) => l.scrollW > l.vw).map(([n]) => n).length,
    "panel outside", L.filter(([, l]) => l.panelInside === false).map(([n]) => n).length,
    "card under panel", L.filter(([, l]) => l.cardUnderPanel).map(([n]) => n).join(" ") || 0,
    "card under strip", L.filter(([, l]) => l.cardUnderStrip).map(([n]) => n).join(" ") || 0,
    "bars outside", L.filter(([, l]) => !l.barsInside).map(([n]) => n).join(" ") || 0);
  if (AUDIT) {
    const all = audit.flatMap((a) => a.aa.map((r) => ({ ...r, name: a.name })));
    const fails = all.filter((r) => r.ratio < r.need);
    const min = (re) => { const v = all.filter((r) => re.test(r.name)).map((r) => r.ratio); return v.length ? Math.min(...v).toFixed(2) : "-"; };
    console.log("AA nodes", all.length, "fails", fails.length, "min light", min(/-light$/), "min dark", min(/-dark$/));
    const seen = new Set();
    for (const f of fails) { const k = f.t + f.ratio; if (seen.has(k)) continue; seen.add(k); console.log("FAIL", f.name, JSON.stringify(f.t), f.ratio, "<", f.need, f.fg, "on", f.bg); }
    const small = new Set(audit.flatMap((a) => a.tg.s.map((x) => a.name.replace(/-\d+(x\d+)?-[a-z-]+$/, "") + ": " + x)));
    console.log("under-44 targets", small.size); [...small].slice(0, 40).forEach((x) => console.log("  ", x));
    const anim = new Set(audit.flatMap((a) => a.tg.a));
    console.log("running animations", anim.size); [...anim].slice(0, 20).forEach((x) => console.log("  ", x));
    fs.writeFileSync(path.join(OUT, `audit-${mode}.json`), JSON.stringify(audit, null, 1));
  }
  console.log("shots", report.shots.length, "paid", report.paid.length, "api at network", report.api.length, "notes", report.notes.length);
  report.notes.forEach((n) => console.log("  note", n));
})();
