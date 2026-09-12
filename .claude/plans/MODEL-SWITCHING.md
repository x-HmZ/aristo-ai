# Model switching: who does it, and when

**A session cannot change its own model.** Whatever you pick when the session starts is what
runs until you change it. So every "then switch to Sonnet" in the V8 and V9 briefs is an
instruction for **you**, and the brief tells the session to stop and say so when it reaches
that point. If a session never says anything, no switch is needed.

Two things *are* automatic, and they do most of the work:

- **`opusplan`** runs Opus in plan mode and Sonnet for the edits, inside one session. Most
  build phases use this, so you set it once at the start and never touch it again.
- **Subagents** can run on a different model from the session that spawns them. An Opus
  session can hand a mechanical sweep to Sonnet or Haiku, and a Sonnet session can hand a
  hard analysis to Opus, without you doing anything.

## How to switch

- **Desktop app (what you use):** the model picker in the session UI.
- **Terminal:** `/model opus`, `/model sonnet`, `/model haiku`, `/model opusplan`. For Fable,
  pick `claude-fable-5-1` if no short alias is offered.

Switching mid-session keeps the conversation; it costs one cache rewrite, roughly $1 on a
100k-token context. That is far cheaper than finishing an hour of mechanical edits on an
expensive model.

## The switch list (the whole thing)

| # | Moment | What you will see | Do |
|---|---|---|---|
| 1 | Starting a taste session (V8.0 + V9.0) | You are opening a direction/canvas task | **Opus** before the first message |
| 2 | Starting most build phases (V8.2, V8.3, V8.4a, V9.3) | The brief header says `opusplan` | **opusplan**, then leave it alone |
| 3 | Starting a settled-design phase (V8.4b/c, V8.6, V8.7, V9.4, V9.5) | The design is decided, the work is edits | **Sonnet** |
| 4 | Starting V9.2 (the retarget pipeline) | The one Fable phase | **Fable 5.1** |
| 5 | **Inside V9.2**, once the pipeline is clean on 2 or 3 clips | The session says the pipeline is proven and asks you to switch | **Sonnet**, then let it convert the rest |
| 6 | Inside V8.1, once the words are approved | The session moves from writing copy to applying it | **Sonnet** |
| 7 | A mechanical sweep (admin token pass, dead-code removal) | Pure find-and-replace | **Haiku** |
| 8 | **Any session that has stalled twice on the same problem** | It says so, or you notice it going in circles | Go up one tier: Sonnet to Opus, Opus to Fable. Ask it to restate the problem before retrying |
| 9 | End of a Fable session | Work is done | Switch back, so the next session does not start expensive by accident |

Rows 1 to 4 and 7 are set-and-forget at session start. **Rows 5, 6 and 8 are the only
mid-session switches in the entire programme**, and in each case the session announces it.

## Price reference

| Model | Input / output per million tokens | Use it for |
|---|---|---|
| Haiku 4.5 | $1 / $5 | Mechanical sweeps |
| Sonnet 5 | $2 / $10 | Execution against a settled design |
| Opus 5 | $5 / $25 | Decisions, taste, architecture |
| Fable 5.1 | $10 / $50 | V9.2 only, plus escalations. Always thinks, so output costs more too |

Rule of thumb: a heavy session is about $18 on Opus and about $32 on Fable. Used as planned,
Fable adds roughly $15 to $45 across the whole programme.
