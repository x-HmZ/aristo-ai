/**
 * Three hand-written widgets. They serve two jobs: the dev harness shows them
 * with no API call, and the generator's prompt quotes them as the standard to
 * match (what Hmz approves by eye is what the model is asked to write).
 *
 * Writing rules these follow, which the generator is also given: CSS variables
 * and `ARISTO.colors` for every colour, `accentText` for the key mark, controls
 * labelled exactly as the spec, labels tied to inputs, a live text readout, and
 * no word of code that validate.ts rejects.
 */

import type { InteractiveParts, InteractiveSpec } from "./spec";

export interface InteractiveFixture {
  id:    string;
  spec:  InteractiveSpec;
  parts: InteractiveParts;
}

// ─── 1. Slope and intercept (canvas) ───────────────────────────────────────────

const slopeLine: InteractiveFixture = {
  id: "slope-line",
  spec: {
    goal:  "See for yourself what slope and intercept do to a line.",
    brief:
      "The line y = mx + b on a grid from -7 to 7, starting at m = 1 and b = 0. A dashed rise-over-run step " +
      "starts at the intercept so the slope is visible as a step, not only a number.",
    controls: [
      { label: "Slope (m)",     kind: "slider", effect: "Tilts the line; the dashed step shows rise for a run of 1." },
      { label: "Intercept (b)", kind: "slider", effect: "Slides the line up or down; the dot marks where it crosses the y axis." },
    ],
    try_this: ["Make the slope negative.", "Set the slope to 0.", "Move the intercept to -3."],
  },
  parts: {
    title: "Slope and intercept",
    markup: `<div class="stack">
  <div class="readout" id="eq" aria-live="polite">y = 1x + 0</div>
  <div class="stage"><canvas id="plot" role="img" aria-label="Graph of the line y = mx + b"></canvas></div>
  <div class="controls">
    <div class="control"><label for="m">Slope (m) <span class="value" id="mv">1</span></label>
      <input id="m" type="range" min="-5" max="5" step="0.5" value="1"></div>
    <div class="control"><label for="b">Intercept (b) <span class="value" id="bv">0</span></label>
      <input id="b" type="range" min="-3" max="3" step="1" value="0"></div>
  </div>
</div>`,
    css: `#eq{text-align:center}`,
    js: `var C = ARISTO.colors;
var mIn = document.getElementById('m');
var bIn = document.getElementById('b');
function fmt(n) { return (Math.round(n * 10) / 10).toString(); }

var plot = ARISTO.canvas(document.getElementById('plot'), function (ctx, w, h) {
  var m = +mIn.value, b = +bIn.value;
  var u = w / 14, ox = w / 2, oy = h / 2;
  function X(x) { return ox + x * u; }
  function Y(y) { return oy - y * u; }
  var ymax = Math.floor(h / u / 2);
  ctx.lineWidth = 1; ctx.strokeStyle = C.line;
  for (var i = -7; i <= 7; i++) { ctx.beginPath(); ctx.moveTo(X(i), 0); ctx.lineTo(X(i), h); ctx.stroke(); }
  for (var j = -ymax; j <= ymax; j++) { ctx.beginPath(); ctx.moveTo(0, Y(j)); ctx.lineTo(w, Y(j)); ctx.stroke(); }
  ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

  ctx.strokeStyle = C.accentText; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X(-7), Y(-7 * m + b)); ctx.lineTo(X(7), Y(7 * m + b)); ctx.stroke();

  ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.strokeStyle = C.info;
  ctx.beginPath(); ctx.moveTo(X(0), Y(b)); ctx.lineTo(X(1), Y(b)); ctx.lineTo(X(1), Y(b + m)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.info; ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('run 1', X(0.15), Y(b) + (m >= 0 ? 16 : -8));
  ctx.fillText('rise ' + fmt(m), X(1) + 7, Y(b + m / 2) + 4);

  ctx.fillStyle = C.accentText; ctx.beginPath(); ctx.arc(X(0), Y(b), 6, 0, Math.PI * 2); ctx.fill();
}, 0.45);

function update() {
  var m = +mIn.value, b = +bIn.value;
  document.getElementById('mv').textContent = fmt(m);
  document.getElementById('bv').textContent = fmt(b);
  document.getElementById('eq').textContent = 'y = ' + fmt(m) + 'x ' + (b < 0 ? '- ' : '+ ') + Math.abs(b);
  plot.redraw();
}
mIn.addEventListener('input', update);
bIn.addEventListener('input', update);
update();`,
  },
};

