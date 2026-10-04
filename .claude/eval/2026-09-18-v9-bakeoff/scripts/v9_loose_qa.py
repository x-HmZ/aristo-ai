"""
QA for the loosened shirts (V8.3d), every `step`-th frame of every shipped clip.

Four checks, each counted per side (the teacher's left is +x) so the two sides
can be put next to each other (MJ's left elbow passed two sessions because no
check compared her left with her right):

- skin:  body skin covered by the shirt at rest that ends up outside it (a ray
         along its normal misses the cloth, a ray against it meets the cloth).
         Skin within `edge` of the shirt's open edges is skipped: it leaves the
         cloth there legitimately (collar, cuffs, hem).
- under: the same for the garment under the hem (trousers, skirt): the hem
         must stay over it.
- arm:   torso cloth inside the arm skin (arms down at the sides against the
         eased torso).
- cloth: sleeve cloth inside the torso cloth, and torso cloth inside a sleeve,
         away from the shoulder seam where the two are one surface.

Also the peak frame of each clip: the frame whose hands are furthest from the
Idle pose's (both hands summed), for the peak sheets.

Headless:
  blender -b <scene.blend> --python-expr "import sys; sys.path.insert(0, r'<scripts>'); \
      import v9_loose_qa as Q; Q.run('Jake', r'<out.json>')"
"""

import json
import math
import re
import time

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

import v9_loose as VL

TEACH = {
    "Jake": dict(arm="Armature.002", shirt=VL.JAKE["shirt"], skins=("CC_Base_Body.002",),
                 under=VL.JAKE["under"], root="ROOT_canino_man"),
    "MJ": dict(arm="Object_4.001", shirt=VL.MJ["shirt"], skins=("Object_10.001", "Object_12.001", "Object_9.001"),
               under=VL.MJ["under"], root="ROOT_canino_girl_GLB"),
}
CLIPS = [
    "Idle", "Idle2", "Idle3", "Idle4", "Thinking", "ThinkingM",
    "Talking", "Talking2", "Talking2M", "Talking3", "Talking3M", "Talking4", "Talking6", "Talking6M",
    "Pointing", "Nodding", "ShakeNo",
    "PresentModel", "Encourage", "Almost", "Exactly", "WellDone", "ThatsIt", "GlanceBoard",
    "Imagine", "HoldIdea", "StepBeat", "MoveOn", "YourTurn", "BringTogether",
    "OneMoment", "PointNear", "PatientTilt", "BackToBoard",
]
DEBUG = []
HAND_RE = re.compile(r"^CC_Base_([LR])_Hand(_\d+)?$")


