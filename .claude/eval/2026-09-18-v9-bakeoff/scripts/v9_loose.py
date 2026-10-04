"""
Loosen a teacher's shirt (V8.3d): ease, an untucked hem that hangs, folds.

Hmz (2026-10-04): the shirts are skin tight; he wants a relaxed fit that reads as
fabric. Jake's collared shirt comes out of his trousers with a straight hem and a
shallow shirt-tail curve; MJ's tee comes out over the skirt with a slight A-line.

The skin under both shirts was masked away in V9.1c (v9_mask.mask_under), so the
body cannot serve as the reference surface. As in v9_tee, the shirt itself is the
proxy for the body (it was fitted a few mm off the skin), and the garment under
the hem (trousers, skirt) is the floor the new cloth must clear.

Method, in the rest pose:

1. Restore the shirt as V8.3c shipped it (`<mesh>_v83c`, fake user), so every run
   starts from the same mesh and this is safe to re-run with other numbers.
2. Cut it at `z_cut`, above the waist, and drop everything below. Jake's source
   ends in a tuck: a sculpted ridge where it meets the trousers, then the cloth
   pulled in, then a turned-in facing whose free edge is the mesh's boundary.
   Easing that and growing from its edge kept the old hem as a band (V8.3d
   drafts 1-8); cutting above it and regrowing is v9_tee's method, which MJ's tee
   already went through. The button islands the cut takes are put back (step 6).
3. One subdivision of the main islands (buttons are left alone), so the eased
   cloth and its folds have the density to curve.
4. Ease the upper part. Radius is measured from one plumb axis (the mean of the
   spine heads below the chest): cloth hangs plumb, and both a per-slice centre
   and the spine's own lumbar curve put false bumps in it. The target is the
   shirt's own outermost radius S(z, theta) plus an ease field (0 at the shoulder
   line, `ease_chest` at the chest, rising toward `ease_waist`, `side` of it under
   the arms), filled downward so it narrows no faster than `drape` per metre (the
   back by `drape_back`): the cloth hangs from the chest. Each vertex moves by the
   target minus the old surface at its own height and angle (a ray, not a grid),
   so inner layers (the placket under-lap) keep their depth.
5. Sleeves. Radially from each arm's bone line (upper arm, forearm, hand heads)
   by a profile along it; Jake's is drawn back in at the cuff so the forearm
   blouses above it. Blended torso / sleeve by the arm weights.
6. Regrow the lower part from the cut boundary as rings (extrude_edge_only, as
   v9_tee). Each ring sits on a fresh envelope: from the cut ring's radius it
   narrows by `drape`, opens by `flare` below the waist, always clears the
   garment under it by `clear`, and above that garment widens at most `rise` per
   metre (no step at the waistband). Each column keeps its offset from the cut
   ring's outer surface, so the placket over-lap stays over the under-lap. The
   hem is longer at front and back by `tail` (a shirt-tail curve). Weights come
   from the source shirt's nearest vertices (inverse distance, the k nearest).
   Buttons are copied down the placket at the existing spacing.
7. Folds as geometry: outward-only drape waves growing toward the hem, and
   stacked rings above Jake's cuffs. Fine folds and the weave are a baked normal
   map (v9_fabric).
8. The weights of the loose lower torso are smoothed over the mesh, so the cloth
   does not follow every bone sharply.
"""

import math
import re

import bmesh
import bpy
import numpy as np
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ARM_RE = re.compile(r"_[LR]_(Upperarm|Forearm|Elbow|Hand)")
BUTTON_FACES = 200  # Jake's buttons are islands of 57-78 faces; the shirt itself is one of 3754

