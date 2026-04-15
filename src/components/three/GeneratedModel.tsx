"use client";

import { Html, useGLTF, OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Group } from "three";

interface AnnotationPoint {
  label: string;
  position: [number, number, number];
}

interface GeneratedModelProps {
  modelUrl: string;
  annotationHints?: string[];
  position?: [number, number, number];
  scale?: number;
}

// Distribute annotation labels around the model in a circle
function generateAnnotationPositions(hints: string[]): AnnotationPoint[] {
  const radius = 0.9;
  return hints.slice(0, 5).map((label, i) => {
    const angle = (i / hints.length) * Math.PI * 2;
    return {
      label,
      position: [
        Math.cos(angle) * radius,
        0.3 + i * 0.25,
        Math.sin(angle) * radius * 0.3,
      ],
    };
  });
}

export function GeneratedModel({
  modelUrl,
  annotationHints = [],
  position = [1.8, -1.7, -3],
  scale = 1.2,
}: GeneratedModelProps) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF(modelUrl);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
  const [appeared, setAppeared] = useState(false);

  const annotations = generateAnnotationPositions(annotationHints);

  // Fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setAppeared(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Slow auto-rotation
  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group
      ref={group}
      position={position}
      scale={appeared ? scale : 0}
      dispose={null}
    >
      <primitive object={scene} />

      {/* Annotation labels */}
      {annotations.map(({ label, position: aPos }) => (
        <Html
          key={label}
          position={aPos}
          distanceFactor={3}
          style={{ pointerEvents: "auto" }}
        >
          <div
            className={`
              px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer
              transition-all duration-200 select-none
              ${hoveredAnnotation === label
                ? "bg-primary text-primary-foreground shadow-aristo scale-110"
                : "bg-white/90 text-foreground shadow-warm border border-border"
              }
            `}
            onMouseEnter={() => setHoveredAnnotation(label)}
            onMouseLeave={() => setHoveredAnnotation(null)}
          >
            {label}
          </div>
        </Html>
      ))}

      {/* Subtle glow ring at base */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <ringGeometry args={[0.6, 0.8, 32]} />
        <meshBasicMaterial color="#F97B2F" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}
