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
FINGER_JOINT_RE = re.compile(r"^CC_Base_([LR])_(Index|Mid|Ring|Pinky|Thumb)(\d)(_\d+)?$")

# Hand life (V9.7, a spec with "life": True). Hmz on the first V9.7 drafts:
# the hands stayed flat and rigid. A real open hand is not flat: the index
# opens most and the pinky least (the cascade), the fingertips keep a bend,
# the fingers unfurl one after another, a held hand never freezes, and the
# wrist is carried by the forearm rather than welded to it.
# Per finger: (share of the openness, delay in s, drift phase).
FINGER_LIFE = {"Index": (1.0, 0.0, 0.0), "Mid": (0.88, 0.03, 1.1), "Ring": (0.74, 0.06, 2.3),
               "Pinky": (0.6, 0.09, 3.4), "Thumb": (0.6, 0.02, 0.6)}
FINGER_JOINT = {1: 1.0, 2: 0.8, 3: 0.6}  # knuckle to fingertip: the tips stay bent
FINGER_DRIFT = 0.05  # openness, a slow wave while the hand is held
WRIST_LAG, WRIST_K = 0.1, 0.5  # the hand trails the forearm by 0.1 s, half way


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


# A full tuck (openness -1) per joint, knuckle to tip, added to the reference
# pose. The Canino finger bones flex about their local Z (-Z on the left
# hand, +Z on the right), measured on both rigs; Idle is only about 10 deg a
# joint, which is why scaling Idle could not close a hand.
CURL_DEG = {1: 70, 2: 85, 3: 55}


def _curl(basis, a, side="L", joint=1, thumb=False):
    """
    A finger's local basis at openness `a`: 0 is the reference pose (Idle, or
    the base loop's frame), 1 is rest (flat). Below 0 it curls past the
    reference towards a tuck at -1 (the fingers a point folds away; V9.8):
    a bend about the bone's own Z by `CURL_DEG`. The thumb's axes differ per
    joint, so it carries on along its reference bend instead (-1 is twice it).
    """
    if a >= 0 or thumb:
        return _exp(_log(basis) * (1.0 - a))
    z = -1.0 if side == "L" else 1.0
    return basis @ Quaternion(Vector((0, 0, z)), math.radians(CURL_DEG[joint] * -a))


def _base_frames(arm, action_name, n_frames):
    """Every bone's armature-space rotation, local basis and location on each frame of a base loop, wrapping."""
    act = bpy.data.actions[action_name]
    s, e = (int(round(v)) for v in act.frame_range)
    reset_pose(arm)
    _use_action(arm, act)
    out = []
    for i in range(n_frames):
        bpy.context.scene.frame_set(s + i % (e - s))
        out.append(({pb.name: pb.matrix.to_3x3().normalized() for pb in arm.pose.bones},
                    {pb.name: pb.matrix_basis.to_quaternion().normalized() for pb in arm.pose.bones},
                    {pb.name: pb.location.copy() for pb in arm.pose.bones}))
    return out


def _loc_bones(arm, action_name):
    """Bones the base action keys a location on (the hips)."""
    import v9_fingers
    cb = v9_fingers._channelbag(arm, bpy.data.actions[action_name])
    return {m.group(1) for fc in cb.fcurves
            for m in [re.match(r'pose\.bones\["(.+)"\]\.location', fc.data_path)] if m}


def base_length(teacher, base):
    """Seconds of one pass of the base loop `<Teacher>_<base>`, frame count - 1."""
    s, e = bpy.data.actions[f"{teacher}_{base}"].frame_range
    return (int(round(e)) - int(round(s))) / FPS


def build(teacher, spec, idle="Idle", name=None, frame=1):
    """
    Key `spec` on `teacher` as the action `<Teacher>_<spec name>`.

    spec = {
      "name": "PresentModel", "length": 2.6,
      "bones": {logical CC name: [(t, [(axis, deg), ...]), ...]},
      "fingers": {"L"|"R": [(t, openness 0..1), ...]},
      "digits": {"L"|"R": {"Index"|"Mid"|"Ring"|"Pinky"|"Thumb": [(t, openness -1..1), ...]}},
      "thumb": {"L"|"R": [(t, [(axis, deg), ...]), ...]},  # extra, on Thumb1
      "on": "Idle4", "passes": 2,                           # optional, see below
    }

    `digits` (V9.8) keys one finger on its own, over `fingers` for that
    finger: an extended index with the others curled. Its openness is exact
    (no life cascade share and no bent fingertips, so a pointing index is
    straight) and may go below 0 to curl past the reference pose (`_curl`).
    Life's stagger and a smaller drift still apply.

    `on` (V9.8) builds a full-body clip for the base layer: every bone plays
    the named base loop (`<Teacher>_<on>`) frame by frame, hips included, and
    the spec's offsets and fingers ride on top of it instead of on a still
    Idle pose. The clip takes the loop's length (times `passes`, the loop
    played that many times over), so it loops wherever the base does; keep the first and last keys of every offset equal (the specs keep
    them identity) and the seam is the base's own.
    """
    arm_name, root_name = TEACHERS[teacher]
    arm = bpy.data.objects[arm_name]
    P_idle, B_idle = idle_pose(arm, f"{teacher}_{idle}", frame)
    axes = body_axes(arm, root_name)
    bones = arm.data.bones
    on = spec.get("on")
    if on:
        spec = {**spec, "length": base_length(teacher, on) * spec.get("passes", 1)}

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

    life = spec.get("life", False)
    length = spec["length"]
    fingers = {}
    for side, keys in spec.get("fingers", {}).items():
        for b in bones:
            m = FINGER_JOINT_RE.match(b.name)
            if m and m.group(1) == side:
                w, delay, phase = (FINGER_LIFE[m.group(2)] if life else (1.0, 0.0, 0.0))
                jscale = FINGER_JOINT[int(m.group(3))] if life else 1.0
                fingers[b.name] = ([k[0] for k in keys], [k[1] for k in keys], w * jscale, delay, phase)
    digit = set()
    for side, per in spec.get("digits", {}).items():
        for b in bones:
            m = FINGER_JOINT_RE.match(b.name)
            if m and m.group(1) == side and m.group(2) in per:
                keys = per[m.group(2)]
                _w, delay, phase = FINGER_LIFE[m.group(2)] if life else (1.0, 0.0, 0.0)
                fingers[b.name] = ([k[0] for k in keys], [k[1] for k in keys], 1.0, delay, phase)
                digit.add(b.name)

    # Wrist follow-through (life): the hand trails its forearm by WRIST_LAG
    # seconds at WRIST_K strength, so it is carried rather than welded on.
    lag = set()
    if life:
        for side in "LR":
            fa = rt.resolve(arm, f"CC_Base_{side}_Forearm")
            if fa in offs:
                h = rt.resolve(arm, f"CC_Base_{side}_Hand")
                offs.setdefault(h, ([0.0, length], [Vector((0, 0, 0))] * 2))
                lag.add(h)

    keyed = set(offs) | set(fingers)
    order = sorted(bones, key=lambda b: len(b.parent_recursive))
    rel = {b.name: (b.parent.matrix_local.to_3x3().inverted() @ b.matrix_local.to_3x3())
           if b.parent else b.matrix_local.to_3x3() for b in bones}

    def chain(t, delayed=None):
        """Offsets down the chain at `t`; with `delayed`, lagged hands."""
        O = {}
        for b in order:
            n = b.name
            O_par = O.get(b.parent.name if b.parent else None, Quaternion())
            if n in offs:
                ts, vs = offs[n]
                own = _exp(Vector([pchip(ts, [vv[c] for vv in vs], t) for c in range(3)]))
                if delayed is not None and n in lag:
                    k = WRIST_K * min(1.0, t / 0.2, (length - t) / 0.2)
                    O_par = O_par.slerp(delayed[b.parent.name], max(0.0, k))
                O[n] = O_par @ own
            else:
                O[n] = O_par
        return O

    def openness(n, t):
        ts, ys, w, delay, phase = fingers[n]
        lo = -1.0 if n in digit else 0.0
        if not life:
            return min(1.0, max(lo, pchip(ts, ys, t) * w))
        # The stagger and the drift both fade out at the ends, so the first and
        # last frames are exactly the keyed values.
        edge = max(0.0, min(1.0, t / 0.2, (length - t) / 0.2))
        a = pchip(ts, ys, t - delay * edge)
        drift = FINGER_DRIFT * (0.5 if n in digit else 1.0)
        a += drift * edge * min(1.0, abs(pchip(ts, ys, t)) / 0.3) * math.sin(2 * math.pi * 0.55 * t + phase)
        return min(1.0, max(lo, a * w))

    n_frames = int(round(spec["length"] * FPS)) + 1
    on_frames = _base_frames(arm, f"{teacher}_{on}", n_frames) if on else None
    loc_keyed = _loc_bones(arm, f"{teacher}_{on}") if on else set()
    if on:
        keyed |= {b.name for b in bones}
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
        P_ref, B_ref, L_ref = on_frames[i] if on else (P_idle, B_idle, None)
        O = chain(t, chain(t - WRIST_LAG) if lag else None)
        P = {}
        for b in order:
            n = b.name
            par = b.parent.name if b.parent else None
            if n in offs:
                P[n] = O[n].to_matrix() @ P_ref[n]
                continue
            if n in fingers:
                m = FINGER_JOINT_RE.match(n)
                basis = _curl(B_ref[n], openness(n, t), m.group(1), int(m.group(3)), m.group(2) == "Thumb")
            else:
                basis = B_ref[n]
            P[n] = (P[par] @ rel[n] if par else rel[n]) @ basis.to_matrix()
        for n in loc_keyed:
            pb = arm.pose.bones[n]
            pb.location = L_ref[n]
            pb.keyframe_insert("location", frame=frame + i)
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


