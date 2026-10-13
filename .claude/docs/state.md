# Aristo AI — Current State & Next Steps

_Update this at the end of every significant session: done / next / blockers, compact._

## 2026-10-06 - V8.7: assets and cleanup, the last V8 step (merged into deploy-prep, #24)

Branch `dev/v8-7-cleanup` off `origin/deploy-prep`. Brief: `.claude/plans/V8-7-assets-and-cleanup.md`. Evidence:
`.claude/eval/2026-10-06-v8-7/` (README). Planned on Opus, built on Sonnet; Hmz picked the OG layout and confirmed the
dead-code list (two stops).
- **In-room overlays:** "Your turn" (an emoji, 3.99:1), the teacher's "Thinking" chip and a generated model's annotation
  labels are ink-glass pills now (10.9:1).
- **/dev pages** on the tokens through `dev/devKit.tsx` (min contrast 1.17 to 5.48; 36px desktop controls).
- **Link-preview image:** wordmark, outlined headline and a wide still of the lit classroom (Jake and the brain) that fades
  into the ink; Hmz picked this "blend" (B) from three. `brand/OgCard.tsx`, `public/images/og/room.jpg`
  (`scripts/brand/og-still.mjs`). Follow-up (`fix/og-jpeg`): served as a 74 KB JPEG (4:4:4) instead of a 510 KB PNG.
- **Dead code removed:** 22 of 26 `--aristo-*` tokens, the aristo gradients and shadows, `.text-gradient`, 9 `BRAND_HEX`
  keys. The compiled CSS differs only in the `:root` block (22 declarations gone, none new). Kept: orange-main, backdrop,
  purple, amber.
