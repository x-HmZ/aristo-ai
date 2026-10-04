import { Color, type Material, type Object3D } from "three";

/**
 * A teacher's shirt colour (V8.3c). Both teachers shipped in white, which merged with the white infographics on the
 * board and the light page. The shirt is its own material in each GLB, so the colour is set at mount, by name
 * (Jake's `lambert3SG`, MJ's `lambert7.003`). Since V8.3d both are cloth: no colour map (the colour factor is the
 * colour), a baked fold-and-weave normal map, high roughness and a sheen, whose colour is set here too.
 */
export interface Outfit {
  /** The shirt's material name in the GLB. */
  material: string;
  /** The shirt's colour, `#rrggbb`. */
  color: string;
}

type Colored = Material & { color?: Color; sheen?: number; sheenColor?: Color };

/**
 * The cloth's sheen (V8.3d): the soft light a woven fabric catches at grazing angles. The GLB says the shirt has sheen
 * (KHR_materials_sheen), but Blender's exporter writes its tint as the colour and drops the weight, so a white sheen
 * would wash a pastel out. At mount the sheen takes the shirt's own colour, halfway to white, at this strength.
 */
export const SHEEN_STRENGTH = 0.35;
const WHITE = new Color(1, 1, 1);

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
        const c = copy as Colored;
        c.color?.set(outfit.color);
        if (c.sheen && c.sheenColor) c.sheenColor.set(outfit.color).lerp(WHITE, 0.5).multiplyScalar(SHEEN_STRENGTH);
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
