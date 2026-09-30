import type { Camera, Material, Object3D, Scene, Texture, WebGLRenderer } from "three";

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
