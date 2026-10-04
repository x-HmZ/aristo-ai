"""
The loosened shirts' cloth detail (V8.3d): fine folds, baked to one tangent-space
normal map per shirt.

The geometry carries the big shapes (ease, the hanging hem, its waves; v9_loose).
What a real shirt also has, and a 8-10k vertex mesh cannot, is small folds where
the cloth gathers. Those are baked. A weave was tried (step 3, `weave=True`) and
dropped: a weave fine enough for shirting is under four texels of a 2048 map, so
it baked as moire, and the clamp for bake misses flattened patches of it. The
matte look comes from the material (roughness 0.88, sheen; v9_loose.fabric).

1. The shirt is re-unwrapped (smart project): the grown hem had a placeholder
   strip, and Jake's old layout fed a fold-painted colour map that is gone.
2. A copy is subdivided twice and displaced by authored folds, each where cloth
   folds on a person: soft vertical drape above the hem, shallow horizontal
   wrinkles round the waist, diagonal pulls from the armpits, creases at the
   inner elbow, stacked rings above the cuffs, short-sleeve hem rolls (MJ), and
   a faint all-over crumple so no area reads as plastic.
3. Optionally (off) the copy's material adds a weave as a bump: crossed fine
   waves in world space, continuous over UV seams.
4. Cycles bakes normals from the copy to the shirt (selected to active).

Amplitudes are in metres in the rest pose. They are small on purpose: the map
should read as cloth up close and as a soft, matte surface at landing distance.
"""

import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Vector, noise

import v9_loose as VL

FOLDS = {
    "Jake": dict(drape=0.0018, waist=0.0007, armpit=0.0010, elbow=(0.58, 0.0015),
                 cuff=(0.66, 0.88, 0.0013), sleeve_hem=None, crumple=0.0004),
    "MJ": dict(drape=0.0016, waist=0.0006, armpit=0.0009, elbow=None,
               cuff=None, sleeve_hem=(0.22, 0.33, 0.0009), crumple=0.0004),
}


def _ridge(v):
    """Ridged noise in 0..1: soft-crested folds, irregular because the noise is."""
    return (1.0 - abs(noise.noise(v))) ** 2


def _cfg(teacher):
    return VL.JAKE if teacher == "Jake" else VL.MJ


def unwrap(ob, angle=66.0, margin=0.006):
    """Smart-project the whole shirt into its active UV layer (object mode on return)."""
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.hide_viewport = False
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    # The bake and glTF use the active layer; drop any other.
    me = ob.data
    act = me.uv_layers.active.name
    for l in [l for l in me.uv_layers if l.name != act]:
        me.uv_layers.remove(l)


def fold_field(teacher, ax, p):
    """Displacement (metres, along the normal) of a rest-pose torso point on the shirt; ax is the plumb axis."""
    F = FOLDS[teacher]
    cfg = _cfg(teacher)
    theta = math.atan2(p.y - ax[1], p.x - ax[0])
    d = 0.0
    # Soft vertical drape above the hem: ridges about 3 cm apart round the body, 20 cm long.
    hem = cfg["hem_side"] - cfg["tail"] * math.sin(theta) ** 2
    g = VL._smoothstep(cfg["z_waist"] + 0.06, hem, p.z)
    if g > 0:
        d += F["drape"] * g * _ridge(Vector((math.cos(theta) * 5.0, math.sin(theta) * 5.0, p.z * 5.0)))
    # Shallow horizontal wrinkles round the waist, stronger at the back and sides.
    wz = math.exp(-(((p.z - cfg["z_waist"]) / 0.05) ** 2))
    if wz > 0.01:
        back = 0.6 + 0.4 * max(0.0, math.sin(theta))
        d += F["waist"] * wz * back * _ridge(Vector((p.x * 6.0, p.y * 6.0, p.z * 38.0)))
    return d


def _arm_terms(teacher, F, lines, L, R, i, p, n):
    d = 0.0
    for s, a in (("L", L[i]), ("R", R[i])):
        if a < 0.3:
            continue
        t, q = VL._on_line(lines[s], p)
        u = (p - q)
        if u.length < 1e-6:
            continue
        u.normalize()
        # Arm-local coordinates for stretched noise: along the arm (t) and round it (u). Ridges run round the arm.
        ring = lambda k_along, k_round: Vector((t * k_along, u.x * k_round + u.z * 0.5 * k_round, u.y * k_round))
        if F["elbow"]:
            te, amp = F["elbow"]
            front = max(0.0, u.dot(Vector((0, -1, 0))))  # the inner elbow faces forward in the rest pose
            win = math.exp(-(((t - te) / 0.06) ** 2))
            d += amp * a * win * front ** 1.5 * _ridge(ring(45.0, 2.5))
        if F["cuff"]:
            t0, t1, amp = F["cuff"]
            if t0 < t < t1:
                env = math.sin(math.pi * (t - t0) / (t1 - t0))
                d += amp * a * env * _ridge(ring(38.0, 2.0))
        if F["sleeve_hem"]:
            t0, t1, amp = F["sleeve_hem"]
            if t0 < t < t1:
                env = math.sin(math.pi * (t - t0) / (t1 - t0))
                d += amp * a * env * _ridge(ring(32.0, 2.0))
    return d


