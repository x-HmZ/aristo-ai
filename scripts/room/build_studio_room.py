"""V8.5 room restyle: the classroom GLB becomes a warm, minimal learning studio.

Headless and reproducible. Reads the pre-V8.5 classroom (one merged mesh with a
single baked 4096 atlas on UVMap.001, plus a 2-tri "glass" and the emissive
"Lights" strip), restyles it and re-bakes the same atlas, so the room keeps its
three draw calls and every coordinate the app depends on:

  - only whole loose parts are removed (lockers, wall clock, cork boards and
    their notes, chalk tray); nothing structural moves or is added
  - floor, desk tops, walls and the board stay where they are, so the probed
    desk plane (y=-0.888), the floor (y=-1.694) and the board plane hold
  - the chalkboard's own two faces become the display, the board frame its bezel

UV0 ("UVMap") is the original colour-palette UV: every face's UV0 centre lands
on one swatch, so it is used as a material ID. Parts are classified from that
swatch plus their bounding box (Blender coords: Z up, room x -4.48..4.48,
y -8.28..3.62, z 0..4.17; app world = (x + 0.2, z - 1.7, -y - 2)).

Usage (Blender 5.1, from the repo root):
  blender -b --factory-startup --python scripts/room/build_studio_room.py -- \
      --src <pre-V8.5 classroom_default.glb> --out <raw.glb> [--res 4096]
      [--samples 256] [--atlas <atlas.png>] [--classes]
Then compress: see scripts/room/README.md.
"""

import argparse
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=4096)
ap.add_argument("--samples", type=int, default=256)
ap.add_argument("--atlas", default="")
ap.add_argument("--classes", action="store_true", help="flat class colours, no bake (debug)")
ap.add_argument("--blend", default="", help="save the pre-bake scene here (debug)")
args = ap.parse_args(argv)


# ─── Palette (sRGB hex -> linear) ────────────────────────────────────────────

def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


# class -> (base colour, roughness). Warm plaster, pale oak, one orange spark.
PALETTE = {
    "wall":       ("#E9DFD1", 0.9),
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
}
# Bake light levels. Calibrated so the plaster lands near the old atlas's
# brightness: three.js lights the baked colour again at runtime.
LIGHT = {"sun": 2.4, "fill": 80.0, "strip": 3.0, "world": 0.4}

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


def uv0_key(u, v):
    return f"{round(u * 50) / 50:.2f},{round(v * 50) / 50:.2f}"


# Swatch (UV0 cluster) -> class. Anything not listed falls to classify_misc().
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
                return "remove:" + name, key, mn, mx
    for name, box in REMOVE_BOXES.items():
        lo, hi = box
        if all(mn[i] <= hi[i] and lo[i] <= mx[i] for i in range(3)):
            print(f"KEPT-NEAR {name}: {cls} {key} n={len(faces)} mn={tuple(round(v, 2) for v in mn)} mx={tuple(round(v, 2) for v in mx)}")
    if cls == "misc" and inside(mn, mx, BOOKSHELF):
        cls = "book"
    return cls, key, mn, mx


classes = {}
report = {}
for faces in parts:
    cls, key, mn, mx = classify_part(faces)
    classes.setdefault(cls, []).extend(faces)
    report[cls] = report.get(cls, 0) + len(faces)
for k in sorted(report):
    print(f"CLASS {k:18s} {report[k]}")

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
    """Subtle long-grain variation for oak surfaces (baked into the atlas)."""
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


mats = {}
for cls, (hexc, rough) in PALETTE.items():
    m, b = principled("V85_" + cls, lin(hexc), rough)
    if cls in ("desk", "panel", "oak", "door"):
        add_grain(m, b, lin(hexc))
    mats[cls] = m

# Display: a dark screen in standby, a soft warm glow low in the middle.
m, b = principled("V85_screen", lin("#15181E"), 0.3)
nt = m.node_tree
geo = nt.nodes.new("ShaderNodeNewGeometry")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
# Normalised board coords: x -1.26..1.68, z 1.27..2.83
mx_ = nt.nodes.new("ShaderNodeMapRange")
mx_.inputs["From Min"].default_value, mx_.inputs["From Max"].default_value = -1.26, 1.68
mz_ = nt.nodes.new("ShaderNodeMapRange")
mz_.inputs["From Min"].default_value, mz_.inputs["From Max"].default_value = 1.27, 2.83
nt.links.new(sep.outputs["X"], mx_.inputs["Value"])
nt.links.new(sep.outputs["Z"], mz_.inputs["Value"])
comb = nt.nodes.new("ShaderNodeCombineXYZ")
nt.links.new(mx_.outputs["Result"], comb.inputs["X"])
nt.links.new(mz_.outputs["Result"], comb.inputs["Y"])
# distance from (0.5, -0.1) in board space, aspect-corrected -> radial glow
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
nt.links.new(fall.outputs["Result"], b.inputs["Emission Strength"])
# scale glow down: route through a multiply
mul = nt.nodes.new("ShaderNodeMath")
mul.operation = "MULTIPLY"
mul.inputs[1].default_value = 0.06
nt.links.new(fall.outputs["Result"], mul.inputs[0])
nt.links.new(mul.outputs["Value"], b.inputs["Emission Strength"])
mats["screen"] = m

