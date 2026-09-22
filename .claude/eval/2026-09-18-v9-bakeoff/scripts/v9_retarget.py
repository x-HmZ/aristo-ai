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
    for cc in BONE_MAP:  # dict order is parents-first, so a leaf's parent is set
        t = resolve(tgt_arm, cc)
        if not t:
            continue
        aim = AIM.get(cc)
        ta = resolve(tgt_arm, aim) if aim else None
        s, sa = BONE_MAP[cc], BONE_MAP.get(aim) if aim else None
        if ta and sa in src_arm.data.bones:
            dt = _head(tgt_arm, ta) - _head(tgt_arm, t)
            ds = _head(src_arm, sa) - _head(src_arm, s)
            swing[t] = dt.rotation_difference(ds).to_matrix()
        else:
            parent = tgt_arm.data.bones[t].parent
            while parent is not None and parent.name not in swing:
                parent = parent.parent
            swing[t] = swing[parent.name].copy() if parent else Matrix.Identity(3)
    return swing


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

    probe = src_arm.pose.bones["RightHand"]
    probe_path = []

    for f in range(start, end + 1):
        scene.frame_set(f)
        probe_path.append((src_arm.matrix_world @ probe.head).copy())
        desired = {}
        for t, s in order:
            spb = src_arm.pose.bones[s]
            delta = (src_arm.matrix_world @ spb.matrix).to_3x3() @ s_rest[s].inverted()
            desired[t] = delta @ t_rest[t]

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
                off = (src_head - src_root_rest_head) * ratio
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
