# V9 — A new teacher, and an animation library that reacts to the lesson

**Model:** see `V8-V9-estimates-models-tooling.md` per phase (Opus 5 decides, Sonnet 5 builds)
**Depends on:** nothing to start (V9.0 and V9.1 can run today). **Feeds:** V8.3 hero video,
V8.5 room, V8.7 re-capture. **Written:** 2026-09-11. Market facts verified that day (sources
at the bottom); re-check anything time-sensitive before acting on it.

This is its own programme because it has more moving parts than it looks: the look, the
licence, the web weight, the face rig for lipsync, the skeleton for retargeting, the
library, the triggering logic and the performance budget all constrain each other.

## The goal

1. **A different-looking teacher** who reads as the future of teaching: warm, credible, not
   childish, not corporate, not uncanny, for 11 to 14 year olds and the parents watching.
2. **Good quality at no licence fee. This is now a hard constraint** (Hmz, 2026-09-12): $0 for
   assets and tools, commercial use allowed, shipping inside the web app allowed. Quality comes
   from engineering and free sources; see "Getting ActorCore quality without buying it".
3. **An extensive animation library**, organised so animations are **triggered by lesson
   scenarios** (greeting, explaining, pointing at a model, waiting for an answer, reacting to
   a right or wrong answer, and so on) instead of today's handful of generic clips.

**Boundary (same as V8):** no change to lesson logic, APIs or the lesson schema. Scenarios
are driven by signals the app **already emits**. Anything that needs a new signal is listed
as "later" and needs Hmz's OK.

## What exists today (read before designing)

- `src/components/three/Teacher.tsx`: `AVATAR_ASSETS` maps `ryan | sonia | marcus | priya`
  to a scene GLB, an animation GLB, clip pools and morph names. `marcus` and `priya` are
  Avaturn exports with ARKit blendshapes and Oculus visemes (~9.6 MB each). `ryan` and
  `sonia` have no viseme morphs, which is why `DEFAULT_TEACHER` became `marcus`
  (`src/store/useAristoStore.ts`). A custom teacher from `/create-teacher` (Avaturn) plays
  `CUSTOM_ANIMATIONS_URL = /models/animations_Avaturn.glb`. **That flow must keep working.**
- **Animation set:** 16 clips in `public/models/animations_Avaturn.glb` (1.98 MB), built by
  `scripts/build_avaturn_animations.py` (Blender, constraint retarget) from Mixamo Y-Bot FBX
  files in `scripts/y_bot_animations/`: Idle ×4, Talking ×6, Thinking ×2, Pointing, Nodding,
  ShakeNo, Clapping.
- **Behaviour:** `AvatarGesture = idle | pointing | nodding | shaking | explaining`. Teacher
  resolves `isLoading → thinking`, `isSpeaking → talking`, else idle; `pointing` layers over
  talking; nod and shake play once and revert; idle variants cycle every 20 s.
- **Face:** `useTTS().getCurrentViseme()` returns a viseme from ElevenLabs alignment timings
  (V7) or the wawa-lipsync FFT fallback; Teacher drives the matching morph. Blink uses
  `eyeBlinkLeft`. Each mount clones the rig (`SkeletonUtils.clone`); `<Teacher>` is keyed by
  avatar so switching remounts cleanly (the 2026-09-09 T-pose fix). Keep both.
- **Pinned:** three 0.161, R3F 8.18, drei 9.117 (react-reconciler constraint). No upgrades.

## Hard requirements for any teacher that ships

| Requirement | Bar |
|---|---|
| Licence | $0, commercial use, redistribution inside the app allowed. Recorded per file in `public/models/LICENSES.md` with source URL and date |
| Face rig | Oculus 15 visemes, or ARKit 52 blendshapes to derive them from, **plus** blink, smile and brow shapes. No viseme morphs = disqualified (the Ryan/Sonia lesson) |
| Skeleton | Humanoid, retargetable (Mixamo-style names or a documented bone map) |
| Web weight | Avatar GLB ≤ 4 MB compressed (Draco/meshopt), ≤ 60k triangles, textures ≤ 2048px |
| Look | Judged on real renders **in the Aristo classroom at the real camera framing**, both themes of the surrounding UI. Never judged from a vendor thumbnail |
| Cast | At least two teachers, as today (Marcus/Priya), so learners can choose |

