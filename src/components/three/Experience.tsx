"use client";

import { useAristoStore } from "@/store/useAristoStore";
import type { ModelAnnotation } from "@/lib/agents/teaching";
import { Environment, Float, Grid, Html, useTexture } from "@react-three/drei";
import { Component, Suspense, useEffect, useRef, useMemo, type ErrorInfo, type ReactNode } from "react";
import { Group, MeshBasicMaterial, SRGBColorSpace } from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { GeneratedModel } from "./GeneratedModel";
import { Teacher } from "./Teacher";
import { Classroom } from "./Classroom";
import { Callouts } from "@/components/learn/Callouts";
import { CameraController } from "./CameraController";
import { DeskQuiz } from "./DeskQuiz";

// Bump tone-mapping exposure for PBR avatar materials (Avaturn dark suit benefits from this)
function RendererConfig() {
  const { gl } = useThree();
  useEffect(() => { gl.toneMappingExposure = 0.83; }, [gl]);
  return null;
}

// Shared anchor — image panel and 3D model both live here.
// Image plane is IMG_SIZE × IMG_SIZE (≈1.46), so shifting the anchor by
// half-image (~0.73) left and up moves the plane towards the avatar's head
// so "pointing" gestures actually land on the diagram instead of empty air.
const SCENE_X = 0.37;   // was 1.1 — half-width left
const SCENE_Y = 0.33;   // was -0.4 — half-height up (head/shoulder level)
const SCENE_Z = -3;

// 3D model anchor — kept at the original chest-height position so generated
// models read at body scale rather than floating around the avatar's face.
const MODEL_X = 1.1;
const MODEL_Y = -0.4;
const MODEL_Z = -3;

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

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.38} color="#ffffff" />
      {/* Key light — from front-right, brightens face */}
      <directionalLight position={[2, 5, 3]} intensity={1.22} color="#ffffff" castShadow />
      {/* Fill light — front-left, soft warmth */}
      <directionalLight position={[-2, 3, 2]} intensity={0.51} color="#fff4e8" />
      {/* Rim — neutral warm, low intensity. Saturated colour here reflects in eye corneas. */}
      <pointLight position={[3, 4, -5]} intensity={0.26} color="#fff4e8" />
      <hemisphereLight args={["#ffffff", "#f5e8d8", 0.38]} />
    </>
  );
}

// Teaching image rendered as a crisp WebGL plane — avoids CSS-transform blurriness.
// SRGBColorSpace fixes the black-texture bug in Three.js r152+.
// 1.265 × 1.15 ≈ 1.455 (another +15 %)
const IMG_SIZE   = 1.455;
const FRAME_SIZE = 1.525; // border stays ~0.07 wider all around

