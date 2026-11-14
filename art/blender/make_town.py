"""
Build the Slimeworld market town kit: a cosy, low poly set in warm light.

    blender -b -P art/blender/make_town.py -- public/models/town.raw.glb [preview.png]

Nodes in the exported file (Y up, metres, each kit piece centred on x = z = 0):
  Stall     - wooden market stall; materials AwningA/AwningB are recoloured per shop,
              child "Boards" is shown when the shop is closed, "Sign" carries the name
  Lantern   - lamp post; material LanternGlow glows at night
  Tree      - round friendly tree
  Fountain  - plaza centrepiece; material Water
  Crate, Barrel, Bench - props
  Ground    - round cobbled plaza
"""
import sys
import math
import random
import bpy
import bmesh

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
out_glb = argv[0] if argv else "town.raw.glb"
out_png = argv[1] if len(argv) > 1 else None
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
MATS = {}


def mat(name, colour, roughness=0.7, metallic=0.0, emission=None, strength=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*colour, 1)
    b.inputs["Roughness"].default_value = roughness
    b.inputs["Metallic"].default_value = metallic
    if emission:
        b.inputs["Emission Color"].default_value = (*emission, 1)
        b.inputs["Emission Strength"].default_value = strength
    MATS[name] = m
    return m


WOOD = mat("Wood", (0.55, 0.33, 0.18), 0.8)
WOOD_DARK = mat("WoodDark", (0.36, 0.2, 0.11), 0.85)
STONE = mat("Stone", (0.78, 0.74, 0.68), 0.9)
STONE_DARK = mat("StoneDark", (0.62, 0.58, 0.53), 0.9)
LEAF = mat("Leaf", (0.34, 0.66, 0.36), 0.8)
LEAF_LIGHT = mat("LeafLight", (0.5, 0.78, 0.42), 0.8)
METAL = mat("Metal", (0.18, 0.17, 0.2), 0.4, 0.6)
GLOW = mat("LanternGlow", (1.0, 0.82, 0.45), 0.3, emission=(1.0, 0.7, 0.3), strength=3.0)
WATER = mat("Water", (0.45, 0.75, 0.95), 0.05)
AWN_A = mat("AwningA", (0.92, 0.35, 0.35), 0.75)
AWN_B = mat("AwningB", (0.98, 0.94, 0.86), 0.75)
SIGN = mat("Sign", (0.95, 0.88, 0.7), 0.8)
GROUND = mat("Ground", (0.86, 0.79, 0.68), 0.95)


