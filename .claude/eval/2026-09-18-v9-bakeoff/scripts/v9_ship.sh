#!/usr/bin/env sh
# Post-process the raw Blender exports (v9_export.export) and install them.
# Run from the repo root after exporting both teachers to export/.
set -e
E=.claude/eval/2026-09-18-v9-bakeoff
P=$E/scripts/v9_postprocess.mjs
LIC="CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)"

node $P $E/export/Teacher_Jake.glb $E/export/Teacher_Jake_opt.glb \
  --copyright "\"Free Cartoon Game Man Character (Rigged)\" by Canino3d (https://sketchfab.com/3d-models/free-cartoon-game-man-character-rigged-a69c8962f4a14ea89bf623d716a81411), $LIC. Modified for Aristo: retargeted animation, baked visemes, materials."

# Jake's raw export is the eyelash donor: same Character Creator base UVs.
node $P $E/export/Teacher_MJ.glb $E/export/Teacher_MJ_opt.glb \
  --eyelash-from $E/export/Teacher_Jake.glb \
  --drop-material Std_Eye_Occlusion --drop-material lambert13 \
  --copyright "\"Free Stylized Cartoon Girl Rigged Character\" by Canino3d (https://sketchfab.com/3d-models/free-stylized-cartoon-girl-rigged-character-dcaa822909ae4e04ad7eb85bc371a8c4), $LIC. Modified for Aristo: retargeted animation, baked visemes, extended clothing, materials."

cp $E/export/Teacher_Jake_opt.glb public/models/Teacher_Jake.glb
cp $E/export/Teacher_MJ_opt.glb public/models/Teacher_MJ.glb
ls -la public/models/Teacher_Jake.glb public/models/Teacher_MJ.glb
