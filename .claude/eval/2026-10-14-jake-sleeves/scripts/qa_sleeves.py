"""
Jake's sleeves, every frame of every clip (2026-10-14). Two checks, counted per side (his left is +x):

- pokes: v9_mask.find_pokes, body against shirt, trousers and shoes (skin covered at rest that ends up outside).
- seen:  the camera-ray test MJ's sleeves got in V9.7. From the lesson camera and the same camera swung 0.5 rad either
         way round him, forearm and wrist skin (the hand bone under half its weight) that the camera sees, with
         sleeve cloth within 6 mm behind it along the ray: skin showing through the sleeve. Vertices and triangle
         centres both (a face can cross the cloth between vertices that are under it). Skin within 8 mm of the
         shirt's open edges is skipped (the wrist leaves the cuff there).

blender -b <scene.blend> --python qa_sleeves.py -- <out.json> <clips|all> [step]
"""

import json
import math
import re
import sys
import time

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

sys.path.insert(0, r"C:\Users\Pc\Desktop\Empire\Artisto\Aristo 2.0\Aristo-AI\.claude\eval\2026-09-18-v9-bakeoff\scripts")
import v9_loose as VL  # noqa: E402
import v9_mask as MK  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
out_path, which = args[0], args[1]
step = int(args[2]) if len(args) > 2 else 1

arm = bpy.data.objects["Armature.002"]
shirt = bpy.data.objects[VL.JAKE["shirt"]]
body = bpy.data.objects["CC_Base_Body.002"]
under = [bpy.data.objects["Pants_14249_Shape"], bpy.data.objects["hnsshoes_6176_Shape"]]
for o in [arm, shirt, body] + under:
    o.hide_viewport = False
ad = arm.animation_data
acts = {t.name: t.strips[0].action for t in ad.nla_tracks}
for t in ad.nla_tracks:
    t.mute = True
clips = list(acts) if which == "all" else which.split(",")
if which.startswith("shard:"):  # shard:k/n, for parallel runs
    k, n = map(int, which[6:].split("/"))
    clips = sorted(acts)[k::n]

# The lesson camera (v9_gesture.lesson_camera) in Blender space, and swung +-0.5 rad about his vertical axis.
s, ry = 1.3824, 0.3
d = Vector((1.0, 1.7, 3.9))
c, sn = math.cos(-ry), math.sin(-ry)
loc3 = Vector((c * d.x + sn * d.z, d.y, -sn * d.x + c * d.z)) / s
cam0 = Vector((loc3.x, -loc3.z, loc3.y))
cams = []
for a in (-0.5, 0.0, 0.5):
    ca, sa = math.cos(a), math.sin(a)
    cams.append(Vector((ca * cam0.x - sa * cam0.y, sa * cam0.x + ca * cam0.y, cam0.z)))


