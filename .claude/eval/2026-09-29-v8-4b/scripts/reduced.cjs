// Under prefers-reduced-motion, every transition and animation duration inside the .theme-paper card must be 0.
// The card is checked through /dev/desk-quiz; the harness is checked for the live region and the reset flow.
const { chromium, sleep, LAUNCH, sceneReady, click, FAKE_SR, mockQuiz } = require("./common.cjs");
const base = process.argv[2] || "http://localhost:3000";
(async () => {
  const browser = await chromium.launch(LAUNCH);
  for (const motion of ["reduce", "no-preference"]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: motion });
    await ctx.addInitScript(FAKE_SR);
    const page = await ctx.newPage();
    await page.goto(`${base}/dev/desk-quiz`, { waitUntil: "domcontentloaded" });
    await sceneReady(page);
    await sleep(2500);
    const r = await page.evaluate(() => {
      const card = document.querySelector(".aristo-paper");
      const durs = new Set();
      let animName = getComputedStyle(card).animationName;
      for (const el of card.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        cs.transitionDuration.split(",").forEach((d) => durs.add(d.trim()));
      }
      return { animName, durs: [...durs], slow: getComputedStyle(card).getPropertyValue("--dur-slow").trim() };
    });
    console.log(motion, JSON.stringify(r));
    await ctx.close();
  }
  // Live region: mounted before the banner, and the banner appears inside it.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await mockQuiz(page, 300);
  await page.goto(`${base}/dev/quiz-bars?only=quiz`, { waitUntil: "networkidle" });
  const before = await page.evaluate(() => ({ region: !!document.querySelector('[data-h=quiz] [role=status]'), text: document.querySelector('[data-h=quiz] [role=status]')?.textContent.trim() }));
  await click(page, /^Mantle$/);
  await sleep(900);
  const after = await page.evaluate(() => ({ region: !!document.querySelector('[data-h=quiz] [role=status]'), text: document.querySelector('[data-h=quiz] [role=status]')?.textContent.trim().slice(0, 40) }));
  console.log("live region before", JSON.stringify(before), "after", JSON.stringify(after));
  await browser.close();
})();
