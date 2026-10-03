import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Box3, Vector3, type Mesh, type Object3D } from "three";
import { clockOf } from "../play";
import { SPOTS, frustumFor, type SpotId } from "./spots";
import { fx } from "./dissolve";

/** Jake's bones the verification reads: the hands, the index fingertips' last joints and the shoulders, both sides. */
const BONES = ["CC_Base_L_Hand", "CC_Base_R_Hand", "CC_Base_L_Index1", "CC_Base_R_Index1", "CC_Base_L_Index3", "CC_Base_R_Index3", "CC_Base_L_Mid1", "CC_Base_R_Mid1", "CC_Base_L_Mid3", "CC_Base_R_Mid3", "CC_Base_L_Thumb3", "CC_Base_R_Thumb3", "CC_Base_L_Pinky3", "CC_Base_R_Pinky3", "CC_Base_Head", "CC_Base_L_Upperarm", "CC_Base_R_Upperarm"] as const;

declare global {
  interface Window {
    __landing?: {
      spot: SpotId;
      /** World positions of BONES, this frame. */
      bones: () => Record<string, [number, number, number]>;
      /** A world point on the page, in CSS px (through this frame's camera and the canvas's box). */
      toPage: (p: [number, number, number]) => { x: number; y: number };
      /** The framed spot's frustum (null in the room, which has a moving camera). */
      frustum: () => ReturnType<typeof frustumFor> | null;
      /** An object's world bounds by name (the heart's model is "landing-heart-solid", visible or not), or null. */
      bounds: (name: string) => { min: [number, number, number]; max: [number, number, number] } | null;
      /** The nearest vertex of an object's meshes to a world point, and its distance (m), or null. */
      nearest: (name: string, p: [number, number, number]) => { point: [number, number, number]; distance: number } | null;
      /** The renderer's counts: shader programs, geometries and textures on the GPU (for long-frame attribution). */
      gl: () => { programs: number; geometries: number; textures: number };
      /** Every live GL program's material type and cache key (what a new variant is, when one compiles mid-scene). */
      programKeys: () => string[];
      /** The teacher switch's dissolve now (dissolve.ts fx): 0 whole, 1 gone. */
      dissolve: () => number;
      /** Frames rendered so far. */
      frame: number;
      /** The spot's section clock (play.ts), in seconds. */
      clock: () => number;
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
      clock: () => clockOf(spot).t,
      bones: () => Object.fromEntries(BONES.map((n) => {
        const o = find(n);
        return [n, o ? (o.getWorldPosition(v).toArray() as [number, number, number]) : [NaN, NaN, NaN]];
      })),
      toPage: (p) => {
        v.set(p[0], p[1], p[2]).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + window.scrollX + ((v.x + 1) / 2) * r.width, y: r.top + window.scrollY + ((1 - v.y) / 2) * r.height };
      },
      frustum: () => (spot === "room" ? null : frustumFor(SPOTS[spot], size.width / Math.max(1, size.height))),
      bounds: (name) => {
        const o = find(name);
        if (!o) return null;
        const b = new Box3().setFromObject(o, true);
        return b.isEmpty() ? null : { min: b.min.toArray() as [number, number, number], max: b.max.toArray() as [number, number, number] };
      },
      gl: () => ({ programs: gl.info.programs?.length ?? -1, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures }),
      dissolve: () => fx.value.value,
      programKeys: () => (gl.info.programs ?? []).map((q) => `${q.name}|${q.cacheKey}`),
      nearest: (name, p) => {
        const o = find(name);
        if (!o) return null;
        o.updateWorldMatrix(true, true);
        const q = new Vector3(...p), w = new Vector3();
        let best: [number, number, number] | null = null, d = Infinity;
        o.traverse((m) => {
          const pos = (m as Mesh).isMesh ? (m as Mesh).geometry.getAttribute("position") : null;
          if (!pos) return;
          for (let i = 0; i < pos.count; i++) {
            w.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
            const e = w.distanceTo(q);
            if (e < d) { d = e; best = w.toArray() as [number, number, number]; }
          }
        });
        return best ? { point: best, distance: d } : null;
      },
    };
    return () => { delete window.__landing; };
  }, [scene, camera, gl, size, spot, v]);
  useFrame(() => { if (window.__landing) window.__landing.frame += 1; });
  return null;
}
