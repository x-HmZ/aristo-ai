# V8 + V9 — Estimates, models, skills and tooling

Companion to `V8-brand-and-experience-redesign.md` and
`V9-teacher-avatar-and-animation-library.md`. Written 2026-09-11. Estimates are for Claude
Code sessions in this repo, not calendar time; a "session" is one focused context that ends
with a PR or a decision.

## Scale

| Size | Meaning |
|---|---|
| **S** | Under half a session. Mechanical, low judgement |
| **M** | One session |
| **L** | Two to three sessions, or one session with a hard verification loop |
| **XL** | Four or more sessions, or several phases with a decision point between them |

Risk means the chance the first attempt misses the bar and needs another round, not danger.

## Models

Your global policy is **`opusplan`**: Opus plans, Sonnet executes. Concretely:

- **Opus 5** (`/model opus`): decisions and taste. Direction canvases, brand and copy
  judgement, evaluating candidates, designing the avatar director, art direction.
- **`opusplan`**: most build tasks. Opus in plan mode for the approach, Sonnet 5 for the edits.
- **Sonnet 5** (`/model sonnet`): straightforward execution against a settled design.
- **Haiku 4.5** (`/model haiku`): mechanical sweeps only (token passes on admin pages,
  dead-code removal after it is confirmed dead, doc ticks). Never for design judgement.

Fable 5.1 is the fourth option; where it earns its price is set out just below.

### Is Claude Fable 5.1 worth it here?

Anthropic positions Fable 5.1 as "for demanding reasoning and long-horizon agentic work", and
its own guidance is to start with Opus 5 and reach for Fable when Opus at high effort falls
short. It always thinks, defaults to high effort, and is slower.

Prices per million tokens: **Fable 5.1 $10 in / $50 out** against **Opus 5 $5 / $25**, so
exactly 2x. The one place Fable is cheaper is cache reads: **$0.25 against $0.50**
(2.5% of input vs 10%), which matters because a long agentic session re-reads a cached context
on every turn.

Modelled on a heavy session (about 150 turns, ~80k average context, 90% cache hits, and 40%
more output tokens for Fable because thinking is always on and billed as output):

| | Cache reads | Cache writes | Output | **Session total** |
|---|---|---|---|---|
| Opus 5 | 10.8M x $0.50 = $5.40 | 1.2M x $6.25 = $7.50 | 200k x $25 = $5.00 | **~$18** |
| Fable 5.1 | 10.8M x $0.25 = $2.70 | 1.2M x $12.50 = $15.00 | 280k x $50 = $14.00 | **~$32** |

So roughly **1.8x per session, about $14 more on a heavy one**. Across the whole V9 programme
(9 to 12 sessions) that is **$120-180 on Opus against $220-320 all-Fable**. Using Fable only
on the two or three hardest sessions costs **$30-45 extra**.

**Recommendation:** do not default to Fable. Spend the allowance where the work is genuinely
long-horizon and expensive to get wrong: **V9.2 (retarget pipeline)** and **V9.1 (bake-off)**,
optionally **V8.5 (room, anchor constraints)**. Everything else stays Opus-decides,
Sonnet-builds. A good escalation rule: if an Opus session stalls twice on the same problem,
restart that task on Fable rather than starting it there.

Note: if your Fable usage is included in a plan rather than billed per token, the dollar
figures above are the value of the allowance you would consume, not an invoice.

