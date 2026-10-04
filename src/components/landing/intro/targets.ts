/**
 * The opening's shapes (V8.3c, "Spark to Teacher"), as point clouds: each beat's particles go to one of these. Points
 * are in CSS pixels from the viewport's centre (x right, y down, z towards the reader), colours are linear 0..1 RGB.
 *
 * The samplers that need the DOM (text, a path, an image) take a canvas factory, so the arithmetic is unit-tested
 * without one. Everything here is deterministic for a seed: the same visit draws the same opening.
 */

export interface Cloud {
  /** xyz per point. */
  pos: Float32Array;
  /** rgb per point. */
  col: Float32Array;
  /** Per point, its order in the shape (0..1): the mark is drawn in this order. */
  order: Float32Array;
}

/** A small seeded generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** The palette: the page's ink and paper, and its one orange as the light. */
export const CREAM = hex("#F4ECE1");
export const ORANGE = hex("#F97B2F");
export const EMBER = hex("#FFB27A");

/**
 * Fill `n` points from `k` candidates (repeating, shuffled, with a little jitter so repeats do not stack). `pick(i)`
 * writes candidate i's position and colour.
 */
export function fill(
  n: number, k: number, seed: number, jitter: number,
  pick: (i: number, p: number[], c: number[]) => void,
): Cloud {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), order = new Float32Array(n);
  const r = rng(seed);
  const p = [0, 0, 0], c = [0, 0, 0];
  for (let j = 0; j < n; j++) {
    // Spread the n points evenly over the k candidates (in their order), then jitter.
    const i = Math.min(k - 1, Math.floor((j / n) * k));
    pick(i, p, c);
    pos[j * 3] = p[0] + (r() - 0.5) * jitter;
    pos[j * 3 + 1] = p[1] + (r() - 0.5) * jitter;
    pos[j * 3 + 2] = p[2] + (r() - 0.5) * jitter;
    col.set(c, j * 3);
    order[j] = k > 1 ? i / (k - 1) : 0;
  }
  return { pos, col, order };
}

/** Where a canvas's opaque pixels are, on a grid of `step`: each one's x, y and its colour. */
export function opaquePixels(data: Uint8ClampedArray, w: number, h: number, step: number, min = 128): { x: number; y: number; c: [number, number, number] }[] {
  const out: { x: number; y: number; c: [number, number, number] }[] = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const k = (y * w + x) * 4;
      if (data[k + 3] >= min) out.push({ x, y, c: [data[k] / 255, data[k + 1] / 255, data[k + 2] / 255] });
    }
  }
  return out;
}

/**
 * The ideas of the lesson as a constellation: `count` orbs on a loose ring around the centre (with one in the middle),
 * the links between neighbours and across. Returns each orb's centre and the links as pairs of orb indices.
 */
export function constellation(count: number, rx: number, ry: number, seed: number): { centres: [number, number][]; links: [number, number][] } {
  const r = rng(seed);
  const centres: [number, number][] = [[0, 0]];
  for (let i = 0; i < count - 1; i++) {
    const a = (i / (count - 1)) * Math.PI * 2 - Math.PI / 2 + (r() - 0.5) * 0.35;
    const k = 0.78 + r() * 0.22;
    centres.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
  }
  const links: [number, number][] = [];
  for (let i = 1; i < count; i++) {
    links.push([0, i]);
    links.push([i, i === count - 1 ? 1 : i + 1]);
  }
  return { centres, links };
}

/** Points around each orb: a bright core and a soft halo, the centre orb in orange. */
export function orbs(n: number, centres: readonly [number, number][], radius: number, seed: number): Cloud {
  const r = rng(seed);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), order = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const o = j % centres.length;
    const [cx, cy] = centres[o];
    // Gaussian-ish radius (two uniforms), a third of the points in a tight core.
    const core = r() < 0.35;
    const d = (core ? 0.35 : 1) * radius * Math.sqrt(-2 * Math.log(Math.max(1e-6, r()))) * 0.5;
    const a = r() * Math.PI * 2;
    pos[j * 3] = cx + Math.cos(a) * d;
    pos[j * 3 + 1] = cy + Math.sin(a) * d;
    pos[j * 3 + 2] = (r() - 0.5) * radius;
    const c = o === 0 ? ORANGE : core ? CREAM : EMBER;
    col.set(c, j * 3);
    order[j] = o / centres.length;
  }
  return { pos, col, order };
}

