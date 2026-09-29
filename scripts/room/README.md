# Room pipeline (V8.5)

Both classroom GLBs are built from the pre-V8.5 classroom by a headless Blender restyle and re-bake:

| Variant | Ships as | Picker label | What it is |
|---|---|---|---|
| `day` | `public/models/classroom_default.glb` | Classroom | The original room restyled in place: a blue-grey front wall behind the teacher (V8.5b) with light grey side walls, pale oak, a display for the chalkboard. The same UV and atlas, three draw calls |
| `evening` | `public/models/classroom_alternative.glb` | Evening | The same shell as a one-to-one study at dusk: only the learner's desk, a reading nook, pendant lamps, CC0 Poly Haven props. A regenerated lightmap UV, everything joined into one mesh, and the bake exported as an emissive texture so the app shows it as-is |

Decisions and before/after: `.claude/docs/decisions.md` (search "V8.5") and `.claude/eval/2026-09-27-v8-5-room/`.

## Rebuild

```bash
git show cb3348a:public/models/classroom_default.glb > /tmp/classroom_src.glb
node scripts/room/fetch-props.mjs /tmp/room_props
blender -b --factory-startup --python scripts/room/build_studio_room.py -- --src /tmp/classroom_src.glb --out /tmp/day.glb --variant day --res 4096 --samples 64
blender -b --factory-startup --python scripts/room/build_studio_room.py -- --src /tmp/classroom_src.glb --out /tmp/evening.glb --variant evening --props /tmp/room_props --res 4096 --samples 128
```

`fetch-props.mjs` is only needed for `evening`. Compress each raw export with the T02 recipe:

```bash
yarn gltf-transform dedup /tmp/day.glb /tmp/day_d.glb
yarn gltf-transform webp /tmp/day_d.glb /tmp/day_w.glb --quality 85
yarn gltf-transform draco /tmp/day_w.glb public/models/classroom_default.glb
```

Bakes run on CPU (i5-1135G7): the day bake takes about 30 minutes, the evening one about as long at 128 samples. Use
`--res 1024 --samples 32` (a minute or two) to iterate. The raw export also leaves `<out>_raw.exr`, `<out>_albedo.exr`
and `<out>_atlas.png` next to it.

## What the script does

- Classifies each loose part by its UV0 swatch (the original palette UV) and its bounding box.
- Deletes whole parts inside the removal boxes: the lockers, the wall clock, the cork boards and their notes, and the
  chalk tray. The evening variant also removes every school desk and chair outside the learner's and the teacher's
  corners, and replaces the tiled floor with one plane at the tiles' height.
- Gives every class a flat palette material. Evening also adds the rug, the Poly Haven props, and the pendant cords and
  bulbs.
- Bakes the lighting into one 4096 atlas. Day reuses the original lightmap UV (`UVMap.001`); evening regenerates one
  across everything it bakes.
- Denoises the bake with OIDN, guided by an albedo bake.
- Exports one baked material.

Nothing structural moves, so the anchors the app reads (desk plane, floor, display plane) are the same in both rooms.
To change a look, edit `PALETTES`, `LIGHTS` or `SKY` near the top of the script (or try a wall colour with `--wall` / `--wall-side`). Everything else is wiring.

Props must be real geometry: most Poly Haven plants are alpha-cut leaf cards, which one opaque baked atlas cannot show.

## Verify

With `yarn dev` running (add `ROOM=alt` for the evening room; set `CHROME=<path>` if Chrome is not at its default
Windows location):

```bash
node scripts/room/verify-room.mjs probe <dir> after
node scripts/room/verify-room.mjs shots <dir> after
UNCAP=1 node scripts/room/verify-room.mjs fps <dir> after
```

`probe` must still report y -0.888 on the learner's desk and y -1.694 on the floor, and it must hit the display at
z -5.574. The expected values are listed in the script. The evening room has no second-row desk, so `DeskPaper` is not
mounted there (`Classroom.tsx`, `PLACEMENT.alternative.desk = null`).