## Candidate sources (status verified 2026-09-11)

**Avatars**

| Source | Cost / licence | Face rig | Fit notes |
|---|---|---|---|
| **Meshy** (text-to-3D and image-to-3D) | **Free plan output is CC BY 4.0: commercial use allowed but attribution required.** Paid plans give full ownership. The CC0 claim in the 2026 research applies to Meshy's own asset-library pages, not to what you generate on the free tier | **None. Generated meshes carry no blendshapes** | GLB-native, Blender plugin. Best ergonomics for "here is an image, give me a model". Credits are spend, so it needs approval |
| **Tripo** (v3) | Credits (spend). Already used in the product for lesson objects through fal | None on the mesh; its auto-rig is body-only | Quad topology, built-in auto-rig and auto-animate. Same face caveat |
| **Avatar SDK / MetaPerson** | First avatar free, Pro $800/mo | ARKit blendshapes | The vendor Ready Player Me pointed users to. Photoreal selfie avatars, which is the direction this brief is moving away from |
| **Avaturn** (current vendor) | Free Basic export (Pro is $800/mo, not needed) | ARKit + visemes | Proven in this codebase. Mostly realistic, so the uncanny issue remains unless a stylised output meets the bar. Verify what styles the free tier exports today |
| **VRoid Studio / VIVERSE Avatar Creator → VRM** | Free; VRM spec is MIT | 5 vowel visemes (aa ih ou ee oh); ARKit "perfect sync" possible with extra work | Anime aesthetic, a strong risk with Western parents. Needs `@pixiv/three-vrm`: **verify compatibility with three 0.161 before anything else** |
| **Quaternius Universal Base Characters** | CC0 | Probably none; add 15 viseme shape keys in Blender | Stylised base meshes on the same universal rig as the Quaternius animation libraries. Good path to a custom look if faces can be sculpted to a high bar |
| **Generated character** (Hunyuan3D or Hyper3D via the Blender MCP) + auto-rig (Mesh2Motion or Mixamo auto-rigger) + hand-made visemes | Hyper3D credits cost money; Hunyuan3D weights are free but need a local GPU | None; add in Blender | Most control over the look, highest risk (topology for facial deformation, hands). Any paid generation needs Hmz's OK |
| **Microsoft Rocketbox** | MIT (verify) | Varies; verify blendshapes | Realistic and somewhat dated. Mostly a fallback |
| **MetaHuman** | Free under $1M revenue; allowed in any engine since June 2025 | Full facial rig | Best realism, which is the wrong direction for this brief, and far too heavy for the web without a large LOD/export project. Include only for completeness |
| ~~Ready Player Me~~ | Shut down 31 Jan 2026 (Netflix acquisition) | | Excluded |
| Paid (Character Creator, marketplace) | Not $0 | | Excluded unless nothing free meets the bar. That call is Hmz's |

**Animations**

| Source | Licence | What it gives | Notes |
|---|---|---|---|
| **Mixamo** (Adobe) | Free, commercial use, royalty-free. No redistribution as standalone asset files | The largest free library: talking, gesturing, pointing, thinking, idle, reactions, sitting, walking | Needs an Adobe login. **Hmz downloads; Claude never enters credentials.** Claude prepares the exact clip list. Ship only inside the app's GLBs |
| **Reallusion AccuRIG 2** | **Free**, no per-use fee | Auto-rigs any humanoid mesh, **body only** | The strongest free auto-rigger and it needs no Adobe account. Use it on a generated or CC0 mesh. It does not produce facial blendshapes |
| **Reallusion ActorCore** | **Mostly paid.** ~4,500 motions, about 32 free; single clips roughly $1.50 to $12; packs up to about $200, bundles from $14.99 | n/a | The best library for what Aristo actually needs (conversation, presenter, gesture, teaching acting), and the reason to consider breaking the $0 rule. See the budget decision below |
| **Quaternius Universal Animation Library 1 and 2** | CC0 | UAL1 120+ clips (free Standard tier has 45), UAL2 130+; universal humanoid rig | Strong on locomotion and emotes; check the free tier for teaching-relevant clips before buying the full tier (not $0) |
| **Mesh2Motion** | Code MIT, animations CC0 | Browser rigging tool plus an animation set | Also useful as a free auto-rigger for a generated or base mesh |
| **NVIDIA Kimodo** (text-to-motion, March 2026) | Code Apache-2.0; **SOMA** checkpoints under the NVIDIA Open Model License (commercial OK); **SMPL-X checkpoint is research-only: do not use it** | Bespoke clips from text ("teacher gestures toward something floating on their left, then back to the student") | Needs ~17 GB VRAM, or under 3 GB with the text encoder on CPU. Output needs retargeting from SOMA to our rig. Optional, for scenarios no library covers |
| ~~Ready Player Me animation library~~ | Built for RPM armatures only; RPM itself is gone | | Excluded |

