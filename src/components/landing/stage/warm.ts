import type { Camera, Material, Mesh, Object3D, Scene, Texture, WebGLRenderer } from "three";

const idle = () =>
  new Promise<void>((resolve) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => resolve(), { timeout: 600 });
    else setTimeout(resolve, 60);
  });

/** Every texture on an object's materials (maps of any kind), once each. */
export function texturesOf(object: Object3D): Texture[] {
  const out = new Set<Texture>();
  object.traverse((o) => {
    const m = (o as { material?: Material | Material[] }).material;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
      for (const v of Object.values(mat)) if (v && (v as Texture).isTexture) out.add(v as Texture);
      const uniforms = (mat as { uniforms?: Record<string, { value: unknown }> }).uniforms;
      if (uniforms) for (const u of Object.values(uniforms)) if (u.value && (u.value as Texture).isTexture) out.add(u.value as Texture);
    }
  });
  return [...out];
}

/**
 * Get a part ready before its beat, off the frames the reader scrolls through: its shaders compile in parallel
 * (`compileAsync`, KHR_parallel_shader_compile where the driver has it) and its textures upload one per idle
 * moment. What is left for the first draw is the geometry upload, which the caller does in one invisible frame.
 */
export async function warmUp(gl: WebGLRenderer, scene: Scene, camera: Camera, object: Object3D): Promise<void> {
  await gl.compileAsync(object, camera, scene);
  for (const t of texturesOf(object)) {
    await idle();
    gl.initTexture(t);
  }
}

/**
 * The first real draw of each of `object`'s meshes, one mesh per idle moment, before it is shown. A program that
 * compileAsync reports ready still costs its first draw on some drivers (ANGLE on Direct3D 11 finishes it then: 50 to
 * 200 ms each, measured in the V8.3b eval, session 3); drawn all at once when the part first shows, that was one long
 * frame (Jake's start-up, about 500 ms; the room, 2.5 s). Here each costs its own short task instead.
 *
 * Each draw is the whole scene with only that mesh shown (so its lights, environment, tone mapping and output are the
 * screen's: the same program variants the live frames use), on the canvas itself, and the frame is drawn again
 * straight after, so what the canvas shows never changes. Frustum culling is off for that draw, so a mesh outside
 * the current view is drawn too. `object` itself may be hidden; it is shown only for its draws.
 */
export async function drawEach(gl: WebGLRenderer, scene: Scene, camera: Camera, object: Object3D, alive: () => boolean = () => true): Promise<void> {
  const meshes: Mesh[] = [];
  const seen = new Set<string>();
  object.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    // One draw per material set and kind of geometry (skinned, morphed): what a program is compiled for.
    const key = `${mats.map((x) => x.uuid).join()}|${(m as { isSkinnedMesh?: boolean }).isSkinnedMesh ? 1 : 0}|${m.morphTargetInfluences?.length ?? 0}`;
    if (seen.has(key)) return;
    seen.add(key);
    meshes.push(m);
  });
  for (const mesh of meshes) {
    await idle();
    if (!alive()) return;
    const shown: Object3D[] = [];
    scene.traverse((o) => { if ((o as Mesh).isMesh && o !== mesh && o.visible) { o.visible = false; shown.push(o); } });
    const wasVisible = object.visible, culled = mesh.frustumCulled;
    object.visible = true;
    mesh.frustumCulled = false;
    try {
      gl.render(scene, camera);
    } finally {
      object.visible = wasVisible;
      mesh.frustumCulled = culled;
      for (const o of shown) o.visible = true;
    }
    // The frame as it was: the canvas never shows the warm draw.
    gl.render(scene, camera);
  }
}
