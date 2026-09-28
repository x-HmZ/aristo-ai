// Room verification harness (V8.5): screenshots of every camera framing, the
// SceneProbe anchor checks, and an fps / draw-call reading, all from headless
// Chrome over the DevTools protocol against a running `yarn dev`.
//
//   node scripts/room/verify-room.mjs <shots|probe|fps> <outdir> <prefix>
//
// shots  /dev/free-model (empty, image, model stages; orbit to both azimuth
//        limits and both polar limits) and /dev/desk-quiz (lesson and desk
//        framings), saved as <outdir>/<prefix>_<framing>.png
// probe  /dev/desk-quiz SceneProbe: probe-down at the desk / floor / anchor
//        points below, then forward clicks at the display from the lesson view
// fps    3 x 8 s on /dev/free-model (empty stage); set UNCAP=1 to lift vsync
// Set ROOM=alt for the alternative classroom.
//
// Only the dev server is touched; nothing is written outside <outdir>.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [mode, outdir = ".", prefix = "room"] = process.argv.slice(2);
if (!["shots", "probe", "fps"].includes(mode)) {
  console.error("usage: node scripts/room/verify-room.mjs <shots|probe|fps> <outdir> <prefix>");
  process.exit(1);
}
mkdirSync(outdir, { recursive: true });

// CHROME overrides the browser path (the default is Chrome on Windows).
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// ROOM=alt runs everything against the alternative classroom (?room=alt).
const QS = process.env.ROOM === "alt" ? "?room=alt" : "";
const PORT = 9333;
const CDP_TIMEOUT_MS = 60000;
const W = 1280;
const H = 720;

// World-space (x, z) points for probe-down. Expected hits in the comments.
const PROBE_DOWN = [
  [0, -0.5],     // student desk centre: y -0.888 (PAPER_ANCHOR sits 1 cm above)
  [-0.4, -0.3],  // student desk corner: y -0.888
  [0.4, -0.75],  // student desk corner: y -0.888
  [0.3, -2.35],  // second-row desk (PLACEMENT.default.desk): y -0.888; floor in the evening room
  [-1, -3],      // teacher's feet: hits the teacher mesh
  [0.37, -3],    // below SCENE_* / MODEL_*: floor y -1.694
  [0, -1.5],     // between rows: chair, then floor y -1.694
  [-3.2, -5.2],  // where the lockers stood: floor only after V8.5
  [0.45, -5.4],  // in front of the display: floor y -1.694
];
// Screen points (1280x720, lesson framing) that land on the display.
const DISPLAY_CLICKS = [[640, 250], [760, 200], [900, 300]];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "room-"));
const flags = [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, "--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--hide-scrollbars",
  ...(process.env.UNCAP ? ["--disable-gpu-vsync", "--disable-frame-rate-limit"] : []),
  "about:blank",
];
const chrome = spawn(CHROME, flags, { stdio: "ignore" });

let ws = null;
let seq = 0;
const pending = new Map();   // id -> { resolve, reject, timer }
const logs = [];

function failPending(err) {
  for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(err); }
  pending.clear();
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  const timer = setTimeout(() => {
    pending.delete(id);
    reject(new Error(`CDP ${method} timed out after ${CDP_TIMEOUT_MS} ms`));
  }, CDP_TIMEOUT_MS);
  pending.set(id, { resolve, reject, timer });
  ws.send(JSON.stringify({ id, method, params }));
});
const evalJs = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

async function connect() {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(200); }
  }
  const page = targets?.find((t) => t.type === "page");
  if (!page) throw new Error(`no DevTools page on port ${PORT} (is CHROME=${CHROME} right?)`);
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("DevTools socket did not open")), CDP_TIMEOUT_MS);
    ws.onopen = () => { clearTimeout(timer); resolve(); };
    ws.onerror = () => { clearTimeout(timer); reject(new Error("DevTools socket failed")); };
  });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { resolve, timer } = pending.get(d.id);
      clearTimeout(timer);
      pending.delete(d.id);
      resolve(d);
    }
    if (d.method === "Runtime.consoleAPICalled") logs.push(d.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  ws.onclose = () => failPending(new Error("DevTools socket closed"));
  ws.onerror = () => failPending(new Error("DevTools socket error"));
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
}

