"use client";

import { useAristoStore } from "@/store/useAristoStore";
import { Environment, Float, Grid } from "@react-three/drei";
import { Suspense } from "react";
import { GeneratedModel } from "./GeneratedModel";
import { Teacher } from "./Teacher";

function Floor() {
  return (
    <Grid
      position={[0, -1.71, 0]}
      args={[20, 20]}
      cellSize={0.8}
      cellThickness={0.4}
      cellColor="#f0e8df"
      sectionSize={4}
      sectionThickness={0.8}
      sectionColor="#e0c8b0"
      fadeDistance={12}
      fadeStrength={1.5}
      infiniteGrid
    />
  );
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.6} color="#fff8f0" />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.2}
        color="#ffffff"
        castShadow
      />
      <pointLight position={[-3, 3, 2]} intensity={0.4} color="#F97B2F" />
      <hemisphereLight
        args={["#fff4e8", "#fde8cc", 0.4]}
      />
    </>
  );
}

function FloatingModel({ modelUrl, annotationHints }: { modelUrl: string; annotationHints?: string[] }) {
  return (
    <Float
      speed={1.2}
      rotationIntensity={0}
      floatIntensity={0.3}
      floatingRange={[-0.05, 0.05]}
    >
      <GeneratedModel
        modelUrl={modelUrl}
        annotationHints={annotationHints}
        position={[1.8, -1.7, -3]}
        scale={1.2}
      />
    </Float>
  );
}

export function Experience() {
  const teacher = useAristoStore((s) => s.teacher);
  const activeModelUrl = useAristoStore((s) => s.activeModelUrl);
  const messages = useAristoStore((s) => s.messages);

  const lastMessage = messages.at(-1);
  // Only structured messages carry modelUrl / annotationHints
  const lastStructured = lastMessage?.type === "structured" ? lastMessage : null;
  const annotationHints =
    lastStructured?.modelUrl === activeModelUrl
      ? (lastStructured.annotationHints ?? [])
      : [];

  const teacherAvatar = teacher === "ryan" ? "Ryan" : "Sonia";

  return (
    <>
      <color attach="background" args={["#FDF0E4"]} />
      <SceneLights />
      <Environment preset="apartment" environmentIntensity={0.3} />
      <Floor />

      <Suspense fallback={null}>
        <Teacher
          teacher={teacherAvatar}
          position={[-1, -1.7, -3]}
          scale={1.5}
          rotationY={0.35}
        />
      </Suspense>

      {activeModelUrl && (
        <Suspense fallback={null}>
          <FloatingModel
            modelUrl={activeModelUrl}
            annotationHints={annotationHints}
          />
        </Suspense>
      )}
    </>
  );
}
