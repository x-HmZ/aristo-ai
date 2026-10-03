// "Hear it": off by default (nothing audio is fetched), then on: the move's own recording and its timings play, the
// spoken words light up, the next move swaps the line, and nothing calls an API. Usage: node sound.cjs [base]
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3000"] = process.argv;
const yFor = (S) => { const ids = ["top", "idea", "how", "moves", "map", "parents", "start"]; const i = Math.floor(S); const el = document.getElementById(ids[i]); return Math.round(el.getBoundingClientRect().top + scrollY + (S - i) * (el.offsetHeight - innerHeight)); };
(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, "light", { width: 1280, height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  const audio = [];
  p.on("request", (r) => { if (/\.(mp3|align\.json)$/.test(r.url())) audio.push(r.url().replace(base, "")); });
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.dataset.stage === "live", null, { timeout: 90000 });
  const go = async (S) => { const y = await p.evaluate(yFor, S); const from = await p.evaluate(() => scrollY); for (let i = 1; i <= 20; i++) { await p.evaluate((v) => scrollTo(0, v), Math.round(from + ((y - from) * i) / 20)); await sleep(30); } await sleep(1200); };
  await go(3.1);
  const before = audio.length;
  const clicked = await p.evaluate(() => { const btn = [...document.querySelectorAll("button")].find((x) => /hear it/i.test(x.textContent) && x.getBoundingClientRect().height > 0 && getComputedStyle(x.closest(".landing-beat")).visibility !== "hidden" && +getComputedStyle(x.closest(".landing-beat")).opacity > 0.5); if (!btn) return false; btn.click(); return true; });
  await sleep(2500);
  const s1 = await p.evaluate(() => ({ pressed: [...document.querySelectorAll("button[aria-pressed=true]")].length, spoken: document.querySelectorAll("[data-spoken='1']").length, label: [...document.querySelectorAll("button[aria-pressed=true]")].map((b) => b.textContent.trim())[0] }));
  await go(3.3);
  await sleep(1500);
  const s2 = await p.evaluate(() => ({ spoken: document.querySelectorAll("[data-spoken='1']").length }));
  await go(4.6);
  await sleep(800);
  const s3 = await p.evaluate(() => ({ spoken: document.querySelectorAll("[data-spoken='1']").length, pressed: [...document.querySelectorAll("button[aria-pressed=true]")].map((b) => b.textContent.trim())[0] }));
  console.log(JSON.stringify({ audioBeforeClick: before, clicked, afterClick: s1, afterNextMove: s2, inMap: s3, audio, api: report.api.length, paid: report.paid.length }, null, 1));
  await b.close();
})();
