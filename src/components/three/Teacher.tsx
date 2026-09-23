"use client";

import "./dracoDecoder";
import { useAristoStore, DEFAULT_TEACHER, type TeacherAvatar } from "@/store/useAristoStore";
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Group, LoopOnce, LoopRepeat, MathUtils, MeshStandardMaterial, SRGBColorSpace,
  type AnimationAction, type AnimationClip,
} from "three";
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
//   CC4 / Avaturn (ARKit standard):    mouthSmile, eyeBlinkLeft + eyeBlinkRight
//   CGTrader Auto-Rig Pro:             varies — inspect in Blender and update morphs
//
// ── pbrMaterials flag ────────────────────────────────────────────────────────
//   false → strip all material props to a flat MeshStandardMaterial (safe
//           fallback for legacy / stylised GLBs that have material issues).
//   true  → trust the GLB's PBR materials as-is (required for CC4, Avaturn,
//            and any character with normal/roughness/specular maps — stripping
//            them makes the character look flat and washed-out).

interface AvatarConfig {
  label:            string;   // shown in the teacher pickers
  sceneFile:        string;
  animFile:         string;
  /**
   * Animation-only GLBs on the same skeleton, fetched once the scene is
   * ready (V9.2) so they never compete with the first load. Their clips bind
   * to the teacher's bones by name. A clip named in `clips` that lives in a
   * pack is skipped until the pack arrives: pointing falls back to talking,
   * nodding and shaking to idle. `clips.idle[0]` must live in `animFile`:
   * it is the clip a teacher mounts on.
   */
  clipPacks?:       readonly string[];
  spawnLabelHeight: number;
  /**
   * World-space height multiplier applied in Experience.tsx (SafeTeacher's
   * `scale` prop). The Canino rigs are normalised in Blender to Marcus's
   * TARGET_HEIGHT (1.859 m, see v9_export.py) regardless of the character's
   * real-world height, so this is where each teacher gets their own stature
   * back: `standScale * 1.859` should equal the real height. Falls back to
   * the legacy flat 1.5 (Ryan/Sonia/Marcus/Priya/custom) when unset — those
   * rigs were never measured against real-world furniture (V9.2b).
   */
  standScale?:      number;
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
    /**
     * Blend shape(s) closed on each blink. ARKit rigs split the blink per eye
     * (eyeBlinkLeft / eyeBlinkRight); naming only one of them winks.
     */
    eyeClose?:   string | readonly string[];
    /**
     * If true, the rig has the full Avaturn ARKit viseme set
     * (viseme_aa, viseme_E, viseme_O, …). Teacher.tsx will drive these
     * directly from wawa-lipsync per frame instead of toggling mouthSmile.
     */
    visemes?:    boolean;
  };
  pbrMaterials: boolean;
  /**
   * Required attribution for a third-party model (CC BY and similar).
   * <AvatarCredit> renders it wherever this avatar is on screen, so an avatar
   * whose licence demands credit cannot ship without it.
   */
  credit?: AvatarCreditInfo;
}

export interface AvatarCreditInfo {
  title:      string;
  author:     string;
  sourceUrl:  string;
  authorUrl:  string;
  license:    string;
  licenseUrl: string;
  /** CC BY 4.0 section 3(a)(1)(B): say that the work was changed. */
  modified:   boolean;
}

// Both Canino3d teachers are retargeted, re-clothed and re-materialed in
// .claude/eval/2026-09-18-v9-bakeoff/scripts, so `modified` is true.
const CANINO3D = {
  author:     "Canino3d",
  authorUrl:  "https://sketchfab.com/Canino3d",
  license:    "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  modified:   true,
} as const;

// Canino3d rigs: clips retargeted from the Mixamo pack behind
// animations_Avaturn.glb. The teacher's own GLB carries the base clips (Idle,
// Talking, Thinking); the rest come from its clip pack (V9.2). Their
// "Thinking" is baked from the pack's Thinking2 (looking up, arms relaxed):
// the pack's Thinking puts a hand to the chin, which on these proportions
// lands on the chest (V9.1e). An `M` suffix is a left-right mirror. The pack
// also carries Idle3 (a restless fidget), Talking6 and Talking6M (a wave),
// kept out of these pools for the V9.3 director's long-wait and greeting rows.
const CANINO_CLIPS: AvatarConfig["clips"] = {
  idle:     ["Idle", "Idle2", "Idle4"],
  thinking: ["Thinking", "ThinkingM"],
  talking:  ["Talking", "Talking2", "Talking2M", "Talking3", "Talking3M", "Talking4"],
  pointing: ["Pointing"],
  nodding:  ["Nodding"],
  shaking:  ["ShakeNo"],
};
const ARKIT_BLINK = ["eyeBlinkLeft", "eyeBlinkRight"] as const;

