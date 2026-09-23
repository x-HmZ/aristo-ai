"""
Per-clip numbers for motion QA (V9.2): the three columns of the V9.1e table,
measured the same way for every new bake.

- `bone_deltas`: the angle between each mapped bone's world rotation delta
  on the teacher and on the source, as `retarget_action` defines it
  (facing map and rest alignment included). 0.000 deg means the motion
  crossed over exactly. MJ's hanging upper arms deviate on purpose after
  `v9_skirt.clear_hands`.
- `sole`: per frame, the lower of the two feet (heel or ball joint) against
  its rest height, which is the floor since `normalise` stands the teacher
  on z = 0. Returns the range over the clip, in mm.
- `seam`: the largest angle between the first and last frame over the mapped
  bones, for clips that loop. Compare it with the source's own seam.

The source rig is un-hidden while measuring (a hidden rig is never
evaluated) and every armature gets its action back afterwards.
"""

import math

import bpy

import v9_retarget as RT


def _play(arm, action):
    ad = arm.animation_data
    ad.action = action
    if hasattr(ad, "action_slot") and action.slots:
        ad.action_slot = action.slots[0]


class _Keep:
    """Restore frame, actions and viewport visibility on exit."""

    def __init__(self, *arms):
        self.arms = arms

    def __enter__(self):
        sc = bpy.context.scene
        self.f0 = sc.frame_current
        self.state = [(a, a.animation_data.action, a.hide_viewport) for a in self.arms]
        for a in self.arms:
            a.hide_viewport = False
        return self

    def __exit__(self, *exc):
        for a, act, hv in self.state:
            a.animation_data.action = act
            a.hide_viewport = hv
        bpy.context.scene.frame_set(self.f0)


def bone_deltas(teacher, clip, src_name="MarcusArma", step=1, per_bone=False):
    """Largest angle (deg) between teacher and source bone deltas over the clip."""
    tgt = bpy.data.objects[RT.TEACHERS[teacher]]
    src = bpy.data.objects[src_name]
    pairs, _ = RT.build_pairs(tgt, src)
    swing = RT.rest_alignment(tgt, src)
    C = RT.facing_map(tgt, src)
    C_inv = C.inverted()
    t_rest = {t: swing.get(t, RT.Matrix.Identity(3)) @ RT._rest3(tgt, t) for t, _ in pairs}
    s_rest = {s: RT._rest3(src, s) for _, s in pairs}
    act_t = bpy.data.actions[f"{teacher}_{clip}"]
    act_s = bpy.data.actions[clip]
    s0, e0 = (int(round(v)) for v in act_t.frame_range)
    worst = {}
    sc = bpy.context.scene
    with _Keep(tgt, src):
        _play(tgt, act_t)
        _play(src, act_s)
        for f in range(s0, e0 + 1, step):
            sc.frame_set(f)
            for t, s in pairs:
                ds = (src.matrix_world @ src.pose.bones[s].matrix).to_3x3() @ s_rest[s].inverted()
                dt = (tgt.matrix_world @ tgt.pose.bones[t].matrix).to_3x3() @ t_rest[t].inverted()
                want = C @ ds @ C_inv
                ang = math.degrees(want.to_quaternion().rotation_difference(dt.to_quaternion()).angle)
                ang = min(ang, 360.0 - ang)
                if ang > worst.get(t, (0.0, None))[0]:
                    worst[t] = (ang, f)
    if per_bone:
        return dict(sorted(worst.items(), key=lambda kv: -kv[1][0]))
    top = max(worst.items(), key=lambda kv: kv[1][0]) if worst else (None, (0.0, None))
    return round(top[1][0], 3), top[0], top[1][1]


