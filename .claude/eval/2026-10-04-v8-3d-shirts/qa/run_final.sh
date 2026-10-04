#!/usr/bin/env sh
# Final QA (new shirts) and peak renders, both teachers in parallel, on the saved working scene.
for T in Jake MJ; do
  t=$(echo $T | tr A-Z a-z)
  rm -rf "C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-10-04-v8-3d-shirts/renders/$t"
  ( "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b "C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene_v83d_wip.blend" --python-expr "import sys; sys.path.insert(0, r'C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-09-18-v9-bakeoff/scripts'); import v9_loose_qa as Q; Q.run('$T', r'C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-10-04-v8-3d-shirts/qa/qa-$T-baseFalse.json')" > "C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-10-04-v8-3d-shirts/qa/log-$T-False.txt" 2>&1 &&     "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b "C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-09-18-v9-bakeoff/bakeoff_scene_v83d_wip.blend" --python-expr "import sys; sys.path.insert(0, r'C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-09-18-v9-bakeoff/scripts'); import bpy, v9_loose_sheets as S
for mn,c in (('lambert3SG',(0.42,0.58,0.40,1)),('lambert7.003',(0.55,0.45,0.75,1))):
    b=next(n for n in bpy.data.materials[mn].node_tree.nodes if n.type=='BSDF_PRINCIPLED'); b.inputs['Base Color'].default_value=c
S.run('$T', r'C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-10-04-v8-3d-shirts/qa/qa-$T-baseFalse.json', r'C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-10-04-v8-3d-shirts/renders/$t')" > "C:/Users/Pc/Desktop/Empire/Artisto/Aristo 2.0/Aristo-AI/.claude/eval/2026-10-04-v8-3d-shirts/qa/log-$T-sheets.txt" 2>&1 ) &
done
wait
