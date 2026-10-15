// The frozen /demo copy of the steepness widget: widget-v2.json (as generated) with two cosmetic fixes, recorded
// here so the edit is reproducible: the dashed tangent is clipped to the plot area (it ran over the axis label),
// and each unit sits beside its value instead of at the far end of the label row. Writes widget-demo.json.
// Usage: node curate.cjs
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..");
const w = JSON.parse(fs.readFileSync(path.join(DIR, "widget-v2.json"), "utf8"));
const swap = (s, from, to) => { if (!s.includes(from)) throw new Error(`not found: ${from.slice(0, 60)}`); return s.replace(from, to); };

w.js = swap(w.js, `  if (showTangent) {
    var speed = speedAt(tpos, steep);`, `  if (showTangent) {
    ctx.save();
    ctx.beginPath(); ctx.rect(X(0), Y(dmax), X(tmax) - X(0), Y(0) - Y(dmax)); ctx.clip();
    var speed = speedAt(tpos, steep);`);
w.js = swap(w.js, `    ctx.stroke();
    ctx.setLineDash([]);
  }

  // marker dot`, `    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // marker dot`);
w.markup = swap(w.markup, `Steepness of segment 2 <span class="value" id="steepv">0</span> m/s</label>`, `Steepness of segment 2 <span><span class="value" id="steepv">0</span> m/s</span></label>`);
w.markup = swap(w.markup, `Time position <span class="value" id="tposv">0</span> s</label>`, `Time position <span><span class="value" id="tposv">0</span> s</span></label>`);

fs.writeFileSync(path.join(DIR, "widget-demo.json"), JSON.stringify(w, null, 2));
console.log("ok");