def _eval(o, dg):
    e = o.evaluated_get(dg)
    me = e.to_mesh()
    mw = o.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    pts = [mw @ v.co for v in me.vertices]
    nrm = [(nm @ v.normal).normalized() for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    e.to_mesh_clear()
    return pts, nrm, faces


def _bvh(pts, faces, keep=None):
    fs = [f for f in faces if keep is None or all(keep[i] for i in f)]
    return BVHTree.FromPolygons(pts, fs) if fs else None


def _play(arm, action):
    ad = arm.animation_data
    ad.action = action
    if hasattr(ad, "action_slot") and action.slots:
        ad.action_slot = action.slots[0]


def _clip_actions(arm):
    return {t.name: t.strips[0].action for t in arm.animation_data.nla_tracks}


def _hands(arm):
    out = {}
    for pb in arm.pose.bones:
        m = HAND_RE.match(pb.name)
        if m:
            out[m.group(1)] = arm.matrix_world @ pb.head
    return out


def run(teacher, out_path, step=2, reach=0.06, edge=0.012, near=0.03, clips=None, baseline=False):
    """baseline=True measures the shirt as V8.3c shipped it (its saved source mesh), for comparison."""
    t0 = time.time()
    if baseline:
        sh = bpy.data.objects[TEACH[teacher]["shirt"]]
        sh.data = bpy.data.meshes[sh["v83d_src"]]
    cfg = TEACH[teacher]
    sc = bpy.context.scene
    arm = bpy.data.objects[cfg["arm"]]
    shirt = bpy.data.objects[cfg["shirt"]]
    skins = [bpy.data.objects[n] for n in cfg["skins"]]
    under = [bpy.data.objects[n] for n in cfg["under"]]
    for o in [arm, shirt] + skins + under:
        o.hide_viewport = False
    acts = _clip_actions(arm)
    # NLA strips would add on top of the action being checked: mute them.
    for t in arm.animation_data.nla_tracks:
        t.mute = True

    # Rest: who is covered, which shirt vertices are torso or sleeve, where the sleeves start.
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    sp, sn, sf = _eval(shirt, dg)
    L, R = VL.arm_weights(shirt)
    torso = (1 - np.clip(L + R, 0, 1)) > 0.9
    sleeve_L = L > 0.9
    sleeve_R = R > 0.9
    lines = {"L": VL.arm_line(arm, "L"), "R": VL.arm_line(arm, "R")}
    t_along = np.zeros(len(sp))
    for i, p in enumerate(sp):
        if sleeve_L[i]:
            t_along[i] = VL._on_line(lines["L"], p)[0]
        elif sleeve_R[i]:
            t_along[i] = VL._on_line(lines["R"], p)[0]
    rest_x = np.array([p.x for p in sp])
    bvh0 = _bvh(sp, sf)
    # Torso cloth near the shoulder seam is one surface with the sleeve: only torso cloth at least 4 cm from any
    # sleeve vertex at rest is tested against the sleeves.
    kd_s = KDTree(int((sleeve_L | sleeve_R).sum()))
    for i in np.nonzero(sleeve_L | sleeve_R)[0]:
        kd_s.insert(sp[i], int(i))
    kd_s.balance()
    torso_far = np.array([torso[i] and kd_s.find(sp[i])[2] > 0.04 for i in range(len(sp))])

    def covered(objs):
        out = []
        for o in objs:
            p, n, _ = _eval(o, dg)
            out.append({i for i, (a, b) in enumerate(zip(p, n)) if bvh0.ray_cast(a + b * 1e-4, b, reach)[0] is not None})
        return out

    cov_skin = covered(skins)
    cov_under = covered(under)
    skin_x = [np.array([p.x for p in _eval(o, dg)[0]]) for o in skins]
    under_x = [np.array([p.x for p in _eval(o, dg)[0]]) for o in under]
    # Arm skin: vertices weighted to the arm bones.
    arm_keep = []
    for o in skins:
        Lk, Rk = VL.arm_weights(o)
        arm_keep.append((Lk > 0.5, Rk > 0.5))
    arm.data.pose_position = "POSE"
    bpy.context.view_layer.update()

    _play(arm, acts["Idle"])
    sc.frame_set(int(acts["Idle"].frame_range[0]))
    idle_hands = _hands(arm)

    report = {"teacher": teacher, "step": step, "clips": {}}
    for clip in clips or CLIPS:
        act = acts[clip]
        _play(arm, act)
        s, e = (int(round(v)) for v in act.frame_range)
        rec = {k: {"L": set(), "R": set(), "worst_mm": 0.0, "worst_frame": None} for k in ("skin", "under", "arm", "cloth")}
        peak = (-1.0, s)

        def note(kind, side, key, depth, f):
            if len(DEBUG) < 60:
                DEBUG.append((kind, side, key, round(depth * 1000, 1), f))
            r = rec[kind]
            r[side].add(key)
            if depth * 1000 > r["worst_mm"]:
                r["worst_mm"] = round(depth * 1000, 1)
                r["worst_frame"] = f

        for f in range(s, e + 1, step):
            sc.frame_set(f)
            h = _hands(arm)
            reach_h = sum((h[k] - idle_hands[k]).length for k in h)
            if reach_h > peak[0]:
                peak = (reach_h, f)
            dg = bpy.context.evaluated_depsgraph_get()
            P, Nn, F = _eval(shirt, dg)
            bvh = _bvh(P, F)
            # open edges of the shirt, for the skin margin
            import bmesh
            em = shirt.evaluated_get(dg).to_mesh()
            bm = bmesh.new()
            bm.from_mesh(em)
            edge_pts = [shirt.matrix_world @ v.co for v in bm.verts if v.is_boundary]
            bm.free()
            shirt.evaluated_get(dg).to_mesh_clear()
            kd = KDTree(len(edge_pts))
            for i, q in enumerate(edge_pts):
                kd.insert(q, i)
            kd.balance()

            def poke(objs, covs, xs, kind):
                for o, cov, xx in zip(objs, covs, xs):
                    p, n, _ = _eval(o, dg)
                    for i in cov:
                        a, b = p[i], n[i]
                        if bvh.ray_cast(a + b * 1e-4, b, reach)[0] is not None:
                            continue
                        hit = bvh.ray_cast(a - b * 1e-4, -b, reach)[0]
                        if hit is None or kd.find(hit)[2] < edge:
                            continue
                        note(kind, "L" if xx[i] > 0 else "R", f"{o.name}:{i}", (a - hit).length, f)

            poke(skins, cov_skin, skin_x, "skin")
            poke(under, cov_under, under_x, "under")

            # Torso cloth inside the arm skin.
            for o, (Lk, Rk) in zip(skins, arm_keep):
                p, n, fs = _eval(o, dg)
                for side, keep in (("L", Lk), ("R", Rk)):
                    ab = _bvh(p, fs, keep)
                    if ab is None:
                        continue
                    for i in np.nonzero(torso)[0]:
                        loc, nor, _, d = ab.find_nearest(P[i], near)
                        if loc is not None and (P[i] - loc).dot(nor) < 0:
                            note("arm", side, int(i), d, f)
            # Sleeve inside torso cloth, torso cloth inside a sleeve (away from the shoulder seam).
            tb = _bvh(P, F, torso)
            for side, sl in (("L", sleeve_L), ("R", sleeve_R)):
                sb = _bvh(P, F, sl)
                for i in np.nonzero(sl & (t_along > 0.2))[0]:
                    loc, nor, _, d = tb.find_nearest(P[i], near)
                    if loc is not None and (P[i] - loc).dot(nor) < 0:
                        note("cloth", side, int(i), d, f)
                if sb is None:
                    continue
                for i in np.nonzero(torso_far & ((rest_x > 0) == (side == "L")))[0]:
                    loc, nor, _, d = sb.find_nearest(P[i], near)
                    if loc is not None and (P[i] - loc).dot(nor) < 0:
                        note("cloth", side, -int(i) - 1, d, f)
        report["clips"][clip] = {
            "frames": [s, e], "peak_frame": peak[1],
            **{k: {"L": len(v["L"]), "R": len(v["R"]), "worst_mm": v["worst_mm"], "worst_frame": v["worst_frame"]}
               for k, v in rec.items()},
        }
        with open(out_path, "w") as fh:
            json.dump(report, fh, indent=1)
        print(teacher, clip, json.dumps(report["clips"][clip]), round(time.time() - t0), flush=True)
    for t in arm.animation_data.nla_tracks:
        t.mute = False
    report["seconds"] = round(time.time() - t0)
    with open(out_path, "w") as fh:
        json.dump(report, fh, indent=1)
    return report


def which(teacher, clip, frame, out_png=None, reach=0.06, edge=0.012):
    """The skin vertices that poke at one frame: where they are (rest and posed), and a close render of the worst."""
    import bmesh
    import v9_render as vr
    cfg = TEACH[teacher]
    sc = bpy.context.scene
    arm = bpy.data.objects[cfg["arm"]]
    shirt = bpy.data.objects[cfg["shirt"]]
    skins = [bpy.data.objects[n] for n in cfg["skins"]]
    for t in arm.animation_data.nla_tracks:
        t.mute = True
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    sp, _, sf = _eval(shirt, dg)
    bvh0 = _bvh(sp, sf)
    rest = {}
    for o in skins:
        p, n, _ = _eval(o, dg)
        rest[o.name] = (p, {i for i, (a, b) in enumerate(zip(p, n)) if bvh0.ray_cast(a + b * 1e-4, b, reach)[0] is not None})
    arm.data.pose_position = "POSE"
    _play(arm, _clip_actions(arm)[clip])
    sc.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    P, _, F = _eval(shirt, dg)
    bvh = _bvh(P, F)
    em = shirt.evaluated_get(dg).to_mesh()
    bm = bmesh.new()
    bm.from_mesh(em)
    edge_pts = [shirt.matrix_world @ v.co for v in bm.verts if v.is_boundary]
    bm.free()
    shirt.evaluated_get(dg).to_mesh_clear()
    kd = KDTree(len(edge_pts))
    for i, q in enumerate(edge_pts):
        kd.insert(q, i)
    kd.balance()
    out = []
    for o in skins:
        p, n, _ = _eval(o, dg)
        rp, cov = rest[o.name]
        for i in cov:
            a, b = p[i], n[i]
            if bvh.ray_cast(a + b * 1e-4, b, reach)[0] is not None:
                continue
            hit = bvh.ray_cast(a - b * 1e-4, -b, reach)[0]
            if hit is None or kd.find(hit)[2] < edge:
                continue
            out.append({"mesh": o.name, "i": i, "depth_mm": round((a - hit).length * 1000, 1),
                        "rest": [round(x, 3) for x in rp[i]], "posed": [round(x, 3) for x in a],
                        "edge_mm": round(kd.find(hit)[2] * 1000, 1)})
    out.sort(key=lambda d: -d["depth_mm"])
    if out_png and out:
        vr.solo(cfg["root"], keep=())
        w = Vector(out[0]["posed"])
        for k, deg in enumerate((0.0, 90.0, -90.0)):
            vr.frame(tuple(w), 0.25, facing=math.radians(deg))
            vr.shoot(out_png.replace(".png", f"_{k}.png"), (360, 360))
    for t in arm.animation_data.nla_tracks:
        t.mute = False
    return out