def hands(teacher, action_name, frames=None, base="Idle", fingers_gap=False):
    """
    Where the hands are, in world mm along his body axes (left, forward, up):
    each hand's middle knuckle from the chest (Spine02 head), and the gap
    between the two knuckles, with the gesture over `base`. For reading a
    pose by numbers before looking at it.
    """
    arm = composite(teacher, base, action_name)
    act = bpy.data.actions[action_name]
    s, e = (int(round(v)) for v in act.frame_range)
    frames = frames or range(s, e + 1)
    root = bpy.data.objects[TEACHERS[teacher][1]].matrix_world.to_3x3().normalized()
    axes = [(root @ Vector(v)).normalized() for v in ((1, 0, 0), (0, -1, 0), (0, 0, 1))]
    mw = arm.matrix_world
    pick = {side: rt.resolve(arm, f"CC_Base_{side}_Mid1") for side in "LR"}
    chest = rt.resolve(arm, "CC_Base_Spine02")
    out = []
    for f in frames:
        bpy.context.scene.frame_set(f)
        c = mw @ arm.pose.bones[chest].head
        row = {"f": f}
        P = {side: mw @ arm.pose.bones[b].head for side, b in pick.items()}
        for side, p in P.items():
            row[side] = tuple(round((p - c).dot(a) * 1000) for a in axes)
            h, i, k = (mw @ arm.pose.bones[rt.resolve(arm, f"CC_Base_{side}_{j}")].head
                       for j in ("Hand", "Index1", "Pinky1"))
            n = (i - h).cross(k - h).normalized() * (-1 if side == "L" else 1)  # out of the palm
            row[side + "palm"] = tuple(round(n.dot(a), 1) for a in axes)
        row["gap"] = round((P["L"] - P["R"]).length * 1000)
        if fingers_gap:
            pts = {side: [mw @ pb.head for pb in arm.pose.bones
                          if re.match(rf"^CC_Base_{side}_(Hand|Index\d|Mid\d|Ring\d|Pinky\d|Thumb\d)(_\d+)?$", pb.name)]
                   for side in "LR"}
            row["near"] = round(min((a - b).length for a in pts["L"] for b in pts["R"]) * 1000)
        out.append(row)
    return out


STAND = {"Jake": 1.3824, "MJ": 1.3521}  # standScale, AVATAR_ASSETS
TEACHER_POS, TEACHER_RY = Vector((-1.0, -1.7, -3.0)), 0.3  # Experience.tsx
PANEL_CENTER, PANEL_SIZE = Vector((0.37, 0.18, -3.0)), 1.455  # SCENE_X/Y/Z, IMG_SIZE


def _to_teacher(teacher, v3, point=True):
    """A three.js world point (or direction) in the teacher's Blender space."""
    d = (v3 - TEACHER_POS) / STAND[teacher] if point else v3
    c, sn = math.cos(-TEACHER_RY), math.sin(-TEACHER_RY)
    x, y, z = c * d.x + sn * d.z, d.y, -sn * d.x + c * d.z
    return Vector((x, -z, y))


def panel_hit(teacher, action_name, frames, side="L", base=None):
    """
    Where the `side` index finger points on the image panel (V9.8, for
    PointNear): the ray from the index knuckle through its tip, met with the
    panel plane. `u` runs from the panel's near edge (his side, 0) to the far
    one (1), `v` from its bottom (0) to its top (1); inside is 0..1 on both.
    Also the fingertip's distance to the plane in mm.
    """
    arm = composite(teacher, base, action_name) if base else bpy.data.objects[TEACHERS[teacher][0]]
    if not base:
        reset_pose(arm)
        _use_action(arm, bpy.data.actions[action_name])
    mw = arm.matrix_world
    c = _to_teacher(teacher, PANEL_CENTER)
    n = _to_teacher(teacher, Vector((0, 0, 1)), point=False).normalized()
    u_ax = _to_teacher(teacher, Vector((1, 0, 0)), point=False).normalized()
    v_ax = Vector((0, 0, 1))
    half = PANEL_SIZE / STAND[teacher] / 2
    k1, k3 = rt.resolve(arm, f"CC_Base_{side}_Index1"), rt.resolve(arm, f"CC_Base_{side}_Index3")
    out = []
    for f in frames:
        bpy.context.scene.frame_set(f)
        a = mw @ arm.pose.bones[k1].head
        tip = mw @ arm.pose.bones[k3].tail
        d = (tip - a).normalized()
        den = d.dot(n)
        row = {"f": f, "tip_mm": round((tip - c).dot(n) * 1000)}
        if abs(den) > 1e-6:
            p = a + d * ((c - a).dot(n) / den)
            row["u"] = round(((p - c).dot(u_ax) + half) / (2 * half), 2)
            row["v"] = round(((p - c).dot(v_ax) + half) / (2 * half), 2)
            row["ahead"] = (p - a).dot(d) > 0
        out.append(row)
    return out


