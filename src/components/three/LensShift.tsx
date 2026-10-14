"use client";

/**
 * Frames the teaching set (the teacher and the room's display) in the part of the canvas the lesson panel leaves
 * free. A lens shift (`setViewOffset`), like an architect's shift lens: the camera does not turn or move, so the
 * room keeps its perspective; the picture slides until the set's midpoint sits in the middle of the free area.
 *
 * The set is given in world space by Experience (the teacher's outer edge and the display's far edge), so a new
 * room or a new teacher spot re-frames itself. Off in the desk view (the quiz paper is framed by deskFraming) and
 * where the panel covers most of a narrow canvas. Where the set is wider than the free area (1280px), the view widens
 * (`zoom` below 1) just enough to fit it.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3, type PerspectiveCamera } from "three";
import { useAristoStore } from "@/store/useAristoStore";
import { PANEL_INSET_PX } from "@/components/learn/ClassroomChrome";

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
  const zoom = useRef(1);
  const a = useRef(new Vector3());
  const b = useRef(new Vector3());

  useFrame((_, delta) => {
    const cam = camera as PerspectiveCamera;
    let goal = 0;
    let goalZoom = 1;
    if (!activeQuiz && size.width >= MIN_WIDTH) {
      // Measure at zoom 1 with no shift; both scale the picture linearly from its centre.
      cam.zoom = 1;
      cam.clearViewOffset();
      const pa = a.current.set(...left).project(cam);
      const pb = b.current.set(...right).project(cam);
      const free = size.width - PANEL_INSET_PX;
      // Where the set is wider than the free area (1280px), widen the view just enough to fit it with a margin.
      const spanPx = Math.abs(pb.x - pa.x) / 2 * size.width;
      goalZoom = Math.min(1, (free * FILL) / spanPx);
      const midPx = ((pa.x + pb.x) / 2) * goalZoom / 2 * size.width + size.width / 2;
      goal = midPx - free / 2;
    }
    const t = 1 - Math.exp(-LAMBDA * Math.min(delta, 0.1));
    shift.current += (goal - shift.current) * t;
    zoom.current += (goalZoom - zoom.current) * t;
    if (Math.abs(shift.current) < 0.5 && goal === 0 && Math.abs(zoom.current - 1) < 0.001) {
      if (cam.view?.enabled) cam.clearViewOffset();
      if (cam.zoom !== 1) { cam.zoom = 1; cam.updateProjectionMatrix(); }
      shift.current = 0;
      zoom.current = 1;
      return;
    }
    cam.zoom = zoom.current;
    cam.setViewOffset(size.width, size.height, shift.current, 0, size.width, size.height);
  });

  return null;
}