function TeachingImageInner({ imageUrl }: { imageUrl: string }) {
  const texture              = useTexture(imageUrl);
  texture.colorSpace         = SRGBColorSpace;
  const setPreviewZoomUrl    = useAristoStore((s) => s.setPreviewZoomUrl);
  const pending3dImageUrl    = useAristoStore((s) => s.pending3dImageUrl);
  const activeModelUrl       = useAristoStore((s) => s.activeModelUrl);
  const isGeneratingModel    = useAristoStore((s) => s.isGeneratingModel);
  const setIsGeneratingModel = useAristoStore((s) => s.setIsGeneratingModel);
  const setActiveModelUrl    = useAristoStore((s) => s.setActiveModelUrl);
  const setViewMode3d        = useAristoStore((s) => s.setViewMode3d);

  // Current-segment callouts — adaptive-visual mode only. When LessonPlayer
  // bumps currentSegmentId, we look up the matching segment's visual.callouts
  // and surface them as floating chips above the image so the student sees
  // exactly what the avatar is pointing at.
  const currentSegmentId = useAristoStore((s) => s.currentSegmentId);
  const activeLesson     = useAristoStore((s) => s.activeLesson);
  const calloutLabels = useMemo<string[]>(() => {
    if (!currentSegmentId || !activeLesson?.segments) return [];
    const seg = activeLesson.segments.find((s) => s.id === currentSegmentId);
    return seg?.visual?.callouts ?? [];
  }, [currentSegmentId, activeLesson]);

  const groupRef     = useRef<Group>(null);
  const imgScale     = useRef(1.0);
  const materialRef  = useRef<MeshBasicMaterial>(null);

  // Fade-in animation when the image URL swaps (200ms ramp). Combined with
  // the Float container's bobbing motion, this reads as a gentle dissolve
  // rather than a hard cut between segment visuals.
  const fadeStart = useRef<number>(performance.now());
  useEffect(() => {
    fadeStart.current = performance.now();
    if (materialRef.current) materialRef.current.opacity = 0;
  }, [imageUrl]);

  useFrame(() => {
    if (groupRef.current) groupRef.current.scale.setScalar(imgScale.current);
    if (materialRef.current) {
      const t = (performance.now() - fadeStart.current) / 200;
      materialRef.current.opacity = Math.min(1, Math.max(0, t));
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setPreviewZoomUrl(imageUrl);
  };

  const onWheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation();
    imgScale.current = Math.max(0.4, Math.min(2.5, imgScale.current - e.deltaY * 0.001));
  };

  const handleViewIn3d = async () => {
    if (!pending3dImageUrl || isGeneratingModel) return;
    if (activeModelUrl) {
      // Already converted — just flip the mode
      setViewMode3d(true);
      return;
    }
    setIsGeneratingModel(true);
    try {
      const res = await fetch("/api/generate-model/3d", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ imageUrl: pending3dImageUrl }),
      });
      const data = await res.json();
      if (data.modelUrl) {
        setActiveModelUrl(data.modelUrl);
        setViewMode3d(true);
      }
    } catch {
      /* non-critical — image stays */
    } finally {
      setIsGeneratingModel(false);
    }
  };

  const showViewIn3dButton = !!pending3dImageUrl && !isGeneratingModel;

  return (
    <Float speed={1.0} rotationIntensity={0.04} floatIntensity={0.2} floatingRange={[-0.03, 0.03]}>
      <group ref={groupRef} position={[SCENE_X, SCENE_Y, SCENE_Z]}>
        {/* Main image plane — click to open lightbox, scroll to resize */}
        <mesh
          onClick={handleClick}
          onWheel={onWheel}
          onPointerEnter={() => { document.body.style.cursor = "zoom-in"; }}
          onPointerLeave={() => { document.body.style.cursor = ""; }}
        >
          <planeGeometry args={[IMG_SIZE, IMG_SIZE]} />
          <meshBasicMaterial ref={materialRef} map={texture} toneMapped={false} transparent />
        </mesh>

        {/* Per-segment callout chips — adaptive-visual mode only.
            Anchored just above the image so they read as "what we're
            looking at right now" rather than competing with the toolbar. */}
        {calloutLabels.length > 0 && (
          <Html position={[0, IMG_SIZE / 2 + 0.11, 0]} center>
            <Callouts callouts={calloutLabels} />
          </Html>
        )}

        {/* Soft orange border frame */}
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[FRAME_SIZE, FRAME_SIZE]} />
          <meshBasicMaterial color="#F97B2F" transparent opacity={0.25} />
        </mesh>

        {/* Bottom toolbar — state-aware */}
        <Html position={[0, -(IMG_SIZE / 2 + 0.13), 0]} center>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {isGeneratingModel ? (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "rgba(253,240,228,0.92)",
                border: "1px solid rgba(249,123,47,0.3)",
                borderRadius: "20px", padding: "3px 10px",
                fontSize: "10px", fontWeight: 600, color: "#C05A1C",
                whiteSpace: "nowrap", pointerEvents: "none",
              }}>
                <span style={{
                  width: "5px", height: "5px", borderRadius: "50%",
                  background: "#F97B2F", display: "inline-block",
                  animation: "aristoPulse 1.4s ease-in-out infinite",
                }} />
                Building 3D model…
              </div>
            ) : (
              <>
                {showViewIn3dButton && (
                  <button
                    onClick={handleViewIn3d}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      background: "#F97B2F", color: "white",
                      border: "1px solid rgba(192,90,28,0.5)",
                      borderRadius: "20px", padding: "4px 11px",
                      fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em",
                      whiteSpace: "nowrap", cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(249,123,47,0.35)",
                    }}
                  >
                    {activeModelUrl ? "Show 3D" : "View in 3D"}
                  </button>
                )}
                <div style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  background: "rgba(253,240,228,0.92)",
                  border: "1px solid rgba(249,123,47,0.3)",
                  borderRadius: "20px", padding: "3px 10px",
                  fontSize: "10px", fontWeight: 600, color: "#C05A1C",
                  whiteSpace: "nowrap", pointerEvents: "none",
                }}>
                  scroll to resize · click to zoom
                </div>
              </>
            )}
          </div>
          <style>{`
            @keyframes aristoPulse {
              0%,100%{opacity:1;transform:scale(1)}
              50%{opacity:0.35;transform:scale(0.65)}
            }
          `}</style>
        </Html>
      </group>
    </Float>
  );
}

