// Desk-quiz framing check. node desk.cjs <label> <baseUrl> <themes> <hosts>
//   hosts: probe (/dev/desk-quiz, stub quiz), probe-alt (same, Evening room), demo (/demo, local quiz),
//          shell (/dev/learn-shell, the real LearnClient with every /api call mocked in the page)
//   SIZES=360x640,... overrides the size list; REDUCED=1 emulates prefers-reduced-motion; MOTION=1 (probe hosts)
//   also toggles the quiz off and on and samples the camera 150 ms and 3 s after each toggle.
// Free routes only. Every report has to show 0 paid and 0 api at the network. Syntax-check with node --check.
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi, sceneReady, click, FAKE_SR, LAYOUT } = require("./common.cjs");
const { AA, TARGETS } = require("./check.cjs");
const [, , label = "before", base = "http://localhost:3000", themesArg = "light", hostsArg = "probe"] = process.argv;
const OUT = path.join(__dirname, "..", label + (process.env.REDUCED ? "-reduced" : ""));
fs.mkdirSync(OUT, { recursive: true });
const ALL = [[360, 640], [360, 780], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 720], [1440, 900], [1920, 1080]];
const SIZES = process.env.SIZES ? ALL.filter(([w, h]) => process.env.SIZES.split(",").includes(`${w}x${h}`)) : ALL;
const NEXT = /^(Next( question)?( →)?|See [Rr]esults)$/;
const report = { label, rows: {}, paid: [], api: [], notes: [] };
const audit = [];

// Page side: the card's projected box, its controls (only those whose centre is on the card), the top bar pills.
const DESK = () => {
  const card = document.querySelector(".aristo-paper");
  if (!card) return null;
  const R = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const hit = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  const C = R(card);
  const ctrls = [...card.querySelectorAll("button, input, textarea, select")].filter((e) => getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().width > 0).map((e) => ({ t: (e.innerText || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 20), ...R(e) }))
    .filter((c) => (c.x + c.r) / 2 >= C.x && (c.x + c.r) / 2 <= C.r && (c.y + c.b) / 2 >= C.y && (c.y + c.b) / 2 <= C.b);
  const bars = [...document.querySelectorAll(".theme-ink")].map(R).filter((b) => b.y < 100 && b.w > 0 && b.h < 80);
  const vis = Math.max(0, Math.min(C.r, innerWidth) - Math.max(C.x, 0)) * Math.max(0, Math.min(C.b, innerHeight) - Math.max(C.y, 0)) / (C.w * C.h);
  return {
    vw: innerWidth, vh: innerHeight, card: C, visible: +vis.toFixed(3), margins: { left: C.x, right: innerWidth - C.r, top: C.y, bottom: innerHeight - C.b },
    cssWidth: card.offsetWidth, cssMaxH: getComputedStyle(card).maxHeight, cssH: card.offsetHeight, scrolls: card.scrollHeight > card.clientHeight + 1,
    controls: ctrls.length, minH: ctrls.length ? Math.min(...ctrls.map((c) => c.h)) : null, minW: ctrls.length ? Math.min(...ctrls.map((c) => c.w)) : null,
    underBar: bars.some((b) => hit(C, b)), cam: window.__cam || null,
  };
};

