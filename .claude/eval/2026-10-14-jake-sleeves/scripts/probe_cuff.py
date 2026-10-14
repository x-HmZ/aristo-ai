"""The cuff's structure on Jake's shirt: boundary loops near the wrists, sharp edges, and the cuff region reached
from the open edge without crossing a sharp edge. blender -b bakeoff_scene.blend --python probe_cuff.py"""

import sys

import bmesh
import bpy

sys.path.insert(0, r"C:\Users\Pc\Desktop\Empire\Artisto\Aristo 2.0\Aristo-AI\.claude\eval\2026-09-18-v9-bakeoff\scripts")
import v9_loose as VL  # noqa: E402

ob = bpy.data.objects[VL.JAKE["shirt"]]
arm = bpy.data.objects[VL.JAKE["arm"]]
mw = ob.matrix_world
with VL._rest(arm):
    lines = {s: VL.arm_line(arm, s) for s in "LR"}
    L, R = VL.arm_weights(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    T = {}
    for v in bm.verts:
        s = "L" if L[v.index] >= R[v.index] else "R"
        if max(L[v.index], R[v.index]) > 0.3:
            T[v.index] = (s,) + VL._on_line(lines[s], mw @ v.co)
    sharp = [e for e in bm.edges if not e.smooth]
    print("sharp edges", len(sharp), "seams", sum(e.seam for e in bm.edges))
    for s in "LR":
        bnd = [e for e in bm.edges if e.is_boundary and all(v.index in T and T[v.index][0] == s and T[v.index][1] > 0.8 for v in e.verts)]
        bv = {v for e in bnd for v in e.verts}
        sh = [e for e in sharp if all(v.index in T and T[v.index][0] == s and T[v.index][1] > 0.75 for v in e.verts)]
        shv = {v for e in sh for v in e.verts}
        print(s, "boundary edges", len(bnd), "verts", len(bv), "t", sorted(round(T[v.index][1], 3) for v in bv)[:: max(1, len(bv) // 8)])
        print(s, "sharp edges near wrist", len(sh), "t", sorted(round(T[v.index][1], 3) for v in shv)[:: max(1, len(shv) // 10)])
        # Flood from the boundary without crossing sharp edges.
        seen, front = set(bv), list(bv)
        while front:
            v = front.pop()
            for e in v.link_edges:
                if not e.smooth:
                    continue
                o = e.other_vert(v)
                if o not in seen and o.index in T:
                    seen.add(o)
                    front.append(o)
        ts = sorted(T[v.index][1] for v in seen)
        print(s, "flood verts", len(seen), "t range", round(ts[0], 3), round(ts[-1], 3))
        # Rings: distinct t of the flood region (rounded).
        print(s, "flood t histogram", {round(t, 2): sum(1 for x in ts if round(x, 2) == round(t, 2)) for t in ts})
