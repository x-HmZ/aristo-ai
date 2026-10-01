import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { Group, MeshBasicMaterial, SRGBColorSpace, ShaderMaterial, Vector2 } from "three";
import { clockOf } from "../play";
import { PICTURE_T, PICTURE_URL } from "./scripts";
import { DIAGRAM_FRAG, DIAGRAM_VERT } from "./shaders";
import { host } from "./host";
import { BOARD } from "./spots";
import { seg, smooth } from "./timeline";
import { warmUp } from "./warm";

/** The white frame around the picture: the product's (Experience FRAME_SIZE 1.525 for IMG_SIZE 1.455). */
const FRAME = BOARD.size + 0.07;

/**
 * It Draws the Picture (V8.3b): the volcano lesson's real cross-section resolving where the classroom shows a
 * lesson's picture, at the size it shows it: noise, then sketch lines, then colour (shaders.ts), on the picture
 * section's clock. Jake points at it once it has mostly formed (scripts.ts PICTURE_T).
 */
export function Diagram() {
  const tex = useTexture(PICTURE_URL);
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
  const frame = useMemo(() => new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, toneMapped: false }), []);
  useEffect(() => () => { mat.dispose(); frame.dispose(); }, [mat, frame]);

  // Warmed before its section (warm.ts), then one invisible draw.
  const { gl, scene: root, camera } = useThree();
  const warm = useRef(-1);
  useEffect(() => {
    let alive = true;
    const g = group.current;
    if (!g) return;
    void warmUp(gl, root, camera, g).catch(() => {}).then(() => { if (alive) warm.current = 1; });
    return () => { alive = false; };
  }, [gl, root, camera, mat]);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    if (warm.current > 0) { warm.current = 0; g.visible = true; mat.uniforms.opacity.value = 0; frame.opacity = 0; return; }
    if (warm.current < 0) return;
    // Only at its own spot: the heart uses the same place in the model section.
    if (host.active !== "picture") { g.visible = false; return; }
    const p = seg(clockOf("picture").t, PICTURE_T.resolve[0], PICTURE_T.resolve[1]);
    const t = clockOf("picture").t;
    g.visible = t > 0;
    if (!g.visible) return;
    mat.uniforms.p.value = p;
    mat.uniforms.time.value = state.clock.elapsedTime;
    mat.uniforms.opacity.value = smooth(seg(t, 0, PICTURE_T.resolve[0]));
    frame.opacity = smooth(seg(p, 0.7, 1)) * 0.95;
  });

  return (
    <group ref={group} name="landing-picture" position={BOARD.center as unknown as [number, number, number]} visible={false}>
      <mesh position={[0, 0, -0.004]} material={frame}>
        <planeGeometry args={[FRAME, FRAME]} />
      </mesh>
      <mesh material={mat}>
        <planeGeometry args={[BOARD.size, BOARD.size]} />
      </mesh>
    </group>
  );
}
