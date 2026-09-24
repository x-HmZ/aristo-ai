# V9.6 gesture catalogue: built on the stage and the lesson (proposal, 2026-09-24)

Hmz, after reviewing the first clips: "think about better actions ... a longer catalog, built on the
surroundings and situations that can rise up and that make sense overall". This is that catalogue. Every
row names what is physically around the teacher, what is happening in the lesson at that moment, and the
signal that already exists for it. Nothing here needs a new app signal or a lesson-schema change.

## Status (2026-09-25)

**Batch 1 is done and wired** (Almost, Exactly, WellDone, ThatsIt, GlanceBoard, plus the approved PresentModel and
Encourage); see V9-REPORT "V9.6". Batches 2 and 3 are next, on Opus. Batch 2 needs the director to read segment
roles (`hook`, `demo_step`, `transition`, `challenge_setup`) and phases, which it does not do yet.

## Settled so far in V9.6 (Hmz)

- PresentModel and Encourage: approved in motion.
- Talking6 / Talking6M (greeting wave): play at 0.75 (a `timeWarp` of [0.75, 0.75], data only).
- ShakeNo stays in the wrong-answer pool at a lower weight than the new clip (proposed 1 to 3).
- Jake's PP viseme softened to 0.6 (MJ too): looks better.
- LookAgain v1 (tilt and nod) and LookAgainHand: rejected. Why they failed is the reason for this doc (below).

## The stage (what the teacher can relate to)

| Thing | Where, from the teacher | Signal |
|---|---|---|
| The student | The camera: in front, slightly to his left, at eye height | always |
| The board / image panel | Up and to his left (screen right), about shoulder height | `activePreviewImageUrl` |
| The generated 3D model | The same spot as the board image | `activeModelUrl`, `modelInteracting` |
| The student's desk and quiz paper | Low, in front of the camera | `activeQuiz` |
| The teacher's own space | In front of his chest: where "shaping" and "counting" gestures live | - |

There are no props and nothing he can touch. Hand-to-body and hand-to-face contact is out (the Canino
proportions put hands through the chest and chin, V9.1e), and so is hand-to-hand contact (Clapping never
closes, V9.2).

## Why LookAgain missed

- A nod means "yes". On a wrong answer, it said the opposite of the words.
- The hand towards the desk pointed at nothing: a challenge answer is typed in the answer panel, not on the
  desk. The desk only matters when the quiz is handed out (row 18).
- What actually happens on a wrong answer: the student submits, the shake fires, and the next segment
  (`challenge_reveal`, "here's what to consider") starts at once, usually with the lesson image still on the
  board. So a real "let's look at that again" means looking back at the board, and it has to be short
  because the teacher is already talking.

## The catalogue

"Have" = shipped clip. "New" = Tier 2, authored in Blender. The trigger column says whether the director
already has the scenario (**now**) or needs a new scenario from an existing signal (**wire**: director and
manifest, presentational only, with tests and a `typescript-reviewer` pass).

### A. Arriving and waiting

| # | Situation | What a good teacher does | Clip | Trigger |
|---|---|---|---|---|
| 1 | The student arrives | A friendly wave | Talking6 / 6M at 0.75 (have) | now: `greeting` |
| 2 | Nothing happening, attentive | Stands easy, small weight shifts | Idle, Idle2, Idle4 (have) | now: `idle` |
| 3 | Quiet for a long time | Glances over at the board and back, as if rereading it | **GlanceBoard** (new, head and upper) | now: `longWait` |
| 4 | Preparing a lesson or an answer | "One moment": a gently raised index finger, then the thinking loop | **OneMoment** (new) + Thinking (have) | wire: `isLoading` rising edge |

### B. Teaching

