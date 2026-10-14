// Jake's forearms and cuffs at full size, in the engine that ships (three.js, the room's lights, his sage shirt).
// Usage: node forearms.cjs <label> [file=Teacher_Jake.glb] [base=http://localhost:3000]
// Needs `yarn dev` (the lab 404s in production) and a global playwright. Free route only: /dev/avatar-lab?shot.
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));

const [, , label = "before", file = "Teacher_Jake.glb", base = "http://localhost:3000"] = process.argv;
const OUT = path.join(__dirname, "..", "shots", label);
fs.mkdirSync(OUT, { recursive: true });

// Times picked once from the clips (the Pointing peak is found below): Idle at rest, Talking mid-gesture.
const POSES = [["Idle", 1.0], ["Talking", 2.2], ["Pointing", null]];
const ROT = 0.3; // the lab's teacher rotation, as the app's
const FWD = [Math.sin(ROT), 0, Math.cos(ROT)];
const LEFT = [Math.cos(ROT), 0, -Math.sin(ROT)]; // the teacher's left (+x local)
const add = (a, b, s = 1) => a.map((v, i) => v + b[i] * s);
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  const paid = [];
  page.on("request", (r) => { if (/\/api\//.test(r.url())) paid.push(r.url()); });
  await page.goto(`${base}/dev/avatar-lab?shot&who=jake&blink=0&file=${file}`, { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => window.__lab && window.__lab.clips().includes("Pointing"), null, { timeout: 180000 });
  if (process.env.MAT) console.log('shirt was', await page.evaluate((o) => window.__lab.shirt(o), JSON.parse(process.env.MAT)));
  const tick = async (n = 6) => { const f = await page.evaluate(() => window.__lab.frame); await page.waitForFunction((g) => window.__lab.frame >= g, f + n); };

  for (const [clip, t0] of POSES) {
    let t = t0;
    if (t === null) {
      // The Pointing peak: the frame the right hand is highest.
      let best = -1e9;
      for (let s = 0; s <= 4; s += 0.1) {
        await page.evaluate(([c, s]) => window.__lab.pose(c, s), [clip, s]);
        const y = (await page.evaluate(() => window.__lab.bones(["CC_Base_R_Hand"])))["CC_Base_R_Hand"][1];
        if (y > best) { best = y; t = s; }
      }
    }
    await page.evaluate(([c, s]) => window.__lab.pose(c, s), [clip, t]);
    await tick();
    for (const side of ["L", "R"]) {
      const b = await page.evaluate((s) => window.__lab.bones([`CC_Base_${s}_Forearm`, `CC_Base_${s}_Hand`]), side);
      const fa = b[`CC_Base_${side}_Forearm`], hd = b[`CC_Base_${side}_Hand`];
      const mid = add(fa, add(hd, fa, -1), 0.6); // between elbow and wrist, nearer the cuff
      const out = side === "L" ? LEFT : LEFT.map((v) => -v);
      const views = { front: FWD, side: out, three4: norm(add(FWD, out)) };
      for (const [v, dir] of Object.entries(views)) {
        const name = `${clip}-${side}-${v}`;
        if (ONLY && !ONLY.some((o) => name.includes(o))) continue;
        await page.evaluate(([p, a]) => window.__lab.cam(p, a), [add(mid, dir, Number(process.env.DIST || 0.95)), mid]);
        await tick(3);
        await page.screenshot({ path: path.join(OUT, `${name}.png`) });
      }
    }
    console.log(clip, "t =", t.toFixed(2));
  }
  // The whole teacher at the lesson's distance, front, for context.
  await page.evaluate(() => window.__lab.pose("Talking", 2.2));
  await page.evaluate(() => window.__lab.cam([Math.sin(0.3) * 2.6, -0.45, -3 + Math.cos(0.3) * 2.6], [0, -0.45, -3]));
  await tick();
  await page.screenshot({ path: path.join(OUT, "Talking-full.png") });
  console.log("api requests:", paid.length, paid);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
