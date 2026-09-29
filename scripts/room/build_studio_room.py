"""V8.5 rooms: the classroom GLB restyled into two rooms that share one shell.

Headless and reproducible. Reads the pre-V8.5 classroom (one merged mesh with a
single baked 4096 atlas on UVMap.001, plus a 2-tri "glass" and the emissive
"Lights" strip) and builds one of two variants:

  day      -> public/models/classroom_default.glb, "Studio": a warm, minimal
              learning studio. Only whole loose parts are removed (lockers,
              wall clock, cork boards and their notes, chalk tray) and the room
              is re-baked into the same atlas on the same UV, so it keeps its
              three draw calls.
  evening  -> public/models/classroom_alternative.glb, "Evening": the same
              shell as a one-to-one study at dusk. Every desk but the learner's
              own goes, a reading nook and pendant lamps come in (CC0 models
              from Poly Haven, see LICENSES.md), the lightmap UV is regenerated
              and everything is joined into one baked mesh plus the light strip.

Both keep every coordinate the app depends on: nothing structural moves, so
the probed desk plane (y=-0.888), the floor (y=-1.694) and the display plane
(z=-5.574) hold, and the app places both GLBs with the same transform.

UV0 ("UVMap") is the original colour-palette UV: every face's UV0 centre lands
on one swatch, so it is used as a material ID. Parts are classified from that
swatch plus their bounding box (Blender coords: Z up, room x -4.48..4.48,
y -8.28..3.62, z 0..4.17; app world = (x + 0.2, z - 1.7, -y - 2)).

Usage (Blender 5.1, from the repo root):
  blender -b --factory-startup --python scripts/room/build_studio_room.py -- \
      --src <pre-V8.5 classroom_default.glb> --out <raw.glb> [--variant day|evening]
      [--props <dir of Poly Haven 1k glTF folders>] [--res 4096] [--samples 64]
      [--atlas <atlas.png>] [--classes] [--blend <debug.blend>]
Then compress: see scripts/room/README.md.
"""

import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--variant", choices=("day", "evening"), default="day")
ap.add_argument("--props", default="", help="folder holding the Poly Haven glTF folders (evening)")
ap.add_argument("--res", type=int, default=4096)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--atlas", default="")
ap.add_argument("--classes", action="store_true", help="stop before the bake (debug)")
ap.add_argument("--blend", default="", help="save the pre-bake scene here (debug)")
ap.add_argument("--wall", default="", help="override the palette's wall colour (sRGB hex), to try options")
args = ap.parse_args(argv)
EVENING = args.variant == "evening"
if EVENING and not args.props:
    ap.error("--variant evening needs --props")


# ─── Palette (sRGB hex -> linear) ────────────────────────────────────────────

def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


# class -> (base colour, roughness).
PALETTES = {
    # Blue-grey walls, pale oak, one orange spark.
    "day": {
        "wall":       ("#6B8196", 0.9),   # blue-grey: white shirts read against it (V8.5b)
        "ceiling":    ("#F3EEE7", 0.9),
        "floor":      ("#CDBBA5", 0.55),
        "panel":      ("#C9A47A", 0.6),   # front-wall lower panelling, pale oak
        "trim":       ("#E4DACC", 0.8),
        "desk":       ("#C9A67C", 0.5),   # desk tops, pale oak
        "chair":      ("#D7794A", 0.6),   # the spark: soft terracotta shells
        "legs":       ("#E6DFD3", 0.45),  # warm white powder coat
        "feet":       ("#3A3632", 0.7),
        "frame":      ("#3A3733", 0.5),   # window and door frames
        "door":       ("#C9A67F", 0.6),
        "oak":        ("#C9A67F", 0.6),
        "dark":       ("#34312E", 0.6),   # teacher chair
        "bezel":      ("#1C1E22", 0.35),
        "plant":      ("#5E7A4A", 0.7),
        "pot":        ("#EDE6DA", 0.5),
    },
    # Night Class: deep ink walls, walnut, amber light, a rust rug as the spark.
    "evening": {
        "wall":       ("#3D4659", 0.9),
        "ceiling":    ("#343B4A", 0.9),
        "floor":      ("#8C6D52", 0.5),   # warm oak
        "panel":      ("#5E4130", 0.55),  # walnut panelling
        "trim":       ("#3D4659", 0.8),
        "desk":       ("#7A5536", 0.45),  # walnut
        "chair":      ("#C9683D", 0.6),
        "legs":       ("#2A2A2D", 0.4),   # blackened steel
        "feet":       ("#1E1E20", 0.7),
        "frame":      ("#16181D", 0.5),
        "door":       ("#5E4130", 0.55),
        "oak":        ("#6A4830", 0.55),
        "dark":       ("#26272A", 0.6),
        "bezel":      ("#0F1114", 0.35),
        "plant":      ("#4F6B3E", 0.7),
        "pot":        ("#D9CFC2", 0.5),
        "rug":        ("#8E5B45", 0.95),
        "cord":       ("#141414", 0.5),
    },
}
PALETTE = dict(PALETTES[args.variant])
if args.wall:
    PALETTE["wall"] = (args.wall, PALETTE["wall"][1])

