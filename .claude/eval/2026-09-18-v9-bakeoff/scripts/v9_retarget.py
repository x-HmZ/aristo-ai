"""
Bake the app's Mixamo clips onto a Character Creator 4 skeleton.

The app ships one animation pack, `public/models/animations_Avaturn.glb`, on a
54-bone Mixamo skeleton with unprefixed names (Hips, LeftArm, ...). The Canino
teachers are CC4 rigs: 101 bones named `CC_Base_*`, a different rest pose, and
a pile of twist and share bones Mixamo has no opinion about.

An earlier attempt copied world-space bone *directions* from the Mixamo rig
onto the CC4 rig and crumpled the mesh to about 40% height. That is the
expected result: it throws away the target's own rest pose, so every bone is
forced to point the way a differently proportioned skeleton points, and bone
lengths fight the chain.

What works instead is copying the rotation *delta* each bone has moved through
relative to its own rest pose, and replaying that delta on top of the target's
rest pose:

    delta          = R_src_pose · R_src_rest⁻¹              (in world space)
    R_tgt_pose     = delta · R_tgt_rest

Both rigs then keep their own proportions, and only the motion crosses over.

The delta is measured from the *source's* rest pose, so it must be replayed on
a target standing in that same pose. Mixamo rests in a T-pose; CC4 rests in an
A-pose with the arms 30 deg down. The first bake skipped this, and every
arms-down clip rotated the arms a further 30 deg past vertical, through the
back (V9.1c audit). `rest_alignment` swings each limb bone of the target onto
the source's rest direction first, so R_tgt_rest above is really
swing · R_tgt_rest. Spine, neck and head are left alone: the angle between
their joints is anatomy, not pose. Writing it into `matrix_basis` as a pure rotation, parents before
children, means bone positions follow the chain instead of being forced, so
nothing stretches.

Two things that would otherwise go wrong:

- Twist bones (`*Twist01/02`, `*ShareBone`) are deliberately left out of the
  map. They have no Mixamo counterpart, and driving them from the parent's
  delta double-counts the parent's rotation -- forearms corkscrew.
- Root translation is scaled by the height ratio between the rigs. The CC4
  characters are 2.5 m tall in this scene and Mixamo's is human-sized, so an
  unscaled hip translation moves them a fraction of the distance they should.
"""

import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

# CC4 -> Mixamo. Fingers and the spine chain are spelled out because CC4's
# abbreviations (Mid, Pinky) do not match Mixamo's (Middle, Pinky) uniformly.
BONE_MAP = {
    "CC_Base_Hip": "Hips",
    "CC_Base_Waist": "Spine",
    "CC_Base_Spine01": "Spine1",
    "CC_Base_Spine02": "Spine2",
    "CC_Base_NeckTwist01": "Neck",
    "CC_Base_Head": "Head",
}
for cc, mx in (("L", "Left"), ("R", "Right")):
    BONE_MAP.update({
        f"CC_Base_{cc}_Clavicle": f"{mx}Shoulder",
        f"CC_Base_{cc}_Upperarm": f"{mx}Arm",
        f"CC_Base_{cc}_Forearm": f"{mx}ForeArm",
        f"CC_Base_{cc}_Hand": f"{mx}Hand",
        f"CC_Base_{cc}_Thigh": f"{mx}UpLeg",
        f"CC_Base_{cc}_Calf": f"{mx}Leg",
        f"CC_Base_{cc}_Foot": f"{mx}Foot",
        f"CC_Base_{cc}_ToeBase": f"{mx}ToeBase",
    })
    for cc_f, mx_f in (("Index", "Index"), ("Mid", "Middle"),
                       ("Ring", "Ring"), ("Pinky", "Pinky"), ("Thumb", "Thumb")):
        for i in (1, 2, 3):
            BONE_MAP[f"CC_Base_{cc}_{cc_f}{i}"] = f"{mx}Hand{mx_f}{i}"

ROOT_CC = "CC_Base_Hip"

