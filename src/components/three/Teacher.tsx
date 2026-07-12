"use client";

import "./dracoDecoder";
import { useAristoStore, type TeacherAvatar } from "@/store/useAristoStore";
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, LoopOnce, MathUtils, MeshStandardMaterial, SRGBColorSpace } from "three";
import { randInt } from "three/src/math/MathUtils.js";
import { getCurrentViseme } from "@/hooks/useTTS";

const ANIMATION_FADE_TIME = 0.5;

// ─── Avatar config ────────────────────────────────────────────────────────────
//
// To add a new avatar:
//   1. Drop Teacher_<Name>.glb + animations_<Name>.glb into public/models/.
//   2. Add an entry here.
//   3. Flip readyToUse to true in TeacherControls.tsx.
//
// ── Recommended realistic sources (free, commercial-OK) ──────────────────────
//
//   CC4 photoscanned characters (Aaron / Ariana and ActorCore free tier):
//     https://www.reallusion.com/character-creator/free-3d-character-base.html
//     https://actorcore.reallusion.com/3d-character/free
//     License: CC4 Base EULA — commercial use including web/apps is permitted.
//
//   CGTrader Realistic Male (rigged, native GLB):
//     https://www.cgtrader.com/free-3d-models/character/man/realistic-male-character-rigged
//     License: CGTrader Royalty-Free — commercial use OK.
//
// ── Blender workflow (CC4 → GLB) ─────────────────────────────────────────────
//   1. Export FBX from CC4 using the "Blender" preset.
//   2. In Blender, install the free CC/iC Blender Tools add-on:
//        https://github.com/soupday/cc_blender_tools
//   3. Import FBX with the add-on → Build Basic Materials → Bake Textures.
//   4. Export as GLTF 2.0 Binary (.glb), no animations → Teacher_<Name>.glb.
//
// ── Animation workflow (Mixamo → GLB) ────────────────────────────────────────
//   1. Upload the character FBX to https://www.mixamo.com → Auto-Rig.
//   2. Apply and download each of these four animations as FBX (With Skin):
//        Idle, Talking (or "Standing Arguing"), Talking2 (or "Lecturing"),
//        Thinking (or "Thinking" / "Thoughtful").
//   3. In Blender, import each FBX, rename the NLA strip to the exact clip name
//      shown in the `clips` config below, then push to NLA.
//   4. With all clips in the NLA editor, export as GLTF 2.0 Binary (.glb),
//      Include Animations: ON → animations_<Name>.glb.
//
// ── Blend-shape names by source ──────────────────────────────────────────────
//   Ryan / Sonia (legacy custom rig):  mouthSmile, eye_close
//   CC4 / Avaturn (ARKit standard):    mouthSmile, eyeBlinkLeft (+ eyeBlinkRight)
//   CGTrader Auto-Rig Pro:             varies — inspect in Blender and update morphs
//
// ── pbrMaterials flag ────────────────────────────────────────────────────────
//   false → strip all material props to a flat MeshStandardMaterial (safe
//           fallback for legacy / stylised GLBs that have material issues).
//   true  → trust the GLB's PBR materials as-is (required for CC4, Avaturn,
//            and any character with normal/roughness/specular maps — stripping
//            them makes the character look flat and washed-out).

interface AvatarConfig {
  sceneFile:        string;
  animFile:         string;
  spawnLabelHeight: number;
  clips: {
    idle:     string[];   // one or more; cycles on a timer when standing still
    thinking: string[];   // one or more; cycles at clip end while loading
    talking:  string[];   // one or more; cycles at clip end while speaking
    pointing?: string[];  // played when gesture === "pointing"; falls back to talking
    nodding?:  string[];  // played once on correct-answer feedback
    shaking?:  string[];  // played once on incorrect-answer feedback
  };
  morphs: {
    mouthSmile?: string;  // blend-shape name for mouth-open / smile (legacy fallback)
    eyeClose?:   string;  // blend-shape name for eye blink (single target)
    /**
     * If true, the rig has the full Avaturn ARKit viseme set
     * (viseme_aa, viseme_E, viseme_O, …). Teacher.tsx will drive these
     * directly from wawa-lipsync per frame instead of toggling mouthSmile.
     */
    visemes?:    boolean;
  };
  pbrMaterials: boolean;
}

