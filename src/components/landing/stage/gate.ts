/**
 * Which landing a visitor gets (V8.3). Decided before anything heavy is downloaded.
 *
 * - `stack`: reduced motion. No pinning, every beat a still with its words (CSS does this on its own, see
 *   globals.css; the gate only records it).
 * - `lite`: the same pinned story with stills that cross-fade: phones, weak or software GPUs, Save-Data, low memory.
 * - `full`: the live 3D stage.
 *
 * The full stage can still hand over to lite after the fact, if its first frames are slow (LandingStage).
 */
export type LandingMode = "full" | "lite" | "stack";

export interface GateEnv {
  reducedMotion: boolean;
  /** WebGL2 with `failIfMajorPerformanceCaveat` (a software renderer counts as absent). */
  webgl2: boolean;
  width: number;
  /** A coarse pointer and no fine one: a phone or a tablet without a mouse. */
  coarseOnly: boolean;
  saveData: boolean;
  /** navigator.deviceMemory in GB, where the browser reports it. */
  deviceMemory?: number;
  /** `?lite=1` / `?full=1` (verification and the "See it in 3D" fallback). */
  forced?: "full" | "lite" | null;
}

/** Below this width the stage is a phone's: lite by default (Hmz, V8.3 plan). */
export const FULL_MIN_WIDTH = 768;

export function decideMode(env: GateEnv): LandingMode {
  if (env.reducedMotion) return "stack";
  if (env.forced === "lite") return "lite";
  if (!env.webgl2) return "lite";
  if (env.forced === "full") return "full";
  if (env.width < FULL_MIN_WIDTH || env.coarseOnly || env.saveData) return "lite";
  if (env.deviceMemory !== undefined && env.deviceMemory < 4) return "lite";
  return "full";
}

/** Read the environment in the browser. Creates and releases one WebGL2 context. */
export function readEnv(): GateEnv {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  let webgl2 = false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    webgl2 = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("lite") === "1" ? "lite" : params.get("full") === "1" ? "full" : null;
  return {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    webgl2,
    width: window.innerWidth,
    coarseOnly: window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches,
    saveData: !!nav.connection?.saveData,
    deviceMemory: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    forced,
  };
}

/** The stage's own check after it starts: p75 frame time over its first frames. */
export const SLOW_P75_MS = 24;
export const SLOW_SAMPLE_FRAMES = 90;
export function isSlow(frameMs: readonly number[]): boolean {
  if (frameMs.length < SLOW_SAMPLE_FRAMES) return false;
  const sorted = [...frameMs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.75)] > SLOW_P75_MS;
}