// Exported so TeacherControls.tsx can preload an avatar's GLBs on
// hover/select (see T02 — 3D asset diet: only the default avatar is preloaded
// at module scope now; everything else lazy-loads via Suspense, optionally
// warmed early by the switcher UI).
export const AVATAR_ASSETS: Record<Exclude<TeacherAvatar, "custom">, AvatarConfig> = {
  ryan: {
    label:     "Ryan",
    sceneFile: "Teacher_Ryan.glb",
    animFile:  "animations_Ryan.glb",
    spawnLabelHeight: 1.2,
    clips:  { idle: ["Idle"], thinking: ["Thinking"], talking: ["Talking", "Talking2"] },
    morphs: { mouthSmile: "mouthSmile", eyeClose: "eye_close" },
    pbrMaterials: false,
  },
  sonia: {
    label:     "Sonia",
    sceneFile: "Teacher_Sonia.glb",
    animFile:  "animations_Sonia.glb",
    spawnLabelHeight: 1.1,
    clips:  { idle: ["Idle"], thinking: ["Thinking"], talking: ["Talking", "Talking2"] },
    morphs: { mouthSmile: "mouthSmile", eyeClose: "eye_close" },
    pbrMaterials: false,
  },
  // Avaturn photorealistic adult male — Mixamo-animated, 16+ clips
  marcus: {
    label:     "Marcus",
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
    morphs: { mouthSmile: "mouthSmile", eyeClose: ARKIT_BLINK, visemes: true },
    pbrMaterials: true,
  },
  // Avaturn photorealistic adult female — same shared animation file
  priya: {
    label:     "Priya",
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
    morphs: { mouthSmile: "mouthSmile", eyeClose: ARKIT_BLINK, visemes: true },
    pbrMaterials: true,
  },
  // Stylised Character Creator 4 rigs (V9). The 15 visemes are baked shape
  // keys, so the lipsync path drives them unchanged; normalised to Marcus's
  // height, so the lesson camera and placement are unchanged too.
  jake: {
    label:     "Jake",
    sceneFile: "Teacher_Jake.glb",
    animFile:  "Teacher_Jake.glb",
    clipPacks: ["Teacher_Jake_clips.glb"],
    // Local units (pre-scale): was 1.4, tuned for the old flat scale=1.5.
    // Re-tuned in world space for the new standScale (V9.2b).
    spawnLabelHeight: 2.1,
    // Real height (1.78 m / 1.859 m TARGET_HEIGHT) read as a dwarf next to
    // the old 2.79 m giant (Hmz, 2026-09-23) — halfway between the two was
    // 1.2288 (2.28 m), then Hmz asked for 10-15% taller still: 1.2288 *
    // 1.125 = 1.3824, height 2.57 m.
    standScale: 1.3824,
    clips:  CANINO_CLIPS,
    morphs: { mouthSmile: "mouthSmile", eyeClose: ARKIT_BLINK, visemes: true },
    pbrMaterials: true,
    credit: {
      title:     "Free Cartoon Game Man Character (Rigged)",
      sourceUrl: "https://sketchfab.com/3d-models/free-cartoon-game-man-character-rigged-a69c8962f4a14ea89bf623d716a81411",
      ...CANINO3D,
    },
  },
  mj: {
    label:     "MJ",
    sceneFile: "Teacher_MJ.glb",
    animFile:  "Teacher_MJ.glb",
    clipPacks: ["Teacher_MJ_clips.glb"],
    // See Jake's comment — same re-tune for the new standScale (V9.2b).
    spawnLabelHeight: 2.1,
    // Real height (1.68 m) read as a dwarf next to the old 2.79 m giant
    // (Hmz, 2026-09-23) — halfway between the two was 1.2019 (2.23 m), then
    // Hmz asked for 10-15% taller still: 1.2019 * 1.125 = 1.3521, height
    // 2.51 m. She was normalised to Jake's rig height
    // (v9_export.TARGET_HEIGHT), so this is where she gets her own stature
    // back, per the app scale, not the GLB.
    standScale: 1.3521,
    clips:  CANINO_CLIPS,
    morphs: { mouthSmile: "mouthSmile", eyeClose: ARKIT_BLINK, visemes: true },
    pbrMaterials: true,
    credit: {
      title:     "Free Stylized Cartoon Girl Rigged Character",
      sourceUrl: "https://sketchfab.com/3d-models/free-stylized-cartoon-girl-rigged-character-dcaa822909ae4e04ad7eb85bc371a8c4",
      ...CANINO3D,
    },
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
  morphs: { mouthSmile: "mouthSmile", eyeClose: ARKIT_BLINK, visemes: true },
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

// ─── Clip packs ───────────────────────────────────────────────────────────────

// Loads one animation-only GLB and hands its clips up. It renders nothing and
// suspends only its own Suspense boundary, so the teacher keeps playing while
// the pack downloads.
function ClipPack({ url, onLoad }: { url: string; onLoad: (clips: AnimationClip[]) => void }) {
  const { animations } = useGLTF(url);
  useEffect(() => { onLoad(animations); }, [animations, onLoad]);
  return null;
}

// A pack that fails to load must not reach SafeTeacher's boundary, which
// would swap the whole teacher out. The base clips carry on without it.
class ClipPackBoundary extends Component<{ url: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.warn(`[Teacher] clip pack ${this.props.url} failed to load:`, error.message);
    // useGLTF's cache keeps the rejection for the life of the tab; clear it
    // so the next mount of this teacher fetches again instead of rethrowing.
    useGLTF.clear(this.props.url);
  }
  render() { return this.state.failed ? null : this.props.children; }
}

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
        } as Pick<AvatarConfig, "clips" | "morphs" | "pbrMaterials" | "spawnLabelHeight" | "clipPacks">,
      };
    }
    const key = teacher === "custom"
      ? "ryan"
      : (teacher as Exclude<TeacherAvatar, "custom">);
    const asset = AVATAR_ASSETS[key] ?? AVATAR_ASSETS.ryan;
    return {
      sceneUrl: `/models/${asset.sceneFile}`,
      animUrl:  `/models/${asset.animFile}`,
      cfg: asset as Pick<AvatarConfig, "clips" | "morphs" | "pbrMaterials" | "spawnLabelHeight" | "clipPacks">,
    };
  }, [teacher, customTeacherGlbUrl]);

  const { scene: cachedScene }       = useGLTF(sceneUrl);
  const { animations }               = useGLTF(animUrl);

  // Clone the cached GLTF scene rather than mounting it directly.
  //
  // useGLTF caches by URL and hands back ONE shared object graph. Mounting it
  // with <primitive> meant every Teacher instance drove the *same* bones, and
  // this component also mutates that graph (materials below, morph influences
  // per frame), so those edits leaked into the cache. Two concrete bugs came
  // out of that, both reported 2026-09-09:
  //
  //   • T-pose on every avatar except the default. Marcus and Priya share
  //     animations_Avaturn.glb, so useGLTF returns the SAME animations array
  //     for both; drei memoises actions on that array, so switching between
  //     them never rebuilt the actions and they stayed bound to the previous
  //     rig's bones. The new avatar got driven by nothing.
  //   • Marcus slowly twisting out of position when left idle. A mixer from a
  //     previous mount was still animating those shared bones alongside the
  //     live one — two mixers crossfading the same Hips every 20s idle cycle,
  //     which reads as small weird turns accumulating over minutes. (It is not
  //     the clips: measured, their root yaw stays within ±6° and translation
  //     is ~0, so no clip turns him around.)
  //
  // Cloning gives each mount its own skeleton, so a stale mixer can only
  // animate a detached graph, and material/morph edits stay local.
  const scene = useMemo(() => SkeletonUtils.clone(cachedScene), [cachedScene]);

  const { actions, mixer }           = useAnimations(animations, group);

  // Belt-and-braces: stop a mixer's actions when this rig unmounts so it is not
  // left running against the detached clone.
  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);

  // Clip packs (V9.2). Their actions go on the SAME mixer and root, but not
  // through useAnimations: drei stops every action whenever its clip list
  // changes, so appending would snap the playing clip back to frame 0. A ref
  // is enough, because pools are resolved at pick time (see `loaded`) and a
  // late pack must not re-run the state machine mid-sentence.
  const sceneReady  = useAristoStore((s) => s.sceneReady);
  const packActions = useRef<Record<string, AnimationAction>>({});
  const onPackLoad  = useCallback((clips: AnimationClip[]) => {
    const root = group.current;
    if (!root) return;
    for (const clip of clips) {
      packActions.current[clip.name] ??= mixer.clipAction(clip, root);
    }
  }, [mixer]);
  const getAction = useCallback(
    (name: string): AnimationAction | undefined => actions[name] ?? packActions.current[name] ?? undefined,
    [actions],
  );
  // The clips of a pool that can play now; `fallback` when none of them can.
  const loaded = useCallback((pool: string[] | undefined, fallback: string[] = []) => {
    const ready = (pool ?? []).filter((n) => getAction(n));
    return ready.length ? ready : fallback.filter((n) => getAction(n));
  }, [getAction]);

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
    // Only clips that can play now: a pack clip before its pack arrives
    // would stop the current clip and leave the bind pose.
    const pickRandom = (pool: string[] | undefined, fallback?: string[]) => {
      const variants = loaded(pool, fallback);
      if (variants.length) setAnimation(variants[randInt(0, variants.length - 1)]);
    };

    if (gesture === "pointing") {
      pickRandom(cfg.clips.pointing, cfg.clips.talking);
      return;
    }
    if (gesture === "nodding") {
      pickRandom(cfg.clips.nodding, cfg.clips.idle);
      return;
    }
    if (gesture === "shaking") {
      pickRandom(cfg.clips.shaking, cfg.clips.idle);
      return;
    }
    if (gesture === "explaining") {
      // Deliberate lecturing pose. Falls back to talking pool until a
      // dedicated "Lecturing"-derived clip is baked into the animation file.
      pickRandom(cfg.clips.talking);
      return;
    }

    if (isLoading) {
      pickRandom(cfg.clips.thinking);
    } else if (isSpeaking) {
      pickRandom(cfg.clips.talking);
    } else {
      pickRandom(cfg.clips.idle);
    }
  }, [gesture, isLoading, isSpeaking, cfg.clips, loaded]);

  // Idle variant cycling — rotates every 20s so the avatar never freezes
  useEffect(() => {
    if (gesture !== "idle" || isLoading || isSpeaking || cfg.clips.idle.length <= 1) return;
    const id = setInterval(() => {
      setAnimation((cur) => {
        const variants = loaded(cfg.clips.idle);
        if (!variants.length) return cur;
        const idx = variants.indexOf(cur);
        return variants[(idx + 1) % variants.length];
      });
    }, 20_000);
    return () => clearInterval(id);
  }, [gesture, isLoading, isSpeaking, cfg.clips.idle, loaded]);

  // Auto-revert one-shot gestures. When the clip is playing, revert as it
  // ends, less the crossfade, so the fade covers its tail: the fixed 1.5 s cut
  // the 3.1 s ShakeNo after its first turn (V9.1e) -- on every avatar with the
  // clip, custom Avaturn teachers included. Until the clip starts, or on an
  // avatar without one (the nod then keeps Idle), the fixed timings stand.
  useEffect(() => {
    if (gesture !== "nodding" && gesture !== "shaking") return;
    const pool = gesture === "nodding" ? cfg.clips.nodding : cfg.clips.shaking;
    const clip = pool?.includes(animation) ? getAction(animation)?.getClip() : undefined;
    const ms = clip
      ? Math.max(0, clip.duration - ANIMATION_FADE_TIME) * 1000
      : gesture === "nodding" ? 2000 : 1500;
    const id = setTimeout(() => setGesture("idle"), ms);
    return () => clearTimeout(id);
  }, [gesture, animation, getAction, cfg.clips, setGesture]);

  // The gesture is read through a ref so the play effect below runs only when
  // the clip changes. With `gesture` in its deps, a gesture change re-ran it
  // for the clip still playing and `reset()` snapped that clip to frame 0 for
  // one frame before the crossfade: a 33 deg pop of the arm on Talking ->
  // Pointing (V9.1d). It also made a nod that falls back to Idle (every
  // avatar without a Nodding clip) turn Idle into a clamped one-shot for good.
  const gestureRef = useRef(gesture);
  useEffect(() => { gestureRef.current = gesture; }, [gesture]);

  // Play animation with crossfade. One-shot gestures (nod/shake) play once.
  useEffect(() => {
    const action = getAction(animation);
    if (!action) return;
    // One-shot only when the clip IS the gesture's clip. A nod that fell back
    // to Idle (no Nodding yet, clip pack still loading) must keep Idle
    // looping: clamped, it froze on its last frame until something else
    // changed the clip.
    const g = gestureRef.current;
    const oneShotPool = g === "nodding" ? cfg.clips.nodding : g === "shaking" ? cfg.clips.shaking : undefined;
    const isOneShot = !!oneShotPool?.includes(animation);
    if (isOneShot) {
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    }
    action.reset().fadeIn(mixer.time > 0 ? ANIMATION_FADE_TIME : 0).play();
    // Prime the mixer on first mount so bones are in the correct pose before
    // the first useFrame tick — prevents a one-frame T-pose flash at startup.
    if (mixer.time === 0) mixer.update(1 / 60);
    return () => { action.fadeOut(ANIMATION_FADE_TIME); };
  }, [animation, getAction, mixer, cfg.clips.nodding, cfg.clips.shaking]);

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
      const lids = typeof cfg.morphs.eyeClose === "string" ? [cfg.morphs.eyeClose] : cfg.morphs.eyeClose;
      for (const lid of lids) lerpMorphTarget(lid, blink ? 1 : 0, 0.5);
    }

    // Cycle multi-variant pools at clip end (only while in their state).
    const cycleAt = (pool: string[]) => {
      const variants = loaded(pool);
      const act = getAction(animation);
      if (variants.length <= 1 || !act) return;
      // From the rendered clip, not the updater's `cur`: this runs every
      // frame of the fade window, and several frames can pass before React
      // re-renders, so stepping from `cur` skipped variants.
      if (act.time > act.getClip().duration - ANIMATION_FADE_TIME) {
        setAnimation(variants[(variants.indexOf(animation) + 1) % variants.length]);
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
      {sceneReady && cfg.clipPacks?.map((file) => (
        <ClipPackBoundary key={file} url={`/models/${file}`}>
          <Suspense fallback={null}>
            <ClipPack url={`/models/${file}`} onLoad={onPackLoad} />
          </Suspense>
        </ClipPackBoundary>
      ))}
    </group>
  );
}

