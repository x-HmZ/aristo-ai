#!/usr/bin/env sh
# Final QA (new shirts) and peak renders, both teachers in parallel, on the saved working scene.
# Repo root (Windows form under Git Bash, so Blender can read it); Blender from $BLENDER or the PATH.
ROOT="$(cd "$(dirname "$0")/../../../.." && (pwd -W 2>/dev/null || pwd))"
BLENDER="${BLENDER:-blender}"
for T in Jake MJ; do
  t=$(echo $T | tr A-Z a-z)
  rm -rf "$ROOT/.claude/eval/2026-10-04-v8-3d-shirts/renders/$t"
  ( "$BLENDER" -b "$ROOT/.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene_v83d_wip.blend" --python-expr "import sys; sys.path.insert(0, r'$ROOT/.claude/eval/2026-09-18-v9-bakeoff/scripts'); import v9_loose_qa as Q; Q.run('$T', r'$ROOT/.claude/eval/2026-10-04-v8-3d-shirts/qa/qa-$T-baseFalse.json')" > "$ROOT/.claude/eval/2026-10-04-v8-3d-shirts/qa/log-$T-False.txt" 2>&1 &&     "$BLENDER" -b "$ROOT/.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene_v83d_wip.blend" --python-expr "import sys; sys.path.insert(0, r'$ROOT/.claude/eval/2026-09-18-v9-bakeoff/scripts'); import bpy, v9_loose_sheets as S
for mn,c in (('lambert3SG',(0.42,0.58,0.40,1)),('lambert7.003',(0.55,0.45,0.75,1))):
    b=next(n for n in bpy.data.materials[mn].node_tree.nodes if n.type=='BSDF_PRINCIPLED'); b.inputs['Base Color'].default_value=c
S.run('$T', r'$ROOT/.claude/eval/2026-10-04-v8-3d-shirts/qa/qa-$T-baseFalse.json', r'$ROOT/.claude/eval/2026-10-04-v8-3d-shirts/renders/$t')" > "$ROOT/.claude/eval/2026-10-04-v8-3d-shirts/qa/log-$T-sheets.txt" 2>&1 ) &
done
wait