async function go(path, settleMs) {
  await send("Page.navigate", { url: BASE + path });
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    ready = await evalJs("!!document.querySelector('canvas')");
    if (!ready) await sleep(500);
  }
  if (!ready) throw new Error(`no canvas on ${BASE + path} after 60 s (is yarn dev running?)`);
  await sleep(settleMs);
}
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(outdir, `${prefix}_${name}.png`), Buffer.from(r.result.data, "base64"));
  console.log("saved", name);
}
const click = (testid) => evalJs(`document.querySelector('[data-testid="${testid}"]')?.click()`);
async function mouse(type, x, y, extra = {}) {
  await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra });
}
// OrbitControls drag; the camera's azimuth / polar limits clamp the result.
async function drag(dx, dy) {
  const x = 640;
  const y = 380;
  await mouse("mousePressed", x, y);
  for (let s = 1; s <= 20; s++) {
    await mouse("mouseMoved", x + (dx * s) / 20, y + (dy * s) / 20, { buttons: 1 });
    await sleep(16);
  }
  await mouse("mouseReleased", x + dx, y + dy);
  await sleep(2500);
}

async function run() {
  await connect();

  if (mode === "shots") {
    await go(`/dev/free-model${QS}`, 25000);
    await click("stage-empty"); await sleep(3000); await shot("lesson_empty");
    await click("stage-image"); await sleep(5000); await shot("lesson_image");
    await click("stage-model"); await sleep(6000); await shot("lesson_model");
    await click("stage-empty"); await sleep(2000);
    await drag(400, 0); await shot("turn_right_max");
    await drag(-800, 0); await shot("turn_left_max");
    await drag(400, 0);
    await drag(0, 400); await shot("look_down_max");
    await drag(0, -800); await shot("look_up_max");
    // /dev/desk-quiz opens with the quiz shown (desk framing); the toggle
    // returns to the lesson framing.
    await go(`/dev/desk-quiz${QS}`, 20000);
    await shot("deskquiz_desk");
    await click("toggle-quiz"); await sleep(4000); await shot("deskquiz_lesson");
  }

  if (mode === "probe") {
    await go(`/dev/desk-quiz${QS}`, 25000);
    for (const [x, z] of PROBE_DOWN) {
      await evalJs(`window.dispatchEvent(new CustomEvent("aristo:probe-down",{detail:{x:${x},z:${z}}}))`);
    }
    await click("toggle-quiz"); await sleep(4000);
    for (const [x, y] of DISPLAY_CLICKS) {
      await mouse("mousePressed", x, y);
      await mouse("mouseReleased", x, y);
      await sleep(300);
    }
    await sleep(1000);
    logs.filter((l) => l.includes("probe")).forEach((l) => console.log(l));
  }

  if (mode === "fps") {
    await go(`/dev/free-model${QS}`, 25000);
    await click("stage-empty"); await sleep(4000);
    console.log("gpu", await evalJs(`(() => { const g = document.createElement('canvas').getContext('webgl2');
      return g.getParameter(g.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL); })()`));
    const measure = `(async () => {
      const P = WebGL2RenderingContext.prototype; let calls = 0;
      const orig = { de: P.drawElements, da: P.drawArrays, dei: P.drawElementsInstanced };
      P.drawElements = function (...a) { calls++; return orig.de.apply(this, a); };
      P.drawArrays = function (...a) { calls++; return orig.da.apply(this, a); };
      P.drawElementsInstanced = function (...a) { calls++; return orig.dei.apply(this, a); };
      let frames = 0, last = 0; const per = []; const t0 = performance.now();
      await new Promise((res) => { (function f() { frames++; per.push(calls - last); last = calls;
        if (performance.now() - t0 < 8000) requestAnimationFrame(f); else res(); })(); });
      Object.assign(P, { drawElements: orig.de, drawArrays: orig.da, drawElementsInstanced: orig.dei });
      per.sort((a, b) => a - b);
      return { fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1), drawCalls: per[per.length >> 1] };
    })()`;
    for (let i = 0; i < 3; i++) console.log("run", i, JSON.stringify(await evalJs(measure)));
  }
}

try {
  await run();
} catch (err) {
  console.error(String(err?.message ?? err));
  process.exitCode = 1;
} finally {
  failPending(new Error("shutting down"));
  ws?.close();
  chrome.kill();
  // Chrome holds the profile until it exits; retry briefly, then leave it.
  for (let i = 0; i < 10; i++) {
    try { rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(300); }
  }
}