async function toDesk(page, host) {
  if (host.startsWith("probe")) {
    await page.goto(`${base}/dev/desk-quiz${host === "probe-alt" ? "?room=alt" : ""}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 120000 });
    await page.addStyleTag({ content: "aside{display:none!important} div[style*='monospace']{display:none!important}" });
    await page.waitForSelector(".aristo-paper", { timeout: 120000 });
    await sleep(5000);
  } else if (host === "demo") {
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await sceneReady(page);
    await page.getByText("How Volcanoes Erupt").first().click();
    await page.waitForFunction(() => /activate/i.test(document.body.innerText), null, { timeout: 30000 });
    await sleep(2500);
    await click(page, /^(Next →|Next)$/); await sleep(1500);
    await click(page, /Next sentence/); await sleep(3500);
    if (!(await click(page, /Take (the )?quiz/i))) throw new Error("no take-quiz button");
    await sleep(4500);
  } else if (host === "shell") {
    await page.goto(`${base}/dev/learn-shell`, { waitUntil: "domcontentloaded" });
    await sceneReady(page); await sleep(1000);
    await click(page, /Explore [Ff]reely/); await sleep(1200); // dismiss the mode picker, as the V8.4c flow does
    await page.evaluate(() => {
      const s = window.__store.getState();
      s.setCourse({ courseId: "c-earth", title: "Earth Science: Inside the Planet", domain: "earth_science", topics: ["volcano-eruption", "heart"], currentTopicIndex: 0, sessionId: null, structure: { modules: [{ id: "m1", title: "Inside the Earth", description: "", lessons: [{ id: "l1", title: "Volcanoes", concept_ids: ["volcano-eruption", "heart"] }] }] } });
      s.setMode("course");
    });
    await sleep(4000);
    if (!(await click(page, /Take (the )?quiz/i))) throw new Error("no course take-quiz button");
    await sleep(4500);
  }
}

// Every question type the desk can show is not reachable for free; the choice (multiple choice, true or false) and the
// results are. Step through the local quiz on demo and shell.
async function walk(page, host, tag) {
  if (host !== "demo" && host !== "shell") return;
  await click(page, /^Lava$/); await sleep(900);
  await page.screenshot({ path: path.join(OUT, `${host}-answered-${tag}.jpg`), type: "jpeg", quality: 72 });
  report.rows[`${host}-answered-${tag}`] = await page.evaluate(DESK);
  audit.push({ name: `${host}-answered-${tag}`, aa: await page.evaluate(AA, ".aristo-paper"), tg: await page.evaluate(TARGETS, ".aristo-paper") });
  await click(page, NEXT); await sleep(900);
  await page.screenshot({ path: path.join(OUT, `${host}-tf-${tag}.jpg`), type: "jpeg", quality: 72 });
  report.rows[`${host}-tf-${tag}`] = await page.evaluate(DESK);
  audit.push({ name: `${host}-tf-${tag}`, aa: await page.evaluate(AA, ".aristo-paper"), tg: await page.evaluate(TARGETS, ".aristo-paper") });
}

async function motion(page, tag) {
  const sample = async (n) => ({ n, cam: await page.evaluate(() => window.__cam || null), card: (await page.evaluate(DESK))?.card || null });
  const tog = () => page.evaluate(() => document.querySelector('[data-testid="toggle-quiz"]').click());
  const m = { start: await sample("desk settled") };
  await tog(); await sleep(150); m.offAt150 = await sample("lesson +150ms");
  await sleep(3000); m.offSettled = await sample("lesson +3s");
  await tog(); await sleep(150); m.onAt150 = await sample("desk +150ms");
  await sleep(3000); m.onSettled = await sample("desk +3s");
  report.rows[`motion-${tag}`] = m;
}

(async () => {
  const browser = await chromium.launch(LAUNCH);
  for (const theme of themesArg.split(",")) for (const host of hostsArg.split(",")) for (const [w, h] of SIZES) {
    const tag = `${w}x${h}-${theme}`;
    const name = `${host}-${tag}`;
    const ctx = await themedContext(browser, theme, { width: w, height: h });
    await ctx.addInitScript(FAKE_SR);
    const page = await ctx.newPage();
    await guardApi(page, report);
    try {
      await toDesk(page, host);
      await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 72 });
      report.rows[name] = { ...(await page.evaluate(DESK)), layout: await page.evaluate(LAYOUT) };
      audit.push({ name, aa: await page.evaluate(AA, ".aristo-paper"), tg: await page.evaluate(TARGETS, ".aristo-paper") });
      await walk(page, host, tag);
      if (process.env.MOTION && host.startsWith("probe") && theme === "light") await motion(page, `${host}-${w}x${h}`);
    } catch (e) { console.error("FAILED", name, e.message.split("\n")[0]); report.notes.push(`${name}: FAILED ${e.message.split("\n")[0]}`); }
    await ctx.close();
    const r = report.rows[name];
    console.log(name.padEnd(28), r ? `card ${r.card.x}..${r.card.r} vis ${r.visible} css ${r.cssWidth}x${r.cssH} minH ${r.minH} minW ${r.minW} underBar ${r.underBar}` : "-");
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `report-${hostsArg}.json`), JSON.stringify(report, null, 1));
  const all = audit.flatMap((a) => a.aa.map((r) => ({ ...r, name: a.name })));
  const fails = all.filter((r) => r.ratio < r.need);
  console.log("AA nodes", all.length, "fails", fails.length, "min", all.length ? Math.min(...all.map((r) => r.ratio)).toFixed(2) : "-");
  const small = new Set(audit.flatMap((a) => a.tg.s.map((x) => a.name + ": " + x)));
  console.log("under-44 controls", small.size); [...small].slice(0, 60).forEach((x) => console.log("  ", x));
  const anim = new Set(audit.flatMap((a) => a.tg.a));
  console.log("running animations", anim.size); [...anim].slice(0, 10).forEach((x) => console.log("  ", x));
  fs.writeFileSync(path.join(OUT, `audit-${hostsArg}.json`), JSON.stringify(audit, null, 1));
  console.log("paid", report.paid.length, "api at network", report.api.length, "notes", report.notes.length);
  report.notes.forEach((n) => console.log("  note", n));
})();
