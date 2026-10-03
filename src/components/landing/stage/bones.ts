import type { Object3D } from "three";

/**
 * A rig's bone by its CC4 name (V8.3c). Jake's bones carry the plain names (`CC_Base_L_Hand`); MJ's export gave each a
 * numeric suffix (`CC_Base_L_Hand_055`) and a `_scaleCompensation` twin, so an exact lookup finds nothing on her. This
 * takes the exact name, else the name with one numeric suffix, never a compensation node.
 */
export function boneOf(root: Object3D, name: string): Object3D | undefined {
  const exact = root.getObjectByName(name);
  if (exact) return exact;
  const suffixed = new RegExp(`^${name}_[0-9]+$`);
  let found: Object3D | undefined;
  root.traverse((o) => { if (!found && suffixed.test(o.name)) found = o; });
  return found;
}