# Which mapped bone each limb bone points at, for aligning the two rest poses.
# Leaves (finger tips, toes) are absent and inherit their parent's swing. The
# hip, spine, neck and head are left out on purpose: both rigs stand upright,
# and the angle between their joint positions is anatomy (CC4 puts the waist
# joint behind the hip, 23 deg off Mixamo's), not pose -- aligning it tilts
# the pelvis.
AIM = {}
for cc in ("L", "R"):
    AIM.update({
        f"CC_Base_{cc}_Clavicle": f"CC_Base_{cc}_Upperarm",
        f"CC_Base_{cc}_Upperarm": f"CC_Base_{cc}_Forearm",
        f"CC_Base_{cc}_Forearm": f"CC_Base_{cc}_Hand",
        f"CC_Base_{cc}_Hand": f"CC_Base_{cc}_Mid1",
        f"CC_Base_{cc}_Thigh": f"CC_Base_{cc}_Calf",
        f"CC_Base_{cc}_Calf": f"CC_Base_{cc}_Foot",
        f"CC_Base_{cc}_Foot": f"CC_Base_{cc}_ToeBase",
    })
    for f in ("Index", "Mid", "Ring", "Pinky", "Thumb"):
        AIM[f"CC_Base_{cc}_{f}1"] = f"CC_Base_{cc}_{f}2"
        AIM[f"CC_Base_{cc}_{f}2"] = f"CC_Base_{cc}_{f}3"


# Both rigs rest flat-footed, but Mixamo's foot bone aims 28 deg down to the
# ball of the foot and CC4's 11-14 deg: that pitch is anatomy (ankle height
# against foot length), like the pelvis tilt above. Matching it pitched both
# teachers' feet ~15 deg toe-down in every clip (V9.1d), so feet only take the
# yaw part of the swing -- the toe-out angle.
YAW_ONLY = {"CC_Base_L_Foot", "CC_Base_R_Foot"}


def resolve(arm, logical):
    """
    CC4 bone names survive the Sketchfab GLB conversion with a numeric suffix
    (`CC_Base_Hip_02`), so a map written in plain CC4 names has to be resolved
    against whichever rig is in hand.
    """
    bones = arm.data.bones
    if logical in bones:
        return logical
    hits = [b.name for b in bones
            if b.name.startswith(logical + "_") and b.name[len(logical) + 1:].isdigit()]
    return hits[0] if len(hits) == 1 else None


def build_pairs(tgt_arm, src_arm):
    pairs, missing = [], []
    for cc, mx in BONE_MAP.items():
        t = resolve(tgt_arm, cc)
        if t and mx in src_arm.data.bones:
            pairs.append((t, mx))
        else:
            missing.append(cc if not t else mx)
    return pairs, missing


def _rest3(arm, name):
    return (arm.matrix_world @ arm.data.bones[name].matrix_local).to_3x3()


def _head(arm, name):
    return arm.matrix_world @ arm.data.bones[name].head_local


def _yaw(arm, left, right):
    v = _head(arm, left) - _head(arm, right)
    return math.atan2(v.y, v.x)


def facing_map(tgt_arm, src_arm):
    """
    World rotation (about Z) that turns the source's facing into the target's.

    Deltas are measured in world space, so they only transfer unchanged when
    both rigs face the same way. V9.1c baked every shipped clip with the
    teachers turned to the app's facing (rotZ 0.3) and the source facing
    front, which rotated every delta 17 deg about the vertical: arm and hand
    directions came out 13-20 deg off the source, the hand up to 11 cm (V9.1d).
    Conjugating by this map makes the bake independent of placement.
    """
    ty = _yaw(tgt_arm, resolve(tgt_arm, "CC_Base_L_Thigh"), resolve(tgt_arm, "CC_Base_R_Thigh"))
    sy = _yaw(src_arm, "LeftUpLeg", "RightUpLeg")
    return Matrix.Rotation(ty - sy, 3, "Z")


def rest_alignment(tgt_arm, src_arm):
    """
    Per target bone, the world-space swing that turns the target's rest pose
    into the source's: each bone is rotated so it points where the matching
    source bone points at rest.

    The delta below is measured from the source's rest pose, so it is only
    meaningful on a target standing in that same pose. Mixamo rests in a
    T-pose (upper arm 0.3 deg below horizontal); CC4 rests in an A-pose (30 deg
    down and forward). Replaying the T-pose-relative "arms down" delta on an
    A-pose overshoots by those 30 deg and puts both arms through the back,
    which is what the first bake did in every clip.
    """
    swing = {}
    C = facing_map(tgt_arm, src_arm)
    for cc in BONE_MAP:  # dict order is parents-first, so a leaf's parent is set
        t = resolve(tgt_arm, cc)
        if not t:
            continue
        aim = AIM.get(cc)
        ta = resolve(tgt_arm, aim) if aim else None
        s, sa = BONE_MAP[cc], BONE_MAP.get(aim) if aim else None
        if ta and sa in src_arm.data.bones:
            dt = _head(tgt_arm, ta) - _head(tgt_arm, t)
            ds = C @ (_head(src_arm, sa) - _head(src_arm, s))
            if cc in YAW_ONLY:
                dt.z = ds.z = 0.0
            swing[t] = dt.rotation_difference(ds).to_matrix()
        else:
            parent = tgt_arm.data.bones[t].parent
            while parent is not None and parent.name not in swing:
                parent = parent.parent
            swing[t] = swing[parent.name].copy() if parent else Matrix.Identity(3)
    return swing