## The pipeline from Hmz's research, and the gap in it

The proposed chain is the right shape for this project:

```
image or text prompt -> Meshy or Tripo -> GLB mesh -> AccuRIG (auto-rig, body)
   -> ActorCore / Mixamo / CC0 clips (retarget, bake) -> GLB with animations -> three.js
```

**What it misses is the face.** Every generate-then-auto-rig path produces a body rig and no
facial blendshapes, and AccuRIG rigs bodies, not faces. Aristo's teacher must lip-sync:
`useTTS().getCurrentViseme()` drives viseme morphs every frame, and an avatar without them
repeats the Ryan/Sonia failure. Any pipeline starting from a generated mesh needs one of
these, and **V9.1 must prove it before the pipeline is adopted**:

1. **Sculpt the shapes by hand in Blender** as shape keys: 15 Oculus visemes plus blink,
   smile and brow. Feasible on a stylised face with clean topology, slow on a photoreal one.
   Budget a session for this alone.
2. **Start from a platform that ships blendshapes** (Avaturn, MetaPerson, VRM perfect-sync)
   and restyle materials, hair and clothing rather than geometry.
3. **Hybrid:** generated head retopologised onto a base mesh that already has the shapes.
   Most effort, best result, only if 1 and 2 both fail.

Two more checks on any generated mesh: hands (image-to-3D routinely mangles fingers, and this
teacher points at things), and edge loops around mouth and eyes good enough to deform.

## Getting ActorCore quality without buying it (decided 2026-09-12)

Hmz cannot spend right now, so **the programme is $0 and the plan is built around that.**
ActorCore stays on the shelf as a later upgrade, not a dependency.

The important realisation: **the teacher does not feel dead because there are too few clips.**
There are already 16 (Idle x4, Talking x6, Thinking x2, Pointing, Nodding, ShakeNo, Clapping).
It feels dead because nothing decides *when* to play them, nothing varies them, and the body
is otherwise perfectly still. Most of the perceived gap is engineering, and engineering is free.

### Tier 1 (free, biggest win): make the clips you already have go further

- **The director** (V9.3) maps all 21 scenarios onto the existing pools. Alone, this is the
  single largest perceived improvement.
- **Variation from what exists**, generated once in Blender and baked as extra clips:
  **mirroring** (a left-handed point becomes a right-handed one), **time-warping**
  (the same gesture at 0.85x and 1.15x reads as two different beats), **partial-body
  blending** (Talking arms over a different weight-shifted stance), and **start-offset**
  cycling. Sixteen clips become forty believable ones at no cost.
- **Procedural life at runtime**, no clips at all: breathing, slow weight shift between feet,
  head and eye look-at (camera, board, model, desk), blinks and saccades, micro-nods while
  listening, additive idle sway. This is what separates "a 3D model playing a loop" from
  "someone standing in a room". Cheap on CPU, infinitely variable.
- **IK pointing:** rather than one baked Pointing clip, aim the arm at the actual target
  (board, model, desk) at runtime. One clip covers every direction and always points at the
  right thing.

### Tier 2 (free, Claude's labour in Blender): author the emblematic gestures

Claude can author a specific class of motion well through the Blender MCP, by writing the
keyframes and curves directly: **pose-to-pose emblematic gestures** where timing is forgiving
and the shape carries the meaning. Realistic targets: open-palm present, arms-open welcome,
beckon, shrug, hand-to-chin thinking, small "hold on" stop, thumbs-up, counting one-two-three
on fingers, a gentle "let's look again" correction, and transitions between stances.

