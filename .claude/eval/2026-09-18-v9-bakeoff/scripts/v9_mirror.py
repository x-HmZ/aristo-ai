"""
Mirror a Mixamo source action left-for-right (V9.2, Tier 1 variants).

The mirror is made on the *source* rig (`MarcusArma`), so the result is just
another source action. `v9_retarget.bake_clips` then bakes it onto both
teachers, and every check (pokes, `clear_hands`, strips) applies unchanged.

A bone's local axes on the left and right are not reflections of each other
in any convention you can rely on, so mirroring local rotations (negating
quaternion components) is fragile. What is reliable is the rotation *delta*
each bone moves through relative to its own rest, in armature space, the
same quantity the retarget copies:

    delta_B   = R_B_pose · R_B_rest⁻¹                    (armature space)
    delta_B'  = X · delta_B · X                          (X reflects x)
    R_B'_pose = delta_B' · R_B'_rest

Here B' is B's partner (Left <-> Right; the spine maps to itself). The rig is
symmetric about x = 0 in armature space: rest joints pair up to 0.9 mm.
The hips' translation is reflected in the same way. The rotation is written
into `matrix_basis` parents first, exactly as `retarget_action` does, so
bone positions follow the chain.
"""

import bpy
from mathutils import Matrix, Vector

X = Matrix.Diagonal((-1.0, 1.0, 1.0))


def partner(name):
    if "Left" in name:
        return name.replace("Left", "Right")
    if "Right" in name:
        return name.replace("Right", "Left")
    return name


def mirror_action(src_name, new_name=None, arm_name="MarcusArma"):
    arm = bpy.data.objects[arm_name]
    scene = bpy.context.scene
    src = bpy.data.actions[src_name]
    new_name = new_name or f"{src_name}M"

    # The depsgraph does not evaluate a hidden rig (see retarget_action).
    hv = arm.hide_viewport
    arm.hide_viewport = False
    arm.hide_set(False)
    ad = arm.animation_data
    old_action = ad.action
    f0 = scene.frame_current

    bones = arm.data.bones
    rest3 = {b.name: b.matrix_local.to_3x3() for b in bones}
    order = sorted((b.name for b in bones), key=lambda n: len(bones[n].parent_recursive))
    start, end = (int(round(v)) for v in src.frame_range)

    try:
        # Pass 1: read the source pose as armature-space deltas.
        ad.action = src
        if hasattr(ad, "action_slot") and src.slots:
            ad.action_slot = src.slots[0]
        frames = []
        for f in range(start, end + 1):
            scene.frame_set(f)
            deltas = {n: arm.pose.bones[n].matrix.to_3x3() @ rest3[n].inverted() for n in order}
            frames.append((deltas, arm.pose.bones["Hips"].head.copy()))

        # Pass 2: write the mirrored pose into a new action.
        old = bpy.data.actions.get(new_name)
        if old is not None:
            bpy.data.actions.remove(old)
        act = bpy.data.actions.new(new_name)
        act.use_fake_user = True
        ad.action = act
        if hasattr(ad, "action_slot") and act.slots:
            ad.action_slot = act.slots[0]

        hip_rest = bones["Hips"].head_local
        for i, (deltas, hip_head) in enumerate(frames):
            f = start + i
            want = {n: X @ deltas[partner(n)] @ X @ rest3[n] for n in order}
            for n in order:
                pb = arm.pose.bones[n]
                bone = bones[n]
                if bone.parent is None:
                    parent_delta = Matrix.Identity(3)
                else:
                    p = bone.parent.name
                    parent_delta = want[p] @ rest3[p].inverted()
                basis3 = rest3[n].inverted() @ parent_delta.inverted() @ want[n]
                pb.rotation_mode = "QUATERNION"
                pb.rotation_quaternion = basis3.to_quaternion()
                pb.scale = (1.0, 1.0, 1.0)
                if bone.parent is None:
                    pb.location = rest3[n].inverted() @ (X @ hip_head - hip_rest)
                else:
                    pb.location = (0.0, 0.0, 0.0)
                pb.keyframe_insert("rotation_quaternion", frame=f)
                pb.keyframe_insert("location", frame=f)
        return act, start, end
    finally:
        ad.action = old_action
        arm.hide_viewport = hv
        scene.frame_set(f0)


def check_mirror(src_name, mir_name, arm_name="MarcusArma", step=4):
    """
    Largest distance (m) between every joint of the mirror and the reflection
    of its partner in the source, over the clip. Expect about 1 mm, the rig's
    own rest asymmetry.
    """
    arm = bpy.data.objects[arm_name]
    scene = bpy.context.scene
    ad = arm.animation_data
    old_action, f0, hv = ad.action, scene.frame_current, arm.hide_viewport
    arm.hide_viewport = False
    names = [b.name for b in arm.data.bones]
    src, mir = bpy.data.actions[src_name], bpy.data.actions[mir_name]
    start, end = (int(round(v)) for v in src.frame_range)
    worst = (0.0, None, None)
    try:
        for f in range(start, end + 1, step):
            ad.action = src
            scene.frame_set(f)
            a = {n: X @ arm.pose.bones[n].tail.copy() for n in names}
            ad.action = mir
            scene.frame_set(f)
            for n in names:
                d = (arm.pose.bones[partner(n)].tail - a[n]).length
                if d > worst[0]:
                    worst = (d, n, f)
    finally:
        ad.action = old_action
        arm.hide_viewport = hv
        scene.frame_set(f0)
    return worst
