"""
Jake's sleeve against his arm, in the rest pose (the shirt session, 2026-10-14). Per side and per step along the arm
line (0 shoulder, 0.58 elbow, 1 wrist): the sleeve's mean and max radius from the bone line, the arm skin's under it,
and the gap between them. Real shirts: a few mm over the forearm and a cuff that closes on the wrist; a sweater: a
wide tube that bunches into a gathered band.

blender -b bakeoff_scene.blend --python measure.py -- <out.json>
"""

import json
import math
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, r"C:\Users\Pc\Desktop\Empire\Artisto\Aristo 2.0\Aristo-AI\.claude\eval\2026-09-18-v9-bakeoff\scripts")
import v9_loose as VL  # noqa: E402

cfg = VL.JAKE
shirt = bpy.data.objects[cfg["shirt"]]
arm = bpy.data.objects[cfg["arm"]]
body = bpy.data.objects["CC_Base_Body.002"]
import os
if os.environ.get("SHIRT_MESH"):
    shirt.data = bpy.data.meshes[shirt["v83d_src"] if os.environ["SHIRT_MESH"] == "src" else os.environ["SHIRT_MESH"]]
out = {"shirt": shirt.name, "body": body.name, "shirt_verts": len(shirt.data.vertices), "sides": {}}

for o in (shirt, bpy.data.objects["CC_Base_Body.002"]):
    o.hide_viewport = False
bpy.context.view_layer.update()
with VL._rest(arm):
    for s in ("L", "R"):
        line = VL.arm_line(arm, s)
        rows = []
        for name, ob in (("sleeve", shirt), ("skin", body)):
            dg = bpy.context.evaluated_depsgraph_get()
            ev = ob.evaluated_get(dg)
            em = ev.to_mesh()
            mw = ev.matrix_world
            Lw, Rw = VL.arm_weights(ob)
            aw = Lw if s == "L" else Rw
            for i, v in enumerate(em.vertices):
                if aw[i] < 0.5:
                    continue
                P = mw @ v.co
                t, q = VL._on_line(line, P)
                if 0.4 <= t <= 1.08:
                    rows.append((name, t, (P - q).length))
        bins = {}
        for name, t, r in rows:
            k = round(t * 50) / 50
            bins.setdefault(k, {}).setdefault(name, []).append(r)
        table = []
        for k in sorted(bins):
            b = bins[k]
            e = {"t": k}
            for name in ("sleeve", "skin"):
                if name in b:
                    a = np.array(b[name]) * 1000
                    e[name] = [round(float(np.median(a)), 1), round(float(np.percentile(a, 90)), 1), len(a)]
            if "sleeve" in e and "skin" in e:
                e["gap_mm"] = round(e["sleeve"][0] - e["skin"][0], 1)
            table.append(e)
        out["sides"][s] = table

json.dump(out, open(sys.argv[sys.argv.index("--") + 1], "w"), indent=1)
for s, tab in out["sides"].items():
    print(s)
    for e in tab:
        print(" ", e)
