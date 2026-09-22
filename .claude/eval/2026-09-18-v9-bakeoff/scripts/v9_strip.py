"""
Frame strips for motion QA: the source rig and each teacher, same clip, same
frames, side by side.

A single sampled frame hides anything that lives for a few frames (a wrist
wrap at the peak of a gesture, a foot dipping at the loop point), so every
check in V9.1d looks at every Nth frame of the whole clip instead.

The scene is kept in export state (teachers at the origin, normalised), so
`place()` parents a teacher's root under an empty carrying the app's teacher
transform from `Experience.tsx` -- position (-1, -1.7, -3), scale 1.5,
rotY 0.3, i.e. Blender (-1, 3, -1.7), rotZ 0.3 -- and `unplace()` puts it back.
Marcus (`ROOT_marcus`) already stands there and plays the Mixamo source.
"""

import math
import os
import numpy as np
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

import v9_render as R

APP_LOC = Vector((-1.0, 3.0, -1.7))
APP_ROT_Z = 0.3
APP_SCALE = 1.5

SUBJECTS = {
    # label: (root, armature, clip-name -> action-name)
    "Marcus (source)": ("ROOT_marcus", "Armature", lambda c: c),
    "Jake": ("ROOT_canino_man", "Armature.002", lambda c: f"Jake_{c}"),
    "MJ": ("ROOT_canino_girl_GLB", "Object_4.001", lambda c: f"MJ_{c}"),
}
# Object_39.001 is MJ's old extended skirt, retired in V9.1e for MJ_skirt.
HIDE = ("Icosphere", "Icosphere.001", "Object_41.001", "Object_11.001", "Object_39.001")


MIXAMO = {"L_Hand": "LeftHand", "R_Hand": "RightHand", "L_Foot": "LeftFoot",
          "R_Foot": "RightFoot", "L_Forearm": "LeftForeArm", "R_Forearm": "RightForeArm",
          "L_Upperarm": "LeftArm", "R_Upperarm": "RightArm", "Hip": "Hips", "Head": "Head"}


def resolve_bone(arm, logical):
    """`L_Hand` -> `CC_Base_L_Hand` (or its `_NN` suffixed twin) or `LeftHand`."""
    if logical in MIXAMO and MIXAMO[logical] in arm.pose.bones:
        return MIXAMO[logical]
    name = f"CC_Base_{logical}"
    if name in arm.pose.bones:
        return name
    hits = [b.name for b in arm.pose.bones
            if b.name.startswith(name + "_") and b.name[len(name) + 1:].isdigit()]
    return hits[0]


def app_empty():
    e = bpy.data.objects.get("APP_Teacher")
    if e is None:
        e = bpy.data.objects.new("APP_Teacher", None)
        bpy.context.scene.collection.objects.link(e)
    e.location = APP_LOC
    e.rotation_euler = (0.0, 0.0, APP_ROT_Z)
    e.scale = (APP_SCALE,) * 3
    return e


def place(root_name):
    root = bpy.data.objects[root_name]
    if root_name == "ROOT_marcus":
        return root
    root.parent = app_empty()
    root.matrix_parent_inverse.identity()
    bpy.context.view_layer.update()
    return root


def unplace(root_name):
    root = bpy.data.objects[root_name]
    if root_name == "ROOT_marcus" or root.parent is None:
        return
    m = root.matrix_world.copy()
    root.parent = None
    # Undo the app transform: back to the normalised export pose.
    e = app_empty()
    root.matrix_world = e.matrix_world.inverted() @ m
    bpy.context.view_layer.update()


def play(arm_name, action_name):
    arm = bpy.data.objects[arm_name]
    arm.hide_viewport = False
    arm.animation_data_create()
    ad = arm.animation_data
    for t in ad.nla_tracks:
        t.mute = True
    act = bpy.data.actions[action_name]
    ad.action = act
    if hasattr(ad, "action_slot") and act.slots:
        ad.action_slot = act.slots[0]
    return act


