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


def _evaluated_world(o, depsgraph):
    e = o.evaluated_get(depsgraph)
    me = e.to_mesh()
    mw = o.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    pts = [mw @ v.co for v in me.vertices]
    nrm = [(nm @ v.normal).normalized() for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    e.to_mesh_clear()
    return pts, nrm, faces


def _boundary_points(o, depsgraph):
    e = o.evaluated_get(depsgraph)
    me = e.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    pts = [o.matrix_world @ v.co for v in bm.verts if v.is_boundary]
    bm.free()
    e.to_mesh_clear()
    return pts


def find_pokes(skin, garments, arm, actions, step=2, reach=0.02, edge_margin=0.01):
    """
    Skin vertices that end up *outside* a garment in any frame of `actions`.

    A vertex pokes when a ray along its normal misses every garment within
    `reach` but a ray against it meets one: the cloth is behind the skin.
    Vertices within `edge_margin` of a garment's open edge (collar, cuff, hem)
    are skipped, since skin legitimately leaves the garment there.
    Returns {vertex index: worst depth in metres}.
    """
    from mathutils.kdtree import KDTree
    scene = bpy.context.scene
    skin = bpy.data.objects[skin] if isinstance(skin, str) else skin
    garments = [bpy.data.objects[g] if isinstance(g, str) else g for g in garments]
    arm = bpy.data.objects[arm] if isinstance(arm, str) else arm
    for o in [skin, arm] + garments:
        o.hide_viewport = False
    ad = arm.animation_data

    # Only skin the garments cover at rest can poke through them; hands and
    # necks sit next to cloth legitimately.
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    verts, faces = [], []
    for g in garments:
        p, _, fs = _evaluated_world(g, dg)
        base = len(verts)
        verts += p
        faces += [tuple(base + i for i in fc) for fc in fs]
    bvh = BVHTree.FromPolygons(verts, faces)
    pts, nrm, _ = _evaluated_world(skin, dg)
    covered = {i for i, (p, n) in enumerate(zip(pts, nrm))
               if bvh.ray_cast(p + n * 1e-4, n, reach)[0] is not None}
    arm.data.pose_position = "POSE"

    worst = {}
    for act in actions:
        act = bpy.data.actions[act] if isinstance(act, str) else act
        ad.action = act
        if hasattr(ad, "action_slot") and act.slots:
            ad.action_slot = act.slots[0]
        s, e = (int(round(v)) for v in act.frame_range)
        for f in range(s, e + 1, step):
            scene.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            verts, faces, edges = [], [], []
            for g in garments:
                p, _, fs = _evaluated_world(g, dg)
                base = len(verts)
                verts += p
                faces += [tuple(base + i for i in fc) for fc in fs]
                edges += _boundary_points(g, dg)
            bvh = BVHTree.FromPolygons(verts, faces)
            kd = KDTree(len(edges))
            for i, p in enumerate(edges):
                kd.insert(p, i)
            kd.balance()
            pts, nrm, _ = _evaluated_world(skin, dg)
            for i, (p, n) in enumerate(zip(pts, nrm)):
                if i not in covered or bvh.ray_cast(p + n * 1e-4, n, reach)[0] is not None:
                    continue
                hit = bvh.ray_cast(p - n * 1e-4, -n, reach)[0]
                if hit is None or kd.find(hit)[2] < edge_margin:
                    continue
                d = (p - hit).length
                if d > worst.get(i, 0.0):
                    worst[i] = d
    return worst


def push_under(skin, pokes, pad=0.002, rings=1):
    """
    Move poking skin inward along its rest normal, in the basis and every
    shape key alike (so viseme deltas are unchanged), by its worst depth plus
    `pad`; `rings` rings of neighbours follow with the same offset so no
    crease forms at the edge of the patch.
    """
    skin = bpy.data.objects[skin] if isinstance(skin, str) else skin
    me = skin.data
    inv = skin.matrix_world.inverted().to_3x3()
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    depth = dict(pokes)
    for _ in range(rings):
        grow = {}
        for i, d in depth.items():
            for e in bm.verts[i].link_edges:
                j = e.other_vert(bm.verts[i]).index
                if j not in depth:
                    grow[j] = max(grow.get(j, 0.0), d)
        depth.update(grow)
    offsets = {}
    for i, d in depth.items():
        # World-space depth to object space along the object-space normal.
        n = bm.verts[i].normal.normalized()
        scale = (inv @ (skin.matrix_world.to_3x3() @ n)).length / max(1e-9, (skin.matrix_world.to_3x3() @ n).length)
        offsets[i] = -n * (d + pad) * scale
    bm.free()
    for i, off in offsets.items():
        me.vertices[i].co += off
    if me.shape_keys:
        for kb in me.shape_keys.key_blocks:
            for i, off in offsets.items():
                kb.data[i].co += off
    me.update()
    return len(offsets)


def mirror_region(skin, joint, r_full, r_fade, u_mirror=5.0):
    """
    Rebuild the +x side of `skin` around a world point `joint` as the mirror
    of its -x side (V9.1e, MJ's left elbow).

    Her left arm carries a sculpt defect from the source asset: at rest a
    notch on the inner elbow and a hump at its point, up to 49 mm off the
    mirrored right arm, while her rig is symmetric to 0.1 mm and the rest of
    the arm to a median 0.1 mm. Seen in the app as a broken elbow.

    Left and right vertices are paired through the UVs (Character Creator
    lays the arms out mirrored: u + u' = `u_mirror`, same v), not by
    position, since position is what is broken. Vertices within `r_full` of
    the joint take the mirrored position; the correction fades out by
    `r_fade`. Run in the rest pose. Returns the number of vertices moved.
    """
    skin = bpy.data.objects[skin] if isinstance(skin, str) else skin
    me = skin.data
    mw = skin.matrix_world
    mwi3 = mw.inverted().to_3x3()
    W = [mw @ v.co for v in me.vertices]
    uvs = [[] for _ in me.vertices]
    uvl = me.uv_layers.active.data
    for loop in me.loops:
        uvs[loop.vertex_index].append(tuple(uvl[loop.index].uv))
    key = lambda u, v: (round(u, 4), round(v, 4))
    right = {key(u, v): i for i in range(len(W)) if W[i].x < 0 for u, v in uvs[i]}
    joint = Vector(joint)
    moved = 0
    for i, w in enumerate(W):
        d = (w - joint).length
        if w.x <= 0 or d >= r_fade:
            continue
        j = next((right[k] for k in (key(u_mirror - u, v) for u, v in uvs[i]) if k in right), None)
        if j is None:
            continue
        t = 1.0 if d <= r_full else 1.0 - (d - r_full) / (r_fade - r_full)
        t = t * t * (3 - 2 * t)
        target = Vector((-W[j].x, W[j].y, W[j].z))
        me.vertices[i].co += mwi3 @ ((target - w) * t)
        moved += 1
    me.update()
    return moved


def adopt_weights(skin, garment, reach=0.03, edge_near=0.012, edge_far=0.03, k=4,
                  only=None):
    """
    Skin under a garment takes the garment's weights, so the two move as one.

    V9.1e: MJ's arm skin at the back of the armpit is weighted 0.55 to
    Spine02, the sleeve over it 0.47 to the upper arm, so when the arm comes
    forward (Talking) the sleeve goes with it and the skin stays: 18 mm of
    skin through the back of the sleeve. The skin there is the margin
    `mask_under` keeps, so masking cannot remove it.

    A skin vertex is under the garment when a ray along its normal (or
    against it, for skin already outside) meets the garment within `reach`
    at rest. Its new weights are the garment's, interpolated over the `k`
    nearest garment vertices, blended with its own by distance from the
    garment's open edges: its own at `edge_near`, the garment's from
    `edge_far`, so skin leaving a hem keeps a continuous weight field.
    `only` limits it to vertex indices. Run in the rest pose.
    Returns the number of vertices changed.
    """
    from mathutils.kdtree import KDTree
    skin = bpy.data.objects[skin] if isinstance(skin, str) else skin
    garment = bpy.data.objects[garment] if isinstance(garment, str) else garment
    bvh = _garment_bvh([garment])
    gm = garment.matrix_world
    gnames = {g.index: g.name for g in garment.vertex_groups}
    gpts = [gm @ v.co for v in garment.data.vertices]
    kd = KDTree(len(gpts))
    for i, p in enumerate(gpts):
        kd.insert(p, i)
    kd.balance()
    bm = bmesh.new()
    bm.from_mesh(garment.data)
    edges = [gm @ v.co for v in bm.verts if v.is_boundary]
    bm.free()
    ke = KDTree(len(edges))
    for i, p in enumerate(edges):
        ke.insert(p, i)
    ke.balance()

    mw = skin.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    snames = {g.index: g.name for g in skin.vertex_groups}
    plan = {}
    for v in skin.data.vertices:
        if only is not None and v.index not in only:
            continue
        p = mw @ v.co
        n = (nm @ v.normal).normalized()
        if (bvh.ray_cast(p + n * 1e-4, n, reach)[0] is None
                and bvh.ray_cast(p - n * 1e-4, -n, reach)[0] is None):
            continue
        t = (ke.find(p)[2] - edge_near) / (edge_far - edge_near)
        t = min(1.0, max(0.0, t))
        if t <= 0:
            continue
        t = t * t * (3 - 2 * t)
        acc = {}
        for _co, i, d in kd.find_n(p, k):
            w = 1.0 / max(d, 1e-4)
            for g in garment.data.vertices[i].groups:
                if g.group in gnames:
                    acc[gnames[g.group]] = acc.get(gnames[g.group], 0.0) + g.weight * w
        s = sum(acc.values())
        new = {nme: x / s * t for nme, x in acc.items()}
        own = {snames[g.group]: g.weight for g in v.groups if g.group in snames}
        so = sum(own.values()) or 1.0
        for nme, x in own.items():
            new[nme] = new.get(nme, 0.0) + x / so * (1 - t)
        plan[v.index] = new
    for vi, new in plan.items():
        for g in skin.vertex_groups:
            g.remove([vi])
        top = sorted(new.items(), key=lambda z: -z[1])[:4]
        s = sum(x for _, x in top)
        for nme, x in top:
            g = skin.vertex_groups.get(nme) or skin.vertex_groups.new(name=nme)
            g.add([vi], x / s, "REPLACE")
    return len(plan)


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