# Bake light levels. Day is calibrated so the plaster lands near the old
# atlas's brightness: three.js lights the baked colour again at runtime.
LIGHTS = {
    "day":     {"sun": 2.4, "fill": 80.0, "strip": 3.0, "world": 0.4},
    "evening": {"sun": 0.0, "fill": 0.0, "strip": 0.6, "world": 0.8},
}
LIGHT = LIGHTS[args.variant]

# Window glass gradient (horizon -> top) and its strength.
SKY = {
    "day":     (["#F6D9BC", "#AFCBDD"], 1.4),
    "evening": (["#F2A765", "#B97A86", "#2E3F66"], 1.2),   # dusk: amber, rose, blue hour
}
SCREEN_GLOW = {"day": 0.06, "evening": 0.10}

# Books keep a hue each, pulled into the room's palette.
BOOKS = ["#D98A5E", "#E9DCC6", "#8C9A86", "#3A3733", "#C9A67F", "#B86E4B"]


# ─── Import ──────────────────────────────────────────────────────────────────

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args.src)
bpy.data.materials["BakedTextures"].name = "BakedTextures_src"  # frees the name for the export
room = bpy.data.objects["Classroom"]
glass_ob = bpy.data.objects["glass"]
lights_ob = bpy.data.objects["Lights"]
atlas_src = bpy.data.images[0]
sc = bpy.context.scene


def uv0_key(u, v):
    return f"{round(u * 50) / 50:.2f},{round(v * 50) / 50:.2f}"


# Swatch (UV0 cluster) -> class. Anything not listed is "misc".
SWATCH = {
    "0.54,0.56": "wall", "0.32,0.94": "ceiling", "0.92,0.94": "ceiling",
    "0.52,0.94": "trim",
    "0.56,0.54": "floor", "0.56,0.52": "floor",
    "0.66,0.44": "wood",          # desks, chairs and front panelling share it
    "0.68,0.94": "legs", "0.66,0.94": "legs", "0.90,0.94": "feet",
    "0.66,0.46": "panel", "0.66,0.48": "panel", "0.66,0.50": "panel", "0.66,0.42": "panel",
    "0.32,0.06": "trim", "0.32,0.08": "frame", "0.30,0.06": "frame",
    "0.32,0.04": "frame",   # window mullions
    "0.18,0.80": "glass", "0.20,0.84": "glass", "0.20,0.82": "glass", "0.18,0.82": "glass",
    "0.22,0.80": "glass", "0.16,0.82": "glass", "0.20,0.80": "glass",
    "0.70,0.44": "oak", "0.68,0.44": "oak", "0.56,0.44": "oak", "0.56,0.46": "door",
    "0.80,0.94": "bezel", "0.90,0.80": "screen",
    "0.78,0.94": "dark", "0.68,0.92": "dark",
    "0.94,0.82": "plant", "0.92,0.82": "plant", "0.94,0.84": "plant", "0.94,0.80": "plant",
    "0.56,0.94": "pot", "0.58,0.94": "pot", "0.60,0.94": "pot", "0.58,0.92": "pot",
}