function ModelToolbar() {
  const setViewMode3d = useAristoStore((s) => s.setViewMode3d);
  return (
    <Html position={[MODEL_X, MODEL_Y - 0.86, MODEL_Z]} center>
      <button
        onClick={() => setViewMode3d(false)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          background: "rgba(253,240,228,0.92)", color: "#C05A1C",
          border: "1px solid rgba(249,123,47,0.4)",
          borderRadius: "20px", padding: "4px 11px",
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em",
          whiteSpace: "nowrap", cursor: "pointer",
        }}
      >
        Show image
      </button>
    </Html>
  );
}

function TeachingImagePanel({ imageUrl }: { imageUrl: string }) {
  return (
    <Suspense fallback={null}>
      <TeachingImageInner imageUrl={imageUrl} />
    </Suspense>
  );
}

// ─── Teacher error boundary ───────────────────────────────────────────────────
// Catches GLB 404s / parse errors from useGLTF and resets the avatar to Ryan
// so the scene never stays blank when an optional avatar GLB is missing.

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
        <meshStandardMaterial color="#f0e4d4" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function SafeTeacher(props: React.ComponentProps<typeof Teacher>) {
  const setTeacher = useAristoStore((s) => s.setTeacher);
  const { position = [-1, -1.7, -3], scale = 1.5, rotationY = 0.35 } = props;
  return (
    <TeacherErrorBoundary onError={() => setTeacher("ryan")}>
      <Suspense fallback={<AvatarLoadingPlaceholder position={position as [number,number,number]} scale={scale} rotationY={rotationY} />}>
        <Teacher {...props} />
      </Suspense>
    </TeacherErrorBoundary>
  );
}

function FloatingModel({
  modelUrl,
  modelAnnotations,
}: {
  modelUrl:          string;
  modelAnnotations?: ModelAnnotation[];
}) {
  return (
    <Float speed={1.2} rotationIntensity={0} floatIntensity={0.25} floatingRange={[-0.04, 0.04]}>
      <GeneratedModel
        modelUrl={modelUrl}
        modelAnnotations={modelAnnotations}
        position={[MODEL_X, MODEL_Y, MODEL_Z]}
        scale={1.5}
      />
    </Float>
  );
}

// ─── "Your turn" speech bubble ────────────────────────────────────────────────
//
// Anchored next to the avatar's head while awaitingAnswer is true.  Pure
// visual cue — the actual interactive input is the AnswerInputPanel in the
// right panel where typing/dictation makes sense.
//
// The avatar sits at [-1, -1.7, -3] with scale 1.5; head ≈ (avatarY + 1.4 * scale).
const TEACHER_HEAD_X = -0.25;
const TEACHER_HEAD_Y = 0.55;
const TEACHER_HEAD_Z = -3;

function YourTurnBubble() {
  return (
    <Html position={[TEACHER_HEAD_X, TEACHER_HEAD_Y, TEACHER_HEAD_Z]} center>
      <div
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(249,123,47,0.45)",
          borderRadius: "20px", padding: "6px 14px",
          fontSize: "12px", fontWeight: 700, color: "#C45A10",
          whiteSpace: "nowrap",
          boxShadow: "0 8px 28px rgba(249,123,47,0.35)",
          backdropFilter: "blur(6px)",
          animation: "aristoBubbleIn 0.3s ease-out, aristoBubblePulse 2.2s ease-in-out 0.3s infinite",
          pointerEvents: "none",
        }}
      >
        <span style={{
          width: "8px", height: "8px", borderRadius: "50%",
          background: "#F97B2F",
          animation: "aristoMicPulse 1.2s ease-in-out infinite",
        }} />
        🎙 Your turn
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

  const showModel = !!activeModelUrl && viewMode3d;
  const showImage = !showModel && !!activePreviewImageUrl;

  return (
    <>
      <RendererConfig />
      <CameraController
        deskPos={devOverrides?.deskPos}
        deskTarget={devOverrides?.deskTarget}
        lambda={devOverrides?.lambda}
      />
      <color attach="background" args={["#FDF0E4"]} />
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
        position={[-1, -1.7, SCENE_Z]}
        scale={1.5}
        rotationY={0.3}
      />

      {/* Awaiting-answer cue — avatar speech bubble */}
      {awaitingAnswer && <YourTurnBubble />}

      {/* In-scene quiz on the desk paper.  Self-gated on store.activeQuiz —
          renders nothing when no quiz is active. */}
      <Suspense fallback={null}>
        <DeskQuiz paperAnchor={devOverrides?.paperAnchor} />
      </Suspense>

      {showModel ? (
        <Suspense fallback={null}>
          <FloatingModel modelUrl={activeModelUrl!} modelAnnotations={lesson?.metadata.model_annotations} />
          <ModelToolbar />
        </Suspense>
      ) : showImage ? (
        <TeachingImagePanel imageUrl={activePreviewImageUrl!} />
      ) : null}
    </>
  );
}