- **Measured:** AA 0 failures on every changed state and on the production `/`, `/demo`, `/sign-in`, `/sign-up` in both
  themes at 360 and 1280; tests 505 (the removed tokens' own checks), lint 0 errors; 0 API calls.
- **Open:**
  - the OG image does not carry Jake's CC BY credit (it is on the page; LICENSES.md row);
  - `public/images/landing/v3/idea.webp` stays as the proportions reference.
- **V8 is complete.** Merged as #24. Portfolio brief written as a Claude doc (capture list, page structure, copy).

## 2026-10-06 - V8.6: the app pages onto the brand system (merged into deploy-prep, #23)

Branch `dev/v8-6-app-pages` off `origin/deploy-prep`. Evidence: `.claude/eval/2026-10-05-v8-6-app-pages/` (README, sheets).
Hmz approved the plan, reviewed stop 1, and picked: admin drawer below md, mastery icon + word, review by screenshots.
- **Learner (/learn):** onboarding, course map and dashboard on the tokens, `.theme-paper` pins removed, emoji gone.
  Mastery tiers are an icon and a word (`learn/mastery.tsx`, Mastered a solid star); stats are ink with icons;
  44px targets; mode picker, course map and dashboard are modal dialogs (`useModalDialog`).
- **/create-teacher** on the tokens, lock dropped; **/pending** and the auth pages audited (already passing; /pending
  split into `PendingView` for the harness only).
- **Admin:** a drawer below md; token pass (`admin-tokens.cjs` codemod plus hand pass; `admin/chart.ts` for
  Recharts); categorical data-viz keeps its hues (decisions.md). The light lock is retired everywhere.
- **Measured:** AA 0 failures on every surface in both themes at 360 / 768 / 1280 (learner min 5.25, create-teacher
  4.98, admin 4.55, from 784 / 172 / 4,436 failures); 0 targets under 44px (from 1,782); 0 overflow; 0 API calls in
  the harnesses; real admin data checked in the pane, view only. Tests 558, lint 0 errors. Production build: /sign-in,
  /sign-up and /demo 0 failures, 0 API calls. Two code reviews (typescript-reviewer): no high findings; the mediums
  (drawer close on same-page links and past md, dialog semantics) fixed.
- **Open:** the in-place dialogs focus the panel, not a fallback, when their opener unmounts (mode picker to course
  map); harness-only: `/hx/admin` fails its server render in dev (Next's internal pathname context) and renders client-side.
- **Not done:** the sign-up to learn flow walk with a test account (Hmz chose screenshots); React Flow canvas
  graphics are not checked as text.
- **Next:** merged as #23 after Hmz saw the sheets; V8.7 (`dev/v8-7-cleanup`), brief in `.claude/plans/V8-7-assets-and-cleanup.md` (Sonnet).

## 2026-10-05 - The opening's Skip never cream on the lit page (merged into deploy-prep, #22)

Branch `fix/intro-skip-contrast` off `origin/deploy-prep`. Evidence: `.claude/eval/2026-10-05-intro-skip/`.
`check.cjs` without `?nointro` had caught "Skip intro" at 1.05:1 (360 lite light) as the cover faded.
- `.landing-intro` is ink while `on`/`playing` (under its canvas; looks the same), clears at `lifting`; Skip is hidden
  there and at `done` (visibility, opacity, pointer events, no transition). The cover's fade is unchanged.
- Measured (production): check.cjs no `?nointro` 360/768/1280 light+dark 0 failures (min 4.74); every frame of 18
  plays (`skip.cjs`) Skip min 10.49, never visible after the lift; plays and skips (key, tap) to `done`; tests 556,
  lint 0 errors.
- **Next:** V8.6, the app pages onto the brand system (`dev/v8-6-app-pages`), then V8.7.

## 2026-10-05 - V8.3d: softer, looser teacher shirts (merged into deploy-prep, #21)

Branch `dev/v8-3d-shirts` off `origin/deploy-prep`. Evidence: `.claude/eval/2026-10-04-v8-3d-shirts/` (README: sheet A2,
three fit rounds, QA, files). Hmz picked at each stop; no paid generation.

- **Colours:** Jake sage (swatch #A9C6A4, code #7CA772), MJ lavender (#C3B1E1, code #AA89E5), each solved on the
  shipped cloth so the lit shirt renders as its swatch (`shirts.cjs`, ONLY= / SHEET=). Butter merged with the page.
- **Cloth:** both shirts cut above the waist and regrown loose (`v9_loose.py`): untucked (Jake 7 cm below his
  waistband, shirt-tail curve; MJ 4 cm over the skirt, A-line), relaxed ease, every section convex (no leg-torso V),
  Jake's sleeves 3 cm shorter with the forearm skin V9.1c masked put back (`restore_skin`), buttons ride the cloth.
  Fold normal map baked in-house (`v9_fabric.py`); roughness 0.88, sheen in the shirt's colour (`outfit.ts`); no
  weave (it baked as moire). GLBs: Jake 2.36 MB (+79 KB), MJ 1.81 MB (+33 KB); clip packs byte-identical.
- **QA:** `v9_loose_qa.py`, 34 clips, every 2nd frame, per side, against the V8.3c shirts: no garment through a hem
  (the old shirts let some out), no shallow skin poke but one hidden in MJ's armpit; armpit cloth contacts about 1.5x
  the old ones and hidden; left and right joints matched on the peak sheets.
- **Shipped:** every landing poster and both chooser faces recaptured; /demo checked for both teachers (0 API).
- **Measured (production):** AA 0 failures (min 4.74, `?nointro`), 0 small targets, 0 overflow, both teachers; bounds
  0 px out at every spot; section p95 16.7 to 16.8 ms, CLS 0, LCP the hero poster (V8.3b's hero start-up frames as
  before); switch longest frame 17 ms; room pointing 8.3 / 6.6 deg; tests 556; lint 0 errors; 0 API calls.
- **Not done:** /learn not checked signed-in (Hmz skipped it; /demo uses the same Teacher and was checked).
- **Next:** merged as #21 after Hmz's review; V8.6 is next (see the entry above).

## 2026-10-03 - V8.3c: a model worth turning, coloured shirts, Jake or MJ, the opening (merged into deploy-prep, #20)

Branch `dev/v8-3c-landing` off `origin/deploy-prep`. Evidence and numbers: `.claude/eval/2026-10-03-v8-3c-landing/`
(README; `video/dark.webm`). Plan approved by Hmz; he picked at each stop (shirts, topic, model, voice, opening).

- **Shirts:** Jake forest, MJ plum, app-wide, at mount (`three/outfit.ts`, `AVATAR_ASSETS.*.outfit`).
- **The room teaches the brain:** a new real demo lesson (`src/data/demo/brain.ts`, `scripts/generate-demo-brain.ts`;
  not in DEMO_TOPICS until it is narrated), its NB Pro diagram on the board, the Tripo3D brain turning so the
  cerebellum and brainstem come round as named, with labels; the brain quiz on the desk; three of its sentences in
  each teacher's voice (`scripts/landing-voice.mjs`). The volcano's rock is gone from the room (/demo still has it).
- **Teacher chooser:** hero "Your teacher: Jake | MJ", page-wide, kept for the tab, posters per teacher
  (`v3b/mj/`), Try a lesson opens `/demo?teacher=`; the live switch dissolves into light and forms the other, who
  waves (`stage/dissolve.ts`); a hover pre-warms the other teacher (kept mounted). MJ's bones are suffixed:
  `stage/bones.ts`. Placements per teacher (`heartFor`, `roomModel`), measured from the bones.
- **The opening, Spark to Teacher** (`landing/intro/`): about five seconds, once per tab, raw WebGL2 in its own
  chunk; a pre-paint cover with failsafes; the stage waits for it.
- **Measured:** `/` 131 kB; 0 AA failures (min 4.74) for both teachers, 0 small targets, 0 overflow 360 to 1440;
  p95 16.7 to 16.8 ms everywhere; switch longest frame 17 ms; opening p95 16.8 ms with 1 to 3 GPU-side spikes;
  LCP unchanged; tests 554; lint 0 errors. fal $1.37 of $2.
- **Reviews:** security nothing above medium (the eval ledger); code review's high and mediums fixed (README).
- **Follow-up (2026-10-04, Hmz: "fix the not done"):** the room's diagram now lifts off the board as points onto the
  brain before it solidifies (`RoomScene.tsx buildPoints`, `room.ts MODEL_BUILD`); the brain lesson is narrated
  (Antoni, 3,918 characters, the free plan's last for the month, until 9 Oct) and is /demo's third topic; /demo's
  volcano lesson no longer offers a 3D model (Hmz; its GLB deleted); the chooser's pressed look comes from
  `html[data-teacher]` in CSS, so an MJ-first load is right from the first paint, and a change is announced.
- **Open:** ElevenLabs renders are on the free plan (not for commercial use: re-render on a paid plan before launch);
  in /demo MJ still speaks with the male narration; the hero start-up frame (V8.3b's).
- **Next:** merged as #20 after Hmz's review.

## 2026-10-03 - V8.3b merged into deploy-prep (#19; #18 closed)

PR #19 merged into `deploy-prep` (production deploys from it). Evidence for the last round:
`.claude/eval/2026-09-30-v8-3b-landing/session3/fixes/`.

- **Hmz's review fixes (2026-10-02), all in #19:**
  - Five Moves: the board is a list in normal flow, its links drawn from the orbs' measured centres (they started
    and stopped at the wrong orbs); each group under its move's name; what you know feeds the idea (no chain); the
    mountain icon replaces the sparkle.
  - The map: the next lesson ("for Loops") named in a legend; its link from Lists drawn lit and flowing; the course
    named.
  - For Parents: the page's one tint band.
  - The close: Try a lesson gets the hero's palm offer; the close and hero framings keep the offer in the box (hero
    need 0.22; it was 3 px from the edge once the offer was really triggered).
  - The speed check judges 90 frames in a row at one live spot (a fast machine scrolling at once went to lite).
- **Measured:** every gesture lands (Five Moves pieces within 4 px, the close's offer 1.7 degrees off the button);
  0 px out of every box; AA 0 failures both themes (min 4.74 light, the parents' eyebrow on the tint); 0 small
  targets; 0 overflow at 360 to 1440; `/` 130 kB; tests 86; lint 0 errors.
- **Open (not urgent):** hero frames up to about 150 ms just after he is live (clip-pack binding); a resized room
  texture for the landing (decide with Hmz); the per-frame `getBoundingClientRect` reads in the stage driver.
- **Next:** Hmz's small fixes in a new session (not landing-build work); then V8.4 / V8.6 (classroom, admin and
  create-teacher onto the brand system).

## 2026-10-01 - V8.3b build, session 3 done: Immersive, For Parents, the close, review, verification; PR open

Branch `dev/v8-3b-landing`, pushed, PR into `deploy-prep` (supersedes #18). Evidence:
`.claude/eval/2026-09-30-v8-3b-landing/session3/` (immersive/, parents/, close/, verify/, perf/; README "Session 3").

- **Built:** Step Into the Classroom (the product's room, a camera tour on the section's clock: in to the seat, he
  explains; the board, he points at the volcano cross-section; the model it becomes, presented from his fingertip;
  a glance at the quiz on your desk. Tabs, drag to look around, Pause, Hear it; loads only near the section). For
  Parents on the system (promises on the product's paper). The close waves each time it comes into view.
- **Shown to Hmz, no reply yet:** Immersive (tour, peaks, controls), For Parents, the close's wave peaks. It
  Remembers still has no comment from him; ask before changing it.
- **Perf:** the hero start-up frame (500 to 850 ms of shader first-draws) is fixed by `warm.ts drawEach`; the room
  never warms into a render target. Left: frames up to about 180 ms at the hero after he is live and during a very
  fast scroll near the room (its one-off load). p95 16.7 to 16.8 ms everywhere; `/` 129 kB.
- **Reviews:** security nothing above low; code review fixes in 8d6da5a (room preload, reset on leaving, failed room,
  focus). Not done from it: per-frame `getBoundingClientRect` and small allocations in the driver (measured frames
  are fine), the module-level TARGET arrays.
- **Measured:** 0 AA failures (min 5.11 light, 5.48 dark), 0 targets under 44 px, 0 overflow at 360 to 1440, bounds
  0 px out, tests 86, lint 0 errors and 10 warnings, 0 API and 0 paid calls.
- **Next:** Hmz's review of the PR and of Immersive / For Parents / the close; then merge into `deploy-prep`; close
  #18 (not done: ask). Optional: a resized copy of the room's 4096 px texture for the landing (decide with Hmz).

## 2026-10-01 - V8.3b build, session 2 done: Five Moves and It Remembers built and reviewed; Ideas removed

Branch `dev/v8-3b-landing` (no upstream, nothing pushed). Last code commit 613917b, evidence 4c7cce0. Evidence:
`.claude/eval/2026-09-30-v8-3b-landing/session2/` (moves/, remember/, posters/, bounds).

- **Page order now:** hero, A Teacher of Your Own (#idea), It Draws a Diagram, It Builds a Model, One Lesson, Five
  Moves (#how, nav "How it works"), It Remembers What You Know (#map), For Parents (old, not restyled), Close (old),
  footer. **It Finds the Ideas Inside was removed** (Hmz: Five Moves covers it and looks better).
- **Five Moves (story, Hmz approved):** Jake beside the classroom's dark display. Each move's gesture (director
  signals: hook/Imagine, explain/HoldIdea, demo_step/StepBeat x3, challenge_setup/YourTurn, connect/BringTogether, plus
  the "that's right" reaction) makes a piece at his hands (placed per frame from bones via `shared.hands.onReport`,
  same frame as the render), which then flies to its place on the board: the volcano lesson's outline (summaries, not
  lines). "Next" hangs from the answer (Hmz). Files: `sections/Moves.tsx`, `MovesBoard.tsx`, `MovesHands.tsx`.
- **It Remembers (built, shown to Hmz, not yet commented on):** a paper card with one real concept (Variables and
  Assignment) over three weeks; Jake points (PointNear, aimed) at each review point as the line reaches it, all inside
  the clip's ~3.7 s hold; then the real course map on the dark display. `sections/Remember.tsx`.
- **Fixes Hmz asked for:**
  - posters = first live frame everywhere: stills placed by the live framing in CSS (`spots.ts stillCss`,
    unit-tested), recaptured at the first live frame; `idea.webp` had been clipped by the capture viewport.
  - Jake never out of bounds: `scripts/bounds.cjs` (probe-only `?probe&wide=` view); Five Moves' Imagine spread was
    85 px out. Fixed with `need` per spot; now >= 23 px clear at 768 to 1440.
- **Stage additions:** aim glides between targets and, on pointing spots, turns the index finger (`aim.ts` `finger`);
  picture pointing now 0.4 deg. Section clocks have a reader pause (`play.ts setPaused`).
- **Measured:** AA 0 failures (min 4.74 light, 5.48 dark), 0 targets under 44 px, 0 overflow 360 to 1440, tests 89,
  lint 0 errors, 0 API and 0 paid calls. Gesture peaks: every piece within 4 px of its hand; taps within 4 px.
- **Open / next session:**
  1. Immersive ("Step Into the Classroom"): the room, the volcano lesson, a camera tour you can drag; loads only near
     the section.
  2. For Parents restyled on the system.
  3. The close: waves goodbye each time it comes into view (today it remounts only on a spot change).
  4. Steps 10 to 12: stills (recapture `picture.webp` end still: the finger aim changed) and the lite/stack paths;
     verification (perf, the two long frames: hero start-up 83 to 150 ms, 133 ms in a steady scroll at 1440);
     `code-reviewer` + `security-reviewer` (driver hooks touch Teacher.tsx) with fixes; docs (decisions,
     brand-system, messaging; delete `stage/scroll.ts`, `timeline.ts` leftovers, old `HeartBuild`? check use,
     unused `classroom-*.webp` and `v3/*` except `idea.webp`); then the PR into `deploy-prep`, superseding #18.
- **Gotcha:** never run `next dev` with a stray `next start`/`build` on the same `.next` (500s on localhost).

## 2026-10-01 - V8.3b build, session 1 done: nav, hero, idea, ideas, picture, model built and reviewed by Hmz

Branch `dev/v8-3b-landing` (no upstream, nothing pushed). Last commit b73e4e0 plus the docs commit after it.
Evidence: `.claude/eval/2026-09-30-v8-3b-landing/` (README rounds 1 to 6; `first-sections/`, `sections-r5/`,
`sections-r6/`).

- **Built, in page order:**
  - nav (pill, sheet below lg);
  - **hero:** Jake left, text right. He waves with his left hand and follows the pointer. On Try a lesson he offers
    his left palm, aimed at the button, with his head and eyes on it. A tap waves; coming back waves.
  - **A Teacher of Your Own:** the beats rise and the colonnade draws. He holds the idea, an orb that flies into the
    mark's middle flute and lights it.
  - **It Finds the Ideas Inside (volcano):** the classroom's dark display; the ideas come out of a thinking glow as
    orbs and form a constellation. He points (PointNear) at the magma chamber's orb.
  - **It Draws a Diagram (volcano):** the cross-section resolves (noise, lines, colour) and he points at the crater.
  - **It Builds a Model (heart):** the infographic lifts into points onto the heart. PresentModel's palm meets its
    edge. Drag or Turn it.
  - **For Parents:** the old V8.3 one, not yet restyled.
  - **Close:** a spot that waves.
  - Footer.
- **How the stage works** (read before adding a section):
  - `stage/host.ts`: one canvas over the most visible spot.
  - `stage/spots.ts`: the classroom eye, plus a crop per spot; `need` keeps a reach in frame.
  - `stage/scripts.ts`: the per-spot director signals and the timelines.
  - `stage/aim.ts`: aims a hand at a target after the pose.
  - LandingStage: `TARGET`, `gestureAt`, `withhold` (never Pointing; the hero also never Talking6).
  - `play.ts`: the section clocks; a spot's graphic plays once Jake is live there.
  - Posters: `<spot>-start.webp` on the live path and `<spot>.webp` on lite.
- **Teacher.tsx** (product) gained three optional driver fields, used only by the landing: `viewer`, `afterPose`,
  `withhold`. The classroom passes no driver and is unchanged.
- **Hmz's rules learned this session** (memory `landing_features_not_a_lesson`):
  - features, not a lesson;
  - every gesture lands on a real thing, verified from the bones with peak frames;
  - a section's poster is its first frame;
  - one visual language: the idea's orb of light, the dark display, chalk and paper.
- **Measured** (`sections-r5/perf.json`, `sections-r6/check.json`):
  - `/` 118 kB first load (budget 135); `/demo` and `/learn` unchanged;
  - LCP 152 to 428 ms; CLS 0;
  - every section plays at p95 16.8 ms with 0% dropped;
  - 0 AA failures in both themes; 0 targets under 44px; 0 overflow at 360 to 1440;
  - tests 519, lint 0 errors and 10 warnings.
- **Open:**
  - the hero's single 83 to 150 ms start-up frame, and one 133 ms frame in a steady scroll at 1440 light (likely
    Jake's remount at a spot change): find both with long-frame attribution;
  - `stage/scroll.ts` and `timeline.ts` are now used only by `timeline.test.ts` and the old V8.3 camera poses
    (Immersive may reuse the poses; delete the rest);
  - three unused `public/images/landing/classroom-*.webp` and the old `public/images/landing/v3/*` stills (except
    `idea.webp`, the proportions reference) go in step 10.
- **Next (new session):** plan section 8 from the rest of step 7 on.
  1. Five Moves (in plain words);
  2. It Remembers (map and curve);
  3. Immersive (the classroom room, volcano, camera tour, drag to look);
  4. For Parents restyled on the system;
  5. the close;
  6. then steps 10 to 12: stills and lite, verification plus the `code-reviewer` (and `security-reviewer`: the
     driver hooks touch Teacher), then docs (decisions, brand-system, messaging). Then the PR into `deploy-prep`,
     superseding #18.

## 2026-09-30 - V8.3b: direction E approved by Hmz; build next (new session)

- **Direction E, "Jake Presents"** (`mockups/e.html`, `shots/sheet-e.webp`): A's page. Jake appears on his own in
  each section beside its short motion graphic, and does something with it. The room is one "Immersive" section with
  a camera tour. Nothing is pinned or scrubbed.
- **The plan:** `.claude/plans/V8.3b-landing-plan.md`. Round 3 at the top is the direction and the two hard
  requirements; sections 5 to 8 give the perf plan, the notes, what is kept and deleted, and the build order.
- **Hard requirements (Hmz):**
  - nothing may look wrong (the mockup's slim hero Jake was the capture framing; the build renders the product's
    `Teacher`, compared side by side with the classroom render);
  - gestures land on real things at the right scale, placed from Jake's hand bone at the gesture's peak and verified
    with peak frames.
- **Already done:** note 7, the face (54f15a6); note 8, the paper (cc03e22).
- **Next session:** start at plan section 8, step 2. Build a section at a time, and show Hmz the first live sections
  (nav, hero, the model build) before the rest. Evidence goes in `.claude/eval/2026-09-30-v8-3b-landing/` (its
  README lists the scripts).

## 2026-09-30 - V8.3b: direction D (A's page + the V8.3 immersion) mocked; face and desk paper done

- Round 2 (Hmz): A's style plus B's teacher as a main part of the look, with the V8.3 immersion but none of its UX.
  D is mocked (`mockups/d.html`, `shots/sheet-d.png`). No tilted cards. The Idea keeps its own section.
- Committed: 54f15a6 (resting face smile 0.8 and lids 0.12, app-wide, gain-scaled; Jake and MJ checked in
  `face/pair-sheet.png`) and cc03e22 (the placeholder paper removed from the classroom). Tests 485, lint 0 errors
  and 10 warnings.
- **Next:** Hmz's go on D and the desk-card question (plan section 9), then the build order in plan section 8.

## 2026-09-30 - V8.3b planned: waiting for Hmz to pick a direction (no product code yet)

- Branch `dev/v8-3b-landing` from `origin/dev/v8-3-landing` (93e913a), upstream unset.
- Plan: `.claude/plans/V8.3b-landing-plan.md`, covering the research with links, three directions (A Lesson Objects,
  recommended; B The Lit Window; C Line and Light), the section list with motion, where Jake appears, the perf plan,
  the 8 notes, and 4 questions.
- Evidence in `.claude/eval/2026-09-30-v8-3b-landing/`: `mockups/` (real HTML on the tokens, and `shots/sheet-*.png`
  at 1280 and 360, light and dark) and `face/sheet.png` (note 7, five idle faces).
- `scripts/`: `mockups.cjs`, `sheets.cjs`, `face.cjs`, `measure.cjs`, `overflow.cjs`.
- Dev harness only: `/dev/avatar-lab` reads `?who=&view=&clip=&smile=&lid=&blink=0`.
- **Next:** Hmz answers the plan's section 10, then the build order in section 9.

## 2026-09-30 - V8.3 reviewed by Hmz: redo the landing as a website (next session; PR #18 not merged)

Hmz saw the V8.3 scroll story (entry below, PR #18) and wants it redone in a new session, as V8.3b.

- **The direction:**
  - The page must look like a landing page: a modern, creative, real website, with a much better navbar and proper
    sections and components.
  - The whole page being the classroom is fine only if immersion is a deliberate, emphasised part of the story.
  - Motion graphics need not come from Jake or the room: design them freely to the Night Class vibe.
  - Reference the lesson rather than replaying it. Anything that plays runs like a short demo at a readable pace, not
    scroll-scrubbed; the pinned scroll-through felt unintuitive.
- **His notes on this build:**
  1. Start with Jake idle, not facing the board.
  2. The dark ink-glass title chips ("A Teacher of Your Own") do not carry the app's vibe.
  3. The Column mark drawn in ink blends into the room in dark mode.
  4. The scroll-through is not intuitive.
  5. "It Remembers What You Know" and "For Parents" feel out of place with the rest of the page.
  6. The goodbye wave plays only once.
  7. Jake's idle face is too blank: friendlier, not a full smile.
  8. The classroom's old placeholder paper (Classroom.tsx StudentDeskPaper) shows under the desk card.
- **Reusable from dev/v8-3-landing:**
  - `/` in the Pages Router, and the gate (full / lite / stack);
  - the poster-as-LCP approach;
  - the opt-in sound (`stage/sound.ts`);
  - the KG snapshot, Jake's credit and the 44px footer;
  - the `Teacher` `driver` prop and the warm-up (`stage/warm.ts`);
  - the resized `public/landing/heart.glb`;
  - the eval scripts and the perf lessons in the eval README (lazy parts warmed before use, no per-frame SVG filters,
    host-level pause state, idle writers skipped).
- **Next:** V8.3b in a new session (prompt given to Hmz); V8.6; V8.7.

## 2026-09-30 - V8.3 landing v3 done: a scroll-driven story with the live classroom (Opus plan approved by Hmz)

Branch `dev/v8-3-landing` off `origin/deploy-prep` (83c6f37, #15 and #17 in it; no upstream set); PR into
`deploy-prep`. Plan and storyboard: `.claude/plans/V8.3-landing-plan.md` (Hmz: the recommendations plus 6B desk
challenge, 7C editorial map, 8B goodbye wave). Decisions: the eight V8.3 rows in decisions.md. System: brand-system.md
"Landing (V8.3)" and Motion. Copy: messaging.md "Landing copy, V8.3". Evidence: `.claude/eval/2026-09-30-v8-3-landing/`.

- **Shipped:**
  - `/` moved to the Pages Router (`pages/index.tsx`, static). `src/components/landing/`: `LandingRoot`, pinned
    sections, `content.ts`, `mapStory.ts` and `stage/` (timeline, scroll driver, gate, the R3F stage, diagram and heart
    shaders, warm-up, opt-in sound).
  - The story, section by section:
    - the opening window opens to full bleed as the camera enters the room;
    - the idea: the Column draws itself, and the story shows on the display;
    - from a question to a lesson: the topic types itself, the ideas link up, five cards with the real first lines,
      the real `teaching.jpg` resolves from noise through sketch to colour, and `source.jpg` lifts into points onto
      the real model;
    - one lesson, five moves, with the challenge on the desk;
    - the map beside one concept's memory curve (a real course, an example learner);
    - the parents;
    - the close, where Jake waves goodbye.
  - `Teacher` gained an optional `driver` prop. The landing drives the director from scroll with the product's own
    signals.
  - `Experience.tsx` exports its lights and renderer config. Nothing in `src/lib`, `src/store`, `src/hooks` or
    `src/app/api` changed.
  - Modes: full, lite (phones, weak GPUs; 12 stills captured from the stage), and the stack (reduced motion, no JS).
    The stage hands over to lite if it is slow, throws, or its chunk fails.
  - `scripts/snapshot-kg.ts`, local only (anon key; published courses only). `public/landing/heart.glb`: the real
    model resized, 624 kB. Footer links are 44px and carry Jake's CC BY credit.
- **Measured** (headless on the GPU, production build):
  - `/` is 127 kB first load (was 122; budget 135). `/demo` and `/learn` are unchanged.
  - The LCP is the poster everywhere (188 to 504 ms). CLS 0.
  - Scroll p95 16.8 ms at 360 to 1440 in both themes, with 0.4 to 3.6% of frames dropped. Lite under a 4x CPU
    throttle drops 8.4 to 8.6%.
  - AA: 5,412 nodes, 0 failures, minimum 5.11 light and 5.48 dark (the stack 4.74). No target under 44px, no overflow.
  - 0 API and 0 paid calls in every run.
- **Deviation:** GlanceBoard has no director signal (only the 25 s long wait), so the idea and diagram beats use
  Pointing and PresentModel instead. A scripted cue would need `src/lib/avatar/director.ts`: ask Hmz.
- **Gates:** type-check clean; lint 0 errors and 10 warnings; tests 482 (441 + 41); build green. The `code-reviewer`
  found 2 high, 7 medium and 4 low; all fixed (eval README, "Review").
- **Next:** V8.6 (admin, then onboarding, course map, dashboard and create-teacher onto the tokens); V8.7 (re-capture,
  cleanup: the three `public/images/landing/classroom-*.webp` are now unused).

## 2026-09-30 - Desk quiz at portrait sizes done: the whole card on every phone, 44px targets (Opus plan approved by Hmz, Sonnet execution)

Branch `dev/desk-quiz-portrait` off `origin/deploy-prep` (b3cc79b, #15 and #16 in it; no upstream set); PR into
`deploy-prep`. Decisions are the five rows starting "Desk quiz framing follows the canvas aspect ratio" in decisions.md;
the desk card part of brand-system.md is updated. Evidence, scripts and numbers: `.claude/eval/2026-09-30-desk-framing/`.

- **Shipped:**
  - `src/components/three/deskFraming.ts` (pure, 37 unit tests, pinned against browser measurements): the camera pose and the card box for a canvas size.
    Landscape sizes get `DESK_POS` / `DESK_TARGET` and 520 x 620 back as the same objects; otherwise the camera slides
    along today's view ray and the card narrows until it fits the width and the first control is 44px on screen.
    `CameraController` and `DeskQuiz` read it. Lesson framing, `SCENE_*` / `MODEL_*`, `PAPER_ANCHOR`, the FOV and
    `distanceFactor` are unchanged.
  - Desk controls are 44 to 52px tall in CSS as the tilt needs (`controlHeight` from `deskFraming`; `DeskQuiz` only,
    `QuizView` unchanged, so the daily review is as it was).
  - The camera cuts to the desk and back under `prefers-reduced-motion` (with a landing-frame fix found in
    verification).
  - `AristoCanvas` shares `MIN_POLAR_ANGLE` (same value) with `deskFraming`, because OrbitControls clamps the desk pose
    to it: the camera that renders is `(0, 0.133, 0.083)`, not `DESK_POS`. This is why "a steeper camera" is not on
    offer without touching the lesson orbit.
  - `/dev/desk-quiz` now shows the production framing until a slider moves, and publishes `window.__cam`.
- **Measured** (the probe, /demo and the harness; 9 sizes from 360x640 to 1920x1080, light and dark):
  - The card is fully visible in all 144 states (before: 60 of the 108 host states cropped; 49% visible at 360x780,
    80% at 768x1024) and never under the top bar, the panel or the strip.
  - Smallest desk control 44px on screen in every state, answered cards included (before 34); 0 under 44 (before 52
    kinds). AA: 0 failures, minimum 5.33.
  - fps in the desk framing (production build): 1280x720 127 before, 116 and 111 after; 390x844 246 before, 228 and
    226 after (single runs range from 79 to 145; p95 frame time unchanged at 5 to 6.6 ms). First loads: `/` 122 kB static, `/demo` 135, `/learn` 134, all unchanged.
  - Anchors: the nine probe-downs identical (moving mesh aside); the display clicks vary run to run by more than the
    change (old code 0.392 to 0.403, new 0.408 to 0.419).
- **Gates:** type-check clean; lint 0 errors / 10 warnings; tests 441 (404 + 37); build green.
- **Gap left:** a landscape phone (844x390, 667x375) has no room for a usable card between the bars, so it keeps
  today's framing and is cropped (controls about 28px). Owner: a panel and strip layout task, not the camera.
- **Next:** V8.3 landing v3 (session order below); V8.6; V8.7.

## 2026-09-30 - Next: V8.3 landing (the desk-quiz framing is done, above) (direction agreed with Hmz, no code yet)

V8.4c merged (#15, 215db0d). Session order Hmz chose:

1. ~~Desk-quiz framing at portrait sizes~~ Done, see the entry above.
2. **V8.3 landing v3** (`/model opusplan`; Fable 5.1 only if the scroll-and-3D choreography stalls). The direction
   Hmz agreed, which replaces the brief's looping hero video and example-image carousel:
   - **A motion-led, scroll-driven page**, premium, advanced yet friendly and creative: Night Class ink, the lit
     classroom as the warm window, the one orange as light. Soft, springy motion, depth and parallax. Not a static
     page with screenshots, not a carousel.
   - **Opening:** the teacher turns, smiles and greets; "One teacher. One student. Every kid." builds in; scrolling
     pushes the camera through the "window" into the room.
   - **The idea:** the column mark draws itself, the flute lights, the one-to-one tutoring story appears on the display.
   - **From a question to a lesson** (pinned, the centrepiece): a topic types itself; it breaks into concepts that float
     out and link up (Aristo grasping the idea, the knowledge graph); the five moves stack in with real demo lines
     (lesson generation); the diagram resolves out of noise and sketch lines onto the board (image generation); it
     lifts off, becomes a point cloud, a wireframe, then the solid model turning in the room (3D generation, from
     `public/demo/heart/source.jpg`, `teaching.jpg` and `model.glb`, the pipeline's real before and after); the
     camera pulls back and the teacher starts teaching.
   - **One lesson, five moves** (pinned): the teacher delivers it; scroll drives Activate to Connect.
   - **The student grasping it**, storyboarded and cinematic too (Hmz): the map's concepts light up, mastery rings
     fill, and review pulses travel back along the links, labelled as an example learner.
   - **For parents:** calm. **Close:** the teacher sends you off, one CTA.
   - **Guards:** the first paint stays a poster with / at or under 135 kB; 3D, models and animation code load after
     it; phones, low-end GPUs, no WebGL and reduced motion get a lighter version telling the same story; only existing
     assets; no paid generation; finished pieces are labelled as real outputs, no speed claim unless measured.
   - **The plan starts with a storyboard** (start, middle and end of each section's scroll range, teacher gestures
     that make sense in context, two or three options where there is a real choice) for Hmz to pick from before
     anything is built.
3. Then V8.6 (admin, then onboarding, course map, dashboard, create-teacher onto the tokens) and V8.7 (re-capture).

## 2026-09-30 - V8.4c done: classroom shells, pickers, loading, free mode, review; the lock is gone (Opus plan approved by Hmz)

Branch `dev/v8-4c-shells` off `origin/deploy-prep` (36fefc8, #11 to #14 merged; no upstream set); PR into `deploy-prep`.
Decisions are the nine V8.4c rows in decisions.md; the system parts are in brand-system.md ("Classroom (V8.4c)", Theme,
register, AA gaps). Evidence, scripts and numbers are in `.claude/eval/2026-09-29-v8-4c/`.

- **Shipped:**
  - /learn and /demo follow the theme (OS, a stored choice, or the new toggle in the top bar). The lock is deleted from
    `pages/_app.tsx`; `pages/_document.tsx` applies a stored choice before the first paint. No V8.4a/b file changed.
  - Top bars are ink-glass pills on the room (wordmark, account or demo banner, toggle); below md the /learn actions are
    44px icons with screen-reader names. Shared pieces in `src/components/learn/ClassroomChrome.tsx`.
  - The panel column follows the theme, is clamped to the viewport (fixes the overflow below 440px), and collapses to
    its strip while the quiz is on the desk (Hmz: every width). The desk card is fully visible from 768 up.
  - The topic picker and ModePicker (system scrim, surface cards, icons), the loading screen, free-mode cards, ReviewView
    and the lightbox are on the tokens; AvatarCredit and `.aristo-scroll` are off the orange. The last V8.1 step 5 sweep.
  - Onboarding, the course map and the dashboard (V8.6) are pinned light with `.theme-paper`.
  - `src/lib`, `src/app/api`, `src/hooks`, `src/store`, `src/components/three`, `src/data` untouched; no prop, store read,
    handler or effect changed.
- **Measured** (real themes, headless on the GPU; the local `/dev/learn-shell` harness mounts LearnClient with every
  /api call mocked in the page):
  - AA: 8,076 text nodes, 0 failures, minimum 4.74 light / 5.24 dark (before: 6,031 nodes, 1,363 failures, min 1.22).
  - Targets: all at least 44px except the tilted desk card's options (42px on screen, as in V8.4b). Nothing animates
    under reduced motion; `--dur-*` are 0 on the root, `.theme-ink` and `.theme-paper`.
  - No overflow at 360; the panel always inside the viewport; the desk card never under the panel or the strip at 768 /
    1024 / 1280 / 1440. Anchor probes identical (the moving-mesh and screen-click ones vary by run, as before).
  - Toggle on the production build: flips the theme, stores it, and the reloaded first paint is already right.
  - First loads: `/` 122 kB static, `/demo` 135, `/learn` 134 (unchanged; the first build was 136 until the loading
    screen dropped ui/button and MotionConfig). `/demo` JS 455.7 -> 456.9 kB, CSS 14.3 -> 13.9, scene ready median
    2343 -> 1639 ms (noise). 0 paid requests anywhere.
- **Gap left:** the desk quiz at 360 portrait is cropped by the camera. Closed by the desk-framing task (entry above).
  - `/learn` in the pane (production build, signed in by Hmz, view-only): JS 458.9 -> 460.6 kB, CSS 14.3 -> 13.9, only
    the three GET calls, no lock, dark under OS dark, the toggle 44px, no target under 44px.
- **Next:** V8.3 landing v3; V8.6 (admin token pass, then onboarding, course map, dashboard and create-teacher onto the
  tokens, dropping the `.theme-paper` pins); V8.7 re-capture of the now-themed classroom.

## 2026-09-29 - V8.4b done: quiz, desk card, answer panel, input box, quiz bars (Sonnet, plan approved by Hmz)

Branch `dev/v8-4b-quiz` off `origin/deploy-prep` (then at #11 and #12); PR into `deploy-prep`. #11 to #14 are all merged
since. Decisions are the seven V8.4b rows in decisions.md; the system parts are in brand-system.md ("Classroom
(V8.4b): the quiz", Theme, register, AA gaps). Evidence, scripts and numbers are in `.claude/eval/2026-09-29-v8-4b/`.

- **Shipped:**
  - Desk card is paper in the room: `.theme-paper` keeps it light in both themes. Box, anchor and camera untouched.
  - QuizView on the tokens and host-agnostic (the daily review hosts it too).
  - Right and wrong are `success` / `danger` on tints, each with an icon, words and screen-reader text.
  - Bloom level is one neutral chip with an icon and a label (no hues).
  - "Question 1 of 2" is `accent-text`.
  - Ordering rows have 44px icon buttons with labels.
  - AnswerInputPanel, InputBox and the CourseFlow bars (with their loading bar) are on the system Button / Input, 44px,
    following the theme like the V8.4a panel.
  - Mic and listening keep their behaviour: the accent fill, a stop icon, a ring and "Listening…". Pulse, spinner and
    bounce are `motion-safe:`.
  - Scope additions (approved): the "Quiz on your desk" strips in LearnClient and DemoClient, and DemoResultBar.
  - V8.1 step 5 microcopy for these files: no em-dash, no `!`, no emoji, no text arrows.
  - `src/lib`, `src/app/api`, `src/hooks`, `src/store` and `pages/` untouched; no prop, handler or effect changed.
- **Measured** (`.claude/eval/2026-09-29-v8-4b/README.md`):
  - AA: 3,292 text nodes (every question type, the answer panel, the input box, the bars, the desk card on /demo and
    /dev/desk-quiz; 360 / 768 / 1280; light and the dark preview), 0 failures, minimum 5.26.
  - The desk card never overflows its 620px box, and nothing animates under reduced motion.
  - Every target is at least 44px (the desk card's options measure 39-43px only because the card is tilted in 3D; the CSS
    height is 44px).
  - `/demo` JS 454.2 -> 455.2 kB, CSS 14.4 -> 14.3 kB, scene ready median 2245 -> 1969 ms (noise, not slower).
  - `/learn` in the pane: JS 457.8 -> 458.5 kB, the same three GET calls, no paid endpoint, and the free-mode input is 44px.
  - First loads: `/` 122 kB static, `/demo` 135 kB, `/learn` 134 kB.
- **Gates:** type-check clean; lint 0 errors / 10 warnings (unchanged); tests 404; build green.
- **Not done, left for V8.4c:** `ReviewView` (hosts QuizView; white header, emoji, dashes), the LearnClient / DemoClient shells
  (panel column, top bars, banner; the card is partly under the 400px panel at narrow widths), FreeTopicCard, ModePicker,
  loading, the orange `.aristo-scroll` scrollbar on the card, then deleting the lock in `pages/_app.tsx`.
- **Next:** V8.4c (done, below); then V8.3 landing v3 and V8.7 re-capture.

## 2026-09-29 - V8.5b: day room walls the teachers read against

Branch `dev/v8-5b-day-walls` off `origin/deploy-prep`; PR into `deploy-prep`. It is independent of V8.4a (#11).

- Both teachers wear white against warm plaster: 1.1:1 shirt to wall. Hmz picked deep blue-grey from six baked
  options.
- `classroom_default.glb` was re-baked at full quality. The front wall behind the teacher is #6B8196, and the side and
  back walls are #D6DDE3. All-blue-grey baked the bounce-lit walls near-black.
- Result: Jake 1.57, MJ 1.51. The 12 anchor probes are identical, draw calls unchanged, fps median 158 → 156 (noise),
  and the file is 1.05 MB.
- `build_studio_room.py` gains `--wall` / `--wall-side` and a per-face `wall_side` split.
- Evidence and the option sheets are in `.claude/eval/2026-09-29-v8-5b-walls/`.
- Blender 5.1 is installed locally at `C:/Program Files/Blender Foundation/Blender 5.1/`. A preview bake takes about
  1 minute, a full one about 30.
## 2026-09-29 - V8.4a done: lesson panel and controls, caption first (Opus plan, then execution)

Branch `dev/v8-4a-lesson-panel` off `origin/deploy-prep` (7d457c3, #10 merged); PR into `deploy-prep`. Plan approved by Hmz
with two scope additions: the Experience.tsx toolbars, and one read-only `activeQuiz` selector. Decisions are the eight V8.4a
rows in decisions.md; the system parts are in brand-system.md ("Classroom (V8.4a)", Theme, register, AA gaps).

- **Shipped:**
  - Caption band: the spoken sentence in ink glass over the scene, portalled, left of the panel, top edge at or below
    80% of the height, lg and up, hidden on the desk quiz.
  - The band fits the whole sentence (18/16/14px, then without the next line) rather than cutting it.
  - Below lg the caption leads the panel instead.
  - Phase rail and the system's phase label in one accent. No phase hues anywhere in these files.
  - Transcript drawer for the whole lesson.
  - Panel, TeacherControls and message-panel states on the semantic tokens. They follow the theme and render light
    under the lock.
  - Callouts and in-scene toolbars in `.theme-ink`. View in 3D / Show image are the secondary button.
  - "seg N / M" only on `yarn dev`.
  - Microcopy (V8.1 step 5) for these files.
  - `src/lib`, `src/app/api`, `src/hooks`, `src/store` untouched; no prop, handler or effect changed.
- **Measured** (evidence, scripts and numbers in `.claude/eval/2026-09-29-v8-4a/`):
  - No band vs toolbar overlap in 42 band shots (16px at the closest).
  - Every demo sentence (127 to 358 characters) shows in full.
  - AA: 1812 text nodes over 8 states, 4 widths and 2 themes, 0 failures (min 4.71 / 5.24, scene pixels taken as
    white and black).
  - All targets are at least 44px, and nothing animates under reduced motion.
  - The open transcript keeps the spoken sentence in view.
  - `/demo` cold scene-ready median 2124 → 1903 ms, not slower. JS +5.5 kB compressed (lazy classroom chunk; `/learn`
    450.8 → 456.7 kB); first load unchanged at 134 kB.
  - `/learn` was checked signed in, read-only, with only its three GET calls.
- **One orange (Hmz, after review):** every filled button is #F97B2F with brand-brown labels (#3D2110, 5.55:1; near-black read too harsh), app-wide (light `accent` changed; `status-ink` for danger; focus rings on `accent-text`; the classroom's leftover white-on-orange fills too). Landing and auth re-checked, 0 AA failures both themes.
- **Wordmark sharp on the first screen:** the /demo and /learn top bars sit above the picker scrims (the blur made the letters look low-res).
- **Follow-up (#13):** Back / Next is sticky to the bottom of the lesson scroll, which now stops above the playback row (on a short screen the row had slid under the controls).
- **Gates:** type-check clean; lint 0 errors / 10 warnings (unchanged); tests 404; build green; `/` static at 122 kB.
- **code-reviewer:** no critical or high.
  - Fixed the three mediums: the band cut long sentences (now fits them, and shows from lg); the transcript did not
    follow the spoken sentence; `.theme-ink` sat in a `:has()` selector list that old browsers drop whole (now `:is()`).
  - Also fixed: a region label, a stable `aria-controls` target, and the import order.
  - Left as is:
    - TeacherControls is about 60px taller with the 44px rows.
    - The toolbar at 768 sits partly under the panel, as before (host layout, V8.4c).
    - For a legacy lesson without `segments`, the panel caption below lg is empty; the band uses the playback shim.
      Fixing it needs a new prop.
- **Tooling note:** the browser pane throttles to about 5 fps when hidden, so the 3D scene never finishes loading there.
  Headless Playwright on the GPU (`--use-angle=d3d11`) works; the scripts are in the eval folder. `/dev/*` returns 404 on a
  production build.
- **Next:**
  - V8.4b (quiz, desk quiz card, AnswerInputPanel, InputBox) on Sonnet.
  - V8.4c (free mode, pickers, loading, the LearnClient / DemoClient shells including the 400px panel overflowing
    below 440px, then delete the lock in `pages/_app.tsx`).
  - Remaining AA gaps are listed in brand-system.md.

## 2026-09-29 - V8.2 done: design system v2, one orange, app-wide theme (Opus plan, then execution)

Branch `dev/v8-2-design-system` off `origin/deploy-prep` (which has #8 tokens and #9 V8.1); PR into
`deploy-prep`, not merged (Hmz merges). The system is written down in `.claude/docs/brand-system.md`;
`landing-design-system.md` is now a pointer. Decisions are in decisions.md (seven V8.2 rows).

- **Orange decision:** `aristo-orange-main` #F97B2F and `aristo-brown-main` #3D2110 win; the legacy
  #F59047 / #402B1C tokens are deleted and their uses renamed. Visible on purpose in admin, the loading
  screen, `.aristo-scroll`, the `shadow-aristo*` tint and two scene chips. `src/lib` is untouched except the
  new `src/lib/design/shape.ts` (moved from `components/landing`).
- **Semantic tokens app-wide** (bg ... info, plus `accent-hover`), the landing's Night Class values 1:1;
  shadcn's colour names are gone (mapping table in brand-system.md). Motion tokens (`duration-fast/base/slow/
  reveal`, `ease-out-soft`) and a `type-*` scale.
- **Theme:** `data-theme` + key `aristo-theme` (the old `aristo-landing-theme` is carried over once), script in
  the root layout head. **Light lock** meta on /learn, /demo, /dev (`pages/_app.tsx`), admin and create-teacher,
  which also keeps their old page defaults. Remove it per surface in V8.4 / V8.6.
- **Moved onto the system:** `ui/*` (control radius, 44px heights, press, focus ring, e1/e2), sign-in, sign-up,
  pending (Column mark instead of gradient text), not-found (was near-invisible).
- **How no-change was checked:** computed styles of every element hashed before and after in the browser.
  `/` identical in both themes (inside the landing root). `/demo` under OS-dark identical to the light
  baseline (the lock holds); the lesson state differed only by the planned `shadow-aristo-sm` tint. The AA
  checker (each text node against its composited background) passed every pair on `/`, `/sign-in` and
  `/sign-up` at 360 / 768 / 1280 in both themes (min 4.74 light, 5.97 dark), with no horizontal scroll.
- **Gates:** type-check clean; lint 0 errors / 10 warnings (unchanged); tests **404** (408 minus the four
  per-token assertions for the two deleted tokens); build green; `/` static, 122 kB, no three import.
- **code-reviewer:** no critical or high. Fixed: alpha hover on accent fills (4.1:1, now `accent-hover`), light
  success/warning on sunk/tint (4.2:1, darkened), the lock missing the viewport scrollbar. Documented, not
  changed: tailwind-merge does not know `type-*` / `shadow-e*` / `duration-*`; browsers without `:has()` lose
  the lock's cream defaults.
- **Checked signed in** (Hmz signed in; free mode, read-only calls only, nothing generated): /learn,
  /admin (overview, users, courses, cost, audit-log) and /create-teacher all stay light under OS-dark with their
  old page defaults; the lock meta is in `<head>` on the first response, so no dark first frame. Admin contrast
  gaps are old ones, slightly better now: sidebar labels ~2.35, active nav white on #F97B2F 2.66 (V8.6).
- **Hex literals left, each with an owner** (brand-system.md register): classroom status colours (V8.4a/b),
  admin data-viz (V8.6). Known AA gaps inside the locked classroom: white on #F97B2F (2.66), `orange-ink` on
  cream (4.15), the loading caption, all V8.4.
- **Next:** V8.4a/b/c (classroom UI; drop the lock from `pages/_app.tsx` when it is on the tokens), V8.1 step 5
  microcopy sweep, V8.3, V8.6 (admin token pass, Haiku).

## 2026-09-28 - V8.1 done: brand foundation, mark and copy (Opus for the words and mark, Sonnet to apply)

Branch `dev/v8-1-brand`, off `origin/deploy-prep`; PR into `deploy-prep`, not merged (Hmz merges). Gates and the code-review
result are at the end of this entry. `/` is still static, first-load JS 122 kB, no three / R3F import.

- **Shipped:** `.claude/docs/brand/messaging.md` (positioning, descriptions, pillars, voice, words to avoid, honesty rules,
  approved landing copy deck). The Column mark, candidate D (Hmz's pick), as vectors from Archivo's own outlines
  (`scripts/brand/build-mark.mjs` -> `src/components/brand/markPaths.ts`, `public/brand/*.svg`); one `AristoMark` component
  in the landing nav and footer, /learn and /demo top bars, loading screen, create-teacher header, empty-state avatar. Zero
  sparkle glyphs. Every landing string rewritten to the deck; section H2s are now Title Case Geist. Metadata fixed
  (`aristo-ai-ten.vercel.app`, no em-dash, no "adapts to your style"), plus `opengraph-image.tsx`, `icon.svg`, `favicon.ico`,
  `apple-icon.tsx`, and a title/icon `<Head>` in `pages/_app.tsx` for /learn and /demo.
- **Honesty fix:** the parents section no longer says "learning, not behaviour"; it lists what the schema stores (time and
  clicks per lesson, engagement profile, misconceptions, AI-request log). The speech-to-text line says it is the browser's own.
- **Deferred:** V8.1 step 5, the in-app microcopy sweep. It was held back for `dev/v8-tokens`, which has now merged, so it is
  unblocked: do it against messaging.md. (The rebase onto the token branch re-applied the mark with `aristo-*` classes.)
- **Next:** V8.4a/b/c (classroom UI), then V8.3 landing v3 and V8.7 re-capture. Re-generate the mark with
  `node scripts/brand/build-mark.mjs` after a `yarn build` (it reads Archivo from `.next/static/media`); the favicon with
  `node scripts/brand/build-favicon.mjs`.
- **Gates:** type-check clean, lint 10 (unchanged), tests 337, build green; `/` static, 122 kB first-load JS. Verified at
  360 / 768 / 1280 in both themes (the hero line holds three lines at 360). `code-reviewer`: no critical or high; fixed
  the medium (/demo had no link preview, now has og tags; apple-touch-icon added) and the accessible name on the top-bar
  mark. Left as is: the middleware matcher still runs on the two metadata routes (auth file, harmless), and og:url is
  the site root on /sign-in and /sign-up.

## 2026-09-28 - Hex-to-token refactor on deploy-prep, zero visual change (Sonnet)

Branch `dev/v8-tokens` off `origin/deploy-prep` (V9 and the V8.5 rooms); PR into `deploy-prep`, not merged. It ports
`dev/classroom-color-tokens` (a WIP off the pre-V9 `deploy-prep` of 2026-09-10; pushed as-is first, still there) and
finishes the sweep. **V8.2 is unblocked.** Gates: type-check clean, tests 408 (was 337; the rest are per-token
assertions in `brandColors.test.ts`), build green, lint 0 errors and 8 warnings (10 before; none new, none in colour code).

- **Inventory:** 157 `#F97B2F` in 30 files on `deploy-prep`, 170 counting the brand and stray hues together. Of the 12
  files both the WIP and V9 touched, git merged 11 cleanly and only `.claude/launch.json` conflicted (took production's).
  Merged cleanly is not complete: V9 had added new literals to `LessonView`, `DemoClient` and `TeacherControls`.
- **The WIP's one bad idea, reversed.** It re-pointed the old `--aristo-orange` and `--aristo-brown` at the classroom
  values. Those tokens render #F59047 and #402B1C (their comments lied), and admin, sign-in and pending use them, so it
  moved those pages. The classroom literals now live in new `--aristo-orange-main` / `--aristo-brown-main`, and the old
  tokens are unchanged. **V8.2 decides which orange wins** (decisions.md). Do not "fix" the old two in passing.
- **Swept:** brand palette, the three stray hues plus amber (the fourth phase), and the peach and sand near-misses.
  Classes became `aristo-*`; strings that must be strings (recharts, React Flow, three.js, canvas, email) read
  `BRAND_HEX`. Not swept, on purpose: status and data-viz colours, code themes, scene-material constants (now
  commented). Landing untouched (V8.1). No rendered text and no brand mark changed.
- **How zero change was checked:** each changed file diffed against `deploy-prep` after normalising every colour to one
  canonical hex marker (`[#F97B2F]`, `aristo-orange-main`, `hsl(var(--..))`, `BRAND_HEX.x` and `rgba()` all collapse).
  39 files compared; every difference left is the same colour written another way.
- **Then measured in Chrome, before vs after, at 1280x720** (same code paths, two servers, animations frozen, every
  element's computed colour, background, border, shadow, fill and pseudo-element hashed and compared): `/demo` idle,
  narrating, teaching image, both lessons; the quiz and the answer panel; `/dev/free-model` empty, image and model in both
  rooms (`?room=alt`); `/dev/desk-quiz` quiz and lesson framings in both rooms; `/sign-in` and `/sign-up` (screenshots
  byte-identical). All identical, and all 28 `--aristo-*` tokens render their documented hex. **Not reachable without a
  session:** `/create-teacher`, `/admin/*` and `/pending` redirect to `/sign-in`, so they rest on the file-diff proof, not
  a browser check; the Challenge and Connect phase cards likewise (`/learn` only). Look at admin once by eye after merge.
- **Gotcha:** `yarn dev` and `yarn start` share `.next`, so starting a dev server breaks a production server in the same
  tree (500s). `/dev/*` pages 404 in production by design, so they need dev.
- **Lint in a nested worktree** fails on a duplicate `@next/next` plugin from the parent `.eslintrc.json`. From a
  worktree run `npx eslint --no-eslintrc -c .eslintrc.json --ext .ts,.tsx src pages`.

## 2026-09-28 - V8.5 done: two rooms, "Classroom" (warm studio) and "Evening" (one-to-one study) (Opus)

Branch `dev/v8-5-studio-room`, taken off `docs/v8-v9-programme` and not off `deploy-prep`. The brief says to branch off
`deploy-prep`, but that branch has none of V9 (Jake/MJ, the director), and the room had to be verified against the real
scene. Merge it after the V8/V9 programme lands, or rebase the commits then. Evidence and numbers are in
`.claude/eval/2026-09-27-v8-5-room/README.md`. Gates: type-check clean, lint 10 (unchanged), tests 337, build green.

- **Shipped:** `classroom_default.glb`, restyled and re-baked headless by `scripts/room/build_studio_room.py` (no new
  sources, so `LICENSES.md` only notes the modification). The lockers, wall clock, cork boards and chalk tray are gone,
  and the chalkboard is now a dark display. The palette is warm plaster, a pale floor, pale oak, charcoal frames and
  terracotta chairs. Same three meshes and one 4096 atlas; 1.12 to 1.07 MB. The raw export and atlas are in the
  git-ignored `assets-src/models/` (the old uncompressed source was renamed `classroom_default.pre-v8-5.glb`).
- **Anchors:** unchanged by construction, and probed before and after with `scripts/room/verify-room.mjs probe`: desks
  y -0.888, floor y -1.694, display z -5.574. No constant changed in `Experience.tsx`, `CameraController.tsx`,
  `DeskQuiz.tsx` or `Classroom.tsx`. There is no app code diff at all: the GLB, scripts and docs only.
- **Perf:** 32 draw calls per frame before and after. Uncapped headless fps averaged 126 before and 153 after, over 9 runs
  each (noisy); it is 60 with vsync in both.
- **Found:** the `Blackboard` canvas plane (z -6) sits behind the front wall and has never been visible. It is recorded
  in decisions.md with the display's probed rectangle, for V3 / T08.
- **For Hmz to judge:** whether the look clears the bar (the before/after sheets are in the eval folder). The rows of
  desks stay, because they are the quiz anchors. The quiz card is now cream on pale oak, so its contrast is lower than on
  the old orange desk; worth a look in V8.4b.
- **Evening room (second pass, Hmz: "do something to replace the alt room as well... be a little creative"):**
  `classroom_alternative.glb` is now built from the default room's shell (`--variant evening`). It is a one-to-one
  study at dusk: only the learner's desk remains, with a reading nook (CC0 Poly Haven props, fetched by
  `scripts/room/fetch-props.mjs`), pendant lamps, a rust rug, blue-ink walls, walnut and dusk windows. The picker
  label is "Evening"; the store value is unchanged. The bake ships as an emissive texture, so the app's daylight rig
  does not re-light it. The old alt room had **broken quiz anchors** (the paper floated over a chair) and cost 160 draw
  calls per frame at about 32 fps. Evening: every anchor probed, 30 draw calls, about 163 fps, 1.47 to 0.69 MB.
  `Classroom.tsx` shares one `ROOM_SHELL` transform and has no `DeskPaper` in Evening (`desk: null`).
  The picker itself is only in `/learn` (auth, not opened); the same load path was checked through `?room=alt`.
- **Code review:** the `code-reviewer` agent ran twice. The first pass found 0 critical or high issues and 1 medium
  (`verify-room.mjs` did not always clean up Chrome), plus 4 lows. All were fixed: cleanup in `finally`, CDP
  timeouts, a failing canvas wait, profile removal, a path guard in `fetch-props.mjs`, and the shared shell constant.
  The indirect clamp is now evening-only, so the shipped day bake stays reproducible. The confirming pass approved.
- **Next:** V8.4a/b/c (classroom UI), then V8.7 re-capture. `verify-room.mjs shots` (with `ROOM=alt` too) can drive
  the captures.

## 2026-09-27 - V9.8 done: batch 3 wired (Opus authored, Sonnet wired)

Detail in `.claude/plans/V9-REPORT.md` ("V9.8"). Gates: type-check clean, lint 10 (unchanged), tests 337 (was
314), build green. `typescript-reviewer` caught a real bug (OneMoment losing its rising edge for good if
blocked at that exact tick); fixed and covered by two regression tests before this was reported done.

- **Shipped:** OneMoment (`oneMoment`, over `thinking`, isLoading rising edge), PointNear (beside Pointing in
  `point`, half the pool, `point` now `play: "dwell"` so one hand holds for the whole stretch), PatientTilt
  (`listenBeat`, once per question ~4s into `listen`, re-armed by a new question), BackToBoard (`wrongBoard`, a
  wrong answer with the lesson image still up, falls back to plain `wrong`) -- all in the Jake and MJ clip packs
  (739,804 B and 767,240 B). Pointing's hand also fixed (other fingers folded, index straightened; was bent back
  9 deg and splayed 12.5 deg): approved, "pointing looks good now". Checked in `/dev/free-model` (Jake and MJ,
  forced through the store via a temporary `three.setFrameloop("never")` + synthetic-clock hook, reverted); not
  separately re-walked in `/demo`'s live lesson flow this session (its own controller fights manual signal
  forcing) -- same `director.ts` already covered by the unit tests and the free-model checks. `/learn` not opened
  (auth).
- **Dropped:** OverToYou (row 18) after three rejected rounds ("the arm movement is very unnatural"); the look
  layer turning the head to the desk is the whole "over to you". Batch 3 of `V96-GESTURE-CATALOGUE.md` is now
  fully closed out (shipped or explicitly dropped).
- **Known edge:** `point`'s `"dwell"` mode also slows the *pre-pack* Talking fallback's re-check cadence (~20s
  instead of ~3.5s before noticing the clip pack has landed) -- accepted, the pack almost always loads before a
  lesson's first point.
- **Next:** nothing queued from the gesture catalogue. V8.7 (landing re-capture) still waits on V8.4 and V8.5.

## 2026-09-27 - V9.7 done: six teaching-move clips wired (Opus authored, Sonnet wired)

Detail in `.claude/plans/V9-REPORT.md` ("V9.7"). Gates: type-check clean, lint 10, tests 314 (was 291), build green.

- **Shipped:** Imagine (hook), HoldIdea (explain, sparse), StepBeat (demo_step), MoveOn (transition), YourTurn
  (challenge_setup, plays at 0.85), BringTogether (connect, sparse) in the Jake and MJ clip packs (676,368 B and
  703,156 B). A new board image now also plays PresentModel. The director reads a segment's role via the new
  `roleOf` (beside `phaseOf`). Approved by Hmz in motion on `/dev/avatar-lab`; five of six confirmed playing from
  the real Volcanoes lesson's own segment data on `/demo`, BringTogether confirmed by forcing a matching segment
  (its lesson has none) -- both via a temporary, reverted debug hook.
- **Also:** all 13 hand-keyed clips (the new six plus the six V9.6 ones) got a "life" pass on the fingers (Hmz:
  the old hands were "flat... rigid"); MJ's collar and sleeves fixed (arm/head skin was showing through).
- **Bug caught and fixed before shipping:** `typescript-reviewer` found `beatDone` (the sparse-beat gate) was
  latching even when the overlay never actually played (blocked by Pointing/Thinking, a busy overlay, or a clip
  not yet loaded), permanently losing HoldIdea/BringTogether for the rest of the lesson. Fixed and covered by a
  regression test.
- **Question for Hmz:** none blocking. Two low-priority items are recorded in V9-REPORT's "Known edges": whether
  BringTogether is rare across real lessons (its Volcanoes trigger only fires via a forced segment), and that
  `beatDone` isn't seeded on a mid-lesson avatar swap.
- **Next:** batch 3 of the gesture catalogue (OneMoment, BackToBoard, OverToYou, PatientTilt, PointNear), Opus to
  author, in `.claude/plans/V96-GESTURE-CATALOGUE.md`. V8.7 (landing re-capture) still waits on V8.4 and V8.5.

## 2026-09-25 - V9.6 done: seven authored gestures wired (Opus authored, Sonnet wired)

Detail in `.claude/plans/V9-REPORT.md` ("V9.6"). Gates: type-check clean, lint 10, tests 291, build green.

- **Shipped:** PresentModel, Almost, Exactly, WellDone, Encourage, ThatsIt, GlanceBoard in the Jake and MJ clip packs
  (500,280 to 577,352 B and 526,496 to 603,744 B), wired for rows 2, 9, 13, 14, 16 and 18. Each approved by Hmz in
  motion. Checked in the app on Jake and MJ (`/dev/free-model` and `/demo`). `/learn` not opened (auth).
- **Also:** greeting wave at 0.75; ShakeNo at a third of Almost's weight in the wrong-answer pool; PP viseme softened
  to 0.6 on both teachers; `ClipSpec.look` (an overlay clip can own the head's look, used by GlanceBoard). LookAgain
  rejected (a nod says yes).
- **Question for Hmz:** the long wait now alternates Idle3 and GlanceBoard, about one gesture every 35 s of quiet
  instead of every 70 s. Raise `LONG_WAIT_S` or lengthen both cooldowns (about 130 s) if it feels restless.
- **Next:** the gesture catalogue's batches 2 (teaching moves by segment role) and 3 (event clips), Opus to author,
  in `.claude/plans/V96-GESTURE-CATALOGUE.md`. V8.7 (landing re-capture) still waits on V8.4 and V8.5.
- **Still open from V9.5:** LICENSES.md sources for the classroom and Ryan/Sonia, the Sony duck placeholder.

## 2026-09-23 - V9.5 done: integration, budgets, docs, licences (Sonnet)

Detail in `.claude/plans/V9-REPORT.md` ("V9.5"). V9 is finished apart from the open items below. No escalation needed.

- **Done:** Jake confirmed as the default (recorded in decisions.md; CLAUDE.md, architecture.md and the code comments
  say so; nothing preloads or prefetches anything else). Fallbacks fixed: `custom` with no URL, an unknown key and a
  teacher that fails to load now land on Jake (they went to Ryan, or to a blank slot). Persisted Marcus/Priya/Ryan/Sonia
  already fell back through the store. Picker, Jake/MJ switching mid-lesson, credit for both, and custom URLs checked
  on `/demo` and `/dev/free-model`. 267 tests, type-check clean, lint 22, build green.
- **Budget (cold `/demo`, before = branch start with Marcus, after = Jake):** GLBs 6.95 MB to 3.23 MB, everything 9.2 MB
  to 5.5 MB, posed at 9 Mbps 14.7 s to 9.4 s, warm unchanged. T02's 12 MB bar met; nothing to re-export.
- **Docs:** `LICENSES.md` (new), `.claude/docs/architecture.md` ("Teacher avatar subsystem"), CLAUDE.md avatar notes.
- **Blocked on Hmz / open questions:** (1) ShakeNo: Hmz decided to keep it for now; (2) the Tier 2 clips (hand-keyed gestures: present a model, "let's look again", supportive quiz);
  (3) `LICENSES.md`: classroom and Ryan/Sonia are open source from a YouTuber per Hmz (creator, licence, URL still to record), the Sony duck `dev_placeholder.glb` still open; (4) done: the unreferenced V1 JSX tree and its images are deleted (lint is now 10 warnings, not 22).
- **Not verified:** `/learn` end to end (needs auth), face hints in a real quiz, a phone, frame rate.
- **Next:** V8.7 re-capture is no longer blocked by V9; the plan also waits on V8.4 and V8.5 (both still unticked).
  The plan assigns it Sonnet 5 for captures and Haiku 4.5 for the dead-code removal once you confirm.

## 2026-09-23 - V9.4 done: face and gaze (Sonnet)

Detail in `.claude/plans/V9-REPORT.md` ("V9.4"). No escalation to Opus needed.

- **Done:** `face.ts` and `gaze.ts` (pure, tested) plus `Teacher.tsx`: the director's face hint drives the
  smile, blink runs from a scheduler in `useFrame`, and the eyes follow camera/board/model/desk with
  saccades and drift. 267 tests, type-check clean, lint 22, build green. Checked in the browser on Jake
  and MJ (all four expressions, eye tracking, blink, visemes by timeline and by FFT). T08's gaze item ticked.
- **Found:** the Canino rigs have only a weak `mouthSmile` and blink shapes (no brows), so expressions are
  smile levels (1.6 for a smile, over 1 on purpose) plus eye gaze. `smileGain` scales the hint per rig;
  unset rigs get 0.4. The FFT viseme fallback pins the mouth at full (volume 0.56-0.73 into
  `min(1, volume*4)`); not fixed, the timeline path is the real one.
- **Not verified visually:** the face hints in a real quiz (correct, wrong, lesson complete), covered by
  the director tests only; Marcus/Priya/custom teachers (archived, gain 0.4); `/learn` (needs auth).
- **Blocked on Hmz:** still the ShakeNo question from V9.3 (recommendation: silence it).
- **Next:** V9.5 integration (budgets, `AVATAR_ASSETS`, picker and `/create-teacher`, docs,
  `LICENSES.md`). The Tier 2 clips are still open.

## 2026-09-23 — V9.3 done: the animation director is wired (Sonnet)

Detail in `.claude/plans/V9-REPORT.md` ("V9.3", with the coverage table and the ShakeNo question).

- **Done:** `Teacher.tsx` runs on `src/lib/avatar/` (base, masked overlays, latched reactions, look).
  `lessonComplete` mirrored into the store. `Experience.tsx` passes `lookTargets`. 237 tests, type-check
  clean, lint 22, build green. Checked in the browser on Jake, MJ, Ryan, a custom teacher, pack
  blocked, and `/demo`.
- **Found in the app:** MJ's numbered bone names (`CC_Base_Head_038`) defeated the structural masks, so
  she had no greeting or head overlays until `HEAD`/`HIP` accepted a numeric suffix. Fixed and tested.
- **Not verified visually:** head-to-desk in a real quiz, `lessonComplete` and quiz-result reactions,
  Marcus/Priya on their own GLBs, `/learn` (needs auth).
- **Blocked on Hmz:** the ShakeNo question (keep, or silence a wrong-answer head shake until a
  "let's look again" clip exists). Recommendation: silence.
- **Next:** V9.4 face and gaze (expressions from the director's `face` hint, eyes, drift and
  saccades). The Tier 2 clips (present model, wrong answer, quiz supportive) are still open.
- **Tooling note:** another session's `next dev` holds `.next` on Windows, so `yarn build` fails
  with EPERM; build with a temporary `distDir` and revert the config and `tsconfig.json`.

## 2026-09-23 — V9.3 director: design half done, wiring next (Sonnet) — superseded above

- **Done (Opus):** `src/lib/avatar/` — `animationManifest.ts` (clips, scenario table, clip sets
  per avatar), `director.ts` (pure step function: base/overlay/look/face, no repeats,
  cooldowns, latched reactions, greeting, long wait, fallbacks), `skeletonMasks.ts`, `look.ts`.
  122 table-driven tests; suite 207/207, type-check clean. Nothing in the app uses them yet.
- **Next:** wire `Teacher.tsx` to it, per `.claude/plans/V93-WIRING.md`. That brief holds
  the settled decisions (Pointing stays base, nod/shake head-only overlays, reactions latched,
  weight-dominance overlays, `lessonComplete` store mirror) — execute it, don't re-derive.

## 2026-09-23 — V9.2b: scale, fingers, trousers — all three fixed

Detail in `.claude/plans/V9-REPORT.md` ("V9.2b"). Ran against `NEXT-SESSION-V92B-FIXES.md`.

- **Scale:** three live rounds with Hmz. True real height (Jake 1.78 m) read as a dwarf; halfway
  to the old 2.79 m giant still read short; landed on **halfway × 1.125 — Jake 2.57 m
  (`standScale` 1.3824), MJ 2.51 m (1.3521)**, taller than the brief's original "believable
  adult" target, by Hmz's explicit choice after seeing it live. New `AvatarConfig.standScale` in
  `Teacher.tsx`, read via `standScaleFor(teacher)` in `Experience.tsx`; legacy avatars keep the
  old flat 1.5. `SCENE_Y`/`TEACHER_HEAD_Y` re-tuned to match (final: 0.18 / 0.65). Generated-model
  initial spawn size also cut 45% (1.5 → 0.825) — the student's own scroll-to-resize is
  untouched. All numbers, including the two superseded intermediate passes, are in
  `decisions.md` — don't re-derive them.
- **Fingers:** not a retarget bug (deltas were already 0.000° vs Marcus) — the same Mixamo
  rotation values read as a tighter clench on the Canino rigs' shorter fingers. Fixed with a new
  `scripts/v9_fingers.py`: `relax_fingers` slerps baked finger rotations 35% toward rest, per
  clip, for both teachers; Pointing's index untouched. Re-shipped, `v9_verify_anim.mjs` still
  passes.
- **Jake's trousers:** not the normal map (there isn't one) and not a skinning bug (the crease
  survives `mixer.stopAllAction()` — true bind pose). It's a fold sculpted into the source
  mesh's rest geometry. Fixed with a feathered Laplacian smooth on `Pants_14249_Shape` at both
  knees, edited directly on the rest mesh. `v9_mask.find_pokes`: 0 pokes on trousers/shirt/shoes
  across all 17 clips after the edit. MJ's skirt/legs checked, no equivalent issue.
- **Gates:** type-check clean, lint 22 (pre-existing), tests 85/85.
- **New tooling** (documented in V9-REPORT.md "V9.2b Tooling"): a `window.__v92` mixer-freeze
  hook for exact-frame close-ups with the real R3F camera — needs
  `scene.updateMatrixWorld(true)` right after `mixer.update()` or camera aim reads stale bone
  transforms. Reverted before this commit, same as `__v91d`/`__v91dStore`.

**Next:** V9.3 director (manifest, pools, runtime time-warp, procedural life; wire Idle3 and the
waves). Start prompt: `.claude/plans/NEXT-SESSION-V93-DIRECTOR.md` (Opus 5 to design, Sonnet 5 to
grind — see "Model discipline" in the programme plan).

**Still open:** the Avaturn rig's packs (mirrors, diet); the gap clips (Mixamo exhausted, see
"Clip sources" below); MJ's hair on her shoulder; the scalp seam; female narration for MJ
(parked, needs Hmz's go).

## 2026-09-23 — V9.2: animation library for Jake and MJ (17 clips, base + lazy pack)

Detail in `.claude/plans/V9-REPORT.md` ("V9.2"). **Canino rigs done; the Avaturn rig is not.**

- **Channel diet:** rest-value tracks dropped (MJ 765 → 61 channels per clip) and rotations
  stored as int16. Checked against the raw export in three.js (`v9_verify_anim.mjs`): ≤ 0.016°
  and ≤ 0.24 mm on all clips and crossfades.
- **Shipping:**
  - `Teacher_<T>.glb` (mesh + Idle/Talking/Thinking) plus `Teacher_<T>_clips.glb` (14 clips,
    meshopt), fetched after `sceneReady` (`clipPacks` in `Teacher.tsx`).
  - First load: Jake 2.96 → 2.28 MB, MJ 2.92 → 1.78 MB. The packs are 0.51 / 0.54 MB.
- **Clips:** Idle2 and Idle4; Talking2, 3 and 4; mirrors Talking2M, Talking3M, Talking6M and
  ThinkingM (`v9_mirror.py`). Idle3 and Talking6/6M ship unwired for the V9.3 director. Clapping
  and Talking5 were rejected. Time-warp stays runtime.
- **Checks:** pokes 0 or pushed ≤ 2 mm; one cuff false positive, checked by eye. `v9_qa.py`
  covers deltas, soles and seams.
- **App:** checked in `/dev/free-model` on both teachers and in `/demo` for MJ, including the
  missing-pack fallback.
  - Fixed: a nod falling back to Idle could freeze Idle clamped.
  - Fixed: the talking cycler skipped variants.
- **Gates:** type-check clean, lint 22 (pre-existing), tests 85/85; `typescript-reviewer` pass.

**Next:** **V9.2b** fixes Hmz found in the app. Start prompt:
`.claude/plans/NEXT-SESSION-V92B-FIXES.md` (Sonnet).
- The teachers stand 2.79 m in a real-size classroom (`scale={1.5}`), so a desk reaches the
  knee.
- The fingers look bent.
- Jake's trousers deform at the knees.

Then V9.3 director (manifest, pools, runtime time-warp, procedural life; wire Idle3 and the
waves), then Tier 2 hand-keyed gestures for the gaps (decisions.md "Clip sources"). Hmz saw
Idle3: fine.

**Still open:** the Avaturn rig's packs (mirrors, diet); MJ's hair on her shoulder; the scalp
seam.

## 2026-09-23 — V9.1e: MJ's wardrobe A shipped; six clips per teacher

Detail in `.claude/plans/V9-REPORT.md` ("V9.1e"). **A passed the bar; B not built.**

- **Tee** rebuilt below the old crop hem (`scripts/v9_tee.py`): cut above the hem's
  normal-map folds, re-grown loose and tucked, 0 zero-area UV faces.
- **Skirt** `MJ_skirt`: pleated navy A-line with waistband and lip, hem 0.52, parented to her
  rig. The old skirt is hidden via `v9_strip.HIDE`.
- **Missed by V9.1d, now fixed:**
  - arm skin through MJ's sleeve, 18 mm, fixed with `v9_mask.adopt_weights`;
  - MJ's fingers inside any eased skirt, fixed by `v9_skirt.clear_hands`, which swings
    hanging arms 3-10° (a deliberate deviation from the source; Pointing untouched).
  - MJ's broken left elbow (spotted by Hmz): a sculpt defect in the source mesh, rebuilt
    as a mirror of her right arm with `v9_mask.mirror_region`.
- Zero pokes on every frame of all six clips for both teachers. The new `check_through`
  covers the hands and knees that `find_pokes` cannot see.
- **Clips:** Thinking (baked from the pack's Thinking2; the pack's Thinking put the hand on
  the chest), Nodding and ShakeNo, on both teachers. The `Teacher.tsx` nod/shake revert now
  follows clip length.
- Sizes: Jake 2.96 MB, MJ 2.92 MB. Gates: type-check clean, lint 22 (pre-existing), tests
  85/85.

**Next:** V9.2, the animation library. Plan-mode first: channel diet (MJ carries 765 channels
per clip) and how packs ship, then the remaining 10 source clips. Start prompt:
`.claude/plans/NEXT-SESSION-V92-ANIMATION-LIBRARY.md`. Still open: MJ in `/demo` (not
re-checked), her hair clipping the shoulder, the forehead scalp seam, and the parked female
narration.

## 2026-09-23 — V9.1d: motion fixed and re-shipped; MJ's wardrobe waits on Hmz

Detail in `.claude/plans/V9-REPORT.md` ("V9.1d"). **V9.1c's motion was wrong in ways three
sampled frames could not show.**

- **Fixed, re-baked, re-shipped** (Jake 2.54 MB, MJ 2.27 MB): arms/hands were 13–20° off the
  source (bake ran with the teachers turned 17°, world deltas rotated with them), now ≤ 0.1°;
  feet stood toe-down (anatomy swing), then floated (source pins hips), now flat and grounded;
  Jake stood 30 mm up and 8 cm behind Marcus's mark (normalise measured a posed frame); MJ's
  elbow stepped (share bone undriven); skin through Jake's cuff (mislabelled vertex group).
- **`Teacher.tsx`:** a gesture change reset the playing clip (33° arm pop on Talking → Pointing),
  and a nod froze Idle for good on every avatar without a Nodding clip. Fixed; measured in app.
- **Passing:** wrists, fingers, shoulders, loop seams, transitions, face; Pointing lands inside
  the image's upper-left for both (Marcus lands just outside it).
- Gates: type-check clean, lint 22 (pre-existing), tests 85/85.

**MJ's wardrobe:** her extended tee and skirt fail the bar (slits showing her legs, stretched
dark blotches, jagged hem, crop-hem ridge on the tee). Options in
`.claude/eval/2026-09-18-v9-bakeoff/v91d_mj_wardrobe_options.png`. **Hmz picked A** (rebuilt
pleated skirt, `scripts/v9_skirt.py`, plus a tee repair) **with B (CC0 MPFB trousers) as the
fallback** if A cannot pass. Until it ships, students who pick MJ see the failing skirt.

**Next:** V9.1e — build A (B only if A fails), judge in three.js, re-ship; then Thinking, Nodding,
ShakeNo. Start prompt: `.claude/plans/NEXT-SESSION-V91E-MJ-SKIRT-AND-CLIPS.md`.
Scene backup before this session: `bakeoff_scene_pre_v91d.blend`.

## 2026-09-22 — V9.1c: V9.1b audited, rebuilt, and wired into the app

Detail in `.claude/plans/V9-REPORT.md` ("V9.1c"). **V9.1b was overstated**: arms were buried behind
the back in every clip (T-pose vs A-pose rest mismatch), 5 of 6 clips were frozen stills (the export
hid the source rig), and MJ's 32k tris came from decimation that shattered her teeth and hair.

- **Fixed and re-shipped**: rest-aligned retarget (`v9_retarget.rest_alignment`, guard raises on a
  frozen source), MJ rebuilt from undecimated meshes, hidden skin masked instead of decimating
  (`v9_mask.py`), material pass (`v9_postprocess.mjs` via `v9_ship.sh`), SS and I recipes corrected.
  Jake 42.8k tris / 2.49 MB, MJ 53.3k / 2.21 MB. Accepted, no simplify.
- **Wired**: `jake` / `mj` in the union, `AVATAR_ASSETS` (label 1.4, by looking), switcher, voice map,
  dev harness (`/dev/free-model?avatar=&state=`). Blink now drives both eyes (all ARKit rigs winked).
- **CC BY credit** on each avatar's config → `<AvatarCredit>` in the `/learn` and `/demo` panels, plus
  `asset.copyright` in each GLB.
- Gates: type-check clean, lint 22 (pre-existing), tests 85/85. Checked in `/dev/free-model` and in
  `/demo`, then `/learn` once Hmz signed in (see follow-up).

**Follow-up (same day, Hmz):** Jake and MJ are the roster. `ACTIVE_TEACHERS` in the store drives both
pickers; Ryan/Sonia/Marcus/Priya archived (config + GLBs kept), `DEFAULT_TEACHER` = jake, persisted
old choices remap to it. `/demo` opens on Jake with a Jake/MJ switcher. `/learn` checked signed in
(switcher only). The /learn switcher had been hiding Jake/MJ in a clipped 260 px row.

**Next:** V9.1d — motion QA of all clips frame by frame, MJ's wardrobe held to a written quality bar,
then more clips (Thinking, Nodding, ShakeNo). Start prompt:
`.claude/plans/NEXT-SESSION-V91D-MOTION-WARDROBE-QA.md`. Motion was only checked at 3 sampled frames
per clip; wrist twist, fingers, feet and where Pointing lands are unverified.

**TODO, parked by Hmz (2026-09-22):** female narration for MJ in `/demo` (she lip-syncs the male
pre-rendered voice). 6,856 ElevenLabs chars for both topics, plus per-voice folders in the player.
Do not start without Hmz's go.

## 2026-09-21 — V9.1b: the Canino pair is shippable

Detail in `.claude/plans/V9-REPORT.md` ("V9.1b"). Renders and the working scene are in
`.claude/eval/2026-09-18-v9-bakeoff/`; reusable Blender scripts in its `scripts/`.

**The face-rig blocker is solved — L3 is back on, and it beats the Rocketbox fallback.**

- The woman's FBX is only broken in the **forearm chain** (92/101 bones fit at zero residual). Her
  head matches the clean GLB to **0.66 mm**, so all 68 face shapes transferred exactly. No sculpting.
- The 15 Oculus visemes are **baked as real shape keys** from CC's 68 face shapes, so
  `Teacher.tsx` drives both rigs **with no code change**. CC's `Open` moves lips 3.3 mm; the jaw
  drop is `Mouth_Open` at 16.3 mm — which is why a 15 → 8 name map would have failed.
- Retarget works: rotation **delta** relative to each rig's own rest pose (not world directions).
  52/52 bones mapped; Idle, Talking, Pointing baked for both.
- She is re-clothed (hip-length tee, knee-length skirt) by extending her own garments.
- Shipped: `public/models/Teacher_Jake.glb` **2.69 MB** and `Teacher_MJ.glb` **1.87 MB** — both
  smaller than Marcus (9.18 MB). Normalised to Marcus's height so the lesson camera is unchanged.
- Verified in the browser at `/dev/avatar-lab`: Draco decodes, all 17 morph targets present with
  the right names, all 3 clips play, lipsync tracks the demo narration.

**Next:** add `jake` / `mj` to `AVATAR_ASSETS` in `src/components/three/Teacher.tsx`
(`visemes: true`, `animFile` = their own GLB, set `spawnLabelHeight`), then add the **CC-BY 4.0
attribution for Canino3d** — required wherever these ship. Cosmetic: MJ's skirt shows faint seams
between its 139 pleat panels; her forehead has a scalp seam from the source asset.

Rocketbox F01/M04 remain the fallback, rendered and ready, but are no longer the plan.


## 2026-09-18 (later) — V9.1 bake-off, round 1 renders

Findings, numbers and licences are in `.claude/plans/V9-REPORT.md`; renders are in `.claude/eval/2026-09-18-v9-bakeoff/`.

- Blender 5.1.1 via MCP (the add-on is outdated but works). Scene `V9_bakeoff` matches the app's lesson camera, placement and lights.
- Rendered: Marcus control; L2-a MPFB female; L2-b Rocketbox F17 and M12; L3-a the same MPFB female with cel shading and an outline. Each at lesson framing and in close-up.
- **Face rig is not the blocker any more:** MPFB (CC0) and Rocketbox (MIT) both ship 52 ARKit shapes + 15 visemes.
- Quaternius free tier dropped (Superhero bodies only, no clothes, no face). The generate-and-rig run was skipped by Hmz.
- Installed into Blender: the MPFB 2.0.17 extension + 13 CC0 asset packs. Sources are git-ignored under `sources/`.

### 2026-09-20 (later) — L3 reopened: the Canino pair goes first next session

The GLB test changed the picture. `sources/canino/MJ_sketchfab.glb` has **clean geometry and rig** (the author's FBX is the broken one) but **zero morph targets**; the FBX has the 69 shapes and a broken body. Neither file has both, so the next session's first job is to get one that does. Start prompt: `.claude/plans/NEXT-SESSION-CANINO.md`.

Rocketbox F01/M04 stay as the fallback, fully rendered and ready.

### 2026-09-20 — casting settled, L3 abandoned

- **Teachers: Rocketbox Female_Adult_01 + Male_Adult_04** (MIT). Rendered at lesson framing and close-up. Known defect: M04's hair seams where alpha cards overlap.
- **L3 dropped after testing.** Canino3d's set: the man (`Jake`) is excellent, but the woman's arms are melted in the rest mesh and the young man explodes; their GLB conversion has no shape keys. No matching free stylised female exists (~250 models searched, CC tags are fan art of copyrighted characters). `Jake` is parked in the report as a one-teacher or paid-pair option.
- Measured, against the claim that these avatars are low-res: Rocketbox ships 2048² colour/normal/specular vs Marcus's 1024²-and-below. See `quality_check.png`.

### Next
- V9.2 retarget: Rocketbox Biped -> the existing Mixamo clips (note both import traps in the report), then GLB export + compressed sizes.
- Fix M04's hair material; rename Rocketbox shapes (`AA_VI_10_aa` -> `viseme_aa`, `AK_*` -> ARKit) for `Teacher.tsx`.
- `pages/dev/avatar-lab.tsx` with demo narration for lipsync judging.

## 2026-09-18 — Wave 1 direction (V8.0, V8.0b, V9.0), no code

Branch `docs/v8-v9-programme`. Canvas: https://claude.ai/artifact/CNqx2JxQMkpyyeWXhc36HP (positioning, marks, casing, name screen, landing wireframes, classroom UI over the real scene, teacher looks).

- **Decided** (rows in decisions.md): positioning P1 "One teacher. One student. Every kid."; wide caps for hero and close only, Title Case Geist elsewhere; **keep the name Aristo**; classroom UI A (caption first); landing becomes a live 3D introduction with a pinned-scroll five-phase section; L2 and L3 teacher looks both go to the V9.1 bake-off with younger, casual casting; two new teachers; Marcus/Priya retired from the picker later; $0 animation plan.
- **Name screen:** 12 candidates, six died on specific findings (a live AI tutor on Bloom, Chiron, Hypatia; Lantern is a VPN school filters block). The full table is on the canvas.
- **V9.0 had no renders:** Blender was not running and no candidate meshes exist yet. Renders move to V9.1, where they belong anyway.

### Next
- **Mark decided:** R1 The Column, from Hmz's own pillar reference (round two on the canvas). V8.1 draws the final vector wordmark.
- **V9.1 bake-off** (wave 2): L2 and L3 candidates with L5 casting, rendered in the classroom at the real framing. Needs Blender running with the MCP add-on.
- **V8.3 now needs a plan-mode pass** before anything: 3D on `/` means a Pages Router move and a new performance plan.

## 2026-09-11 — T04b landing visual identity ("Night Class")

Branch `dev/t04b-visual-identity` off `deploy-prep`, PR into `deploy-prep`.

- **Audit first, measured.** The shipped primary button put cream text on `#F59047` at
  **2.2:1**, failing WCAG AA. That token rendered at 90% saturation while its comment claimed
  `#F97B2F`. Orange carried every job on the page (gradient headline, glow shadows, two
  blobs, tinted cells, 9 icon chips, pills, a full-orange band). The hero headline ran to 3
  lines at 1440. No `--aristo-*` token had a dark value.
- **Three directions on a canvas** (https://claude.ai/code/artifact/faee56f8-fe76-499b-9ee2-4e19f5fcf3dc):
  A Ember (keep orange, calmer), B Night Class (dark-first), C Cobalt (move the accent). Hmz
  picked **B**, **landing-only scope**, **follow the OS with a toggle**.
- **Scoped, not global:** `--lp-*` tokens under `.landing`. `/learn` + `/demo` hardcode
  `#F97B2F` ~87 times, so global tokens would have half-migrated the app. The system is
  written down in `.claude/docs/landing-design-system.md`.
- **Theme:** stored choice mirrored to `html[data-landing-theme]` by an inline pre-paint
  script; otherwise `prefers-color-scheme`. Choosing the OS's own mode clears the choice.
  Toggle in the nav at sm+, in the footer below sm (at 360px it wrapped the nav actions).
- **Type:** Archivo `wdth` 125 caps for display only, loaded from a landing-only module so it
  never preloads on `/learn`. Headline measured to 2 lines at lg/xl.
- **Gates:** type-check, lint (same 22 pre-existing warnings, none in landing), tests 85/85,
  build. `/` still static, first-load JS 120 -> 122 kB (the toggle). Checked on a production
  build in both themes; no horizontal overflow at 360/768/1024/1280/1440.
- **Red herring worth knowing:** a local capture showed the old black-hole shot in step 3.
  The server was sending the committed heart byte-for-byte; the headless browser had cached
  the old `/_next/image` response from an earlier session on the same port.

### Open

- Product-wide migration of the palette (a sweep of the ~87 hardcoded hex values) is its own task.
- The wordmark was not touched. Whether it should change now the page around it has is Hmz's call.
- Screenshots did not need re-shooting: the product did not change.

## 2026-09-10 (later) — heart demo topic, three playback bugs, PR #4 merged

- **Black holes retired, heart added, $0 of fal spend.** A black hole is light, not a
  surface: rendered through the app's own loader stack its model measured
  `0.08 x 0.85 x 1.00`, a paper-thin sliver. The heart's model and labelled teaching image
  were already paid for by the 2026-09-09 eval and were sitting in `public/demo/heart/`
  (I had wrongly reported that model as lost, having checked only the persistent cache and
  the tracked GLBs). `scripts/generate-demo-heart.ts` makes **zero fal calls**.
- **No segment visuals were generated either.** `useLessonPlayback` holds the last visible
  image when a segment supplies none, so one teaching image on `seg_005` carries the whole
  lesson. Adding real segment visuals later is ~$0.08 each and does not touch narration.
- **3,321 ElevenLabs characters**, taken from the script's `--dry-run` before spending, not
  estimated after. Alignment sidecars cost **zero** TTS credits: forced alignment bills as
  speech-to-text, and the `forced_alignment` key permission now works.

### Three bugs, all found by playing it rather than by testing

1. **Demo audio is addressed by `concept_id`, not by slug.** `useLessonPlayback` resolves
   `/demo/<lesson.concept_id>/<segment>.mp3`, so the concept id names the asset folder. The
   original two topics satisfied `slug === concept_id` by coincidence, which hid the coupling
   until a topic arrived with concept id `human-heart` and folder `heart`. Every mp3 404d, so
   every segment "ended" instantly and playback raced to segment 15 *during the loading
   screen* — which presents as "the lesson starts halfway through". `src/data/demo/index.ts`
   now asserts the invariant at module load, and the generator derives the id from `SLUG`.
2. **Missing alignment sidecars degrade lipsync silently.** 15 mp3s and 0 `.align.json` meant
   the heart fell back to the FFT guess while the volcano used real character timings. Both
   topics now have 15/15.
3. **The 3D model sat at a stale anchor.** `SCENE_*` was moved to head height so pointing
   gestures land on the diagram; `MODEL_*` was left at the old `(1.1, -0.4)` behind a comment
   arguing head height would crowd the avatar's face, while the comment above `SCENE_*` still
   claimed both shared the anchor. They share it again.

### Landing page

The last stale asset is replaced: `classroom-3d-model.webp` is now Hmz's own capture of the
heart at the shared anchor. It was cropped from the left rather than squashed, because the
source frame was 1.96:1 against the 1.78:1 the other two shots use and a mismatched intrinsic
aspect makes `next/image` reserve the wrong space.

**PR #4 merged into `deploy-prep`** with both checks green, which deploys to production.

### Still open

- **T04b visual identity** (`.claude/plans/T04b-landing-visual-identity.md`) — its own
  session. Palette at 90% saturation, flat typography, no dark mode. Note the brief was
  corrected: the wordmark is NOT a blocker on the typography work, they are independent.
- **Multiview pricing is the one unpinned row** in `pricing.ts`, because fal reports that
  endpoint in credits rather than per generation. Reconcile against the dashboard after the
  first real production run.
- Optional, ~$0.16: two real segment visuals for the heart if one static board across fifteen
  segments reads thin next to the volcano's two.
- ElevenLabs: ~2,879 credits left after this session.

## 2026-09-10 — 3D root-caused and fixed, landing rebuilt twice

Continues the T04 branch (`dev/t04-landing-page`, PR #4 into `deploy-prep`).

**The demo 3D models were bad for a reason nobody had measured.** Not the mesh, not the
generator: **texture coverage**. Tripo's single-image path paints only the surface its one
source view can see and fills the rest with flat pale grey. Unpacking the volcano's albedo
atlas showed roughly half of it as featureless filler, and under the classroom's
`<Environment preset="studio">` a large pale surface at roughness 0.37 reads as chrome. The
metalness theory was tested and rejected (measured 0.011).

`scripts/eval-multiview-3d.mjs` proved the fix for $0.67: one strong three-quarter front view
(nano-banana-pro), three rotations of it by *editing* that view (flux-pro/kontext), then
`tripo3d/tripo/v2.5/multiview-to-3d` at texture HD. Editing rather than regenerating is what
keeps the four inputs the same object. The new atlas carries basalt across the whole surface.
The volcano in `/demo` is that model: **658 KB**, against 1.65 MB single-view and 4.0 MB for
the TripoSR original. Better and smaller each time.

Wired into production behind a per-topic decision: the teaching agent now returns
`model_needs_multiview`, reasoning about whether the sides and back differ meaningfully from
the front. Four views cost ~$0.67 against $0.303, so a planet does not pay the price of a
heart. `generate3dModelMultiview` falls back to single-view if any view edit fails.

**Glow topics now opt out of 3D entirely.** A black hole is light, not matter, so image-to-mesh
returns torn shards. `teaching.ts` guidance previously excluded only "abstract concepts, code,
processes"; it now also excludes fire, plasma, gas, fields, forces, waves, explosions, and
anything whose appearance is its glow.

**Also fixed: the Pages Router never had the Geist font variables.** They were declared inline
in the App Router root layout and set on its `<body>`, so `/demo`, `/learn` and `/dev/*` fell
back to the browser's default serif. An undefined `var()` does not fall through to the next
family; the whole declaration is dropped. Both fonts now come from `src/lib/fonts.ts`, and the
Pages Router side defines the properties on `:root` from `_app.tsx`. Two dead ends recorded in
the commit: a wrapper in `_app.tsx` leaves body-level Radix portals serif, and `_document.tsx`
cannot do it at all because next/font is only wired up from `_app` or a page.

**The landing page was rebuilt a second time** against the `design-taste-frontend` skill's
audit, which failed the first version on seven mechanical counts: 8 em-dashes in rendered copy
(now 0), 8 eyebrow labels against a budget of 3 (now 2), 12 corner radii (now 4, documented in
`shape.ts`), four consecutive zigzag splits (now four distinct layouts), three-equal-cards
twice (now a six-cell bento), a five-element hero with 28-word subtext (now four and 17), and
no press feedback on any control.

### Open

- **Visual identity is NOT done** and Hmz has called it: the orange is 90% saturation against
  the skill's 80% ceiling, the lowercase wordmark undersells, and he wants a dark mode.
  Brief written: `.claude/plans/T04b-landing-visual-identity.md`, to run as its own session.
- **The two landing images that show a 3D model are stale** (they show the old rejected one).
  Re-shoot after confirming the new volcano looks right.
- **The black-hole demo topic should be swapped** for something with real geometry. A full
  topic swap is roughly $0.80-1.00 plus TTS quota; the model is the cheap part.
- The heart model from the earlier eval **does not exist**: those scripts called fal directly
  and never persisted. The cache has only the two models from this session's regen.
- Multiview pricing is the one row in `pricing.ts` not pinned to a fal API reading, because
  the API reports that endpoint in credits. Reconcile against the dashboard after a real run.

## 2026-09-09 (T04) — landing page rebuilt

Branch `dev/t04-landing-page` off `deploy-prep`. `src/app/page.tsx` went from a hero plus
three emoji cards to a full page in `src/components/landing/`: nav, split hero, capability
strip, four-step how-it-works, six-card feature grid, a parents strip, a closing CTA and a
footer. Design canvas approved before any code was written
(https://claude.ai/code/artifact/d0d76f20-e5f9-4051-8ee3-ea36eb68a1d5).

- **The product visuals are real, and they come from `/demo`, not `/learn`.** Three stills
  captured from a **production build** with a dependency-free CDP driver: the volcano lesson
  with its generated cross-section, the generated black-hole model standing in the room with
  its labels, and the desk quiz. `/demo` renders the same classroom, avatar and lesson panel
  but is public, session-free and calls no paid API, so re-shooting costs nothing. Exported
  as WebP at 1760px into `public/images/landing/` (80-133 kB each), served through
  `next/image`.
- **The 3D shot is the black hole, not the volcano, and that was forced.** In the volcano
  lesson the generated mesh sits behind the lesson panel and cannot be framed without
  cropping the panel out. The black-hole model stands clear of it, with its accretion disk,
  event horizon and bent-light-ring labels legible.
- **Motion is `react-intersection-observer` + a CSS transition, not framer-motion.** Same
  reveal, ~2 kB instead of ~38 kB: `/` first-load JS is **120 kB** (146 kB with
  framer-motion), statically prerendered. `prefers-reduced-motion` is honoured by a media
  query in `globals.css` rather than a JS branch, so there is no first-paint animation to
  undo.
- **The hero is deliberately NOT wrapped in `Reveal`.** Its start state is `opacity: 0` and
  Chrome does not credit a transparent element as painted, so wrapping the classroom
  screenshot (the LCP candidate, preloaded with `priority`) pushed LCP out by hydration plus
  the transition. Above the fold there is nothing to reveal anyway.
- **The reveal cannot leave the page hidden.** A `<noscript>` rule unhides everything when
  JS never runs, and an element that is still hidden re-checks its own rect on a 1200 ms
  interval, clearing the interval once shown. That second net is not theoretical:
  IntersectionObserver delivered no callbacks at all in the CDP-driven Chrome used for
  verification. It is a repeating check rather than a one-shot timer because any one-shot
  latch has to guess once whether the observer is healthy, and both guesses fail — giving up
  eagerly kills the animation for the whole tab after one slow load, and trusting a single
  callback leaves everything already stood down permanently hidden if delivery stops. Both
  were written and both were caught in review; the repeating check needs no guess. Verified
  by scrolling a production build: 1 of 15 revealed at rest, then 4, 6, 13, 15 on the way
  down.
- **One new token**: `--aristo-orange-deep` (`23 75% 43%` — the #C05A1C already hardcoded
  around the learn/demo components) plus its `aristo.orange-deep` Tailwind colour. Nothing
  else in the palette changed.
- Copy is honest by construction: no testimonials, no user counts, no logos. The parents
  strip says what is tracked (mastery, answers, session length), that access is
  approval-gated, and that lessons are AI-generated and can be wrong.
- **Not done, on purpose**: no FAQ (offered, not requested); `LEGAL_LINKS` in
  `SiteFooter.tsx` is an empty array, so the privacy/terms row renders nothing rather than
  shipping dead links.
- Gates: `yarn type-check`, `yarn lint` (22 warnings, all pre-existing, none in the new
  files), `yarn test` (83/83), `yarn build` — all green. No horizontal overflow at 360, 768,
  1024, 1280 or 1440, verified by measuring `scrollWidth` against `innerWidth`.

**Found while capturing, NOT fixed (out of T04 scope):** `pages/_app.tsx` never applies the
`--font-geist-sans` / `--font-geist-mono` variables — those are set on `<body>` in
`src/app/layout.tsx`, which the Pages Router never renders. So on `/demo` and `/learn` the
`font-sans` declaration resolves to `var(--font-geist-sans), system-ui, sans-serif` with an
undefined custom property, which invalidates the whole declaration and drops bold text to
the default serif. It is visible in the landing screenshots. One-line fix in `pages/_app.tsx`;
touching `/learn` was explicitly out of scope here.

## 2026-09-09 (final) — tiered image models applied

**Eval artifacts kept:** `.claude/eval/2026-09-09-pipeline/` (README + 16 comparison images
+ 4 reference GLBs, Draco-compressed, 7.6 MB) is the evidence behind every choice below, and
the thing to point a fresh session at. The good heart model is demo-ready at
`public/demo/heart/model.glb` (1.88 MB).

Acting on the eval above. `generateInfographic` gained a `tier` option:

- **"pro"** (`fal-ai/nano-banana-pro`, $0.15) — topic teaching image only, because
  `visual_walkthrough` narration cites its labels by name.
- **"fast"** (`fal-ai/nano-banana-2`, $0.08) — segment visuals. Measured equal to Pro on
  text accuracy, 2.1x faster.

Two details that matter:

1. **The model is part of the cache key** (`cacheKey(prompt, style, model)`). Without it the
   two tiers would serve each other's images out of L1/L2 for the same prompt+style. This
   re-keys every existing infographic entry — free right now, since `generated_assets` was
   emptied after the T06 probe.
2. **`RESTRAINT_SUFFIX` is appended on the fast tier only.** NB2 renders text as well as Pro
   but volunteers titles, explanatory paragraphs, "RESULT:" boxes and callouts labelling
   styling rather than content — an image that explains itself talks over the teacher who is
   narrating. Verified with one more generation ($0.08): the same flow prompt that produced
   a cluttered poster came back as a clean numbered chevron diagram, correct labels, no
   title, no paragraphs. Not applied to Pro, which is already restrained.

Per concept now **$0.77** (1 Pro teaching image + 4 NB2 segment visuals + FLUX + Tripo3D),
against $0.82 before for a worse 3D model — the whole quality upgrade lands cheaper than the
status quo, and lessons render faster.

Total eval spend across the session: **$2.43** of the $3 Hmz authorised.

## 2026-09-09 (latest) — pipeline eval run, $2.35 spent, three findings

Hmz authorised up to $3 for one round of real generations. Spent **$2.352**. Eval called fal
**directly**, not through `banana.ts`, so `usage_events` stays clean (verified: still 57 rows,
unchanged) — same precedent T07 set.

**1. Nano Banana 2 matches Pro on text. My earlier assumption was wrong.**
Tested on three *real* segment prompts pulled from `cached_lessons` — all text-heavy Python
material (code snippets with quotes and line numbers, `python3 --version` / `Python 3.12.0`,
labelled flow boxes). This is the hardest text workload the product has. **NB2 garbled nothing
in 3/3.** Pro also 3/3. Text fidelity is a tie, so the premise for keeping Pro on segment
visuals ("NB2 is worse at labels") does not survive contact with the actual prompts.

The real difference is **design restraint**, and it cuts both ways:
- Pro is disciplined and glanceable; on the flow prompt it was *too* sparse (three boxes in a
  sea of white).
- NB2 is richer and more engaging — its flow diagram is the better teaching visual — but it
  over-annotates, adding explanatory paragraphs and useless callouts ("Terminal Background
  (Dark)"). That competes with the teacher's narration, which is the thing narrating.

Latency, measured: **Pro avg 27.6 s** (19.2 / 34.9 / 28.6) vs **NB2 avg 12.9 s** (16.1 / 9.8 /
12.9) — NB2 is **2.1x faster**, matching the vendor claim.

**2. The FLUX source step must stay — proven, not assumed.**
Fed the labelled NB Pro teaching infographic to Tripo3D as an alternative source: it extruded
the label text and leader lines into the geometry, producing garbled 3D lettering and arrows
sticking out of the heart. Unusable. The clean, unlabelled, single-object FLUX source is
load-bearing, and that architectural split is now justified by evidence.

**3. T07's suggested FLUX prompt tweak is harmful — do NOT apply it.**
Tested "solid opaque forms, thick volumetric shapes, no transparency, no thin membranes" on
the exact case T07 flagged (animal cell). It **backfired**: FLUX rendered the membrane as a
glassy petri dish, so Tripo3D reconstructed only the loose contents and returned disconnected
floating blobs. The unmodified prompt produced a coherent solid disc. T07's hypothesis is
refuted; the current prompt stays.

**Tripo3D v2.5 confirmed good in production shape.** Heart from a FLUX source came out
volumetric, anatomically plausible, with coronary vessels and clean PBR — the "flat coin"
failure that made TripoSR unusable is gone. Latency 63-82 s, well inside the new 240 s
timeout. Response fields confirmed as `task_id, model_mesh, base_model, pbr_model,
rendered_image`, so the shipped `pbr_model ?? model_mesh` fallback is correct.
One caveat: Tripo's own `rendered_image` preview came back blank on one of five calls even
though the mesh was fine (14.9 MB) — treat that preview as unreliable, never as a health check.

## 2026-09-09 (later) — Tripo3D v2.5 swap + fal pricing correction

Same branch `dev/t06-persistent-cache`, on top of T06. **Not yet run against fal** — the
swap is code-complete but deliberately unverified to preserve credits (Hmz's call).

- **`fal-ai/triposr` -> `tripo3d/tripo/v2.5/image-to-3d`** (`texture: "standard"`,
  `pbr: true`, $0.30/gen). T07 scored it 4/5 vs TripoSR's 1.5/5 and it is faster
  (78 s vs ~100 s). Cache prefix `triposr|` -> `tripo25|` so old meshes are unreachable;
  `GeneratedModel.tsx` drops the `-PI/2` X rotation (Tripo3D is Y-up glTF); 240 s timeout
  added around `fal.subscribe`, which has none of its own and hung once in the eval.
- **The fal pricing table was wrong on its biggest line.** `fal-ai/nano-banana-pro` was
  set to $0.04 — that is the **non-Pro** rate ($0.0398) — while fal charges **$0.15**. The
  cost dashboard has understated infographic spend **3.75x**. Corrected against fal's own
  pricing API (`GET https://api.fal.ai/v1/models/pricing?endpoint_id=<slug>`), which is
  authoritative and free to query — the docs pages disagree with each other. Now pinned by
  `pricing.test.ts` so the next drift fails CI.
- **Real per-concept economics, one-time, post-T06** (~4.5 NB Pro images per concept,
  measured from `usage_events`):

  | | images | FLUX | 3D | total |
  |---|---|---|---|---|
  | before (as billed) | $0.68 | $0.003 | $0.07 | **$0.75** |
  | after this swap | $0.68 | $0.003 | $0.30 | **$0.98** |
  | if segment visuals move to nano-banana-2 | $0.36 | $0.003 | $0.30 | **$0.66** |

  So the 3D upgrade is +31%, not the 4.3x that a 3D-only comparison implies — and switching
  the image model would more than pay for it.
- **Open recommendation, not done:** `fal-ai/nano-banana-2` (Gemini 3.1 Flash Image) is
  $0.08 vs Pro's $0.15, 2-3x faster (4-8 s vs 10-20 s), and fal's own comparison rates it
  *better* for infographic text spacing/readability; Pro's edge is print-grade typography,
  which Aristo does not need. Worth an A/B on real segment prompts before switching — that
  costs credits, so it is queued, not done. Would also cut lesson latency, which is the
  other half of the `/learn` loading complaint.

## 2026-09-09 (later) — T06 persistent generation cache COMPLETE

Branch `dev/t06-persistent-cache`, merged up from `deploy-prep` first (so it carries the
lipsync, demo and avatar-clone work). Closes the last open T06 item.

- **`src/lib/imagegen/banana.ts` has a real L2 layer** under the existing L1 memory cache:
  lookup `(kind, prompt_hash)` in `generated_assets` -> generate via fal -> download ->
  upload to the public `generated-assets` bucket -> upsert row -> serve the durable Supabase
  URL from then on. `concept_id` threaded through `/api/generate-model`,
  `/api/generate-model/3d`, `/api/learn/segment-visuals` and their call sites.
- **Migration 016 is applied** to the live DB (was the blocker; done by hand in the SQL
  Editor — PostgREST has no arbitrary-SQL endpoint, so agent sessions cannot run DDL).
- **Bucket decision: PUBLIC** (Hmz, 2026-09-09). Generated educational images, no learner
  data, content-addressed unguessable paths, CDN-cacheable, no signing round trip — so the
  URLs stay safe to hold in the L1 cache and in lesson payloads. Verified live:
  `cache-control: public, max-age=31536000`.
- **Acceptance criteria proven live**, each run in its own process so L1 was truly cold:
  run 1 generated in 3683 ms and wrote one `usage_events` row ($0.003); run 2 served the
  identical URL in 300 ms with **no new cost row**; with the bucket renamed to a wrong name,
  generation still succeeded (warn, no throw, fal URL served, no row written for an
  unstorable object). Total verification spend $0.009; all test rows/objects deleted after.
- **Defect found and fixed while verifying.** A row does not prove the object exists —
  `getPublicUrl` never checks — so row-present + object-deleted returned a URL that 400s,
  and because the row kept "hitting", generation never re-ran: a silent, permanent broken
  image. `lookupPersistedAsset` now confirms a hit with a bounded `HEAD` (1500 ms); a
  definitive 400/404 drops the stale row and regenerates (self-healing), anything else
  fails open and serves the URL. Costs ~100 ms per hit vs ~3800 ms to regenerate.
- Gates: `yarn type-check`, `yarn lint` (pre-existing warnings only), `yarn test` (76/76),
  `yarn build` — all green.

## 2026-09-09 — avatar T-pose + idle drift (one root cause)

Two reported bugs, one cause. `Teacher.tsx` mounted the **globally cached** GLTF scene
directly (`<primitive object={scene} />`, no clone) and mutated it via `scene.traverse`
(materials, per-frame morph influences). Every Teacher instance therefore drove the *same*
bone objects.

- **T-pose on every avatar except the default.** Marcus and Priya share
  `animations_Avaturn.glb`, so `useGLTF` returns the same `animations` array for both.
  drei memoises actions on that array, so switching between them never rebuilt the actions —
  they stayed bound to the previous rig's bones and the new avatar was driven by nothing.
- **Marcus slowly twisting out of position when idle.** A mixer from an earlier mount kept
  animating those shared bones alongside the live one; two mixers crossfading the same Hips
  on each 20s idle cycle reads as small weird turns accumulating.

Ruled out on the way, with measurements rather than guesses:
- Missing animation files — all present.
- Bone-name mismatch — Priya's clip targets resolve 100% against her mesh (Ryan/Sonia miss
  only 13 `_end` leaf tips out of ~79, which cannot cause a T-pose).
- A "turn to the blackboard" idle clip — parsed the GLB accessors: root yaw across
  Idle/Idle2/Idle3/Idle4 stays within ±6° and translation is ~0. No clip turns him.
- `rotationY` — a static prop (0.3), never animated.

Fix: clone per mount (`SkeletonUtils.clone`, memoised on the cached scene) so each rig owns
its skeleton and edits stay local; key `<Teacher>` by avatar in `Experience.tsx` so a switch
fully remounts (new group, mixer, actions); stop the mixer's actions on unmount.

**Verified running 2026-09-09.** Loaded `/learn` and switched through Ryan / Sonia / Priya /
Marcus: all four animate, none T-pose. Left Marcus idle for several minutes — he holds
position, no drift or turning. Typecheck, lint, tests and build all pass.

## 2026-09-08 (later) — V7 alignment lipsync, demo path built

Same branch `dev/v2-instant-demo`, still uncommitted.

- **New `src/lib/lipsync/visemes.ts`** turns ElevenLabs character timings into a merged
  viseme timeline. 26 unit assertions in `visemes.test.ts`, including a 60fps playback
  simulation (mouth active >70% of a clip, 3-25 shape changes/sec, never frozen >0.6s) —
  the failure modes that only show up in motion.
- **`prerender-demo-tts.mjs --align`** sends existing mp3s to `/v1/forced-alignment` and
  writes `<seg>.align.json` beside each. Resumable; treats an alignment as stale when the
  mp3's byte count stops matching the `audioBytes` recorded in it.
- **`useTTS` prefers timings over the FFT.** `getCurrentViseme()` reads the timeline when
  one is loaded, else falls through to wawa-lipsync unchanged. The sidecar fetch is
  fire-and-forget (playback never waits) and generation-guarded (a late sidecar cannot
  attach to a later segment). Teacher.tsx needed no changes — it already consumed
  `getCurrentViseme()`, which is why that was the seam to pick.
- **BLOCKED on one command.** `api.elevenlabs.io` is denied by this session's egress policy
  and the desktop VM has no outbound DNS, so no alignment file exists yet. Run
  `node scripts/prerender-demo-tts.mjs --align` from a normal shell: 30 segments, ~7.4 min
  of audio, **0 TTS characters** (Forced Alignment bills as speech-to-text).
- **Not verified in motion.** The demo playthrough could not be re-run: the dev server
  stopped serving the `DemoClient` dynamic chunk after repeated recompiles (only 8
  resources loaded, no canvas ever mounted, GLBs themselves fine at 200). Restart
  `next dev`. What was verified live: the sidecar 404s and the mp3 still serves 200 — the
  intended degrade path.
- Safety net worth keeping: `parseAlignment` rejects payloads whose `generator` is not an
  ElevenLabs run, so a hand-made placeholder degrades to the FFT rather than driving the
  mouth from invented timings.
- **`/learn` now gets alignment too** (same day, after the demo-only version was rightly
  called out as pointless on its own). `/api/tts` calls `/with-timestamps`, which returns
  character timings with the audio **at the same character cost and with no extra key
  scope** — unlike Forced Alignment, which needs `forced_alignment` enabled on the key and
  is what the demo's `--align` pass hit a 401 on. Response is JSON (base64 audio +
  alignment); `useTTS` sniffs the content type, so the plain-audio fallback still works.
  `parseAlignment` now normalises both ElevenLabs shapes — the parallel arrays
  `with-timestamps` returns and the array-of-objects Forced Alignment returns.
- Three independent ways this degrades rather than breaks, because none of it could be run
  against the live API from here: upstream failure falls back to the plain endpoint;
  a missing or malformed alignment leaves lipsync on the FFT; `TTS_TIMESTAMPS=off` disables
  the timestamped call without a code deploy.

### Shared-audio race found and fixed while debugging the above

Reported symptoms on `/learn`: audio lagging, narration not playing the whole segment, and
the avatar never returning to idle. All three were **one pre-existing bug**, not the
alignment work. Instrumenting the audio element during a live free-topic answer showed
three `/api/tts` calls starting within 13ms of each other and three different blobs loading
within 60ms, each `abort`+`emptied`-ing the previous.

Cause: one `<audio>` singleton, four independent narrators — `FreeTopicCard.tsx:122`,
`InputBox.tsx:91`, `LessonView.tsx:256/263/281/614/645`, `useLessonPlayback.ts:470` — and
nothing arbitrating between them. Overlapping `speak()` calls both completed their fetches
and both set `audio.src`. `speak()`'s internal `stop()` never set the previous call's
`cancelled` flag (only `controller.stop()` did), so a superseded fetch happily clobbered
whatever was playing.

Why it produced each symptom: the loser's audio was killed ~50ms in (**"didn't run the
whole part"**); three full-price generations ran concurrently and slowed each other from
~1.3s to ~4.2s (**"lagging"**); and `abort`/`emptied` do **not** fire `ended`, so the losing
caller's `onEnd` never ran and any component waiting on it — the lesson engine — hung
forever with `gesture` stuck (**"not coming back to idle"**). That last one is the direct
answer to "does the audio have an ending mark": it does, but only the winner ever gets it.

Fix in `useTTS`: speech is explicitly owned (`_speechSeq` / `_activeSpeech`). Only the
holder may touch the element, and a superseded caller gets its `onEnd` so it is released
rather than left waiting. Verified live — abort count went 3 -> 0 and a 34.6s clip played
through cleanly.

**Fixed (2026-09-08).** Corrected diagnosis after reading the call sites: it was not three
components narrating different slices. In FREE mode two components narrated *the same
answer*:

- `InputBox.tsx:91` speaks `data.definition + data.explanation` imperatively the moment
  `/api/teach` returns.
- `FreeTopicCard.tsx:122` speaks `parsed.definition + parsed.explanation` from a mount
  effect when it is the latest card — the same content, re-parsed out of the markdown
  summary InputBox built, which is why the two clips were near-identical but not equal
  (32.93s vs 32.04s).

The third call is `reactStrictMode: true` (next.config) double-invoking FreeTopicCard's
effect in dev. So production duplicates 2x, dev 3x.

`LessonView` and `useLessonPlayback` are course-mode narrators and are mutually exclusive
with free mode (`MessagePanel.tsx:64-67` returns early), so they never overlap with these —
they are separate owners, not part of this race.

Cost: a ~32s answer is roughly 500 characters, so each free-topic question billed ~1,000
(prod) or ~1,500 (dev) instead of ~500 — against a 10,000/month tier.

Two changes, both on Hmz's call:

1. **`FreeTopicCard` owns free-topic narration**; the `speak()` call is gone from
   `InputBox`. The card renders the answer, speaks the parsed text that matches what is on
   screen, and already handled the explaining/idle gesture and unmount cleanup — none of
   which InputBox did (it only toggled `isSpeaking`, which is why the avatar's gesture
   handling was unreliable on this path).
2. **`useTTS` shares one in-flight request per (voice, text)** (`_inflight` +
   `fetchTtsShared`). Concurrent duplicate calls now wait on the first request rather than
   opening their own, which kills the StrictMode double-fire in dev and protects against any
   future component narrating something already being fetched. Entries clear as soon as the
   request settles, so speaking the same text again later still refetches.

Verified live on `/learn`: one free-topic question went from **3 `/api/tts` calls to 1**,
request time from ~2.7-4.2s to **1.69s**, and aborts from 3 to **0**.

## 2026-09-08 — demo narration, avatar default, ops unblocked

Branch `dev/v2-instant-demo` (merged up from `deploy-prep` first, so it now carries T10's
CI/tests). **Uncommitted at time of writing.**

- **Demo narration is pre-rendered ElevenLabs audio**, not browser speechSynthesis.
  `scripts/prerender-demo-tts.mjs` (dependency-free node, reads `.env.local`, resumable,
  `--dry-run`) wrote 30 mp3s / 7,029 chars into `public/demo/<slug>/`. `useTTS` gained a
  `srcUrl` option that points the singleton audio element at a static file; that element is
  what wawa-lipsync analyses, so **this is what made lipsync work on the demo at all** —
  speechSynthesis exposes no audio buffer. Per-segment fallback to speechSynthesis if a file
  fails to load. Verified in-browser: 0 `/api/` requests across a full lesson.
- **DEFAULT_TEACHER is now `marcus`** (`useAristoStore.ts`), on `/learn` as well as `/demo`.
  Reason: ryan has 0 viseme morphs and sonia has no mouth morphs at all, verified by parsing
  the GLB JSON chunks — neither can ever lipsync. Cost: cold `/learn` goes ~3.6 MB -> ~12.7 MB,
  partly undoing T02. Accepted deliberately: a teacher whose mouth does not move undercuts the
  product's main visual claim. `Teacher.tsx`'s module-scope preload became
  `preloadDefaultAvatar()` called from `LearnClient` — at module scope it also charged `/demo`
  2.5 MB for an avatar it discards. Sign-in prefetch retargeted to marcus.
- **Pricing note corrected**: Sonnet 5's $2/$10 is now standard; the scheduled 2026-09-01 rise
  to $3/$15 was cancelled. The old comment told a future session to bump the row, which would
  have overstated every lesson cost by ~50%. Rates were and are correct.
- **User actions cleared**: migration 016 applied, admin bootstrap SQL run, fal.ai topped up,
  Resend fully wired in Vercel (RESEND_API_KEY prod+preview, ADMIN_NOTIFY_EMAIL and APP_URL
  added as Config, prod+preview) — takes effect on next deploy.
- **New brief**: `V7-alignment-lipsync.md`. Current lipsync is an FFT guess; ElevenLabs
  character timings would make it real. Free on `/learn` (`with-timestamps` bills the same
  characters); the demo can use Forced Alignment on the existing mp3s, billed as STT, so it
  costs no TTS quota.
- Backlog: sonia's phantom `mouthSmile` morph added to `UX-POLISH-BACKLOG.md` as item 0.

## 2026-07-13 — T10 ops hardening (autonomous parts)

- Branch `dev/t10-ops-hardening` (off `deploy-prep`), not pushed. CI (`.github/workflows/ci.yml`),
  Vitest unit tests (4 files / 47 tests: BKT, FSRS, profiler, pricing — all pure logic, no
  network mocking), `.env.example` refreshed, and a read-only live-DB migration reconciliation
  (all 15 migrations confirmed applied) are done. Resend env vars, admin bootstrap SQL, and
  Sentry are user-dependent — runbook at `.claude/plans/T10-RUNBOOK.md`.

## 2026-07-12 — Roadmap era

- Desk quiz + head-turn camera + free-mode 3D hardening shipped (was branch
  `dev/desk-quiz-3d-fixes`, merged to `deploy-prep`).
- Full project audit done. **Active work queue: `.claude/plans/README.md`** (vision tier
  V1–V6 + maintenance tier T01–T11 + UX polish backlog). Session continuity:
  `.claude/plans/SESSION_HANDOFF.md`.
- Production = Vercel `deploy-prep` branch. `master` promotion still pending (needs Vercel
  dashboard branch switch).

## Phase Status — all 9 phases complete

| Phase | Name | Status |
|-------|------|--------|
| 1 | Knowledge Graph Foundation | ✅ |
| 2 | Learner Profile + Mastery | ✅ |
| 3 | Teaching Agent 5-Phase Protocol | ✅ |
| 4 | Quiz Generation + Answer Evaluation | ✅ |
| 5 | Course Builder + Progression | ✅ |
| 6 | Spaced Repetition Engine (FSRS) | ✅ |
| 7 | Behavioral Profiling | ✅ |
| 8 | RAG Pipeline (pgvector + OpenAI embeds) | ✅ |
| 9 | Student Dashboard + Admin Cleanup | ✅ |

## What's Next (post-Phase-9 polish)

- **Vercel deploy** — env vars in Vercel dashboard, verify `maxDuration = 60` on lesson route if Sonnet stalls
- **RAG seeding** — admin-only `POST /api/kg/ingest` per domain (needs `OPENAI_API_KEY`)
- **End-to-end 3D test** — fal.ai pipeline works with `FAL_KEY`; verify model appears in scene
- **Phase 10 (planned)** — real-time voice (ElevenLabs / Whisper to replace Web Speech), shared sessions via Supabase Realtime
- **Lesson streaming** — would replace the synchronous `generateLesson()` JSON return with progressive 5-phase render; requires LessonView + lesson route restructure (deferred)

## Migration State

All run; no pending. `001_initial_schema` → `016_generated_assets` (no `007` — quiz_attempts went into `006_mastery`).
- `005_reset_and_graph.sql` — drops FSLSM tables, builds `concepts` / `concept_prerequisites`
- `006_mastery.sql` — `learner_profiles`, `user_concept_mastery` (+ SRS), `user_course_progress`, `user_misconceptions`, `session_logs`, `quiz_attempts`
- `008_courses.sql` — `courses` + `course_id` FK
- `009_quiz_constraints.sql` — `UNIQUE(user_id, concept_id, misconception)`, `increment_misconception()` RPC
- `010_rag.sql` — vector extension, `reference_chunks` + HNSW index, `match_reference_chunks()` RPC
- `015_user_approval.sql` — `profiles.approval_status` + companion columns for the admin approval gate
- `016_generated_assets.sql` — persistent generation cache (T06): `generated_assets` keyed
  `UNIQUE (kind, prompt_hash)`, RLS read-for-authenticated / write-via-service-role; pairs
  with the public `generated-assets` Storage bucket. Applied 2026-09-09.
