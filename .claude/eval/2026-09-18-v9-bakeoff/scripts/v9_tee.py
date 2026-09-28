"""
Rebuild the lower half of MJ's tee (V9.1e, option A).

V9.1c lengthened her crop top by extruding the boundary loop *below* its
rolled hem and projecting each ring onto the body at 4 mm. Three.js showed
why that fails the bar (V9.1d):

- the rolled hem stays as a ridge with a shading step: the normal map draws
  its folds in the band just above the old edge, so it reads as a crop top
  over a white bodysuit;
- 4 mm off the skin reads as body paint;
- the grown rings copied the hem's UVs: 464 faces with zero UV area under a
  normal map, so three.js has no tangent frame for them.

This cuts the tee above that band (`z_cut`), welds the UV seams the glTF
import split open, and grows a new lower part as a closed tube:

- each ring's radius is taken from a proxy of her waist -- the V9.1c tee
  itself, since the skin under it was masked away in V9.1c -- plus ease, and
  may only narrow slowly going down (`drape`), so it hangs from the ribs
  instead of following the waist in;
- below `z_tuck` it is drawn in to the proxy, tucked under the skirt's
  waistband, so the blouse above it is the only fold that shows;
- the new faces map into a flat corner of the tee's normal map: real UV area,
  so tangents exist, and no stretched folds;
- custom normals are dropped after welding, so the seams stay smooth.

The unmodified tee mesh is kept as `<mesh>_v91d` (fake user), and every run
starts from it, so this is safe to re-run with other numbers.
"""

import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

FLAT_UV = (0.015, 0.085, 0.02, 0.19)  # u0, u1, v0, v1: pure (0.5, 0.5, 1) in the normal map


def _original(ob):
    """The tee as V9.1d left it; saved on first use, restored on every later one."""
    key = ob.get("v91e_src")
    if key and key in bpy.data.meshes:
        src = bpy.data.meshes[key]
    else:
        src = ob.data.copy()
        src.name = ob.data.name + "_v91d"
        src.use_fake_user = True
        ob["v91e_src"] = src.name
    return src


def _bvh(meshes_world):
    verts, faces = [], []
    for me, mw in meshes_world:
        base = len(verts)
        verts += [mw @ v.co for v in me.vertices]
        faces += [tuple(base + i for i in p.vertices) for p in me.polygons]
    return BVHTree.FromPolygons(verts, faces)


def _ring_profile(bvh, z, center, n=180):
    """Outermost proxy radius at `n` angles round `center`, at height z."""
    cx, cy = center
    o = Vector((cx, cy, z))
    r = np.zeros(n)
    for i in range(n):
        th = 2 * math.pi * i / n
        d = Vector((math.cos(th), math.sin(th), 0.0))
        hit = bvh.ray_cast(o + d * 0.6, -d, 0.6)[0]
        r[i] = (hit - o).length if hit else np.nan
    if np.isnan(r).all():
        raise RuntimeError(f"proxy has no cross-section at z={z:.3f}")
    # Fill any miss from its neighbours (open seams in the proxy).
    idx = np.arange(n)
    ok = ~np.isnan(r)
    r = np.interp(idx, idx[ok], r[ok], period=n)
    return r


def _center(bvh, z, guess):
    c = Vector((guess[0], guess[1], z))
    for _ in range(3):
        hits = []
        for d in (Vector((1, 0, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, -1, 0))):
            h = bvh.ray_cast(c + d * 0.6, -d, 0.6)[0]
            hits.append(h)
        if any(h is None for h in hits):
            break
        c = Vector(((hits[0].x + hits[1].x) / 2, (hits[2].y + hits[3].y) / 2, z))
    return (c.x, c.y)


def _smooth_periodic(r, width=9):
    k = np.ones(width) / width
    h = width // 2
    return np.convolve(np.concatenate([r[-h:], r, r[:h]]), k, mode="valid")


def rebuild(tee="Object_31.001", proxy_extra=("Object_10.001",), z_cut=1.305, z_bot=1.065,
            ring_dz=0.012, ease=0.008, tuck_ease=0.0, z_tuck=1.105, tuck_band=0.025,
            drape=0.25, blend_rings=3, weld=1e-5, k=16):
    ob = bpy.data.objects[tee] if isinstance(tee, str) else tee
    arm = ob.find_armature()
    old_pose = arm.data.pose_position
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    try:
        return _rebuild(ob, proxy_extra, z_cut, z_bot, ring_dz, ease, tuck_ease, z_tuck,
                        tuck_band, drape, blend_rings, weld, k)
    finally:
        arm.data.pose_position = old_pose
        bpy.context.view_layer.update()