def hand_frame(teacher, side="L"):
    """
    The `side` hand on the current frame, in mm and unit vectors along his
    body axes (left, forward, up) from the chest (Spine02 head): the middle
    knuckle, the index tip, the palm normal and the index direction.
    """
    arm = bpy.data.objects[TEACHERS[teacher][0]]
    mw = arm.matrix_world
    root = bpy.data.objects[TEACHERS[teacher][1]].matrix_world.to_3x3().normalized()
    axes = [(root @ Vector(v)).normalized() for v in ((1, 0, 0), (0, -1, 0), (0, 0, 1))]
    j = lambda n: mw @ arm.pose.bones[rt.resolve(arm, n)].head
    c = j("CC_Base_Spine02")
    h, i1, k1 = j(f"CC_Base_{side}_Hand"), j(f"CC_Base_{side}_Index1"), j(f"CC_Base_{side}_Pinky1")
    tip = mw @ arm.pose.bones[rt.resolve(arm, f"CC_Base_{side}_Index3")].tail
    palm = (i1 - h).cross(k1 - h).normalized() * (-1 if side == "L" else 1)
    ax = lambda v: Vector([v.dot(a) for a in axes])
    return {"knuckle": ax(j(f"CC_Base_{side}_Mid1") - c) * 1000, "tip": ax(tip - c) * 1000,
            "palm": ax(palm), "index": ax((tip - i1).normalized())}


def fit(teacher, make_spec, params, cost, base="Idle", seconds=40, step=12, min_step=2):
    """
    Coordinate descent on a static pose (V9.8): `make_spec(params)` returns a
    short constant spec, `cost(teacher, action_name)` scores it with the pose
    composited over `base` on frame 2. Returns (cost, params). For aiming a
    hand by numbers before looking at it; the result still gets judged by eye.
    """
    import time
    def ev(p):
        spec = make_spec(p)
        build(teacher, spec)
        composite(teacher, base, f"{teacher}_{spec['name']}")
        bpy.context.scene.frame_set(2)
        return cost(teacher, f"{teacher}_{spec['name']}")
    t0 = time.time()
    p = dict(params)
    best = ev(p)
    while time.time() - t0 < seconds and step >= min_step:
        better = False
        for k in p:
            for d in (step, -step):
                q = dict(p)
                q[k] += d
                c = ev(q)
                if c < best:
                    best, p, better = c, q, True
        if not better:
            step //= 2
    return best, p


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
    "life": True,
    "fingers": {"L": [(0, 0), (0.8, 0.85), (1.9, 0.82), (2.6, 0)]},
}

# "Hmm, almost" (wrong answer, V9.6 batch 1). The reveal starts talking at
# once, so this is short: a warm tilt to the side (roll survives the look
# layer) and the right hand held palm down, rocking "so-so" twice. The
# forearm lifts before it turns palm down, which keeps the hand out of MJ's
# skirt. No nod: a nod says "yes" (LookAgain v1, rejected).
_WOBBLE = [(0.5, -75), (0.66, -50), (0.84, -100), (1.02, -52), (1.2, -98), (1.36, -75)]
ALMOST = {
    "name": "Almost", "length": 2.0,
    "bones": {
        "CC_Base_R_Upperarm": [(0, []), (0.25, [("L", -10)]), (0.5, [("F", -8), ("L", -25), ("A", 12)]),
                               (1.4, [("F", -8), ("L", -25), ("A", 12)]), (1.7, [("L", -10)]), (2.0, [])],
        "CC_Base_R_Forearm": [(0, []), (0.25, [("L", -35)])]
                             + [(t, [("L", -82), ("A", a)]) for t, a in _WOBBLE]
                             + [(1.7, [("L", -35), ("A", -25)]), (2.0, [])],
        "CC_Base_R_Hand": [(0, []), (0.5, [("F", -5)]), (1.4, [("F", -5)]), (2.0, [])],
        **_neck([(0, 0, 0), (0.45, 6, 3), (1.4, 8, 3), (2.0, 0, 0)]),
    },
    "life": True,
    "fingers": {"R": [(0, 0), (0.5, 0.7), (1.4, 0.68), (2.0, 0)]},
}

# "Exactly!" (right answer): a crisp open left palm forward to the student,
# chest high, arriving with a small settle and one small nod on the accent.
EXACTLY = {
    "name": "Exactly", "length": 1.8,
    "bones": {
        "CC_Base_L_Clavicle": [(0, []), (0.3, [("F", 3)]), (1.2, [("F", 3)]), (1.8, [])],
        "CC_Base_L_Upperarm": [(0, []), (0.3, [("F", 6), ("L", -42), ("A", 8)]),
                               (0.42, [("F", 6), ("L", -39), ("A", 8)]),
                               (1.2, [("F", 6), ("L", -38), ("A", 8)]), (1.5, [("F", 6), ("L", -16)]), (1.8, [])],
        "CC_Base_L_Forearm": [(0, []), (0.3, [("L", -52), ("A", -70)]), (0.42, [("L", -47), ("A", -70)]),
                              (1.2, [("L", -46), ("A", -70)]), (1.5, [("L", -30), ("A", -20)]), (1.8, [])],
        "CC_Base_L_Hand": [(0, []), (0.32, [("F", 14)]), (1.2, [("F", 14)]), (1.8, [])],
        **_neck([(0, 0, 0), (0.3, 0, 6), (0.5, 0, 1), (1.2, 0, 1), (1.8, 0, 0)]),
    },
    "life": True,
    # Starts and ends a little open: MJ's Idle curl put her fingertips 3-4 mm
    # into the skirt over Idle2 and Talking at the first and last frames.
    "fingers": {"L": [(0, 0.3), (0.3, 0.85), (1.2, 0.82), (1.8, 0.3)]},
}


def _both(left, right_sign=-1):
    """Mirror a left-arm key list to the right: F and A flip sign, L stays."""
    return [(t, [(ax, d * (right_sign if ax in ("F", "A") else 1)) for ax, d in ops]) for t, ops in left]