JAKE = dict(
    shirt="TrendyLongSleevesShirt_v01_7902_Shape", arm="Armature.002", under=("Pants_14249_Shape",),
    z_cut=1.16, clear=0.013, z_top=1.47, z_chest=1.38, z_waist=1.13, ease_chest=0.010, ease_waist=0.025,
    side=0.45, drape=0.10, drape_back=0.16, drape_side=0.8, rise=0.25, flare=0.0, hem_side=1.000, tail=0.025, ring_dz=0.012, seam_band=0.03,
    # Along the arm line, 0 = shoulder joint, 1 = wrist (hand head); his elbow is at about 0.58, the cuff from 0.88.
    sleeve=((0.0, 0.0), (0.06, 0.005), (0.45, 0.007), (0.58, 0.009), (0.80, 0.009), (0.88, 0.004), (1.0, 0.003)),
    cuff_rings=(0.66, 0.88), wave_amp=0.005, wave_n=9, seed=3.0, buttons=True,
)
MJ = dict(
    shirt="Object_31.001", arm="Object_4.001", under=("MJ_skirt",),
    z_cut=1.21, clear=0.006, z_top=1.46, z_chest=1.39, z_waist=1.14, ease_chest=0.010, ease_waist=0.028,
    side=0.3, drape=0.12, drape_back=0.16, drape_side=0.8, rise=0.25, flare=0.10, hem_side=1.052, tail=0.008, ring_dz=0.010, seam_band=0.03,
    # Her short sleeve ends at about 0.3 of the arm line.
    sleeve=((0.0, 0.0), (0.05, 0.008), (0.20, 0.013), (0.35, 0.016), (1.0, 0.016)),
    cuff_rings=None, wave_amp=0.004, wave_n=8, seed=7.0, buttons=False,
)


# ---------------------------------------------------------------- helpers

def _rest(arm):
    class _K:
        def __enter__(self):
            self.p = arm.data.pose_position
            arm.data.pose_position = "REST"
            bpy.context.view_layer.update()

        def __exit__(self, *e):
            arm.data.pose_position = self.p
            bpy.context.view_layer.update()
    return _K()


def _source(ob):
    """The shirt as V8.3c shipped it; saved on first use, restored on every later one."""
    key = ob.get("v83d_src")
    if key and key in bpy.data.meshes:
        src = bpy.data.meshes[key]
        old = ob.data
        ob.data = src.copy()
        ob.data.name = src.name.replace("_v83c", "_v83d")
        if old.users == 0 and old is not src:
            bpy.data.meshes.remove(old)
    else:
        src = ob.data.copy()
        src.name = ob.data.name + "_v83c"
        src.use_fake_user = True
        ob["v83d_src"] = src.name
    return src


def _bvh_world(objs, face_ok=None):
    verts, faces = [], []
    for o in objs:
        me, mw = o.data, o.matrix_world
        base = len(verts)
        verts += [mw @ v.co for v in me.vertices]
        for p in me.polygons:
            if face_ok is None or face_ok(o, p):
                faces.append(tuple(base + i for i in p.vertices))
    return BVHTree.FromPolygons(verts, faces) if faces else None


def _profile(bvh, z, c, n):
    """Outermost radius at n angles round c at height z, nan where nothing is hit."""
    o = Vector((c[0], c[1], z))
    r = np.full(n, np.nan)
    for i in range(n):
        th = 2 * math.pi * i / n
        d = Vector((math.cos(th), math.sin(th), 0.0))
        hit = bvh.ray_cast(o + d * 0.6, -d, 0.6)[0]
        if hit:
            r[i] = (hit - o).length
    return r


def _fill(r):
    ok = ~np.isnan(r)
    if not ok.any():
        return r
    idx = np.arange(len(r))
    return np.interp(idx, idx[ok], r[ok], period=len(r))


def _smooth_periodic(r, width):
    if width < 2:
        return r
    k = np.ones(width) / width
    h = width // 2
    return np.convolve(np.concatenate([r[-h:], r, r[:h]]), k, mode="valid")[: len(r)]


def _smooth_rows(G, width_theta=7):
    G = G.copy()
    for k in range(len(G)):
        if not np.isnan(G[k]).all():
            G[k] = _smooth_periodic(_fill(G[k]), width_theta)
    with np.errstate(all="ignore"):
        return np.array([np.nanmean(G[max(0, k - 1):k + 2], axis=0) for k in range(len(G))])


def _smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def arm_weights(ob):
    """Per vertex: (weight to the left arm, weight to the right arm)."""
    names = {g.index: g.name for g in ob.vertex_groups}
    L = np.zeros(len(ob.data.vertices))
    R = np.zeros(len(ob.data.vertices))
    for v in ob.data.vertices:
        for g in v.groups:
            n = names.get(g.group, "")
            if ARM_RE.search(n):
                if "_L_" in n:
                    L[v.index] += g.weight
                else:
                    R[v.index] += g.weight
    return np.clip(L, 0, 1), np.clip(R, 0, 1)


