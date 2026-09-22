"""
V9.1 face rig helpers for the Canino3d (Character Creator 4) teachers.

Two jobs, both pure geometry, both re-runnable:

1. `transfer_shapes` -- copy shape keys from one mesh onto another that has the
   same surface but a different vertex order. Sketchfab's GLB conversion drops
   morph targets and splits the body by material, so the woman's clean mesh
   arrives with no face rig while the author's FBX keeps all 69 shapes on a
   body whose forearms are warped in the rest pose. The head is identical
   between the two files to 0.66 mm, so the face deltas transfer exactly;
   matching is by nearest neighbour after a similarity fit on the shared
   skeleton, and any vertex without a partner inside `tol` is left alone.

2. `bake_visemes` -- collapse Character Creator's 8-viseme mouth set plus its
   expression shapes into the 15 Oculus names the app already drives
   (`viseme_aa` ... `viseme_U`, see AVATURN_VISEMES in Teacher.tsx), plus
   `mouthSmile` and `eyeBlinkLeft`/`eyeBlinkRight`.

   Baking rather than mapping at runtime is what keeps Teacher.tsx untouched:
   it looks morph targets up by name on every skinned mesh, so a GLB that
   carries those names needs no new code. It also cuts the exported morph
   targets from 69 to 18, which is most of the file size on a 14k-vertex head.

   CC's own `Open` viseme only moves the lips 3 mm; the jaw drop lives in the
   expression shape `Mouth_Open` (16 mm). That is why `viseme_aa` is built from
   both, and why a naive 15 -> 8 name map produces a mouth that never opens.
"""

import numpy as np
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

# The 15 names Teacher.tsx drives, plus the two ARKit targets it uses for the
# blink loop and the resting smile. Weights are on Character Creator shapes.
RECIPES = {
    "viseme_sil": {},
    "viseme_PP":  {"Explosive": 1.0, "Mouth_Lips_Tight": 0.35},
    "viseme_FF":  {"Dental_Lip": 1.0, "Mouth_Bottom_Lip_Under": 0.30},
    "viseme_TH":  {"Mouth_Open": 0.30, "Lip_Open": 0.45, "Tongue_Out": 0.75},
    "viseme_DD":  {"Mouth_Open": 0.26, "Lip_Open": 0.45, "Tongue_up": 0.50},
    "viseme_kk":  {"Mouth_Open": 0.32, "Lip_Open": 0.30, "Tongue_Lower": 0.40},
    "viseme_CH":  {"Affricate": 0.85, "Mouth_Open": 0.15},
    # /s/ is teeth nearly together behind parted lips. The first recipe had no
    # jaw or lip parting and rendered as a closed mouth (V9.1c audit); the
    # added terms are 0.6x viseme_DD, tongue raised behind the teeth included.
    "viseme_SS":  {"Wide": 0.55, "Mouth_Lips_Part": 0.35, "Mouth_Lips_Tight": 0.20,
                   "Mouth_Open": 0.156, "Lip_Open": 0.27, "Tongue_up": 0.30},
    "viseme_nn":  {"Mouth_Open": 0.24, "Lip_Open": 0.45, "Tongue_Raise": 0.60},
    "viseme_RR":  {"Tight_O": 0.38, "Mouth_Open": 0.22},
    "viseme_aa":  {"Mouth_Open": 1.00, "Open": 1.00},
    "viseme_E":   {"Mouth_Open": 0.45, "Wide": 0.50},
    # /i/ is a spread mouth with the teeth showing. Spread alone rendered as a
    # closed slit (V9.1c audit), so 0.5x viseme_DD is added to part the lips.
    "viseme_I":   {"Wide": 0.90, "Mouth_Widen": 0.60, "Mouth_Widen_Sides": 0.40,
                   "Mouth_Open": 0.31, "Mouth_Lips_Part": 0.30, "Lip_Open": 0.225,
                   "Tongue_up": 0.25},
    "viseme_O":   {"Tight_O": 0.70, "Mouth_Open": 0.42},
    "viseme_U":   {"Tight": 0.85, "Mouth_Open": 0.12},
    "mouthSmile":    {"Mouth_Smile": 1.0},
    "eyeBlinkLeft":  {"Eye_Blink_L": 1.0},
    "eyeBlinkRight": {"Eye_Blink_R": 1.0},
}

BAKED = set(RECIPES)


def _co(kb, n):
    a = np.empty(n * 3, dtype=np.float64)
    kb.data.foreach_get("co", a)
    return a.reshape(n, 3)


def umeyama(X, Y):
    """Similarity transform (scale, rotation, translation) taking X onto Y."""
    mx, my = X.mean(0), Y.mean(0)
    Xc, Yc = X - mx, Y - my
    U, S, Vt = np.linalg.svd(Xc.T @ Yc / len(X))
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    R = Vt.T @ np.diag([1, 1, d]) @ U.T
    s = (S * np.array([1, 1, d])).sum() / (Xc ** 2).sum() * len(X)
    return s, R, my - s * (R @ mx)


