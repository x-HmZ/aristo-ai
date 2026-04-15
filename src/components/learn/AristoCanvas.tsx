"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Experience } from "@/components/three/Experience";

export function AristoCanvas() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.5, 4], fov: 40 }}
      className="w-full h-full"
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.8}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
        target={[0, 0, -3]}
      />
    </Canvas>
  );
}
