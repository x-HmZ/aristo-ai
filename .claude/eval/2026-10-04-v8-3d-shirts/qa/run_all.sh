#!/usr/bin/env sh
# Full QA, both teachers, new shirts and the V8.3c baseline, every 2nd frame of every clip.
# Repo root (Windows form under Git Bash, so Blender can read it); Blender from $BLENDER or the PATH.
ROOT="$(cd "$(dirname "$0")/../../../.." && (pwd -W 2>/dev/null || pwd))"
BLENDER="${BLENDER:-blender}"
for T in Jake MJ; do
  for BASE in False True; do
    "$BLENDER" -b "$ROOT/.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene_v83d_wip.blend" --python-expr "import sys; sys.path.insert(0, r'$ROOT/.claude/eval/2026-09-18-v9-bakeoff/scripts'); import v9_loose_qa as Q; Q.run('$T', r'$ROOT/.claude/eval/2026-10-04-v8-3d-shirts/qa/qa-$T-base$BASE.json', baseline=$BASE)" > "$ROOT/.claude/eval/2026-10-04-v8-3d-shirts/qa/log-$T-$BASE.txt" 2>&1 &
  done
done
wait