def fit_armatures(src_arm, dst_arm, name_of):
    """
    Fit `src_arm`'s rest skeleton onto `dst_arm`'s, ignoring bones that
    disagree. Returns the transform and the bones it threw out.

    The outliers are the diagnosis, not noise: on the Canino woman 92 of 101
    bones land on top of each other exactly and the 9 that do not are the
    forearm chain and a stray UpperJaw -- which is precisely the part of her
    FBX body that is visibly melted.
    """
    dn = {b.name: b for b in dst_arm.data.bones}
    pairs = [(b.name, name_of(b.name)) for b in src_arm.data.bones
             if name_of(b.name) in dn]
    P = np.array([(src_arm.matrix_world @ src_arm.data.bones[a].head_local)[:] for a, _ in pairs])
    Q = np.array([(dst_arm.matrix_world @ dn[b].head_local)[:] for _, b in pairs])

    keep = np.ones(len(P), bool)
    for _ in range(6):
        s, R, t = umeyama(P[keep], Q[keep])
        res = np.linalg.norm((s * (R @ P.T)).T + t - Q, axis=1)
        keep = res < max(0.01, 3 * np.median(res[keep]))
    M = Matrix([[s * R[0, 0], s * R[0, 1], s * R[0, 2], t[0]],
                [s * R[1, 0], s * R[1, 1], s * R[1, 2], t[1]],
                [s * R[2, 0], s * R[2, 1], s * R[2, 2], t[2]],
                [0, 0, 0, 1]])
    dropped = [(pairs[i][0], float(res[i])) for i in np.argsort(-res) if not keep[i]]
    return M, dropped, float(res[keep].max())


def transfer_shapes(src, targets, M, tol=0.002):
    """
    Copy every shape key on `src` onto each mesh in `targets`, matching
    vertices by position after `M` and rotating the deltas into each target's
    own local space. A key that moves nothing on a given target is skipped, so
    the eyelash mesh does not collect 68 empty mouth shapes.
    """
    sm = src.data
    ns = len(sm.vertices)
    world = M @ src.matrix_world
    kd = KDTree(ns)
    for i, v in enumerate(sm.vertices):
        kd.insert(world @ v.co, i)
    kd.balance()

    kbs = sm.shape_keys.key_blocks
    basis = _co(kbs[0], ns)
    deltas = {kb.name: _co(kb, ns) - basis for kb in kbs[1:]}
    linear = np.array(M.to_3x3() @ src.matrix_world.to_3x3())

    out = []
    for tob in targets:
        tm = tob.data
        nt = len(tm.vertices)
        idx = np.empty(nt, dtype=np.int64)
        dist = np.empty(nt)
        for i, v in enumerate(tm.vertices):
            _, j, d = kd.find(tob.matrix_world @ v.co)
            idx[i], dist[i] = j, d
        xform = np.array(tob.matrix_world.to_3x3().inverted()) @ linear

        if tm.shape_keys is None:
            tob.shape_key_add(name="Basis", from_mix=False)
        tbasis = _co(tm.shape_keys.key_blocks[0], nt)

        added = 0
        for name, d in deltas.items():
            dt = d[idx] @ xform.T
            dt[dist > tol] = 0.0
            if np.abs(dt).max() < 1e-7:
                continue
            kb = tm.shape_keys.key_blocks.get(name) or tob.shape_key_add(name=name, from_mix=False)
            kb.data.foreach_set("co", (tbasis + dt).ravel())
            kb.slider_min, kb.slider_max, kb.value = 0.0, 1.0, 0.0
            added += 1
        tm.update()
        out.append((tob.name, nt, int((dist > tol).sum()), added, float(dist.max())))
    return out


def bake_visemes(meshes, recipes=RECIPES):
    """
    Add the 18 app-facing shape keys to every mesh that any of them moves.
    Idempotent: source deltas are read before the baked keys, so re-running
    with edited weights overwrites cleanly.
    """
    out = []
    for o in meshes:
        me = o.data
        if not me.shape_keys:
            continue
        n = len(me.vertices)
        kbs = me.shape_keys.key_blocks
        basis = _co(kbs[0], n)
        src = {kb.name: _co(kb, n) - basis for kb in kbs[1:] if kb.name not in BAKED}
        added = []
        for tgt, rec in recipes.items():
            d = np.zeros((n, 3))
            for k, w in rec.items():
                if k in src:
                    d += w * src[k]
            if tgt != "viseme_sil" and np.abs(d).max() < 1e-9:
                continue
            kb = kbs.get(tgt) or o.shape_key_add(name=tgt, from_mix=False)
            kb.data.foreach_set("co", (basis + d).ravel())
            kb.slider_min, kb.slider_max, kb.value = 0.0, 1.0, 0.0
            added.append(tgt)
        me.update()
        out.append((o.name, added))
    return out


def drop_source_shapes(meshes):
    """Remove the Character Creator shapes, keeping Basis and the baked set."""
    removed = 0
    for o in meshes:
        me = o.data
        if not me.shape_keys:
            continue
        for kb in [k for k in me.shape_keys.key_blocks[1:] if k.name not in BAKED]:
            o.shape_key_remove(kb)
            removed += 1
    return removed