// Exported so TeacherControls.tsx can preload an avatar's GLBs on
// hover/select (see T02 — 3D asset diet: only the default avatar is preloaded
// at module scope now; everything else lazy-loads via Suspense, optionally
// warmed early by the switcher UI).
export const AVATAR_ASSETS: Record<Exclude<TeacherAvatar, "custom">, AvatarConfig> = {
  ryan: {
    sceneFile: "Teacher_Ryan.glb",
    animFile:  "animations_Ryan.glb",
    spawnLabelHeight: 1.2,
    clips:  { idle: ["Idle"], thinking: ["Thinking"], talking: ["Talking", "Talking2"] },
    morphs: { mouthSmile: "mouthSmile", eyeClose: "eye_close" },
    pbrMaterials: false,
  },
  sonia: {
    sceneFile: "Teacher_Sonia.glb",
    animFile:  "animations_Sonia.glb",
    spawnLabelHeight: 1.1,
    clips:  { idle: ["Idle"], thinking: ["Thinking"], talking: ["Talking", "Talking2"] },
    morphs: { mouthSmile: "mouthSmile", eyeClose: "eye_close" },
    pbrMaterials: false,
  },
  // Avaturn photorealistic adult male — Mixamo-animated, 16+ clips
  marcus: {
    sceneFile: "Teacher_Marcus.glb",
    animFile:  "animations_Avaturn.glb",
    spawnLabelHeight: 1.25,
    clips: {
      idle:     ["Idle", "Idle2", "Idle3", "Idle4"],
      thinking: ["Thinking", "Thinking2"],
      talking:  ["Talking", "Talking2", "Talking3", "Talking4", "Talking5", "Talking6"],
      pointing: ["Pointing"],
      nodding:  ["Nodding"],
      shaking:  ["ShakeNo"],
    },
    morphs: { mouthSmile: "mouthSmile", eyeClose: "eyeBlinkLeft", visemes: true },
    pbrMaterials: true,
  },
  // Avaturn photorealistic adult female — same shared animation file
  priya: {
    sceneFile: "Teacher_Priya.glb",
    animFile:  "animations_Avaturn.glb",
    spawnLabelHeight: 1.15,
    clips: {
      idle:     ["Idle", "Idle2", "Idle3", "Idle4"],
      thinking: ["Thinking", "Thinking2"],
      talking:  ["Talking", "Talking2", "Talking3", "Talking4", "Talking5", "Talking6"],
      pointing: ["Pointing"],
      nodding:  ["Nodding"],
      shaking:  ["ShakeNo"],
    },
    morphs: { mouthSmile: "mouthSmile", eyeClose: "eyeBlinkLeft", visemes: true },
    pbrMaterials: true,
  },
};

// Avaturn avatars (Marcus, Priya, custom) all share one Mixamo-retargeted
// animation pack at public/models/animations_Avaturn.glb.
const CUSTOM_ANIMATIONS_URL = "/models/animations_Avaturn.glb";
const CUSTOM_CONFIG: Pick<AvatarConfig, "clips" | "morphs" | "pbrMaterials"> = {
  clips: {
    idle:     ["Idle"],
    thinking: ["Thinking"],
    talking:  ["Talking", "Talking2"],
    pointing: ["Pointing"],
    nodding:  ["Nodding"],
    shaking:  ["ShakeNo"],
  },
  morphs: { mouthSmile: "mouthSmile", eyeClose: "eyeBlinkLeft", visemes: true },
  pbrMaterials: true,
};