def arm_line(arm, side):
    """World heads of the side's upper arm, forearm and hand (rest)."""
    out = []
    for part in ("Upperarm", "Forearm", "Hand"):
        rx = re.compile(rf"^CC_Base_{side}_{part}(_\d+)?$")
        b = next(b for b in arm.data.bones if rx.match(b.name))
        out.append(arm.matrix_world @ b.head_local)
    return out


def plumb_axis(arm, below):
    """(x, y) of a vertical axis: the mean of the hip, waist and spine heads under `below` (rest)."""
    rx = re.compile(r"^CC_Base_(Hip|Waist|Spine01|Spine02)(_\d+)?$")
    pts = [arm.matrix_world @ b.head_local for b in arm.data.bones if rx.match(b.name)]
    P = np.array(sorted({(round(p.x, 4), round(p.y, 4), round(p.z, 4)) for p in pts}))
    P = P[P[:, 2] < below]
    return float(P[:, 0].mean()), float(P[:, 1].mean())


def _on_line(pts, p):
    """Distance along the polyline (normalised 0..1), closest point."""
    seg = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    lens = [(b - a).length for a, b in seg]
    total = sum(lens)
    best = (1e9, 0.0, pts[0])
    acc = 0.0
    for (a, b), L in zip(seg, lens):
        d = b - a
        t = max(0.0, min(1.0, (p - a).dot(d) / (L * L)))
        q = a + d * t
        dist = (p - q).length
        if dist < best[0]:
            best = (dist, (acc + t * L) / total, q)
        acc += L
    return best[1], best[2]


def _interp(profile, t):
    xs, ys = zip(*profile)
    return float(np.interp(t, xs, ys))


def _islands(bm):
    """Linked face islands, as lists of faces."""
    seen, out = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, isl = [f], []
        seen.add(f.index)
        while stack:
            x = stack.pop()
            isl.append(x)
            for e in x.edges:
                for y in e.link_faces:
                    if y.index not in seen:
                        seen.add(y.index)
                        stack.append(y)
        out.append(isl)
    return out


class _Grid:
    """A (z, theta) grid of radii round a plumb axis, bilinear lookup."""

    def __init__(self, zs, n):
        self.zs, self.n = zs, n

    def at(self, G, z, theta):
        zs, N = self.zs, self.n
        dz = zs[1] - zs[0]
        f = (z - zs[0]) / dz
        k0 = int(max(0, min(len(zs) - 2, math.floor(f))))
        w = min(1.0, max(0.0, f - k0))
        g = (theta % (2 * math.pi)) / (2 * math.pi) * N
        i0 = int(math.floor(g)) % N
        i1 = (i0 + 1) % N
        u = g - math.floor(g)
        a = G[k0][i0] * (1 - u) + G[k0][i1] * u
        b = G[k0 + 1][i0] * (1 - u) + G[k0 + 1][i1] * u
        return a * (1 - w) + b * w


# ---------------------------------------------------------------- the build

def loosen(cfg, n_theta=180):
    ob = bpy.data.objects[cfg["shirt"]]
    arm = bpy.data.objects[cfg["arm"]]
    with _rest(arm):
        return _loosen(ob, arm, cfg, n_theta)


