"""Jake's sleeve weights along the forearm (rest): the mean weight per bone group in bins of t, per side.
blender -b bakeoff_scene.blend --python probe_weights.py"""

import sys
from collections import defaultdict

import bpy

sys.path.insert(0, r"C:\Users\Pc\Desktop\Empire\Artisto\Aristo 2.0\Aristo-AI\.claude\eval\2026-09-18-v9-bakeoff\scripts")
import v9_loose as VL  # noqa: E402

ob = bpy.data.objects[VL.JAKE["shirt"]]
arm = bpy.data.objects[VL.JAKE["arm"]]
names = {g.index: g.name for g in ob.vertex_groups}
with VL._rest(arm):
    lines = {s: VL.arm_line(arm, s) for s in "LR"}
    L, R = VL.arm_weights(ob)
    for s, A in (("L", L), ("R", R)):
        acc = defaultdict(lambda: defaultdict(float))
        cnt = defaultdict(int)
        for v in ob.data.vertices:
            if A[v.index] < 0.5:
                continue
            t, _q = VL._on_line(lines[s], ob.matrix_world @ v.co)
            if t < 0.5:
                continue
            k = round(t * 25) / 25
            cnt[k] += 1
            for g in v.groups:
                acc[k][names[g.group].replace("CC_Base_", "")] += g.weight
        print("SIDE", s)
        for k in sorted(cnt):
            top = sorted(((w / cnt[k], n) for n, w in acc[k].items()), reverse=True)[:5]
            print(" ", k, cnt[k], ", ".join(f"{n} {w:.2f}" for w, n in top))
