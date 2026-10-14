"use client";

import { useAristoStore, DEFAULT_TEACHER, type TeacherAvatar } from "@/store/useAristoStore";
import type { ModelAnnotation } from "@/lib/agents/teaching";
import { Environment, Float, Grid, Html, useTexture } from "@react-three/drei";
import { Component, Suspense, useEffect, useRef, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { Mesh, MeshBasicMaterial, Plane, SRGBColorSpace, Vector3 } from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { GeneratedModel } from "./GeneratedModel";
import { Teacher, AVATAR_ASSETS, type LookTargets } from "./Teacher";
import { Classroom, roomDisplay, type RoomDisplay } from "./Classroom";
import { BRAND_HEX } from "@/lib/brandColors";
import { Box, Image as ImageIcon, Maximize2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraController } from "./CameraController";
import { LensShift } from "./LensShift";
import { DeskQuiz, PAPER_ANCHOR } from "./DeskQuiz";
import { RendererConfig, SceneLights } from "./SceneBits";

// Re-exported for existing importers; they live in SceneBits so the landing can use them without this module (and
// Classroom's preload of the room) in its stage chunk.
export { RendererConfig, SceneLights };

// In-scene controls (the image and model toolbars): the system's secondary
// button and a status chip, inside `.theme-ink`. Classes only; the <Html>
// positions and every scene constant are unchanged.
const SCENE_BUTTON = "whitespace-nowrap border border-line shadow-e1";
const SCENE_CHIP =
  "pointer-events-none flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-bg/[0.86] px-3 py-1.5 text-xs font-medium text-body backdrop-blur-md";


// Shared anchor for the image panel and the 3D model.
// Image plane is IMG_SIZE × IMG_SIZE (≈1.46), so shifting the anchor by
// half-image (~0.73) left and up moves the plane towards the avatar's head
// so "pointing" gestures actually land on the diagram instead of empty air.
const SCENE_X = 0.37;   // was 1.1 — half-width left
const SCENE_Y = 0.18;   // was 0.33, then -0.035 for the 2.2-2.3 m halfway pass — re-tuned again for standScale 10-15% taller still (V9.2b, Hmz)
const SCENE_Z = -3;

// 3D model anchor. This used to sit at the original chest-height spot
// (1.1, -0.4), on the reasoning that a model at head height would crowd the
// avatar's face. Seen side by side that was the wrong trade: the image plane
// was moved up and left so pointing gestures land on it, and the model was
// left behind at the old anchor, so it spawned low and to the right where the
// lesson panel clips it. They share the anchor again (Hmz, 2026-09-10).
const MODEL_X = SCENE_X;
const MODEL_Y = SCENE_Y;
const MODEL_Z = SCENE_Z;

// Where the teacher stands: beside the display, not in front of it. At x -1 the teacher hid the screen's left
// quarter from the camera; -1.6 keeps the whole screen clear (V10 placement, 2026-10-15).
const TEACHER_X = -1.6;

// Legacy rigs (Ryan/Sonia/Marcus/Priya/custom Avaturn) never got measured
// against the classroom furniture — only Jake and MJ, the shipped roster,
// have a `standScale`. Keep the old flat 1.5 for everything else (V9.2b).
const LEGACY_STAND_SCALE = 1.5;
function standScaleFor(teacher: TeacherAvatar): number {
  if (teacher === "custom") return LEGACY_STAND_SCALE;
  return AVATAR_ASSETS[teacher]?.standScale ?? LEGACY_STAND_SCALE;
}

// Scene-material and light colours below are 3D constants, not brand tokens: none
// of them mirrors an --aristo-* value (the floor grid and lights are warm
// neutrals tuned against the room bake), so they stay literal on purpose.
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


// Teaching image rendered as a crisp WebGL plane on the room's display — avoids CSS-transform blurriness.
// SRGBColorSpace fixes the black-texture bug in Three.js r152+.
const MAX_BOARD_ZOOM = 4;

function TeachingImageInner({ imageUrl, display }: { imageUrl: string; display: RoomDisplay }) {
  const texture              = useTexture(imageUrl);
  texture.colorSpace         = SRGBColorSpace;
  const setPreviewZoomUrl    = useAristoStore((s) => s.setPreviewZoomUrl);
  const pending3dImageUrl    = useAristoStore((s) => s.pending3dImageUrl);
  const activeModelUrl       = useAristoStore((s) => s.activeModelUrl);
  const isGeneratingModel    = useAristoStore((s) => s.isGeneratingModel);
  const setIsGeneratingModel = useAristoStore((s) => s.setIsGeneratingModel);
  const setActiveModelUrl    = useAristoStore((s) => s.setActiveModelUrl);
  const setViewMode3d        = useAristoStore((s) => s.setViewMode3d);
  const demoMode             = useAristoStore((s) => s.demoMode);
  const setBoardInteracting  = useAristoStore((s) => s.setBoardInteracting);

  const activeLesson     = useAristoStore((s) => s.activeLesson);

  const materialRef  = useRef<MeshBasicMaterial>(null);
  const imageRef     = useRef<Mesh>(null);
  const { gl } = useThree();

  // The picture lives inside the screen's bezel. Square diagrams fill its height at rest.
  const areaW = display.width * 0.97;
  const areaH = display.height * 0.94;
  const side  = areaH;

  // Zoom like a smart board: the picture magnifies and pans INSIDE the screen, clipped at the bezel; the screen
  // itself never grows. Scroll zooms about the cursor, drag moves a zoomed picture, double-click resets.
  const view = useRef({ z: 1, x: 0, y: 0 });
  const dragFrom = useRef<{ x: number; y: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const clipPlanes = useMemo(() => {
    const [cx, cy] = display.center;
    return [
      new Plane(new Vector3(1, 0, 0), -(cx - areaW / 2)),
      new Plane(new Vector3(-1, 0, 0), cx + areaW / 2),
      new Plane(new Vector3(0, 1, 0), -(cy - areaH / 2)),
      new Plane(new Vector3(0, -1, 0), cy + areaH / 2),
    ];
  }, [display, areaW, areaH]);
  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);

  const settle = () => {
    const v = view.current;
    const half = (side * v.z) / 2;
    const mx = Math.max(0, half - areaW / 2);
    const my = Math.max(0, half - areaH / 2);
    v.x = Math.max(-mx, Math.min(mx, v.x));
    v.y = Math.max(-my, Math.min(my, v.y));
    setZoomed(v.z > 1.001);
  };
  const reset = () => { view.current = { z: 1, x: 0, y: 0 }; setZoomed(false); };

  // Fade-in when the image URL swaps (200ms ramp): a dissolve on the screen rather than a hard cut. A new
  // picture also starts unzoomed.
  const fadeStart = useRef<number>(performance.now());
  useEffect(() => {
    fadeStart.current = performance.now();
    if (materialRef.current) materialRef.current.opacity = 0;
    reset();
  }, [imageUrl]);

  useFrame(() => {
    if (materialRef.current) {
      const t = (performance.now() - fadeStart.current) / 200;
      materialRef.current.opacity = Math.min(1, Math.max(0, t));
    }
    const v = view.current;
    imageRef.current?.position.set(v.x, v.y, 0);
    imageRef.current?.scale.setScalar(v.z);
  });

  // Event points arrive in world space; the screen is unrotated, so local = world minus its centre.
  const local = (e: ThreeEvent<PointerEvent | WheelEvent | MouseEvent>) => ({
    x: e.point.x - display.center[0],
    y: e.point.y - display.center[1],
  });
  const onWheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation();
    const v = view.current;
    const z = Math.max(1, Math.min(MAX_BOARD_ZOOM, v.z * Math.exp(-e.deltaY * 0.0015)));
    const p = local(e);
    v.x = p.x - (p.x - v.x) * (z / v.z);
    v.y = p.y - (p.y - v.y) * (z / v.z);
    v.z = z;
    settle();
  };
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (view.current.z <= 1.001) return;
    e.stopPropagation();
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    dragFrom.current = local(e);
    document.body.style.cursor = "grabbing";
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragFrom.current) return;
    const p = local(e);
    view.current.x += p.x - dragFrom.current.x;
    view.current.y += p.y - dragFrom.current.y;
    dragFrom.current = p;
    settle();
  };
  const hovering = useRef(false);
  const endDrag = () => {
    dragFrom.current = null;
    // A drag that ended off the screen gives the camera back now; one that ended on it keeps the board's.
    if (!hovering.current) { setBoardInteracting(false); document.body.style.cursor = ""; return; }
    document.body.style.cursor = zoomed ? "grab" : "zoom-in";
  };
  // Leaving the board (or the picture going away) hands the scroll and the drag back to the camera.
  useEffect(() => () => setBoardInteracting(false), [setBoardInteracting]);

  const handleViewIn3d = async () => {
    if (!pending3dImageUrl || isGeneratingModel) return;
    if (activeModelUrl) {
      // Already converted — just flip the mode
      setViewMode3d(true);
      return;
    }

    // Demo path: pending3dImageUrl already holds the frozen GLB URL
    // (useLessonPlayback's demoMode branch stashes lesson.metadata
    // .demo_model_url there) — no /api/generate-model/3d call.
    if (demoMode) {
      setActiveModelUrl(pending3dImageUrl);
      setViewMode3d(true);
      return;
    }

    setIsGeneratingModel(true);
    try {
      const res = await fetch("/api/generate-model/3d", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          imageUrl:       pending3dImageUrl,
          conceptId:      activeLesson?.concept_id ?? null,
          // Four views cost roughly twice one, so only the topics the teaching
          // agent judged to need them get them. See teaching.ts guidance.
          needsMultiview: activeLesson?.metadata?.model_needs_multiview === true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.modelUrl) {
        throw new Error(data.error ?? `generate-model/3d HTTP ${res.status}`);
      }
      setActiveModelUrl(data.modelUrl);
      setViewMode3d(true);
    } catch (err) {
      // Image stays as the fallback visual — but say why in the console so
      // a blank "View in 3D" click is diagnosable in the field.
      console.error("[view-in-3d] 3D conversion failed:", err);
    } finally {
      setIsGeneratingModel(false);
    }
  };

  const showViewIn3dButton = !!pending3dImageUrl && !isGeneratingModel;

  return (
    // On the room's display, just in front of its face: the teacher presents on the screen behind them.
    <group position={[display.center[0], display.center[1], display.center[2] + 0.012]}>
        {/* The picture, clipped to the screen so a zoomed one never spills past the bezel. */}
        <mesh ref={imageRef}>
          <planeGeometry args={[side, side]} />
          <meshBasicMaterial ref={materialRef} map={texture} toneMapped={false} transparent clippingPlanes={clipPlanes} />
        </mesh>

        {/* The whole screen takes the scroll and the drag, not just the picture. */}
        <mesh
          position={[0, 0, 0.002]}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={(e) => { e.stopPropagation(); reset(); }}
          onPointerEnter={() => { hovering.current = true; setBoardInteracting(true); document.body.style.cursor = zoomed ? "grab" : "zoom-in"; }}
          onPointerLeave={() => {
            hovering.current = false;
            if (dragFrom.current) return; // a drag in progress keeps the board until it ends
            setBoardInteracting(false);
            document.body.style.cursor = "";
          }}
        >
          <planeGeometry args={[areaW, areaH]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Bottom toolbar — state-aware. Ink glass (`.theme-ink`) in both
            themes, like everything placed on the lit room; "View in 3D" is
            the system's secondary control (V8.4a). */}
        <Html position={[0, -(display.height / 2 + 0.2), 0]} center>
          <div className="theme-ink flex items-center gap-1.5">
            {isGeneratingModel ? (
              <div role="status" className={SCENE_CHIP}>
                <span aria-hidden className="size-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
                Building 3D model…
              </div>
            ) : (
              <>
                {showViewIn3dButton && (
                  <Button variant="secondary" onClick={handleViewIn3d} className={SCENE_BUTTON}>
                    <Box aria-hidden />
                    {activeModelUrl ? "Show 3D" : "View in 3D"}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setPreviewZoomUrl(imageUrl)} className={SCENE_BUTTON}>
                  <Maximize2 aria-hidden />
                  Expand
                </Button>
                <div className={SCENE_CHIP}>
                  {zoomed ? "drag to move · double-click to reset" : "scroll on the screen to zoom"}
                </div>
              </>
            )}
          </div>
        </Html>
    </group>
  );
}

function ModelToolbar() {
  const setViewMode3d = useAristoStore((s) => s.setViewMode3d);
  return (
    <Html position={[MODEL_X, MODEL_Y - 0.86, MODEL_Z]} center>
      <div className="theme-ink">
        <Button variant="secondary" onClick={() => setViewMode3d(false)} className={SCENE_BUTTON}>
          <ImageIcon aria-hidden />
          Show image
        </Button>
      </div>
    </Html>
  );
}

function TeachingImagePanel({ imageUrl, display }: { imageUrl: string; display: RoomDisplay }) {
  return (
    <Suspense fallback={null}>
      <TeachingImageInner imageUrl={imageUrl} display={display} />
    </Suspense>
  );
}

// ─── Teacher error boundary ───────────────────────────────────────────────────
// Catches GLB 404s / parse errors from useGLTF and resets the avatar to the default
// (Jake) so the scene never stays blank when an optional avatar GLB is missing.

interface TeacherBoundaryProps { children: ReactNode; onError: () => void }
interface TeacherBoundaryState { hasError: boolean }

class TeacherErrorBoundary extends Component<TeacherBoundaryProps, TeacherBoundaryState> {
  state: TeacherBoundaryState = { hasError: false };
  static getDerivedStateFromError(): TeacherBoundaryState { return { hasError: true }; }
  componentDidCatch(_err: Error, _info: ErrorInfo) {
    this.props.onError();
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function AvatarLoadingPlaceholder({ position, scale, rotationY }: { position: [number,number,number]; scale: number; rotationY: number }) {
  return (
    <group position={position} scale={scale} rotation-y={rotationY}>
      {/* Capsule silhouette so the scene doesn't feel empty while the GLB downloads */}
      <mesh position={[0, 0.6, 0]}>
        <capsuleGeometry args={[0.28, 1.1, 6, 12]} />
        {/* Warm neutral placeholder tint; no --aristo-* token mirrors it. */}
        <meshStandardMaterial color="#f0e4d4" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function SafeTeacher(props: React.ComponentProps<typeof Teacher>) {
  const setTeacher = useAristoStore((s) => s.setTeacher);
  const { position = [-1, -1.7, -3], scale = 1.5, rotationY = 0.35 } = props;
  // A teacher that fails to load is swapped for the default. Keyed by avatar so
  // the boundary resets with the switch (an errored boundary renders nothing
  // and would otherwise stay blank), and a default that itself fails stays put
  // rather than looping.
  return (
    <TeacherErrorBoundary
      key={props.teacher}
      onError={() => { if (props.teacher !== DEFAULT_TEACHER) setTeacher(DEFAULT_TEACHER); }}
    >
      <Suspense fallback={<AvatarLoadingPlaceholder position={position as [number,number,number]} scale={scale} rotationY={rotationY} />}>
        {/* Keyed by avatar so a switch fully remounts the rig: new group, new
            mixer, new actions. Without this, switching between two avatars that
            share an animation file (marcus/priya both use animations_Avaturn.glb)
            reused drei's memoised actions, which stayed bound to the previous
            skeleton and left the new avatar in a T-pose. */}
        <Teacher key={props.teacher} {...props} />
      </Suspense>
    </TeacherErrorBoundary>
  );
}

// Catches GLB load/parse failures from the generated-model URL so a bad
// fal.ai asset degrades back to the teaching image instead of blanking the
// entire canvas (useGLTF throws inside Suspense; without a boundary the
// error unmounts the whole scene).
interface ModelBoundaryProps { children: ReactNode; onError: () => void }

class ModelErrorBoundary extends Component<ModelBoundaryProps, TeacherBoundaryState> {
  state: TeacherBoundaryState = { hasError: false };
  static getDerivedStateFromError(): TeacherBoundaryState { return { hasError: true }; }
  componentDidCatch(err: Error, _info: ErrorInfo) {
    console.error("[generated-model] GLB failed to load:", err);
    this.props.onError();
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function FloatingModel({
  modelUrl,
  modelAnnotations,
  focusLabels,
}: {
  modelUrl:          string;
  modelAnnotations?: ModelAnnotation[];
  focusLabels:       string[];
}) {
  return (
    <Float speed={1.2} rotationIntensity={0} floatIntensity={0.25} floatingRange={[-0.04, 0.04]}>
      <GeneratedModel
        modelUrl={modelUrl}
        modelAnnotations={modelAnnotations}
        focusLabels={focusLabels}
        position={[MODEL_X, MODEL_Y, MODEL_Z]}
        // Was 1.5 — Hmz called the initial spawn size too big (V9.2b, 2026-09-23):
        // 45% smaller (middle of his 40-50% ask), 1.5 * 0.55 = 0.825. The user's
        // own scroll-to-resize (GeneratedModel's onWheel) is unaffected.
        scale={0.825}
      />
    </Float>
  );
}

// ─── Where the display sits on the page ───────────────────────────────────────
// The interactive widget is DOM (an iframe cannot live in WebGL), so the scene tells the page where the screen's
// face is, every frame, after the framing (LensShift) has moved it. Only a change of a pixel or more is published.
function ScreenRectReporter({ display }: { display: RoomDisplay }) {
  const { camera, gl } = useThree();
  const setScreenRect = useAristoStore((s) => s.setScreenRect);
  const corner = useRef(new Vector3());
  const last = useRef("");
  useEffect(() => () => setScreenRect(null), [setScreenRect]);
  useFrame(() => {
    const r = gl.domElement.getBoundingClientRect();
    const [cx, cy, cz] = display.center;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const p = corner.current.set(cx + (dx * display.width) / 2, cy + (dy * display.height) / 2, cz).project(camera);
      const px = r.left + ((p.x + 1) / 2) * r.width;
      const py = r.top + ((1 - p.y) / 2) * r.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    const rect = { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
    const key = `${rect.x},${rect.y},${rect.w},${rect.h}`;
    if (key === last.current) return;
    last.current = key;
    setScreenRect(rect);
  });
  return null;
}

// ─── "Your turn" speech bubble ────────────────────────────────────────────────
//
// Anchored next to the avatar's head while awaitingAnswer is true.  Pure
// visual cue — the actual interactive input is the AnswerInputPanel in the
// right panel where typing/dictation makes sense.
//
// Re-tuned for standScale 10-15% taller still (V9.2b, Hmz — see SCENE_Y).
// Jake and MJ differ by ~5 cm at this scale but share one bubble anchor.
const TEACHER_HEAD_X = TEACHER_X + 0.75;
const TEACHER_HEAD_Y = 0.65;
const TEACHER_HEAD_Z = -3;

// An ink-glass pill like the callouts and chips (V8.4a): placed on the lit room, so `.theme-ink`
// keeps it dark in both themes. The mic is an icon, not an emoji; the motion only runs when the
// visitor has not asked for less.
function YourTurnBubble() {
  return (
    <Html position={[TEACHER_HEAD_X, TEACHER_HEAD_Y, TEACHER_HEAD_Z]} center>
      <div
        role="status"
        className="aristo-turn-bubble theme-ink pointer-events-none flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-bg/[0.86] px-3.5 py-1.5 text-xs font-bold text-ink shadow-e2 backdrop-blur-md"
      >
        <Mic aria-hidden className="size-3.5 text-accent-text" />
        Your turn
        <span aria-hidden className="aristo-turn-dot size-2 rounded-full bg-accent" />
      </div>
      <style>{`
        @keyframes aristoBubbleIn {
          from { opacity: 0; transform: translateY(6px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aristoBubblePulse {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes aristoMicPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.75); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .aristo-turn-bubble { animation: aristoBubbleIn 0.3s ease-out, aristoBubblePulse 2.2s ease-in-out 0.3s infinite; }
          .aristo-turn-dot { animation: aristoMicPulse 1.2s ease-in-out infinite; }
        }
      `}</style>
    </Html>
  );
}

interface DevOverrides {
  deskPos?:     [number, number, number];
  deskTarget?:  [number, number, number];
  lambda?:      number;
  paperAnchor?: [number, number, number];
}

export function Experience({ devOverrides }: { devOverrides?: DevOverrides } = {}) {
  const teacher               = useAristoStore((s) => s.teacher);
  const classroom             = useAristoStore((s) => s.classroom);
  const activeModelUrl        = useAristoStore((s) => s.activeModelUrl);
  const activePreviewImageUrl = useAristoStore((s) => s.activePreviewImageUrl);
  const viewMode3d            = useAristoStore((s) => s.viewMode3d);
  const lesson                = useAristoStore((s) => s.activeLesson);
  const awaitingAnswer        = useAristoStore((s) => s.awaitingAnswer);
  const setViewMode3d         = useAristoStore((s) => s.setViewMode3d);
  const setActiveModelUrl     = useAristoStore((s) => s.setActiveModelUrl);

  // The interactive widget is a DOM card (learn/InteractiveStage); while it is up, the board image and
  // the model step aside so nothing floats behind it.
  const display = useMemo(() => roomDisplay(classroom), [classroom]);

  // What the narration is about right now (the segment's visual.callouts). A diagram already labels itself, so
  // these only light up the matching part labels on the 3D model.
  const currentSegmentId = useAristoStore((s) => s.currentSegmentId);
  const focusLabels = useMemo<string[]>(() => {
    const seg = lesson?.segments?.find((s) => s.id === currentSegmentId);
    return seg?.visual?.callouts ?? [];
  }, [lesson, currentSegmentId]);

  const interactiveUp = useAristoStore((s) => s.interactiveShown && !!s.interactive.parts && s.interactive.status !== "failed");

  const showModel = !!activeModelUrl && viewMode3d && !interactiveUp;
  const showImage = !showModel && !!activePreviewImageUrl && !interactiveUp;

  // Where the teacher's head looks (V9.3): the board and a shown model share
  // the scene anchor; the desk is the quiz paper.
  const paperAnchor = devOverrides?.paperAnchor;
  const lookTargets = useMemo<LookTargets>(() => ({
    board: display.center,
    model: [SCENE_X, SCENE_Y, SCENE_Z],
    desk:  paperAnchor ?? PAPER_ANCHOR,
  }), [paperAnchor, display]);

  // The set the camera frames: the teacher's outer edge and the display's far edge (bezel included).
  const setLeft  = useMemo<[number, number, number]>(() => [TEACHER_X - 0.6, 0, SCENE_Z], []);
  const setRight = useMemo<[number, number, number]>(
    () => [display.center[0] + display.width / 2 + 0.06, display.center[1], display.center[2]],
    [display],
  );

  return (
    <>
      <RendererConfig />
      <CameraController
        deskPos={devOverrides?.deskPos}
        deskTarget={devOverrides?.deskTarget}
        lambda={devOverrides?.lambda}
      />
      <LensShift left={setLeft} right={setRight} />
      <ScreenRectReporter display={display} />
      <color attach="background" args={[BRAND_HEX.backdrop]} />
      <SceneLights />
      <Environment preset="studio" environmentIntensity={0.5} />
      {classroom === "none" && <Floor />}

      {classroom !== "none" && (
        <Suspense fallback={null}>
          <Classroom variant={classroom} />
        </Suspense>
      )}

      <SafeTeacher
        teacher={teacher}
        position={[TEACHER_X, -1.7, SCENE_Z]}
        scale={standScaleFor(teacher)}
        rotationY={0.3}
        lookTargets={lookTargets}
      />

      {/* Awaiting-answer cue — avatar speech bubble */}
      {awaitingAnswer && <YourTurnBubble />}

      {/* In-scene quiz on the desk paper.  Self-gated on store.activeQuiz —
          renders nothing when no quiz is active. */}
      <Suspense fallback={null}>
        <DeskQuiz paperAnchor={paperAnchor} />
      </Suspense>

      {showModel ? (
        <ModelErrorBoundary
          onError={() => {
            // Bad GLB — drop back to the teaching image and clear the URL so
            // a retry re-fetches rather than re-throwing the cached failure.
            setActiveModelUrl(null);
            setViewMode3d(false);
          }}
        >
          <Suspense fallback={null}>
            <FloatingModel modelUrl={activeModelUrl!} modelAnnotations={lesson?.metadata.model_annotations} focusLabels={focusLabels} />
            <ModelToolbar />
          </Suspense>
        </ModelErrorBoundary>
      ) : showImage ? (
        <TeachingImagePanel imageUrl={activePreviewImageUrl!} display={display} />
      ) : null}
    </>
  );
}
