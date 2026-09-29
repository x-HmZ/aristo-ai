// V8.4b before/after capture. node capture.cjs <label> <baseUrl> <themes> <mode: demo|probes|harness>
// SIZES=360x780,... to override. Free routes only: /demo, /dev/desk-quiz, /dev/quiz-bars (local harness, not in git).
const fs = require("fs");
const path = require("path");
const { chromium, sleep, PAID, LAUNCH, sceneReady, applyTheme, click, FAKE_SR, mockQuiz } = require("./common.cjs");
const { AA, TARGETS } = require("./check.cjs");
// AUDIT=1 also runs the AA and target checks at every captured state (reduced motion: REDUCED=1).
const AUDIT = !!process.env.AUDIT;
const audit = [];
// Scopes: the harness frames, the desk card, and the bottom bars (rounded-b-2xl with a top border).
const SCOPE = "[data-h], .aristo-paper, .rounded-b-2xl.border-t";
const [, , label = "before", base = "http://localhost:3000", themesArg = "light", mode = "demo"] = process.argv;
const OUT = path.join(__dirname, "..", label);
fs.mkdirSync(OUT, { recursive: true });
const ALL = [[360, 780], [768, 1024], [1280, 720]];
const SIZES = process.env.SIZES ? ALL.filter(([w, h]) => process.env.SIZES.split(",").includes(`${w}x${h}`)) : ALL;
const report = { label, mode, shots: [], paid: [] };
const NEXT = /^(Next( question)?( →)?|See [Rr]esults)$/;

async function shot(page, name, sel) {
  const file = `${name}.jpg`;
  const opt = { path: path.join(OUT, file), type: "jpeg", quality: 72 };
  if (sel) await page.locator(sel).first().screenshot(opt); else await page.screenshot(opt);
  report.shots.push(file);
  if (AUDIT) {
    const w = page.viewportSize().width;
    const aa = await page.evaluate(AA, SCOPE);
    const tg = await page.evaluate(TARGETS, SCOPE);
    const fit = await page.evaluate(() => { const c = document.querySelector(".aristo-paper"); return c ? { h: c.scrollHeight, max: c.clientHeight } : null; });
    audit.push({ name, w, aa, tg, fit });
  }
}

async function demo(page, tag, theme) {
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await sceneReady(page);
  await page.getByText("How Volcanoes Erupt").first().click();
  await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
  await sleep(2000);
  // Walk to the challenge gate (AnswerInputPanel), then on to the quiz.
  await click(page, /^(Next →|Next)$/); await sleep(1200);
  await click(page, /Next sentence/); await sleep(2500);
  await click(page, /^(Next →|Next)$/); await sleep(1500);
  await click(page, /^(Next →|Next)$/); await sleep(2000);
  let gate = false;
  try { await page.waitForSelector("textarea", { timeout: 60000 }); gate = true; } catch { /* not reached */ }
  await applyTheme(page, theme);
  if (gate) {
    await shot(page, `demo-answer-listening-${tag}`);
    await click(page, /Stop listening|Speak/); await sleep(300); // FAKE_SR: stop -> typing
    await page.locator("textarea").first().fill("Pressure from gas pushes the magma up and out.");
    await sleep(300);
    await shot(page, `demo-answer-typing-${tag}`);
    await click(page, /^Skip$|Skip this question/); await sleep(2500);
  }
  await click(page, /^(Next →|Next)$/); await sleep(1500);
  await shot(page, `demo-take-quiz-bar-${tag}`);
  if (await click(page, /Take (the )?quiz/i)) {
    await sleep(3500);
    await shot(page, `demo-desk-q1-${tag}`);
    await click(page, /^Lava$/); await sleep(600);
    await shot(page, `demo-desk-q1-wrong-${tag}`);
    await click(page, NEXT); await sleep(900);
    await shot(page, `demo-desk-q2-${tag}`);
    await click(page, /^True$/); await sleep(600);
    await shot(page, `demo-desk-q2-correct-${tag}`);
    await click(page, NEXT); await sleep(2500);
    await shot(page, `demo-results-${tag}`);
  }
}

async function probes(page, tag, theme) {
  await page.goto(`${base}/dev/desk-quiz`, { waitUntil: "domcontentloaded" });
  await sceneReady(page);
  await applyTheme(page, theme);
  await sleep(2500);
  await shot(page, `probe-desk-q1-${tag}`);
}