// ─── 2. Equivalent fractions (plain DOM) ───────────────────────────────────────

const fractionBars: InteractiveFixture = {
  id: "fraction-bars",
  spec: {
    goal:  "See that cutting every piece into smaller pieces changes the name of a fraction, not its size.",
    brief:
      "Two bars of the same length. The top bar is split into the denominator and shades the numerator. " +
      "The bottom bar cuts every piece into equal smaller ones and shades the matching amount. " +
      "A readout shows both fractions side by side.",
    controls: [
      { label: "Numerator",        kind: "slider", effect: "Shades more or fewer pieces of the top bar." },
      { label: "Denominator",      kind: "slider", effect: "Changes how many equal pieces the top bar has." },
      { label: "Cut each piece into", kind: "choice", effect: "Splits every piece into 1, 2, 3 or 4 smaller ones in the bottom bar." },
    ],
    try_this: ["Set 1/2 and cut each piece into 4.", "Try 3/4 cut into 2."],
  },
  parts: {
    title: "Equivalent fractions",
    markup: `<div class="stack">
  <div class="readout" id="eq" aria-live="polite"></div>
  <div class="stage">
    <div class="bar" id="top" role="img" aria-label="Top bar"></div>
    <div class="bar" id="bot" role="img" aria-label="Bottom bar, every piece cut smaller"></div>
  </div>
  <div class="controls">
    <div class="control"><label for="num">Numerator <span class="value" id="numv"></span></label>
      <input id="num" type="range" min="0" max="12" step="1" value="3"></div>
    <div class="control"><label for="den">Denominator <span class="value" id="denv"></span></label>
      <input id="den" type="range" min="1" max="12" step="1" value="4"></div>
  </div>
  <div class="row" role="group" aria-labelledby="cutLabel">
    <span class="hint" id="cutLabel">Cut each piece into</span>
    <span class="row" id="cuts"></span>
  </div>
</div>`,
    css: `#eq{text-align:center}
.stage{display:flex;flex-direction:column;gap:8px;padding:6px}
.bar{position:relative;display:flex;height:36px;border-radius:8px;overflow:hidden;border:1px solid var(--muted)}
.cell{flex:1;border-right:1px solid var(--muted);background:var(--surface);transition:background .15s}
.cell:last-child{border-right:0}
.cell.on{background:var(--accent-text)}
.tag{position:absolute;left:6px;top:50%;transform:translateY(-50%);padding:0 8px;border-radius:999px;background:var(--surface);color:var(--ink);border:1px solid var(--muted);font-size:12px;font-weight:600;line-height:20px;pointer-events:none}`,
    js: `var numIn = document.getElementById('num');
var denIn = document.getElementById('den');
var cutBox = document.getElementById('cuts');
var cut = 2;

[1, 2, 3, 4].forEach(function (k) {
  var b = document.createElement('button');
  b.type = 'button'; b.textContent = String(k);
  b.addEventListener('click', function () { cut = k; update(); });
  cutBox.appendChild(b);
});

function fill(id, parts, shaded) {
  var el = document.getElementById(id);
  el.textContent = '';
  for (var i = 0; i < parts; i++) {
    var c = document.createElement('div');
    c.className = 'cell' + (i < shaded ? ' on' : '');
    el.appendChild(c);
  }
  var tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = shaded + '/' + parts;
  el.appendChild(tag);
}

function update() {
  var d = +denIn.value;
  numIn.max = String(d);
  if (+numIn.value > d) numIn.value = String(d);
  var n = +numIn.value;
  document.getElementById('numv').textContent = String(n);
  document.getElementById('denv').textContent = String(d);
  fill('top', d, n);
  fill('bot', d * cut, n * cut);
  document.getElementById('eq').textContent = n + '/' + d + ' = ' + (n * cut) + '/' + (d * cut);
  Array.prototype.forEach.call(cutBox.children, function (b, i) {
    b.setAttribute('aria-pressed', String(i + 1 === cut));
  });
}
numIn.addEventListener('input', update);
denIn.addEventListener('input', update);
update();`,
  },
};

// ─── 3. Stepping a Python loop (code stepper) ──────────────────────────────────