| # | Situation | What a good teacher does | Clip | Trigger |
|---|---|---|---|---|
| 5 | Hook ("imagine if...") | Both palms open outward and slightly apart, a curious head tilt | **Imagine** (new) | wire: segment role `hook` |
| 6 | Explaining an idea | Shaping it in the air: hands in front, palms facing, as if holding the idea | **HoldIdea** (new), plus the talking pool (have) | wire: phase `explain`, one beat per segment |
| 7 | A new image lands on the board | Turns to it with an open hand: "take a look at this" | PresentModel (have, same spot) | wire: `activePreviewImageUrl` changes |
| 8 | Calling out a part of the image | Points at it | Pointing (have); **PointNear**, the left index, the near hand (new, full body: pointing plays on the base layer) | now: `point` |
| 9 | Demonstrating step by step | A small chop per step: "first... then..." | **StepBeat** (new) | wire: segment role `demo_step` |
| 10 | The 3D model appears | Presents it | PresentModel (approved) | now: `presentModel` |
| 11 | The student turns the model around | Watches the model with interest, hands at rest | look layer (have) | now |
| 12 | Moving on | Hands move the last idea aside: "now, next" | **MoveOn** (new) | wire: segment role `transition` |
| 13 | Connecting it all | Two hands come together in front, not touching: "it all fits" | **BringTogether** (new) | wire: phase `connect`, one beat per segment |

### C. Checking understanding

| # | Situation | What a good teacher does | Clip | Trigger |
|---|---|---|---|---|
| 14 | Posing the question | An open palm towards the student: "your turn" | **YourTurn** (new) | wire: segment role `challenge_setup` |
| 15 | Waiting for the answer | Patient, head slightly tilted, listening | Idle pool (have); **PatientTilt** (new, head) | now: `listen` |
| 16 | Right answer | A nod, or an open hand towards the student: "exactly!" | Nodding (have); **Exactly** (new) | now: `correct` |
| 17 | Wrong answer | A warm "hmm, almost": head tilt and a small side-to-side hand wobble, before the reveal starts | **Almost** (new) + ShakeNo (have, lower weight) | now: `wrong` |
| 17b | Wrong answer with an image on the board | Turns back to the board: the real "let's look at that again" | **BackToBoard** (new, short, a lighter PresentModel) | wire: `wrong` with an image up |

### D. Quiz and wrap-up

| # | Situation | What a good teacher does | Clip | Trigger |
|---|---|---|---|---|
| 18 | The quiz is handed out | An open hand down towards the student's desk: "over to you" (the desk gesture belongs here) | **OverToYou** (new) | wire: `activeQuiz` rising edge |
| 19 | Student working on the quiz | Looks at the desk, patient | look layer + idle (have) | now: `quizLook` |
| 20 | Quiz passed | "Well done": both hands open outward, a smile | Nodding (have); **WellDone** (new) | now: `quizGood` |
| 21 | Quiz not passed | "You're getting there" | Encourage (approved) | now: `quizSupportive` |
| 22 | Lesson complete | Both palms up, "and that's it!", then a goodbye wave | **ThatsIt** (new) + the wave (have) | now: `lessonComplete` |

## Suggested batches

1. **Finish V9.6 (manifest data, plus the clip-level `look` for GlanceBoard):** Almost (replaces LookAgain in `wrong`, ShakeNo
   at the lower weight), Exactly, WellDone, ThatsIt, GlanceBoard. Five overlay clips, all on scenarios that
   exist today.
2. **V9.7, role-aware teaching (director wiring from existing signals):** Imagine, HoldIdea, StepBeat,
   MoveOn, YourTurn, BringTogether, plus PresentModel reused when a new image lands.
3. **V9.7b, events and base clips:** OneMoment, BackToBoard, OverToYou, PatientTilt, PointNear.

The tool needs two small additions for batch 3: per-finger control (an extended index with the others
curled, for PointNear and OneMoment), and building a full-body clip on top of a base loop (PointNear).
Batches 1 and 2 use what V9.6 already built.

## Honest limits

- These stay emblematic, pose-to-pose gestures. Talking acting stays mocap (the plan's Tier 2 limit).
- Each clip is judged by Hmz in motion before it is wired, as for V9.6.
- In V9.6 a clip took one to three drafts before it read at the classroom camera, and one of four
  (LookAgain) missed on meaning, which only Hmz's review caught. Expect the same ratio.