# Helper bones Mixamo has no opinion about, driven after the bake (V9.1d).
# CC4 skins the elbow and knee creases to a share bone that is meant to sit
# halfway between the two limb bones; left at identity it follows the lower
# bone fully, the inner crease collapses and a hard step shows in MJ's bare
# elbow. The forearm twist bones are meant to carry part of the hand's roll
# so the forearm skin twists gradually instead of all at the wrist.
#   share: (helper, upper limb, lower limb, blend towards lower)
#   twist: (helper, twisting child, its parent, cumulative share of the roll)
SHARE = [("{s}_ElbowShareBone", "{s}_Upperarm", "{s}_Forearm", 0.5),
         ("{s}_KneeShareBone", "{s}_Thigh", "{s}_Calf", 0.5)]
TWIST = [("{s}_ForearmTwist01", "{s}_Hand", "{s}_Forearm", 0.25),
         ("{s}_ForearmTwist02", "{s}_Hand", "{s}_Forearm", 0.60)]


def _twist_angle(q, axis):
    """Signed angle of the twist part of `q` about unit `axis` (swing-twist)."""
    v = Vector((q.x, q.y, q.z))
    return 2.0 * math.atan2(v.dot(axis), q.w)


def drive_helpers(tgt_arm, action, start, end, twist=True, share=True):
    """
    Key the share and twist helpers on an already baked action, frame by frame.

    Twist bones get a *fraction* of the hand's roll about the forearm axis,
    never a copy of the parent's delta -- copying double-counts and
    corkscrews the forearm, which is why they were first left unmapped. The
    hand's own rotation is untouched: its parent is the forearm, not a twist
    bone. Each helper's basis is solved from its actual parent's pose, which
    on MJ's glTF rig is a `_scaleCompensation` bone, not the limb bone.
    """
    scene = bpy.context.scene
    ad = tgt_arm.animation_data
    ad.action = action
    if hasattr(ad, "action_slot") and action.slots:
        ad.action_slot = action.slots[0]
    bones = tgt_arm.data.bones
    pbs = tgt_arm.pose.bones

    def name(pattern, side):
        return resolve(tgt_arm, "CC_Base_" + pattern.format(s=side))

    jobs = []
    for side in ("L", "R"):
        if share:
            for h, a, b, t in SHARE:
                n = [name(x, side) for x in (h, a, b)]
                if all(n):
                    jobs.append(("share", n, t))
        if twist:
            for h, c, p, w in TWIST:
                n = [name(x, side) for x in (h, c, p)]
                if all(n):
                    jobs.append(("twist", n, w))

    for f in range(start, end + 1):
        scene.frame_set(f)
        posed = {}

        def pose_of(bone):
            # A bone between a helper keyed this frame and this one (MJ's
            # `_scaleCompensation`) still holds last frame's pose until the
            # depsgraph runs, so rebuild it from the chain; it has an
            # identity basis.
            if bone.name in posed:
                return posed[bone.name]
            p = bone.parent
            while p is not None and p.name not in posed:
                p = p.parent
            if p is None:
                return pbs[bone.name].matrix
            return pose_of(p) @ p.matrix_local.inverted() @ bone.matrix_local

        for kind, (h, a, b), t in jobs:
            hb, pb = bones[h], pbs[h]
            parent = hb.parent
            p_pose = pose_of(parent)
            rigid = p_pose @ parent.matrix_local.inverted() @ hb.matrix_local
            if kind == "share":
                # Where the helper would be if rigid with the upper bone, and
                # if rigid with the lower one; sit `t` of the way between.
                r_up = (pbs[a].matrix @ bones[a].matrix_local.inverted() @ hb.matrix_local).to_quaternion()
                r_lo = rigid.to_quaternion()
                rot = r_up.slerp(r_lo, t)
                desired = Matrix.Translation(rigid.to_translation()) @ rot.to_matrix().to_4x4()
                basis = rigid.inverted() @ desired
            else:
                # Hand roll relative to the forearm, about the forearm's rest axis.
                dp = pbs[b].matrix.to_3x3() @ bones[b].matrix_local.to_3x3().inverted()
                dc = pbs[a].matrix.to_3x3() @ bones[a].matrix_local.to_3x3().inverted()
                rel = (dp.inverted() @ dc).to_quaternion()
                axis = (bones[a].head_local - bones[b].head_local).normalized()
                tau = _twist_angle(rel, axis)
                # Cumulative share, minus what a twisting parent already carries.
                inherited = next((w for k, (hh, _, _), w in jobs
                                  if k == "twist" and hh != h and
                                  _is_ancestor(bones[hh], hb)), 0.0)
                ang = (t - inherited) * tau
                y = hb.matrix_local.col[1].xyz.normalized()
                sign = 1.0 if y.dot(axis) >= 0 else -1.0
                basis = Matrix.Rotation(sign * ang, 4, "Y")
                desired = rigid @ basis
            posed[h] = desired
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = basis.to_quaternion()
            pb.keyframe_insert("rotation_quaternion", frame=f)
    return len(jobs)


