/**
 * The landing's two shaders (V8.3). Both are driven by one uniform from the scroll timeline; neither needs a
 * texture beyond the real pipeline outputs (teaching.jpg, source.jpg, model.glb).
 */

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

/**
 * The diagram resolving (plan 4A): noise, then sketch lines, then colour.
 * - p 0 to 0.5: animated grain over a blocky, low-resolution version of the diagram whose blocks shrink as p rises
 *   (a diffusion-like denoise);
 * - p 0.35 to 0.75: the diagram's edges (Sobel on luminance) draw on as thin light lines over the dark display,
 *   revealed along a noise front;
 * - p 0.6 to 1: the full-colour diagram floods through along a second noise front.
 */
export const DIAGRAM_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const DIAGRAM_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float p;
  uniform float time;
  uniform float opacity;
  uniform float paper;
  uniform vec2 texel;
  varying vec2 vUv;
  ${NOISE}
  float lum(vec2 uv) { return dot(texture2D(map, uv).rgb, vec3(0.299, 0.587, 0.114)); }
  void main() {
    // A: denoise.
    float a = smoothstep(0.0, 0.5, p);
    float cells = mix(5.0, 110.0, a * a);
    vec2 q = (floor(vUv * cells) + 0.5) / cells;
    vec3 low = texture2D(map, q).rgb;
    float grain = vnoise(vUv * mix(28.0, 180.0, a) + vec2(time * 2.3, -time * 1.7));
    vec3 col = mix(vec3(grain * 0.85 + 0.08), low, a * 0.92);
    // B: sketch.
    float gx = lum(vUv + vec2(texel.x, 0.0)) - lum(vUv - vec2(texel.x, 0.0));
    float gy = lum(vUv + vec2(0.0, texel.y)) - lum(vUv - vec2(0.0, texel.y));
    float edge = smoothstep(0.08, 0.3, length(vec2(gx, gy)));
    float b = smoothstep(0.35, 0.75, p);
    float front = vnoise(vUv * 6.0) * 0.6 + vUv.y * 0.4;
    float drawn = smoothstep(front - 0.05, front + 0.05, b * 1.15);
    // The sketch is drawn on the board: light lines on a dark one, or (paper = 1, a light page) ink lines on paper.
    vec3 board = mix(vec3(0.075, 0.085, 0.105), vec3(0.985, 0.985, 0.98), paper);
    vec3 line = mix(vec3(0.94, 0.93, 0.9), vec3(0.11, 0.12, 0.15), paper);
    vec3 sketch = mix(board, line, edge * drawn);
    col = mix(col, sketch, smoothstep(0.3, 0.5, p));
    // C: colour.
    float c = smoothstep(0.6, 1.0, p);
    float flood = smoothstep(front - 0.08, front + 0.08, c * 1.2 - 0.05);
    col = mix(col, texture2D(map, vUv).rgb, flood);
    gl_FragColor = vec4(col, opacity);
    #include <colorspace_fragment>
  }
`;

/**
 * The photo becoming the model (plan 5A): each point starts on the flat photo (its pixel's colour) and flies to a
 * sampled point on the real mesh (the model texture's colour there), each with its own delay and a small swirl.
 */
export const POINTS_VERT = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aC0;
  attribute vec3 aC1;
  attribute float aDelay;
  uniform float t;
  uniform float size;
  uniform float pixelRatio;
  varying vec3 vColor;
  void main() {
    float k = clamp((t - aDelay) / 0.62, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    float s = sin(k * 3.14159);
    vec3 swirl = vec3(sin(aDelay * 50.0 + k * 5.0), cos(aDelay * 31.0) * 0.4, cos(aDelay * 50.0 + k * 5.0)) * 0.16 * s;
    vec3 pos = mix(aStart, position, k) + swirl;
    vColor = mix(aC0, aC1, k);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = size * pixelRatio * (1.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
export const POINTS_FRAG = /* glsl */ `
  uniform float opacity;
  varying vec3 vColor;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    gl_FragColor = vec4(vColor, opacity * smoothstep(0.5, 0.3, r));
    #include <colorspace_fragment>
  }
`;
