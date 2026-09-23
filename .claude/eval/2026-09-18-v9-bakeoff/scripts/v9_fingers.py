"""
Relax the Canino teachers' fingers towards a neutral curl (V9.2b).

The retarget math was already proven exact -- rest alignment puts each palm
within 3.6-5.1 deg of Marcus's, and finger deltas copy the Mixamo source to
0.000 deg (see decisions.md). The bent look Hmz found in the app is not a
retarget bug: it is the same Mixamo rotation values read on the Canino
rigs' shorter, thicker finger segments, which curl into a visually tighter
fist than the same angle does on Marcus's longer, slender fingers. Confirmed
side by side in three.js (`window.__v92` mixer hook): Marcus's Talking hand
at t=1.5s is open and relaxed; Jake's and MJ's are visibly clawed at the
same clip and time.

Fix: after `bake_clips`, slerp every finger bone's baked
`rotation_quaternion` keyframe toward identity (its own rest pose) by a
fixed blend, per clip, per teacher. Not a retarget change -- it runs on the
already-baked `<Teacher>_<clip>` action, so it composes cleanly with
`drive_helpers` and `ground`, which read pose state independently.

Applied at 35% (gentle: visibly loosens the clenched frames without going
slack in clips that were already fine -- Idle, Talking3, Pointing read
almost the same before and after). Pointing's right index (the finger doing
the pointing) is always excluded, per the brief.
"""

import re

from mathutils import Quaternion

FINGER_RE = re.compile(r"^CC_Base_[LR]_(Index|Mid|Ring|Pinky|Thumb)\d(_\d+)?$")


def finger_bones(arm):
    return [b.name for b in arm.data.bones if FINGER_RE.match(b.name)]


def _channelbag(arm, action):
    """Blender 5.x actions keep fcurves under layers[0].strips[0], keyed by
    the object's action slot -- there is no more flat `action.fcurves`."""
    strip = action.layers[0].strips[0]
    slot = arm.animation_data.action_slot
    return strip.channelbag(slot)


def relax_fingers(arm, action, amount=0.35, skip=()):
    """
    Slerp each finger bone's rotation_quaternion keyframes toward identity
    (rest) by `amount` (0 = untouched, 1 = fully relaxed). Operates on the
    action's existing keyframes in place. `skip` is bone names to leave
    alone, e.g. Pointing's index chain.

    Returns (bones touched, bones found) for a quick sanity check.
    """
    cb = _channelbag(arm, action)
    bones = [b for b in finger_bones(arm) if b not in skip]
    touched = 0
    for b in bones:
        path = f'pose.bones["{b}"].rotation_quaternion'
        fcs = [cb.fcurves.find(path, index=i) for i in range(4)]
        if not all(fcs):
            continue
        frames = sorted({kp.co.x for kp in fcs[0].keyframe_points})
        for f in frames:
            vals = [fc.evaluate(f) for fc in fcs]
            q = Quaternion(vals).normalized()
            q_relaxed = Quaternion((1, 0, 0, 0)).slerp(q, 1 - amount)
            for i in range(4):
                for kp in fcs[i].keyframe_points:
                    if abs(kp.co.x - f) < 1e-6:
                        kp.co.y = q_relaxed[i]
                        kp.handle_left.y = q_relaxed[i]
                        kp.handle_right.y = q_relaxed[i]
        for fc in fcs:
            fc.update()
        touched += 1
    return touched, len(bones)


# All 17 shipped clips, by the Blender action name each one is baked under
# (see v9_retarget.bake_clips and V9-REPORT "V9.2": Thinking/ThinkingM ship
# from the Thinking2/Thinking2M source, not actions literally named
# "Thinking"/"ThinkingM").
CLIP_ACTIONS = [
    "Idle", "Idle2", "Idle3", "Idle4",
    "Talking", "Talking2", "Talking2M", "Talking3", "Talking3M", "Talking4",
    "Talking6", "Talking6M",
    "Thinking2", "Thinking2M",
    "Pointing", "Nodding", "ShakeNo",
]

TEACHERS = {"Jake": "Armature.002", "MJ": "Object_4.001"}


def relax_all(bpy, amount=0.35, teachers=TEACHERS, clips=CLIP_ACTIONS):
    """Apply relax_fingers to every shipped clip for every teacher, in
    place, skipping the right index chain on Pointing. Returns a
    {action_name: "touched/total"} report."""

    def resolve(arm, logical):
        bones = arm.data.bones
        if logical in bones:
            return logical
        hits = [
            b.name for b in bones
            if b.name.startswith(logical + "_") and b.name[len(logical) + 1:].isdigit()
        ]
        return hits[0] if len(hits) == 1 else None

    results = {}
    for pre, arm_name in teachers.items():
        arm = bpy.data.objects[arm_name]
        r_index = {
            resolve(arm, "CC_Base_R_Index1"),
            resolve(arm, "CC_Base_R_Index2"),
            resolve(arm, "CC_Base_R_Index3"),
        }
        for clip in clips:
            name = f"{pre}_{clip}"
            act = bpy.data.actions.get(name)
            if act is None:
                results[name] = "MISSING"
                continue
            skip = r_index if clip == "Pointing" else set()
            n, total = relax_fingers(arm, act, amount=amount, skip=skip)
            results[name] = f"{n}/{total}"
    return results