def ground(tgt_arm, action, start, end):
    """
    Keep the lower foot on the floor, frame by frame, by lowering the hips.

    The Avaturn clips pin the hips at rest height while the legs pose, so the
    source's own feet rise 1.2-3.2 cm off the floor (Marcus hides it by
    standing 2 cm into it). On the CC4 legs it came out 1-6 cm (V9.1d). The
    teachers are normalised to stand on z=0 at rest, so the floor is each
    foot's rest height: whichever of heel (Foot) or ball (ToeBase) is closest
    to its rest height sets the drop. Returns the largest drop, in metres.
    """
    scene = bpy.context.scene
    ad = tgt_arm.animation_data
    ad.action = action
    if hasattr(ad, "action_slot") and action.slots:
        ad.action_slot = action.slots[0]
    root = resolve(tgt_arm, ROOT_CC)
    rb, rpb = tgt_arm.data.bones[root], tgt_arm.pose.bones[root]
    joints = [resolve(tgt_arm, f"CC_Base_{s}_{b}") for s in ("L", "R") for b in ("Foot", "ToeBase")]
    mw = tgt_arm.matrix_world
    rest_z = {j: (mw @ tgt_arm.data.bones[j].head_local).z for j in joints}
    to_local = rb.matrix_local.to_3x3().inverted() @ mw.to_3x3().inverted()
    worst = 0.0
    for f in range(start, end + 1):
        scene.frame_set(f)
        lift = min((mw @ tgt_arm.pose.bones[j].head).z - rest_z[j] for j in joints)
        rpb.location = rpb.location + to_local @ Vector((0.0, 0.0, -lift))
        rpb.keyframe_insert("location", frame=f)
        worst = max(worst, abs(lift))
    return worst


TEACHERS = {"Jake": "Armature.002", "MJ": "Object_4.001"}


def bake_clips(clips, src_name="MarcusArma", teachers=TEACHERS, keep_suffix=None):
    """
    Bake `clips` (source action names) onto every teacher as `<Teacher>_<clip>`,
    then drive the helper bones. An existing action of that name is replaced,
    or renamed to `<name><keep_suffix>` first if a suffix is given.
    """
    src = bpy.data.objects[src_name]
    done = []
    for pre, arm_name in teachers.items():
        arm = bpy.data.objects[arm_name]
        pairs, _ = build_pairs(arm, src)
        ratio = height_ratio(arm, src, pairs)
        for clip in clips:
            name = f"{pre}_{clip}"
            old = bpy.data.actions.get(name)
            if old is not None:
                if keep_suffix and not bpy.data.actions.get(name + keep_suffix):
                    old.name = name + keep_suffix
                    old.use_fake_user = True
                else:
                    bpy.data.actions.remove(old)
            act, s, e = retarget_action(arm, src, bpy.data.actions[clip], pairs, ratio, new_name=name)
            drive_helpers(arm, act, s, e)
            drop = ground(arm, act, s, e)
            done.append((name, s, e, round(drop * 1000, 1)))
    return done


def _is_ancestor(a, b):
    p = b.parent
    while p is not None:
        if p == a:
            return True
        p = p.parent
    return False


def height_ratio(tgt_arm, src_arm, pairs):
    """Hips-to-head distance in each rig, for scaling root translation."""
    def span(arm, a, b):
        return ((arm.matrix_world @ arm.data.bones[a].head_local)
                - (arm.matrix_world @ arm.data.bones[b].head_local)).length
    t_hip, t_head = resolve(tgt_arm, ROOT_CC), resolve(tgt_arm, "CC_Base_Head")
    if not (t_hip and t_head):
        return 1.0
    return span(tgt_arm, t_head, t_hip) / max(1e-6, span(src_arm, "Head", "Hips"))


