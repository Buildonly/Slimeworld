"""
Build the Slimeworld slime model, following docs/ART.md.

    blender -b -P art/blender/make_slime.py -- public/models/slime.raw.glb [preview.png]

Nodes in the exported file (Y up, the slime sits on y = 0):
  Body   - the jelly body (colour and scale are swapped in code per slime)
  Eyes   - both eyes with their shine dots, grouped so code can hide or move them
"""
import sys
import math
import bpy
import bmesh

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
out_glb = argv[0] if argv else "slime.raw.glb"
out_png = argv[1] if len(argv) > 1 else None

# Start from an empty scene.
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, colour, roughness, transmission=0.0, coat=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Transmission Weight"].default_value = transmission
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["IOR"].default_value = 1.33
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    return mat


# 1. UV sphere, Z scaled to 0.8, bottom flattened.
bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=1.0)
body = bpy.context.active_object
body.name = "Body"
me = body.data
bm = bmesh.new()
bm.from_mesh(me)
FLOOR = -0.62
for v in bm.verts:
    v.co.z *= 0.8
    if v.co.z < FLOOR:
        v.co.z = FLOOR
# Lift so the flat bottom rests on z = 0.
for v in bm.verts:
    v.co.z -= FLOOR
bm.to_mesh(me)
bm.free()

# 2. Shade smooth with a level 2 subdivision surface (applied for export).
bpy.ops.object.shade_smooth()
sub = body.modifiers.new("Subdivision", "SUBSURF")
sub.levels = 2
sub.render_levels = 2
bpy.ops.object.modifier_apply(modifier=sub.name)

# 3. Glossy jelly material (green is the common colour; code recolours per slime).
body.data.materials.append(material("Jelly", (0.34, 0.82, 0.56), roughness=0.15, transmission=0.4, coat=1.0))

# 4. Eyes: two small black spheres, each with a tiny white sphere for the shine.
ink = material("Ink", (0.02, 0.012, 0.015), roughness=0.25, coat=1.0)
shine = material("Shine", (1, 1, 1), roughness=0.3, emission=(1, 1, 1))
eyes = bpy.data.objects.new("Eyes", None)
scene.collection.objects.link(eyes)
CENTER_Z = -FLOOR  # middle of the body after lifting
for side in (-1, 1):
    x, z = side * 0.32, CENTER_Z + 0.16
    # Place the eye on the body surface (front is -Y in Blender, +Z in glTF).
    y = -math.sqrt(max(0.0, 1 - x * x - ((z - CENTER_Z) / 0.8) ** 2)) - 0.005
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1.0, location=(x, y, z))
    eye = bpy.context.active_object
    eye.name = f"Eye{'L' if side < 0 else 'R'}"
    eye.scale = (0.125, 0.07, 0.16)
    eye.rotation_euler = (0, 0, side * 0.28)
    bpy.ops.object.shade_smooth()
    eye.data.materials.append(ink)
    eye.parent = eyes
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.04, location=(x + 0.035, y - 0.065, z + 0.065))
    dot = bpy.context.active_object
    dot.name = f"Shine{'L' if side < 0 else 'R'}"
    bpy.ops.object.shade_smooth()
    dot.data.materials.append(shine)
    dot.parent = eyes

# 5. Export as glTF binary (Y up). Compression happens afterwards with glTF Transform.
bpy.ops.export_scene.gltf(
    filepath=out_glb,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)
print(f"Exported {out_glb}")

# Optional preview render (Cycles on CPU so it works headless).
if out_png:
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.95, 0.88, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    scene.world = world
    bpy.ops.mesh.primitive_plane_add(size=20)
    floor = bpy.context.active_object
    floor.data.materials.append(material("Floor", (1.0, 0.93, 0.85), roughness=0.8))
    sun = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "AREA"))
    sun.data.energy = 600
    sun.data.size = 4
    sun.location = (2.5, -3, 5)
    sun.rotation_euler = (math.radians(40), 0, math.radians(35))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.location = (0, -5.2, 1.9)
    cam.rotation_euler = (math.radians(80), 0, 0)
    cam.data.lens = 50
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.render.resolution_x = 800
    scene.render.resolution_y = 600
    scene.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_png}")