def _loosen(ob, arm, cfg, N):
    src = _source(ob)
    me = ob.data
    mw = ob.matrix_world.copy()
    mwi = mw.inverted()
    log = {"verts_before": len(me.vertices)}
    for name in ("custom_normal",):  # imported normals shade the old shape
        if name in me.attributes:
            me.attributes.remove(me.attributes[name])
    ax = plumb_axis(arm, cfg["z_chest"])
    th = np.arange(N) * 2 * math.pi / N
    drape_th = cfg["drape"] + (cfg["drape_back"] - cfg["drape"]) * (0.5 + 0.5 * np.sin(th))  # +y is the back
    # The sides follow the body in: the slice is widest under the armpits, and holding it out there (the drape
    # rule) pushed the torso cloth into the hanging arms.
    drape_th = drape_th + cfg["drape_side"] * np.cos(th) ** 4

    # Buttons of the source: small islands on the front.
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    buttons = []
    for isl in _islands(bm):
        if len(isl) <= BUTTON_FACES:
            vs = {v for f in isl for v in f.verts}
            c = sum((mw @ v.co for v in vs), Vector()) / len(vs)
            if c.y < ax[1]:
                buttons.append(c)
    bm.free()
    buttons.sort(key=lambda c: -c.z)

    # 3. Density first: subdividing after the cut moved the cut edge's midpoints off the plane (the smoothing),
    # which broke the boundary chain and left slits in the regrown cloth.
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    big = [isl for isl in _islands(bm) if len(isl) > BUTTON_FACES]
    # The collar and yoke stay as they are: smoothing rounds off the collar's folds (it read crumpled).
    edges = list({e for isl in big for f in isl for e in f.edges
                  if all((mw @ v.co).z < cfg["z_top"] for v in e.verts)})
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True, smooth=1.0)
    # 2. Cut.
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=mwi @ Vector((0, 0, cfg["z_cut"])),
                           plane_no=(mwi.to_3x3() @ Vector((0, 0, 1))).normalized(), clear_inner=True, dist=1e-6)
    bm.faces.ensure_lookup_table()
    # Button islands the plane cut through go too (they come back whole in step 6).
    for isl in _islands(bm):
        if len(isl) <= BUTTON_FACES and any(abs((mw @ v.co).z - cfg["z_cut"]) < 1e-4 for f in isl for v in f.verts):
            bmesh.ops.delete(bm, geom=isl, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    me.update()
    # The tuck crease was marked sharp; the collar and cuffs keep theirs.
    if "sharp_edge" in me.attributes:
        sh = me.attributes["sharp_edge"].data
        for e in me.edges:
            if all((mw @ me.vertices[i].co).z < cfg["z_cut"] + 0.06 and abs((mw @ me.vertices[i].co).x) < 0.3 for i in e.vertices):
                sh[e.index].value = False

    # 4. Ease the upper part.
    L, R = arm_weights(ob)
    torso = 1.0 - np.clip(L + R, 0, 1)
    W = np.array([(mw @ v.co)[:] for v in me.vertices])
    small = set()
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    for isl in _islands(bm):
        if len(isl) <= BUTTON_FACES:
            small |= {f.index for f in isl}
    bm.free()
    cloth_face = lambda o, p: p.index not in small and all(torso[i] > 0.6 for i in p.vertices)
    bvh_s = _bvh_world([ob], cloth_face)
    zs = np.arange(cfg["z_cut"], cfg["z_top"] + 0.12, 0.01)
    grid = _Grid(zs, N)
    S = np.array([_profile(bvh_s, z, ax, N) for z in zs])
    E = np.zeros_like(S)
    for k, z in enumerate(zs):
        if z >= cfg["z_top"]:
            e = 0.0
        elif z >= cfg["z_chest"]:
            e = cfg["ease_chest"] * _smoothstep(cfg["z_top"], cfg["z_chest"], z)
        else:
            e = cfg["ease_chest"] + (cfg["ease_waist"] - cfg["ease_chest"]) * _smoothstep(cfg["z_chest"], cfg["z_waist"], z)
        # x is the side; under the arms (armpit heights) the sides get less still: the hanging arm presses there.
        side = cfg["side"] * (1.0 - 0.6 * _smoothstep(cfg["z_waist"], cfg["z_chest"], z))
        E[k] = e * (1.0 - (1.0 - side) * np.abs(np.cos(th)))
    T = S + E
    for k in range(len(zs) - 2, -1, -1):
        if zs[k] < cfg["z_chest"]:
            T[k] = np.where(np.isnan(T[k]), T[k], np.fmax(T[k], T[k + 1] - drape_th * 0.01))
    H = _smooth_rows(T)
    lines = {"L": arm_line(arm, "L"), "R": arm_line(arm, "R")}
    for i, p in enumerate(W):
        P = Vector(p)
        move = Vector((0.0, 0.0, 0.0))
        dx, dy = p[0] - ax[0], p[1] - ax[1]
        rr = math.hypot(dx, dy)
        if torso[i] > 0 and rr > 1e-6:
            d3 = Vector((dx / rr, dy / rr, 0.0))
            o = Vector((ax[0], ax[1], p[2]))
            hit = bvh_s.ray_cast(o + d3 * 0.6, -d3, 0.6)[0]
            s_v = (hit - o).length if hit else rr
            theta = math.atan2(dy, dx)
            e_v = grid.at(E, p[2], theta)
            h_v = grid.at(H, p[2], theta)
            # The envelope (the drape fill) fades in from 4 cm above the chest line to 2 cm below it. Over the
            # shoulders the smoothed envelope reached across sharp changes of outline (shoulder cap against back)
            # and threw a vertex 5 cm out behind MJ's right shoulder; switched on hard at the chest line it creased
            # MJ's tee at the bust apex. No vertex moves more than its ease plus 4 cm (the fill under a bust).
            w_env = _smoothstep(cfg["z_chest"] + 0.04, cfg["z_chest"] - 0.02, p[2])
            if math.isnan(h_v) or w_env <= 0:
                t_v = s_v + e_v
            else:
                fill = min(max(s_v + e_v, h_v), s_v + e_v + 0.04)
                t_v = (s_v + e_v) * (1 - w_env) + fill * w_env
            move += d3 * (t_v - s_v) * torso[i]
        for s, a in (("L", L[i]), ("R", R[i])):
            if a > 0:
                t, q = _on_line(lines[s], P)
                u = P - q
                if u.length > 1e-6:
                    # The underside (down and in, in the rest A-pose) lies against the body when the arm hangs:
                    # it gets a third of the ease.
                    un = u.normalized()
                    under_ = max(0.0, un.dot(Vector((-0.45 if s == "L" else 0.45, 0.0, -0.9)).normalized()))
                    move += un * _interp(cfg["sleeve"], t) * a * (1.0 - 0.67 * under_)
        me.vertices[i].co = mwi @ (P + move)
    me.update()

    # 6. Regrow the lower part.
    bm = bmesh.new()
    bm.from_mesh(me)
    dl = bm.verts.layers.deform.active
    uvl = bm.loops.layers.uv.active
    bm.verts.ensure_lookup_table()
    cloth_v = {v for v in bm.verts if torso[v.index] > 0.9}
    cut = [e for e in bm.edges if e.is_boundary and all(abs((mw @ v.co).z - cfg["z_cut"]) < 2e-4 for v in e.verts)]
    if not cut:
        raise RuntimeError("no boundary on the cut plane")
    cut_verts = list({v for e in cut for v in e.verts})
    pol = {}
    for v in cut_verts:
        p = mw @ v.co
        pol[v] = (math.atan2(p.y - ax[1], p.x - ax[0]) % (2 * math.pi), math.hypot(p.x - ax[0], p.y - ax[1]))
    # The cut ring's outer surface, per angle.
    R0 = np.full(N, np.nan)
    for t_, r_ in pol.values():
        i = int(round(t_ / (2 * math.pi) * N)) % N
        R0[i] = r_ if np.isnan(R0[i]) else max(R0[i], r_)
    R0 = _smooth_periodic(_fill(R0), 5)

    def hem_z(theta):  # longer at the front (-y) and back (+y) than at the side seams (+-x)
        return cfg["hem_side"] - cfg["tail"] * math.sin(theta) ** 2

    z_low = cfg["hem_side"] - cfg["tail"] - 0.02
    zs2 = np.arange(cfg["z_cut"], z_low, -0.01)
    under = [bpy.data.objects[n] for n in cfg["under"]]
    bvh_u = _bvh_world(under)
    C = np.array([_profile(bvh_u, z, ax, N) + cfg["clear"] for z in zs2])
    Hd = np.zeros((len(zs2), N))
    Hd[0] = R0
    for k in range(1, len(zs2)):
        # The A-line opens at the front and back only: at the sides it opened into the hanging arms (QA).
        open_ = cfg["flare"] * np.sin(th) ** 2 if zs2[k] < cfg["z_waist"] else 0.0
        row = Hd[k - 1] - drape_th * 0.01 + open_ * 0.01
        Hd[k] = np.where(np.isnan(C[k]), row, np.fmax(row, C[k]))
    for k in range(len(zs2) - 2, -1, -1):  # bottom up: widen gradually above the garment under it
        Hd[k] = np.fmax(Hd[k], Hd[k + 1] - cfg["rise"] * 0.01)
    Hd[0] = R0
    Hd = _smooth_rows(Hd, 5)
    Hd[0] = R0
    grid2 = _Grid(zs2[::-1].copy(), N)
    Hup = Hd[::-1].copy()

    n_rings = max(1, int(math.ceil((cfg["z_cut"] - min(hem_z(t) for t in th)) / cfg["ring_dz"])))
    off = {v: pol[v][1] - float(np.interp(pol[v][0], th, R0, period=2 * math.pi)) for v in cut_verts}
    col = {v: v for v in cut_verts}
    ring = {v: 0 for v in cut_verts}
    cur = cut
    new_faces, new_verts = [], []
    for k in range(1, n_rings + 1):
        ret = bmesh.ops.extrude_edge_only(bm, edges=cur)
        verts = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
        vset = set(verts)
        new_faces += [g for g in ret["geom"] if isinstance(g, bmesh.types.BMFace)]
        for v in verts:
            prev = next(e.other_vert(v) for e in v.link_edges
                        if e.other_vert(v) not in vset and ring.get(e.other_vert(v)) == k - 1)
            top = col[prev]
            col[v] = top
            ring[v] = k
            theta = pol[top][0]
            z = cfg["z_cut"] + (hem_z(theta) - cfg["z_cut"]) * k / n_rings
            r = grid2.at(Hup, z, theta) + off[top]
            v.co = mwi @ Vector((ax[0] + r * math.cos(theta), ax[1] + r * math.sin(theta), z))
            new_verts.append(v)
        cur = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMEdge) and g.is_boundary]
    bm.normal_update()
    out = 0
    for f in new_faces:
        c = mw @ f.calc_center_median()
        n = mw.to_3x3() @ f.normal
        out += 1 if n.dot(Vector((c.x - ax[0], c.y - ax[1], 0))) > 0 else -1
    if out < 0:
        bmesh.ops.reverse_faces(bm, faces=new_faces)
    for f in new_faces:
        f.smooth = True
        for l in f.loops:  # a strip with real area; the whole shirt is re-unwrapped for the bake
            l[uvl].uv = (pol[col[l.vert]][0] / (2 * math.pi), 0.5 - 0.4 * ring[l.vert] / n_rings)
    # Weights for the new vertices from the source shirt's nearest (rest, world), inverse distance.
    sn = {g.index: g.name for g in ob.vertex_groups}
    donors = [(mw @ v.co, {sn[g.group]: g.weight for g in v.groups if g.group in sn}) for v in src.vertices]
    kd = KDTree(len(donors))
    for i, (p, _) in enumerate(donors):
        kd.insert(p, i)
    kd.balance()
    gidx = {g.name: g.index for g in ob.vertex_groups}
    for v in new_verts:
        acc = {}
        for _co, i, d in kd.find_n(mw @ v.co, 12):
            w = 1.0 / max(d, 1e-3)
            for n, x in donors[i][1].items():
                acc[n] = acc.get(n, 0.0) + x * w
        top = sorted(acc.items(), key=lambda z: -z[1])[:4]
        s = sum(x for _, x in top)
        v[dl].clear()
        for n, x in top:
            v[dl][gidx[n]] = x / s
    new_set = set(new_verts)
    log["rings"] = n_rings
    log["cut_columns"] = len(cut_verts)
    # The eased upper part and the regrown lower part meet at the cut with a small change of slope, which
    # shades as a line across the belly: relax a band round it (cloth only, not the placket edge or buttons).
    band = [v for v in bm.verts if abs((mw @ v.co).z - cfg["z_cut"]) < cfg["seam_band"]
            and not v.is_boundary and len(v.link_faces) >= 3
            and (v in cloth_v or v in new_set)]
    for _ in range(4):
        bmesh.ops.smooth_vert(bm, verts=band, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)

    # Buttons back down the placket, at the source's spacing, from the lowest one left.
    if cfg["buttons"]:
        bm.faces.ensure_lookup_table()
        left = []
        for isl in _islands(bm):
            if len(isl) <= BUTTON_FACES:
                vs = list({v for f in isl for v in f.verts})
                c = sum((mw @ v.co for v in vs), Vector()) / len(vs)
                if c.y < ax[1]:
                    left.append((c, isl))
        left.sort(key=lambda t: t[0].z)
        zs_b = [c.z for c in buttons]
        gaps = [a - b for a, b in zip(zs_b, zs_b[1:]) if a - b > 0.03]
        step = float(np.median(gaps)) if gaps else 0.085
        c0, isl0 = left[0]
        t0 = math.atan2(c0.y - ax[1], c0.x - ax[0])
        r_surf0 = grid.at(H, c0.z, t0)
        added = 0
        z = c0.z - step
        while z > hem_z(t0 % (2 * math.pi)) + 0.03:
            ret = bmesh.ops.duplicate(bm, geom=isl0)
            dv = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
            r_new = grid2.at(Hup, z, t0)
            shift = Vector((math.cos(t0), math.sin(t0), 0.0)) * (r_new - r_surf0) + Vector((0, 0, z - c0.z))
            for v in dv:
                v.co = mwi @ (mw @ v.co + shift)
            # weights from the cloth under it
            near = min(new_verts, key=lambda q: ((mw @ q.co) - (c0 + shift)).length)
            for v in dv:
                v[dl].clear()
                for gi, w in near[dl].items():
                    v[dl][gi] = w
            added += 1
            z -= step
        log["buttons_added"] = added
    bm.to_mesh(me)
    bm.free()
    me.update()

    # 7. Geometric folds.
    L, R = arm_weights(ob)
    torso = 1.0 - np.clip(L + R, 0, 1)
    seed = cfg["seed"]
    n = cfg["wave_n"]
    for v in me.vertices:
        p = mw @ v.co
        if torso[v.index] > 0.5 and p.z < cfg["z_waist"] + 0.04:
            theta = math.atan2(p.y - ax[1], p.x - ax[0])
            g = _smoothstep(cfg["z_waist"] + 0.04, hem_z(theta % (2 * math.pi)), p.z) ** 1.5
            w = 0.6 * math.sin(n * theta + seed) + 0.4 * math.sin((n + 4) * theta + 2.1 * seed + 3.0 * p.z) \
                + 0.5 * noise.noise(Vector((math.cos(theta) * 3, math.sin(theta) * 3, p.z * 4 + seed)))
            a = cfg["wave_amp"] * g * torso[v.index] * (0.5 + 0.5 * max(-1.0, min(1.0, w)))
            v.co = mwi @ (p + Vector((math.cos(theta), math.sin(theta), 0.0)) * a)
        if cfg["cuff_rings"]:
            t0, t1 = cfg["cuff_rings"]
            for s, a in (("L", L[v.index]), ("R", R[v.index])):
                if a < 0.5:
                    continue
                t, q = _on_line(lines[s], p)
                if t0 < t < t1:
                    u = p - q
                    env = math.sin(math.pi * (t - t0) / (t1 - t0))
                    rg = 0.5 + 0.5 * math.sin(2 * math.pi * t / 0.045 + 1.7 * noise.noise(p * 12))
                    if u.length > 1e-6:
                        v.co = mwi @ (p + u.normalized() * 0.0025 * env * rg * a)
    me.update()

    # 8. Smooth the weights of the loose lower torso.
    zv = np.array([(mw @ v.co).z for v in me.vertices])
    sel = [v.index for v in me.vertices if torso[v.index] > 0.9 and zv[v.index] < cfg["z_cut"] + 0.02]
    log["weights_smoothed"] = smooth_weights(ob, sel, iters=6, lam=0.5)
    log["verts_after"] = len(me.vertices)
    log["faces_after"] = len(me.polygons)
    # Spike guard: how far the eased upper part sits from the source surface (rest). The ease is at most a few cm;
    # anything well past it is a fault like the V8.3d flap behind MJ's shoulder, which only a render had shown.
    src_bvh = _bvh_world_mesh(src, mw)
    off = []
    for v in me.vertices:
        p = mw @ v.co
        if p.z > cfg["z_cut"] + 0.01:
            off.append(src_bvh.find_nearest(p)[3])
    off = np.array(off)
    log["upper_offset_mm"] = {"p99": round(float(np.percentile(off, 99)) * 1000, 1),
                              "max": round(float(off.max()) * 1000, 1),
                              "over_40mm": int((off > 0.04).sum())}
    return log