/**
 * A brain in points, for the turning beat: two hemispheres (folded by a ridged noise, a gap at the midline), the
 * cerebellum under the back, the brainstem below. Its regions are tinted towards the model's (a nod to the room), soft
 * against the cream. Units: `size` is its length front to back in px; +z is the front.
 */
export function brain(n: number, size: number, seed: number): Cloud {
  const r = rng(seed);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), order = new Float32Array(n);
  const tint = (c: [number, number, number], k: number): [number, number, number] =>
    [CREAM[0] + (c[0] - CREAM[0]) * k, CREAM[1] + (c[1] - CREAM[1]) * k, CREAM[2] + (c[2] - CREAM[2]) * k];
  const FRONT = tint(hex("#5B8DEF"), 0.7), TOP = tint(hex("#F2C14E"), 0.7), SIDE = tint(hex("#6CC27A"), 0.65);
  const BACK = tint(hex("#E5604D"), 0.7), CEREB = tint(hex("#B58AD8"), 0.65), STEM = tint(hex("#C9C2BA"), 0.4);
  const s = size / 1.3;
  const sphere = () => {
    const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
    return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
  };
  for (let j = 0; j < n; j++) {
    const u = r();
    let x: number, y: number, z: number, c: [number, number, number], shade = 1;
    if (u < 0.78) {
      // A hemisphere: a point on an ellipsoid, pushed out along a ridged fold pattern (the gyri), darker in the folds.
      const side = r() < 0.5 ? -1 : 1;
      let [dx, dy, dz] = sphere();
      if (dx * side < -0.15) dx = -dx; // no points on the inner face
      const ridge = Math.abs(Math.sin(11 * dz + 5 * dy + 2 * dx) * Math.sin(10 * dy - 6 * dz));
      const fold = 1 + 0.06 * ridge;
      x = (side * 0.06 + dx * 0.34) * fold;
      y = dy * 0.4 * fold - (dz < -0.2 ? 0.04 : 0);
      z = dz * 0.62 * fold;
      shade = 0.35 + 0.65 * ridge * ridge;
      c = z > 0.2 ? FRONT : y > 0.14 ? TOP : z < -0.34 ? BACK : SIDE;
    } else if (u < 0.93) {
      // The cerebellum: two lobes tucked under the back of the cerebrum, filled (a surface alone reads as a ring in
      // light), finely striped across (its folia).
      const side = r() < 0.5 ? -1 : 1;
      const [dx, dy, dz] = sphere();
      const k = Math.cbrt(r());
      x = side * 0.1 + dx * 0.16 * k;
      y = -0.27 + dy * 0.1 * k;
      z = -0.43 + dz * 0.2 * k;
      shade = 0.3 + 0.7 * Math.pow(Math.abs(Math.sin(y * 70 + z * 8)), 2);
      c = CEREB;
    } else {
      // The brainstem: a tapering stalk from under the middle of the brain, down and a little forward.
      const a = r() * Math.PI * 2, h = r(), k = Math.sqrt(r());
      const rad = (0.07 - h * 0.03) * k;
      x = Math.cos(a) * rad;
      y = -0.22 - h * 0.4;
      z = -0.2 + Math.sin(a) * rad + h * 0.1;
      shade = 0.55 + 0.45 * k;
      c = STEM;
    }
    pos[j * 3] = x * s;
    pos[j * 3 + 1] = -y * s; // y down on screen
    pos[j * 3 + 2] = z * s;
    col[j * 3] = c[0] * shade; col[j * 3 + 1] = c[1] * shade; col[j * 3 + 2] = c[2] * shade;
    order[j] = r();
  }
  return { pos, col, order };
}
