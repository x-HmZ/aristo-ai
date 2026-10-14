# V10 live test: six topics, real lessons and widgets (2026-10-14)

Approved by Hmz: Anthropic only, well under 1 USD, `NEXT_PUBLIC_INTERACTIVE_VISUALS=true` for the run only.
`scripts/live.run.ts` loaded only `ANTHROPIC_API_KEY` from `.env.local` (no fal, no ElevenLabs), captured usage in-process
(nothing written to `usage_events`) and had a hard stop at 0.90 USD. **Spent: 0.406 USD over 11 calls** (6 lessons, 5 widgets,
no retries). Each topic folder holds `lesson.json`, `spec.json`, `widget.json` and the screenshots from `scripts/shots.cjs`
(light and dark at 560 px, light at 360 px, and `-played` after moving every control): 115 / 115 checks (ready, text AA, 44 px
targets, no horizontal scroll, no page errors, nothing left the frame).

## The decider against the rule in teaching.ts

| Topic | Expected | Chose | Explore segment | Widget |
|---|---|---|---|---|
| Equivalent fractions | interactive | interactive | 10 of 15, demonstrate | pizza cut by a scale factor, label toggle |
| Area and perimeter | interactive | interactive | 10 of 14, demonstrate | length slider, width follows to keep P = 20, best area so far |
| Experimental probability | interactive | interactive | 9 of 13, demonstrate | running % heads against a dashed 50% line, flip 1 / 50, reset |
| Python for + range() | interactive | interactive | 8 of 14, demonstrate | start/stop/step sliders, dots on a number line, stop as a boundary |
| Python if/elif/else | interactive | interactive | 8 of 12, demonstrate | score slider lights the branch that runs |
| Parts of a plant cell | 3D or image | 3D model (`should_generate_model`, six annotations) | none | none |

All six follow the rule: an input-and-result topic gets a widget, a physical object gets the 3D model, never both; the explore
segment is always in demonstrate, after the setup, never last, with no visual, naming the first control by its label.

## What the run found

- **Bug, fixed:** the probability widget declared `var history = []` at the top level. In a classic script that is
  `window.history`, so the array never existed and every click threw after `ready` (the frame ignores late errors): the buttons
  did nothing. `buildWidgetDoc` now runs widget code in its own function scope (unit test added). The same trap waits for any
  widget naming a variable `name`, `status`, `length`, `top`...
- **Teaching flaw:** the if/elif widget marks a later true `elif` with a green "true" and says "condition tested true but came
  after a branch already ran". Python never tests it; the picture teaches the misconception the lesson warns about.
- **Polish:** the probability buttons repeat their labels above them; the fraction title reads "1/2 of the pizza (same as 1/2)"
  at n = 1.

Rerun the screenshots (0 calls, dev server up): `node .claude/eval/2026-10-14-v10-live/scripts/shots.cjs`.