def _bvh_world_mesh(me, mw):
    return BVHTree.FromPolygons([mw @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons])


def fabric(material, normal_image=None, roughness=0.88, sheen=0.5, sheen_roughness=0.5, normal_strength=1.0):
    """
    The shirt as cloth: no colour map (the colour is a factor set at mount, outfit.ts), rough, a soft sheen, and the
    baked fold-and-weave normal map when there is one. Jake's painted-fold diffuse map goes: its folds belong to the
    tight shirt. Nodes are found by type, never by name.
    """
    m = bpy.data.materials[material]
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    for link in list(bsdf.inputs["Base Color"].links):
        nt.links.remove(link)
    for n in [n for n in nt.nodes if n.type == "TEX_IMAGE"]:
        nt.nodes.remove(n)
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Sheen Weight"].default_value = sheen
    bsdf.inputs["Sheen Roughness"].default_value = sheen_roughness
    bsdf.inputs["Sheen Tint"].default_value = (1, 1, 1, 1)
    nm = next((n for n in nt.nodes if n.type == "NORMAL_MAP"), None)
    for link in list(bsdf.inputs["Normal"].links):
        nt.links.remove(link)
    if normal_image is not None:
        if nm is None:
            nm = nt.nodes.new("ShaderNodeNormalMap")
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images[normal_image] if isinstance(normal_image, str) else normal_image
        tex.image.colorspace_settings.name = "Non-Color"
        nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
        nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    m.use_backface_culling = False
    return m