# Whole loose parts inside these boxes are deleted, unless structural.
REMOVE_BOXES = {
    "lockers":    ((-4.45, 2.80, -0.05), (-2.70, 3.58, 2.30)),
    "clock":      ((-0.25, 3.30, 2.95), (0.80, 3.75, 3.80)),
    "cork_left":  ((-2.55, 3.30, 1.15), (-1.3230, 3.75, 2.95)),
    "cork_right": ((1.7310, 3.30, 1.15), (2.95, 3.75, 2.95)),
    "chalk_tray": ((-1.35, 3.30, 1.15), (1.80, 3.545, 1.32)),
}
# Structural parts are never removed. Glass is left out on purpose: the cork
# board notes share a swatch with the side-window glass.
STRUCTURAL = {"wall", "floor", "ceiling", "panel", "trim", "frame", "screen"}
BOOKSHELF = ((3.35, 3.20, -0.05), (4.45, 3.60, 2.40))

# Evening: the learner's own desk and chair (world desk centre [0, -0.888,
# -0.5], the quiz anchor) and the teacher's desk corner stay; every other
# desk, chair and their legs go.
SCHOOL_FURNITURE = {"desk", "chair", "legs", "feet"}
KEEP_FURNITURE = (
    ((-0.95, -2.50, -0.10), (0.55, -1.00, 1.30)),   # learner's desk and chair
    ((2.20, 0.70, -0.10), (4.50, 2.70, 1.40)),      # teacher's desk and chair
)


def inside(mn, mx, box):
    lo, hi = box
    return all(lo[i] <= mn[i] and mx[i] <= hi[i] for i in range(3))


# ─── Classify loose parts ────────────────────────────────────────────────────

me = room.data
bm = bmesh.new()
bm.from_mesh(me)
uv0 = bm.loops.layers.uv["UVMap"]
bm.faces.ensure_lookup_table()

parts = []
seen = set()
for f in bm.faces:
    if f.index in seen:
        continue
    stack, faces = [f], []
    seen.add(f.index)
    while stack:
        g = stack.pop()
        faces.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen:
                    seen.add(h.index)
                    stack.append(h)
    parts.append(faces)


def classify_part(faces):
    votes = {}
    for g in faces:
        c = Vector((0, 0))
        for loop in g.loops:
            c += loop[uv0].uv
        c /= len(g.loops)
        k = uv0_key(c.x, c.y)
        votes[k] = votes.get(k, 0.0) + g.calc_area()
    key = max(votes, key=votes.get)
    vs = [v.co for g in faces for v in g.verts]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    cls = SWATCH.get(key, "misc")
    if cls == "wood":
        if mn.y > 3.15:
            cls = "panel"
        elif (mx.z - mn.z) < 0.12 and 0.62 < (mn.z + mx.z) / 2 < 0.9 and (mx.x - mn.x) * (mx.y - mn.y) > 0.25:
            cls = "desk"
        elif (mx.z - mn.z) < 0.06 and 0.74 < (mn.z + mx.z) / 2 < 0.83:
            cls = "desk"          # the desk tops' edge strips
        else:
            cls = "chair"
    if cls not in STRUCTURAL:
        for name, box in REMOVE_BOXES.items():
            if inside(mn, mx, box):
                return "remove:" + name
    if EVENING and cls in SCHOOL_FURNITURE and not any(inside(mn, mx, b) for b in KEEP_FURNITURE):
        return "remove:classroom_desks"
    if EVENING and cls == "floor":
        return "remove:floor_tiles"   # replaced by one plank floor at the same height
    if cls == "misc" and inside(mn, mx, BOOKSHELF):
        cls = "book"
    return cls


classes = {}
report = {}
for faces in parts:
    cls = classify_part(faces)
    classes.setdefault(cls, []).extend(faces)
    report[cls] = report.get(cls, 0) + len(faces)
for k in sorted(report):
    print(f"CLASS {k:24s} {report[k]}")

# Delete removed parts.
dead = [f for k, fs in classes.items() if k.startswith("remove:") for f in fs]
bmesh.ops.delete(bm, geom=dead, context="FACES")
classes = {k: v for k, v in classes.items() if not k.startswith("remove:")}

# ─── Materials ───────────────────────────────────────────────────────────────


