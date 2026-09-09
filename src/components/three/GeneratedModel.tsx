"use client";

import { Html, useGLTF } from "@react-three/drei";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Euler, Group } from "three";
import { useAristoStore } from "@/store/useAristoStore";
import type { ModelAnnotation } from "@/lib/agents/teaching";

interface AnnotationPoint {
  label: string;
  position: [number, number, number];
}

interface GeneratedModelProps {
  modelUrl: string;
  annotationHints?: string[];                      // legacy: positional fallback
  modelAnnotations?: ModelAnnotation[];            // preferred: { label, bias }
  position?: [number, number, number];
  scale?: number;
}

const BIAS_DIRS: Record<ModelAnnotation["bias"], [number, number, number]> = {
  front:  [ 0,    0.3,  0.9],
  back:   [ 0,    0.3, -0.9],
  left:   [-0.9,  0.3,  0  ],
  right:  [ 0.9,  0.3,  0  ],
  top:    [ 0,    1.1,  0  ],
  bottom: [ 0,   -0.6,  0  ],
};

function biasPositions(annotations: ModelAnnotation[]): AnnotationPoint[] {
  // Spread overlapping biases by stacking vertically
  const groups: Record<string, number> = {};
  return annotations.slice(0, 6).map((a) => {
    const base = BIAS_DIRS[a.bias] ?? BIAS_DIRS.front;
    const idx  = (groups[a.bias] = (groups[a.bias] ?? 0) + 1) - 1;
    return {
      label: a.label,
      position: [base[0], base[1] + idx * 0.25, base[2]],
    };
  });
}

function hintPositions(hints: string[]): AnnotationPoint[] {
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
  modelAnnotations,
  position = [1.1, -0.4, -3],
  scale = 1.5,
}: GeneratedModelProps) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF(modelUrl);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
  const [appeared, setAppeared] = useState(false);

  const setModelInteracting = useAristoStore((s) => s.setModelInteracting);

  // Tripo3D v2.5 emits Y-up glTF (the spec default), so no correction is
  // needed. This used to apply `-PI/2` on X for TripoSR, which exported Z-up;
  // that model was retired 2026-09-09 and its cached meshes are unreachable
  // (the cache-key prefix changed with it), so the rotation would only ever
  // tip a correctly-oriented model onto its back now.
  useEffect(() => {
    scene.rotation.set(0, 0, 0);
  }, [scene]);

  const annotations: AnnotationPoint[] = modelAnnotations && modelAnnotations.length > 0
    ? biasPositions(modelAnnotations)
    : hintPositions(annotationHints);
  const isDragging   = useRef(false);
  const lastPointer  = useRef({ x: 0, y: 0 });
  const rotY         = useRef(0);    // world-Y spin (like Earth's axis)
  const rotX         = useRef(0);    // tilt (latitude)
  const userScale    = useRef(scale);
  const isHovered    = useRef(false);


  useEffect(() => { userScale.current = scale; }, [scale]);

  useEffect(() => {
    const t = setTimeout(() => setAppeared(true), 50);
    return () => clearTimeout(t);
  }, []);

  useFrame((_, delta) => {
    if (!group.current) return;
    // Auto-rotate on Y only when not interacted with (like Earth spinning on its axis)
    if (!isHovered.current) {
      rotY.current += delta * 0.4;
    }
    // YXZ order: Y spin applied first, then X tilt — gives true globe feel
    group.current.rotation.order = "YXZ" as unknown as Euler["order"];
    group.current.rotation.y = rotY.current;
    group.current.rotation.x = rotX.current;
    group.current.scale.setScalar(appeared ? userScale.current : 0);
  });

  const onPointerEnter = () => {
    isHovered.current = true;
    setModelInteracting(true);
    document.body.style.cursor = "grab";
  };

  const onPointerLeave = () => {
    isDragging.current = false;
    isHovered.current = false;
    setModelInteracting(false);
    document.body.style.cursor = "";
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    document.body.style.cursor = "grabbing";
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDragging.current = false;
    document.body.style.cursor = "grab";
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    // Left-right drag → Y spin; up-down drag → X tilt (clamped so it doesn't flip)
    rotY.current += dx * 0.012;
    rotX.current  = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, rotX.current + dy * 0.012));
    lastPointer.current = { x: e.clientX, y: e.clientY };
  };

  const onWheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation();
    userScale.current = Math.max(0.4, Math.min(3.0, userScale.current - e.deltaY * 0.001));
  };

  return (
    <group
      ref={group}
      position={position}
      dispose={null}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
      onWheel={onWheel}
    >
      <primitive object={scene} />

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

      {/* Glow ring at base */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <ringGeometry args={[0.6, 0.8, 32]} />
        <meshBasicMaterial color="#F97B2F" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}
