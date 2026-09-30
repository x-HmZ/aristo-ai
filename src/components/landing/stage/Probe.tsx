import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Vector3, type Object3D } from "three";
import { SPOTS, frustumFor, type SpotId } from "./spots";

/** Jake's bones the verification reads: the hands and the index fingertips' last joints, both sides. */
const BONES = ["CC_Base_L_Hand", "CC_Base_R_Hand", "CC_Base_L_Index3", "CC_Base_R_Index3", "CC_Base_Head"] as const;

declare global {
  interface Window {
    __landing?: {
      spot: SpotId;
      /** World positions of BONES, this frame. */
      bones: () => Record<string, [number, number, number]>;
      /** A world point on the page, in CSS px (through this frame's camera and the canvas's box). */
      toPage: (p: [number, number, number]) => { x: number; y: number };
      frustum: () => ReturnType<typeof frustumFor>;
      /** Frames rendered so far. */
      frame: number;
    };
  }
}

/**
 * `?probe`: the verification's window into the stage. It reads Jake's bones in world space, so an object is placed
 * from where his hand actually is at a gesture's peak (Hmz's second hard requirement), and peak frames can show the
 * hand against the object in page pixels. Reads only; renders nothing.
 */
export function Probe({ spot }: { spot: SpotId }) {
  const { scene, camera, gl, size } = useThree();
  const v = useMemo(() => new Vector3(), []);
  useEffect(() => {
    const find = (name: string): Object3D | undefined => scene.getObjectByName(name);
    window.__landing = {
      spot,
      frame: 0,
      bones: () => Object.fromEntries(BONES.map((n) => {
        const o = find(n);
        return [n, o ? (o.getWorldPosition(v).toArray() as [number, number, number]) : [NaN, NaN, NaN]];
      })),
      toPage: (p) => {
        v.set(p[0], p[1], p[2]).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + window.scrollX + ((v.x + 1) / 2) * r.width, y: r.top + window.scrollY + ((1 - v.y) / 2) * r.height };
      },
      frustum: () => frustumFor(SPOTS[spot], size.width / Math.max(1, size.height)),
    };
    return () => { delete window.__landing; };
  }, [scene, camera, gl, size, spot, v]);
  useFrame(() => { if (window.__landing) window.__landing.frame += 1; });
  return null;
}
