"use client";

import "./dracoDecoder";
import { useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useAristoStore } from "@/store/useAristoStore";
import { BRAND_HEX, withAlpha } from "@/lib/brandColors";
import type { Classroom as ClassroomVariant } from "@/store/useAristoStore";

// Canvas-texture colours in this file are 3D-material constants (chalkboard
// green, paper, ruled lines, ink), not brand colours: no --aristo-* token
// mirrors them, so they stay literal. The orange accents are the exception and
// come from BRAND_HEX, which brandColors.test.ts keeps equal to
// --aristo-orange-main.

// ─── Blackboard — ambient echo of current phase content ─────────────────────

function Blackboard({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  const lesson = useAristoStore((s) => s.activeLesson);
  const meshRef = useRef<THREE.Mesh>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width  = 1024;
    canvas.height = 512;
    canvasRef.current  = canvas;
    textureRef.current = new THREE.CanvasTexture(canvas);
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshBasicMaterial).map = textureRef.current;
      (meshRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
    return () => {
      textureRef.current?.dispose();
    };
  }, []);

  // Repaint whenever lesson content changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const texture = textureRef.current;
    if (!canvas || !texture) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Board background — dark green/slate
    ctx.fillStyle = "#1a3a2a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Chalk border
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    if (lesson) {
      // Topic label
      ctx.fillStyle = withAlpha(BRAND_HEX.orangeMain, 0.9);
      ctx.font = "bold 36px 'Arial', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lesson.concept_name, canvas.width / 2, 68);

      // Divider line
      ctx.strokeStyle = withAlpha(BRAND_HEX.orangeMain, 0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 86);
      ctx.lineTo(canvas.width - 60, 86);
      ctx.stroke();

      // Key insight
      const insight = lesson.phases.explain.key_insight;
      if (insight) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "22px 'Arial', sans-serif";
        ctx.textAlign = "left";
        // Word-wrap
        const words = insight.split(" ");
        let line = "";
        let y = 130;
        const maxWidth = canvas.width - 120;
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, 60, y);
            line = word;
            y += 34;
            if (y > canvas.height - 50) break;
          } else {
            line = test;
          }
        }
        if (line) ctx.fillText(line, 60, y);
      }
    } else {
      // Empty state
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = "italic 28px 'Arial', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Aristo", canvas.width / 2, canvas.height / 2);
    }

    texture.needsUpdate = true;
  }, [lesson?.concept_id, lesson?.phases.explain.key_insight]);

  return (
    <mesh ref={meshRef} position={position} rotation={rotation ? new THREE.Euler(...rotation) : undefined}>
      <planeGeometry args={[4.2, 2.1]} />
      <meshBasicMaterial toneMapped={false} />
    </mesh>
  );
}

// ─── Desk paper — ambient echo of current quiz question ─────────────────────

