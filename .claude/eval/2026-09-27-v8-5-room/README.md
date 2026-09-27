# V8.5 room: before and after (2026-09-27)

Each image shows the original room on the left and the V8.5 room on the right, both captured at 1280x720 and shown at
half size. All captures come from
`node scripts/room/verify-room.mjs shots` on `yarn dev`, headless Chrome on the Intel Iris Xe (ANGLE D3D11), with Jake
and the same code.

| File | Framing |
|---|---|
| `lesson_empty.jpg` | Lesson camera (`LESSON_POS` [0,0,0.9] looking at [0,0,0.4]), nothing on the board |
| `lesson_image.jpg` | Lesson camera, teaching image up at `SCENE_*` (the red square is `/dev/free-model`'s placeholder) |
| `lesson_model.jpg` | Lesson camera, 3D model up at `MODEL_*` (the dev duck) |
| `turn_right_max.jpg`, `turn_left_max.jpg` | OrbitControls at the azimuth limits (plus and minus 45 degrees) |
| `look_down_max.jpg`, `look_up_max.jpg` | OrbitControls at the polar limits (pi/6 and pi/1.8) |
| `deskquiz_desk.jpg` | `/dev/desk-quiz`, quiz on the desk (`DESK_POS` / `DESK_TARGET`, `PAPER_ANCHOR`) |
| `deskquiz_lesson.jpg` | `/dev/desk-quiz` toggled back to the lesson framing |
| `blender-overview.jpg` | Blender render of the baked atlas alone (no runtime lights), wide view from the back of the room |

## Anchor probes (`verify-room.mjs probe`, `/dev/desk-quiz` SceneProbe)

| Probe | Before | After |
|---|---|---|
| Student desk, centre and both corners (x,z = 0,-0.5 / -0.4,-0.3 / 0.4,-0.75) | y -0.888 | y -0.888 |
| Second-row desk (0.3, -2.35) | y -0.888 | y -0.888 |
| Floor below `SCENE_*` (0.37, -3) and in front of the board (0.45, -5.4) | y -1.694 | y -1.694 |
| Locker corner (-3.2, -5.2) | locker top y 0.541, then floor | floor y -1.694 (lockers gone) |
| Board or display, clicked from the lesson framing | z -5.574, normal +z | z -5.574, normal +z |
| Right cork board spot | cork z -5.574 | wall z -5.617 (cork gone) |

Nothing structural moved, so no constant in `Experience.tsx`, `CameraController.tsx`, `DeskQuiz.tsx` or `Classroom.tsx`
changed.

## Budget

| | Before | After |
|---|---|---|
| `classroom_default.glb` | 1,122,712 B | 1,065,188 B (limit 2 MB) |
| Room draw calls | 3 meshes, 1 texture (4096 WebP) | the same |
| Frame draw calls (`/dev/free-model`, empty stage) | 32 | 32 |
| Uploaded vertices | 70,407 | 61,746 |
| fps, vsync on | 60 | 60 |
| fps, uncapped (9 x 8 s runs each, interleaved) | mean 126 (range 100 to 153) | mean 153 (range 136 to 174) |

The uncapped runs are noisy on this laptop. The after runs are not slower, which meets the within-10% bar.
