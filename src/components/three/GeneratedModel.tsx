"use client";

import { Html, useGLTF } from "@react-three/drei";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box3, Euler, Group, Matrix4, Vector3, type Mesh, type Object3D } from "three";
import { useAristoStore } from "@/store/useAristoStore";
import type { ModelAnnotation } from "@/lib/agents/teaching";
import { BRAND_HEX } from "@/lib/brandColors";

interface AnnotationPoint {
  label: string;
  position: [number, number, number];
  /** Which side of the anchor the chip sits on, so it never covers the model. */
  align?: "left" | "right" | "center";
}

interface GeneratedModelProps {
  modelUrl: string;
  annotationHints?: string[];                      // legacy: positional fallback
  modelAnnotations?: ModelAnnotation[];            // preferred: { label, bias }
  /** The parts the narration is on right now (the segment's callouts): their labels light up like a hover. */
  focusLabels?: string[];
  position?: [number, number, number];
  scale?: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** "Left ventricle" is in focus for a callout "left ventricle" or "the left ventricle wall", and the other way round. */
function inFocus(label: string, focus: string[]): boolean {
  const l = norm(label);
  return focus.some((f) => {
    const n = norm(f);
    return !!n && (n.includes(l) || l.includes(n));
  });
}

/** The model's bounds in its own space, whatever group it is mounted in (the cached scene may already be placed). */
function modelBounds(scene: Object3D): Box3 {
  scene.updateMatrixWorld(true);
  const toLocal = new Matrix4().copy(scene.matrixWorld).invert();
  const box = new Box3();
  const part = new Box3();
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    part.copy(mesh.geometry.boundingBox!).applyMatrix4(new Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld));
    box.union(part);
  });
  return box;
}

/**
 * Label spots measured from the model itself (its bounds at the shown scale), outside the spinning group: a
 * generated mesh has no named parts, so a label cannot sit on the real aorta, but "top" now means just above this
 * model and the side labels form two tidy columns beside it, instead of fixed offsets that floated up the wall.
 */
function boundsPositions(annotations: ModelAnnotation[], box: Box3, s: number): AnnotationPoint[] {
  const c = box.getCenter(new Vector3()).multiplyScalar(s);
  const half = box.getSize(new Vector3()).multiplyScalar(s / 2);
  const side = Math.max(half.x, half.z) + 0.06; // the model spins, so clear its widest turn
  const pad = 0.06, step = 0.16;
  const cols = { left: 0, right: 0, top: 0, bottom: 0 };
  return annotations.slice(0, 6).map((a) => {
    let col: keyof typeof cols =
      a.bias === "left" || a.bias === "back" ? "left" : a.bias === "right" ? "right" : a.bias === "top" ? "top" : a.bias === "bottom" ? "bottom" : "right";
    // Top and bottom take two labels each; the rest spill to the shorter side column.
    if ((col === "top" || col === "bottom") && cols[col] >= 2) col = cols.left <= cols.right ? "left" : "right";
    if (a.bias === "front") col = cols.left < cols.right ? "left" : "right";
    const i = cols[col]++;
    if (col === "top")    return { label: a.label, align: "center", position: [c.x + (i ? 0.35 : -0.35) * (cols.top > 1 ? 1 : 0), c.y + half.y + pad, c.z] };
    if (col === "bottom") return { label: a.label, align: "center", position: [c.x + (i ? 0.35 : -0.35) * (cols.bottom > 1 ? 1 : 0), c.y - half.y - pad, c.z] };
    const x = col === "left" ? c.x - side : c.x + side;
    return { label: a.label, align: col, position: [x, c.y + half.y * 0.5 - i * step, c.z] };
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
  focusLabels = [],
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

  const bounds = useMemo(() => modelBounds(scene), [scene]);
  const annotations: AnnotationPoint[] = useMemo(
    () => modelAnnotations && modelAnnotations.length > 0
      ? boundsPositions(modelAnnotations, bounds, scale)
      : hintPositions(annotationHints),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hints are a stable legacy list
    [modelAnnotations, bounds, scale],
  );
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
    <group position={position}>
    <group
      ref={group}
      dispose={null}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
      onWheel={onWheel}
    >
      <primitive object={scene} />

      {/* Glow ring at base */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <ringGeometry args={[0.6, 0.8, 32]} />
        <meshBasicMaterial color={BRAND_HEX.orangeMain} transparent opacity={0.15} />
      </mesh>
    </group>

      {/* Labels stay put while the model turns. */}
      {annotations.map(({ label, position: aPos, align = "center" }) => (
        <Html
          key={label}
          position={aPos}
          style={{
            pointerEvents: "auto",
            transform: align === "left" ? "translate(-100%, -50%)" : align === "right" ? "translate(0, -50%)" : "translate(-50%, -50%)",
          }}
        >
          <div
            className={`
              theme-ink cursor-pointer select-none whitespace-nowrap rounded-[10px] border px-2.5 py-1 text-xs font-semibold shadow-e1
              transition-transform duration-fast motion-reduce:transition-none
              ${hoveredAnnotation === label || inFocus(label, focusLabels)
                ? "scale-110 border-accent bg-accent text-accent-ink"
                : "border-line bg-bg/[0.86] text-ink backdrop-blur-md"
              }
            `}
            onMouseEnter={() => setHoveredAnnotation(label)}
            onMouseLeave={() => setHoveredAnnotation(null)}
          >
            {label}
          </div>
        </Html>
      ))}
    </group>
  );
}
