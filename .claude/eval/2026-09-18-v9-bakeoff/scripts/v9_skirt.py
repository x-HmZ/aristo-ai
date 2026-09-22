"""
A clean pleated A-line skirt for MJ, built from scratch (V9.1d option A).

Why not keep extending her own skirt: it is 139 separate pleat panels. Grown
downward with a flare they drift apart, so her legs show through the slits as
thin orange lines; the grown rings copied the hem's UVs (676 of 1,244 faces
with zero UV area), which stretches single rows of baked pleat shading into
the dark blotches three.js shows; and the hem is the panels' ends at
different heights, so it reads as slashed. Those are modelling problems, not
weights or normals.

This one is a single closed tube: rings from the waist to below the knee,
each sized from the body's own cross-section (ray cast from the body axis) so
it clears the hips, never narrower than the ring above, plus an A-line flare
and knife pleats as a sawtooth in the radius. Proper cylindrical UVs, a flat
navy material, outward normals. Weights come from the body's nearest
vertices, with calf/knee/foot influence folded into the thigh and a growing
share of the hip towards the hem, so a wide stance swings it rather than
tearing it between the legs.

V9.1e shipped it as `MJ_skirt` (parented to her armature `Object_4.001`,
the old `Object_39.001` hidden via v9_strip.HIDE), after v9_tee.rebuild():

    tgt = body_target(arm, ["Object_13.001", "Object_10.001", "Object_31.001"],
                      name="MJ_skirt_target")
    sk = build(tgt, name="MJ_skirt", segments=128, pleat_depth=0.018,
               waistband=0.03, waist_clearance=0.005, lip=0.006)
    weight_and_bind(sk, arm, ["Object_13.001", "Object_10.001"])
    clear_hands(arm, "MJ_<clip>", sk, ["Object_12.001", "Object_14.001"])

Its checks are v9_mask.find_pokes (skin the garments cover at rest) plus
check_through below (knees and hands, which the flare stands far off).
"""

import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

import v9_clothe as CL

NAVY = (0.026, 0.031, 0.078, 1.0)  # linear; matches the flat area of her skirt texture


def body_target(arm, parts, name="OPT_bodytarget"):
    """One world-space mesh of `parts` in the rest pose, for ray casting."""
    old = arm.data.pose_position
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for n in parts:
        o = bpy.data.objects[n]
        e = o.evaluated_get(dg)
        m = e.to_mesh().copy()
        m.transform(o.matrix_world)
        bm.from_mesh(m)
        bpy.data.meshes.remove(m)
        e.to_mesh_clear()
    bm.to_mesh(me)
    bm.free()
    arm.data.pose_position = old
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
    else:
        ob.data = me
    ob.hide_render = ob.hide_viewport = True
    return ob


def _flat_material(name, color, roughness=0.8):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    mat.use_backface_culling = False
    return mat


def _center(bvh, z, guess=(0.0, 0.0)):
    """Mid-point of the body's extents along x and y at height z."""
    c = Vector((guess[0], guess[1], z))
    for _ in range(3):
        hits = [bvh.ray_cast(c + d * 0.6, -d, 0.6)[0]
                for d in (Vector((1, 0, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, -1, 0)))]
        if any(h is None for h in hits):
            break
        c = Vector(((hits[0].x + hits[1].x) / 2, (hits[2].y + hits[3].y) / 2, z))
    return c.x, c.y


