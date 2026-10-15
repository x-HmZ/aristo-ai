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

// The trip, matched to the lesson's worked example (Hmz, 2026-10-15): segment 3 is the straight 7 to 9 s at 10 m/s
// the narration walks through (20 m to 40 m past segment 2), and the curve the tangent needs comes after it,
// 9 to 12 s, the runner speeding up from 10 to 20 m/s (the challenge's "curve bending steeply upward"). Axes to 12 s
// and 120 m, which holds the steepest case (segment 2 at 10 m/s ends at 115 m).
w.js = swap(w.js, `// seg3: t in [7,10], curve: speed goes from 2 to 14 m/s linearly, so
//   v(t) = 2 + (14-2)*(t-7)/3 = 2 + 4*(t-7)
//   d(t) = d0 + integral_7^t v(s) ds = d0 + 2*(t-7) + 2*(t-7)^2
// at t=10: d0 + 2*3 + 2*9 = d0 + 6 + 18 = d0+24`, `// seg3: t in [7,9], straight at 10 m/s, as in the lesson's worked example
// seg4: t in [9,12], curve: speed goes from 10 to 20 m/s linearly, so
//   v(t) = 10 + (10/3)*(t-9)
//   d(t) = d3 + 10*(t-9) + (5/3)*(t-9)^2, with d3 = d1seg2 + 20`);
w.js = swap(w.js, `  } else {
    var base = d1seg2(steep);
    var dt = t - 7;
    return base + 2 * dt + 2 * dt * dt;
  }`, `  } else if (t <= 9) {
    return d1seg2(steep) + 10 * (t - 7);
  } else {
    var dt = t - 9;
    return d1seg2(steep) + 20 + 10 * dt + (5 / 3) * dt * dt;
  }`);
w.js = swap(w.js, `  } else {
    var dt = t - 7;
    return 2 + 4 * dt;
  }`, `  } else if (t <= 9) {
    return 10;
  } else {
    return 10 + (10 / 3) * (t - 9);
  }`);
w.js = swap(w.js, `  var tmax = 10, dmax = 100;`, `  var tmax = 12, dmax = 120;`);
w.js = swap(w.js, `  ctx.fillText('100', padL - 4, padT + 4);`, `  ctx.fillText('120', padL - 4, padT + 4);`);
w.js = swap(w.js, `  ctx.fillText('10', padL + gw, padT + gh + 16);`, `  ctx.fillText('12', padL + gw, padT + gh + 16);`);
w.markup = swap(w.markup, `<input id="tpos" type="range" min="0" max="10" step="0.1" value="0">`, `<input id="tpos" type="range" min="0" max="12" step="0.1" value="0">`);
w.markup = swap(w.markup, `aria-label="Distance-time graph of a trip with three parts, a dot marks the current time"`, `aria-label="Distance-time graph of a trip in four parts, a dot marks the current time"`);

// With 12 s and 120 m the readout is longer; at the kit's 20px it split "15 / m/s" over two lines on the board.
w.css = `${w.css}\n#readout{font-size:17px}`;

fs.writeFileSync(path.join(DIR, "widget-demo.json"), JSON.stringify(w, null, 2));
console.log("ok");