# "Well done!" (quiz passed): both arms open outward at chest height, palms
# up, a small lift on the beat, a warm tilt.
_WD = {
    "Clavicle": [(0, []), (0.5, [("F", 5)]), (0.9, [("F", 7)]), (1.7, [("F", 5)]), (2.4, [])],
    "Upperarm": [(0, []), (0.5, [("F", 35), ("L", -25), ("A", -20)]), (0.9, [("F", 38), ("L", -30), ("A", -20)]),
                 (1.1, [("F", 36), ("L", -26), ("A", -20)]), (1.7, [("F", 35), ("L", -25), ("A", -20)]), (2.4, [])],
    "Forearm": [(0, []), (0.55, [("L", -55), ("A", -60)]), (1.7, [("L", -52), ("A", -62)]), (2.4, [])],
    "Hand": [(0, []), (0.6, [("F", 10)]), (1.7, [("F", 10)]), (2.4, [])],
}
WELL_DONE = {
    "name": "WellDone", "length": 2.4,
    "bones": {
        **{f"CC_Base_L_{b}": k for b, k in _WD.items()},
        **{f"CC_Base_R_{b}": _both(k) for b, k in _WD.items()},
        **_neck([(0, 0, 0), (0.5, -4, 0), (1.7, -5, 0), (2.4, 0, 0)]),
    },
    "life": True,
    "fingers": {s: [(0, 0), (0.5, 0.85), (1.7, 0.82), (2.4, 0)] for s in "LR"},
}

# "And that's it!" (lesson complete): both hands gather in front, palms
# facing and apart, then open outward palms up, "so, that's it".
_TI = {
    "Clavicle": [(0, []), (0.9, [("F", 4)]), (1.9, [("F", 4)]), (2.6, [])],
    "Upperarm": [(0, []), (0.25, [("L", -12)]), (0.55, [("F", -4), ("L", -30), ("A", 18)]),
                 (1.0, [("F", 14), ("L", -26), ("A", -25)]), (1.9, [("F", 15), ("L", -26), ("A", -25)]), (2.6, [])],
    "Forearm": [(0, []), (0.25, [("L", -30)]), (0.55, [("L", -72), ("A", -10)]),
                (1.05, [("L", -62), ("A", -65)]), (1.9, [("L", -60), ("A", -66)]), (2.6, [])],
    "Hand": [(0, []), (1.05, [("F", 8)]), (1.9, [("F", 8)]), (2.6, [])],
}
THATS_IT = {
    "name": "ThatsIt", "length": 2.6,
    "bones": {
        **{f"CC_Base_L_{b}": k for b, k in _TI.items()},
        **{f"CC_Base_R_{b}": _both(k) for b, k in _TI.items()},
        **_neck([(0, 0, 0), (0.55, 0, 2), (1.0, -4, 6), (1.3, -4, 2), (1.9, -3, 2), (2.6, 0, 0)]),
    },
    "life": True,
    "fingers": {s: [(0, 0), (0.55, 0.55), (1.05, 0.85), (1.9, 0.82), (2.6, 0)] for s in "LR"},
}


def _neck3(keys, w=(0.3, 0.3, 0.4)):
    """Like _neck with a turn: (t, yaw about U, tilt about F, pitch about L)."""
    return {bone: [(t, [("U", y * k), ("F", r * k), ("L", p * k)]) for t, y, r, p in keys]
            for bone, k in zip(("CC_Base_NeckTwist01", "CC_Base_NeckTwist02", "CC_Base_Head"), w)}


# A long quiet wait: turns to the board (on his left) as if rereading it,
# a small thoughtful tilt, then back. The chest turns a little too. In the
# app the look layer takes its target from the base (camera, weight 0.5), so
# the head turn only reads fully if longWait gets its own look target.
GLANCE_BOARD = {
    "name": "GlanceBoard", "length": 2.8,
    "bones": {
        "CC_Base_Spine01": [(0, []), (0.8, [("U", 4)]), (1.9, [("U", 4)]), (2.8, [])],
        "CC_Base_Spine02": [(0, []), (0.8, [("U", 7)]), (1.9, [("U", 8)]), (2.8, [])],
        **_neck3([(0, 0, 0, 0), (0.8, 30, -2, 4), (1.9, 32, -6, 5), (2.8, 0, 0, 0)]),
    },
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
    "life": True,
    "fingers": {"R": [(0, 0), (0.65, 0.75), (1.7, 0.72), (2.5, 0)]},
}

V96 = (PRESENT_MODEL, ENCOURAGE, ALMOST, EXACTLY, WELL_DONE, THATS_IT, GLANCE_BOARD)


def build_all(teachers=("Jake", "MJ")):
    """Key, drive helpers and relax fingers for every V9.6 clip."""
    out = []
    for t in teachers:
        for spec in V96:
            act, s, e = build(t, spec)
            out.append((act.name, s, e, finish(t, act.name, relax=0 if spec.get("life") else 0.35)))
    return out


# ─── The V9.7 clips (catalogue batch 2: teaching moves) ──────────────────────
# Each plays once per segment role or phase (catalogue rows 5, 6, 9, 12, 13,
# 14), so each has to read as its own move and not as a batch 1 clip: no nod
# (Exactly and Encourage own it) and no wide palms-up opening (WellDone and
# ThatsIt own it). Where a row has two plausible gestures there is an "A" and
# a "B" for Hmz to pick from.

def _pair(left):
    """Both arms from left-arm keys, the right one mirrored."""
    out = {}
    for b, k in left.items():
        out[f"CC_Base_L_{b}"] = k
        out[f"CC_Base_R_{b}"] = _both(k)
    return out


def _right(left):
    """The right arm only, authored as if it were the left (mirrored)."""
    return {f"CC_Base_R_{b}": _both(k) for b, k in left.items()}


# "Picture this" (hook): both hands come up in front, palms down and close,
# then glide apart level, as if laying out a scene in the air. A curious
# tilt, the chin a little up. (Palms to the student read as "hands up".)
IMAGINE_A = {
    "name": "Imagine", "length": 2.2,
    "bones": {
        **_pair({
            "Upperarm": [(0, []), (0.25, [("L", -16)]), (0.6, [("F", -5), ("L", -46), ("A", 16)]),
                         (1.35, [("F", 36), ("L", -44), ("A", -4)]), (1.7, [("F", 37), ("L", -43), ("A", -4)]),
                         (2.2, [])],
            "Forearm": [(0, []), (0.25, [("L", -40)]), (0.6, [("L", -72), ("A", 70)]),
                        (1.35, [("L", -54), ("A", 72)]), (1.7, [("L", -52), ("A", 70)]), (2.2, [])],
            "Hand": [(0, []), (0.6, [("F", -25)]), (1.7, [("F", -20)]), (2.2, [])],
        }),
        **_neck([(0, 0, 0), (0.6, 4, -2), (1.35, 7, -4), (1.7, 7, -4), (2.2, 0, 0)]),
    },
    "life": True,
    "fingers": {s: [(0, 0), (0.6, 0.75), (1.35, 0.8), (1.7, 0.75), (2.2, 0)] for s in "LR"},
}

