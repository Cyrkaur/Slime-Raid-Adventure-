import bpy, sys, math, os
a=sys.argv[sys.argv.index('--')+1:]; out=a[0]; files=a[1:]
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
for i,f in enumerate(files):
    before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f)
    for o in bpy.data.objects:
        if o not in before and o.parent is None: o.location.x += (i-(len(files)-1)/2)*1.9
bpy.ops.mesh.primitive_plane_add(size=30); g=bpy.context.object
m=bpy.data.materials.new('g'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(0.25,0.4,0.2,1); g.data.materials.append(m)
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera=cam
cam.location=(0,-7.5,2.6); cam.rotation_euler=(math.radians(76),0,0); cam.data.lens=40
for loc,e in (((3,-4,6),4),((-4,-2,3),1.5)):
    l=bpy.data.objects.new('l',bpy.data.lights.new('l','SUN')); l.data.energy=e; sc.collection.objects.link(l); l.rotation_euler=(math.radians(50),math.radians(20 if loc[0]>0 else -30),0)
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.55,0.7,0.9,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.8
sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x=1800; sc.render.resolution_y=700; sc.render.filepath=out
bpy.ops.render.render(write_still=True)
