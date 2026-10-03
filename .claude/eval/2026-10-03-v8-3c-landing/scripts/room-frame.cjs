// Step Into the Classroom: is Jake in frame through the tour? From a track.cjs run of the room (NOSHOT=1 is enough):
// per sample, how far his head (the head bone, plus 0.17 m up for the top of his hair) and his hands and fingertips are
// inside the room's box, in px (negative: out). The desk glance (the camera looks down at the desk, away from him by
// design) is left out. Usage: node room-frame.cjs <trackdir> [deskFrom] [deskTo]
const path = require("path");
const [, , dir, d0 = "24.7", d1 = "31.4"] = process.argv;
const r = require(path.resolve(dir, "track.json"));
const PARTS = ["CC_Base_Head", "CC_Base_L_Hand", "CC_Base_R_Hand", "CC_Base_L_Index3", "CC_Base_R_Index3", "CC_Base_L_Mid3", "CC_Base_R_Mid3"];
let worst = null;
const perPart = {};
for (const s of r.samples) {
  if (s.t >= Number(d0) && s.t <= Number(d1)) continue;
  for (const k of PARTS) {
    const p = s.page[k];
    if (!p) continue;
    // The top of his head is about 0.17 m above the head bone: take it as 0.1 of the box height above on screen at most.
    const y = k === "CC_Base_Head" ? p.y - (s.page.CC_Base_Head.y - s.page.CC_Base_L_Upperarm.y) * 0.9 : p.y;
    const m = Math.min(p.x - s.box.x, s.box.x + s.box.w - p.x, y - s.box.y);
    if (!(k in perPart) || m < perPart[k].m) perPart[k] = { m: Math.round(m), t: +s.t.toFixed(2) };
    if (!worst || m < worst.m) worst = { m: Math.round(m), part: k, t: +s.t.toFixed(2) };
  }
}
console.log(JSON.stringify({ samples: r.samples.length, worst, perPart }));