def build(target, name="OPT_skirt", z_top=1.10, z_bot=0.50, segments=96, rings=18,
          clearance=0.012, flare=0.075, pleats=16, pleat_depth=0.012, center=None,
          waistband=0.0, waist_clearance=None, lip=0.0):
    """
    `center` None measures the body's axis at z_top (V9.1d passed a fixed
    point, which went stale when `normalise` moved her in V9.1d).

    V9.1e additions, all off by default so the V9.1d mock-up rebuilds as it was:
    `waistband` metres of plain (unpleated) band at the top, fitted with
    `waist_clearance`; `lip` an inward ring at the top edge that closes the
    gap between waistband and tee when seen from above. (A darker hem band
    was tried and dropped: at lesson distance nothing needed it.)
    """
    # From the mesh data: the target is hidden, and a hidden object has no
    # evaluated mesh for BVHTree.FromObject.
    me_t = target.data
    bvh = BVHTree.FromPolygons([target.matrix_world @ v.co for v in me_t.vertices],
                               [tuple(p.vertices) for p in me_t.polygons])
    cx, cy = center if center is not None else _center(bvh, z_top)
    waist_clearance = clearance if waist_clearance is None else waist_clearance

    def body_r(th, z):
        d = Vector((math.cos(th), math.sin(th), 0.0))
        o = Vector((cx, cy, z))
        hit = bvh.ray_cast(o + d * 0.6, -d, 0.6)[0]
        return (hit - o).length if hit else 0.0

    # Ring heights: the waistband gets its own rings so its bottom edge is
    # where the pleats begin.
    zs = []
    if waistband > 0:
        zs += [z_top, z_top - waistband / 2]
        z_p = z_top - waistband
    else:
        z_p = z_top
    zs += [z_p + (z_bot - z_p) * k / rings for k in range(rings + 1)]

    radii, prev, body0 = [], None, None
    for z in zs:
        t = max(0.0, (z_p - z) / (z_p - z_bot))
        c = waist_clearance if z > z_p + 1e-6 else clearance
        body = np.array([body_r(2 * math.pi * i / segments, z) for i in range(segments)])
        if body0 is None:
            body0 = body
        r = body + c
        if prev is not None:
            r = np.maximum(r, prev)
        r = np.convolve(np.concatenate([r[-4:], r, r[:4]]), np.ones(9) / 9, mode="valid")
        if prev is not None:
            r = np.maximum(r, prev)
        prev = r.copy()  # the un-flared radius, so the flare does not compound
        radii.append((z, r + flare * t ** 1.4, t, z <= z_p + 1e-6))

    bm = bmesh.new()
    grid = []

    def ring_verts(z, r, amp):
        row = []
        for i in range(segments):
            th = 2 * math.pi * i / segments
            saw = (i * pleats / segments) % 1.0
            rr = r[i] + amp * (saw - 0.5)
            row.append(bm.verts.new((cx + rr * math.cos(th), cy + rr * math.sin(th), z)))
        return row

    if lip > 0:
        # Turned in over the tee: from just outside the body to the band.
        grid.append(ring_verts(z_top - lip, body0 + 0.001, 0.0))
    for z, r, t, pleated in radii:
        amp = (0.25 * pleat_depth + pleat_depth * t) if pleated else 0.0
        grid.append(ring_verts(z, r, amp))
    uv = bm.loops.layers.uv.new("UVMap")
    n = len(grid) - 1
    for k in range(n):
        for i in range(segments):
            j = (i + 1) % segments
            f = bm.faces.new((grid[k][i], grid[k][j], grid[k + 1][j], grid[k + 1][i]))
            for loop, (u, v) in zip(f.loops, ((i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1))):
                loop[uv].uv = (u / segments, 1 - v / n)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # A lip turned inward makes the outward test above ambiguous for the whole
    # tube; check the pleated body explicitly.
    bm.normal_update()
    f = next(f for f in bm.faces if f.calc_center_median().z < z_p - 0.05)
    p = f.calc_center_median()
    if f.normal.dot(Vector((p.x - cx, p.y - cy, 0.0))) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    old = bpy.data.objects.get(name)
    if old is not None:
        bpy.data.objects.remove(old)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(_flat_material(name, NAVY))
    ob["v91e_center"] = (cx, cy)
    return ob


