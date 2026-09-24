# Next session — V9.1b: make the Canino pair usable

Paste the block below as the first message of the new session.

---

Continue V9.1 of the teacher programme. Read `CLAUDE.md`, `.claude/docs/state.md`, then `.claude/plans/V9-REPORT.md` (round 1 and 2 sections) before doing anything. Blender is running with the MCP add-on; open `.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene.blend`, which already holds the classroom, the app's lesson camera and lights, and every candidate. Renders and sources live in that folder; `sources/` is git-ignored.

**Decided, do not re-open:** L2 fallback is Rocketbox Female_Adult_01 + Male_Adult_04 (MIT), already rendered. L3 candidate is the Canino3d pair (CC-BY, Sketchfab): `Jake` the man and `MJ` the woman. The Canino "boy" (`Frank`) is broken and out. $0 for assets and tools. I am signed in to Sketchfab in your built-in browser.

**The one blocker to solve first.** Neither file of the woman has both a good body and a face rig:
- `sources/canino/MJ_sketchfab.glb` — clean geometry, rig intact (255 bones), **zero morph targets**.
- `sources/canino/girl/source/MJ.fbx` — 69 shape keys on `CC_Base_Body` (14,164 verts), but the body mesh is warped **in its rest state** (melted forearms and hands).

Try in this order and stop at the first that works:
1. **Transfer the shape keys across.** Check whether the FBX body's 14,164 verts correspond to the GLB body parts (the GLB splits the body by material: `Object_12`, `Object_14`, …). If vertex order matches, join as shapes; if it matches only per-part, transfer per part. Deltas may be valid even though the FBX basis is warped — verify by driving a viseme and looking at the mouth, not by trusting the numbers.
2. **Re-download the FBX** to rule out a bad transfer (the first attempts truncated: the browser pane cancels in-flight downloads when the tab navigates, and the Save dialog opens at the *start* of the transfer — wait until the size stops growing, verify with `unzip -t`).
3. **Sculpt the 15 visemes by hand** on the GLB mesh (plan route 1), plus blink, brow raise and smile.

**Then, in order:**
- **The man.** Confirm `Jake.fbx` geometry is sound (it rendered correctly) and inventory his shapes: 69 on the body, of which the mouth set is Character Creator's 8 visemes (`Open`, `Explosive`, `Dental_Lip`, `Tight_O`, `Tight`, `Wide`, `Affricate`, `Lip_Open`). The app drives 15 Oculus names (`viseme_aa` … `viseme_U`) via `useTTS().getCurrentViseme()`. Decide and record: map 15 → 8, or sculpt the missing ones. Judge it on the demo narration, not on paper.
- **Re-clothe the woman.** She is in a crop top and micro skirt; that cannot teach middle-schoolers. CC0 garments are already installed in MPFB (`toigo_fisherman_sweater`, `toigo_wool_pants`, shirts01/pants01), or hide her garment meshes and fit new ones with shrinkwrap plus weight transfer.
- **Retarget.** The CC4 rig does not take the existing Mixamo clips: a world-direction pose transfer crumples the mesh to ~40% height. Build a real bone map (CC4 `CC_Base_*` → the Mixamo names in `animations_Avaturn.glb`) and bake Idle, Talking and Pointing. Watch the twist bones.
- **Export and budget.** GLB per teacher with `@gltf-transform/cli` (already a dev dependency): Draco or meshopt, resample, prune. Jake is 105k tris and MJ 57k, so decimate; state the before and after sizes.
- **Judge it in the app.** Build `pages/dev/avatar-lab.tsx` (Pages Router, like the other `/dev` pages — App Router breaks R3F) and play the demo narration with its alignment sidecars so lipsync can be seen.

**Gotchas already paid for:**
- Canino meshes are centimetre-scale and Y-up. Normalise the root by the **full** bounding box; a leftover `hide_render` flag silently gives a partial box and a 9 m character. Hide `Skate_Board`.
- `Teacher_Marcus.glb` contains a material-less 3 m icosphere; hide it in renders.
- The classroom's warm wall patch is baked into its texture, and no mesh in the app casts shadows.
- Rocketbox FBX clips import with rotations relative to the clip file's own rest pose, and bones arrive in Euler mode.

**Ground rules:** verify claims by rendering, not by reading bounding-box numbers — I got that wrong once this programme and it cost a candidate. Stop and ask before any spend, any account-gated download, or anything needing my login. Update `.claude/plans/V9-REPORT.md` and `.claude/docs/state.md` at the end.

**Fallback:** if the face rig cannot be made to work on the woman in this session, say so plainly and ship Rocketbox F01 + M04 instead. Do not pair a stylised teacher with a photoreal one.