Reviews after every meaningful change, per your CLAUDE.md: `typescript-reviewer` (or
`code-reviewer`) subagent; `security-reviewer` wherever a secret or service-role key is
touched (V8.3's KG snapshot script).

## Per-task table

| Task | Size | Sessions | Risk | Model | Skills to load | MCP / tools | Needs from Hmz | Spend |
|---|---|---|---|---|---|---|---|---|
| Token refactor (running now) | M | 1 | Low | Sonnet | design-system | Browser, puppeteer | Review /demo before and after | $0 |
| **V8.0** Direction lock | M | 1 | Low | **Opus** | design-taste-frontend, design | none | Five picks on the canvas | $0 |
| **V8.0b** The name (keep or change) | M | 1 | Med | **Opus** decides, Sonnet screens | none specific | WebSearch (domain, trademark, handles) | The decision; professional clearance search before filing | $0 (registration/clearance is later, if he changes it) |
| **V8.1** Brand foundation | M | 1–2 | Med | Opus decides, Sonnet applies | design-taste-frontend, brand-voice (ref lib), seo (ref lib) | none | Approve positioning line and mark | $0 (fal only if approved for mark references) |
| **V8.2** Design system v2 | L | 2 | Med | opusplan | design-system, vercel:shadcn, design-taste-frontend | Browser, puppeteer | none | $0 |
| **V8.3** Landing v3 | L–XL | 3 | Med–High | opusplan | design-taste-frontend, frontend-design, dataviz, video-editing (ref lib), security-review | puppeteer, Browser, **ffmpeg**, Supabase (MCP or local script) | Install ffmpeg; sign off hero clip | $0 (reuses demo audio) |
| **V8.4a** Lesson panel and controls | L | 2 | Med | opusplan | frontend-design, design-system, vercel:react-best-practices | Browser, puppeteer | Review states | $0 |
| **V8.4b** Quiz and answers | M–L | 1–2 | Med | Sonnet | frontend-design, design-system | Browser, puppeteer | none | $0 |
| **V8.4c** Free mode, pickers, loading | M | 1 | Low | Sonnet | frontend-design, design-system | Browser | none | $0 |
| **V8.5** Environment art direction | L | 2–3 | **High** | **Opus** directs, Sonnet executes | design (canvas for render comparisons) | **Blender MCP**, context7 (three/drei), puppeteer | Blender running; approve renders | $0 (CC0 first; generation only if approved) |
| **V8.6** App pages | M–L | 2 | Low–Med | Sonnet (Haiku for the admin token pass) | frontend-design, design-system | Browser | Test account or screenshot review | $0 |
| **V8.7** Re-capture, assets, cleanup | M | 1 | Low | Sonnet (Haiku for dead-code removal) | seo (ref lib) | ffmpeg, puppeteer | Confirm legacy deletion | $0 |
| **V9.0** Look direction | M | 1 | Med | **Opus** | design | **Blender MCP** (renders) | Pick the look; keep or retire Marcus/Priya | $0 |
| **V9.1** Bake-off | L | 2 | **High** | **Opus** judges (Fable if it stalls), Sonnet builds the lab page | none specific | Blender MCP, context7, Browser | Pick the candidate | $0 |
| **V9.2** Library, retarget pipeline, clip multiplication + authored gestures | XL | 3–4 | **High** | **Fable 5.1 worth it here**, else opusplan | none specific | **Blender MCP**, gltf-transform (already a dev dep) | **Mixamo downloads (Adobe login)**; review authored gestures in motion | $0 |
| **V9.3** Director and scenarios | L | 2 | Med | **Opus** designs, Sonnet builds | vercel:react-best-practices | context7 (three AnimationMixer, drei useAnimations) | none | $0 |
| **V9.4** Face and gaze | M–L | 1–2 | Med | Sonnet | none specific | Browser, context7 | Judge lipsync and expressions | $0 |
| **V9.5** Integration | M | 1 | Med | Sonnet | vercel:react-best-practices | Browser, puppeteer | Final sign-off | $0 |

**Totals:** V8 ≈ 16–20 sessions, V9 ≈ 9–12 sessions, about 25–32 in all. Two tracks run in
parallel, so the critical path is roughly 14–17 sessions deep.

## Order of work (revised 2026-09-12: avatar and 3D first)

Hmz's call, and it is right: the landing page's hero is the teacher in motion, so building the
landing before the teacher means shooting the footage twice. The only thing that must come
*before* the avatar is the look decision, because the teacher is the brand.

| Wave | Do | Why here |
|---|---|---|
| **1** | **V8.0 + V8.0b + V9.0: one direction wave** (brand direction, **the name**, teacher look, and confirming the $0 animation strategy) | These are one decision. Opus, no code. The name must be settled before anything is drawn or written around it |
| **2** | **V9.1 bake-off** (gate: the teacher is chosen and the viseme route is proved) | Everything downstream depends on this answer |
| **3** | **V9.2 library** + in parallel **V8.2 design system v2** (needs the token refactor merged) | Different files, no overlap. The design system unblocks all UI work |
| **4** | **V9.3 director** + **V9.4 face and gaze** | Needs the library from wave 3 |
| **5** | **V8.5 room** + **V9.5 integration** | The room and the teacher land together, so the scene is shot once |
| **6** | **V8.4a/b/c classroom UI** + **V8.1 brand copy and mark** | The UI around the new scene, and the words for the landing |
| **7** | **V8.3 landing v3**, with the hero video captured from the finished scene | One capture, not two |
| **8** | **V8.6 app pages**, then **V8.7 cleanup and assets** | Tail work |

The old ordering (landing first with current footage, re-shot later) is superseded.

## Setup checklist (what to provide to Claude)

**Install on this machine**

- [ ] **ffmpeg**: `winget install Gyan.FFmpeg`. Needed for V8.3 and V8.7 video encoding;
  not installed today.
- [ ] **GitHub CLI** (optional, convenience): `winget install GitHub.cli`, then `gh auth login`.
  Not installed today; the GitHub MCP covers PRs without it.
- [ ] **Blender 4.x** with the **blender-mcp add-on**, and its server started whenever a V8.5
  or V9 session runs. The MCP is configured, but its tools only work while Blender is open
  with the add-on listening.
- [ ] Optional: a GPU with ≥ 17 GB VRAM (or run the text encoder on CPU) if you want NVIDIA
  Kimodo for bespoke animations in V9.2.

**Fix or authorise MCP servers**

- [ ] **Supabase MCP** failed to connect in the 2026-09-11 session (`CONNECTION_CLOSED`).
  V8.3's KG snapshot can use a local script with the service-role key from `.env.local`
  instead, but fixing the MCP makes it easier. Run `/mcp` in an interactive terminal session.
- [ ] **Vercel MCP** needs authorising (optional; useful for checking preview deployments).
- Working already: GitHub MCP, puppeteer, context7, the in-app Browser, Claude in Chrome.

**Skills**

Already installed and used by these briefs: `design-taste-frontend`, `frontend-design`,
`design` (canvas), `design-system`, `dataviz`, `security-review`, `vercel:shadcn`,
`vercel:react-best-practices`, `vercel:nextjs`, `fal-ai-media` (only with approval).

Copy from your reference library on demand, as your global CLAUDE.md prescribes (from
`C:\Users\Pc\Desktop\Empire\CLAUDE SETUP\everything-claude-code\skills\` into
`~/.claude/skills/`):

- [ ] `brand-voice`: V8.1 messaging and copy
- [ ] `seo`: V8.1 metadata and OG, V8.7
- [ ] `video-editing`: V8.3 capture and encode pipeline
- [ ] Optional: `remotion-video-creation`, if you later want a captioned social cut of the
  hero footage. Not needed for the landing loop.

No three.js or Blender skill was found in your claude.ai skills or the reference library.
context7 (three, drei, R3F docs) plus the Blender MCP cover it.

**Money: none. The programme is $0 (Hmz, 2026-09-12)**

- Animation quality comes from engineering (the director, blending, mirroring, time-warping,
  procedural life, IK pointing) plus free sources: Mixamo, ActorCore's ~32 free motions,
  Quaternius CC0, Mesh2Motion, AccuRIG. See "Getting ActorCore quality without buying it" in
  the V9 brief.
- ActorCore bundles (~$50-150) remain the later upgrade. The manifest makes that a data
  change, not a rewrite, so nothing is blocked by deferring it.
- Avoid: Meshy/Tripo credits (spend; and Meshy's free output is CC BY 4.0, attribution
  required), Cascadeur Free (no commercial use, no FBX export), Kimodo (needs CUDA; this
  machine has Intel Iris Xe), and research-only mocap datasets (BEAT, ZeroEGGS, Trinity, AMASS).

**Accounts and decisions only you can make**

- [ ] Adobe login for Mixamo: you download the clips from the list V9.2 prepares. Claude
  never creates accounts or enters passwords.
- [ ] A test account for walking sign-up → pending → onboarding → learn in V8.6, or review
  screenshots instead.
- [ ] The decision points: V8.0 picks, V8.1 line and mark, V9.0 look, V9.1 candidate, any spend.

## Biggest risks, and the mitigation already in the briefs

| Risk | Where | Mitigation |
|---|---|---|
| No free avatar meets the look bar | V9.1 | Bake-off with real renders before any integration; paid fallback is an explicit Hmz decision |
| Retargeted clips look off (sliding, hands through the body) | V9.2 | Constraint retarget already proven here; dev lab page; per-clip QA list |
| The mark is weak if hand-drawn as SVG | V8.1 | Keep it typographic or simple geometric; anything more complex goes through canvas exploration and, if approved, image-model references |
| Hero video hurts LCP | V8.3 | Poster image is the LCP element; video loads after paint; hard size cap |
| A new room breaks the probed anchors | V8.5 | Anchor contract written first; `/dev` probes before and after |
| Redesign quietly changes behaviour | V8.4 | Diffs limited to markup and classes; full demo walk-through as the gate |

## Switching models

A session **cannot** change its own model, and the briefs' "then switch" lines are instructions
for Hmz. The full list of switch points, with the exact triggers, is
`.claude/plans/MODEL-SWITCHING.md`. Short version: set the model at session start, and expect
only three mid-session switches in the whole programme (V9.2's pipeline-to-grind handover,
V8.1's copy-to-apply handover, and any stalled session moving up a tier).

## Kickoff prompts (model first, then the task)

Set the model **before** the first message; that way the expensive turns are not spent on
orientation. Each brief states its own model per phase, and the wave table above says which
phase comes next.

**A taste session (V8.0 + V9.0, the one to run first):**

```text
/model opus
Read CLAUDE.md, .claude/docs/state.md, .claude/plans/V8-brand-and-experience-redesign.md
and .claude/plans/V9-teacher-avatar-and-animation-library.md. Run V8.0 and V9.0 together as
one direction session: brand direction, teacher look, and confirm the $0 animation strategy.
Load the design-taste-frontend and design skills. Produce a design canvas. No code.
```

**A build session (most phases):**

```text
/model opusplan
Read CLAUDE.md, .claude/docs/state.md and .claude/plans/<brief>.md. Execute <phase> only,
following its guardrails and the model note in its header. Load the skills listed for it in
.claude/plans/V8-V9-estimates-models-tooling.md. Branch off deploy-prep, PR into deploy-prep,
tick the checklist when done.
```

**The one Fable phase (V9.2):**

```text
/model claude-fable-5-1
Read CLAUDE.md and .claude/plans/V9-teacher-avatar-and-animation-library.md. Execute V9.2.
Check the Blender MCP is reachable first. Design and debug the retarget pipeline on 2-3 clips
until the output is clean, write the pipeline down in the script, then tell me to switch to
/model sonnet before converting the remaining clips.
```

**A mechanical pass:**

```text
/model haiku
Read .claude/plans/<brief>.md, section <phase>. Do exactly the mechanical steps listed there
and nothing else. Stop and ask if anything requires judgement.
```
