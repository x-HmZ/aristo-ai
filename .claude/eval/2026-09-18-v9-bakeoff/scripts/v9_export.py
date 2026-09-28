"""
Export one Canino teacher as a GLB the app can load.

Three things have to be true for `Teacher.tsx` to pick the file up unchanged:

- The clips must be named `Idle`, `Talking` and `Pointing`. glTF takes its
  animation names from NLA track names, so each baked action is pushed onto
  its own track under the plain name.
- The morph targets must keep the names the app drives. Blender's exporter
  writes shape-key names into `extras.targetNames`, which three.js reads into
  `morphTargetDictionary` -- so the 18 baked keys survive as-is.
- The character must be the same height as the avatar shipping today, because
  the lesson camera and the `scale={1.5}` placement in `Experience.tsx` are
  tuned to it. Marcus measures 1.859 m with his root scale divided out, so
  both teachers are normalised to that, standing on z=0 and facing front with
  no rotation -- the app applies its own `rotY`.

Decimation is deliberately partial. Blender's Decimate modifier refuses to run
on a mesh with shape keys, and on these characters the entire body (face
included) is one such mesh. Hair, clothing and shoes carry no shape keys and
are two thirds of the triangles, so they take the reduction and the face is
left untouched -- which is where the quality has to survive anyway.

V9.1c: ship with `budget=None`. Collapse-decimate shattered MJ's teeth, broke
her hair cards into floating flakes and faceted her tee; the triangles now come
from deleting skin hidden under clothing instead (v9_mask.py), and the size
pass is v9_postprocess.mjs (run via v9_ship.sh).

Note that `export` leaves `hide_viewport = hide_render` on every object, which
hides the Mixamo source rig; v9_retarget.retarget_action un-hides it itself.
"""

import os
import bpy
import numpy as np
from mathutils import Vector

TARGET_HEIGHT = 1.859  # Marcus, root scale divided out
MARCUS_HIP_XY = (0.0, -0.0141)  # Marcus's Hips joint at rest, same space


def descend(o):
    yield o
    for c in o.children:
        yield from descend(c)


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def has_shapes(o):
    return bool(o.data.shape_keys and len(o.data.shape_keys.key_blocks) > 1)


def drop_empty_shapekeys(objs):
    """
    Decimate refuses any mesh that still owns a shape-key datablock, even one
    holding nothing but Basis -- which is what is left on the body parts no
    viseme happens to move. Clearing those frees them for decimation.
    """
    n = 0
    for o in objs:
        if o.type == "MESH" and o.data.shape_keys and len(o.data.shape_keys.key_blocks) == 1:
            with bpy.context.temp_override(object=o):
                bpy.ops.object.shape_key_remove(all=True)
            n += 1
    return n


def decimate(objs, budget):
    """Collapse-decimate meshes without shape keys down to a triangle budget."""
    drop_empty_shapekeys(objs)
    pool = [o for o in objs if o.type == "MESH" and not o.data.shape_keys]
    before = sum(tris(o) for o in pool)
    if before <= budget or not pool:
        return before, before
    ratio = budget / before
    for o in pool:
        m = o.modifiers.new("v9_decimate", "DECIMATE")
        m.decimate_type = "COLLAPSE"
        m.ratio = ratio
        m.use_collapse_triangulate = True
        with bpy.context.temp_override(object=o):
            bpy.ops.object.modifier_apply(modifier=m.name)
    return before, sum(tris(o) for o in pool)


def stack_nla(arm, clips):
    """One NLA track per clip; the track name becomes the glTF animation name."""
    arm.animation_data_create()
    ad = arm.animation_data
    ad.action = None
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    for name, action_name in clips.items():
        act = bpy.data.actions.get(action_name)
        if not act:
            continue
        track = ad.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, int(act.frame_range[0]), act)
        strip.name = name
    return [t.name for t in ad.nla_tracks]


def normalise(root_name, exclude=()):
    """
    Stand the character on z=0 at the origin, unrotated, at TARGET_HEIGHT.

    Measured in the rest pose. A skinned mesh's bounding box follows the
    current pose, so the V9.1c export measured Jake in whatever frame was
    showing -- toes pitched into the floor -- and his rest soles came out
    30 mm above it, 45 mm in the app (V9.1d).
    """
    root = bpy.data.objects[root_name]
    arms = [o for o in descend(root) if o.type == "ARMATURE"]
    old = [a.data.pose_position for a in arms]
    for a in arms:
        a.data.pose_position = "REST"
    try:
        return _normalise(root, exclude)
    finally:
        for a, p in zip(arms, old):
            a.data.pose_position = p
        bpy.context.view_layer.update()


def _normalise(root, exclude):
    root.rotation_euler = (0, 0, 0)
    root.location = (0, 0, 0)
    root.scale = (1, 1, 1)
    bpy.context.view_layer.update()

    pts = []
    for o in descend(root):
        if o.type == "MESH" and o.name not in exclude and not o.hide_render:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    P = np.array([p[:] for p in pts])
    height = P[:, 2].max() - P[:, 2].min()
    s = TARGET_HEIGHT / height
    root.scale = (s, s, s)
    bpy.context.view_layer.update()

    pts = []
    for o in descend(root):
        if o.type == "MESH" and o.name not in exclude and not o.hide_render:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    P = np.array([p[:] for p in pts])
    # Stand the hip joint where Marcus's stands, not the bounding-box centre:
    # the box moves with the A-pose arms and the hair, which put Jake 8 cm
    # behind Marcus's spot in V9.1c, and the lesson camera and the Pointing
    # anchor in Experience.tsx were tuned on Marcus.
    arm = next(o for o in descend(root) if o.type == "ARMATURE")
    hip = next(b for b in arm.data.bones if b.name.startswith("CC_Base_Hip"))
    h = arm.matrix_world @ hip.head_local
    root.location = (MARCUS_HIP_XY[0] - h.x, MARCUS_HIP_XY[1] - h.y, -P[:, 2].min())
    bpy.context.view_layer.update()
    return height, s


def export(root_name, out_path, clips, exclude=(), budget=None):
    root = bpy.data.objects[root_name]
    members = [o for o in descend(root) if o.name not in exclude]
    meshes = [o for o in members if o.type == "MESH" and not o.hide_render]
    arm = next(o for o in members if o.type == "ARMATURE")

    before = sum(tris(o) for o in meshes)
    dec_before = dec_after = 0
    if budget:
        dec_before, dec_after = decimate(meshes, budget)
    after = sum(tris(o) for o in meshes)

    src_h, scale = normalise(root_name, exclude)
    tracks = stack_nla(arm, clips)

    # `select_all(DESELECT)` only touches visible objects, so a hidden object
    # left selected by an earlier step rides along into the export -- which is
    # how a material-less icosphere ended up inside the first Jake build.
    for o in bpy.data.objects:
        o.hide_viewport = False
        o.select_set(False)
    for o in bpy.data.objects:
        o.hide_viewport = o.hide_render
    for o in members:
        if o.type in ("MESH", "ARMATURE", "EMPTY") and not o.hide_render:
            o.hide_viewport = False
            o.select_set(True)
    bpy.context.view_layer.objects.active = arm

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animation_mode="NLA_TRACKS",
        export_morph=True,
        export_morph_normal=False,
        export_skins=True,
        export_yup=True,
    )
    return {
        "tris_before": before, "tris_after": after,
        "decimated_from": dec_before, "decimated_to": dec_after,
        "src_height": src_h, "scale": scale, "tracks": tracks,
        "bytes": os.path.getsize(out_path) if os.path.exists(out_path) else 0,
        "meshes": len(meshes),
    }
