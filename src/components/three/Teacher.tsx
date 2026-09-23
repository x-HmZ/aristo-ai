"use client";

import "./dracoDecoder";
import { useAristoStore, DEFAULT_TEACHER, type TeacherAvatar } from "@/store/useAristoStore";
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AnimationClip, Group, LoopOnce, LoopRepeat, MathUtils, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3,
  type AnimationAction, type Bone, type SkinnedMesh,
} from "three";
import { getCurrentViseme } from "@/hooks/useTTS";
import {
  AVATURN_CLIP_SET, CANINO_CLIP_SET, CUSTOM_CLIP_SET, LEGACY_CLIP_SET, MOUNT_CLIP,
  type ClipMask, type FaceHint, type LookTarget,
} from "@/lib/avatar/animationManifest";
import {
  createDirectorState, overlayBlend, overlayWeight, phaseOf, stepDirector,
  type BasePlay, type DirectorSignals, type DirectorState, type OverlayPlay, type ReactionKind,
} from "@/lib/avatar/director";
import { createBlinkState, stepBlink, stepSmile, type BlinkState } from "@/lib/avatar/face";
import {
  EYE_RATE, EYE_WEIGHT, createGazeState, eyeAim, gazeTarget, stepSaccade, type GazeState,
} from "@/lib/avatar/gaze";
import { LOOK_RATE, LOOK_WEIGHT, aimAngles, damp, lookOffset, yawPitchOf } from "@/lib/avatar/look";
import { headBoneOf, maskTrackNames, skeletonMasks, type BoneInfo } from "@/lib/avatar/skeletonMasks";

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
   * nodding and shaking to idle. `MOUNT_CLIP` must live in `animFile`:
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
  /**
   * The clip names this avatar ships, a set from animationManifest.ts. What
   * each clip is for lives in the manifest; the director (director.ts) picks.
   */
  clips: readonly string[];
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

