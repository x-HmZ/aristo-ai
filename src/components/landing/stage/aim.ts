import { Quaternion, Vector3, type Object3D } from "three";
import { damp } from "./ease";

/**
 * Aims an offered hand at a point (V8.3b, the hero: Hmz wanted the open palm to point at Try a lesson). The clip
 * (PresentModel) holds the hand out level at shoulder height; the button is lower. After the pose each frame, the
 * shoulder turns so the line from it to the fingertip meets the point, then the wrist turns so the hand does too,
 * which also tips the palm towards it. Both are limited, and weighted by how far the arm is raised, so the
 * correction grows and fades with the gesture itself and never touches the arm at rest.
 *
 * A bone the mixer did not write this frame (its track dropped as rest) still holds what was written here, so it is
 * put back to its clip value first; the correction never compounds (the same guard as Teacher's head look).
 */

/** How raised the arm is, from the sine of the shoulder-to-fingertip line's elevation (-1 hanging, 0 level). */
export function raisedWeight(sinElevation: number): number {
  const t = Math.min(1, Math.max(0, (sinElevation + 0.6) / 0.4));
  return t * t * (3 - 2 * t);
}

/** The most the shoulder, the wrist and (when pointing) the index finger's base may turn, in radians. */
export const MAX_SHOULDER = (25 * Math.PI) / 180;
export const MAX_WRIST = (30 * Math.PI) / 180;
export const MAX_FINGER = (15 * Math.PI) / 180;

interface Held { clip: Quaternion; written: Quaternion; wrote: boolean }
const held = (): Held => ({ clip: new Quaternion(), written: new Quaternion(), wrote: false });

const _a = new Vector3(), _b = new Vector3(), _p = new Vector3(), _t = new Vector3();
const _q = new Quaternion(), _qt = new Quaternion(), _qw = new Quaternion(), _qp = new Quaternion(), _id = new Quaternion();

/** Turns `bone` (in world space) so the line from it to `end` points at `target`, by at most `max`, times `w`. */
function turn(bone: Object3D, end: Object3D, target: Vector3, w: number, max: number) {
  bone.getWorldPosition(_p);
  end.getWorldPosition(_t);
  _a.subVectors(_t, _p).normalize();
  _b.subVectors(target, _p).normalize();
  _qt.setFromUnitVectors(_a, _b);
  const angle = 2 * Math.acos(Math.min(1, Math.abs(_qt.w)));
  const k = angle > 1e-6 ? (Math.min(angle, max) / angle) * w : 0;
  _q.copy(_id).slerp(_qt, k);
  // World rotation onto the bone, back into its parent's space.
  bone.getWorldQuaternion(_qw);
  bone.parent!.getWorldQuaternion(_qp).invert();
  bone.quaternion.copy(_qp.multiply(_q.multiply(_qw)));
  bone.updateMatrixWorld(true);
}

/**
 * `finger`: for a pointing hand, the index finger's base turns last, so the finger itself (knuckle to tip) points at
 * the target and not only the line from the wrist: at a distance the finger's own bend otherwise misses it (It
 * Remembers' last review point, V8.3b eval). Off for an open palm (the hero's offer).
 */
export function createAim(root: Object3D, side: "L" | "R" = "L", opts: { finger?: boolean } = {}) {
  const shoulder = root.getObjectByName(`CC_Base_${side}_Upperarm`);
  const hand = root.getObjectByName(`CC_Base_${side}_Hand`);
  const tip = root.getObjectByName(`CC_Base_${side}_Index3`);
  const knuckle = opts.finger ? root.getObjectByName(`CC_Base_${side}_Index1`) : undefined;
  const hs = held(), hh = held(), hk = held();
  let weight = 0;

  const restore = (bone: Object3D, h: Held) => {
    if (h.wrote && bone.quaternion.equals(h.written)) bone.quaternion.copy(h.clip);
    else h.clip.copy(bone.quaternion);
    h.wrote = false;
  };
  const keep = (bone: Object3D, h: Held) => { h.written.copy(bone.quaternion); h.wrote = true; };

  /** Each frame after the pose: aim at `target` while `active`, fading in and out over about a fifth of a second. */
  return (target: Vector3 | null, active: boolean, delta: number) => {
    if (!shoulder || !hand || !tip || !shoulder.parent || !hand.parent) return;
    restore(shoulder, hs);
    restore(hand, hh);
    if (knuckle) restore(knuckle, hk);
    if (!active && weight < 1e-3) return;
    // The mixer and the look moved the skeleton this frame; its world matrices are refreshed at render, so now.
    root.updateMatrixWorld(true);
    shoulder.getWorldPosition(_p);
    tip.getWorldPosition(_t);
    const sin = _t.sub(_p).normalize().y;
    weight = damp(weight, active && target ? raisedWeight(sin) : 0, 12, delta);
    if (weight < 1e-3 || !target) return;
    turn(shoulder, tip, target, weight, MAX_SHOULDER);
    turn(hand, tip, target, weight, MAX_WRIST);
    if (knuckle?.parent) turn(knuckle, tip, target, weight, MAX_FINGER);
    keep(shoulder, hs);
    keep(hand, hh);
    if (knuckle) keep(knuckle, hk);
  };
}
