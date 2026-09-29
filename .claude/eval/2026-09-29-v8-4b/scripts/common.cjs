// Shared helpers for the V8.4b scripts. Free routes only; every /api/quiz call is mocked in the browser.
const path = require("path");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAID = /\/api\/(learn\/(challenge|explain-more|lesson|complete)|generate|tts|quiz\/generate|courses\/generate|chat|teach)/;
const LAUNCH = { headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] };

async function sceneReady(page) {
  await page.waitForFunction(() => !document.querySelector('[class*="z-[100]"]') && !!document.querySelector("canvas"), null, { timeout: 90000 });
  await sleep(800);
}
async function applyTheme(page, theme) {
  if (theme !== "dark") return;
  await page.evaluate(() => { document.querySelector('meta[name="aristo-theme-lock"]')?.remove(); document.documentElement.setAttribute("data-theme", "dark"); });
  await sleep(150);
}
const click = (page, re) => page.evaluate(([s, f]) => {
  const r = new RegExp(s, f);
  const b = [...document.querySelectorAll("button")].find((x) => r.test(x.innerText.trim()) || r.test(x.getAttribute("aria-label") || "") || r.test(x.getAttribute("title") || ""));
  if (b && !b.disabled) { b.click(); return true; }
  return false;
}, [re.source, re.flags]);

// A SpeechRecognition that never touches the microphone: start() succeeds and stays "listening".
const FAKE_SR = () => {
  class R { start() {} stop() { this.onend && this.onend(); } abort() {} }
  window.SpeechRecognition = R;
  window.webkitSpeechRecognition = R;
};

// Mock the quiz API in the browser (delayed, so the selected-but-unmarked state can be seen).
async function mockQuiz(page, delay = 1400) {
  await page.route("**/api/quiz/**", async (route) => {
    const url = route.request().url();
    if (/quiz\/submit/.test(url)) {
      const b = JSON.parse(route.request().postData() || "{}");
      const ok = String(b.userAnswer).trim().toLowerCase() === String(b.correctAnswer).trim().toLowerCase();
      await sleep(delay);
      return route.fulfill({ json: { is_correct: ok, score: ok ? 1 : 0, feedback: ok ? "Right. This is the explanation that follows a correct answer." : "The correct answer is " + b.correctAnswer + ". This is the explanation that follows a wrong answer.", misconception_detected: null } });
    }
    return route.fulfill({ json: { ok: true } });
  });
}
module.exports = { chromium, sleep, PAID, LAUNCH, sceneReady, applyTheme, click, FAKE_SR, mockQuiz };