def sole(teacher, clip):
    """(lowest, highest) of the lower foot against the floor, in mm."""
    arm = bpy.data.objects[RT.TEACHERS[teacher]]
    act = bpy.data.actions[f"{teacher}_{clip}"]
    joints = [RT.resolve(arm, f"CC_Base_{s}_{b}") for s in ("L", "R") for b in ("Foot", "ToeBase")]
    mw = arm.matrix_world
    rest_z = {j: (mw @ arm.data.bones[j].head_local).z for j in joints}
    s0, e0 = (int(round(v)) for v in act.frame_range)
    lows = []
    sc = bpy.context.scene
    with _Keep(arm):
        _play(arm, act)
        for f in range(s0, e0 + 1):
            sc.frame_set(f)
            lows.append(min((mw @ arm.pose.bones[j].head).z - rest_z[j] for j in joints))
    return round(min(lows) * 1000, 1), round(max(lows) * 1000, 1)


ROOTS = {"Jake": "ROOT_canino_man", "MJ": "ROOT_canino_girl_GLB"}


def sole_mesh(teacher, clip, step=3, below=0.12):
    """
    (lowest, highest) over the clip of the lowest vertex of the feet and
    shoes, in mm against z = 0. The scene keeps the teachers in export state,
    standing on z = 0 (v9_export.normalise). Only meshes with vertices below
    `below` at rest are evaluated.
    """
    import numpy as np
    import v9_export
    import v9_strip
    arm = bpy.data.objects[RT.TEACHERS[teacher]]
    act = bpy.data.actions[f"{teacher}_{clip}"]
    root = bpy.data.objects[ROOTS[teacher]]
    meshes = [o for o in v9_export.descend(root) if o.type == "MESH"
              and o.name not in v9_strip.HIDE
              and min((o.matrix_world @ v.co).z for v in o.data.vertices) < below]
    s0, e0 = (int(round(v)) for v in act.frame_range)
    sc = bpy.context.scene
    old_hide = [(o, o.hide_viewport) for o in meshes]
    lows = []
    try:
        with _Keep(arm):
            for o in meshes:
                o.hide_viewport = False
            _play(arm, act)
            for f in range(s0, e0 + 1, step):
                sc.frame_set(f)
                dg = bpy.context.evaluated_depsgraph_get()
                low = 9.0
                for o in meshes:
                    eo = o.evaluated_get(dg)
                    me = eo.to_mesh()
                    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
                    me.vertices.foreach_get("co", co)
                    eo.to_mesh_clear()
                    co = co.reshape(-1, 3)
                    m = np.array(eo.matrix_world)
                    z = co @ m[2, :3] + m[2, 3]
                    low = min(low, float(z.min()))
                lows.append(low)
    finally:
        for o, h in old_hide:
            o.hide_viewport = h
    return round(min(lows) * 1000, 1), round(max(lows) * 1000, 1)


def seam(arm_name, action_name, bones=None):
    """Largest first-vs-last-frame angle (deg) over `bones` (default: mapped CC or all)."""
    arm = bpy.data.objects[arm_name]
    act = bpy.data.actions[action_name]
    if bones is None:
        bones = [b.name for b in arm.pose.bones]
    s0, e0 = (int(round(v)) for v in act.frame_range)
    sc = bpy.context.scene
    with _Keep(arm):
        _play(arm, act)
        sc.frame_set(s0)
        a = {b: (arm.matrix_world @ arm.pose.bones[b].matrix).to_quaternion() for b in bones}
        sc.frame_set(e0)
        worst = (0.0, None)
        for b in bones:
            q = (arm.matrix_world @ arm.pose.bones[b].matrix).to_quaternion()
            ang = math.degrees(a[b].rotation_difference(q).angle)
            ang = min(ang, 360.0 - ang)
            if ang > worst[0]:
                worst = (ang, b)
    return round(worst[0], 2), worst[1]


def mapped_bones(teacher, src_name="MarcusArma"):
    tgt = bpy.data.objects[RT.TEACHERS[teacher]]
    pairs, _ = RT.build_pairs(tgt, bpy.data.objects[src_name])
    return [t for t, _ in pairs], [s for _, s in pairs]
