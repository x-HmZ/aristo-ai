import { Box3, Color, type Material, type Mesh, type Object3D, type WebGLProgramParametersWithUniforms } from "three";
import { BRAND_HEX } from "@/lib/brandColors";

/**
 * The switch between teachers (V8.3c): the one teaching dissolves into light from the feet up, then the other forms
 * the same way and waves. Every mount on the landing carries the patch (at 0 it draws exactly as before), so the
 * warm-up compiles it and a switch never compiles a shader mid-scene.
 *
 * `fx.value` is how much of the teacher is gone, 0 to 1; `fx.dir` 1 goes feet first (out), -1 comes back feet first
 * (in). One uniform object for every patched material, set once a frame by the stage.
 */
export const fx = {
  value: { value: 0 },
  dir: { value: 1 },
  base: { value: -1.7 },
  height: { value: 2.6 },
  edge: { value: new Color(BRAND_HEX.orangeMain) },
};

const VERT_DECL = "varying vec3 vDissolveWorld;\n";
const VERT_BODY = "vDissolveWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n";
const FRAG_DECL = `varying vec3 vDissolveWorld;
uniform float uDissolve;
uniform float uDissolveDir;
uniform float uDissolveBase;
uniform float uDissolveHeight;
uniform vec3 uDissolveEdge;
float dissolveHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dissolveNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dissolveHash(i), dissolveHash(i + vec3(1,0,0)), f.x), mix(dissolveHash(i + vec3(0,1,0)), dissolveHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dissolveHash(i + vec3(0,0,1)), dissolveHash(i + vec3(1,0,1)), f.x), mix(dissolveHash(i + vec3(0,1,1)), dissolveHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float dissolveField() {
  float h = clamp((vDissolveWorld.y - uDissolveBase) / uDissolveHeight, 0.0, 1.0);
  float f = 0.72 * h + 0.28 * dissolveNoise(vDissolveWorld * 9.0);
  return uDissolveDir > 0.0 ? f : 1.0 - f;
}
`;
const FRAG_CLIP = `float dissolveF = dissolveField();
if (uDissolve > 0.0 && dissolveF < uDissolve) discard;
`;
const FRAG_GLOW = `if (uDissolve > 0.0 && uDissolve < 1.0) totalEmissiveRadiance += uDissolveEdge * 3.0 * (1.0 - smoothstep(0.0, 0.06, dissolveF - uDissolve));
`;

function patch(mat: Material): Material {
  const copy = mat.clone();
  copy.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uDissolve = fx.value;
    shader.uniforms.uDissolveDir = fx.dir;
    shader.uniforms.uDissolveBase = fx.base;
    shader.uniforms.uDissolveHeight = fx.height;
    shader.uniforms.uDissolveEdge = fx.edge;
    shader.vertexShader = VERT_DECL + shader.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = FRAG_DECL + shader.fragmentShader
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${FRAG_CLIP}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${FRAG_GLOW}`);
  };
  // One program per original program, shared by every patched copy (and so compiled once, at the warm-up).
  copy.customProgramCacheKey = () => "landing-dissolve";
  return copy;
}

/**
 * The driver's `materials` pass (Teacher.tsx): each mesh's material swapped for a patched copy, and the teacher's
 * height read for the sweep (`measure`: only the teacher on stage sets it). Returns the cleanup that puts the originals back and frees the copies.
 */
export function dissolvable(root: Object3D, measure: boolean): () => void {
  const swapped: { mesh: Mesh; was: Material | Material[] }[] = [];
  const copies = new Map<Material, Material>();
  const one = (m: Material) => {
    let c = copies.get(m);
    if (!c) { c = patch(m); copies.set(m, c); }
    return c;
  };
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    swapped.push({ mesh, was: mesh.material });
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(one) : one(mesh.material);
  });
  if (!measure) return restore(swapped, copies);
  root.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(root);
  if (Number.isFinite(box.min.y) && box.max.y > box.min.y) {
    fx.base.value = box.min.y;
    fx.height.value = box.max.y - box.min.y;
  }
  return restore(swapped, copies);
}

function restore(swapped: { mesh: Mesh; was: Material | Material[] }[], copies: Map<Material, Material>): () => void {
  return () => {
    for (const { mesh, was } of swapped) mesh.material = was;
    for (const c of copies.values()) c.dispose();
  };
}
