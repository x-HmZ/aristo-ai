#!/usr/bin/env sh
# Full QA, both teachers, new shirts and the V8.3c baseline, every 2nd frame of every clip.
for T in Jake MJ; do
  for BASE in False True; do
    "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b "C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene_v83d_wip.blend" --python-expr "import sys; sys.path.insert(0, r'C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-09-18-v9-bakeoff/scripts'); import v9_loose_qa as Q; Q.run('$T', r'C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-10-04-v8-3d-shirts/qa/qa-$T-base$BASE.json', baseline=$BASE)" > "C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-10-04-v8-3d-shirts/qa/log-$T-$BASE.txt" 2>&1 &
  done
done
wait
