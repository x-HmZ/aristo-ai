"""
build_avaturn_animations.py — Blender 4.x script
================================================

Builds a clean animations_Avaturn.glb from Mixamo Y_Bot FBX files.

Because Y_Bot already uses the standard Mixamo skeleton (mixamorig:Hips,
mixamorig:Spine, etc.) and Avaturn exports the *same* skeleton without the
"mixamorig:" prefix, the import is a 1:1 bone name match — no retarget
constraints, no visual-keying workarounds.  The resulting GLB has perfect
arm/wrist/hand motion with no twist-bone artifacts.


────────────────────────────────────────────────────────────────────────
STEP 1 — Download Mixamo animations
────────────────────────────────────────────────────────────────────────

1. Go to https://www.mixamo.com (free Adobe account).
2. Search for and download EACH clip below as:
      Character: Y Bot
      Format: FBX Binary (.fbx) / FBX 7.4
      Skin: Without Skin  ← important: mesh is not needed and just wastes space
      Frame rate: 30 fps

   Clip name (Mixamo search term)         → save as filename in INPUT_DIR
   ─────────────────────────────────────────────────────────────────────
   Idle Standing             (calm idle)  → Idle.fbx
   Idle Standing 2           (breathing)  → Idle2.fbx
   Idle Fidgeting                         → Idle3.fbx
   Neutral Idle              (minimal)    → Idle4.fbx
   Standing Arguing          (talking)    → Talking.fbx
   Lecturing                 (talking)    → Talking2.fbx
   Happy Talk                             → Talking3.fbx
   Explaining                             → Talking4.fbx
   Talking While Standing                 → Talking5.fbx
   Standing Greeting                      → Talking6.fbx
   Thinking                               → Thinking.fbx
   Thoughtful Head Shake     (thinking)   → Thinking2.fbx
   Pointing                  (forward)    → Pointing.fbx
   Yes                       (nodding)    → Nodding.fbx
   Shaking Hands             ("no" shake) → ShakeNo.fbx
   Clapping                               → Clapping.fbx

   (Total: 16 FBX files, ~0.3–0.6 MB each — WITHOUT Skin is correct here,
    the Y_Bot mesh is discarded immediately after import anyway)

3. Place all 16 FBX files into:
      <project_root>/scripts/y_bot_animations/

   The project root is detected automatically from this script's location.


────────────────────────────────────────────────────────────────────────
STEP 2 — Run this script in Blender
────────────────────────────────────────────────────────────────────────

Option A — Blender Text Editor (recommended):
  1. Open Blender 4.x (any new file).
  2. Switch one area to "Text Editor", open this file, click "Run Script".
  3. Wait for "Done!" in the Blender console (Info log).

Option B — Blender headless (CLI):
  blender --background --python scripts/build_avaturn_animations.py

Output: <project_root>/public/models/animations_Avaturn.glb
"""

import bpy
import os
import sys

# ─── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR   = os.path.dirname(os.path.realpath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
INPUT_DIR    = os.path.join(SCRIPT_DIR, "y_bot_animations")
OUTPUT_PATH  = os.path.join(PROJECT_ROOT, "public", "models", "animations_Avaturn.glb")

# Each entry: (filename_without_extension, nla_strip_name_in_output_glb)
CLIPS = [
    ("Idle",      "Idle"),
    ("Idle2",     "Idle2"),
    ("Idle3",     "Idle3"),
    ("Idle4",     "Idle4"),
    ("Talking",   "Talking"),
    ("Talking2",  "Talking2"),
    ("Talking3",  "Talking3"),
    ("Talking4",  "Talking4"),
    ("Talking5",  "Talking5"),
    ("Talking6",  "Talking6"),
    ("Thinking",  "Thinking"),
    ("Thinking2", "Thinking2"),
    ("Pointing",  "Pointing"),
    ("Nodding",   "Nodding"),
    ("ShakeNo",   "ShakeNo"),
    ("Clapping",  "Clapping"),
]

MIXAMO_PREFIX = "mixamorig:"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def log(msg):
    print(f"[build_avaturn_animations] {msg}")
    sys.stdout.flush()