# "What if..." (hook): one hand rises in front of him, palm up, and the
# fingers open as it lifts, as if letting an idea out into the air; the chin
# lifts a little with it. It stays in his own space: a hand out to the side
# pointed at nothing (draft 2, like LookAgainHand).
IMAGINE_B = {
    "name": "ImagineB", "length": 2.2,
    "bones": {
        **_right({
            "Upperarm": [(0, []), (0.3, [("F", -2), ("L", -16), ("A", 6)]), (0.9, [("F", 4), ("L", -40), ("A", -10)]),
                         (1.6, [("F", 6), ("L", -44), ("A", -12)]), (2.2, [])],
            "Forearm": [(0, []), (0.3, [("L", -60), ("A", -40)]), (0.9, [("L", -80), ("A", -90)]),
                        (1.6, [("L", -76), ("A", -92)]), (2.2, [])],
            "Hand": [(0, []), (0.9, [("F", 12)]), (1.6, [("F", 16)]), (2.2, [])],
        }),
        **_neck([(0, 0, 0), (0.9, -3, -3), (1.6, -5, -5), (2.2, 0, 0)]),
    },
    "fingers": {"R": [(0, 0), (0.35, 0.05), (1.0, 1.0), (1.6, 1.0), (2.2, 0)]},
}

# Holding the idea (explain): hands in front of the chest, palms facing, a
# ball's width apart, with one small shaping beat. No contact.
HOLD_IDEA = {
    "name": "HoldIdea", "length": 2.5,
    "bones": {
        **_pair({
            "Clavicle": [(0, []), (0.55, [("F", -2)]), (1.9, [("F", -2)]), (2.5, [])],
            "Upperarm": [(0, []), (0.22, [("L", -12)]), (0.55, [("F", -5), ("L", -34), ("A", 18)]),
                         (0.95, [("F", -6), ("L", -31), ("A", 19)]), (1.25, [("F", -5), ("L", -34), ("A", 18)]),
                         (1.9, [("F", -5), ("L", -33), ("A", 18)]), (2.2, [("F", 5), ("L", -13)]), (2.5, [])],
            "Forearm": [(0, []), (0.22, [("L", -30)]), (0.55, [("L", -82), ("A", -12)]),
                        (0.95, [("L", -74), ("A", -12)]), (1.25, [("L", -82), ("A", -12)]),
                        (1.9, [("L", -80), ("A", -12)]), (2.2, [("L", -36), ("A", -5)]), (2.5, [])],
        }),
        **_neck([(0, 0, 0), (0.55, 2, 1), (0.95, 3, 4), (1.25, 3, 1), (2.5, 0, 0)]),
    },
    "life": True,
    "fingers": {s: [(0, 0), (0.55, 0.3), (0.95, 0.22), (1.25, 0.3), (1.9, 0.3), (2.5, 0)] for s in "LR"},
}

# One step (demo_step): the right hand comes up as a flat blade, palm to
# the side, and chops down once on the step. Short, so it lands on each.
STEP_BEAT = {
    "name": "StepBeat", "length": 1.4,
    "bones": {
        **_right({
            "Upperarm": [(0, []), (0.3, [("F", 6), ("L", -32), ("A", 6)]), (0.5, [("F", 6), ("L", -34), ("A", 6)]),
                         (0.62, [("F", 6), ("L", -30), ("A", 6)]), (0.9, [("F", 6), ("L", -30), ("A", 6)]),
                         (1.4, [])],
            "Forearm": [(0, []), (0.3, [("L", -82), ("A", -5)]), (0.5, [("L", -92), ("A", -5)]),
                        (0.62, [("L", -64), ("A", -5)]), (0.9, [("L", -66), ("A", -5)]), (1.4, [])],
        }),
        **_neck([(0, 0, 0), (0.5, 0, 0), (0.64, 0, 3), (0.9, 0, 1), (1.4, 0, 0)]),
    },
    "life": True,
    "fingers": {"R": [(0, 0), (0.3, 0.85), (0.9, 0.82), (1.4, 0)]},
}

# "Now, next" (transition): the right hand, palm down, brushes the last idea
# aside, from in front of him out to his right.
MOVE_ON_A = {
    "name": "MoveOnA", "length": 1.6,
    "bones": {
        **_right({
            "Upperarm": [(0, []), (0.3, [("F", -4), ("L", -26), ("A", 14)]),
                         (0.85, [("F", 30), ("L", -24), ("A", -4)]), (1.1, [("F", 31), ("L", -22), ("A", -4)]),
                         (1.6, [])],
            "Forearm": [(0, []), (0.3, [("L", -82), ("A", 70)]), (0.85, [("L", -42), ("A", 70)]),
                        (1.1, [("L", -40), ("A", 60)]), (1.6, [])],
        }),
        **_neck([(0, 0, 0), (0.3, 0, 2), (0.85, -3, 0), (1.6, 0, 0)]),
    },
    "life": True,
    "fingers": {"R": [(0, 0), (0.3, 0.6), (0.85, 0.75), (1.1, 0.7), (1.6, 0)]},
}

# "And so, on to..." (transition): the right hand rolls forward once in
# front of him and opens palm up ahead, the "moving along" roll.
MOVE_ON_B = {
    "name": "MoveOn", "length": 1.6,
    "bones": {
        **_right({
            "Upperarm": [(0, []), (0.12, [("F", 5), ("L", -8)]), (0.3, [("F", -2), ("L", -20), ("A", 10)]), (0.55, [("F", -2), ("L", -22), ("A", 10)]),
                         (0.8, [("F", 2), ("L", -32), ("A", 4)]), (1.05, [("F", 4), ("L", -36), ("A", 0)]),
                         (1.35, [("F", 7), ("L", -16)]), (1.6, [])],
            "Forearm": [(0, []), (0.12, [("L", -28)]), (0.3, [("L", -80), ("A", -55)]), (0.55, [("L", -102), ("A", -60)]),
                        (0.8, [("L", -72), ("A", -70)]), (1.05, [("L", -55), ("A", -78)]), (1.35, [("L", -34), ("A", -30)]), (1.6, [])],
        }),
    },
    "life": True,
    "fingers": {"R": [(0, 0.3), (0.3, 0.45), (0.8, 0.6), (1.05, 0.8), (1.6, 0.3)]},
}

# "Your turn" (challenge_setup): the right hand, palm up, sweeps in from his
# side to the front, towards the student (who is straight ahead of him); a
# questioning tilt, no nod. Draft 1 carried the left hand out to his left,
# which ended where Exactly ends and pointed at the board side.
YOUR_TURN_A = {
    "name": "YourTurnA", "length": 2.0,
    "bones": {
        **_right({
            "Upperarm": [(0, []), (0.35, [("F", 24), ("L", -16), ("A", -20)]),
                         (0.95, [("F", -10), ("L", -48), ("A", 6)]), (1.5, [("F", -10), ("L", -47), ("A", 6)]),
                         (1.75, [("F", 8), ("L", -16), ("A", -2)]), (2.0, [])],
            "Forearm": [(0, []), (0.35, [("L", -48), ("A", -80)]), (0.95, [("L", -50), ("A", -88)]),
                        (1.5, [("L", -52), ("A", -88)]), (1.75, [("L", -34), ("A", -30)]), (2.0, [])],
            "Hand": [(0, []), (0.95, [("F", 8)]), (1.5, [("F", 8)]), (2.0, [])],
        }),
        "CC_Base_Spine02": [(0, []), (0.95, [("L", 3)]), (1.5, [("L", 3)]), (2.0, [])],
        **_neck([(0, 0, 0), (0.35, -2, 0), (0.95, 6, -2), (1.5, 7, -2), (2.0, 0, 0)]),
    },
    "life": True,
    "fingers": {"R": [(0, 0), (0.35, 0.55), (0.95, 0.78), (1.5, 0.74), (2.0, 0)]},
}

