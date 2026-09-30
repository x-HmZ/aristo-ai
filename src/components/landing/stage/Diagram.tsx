import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useMemo, useRef } from "react";
import { DoubleSide, Group, MeshBasicMaterial, SRGBColorSpace, ShaderMaterial, Vector2, Vector3 } from "three";
import { getFrame } from "./scroll";
import { DIAGRAM_FRAG, DIAGRAM_VERT } from "./shaders";
import { mix, roomAt, seg, smooth } from "./timeline";

export const DIAGRAM_URL = "/demo/heart/teaching.jpg";

// The board anchor the product shows a lesson image at (Experience.tsx SCENE_* and IMG_SIZE), and a place on the
// display wall to its right, where the diagram goes while the model has the anchor.
const IMG = 1.455;
const ANCHOR = new Vector3(0.37, 0.18, -3);
// In front of the display mesh (which stands proud of the wall), to the right of where the model floats.
const WALL = new Vector3(2.1, 0.5, -5.3);
const WALL_SCALE = 1.0;

/**
 * The lesson diagram (the real `teaching.jpg`) resolving on the board: noise, then sketch lines, then colour
 * (shaders.ts), then sliding up onto the display wall when the model arrives, and back for Demonstrate.
 */
export function Diagram() {
  const tex = useTexture(DIAGRAM_URL);
  tex.colorSpace = SRGBColorSpace;
  const group = useRef<Group>(null);
  const mat = useMemo(
    () => new ShaderMaterial({
      uniforms: {
        map: { value: tex }, p: { value: 0 }, time: { value: 0 }, opacity: { value: 0 },
        texel: { value: new Vector2(1.2 / 1024, 1.2 / 1024) },
      },
      vertexShader: DIAGRAM_VERT,
      fragmentShader: DIAGRAM_FRAG,
      transparent: true,
      toneMapped: false,
    }),
    [tex],
  );
  const frame = useMemo(() => new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, toneMapped: false, side: DoubleSide }), []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const r = roomAt(getFrame().S);
    g.visible = r.diagram > 0;
    if (!g.visible) return;
    mat.uniforms.p.value = r.diagram;
    mat.uniforms.time.value = state.clock.elapsedTime;
    mat.uniforms.opacity.value = smooth(seg(r.diagram, 0, 0.1));
    frame.opacity = smooth(seg(r.diagram, 0.7, 1)) * 0.95;
    const k = smooth(r.diagramPlace);
    g.position.lerpVectors(ANCHOR, WALL, k);
    // An arc on the way up, so it lifts off the board rather than sliding through the teacher's space.
    g.position.y += Math.sin(k * Math.PI) * 0.25;
    g.scale.setScalar(mix(1, WALL_SCALE, k));
  });

  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 0, -0.004]} material={frame}>
        <planeGeometry args={[IMG + 0.07, IMG + 0.07]} />
      </mesh>
      <mesh material={mat}>
        <planeGeometry args={[IMG, IMG]} />
      </mesh>
    </group>
  );
}