def strip_mixamo_prefix(armature_obj):
    """Rename bones from 'mixamorig:Hips' → 'Hips' on an imported Y_Bot rig."""
    for bone in armature_obj.data.bones:
        if bone.name.startswith(MIXAMO_PREFIX):
            bone.name = bone.name[len(MIXAMO_PREFIX):]
    for pbone in armature_obj.pose.bones:
        if pbone.name.startswith(MIXAMO_PREFIX):
            pbone.name = pbone.name[len(MIXAMO_PREFIX):]


def import_and_push_clip(fbx_path, strip_name, target_armature):
    """
    Import one Y_Bot FBX, strip the Mixamo prefix, rename its action to
    strip_name, then push the action to an NLA strip on target_armature.
    Returns the imported action or None on failure.
    """
    log(f"  importing {os.path.basename(fbx_path)} → '{strip_name}'")
    bpy.ops.import_scene.fbx(
        filepath=fbx_path,
        use_anim=True,
        ignore_leaf_bones=False,
        automatic_bone_orientation=False,
    )

    # The newly imported objects are selected after import
    imported_arma = None
    for obj in bpy.context.selected_objects:
        if obj.type == "ARMATURE":
            imported_arma = obj
            break

    if imported_arma is None:
        log(f"  WARNING: no armature found in {fbx_path}, skipping")
        for obj in bpy.context.selected_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
        return None

    # Strip prefix so bone names match Avaturn
    strip_mixamo_prefix(imported_arma)

    # Grab the action (there should be exactly one per Y_Bot FBX)
    action = imported_arma.animation_data.action if imported_arma.animation_data else None
    if action is None:
        log(f"  WARNING: no action in {fbx_path}, skipping")
        bpy.data.objects.remove(imported_arma, do_unlink=True)
        return None

    # Rename the action to the target strip name
    action.name = strip_name

    # Push to NLA on the target armature so it bakes into the GLB export
    if target_armature.animation_data is None:
        target_armature.animation_data_create()

    nla_track = target_armature.animation_data.nla_tracks.new()
    nla_track.name = strip_name
    # Find a free start frame (pack them back-to-back)
    existing_strips = [
        s for t in target_armature.animation_data.nla_tracks for s in t.strips
    ]
    start_frame = max((s.frame_end for s in existing_strips), default=0) + 4
    nla_strip = nla_track.strips.new(strip_name, int(start_frame), action)
    nla_strip.name = strip_name

    # Remove imported Y_Bot mesh/armature — we only needed the action
    for obj in list(bpy.context.selected_objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    return action


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    log(f"Input dir:  {INPUT_DIR}")
    log(f"Output:     {OUTPUT_PATH}")

    if not os.path.isdir(INPUT_DIR):
        log(f"ERROR: Input directory not found: {INPUT_DIR}")
        log("Create it and add your Y_Bot FBX downloads. See STEP 1 above.")
        return

    missing = [name for name, _ in CLIPS if not os.path.isfile(os.path.join(INPUT_DIR, f"{name}.fbx"))]
    if missing:
        log(f"ERROR: Missing FBX files: {missing}")
        log("Download them from Mixamo (see STEP 1) and place in the input dir.")
        return

    # Clear the scene
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    # Create a minimal target armature — GLB export needs an armature owner for NLA tracks.
    bpy.ops.object.armature_add(location=(0, 0, 0))
    target_arma = bpy.context.object
    target_arma.name = "AvaturnRig"

    imported_actions = []
    for (filename, strip_name) in CLIPS:
        fbx_path = os.path.join(INPUT_DIR, f"{filename}.fbx")
        action = import_and_push_clip(fbx_path, strip_name, target_arma)
        if action:
            imported_actions.append(action)

    log(f"Imported {len(imported_actions)} / {len(CLIPS)} clips")

    # Select only the target armature for export
    bpy.ops.object.select_all(action="DESELECT")
    target_arma.select_set(True)
    bpy.context.view_layer.objects.active = target_arma

    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    # Export as GLB — animations only, no meshes needed
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=True,
        export_frame_range=False,
        export_def_bones=True,
        export_morph=False,
        export_materials="NONE",
        export_image_format="NONE",
    )

    log(f"Done! Written to {OUTPUT_PATH}")
    log("Replace public/models/animations_Avaturn.glb with this file and reload /learn.")


main()