async function harness(page, tag, theme) {
  await mockQuiz(page);
  await page.goto(`${base}/dev/quiz-bars?only=bars`, { waitUntil: "networkidle" });
  await applyTheme(page, theme);
  for (const id of ["loading", "take", "take-loading", "adv-pass", "adv-mid", "adv-low"]) await shot(page, `bar-${id}-${tag}`, `[data-h=${id}]`);
  await page.goto(`${base}/dev/quiz-bars?only=input`, { waitUntil: "networkidle" });
  await applyTheme(page, theme); await sleep(400);
  await shot(page, `answer-listening-${tag}`, "[data-h=answer]");
  await click(page, /Stop listening/); await sleep(200);
  await page.locator("[data-h=answer] textarea").fill("Pressure from gas pushes the magma up and out.");
  await shot(page, `answer-typing-${tag}`, "[data-h=answer]");
  await shot(page, `inputbox-idle-${tag}`, "[data-h=inputbox]");
  await page.locator("[data-h=inputbox] input").fill("How do volcanoes erupt");
  await shot(page, `inputbox-typed-${tag}`, "[data-h=inputbox]");
  await click(page, /^Speak$/); await sleep(300);
  await shot(page, `inputbox-listening-${tag}`, "[data-h=inputbox]");

  await page.goto(`${base}/dev/quiz-bars?only=quiz`, { waitUntil: "networkidle" });
  await applyTheme(page, theme); await sleep(400);
  const Q = "[data-h=quiz]";
  await shot(page, `quiz-1-mcq-${tag}`, Q);
  await click(page, /^Crust$/); await sleep(500);
  await shot(page, `quiz-1-selected-${tag}`, Q);
  await sleep(1500);
  await shot(page, `quiz-1-wrong-${tag}`, Q);
  await click(page, NEXT); await sleep(500);
  await shot(page, `quiz-2-tf-${tag}`, Q);
  await click(page, /^True$/); await sleep(2200);
  await shot(page, `quiz-2-correct-${tag}`, Q);
  await click(page, NEXT); await sleep(500);
  await shot(page, `quiz-3-fill-${tag}`, Q);
  await page.locator(`${Q} input`).fill("igneous");
  await shot(page, `quiz-3-fill-typed-${tag}`, Q);
  await click(page, /^Submit$/); await sleep(2200);
  await shot(page, `quiz-3-fill-result-${tag}`, Q);
  await click(page, NEXT); await sleep(500);
  await shot(page, `quiz-4-short-${tag}`, Q);
  await click(page, /I don't know/); await sleep(2200);
  await shot(page, `quiz-4-short-result-${tag}`, Q);
  await click(page, NEXT); await sleep(500);
  await shot(page, `quiz-5-code-${tag}`, Q);
  await click(page, /I don't know/); await sleep(2200);
  await click(page, NEXT); await sleep(500);
  await shot(page, `quiz-6-order-${tag}`, Q);
  await click(page, /^Submit [Oo]rder$/); await sleep(2200);
  await shot(page, `quiz-6-order-result-${tag}`, Q);
  await click(page, NEXT); await sleep(500);
  await shot(page, `quiz-7-match-${tag}`, Q);
  const sels = page.locator(`${Q} select`);
  const n = await sels.count();
  for (let i = 0; i < n; i++) await sels.nth(i).selectOption({ index: (i % 3) + 1 });
  await click(page, /^Submit [Mm]atches$/); await sleep(2200);
  await shot(page, `quiz-7-match-result-${tag}`, Q);
}

(async () => {
  const browser = await chromium.launch(LAUNCH);
  for (const theme of themesArg.split(",")) for (const [w, h] of SIZES) {
    const tag = `${w}-${theme}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: process.env.REDUCED ? "reduce" : "no-preference" });
    await ctx.addInitScript(FAKE_SR);
    const page = await ctx.newPage();
    page.on("request", (r) => { if (PAID.test(r.url())) report.paid.push(r.url()); });
    try {
      if (mode === "demo") await demo(page, tag, theme);
      if (mode === "probes") await probes(page, tag, theme);
      if (mode === "harness") await harness(page, tag, theme);
    } catch (e) { console.error("FAILED", tag, e.message.split("\n")[0]); }
    await ctx.close();
    console.log("done", tag);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `report-${mode}.json`), JSON.stringify(report, null, 1));
  if (AUDIT) {
    const all = audit.flatMap((a) => a.aa.map((r) => ({ ...r, name: a.name })));
    const fails = all.filter((r) => r.ratio < r.need);
    console.log("AA nodes", all.length, "fails", fails.length, "min", Math.min(...all.map((r) => r.ratio)).toFixed(2));
    const seen = new Set();
    for (const f of fails) { const k = f.t + f.ratio; if (seen.has(k)) continue; seen.add(k); console.log("FAIL", f.name, JSON.stringify(f.t), f.ratio, "<", f.need, f.fg, "on", f.bg); }
    const small = new Set(audit.flatMap((a) => a.tg.s.map((x) => a.name.replace(/-d+-(light|dark)$/, "") + ": " + x)));
    console.log("under-44 targets", small.size); [...small].slice(0, 25).forEach((x) => console.log("  ", x));
    const anim = new Set(audit.flatMap((a) => a.tg.a));
    console.log("running animations", anim.size); [...anim].slice(0, 15).forEach((x) => console.log("  ", x));
    const fits = audit.filter((a) => a.fit).map((a) => a.name + " " + a.fit.h + "/" + a.fit.max);
    console.log("card fit (scrollHeight/clientHeight)", fits.filter((x) => { const [h, m] = x.split(" ")[1].split("/"); return +h > +m + 1; }).length, "overflowing of", fits.length);
    fs.writeFileSync(path.join(OUT, `audit-${mode}${process.env.REDUCED ? "-reduced" : ""}.json`), JSON.stringify(audit, null, 1));
  }
  console.log("shots", report.shots.length, "paid", report.paid.length);
})();