def principled(name, rgba, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Roughness"].default_value = rough
    return m, b


def add_grain(m, b, rgba, scale=(1.0, 24.0, 1.0), amount=0.025):
    """Subtle long-grain variation for wood surfaces (baked into the atlas)."""
    nt = m.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3.0
    nz.inputs["Detail"].default_value = 6.0
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = amount * 4
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    mix.inputs[6].default_value = rgba
    nt.links.new(nz.outputs["Fac"], mix.inputs[7])
    nt.links.new(mix.outputs[2], b.inputs["Base Color"])


def position_gradient(nt, axis, lo, hi):
    """A 0..1 value along one world axis, for gradients that ignore the UVs."""
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.inputs["From Min"].default_value, rng.inputs["From Max"].default_value = lo, hi
    nt.links.new(sep.outputs[axis], rng.inputs["Value"])
    return rng.outputs["Result"]


mats = {}
for cls, (hexc, rough) in PALETTE.items():
    m, b = principled("V85_" + cls, lin(hexc), rough)
    if cls in ("desk", "panel", "oak", "door"):
        add_grain(m, b, lin(hexc))
    if cls == "rug":
        add_grain(m, b, lin(hexc), scale=(30.0, 30.0, 30.0), amount=0.05)
    mats[cls] = m

# Display: a dark screen in standby, a soft warm glow low in the middle.
m, b = principled("V85_screen", lin("#15181E"), 0.3)
nt = m.node_tree
comb = nt.nodes.new("ShaderNodeCombineXYZ")
# Normalised board coords: x -1.26..1.68, z 1.27..2.83
nt.links.new(position_gradient(nt, "X", -1.26, 1.68), comb.inputs["X"])
nt.links.new(position_gradient(nt, "Z", 1.27, 2.83), comb.inputs["Y"])
# distance from a point just below the bottom edge, aspect-corrected -> radial glow
sub = nt.nodes.new("ShaderNodeVectorMath")
sub.operation = "SUBTRACT"
sub.inputs[1].default_value = (0.5, -0.25, 0.0)
nt.links.new(comb.outputs["Vector"], sub.inputs[0])
scl = nt.nodes.new("ShaderNodeVectorMath")
scl.operation = "MULTIPLY"
scl.inputs[1].default_value = (1.0, 0.75, 1.0)
nt.links.new(sub.outputs["Vector"], scl.inputs[0])
ln = nt.nodes.new("ShaderNodeVectorMath")
ln.operation = "LENGTH"
nt.links.new(scl.outputs["Vector"], ln.inputs[0])
fall = nt.nodes.new("ShaderNodeMapRange")
fall.inputs["From Min"].default_value, fall.inputs["From Max"].default_value = 0.0, 0.85
fall.inputs["To Min"].default_value, fall.inputs["To Max"].default_value = 1.0, 0.0
fall.interpolation_type = "SMOOTHSTEP"
nt.links.new(ln.outputs["Value"], fall.inputs["Value"])
b.inputs["Emission Color"].default_value = lin("#E98A52")
mul = nt.nodes.new("ShaderNodeMath")
mul.operation = "MULTIPLY"
mul.inputs[1].default_value = SCREEN_GLOW[args.variant]
nt.links.new(fall.outputs["Result"], mul.inputs[0])
nt.links.new(mul.outputs["Value"], b.inputs["Emission Strength"])
mats["screen"] = m

# Window glass: a sky gradient, low to high.
m, b = principled("V85_glass", lin("#000000"), 0.2)
nt = m.node_tree
cr = nt.nodes.new("ShaderNodeValToRGB")
stops, strength = SKY[args.variant]
while len(cr.color_ramp.elements) < len(stops):
    cr.color_ramp.elements.new(0.5)
for i, (el, h) in enumerate(zip(cr.color_ramp.elements, stops)):
    el.position = i / (len(stops) - 1)
    el.color = lin(h)
nt.links.new(position_gradient(nt, "Z", 1.1, 3.1), cr.inputs["Fac"])
nt.links.new(cr.outputs["Color"], b.inputs["Emission Color"])
b.inputs["Emission Strength"].default_value = strength
# Bake rays see the sky; light rays pass straight through (sun on the floor).
lp = nt.nodes.new("ShaderNodeLightPath")
tr = nt.nodes.new("ShaderNodeBsdfTransparent")
mixs = nt.nodes.new("ShaderNodeMixShader")
outn = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
nt.links.new(lp.outputs["Is Camera Ray"], mixs.inputs["Fac"])
nt.links.new(tr.outputs["BSDF"], mixs.inputs[1])
nt.links.new(b.outputs["BSDF"], mixs.inputs[2])
nt.links.new(mixs.outputs["Shader"], outn.inputs["Surface"])
mats["glass"] = m

# Anything unclassified keeps a calm, neutral tone.
mats["misc"] = principled("V85_misc", lin("#D9CFC2" if not EVENING else "#8A8078"), 0.7)[0]
book_mats = [principled(f"V85_book{i}", lin(h), 0.7)[0] for i, h in enumerate(BOOKS)]

# Assign.
me.materials.clear()
for k in mats:
    me.materials.append(mats[k])
for bm_ in book_mats:
    me.materials.append(bm_)
idx = {k: i for i, k in enumerate(mats)}
for cls, faces in classes.items():
    alive = [f for f in faces if f.is_valid]
    if cls == "book":
        # one colour per book, keyed on its position along the shelf
        for f in alive:
            f.material_index = len(mats) + (hash(round(f.calc_center_median().x, 1)) % len(book_mats))
        continue
    for f in alive:
        f.material_index = idx.get(cls, idx["misc"])
bm.to_mesh(me)
bm.free()
me.update()

glass_ob.data.materials.clear()
glass_ob.data.materials.append(mats["glass"])

# ─── Evening: the study's own furniture ──────────────────────────────────────

added = []   # extra mesh objects that join the baked room


def import_prop(folder):
    """Import a Poly Haven 1k glTF as one mesh object, based on the floor at its footprint centre."""
    before = set(bpy.data.objects)
    path = os.path.join(args.props, folder, f"{folder}_1k.gltf")
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    helpers = [o.name for o in new if o.type != "MESH"]   # empties the importer parents to
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # base the prop at its own footprint centre, on the floor
    vs = [v.co for v in ob.data.vertices]
    cx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2
    cy = (min(v.y for v in vs) + max(v.y for v in vs)) / 2
    z0 = min(v.z for v in vs)
    for v in ob.data.vertices:
        v.co -= Vector((cx, cy, z0))
    for name in helpers:
        bpy.data.objects.remove(bpy.data.objects[name])
    return ob


def place(ob, at, rot_deg=0.0, scale=1.0):
    ob.location = at
    ob.rotation_euler = (0.0, 0.0, math.radians(rot_deg))
    ob.scale = (scale, scale, scale)
    added.append(ob)
    return ob


def rounded_rug(name, cx, cy, sx, sy, r, h=0.012):
    """A flat wool rug with rounded corners (scripted: Poly Haven has no rug)."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy, h / 2))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (sx, sy, h)
    bpy.ops.object.transform_apply(scale=True)
    bev = ob.modifiers.new("round", "BEVEL")
    bev.affect = "VERTICES"
    bev.width = r
    bev.segments = 8
    bpy.ops.object.modifier_apply(modifier=bev.name)
    ob.data.materials.append(mats["rug"])
    added.append(ob)
    return ob


def pendant(at_xy, drop_to, energy, ceiling=4.15):
    """Poly Haven's ceiling globe hung on a cord from the ceiling."""
    lamp = import_prop("modern_ceiling_lamp_01")
    # the lamp's own base sits at z 0 after import_prop; hang it so the globe's bottom is at `drop_to`
    lamp_h = max(v.co.z for v in lamp.data.vertices)
    place(lamp, (at_xy[0], at_xy[1], drop_to))
    top = drop_to + lamp_h
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.006, depth=ceiling - top,
                                        location=(at_xy[0], at_xy[1], (ceiling + top) / 2))
    cord = bpy.context.active_object
    cord.data.materials.append(mats["cord"])
    added.append(cord)
    # the bulb: a warm point light inside the globe, a hot emissive globe
    for mat in lamp.data.materials:
        if "globe" in mat.name.lower() or "glass" in mat.name.lower():
            bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            bsdf.inputs["Emission Color"].default_value = lin("#FFC98A")
            bsdf.inputs["Emission Strength"].default_value = 6.0
    bulb = bpy.data.lights.new("V85_bulb", "POINT")
    bulb.energy = energy
    bulb.color = lin("#FFB978")[:3]
    bulb.shadow_soft_size = 0.08
    bo = bpy.data.objects.new("V85_bulb", bulb)
    sc.collection.objects.link(bo)
    bo.location = (at_xy[0], at_xy[1], drop_to - 0.06)   # just under the globe, which is opaque
    return lamp


