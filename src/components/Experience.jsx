"use client";
import { useAITeacher } from "@/hooks/useAITeacher";
import {
  CameraControls,
  Environment,
  Float,
  Html,
  Loader,
  useGLTF,
  Stats,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Leva, button, useControls } from "leva";
import { Suspense, useEffect, useRef, useMemo } from "react";
import { degToRad } from "three/src/math/MathUtils";
import { BoardSettings } from "./BoardSettings";
import { MessagesList } from "./MessagesList";
import { Teacher } from "./Teacher";
import { TypingBox } from "./TypingBox";
import { QuizBox } from "./QuizBox";
import ImageBox from "./ImageBox";
import LogoutButton from "./LogoutButton";
import { useModelLoader, preloadModels } from '@/utils/modelLoader';

const itemPlacement = {
  default: {
    classroom: {
      position: [0.2, -1.7, -2],
    },
    teacher: {
      position: [-1, -1.7, -3],
    },
    board: {
      position: [0.45, 0.382, -6],
    },
  },
  alternative: {
    classroom: {
      position: [0.3, -1.7, -1.5],
      rotation: [0, degToRad(-90), 0],
      scale: 0.4,
    },
    teacher: { position: [-1, -1.7, -3] },
    board: { position: [1.4, 0.84, -8] },
  },
};

// Preload models when the module is imported
preloadModels();

export const Experience = () => {
  const teacher = useAITeacher((state) => state.teacher);
  const classroom = useAITeacher((state) => state.classroom);
  const Quiz = useAITeacher((state) => state.Quiz);
  const learningStyle = useAITeacher((state) => state.learningStyle);

  // Memoize the classroom placement to prevent unnecessary recalculations
  const classroomPlacement = useMemo(() => itemPlacement[classroom], [classroom]);

  // Load the classroom model using our optimized loader
  const { scene: classroomScene } = useModelLoader(`/models/classroom_${classroom || 'default'}.glb`);

  return (
    <>
      <div className="z-10 md:justify-center fixed bottom-4 left-4 right-4 flex gap-3 flex-wrap justify-stretch">
        <TypingBox />
      </div>
      <div className="z-10 md:justify-end fixed top-4 left-4 right-4 flex gap-0 flex-wrap justify-stretch">
        <LogoutButton />
      </div>

      <Leva hidden />
      <Loader />
      <Canvas
        camera={{
          position: [0, 0, 0.0001],
        }}
        performance={{
          min: 0.5,
          max: 1,
        }}
        dpr={[1, 2]}
        shadows={false}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <Stats />
        <CameraManager />

        {/* Quiz Box */}
        {Quiz ? (
          <Suspense fallback={null}>
            <Float speed={0} floatIntensity={0} rotationIntensity={0}>
              <Html
                distanceFactor={0.4}
                transform
                position={[0, -0.8, -0.52]}
                rotation-x={-1.4}
              >
                <QuizBox />
              </Html>
            </Float>
          </Suspense>
        ) : null}

        {/* Visual Representation */}
        {learningStyle === "as if explaining with a visual example" && Quiz === false ? (
          <Suspense fallback={null}>
            <Float speed={0.7} floatIntensity={0.2} rotationIntensity={0.1}>
              <Html
                distanceFactor={0.8}
                transform
                position={[1.6, 0.1, -3]}
                rotation-y={-0.4}
              >
                <ImageBox />
              </Html>
            </Float>
          </Suspense>
        ) : null}

        <Suspense fallback={null}>
          <Float speed={0.5} floatIntensity={0.2} rotationIntensity={0.1}>
            <Html
              transform
              {...classroomPlacement.board}
              distanceFactor={1}
            >
              <MessagesList />
              <BoardSettings />
            </Html> 
            <Environment preset="sunset" />
            <ambientLight intensity={0.8} color="pink" />

            <primitive
              object={classroomScene}
              {...classroomPlacement.classroom}
              frustumCulled={true}
            />
            <Teacher
              teacher={teacher}
              key={teacher}
              {...classroomPlacement.teacher}
              scale={1.5}
              rotation-y={degToRad(20)}
              frustumCulled={true}
            />
          </Float>
        </Suspense>
      </Canvas>
    </>
  );
};

const CAMERA_POSITIONS = {
  default: [0, 6.123233995736766e-21, 0.0001],
  loading: [
    0.00002621880610890309, 0.00000515037441056466, 0.00009636414192870058,
  ],
  speaking: [0, -1.6481333940859815e-7, 0.00009999846226827279],
};

const CAMERA_ZOOMS = {
  default: 1,
  loading: 1.3,
  speaking: 2.1204819420055387,
};

const CameraManager = () => {
  const controls = useRef();
  const loading = useAITeacher((state) => state.loading);
  const currentMessage = useAITeacher((state) => state.currentMessage);

  useEffect(() => {
    if (loading) {
      controls.current?.setPosition(...CAMERA_POSITIONS.loading, true);
      controls.current?.zoomTo(CAMERA_ZOOMS.loading, true);
    } else if (currentMessage) {
      controls.current?.setPosition(...CAMERA_POSITIONS.speaking, true);
      controls.current?.zoomTo(CAMERA_ZOOMS.speaking, true);
    }
  }, [loading]);

  useControls("Helper", {
    getCameraPosition: button(() => {
      const position = controls.current.getPosition();
      const zoom = controls.current.camera.zoom;
      console.log([...position], zoom);
    }),
  });

  return (
    <CameraControls
      ref={controls}
      minZoom={1}
      maxZoom={3}
      polarRotateSpeed={-0.3} // REVERSE FOR NATURAL EFFECT
      azimuthRotateSpeed={-0.3} // REVERSE FOR NATURAL EFFECT
      mouseButtons={{
        left: 1, //ACTION.ROTATE
        wheel: 16, //ACTION.ZOOM
      }}
      touches={{
        one: 32, //ACTION.TOUCH_ROTATE
        two: 512, //ACTION.TOUCH_ZOOM
      }}
    />
  );
};
