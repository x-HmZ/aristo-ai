# T02 — 3D Asset Diet (compression + conditional loading)

**Model:** sonnet | **Priority:** 3 | **Depends on:** T01 (clean tree)

## Context

`/learn` currently downloads ~78 MB of GLB assets on load. Measured sizes in `public/models/`:

| File | MB | Problem |
|------|----|---------|
| classroom_alternative.glb | 35.28 | Preloaded even when the default classroom is shown |
| Teacher_Marcus.glb | 13.47 | Preloaded even if user picked Ryan |
| Teacher_Priya.glb | 13.31 | Same |
| Sonia.fbx / Ryan.fbx | 7.25 / 2.46 | **Unused** — no code references `.fbx` in `src/` (verified by grep). Dead weight in the deploy output |
| Teacher_Sonia.glb | 6.39 | Uncompressed |
| animations_Avaturn.glb | 5.90 | Uncompressed |
| classroom_default.glb | 3.71 | Uncompressed |
| Teacher_Ryan.glb | 3.33 | Uncompressed |

Preload sites: `src/components/three/Teacher.tsx:476-482` (all 4 avatars + custom anims),
`src/components/three/Classroom.tsx:341-342` (BOTH classrooms).

The Avaturn avatars (Marcus/Priya) carry 4096x4096 baked textures — most of their 13.5 MB.

## What to do

1. **Delete** `public/models/Sonia.fbx` and `public/models/Ryan.fbx` (confirm zero references first
   with a repo-wide grep for `.fbx`, including `pages/`, `scripts/`, `public/`).
2. **Compress every GLB** with `@gltf-transform/cli` (add as devDependency via yarn):
   - `gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp`
   - For Marcus/Priya additionally cap texture size at 2048 (`--texture-resize 2048` or the
     `resize` command). Visually verify no quality cliff — the avatar fills only part of the frame.
   - For `classroom_alternative.glb` (35 MB) target <8 MB; if optimize alone is not enough, resize
     textures to 1024 — it is a background environment.
   - Keep originals in a git-ignored `assets-src/` folder or rely on git history; do not keep
     both copies in `public/`.
3. **Draco decoder wiring**: `useGLTF` from drei supports Draco out of the box via a CDN decoder,
   but the project should self-host: copy the draco decoder files to `public/draco/` and call
   `useGLTF.setDecoderPath("/draco/")` once (Teacher.tsx module scope or a shared module).
   Verify decoding works in the browser, not just at build time.
4. **Conditional preloading**:
   - `Teacher.tsx`: preload ONLY the currently selected avatar's scene+anim files (read the
     selection from the store / props at module level is not possible — move preloads into a small
     effect or preload just the default avatar statically and let others lazy-load via Suspense).
   - `Classroom.tsx`: preload only `classroom_default.glb`; the alternative loads on demand when
     the user switches (TeacherControls has the switcher).
5. Re-measure: log the total bytes fetched for `/learn` cold load (browser devtools or
   `Get-ChildItem` on the compressed files) and record before/after in the checklist below.

## Acceptance criteria

- Cold `/learn` initial GLB payload under ~12 MB (default avatar + default classroom + anims).
- All avatars and both classrooms still render correctly, animations and morph targets
  (lipsync visemes `viseme_*`, `mouthSmile`, `eyeBlinkLeft`) intact after compression —
  **verify morph targets survive**: `gltf-transform optimize` can prune them if flags are wrong;
  test lipsync in the running app or inspect with `gltf-transform inspect`.
- Avatar switching still works (lazy path tested for Marcus/Priya + alternative classroom).
- `yarn build` passes.

## Do NOT

- Do not touch camera constants, anchors, or any positioning — desk-quiz placement was
  painstakingly probed (see `.claude/docs/` and memory notes).
- Do not move `/learn` or restructure the R3F component tree.

## Status checklist

- [x] FBX files removed (`Sonia.fbx` 7.25 MB, `Ryan.fbx` 2.46 MB — grep-confirmed
      zero runtime references, all `fbx` hits were Blender-workflow comments)
- [x] GLBs compressed (per-file, before -> after; see full table in the session
      report). Total across the 9 compressed files: 82.64 MB -> 30.75 MB.
      Originals preserved in git-ignored `assets-src/models/`.

  | File | Before | After |
  |------|-------:|------:|
  | Teacher_Marcus.glb | 14.13 MB | 9.63 MB |
  | Teacher_Priya.glb | 13.95 MB | 9.84 MB |
  | Teacher_Sonia.glb | 6.70 MB | 5.25 MB |
  | Teacher_Ryan.glb | 3.49 MB | 1.98 MB |
  | animations_Avaturn.glb | 6.18 MB | 1.98 MB |
  | animations_Sonia.glb | 729 KB | 499 KB |
  | animations_Ryan.glb | 578 KB | 478 KB |
  | classroom_alternative.glb | 36.99 MB | 1.47 MB |
  | classroom_default.glb | 3.89 MB | 1.12 MB |

- [x] Draco decoder self-hosted and wired (`public/draco/`, copied from
      `node_modules/three/examples/jsm/libs/draco/gltf/`; wired via
      `src/components/three/dracoDecoder.ts` calling
      `useGLTF.setDecoderPath("/draco/")`, imported for its side effect by
      both `Teacher.tsx` and `Classroom.tsx`)
- [x] Conditional preloads in place (module scope now preloads only
      `ryan` + `classroom_default`; all other avatars/classroom lazy-load via
      the existing Suspense boundaries in `Experience.tsx`, additionally
      warmed on hover/click in `TeacherControls.tsx`)
- [x] Morph targets / lipsync verified post-compression (scripted
      `@gltf-transform/core` inspection, not just visual — see report: morph
      target counts/names, animation clip names + channel counts, and skin
      joint counts are byte-for-byte identical pre/post compression for every
      file). `yarn type-check` and `yarn build` both pass. Browser-level
      lipsync/render check still recommended (see final report risk note).
