"""
Jake's sleeves from the elbow down (2026-10-14). Hmz: they read as a sweater.

What made them read that way (crops and numbers: .claude/eval/2026-10-14-jake-sleeves/):

- V8.3d eased the whole sleeve by 12-14 mm (v9_loose.JAKE["sleeve"]), so over the forearm it stands 58-61 mm off the
  arm line, as wide as at the elbow and wider than over the upper arm, about twice the forearm's own radius.
- It then shortened the sleeve 3 cm by sliding only the forearm part up the arm (`shorten`, smoothstep 0.55-0.9):
  about 10 cm of cloth squeezed into 7, so the source's folds stacked into rings above the cuff.
- The sleeve pinches in above the cuff, and the cuff is a deep rounded cup whose lower half curls in to the wrist:
  a ribbed cuff. A shirt's cuff is a straight band with a hard bottom edge, standing off the wrist.

`tailor` edits the shipped shirt in place, in the rest pose, moving vertices only: topology, UVs, the baked normal map
and the weights stay as they are, and the torso does not move (it carries no arm weight). Per side:

1. The shortening is spread over the whole sleeve instead of the forearm: each vertex's along-arm shift goes from
   3 cm x smoothstep(0.55, 0.9) of its source position t0 to 3 cm x smoothstep(`spread`). The cuff stays put.
2. A grid round the forearm bone (angle x distance along it) holds the cloth's outer envelope (the outermost radius
   per cell), the skin's radius (rays from the bone) and where the cloth ends (the cuff's rim, per angle).
3. A new envelope: from just below the elbow, a straight loft from the elbow's radius (less `elbow_take`) to the
   cuff's, blended in by `beta`; then the cuff, a band `cuff_h` long at the skin's radius plus `cuff_gap`, whose
   last 3 mm turn in at 45 degrees (the hard bottom edge). The sleeve meets it `gather` proud (the seam).
4. Every vertex moves by the change of the envelope at its cell, so the cuff's inner facing keeps its thickness; over
   the loft the single layer's ridges are also flattened by `beta * detail_kill`. No cloth comes closer to the skin
   than `clear`.

Cuff buttons ride rigidly with their nearest cloth vertex, as in v9_loose.
"""

import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

import v9_loose as VL

OLD = VL.JAKE  # the V8.3d numbers this edit takes back

OPTIONS = {
    # A tailored sleeve: narrower from the elbow down, a cuff that closes round the wrist.
    # cuff_gap 11 mm (what Hmz picked) let the right wrist through the lower cuff in seven clips once the cuff left
    # the hand bone (camera-ray test, up to 5.9 mm); 13 mm clears every frame.
    "tailored": dict(spread=(0.30, 0.95), elbow_take=0.006, cuff_gap=0.013, beta=0.85, detail_kill=0.75),
    # More room: the elbow as shipped, a looser cuff; the same straight line and hard cuff.
    "relaxed": dict(spread=(0.30, 0.95), elbow_take=0.0, cuff_gap=0.015, beta=0.75, detail_kill=0.6),
}
COMMON = dict(cuff_h=0.034, gather=0.002, clear=0.004, z_e=0.02, n_theta=24, dz=0.003, square_rim=True, hand_to_twist=1.0)
HAND = r"^CC_Base_{s}_Hand(_d+)?$"
TWIST2 = r"^CC_Base_{s}_ForearmTwist02(_d+)?$"


def hand_to_twist(ob, A, s, frac):
    """
    The cuff hung ~60% on the hand bone, so it bent with the wrist and wrapped it like a knitted cuff. A shirt's cuff
    hangs off the forearm and the hand bends inside it: the hand's weight on the sleeve goes to ForearmTwist02, which
    still follows the wrist's roll at 60% (drive_helpers). Returns how many vertices changed.
    """
    import re
    hand = next((g for g in ob.vertex_groups if re.match(HAND.format(s=s), g.name)), None)
    tw = next((g for g in ob.vertex_groups if re.match(TWIST2.format(s=s), g.name)), None)
    if hand is None or tw is None:
        raise RuntimeError(f"no hand or twist group for {s}")
    n = 0
    for v in ob.data.vertices:
        if A[v.index] <= 0.5:
            continue
        w = next((g.weight for g in v.groups if g.group == hand.index), 0.0)
        if w <= 0:
            continue
        t = next((g.weight for g in v.groups if g.group == tw.index), 0.0)
        hand.add([v.index], w * (1 - frac), "REPLACE")
        tw.add([v.index], t + w * frac, "REPLACE")
        n += 1
    return n


