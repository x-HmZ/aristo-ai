"use client";

/**
 * Frames the teaching set (the teacher and the room's display) in the part of the canvas the lesson panel leaves
 * free. A lens shift (`setViewOffset`), like an architect's shift lens: the camera does not turn or move, so the
 * room keeps its perspective; the picture slides until the set's midpoint sits in the middle of the free area.
 *
 * The set is given in world space by Experience (the teacher's outer edge and the display's far edge), so a new
 * room or a new teacher spot re-frames itself. Off in the desk view (the quiz paper is framed by deskFraming) and
 * where the panel covers most of a narrow canvas. On a phone the free area is what the lesson sheet (portrait) or
 * drawer (landscape) leaves, from under the top bar down: the set is centred in it, with the view widened to fit.
 * Where the set is wider than the free area (1280px), the view widens
 * (`zoom` below 1) just enough to fit it.
 *
 * It measures with its own unshifted copy of the camera, so the real camera's projection is only touched when the
 * framing actually changes. The desk view snaps it off at once (drei's transformed Html, the quiz paper, does not
 * follow a view offset), and reduced motion snaps every change.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { useAristoStore } from "@/store/useAristoStore";
import { PANEL_INSET_PX } from "@/components/learn/ClassroomChrome";
import { PHONE_TOP_INSET, useClassroomLayout } from "@/store/useClassroomLayout";

type Vec3 = [number, number, number];

/** Below this width the panel covers most of the canvas and there is no free area to centre in. */
const MIN_WIDTH = 900;
const LAMBDA = 3.2;
/** The set may use this much of the free width; the rest is margin on both sides. */
const FILL = 0.94;

export function LensShift({ left, right }: { left: Vec3; right: Vec3 }) {
  const { camera, size } = useThree();
  const activeQuiz = useAristoStore((s) => s.activeQuiz);
  const shift = useRef(0);
  const shiftY = useRef(0);
  const zoom = useRef(1);
  const a = useRef(new Vector3());
  const b = useRef(new Vector3());
  const measure = useRef(new PerspectiveCamera());

  const reduceMotion = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => { reduceMotion.current = e.matches; };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useFrame((_, delta) => {
    const cam = camera as PerspectiveCamera;
    let goal = 0;
    let goalY = 0;
    let goalZoom = 1;
    const { mode, panelRight, panelBottom } = useClassroomLayout.getState();
    const phone = mode !== "desk";
    if (!activeQuiz && (phone || size.width >= MIN_WIDTH)) {
      // The camera's pose this frame (CameraController and OrbitControls may have moved it), unshifted, at zoom 1.
      cam.updateMatrixWorld();
      const m = measure.current;
      if (m.fov !== cam.fov || m.aspect !== cam.aspect || m.near !== cam.near || m.far !== cam.far) {
        m.fov = cam.fov; m.aspect = cam.aspect; m.near = cam.near; m.far = cam.far;
        m.updateProjectionMatrix();
      }
      m.matrixWorld.copy(cam.matrixWorld);
      m.matrixWorldInverse.copy(cam.matrixWorldInverse);
      const pa = a.current.set(...left).project(m);
      const pb = b.current.set(...right).project(m);
      const free = size.width - (phone ? panelRight : PANEL_INSET_PX);
      const spanPx = Math.abs(pb.x - pa.x) / 2 * size.width;
      goalZoom = Math.min(1, (free * FILL) / spanPx);
      const midPx = ((pa.x + pb.x) / 2) * goalZoom / 2 * size.width + size.width / 2;
      goal = midPx - free / 2;
      // A phone's free area starts under the top bar and ends at the sheet: slide the picture up to its middle.
      if (phone) goalY = (panelBottom - PHONE_TOP_INSET) / 2;
    }
    const snap = reduceMotion.current || !!activeQuiz;
    const t = snap ? 1 : 1 - Math.exp(-LAMBDA * Math.min(delta, 0.1));
    const nextShift = shift.current + (goal - shift.current) * t;
    const nextY = shiftY.current + (goalY - shiftY.current) * t;
    const nextZoom = zoom.current + (goalZoom - zoom.current) * t;
    const settledOff = goal === 0 && goalY === 0 && goalZoom === 1 && Math.abs(nextShift) < 0.5 && Math.abs(nextY) < 0.5 && Math.abs(nextZoom - 1) < 0.001;
    if (settledOff) {
      shift.current = 0;
      shiftY.current = 0;
      zoom.current = 1;
      if (cam.view?.enabled) cam.clearViewOffset();
      if (cam.zoom !== 1) { cam.zoom = 1; cam.updateProjectionMatrix(); }
      return;
    }
    // Leave the projection alone when nothing visible would change.
    const sameCanvas = !!cam.view?.enabled && cam.view.fullWidth === size.width && cam.view.fullHeight === size.height;
    if (sameCanvas && Math.abs(nextShift - shift.current) < 0.05 && Math.abs(nextY - shiftY.current) < 0.05 && Math.abs(nextZoom - zoom.current) < 0.00005) return;
    shift.current = nextShift;
    shiftY.current = nextY;
    zoom.current = nextZoom;
    cam.zoom = nextZoom;
    cam.setViewOffset(size.width, size.height, nextShift, nextY, size.width, size.height);
  });

  return null;
}
