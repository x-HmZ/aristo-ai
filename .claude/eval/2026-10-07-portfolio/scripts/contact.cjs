// A contact sheet for a recorded session: one frame every <step> seconds, labelled with its time from the start
// and the markers it follows, so clip windows are chosen by eye.
//   node contact.cjs <session> [step=3] [from=0] [to=end]
const fs = require("fs");
const path = require("path");
const { chromium, LAUNCH } = require("./common.cjs");

const [session, stepArg = "3", fromArg = "0", toArg] = process.argv.slice(2);
const DIR = path.join(__dirname, "..", "rec", session);
const frames = JSON.parse(fs.readFileSync(path.join(DIR, "frames.json"), "utf8"));
const marks = JSON.parse(fs.readFileSync(path.join(DIR, "marks.json"), "utf8"));
const t0 = frames[0].t, step = Number(stepArg), from = Number(fromArg), to = toArg ? Number(toArg) : frames.at(-1).t - t0;
const markAt = Object.entries(marks).map(([n, t]) => [n, t - t0]);

const picks = [];
for (let s = from; s <= to; s += step) {
  let best = frames[0];
  for (const f of frames) if (f.t - t0 <= s) best = f; else break;
  const label = markAt.filter(([, m]) => m <= s && m > s - step).map(([n]) => n).join(", ");
  picks.push({ s, f: best.f, label });
}
(async () => {
  const cells = picks.map((p) => `<div><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(DIR, "frames", p.f)).toString("base64")}"><p>${p.s.toFixed(1)} s ${p.label ? "<b>" + p.label + "</b>" : ""}</p></div>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#222;color:#ddd;font:12px system-ui;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:1600px}img{width:100%;display:block}p{margin:2px 0}b{color:#f0a070}</style>${cells}`;
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: 1624, height: 900 } });
  await p.setContent(html, { waitUntil: "load" });
  const out = path.join(DIR, `contact-${from}-${Math.round(to)}.jpg`);
  await p.screenshot({ path: out, type: "jpeg", quality: 80, fullPage: true });
  await b.close();
  console.log(out, "marks:", markAt.map(([n, m]) => `${n}@${m.toFixed(1)}`).join(" "));
})();
