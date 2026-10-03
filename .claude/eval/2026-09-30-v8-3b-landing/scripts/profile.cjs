// CPU profiles of the landing's long frames (V8.3b, session 3), by the DevTools sampling profiler: the start-up until
// Jake is live at the hero (plus 1 s), and the scroll down to Step Into the Classroom until the room is live. Prints
// each window's heaviest functions by self time, with their file, and any `DBG` performance measures the page made.
// Usage: node profile.cjs [base] [width]
const path = require("path");
const { chromium, sleep, LAUNCH, themedContext, guardApi } = require("../../2026-09-30-desk-framing/scripts/common.cjs");
const [, , base = "http://localhost:3000", width = "1440"] = process.argv;

function top(profile, n = 14) {
  const self = new Map();
  const byId = new Map(profile.nodes.map((x) => [x.id, x]));
  const dts = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const node = byId.get(id);
    const f = node.callFrame;
    const key = `${f.functionName || "(anon)"} ${f.url.replace(/^.*\/_next\//, "").replace(/^webpack-internal:\/\/\//, "")}:${f.lineNumber}`;
    self.set(key, (self.get(key) || 0) + (dts[i] || 0) / 1000);
  });
  return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, ms]) => `${ms.toFixed(0).padStart(6)} ms  ${k}`).join("\n");
}

(async () => {
  const b = await chromium.launch(LAUNCH);
  const report = { api: [], paid: [] };
  const ctx = await themedContext(b, "light", { width: Number(width), height: 800 });
  const p = await ctx.newPage();
  await guardApi(p, report);
  // Each slow getProgramInfoLog (a program still compiling when first used), named by its shaders' SHADER_NAME.
  await p.addInitScript(() => {
    window.__slowPrograms = [];
    for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
      const orig = C.prototype.getProgramInfoLog;
      C.prototype.getProgramInfoLog = function (prog) {
        const t0 = performance.now();
        const r = orig.call(this, prog);
        const dt = performance.now() - t0;
        if (dt > 15) {
          const names = (this.getAttachedShaders(prog) || []).map((sh) => (this.getShaderSource(sh) || "").match(/#define SHADER_NAME (\S+)/)?.[1] ?? "?");
          const src = (this.getAttachedShaders(prog) || []).map((sh) => this.getShaderSource(sh) || "").join("");
          const flags = ["USE_SKINNING", "USE_MORPHTARGETS", "USE_SHADOWMAP", "TONE_MAPPING", "USE_ENVMAP", "USE_MAP"].filter((f) => src.includes("#define " + f));
          window.__slowPrograms.push({ t: Math.round(t0), dt: Math.round(dt), names: [...new Set(names)].join("/"), flags: flags.join(","), live: document.querySelector("[data-spot][data-live]")?.getAttribute("data-spot") ?? null });
        }
        return r;
      };
    }
  });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
  await p.goto(base + "/?probe", { waitUntil: "load" });
  await p.waitForFunction(() => document.querySelector("[data-spot=hero][data-live]"), null, { timeout: 120000 });
  await sleep(1000);
  const a = await cdp.send("Profiler.stop");
  console.log("== start-up\n" + top(a.profile));
  await sleep(3000);
  await cdp.send("Profiler.start");
  await p.evaluate(() => new Promise((resolve) => {
    const id = setInterval(() => { scrollBy(0, 100); const r = document.querySelector("[data-spot=room]").getBoundingClientRect(); if (r.top < 100) { clearInterval(id); resolve(); } }, 16);
  }));
  await p.waitForFunction(() => document.querySelector("[data-spot=room][data-live]"), null, { timeout: 60000 }).catch(() => {});
  await sleep(500);
  const c = await cdp.send("Profiler.stop");
  console.log("== to the room\n" + top(c.profile));
  console.log("== measures\n" + (await p.evaluate(() => performance.getEntriesByType("measure").filter((m) => m.name.startsWith("DBG")).map((m) => `${Math.round(m.startTime)} +${Math.round(m.duration)} ${m.name}`).join("\n"))));
  console.log("== slow programs\n" + (await p.evaluate(() => window.__slowPrograms.map((x) => `${x.t} +${x.dt} ${x.names} [${x.flags}] live=${x.live}`).join("\n"))));
  console.log(JSON.stringify({ api: report.api.length, paid: report.paid.length }));
  await b.close();
})();
