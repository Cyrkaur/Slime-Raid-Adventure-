"""Hero portrait render (MODEL FIRST rule): portraits, summon cards and collection art come from the hero GLB.
Fixed camera + key/rim/fill light rig, transparent-background PNG. One render per form tier GLB
(Epic = morph body today; Legendary ascended / Mythic humanoid GLBs get the same call).
Usage: Blender -b -P render_portrait.py -- <in.glb> <out.png> [size=1024]
Serif paint-overs start from this PNG. Gel shading here is Blender's, not the in-game shader."""
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = a[0], a[1]; SIZE = int(a[2]) if len(a) > 2 else 1024
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == 'MESH']
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
ctr = (lo + hi) / 2; ht = max(hi.z - lo.z, hi.x - lo.x)
def aim(o, tgt): o.rotation_euler = (tgt - o.location).to_track_quat('-Z', 'Y').to_euler()
# fixed camera: 3/4 front, slightly above eye line, telephoto so every hero frames the same way
cd = bpy.data.cameras.new('PortraitCam'); cd.lens = 85; cam = bpy.data.objects.new('PortraitCam', cd); sc.collection.objects.link(cam)
yaw = math.radians(-24); dist = ht * 3.0
cam.location = ctr + Vector((math.sin(yaw) * dist, -math.cos(yaw) * dist, ht * 0.35)); aim(cam, ctr + Vector((0, 0, ht * 0.10))); sc.camera = cam
def area(name, loc, energy, size, col=(1, 1, 1)):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.size = size; ld.color = col
    o = bpy.data.objects.new(name, ld); sc.collection.objects.link(o); o.location = ctr + Vector(loc) * ht; aim(o, ctr); return o
area('Key', (-1.6, -2.2, 2.0), 260 * ht * ht, 1.5 * ht)                       # warm key, camera-left high
area('Fill', (2.2, -1.8, 0.4), 70 * ht * ht, 2.5 * ht, (0.85, 0.92, 1.0))   # soft cool fill
area('Rim', (1.2, 2.4, 1.6), 420 * ht * ht, 1.0 * ht, (0.9, 0.97, 1.0))     # back rim for the gel edge
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.6, 0.7, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.15
eng = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in eng else 'BLENDER_EEVEE'
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = SIZE; sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'   # keep the element colours saturated (Filmic/AgX wash gel pastel)
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('PORTRAIT', OUT, SIZE)
