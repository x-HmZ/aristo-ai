// Portfolio clips: record a browser session as a timestamped JPEG frame stream (Chrome screencast) with named
// markers, for encode.cjs to cut and encode. Free routes only, every /api call aborted at the network.
//   node record.cjs <session> [baseUrl]      session: demo | opening | switch | onboarding   THEME=light|dark
// Writes ../rec/<session>/frames/*.jpg, frames.json ([{f, t}]) and marks.json ({name: t}); t = seconds since epoch.
const fs = require("fs");
const path = require("path");
const { sleep, LAUNCH, chromium, themedContext, guardApi, sceneReady, click } = require("./common.cjs");

const session = process.argv[2];
const base = process.argv[3] || "http://localhost:3100";
// THEME overrides the session theme; a light session records to rec/<session>-light.
const THEME = process.env.THEME;
const OUT = path.join(__dirname, "..", "rec", THEME === "light" ? `${session}-light` : session);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "frames"), { recursive: true });

async function startRecorder(page, w, h) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const marks = {};
  cdp.on("Page.screencastFrame", (f) => {
    const name = `${String(frames.length).padStart(6, "0")}.jpg`;
    fs.writeFileSync(path.join(OUT, "frames", name), Buffer.from(f.data, "base64"));
    frames.push({ f: name, t: f.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 95, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  return {
    mark: (name) => { marks[name] = Date.now() / 1000; console.log(`  mark ${name}`); },
    stop: async () => {
      await cdp.send("Page.stopScreencast").catch(() => {});
      fs.writeFileSync(path.join(OUT, "frames.json"), JSON.stringify(frames));
      fs.writeFileSync(path.join(OUT, "marks.json"), JSON.stringify(marks, null, 1));
      const span = frames.length ? frames.at(-1).t - frames[0].t : 0;
      console.log(`  ${frames.length} frames over ${span.toFixed(1)} s (${(frames.length / Math.max(span, 1)).toFixed(1)} fps)`);
    },
  };
}

// Move the mouse in small steps (a drag that turns the model, or a pointer drifting to a button).
async function glide(page, from, to, ms, down = false) {
  const steps = Math.max(2, Math.round(ms / 16));
  await page.mouse.move(from[0], from[1]);
  if (down) await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps);
    await sleep(ms / steps);
  }
  if (down) await page.mouse.up();
}

const SESSIONS = {
  // The brain lesson end to end: teaching, the 3D model, the desk quiz. 1920x1080, dark.
  demo: { w: 1920, h: 1080, theme: "dark", run: async (page, rec) => {
    await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
    await sceneReady(page); await sleep(1500);
    rec.mark("picker");
    await page.getByText("How Your Brain Is Organised").first().click();
    rec.mark("lesson");
    await sleep(9000);
    await click(page, /^Next$/); rec.mark("explain"); await sleep(16000);
    await click(page, /^Next$/); rec.mark("demonstrate"); await sleep(16000);
    await click(page, /^Next$/); rec.mark("next-3"); await sleep(10000);
    if (await click(page, /^(View in 3D|Show 3D)$/)) {
      rec.mark("model"); await sleep(4500);
      const box = await page.evaluate(() => { const c = document.querySelector("canvas").getBoundingClientRect(); return [c.left + c.width * 0.5, c.top + c.height * 0.42]; });
      await glide(page, box, [box[0] + 260, box[1] + 10], 3200, true); rec.mark("model-turned"); await sleep(3500);
    } else console.log("  no View in 3D button");
    if (await click(page, /Take (the )?quiz/i)) {
      rec.mark("quiz"); await sleep(4500);
      await click(page, /^Cerebellum$/); rec.mark("q1"); await sleep(1600);
      await click(page, /^(Next|Next question|Check|Submit)/i); await sleep(1800);
      await click(page, /^False$/); rec.mark("q2"); await sleep(1600);
      await click(page, /^(Next|Finish|See results|Check|Submit)/i); await sleep(3500);
      rec.mark("results"); await sleep(2500);
    } else console.log("  no Take the quiz button");
  } },
  // The landing's opening on a first visit (it plays once per tab). 1920x1080, dark.
  opening: { w: 1920, h: 1080, theme: "dark", run: async (page, rec) => {
    rec.mark("go");
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    await sleep(12000); rec.mark("end");
  } },
  // The landing's teacher chooser: Jake to MJ. 1440x900, dark.
  switch: { w: 1440, h: 900, theme: "dark", run: async (page, rec) => {
    await page.goto(`${base}/?nointro`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 90000 }); await sleep(8000);
    // Off camera first: switch to MJ and back so both teachers are loaded and kept mounted; the recorded switch
    // is then the real one a returning visitor sees, not a cold download.
    const mj = page.getByRole("button", { name: /MJ/ }).first();
    const jake = page.getByRole("button", { name: /Jake/ }).first();
    await mj.click(); await sleep(14000);
    await jake.click(); await sleep(9000);
    rec.mark("ready"); await sleep(1500);
    const b = await mj.boundingBox();
    if (b) await glide(page, [b.x + b.width / 2 + 160, b.y + 120], [b.x + b.width / 2, b.y + b.height / 2], 700);
    await sleep(600);
    rec.mark("click"); await mj.click(); await sleep(7000);
    rec.mark("end");
  } },
  // Onboarding in the local learn harness (dev server): three choices, Continue, Continue. 1440x900, dark.
  onboarding: { w: 1440, h: 900, theme: "dark", run: async (page, rec) => {
    await page.goto(`${base}/dev/learn-shell?onboarded=0`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => /What.s your goal/.test(document.body.innerText), null, { timeout: 90000 }); await sleep(1500);
    rec.mark("start"); await sleep(1200);
    const tap = async (re) => { const el = page.getByRole("button", { name: re }).first(); const b = await el.boundingBox(); if (b) await glide(page, [b.x + b.width / 2 - 120, b.y + b.height / 2 + 60], [b.x + b.width / 2, b.y + b.height / 2], 500); await el.click(); await sleep(900); };
    await tap(/^Fill in gaps/); await tap(/^Continue/); await sleep(400);
    await tap(/^20/); await tap(/^Continue/); await sleep(400);
    await tap(/Middle School Science/); await sleep(1500);
    rec.mark("end");
  } },
};

(async () => {
  const s = SESSIONS[session];
  if (!s) throw new Error("unknown session " + session);
  const browser = await chromium.launch(LAUNCH);
  const ctx = await themedContext(browser, THEME || s.theme, { width: s.w, height: s.h });
  const page = await ctx.newPage();
  const report = { api: [], paid: [] };
  await guardApi(page, report);
  const rec = await startRecorder(page, s.w, s.h);
  try { await s.run(page, rec); } catch (e) { console.log("  ERROR", e.message); }
  await rec.stop();
  await browser.close();
  console.log(`  api at network: ${report.api.length}, paid: ${report.paid.length}`);
})();