# "Over to you" (challenge_setup): both hands offered forward to the
# student, elbows in front and hands close, palms up, with a small lift at
# the end like a question. Draft 1 had the elbows at his sides and the hands
# out wide, which is a shrug.
YOUR_TURN_B = {
    "name": "YourTurn", "length": 2.0,
    "bones": {
        **_pair({
            "Upperarm": [(0, []), (0.2, [("F", 5), ("L", -10)]), (0.5, [("F", -5), ("L", -39), ("A", 6)]), (1.1, [("F", -5), ("L", -42), ("A", 6)]),
                         (1.5, [("F", -5), ("L", -41), ("A", 6)]), (1.75, [("F", 6), ("L", -14)]), (2.0, [])],
            "Forearm": [(0, []), (0.2, [("L", -35), ("A", -25)]), (0.5, [("L", -42), ("A", -85)]), (1.1, [("L", -48), ("A", -85)]),
                        (1.5, [("L", -47), ("A", -85)]), (1.75, [("L", -32), ("A", -30)]), (2.0, [])],
            "Hand": [(0, []), (0.5, [("F", 6)]), (1.5, [("F", 6)]), (2.0, [])],
        }),
        "CC_Base_Spine02": [(0, []), (0.5, [("L", 2)]), (1.1, [("L", 4)]), (1.5, [("L", 4)]), (2.0, [])],
        **_neck([(0, 0, 0), (0.5, 0, 0), (1.1, 0, -3), (1.5, 0, -3), (2.0, 0, 0)]),
    },
    "life": True,
    "fingers": {s: [(0, 0), (0.5, 0.7), (1.1, 0.78), (1.5, 0.74), (2.0, 0)] for s in "LR"},
}

# "It all fits" (connect): the hands start wide, palms facing, and come
# together in front, close but not touching; a small satisfied settle.
BRING_TOGETHER = {
    "name": "BringTogether", "length": 2.4,
    "bones": {
        **_pair({
            "Upperarm": [(0, []), (0.2, [("L", -12)]), (0.6, [("F", 32), ("L", -32), ("A", -4)]),
                         (1.3, [("F", -6), ("L", -36), ("A", 22)]), (1.9, [("F", -5), ("L", -35), ("A", 21)]),
                         (2.4, [])],
            "Forearm": [(0, []), (0.2, [("L", -30)]), (0.6, [("L", -62), ("A", -15)]),
                        (1.3, [("L", -84), ("A", -10)]), (1.9, [("L", -82), ("A", -10)]), (2.4, [])],
        }),
        **_neck([(0, 0, 0), (0.6, 0, -1), (1.3, 2, 4), (1.9, 2, 2), (2.4, 0, 0)]),
    },
    "life": True,
    "fingers": {s: [(0, 0), (0.6, 0.6), (1.3, 0.45), (1.9, 0.48), (2.4, 0)] for s in "LR"},
}

# Hmz picked MoveOn B and YourTurn B (2026-09-26); ImagineB never converged.
V97 = (IMAGINE_A, HOLD_IDEA, STEP_BEAT, MOVE_ON_B, YOUR_TURN_B, BRING_TOGETHER)
V97_NOT_SHIPPED = (IMAGINE_B, MOVE_ON_A, YOUR_TURN_A)


def build_v97(teachers=("Jake", "MJ"), names=None):
    """Key, drive helpers and relax fingers for the V9.7 clips (or `names`)."""
    out = []
    for t in teachers:
        for spec in V97:
            if names and spec["name"] not in names:
                continue
            act, s, e = build(t, spec)
            out.append((act.name, s, e, finish(t, act.name, relax=0 if spec.get("life") else 0.35)))
    return out


# ─── The V9.8 clips (catalogue batch 3: events and base clips) ───────────────
# Rows 4, 8, 15, 17b and 18. Arm poses at the hold were aimed by numbers with
# `fit` (and `panel_hit` for PointNear), then judged at the lesson camera.
# OneMoment's right arm was fitted on the right bones directly, so its keys
# are raw (not mirrored through `_right`).

def _tuck(keys):
    """The three fingers a pointing hand folds away, all on the same keys."""
    return {f: keys for f in ("Mid", "Ring", "Pinky")}


# "One moment" (isLoading rising edge, then the Thinking loop takes over): the
# right index raised gently in front of the shoulder, palm to the student,
# the other fingers folded, held briefly. The forearm lifts before it turns.
_OM_UA = [("F", 21), ("L", -23), ("A", -7)]
_OM_HAND = [("L", -30), ("F", -32)]
ONE_MOMENT = {
    "name": "OneMoment", "length": 2.0,
    "bones": {
        "CC_Base_R_Upperarm": [(0, []), (0.2, [("L", -10)]), (0.55, _OM_UA), (1.4, _OM_UA),
                               (1.7, [("F", 6), ("L", -12)]), (2.0, [])],
        "CC_Base_R_Forearm": [(0, []), (0.2, [("L", -45), ("A", -30)]), (0.55, [("L", -112), ("A", -94)]),
                              (0.72, [("L", -108), ("A", -94)]), (1.4, [("L", -108), ("A", -94)]),
                              (1.7, [("L", -50), ("A", -40)]), (2.0, [])],
        "CC_Base_R_Hand": [(0, []), (0.55, _OM_HAND), (1.4, _OM_HAND), (2.0, [])],
        **_neck([(0, 0, 0), (0.55, 3, 0), (1.4, 3, 0), (2.0, 0, 0)]),
    },
    "life": True,
    "digits": {"R": {"Index": [(0, 0), (0.2, 0.3), (0.5, 1), (1.4, 1), (1.75, 0.3), (2.0, 0)],
                     **_tuck([(0, 0), (0.2, -0.2), (0.5, -0.9), (1.4, -0.9), (1.75, -0.2), (2.0, 0)]),
                     "Thumb": [(0, 0), (0.5, -0.7), (1.4, -0.7), (2.0, 0)]}},
}