def evaluated(o, dg):
    e = o.evaluated_get(dg)
    me = e.to_mesh()
    pts = [o.matrix_world @ v.co for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    e.to_mesh_clear()
    return pts, faces


import os
if os.environ.get("QA_SELFTEST"):  # the detector must fire: forearm sleeves pulled 15 mm into the arm
    with VL._rest(arm):
        Ls, Rs = VL.arm_weights(shirt)
        lines = {k: VL.arm_line(arm, k) for k in "LR"}
        mwi = shirt.matrix_world.inverted()
        for v in shirt.data.vertices:
            for k, a in (("L", Ls[v.index]), ("R", Rs[v.index])):
                P = shirt.matrix_world @ v.co
                t, q = VL._on_line(lines[k], P)
                if a > 0.5 and 0.6 < t < 0.85:
                    v.co = mwi @ (P - (P - q).normalized() * 0.015)

# Rest: which skin is forearm or wrist, which shirt faces are sleeve.
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
names = {g.index: g.name for g in body.vertex_groups}
hand_re = re.compile(r"_[LR]_(Hand|Thumb|Index|Mid|Ring|Pinky)")
fore_re = re.compile(r"_([LR])_(Forearm|ForearmTwist|Elbow)")
side = {}
for v in body.data.vertices:
    fw = {"L": 0.0, "R": 0.0}
    hw = 0.0
    for g in v.groups:
        n = names.get(g.group, "")
        m = fore_re.search(n)
        if m:
            fw[m.group(1)] += g.weight
        if hand_re.search(n):
            hw += g.weight
    k = max(fw, key=fw.get)
    if fw[k] > 0.3 and hw < 0.5:
        side[v.index] = k
skin_faces = [p.index for p in body.data.polygons if all(i in side for i in p.vertices)]
L, R = VL.arm_weights(shirt)
sleeve_faces = [p.index for p in shirt.data.polygons if all(max(L[i], R[i]) > 0.5 for i in p.vertices)]
arm.data.pose_position = "POSE"


DBG = []


def seen_through(dg):
    sp, sf = evaluated(shirt, dg)
    bp, bf = evaluated(body, dg)
    cloth = BVHTree.FromPolygons(sp, [sf[i] for i in sleeve_faces])
    allc = BVHTree.FromPolygons(sp, sf)
    skin = BVHTree.FromPolygons(bp, bf)
    edges = MK._boundary_points(shirt, dg)
    kd = KDTree(len(edges))
    for i, p in enumerate(edges):
        kd.insert(p, i)
    kd.balance()
    pts = [(bp[i], side[i]) for i in side]
    pts += [(sum((bp[j] for j in bf[f]), Vector()) / len(bf[f]), side[bf[f][0]]) for f in skin_faces]
    hits = {"L": 0, "R": 0}
    for p, sd in pts:
        if kd.find(p)[2] < 0.008:
            continue
        for cam in cams:
            v = p - cam
            dist = v.length
            dr = v / dist
            h = allc.ray_cast(cam, dr, dist + 0.001)
            if h[0] is not None and h[3] < dist - 0.0005:
                continue  # cloth in front
            h = skin.ray_cast(cam, dr, dist + 0.001)
            if h[0] is not None and h[3] < dist - 0.001:
                continue  # other skin in front
            hc = cloth.ray_cast(p + dr * 1e-4, dr, 0.006)
            if hc[0] is not None:
                hits[sd] += 1
                if os.environ.get("QA_DEBUG"):
                    DBG.append((sd, round(hc[3] * 1000, 2), round(kd.find(p)[2] * 1000, 1), cams.index(cam), [round(x, 3) for x in p]))
                break
    return hits


t0 = time.time()
res = {}
for name in clips:
    act = acts[name]
    pokes = MK.find_pokes(body, [shirt] + under, arm, [act], step=step)
    side_pokes = {"L": 0, "R": 0, "worst_mm": round(max(pokes.values(), default=0) * 1000, 2)}
    for i in pokes:
        side_pokes["L" if (body.matrix_world @ body.data.vertices[i].co).x > 0 else "R"] += 1
    ad.action = act
    if hasattr(ad, "action_slot") and act.slots:
        ad.action_slot = act.slots[0]
    f0, f1 = (int(round(x)) for x in act.frame_range)
    seen = {"L": 0, "R": 0, "frames": 0}
    for f in range(f0, f1 + 1, step):
        bpy.context.scene.frame_set(f)
        h = seen_through(bpy.context.evaluated_depsgraph_get())
        seen["L"] += h["L"]
        seen["R"] += h["R"]
        seen["frames"] += 1
    res[name] = {"pokes": side_pokes, "seen": seen}
    if DBG:
        print("DBG", name, DBG[:12], "depth_mm max", max(x[1] for x in DBG), "edge_mm min", min(x[2] for x in DBG))
        DBG.clear()
    print("CLIP", name, json.dumps(res[name]), round(time.time() - t0), "s", flush=True)
json.dump({"step": step, "clips": res}, open(out_path, "w"), indent=1)