def plank_floor(z=0.006):
    """One flat floor where the tiles were, at the tiles' top (probed y -1.694)."""
    # The full shell footprint, under the walls: the old tiled floor also closed
    # the gap below them, and without it the canvas background shows through as
    # a bright line along the wall base.
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, -2.33, z))
    ob = bpy.context.active_object
    ob.name = "V85_floor"
    ob.scale = (8.96, 11.90, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    m = mats["floor"]
    add_grain(m, next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"),
              lin(PALETTE["floor"][0]), scale=(1.5, 40.0, 1.0), amount=0.05)
    ob.data.materials.append(m)
    added.append(ob)


if EVENING:
    plank_floor()
    # A rust rug marks the one-to-one space from the learner's desk to the display.
    rounded_rug("V85_rug", 0.2, 0.0, 4.6, 5.4, 0.35)
    # Reading nook where the lockers stood, front left.
    # Plants must be real geometry: most Poly Haven plants are alpha-cut leaf
    # cards, which a single opaque baked atlas cannot show. The succulent is not.
    place(import_prop("mid_century_lounge_chair"), (-3.05, 2.2, 0.0), rot_deg=-145.0)
    place(import_prop("side_table_01"), (-2.2, 2.95, 0.0), rot_deg=10.0)
    place(import_prop("potted_plant_04"), (-2.2, 2.95, 0.55), scale=1.6)
    place(import_prop("potted_plant_04"), (-4.0, 3.1, 0.0), rot_deg=40.0, scale=3.2)
    # Warm pools of light: over the nook, the teacher's desk and the learner.
    # Kept clear of the teacher's desk (its old geometry has gaps that leak a point light into a wedge).
    pendant((-2.65, 2.3), 2.35, 70.0)
    pendant((2.0, 1.05), 2.30, 80.0)
    pendant((-0.2, -1.45), 2.60, 70.0)

# ─── Lighting ────────────────────────────────────────────────────────────────

world = bpy.data.worlds.new("V85_world")
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs["Color"].default_value = lin("#DCE5EC" if not EVENING else "#2A3552")
bg.inputs["Strength"].default_value = LIGHT["world"]
sc.world = world

if LIGHT["sun"] > 0:
    # Late-afternoon sun through the right-hand windows, soft-edged.
    sun_d = bpy.data.lights.new("V85_sun", "SUN")
    sun_d.energy = LIGHT["sun"]
    sun_d.color = lin("#FFE2C2")[:3]
    sun_d.angle = 0.12
    sun = bpy.data.objects.new("V85_sun", sun_d)
    sc.collection.objects.link(sun)
    sun.rotation_euler = (1.05, 0.0, 1.95)  # from +x, low, slightly from the back

if LIGHT["fill"] > 0:
    # Even studio fill from the ceiling (the strips read as the source).
    for i, y in enumerate((-6.0, -2.0, 1.8)):
        ad = bpy.data.lights.new(f"V85_fill{i}", "AREA")
        ad.shape = "RECTANGLE"
        ad.size, ad.size_y = 7.0, 3.2
        ad.energy = LIGHT["fill"]
        ad.color = lin("#FFF1E2")[:3]
        ao = bpy.data.objects.new(f"V85_fill{i}", ad)
        sc.collection.objects.link(ao)
        ao.location = (0.0, y, 4.05)

if EVENING:
    # A warm wash grazing down the front wall, behind the teacher and the display.
    wd = bpy.data.lights.new("V85_wash", "AREA")
    wd.shape = "RECTANGLE"
    wd.size, wd.size_y = 6.0, 0.25
    wd.energy = 300.0
    wd.color = lin("#FFC894")[:3]
    wo = bpy.data.objects.new("V85_wash", wd)
    sc.collection.objects.link(wo)
    wo.location = (0.2, 3.2, 3.95)
    wo.rotation_euler = (math.radians(25), 0.0, 0.0)   # tipped towards the wall (+y)
    # A soft, low fill so the room never drops to black.
    fd = bpy.data.lights.new("V85_lowfill", "AREA")
    fd.size, fd.size_y = 8.0, 10.0
    fd.shape = "RECTANGLE"
    fd.energy = 230.0
    fd.color = lin("#FFE7CF")[:3]
    fo = bpy.data.objects.new("V85_lowfill", fd)
    sc.collection.objects.link(fo)
    fo.location = (0.0, -1.0, 4.05)

lm = lights_ob.data.materials[0]
lb = next(n for n in lm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
lb.inputs["Emission Color"].default_value = lin("#FFF4E6")
lb.inputs["Emission Strength"].default_value = LIGHT["strip"]

if args.blend:
    bpy.ops.wm.save_as_mainfile(filepath=args.blend)

if args.classes:
    print("classes-only run; no bake")
    sys.exit(0)

# ─── Bake UV ─────────────────────────────────────────────────────────────────

bake_obs = [room, glass_ob] + added
if EVENING:
    # Deleting desks and adding props breaks the old lightmap UV: regenerate
    # one shared lightmap UV for everything that is baked.
    for ob in bake_obs:
        if "bake" not in ob.data.uv_layers:
            ob.data.uv_layers.new(name="bake")
        ob.data.uv_layers.active = ob.data.uv_layers["bake"]
    bpy.ops.object.select_all(action="DESELECT")
    for ob in bake_obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = room
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=0.002, rotate=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    bake_uv = "bake"
else:
    bake_uv = "UVMap.001"

# ─── Bake ────────────────────────────────────────────────────────────────────

try:
    sc.render.engine = "CYCLES"
except TypeError as e:
    print(e)
sc.cycles.device = "CPU"
sc.cycles.use_denoising = False
if EVENING:
    # Small bright lamps in a dark room throw fireflies that the denoiser smears
    # into blotches; clamping indirect light keeps them out of the atlas. (Day
    # was baked without it and must stay reproducible.)
    sc.cycles.sample_clamp_indirect = 2.0
sc.render.bake.margin = 16

atlas = bpy.data.images.new("V85_atlas", args.res, args.res, alpha=False, float_buffer=True)
albedo = bpy.data.images.new("V85_albedo", args.res, args.res, alpha=False, float_buffer=True)
bake_nodes = []
for ob in bake_obs:
    ob.data.uv_layers.active = ob.data.uv_layers[bake_uv]
    for m in ob.data.materials:
        if m is None or m.get("v85_bake_node"):
            continue
        m["v85_bake_node"] = True   # shared materials get one bake target, not one per user
        nt = m.node_tree
        n = nt.nodes.new("ShaderNodeTexImage")
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = bake_uv
        nt.links.new(uvn.outputs["UV"], n.inputs["Vector"])
        nt.nodes.active = n
        n.select = True
        bake_nodes.append(n)

bpy.ops.object.select_all(action="DESELECT")
for ob in bake_obs:
    ob.select_set(True)
bpy.context.view_layer.objects.active = room


def bake(img, kind, samples, **passes):
    for n in bake_nodes:
        n.image = img
    sc.cycles.samples = samples
    for k, v in passes.items():
        setattr(sc.render.bake, k, v)
    bpy.ops.object.bake(type=kind, margin=16, use_clear=True)


# Lighting (glossy left out: it is view-dependent and three.js adds its own).
bake(atlas, "COMBINED", args.samples, use_pass_direct=True, use_pass_indirect=True,
     use_pass_diffuse=True, use_pass_glossy=False, use_pass_transmission=True, use_pass_emit=True)
# Albedo guides the denoiser so material edges stay crisp.
bake(albedo, "DIFFUSE", 1, use_pass_direct=False, use_pass_indirect=False, use_pass_color=True)

stem = args.out[:-4]
for img, name in ((atlas, "_raw.exr"), (albedo, "_albedo.exr")):
    img.filepath_raw = stem + name
    img.file_format = "OPEN_EXR"
    img.save()

# Denoise (OIDN through the compositor) and write the 8-bit sRGB atlas.
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.view_settings.exposure = 0.0
sc.view_settings.gamma = 1.0
sc.render.dither_intensity = 0.0
sc.render.resolution_x = sc.render.resolution_y = args.res
sc.render.resolution_percentage = 100
ng = bpy.data.node_groups.new("V85_denoise", "CompositorNodeTree")
sc.compositing_node_group = ng
n_in = ng.nodes.new("CompositorNodeImage")
n_in.image = bpy.data.images.load(stem + "_raw.exr")
n_alb = ng.nodes.new("CompositorNodeImage")
n_alb.image = bpy.data.images.load(stem + "_albedo.exr")
n_dn = ng.nodes.new("CompositorNodeDenoise")
n_out = ng.nodes.new("NodeGroupOutput")
ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
ng.links.new(n_in.outputs["Image"], n_dn.inputs["Image"])
ng.links.new(n_alb.outputs["Image"], n_dn.inputs["Albedo"])
ng.links.new(n_dn.outputs["Image"], n_out.inputs[0])
sc.render.use_compositing = True
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_depth = "8"
atlas_path = args.atlas or stem + "_atlas.png"
sc.render.filepath = atlas_path
for ob in sc.objects:
    ob.hide_render = True
bpy.ops.render.render(write_still=True)
for ob in sc.objects:
    ob.hide_render = False
print("ATLAS", atlas_path)

# ─── Rebuild the single baked material and export ────────────────────────────

atlas_src.name = "BakedTextures_src"
baked_img = bpy.data.images.load(atlas_path)
baked_img.name = "BakedTextures"
baked = bpy.data.materials.new("BakedTextures")
baked.use_nodes = True
bb = next(n for n in baked.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
bb.inputs["Roughness"].default_value = 0.5
bb.inputs["Metallic"].default_value = 0.0
tex = baked.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = baked_img
if EVENING:
    # Exported as an emissive texture on a black, non-reflective base: three.js
    # then shows the bake as-is. The app's daylight rig (tuned for the teacher)
    # would otherwise light the dusk bake a second time, and its studio
    # environment glares off the dark floor at grazing angles.
    baked.node_tree.nodes.remove(bb)
    em = baked.node_tree.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 1.0
    baked.node_tree.links.new(tex.outputs["Color"], em.inputs["Color"])
    out = next(n for n in baked.node_tree.nodes if n.type == "OUTPUT_MATERIAL")
    baked.node_tree.links.new(em.outputs["Emission"], out.inputs["Surface"])
else:
    baked.node_tree.links.new(tex.outputs["Color"], bb.inputs["Base Color"])
for ob in bake_obs:
    ob.data.materials.clear()
    ob.data.materials.append(baked)
    # Only the bake UV ships.
    for layer in [layer.name for layer in ob.data.uv_layers if layer.name != bake_uv]:
        ob.data.uv_layers.remove(ob.data.uv_layers[layer])
    ob.data.uv_layers[0].name = "UVMap"

if EVENING:
    # One baked mesh: the room, the glass and every prop.
    bpy.ops.object.select_all(action="DESELECT")
    for ob in bake_obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = room
    bpy.ops.object.join()
    room.name = "Classroom"

# The Lights strip keeps its emissive material: white at the original 20 by
# day, a dim warm glow at dusk.
lb.inputs["Emission Color"].default_value = (1, 1, 1, 1) if not EVENING else lin("#FFD6A8")
lb.inputs["Emission Strength"].default_value = 20.0 if not EVENING else 2.0

for ob in list(bpy.data.objects):
    if ob.type == "LIGHT":
        bpy.data.objects.remove(ob)

bpy.ops.export_scene.gltf(
    filepath=args.out,
    export_format="GLB",
    export_image_format="AUTO",
    export_apply=False,
    export_lights=False,
    export_cameras=False,
)
print("EXPORTED", args.out)