**Be honest about the limit.** Hand-keyframed full-body *talking acting* (the thing mocap
libraries sell) will read stiffer than mocap, because Claude's feedback loop is still frames
from the viewport, not motion. So: procedural and emblematic gestures authored here, and the
Talking pools stay mocap (Mixamo). Every authored clip is reviewed by Hmz in motion on
`/dev/avatar-lab` before it ships.

### Tier 3 (free, Hmz's labour, optional): perform the signature gestures

If a few gestures must feel unmistakably like teaching, the cheapest authentic source is Hmz
performing them. Either as **reference video** for Claude to key against in Blender (free,
unlimited), or through a free video-to-mocap tier. **Rokoko Vision free is 30 seconds per
month, FBX export only** (single camera since Vision 3.0), so it is a trickle for 3 to 5 hero
clips over a couple of months, not a library. Check the ToS for commercial use before relying
on it.

### What is NOT available free, so do not plan around it

- **NVIDIA Kimodo** (text-to-motion, commercial-friendly checkpoints) needs CUDA and dedicated
  VRAM. This machine has **Intel Iris Xe integrated graphics**, so it cannot run locally.
  Only via a rented or free cloud GPU, which is spend or flaky. Dropped from the plan.
- **Cascadeur Free** forbids commercial use and exports only its own `.casc` format; FBX
  export and commercial use need the paid Indie plan (under $100k revenue). Not a free path.
- **Academic speech-gesture mocap datasets** (BEAT, ZeroEGGS, Trinity, AMASS and similar) are
  research or non-commercial licensed. **Do not ship motion derived from them.** Verify the
  licence of any dataset before touching it.

### The free sources that do work

| Source | Licence | Use |
|---|---|---|
| **Mixamo** | Free, commercial | The backbone: talking, gesturing, pointing, thinking, idle, reactions, greetings. Richer for conversation than the vendor blogs selling alternatives imply. Hmz downloads from the prepared list |
| **ActorCore free tier** | Free (about 32 motions) | Take the free ones; they are production-grade mocap |
| **Quaternius UAL 1 and 2** | CC0 | Free tiers for locomotion and emotes |
| **Mesh2Motion** | CC0 animations, MIT tool | Gap filling, and a free auto-rigger |
| **AccuRIG 2** | Free | Auto-rig, body only, no Adobe account |

### Design so buying later costs nothing

Clips are referenced through the manifest (V9.3), never hardcoded. If budget appears later,
dropping in ActorCore's conversation and presenter bundles is a **data change**: new files,
new manifest rows, no code. Record that in the manifest's header comment so a future session
knows the upgrade path. Rough figure when the time comes: **$50 to $150** buys the 20 to 30
clips that carry the teaching feel.

## The scenario catalogue (what triggers what)

Every scenario maps to a signal that exists today. Clip counts are minimums, so repetition
never shows. Layers: **base** (full body), **upper** (upper-body gesture over the base),
**face** (expression plus visemes), **look** (head and eye aim).

