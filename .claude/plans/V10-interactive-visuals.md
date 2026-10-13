# V10: interactive visuals (a third kind of teaching visual)

## Context

Hmz learns math best from the code-driven, interactive visuals Gemini produces (sliders, buttons, a live
picture). Aristo has two visuals today: per-segment images (`/api/learn/segment-visuals`) and one 3D model
per lesson (`metadata.should_generate_model`, FLUX then Tripo). This adds a third, an interactive widget,
and puts it in the same decision the teaching agent already makes, so each topic gets whichever visual
explains it best.

Decided with Hmz (2026-10-13):
- **Generated code.** Claude writes a small self-contained widget per topic; it runs in a locked sandbox.
- **On the board, expandable.** Same spot beside the teacher where the image floats; an Expand button opens
  it large; below `lg` it opens large directly.
- **Pause for exploring.** The teacher introduces it, the lesson waits for Continue (like the challenge
  gate), and the widget stays reachable from a button afterwards.

Cost, from `src/lib/llm/pricing.ts` (Sonnet 5: $2 in / $10 out per M): about 5 cents per widget
(4 to 6k output tokens), paid once per concept, then cached.

## Design

### 1. The decider (`src/lib/agents/teaching.ts`)
- `LessonPayload.metadata.interactive?: InteractiveSpec` and the same object in `_metadataSchema`:
  `{ goal, brief, controls: [{ label, kind: "slider"|"toggle"|"stepper"|"choice", effect }], try_this: string[] }`
  (`try_this` = 1 to 3 short prompts shown under the widget).
- Adaptive segments: new `SegmentRole` `"explore"`. Exactly one explore segment when `interactive` is set,
  in Demonstrate, whose text introduces the widget and names its controls by the spec's labels.
- Prompt rules (both prompts, one new block): choose interactive when understanding comes from **changing
  an input and watching the result** (functions and graphs, slope, fractions, ratios, angles, area,
  probability, speed/distance/time, stepping through a loop or an algorithm). Not for static facts, not for
  physical objects (3D owns those). **At most one of 3D model and interactive per lesson.** Segment images
  stay as they are and double as the fallback.
- Free mode (`src/app/api/teach/route.ts`, Haiku): add an optional `interactive` object with the same
  shape and the same either/or rule against `should_generate_model`.

### 2. The generator
- `src/lib/agents/models.ts`: add `interactive` (same model as `teaching`).
- `src/lib/agents/interactive.ts`: one `tool_use` call, strict schema `deliver_interactive`
  `{ title, markup, css, js }`. System prompt: the house kit's classes and CSS variables, the spec's
  controls implemented with exactly those labels, vanilla JS only, canvas or SVG, no network, no external
  assets, no storage, no `while` loops without a bound, animation only through `requestAnimationFrame`,
  works from 320 to 900px wide, readable at grade 6 to 8, keyboard-usable inputs.
