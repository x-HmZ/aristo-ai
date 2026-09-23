"""
Author the Tier 2 gestures (V9.6) on the Canino teachers by writing keys.

A gesture is an overlay: the director plays it over a base clip with only the
tracks of its mask (`skeletonMasks.ts`), so a clip here keys only the bones
that make the gesture. Every other bone is left unkeyed, exports at its rest
value, and `v9_postprocess.mjs` drops rest tracks -- so in the app the base
keeps driving them (the other arm keeps talking, the head keeps its look).

Poses are written as rotations on top of the rig's own Idle pose, not as
local bone values, so one spec plays on Jake and on MJ:

- each keyed bone gets an offset `O_own`, a product of rotations about the
  character's body axes as they stand in Idle ("L" his left, "F" forward,
  "U" up) or about the bone itself ("A", head to child joint);
- offsets compose down the chain like FK, `O = O_parent @ O_own`, and the
  bone's armature-space pose is `O @ P_idle`. An axis is therefore always
  read in the Idle frame: bending the elbow is about "L" even after the
  upper arm has lifted;
- fingers blend their local basis from Idle towards rest (a flat hand), which
  on these rigs is an open hand;
- the local basis is solved against the real parent chain, so MJ's
  `_scaleCompensation` wrappers and numbered names need no special case.

First and last key are the Idle pose (offset identity, openness 0), so the
overlay fades in and out of a standing pose without a pop. Keys are
interpolated as rotation vectors with a monotone cubic (PCHIP): no overshoot,
eased at every turning point, smooth through the others.

Blender 5.x actions: keyframe_insert on an assigned action creates its slot.
"""

import math
import re

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

import v9_retarget as rt

TEACHERS = {"Jake": ("Armature.002", "ROOT_canino_man"),
            "MJ": ("Object_4.001", "ROOT_canino_girl_GLB")}
FPS = 24  # the scene's rate; every shipped clip is baked at it
FINGER_RE = re.compile(r"^CC_Base_([LR])_(Index|Mid|Ring|Pinky|Thumb)\d(_\d+)?$")


# ─── Pose reading ────────────────────────────────────────────────────────────

def _use_action(arm, action):
    ad = arm.animation_data_create()
    ad.use_nla = False
    ad.action = action
    if action is not None and action.slots:
        ad.action_slot = action.slots[0]


def reset_pose(arm):
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


def idle_pose(arm, action_name, frame=1):
    """Armature-space rotation and local basis of every bone at `frame`."""
    arm.hide_viewport = False
    arm.hide_set(False)
    reset_pose(arm)
    _use_action(arm, bpy.data.actions[action_name])
    bpy.context.scene.frame_set(frame)
    P = {pb.name: pb.matrix.to_3x3().normalized() for pb in arm.pose.bones}
    B = {pb.name: pb.matrix_basis.to_quaternion().normalized() for pb in arm.pose.bones}
    return P, B


def body_axes(arm, root_name):
    """The character's left, forward and up, in armature space."""
    root = bpy.data.objects[root_name].matrix_world.to_3x3().normalized()
    to_arm = arm.matrix_world.to_3x3().normalized().inverted()
    left = (to_arm @ (root @ Vector((1, 0, 0)))).normalized()
    fwd = (to_arm @ (root @ Vector((0, -1, 0)))).normalized()
    up = (to_arm @ (root @ Vector((0, 0, 1)))).normalized()
    return {"L": left, "F": fwd, "U": up}


# ─── Interpolation ───────────────────────────────────────────────────────────

def _pchip_slopes(t, y):
    h = np.diff(t)
    d = np.diff(y) / h
    m = np.zeros_like(y)
    for k in range(1, len(y) - 1):
        if d[k - 1] * d[k] > 0:
            w1, w2 = 2 * h[k] + h[k - 1], h[k] + 2 * h[k - 1]
            m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k])
    return m  # zero at both ends: the gesture leaves and lands at rest speed


def pchip(t, y, x):
    t, y = np.asarray(t, float), np.asarray(y, float)
    if x <= t[0]:
        return float(y[0])
    if x >= t[-1]:
        return float(y[-1])
    m = _pchip_slopes(t, y)
    k = int(np.searchsorted(t, x) - 1)
    h = t[k + 1] - t[k]
    s = (x - t[k]) / h
    h00, h10 = 2 * s**3 - 3 * s**2 + 1, s**3 - 2 * s**2 + s
    h01, h11 = -2 * s**3 + 3 * s**2, s**3 - s**2
    return float(h00 * y[k] + h10 * h * m[k] + h01 * y[k + 1] + h11 * h * m[k + 1])