def _pits(arm):
    out = []
    for side in ("L", "R"):
        sh = VL.arm_line(arm, side)[0]
        out.append(Vector((sh.x * 0.85, sh.y, sh.z - 0.07)))
    return out


def _armpit_terms(F, pits, torso_w, p):
    """Diagonal pulls radiating from each armpit over the chest and back."""
    d = 0.0
    if torso_w < 0.5:
        return d
    for pit in pits:
        w = p - pit
        r = math.hypot(w.x, w.z)
        if r < 0.02 or r > 0.18:
            continue
        phi = math.atan2(w.z, w.x)
        fall = math.sin(math.pi * (r - 0.02) / 0.16)
        d += F["armpit"] * torso_w * fall * _ridge(Vector((phi * 3.0, r * 6.0, p.y * 4.0)))
    return d


def build_high(teacher, levels=2):
    """A subdivided, fold-displaced copy of the shirt (rest pose, world-aligned), for the bake."""
    cfg = _cfg(teacher)
    ob = bpy.data.objects[cfg["shirt"]]
    arm = bpy.data.objects[cfg["arm"]]
    F = FOLDS[teacher]
    name = ob.name + "_v83d_high"
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.meshes.remove(old.data)
    with VL._rest(arm):
        me = ob.data.copy()
        hi = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(hi)
        hi.matrix_world = ob.matrix_world.copy()
        mod = hi.modifiers.new("sub", "SUBSURF")
        mod.levels = mod.render_levels = levels
        mod.uv_smooth = "PRESERVE_BOUNDARIES"
        bpy.context.view_layer.objects.active = hi
        with bpy.context.temp_override(object=hi):
            bpy.ops.object.modifier_apply(modifier="sub")
        L, R = VL.arm_weights(hi)
        torso = 1 - np.clip(L + R, 0, 1)
        lines = {"L": VL.arm_line(arm, "L"), "R": VL.arm_line(arm, "R")}
        mw, mwi = hi.matrix_world, hi.matrix_world.inverted()
        nm = mw.to_3x3().inverted().transposed()
        ax = VL.plumb_axis(arm, cfg["z_chest"])
        pits = _pits(arm)
        me.update()
        for v in me.vertices:
            p = mw @ v.co
            n = (nm @ v.normal).normalized()
            d = 0.0
            if torso[v.index] > 0.5:
                d += fold_field(teacher, ax, p) * torso[v.index]
                d += _armpit_terms(F, pits, torso[v.index], p)
            d += _arm_terms(teacher, F, lines, L, R, v.index, p, n)
            d += F["crumple"] * noise.noise(p * 12.0)
            v.co = mwi @ (p + n * d)
        me.update()
        hi.vertex_groups.clear()
    return hi


def _plain_material(name="v83d_plain"):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    return m


