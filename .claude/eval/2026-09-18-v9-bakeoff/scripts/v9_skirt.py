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
"""

import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
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


def build(target, name="OPT_skirt", z_top=1.10, z_bot=0.50, segments=96, rings=18,
          clearance=0.012, flare=0.075, pleats=16, pleat_depth=0.012, center=(0.0, 0.005)):
    # From the mesh data: the target is hidden, and a hidden object has no
    # evaluated mesh for BVHTree.FromObject.
    me_t = target.data
    bvh = BVHTree.FromPolygons([target.matrix_world @ v.co for v in me_t.vertices],
                               [tuple(p.vertices) for p in me_t.polygons])
    cx, cy = center

    def body_r(th, z):
        d = Vector((math.cos(th), math.sin(th), 0.0))
        o = Vector((cx, cy, z))
        hit = bvh.ray_cast(o + d * 0.6, -d, 0.6)[0]
        return (hit - o).length if hit else 0.0

    radii, prev = [], None
    for k in range(rings + 1):
        t = k / rings
        z = z_top + (z_bot - z_top) * t
        r = np.array([body_r(2 * math.pi * i / segments, z) + clearance for i in range(segments)])
        if prev is not None:
            r = np.maximum(r, prev)
        r = np.convolve(np.concatenate([r[-4:], r, r[:4]]), np.ones(9) / 9, mode="valid")
        if prev is not None:
            r = np.maximum(r, prev)
        prev = r.copy()  # the un-flared radius, so the flare does not compound
        radii.append((z, r + flare * t ** 1.4))

    bm = bmesh.new()
    grid = []
    for k, (z, r) in enumerate(radii):
        t = k / rings
        amp = 0.25 * pleat_depth + pleat_depth * t
        row = []
        for i in range(segments):
            th = 2 * math.pi * i / segments
            saw = (i * pleats / segments) % 1.0
            rr = r[i] + amp * (saw - 0.5)
            row.append(bm.verts.new((cx + rr * math.cos(th), cy + rr * math.sin(th), z)))
        grid.append(row)
    uv = bm.loops.layers.uv.new("UVMap")
    for k in range(rings):
        for i in range(segments):
            j = (i + 1) % segments
            f = bm.faces.new((grid[k][i], grid[k][j], grid[k + 1][j], grid[k + 1][i]))
            for loop, (u, v) in zip(f.loops, ((i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1))):
                loop[uv].uv = (u / segments, 1 - v / rings)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

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
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = NAVY
    bsdf.inputs["Roughness"].default_value = 0.8
    mat.use_backface_culling = False
    me.materials.append(mat)
    return ob


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