| # | Scenario | Existing trigger | Clips | Layer | Play |
|---|---|---|---|---|---|
| 1 | Idle, attentive | nothing else active | 4+ | base | loop, cycle |
| 2 | Idle, long wait | idle ≥ 25 s (a timer inside the director, not a new app signal) | 2 | upper | once |
| 3 | Greeting | `sceneReady` becomes true | 2 | upper + face | once |
| 4 | Thinking / preparing | `isLoading` | 3 | base | loop |
| 5 | Talking, neutral | `isSpeaking` | 6+ | base | loop, cycle |
| 6 | Talking, Activate phase (curious, inviting) | `isSpeaking` + current segment's phase | 3 | upper | cycle |
| 7 | Talking, Explain phase (lecturing) | same, phase `explain` | 3 | upper | cycle |
| 8 | Demonstrate: point at the board image | `gesture === "pointing"` | 3 | upper + look (board) | while active |
| 9 | Demonstrate: present the 3D model | `activeModelUrl` set | 2 | upper + look (model) | once, then idle-present |
| 10 | Model being inspected by the learner | `modelInteracting` | 1 | look (model) | while active |
| 11 | Challenge: pose the question | phase `challenge` and speaking | 2 | upper | cycle |
| 12 | Waiting for an answer | `awaitingAnswer` | 3 | base + look (student) | loop |
| 13 | Answer correct | `useLessonPlayback.ts` ~580: `setGesture(data.is_correct ? "nodding" : "shaking")`, the correct branch (also check the other `nodding` call at ~560 and name that case) | 3 (nod, small clap, open-hand praise) | upper + face (smile) | once |
| 14 | Answer wrong, encouraging | the same line, `shaking` branch. Restyle as "let's look again", never a scolding head shake | 3 | upper + face | once |
| 15 | Quiz on the desk | `activeQuiz` set | 2 | look (desk) + upper | while active |
| 16 | Quiz finished | `quizResult` set; branch on score | 2 good + 2 supportive | upper + face | once |
| 17 | Connect phase (summarising) | phase `connect` and speaking | 2 | upper | cycle |
| 18 | Lesson complete | `isComplete`, returned by `useLessonPlayback` (hook state, not in the store: pass it to the director through props, which is presentational wiring, not new functionality) | 2 | upper + face | once |
| 19 | Free-mode explaining | `gesture === "explaining"` (`FreeTopicCard.tsx`) | 3 | base | loop |
| 20 | Blink, micro-expressions, breathing | always | procedural | face | continuous |
| 21 | Eye contact | default look target is the camera, with drift and saccades | procedural | look | continuous |

**Later (needs a new signal, so Hmz's OK):** learner speaking into the mic (the listening
state is local to `AnswerInputPanel.tsx`, not in the store), raise-hand interruption (V1),
XP and level-up celebrations (V5), greeting by name (V4), and LLM-authored gesture cues per
segment (a lesson-schema change).

## Architecture

1. **Animation manifest** (`src/lib/avatar/animationManifest.ts`): every clip with id,
   source and licence, scenario tags, layer, loop or once, duration, weight, cooldown, and
   whether it is mirrorable. The data lives here, not in `Teacher.tsx`.
2. **Avatar director** (`src/lib/avatar/director.ts`, pure and unit-tested with Vitest):
   takes the current signals and returns what each layer should play. Priority rules,
   variety without repeats (no clip twice in a row, cooldowns), crossfade durations. It
   replaces the ad-hoc resolution in `Teacher.tsx`; `Teacher.tsx` becomes a renderer of the
   director's output. Test it like the BKT/FSRS tests: pure logic, no three.js.
3. **Layers in three.js 0.161:** base clips on the mixer; upper-body gestures as subclips
   filtered to upper-body bone tracks (three has no bone masks, so filter the tracks); gentle
   overlays via `AnimationUtils.makeClipAdditive`; look-at as clamped head and eye rotation
   applied after the mixer each frame; face = visemes from `useTTS` plus expression morphs
   plus procedural blink.
4. **Loading:** a base pack (idle, talk, think) loads with the teacher; scenario packs load
   lazily after `sceneReady`. The T02/T03 load budget must not regress.
5. **Custom teachers keep working:** every pack is baked for each shipped rig **and** for the
   Avaturn rig that `/create-teacher` produces.

## Phases

**V9.0 — Look direction (canvas, no code).** **Model: Opus 5** (`/model opus`). Taste, not reasoning; no Fable.

Build a design canvas with 4 to 6 look
directions as turnaround renders placed in the real classroom at the real camera framing
(Blender MCP renders of candidate models). Cover at least: stylised-realistic, clean
stylised (illustrated 3D), and the current realistic look as a control. Hmz picks a direction
and says whether Marcus and Priya stay available as options.

**V9.1 — Bake-off.** **Model: Opus 5 to judge, Sonnet 5 to build the lab page.** Escalate to **Fable 5.1** only if the viseme route will not come together: proving the face rig is the make-or-break reasoning here.