def _weave_material(obj_scale=None, name="v83d_weave", period=0.003, strength=0.4):
    """
    A plain weave as bump: two crossed fine waves in object space. Object coordinates are in the shirt's local
    units (Jake's object scale is 0.011), so the period is given in metres and divided through: the first bake
    used the local units as metres and its weave, a few hundredths of a millimetre, averaged to nothing.
    3 mm is about four texels of the 2048 map, which the shirt keeps (v9_postprocess --full-size).
    """
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfDiffuse")
    coord = nt.nodes.new("ShaderNodeNewGeometry")  # world position: metres, and world X and Z on every shirt
    w1 = nt.nodes.new("ShaderNodeTexWave")
    w2 = nt.nodes.new("ShaderNodeTexWave")
    w3 = nt.nodes.new("ShaderNodeTexWave")
    for w, axis in ((w1, "X"), (w2, "Z"), (w3, "Y")):
        w.wave_type = "BANDS"
        w.bands_direction = axis
        w.inputs["Scale"].default_value = 1.0 / period
        w.inputs["Distortion"].default_value = 0.6
        w.inputs["Detail"].default_value = 0.0
        nt.links.new(coord.outputs["Position"], w.inputs["Vector"])
    # (X + Y) x Z: a grid on the front and back (X across) and on the sides and sleeves (Y across).
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    nt.links.new(w1.outputs["Fac"], add.inputs[0])
    nt.links.new(w3.outputs["Fac"], add.inputs[1])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    nt.links.new(add.outputs["Value"], mul.inputs[0])
    nt.links.new(w2.outputs["Fac"], mul.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = 0.0004
    nt.links.new(mul.outputs["Value"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def flatten(img, ob, arm, cfg, margin_px=6):
    """
    Flat normals (no folds) on the collar and yoke, the button placket and the buttons. Their layers make any
    selected-to-active bake unreliable, and none of them should fold.
    """
    from mathutils.bvhtree import BVHTree  # noqa: F401  (kept with the other bake helpers)
    W, H = img.size
    px = np.empty(W * H * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(H, W, 4)
    me = ob.data
    mw = ob.matrix_world
    ax = VL.plumb_axis(arm, cfg["z_chest"])
    uv = me.uv_layers.active.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    small = set()
    for isl in VL._islands(bm):
        if len(isl) <= VL.BUTTON_FACES:
            small |= {f.index for f in isl}
    bm.free()
    with VL._rest(arm):
        P = [mw @ v.co for v in me.vertices]
    nm = mw.to_3x3().inverted().transposed()
    bvh = VL._bvh_world([ob])
    n_flat = 0
    for poly in me.polygons:
        ps = [P[i] for i in poly.vertices]
        c = sum(ps, Vector()) / len(ps)
        collar = min(p.z for p in ps) > cfg["z_top"] - 0.01 and abs(c.x - ax[0]) < 0.2
        placket = c.y < ax[1] and abs(c.x - ax[0]) < 0.03
        # Any face with another layer of the shirt close along its normal (collar points on the chest, cuff
        # over sleeve): the bake's rays reach the other layer there.
        n = (nm @ poly.normal).normalized()
        layered = False
        for sgn in (1, -1):
            h = bvh.ray_cast(c + n * sgn * 0.0005, n * sgn, 0.012)
            if h[0] is not None and h[2] != poly.index:
                layered = True
                break
        if not (collar or placket or layered or poly.index in small):
            continue
        n_flat += 1
        loops = list(poly.loop_indices)
        T = [np.array(uv[l].uv) * (W, H) for l in loops]
        for k in range(1, len(T) - 1):
            a, b, cc = T[0], T[k], T[k + 1]
            x0 = int(max(0, min(a[0], b[0], cc[0]) - margin_px)); x1 = int(min(W - 1, max(a[0], b[0], cc[0]) + margin_px))
            y0 = int(max(0, min(a[1], b[1], cc[1]) - margin_px)); y1 = int(min(H - 1, max(a[1], b[1], cc[1]) + margin_px))
            if x1 < x0 or y1 < y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = (b[1] - cc[1]) * (a[0] - cc[0]) + (cc[0] - b[0]) * (a[1] - cc[1])
            if abs(d) < 1e-9:
                continue
            l1 = ((b[1] - cc[1]) * (xs - cc[0]) + (cc[0] - b[0]) * (ys - cc[1])) / d
            l2 = ((cc[1] - a[1]) * (xs - cc[0]) + (a[0] - cc[0]) * (ys - cc[1])) / d
            l3 = 1 - l1 - l2
            # inside, grown by the margin (in barycentric terms, roughly a pixel ring per margin step)
            e = margin_px / max(1.0, np.linalg.norm(b - a), np.linalg.norm(cc - a))
            inside = (l1 > -e) & (l2 > -e) & (l3 > -e)
            blk = px[y0:y1 + 1, x0:x1 + 1]
            blk[inside] = (0.5, 0.5, 1.0, 1.0)
    img.pixels.foreach_set(px.ravel())
    img.update()
    return n_flat


def _raster_flat(px, W, H, uv, poly, margin_px=2):
    T = [np.array(uv[l].uv) * (W, H) for l in poly.loop_indices]
    for k in range(1, len(T) - 1):
        a, b, cc = T[0], T[k], T[k + 1]
        x0 = int(max(0, min(a[0], b[0], cc[0]) - margin_px)); x1 = int(min(W - 1, max(a[0], b[0], cc[0]) + margin_px))
        y0 = int(max(0, min(a[1], b[1], cc[1]) - margin_px)); y1 = int(min(H - 1, max(a[1], b[1], cc[1]) + margin_px))
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (b[1] - cc[1]) * (a[0] - cc[0]) + (cc[0] - b[0]) * (a[1] - cc[1])
        if abs(d) < 1e-9:
            continue
        l1 = ((b[1] - cc[1]) * (xs - cc[0]) + (cc[0] - b[0]) * (ys - cc[1])) / d
        l2 = ((cc[1] - a[1]) * (xs - cc[0]) + (a[0] - cc[0]) * (ys - cc[1])) / d
        e = margin_px / max(1.0, np.linalg.norm(b - a), np.linalg.norm(cc - a))
        inside = (l1 > -e) & (l2 > -e) & (1 - l1 - l2 > -e)
        px[y0:y1 + 1, x0:x1 + 1][inside] = (0.5, 0.5, 1.0, 1.0)


def flatten_unfolded(teacher, img, min_fold=0.0003):
    """
    Flat wherever no fold was authored (the summed fold amplitude at the face under `min_fold`, the crumple left
    out). The twice-subdivided bake copy rounds high-curvature areas differently from the shipped mesh, and that
    difference baked in as marks (under MJ's bust); only the authored folds belong in the map.
    """
    cfg = _cfg(teacher)
    ob = bpy.data.objects[cfg["shirt"]]
    arm = bpy.data.objects[cfg["arm"]]
    F = FOLDS[teacher]
    W, H = img.size
    px = np.empty(W * H * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(H, W, 4)
    me = ob.data
    mw = ob.matrix_world
    uv = me.uv_layers.active.data
    L, R = VL.arm_weights(ob)
    torso = 1 - np.clip(L + R, 0, 1)
    lines = {"L": VL.arm_line(arm, "L"), "R": VL.arm_line(arm, "R")}
    ax = VL.plumb_axis(arm, cfg["z_chest"])
    pits = _pits(arm)
    n = 0
    with VL._rest(arm):
        P = [mw @ v.co for v in me.vertices]
    for poly in me.polygons:
        amp = 0.0
        for i in poly.vertices:
            p = P[i]
            d = 0.0
            if torso[i] > 0.5:
                d += abs(fold_field(teacher, ax, p)) * torso[i] + _armpit_terms(F, pits, torso[i], p)
            d += abs(_arm_terms(teacher, F, lines, L, R, i, p, None))
            amp = max(amp, d)
        if amp < min_fold:
            _raster_flat(px, W, H, uv, poly)
            n += 1
    img.pixels.foreach_set(px.ravel())
    img.update()
    return n


def clean(img, max_tilt=22.0):
    """
    Two kinds of bad texel, both flat afterwards: the background between UV islands (black, which texture filtering
    bled into the seams as dark patches and, after the resize to 1024, would bleed further), and bake misses (a ray
    that met the far side: MJ's side seam and bust showed them as white specks). The folds are shallow, so no real
    texel tilts past about 20 degrees; under 1% did, all of them misses.
    """
    W, H = img.size
    a = np.empty(W * H * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    a = a.reshape(-1, 4)
    tilt = np.degrees(np.arccos(np.clip(2 * a[:, 2] - 1, -1, 1)))
    bad = (a[:, 2] < 0.35) | (tilt > max_tilt)
    a[bad] = (0.5, 0.5, 1.0, 1.0)
    img.pixels.foreach_set(a.ravel())
    img.update()
    return int(bad.sum())


def bake(teacher, out_dir, size=2048, levels=2, weave=False):
    """Unwrap, build the folded copy, bake its normals (with the weave) onto the shirt, wire the fabric material."""
    cfg = _cfg(teacher)
    ob = bpy.data.objects[cfg["shirt"]]
    arm = bpy.data.objects[cfg["arm"]]
    sc = bpy.context.scene
    unwrap(ob)
    hi = build_high(teacher, levels)
    hi.data.materials.clear()
    # The weave is off (V8.3d): at 4 texels a period it baked as moire, and the bake-miss clamp then flattened
    # patches of it. Kept as an option; the cloth reads as matte from roughness and sheen.
    hi.data.materials.append(_weave_material() if weave else _plain_material())
    img_name = f"{teacher}_shirt_normal"
    img = bpy.data.images.get(img_name)
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(img_name, size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    mat = ob.data.materials[0]
    nt = mat.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.nodes.active = tex
    old_engine = sc.render.engine
    try:
        sc.render.engine = "CYCLES"
    except TypeError:
        pass
    sc.cycles.samples = 4
    bk = sc.render.bake
    bk.use_selected_to_active = True
    # Short rays: the collar folds over itself and the placket and buttons are layered; longer rays found the
    # other layer and baked dark blotches there.
    bk.cage_extrusion = 0.005
    bk.max_ray_distance = 0.01
    bk.margin = 8
    bk.normal_space = "TANGENT"
    with VL._rest(arm):
        for o in bpy.context.selected_objects:
            o.select_set(False)
        for o in (hi, ob):
            o.hide_viewport = False
            o.hide_render = False
            o.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type="NORMAL")
    sc.render.engine = old_engine
    flatten(img, ob, arm, cfg)
    # flatten_unfolded is not used: its flat faces met folded ones in visible patches (Jake's forearm), and the
    # marks it was for (MJ's bust) were geometry, fixed in v9_loose.
    clean(img)
    path = os.path.join(out_dir, f"{img_name}.png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    nt.nodes.remove(tex)
    bpy.data.meshes.remove(hi.data)
    img.reload()
    VL.fabric(mat.name, normal_image=img)
    return path