def _log(q):
    q = q.normalized()
    if q.w < 0:
        q = -q
    ang = 2 * math.acos(max(-1.0, min(1.0, q.w)))
    s = math.sqrt(max(0.0, 1 - q.w * q.w))
    return Vector((0, 0, 0)) if s < 1e-9 else Vector((q.x, q.y, q.z)) / s * ang


def _exp(v):
    ang = v.length
    return Quaternion() if ang < 1e-9 else Quaternion(v / ang, ang)


# ─── Authoring ───────────────────────────────────────────────────────────────

def _aim_child(arm, bone_name):
    """Joint the bone points at, for the 'A' axis (see v9_retarget.AIM)."""
    logical = re.sub(r"_\d+$", "", bone_name)
    child = rt.AIM.get(logical)
    return rt.resolve(arm, child) if child else None


def _offset(ops, axes, arm, bone, P_idle_all):
    q = Quaternion()
    for axis, deg in ops:
        if axis == "A":
            child = _aim_child(arm, bone)
            pbs = arm.pose.bones
            v = (Vector(pbs[child].head) - Vector(pbs[bone].head)) if child else Vector(pbs[bone].y_axis)
            a = v.normalized()
        else:
            a = axes[axis]
        q = q @ Quaternion(a, math.radians(deg))
    return q


def build(teacher, spec, idle="Idle", name=None, frame=1):
    """
    Key `spec` on `teacher` as the action `<Teacher>_<spec name>`.

    spec = {
      "name": "PresentModel", "length": 2.6,
      "bones": {logical CC name: [(t, [(axis, deg), ...]), ...]},
      "fingers": {"L"|"R": [(t, openness 0..1), ...]},
      "thumb": {"L"|"R": [(t, [(axis, deg), ...]), ...]}   # extra, on Thumb1
    }
    """
    arm_name, root_name = TEACHERS[teacher]
    arm = bpy.data.objects[arm_name]
    P_idle, B_idle = idle_pose(arm, f"{teacher}_{idle}", frame)
    axes = body_axes(arm, root_name)
    bones = arm.data.bones

    offs = {}
    for logical, keys in spec.get("bones", {}).items():
        b = rt.resolve(arm, logical)
        if b is None:
            raise KeyError(f"{teacher}: no bone for {logical}")
        ts = [k[0] for k in keys]
        vs = [_log(_offset(k[1], axes, arm, b, P_idle)) for k in keys]
        offs[b] = (ts, vs)
    for side, keys in spec.get("thumb", {}).items():
        b = rt.resolve(arm, f"CC_Base_{side}_Thumb1")
        ts = [k[0] for k in keys]
        vs = [_log(_offset(k[1], axes, arm, b, P_idle)) for k in keys]
        offs.setdefault(b, (ts, vs))

    fingers = {}
    for side, keys in spec.get("fingers", {}).items():
        for b in bones:
            m = FINGER_RE.match(b.name)
            if m and m.group(1) == side:
                fingers[b.name] = ([k[0] for k in keys], [k[1] for k in keys])

    keyed = set(offs) | set(fingers)
    order = sorted(bones, key=lambda b: len(b.parent_recursive))
    rel = {b.name: (b.parent.matrix_local.to_3x3().inverted() @ b.matrix_local.to_3x3())
           if b.parent else b.matrix_local.to_3x3() for b in bones}

    n_frames = int(round(spec["length"] * FPS)) + 1
    act_name = name or f"{teacher}_{spec['name']}"
    old = bpy.data.actions.get(act_name)
    if old is not None:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(act_name)
    act.use_fake_user = True
    reset_pose(arm)
    _use_action(arm, act)

    prev = {}
    for i in range(n_frames):
        t = i / FPS
        P, O = {}, {}
        for b in order:
            n = b.name
            par = b.parent.name if b.parent else None
            O_par = O.get(par, Quaternion())
            if n in offs:
                ts, vs = offs[n]
                v = Vector([pchip(ts, [vv[c] for vv in vs], t) for c in range(3)])
                O[n] = O_par @ _exp(v)
                P[n] = O[n].to_matrix() @ P_idle[n]
                continue
            O[n] = O_par
            if n in fingers:
                ts, ys = fingers[n]
                a = min(1.0, max(0.0, pchip(ts, ys, t)))
                basis = B_idle[n].slerp(Quaternion(), a)
            else:
                basis = B_idle[n]
            P[n] = (P[par] @ rel[n] if par else rel[n]) @ basis.to_matrix()
        for n in keyed:
            par = bones[n].parent.name if bones[n].parent else None
            base = (P[par] @ rel[n]) if par else rel[n]
            q = (base.inverted() @ P[n]).to_quaternion().normalized()
            if n in prev and prev[n].dot(q) < 0:
                q = -q
            prev[n] = q
            pb = arm.pose.bones[n]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=frame + i)
    return act, frame, frame + n_frames - 1


