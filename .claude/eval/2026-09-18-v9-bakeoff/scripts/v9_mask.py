"""
Delete body skin that clothing hides, on the Canino teachers.

Two problems, one fix:

- Skin pokes through garments in motion. Jake's right shoulder shows through
  his shirt in every clip, and MJ's torso through her extended tee: skin and
  cloth are skinned to the same bones with slightly different weights, so a
  few millimetres of offset is not enough once an arm lifts.
- The triangle budget. Everything under the shirt, the trousers and the shoes
  is drawn and never seen. Removing it costs nothing visible, unlike the
  collapse-decimate of the first export, which shattered MJ's teeth and hair.

A body vertex counts as covered when a ray from it along its own normal hits a
garment within `max_dist`. A face goes only if all its vertices are covered,
and `keep_rings` rings of faces are then added back around every kept region,
so cuffs, collars and hems keep a margin of skin under their edge.

Run with the rig in its rest pose (`pose_position = "REST"`), where mesh data
coordinates are the positions the armature modifier binds to. bmesh carries
shape-key layers through the delete, so this is safe on Jake's body mesh, which
holds the face rig.
"""

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def _garment_bvh(objs):
    verts, faces = [], []
    for o in objs:
        base = len(verts)
        verts += [o.matrix_world @ v.co for v in o.data.vertices]
        for p in o.data.polygons:
            vs = [base + i for i in p.vertices]
            for k in range(1, len(vs) - 1):
                faces.append((vs[0], vs[k], vs[k + 1]))
    return BVHTree.FromPolygons(verts, faces)


def mask_under(body, garments, max_dist, keep_rings=2, only_materials=None,
               poke_dist=0.0):
    """
    Delete the faces of `body` hidden under `garments`. Returns (before, after)
    triangle counts. `only_materials` limits deletion to faces using those
    material names (e.g. never touch the head material).

    `poke_dist` also catches skin that already sits *outside* the garment at
    rest -- the outward ray from it never meets cloth, so it survives the main
    test and shows as a patch through the fabric (MJ's upper chest through her
    tee). A garment within `poke_dist` behind the skin marks it covered.
    """
    body = bpy.data.objects[body] if isinstance(body, str) else body
    garments = [bpy.data.objects[g] if isinstance(g, str) else g for g in garments]
    bvh = _garment_bvh(garments)
    mw = body.matrix_world
    nm = mw.to_3x3().inverted().transposed()

    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    before = sum(len(f.verts) - 2 for f in bm.faces)

    covered = set()
    for v in bm.verts:
        p = mw @ v.co
        n = (nm @ v.normal).normalized()
        hit, _, _, _ = bvh.ray_cast(p + n * 1e-4, n, max_dist)
        if hit is None and poke_dist > 0:
            hit, _, _, _ = bvh.ray_cast(p - n * 1e-4, -n, poke_dist)
        if hit is not None:
            covered.add(v.index)

    allowed = None
    if only_materials is not None:
        names = [m.name if m else "" for m in body.data.materials]
        allowed = {i for i, n in enumerate(names) if n in only_materials}

    doomed = {f for f in bm.faces
              if all(v.index in covered for v in f.verts)
              and (allowed is None or f.material_index in allowed)}
    for _ in range(keep_rings):
        kept_verts = {v for f in bm.faces if f not in doomed for v in f.verts}
        doomed = {f for f in doomed if not any(v in kept_verts for v in f.verts)}

    bmesh.ops.delete(bm, geom=list(doomed), context="FACES_ONLY")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    after = sum(len(f.verts) - 2 for f in bm.faces)
    bm.to_mesh(body.data)
    bm.free()
    body.data.update()
    return before, after