Take the 2 or 3 strongest candidates for the chosen look. For each:
licence verified and recorded; triangle and texture counts; compressed size; face rig
inventory (which visemes and blendshapes exist); a quick retarget of 3 existing clips
(Idle, Talking, Pointing); loaded in a new `pages/dev/avatar-lab.tsx` (Pages Router, like
the other `/dev` pages) with the demo narration and alignment playing so lipsync can be
judged. Also run the generate-and-rig pipeline end to end once (Meshy or Tripo mesh -> AccuRIG ->
three retargeted clips -> **visemes added by one of the three routes above**), so the face gap
is proved solved or ruled out before that pipeline is adopted. Write
`.claude/plans/V9-REPORT.md` with renders, numbers, licence notes and a recommendation.
Hmz decides.

**V9.2 — Library assembly and retarget pipeline.** **Model: Fable 5.1 to design and debug the pipeline, then Sonnet 5 to grind.** The one phase where Fable clearly earns 2x: a long agentic loop across Blender, bone maps, retarget failures, root motion and compression, where a wrong call surfaces forty clips later. Use it on 2 or 3 clips until the pipeline is right, then `/model sonnet` in the same session for the rest. Do not leave Fable on for bulk conversion: identical work at twice the price.

Generalise
`scripts/build_avaturn_animations.py` into `scripts/build_animation_pack.py` (Blender,
driven through the Blender MCP or run headless) that takes a source list plus a target rig
and outputs pack GLBs: retarget, remove root motion, resample to 30 fps, trim, export. Then
compress with `@gltf-transform/cli` (already a dev dependency): resample, prune, Draco or
meshopt. Source every scenario in the catalogue. Prepare the Mixamo clip list for Hmz to
download. Total animation payload ≤ 3 MB per rig.

**V9.3 — Director and scenario wiring.** **Model: Opus 5** designs the director and its tests, **Sonnet 5** writes them. Pure logic with unit tests, so mistakes are cheap to catch; no Fable.

Manifest plus director plus unit tests; wire
`Teacher.tsx` to it; implement the layer system. Every catalogue row has at least the listed
number of variants.

**V9.4 — Face and gaze.** **Model: Sonnet 5**, escalating to Opus 5 if viseme mapping on the new rig misbehaves.

Visemes verified on the new rig with the alignment timeline and the
FFT fallback; expression morphs for the correct, encouraging, greeting and thinking
scenarios; blink and saccades; look targets (camera, board, model, desk). This overlaps T08's
"gaze and blink polish"; do it here and tick it there.

**V9.5 — Integration.** **Model: Sonnet 5.** Budgets, wiring and docs against a settled design.

New default teacher(s); `AVATAR_ASSETS` updated; the teacher picker
and `/create-teacher` still work; load budget measured before and after; docs (`CLAUDE.md`
avatar notes, `.claude/docs/architecture.md`, `state.md`, `decisions.md`); `LICENSES.md`
complete. Then V8.7 re-captures the landing footage.

## Acceptance criteria (whole programme)

- Hmz signed off the look in V9.0 and the candidate in V9.1.
- $0 spent on assets; every shipped file licensed and recorded.
- Every scenario row plays at least its minimum variants; no clip repeats back to back.
- No T-pose, foot sliding, or hands through the body at any camera framing; crossfades
  ≤ 0.4 s without pops; lipsync visibly articulates on the demo lessons.
- 60 fps on mid-range hardware in the lesson scene (record numbers); `/learn` cold load not
  worse than before.
- Demo lessons, free mode, desk quiz, 3D model display, the teacher picker and custom
  teachers all behave exactly as before.
- Director logic covered by unit tests; `yarn type-check`, `lint`, `test`, `build` green.

## Things only Hmz can do

- Log in to Adobe and download the Mixamo clips from the prepared list, and create a free
  ActorCore account for its ~32 free motions. Claude must not create accounts, enter passwords,
  or make purchases.
- Review each Claude-authored gesture in motion on `/dev/avatar-lab` and give notes; stills
  cannot show timing.
- Optional: perform 3 to 5 signature teaching gestures on camera as reference video.
- Keep Blender running with the `blender-mcp` add-on server started when a session needs it.
- Approve any spend (generated characters, a paid animation tier) and the two look decisions.
- Optional: run Kimodo locally if the machine has a suitable GPU.

## Model discipline (keeping this cheap without losing quality)

Per-phase choices are stated above. The rules behind them:

