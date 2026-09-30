// Pure-math check of the framing model against the probe measurements (no browser).
const K = 0.55 / 400; // world units per CSS px on the paper
const FOV = 40 * Math.PI / 180;
const A = [0, -0.878, -0.5], POS0 = [0, 0.2, -0.05], TGT0 = [0, -1.05, -0.6];
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, s) => a.map((v) => v * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));
function cam(pos, tgt, W, H) {
  const f = norm(sub(tgt, pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), t = Math.tan(FOV / 2), asp = W / H;
  return (p) => { const d = sub(p, pos); const z = dot(d, f); return [(dot(d, r) / (z * t * asp) + 1) / 2 * W, (1 - dot(d, u) / (z * t)) / 2 * H, z]; };
}
function box(pos, tgt, W, H, cw, ch) {
  const P = cam(pos, tgt, W, H), a = cw * K / 2, d = ch * K / 2;
  const c = { nl: P([A[0] - a, A[1], A[2] + d]), nr: P([A[0] + a, A[1], A[2] + d]), fl: P([A[0] - a, A[1], A[2] - d]), fr: P([A[0] + a, A[1], A[2] - d]) };
  return { c, left: c.nl[0], right: c.nr[0], top: c.fl[1], bottom: c.nl[1], P };
}
function ctrlH(pos, tgt, W, H, cw, ch, cssH) { // screen height of a control cssH tall at the far edge
  const P = cam(pos, tgt, W, H), d = ch * K / 2;
  const y0 = P([A[0], A[1], A[2] - d])[1], y1 = P([A[0], A[1], A[2] - d + cssH * K])[1];
  return Math.abs(y1 - y0);
}
module.exports = { K, A, POS0, TGT0, sub, add, mul, box, ctrlH, cam };
if (require.main === module) {
  // today's, against the measured card rects (probe, sidebar hidden)
  for (const [W, H, ch] of [[1024, 768, 396], [1280, 720, 371], [1920, 1080, 556], [360, 780, 0]]) {
    const b = box(POS0, TGT0, W, H, 520, ch || 396);
    console.log(W, H, "left", b.left.toFixed(0), "right", b.right.toFixed(0), "top", b.top.toFixed(0), "bot", b.bottom.toFixed(0), "ctrl52@far", ctrlH(POS0, TGT0, W, H, 520, ch || 396, 52).toFixed(1));
  }
}
