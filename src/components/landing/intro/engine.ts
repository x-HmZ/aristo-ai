/**
 * The opening's renderer (V8.3c): raw WebGL2, no three.js, so it is in the page in a few kB and draws from the first
 * frames. One draw call of points: each point goes from its place in the last shape (A) to its place in the next (B)
 * along a curl of noise, at its own moment (a delay from its order in the shape), turned in 3D when a shape is.
 * A second, tiny pass draws lines (the constellation's links) and the spark's head.
 */
import type { Cloud } from "./targets";

const VERT = `#version 300 es
precision highp float;
in vec3 aA; in vec3 aB; in vec3 aCA; in vec3 aCB; in vec4 aR; // aR: seed, size, order, phase
uniform vec2 uRes; uniform float uT; uniform float uTime; uniform float uRotA; uniform float uRotB;
uniform float uSpread; uniform float uSwirl; uniform float uSize; uniform float uFocal; uniform float uDpr; uniform float uJitter;
out vec3 vCol; out float vGlow;
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
float ease(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }
void main() {
  float local = clamp((uT - aR.z * uSpread) / max(1e-3, 1.0 - uSpread), 0.0, 1.0);
  float e = ease(local);
  vec3 a = rotY(aA, uRotA), b = rotY(aB, uRotB);
  vec3 p = mix(a, b, e);
  float arc = sin(3.14159 * e);
  float s = aR.x * 6.2831;
  p += arc * uSwirl * vec3(sin(s * 3.0 + uTime * 1.7 + p.y * 0.01), cos(s * 5.0 + uTime * 1.3 + p.x * 0.01), sin(s * 7.0 + uTime));
  p += uJitter * vec3(sin(uTime * 2.1 + s * 11.0), cos(uTime * 1.9 + s * 13.0), 0.0);
  float f = uFocal / max(1.0, uFocal - p.z);
  vec2 sp = p.xy * f;
  gl_Position = vec4(sp.x / (uRes.x * 0.5), -sp.y / (uRes.y * 0.5), 0.0, 1.0);
  gl_PointSize = max(1.0, uSize * aR.y * f * uDpr * (1.0 + arc * 0.8));
  vCol = mix(aCA, aCB, e);
  vGlow = 1.0 + arc * 0.9;
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec3 vCol; in float vGlow; uniform float uAlpha; uniform float uSoft;
out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = mix(1.0 - smoothstep(0.55, 1.0, d), exp(-d * d * 3.5), uSoft);
  if (a < 0.01) discard;
  a *= uAlpha;
  o = vec4(vCol * vGlow * a, a);
}`;

const LINE_VERT = `#version 300 es
precision highp float;
in vec2 aP; uniform vec2 uRes; uniform float uPt;
void main() { gl_Position = vec4(aP.x / (uRes.x * 0.5), -aP.y / (uRes.y * 0.5), 0.0, 1.0); gl_PointSize = uPt; }`;
const LINE_FRAG = `#version 300 es
precision mediump float;
uniform vec4 uC; uniform float uPoint; out vec4 o;
void main() {
  float a = uC.a;
  if (uPoint > 0.5) { float d = length(gl_PointCoord - 0.5) * 2.0; a *= exp(-d * d * 4.0); }
  o = vec4(uC.rgb * a, a);
}`;

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  return p;
}

export interface Frame {
  t: number; time: number; rotA: number; rotB: number; spread: number; swirl: number; size: number;
  alpha: number; soft: number; jitter: number; additive: boolean;
  /** The links (pairs of points, px from the centre) and their opacity. */
  links?: { pts: Float32Array; alpha: number };
  /** The spark's head (px from the centre) and its size, or null. */
  spark?: { x: number; y: number; size: number; alpha: number } | null;
}

export class Engine {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private lineProg: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buf: Record<"aA" | "aB" | "aCA" | "aCB" | "aR", WebGLBuffer>;
  private lineVao: WebGLVertexArrayObject;
  private lineBuf: WebGLBuffer;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private lu: Record<string, WebGLUniformLocation | null> = {};
  readonly n: number;
  private a: Cloud | null = null;
  private b: Cloud | null = null;

