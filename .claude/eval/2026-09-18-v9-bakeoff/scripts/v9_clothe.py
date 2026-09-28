"""
Lengthen the Canino woman's garments so she can stand in front of a class.

She ships in a cropped tee (hem at the ribs) and a micro skirt, with ~20 cm of
bare midriff between them. Rather than fit a donor garment -- which means
shrinkwrap, weight transfer and a visible style clash with the man, who is the
other half of the pair -- this extends the meshes she already has. Both are
near-flat colour (a white tee, a navy pleated skirt), so the UV stretch that
would wreck a textured garment is invisible here, and keeping her own clothes
keeps the two teachers looking like one artist made them.

Method, per garment:
  * take the bottom boundary loop only (each mesh also has boundary loops at
    the neck, sleeves and waistband -- extruding those would be a disaster),
  * extrude it downward in rings,
  * for the tee, project each new ring onto the body with a small offset so it
    follows the waist and hips instead of hanging straight down and clipping,
  * for the skirt, continue the A-line outward instead, since a skirt should
    not cling to the legs,
  * re-derive armature weights for the new vertices from the nearest body
    vertex. Extrusion inherits the hem's weights, which would pin the new hem
    to the ribcage and make the shirt tail swing with the chest.

The body is split by material in the Sketchfab GLB, so `body_parts` takes the
several meshes that together cover the region a garment is being grown over.
"""

import bmesh
import numpy as np
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def _world_bvh(objs):
    """One BVH over several meshes, in world space."""
    verts, faces = [], []
    for o in objs:
        me = o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
        base = len(verts)
        verts += [o.matrix_world @ v.co for v in me.vertices]
        for p in me.polygons:
            vs = [base + i for i in p.vertices]
            for k in range(1, len(vs) - 1):
                faces.append((vs[0], vs[k], vs[k + 1]))
        o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
    return BVHTree.FromPolygons(verts, faces)


def _weight_donors(objs):
    """World-space vertex positions plus their weight dicts, for re-weighting."""
    pts, wts = [], []
    for o in objs:
        names = {g.index: g.name for g in o.vertex_groups}
        for v in o.data.vertices:
            pts.append(o.matrix_world @ v.co)
            wts.append({names[g.group]: g.weight for g in v.groups if g.group in names})
    return np.array([p[:] for p in pts]), wts


def extend_garment(garment, body_parts, rings, dz, mode="fit",
                   offset=0.004, flare=0.0, z_select=None, smooth_hem=True,
                   max_edge_dz=None):
    """
    Grow `garment`'s bottom hem downward by `rings` rings of `dz` metres.

    mode="fit"   project each ring onto the body (tops, sleeves)
    mode="flare" continue outward from the garment's own axis (skirts)

    `max_edge_dz` keeps only near-horizontal boundary edges. The pleated skirt
    is 139 disconnected panels, so below the hem threshold there are also the
    panels' near-vertical side edges; extruding those grows spurs off the sides
    and the hem comes out slashed. Smoothing has to be off for the same reason:
    it drags neighbouring panels apart into a fringe.
    """
    ob = bpy.data.objects[garment] if isinstance(garment, str) else garment
    bodies = [bpy.data.objects[b] if isinstance(b, str) else b for b in body_parts]
    me = ob.data
    mw = ob.matrix_world
    mwi = mw.inverted()
    n_before = len(me.vertices)

    P = np.array([(mw @ v.co)[:] for v in me.vertices])
    if z_select is None:
        z_select = P[:, 2].min() + 0.12 * (P[:, 2].max() - P[:, 2].min())
    axis = Vector((P[:, 0].mean(), P[:, 1].mean(), 0.0))

    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    def _pick(e):
        if not e.is_boundary:
            return False
        z1, z2 = [(mw @ v.co).z for v in e.verts]
        if max(z1, z2) >= z_select:
            return False
        return max_edge_dz is None or abs(z1 - z2) < max_edge_dz

    cur = [e for e in bm.edges if _pick(e)]
    if not cur:
        raise RuntimeError(f"{ob.name}: no bottom boundary loop under z={z_select:.3f}")

    bvh = _world_bvh(bodies) if mode == "fit" else None
    for k in range(rings):
        ret = bmesh.ops.extrude_edge_only(bm, edges=cur)
        new_v = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
        cur = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMEdge) and g.is_boundary]
        for v in new_v:
            w = mw @ v.co
            w.z -= dz
            if mode == "fit":
                hit, nor, _, _ = bvh.find_nearest(w)
                if hit is not None:
                    w = hit + nor * offset
            else:
                r = Vector((w.x - axis.x, w.y - axis.y, 0.0))
                if r.length > 1e-6:
                    w += r.normalized() * (flare * (k + 1))
            v.co = mwi @ w
    if smooth_hem:
        bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if v.index >= n_before or v.index < 0],
                              factor=0.35, use_axis_x=True, use_axis_y=True, use_axis_z=False)
    bm.to_mesh(me)
    bm.free()
    me.update()

    # Re-weight everything that was added.
    donor_pts, donor_wts = _weight_donors(bodies)
    added = list(range(n_before, len(me.vertices)))
    for g in ob.vertex_groups:
        g.remove(added)
    for vi in added:
        w = np.array((mw @ me.vertices[vi].co)[:])
        j = int(np.argmin(((donor_pts - w) ** 2).sum(1)))
        for name, weight in donor_wts[j].items():
            vg = ob.vertex_groups.get(name) or ob.vertex_groups.new(name=name)
            vg.add([vi], weight, "REPLACE")
    return n_before, len(me.vertices)
