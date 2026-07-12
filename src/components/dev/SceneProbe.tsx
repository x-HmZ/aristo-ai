"use client";

/**
 * SceneProbe — dev-only raycast inspector.
 *
 * Mount inside <AristoCanvas> (via its children prop).  Every canvas click
 * raycasts into the scene and logs the world-space hit point, the surface
 * normal, and the mesh name to the console.  Used to find exact desk
 * surface coordinates for the desk-quiz placement.
 */

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Raycaster, Vector2, Vector3 } from "three";

export function SceneProbe() {
  const { camera, scene, gl } = useThree();

  // Downward probe: dispatch `window.dispatchEvent(new CustomEvent(
  // "aristo:probe-down", { detail: { x, z } }))` to raycast straight down
  // from y=+2 at (x, z) and log every surface it passes through.  Gives
  // exact desk/floor heights without having to click through overlays.
  useEffect(() => {
    const raycaster = new Raycaster();
    const onProbeDown = (e: Event) => {
      const { x, z } = (e as CustomEvent<{ x: number; z: number }>).detail;
      raycaster.set(new Vector3(x, 2, z), new Vector3(0, -1, 0));
      const hits = raycaster.intersectObjects(scene.children, true)
        .filter((h) => h.object.visible)
        .slice(0, 5)
        .map((h) => ({
          y:    +h.point.y.toFixed(3),
          mesh: h.object.name || "(unnamed)",
        }));
      console.log("[probe-down]", JSON.stringify({ x, z, hits }));
    };
    window.addEventListener("aristo:probe-down", onProbeDown);
    return () => window.removeEventListener("aristo:probe-down", onProbeDown);
  }, [scene]);

  useEffect(() => {
    const raycaster = new Raycaster();
    const ndc = new Vector2();

    const onClick = (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster
        .intersectObjects(scene.children, true)
        .find((h) => h.object.visible);
      if (!hit) {
        console.log("[probe] no hit");
        return;
      }
      const worldNormal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : null;
      console.log(
        "[probe]",
        JSON.stringify({
          point:  hit.point.toArray().map((n) => +n.toFixed(3)),
          normal: worldNormal?.toArray().map((n) => +n.toFixed(2)) ?? null,
          mesh:   hit.object.name || "(unnamed)",
        })
      );
    };

    gl.domElement.addEventListener("click", onClick);
    return () => gl.domElement.removeEventListener("click", onClick);
  }, [camera, scene, gl]);

  return null;
}
