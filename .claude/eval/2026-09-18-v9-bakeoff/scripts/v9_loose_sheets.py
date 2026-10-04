"""
Peak renders for the loosened shirts (V8.3d), headless; sheets are composed afterwards (sheets.cjs in the V8.3d
evidence folder adds the labels).

- peaks/<clip>_<view>.png: every clip at its QA peak frame (v9_loose_qa: the hands furthest from Idle), from
  the front and from the teacher's left and right.
- joints/<clip>_<joint>_<side>.png: the elbow, shoulder and armpit of each side, the left one seen from his left
  and the right one from his right at the same angle, so the pair can be laid side by side (the V9.1e lesson:
  compare a joint with its mirror, not only with the source).
- hem/<clip>_<frame>.png: the hem through a clip that moves it.
- before/<view>.png and after/<view>.png at the Idle peak: the V8.3c shirt against the new one, same light.

  blender -b <scene.blend> --python-expr "import sys; sys.path.insert(0, r'<scripts>'); \
      import v9_loose_sheets as S; S.run('Jake', r'<qa.json>', r'<out dir>')"
"""

import json
import math
import os
import re

import bpy
from mathutils import Vector

import v9_loose as VL
import v9_loose_qa as Q
import v9_render as vr

VIEWS = {"front": 0.0, "left": 90.0, "right": -90.0}  # facing angles round z (the teacher faces -y)
JOINTS = {"elbow": "Forearm", "shoulder": "Upperarm"}
HEM_CLIPS = ("Talking4", "ShakeNo", "WellDone")


def _bone(arm, side, part):
    rx = re.compile(rf"^CC_Base_{side}_{part}(_\d+)?$")
    pb = next(p for p in arm.pose.bones if rx.match(p.name))
    return arm.matrix_world @ pb.head


def _cam_at(aim, direction, dist, lens=50.0):
    ob = vr.cam("V83dCam", lens)
    ob.location = aim + direction.normalized() * dist
    ob.rotation_euler = (aim - ob.location).to_track_quat("-Z", "Y").to_euler()
    return ob


def run(teacher, qa_json, out_dir, res=(360, 440), joint_res=(360, 360)):
    cfg = Q.TEACH[teacher]
    arm = bpy.data.objects[cfg["arm"]]
    sc = bpy.context.scene
    acts = Q._clip_actions(arm)
    for t in arm.animation_data.nla_tracks:
        t.mute = True
    qa = json.load(open(qa_json))["clips"]
    vr.solo(cfg["root"], keep=())
    hip = arm.matrix_world @ next(b for b in arm.data.bones if b.name.startswith("CC_Base_Hip")).head_local
    for d in ("peaks", "joints", "hem", "before", "after"):
        os.makedirs(os.path.join(out_dir, d), exist_ok=True)
    manifest = {"teacher": teacher, "peaks": {}, "joints": [], "hem": {}}

    def shoot(path, r):
        vr.shoot(path, r)
        return path

    for clip, rec in qa.items():
        Q._play(arm, acts[clip])
        f = rec["peak_frame"]
        sc.frame_set(f)
        manifest["peaks"][clip] = f
        for view, deg in VIEWS.items():
            vr.frame((hip.x, hip.y, 1.22), 1.05, facing=math.radians(deg))
            shoot(os.path.join(out_dir, "peaks", f"{clip}_{view}.png"), res)
        for joint, part in JOINTS.items():
            for side, sx in (("L", 1.0), ("R", -1.0)):
                aim = _bone(arm, side, part)
                _cam_at(aim, Vector((sx, -0.55, 0.12)), 0.55)
                shoot(os.path.join(out_dir, "joints", f"{clip}_{joint}_{side}.png"), joint_res)
        for side, sx in (("L", 1.0), ("R", -1.0)):  # the armpit, from the front, a little to that side
            aim = (_bone(arm, side, "Upperarm") + Vector((0, 0, -0.08)))
            _cam_at(aim, Vector((0.35 * sx, -1.0, 0.05)), 0.5)
            shoot(os.path.join(out_dir, "joints", f"{clip}_armpit_{side}.png"), joint_res)
        manifest["joints"].append(clip)
        print(teacher, clip, f, flush=True)

    for clip in HEM_CLIPS:
        Q._play(arm, acts[clip])
        s, e = (int(round(v)) for v in acts[clip].frame_range)
        frames = [int(round(s + (e - s) * k / 5)) for k in range(6)]
        manifest["hem"][clip] = frames
        for f in frames:
            sc.frame_set(f)
            vr.frame((hip.x, hip.y, 1.05), 0.55, facing=math.radians(35.0))
            shoot(os.path.join(out_dir, "hem", f"{clip}_{f}.png"), (360, 300))

    # Before / after at the Idle peak.
    shirt = bpy.data.objects[cfg["shirt"]]
    Q._play(arm, acts["Idle"])
    sc.frame_set(qa["Idle"]["peak_frame"])
    new = shirt.data
    for tag, data in (("after", new), ("before", bpy.data.meshes[shirt["v83d_src"]])):
        shirt.data = data
        for view, deg in (("front", 0.0), ("three-quarter", 35.0), ("side", 90.0)):
            vr.frame((hip.x, hip.y, 1.22), 1.05, facing=math.radians(deg))
            shoot(os.path.join(out_dir, tag, f"{view}.png"), (420, 520))
    shirt.data = new
    for t in arm.animation_data.nla_tracks:
        t.mute = False
    json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w"), indent=1)
    return manifest