def qa_floor():
    """A plain grey floor at the teacher's feet for the side view."""
    ob = bpy.data.objects.get("QA_Floor")
    if ob is None:
        me = bpy.data.meshes.new("QA_Floor")
        me.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)])
        ob = bpy.data.objects.new("QA_Floor", me)
        bpy.context.scene.collection.objects.link(ob)
        mat = bpy.data.materials.new("QA_Floor")
        mat.use_nodes = True
        bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (0.35, 0.36, 0.38, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.8
        me.materials.append(mat)
    ob.location = APP_LOC
    return ob


def q3_cam(angle_deg=55.0, dist=4.2, aim_z=1.25, lens=50.0, name="Q3Cam"):
    """Three-quarter view from the teacher's left (the Pointing side)."""
    ob = R.cam(name, lens)
    f = Vector((math.sin(APP_ROT_Z), -math.cos(APP_ROT_Z), 0.0))
    left = Vector((math.cos(APP_ROT_Z), math.sin(APP_ROT_Z), 0.0))
    a = math.radians(angle_deg)
    d = (f * math.cos(a) + left * math.sin(a)).normalized()
    aim = APP_LOC + Vector((0, 0, aim_z))
    ob.location = aim + d * dist
    ob.rotation_euler = (aim - ob.location).normalized().to_track_quat("-Z", "Y").to_euler()
    return ob


def close_cam(name, aim, dist, azimuth_deg=0.0, elev_deg=0.0, lens=50.0):
    """
    A camera `dist` metres from `aim` (a world point), `azimuth_deg` round
    from the teacher's facing towards their left, `elev_deg` above level.
    """
    ob = R.cam(name, lens)
    f = Vector((math.sin(APP_ROT_Z), -math.cos(APP_ROT_Z), 0.0))
    left = Vector((math.cos(APP_ROT_Z), math.sin(APP_ROT_Z), 0.0))
    a, e = math.radians(azimuth_deg), math.radians(elev_deg)
    d = (f * math.cos(a) + left * math.sin(a)) * math.cos(e) + Vector((0, 0, math.sin(e)))
    ob.location = Vector(aim) + d.normalized() * dist
    ob.rotation_euler = (Vector(aim) - ob.location).normalized().to_track_quat("-Z", "Y").to_euler()
    return ob


def lesson_border(cam_name="LessonCam", pad=0.02):
    """Render border around the teacher spot in the lesson camera, in 0..1."""
    sc = bpy.context.scene
    cam = bpy.data.objects[cam_name]
    pts = []
    # Wide enough for an arm held out to the side (Talking, Pointing).
    for dx in (-1.1, 1.1):
        for dy in (-0.6, 0.6):
            for z in (0.0, 1.9 * APP_SCALE):
                pts.append(APP_LOC + Vector((dx, dy, z)))
    uv = [world_to_camera_view(sc, cam, p) for p in pts]
    xs = [p.x for p in uv]
    ys = [p.y for p in uv]
    return (max(0, min(xs) - pad), min(1, max(xs) + pad),
            max(0, min(ys) - pad), min(1, max(ys) + pad))


def _setup(cam_name, res, border):
    sc = bpy.context.scene
    sc.camera = bpy.data.objects[cam_name]
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    if border:
        sc.render.use_border = True
        sc.render.use_crop_to_border = True
        (sc.render.border_min_x, sc.render.border_max_x,
         sc.render.border_min_y, sc.render.border_max_y) = border
    else:
        sc.render.use_border = False
        sc.render.use_crop_to_border = False


def strip(clip, frames, cams, out_path, subjects=None, samples=8, tmp=None):
    """
    One sheet: a row per (camera, subject), a column per frame.

    cams: list of (camera name, (res_x, res_y), border or None).
    """
    sc = bpy.context.scene
    subjects = subjects or list(SUBJECTS)
    tmp = tmp or os.path.join(os.path.dirname(out_path), "_strip_tmp.png")
    old_samples = sc.eevee.taa_render_samples
    sc.eevee.taa_render_samples = samples
    rows = []
    try:
        for label in subjects:
            root, arm, act_of = SUBJECTS[label]
            place(root)
            play(arm, act_of(clip))
            for cam_name, res, border, *track in cams:
                # The lesson camera sees the classroom; the side view sees only
                # the teacher on a plain floor, so no desk hides a foot.
                keep = ("ROOT_classroom",) if cam_name == "LessonCam" else (qa_floor().name,)
                R.solo(root, keep=keep, hide_always=HIDE)
                _setup(cam_name, res, border)
                cam = bpy.data.objects[cam_name]
                tiles = []
                for f in frames:
                    sc.frame_set(f)
                    if track:
                        # Follow a bone: keep the camera's offset, re-aim it.
                        bone, offset = track[0]
                        a = bpy.data.objects[arm]
                        p = a.matrix_world @ a.pose.bones[resolve_bone(a, bone)].head
                        cam.location = p + offset
                        cam.rotation_euler = (-offset).normalized().to_track_quat("-Z", "Y").to_euler()
                    R.shoot(tmp, res)
                    tiles.append(R._grab(tmp))
                rows.append(tiles)
            unplace(root)
    finally:
        sc.eevee.taa_render_samples = old_samples
        sc.render.use_border = False
        sc.render.use_crop_to_border = False
        if os.path.exists(tmp):
            os.remove(tmp)
    h = max(t.shape[0] for r in rows for t in r)
    w = max(t.shape[1] for r in rows for t in r)
    sheet = np.zeros((h * len(rows), w * len(frames), 4), dtype=np.float32)
    sheet[..., 3] = 1.0
    for i, r in enumerate(rows):
        for j, t in enumerate(r):
            sheet[i * h:i * h + t.shape[0], j * w:j * w + t.shape[1]] = t
    img = bpy.data.images.new("v9_strip", sheet.shape[1], sheet.shape[0], alpha=True)
    img.pixels.foreach_set(sheet[::-1].ravel())
    img.filepath_raw = out_path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return out_path, sheet.shape