const forLoop: InteractiveFixture = {
  id: "for-loop",
  spec: {
    goal:  "Watch a for loop run one step at a time and see what each variable holds.",
    brief:
      "Four lines of Python that add the numbers 0 up to n-1. The current line is highlighted, boxes show " +
      "the values of i and total, and a line of text says in plain words what just happened.",
    controls: [
      { label: "Loop count (n)", kind: "slider",  effect: "Sets n in range(n) and restarts the run." },
      { label: "Step",           kind: "stepper", effect: "Runs the next line." },
      { label: "Back",           kind: "stepper", effect: "Goes back one line." },
    ],
    try_this: ["Step through once with n = 3.", "Set n to 6 and predict the output before the last step."],
  },
  parts: {
    title: "Stepping a for loop",
    markup: `<div class="stack">
  <pre class="code" id="code" aria-label="Python code"></pre>
  <div class="row vars">
    <div class="var"><span class="hint">i</span><b id="vi">-</b></div>
    <div class="var"><span class="hint">total</span><b id="vt">-</b></div>
    <div class="var out"><span class="hint">output</span><b id="vo">-</b></div>
  </div>
  <p class="readout log" id="log" aria-live="polite"></p>
  <div class="row">
    <button type="button" id="back">Back</button>
    <button type="button" class="primary" id="step">Step</button>
    <button type="button" id="reset">Start over</button>
  </div>
  <div class="controls"><div class="control">
    <label for="n">Loop count (n) <span class="value" id="nv"></span></label>
    <input id="n" type="range" min="1" max="6" step="1" value="3"></div></div>
</div>`,
    css: `.code{margin:0;padding:8px 10px;background:var(--bg);border:1px solid var(--line);border-radius:12px;font:14px/1.4 ui-monospace,Menlo,Consolas,monospace;color:var(--body);overflow-x:auto}
.code .ln{display:block;border-radius:6px;padding:0 6px}
.code .ln.on{background:var(--accent-text);color:var(--surface)}
.vars{gap:8px}
.var{display:flex;flex-direction:column;min-width:76px;padding:6px 12px;background:var(--sunk);border-radius:10px}
.var b{font-size:20px;font-variant-numeric:tabular-nums;color:var(--ink)}
.var.out{flex:1}
.log{font-size:15px;font-weight:500;min-height:2.6em;margin:0}`,
    js: `var nIn = document.getElementById('n');
var frames = [], k = 0;

function build() {
  var n = +nIn.value, t = 0;
  frames = [{ line: -1, i: '-', t: '-', o: '-', msg: 'Press Step to run the first line.' }];
  t = 0;
  frames.push({ line: 0, i: '-', t: 0, o: '-', msg: 'total starts at 0.' });
  for (var i = 0; i < n; i++) {
    frames.push({ line: 1, i: i, t: t, o: '-', msg: 'The loop gives i the value ' + i + '.' });
    var before = t; t = t + i;
    frames.push({ line: 2, i: i, t: t, o: '-', msg: 'total becomes ' + before + ' + ' + i + ' = ' + t + '.' });
  }
  frames.push({ line: 3, i: n - 1, t: t, o: String(t), msg: 'The loop is over, so print shows ' + t + '.' });
  k = 0;
}

function render() {
  var n = +nIn.value, f = frames[k];
  var lines = ['total = 0', 'for i in range(' + n + '):', '    total = total + i', 'print(total)'];
  var code = document.getElementById('code');
  code.textContent = '';
  lines.forEach(function (text, idx) {
    var s = document.createElement('span');
    s.className = 'ln' + (idx === f.line ? ' on' : '');
    s.textContent = text;
    code.appendChild(s);
  });
  document.getElementById('nv').textContent = String(n);
  document.getElementById('vi').textContent = String(f.i);
  document.getElementById('vt').textContent = String(f.t);
  document.getElementById('vo').textContent = String(f.o);
  document.getElementById('log').textContent = f.msg;
  document.getElementById('back').disabled = k === 0;
  document.getElementById('step').disabled = k === frames.length - 1;
}

document.getElementById('step').addEventListener('click', function () { if (k < frames.length - 1) { k++; render(); } });
document.getElementById('back').addEventListener('click', function () { if (k > 0) { k--; render(); } });
document.getElementById('reset').addEventListener('click', function () { k = 0; render(); });
nIn.addEventListener('input', function () { build(); render(); });
build();
render();`,
  },
};

export const INTERACTIVE_FIXTURES: readonly InteractiveFixture[] = [slopeLine, fractionBars, forLoop];

export function getFixture(id: string): InteractiveFixture | undefined {
  return INTERACTIVE_FIXTURES.find((f) => f.id === id);
}
