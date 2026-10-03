"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/**
 * The classroom's renderer setting and lights, shared by the classroom (Experience) and the landing's stage. Their own
 * module so the landing imports them without Experience, whose import of Classroom preloads the room's GLB: the
 * landing fetches the room only near Step Into the Classroom (V8.3b review).
 */

// Bump tone-mapping exposure for PBR avatar materials (Avaturn dark suit benefits from this)
export function RendererConfig() {
  const { gl } = useThree();
  useEffect(() => { gl.toneMappingExposure = 0.83; }, [gl]);
  return null;
}

// Scene-material and light colours below are 3D constants, not brand tokens (see Experience.tsx).
export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.38} color="#ffffff" />
      {/* Key light — from front-right, brightens face */}
      <directionalLight position={[2, 5, 3]} intensity={1.22} color="#ffffff" castShadow />
      {/* Fill light — front-left, soft warmth */}
      <directionalLight position={[-2, 3, 2]} intensity={0.51} color="#fff4e8" />
      {/* Rim — neutral warm, low intensity. Saturated colour here reflects in eye corneas. */}
      <pointLight position={[3, 4, -5]} intensity={0.26} color="#fff4e8" />
      <hemisphereLight args={["#ffffff", "#f5e8d8", 0.38]} />
    </>
  );
}