- `src/lib/interactive/` (pure, three.js-free, unit-tested):
  - `spec.ts`: types plus hand-written validators (the repo has no Zod; match `segment-visuals/route.ts`).
  - `validate.ts`: size cap (40 KB total), reject `<script`, `<iframe`, `<link`, `<meta`, `<base`, `<form`
    in markup, and `fetch(`, `XMLHttpRequest`, `WebSocket`, `import(`, `eval(`, `window.open`, `location`,
    `top.`, `parent.` (outside the bridge), any `http(s)://` in js/css.
  - `shell.ts`: `buildWidgetDoc(parts, theme)` returns the `srcdoc` string: CSP meta
    (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:`),
    the brand tokens for the theme (from `brand-system.md`), the kit CSS (slider, button, readout, canvas
    frame), and a bridge script that posts `ready` after the widget's code ran and `error` from
    `window.onerror` / `unhandledrejection`.
- `POST /api/learn/interactive` (`src/app/api/learn/interactive/route.ts`): `requireApproved()`, validate
  body `{ conceptId?, topic, spec }`, cache lookup, generate, validate output, store, return
  `{ title, markup, css, js, cached }`. Usage tag `lesson.interactive`. `maxDuration = 60`.
- Cache: migration `017_generated_interactives.sql`: `id`, `concept_id` (varchar(100), FK like 016),
  `spec_hash` unique, `title`, `markup`, `css`, `js`, `source_model`, `created_at`; RLS on, service-role
  only (the route is the only reader). Key = SHA-256 of concept id plus normalized spec. **Free-form
  topics are never stored** (same rule as `cached_lessons`), so a typed topic cannot plant a widget for
  another learner.

### 3. The sandbox (the security boundary)
`<iframe sandbox="allow-scripts" srcdoc=...>` with no `allow-same-origin`: an opaque origin, so no
cookies, no storage, no Supabase session, no parent DOM. The CSP inside blocks every network request.
The parent accepts only `{ type: "aristo-widget", event: "ready" | "error" }` messages and checks
`event.source` against the frame. `validate.ts` is a second layer, not the boundary.
Known limit, stated not solved: a widget with a runaway loop can stall the tab; the prompt forbids it and
the fixtures and live runs are checked for it.

### 4. The classroom
- Store (`src/store/useAristoStore.ts`): `activeInteractive: { status: "idle"|"loading"|"ready"|"failed",
  parts?, spec? }`, `showInteractive`, `interactiveExpanded`, `exploring`, and setters. Not persisted.
- `src/components/learn/InteractiveFrame.tsx`: the iframe, the ready/error handshake (no `ready` in 4 s
  counts as failed), theme passed into `buildWidgetDoc`, a title for the frame. Plain DOM, used in three places.
- `src/components/three/Experience.tsx`: `InteractiveBoard` at `[SCENE_X, SCENE_Y, SCENE_Z]` as a
  non-transform `<Html center>` (the toolbars' pattern; CSS-3D transforms blur, which is why the image is
  a WebGL plane). Ink-glass frame (`.theme-ink`), toolbar: Expand, Show image / Show interactive (the
  "Show 3D" pattern). Render order: interactive, then model, then image. Look target stays `board`.
- `src/components/learn/InteractiveOverlay.tsx`: the expanded view, a modal dialog through the existing
  `useModalDialog`, on the system scrim; opened directly below `lg`.
- `src/hooks/useLessonPlayback.ts`:
  - on lesson load, when `metadata.interactive` is set and not `demoMode`, fetch `/api/learn/interactive`
    in parallel with the visuals batch (the `generate-model` effect is the template); do not block
    `isLoading` on it;
  - at the explore segment: show the widget if `ready`, narrate, then set `exploring` (a second gate
    beside `awaitingAnswer`) until `continueExploring()`; if the widget is `loading` when the segment
    ends, wait up to 8 s, then go on without it; if `failed`, the segment plays over the image and there
    is no gate;
  - reset the new state on lesson swap and unmount.
- `src/components/learn/LessonPlayer.tsx` (or the bottom bar it owns): a "Your turn to explore" bar with
  the spec's `try_this` lines and a Continue button, in the bar style from V8.4b.
- Free mode (`InputBox.tsx`, `FreeTopicCard.tsx`): when the card carries `interactive`, call the route
  and show the widget on the board with the same toolbar; a failure posts the existing "couldn't create
  the visual" message.
- Copy follows `.claude/docs/brand/messaging.md` (no emoji, no em-dash, sentence-case buttons).

### 5. Dev harness, no API calls
`pages/dev/interactive.tsx` + `src/components/dev/InteractivePreview.tsx` (on `devKit.tsx`): three
hand-written fixture widgets in `src/data/dev/interactive/` (slope and intercept of a line, fractions on
a bar, stepping through a Python `for` loop) shown in the frame alone, on the board in the room, and
expanded, in both themes. The fixtures are also the few-shot examples in the generator's prompt, so what
Hmz approves by eye is what the model is asked to match.

## Steps (build on Sonnet, small commits, branch `dev/v10-interactive-visuals` off `origin/deploy-prep`)

1. Copy this plan to `.claude/plans/V10-interactive-visuals.md`.
2. `src/lib/interactive/` (spec, validate, shell) with tests.
3. `InteractiveFrame`, the three fixtures, the dev harness. Headless screenshots, both themes, 360 and 1280.
   **Stop 1: Hmz reviews the look and the board placement by eye.**
4. Store fields, `InteractiveBoard`, `InteractiveOverlay`, the explore gate in the hook and its bar,
   driven by a fixture lesson in the harness (still no API).
5. Generator agent, route, migration 017 (written; applied only with Hmz's go-ahead), models entry.
6. Decider changes in `teaching.ts` and `/api/teach`; free-mode wiring.
7. **Stop 2: live runs need Hmz's go-ahead.** Proposed: 6 topics (3 math, 2 Python, 1 that should pick 3D
   or image instead), about 6 Sonnet lessons plus 5 widgets, well under $1. Save each widget and a
   screenshot under `.claude/eval/2026-10-xx-v10-interactive/`.
8. `security-reviewer` on the route, the sandbox and the validator; `typescript-reviewer` on the rest.
9. Docs: `architecture.md` (subsystem, route, store), `decisions.md` (generated code in a sandbox, the
   either/or rule, free-form never cached), `state.md`, CLAUDE.md vision line. PR into `deploy-prep`.

## Verification
- `yarn test` (new: validator rejects each forbidden construct; shell emits the CSP and the bridge; spec
  validators), `yarn type-check`, `yarn lint`.
- Harness, headless Playwright with `--use-angle=d3d11` (the hidden pane stalls the scene): each fixture
  renders, a slider change redraws, a fixture that throws falls back to the image, the 4 s no-ready
  timeout falls back, Expand opens and returns focus, AA check on the frame, toolbar and bar in both
  themes, 0 network requests from inside the frame, 0 API calls on the page.
- Playback in the harness: the explore segment gates, Continue resumes, the widget can be reopened, a
  lesson without `interactive` behaves exactly as today, `/demo` fires nothing new.
- After stop 2 only: the six live topics, the decider's choices read against the rule, a second request
  for the same concept served from the cache with no new `usage_events` row.

## Not in this plan
- A frozen interactive for `/demo` and the landing (a strong follow-up once a generated one is good).
- Repairing a broken widget with a second model call; reporting broken widgets back to the cache.
- Widgets that report the learner's actions to the profiler.