# Calling out a nearby part of the image (point): the near (left) hand, index
# into the near third of the panel (u 0.27, v 0.46 on Jake), the chest and
# head turned to it. Full body for the base layer, riding two passes of Idle4
# (6 s): up by 0.75 s, one small push towards the image (3 deg of elbow: at
# 6 deg MJ's fingertip came within 2 mm of the panel), held, down by 5.3 s.
_PN_UA = [("U", -8), ("F", 53), ("A", -24)]
_PN_FA = [("L", -42), ("A", -6)]
POINT_NEAR = {
    "name": "PointNear", "on": "Idle4", "passes": 2,
    "bones": {
        "CC_Base_Spine02": [(0, []), (0.75, [("U", 12)]), (4.3, [("U", 12)]), (5.3, []), (6.0, [])],
        "CC_Base_L_Upperarm": [(0, []), (0.25, [("L", -12)]), (0.75, _PN_UA), (4.3, _PN_UA),
                               (4.8, [("F", 20), ("L", -18)]), (5.3, []), (6.0, [])],
        "CC_Base_L_Forearm": [(0, []), (0.25, [("L", -40)]), (0.75, _PN_FA), (1.0, [("L", -39), ("A", -6)]),
                              (1.35, _PN_FA), (4.3, _PN_FA), (4.8, [("L", -55), ("A", -10)]), (5.3, []), (6.0, [])],
        "CC_Base_L_Hand": [(0, []), (0.75, [("F", -12)]), (4.3, [("F", -12)]), (5.3, []), (6.0, [])],
        **_neck3([(0, 0, 0, 0), (0.75, 30, 0, 0), (4.3, 30, 0, 0), (5.3, 0, 0, 0), (6.0, 0, 0, 0)]),
    },
    "life": True,
    # The index straightens as the arm arrives, not on the way up (draft 1
    # pointed at the floor mid-rise).
    "digits": {"L": {"Index": [(0, 0), (0.4, 0.15), (0.75, 1), (4.3, 1), (4.9, 0.3), (5.3, 0), (6.0, 0)],
                     **_tuck([(0, 0), (0.35, -0.3), (0.7, -0.9), (4.3, -0.9), (5.1, -0.1), (5.3, 0), (6.0, 0)]),
                     "Thumb": [(0, 0), (0.7, -0.6), (4.3, -0.6), (5.3, 0), (6.0, 0)]}},
}

# Waiting for the answer (listen): a patient tilt of the head to his left,
# the chin a touch down, listening. No nod (it says yes), no hands. Draft 1
# tilted 7 deg, which the classroom camera did not show without a hand to
# carry it. Neck and head only (a `head` mask): draft 2's small chest lean
# carried the base's arms with it and put MJ's hip hand 12 mm into her skirt
# over Talking4.
PATIENT_TILT = {
    "name": "PatientTilt", "length": 3.0,
    "bones": _neck([(0, 0, 0), (0.9, -12, 4), (1.6, -13, 4), (2.2, -12, 3), (3.0, 0, 0)]),
}

# A wrong answer with an image still up (wrong + previewImage): turns back to
# the board, chest and head, with a light open left hand towards it: "let's
# look at that again". Short, because the reveal starts talking at once.
# Draft 1 had the arm out nearly straight, a full PresentModel; the elbow now
# stays bent and the hand close. The forearm lifts (0.2 s) before it turns
# and untwists (1.65 s) before it drops: turning low swung the little finger
# to 32-36 mm off the trousers, against 60-80 at rest.
_BB = {
    "Upperarm": [(0, []), (0.2, [("L", -8)]), (0.5, [("F", 8), ("L", -15), ("A", -35)]),
                 (1.3, [("F", 9), ("L", -15), ("A", -37)]), (1.65, [("F", 3), ("L", -8), ("A", -8)]), (2.0, [])],
    "Forearm": [(0, []), (0.2, [("L", -40)]), (0.5, [("L", -80), ("A", -65)]), (1.3, [("L", -78), ("A", -66)]),
                (1.65, [("L", -40), ("A", -15)]), (2.0, [])],
    "Hand": [(0, []), (0.55, [("F", 8)]), (1.3, [("F", 8)]), (2.0, [])],
}
BACK_TO_BOARD = {
    "name": "BackToBoard", "length": 2.0,
    "bones": {
        "CC_Base_Spine01": [(0, []), (0.45, [("U", 4)]), (1.3, [("U", 4)]), (2.0, [])],
        "CC_Base_Spine02": [(0, []), (0.45, [("U", 8)]), (1.3, [("U", 8)]), (2.0, [])],
        **{f"CC_Base_L_{b}": k for b, k in _BB.items()},
        **_neck3([(0, 0, 0, 0), (0.45, 28, -2, 2), (1.3, 30, -3, 3), (2.0, 0, 0, 0)]),
    },
    "life": True,
    "fingers": {"L": [(0, 0), (0.5, 0.65), (1.3, 0.62), (2.0, 0)]},
}

# The quiz is handed out (activeQuiz rising edge): "from me to you". The left
# hand gathers in front of the chest palm up, then sweeps forward and down
# towards the student's desk, fingers angled at it, with a lean and the head
# down to it. Draft 1 went straight to the offer: seen from the front the
# reach was foreshortened and read as a low palm at the hip, a shrug.
_OY_GATHER = ([("F", -58), ("L", 0), ("A", -10)], [("L", -130), ("A", -42)], [("L", 30), ("F", 10)])
_OY_OFFER = ([("F", -54), ("L", -35), ("A", -23)], [("L", -65), ("A", -26)], [("L", 20), ("F", 5)])
OVER_TO_YOU_R2 = {
    "name": "OverToYouR2", "length": 2.4,
    "bones": {
        "CC_Base_Spine02": [(0, []), (0.55, [("L", 2)]), (1.0, [("L", 6)]), (1.8, [("L", 6)]), (2.4, [])],
        "CC_Base_L_Upperarm": [(0, []), (0.2, [("L", -10)]), (0.55, _OY_GATHER[0]), (1.0, _OY_OFFER[0]),
                               (1.8, _OY_OFFER[0]), (2.1, [("L", -10)]), (2.4, [])],
        "CC_Base_L_Forearm": [(0, []), (0.2, [("L", -50), ("A", -20)]), (0.55, _OY_GATHER[1]), (1.0, _OY_OFFER[1]),
                              (1.8, _OY_OFFER[1]), (2.1, [("L", -50), ("A", -20)]), (2.4, [])],
        "CC_Base_L_Hand": [(0, []), (0.55, _OY_GATHER[2]), (1.0, _OY_OFFER[2]), (1.15, [("L", 26), ("F", 5)]),
                           (1.8, [("L", 24), ("F", 5)]), (2.4, [])],
        **_neck([(0, 0, 0), (0.55, 0, 2), (1.0, 0, 8), (1.8, 0, 7), (2.4, 0, 0)]),
    },
    "life": True,
    "fingers": {"L": [(0, 0), (0.2, 0.3), (0.55, 0.7), (1.0, 0.85), (1.8, 0.82), (2.4, 0)]},
}