def finish(teacher, action_name, relax=0.35):
    """Drive the twist and share helpers, then the standard finger relax."""
    import v9_fingers
    arm = bpy.data.objects[TEACHERS[teacher][0]]
    act = bpy.data.actions[action_name]
    reset_pose(arm)
    _use_action(arm, act)
    s, e = (int(round(v)) for v in act.frame_range)
    jobs = rt.drive_helpers(arm, act, s, e)
    touched = v9_fingers.relax_fingers(arm, act, amount=relax) if relax else None
    _drop_rest_curves(arm, act)
    return jobs, touched


def _drop_rest_curves(arm, act, tol=1e-5):
    """Helpers on the idle side get identity keys; remove them so the base drives."""
    import v9_fingers
    cb = v9_fingers._channelbag(arm, act)
    by_bone = {}
    for fc in cb.fcurves:
        m = re.match(r'pose\.bones\["(.+)"\]\.rotation_quaternion', fc.data_path)
        if m:
            by_bone.setdefault(m.group(1), []).append(fc)
    dropped = 0
    for bone, fcs in by_bone.items():
        if len(fcs) != 4:
            continue
        rest = (1, 0, 0, 0)
        if all(abs(kp.co.y - rest[fc.array_index]) < tol for fc in fcs for kp in fc.keyframe_points):
            for fc in fcs:
                cb.fcurves.remove(fc)
            dropped += 1
    return dropped


# ─── Review ──────────────────────────────────────────────────────────────────

def composite(teacher, base, gesture):
    """Play `gesture` over `base` the way the app does: NLA Replace on top."""
    arm = bpy.data.objects[TEACHERS[teacher][0]]
    ad = arm.animation_data_create()
    ad.action = None
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    reset_pose(arm)
    for nm in (f"{teacher}_{base}", gesture):
        act = bpy.data.actions[nm]
        tr = ad.nla_tracks.new()
        tr.name = nm
        st = tr.strips.new(nm, 1, act)
        st.blend_type = "REPLACE"
        st.extrapolation = "HOLD"
    ad.use_nla = True
    return arm


def lesson_camera(teacher, name="V96Cam"):
    """
    The app's lesson camera, in the teacher's own space: camera (0, 0, 0.9),
    looking down -z, vertical fov 40; teacher at (-1, -1.7, -3), rotY 0.3,
    standScale Jake 1.3824, MJ 1.3521 (Experience.tsx, AristoCanvas.tsx).
    """
    s = {"Jake": 1.3824, "MJ": 1.3521}[teacher]
    ry = 0.3
    d = Vector((1.0, 1.7, 3.9))  # camera minus teacher origin, three.js world
    c, sn = math.cos(-ry), math.sin(-ry)
    loc3 = Vector((c * d.x + sn * d.z, d.y, -sn * d.x + c * d.z)) / s
    fwd3 = Vector((c * 0 + sn * -1, 0, -sn * 0 + c * -1))
    to_b = lambda v: Vector((v.x, -v.z, v.y))  # three.js y-up to Blender z-up
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, bpy.data.cameras.new(name))
        bpy.context.scene.collection.objects.link(ob)
    ob.data.sensor_fit = "VERTICAL"
    ob.data.angle_y = math.radians(40)
    ob.data.clip_start = 0.01
    ob.location = to_b(loc3)
    ob.rotation_euler = to_b(fwd3).to_track_quat("-Z", "Y").to_euler()
    sc = bpy.context.scene
    sc.camera = ob
    sc.render.resolution_x, sc.render.resolution_y = 1440, 810
    return ob


def view_camera(cam=None):
    sc = bpy.context.scene
    if cam is not None:
        sc.camera = cam
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            sp = area.spaces.active
            sp.region_3d.view_perspective = "CAMERA"
            sp.overlay.show_overlays = False
            sp.show_region_ui = False
            sp.show_region_toolbar = False
            sp.show_region_header = False
            region = next(r for r in area.regions if r.type == "WINDOW")
            with bpy.context.temp_override(area=area, region=region):
                bpy.ops.view3d.view_center_camera()
    return True


