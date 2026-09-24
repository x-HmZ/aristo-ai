"""
Render helpers for the V9.1 bake-off scene.

Everything here exists because of two traps already paid for in this
programme:

- `hide_render` on a parent object does NOT propagate to its children in
  Blender. Hiding a candidate by its ROOT empty leaves every mesh under it in
  the frame, which is how a bearded man ended up rendering inside the woman's
  hair. `solo` walks the hierarchy.
- The Canino characters were never normalised: the woman is 2.58 m tall and
  her head is 1.5x life size. Framing by a guessed distance gives a close-up
  of a forehead, so `frame` measures the subject's real bounding box and
  derives the camera distance from the lens.
"""

import math
import os
import numpy as np
import bpy
from mathutils import Vector

# Characters are placed with the app's teacher rotation (Experience.tsx rotY 0.3).
FACING = math.radians(17.2)


def descend(o):
    yield o
    for c in o.children:
        yield from descend(c)


def solo(*root_names, keep=("ROOT_classroom",),
         hide_always=("Icosphere", "Icosphere.001", "Object_41.001")):
    """
    Show only these roots (plus the classroom); hide every other geometry.

    `hide_always` wins over the roots. It carries meshes hidden on purpose
    inside a character -- MJ's panties (`Object_41.001`), which poke through
    the skirt waistband -- because un-hiding the whole hierarchy brings them
    back and they read as a defect in the render that is not in the GLB.
    """
    visible = set()
    for r in tuple(root_names) + tuple(keep):
        ob = bpy.data.objects.get(r)
        if ob:
            visible |= {o.name for o in descend(ob)}
    visible -= set(hide_always)
    geo = ("MESH", "CURVE", "SURFACE", "META", "FONT", "VOLUME", "GPENCIL")
    for o in bpy.data.objects:
        if o.type in geo:
            o.hide_render = o.hide_viewport = o.name not in visible
    return sum(1 for o in bpy.data.objects if o.type == "MESH" and not o.hide_render)


def bbox(root_name, skip=("Icosphere", "Icosphere.001")):
    pts = []
    for o in descend(bpy.data.objects[root_name]):
        if o.type == "MESH" and o.name not in skip:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    P = np.array(pts)
    return P.min(0), P.max(0)


def cam(name="V9Cam", lens=50.0):
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, bpy.data.cameras.new(name))
        bpy.context.scene.collection.objects.link(ob)
    ob.data.lens = lens
    ob.data.clip_start = 0.01
    bpy.context.scene.camera = ob
    return ob


def frame(aim, height, lens=50.0, sensor=36.0, name="V9Cam", facing=FACING):
    """Put the camera in front of `aim`, far enough to cover `height` metres."""
    ob = cam(name, lens)
    fwd = Vector((math.sin(facing), -math.cos(facing), 0.0))
    ob.location = Vector(aim) + fwd * (height * lens / sensor)
    ob.rotation_euler = (Vector(aim) - ob.location).normalized().to_track_quat("-Z", "Y").to_euler()
    return ob


def head_aim(armature_name, drop=0.055):
    """Aim point for a face shot: the head bone, nudged down to centre the mouth."""
    arm = bpy.data.objects[armature_name]
    hb = next(b for b in arm.data.bones if b.name.split("_")[-1].isdigit() is False
              and b.name == "CC_Base_Head") if "CC_Base_Head" in arm.data.bones else \
        next(b for b in arm.data.bones if b.name.startswith("CC_Base_Head"))
    return (arm.matrix_world @ hb.head_local) + Vector((0, 0, 0.12 - drop))


def face_meshes(*root_names):
    out = []
    for r in root_names:
        for o in descend(bpy.data.objects[r]):
            if o.type == "MESH" and o.data.shape_keys:
                out.append(o)
    return out


def set_face(meshes, **vals):
    for o in meshes:
        for kb in o.data.shape_keys.key_blocks[1:]:
            kb.value = 0.0
        for k, v in vals.items():
            kb = o.data.shape_keys.key_blocks.get(k)
            if kb:
                kb.value = v


def _grab(path):
    im = bpy.data.images.load(path, check_existing=False)
    w, h = im.size
    a = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)[::-1]


def shoot(out_path, res=(620, 620)):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    return out_path


def contact_sheet(meshes, states, out_path, cols=5, res=(620, 620), tmp=None):
    """Render one frame per (label, {shapekey: value}) and tile them."""
    tmp = tmp or os.path.join(os.path.dirname(out_path), "_tmp_shot.png")
    arrs = []
    for _label, vals in states:
        set_face(meshes, **vals)
        bpy.context.view_layer.update()
        shoot(tmp, res)
        arrs.append(_grab(tmp))
    if os.path.exists(tmp):
        os.remove(tmp)
    set_face(meshes)
    h, w, _ = arrs[0].shape
    rows = (len(arrs) + cols - 1) // cols
    sheet = np.zeros((h * rows, w * cols, 4), dtype=np.float32)
    sheet[..., 3] = 1.0
    for i, a in enumerate(arrs):
        r, c = divmod(i, cols)
        sheet[r * h:(r + 1) * h, c * w:(c + 1) * w] = a
    img = bpy.data.images.new("v9_sheet", w * cols, h * rows, alpha=True)
    img.pixels.foreach_set(sheet[::-1].ravel())
    img.filepath_raw = out_path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return out_path


VISEMES = ["viseme_sil", "viseme_PP", "viseme_FF", "viseme_TH", "viseme_DD",
           "viseme_kk", "viseme_CH", "viseme_SS", "viseme_nn", "viseme_RR",
           "viseme_aa", "viseme_E", "viseme_I", "viseme_O", "viseme_U"]


def viseme_states():
    return [(v.replace("viseme_", ""), {v: 1.0}) for v in VISEMES]