// Canino3d rigs (Jake, MJ): clips retargeted from the Mixamo pack behind
// animations_Avaturn.glb (CANINO_CLIP_SET). The teacher's own GLB carries the
// base clips (Idle, Talking, Thinking); the rest come from its clip pack
// (V9.2). Their "Thinking" is baked from the pack's Thinking2 (looking up,
// arms relaxed): the pack's Thinking puts a hand to the chin, which on these
// proportions lands on the chest (V9.1e). An `M` suffix is a left-right mirror.
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
    clips:  LEGACY_CLIP_SET,
    morphs: { mouthSmile: "mouthSmile", eyeClose: "eye_close" },
    pbrMaterials: false,
  },
  sonia: {
    label:     "Sonia",
    sceneFile: "Teacher_Sonia.glb",
    animFile:  "animations_Sonia.glb",
    spawnLabelHeight: 1.1,
    clips:  LEGACY_CLIP_SET,
    morphs: { mouthSmile: "mouthSmile", eyeClose: "eye_close" },
    pbrMaterials: false,
  },
  // Avaturn photorealistic adult male — Mixamo-animated, 16+ clips
  marcus: {
    label:     "Marcus",
    sceneFile: "Teacher_Marcus.glb",
    animFile:  "animations_Avaturn.glb",
    spawnLabelHeight: 1.25,
    clips:  AVATURN_CLIP_SET,
    morphs: { mouthSmile: "mouthSmile", eyeClose: ARKIT_BLINK, visemes: true },
    pbrMaterials: true,
  },
  // Avaturn photorealistic adult female — same shared animation file
  priya: {
    label:     "Priya",
    sceneFile: "Teacher_Priya.glb",
    animFile:  "animations_Avaturn.glb",
    spawnLabelHeight: 1.15,
    clips:  AVATURN_CLIP_SET,
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
    clips:  CANINO_CLIP_SET,
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
    clips:  CANINO_CLIP_SET,
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
  clips: CUSTOM_CLIP_SET,
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

// ─── Director plumbing ────────────────────────────────────────────────────────

interface EyeBone {
  bone:          Bone;
  rest:          Quaternion;
  /** The parent's bind-pose orientation, and its inverse. */
  parentBind:    Quaternion;
  parentBindInv: Quaternion;
  /** Where the eye is turned now, in the teacher's axes. */
  yaw:           number;
  pitch:         number;
}

interface LivePlay {
  seq:       number;
  action:    AnimationAction;
  startedAt: number;
  fadeIn:    number;
  fadeOutAt: number;
  endsAt:    number;
}

// The director's view of the store, read inside useFrame so nothing here
// re-renders the teacher.
function signalsOf(
  s: ReturnType<typeof useAristoStore.getState>,
  reaction: DirectorSignals["reaction"],
): DirectorSignals {
  return {
    gesture:          s.gesture,
    isLoading:        s.isLoading,
    isSpeaking:       s.isSpeaking,
    phase:            phaseOf(s.activeLesson, s.currentSegmentId),
    awaitingAnswer:   s.awaitingAnswer,
    // The condition Experience.tsx uses to show the model.
    modelShown:       !!s.activeModelUrl && s.viewMode3d,
    modelInteracting: s.modelInteracting,
    quizActive:       !!s.activeQuiz,
    quizResult:       s.quizResult,
    lessonComplete:   s.lessonComplete,
    sceneReady:       s.sceneReady,
    reaction,
  };
}

// Scratch objects for the look layer; it runs every frame.
const _qGroup = new Quaternion(), _qGroupInv = new Quaternion(), _qParent = new Quaternion();
const _qParentInv = new Quaternion(), _qOffset = new Quaternion(), _qPitch = new Quaternion();
const _vHead = new Vector3(), _vCur = new Vector3(), _vTarget = new Vector3(), _vEye = new Vector3();
const _qEye = new Quaternion(), _qEyePitch = new Quaternion(), _qEyeParent = new Quaternion();
const _X = new Vector3(1, 0, 0), _Y = new Vector3(0, 1, 0);

// ─── Component ────────────────────────────────────────────────────────────────

/** World-space points the head can look at (V9.3); the camera is always available. */
export type LookTargets = Partial<Record<"board" | "model" | "desk", readonly [number, number, number]>>;

interface TeacherProps {
  teacher:    TeacherAvatar;
  /** Where the head looks for the board, a shown model and the quiz desk. Unset: the camera. */
  lookTargets?: LookTargets;
  position?:  [number, number, number];
  scale?:     number;
  rotationY?: number;
}

export function Teacher({
  teacher,
  position  = [-1, -1.7, -3],
  scale     = 1.5,
  rotationY = 0.35,
  lookTargets,
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
  // is enough: the director reads `available` every frame, so a late pack is
  // picked up at the next clip boundary without re-running anything.
  const sceneReady  = useAristoStore((s) => s.sceneReady);
  const packActions = useRef<Record<string, AnimationAction>>({});
  const allowed     = useMemo(() => new Set<string>(cfg.clips), [cfg.clips]);
  // Clips the director may pick now: name -> duration, only names in the
  // avatar's clip set that have an action.
  const availableRef = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    for (const clip of animations) if (allowed.has(clip.name)) availableRef.current.set(clip.name, clip.duration);
  }, [animations, allowed]);
  const onPackLoad  = useCallback((clips: AnimationClip[]) => {
    const root = group.current;
    if (!root) return;
    for (const clip of clips) {
      if (!allowed.has(clip.name)) continue;
      packActions.current[clip.name] ??= mixer.clipAction(clip, root);
      availableRef.current.set(clip.name, clip.duration);
    }
  }, [mixer, allowed]);
  const getAction = useCallback(
    (name: string): AnimationAction | undefined => actions[name] ?? packActions.current[name] ?? undefined,
    [actions],
  );

  const isLoading  = useAristoStore((s) => s.isLoading);
  const isSpeaking = useAristoStore((s) => s.isSpeaking);
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

  // Thinking dots animation
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setThinkingDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [isLoading]);

  // ─── Animation director (V9.3) ──────────────────────────────────────────────
  //
  // What plays is decided by src/lib/avatar/director.ts (pure, unit-tested);
  // this component only applies its output. Layers:
  //   base    one looping full-body clip, crossfaded on change
  //   overlay a masked, once-played gesture over the base (greeting, long wait,
  //           nod, shake), blended in and out by weight
  //   look    the head turned toward camera / board / model / desk
  //
  // Each rule below was a regression once; the director's own header lists
  // the ones it now owns (no restart of a playing clip on a scenario change,
  // base always loops, variants from its own record). What stays here:
  //  - the director runs in useFrame AFTER useAnimations, so drei's
  //    mixer.update has already run this frame;
  //  - an action still fading out keeps its time when it is picked again:
  //    reset() on it snaps it to frame 0 for a frame (the V9.1d arm pop);
  //  - overlays are masked COPIES of the clip, never the base action, so a
  //    reaction can never clamp the base (the V9.2 frozen-Idle bug);
  //  - the mount clip is primed before the first frame (no T-pose flash).

  // Bones, overlay masks and the head, found once per scene by structure.
  const rig = useMemo(() => {
    const bones: BoneInfo[] = [];
    const byName = new Map<string, Bone>();
    scene.traverse((o) => {
      const b = o as Bone;
      if (!b.isBone) return;
      bones.push({ name: b.name, parent: (b.parent as Bone | null)?.isBone ? b.parent!.name : null });
      byName.set(b.name, b);
    });
    const masks = skeletonMasks(bones);
    const headName = headBoneOf(bones);
    const head = headName ? byName.get(headName) ?? null : null;
    // The head's forward axis in its own space, from the bind pose before any
    // animation: the look layer aims with it.
    let headForward: Vector3 | null = null;
    if (head) {
      scene.updateMatrixWorld(true);
      headForward = new Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new Quaternion()).invert());
    }
    const maskSet = new Set<ClipMask>(["full"]);
    if (masks.upper) maskSet.add("upper");
    if (masks.head) maskSet.add("head");
    // The eyes (V9.4): the Canino rigs' CC_Base_L_Eye / R_Eye. No clip animates
    // them, so the rest pose is the bind pose. An offset is turned about the
    // teacher's own axes, then carried into the eye's parent frame by the
    // parent's bind orientation (the eye bones' own axes are not aligned).
    const eyes: EyeBone[] = [];
    scene.updateMatrixWorld(true);
    for (const b of byName.values()) {
      if (!/^CC_Base_[LR]_Eye(_\d+)?$/.test(b.name) || !b.parent) continue;
      const parentBind = b.parent.getWorldQuaternion(new Quaternion());
      eyes.push({ bone: b, rest: b.quaternion.clone(), parentBind, parentBindInv: parentBind.clone().invert(), yaw: 0, pitch: 0 });
    }
    return { masks, maskSet, head, headForward, eyes };
  }, [scene]);

  // Masked copies of clips, by "<clip>@<mask>". three has no bone masks, so an
  // upper-body gesture is the clip with only the tracks of those bones.
  const maskedActions = useRef(new Map<string, AnimationAction>());
  const overlayAction = useCallback((name: string, mask: ClipMask): AnimationAction | undefined => {
    const key = `${name}@${mask}`;
    const cached = maskedActions.current.get(key);
    if (cached) return cached;
    const bones = mask === "full" ? undefined : rig.masks[mask];
    const source = getAction(name)?.getClip();
    const root = group.current;
    if (!bones || !source || !root) return undefined;
    const keep = new Set(maskTrackNames(source.tracks.map((t) => t.name), bones));
    const tracks = source.tracks.filter((t) => keep.has(t.name)).map((t) => t.clone());
    if (!tracks.length) return undefined;
    const action = mixer.clipAction(new AnimationClip(key, source.duration, tracks, source.blendMode), root);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    maskedActions.current.set(key, action);
    return action;
  }, [getAction, mixer, rig]);

  // A nod or a shake, latched from the store. A lesson sets "nodding" and then
  // the next segment's gesture in the same tick, so the director sampling
  // `gesture` once a frame would nearly always miss it.
  const reactionRef     = useRef<{ kind: ReactionKind; id: number } | null>(null);
  const reactionCounter = useRef(0);
  useEffect(() => useAristoStore.subscribe((s, prev) => {
    if (s.gesture !== prev.gesture && (s.gesture === "nodding" || s.gesture === "shaking")) {
      reactionRef.current = { kind: s.gesture, id: ++reactionCounter.current };
    }
  }), []);

  // The teacher is keyed by avatar in SafeTeacher, so a switch is a new mount
  // and a new director.
  const directorRef = useRef<DirectorState | null>(null);
  directorRef.current ??= createDirectorState(MOUNT_CLIP, signalsOf(useAristoStore.getState(), null));
  const clockRef       = useRef(0);
  const appliedBase    = useRef({ seq: 0, clip: MOUNT_CLIP as string });
  const appliedOverlay = useRef(0);
  const livePlays      = useRef<LivePlay[]>([]);
  const lookRef        = useRef({ yaw: 0, pitch: 0 });
  const headRef        = useRef({ clip: new Quaternion(), written: new Quaternion(), wrote: false });
  const lookTargetsRef = useRef(lookTargets);
  lookTargetsRef.current = lookTargets;

  // Face (V9.4): the director's hint, the smile it drives, the blink and the eyes' idle life.
  const faceRef = useRef<{ hint: FaceHint; smile: number; blink: BlinkState; gaze: GazeState } | null>(null);
  faceRef.current ??= {
    hint: "neutral", smile: 0.15,
    blink: createBlinkState(0, Math.random), gaze: createGazeState(0, Math.random),
  };
  // Every mesh with morph targets, once: the per-frame drive must not walk the scene.
  const morphMeshes = useMemo(() => {
    const list: SkinnedMesh[] = [];
    scene.traverse((o) => {
      const m = o as SkinnedMesh;
      if (m.isSkinnedMesh && m.morphTargetDictionary && m.morphTargetInfluences) list.push(m);
    });
    return list;
  }, [scene]);

  // Prime the mount clip so the bones are posed before the first frame.
  useLayoutEffect(() => {
    const action = getAction(MOUNT_CLIP);
    if (!action) return;
    action.setLoop(LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.reset().play();
    if (mixer.time === 0) mixer.update(1 / 60);
  }, [getAction, mixer]);

  const applyBase = (base: BasePlay) => {
    if (base.seq === appliedBase.current.seq) return;
    appliedBase.current.seq = base.seq;
    const next = getAction(base.clip);
    const prev = getAction(appliedBase.current.clip);
    if (!next || next === prev) return;
    prev?.fadeOut(base.fade);
    next.setLoop(LoopRepeat, Infinity);
    next.clampWhenFinished = false;
    next.setEffectiveTimeScale(base.timeScale);
    if (!next.isRunning()) next.reset();
    next.fadeIn(mixer.time > 0 ? base.fade : 0).play();
    appliedBase.current.clip = base.clip;
  };

  const applyOverlay = (overlay: OverlayPlay | null, now: number) => {
    const live = livePlays.current;
    if (overlay && overlay.seq !== appliedOverlay.current) {
      appliedOverlay.current = overlay.seq;
      // An older play still live fades out over the new one's fade-in.
      for (const p of live) {
        p.fadeOutAt = Math.min(p.fadeOutAt, now);
        p.endsAt = Math.min(p.endsAt, now + (overlay.fadeIn || 0.2));
      }
      const action = overlay.clip ? overlayAction(overlay.clip, overlay.mask) : undefined;
      if (action) {
        const same = live.findIndex((p) => p.action === action);
        if (same >= 0) live.splice(same, 1);
        action.reset();
        action.setEffectiveTimeScale(overlay.timeScale);
        action.setEffectiveWeight(0);
        action.play();
        live.push({
          seq: overlay.seq, action, startedAt: overlay.startedAt, fadeIn: overlay.fadeIn,
          fadeOutAt: overlay.fadeOutAt, endsAt: overlay.endsAt,
        });
      }
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      // The director can pull an overlay's end forward (the base moved on).
      if (overlay && p.seq === overlay.seq) { p.fadeOutAt = overlay.fadeOutAt; p.endsAt = overlay.endsAt; }
      if (now >= p.endsAt) { p.action.stop(); live.splice(i, 1); continue; }
      // Not fadeIn/fadeOut: they scale the weight linearly, which through the
      // dominance ratio ramps far too fast (a pop).
      p.action.setEffectiveWeight(overlayWeight(overlayBlend(p, now)));
    }
  };

  // The world point a look target names: the scene's anchor, or the camera.
  const worldTarget = (target: LookTarget, camera: Vector3, out: Vector3) => {
    const t = lookTargetsRef.current;
    const world = target === "board" || target === "model" || target === "desk" ? t?.[target] : undefined;
    if (world) out.fromArray(world); else out.copy(camera);
  };

  // Turns the eyes toward `target` inside a small clamp, on top of the head,
  // plus the saccades and drift (gaze.ts). Runs after applyLook so the head's
  // final pose is what the eyes compensate for.
  const applyEyes = (target: LookTarget, camera: Vector3, now: number, delta: number) => {
    const { eyes } = rig;
    const face = faceRef.current!;
    face.gaze = stepSaccade(face.gaze, now, Math.random);
    if (!eyes.length) return;
    if (target !== "none") worldTarget(target, camera, _vTarget);
    const thinking = face.hint === "thinking";
    for (const e of eyes) {
      let aim = null;
      if (target !== "none") {
        e.bone.parent!.updateWorldMatrix(true, false);
        _vEye.copy(_vTarget);
        e.bone.parent!.worldToLocal(_vEye);
        _vEye.sub(e.bone.position).applyQuaternion(e.parentBind);
        aim = eyeAim(_vEye);
      }
      const goal = gazeTarget(aim, EYE_WEIGHT[target], face.gaze, now, thinking);
      e.yaw   = damp(e.yaw,   goal.yaw,   EYE_RATE, delta);
      e.pitch = damp(e.pitch, goal.pitch, EYE_RATE, delta);
      // Yaw about +Y, pitch up about -X, in the teacher's axes at bind; then
      // into the parent's frame.
      _qEye.setFromAxisAngle(_Y, e.yaw).multiply(_qEyePitch.setFromAxisAngle(_X, -e.pitch));
      _qEye.premultiply(e.parentBindInv).multiply(_qEyeParent.copy(e.parentBind));
      e.bone.quaternion.copy(_qEye).multiply(e.rest);
    }
  };

  // Turns the head toward `target` on top of the clip's own head motion.
  const applyLook = (target: LookTarget, camera: Vector3, delta: number) => {
    const { head, headForward } = rig;
    const root = group.current;
    if (!head || !headForward || !root || !head.parent) return;
    const hs = headRef.current;
    // If the mixer did not write the head this frame (value unchanged, or the
    // track was dropped as rest by the V9.2 diet), head.quaternion is still
    // what we wrote: use the stored clip value, or the offset compounds.
    if (!(hs.wrote && head.quaternion.equals(hs.written))) hs.clip.copy(head.quaternion);

    root.updateWorldMatrix(true, false);
    head.parent.updateWorldMatrix(true, false);
    root.getWorldQuaternion(_qGroup);
    _qGroupInv.copy(_qGroup).invert();
    head.parent.getWorldQuaternion(_qParent);
    _vHead.copy(head.position).applyMatrix4(head.parent.matrixWorld);

    // The head's forward and the target, in the teacher's own space.
    _vCur.copy(headForward).applyQuaternion(hs.clip).applyQuaternion(_qParent).applyQuaternion(_qGroupInv);
    worldTarget(target, camera, _vTarget);
    _vTarget.sub(_vHead).applyQuaternion(_qGroupInv);

    const off = lookOffset(yawPitchOf(_vCur), aimAngles(_vTarget), LOOK_WEIGHT[target]);
    const look = lookRef.current;
    look.yaw   = damp(look.yaw,   off.yaw,   LOOK_RATE, delta);
    look.pitch = damp(look.pitch, off.pitch, LOOK_RATE, delta);

    // Yaw about +Y, then pitch about the yawed +X (up is negative about +X),
    // in the teacher's space; then into the head's parent space.
    _qOffset.setFromAxisAngle(_Y, look.yaw).multiply(_qPitch.setFromAxisAngle(_X, -look.pitch));
    _qOffset.premultiply(_qGroup).multiply(_qGroupInv);
    _qOffset.premultiply(_qParentInv.copy(_qParent).invert()).multiply(_qParent);
    head.quaternion.copy(_qOffset).multiply(hs.clip);
    hs.written.copy(head.quaternion);
    hs.wrote = true;
  };

  useFrame((state, delta) => {
    const now = (clockRef.current += delta);
    const store = useAristoStore.getState();
    const step = stepDirector(directorRef.current!, {
      now,
      signals:   signalsOf(store, reactionRef.current),
      available: availableRef.current,
      masks:     rig.maskSet,
      rng:       Math.random,
    });
    directorRef.current = step.state;
    const out = step.output;

    applyBase(out.base);
    applyOverlay(out.overlay, now);
    // The old auto-revert: hand a finished nod or shake back to the store.
    if (out.release && store.gesture === out.release) store.setGesture("idle");
    applyLook(out.look, state.camera.position, delta);
    faceRef.current!.hint = out.face;
    applyEyes(out.look, state.camera.position, now, delta);
  });

  // Morph targets per frame
  //
  // For ARKit-rigged avatars (cfg.morphs.visemes === true), the timeline (or
  // wawa-lipsync's FFT guess) gives a viseme name per frame; we drive the
  // matching morph influence to ~`intensity` and fade all other visemes back
  // to 0 so the mouth doesn't accumulate stuck shapes. The director's face
  // hint (V9.4) sets the smile (face.ts): a real smile at rest, a small lift
  // while speaking so it never fights the visemes.
  //
  // For legacy avatars without a viseme set, we keep the old binary
  // mouthSmile open/closed behaviour as a fallback.
  useFrame((_, delta) => {
    const face = faceRef.current!;
    if (cfg.morphs.visemes) {
      const v = isSpeaking ? getCurrentViseme() : null;
      for (const name of AVATURN_VISEMES) {
        const target = (v && v.viseme === name) ? Math.min(1, v.intensity * 1.4) : 0;
        lerpMorphTarget(name, target, 0.4);
      }
      face.smile = stepSmile(face.smile, face.hint, isSpeaking, delta);
      if (cfg.morphs.mouthSmile) lerpMorphTarget(cfg.morphs.mouthSmile, face.smile, 1);
    } else if (cfg.morphs.mouthSmile) {
      lerpMorphTarget(cfg.morphs.mouthSmile, isSpeaking ? 0.5 : 0.2, isSpeaking ? 0.1 : 0.5);
    }

    if (cfg.morphs.eyeClose) {
      const blink = stepBlink(face.blink, clockRef.current, Math.random);
      face.blink = blink.state;
      const lids = typeof cfg.morphs.eyeClose === "string" ? [cfg.morphs.eyeClose] : cfg.morphs.eyeClose;
      for (const lid of lids) lerpMorphTarget(lid, blink.closure, 1);
    }
  });

  const lerpMorphTarget = (target: string, value: number, speed: number) => {
    for (const mesh of morphMeshes) {
      const index = mesh.morphTargetDictionary![target];
      if (index === undefined || mesh.morphTargetInfluences![index] === undefined) continue;
      mesh.morphTargetInfluences![index] = MathUtils.lerp(mesh.morphTargetInfluences![index], value, speed);
    }
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