def check_through(skirt, parts, arm, actions, inside_is_bad, step=1, margin=0.0):
    """
    Vertices of `parts` on the wrong side of the skirt, per frame.

    `v9_mask.find_pokes` only tests skin the garment covers at rest, within
    2 cm. A flared skirt stands far off the knees and hands, so a knee
    leaving it in a wide stance, or a hand passing into it, never shows
    there. Here each vertex is tested along the horizontal line from the
    hip joint through it: a leg vertex is outside the skirt (`inside_is_bad`
    False) when that line meets the skirt before reaching it; a hand is
    inside (`inside_is_bad` True) when the line meets the skirt beyond it.
    Vertices within `margin` of the crossing are ignored.
    Returns {action: (count of bad vertex-frames, worst depth m, worst frame)}.
    """
    scene = bpy.context.scene
    skirt = bpy.data.objects[skirt] if isinstance(skirt, str) else skirt
    arm = bpy.data.objects[arm] if isinstance(arm, str) else arm
    parts = [bpy.data.objects[p] if isinstance(p, str) else p for p in parts]
    hip = next(b.name for b in arm.data.bones if b.name.startswith("CC_Base_Hip"))
    ad = arm.animation_data
    out = {}
    for act in actions:
        act = bpy.data.actions[act] if isinstance(act, str) else act
        ad.action = act
        if hasattr(ad, "action_slot") and act.slots:
            ad.action_slot = act.slots[0]
        s, e = (int(round(v)) for v in act.frame_range)
        bad, worst, wf = 0, 0.0, None
        for f in range(s, e + 1, step):
            scene.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            es = skirt.evaluated_get(dg)
            me = es.to_mesh()
            V = [skirt.matrix_world @ v.co for v in me.vertices]
            bvh = BVHTree.FromPolygons(V, [tuple(p.vertices) for p in me.polygons])
            zlo, zhi = min(v.z for v in V), max(v.z for v in V)
            es.to_mesh_clear()
            h = arm.matrix_world @ arm.pose.bones[hip].head
            for o in parts:
                eo = o.evaluated_get(dg)
                mo = eo.to_mesh()
                for v in mo.vertices:
                    p = o.matrix_world @ v.co
                    if not (zlo < p.z < zhi):
                        continue
                    c = Vector((h.x, h.y, p.z))
                    d = p - c
                    dist = d.length
                    if dist < 1e-4:
                        continue
                    d /= dist
                    if inside_is_bad:
                        hit = bvh.ray_cast(p, d, 0.5)[0]
                        depth = (hit - p).length if hit else 0.0
                    else:
                        hit = bvh.ray_cast(c, d, dist)[0]
                        depth = (p - hit).length if hit else 0.0
                    if depth > margin:
                        bad += 1
                        if depth > worst:
                            worst, wf = depth, f
                eo.to_mesh_clear()
        out[act.name] = (bad, round(worst * 1000, 1), wf)
    return out


def _deepest_hand(bvh, zlo, zhi, hip_w, parts, dg, side_x):
    """Deepest vertex of `parts` inside the skirt on one side (sign of x - hip)."""
    best = (0.0, None, None)
    for o in parts:
        eo = o.evaluated_get(dg)
        mo = eo.to_mesh()
        for v in mo.vertices:
            p = o.matrix_world @ v.co
            if not (zlo < p.z < zhi) or (p.x - hip_w.x) * side_x <= 0:
                continue
            d = Vector((p.x - hip_w.x, p.y - hip_w.y, 0.0))
            if d.length < 1e-4:
                continue
            d.normalize()
            hit = bvh.ray_cast(p, d, 0.5)[0]
            if hit is not None and (hit - p).length > best[0]:
                best = ((hit - p).length, p.copy(), d.copy())
        eo.to_mesh_clear()
    return best


