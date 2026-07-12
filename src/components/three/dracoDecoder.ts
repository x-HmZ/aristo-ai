// Self-hosted Draco decoder wiring (T02 — 3D asset diet).
//
// drei's `useGLTF` defaults to fetching the Draco decoder from a Google CDN
// (https://www.gstatic.com/draco/versioned/decoders/1.5.5/) the first time a
// Draco-compressed GLB loads. We self-host the decoder instead so `/learn`
// never depends on a third-party CDN being reachable.
//
// Decoder files copied from
// node_modules/three/examples/jsm/libs/draco/gltf/ into public/draco/ —
// this is a side-effecting import: importing this module (from anywhere,
// before any `useGLTF()` call resolves) is enough to redirect the decoder
// path for every subsequent GLTFLoader instance, since drei tracks the path
// in a module-level variable shared by all `useGLTF` callers.
//
// Import this module (for its side effect only) from every component that
// calls `useGLTF` / `useGLTF.preload` at module scope — currently Teacher.tsx
// and Classroom.tsx.
import { useGLTF } from "@react-three/drei";

useGLTF.setDecoderPath("/draco/");