def strip(frames, out_path, cols=4, pct=40, crop=None):
    """Viewport (OpenGL) renders of `frames` through the scene camera, tiled."""
    import os
    sc = bpy.context.scene
    old = (sc.render.resolution_percentage, sc.render.filepath, sc.render.image_settings.file_format)
    sc.render.resolution_percentage = pct
    sc.render.image_settings.file_format = "PNG"
    tmp = os.path.join(os.path.dirname(out_path), "_v96_tmp.png")
    area = next(a for a in bpy.context.screen.areas if a.type == "VIEW_3D")
    region = next(r for r in area.regions if r.type == "WINDOW")
    tiles = []
    try:
        for f in frames:
            sc.frame_set(f)
            sc.render.filepath = tmp
            with bpy.context.temp_override(area=area, region=region):
                bpy.ops.render.opengl(write_still=True, view_context=False)
            im = bpy.data.images.load(tmp, check_existing=False)
            w, h = im.size
            a = np.empty(w * h * 4, dtype=np.float32)
            im.pixels.foreach_get(a)
            bpy.data.images.remove(im)
            a = a.reshape(h, w, 4)
            if crop:
                x0, y0, x1, y1 = crop  # fractions, origin top-left
                a = a[::-1][int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)][::-1]
            tiles.append(a)
    finally:
        sc.render.resolution_percentage, sc.render.filepath, sc.render.image_settings.file_format = old
        if os.path.exists(tmp):
            os.remove(tmp)
    h, w, _ = tiles[0].shape
    rows = (len(tiles) + cols - 1) // cols
    sheet = np.ones((h * rows, w * cols, 4), dtype=np.float32)
    for i, a in enumerate(tiles):
        r, c = divmod(i, cols)
        rr = rows - 1 - r  # image rows run bottom-up
        sheet[rr * h:(rr + 1) * h, c * w:(c + 1) * w] = a
    img = bpy.data.images.new("v96_strip", w * cols, h * rows, alpha=True)
    img.pixels.foreach_set(sheet.ravel())
    img.filepath_raw = out_path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return out_path


def clearance(teacher, action_name, garments, side, base="Idle", step=1):
    """
    Closest approach (m) of the gesture hand to each garment over the clip,
    with the gesture playing over `base`. Garment vertices driven mostly by
    the arm (sleeves) are left out, so this measures hand-to-body contact.
    Points: the hand joint and every finger joint of `side`.
    """
    from mathutils.kdtree import KDTree
    arm = composite(teacher, base, action_name)
    act = bpy.data.actions[action_name]
    s, e = (int(round(v)) for v in act.frame_range)
    arm_bone = re.compile(rf"CC_Base_{side}_(Clavicle|Upperarm|Forearm|Elbow|Hand|Index|Mid|Ring|Pinky|Thumb)")
    pts = [b.name for b in arm.data.bones
           if re.match(rf"^CC_Base_{side}_(Hand|Index\d|Mid\d|Ring\d|Pinky\d|Thumb\d)(_\d+)?$", b.name)]
    keep = {}
    for gname in garments:
        o = bpy.data.objects[gname]
        vg = {i: grp.name for i, grp in enumerate(o.vertex_groups)}
        ok = []
        for v in o.data.vertices:
            w_arm = sum(gw.weight for gw in v.groups if arm_bone.match(vg.get(gw.group, "")))
            w_all = sum(gw.weight for gw in v.groups) or 1.0
            ok.append(w_arm / w_all < 0.5)
        keep[gname] = ok
    worst = {gname: (9.0, None) for gname in garments}
    dg = bpy.context.evaluated_depsgraph_get()
    for f in range(s, e + 1, step):
        bpy.context.scene.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        P = [arm.matrix_world @ arm.pose.bones[n].head for n in pts]
        for gname in garments:
            o = bpy.data.objects[gname]
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            mw = o.matrix_world
            kd = KDTree(len(me.vertices))
            n = 0
            for i, v in enumerate(me.vertices):
                if keep[gname][i]:
                    kd.insert(mw @ v.co, i)
                    n += 1
            kd.balance()
            ev.to_mesh_clear()
            for p, nm in zip(P, pts):
                _co, _i, d = kd.find(p)
                if d is not None and d < worst[gname][0]:
                    worst[gname] = (d, (f, nm))
    return {k: (round(v[0] * 1000, 1), v[1]) for k, v in worst.items()}