def clear_hands(arm, action, skirt, parts, margin=0.008, window=4, sigma=2.0, passes=2):
    """
    Swing each upper arm out about the shoulder, frame by frame, by the
    smallest angle that takes the hand out of the skirt plus `margin`.

    V9.1e: MJ's hips are 0.163 m to the side; in Idle her hands hang 10-15 mm
    outside that, so any skirt with ease at the hips swallows her fingers
    (24-33 mm, every Idle frame; up to 79 mm in Talking with the arms
    hanging). A narrower skirt puts her legs through it in Pointing instead.
    Real cloth would be pushed aside; the arms move instead, by what each
    frame needs, max-filtered over +-`window` frames and Gaussian-smoothed so
    the swing never pops. The rotation is rigid for the whole arm, so the
    elbow-share and twist helpers keep their relative pose. Frames where the
    hands are clear (a raised Pointing arm) are left alone, so where Pointing
    lands does not move.

    The skirt is weighted to the hips and legs only, so moving the arms does
    not move it; `passes` re-measures after each application.
    Returns the largest swing applied per side, in degrees.
    """
    import v9_retarget as RT
    scene = bpy.context.scene
    arm = bpy.data.objects[arm] if isinstance(arm, str) else arm
    skirt = bpy.data.objects[skirt] if isinstance(skirt, str) else skirt
    parts = [bpy.data.objects[p] if isinstance(p, str) else p for p in parts]
    ad = arm.animation_data
    ad.action = action = bpy.data.actions[action] if isinstance(action, str) else action
    if hasattr(ad, "action_slot") and action.slots:
        ad.action_slot = action.slots[0]
    s, e = (int(round(v)) for v in action.frame_range)
    hip = next(b.name for b in arm.data.bones if b.name.startswith("CC_Base_Hip"))
    upper = {"L": RT.resolve(arm, "CC_Base_L_Upperarm"), "R": RT.resolve(arm, "CC_Base_R_Upperarm")}
    mw3 = arm.matrix_world.to_3x3()
    mw3_inv = mw3.inverted()
    worst = {"L": 0.0, "R": 0.0}

    for _ in range(passes):
        need = {side: {} for side in upper}
        for f in range(s, e + 1):
            scene.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            es = skirt.evaluated_get(dg)
            me = es.to_mesh()
            V = [skirt.matrix_world @ v.co for v in me.vertices]
            bvh = BVHTree.FromPolygons(V, [tuple(p.vertices) for p in me.polygons])
            zlo, zhi = min(v.z for v in V), max(v.z for v in V)
            es.to_mesh_clear()
            hip_w = arm.matrix_world @ arm.pose.bones[hip].head
            for side, sx in (("L", 1.0), ("R", -1.0)):
                depth, p, u = _deepest_hand(bvh, zlo, zhi, hip_w, parts, dg, sx)
                if p is None:
                    continue
                sh = arm.matrix_world @ arm.pose.bones[upper[side]].head
                r = p - sh
                axis = r.cross(u)
                if axis.length < 1e-6:
                    continue
                axis.normalize()
                lever = (r - axis * r.dot(axis)).length
                need[side][f] = (math.atan((depth + margin) / lever), axis)
        if not any(need.values()):
            break
        for side in upper:
            if not need[side]:
                continue
            frames = range(s, e + 1)
            ang = np.array([need[side].get(f, (0.0, None))[0] for f in frames])
            ang = np.array([ang[max(0, i - window):i + window + 1].max() for i in range(len(ang))])
            k = np.exp(-0.5 * (np.arange(-3 * int(sigma), 3 * int(sigma) + 1) / sigma) ** 2)
            k /= k.sum()
            pad = len(k) // 2
            ang = np.convolve(np.pad(ang, pad, mode="edge"), k, mode="valid")
            # One axis per side (the mean of the frames that needed a swing),
            # so the swing plane does not wander from frame to frame.
            ax = sum((a for _, a in need[side].values()), Vector()).normalized()
            pb = arm.pose.bones[upper[side]]
            pb.rotation_mode = "QUATERNION"
            for i, f in enumerate(frames):
                if ang[i] < 1e-5:
                    continue
                scene.frame_set(f)
                P = (pb.matrix @ pb.matrix_basis.inverted()).to_3x3()
                R_arm = mw3_inv @ Matrix.Rotation(ang[i], 3, ax) @ mw3
                q0 = pb.rotation_quaternion.copy()
                q = (P.inverted() @ R_arm @ P @ q0.to_matrix()).to_quaternion()
                if q.dot(q0) < 0:
                    q.negate()
                pb.rotation_quaternion = q
                pb.keyframe_insert("rotation_quaternion", frame=f)
            worst[side] += math.degrees(float(ang.max()))
    return worst


def weight_and_bind(ob, arm, bodies, k=24, hip_share=(0.25, 0.6)):
    names = [b.name for b in arm.data.bones]

    def bone(prefix):
        return next(n for n in names if n.startswith(prefix)
                    and (n == prefix or n[len(prefix) + 1:].isdigit()))

    hip, tl, tr = bone("CC_Base_Hip"), bone("CC_Base_L_Thigh"), bone("CC_Base_R_Thigh")
    pts, wts = CL._weight_donors([bpy.data.objects[b] for b in bodies])
    kd = KDTree(len(pts))
    for i, p in enumerate(pts):
        kd.insert(p, i)
    kd.balance()
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    zs = [v.co.z for v in ob.data.vertices]
    z0, z1 = max(zs), min(zs)
    lo, hi = hip_share
    for v in ob.data.vertices:
        t = (z0 - v.co.z) / (z0 - z1)
        acc = {}
        for _co, i, d in kd.find_n(ob.matrix_world @ v.co, k):
            w = 1.0 / max(d, 1e-3)
            for n, x in wts[i].items():
                if any(s in n for s in ("Calf", "Knee", "Foot", "ToeBase", "ThighTwist")):
                    n = tl if "_L_" in n else tr
                acc[n] = acc.get(n, 0.0) + x * w
        s = sum(acc.values())
        a = lo + (hi - lo) * t if t > 0.25 else 0.0
        acc = {n: x / s * (1 - a) for n, x in acc.items()}
        acc[hip] = acc.get(hip, 0.0) + a
        top = sorted(acc.items(), key=lambda z: -z[1])[:4]
        s = sum(x for _, x in top)
        for n, x in top:
            g = ob.vertex_groups.get(n) or ob.vertex_groups.new(name=n)
            g.add([v.index], x / s, "REPLACE")
    mw = ob.matrix_world.copy()
    ob.parent = arm
    ob.matrix_world = mw
    mod = ob.modifiers.get("Armature") or ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    return ob
