// V8.7 step 1: the three in-room leftovers (the teacher's "Thinking" chip, the "Your turn" bubble, a generated
// model's annotation labels) through the local /dev/learn-shell harness (every /api call mocked in the page).
// States are forced through window.__store (the harness exposes it); nothing is generated.
//   node inscene.cjs <label> [baseUrl]     SIZES=360,1280  THEMES=light,dark
const fs = require("fs");
const path = require("path");
const { sleep, LAUNCH, chromium, themedContext, guardApi, sceneReady, click } = require("./common.cjs");
const { AA } = require("./check.cjs");

const label = process.argv[2] || "after";
const base = process.argv[3] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", label);
fs.mkdirSync(OUT, { recursive: true });
const H = { 360: 780, 768: 1024, 1280: 800 };
const SIZES = (process.env.SIZES || "360,1280").split(",").map(Number);
const THEMES = (process.env.THEMES || "light,dark").split(",");

const ANNOTATIONS = [
  { label: "Crust", bias: "top" }, { label: "Mantle", bias: "front" }, { label: "Outer core", bias: "left" },
];
// [name, patch applied to the store, the text of the in-room element under test]
const STATES = [
  ["thinking", { isLoading: true }, /^Thinking/],
  ["your-turn", { awaitingAnswer: true }, /Your turn/],
  ["annotations", { activeModelUrl: "/models/dev_placeholder.glb", viewMode3d: true, withLesson: true }, /^(Crust|Mantle|Outer core)$/],
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], shots: {} };
  for (const theme of THEMES) for (const w of SIZES) {
    for (const [name, patch, only] of STATES) {
      const key = `${name}-${w}-${theme}`;
      const ctx = await themedContext(browser, theme, { width: w, height: H[w] });
      const page = await ctx.newPage();
      await guardApi(page, report);
      try {
        await page.goto(`${base}/dev/learn-shell`, { waitUntil: "domcontentloaded" });
        await sceneReady(page);
        await sleep(800);
        await click(page, /Explore [Ff]reely/); await sleep(800);
        await page.evaluate(async ([p, anns]) => {
          const { withLesson, ...rest } = p;
          // A whole lesson (the harness answers /api/learn/lesson with the pre-rendered volcano), plus the annotations.
          if (withLesson) { const l = await (await fetch("/api/learn/lesson/harness")).json(); l.metadata = { ...l.metadata, model_annotations: anns }; rest.activeLesson = l; }
          window.__store.setState(rest);
        }, [patch, ANNOTATIONS]);
        await sleep(1800);
        // The hovered annotation is its own state: hover the first label.
        let hover = null;
        if (name === "annotations") {
          const box = await page.evaluate(() => { const el = [...document.querySelectorAll("div")].find((d) => d.textContent === "Mantle" && d.className.includes("cursor-pointer")); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
          hover = box;
        }
        await page.screenshot({ path: path.join(OUT, `${key}.jpg`), type: "jpeg", quality: 78 });
        // The same filter before and after: the checker reads every text node, the test keeps the element under test.
        let aa = (await page.evaluate(AA, "")).filter((r) => only.test(r.t));
        if (hover) {
          await page.mouse.move(hover.x, hover.y); await sleep(500);
          await page.screenshot({ path: path.join(OUT, `${name}-hover-${w}-${theme}.jpg`), type: "jpeg", quality: 78 });
          aa = aa.concat((await page.evaluate(AA, "")).filter((r) => only.test(r.t)));
        }
        report.shots[key] = { n: aa.length, min: aa.length ? Math.min(...aa.map((r) => r.ratio)) : null, fails: aa.filter((r) => r.ratio < r.need).map((r) => `${r.t} | ${r.ratio} | ${r.fg} on ${r.bg}`), found: aa.map((r) => r.t) };
        console.log(`${key}: n=${aa.length} min=${report.shots[key].min} fails=${report.shots[key].fails.length} text=[${[...new Set(aa.map((r) => r.t))].join(", ")}]`);
      } catch (e) { report.shots[key] = { error: String(e.message || e) }; console.log(`${key}: ERROR ${e.message}`); }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report-inscene.json"), JSON.stringify(report, null, 1));
  console.log(`api at network: ${report.api.length}, paid: ${report.paid.length}`);
})();