def _src_t(t, a, k):
    """The source t0 of a vertex now at t, given shift k * a * smoothstep(0.55, 0.9, t0) (fixed point)."""
    t0 = t
    for _ in range(8):
        t0 = t + k * a * VL._smoothstep(0.55, 0.9, t0)
    return t0


def _fill_periodic(G):
    """NaN cells: along z by interpolation within a sector, then across sectors (periodic)."""
    G = G.copy()
    nt, nz = G.shape
    zs = np.arange(nz)
    for j in range(nt):
        ok = ~np.isnan(G[j])
        if ok.sum() >= 2:
            G[j] = np.interp(zs, zs[ok], G[j][ok])
        elif ok.sum() == 1:
            G[j] = G[j][ok][0]
    th = np.arange(nt)
    for k in range(nz):
        ok = ~np.isnan(G[:, k])
        if 0 < ok.sum() < nt:
            G[:, k] = np.interp(th, th[ok], G[ok, k], period=nt)
    return G


def _smooth(G, wt=1, wz=1):
    out = G.copy()
    for _ in range(2):
        acc = np.zeros_like(out)
        n = 0
        for a in range(-wt, wt + 1):
            for b in range(-wz, wz + 1):
                sh = np.roll(out, a, axis=0)
                if b:
                    sh = np.concatenate([sh[:, :1].repeat(max(0, b), 1), sh[:, :sh.shape[1] - b]], 1) if b > 0 else \
                        np.concatenate([sh[:, -b:], sh[:, -1:].repeat(-b, 1)], 1)
                acc += sh
                n += 1
        out = acc / n
    return out


def _bilinear(G, j, k):
    nt, nz = G.shape
    j0 = math.floor(j)
    k = min(max(k, 0.0), nz - 1.0)
    k0 = min(int(k), nz - 2)
    fj, fk = j - j0, k - k0
    a, b = j0 % nt, (j0 + 1) % nt
    return ((1 - fj) * ((1 - fk) * G[a, k0] + fk * G[a, k0 + 1])
            + fj * ((1 - fk) * G[b, k0] + fk * G[b, k0 + 1]))


def _skin_bvh(body_name="CC_Base_Body.002"):
    body = bpy.data.objects[body_name]
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world
    verts = [mw @ v.co for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, faces)


