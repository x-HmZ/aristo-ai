"""
Build one sleeve option on the working scene and export Jake's base clips for a look in the engine. The scene is not
saved. blender -b bakeoff_scene.blend --python build_option.py -- <option> <raw.glb> [save.blend]
"""

import json
import sys

import bpy

sys.path.insert(0, r"C:\Users\Pc\Desktop\Empire\Artisto\Aristo 2.0\Aristo-AI\.claude\eval\2026-09-18-v9-bakeoff\scripts")
import v9_export as EX  # noqa: E402
import v9_sleeve as SL  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
option, raw = args[0], args[1]
# The saved scene can carry a solo render state (hide_render on every Jake mesh but the shirt); the GLB ships all 8.
for o in bpy.data.objects["ROOT_canino_man"].children_recursive:
    if o.type == "MESH":
        o.hide_render = False
if option != "shipped":
    print(json.dumps(SL.tailor(option)))
info = EX.export("ROOT_canino_man", raw, {"Idle": "Jake_Idle", "Talking": "Jake_Talking", "Thinking": "Jake_Thinking2"})
print(json.dumps({k: v for k, v in info.items()}))
if len(args) > 2:
    bpy.ops.wm.save_as_mainfile(filepath=args[2], copy=True)
