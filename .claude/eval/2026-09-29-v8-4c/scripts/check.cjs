// Page-side checks, evaluated in the browser. Same method as V8.4a's aa.cjs: each visible text node
// against its composited background. Where the stack is not opaque (the 3D scene, or the harness frame,
// which is skipped on purpose) both a white and a black pixel are tried and the lower ratio counts.
// Disabled controls are exempt (WCAG 1.4.3).

// Returns [{t, ratio, need, fg, bg, scene, size}] for every visible text node under `scope` (a selector
// or "" for the whole document).
const AA = (scope) => {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, bottom) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1); };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement;
    if (!el || !n.textContent.trim()) continue;
    if (scope && !el.closest(scope)) continue;
    if (el.closest(".sr-only, [data-skip], [disabled], [aria-disabled='true'], script, style, [data-nextjs-dialog-overlay], nextjs-portal")) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
    const fg = parse(cs.color);
    const layers = [];
    let e = el, opaque = false;
    while (e && e !== document.body && e !== document.documentElement && !e.hasAttribute("data-h")) {
      const s = getComputedStyle(e);
      const bg = parse(s.backgroundColor);
      if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 0.999) { opaque = true; break; } }
      e = e.parentElement;
    }
    // A parent with reduced opacity dims the text too.
    let op = 1; for (let p = el; p && p !== document.body; p = p.parentElement) op *= +getComputedStyle(p).opacity;
    // Fully transparent through an ancestor: not on screen (a place not yet lit), so not text to read. Any partial
    // opacity still counts, composited.
    if (op === 0) continue;
    const grounds = opaque ? [null] : [[255, 255, 255, 1], [0, 0, 0, 1]];
    let worst = Infinity, worstBg = null;
    for (const g of grounds) {
      let c = g ? g : layers[layers.length - 1];
      const start = g ? layers.length - 1 : layers.length - 2;
      for (let i = start; i >= 0; i--) c = over(layers[i], c);
      const f = fg[3] * op < 1 ? over([fg[0], fg[1], fg[2], fg[3] * op], c) : fg;
      const rr = ratio(f, c);
      if (rr < worst) { worst = rr; worstBg = c; }
    }
    const size = parseFloat(cs.fontSize), weight = +cs.fontWeight;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    out.push({ t: n.textContent.trim().slice(0, 40), ratio: +worst.toFixed(2), need: large ? 3 : 4.5, fg: cs.color, bg: worstBg.slice(0, 3).map(Math.round).join(","), scene: !opaque, size });
  }
  return out;
};

// Targets under 44x44 and running animations, under `scope`.
const TARGETS = (scope) => {
  const s = [], a = [];
  for (const b of document.querySelectorAll("button, a, textarea, input, select")) {
    if (scope && !b.closest(scope)) continue;
    const r = b.getBoundingClientRect();
    if (r.width === 0 || getComputedStyle(b).visibility === "hidden") continue;
    // Links inside a sentence are exempt from the target size (WCAG 2.5.8, inline); they render inline.
    if (b.tagName === "A" && getComputedStyle(b).display === "inline") continue;
    if (r.height < 44 - 0.5 || r.width < 44 - 0.5) s.push(`${(b.innerText || b.getAttribute("aria-label") || b.getAttribute("placeholder") || b.tagName).trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  for (const el of document.querySelectorAll("*")) {
    if (scope && !el.closest(scope)) continue;
    const cs = getComputedStyle(el);
    if (cs.animationName && cs.animationName !== "none" && cs.animationPlayState === "running") a.push(`${el.tagName}.${(el.className.baseVal ?? el.className).toString().slice(0, 40)} ${cs.animationName}`);
    if (cs.transitionDuration && cs.transitionDuration.split(",").some((d) => parseFloat(d) > 0) && el.matches(":hover")) a.push(`transition ${el.tagName}`);
  }
  return { s, a };
};
module.exports = { AA, TARGETS };