// wawa-lipsync emits viseme strings ("viseme_aa" etc.) that double as Avaturn
// ARKit blend-shape names. The full set lives on the Head_Mesh of every
// Avaturn export. We treat this list as the morph palette to clear each frame.
const AVATURN_VISEMES = [
  "viseme_sil", "viseme_PP", "viseme_FF", "viseme_TH", "viseme_DD",
  "viseme_kk",  "viseme_CH", "viseme_SS", "viseme_nn", "viseme_RR",
  "viseme_aa",  "viseme_E",  "viseme_I",  "viseme_O",  "viseme_U",
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

interface TeacherProps {
  teacher:    TeacherAvatar;
  position?:  [number, number, number];
  scale?:     number;
  rotationY?: number;
}

export function Teacher({
  teacher,
  position  = [-1, -1.7, -3],
  scale     = 1.5,
  rotationY = 0.35,
}: TeacherProps) {
  const group               = useRef<Group>(null);
  const customTeacherGlbUrl = useAristoStore((s) => s.customTeacherGlbUrl);

  // Resolve scene + animation URLs and the avatar config in a single memo so
  // the `cfg` reference is stable across renders. Without this, every parent
  // re-render rebuilt cfg → useEffect deps that include `cfg.clips` re-fired
  // on every frame and the animation kept re-randomising itself.
  //
  // Custom avatar fallback: if the user picked "custom" but never finished
  // /create-teacher (customTeacherGlbUrl is null), fall back to the Ryan GLB
  // so the scene doesn't crash on a null model URL.
  const { sceneUrl, animUrl, cfg } = useMemo(() => {
    const useCustom = teacher === "custom" && !!customTeacherGlbUrl;
    if (useCustom) {
      return {
        sceneUrl: customTeacherGlbUrl!,
        animUrl:  CUSTOM_ANIMATIONS_URL,
        cfg: {
          ...CUSTOM_CONFIG,
          spawnLabelHeight: 1.25,
        } as Pick<AvatarConfig, "clips" | "morphs" | "pbrMaterials" | "spawnLabelHeight">,
      };
    }
    const key = teacher === "custom"
      ? "ryan"
      : (teacher as Exclude<TeacherAvatar, "custom">);
    const asset = AVATAR_ASSETS[key] ?? AVATAR_ASSETS.ryan;
    return {
      sceneUrl: `/models/${asset.sceneFile}`,
      animUrl:  `/models/${asset.animFile}`,
      cfg: asset as Pick<AvatarConfig, "clips" | "morphs" | "pbrMaterials" | "spawnLabelHeight">,
    };
  }, [teacher, customTeacherGlbUrl]);

  const { scene }                    = useGLTF(sceneUrl);
  const { animations }               = useGLTF(animUrl);
  const { actions, mixer }           = useAnimations(animations, group);

  const isLoading  = useAristoStore((s) => s.isLoading);
  const isSpeaking = useAristoStore((s) => s.isSpeaking);
  const gesture    = useAristoStore((s) => s.gesture);
  const setGesture = useAristoStore((s) => s.setGesture);
  const [animation, setAnimation]    = useState<string>(cfg.clips.idle[0]);

  // When the avatar switches, snap to the new rig's first idle clip so we don't
  // try to play an animation name that no longer exists on the new actions map.
  useEffect(() => {
    setAnimation(cfg.clips.idle[0]);
  }, [cfg]);
  const [blink, setBlink]            = useState(false);
  const [thinkingDots, setThinkingDots] = useState(".");

  // Material handling
  //  - Legacy avatars (Ryan/Sonia, pbrMaterials=false): strip everything to a
  //    flat MeshStandardMaterial. Their GLBs ship without proper PBR maps.
  //  - PBR avatars (Marcus/Priya/custom Avaturn): keep the GLB materials, but
  //    fix two known issues:
  //      a) baseColor textures must be sRGB (Three.js r152+); missing this
  //         is the most common cause of "wrong colour" on Avaturn imports.
  //      b) eye/cornea meshes pick up environment + rim lighting too strongly,
  //         which is why the eyes were rendering reddish under the previous
  //         orange rim light. Tame envMap intensity and zero any emissive.
  useEffect(() => {
    // Disable frustum culling on every mesh — SkinnedMesh bounding spheres are
    // computed at bind pose and never update with animation, so Three.js culls
    // them incorrectly as the camera orbits (eyes/head pop out, body spaghettis).
    scene.traverse((child: any) => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.frustumCulled = false;
      }
    });

    if (!cfg.pbrMaterials) {
      scene.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material = new MeshStandardMaterial({ map: child.material.map });
        }
      });
      return;
    }

    scene.traverse((child: any) => {
      if (!child.isMesh || !child.material) return;

      const applyToMaterial = (mat: any) => {
        if (mat.map && mat.map.colorSpace !== SRGBColorSpace) {
          mat.map.colorSpace = SRGBColorSpace;
          mat.map.needsUpdate = true;
        }

        const isEye = /eye|cornea|iris/i.test(child.name) || /eye|cornea|iris/i.test(mat.name ?? "");
        if (isEye) {
          if ("envMapIntensity" in mat) mat.envMapIntensity = 0.6;
          if (mat.emissive && typeof mat.emissive.setRGB === "function") {
            mat.emissive.setRGB(0, 0, 0);
          }
          if ("emissiveIntensity" in mat) mat.emissiveIntensity = 0;
          mat.needsUpdate = true;
        }
      };

      if (Array.isArray(child.material)) {
        child.material.forEach(applyToMaterial);
      } else {
        applyToMaterial(child.material);
      }
    });
  }, [scene, cfg.pbrMaterials]);

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

  // ─── Animation state machine ────────────────────────────────────────────────
  //
  // Resolution order (highest priority first):
  //   1. gesture override (pointing / nodding / shaking)
  //   2. isLoading        → thinking
  //   3. isSpeaking       → talking
  //   4. fallback         → idle
  //
  // Pointing is a "talking-while-pointing" mode — if the avatar isn't speaking,
  // we still play the pointing clip so the gesture lands; if it IS speaking,
  // pointing replaces the talking clip (the Mixamo "Pointing" clip already
  // includes torso/head motion that reads as speech).
  useEffect(() => {
    const pickRandom = (variants: string[]) =>
      variants[randInt(0, variants.length - 1)];

    if (gesture === "pointing") {
      const pool = cfg.clips.pointing ?? cfg.clips.talking;
      setAnimation(pickRandom(pool));
      return;
    }
    if (gesture === "nodding") {
      const pool = cfg.clips.nodding ?? cfg.clips.idle;
      setAnimation(pickRandom(pool));
      return;
    }
    if (gesture === "shaking") {
      const pool = cfg.clips.shaking ?? cfg.clips.idle;
      setAnimation(pickRandom(pool));
      return;
    }
    if (gesture === "explaining") {
      // Deliberate lecturing pose. Falls back to talking pool until a
      // dedicated "Lecturing"-derived clip is baked into the animation file.
      const pool = cfg.clips.talking;
      setAnimation(pickRandom(pool));
      return;
    }

    if (isLoading) {
      setAnimation(pickRandom(cfg.clips.thinking));
    } else if (isSpeaking) {
      setAnimation(pickRandom(cfg.clips.talking));
    } else {
      setAnimation(pickRandom(cfg.clips.idle));
    }
  }, [gesture, isLoading, isSpeaking, cfg.clips]);

  // Idle variant cycling — rotates every 20s so the avatar never freezes
  useEffect(() => {
    if (gesture !== "idle" || isLoading || isSpeaking || cfg.clips.idle.length <= 1) return;
    const id = setInterval(() => {
      setAnimation((cur) => {
        const variants = cfg.clips.idle;
        const idx = variants.indexOf(cur);
        return variants[(idx + 1) % variants.length];
      });
    }, 20_000);
    return () => clearInterval(id);
  }, [gesture, isLoading, isSpeaking, cfg.clips.idle]);

  // Auto-revert short one-shot gestures (nod ~2s, shake ~1.5s)
  useEffect(() => {
    if (gesture !== "nodding" && gesture !== "shaking") return;
    const ms = gesture === "nodding" ? 2000 : 1500;
    const id = setTimeout(() => setGesture("idle"), ms);
    return () => clearTimeout(id);
  }, [gesture, setGesture]);

  // Play animation with crossfade. One-shot gestures (nod/shake) play once.
  useEffect(() => {
    const action = actions[animation];
    if (!action) return;
    const isOneShot = gesture === "nodding" || gesture === "shaking";
    if (isOneShot) {
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    action.reset().fadeIn(mixer.time > 0 ? ANIMATION_FADE_TIME : 0).play();
    // Prime the mixer on first mount so bones are in the correct pose before
    // the first useFrame tick — prevents a one-frame T-pose flash at startup.
    if (mixer.time === 0) mixer.update(1 / 60);
    return () => { action.fadeOut(ANIMATION_FADE_TIME); };
  }, [animation, actions, mixer, gesture]);

  // Morph targets per frame
  //
  // For ARKit-rigged avatars (cfg.morphs.visemes === true), wawa-lipsync
  // analyses the live TTS audio and emits a viseme name per frame; we drive
  // the matching morph influence to ~`intensity` and fade all other visemes
  // back to 0 so the mouth doesn't accumulate stuck shapes.
  //
  // For legacy avatars without a viseme set, we keep the old binary
  // mouthSmile open/closed behaviour as a fallback.
  useFrame(() => {
    if (cfg.morphs.visemes) {
      const v = isSpeaking ? getCurrentViseme() : null;
      for (const name of AVATURN_VISEMES) {
        const target = (v && v.viseme === name) ? Math.min(1, v.intensity * 1.4) : 0;
        lerpMorphTarget(name, target, 0.4);
      }
      // Subtle resting smile when idle so the face doesn't read as dead
      if (cfg.morphs.mouthSmile && !isSpeaking) {
        lerpMorphTarget(cfg.morphs.mouthSmile, 0.15, 0.2);
      } else if (cfg.morphs.mouthSmile) {
        lerpMorphTarget(cfg.morphs.mouthSmile, 0, 0.3);
      }
    } else if (cfg.morphs.mouthSmile) {
      lerpMorphTarget(cfg.morphs.mouthSmile, isSpeaking ? 0.5 : 0.2, isSpeaking ? 0.1 : 0.5);
    }

    if (cfg.morphs.eyeClose) {
      lerpMorphTarget(cfg.morphs.eyeClose, blink ? 1 : 0, 0.5);
    }

    // Cycle multi-variant pools at clip end (only while in their state).
    const cycleAt = (variants: string[]) => {
      if (variants.length <= 1 || !actions[animation]) return;
      const act = actions[animation];
      if (act.time > act.getClip().duration - ANIMATION_FADE_TIME) {
        setAnimation((cur) => {
          const idx = variants.indexOf(cur);
          return variants[(idx + 1) % variants.length];
        });
      }
    };
    if (gesture === "idle") {
      if (isSpeaking)  cycleAt(cfg.clips.talking);
      if (isLoading)   cycleAt(cfg.clips.thinking);
    } else if (gesture === "explaining") {
      cycleAt(cfg.clips.talking);
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
        <Html position={[0, cfg.spawnLabelHeight, 0]}>
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

// T02 — 3D asset diet: only preload the store's default avatar ("ryan", see
// useAristoStore.ts) at module load time. Sonia/Marcus/Priya/custom are
// larger (Avaturn PBR GLBs) and previously all downloaded eagerly even
// though only one avatar renders at a time — that cost ~35 MB of dead
// weight on every cold `/learn` load. They now lazy-load through the
// existing Suspense boundary (see Experience.tsx SafeTeacher) the first
// time a user switches avatars; TeacherControls.tsx additionally warms the
// GLB cache on hover/click so the switch feels instant despite not being
// preloaded upfront.
useGLTF.preload(`/models/${AVATAR_ASSETS.ryan.sceneFile}`);
useGLTF.preload(`/models/${AVATAR_ASSETS.ryan.animFile}`);
