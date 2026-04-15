"use client";

import { useAristoStore } from "@/store/useAristoStore";
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Group, MathUtils, MeshStandardMaterial } from "three";
import { randInt } from "three/src/math/MathUtils.js";

const ANIMATION_FADE_TIME = 0.5;
const TEACHERS = ["Ryan", "Sonia"] as const;

interface TeacherProps {
  teacher: "Ryan" | "Sonia";
  position?: [number, number, number];
  scale?: number;
  rotationY?: number;
}

export function Teacher({ teacher, position = [-1, -1.7, -3], scale = 1.5, rotationY = 0.35 }: TeacherProps) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF(`/models/Teacher_${teacher}.glb`);
  const { animations } = useGLTF(`/models/animations_${teacher}.glb`);
  const { actions, mixer } = useAnimations(animations, group);

  const isLoading = useAristoStore((s) => s.isLoading);
  const isSpeaking = useAristoStore((s) => s.isSpeaking);
  const [animation, setAnimation] = useState<string>("Idle");
  const [blink, setBlink] = useState(false);
  const [thinkingDots, setThinkingDots] = useState(".");

  // Apply standard material to avoid rendering issues
  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.material) {
        child.material = new MeshStandardMaterial({ map: child.material.map });
      }
    });
  }, [scene]);

  // Blink loop
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const nextBlink = () => {
      timeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); nextBlink(); }, 120);
      }, randInt(1500, 5000));
    };
    nextBlink();
    return () => clearTimeout(timeout);
  }, []);

  // Thinking dots animation
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setThinkingDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Animation state machine
  useEffect(() => {
    if (isLoading) {
      setAnimation("Thinking");
    } else if (isSpeaking) {
      setAnimation(randInt(0, 1) ? "Talking" : "Talking2");
    } else {
      setAnimation("Idle");
    }
  }, [isLoading, isSpeaking]);

  // Play animation with crossfade
  useEffect(() => {
    const action = actions[animation];
    if (!action) return;
    action.reset().fadeIn(mixer.time > 0 ? ANIMATION_FADE_TIME : 0).play();
    return () => { action.fadeOut(ANIMATION_FADE_TIME); };
  }, [animation, actions, mixer]);

  // Morph targets per frame
  useFrame(() => {
    lerpMorphTarget("mouthSmile", isSpeaking ? 0.5 : 0.2, isSpeaking ? 0.1 : 0.5);
    lerpMorphTarget("eye_close", blink ? 1 : 0, 0.5);

    // Loop talking animation
    if (isSpeaking && actions[animation]) {
      const clip = actions[animation].getClip();
      if (actions[animation].time > clip.duration - ANIMATION_FADE_TIME) {
        setAnimation((a) => (a === "Talking" ? "Talking2" : "Talking"));
      }
    }
  });

  const lerpMorphTarget = (target: string, value: number, speed: number) => {
    scene.traverse((child: any) => {
      if (child.isSkinnedMesh && child.morphTargetDictionary) {
        const index = child.morphTargetDictionary[target];
        if (index === undefined || child.morphTargetInfluences[index] === undefined) return;
        child.morphTargetInfluences[index] = MathUtils.lerp(
          child.morphTargetInfluences[index],
          value,
          speed
        );
      }
    });
  };

  return (
    <group ref={group} position={position} scale={scale} rotation-y={rotationY} dispose={null}>
      {isLoading && (
        <Html position={[0, teacher === "Sonia" ? 1.1 : 1.2, 0]}>
          <div className="flex items-center justify-center -translate-x-1/2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 shadow-aristo text-sm font-medium text-foreground">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-soft" />
              Thinking{thinkingDots}
            </div>
          </div>
        </Html>
      )}
      <primitive object={scene} />
    </group>
  );
}

// Preload both teachers
TEACHERS.forEach((t) => {
  useGLTF.preload(`/models/Teacher_${t}.glb`);
  useGLTF.preload(`/models/animations_${t}.glb`);
});
