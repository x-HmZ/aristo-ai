# T01 — Repo + Docs Consolidation

**Model:** sonnet | **Priority:** 1 | **Depends on:** nothing
**IMPORTANT:** pushing and merging require explicit user approval — confirm each push with the user before running it.

## Context

Branch state is sprawled and docs have drifted from reality:

- Vercel production deploys from `deploy-prep` (head `0731b75`). `master` still points at an
  ancient merge commit (`c6f9efe`) from the old prototype era.
- Current working branch `dev/desk-quiz-3d-fixes` has 2 finished, verified commits
  (`299bfe5`, `e238db7` — desk quiz fix + camera/paper fixes) that are **local only**.
- Uncommitted at repo root: `CLAUDE.md` (modified), `.claude/docs/` (new), `TECHNICAL_SUMMARY.md` (new),
  `.claude/settings.local.json` (modified — check whether it should be committed at all; it is usually personal),
  and this `.claude/plans/` directory.
- Docs drift: `.claude/docs/decisions.md` row "3D gen" says "fal.ai FLUX -> Tripo3D" but the code
  uses **TripoSR** (`fal-ai/triposr` in `src/lib/imagegen/banana.ts`). `HANDOFF_DESK_QUIZ.md` at repo
  root is stale — the desk quiz was fixed 2026-06-10. `ADAPTIVE_VISUAL_AID_PLAN.md` and
  `design-prompt.md` are completed one-off plans.

## What to do

1. Commit the doc/meta files on the current branch in small atomic commits
   (CLAUDE.md update, `.claude/docs/`, `TECHNICAL_SUMMARY.md`, `.claude/plans/`).
   Ask the user whether `.claude/settings.local.json` should stay untracked (it usually should;
   if so leave it modified/untracked, do not commit).
2. Fix docs drift:
   - `decisions.md`: change "Tripo3D" to "TripoSR (`fal-ai/triposr`, $0.07/gen)"; add a row for
     ElevenLabs TTS decision and one for the desk-quiz Html-transform approach.
   - Delete `HANDOFF_DESK_QUIZ.md` (stale — solved). Move `ADAPTIVE_VISUAL_AID_PLAN.md` and
     `design-prompt.md` into a new `docs/archive/` folder (or delete if user prefers — ask once).
   - Update `.claude/docs/state.md`: reflect desk-quiz done, deployment live on `deploy-prep`,
     and point to `.claude/plans/README.md` as the active roadmap.
3. With user approval, consolidate branches:
   - Push `dev/desk-quiz-3d-fixes` to origin.
   - Merge it into `deploy-prep` (this deploys it — confirm user is ready).
   - Propose (do not execute without approval) the master promotion: fast-forward/reset `master`
     to `deploy-prep` head, push, then user switches Vercel production branch to `master` in the
     dashboard, after which `deploy-prep` retires.
4. Delete or archive dead local branches only if the user approves (`build-v2`, `build-v3`,
   `adaptive-visuals` are historical checkpoints).

## Acceptance criteria

- `git status` clean on the working branch (except intentionally untracked files).
- decisions.md matches the code (TripoSR), no stale handoff files at root.
- `state.md` current and points at the roadmap.
- Branch plan executed exactly as far as the user approved, no further.

## Do NOT

- Do not force-push anywhere.
- Do not change any application code in this task.

## Status checklist

- [ ] Doc commits made
- [ ] Docs drift fixed
- [ ] Branches pushed/merged (per approval)
- [ ] state.md updated
