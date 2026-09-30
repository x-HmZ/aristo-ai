# V8.3b landing: design rounds and the note 7 face (2026-09-30)

Plan: `.claude/plans/V8.3b-landing-plan.md`. This folder holds the evidence from before the build. The build's own
evidence (load, frames, AA, captures, recordings) is added here as it lands.

## Mockups (`mockups/`)

Real HTML on the app's tokens (`mock.css` mirrors `globals.css` as hex), with:
- the real mark;
- the real heart lesson's diagram, model, lines and word timings;
- the real course map (`build.cjs` writes `data.js` from `markPaths.ts`, the KG snapshot and `seg_004.align.json`).

Open any file in a browser; `?theme=light|dark` forces a theme and `?still=1` shows the settled state. Nothing here
ships.

| Round | File | Sheet | Hmz |
|---|---|---|---|
| 1 | `a.html` Lesson Objects, `b.html` The Lit Window, `c.html` Line and Light | `shots/sheet-a..c.webp` | liked A's style and B's teacher; the tilted quiz card read badly |
| 2 | `d.html` Lesson Objects in the Room | `shots/sheet-d.webp` | wanted Jake presenting per section, with the room as one Immersive section |
| 3 | `e.html` Jake Presents | `shots/sheet-e.webp`, `e-crop-*.webp` | **approved**, with two hard requirements (plan, round 3) |

`jake/*.webp` are Jake's poses on a transparent ground (`scripts/jake-poses.cjs`, from `/dev/avatar-lab`), and
`jake/heart.webp` is the real heart alone (`scripts/heart.cjs`). **The poses' framing made Jake look slim in the hero
(Hmz); they are for the mockups only.** The build renders the product's `Teacher` live.

## Note 7: Jake's idle face (`face/`)

- `sheet.webp`: five resting faces, at face distance and at the classroom camera (zoomed 3x). Hmz picked smile 0.8
  with lids 0.12.
- `pair-sheet.webp`: Jake and MJ before and after, once shipped (54f15a6). Shipped app-wide and gain-scaled.

## Scripts (`scripts/`, all checked with `node --check`)

| Script | What it does |
|---|---|
| `face.cjs`, `face-pair.cjs` | Idle-face captures from `/dev/avatar-lab` (`?who=&view=&clip=&smile=&lid=&blink=0`) |
| `jake-poses.cjs`, `poses-sheet.cjs` | Jake's poses as transparent images, and a sheet of them |
| `heart.cjs` | The real heart model rendered alone (three 0.161.0 from unpkg; model and Draco from the dev server) |
| `mockups.cjs`, `sheets.cjs` | Full-page captures of the mockups (1280 and 360, light and dark), with overflow, and contact sheets |
| `measure.cjs` | The hero lines' width in Archivo wide caps (9.61em at wdth 125, 8.59em at 112) |
| `overflow.cjs`, `crop.cjs` | The elements past the viewport; a crop of a capture |
| `webp.cjs` | PNG to WebP in place (the captures are stored as WebP; the capture scripts write PNG) |

Every capture ran headless on the GPU with `/api` aborted: 0 API calls, 0 paid calls.
