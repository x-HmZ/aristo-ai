"use client";

import { useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useAristoStore } from "@/store/useAristoStore";
import type { Classroom as ClassroomVariant } from "@/store/useAristoStore";

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
      ctx.fillStyle = "rgba(249,123,47,0.9)";
      ctx.font = "bold 36px 'Arial', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lesson.concept_name, canvas.width / 2, 68);

      // Divider line
      ctx.strokeStyle = "rgba(249,123,47,0.3)";
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
      ctx.fillText("Aristo ✦", canvas.width / 2, canvas.height / 2);
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
      <planeGeometry args={[1.2, 0.75]} />
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

const PLACEMENT = {
  default: {
    classroom: { position: [0.2, -1.7, -2]   as [number, number, number], rotationY: 0,             scale: 1   },
    board:     { position: [0.45, 0.382, -6] as [number, number, number] },
    desk:      { position: [0.55, -1.3, -3.6] as [number, number, number] },
  },
  alternative: {
    classroom: { position: [0.3, -1.7, -1.5] as [number, number, number], rotationY: -Math.PI / 2,  scale: 0.4 },
    board:     { position: [1.4, 0.84, -8]   as [number, number, number] },
    desk:      { position: [0.55, -1.3, -3.6] as [number, number, number] },
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

      {!activeQuiz && (
        <DeskPaper
          position={cfg.desk.position}
          rotation={[-Math.PI / 2.5, 0, 0.15]}
        />
      )}
    </group>
  );
}

// Preload both variants
useGLTF.preload("/models/classroom_default.glb");
useGLTF.preload("/models/classroom_alternative.glb");