def tailor(option="tailored", shirt_name=OLD["shirt"], arm_name=OLD["arm"], **over):
    o = {**COMMON, **OPTIONS[option], **over}
    ob = bpy.data.objects[shirt_name]
    arm = bpy.data.objects[arm_name]
    me = ob.data
    mw = ob.matrix_world
    mwi = mw.inverted()
    out = {"option": option}
    with VL._rest(arm):
        lines = {"L": VL.arm_line(arm, "L"), "R": VL.arm_line(arm, "R")}
        total = {s: sum((lines[s][i + 1] - lines[s][i]).length for i in range(2)) for s in lines}
        L, R = VL.arm_weights(ob)
        W = [mw @ v.co for v in me.vertices]
        skin = _skin_bvh()

        bm = bmesh.new()
        bm.from_mesh(me)
        isl = VL._islands(bm)
        buttons = [sorted({v.index for f in i for v in f.verts}) for i in isl if len(i) <= VL.BUTTON_FACES]
        bm.free()
        in_button = {i for b in buttons for i in b}

        # 1. Spread the shortening.
        new = list(W)
        for i, P in enumerate(W):
            if i in in_button:
                continue
            for s, a in (("L", L[i]), ("R", R[i])):
                if a <= 0:
                    continue
                seg = (lines[s][2] - lines[s][1]).normalized()
                t, _q = VL._on_line(lines[s], P)
                t0 = _src_t(t, a, OLD["shorten"] / total[s])
                old_shift = OLD["shorten"] * VL._smoothstep(0.55, 0.9, t0) * a
                new_shift = OLD["shorten"] * VL._smoothstep(*o["spread"], t0) * a
                new[i] = new[i] + seg * (old_shift - new_shift)

        nt, dz = o["n_theta"], o["dz"]
        for s, A in (("L", L), ("R", R)):
            e, h = lines[s][1], lines[s][2]
            ax = (h - e).normalized()
            ref = Vector((0.0, 0.0, 1.0)) if abs(ax.z) < 0.9 else Vector((1.0, 0.0, 0.0))
            e1 = ax.cross(ref).normalized()
            e2 = ax.cross(e1)

            def polar(P):
                d = P - e
                z = d.dot(ax)
                u = d - ax * z
                return z, math.atan2(u.dot(e2), u.dot(e1)) % (2 * math.pi), u.length, u

            idx = [i for i in range(len(W)) if A[i] > 0.5 and i not in in_button]
            pol = {i: polar(new[i]) for i in idx}
            idx = [i for i in idx if pol[i][0] > o["z_e"] - 0.012]
            if not idx:
                continue
            z_lo = o["z_e"] - 0.012
            z_hi = max(pol[i][0] for i in idx) + dz
            nz = int(math.ceil((z_hi - z_lo) / dz)) + 1
            jt = lambda th: th / (2 * math.pi) * nt  # noqa: E731
            kz = lambda z: (z - z_lo) / dz  # noqa: E731

            # 2. Envelope, rim and skin.
            E = np.full((nt, nz), np.nan)
            rim = np.full(nt, np.nan)
            for i in idx:
                z, th, r, _u = pol[i]
                j, k = int(round(jt(th))) % nt, int(round(kz(z)))
                E[j, k] = r if np.isnan(E[j, k]) else max(E[j, k], r)
                rim[j] = z if np.isnan(rim[j]) else max(rim[j], z)
            E = _smooth(_fill_periodic(E))
            ok = ~np.isnan(rim)
            rim = np.interp(np.arange(nt), np.arange(nt)[ok], rim[ok], period=nt)
            # A periodic median over 11 angles first: the left cuff's per-angle maximum dips 15-31 mm over five angles
            # (sparse cells), and taken as the rim it put the cuff band 3 cm up the sleeve there, unsmoothed.
            rim = np.array([np.median(np.roll(rim, -j)[np.r_[0:6, nt - 5:nt]]) for j in range(nt)])
            rim = (np.roll(rim, 1) + rim + np.roll(rim, -1)) / 3
            # A shirt's cuff ends square to the forearm; the source's is slanted along it. The band is stretched per
            # angle to the median rim, from nothing above the cuff to all of it at the rim.
            rim_t = float(np.median(rim))
            out.setdefault("rims", {})[s] = [round(float(x) * 1000) for x in rim]
            # Up to 8 mm; a deeper notch in the rim (the left cuff has one, 15-31 mm over five of 24 angles, the right
            # only a 7 mm dip: in the shipped mesh) is left as it is rather than stretched across.
            d = rim_t - rim
            dzr = np.sign(d) * np.minimum(np.abs(d), 0.008) * np.clip(1 - (np.abs(d) - 0.008) / 0.006, 0, 1)
            if not o["square_rim"]:
                dzr = np.zeros(nt)
            S = np.full((nt, nz), np.nan)
            for j in range(nt):
                th = 2 * math.pi * j / nt
                d = (e1 * math.cos(th) + e2 * math.sin(th)).normalized()
                for k in range(nz):
                    c = e + ax * (z_lo + k * dz)
                    hit = skin.ray_cast(c, d, 0.06)
                    if hit[0] is not None:
                        S[j, k] = hit[3]
            S_f = _fill_periodic(S)

            # 3. The new envelope.
            k_e = int(round(kz(o["z_e"])))
            R_e = E[:, k_e] - o["elbow_take"]
            R_c = np.zeros(nt)
            for j in range(nt):
                zc = rim[j] - o["cuff_h"] / 2
                R_c[j] = (S_f[j, int(round(kz(zc)))] if not np.isnan(S_f[j, int(round(kz(zc)))]) else E[j, int(round(kz(zc)))] - 0.01) + o["cuff_gap"]
            R_c = (np.roll(R_c, 1) + 2 * R_c + np.roll(R_c, -1)) / 4
            N = E.copy()
            B = np.zeros_like(E)  # how much the single layer's detail is flattened
            for j in range(nt):
                z_top = rim[j] - o["cuff_h"]
                for k in range(nz):
                    z = z_lo + k * dz
                    if z < o["z_e"]:
                        continue
                    if z < z_top:
                        s_ = (z - o["z_e"]) / max(1e-6, z_top - o["z_e"])
                        loft = R_e[j] + (R_c[j] + o["gather"] - R_e[j]) * s_
                        b = o["beta"] * VL._smoothstep(o["z_e"], o["z_e"] + 0.03, z)
                        N[j, k] = (1 - b) * E[j, k] + b * loft
                        B[j, k] = b * o["detail_kill"]
                    else:
                        N[j, k] = R_c[j] - max(0.0, z - (rim[j] - 0.003))
            D = N - E

            # 4. Move.
            worst = 0.0
            for i in idx:
                z, th, r, u = pol[i]
                if z < o["z_e"] - 0.006:
                    continue
                j, k = jt(th), kz(z)
                env = _bilinear(E, j, k)
                res = r - env
                b = _bilinear(B, j, k) if res > -0.003 else 0.0
                r_new = env + _bilinear(D, j, k) + res * (1 - b)
                sk = _bilinear(S_f, j, k)
                if not np.isnan(sk):
                    r_new = max(r_new, sk + o["clear"])
                a = min(1.0, A[i])
                r_new = r + (r_new - r) * a
                worst = max(worst, abs(r_new - r))
                jr = j % nt
                j0 = int(math.floor(jr)) % nt
                fr = jr - math.floor(jr)
                rim_v = (1 - fr) * rim[j0] + fr * rim[(j0 + 1) % nt]
                dz_v = (1 - fr) * dzr[j0] + fr * dzr[(j0 + 1) % nt]
                z_new = z + dz_v * VL._smoothstep(rim_v - o["cuff_h"] - 0.012, rim_v - 0.004, z) * a
                sk = _bilinear(S_f, j, kz(z_new))  # the skin where the vertex ends up, too
                if not np.isnan(sk):
                    r_new = max(r_new, sk + o["clear"])
                if u.length > 1e-9:
                    new[i] = e + ax * z_new + u.normalized() * r_new
            out[s] = {"verts": len(idx), "max_move_mm": round(worst * 1000, 1),
                      "elbow_r_mm": round(float(np.mean(R_e)) * 1000, 1),
                      "cuff_r_mm": round(float(np.mean(R_c)) * 1000, 1),
                      "skin_at_cuff_mm": round(float(np.mean(R_c - o["cuff_gap"])) * 1000, 1),
                      "rim_z_mm": [round(float(rim.min()) * 1000, 1), round(float(rim.max()) * 1000, 1)],
                      "hand_to_twist": hand_to_twist(ob, A, s, o["hand_to_twist"]) if o["hand_to_twist"] else 0}

        for i, Q in enumerate(new):
            me.vertices[i].co = mwi @ Q
        # Buttons ride rigidly with their nearest cloth vertex.
        cloth = [i for i in range(len(W)) if i not in in_button]
        kd = KDTree(len(cloth))
        for i in cloth:
            kd.insert(W[i], i)
        kd.balance()
        for b in buttons:
            c = sum((W[i] for i in b), Vector()) / len(b)
            j = kd.find(c)[1]
            dlt = new[j] - W[j]
            for i in b:
                me.vertices[i].co = mwi @ (W[i] + dlt)
        me.update()
    return out