def look(root, arm_name, out_path, action=None, frame=1, aim_z=1.25, height=0.95,
         views=(0.0, 90.0, -90.0), res=(520, 620)):
    """Eevee renders of one teacher from several sides (degrees round z; 0 = front), tiled left to right."""
    import os
    import v9_render as vr
    sc = bpy.context.scene
    arm = bpy.data.objects[arm_name]
    if action:
        arm.animation_data.action = bpy.data.actions[action]
    sc.frame_set(frame)
    vr.solo(root, keep=())
    hip = arm.matrix_world @ next(b for b in arm.data.bones if b.name.startswith("CC_Base_Hip")).head_local
    tiles = []
    tmp = out_path + ".tmp.png"
    for deg in views:
        vr.frame((hip.x, hip.y, aim_z), height, facing=math.radians(deg))
        vr.shoot(tmp, res)
        tiles.append(vr._grab(tmp))
    os.remove(tmp)
    sheet = np.concatenate(tiles, axis=1)
    h, w, _ = sheet.shape
    img = bpy.data.images.new("v83d_look", w, h, alpha=True)
    img.pixels.foreach_set(sheet[::-1].ravel())
    img.filepath_raw = out_path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return out_path


def smooth_weights(ob, sel, iters=6, lam=0.5, keep=4):
    """Laplacian smoothing of the deform weights over the mesh, on `sel` only."""
    me = ob.data
    nb = [[] for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices
        nb[a].append(b)
        nb[b].append(a)
    G = len(ob.vertex_groups)
    Wt = np.zeros((len(me.vertices), G))
    for v in me.vertices:
        for g in v.groups:
            if g.group < G:
                Wt[v.index, g.group] = g.weight
    sel = np.array(sel, dtype=int)
    for _ in range(iters):
        avg = np.array([Wt[nb[i]].mean(0) if nb[i] else Wt[i] for i in sel])
        Wt[sel] = (1 - lam) * Wt[sel] + lam * avg
    for i in sel:
        i = int(i)
        row = Wt[i]
        top = [int(g) for g in np.argsort(-row)[:keep] if row[g] > 1e-4]
        s = float(row[top].sum())
        for g in {x.group for x in me.vertices[i].groups} - set(top):
            ob.vertex_groups[g].remove([i])
        for g in top:
            ob.vertex_groups[g].add([i], float(row[g] / s), "REPLACE")
    return len(sel)