def _rebuild(ob, proxy_extra, z_cut, z_bot, ring_dz, ease, tuck_ease, z_tuck, tuck_band,
             drape, blend_rings, weld, k):
    src = _original(ob)
    mw = ob.matrix_world.copy()
    mwi = mw.inverted()

    # Proxy of her waist: the V9.1c tee (4 mm off the skin that was there) and
    # the pelvis skin below it.
    extra = [bpy.data.objects[n] for n in proxy_extra]
    bvh = _bvh([(src, mw)] + [(o.data, o.matrix_world) for o in extra])

    # Weight donors: the whole V9.1c tee (its extension was weighted from the
    # skin before that was masked).
    names = {g.index: g.name for g in ob.vertex_groups}
    donor_pts = [mw @ v.co for v in src.vertices]
    donor_wts = [{names[g.group]: g.weight for g in v.groups if g.group in names}
                 for v in src.vertices]
    kd = KDTree(len(donor_pts))
    for i, p in enumerate(donor_pts):
        kd.insert(p, i)
    kd.balance()

    bm = bmesh.new()
    bm.from_mesh(src)
    uv = bm.loops.layers.uv.active
    dl = bm.verts.layers.deform.active

    # 1. Cut above the rolled hem.
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    plane_co = mwi @ Vector((0, 0, z_cut))
    plane_no = (mwi.to_3x3() @ Vector((0, 0, 1))).normalized()
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=plane_co, plane_no=plane_no,
                           clear_inner=True, dist=1e-6)
    # 2. Orient, then weld the seams the import split open.
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
    bm.verts.ensure_lookup_table()

    cut = [e for e in bm.edges if e.is_boundary
           and all(abs((mw @ v.co).z - z_cut) < 1e-4 for v in e.verts)]
    if not cut:
        raise RuntimeError("no boundary on the cut plane")
    cut_verts = list({v for e in cut for v in e.verts})

    # 3. Ring heights and profiles.
    n_rings = max(2, int(round((z_cut - z_bot) / ring_dz)))
    zs = [z_cut + (z_bot - z_cut) * (i / n_rings) for i in range(n_rings + 1)]
    wc = [mw @ v.co for v in cut_verts]
    guess = (float(np.mean([p.x for p in wc])), float(np.mean([p.y for p in wc])))
    centers = [_center(bvh, z, guess) for z in zs]
    N = 180
    prox = [_smooth_periodic(_ring_profile(bvh, z, c, N)) for z, c in zip(zs, centers)]

    # Original offset of the cut ring from the proxy, per angle.
    c0 = Vector((*centers[0], z_cut))
    th_cut = {}
    e0 = np.full(N, np.nan)
    for v, p in zip(cut_verts, wc):
        d = p - c0
        th = math.atan2(d.y, d.x) % (2 * math.pi)
        th_cut[v] = th
        i = int(round(th / (2 * math.pi) * N)) % N
        e0[i] = d.length - prox[0][i]
    idx = np.arange(N)
    ok = ~np.isnan(e0)
    e0 = np.interp(idx, idx[ok], e0[ok], period=N)

    radii = [prox[0] + e0]
    for kk in range(1, n_rings + 1):
        z = zs[kk]
        a = min(1.0, kk / blend_rings)
        e = e0 * (1 - a) + ease * a
        if z < z_tuck + tuck_band:
            t = min(1.0, (z_tuck + tuck_band - z) / tuck_band)
            t = t * t * (3 - 2 * t)
            e = e * (1 - t) + tuck_ease * t
        r = prox[kk] + e
        if z >= z_tuck + tuck_band:
            # Hang from the ribs: narrow no faster than `drape` per metre of drop.
            r = np.maximum(r, radii[-1] - drape * (zs[kk - 1] - z))
        radii.append(_smooth_periodic(r, 7))

    def at(kk, th):
        f = th / (2 * math.pi) * N
        i0 = int(math.floor(f)) % N
        i1 = (i0 + 1) % N
        w = f - math.floor(f)
        rr = radii[kk][i0] * (1 - w) + radii[kk][i1] * w
        cx, cy = centers[kk]
        return Vector((cx + rr * math.cos(th), cy + rr * math.sin(th), zs[kk]))

    # 4. Grow the rings.
    cur_edges = cut
    col = {v: v for v in cut_verts}  # ring vertex -> the cut vertex of its column
    ring = {v: 0 for v in cut_verts}
    new_faces = []
    for kk in range(1, n_rings + 1):
        ret = bmesh.ops.extrude_edge_only(bm, edges=cur_edges)
        verts = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
        vset = set(verts)
        new_faces += [g for g in ret["geom"] if isinstance(g, bmesh.types.BMFace)]
        for v in verts:
            prev = next(e.other_vert(v) for e in v.link_edges
                        if e.other_vert(v) not in vset and ring.get(e.other_vert(v)) == kk - 1)
            col[v] = col[prev]
            ring[v] = kk
            v.co = mwi @ at(kk, th_cut[col[v]])
            if dl is not None:
                v[dl].clear()
        cur_edges = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMEdge) and g.is_boundary]

    # Outward winding for the new faces (the extrusion follows the boundary's
    # direction, which after welding is consistent but not necessarily out).
    bm.normal_update()
    out = 0
    for f in new_faces:
        c = f.calc_center_median()
        kk = ring[f.verts[0]]
        cx, cy = centers[kk]
        wc_ = mw @ c
        radial = Vector((wc_.x - cx, wc_.y - cy, 0.0))
        n = (mw.to_3x3() @ f.normal)
        out += 1 if n.dot(radial) > 0 else -1
    if out < 0:
        bmesh.ops.reverse_faces(bm, faces=new_faces)

    # 5. UVs into a flat corner of the normal map.
    u0, u1, v0, v1 = FLAT_UV
    for f in new_faces:
        us = [th_cut[col[l.vert]] / (2 * math.pi) for l in f.loops]
        # A face straddling the angle wrap would span the whole strip; unwrap
        # it (u runs a column past 1.0, still inside the flat corner).
        if max(us) - min(us) > 0.5:
            us = [u + 1.0 if u < 0.5 else u for u in us]
        for l, u in zip(f.loops, us):
            l[uv].uv = (u0 + (u1 - u0) * u, v1 - (v1 - v0) * ring[l.vert] / n_rings)
        f.smooth = True
    for f in bm.faces:
        f.smooth = True

    new_verts = [v for v in bm.verts if ring.get(v, 0) > 0]
    bm.verts.index_update()
    new_idx = [(v.index, mw @ v.co) for v in new_verts]
    me = ob.data
    bm.to_mesh(me)
    bm.free()
    if "custom_normal" in me.attributes:
        me.attributes.remove(me.attributes["custom_normal"])
    if "sharp_face" in me.attributes:
        me.attributes.remove(me.attributes["sharp_face"])
    me.update()

    # 6. Weights for the new vertices from the V9.1c tee, inverse-distance over
    # the k nearest (the nearest one alone steps between bones).
    for vi, p in new_idx:
        acc = {}
        for _co, i, d in kd.find_n(p, k):
            w = 1.0 / max(d, 1e-3)
            for n, x in donor_wts[i].items():
                acc[n] = acc.get(n, 0.0) + x * w
        top = sorted(acc.items(), key=lambda z: -z[1])[:4]
        s = sum(x for _, x in top)
        for n, x in top:
            g = ob.vertex_groups.get(n) or ob.vertex_groups.new(name=n)
            g.add([vi], x / s, "REPLACE")

    zero_uv = 0
    uvl = me.uv_layers.active.data
    for p in me.polygons:
        pts = [uvl[li].uv for li in p.loop_indices]
        a = sum(abs((pts[i] - pts[0]).cross(pts[i + 1] - pts[0])) for i in range(1, len(pts) - 1))
        zero_uv += a < 1e-9
    return {"rings": n_rings, "ring_verts": len(cut_verts), "verts": len(me.vertices),
            "faces": len(me.polygons), "zero_uv_faces": zero_uv,
            "ease_mm_at": {round(z, 3): round(float(np.mean(r - p)) * 1000, 1)
                           for z, r, p in zip(zs, radii, prox)}}