1. **Match the model to the failure mode.** Taste work is verified by looking, so use Opus and
   judge the output. Reasoning whose mistakes surface much later (a retarget pipeline, an
   anchor contract) is where a stronger model pays for itself.
2. **Fable 5.1 is 2x Opus 5 ($10/$50 against $5/$25) and always thinks**, so it is reserved for
   V9.2, and as an escalation in V9.1, V8.5 and V8.3's capture pipeline. Nowhere else.
3. **Split the session at the design/grind seam.** Let the expensive model produce the plan or
   crack the hard case, then switch to Sonnet and execute in the same session. Switching mid
   session costs one cache write (about $1 on a 100k context), far less than running the
   expensive model through an hour of mechanical edits.
4. **Escalate on evidence, not nerves.** If a session stalls twice on the same problem, switch
   up. Starting everything on the biggest model grows the bill without moving the quality.
5. **Haiku 4.5 for mechanical passes only** (token sweeps, confirmed dead-code removal, doc
   ticks), never for anything judged by eye.
6. **One sub-task per session.** Cost scales with how much context is re-read each turn, so a
   long wandering session costs more than two focused ones. Write decisions into the brief so
   the next session reads a conclusion instead of re-deriving it.
7. **Send wide searches to subagents** (Explore or general-purpose): they burn their own
   context instead of growing the main session's.
9. **A session cannot change its own model.** Where a phase says "then switch", the session
   must stop and say so in plain words; the human switches. See `MODEL-SWITCHING.md`.
8. **Setting the model:** in the desktop app use the model picker; in a terminal session use
   `/model opus`, `/model sonnet`, `/model haiku`, `/model opusplan`. If no short alias for Fable is offered,
   pick `claude-fable-5-1` from the picker.

## Status checklist

- [ ] V9.0 look direction chosen
- [ ] V9.1 bake-off report, candidate chosen
- [ ] V9.2 animation packs built for the new rig(s) and the Avaturn rig
- [ ] V9.3 manifest, director (tested), layers wired
- [ ] V9.4 face, expressions, gaze
- [ ] V9.5 integrated, budgets measured, docs and LICENSES.md done

## Sources (checked 2026-09-11)

- Ready Player Me shutdown: https://variety.com/2025/digital/news/netflix-acquires-ready-player-me-games-avatar-creation-1236612915/ and https://avatarsdk.com/blog/2026/01/15/switch-from-ready-player-me-to-avatar-sdk-fast-familiar-production-ready/
- Platform status overview (vendor blog, Avatar SDK; treat as biased): https://avatarsdk.com/blog/2026/08/31/avatar-platforms-2026-whos-alive-whos-gone/
- Avaturn pricing: https://avaturn.me/pricing/
- Mixamo licence: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- Quaternius UAL (CC0): https://quaternius.com/packs/universalanimationlibrary.html and https://quaternius.com/packs/universalanimationlibrary2.html
- Quaternius Universal Base Characters: https://quaternius.com/packs/universalbasecharacters.html
- Mesh2Motion (MIT / CC0): https://github.com/Mesh2Motion/mesh2motion-app
- NVIDIA Kimodo: https://github.com/nv-tlabs/kimodo
- MetaHuman licence change: https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/
- VRM overview: https://news.viverse.com/post/vrm-models-explained
- RPM animation library (excluded): https://github.com/readyplayerme/animation-library
- Meshy licensing per plan (free is CC BY 4.0, paid is full rights): https://www.meshy.ai/pricing
- AccuRIG 2, free: https://actorcore.reallusion.com/auto-rig and https://www.cgchannel.com/2025/07/rig-and-animate-3d-characters-for-free-with-accurig-2-0/
- ActorCore free vs paid motions: https://actorcore.reallusion.com/free
- Avatar SDK / MetaPerson as the RPM replacement: https://avatarsdk.com/blog/2026/01/15/switch-from-ready-player-me-to-avatar-sdk-fast-familiar-production-ready/
- Poly Haven (CC0): https://polyhaven.com/ and Quaternius: https://quaternius.com/
- Rokoko Vision free tier (30s/month, FBX): https://www.rokoko.com/products/vision
- Cascadeur licensing (Free = no commercial use, .casc only): https://cascadeur.com/plans
