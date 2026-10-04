import type { Material, Object3D } from "three";

/**
 * A teacher's shirt colour (V8.3c). Both teachers shipped in white, which merged with the white infographics on the
 * board and the light page. The shirt is its own material in each GLB, so the colour is set at mount, by name:
 * - Jake's `lambert3SG` has a white diffuse map with the folds baked in: the colour factor tints it and the folds stay.
 * - MJ's `lambert7.003` has no map: the colour factor is the colour.
 */
export interface Outfit {
  /** The shirt's material name in the GLB. */
  material: string;
  /** The shirt's colour, `#rrggbb`. */
  color: string;
}

type Colored = Material & { color?: { set: (c: string) => unknown } };

/**
 * Recolours the outfit's material on one mounted teacher. The material is cloned first: a cloned skeleton still shares
 * its materials with the loader's cache, so an edit in place would reach every later mount (and the other pages).
 * Returns the clones, for the caller to dispose of when the mount goes.
 */
export function applyOutfit(root: Object3D, outfit: Outfit): Material[] {
  const clones = new Map<Material, Material>();
  root.traverse((child) => {
    const mesh = child as Object3D & { isMesh?: boolean; material?: Material | Material[] };
    if (!mesh.isMesh || !mesh.material) return;
    const swap = (mat: Material): Material => {
      if (mat.name !== outfit.material) return mat;
      let copy = clones.get(mat);
      if (!copy) {
        copy = mat.clone();
        (copy as Colored).color?.set(outfit.color);
        clones.set(mat, copy);
      }
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
  return [...clones.values()];
}

/** `?shirt=rrggbb` in development only: the colour sheet's override (V8.3c). Null otherwise. */
export function devShirt(search: string | undefined): string | null {
  if (process.env.NODE_ENV === "production" || !search) return null;
  const hex = new URLSearchParams(search).get("shirt");
  return hex && /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex}` : null;
}
