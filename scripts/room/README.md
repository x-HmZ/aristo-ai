# Room pipeline (V8.5)

`public/models/classroom_default.glb` is built from the pre-V8.5 classroom by a headless Blender restyle and re-bake.
Decision and before/after: `.claude/docs/decisions.md` ("Room restyled, not replaced") and
`.claude/eval/2026-09-27-v8-5-room/`.

## Rebuild

```bash
git show cb3348a:public/models/classroom_default.glb > /tmp/classroom_src.glb
blender -b --factory-startup --python scripts/room/build_studio_room.py -- --src /tmp/classroom_src.glb --out /tmp/room.glb --res 4096 --samples 64
yarn gltf-transform dedup /tmp/room.glb /tmp/room_d.glb
yarn gltf-transform webp /tmp/room_d.glb /tmp/room_w.glb --quality 85
yarn gltf-transform draco /tmp/room_w.glb public/models/classroom_default.glb
```

The bake takes about 25 minutes on CPU (i5-1135G7) at 4096 / 64 samples. Use `--res 1024 --samples 32` (about a minute)
to iterate. The raw export also leaves `<out>_raw.exr`, `<out>_albedo.exr` and `<out>_atlas.png` next to it.

## What the script does

- Classifies each loose part by its UV0 swatch (the original palette UV) and its bounding box.
- Deletes whole parts inside the removal boxes: the lockers, the wall clock, the cork boards and their notes, and the
  chalk tray.
- Gives every class a flat palette material, then bakes the lighting into the same 4096 atlas on the same UV
  (`UVMap.001`, the lightmap UV).
- Denoises the bake with OIDN, guided by an albedo bake.
- Exports one baked material (roughness 0.5, metallic 0, as before) with the same three nodes.

Nothing structural moves, so the anchors the app reads (desk plane, floor, board plane) are unchanged.
To change the look, edit `PALETTE` or `LIGHT` at the top of the script. Everything else is wiring.

## Verify

With `yarn dev` running:

```bash
node scripts/room/verify-room.mjs probe <dir> after
node scripts/room/verify-room.mjs shots <dir> after
UNCAP=1 node scripts/room/verify-room.mjs fps <dir> after
```

`probe` must still report y -0.888 on both desks and y -1.694 on the floor, and it must hit the display at z -5.574.
The expected values are listed in the script.
