// The nav (build step 3): the pill at 1280 / 1024 / 768 / 360 in both themes, the sheet open below lg, the section
// highlight after a jump, every target's size and any horizontal overflow. Usage: node nav.cjs <outdir> [base]
const fs = require("fs");
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , out = "build/nav", base = "http://localhost:3000"] = process.argv;
const OUT = path.join(__dirname, "..", out);
fs.mkdirSync(OUT, { recursive: true });

const FACTS = () => {
  const small = [];
  for (const el of document.querySelectorAll("header a, header button")) {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).visibility === "hidden") continue;
    if (r.width < 44 || r.height < 44) small.push(`${el.textContent.trim() || el.getAttribute("aria-label")} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  const nav = document.querySelector("nav[aria-label=Main]").getBoundingClientRect();
  return { overflow: document.documentElement.scrollWidth - innerWidth, navH: Math.round(nav.height), navL: Math.round(nav.left), navR: Math.round(innerWidth - nav.right), small };
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [], runs: [] };
  for (const theme of ["light", "dark"]) for (const w of [1280, 1024, 768, 360]) {
    const ctx = await themedContext(b, theme, { width: w, height: 800 });
    const p = await ctx.newPage();
    await guardApi(p, report);
    await p.goto(base + "/", { waitUntil: "load" });
    await sleep(600);
    await p.screenshot({ path: path.join(OUT, `${theme}-${w}.png`), clip: { x: 0, y: 0, width: w, height: 200 } });
    const facts = await p.evaluate(FACTS);
    let sheet = null;
    if (w < 1024) {
      await p.click("button[aria-controls]");
      await sleep(400);
      await p.screenshot({ path: path.join(OUT, `${theme}-${w}-sheet.png`), clip: { x: 0, y: 0, width: w, height: 420 } });
      sheet = await p.evaluate(FACTS);
      await p.keyboard.press("Escape");
      sheet.closedByEscape = await p.evaluate(() => document.querySelector("button[aria-controls]").getAttribute("aria-expanded") === "false" && document.activeElement === document.querySelector("button[aria-controls]"));
    }
    // The highlight: jump to For parents and read aria-current.
    await p.evaluate(() => document.getElementById("parents")?.scrollIntoView());
    await sleep(300);
    const currentAfterJump = await p.evaluate(() => [...document.querySelectorAll("header a[aria-current=true]")].map((a) => a.textContent.trim()));
    if (w >= 1024) await p.screenshot({ path: path.join(OUT, `${theme}-${w}-at-parents.png`), clip: { x: 0, y: 0, width: w, height: 110 } });
    report.runs.push({ theme, w, ...facts, sheet, currentAfterJump });
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.runs.map((r) => ({ t: r.theme, w: r.w, of: r.overflow, h: r.navH, small: r.small.length, sheetSmall: r.sheet?.small.length, esc: r.sheet?.closedByEscape, cur: r.currentAfterJump.join("/") }))));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