def close_camera(teacher, bone, dist=1.1, side=0.0, up=0.0, name="V96Close"):
    """A 50 mm camera on a bone, from the lesson camera's direction, for detail."""
    arm = bpy.data.objects[TEACHERS[teacher][0]]
    lc = lesson_camera(teacher)
    b = rt.resolve(arm, bone)
    aim = arm.matrix_world @ arm.pose.bones[b].head
    d = (lc.location - aim).normalized()
    d = (Quaternion(Vector((0, 0, 1)), side) @ d)
    d.z += up
    d.normalize()
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, bpy.data.cameras.new(name))
        bpy.context.scene.collection.objects.link(ob)
    ob.data.lens = 50
    ob.data.sensor_fit = "AUTO"
    ob.location = aim + d * dist
    ob.rotation_euler = (aim - ob.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = ob
    return ob


# ─── The V9.6 clips ──────────────────────────────────────────────────────────
# Signs, for reading the specs: about "F", + moves a hanging arm towards his
# left (abducts the left arm, adducts the right) and tips the head to his
# right; about "L", - swings a hanging bone forward and + tips the head down
# (a nod); about "A", - turns the left arm outward and + the right one.

def _neck(keys, w=(0.3, 0.3, 0.4)):
    """Head motion (t, tilt about F, pitch about L) shared down the neck."""
    return {bone: [(t, [("F", r * k), ("L", p * k)]) for t, r, p in keys]
            for bone, k in zip(("CC_Base_NeckTwist01", "CC_Base_NeckTwist02", "CC_Base_Head"), w)}


# Open left palm, up and out towards the model (the scene anchor is on his
# left, screen right). The head is left to the look layer.
PRESENT_MODEL = {
    "name": "PresentModel", "length": 2.6,
    "bones": {
        "CC_Base_L_Clavicle": [(0, []), (0.7, [("F", 3)]), (1.9, [("F", 4)]), (2.6, [])],
        "CC_Base_L_Upperarm": [(0, []), (0.7, [("F", 25), ("L", -20), ("A", -45)]),
                               (1.9, [("F", 28), ("L", -20), ("A", -48)]), (2.6, [])],
        "CC_Base_L_Forearm": [(0, []), (0.78, [("L", -75), ("A", -70)]),
                              (1.9, [("L", -72), ("A", -75)]), (2.6, [])],
        "CC_Base_L_Hand": [(0, []), (0.82, [("F", 10)]), (1.9, [("F", 12)]), (2.6, [])],
    },
    "fingers": {"L": [(0, 0), (0.8, 0.85), (1.9, 0.85), (2.6, 0)]},
}

# "Let's look at that again": a slow tilt, one soft nod and a smaller echo.
LOOK_AGAIN = {
    "name": "LookAgain", "length": 2.0,
    "bones": _neck([(0, 0, 0), (0.5, -12, 6), (0.85, -12, 15), (1.1, -11, 5),
                    (1.3, -11, 9), (2.0, 0, 0)]),
}

# "You're getting there": right palm offered forward at the waist, a small
# forward beat on the nod. The 0.25 s and 2.1 s keys lift the forearm before
# the arm turns in, and untwist it before it drops, so the hand travels at
# the side and never through MJ's flared skirt.
ENCOURAGE = {
    "name": "Encourage", "length": 2.5,
    "bones": {
        "CC_Base_R_Upperarm": [(0, []), (0.25, [("F", -2), ("L", -8), ("A", -2)]),
                               (0.6, [("F", 3), ("L", -18), ("A", -16)]),
                               (0.95, [("F", 3), ("L", -24), ("A", -14)]),
                               (1.7, [("F", 3), ("L", -20), ("A", -16)]),
                               (2.1, [("F", -2), ("L", -8), ("A", -2)]), (2.5, [])],
        "CC_Base_R_Forearm": [(0, []), (0.25, [("L", -30), ("A", 30)]),
                              (0.65, [("L", -75), ("A", 70)]),
                              (0.95, [("L", -66), ("A", 75)]),
                              (1.7, [("L", -72), ("A", 72)]),
                              (2.1, [("L", -30), ("A", 35)]), (2.5, [])],
        "CC_Base_R_Hand": [(0, []), (0.7, [("F", -8)]), (1.7, [("F", -10)]), (2.5, [])],
        **_neck([(0, 0, 0), (0.6, -2, 2), (0.95, -4, 10), (1.25, -4, 3), (1.7, -3, 2), (2.5, 0, 0)]),
    },
    "fingers": {"R": [(0, 0), (0.65, 0.65), (1.7, 0.65), (2.5, 0)]},
}

V96 = (PRESENT_MODEL, LOOK_AGAIN, ENCOURAGE)


def build_all(teachers=("Jake", "MJ")):
    """Key, drive helpers and relax fingers for every V9.6 clip."""
    out = []
    for t in teachers:
        for spec in V96:
            act, s, e = build(t, spec)
            out.append((act.name, s, e, finish(t, act.name)))
    return out