function DeskPaper({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  const meshRef   = useRef<THREE.Mesh>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  // We read active quiz question from the store — but the quiz is local state in
  // LearnClient; the best we can do is read the active lesson's challenge question
  // which mirrors what the quiz is based on.
  const lesson = useAristoStore((s) => s.activeLesson);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width  = 512;
    canvas.height = 320;
    canvasRef.current  = canvas;
    textureRef.current = new THREE.CanvasTexture(canvas);
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshBasicMaterial).map = textureRef.current;
      (meshRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
    return () => {
      textureRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const texture = textureRef.current;
    if (!canvas || !texture) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Paper
    ctx.fillStyle = "#fffef8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Lined paper effect
    ctx.strokeStyle = "rgba(180,190,255,0.35)";
    ctx.lineWidth = 1;
    for (let y = 50; y < canvas.height - 10; y += 28) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(canvas.width - 20, y);
      ctx.stroke();
    }

    // Red margin
    ctx.strokeStyle = "rgba(220,60,60,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(48, 0);
    ctx.lineTo(48, canvas.height);
    ctx.stroke();

    if (lesson?.phases.challenge.question) {
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "bold 18px 'Arial', sans-serif";
      ctx.fillText("Challenge:", 56, 32);

      ctx.fillStyle = "#2d2d44";
      ctx.font = "16px 'Arial', sans-serif";
      const words = lesson.phases.challenge.question.split(" ");
      let line = "";
      let y = 62;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > canvas.width - 80 && line) {
          ctx.fillText(line, 56, y);
          line = word;
          y += 28;
          if (y > canvas.height - 20) break;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, 56, y);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.font = "italic 16px 'Arial', sans-serif";
      ctx.fillText("Your challenge will appear here…", 56, canvas.height / 2);
    }

    texture.needsUpdate = true;
  }, [lesson?.concept_id, lesson?.phases.challenge.question]);

  return (
    <mesh ref={meshRef} position={position} rotation={rotation ? new THREE.Euler(...rotation) : undefined}>
      {/* Sized to fit flat on the second-row desk (~1.05 × 0.6 surface). */}
      <planeGeometry args={[0.6, 0.4]} />
      <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Classroom scene ─────────────────────────────────────────────────────────
// Layout matches V1 (Aristo Experience.jsx commit e8931f0). Camera lives at
// [0, 0, 0.0001] (see AristoCanvas.tsx) so all anchors are V1-verbatim.

interface ClassroomProps {
  variant: Exclude<ClassroomVariant, "none">;
}

type Vec3 = [number, number, number];

// Both GLBs are built from the same shell (scripts/room/), so they share one
// transform and one (hidden) board anchor; retune them here, once.
const ROOM_SHELL = {
  classroom: { position: [0.2, -1.7, -2] as Vec3, rotationY: 0, scale: 1 },
  board:     { position: [0.45, 0.382, -6] as Vec3 },
};

const PLACEMENT: Record<ClassroomProps["variant"], {
  classroom: { position: Vec3; rotationY: number; scale: number };
  board:     { position: Vec3 };
  /** Second-row desk for the ambient DeskPaper; null where the room has none. */
  desk:      { position: Vec3 } | null;
}> = {
  default: {
    ...ROOM_SHELL,
    // The V1-verbatim anchor [0.55,-1.3,-3.6] sits in EMPTY AIR in this GLB
    // (probed: nothing under it but floor at y=-1.694) — the paper visibly
    // floated beside the desks.  Re-anchored flat onto the second-row desk
    // (probed surface y=-0.888, x∈[-0.55,0.5], z∈[-2.1,-2.7]), offset right
    // of the chair so the chair back doesn't occlude it from the camera.
    desk:      { position: [0.3, -0.886, -2.35] as [number, number, number] },
  },
  // V8.5 "Evening": built from the default room's shell (scripts/room/), so it
  // shares its transform and every probed anchor. It is a one-to-one study:
  // the learner's own desk stays (the quiz anchor), the second-row desk does
  // not, so there is no DeskPaper here.
  alternative: {
    ...ROOM_SHELL,
    desk:      null,
  },
};

export function Classroom({ variant }: ClassroomProps) {
  const glbPath = `/models/classroom_${variant}.glb`;
  const { scene } = useGLTF(glbPath);
  // Ambient DeskPaper is hidden while an in-scene quiz is mounted — the
  // DeskQuiz component renders its own (larger, interactive) paper at the
  // same anchor and we don't want the canvas-painted text bleeding through.
  const activeQuiz = useAristoStore((s) => s.activeQuiz);

  const cloned = scene.clone(true);
  const cfg = PLACEMENT[variant];

  return (
    <group>
      <primitive
        object={cloned}
        position={cfg.classroom.position}
        rotation-y={cfg.classroom.rotationY}
        scale={cfg.classroom.scale}
      />

      <Blackboard position={cfg.board.position} />

      {!activeQuiz && cfg.desk && (
        <DeskPaper
          position={cfg.desk.position}
          rotation={[-Math.PI / 2, 0, 0.12]}
        />
      )}
    </group>
  );
}

// T02 — 3D asset diet: preload only the default classroom. The alternative
// was previously preloaded unconditionally even when never shown — it now
// lazy-loads through the Suspense boundary in Experience.tsx the first time
// the user switches scenes; TeacherControls.tsx also warms it on hover/click
// of the "Evening" button.
useGLTF.preload("/models/classroom_default.glb");