def box(name, size, loc, material, parent=None, bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def cyl(name, r, h, loc, material, parent=None, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc)
    o = bpy.context.active_object
    o.name = name
    # Smooth sides, crisp flat caps (plain smooth shading turns big caps black).
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def blob(name, r, loc, material, parent=None, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def empty(name, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    scene.collection.objects.link(e)
    return e


# ---------- Stall ----------
stall = empty("Stall")
box("Counter", (2.2, 0.9, 0.9), (0, 0.15, 0.45), WOOD, stall)
box("CounterTop", (2.35, 1.0, 0.08), (0, 0.15, 0.92), WOOD_DARK, stall)
for x in (-1.05, 1.05):
    for y in (-0.35, 0.6):
        box("Post", (0.1, 0.1, 2.3), (x, y, 1.15), WOOD_DARK, stall, bevel=0.01)
# Striped awning: alternating stripes tilted towards the front, with a scalloped edge.
stripes = 8
for i in range(stripes):
    x = -1.2 + (i + 0.5) * (2.4 / stripes)
    s = box(f"Awning{i}", (2.4 / stripes, 1.4, 0.05), (x, 0.0, 2.35), AWN_A if i % 2 == 0 else AWN_B, stall, bevel=0.0)
    s.rotation_euler = (math.radians(-14), 0, 0)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=2.4 / stripes / 2, location=(x, -0.68, 2.15))
    sc = bpy.context.active_object
    sc.name = f"Scallop{i}"
    sc.scale = (1, 0.35, 0.6)
    sc.data.materials.append(AWN_A if i % 2 == 0 else AWN_B)
    sc.parent = stall
sign = box("Sign", (1.3, 0.08, 0.38), (0, -0.42, 2.75), SIGN, stall)
box("SignFrame", (1.42, 0.06, 0.48), (0, -0.39, 2.75), WOOD_DARK, stall)
# Goods on the counter.
for i in range(5):
    blob("Goods", 0.1 + random.random() * 0.04, (-0.8 + i * 0.4, -0.1, 1.03), mat(f"Goods{i}", [(0.9, 0.3, 0.4), (0.95, 0.75, 0.3), (0.5, 0.75, 0.95), (0.6, 0.85, 0.4), (0.95, 0.55, 0.75)][i], 0.5), stall, sub=1)
# Boards across the front when a shop is closed.
boards = empty("Boards")
boards.parent = stall
for i, (z, rot) in enumerate([(0.55, 8), (1.4, -10), (1.9, 6)]):
    b = box(f"Board{i}", (2.5, 0.08, 0.22), (0, -0.55, z), WOOD_DARK, boards)
    b.rotation_euler = (0, math.radians(rot), 0)

# ---------- Lantern ----------
lantern = empty("Lantern")
cyl("Pole", 0.05, 2.6, (0, 0, 1.3), METAL, lantern, verts=10)
box("LampTop", (0.32, 0.32, 0.06), (0, 0, 2.86), METAL, lantern, bevel=0.01)
box("LampGlass", (0.24, 0.24, 0.3), (0, 0, 2.68), GLOW, lantern, bevel=0.01)
cyl("Foot", 0.14, 0.12, (0, 0, 0.06), METAL, lantern, verts=10)

# ---------- Tree ----------
tree = empty("Tree")
cyl("Trunk", 0.16, 1.4, (0, 0, 0.7), WOOD_DARK, tree, verts=10)
blob("Crown", 0.9, (0, 0, 1.9), LEAF, tree)
blob("Crown2", 0.6, (0.45, 0.2, 2.35), LEAF_LIGHT, tree)
blob("Crown3", 0.55, (-0.4, -0.25, 2.2), LEAF_LIGHT, tree)

# ---------- Fountain ----------
fountain = empty("Fountain")
cyl("Basin", 1.4, 0.45, (0, 0, 0.22), STONE, fountain, verts=32)
cyl("Water", 1.25, 0.05, (0, 0, 0.42), WATER, fountain, verts=32)
cyl("Column", 0.22, 1.2, (0, 0, 0.9), STONE_DARK, fountain, verts=16)
cyl("Bowl", 0.6, 0.18, (0, 0, 1.5), STONE, fountain, verts=24)
blob("Top", 0.22, (0, 0, 1.75), WATER, fountain)

# ---------- Props ----------
crate = empty("Crate")
box("CrateBox", (0.6, 0.6, 0.6), (0, 0, 0.3), WOOD, crate, bevel=0.03)
for z in (0.15, 0.45):
    box("CrateBand", (0.64, 0.64, 0.06), (0, 0, z), WOOD_DARK, crate, bevel=0.01)
barrel = empty("Barrel")
cyl("BarrelBody", 0.32, 0.8, (0, 0, 0.4), WOOD, barrel)
for z in (0.15, 0.65):
    cyl("Hoop", 0.335, 0.05, (0, 0, z), METAL, barrel)
bench = empty("Bench")
box("Seat", (1.4, 0.4, 0.08), (0, 0, 0.45), WOOD, bench)
for x in (-0.55, 0.55):
    box("Leg", (0.08, 0.36, 0.45), (x, 0, 0.22), WOOD_DARK, bench, bevel=0.01)

# ---------- Ground ----------
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=14, fill_type="NGON", location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = "Ground"
ground.data.materials.append(GROUND)
bm = bmesh.new()
bm.from_mesh(ground.data)
bmesh.ops.inset_region(bm, faces=bm.faces[:], thickness=0.6, depth=0.0)
bm.to_mesh(ground.data)
bm.free()
# Scatter a few darker cobbles for texture.
cobbles = empty("Cobbles")
cobbles.parent = ground
for i in range(140):
    a = random.random() * math.tau
    r = 2 + random.random() * 11
    c = box("Cobble", (0.35 + random.random() * 0.2, 0.3 + random.random() * 0.2, 0.03), (math.cos(a) * r, math.sin(a) * r, 0.02), STONE_DARK, cobbles, bevel=0.0)
    c.rotation_euler = (0, 0, random.random() * math.pi)

PLASTER = mat("Plaster", (0.96, 0.9, 0.78), 0.9)
ROOF_A = mat("RoofA", (0.84, 0.36, 0.26), 0.75)
WINDOW = mat("WindowGlow", (1.0, 0.85, 0.55), 0.4, emission=(1.0, 0.72, 0.35), strength=1.5)
GRASS = mat("Grass", (0.5, 0.74, 0.38), 0.95)
PAPER = mat("Paper", (0.98, 0.95, 0.86), 0.9)
ROCK = mat("Rock", (0.6, 0.6, 0.62), 0.9)
FLAG = mat("FlagA", (0.35, 0.78, 0.55), 0.8)
PETALS = [mat(f"Petal{i}", c, 0.6) for i, c in enumerate([(1.0, 0.55, 0.7), (1.0, 0.85, 0.35), (0.65, 0.6, 1.0), (1.0, 1.0, 1.0)])]


def roof(name, w, d, h, loc, material, parent):
    """A pitched roof: a triangular prism along X."""
    bm = bmesh.new()
    x, y, z = w / 2, d / 2, 0
    verts = [bm.verts.new(v) for v in [(-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z), (-x, 0, h), (x, 0, h)]]
    for f in [(0, 1, 5, 4), (3, 4, 5, 2), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]:
        bm.faces.new([verts[i] for i in f])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.location = loc
    o.data.materials.append(material)
    o.parent = parent
    return o


# ---------- House: plaster and timber, pitched roof (RoofA is recoloured per house) ----------
house = empty("House")
box("Walls", (3.2, 2.6, 2.2), (0, 0, 1.1), PLASTER, house, bevel=0.03)
for x in (-1.6, 0, 1.6):
    box("Beam", (0.14, 2.66, 2.2), (x, 0, 1.1), WOOD_DARK, house, bevel=0.0)
box("BeamTop", (3.3, 2.7, 0.14), (0, 0, 2.2), WOOD_DARK, house, bevel=0.0)
box("BeamMid", (3.28, 2.68, 0.1), (0, 0, 1.2), WOOD_DARK, house, bevel=0.0)
roof("Roof", 3.7, 3.2, 1.5, (0, 0, 2.25), ROOF_A, house)
box("Door", (0.7, 0.08, 1.2), (0.6, -1.32, 0.6), WOOD, house, bevel=0.02)
for x in (-0.8,):
    box("Window", (0.6, 0.06, 0.5), (x, -1.32, 1.55), WINDOW, house, bevel=0.01)
    box("WindowFrame", (0.72, 0.05, 0.62), (x, -1.3, 1.55), WOOD_DARK, house, bevel=0.0)
box("WindowSide", (0.06, 0.6, 0.5), (1.62, 0.3, 1.55), WINDOW, house, bevel=0.01)
box("Chimney", (0.35, 0.35, 1.0), (-1.0, 0.6, 3.2), STONE_DARK, house, bevel=0.02)

# ---------- Job board: where shops pin their jobs ----------
board = empty("JobBoard")
for x in (-0.8, 0.8):
    box("BoardPost", (0.12, 0.12, 2.2), (x, 0, 1.1), WOOD_DARK, board, bevel=0.01)
box("BoardPanel", (1.8, 0.1, 1.1), (0, 0, 1.55), WOOD, board, bevel=0.02)
box("BoardRoof", (2.1, 0.5, 0.08), (0, 0, 2.2), WOOD_DARK, board, bevel=0.01)
for i, (x, z) in enumerate([(-0.5, 1.75), (0.05, 1.7), (0.55, 1.78), (-0.25, 1.32), (0.4, 1.3)]):
    p = box(f"Notice{i}", (0.34, 0.02, 0.38), (x, -0.07, z), PAPER, board, bevel=0.0)
    p.rotation_euler = (0, math.radians(random.uniform(-8, 8)), 0)

# ---------- Bushes, flowers, rocks, fences ----------
bush = empty("Bush")
for i in range(5):
    a = i / 5 * math.tau
    blob("BushBall", 0.45 + random.random() * 0.15, (math.cos(a) * 0.35, math.sin(a) * 0.35, 0.4), LEAF if i % 2 else LEAF_LIGHT, bush, sub=2)
blob("BushTop", 0.5, (0, 0, 0.7), LEAF_LIGHT, bush, sub=2)

flowers = empty("Flowers")
for i in range(9):
    a = random.random() * math.tau
    r = random.random() * 0.6
    x, y = math.cos(a) * r, math.sin(a) * r
    cyl("Stem", 0.015, 0.35, (x, y, 0.17), LEAF, flowers, verts=6)
    blob("Petal", 0.09, (x, y, 0.38), PETALS[i % len(PETALS)], flowers, sub=1)

rock = empty("Rock")
r1 = blob("RockA", 0.5, (0, 0, 0.2), ROCK, rock, sub=1)
r1.scale = (1.2, 0.9, 0.6)
r2 = blob("RockB", 0.3, (0.5, 0.3, 0.12), ROCK, rock, sub=1)

fence = empty("Fence")
for x in (-1.0, 0.0, 1.0):
    box("FencePost", (0.12, 0.12, 0.9), (x, 0, 0.45), WOOD_DARK, fence, bevel=0.01)
for z in (0.35, 0.7):
    box("FenceRail", (2.2, 0.07, 0.1), (0, 0, z), WOOD, fence, bevel=0.0)

# ---------- Race arch: start and finish line at the race track ----------
arch = empty("RaceArch")
for x in (-2.6, 2.6):
    box("ArchPost", (0.3, 0.3, 3.2), (x, 0, 1.6), WOOD_DARK, arch, bevel=0.02)
box("ArchBeam", (5.6, 0.35, 0.5), (0, 0, 3.2), WOOD, arch, bevel=0.03)
for i in range(7):
    f = box(f"Pennant{i}", (0.3, 0.02, 0.4), (-2.1 + i * 0.7, 0, 2.75), FLAG if i % 2 else AWN_B, arch, bevel=0.0)
box("FinishLine", (5.0, 0.4, 0.01), (0, 0, 0.012), PAPER, arch, bevel=0.0)

# ---------- Meadow: grass beyond the cobbled plaza ----------
bpy.ops.mesh.primitive_circle_add(vertices=96, radius=60, fill_type="NGON", location=(0, 0, -0.02))
meadow = bpy.context.active_object
meadow.name = "Meadow"
meadow.data.materials.append(GRASS)

bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", export_yup=True, export_apply=True, export_cameras=False, export_lights=False)
print(f"Exported {out_glb}")

# ---------- Preview render: a little market square ----------
if out_png:
    def place(src, loc, rot=0.0, colours=None):
        new = src.copy()
        scene.collection.objects.link(new)
        new.location = loc
        new.rotation_euler = (0, 0, rot)
        for child in src.children_recursive:
            c = child.copy()
            scene.collection.objects.link(c)
            if c.parent is src:
                c.parent = new
        return new

    for o in (stall, lantern, tree, fountain, crate, barrel, bench):
        o.hide_render = True
        for c in o.children_recursive:
            c.hide_render = True
    awnings = [(0.92, 0.35, 0.35), (0.35, 0.6, 0.95), (0.98, 0.75, 0.3), (0.55, 0.8, 0.45), (0.85, 0.5, 0.9), (0.4, 0.8, 0.8)]
    for i in range(6):
        a = i / 6 * math.tau + 0.3
        s = stall.copy()
        scene.collection.objects.link(s)
        s.location = (math.cos(a) * 7, math.sin(a) * 7, 0)
        s.rotation_euler = (0, 0, a + math.pi / 2)
        for child in stall.children_recursive:
            if child.name.startswith("Board"):
                continue
            c = child.copy()
            c.hide_render = False
            if child.data and len(child.data.materials) and child.data.materials[0] == AWN_A:
                m = AWN_A.copy()
                m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*awnings[i], 1)
                c.data = child.data.copy()
                c.data.materials[0] = m
            scene.collection.objects.link(c)
            if child.parent is stall:
                c.parent = s
    for parent in (fountain,):
        f = parent.copy()
        scene.collection.objects.link(f)
        for child in parent.children_recursive:
            c = child.copy()
            c.hide_render = False
            scene.collection.objects.link(c)
            c.parent = f
    for i in range(6):
        a = (i + 0.5) / 6 * math.tau + 0.3
        for src, r in ((lantern, 4.6), (tree, 11)):
            p = src.copy()
            scene.collection.objects.link(p)
            p.location = (math.cos(a) * r, math.sin(a) * r, 0)
            for child in src.children_recursive:
                c = child.copy()
                c.hide_render = False
                scene.collection.objects.link(c)
                c.parent = p
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.98, 0.9, 0.78, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    scene.world = world
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.5
    sun.data.color = (1, 0.93, 0.8)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(40))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.location = (0, -19, 13)
    cam.rotation_euler = (math.radians(55), 0, 0)
    cam.data.lens = 32
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.view_settings.view_transform = "Standard"
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 40
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 700
    scene.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_png}")