// T02 — 3D asset diet: only preload the store's default avatar (DEFAULT_TEACHER
// in useAristoStore.ts). The others are larger (Avaturn PBR GLBs) and previously
// all downloaded eagerly even though only one avatar renders at a time — that
// cost ~35 MB of dead weight on every cold `/learn` load. They now lazy-load
// through the existing Suspense boundary (see Experience.tsx SafeTeacher) the
// first time a user switches avatars; TeacherControls.tsx additionally warms the
// GLB cache on hover/click so the switch feels instant despite not being
// preloaded upfront.
//
// This is a function rather than a module-scope side effect because importing
// this module does NOT imply the default is the avatar that will render: /demo
// picks its own (DEMO_TEACHER) yet still pulls Teacher.tsx into its graph, and
// an unconditional preload once cost that page 2.5 MB it never used — on the
// funnel page, where payload matters most. Callers that know the default is
// the avatar (i.e. /learn) invoke this on mount.
//
// Note the `import "./dracoDecoder"` at the top of this file is still a
// module-scope side effect, and must stay one: it sets the shared decoder path
// before any useGLTF call resolves.
export function preloadDefaultAvatar(): void {
  useGLTF.preload(`/models/${AVATAR_ASSETS[DEFAULT_TEACHER].sceneFile}`);
  useGLTF.preload(`/models/${AVATAR_ASSETS[DEFAULT_TEACHER].animFile}`);
}
