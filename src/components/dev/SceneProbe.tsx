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
import { Raycaster, Vector2 } from "three";

export function SceneProbe() {
  const { camera, scene, gl } = useThree();

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