# Round 3 (Hmz picked the sideways sweep over round 2): the left hand comes
# up palm up out at his side, then sweeps in across the front and down,
# palm tilted to the student and fingers angled at the desk, with a lean and
# the head down to it. The sideways travel is what the student's camera can
# see; a reach towards the camera is foreshortened (rounds 1 and 2).
# MJ's tee sets the limits. Her armpit skin sits between the tee's arm and
# chest panels and comes through when the upper arm is pulled in to the body
# without swinging forward (17 mm mid-sweep in the first sweep draft, which
# also landed the palm in front of his groin; round 2 had the same fault).
# Pushing that skin further in drives it into the chest panel, so the path
# avoids it instead. And with the upper arm not turned out, her sleeve lets
# upper-arm skin show at the camera. So: out wide with the arm lifted away
# from the body (51 cm to his side, like PresentModel's start), swung
# forward (0.9 s) before it comes in, ending front-left with the upper arm
# turned out, palm to the student and fingers down at the desk. 18 cm of
# sideways travel.
_OY_OUT = ([("F", 10), ("L", 14), ("A", -30)], [("L", -80), ("A", -104)], [("L", -12), ("F", 8)])
_OY_IN = ([("F", -15), ("L", -38), ("A", -35)], [("L", -54), ("A", -40)], [("L", 29), ("F", 32)])
OVER_TO_YOU = {
    "name": "OverToYou", "length": 2.4,
    "bones": {
        "CC_Base_Spine02": [(0, []), (0.6, []), (1.15, [("L", 5)]), (1.85, [("L", 5)]), (2.4, [])],
        "CC_Base_L_Upperarm": [(0, []), (0.2, [("L", -8)]), (0.35, [("F", 8), ("L", 0), ("A", -15)]),
                               (0.6, _OY_OUT[0]), (0.9, [("F", 6), ("L", -34), ("A", -34)]), (1.15, _OY_IN[0]),
                               (1.85, _OY_IN[0]), (2.0, [("F", -2), ("L", -32), ("A", -25)]),
                               (2.15, [("F", 10), ("L", -18)]), (2.4, [])],
        "CC_Base_L_Forearm": [(0, []), (0.2, [("L", -45)]), (0.35, [("L", -70), ("A", -60)]), (0.6, _OY_OUT[1]),
                              (0.9, [("L", -68), ("A", -70)]), (1.15, _OY_IN[1]), (1.85, _OY_IN[1]),
                              (2.1, [("L", -45), ("A", -15)]), (2.4, [])],
        "CC_Base_L_Hand": [(0, []), (0.6, _OY_OUT[2]), (1.15, _OY_IN[2]), (1.3, [("L", 33), ("F", 32)]),
                           (1.85, [("L", 31), ("F", 32)]), (2.4, [])],
        **_neck([(0, 0, 0), (0.6, 0, 1), (1.15, 0, 7), (1.85, 0, 6), (2.4, 0, 0)]),
    },
    "life": True,
    "fingers": {"L": [(0, 0), (0.2, 0.3), (0.6, 0.8), (1.15, 0.85), (1.85, 0.82), (2.4, 0)]},
}

# Hmz rejected all three OverToYou rounds (the sweep: "the arm movement is
# very unnatural"), so none ships.
V98 = (ONE_MOMENT, POINT_NEAR, PATIENT_TILT, BACK_TO_BOARD)
V98_NOT_SHIPPED = (OVER_TO_YOU_R2, OVER_TO_YOU)


def build_v98(teachers=("Jake", "MJ"), names=None):
    """Key, drive helpers and relax fingers for the V9.8 clips (or `names`)."""
    out = []
    for t in teachers:
        for spec in V98:
            if names and spec["name"] not in names:
                continue
            act, s, e = build(t, spec)
            out.append((act.name, s, e, finish(t, act.name, relax=0 if spec.get("life") else 0.35)))
    return out


# ─── Pointing's hand (V9.8) ──────────────────────────────────────────────────
# The shipped Pointing clip (Mixamo) extends the right index but leaves the
# middle finger half out and the others loose and splayed: a claw at the
# classroom camera (Hmz, V9.8). V9.2b kept the index out of the finger relax
# and did nothing else to the hand. This folds the three fingers a point does
# not use, and the thumb, to PointNear's shape while the hand is up.
# The index itself was bent back about 9 deg at the knuckle and splayed 12
# deg towards the thumb (Hmz, second look: "the angle of the pointing finger
# looks unnatural"), so `index` sets it to a small forward bend in line with
# the hand. That moves the aim a little; check it with `panel_hit`.

def tuck_point(teacher, action_name, side="R", curl=-0.9, thumb=-0.6, full_at=0.75, index=(8, 4, 2), splay=0):
    """
    Blend the `side` hand's Mid, Ring, Pinky and Thumb keys of `action_name`
    towards a tuck (`_curl` of the Idle hand, as PointNear's `digits`), and
    with `index` (degrees of forward bend per joint, knuckle to tip; None
    leaves it) the index towards that bend, with `splay` degrees of lean
    towards the thumb at the knuckle (the clip had 12.5; 4 moved the aim off
    the panel, so the default is none). The blend
    follows the hand's height: 0 at its lowest in the clip, full once it is
    `full_at` of the way to its highest, smoothstepped. Rewrites the keys in
    place; returns (frames, bones touched).
    """
    arm = bpy.data.objects[TEACHERS[teacher][0]]
    _P, B_idle = idle_pose(arm, f"{teacher}_Idle", 1)
    act = bpy.data.actions[action_name]
    s, e = (int(round(v)) for v in act.frame_range)
    reset_pose(arm)
    _use_action(arm, act)
    hand = rt.resolve(arm, f"CC_Base_{side}_Hand")
    digits = ("Mid", "Ring", "Pinky", "Thumb") + (("Index",) if index else ())
    names = [b.name for b in arm.data.bones
             if (m := FINGER_JOINT_RE.match(b.name)) and m.group(1) == side and m.group(2) in digits]
    zs, cur = [], []
    for f in range(s, e + 1):
        bpy.context.scene.frame_set(f)
        zs.append((arm.matrix_world @ arm.pose.bones[hand].head).z)
        cur.append({n: arm.pose.bones[n].rotation_quaternion.copy() for n in names})
    lo, hi = min(zs), max(zs)
    for i, f in enumerate(range(s, e + 1)):
        x = max(0.0, min(1.0, (zs[i] - lo) / max(1e-6, (hi - lo) * full_at)))
        w = x * x * (3 - 2 * x)
        for n in names:
            m = FINGER_JOINT_RE.match(n)
            is_thumb = m.group(2) == "Thumb"
            if m.group(2) == "Index":
                z = -1.0 if side == "L" else 1.0
                j = int(m.group(3))
                target = Quaternion(Vector((0, 0, z)), math.radians(index[j - 1]))
                if j == 1 and splay:
                    target = Quaternion(Vector((1, 0, 0)), math.radians(splay)) @ target
            else:
                target = _curl(B_idle[n], thumb if is_thumb else curl, side, int(m.group(3)), is_thumb)
            q = cur[i][n].slerp(target, w) if cur[i][n].dot(target) >= 0 else (-cur[i][n]).slerp(target, w)
            pb = arm.pose.bones[n]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=f)
    return e - s + 1, len(names)
