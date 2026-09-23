/**
 * Bone masks for overlay clips (V9.3). three.js has no per-bone action
 * weights, so an upper-body gesture is a copy of its clip with only the
 * tracks of these bones (see `overlayWeight` in director.ts for how it then
 * wins over the base). Pure: the renderer passes in the skeleton as names.
 *
 * Found by structure, not by a per-rig name list, so the Canino rigs
 * (CC_Base_Hip > Waist > Spine01 > Spine02 > NeckTwist01 > ... > Head), the
 * Avaturn rig and custom Avaturn teachers (Hips > Spine > Spine1 > Spine2 >
 * Neck > Head) all resolve the same way:
 * - upper: the bone two below the hips on the way to the head (Spine01,
 *   Spine1) and everything under it -- chest, arms, neck, head. The hips
 *   and the lowest spine bone stay with the base, so the legs and the
 *   stance never change under a gesture;
 * - head: the first neck bone and everything under it.
 */
import type { ClipMask } from "./animationManifest";

export interface BoneInfo {
  name:   string;
  /** Parent bone's name; null at the root of the skeleton. */
  parent: string | null;
}

export type SkeletonMasks = Partial<Record<Exclude<ClipMask, "full">, ReadonlySet<string>>>;

const HEAD = /head$/i;
const HIP  = /hips?$/i;
const NECK = /neck/i;

export function skeletonMasks(bones: readonly BoneInfo[]): SkeletonMasks {
  const parentOf = new Map(bones.map((b) => [b.name, b.parent]));
  const children = new Map<string, string[]>();
  for (const b of bones) {
    if (b.parent === null) continue;
    const list = children.get(b.parent) ?? [];
    list.push(b.name);
    children.set(b.parent, list);
  }

  const chainTo = (name: string): string[] => {
    const chain: string[] = [];
    for (let n: string | null | undefined = name; n; n = parentOf.get(n)) {
      if (chain.includes(n)) break; // a malformed cycle
      chain.unshift(n);
    }
    return chain;
  };
  const subtree = (root: string): Set<string> => {
    const out = new Set<string>();
    const stack = [root];
    while (stack.length) {
      const n = stack.pop()!;
      if (out.has(n)) continue;
      out.add(n);
      stack.push(...(children.get(n) ?? []));
    }
    return out;
  };

  // The head is the one whose chain passes through the hips.
  const headChain = bones
    .filter((b) => HEAD.test(b.name))
    .map((b) => chainTo(b.name))
    .find((chain) => chain.some((n) => HIP.test(n)));
  if (!headChain) return {};

  const masks: SkeletonMasks = {};
  const hip = headChain.findIndex((n) => HIP.test(n));
  const neck = headChain.findIndex((n, i) => i > hip && NECK.test(n));
  const headIdx = headChain.length - 1;

  const upperRoot = headChain[Math.min(hip + 2, neck > hip ? neck : headIdx)];
  if (upperRoot && upperRoot !== headChain[hip]) masks.upper = subtree(upperRoot);
  masks.head = subtree(headChain[neck > hip ? neck : headIdx]);
  return masks;
}

/**
 * The node a three.js track animates: "CC_Base_Head.quaternion" ->
 * "CC_Base_Head". GLTFLoader names tracks `${sanitizedNodeName}.${property}`
 * and bones carry the same sanitised name, so the two compare directly.
 */
export function trackNode(trackName: string): string {
  const dot = trackName.lastIndexOf(".");
  return dot < 0 ? trackName : trackName.slice(0, dot);
}

/** The track names of a clip that belong to `mask`. */
export function maskTrackNames(trackNames: readonly string[], mask: ReadonlySet<string>): string[] {
  return trackNames.filter((t) => mask.has(trackNode(t)));
}