  constructor(private canvas: HTMLCanvasElement, n: number, seedRandom: () => number) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
    if (!gl) throw new Error("no webgl2");
    this.gl = gl;
    this.n = n;
    this.prog = program(gl, VERT, FRAG);
    this.lineProg = program(gl, LINE_VERT, LINE_FRAG);
    for (const k of ["uRes", "uT", "uTime", "uRotA", "uRotB", "uSpread", "uSwirl", "uSize", "uFocal", "uDpr", "uJitter", "uAlpha", "uSoft"]) this.u[k] = gl.getUniformLocation(this.prog, k);
    for (const k of ["uRes", "uPt", "uC", "uPoint"]) this.lu[k] = gl.getUniformLocation(this.lineProg, k);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const make = (name: "aA" | "aB" | "aCA" | "aCB" | "aR", size: number, data: Float32Array) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const loc = gl.getAttribLocation(this.prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    };
    const zero3 = new Float32Array(n * 3);
    const r = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      r[i * 4] = seedRandom();
      r[i * 4 + 1] = 0.55 + seedRandom() * 0.9;
      r[i * 4 + 2] = 0;
      r[i * 4 + 3] = seedRandom();
    }
    this.buf = { aA: make("aA", 3, zero3), aB: make("aB", 3, zero3), aCA: make("aCA", 3, zero3), aCB: make("aCB", 3, zero3), aR: make("aR", 4, r) };
    this.rand = r;
    this.lineVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.lineVao);
    this.lineBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    const lp = gl.getAttribLocation(this.lineProg, "aP");
    gl.enableVertexAttribArray(lp);
    gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  private rand: Float32Array;

  /** The next shape: the current one (B) becomes where the points start (A); the order of B sets each one's delay. */
  morphTo(next: Cloud, orderFrom: "next" | "random" = "next"): void {
    const gl = this.gl;
    this.a = this.b ?? next;
    this.b = next;
    // Fresh storage each time (orphaning): updating a buffer the GPU may still be drawing from stalls (ANGLE: 70 to
    // 180 ms at a beat change, measured).
    const set = (name: keyof Engine["buf"], data: Float32Array) => { gl.bindBuffer(gl.ARRAY_BUFFER, this.buf[name]); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); };
    set("aA", this.a.pos); set("aCA", this.a.col);
    set("aB", this.b.pos); set("aCB", this.b.col);
    for (let i = 0; i < this.n; i++) this.rand[i * 4 + 2] = orderFrom === "next" ? next.order[i] : this.rand[i * 4 + 3];
    set("aR", this.rand);
  }

  resize(): number {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    return dpr;
  }

  draw(f: Frame): void {
    const gl = this.gl;
    const dpr = this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    // Additive light on the ink; normal (premultiplied) when the points must look like the picture they form.
    if (f.additive) gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const w = innerWidth, h = innerHeight;
    if (f.links && f.links.alpha > 0.01) {
      gl.useProgram(this.lineProg);
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, f.links.pts, gl.DYNAMIC_DRAW);
      gl.uniform2f(this.lu.uRes, w, h);
      gl.uniform1f(this.lu.uPoint, 0);
      gl.uniform4f(this.lu.uC, 0.97, 0.62, 0.38, 0.35 * f.links.alpha);
      gl.drawArrays(gl.LINES, 0, f.links.pts.length / 2);
    }
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.u.uRes, w, h);
    gl.uniform1f(this.u.uT, f.t);
    gl.uniform1f(this.u.uTime, f.time);
    gl.uniform1f(this.u.uRotA, f.rotA);
    gl.uniform1f(this.u.uRotB, f.rotB);
    gl.uniform1f(this.u.uSpread, f.spread);
    gl.uniform1f(this.u.uSwirl, f.swirl);
    gl.uniform1f(this.u.uSize, f.size);
    gl.uniform1f(this.u.uFocal, Math.max(w, h) * 1.4);
    gl.uniform1f(this.u.uDpr, dpr);
    gl.uniform1f(this.u.uJitter, f.jitter);
    gl.uniform1f(this.u.uAlpha, f.alpha);
    gl.uniform1f(this.u.uSoft, f.soft);
    gl.drawArrays(gl.POINTS, 0, this.n);
    if (f.spark && f.spark.alpha > 0.01) {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.lineProg);
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([f.spark.x, f.spark.y]), gl.DYNAMIC_DRAW);
      gl.uniform2f(this.lu.uRes, w, h);
      gl.uniform1f(this.lu.uPoint, 1);
      gl.uniform1f(this.lu.uPt, f.spark.size * dpr);
      gl.uniform4f(this.lu.uC, 1, 0.62, 0.32, f.spark.alpha);
      gl.drawArrays(gl.POINTS, 0, 1);
    }
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const b of Object.values(this.buf)) gl.deleteBuffer(b);
    gl.deleteBuffer(this.lineBuf);
    gl.deleteVertexArray(this.vao);
    gl.deleteVertexArray(this.lineVao);
    gl.deleteProgram(this.prog);
    gl.deleteProgram(this.lineProg);
  }
}