# Window glass: a soft sky, pale blue high, warm near the horizon.
m, b = principled("V85_glass", lin("#000000"), 0.2)
nt = m.node_tree
geo = nt.nodes.new("ShaderNodeNewGeometry")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
rmp = nt.nodes.new("ShaderNodeMapRange")
rmp.inputs["From Min"].default_value, rmp.inputs["From Max"].default_value = 1.1, 3.1
nt.links.new(sep.outputs["Z"], rmp.inputs["Value"])
cr = nt.nodes.new("ShaderNodeValToRGB")
cr.color_ramp.elements[0].color = lin("#F6D9BC")
cr.color_ramp.elements[1].color = lin("#AFCBDD")
nt.links.new(rmp.outputs["Result"], cr.inputs["Fac"])
nt.links.new(cr.outputs["Color"], b.inputs["Emission Color"])
b.inputs["Emission Strength"].default_value = 1.4
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

# Anything unclassified keeps a calm, desaturated version of its old look.
mats["misc"] = principled("V85_misc", lin("#D9CFC2"), 0.7)[0]
book_mats = [principled(f"V85_book{i}", lin(h), 0.7)[0] for i, h in enumerate(BOOKS)]

# Assign.
me.materials.clear()
order = list(mats.keys()) + [bm_.name for bm_ in book_mats]
for k in mats:
    me.materials.append(mats[k])
for bm_ in book_mats:
    me.materials.append(bm_)
idx = {k: i for i, k in enumerate(mats)}
bi = 0
for cls, faces in classes.items():
    alive = [f for f in faces if f.is_valid]
    if cls == "book":
        # one colour per loose part, cycling through the book palette
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

# ─── Lighting ────────────────────────────────────────────────────────────────

sc = bpy.context.scene
world = bpy.data.worlds.new("V85_world")
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs["Color"].default_value = lin("#DCE5EC")
bg.inputs["Strength"].default_value = LIGHT["world"]
sc.world = world

# Late-afternoon sun through the right-hand windows, soft-edged.
sun_d = bpy.data.lights.new("V85_sun", "SUN")
sun_d.energy = LIGHT["sun"]
sun_d.color = lin("#FFE2C2")[:3]
sun_d.angle = 0.12
sun = bpy.data.objects.new("V85_sun", sun_d)
sc.collection.objects.link(sun)
sun.rotation_euler = (1.05, 0.0, 1.95)  # from +x, low, slightly from the back

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

lm = lights_ob.data.materials[0]
lb = next(n for n in lm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
lb.inputs["Emission Color"].default_value = lin("#FFF4E6")
lb.inputs["Emission Strength"].default_value = LIGHT["strip"]

if args.blend:
    bpy.ops.wm.save_as_mainfile(filepath=args.blend)

# ─── Bake ────────────────────────────────────────────────────────────────────

if args.classes:
    print("classes-only run; no bake")
    sys.exit(0)

try:
    sc.render.engine = "CYCLES"
except TypeError as e:
    print(e)
sc.cycles.device = "CPU"
sc.cycles.use_denoising = False
sc.render.bake.margin = 16

bake_uv = "UVMap.001"
atlas = bpy.data.images.new("V85_atlas", args.res, args.res, alpha=False, float_buffer=True)
albedo = bpy.data.images.new("V85_albedo", args.res, args.res, alpha=False, float_buffer=True)
bake_nodes = []
for ob in (room, glass_ob):
    ob.data.uv_layers.active = ob.data.uv_layers[bake_uv]
    for m in ob.data.materials:
        nt = m.node_tree
        n = nt.nodes.new("ShaderNodeTexImage")
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = bake_uv
        nt.links.new(uvn.outputs["UV"], n.inputs["Vector"])
        nt.nodes.active = n
        n.select = True
        bake_nodes.append(n)

bpy.ops.object.select_all(action="DESELECT")
room.select_set(True)
glass_ob.select_set(True)
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
baked.node_tree.links.new(tex.outputs["Color"], bb.inputs["Base Color"])
for ob in (room, glass_ob):
    ob.data.materials.clear()
    ob.data.materials.append(baked)
    # Only the bake UV ships (the palette UV is dead weight now).
    ob.data.uv_layers.remove(ob.data.uv_layers["UVMap"])
    ob.data.uv_layers[0].name = "UVMap"

# The Lights strip keeps its original emissive material untouched.
lb.inputs["Emission Color"].default_value = (1, 1, 1, 1)
lb.inputs["Emission Strength"].default_value = 20.0

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