def retarget_action(tgt_arm, src_arm, action, pairs, ratio,
                    new_name=None, root_motion=True):
    """Bake one source action onto the target rig as its own action."""
    scene = bpy.context.scene
    # The depsgraph does not evaluate an object whose viewport visibility is
    # off, so a hidden source rig never leaves its current pose and every
    # frame bakes the same still. v9_export.export() sets hide_viewport from
    # hide_render on every object, which is how the first shipped Talking and
    # Pointing clips (and all of MJ's) came out frozen.
    for o in (src_arm, tgt_arm):
        o.hide_viewport = False
        o.hide_set(False)
    src_arm.animation_data_create()
    src_arm.animation_data.action = action
    if hasattr(src_arm.animation_data, "action_slot") and action.slots:
        src_arm.animation_data.action_slot = action.slots[0]

    start, end = (int(round(v)) for v in action.frame_range)
    tgt_arm.animation_data_create()
    baked = bpy.data.actions.new(new_name or f"{action.name}_CC4")
    baked.use_fake_user = True
    tgt_arm.animation_data.action = baked
    if hasattr(tgt_arm.animation_data, "action_slot") and baked.slots:
        tgt_arm.animation_data.action_slot = baked.slots[0]

    # Deepest-last, so a parent's pose is final before its child reads it.
    order = sorted(pairs, key=lambda p: len(tgt_arm.data.bones[p[0]].parent_recursive))
    # The target's rest, swung into the source's rest pose -- see rest_alignment.
    swing = rest_alignment(tgt_arm, src_arm)
    t_rest = {t: swing.get(t, Matrix.Identity(3)) @ _rest3(tgt_arm, t) for t, _ in pairs}
    s_rest = {s: _rest3(src_arm, s) for _, s in pairs}
    mapped = {t for t, _ in pairs}
    root = resolve(tgt_arm, ROOT_CC)
    root_rest_head = (tgt_arm.matrix_world @ tgt_arm.data.bones[root].head_local) if root else None
    src_root_rest_head = (src_arm.matrix_world @ src_arm.data.bones["Hips"].head_local)

    Mt3_inv = tgt_arm.matrix_world.to_3x3().inverted()
    C = facing_map(tgt_arm, src_arm)
    C_inv = C.inverted()

    probe = src_arm.pose.bones["RightHand"]
    probe_path = []

    for f in range(start, end + 1):
        scene.frame_set(f)
        probe_path.append((src_arm.matrix_world @ probe.head).copy())
        desired = {}
        for t, s in order:
            spb = src_arm.pose.bones[s]
            delta = (src_arm.matrix_world @ spb.matrix).to_3x3() @ s_rest[s].inverted()
            desired[t] = C @ delta @ C_inv @ t_rest[t]

        for t, s in order:
            tpb = tgt_arm.pose.bones[t]
            bone = tgt_arm.data.bones[t]
            R_des = Mt3_inv @ desired[t]

            # Nearest ancestor we actually drive. Bones in between (twist,
            # share) keep an identity basis, and an identity-basis bone
            # carries its parent's delta unchanged -- so their rest frames
            # cancel and only the mapped ancestor's delta matters.
            parent = bone.parent
            while parent is not None and parent.name not in mapped:
                parent = parent.parent

            rest3 = bone.matrix_local.to_3x3()
            if parent is None:
                parent_delta = Matrix.Identity(3)
            else:
                parent_delta = ((Mt3_inv @ desired[parent.name])
                                @ parent.matrix_local.to_3x3().inverted())

            # Blender composes pose = parent_pose · parent_rest⁻¹ · rest · basis.
            basis3 = rest3.inverted() @ parent_delta.inverted() @ R_des

            tpb.rotation_mode = "QUATERNION"
            tpb.rotation_quaternion = basis3.to_quaternion()
            tpb.scale = (1.0, 1.0, 1.0)
            if t == root and root_motion:
                src_head = src_arm.matrix_world @ src_arm.pose.bones["Hips"].head
                off = C @ (src_head - src_root_rest_head) * ratio
                # `location` lives in the bone's own rest frame, not armature space.
                tpb.location = rest3.inverted() @ (Mt3_inv @ off)
            else:
                tpb.location = (0.0, 0.0, 0.0)
            tpb.keyframe_insert("rotation_quaternion", frame=f)
            tpb.keyframe_insert("location", frame=f)

    travel = max((p - probe_path[0]).length for p in probe_path)
    if travel < 1e-4:
        raise RuntimeError(f"{action.name}: source hand never moved -- source rig not evaluated")
    return baked, start, end
