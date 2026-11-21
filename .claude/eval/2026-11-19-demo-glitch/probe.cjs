const path = require("path"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
(async () => {
  const b = await chromium.launch({ headless: true, args: ["--use-angle=d3d11"] });
  for (const [w, h] of [[360, 640], [390, 844], [844, 390]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true })).newPage();
    await p.route("**/api/**", (r) => r.abort());
    await p.goto(process.argv[2] + "/demo"); await p.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
    await p.getByText("How Volcanoes Erupt").first().click(); await p.waitForTimeout(3500);
    console.log(w, h, JSON.stringify(await p.evaluate(() => {
      const r = (e) => e && e.getBoundingClientRect(); const f = (x) => x && [Math.round(x.top), Math.round(x.bottom)];
      const next = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "Next");
      const pause = [...document.querySelectorAll("button")].find((x) => /Pause/.test(x.innerText));
      let slot = next; while (slot && !/flex-1 overflow-hidden/.test(slot.className)) slot = slot.parentElement;
      const sc = next.closest(".aristo-scroll"); return { next: f(r(next)), row: f(r(next.parentElement)), scroll: f(r(sc)), scrollH: sc.scrollHeight, pauseCard: f(r(pause?.parentElement)), slot: f(r(slot)), kids: [...slot.querySelectorAll(":scope > * > *")].map(e=>e.tagName+":"+f(r(e))) };
    })));
  }
  await b.close();
})();
