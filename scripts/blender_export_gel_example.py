"""
Example Blender script — multi-part grounded gel → GLB.
Requires Blender 3.x/4.x installed.

  blender --background --python scripts/blender_export_gel_example.py

Outputs assets/models/gel/gel_blender_example.glb next to this project.
"""
import os
import math

try:
    import bpy
except ImportError:
    print("Run inside Blender: blender --background --python this_file.py")
    raise SystemExit(1)

# Clear scene
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def uv_sphere(name, loc, scale):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.shade_smooth()
    return obj

# Grounded multi-part gel (Y-up, feet near 0)
uv_sphere("skirt", (0, 0, 0.12), (0.75, 0.75, 0.18))
uv_sphere("foot_L", (-0.28, 0.1, 0.1), (0.22, 0.22, 0.1))
uv_sphere("foot_R", (0.28, 0.1, 0.1), (0.22, 0.22, 0.1))
uv_sphere("body", (0, 0, 0.9), (0.55, 0.55, 0.5))
uv_sphere("cheek_L", (-0.42, 0.15, 0.85), (0.22, 0.2, 0.18))
uv_sphere("cheek_R", (0.42, 0.15, 0.85), (0.22, 0.2, 0.18))
uv_sphere("crown", (0, -0.05, 1.35), (0.35, 0.32, 0.28))
uv_sphere("eye_L", (-0.16, 0.45, 1.05), (0.09, 0.06, 0.1))
uv_sphere("eye_R", (0.16, 0.45, 1.05), (0.09, 0.06, 0.1))

# Join into one mesh for simple export
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = bpy.data.objects["body"]
bpy.ops.object.join()
gel = bpy.context.active_object
gel.name = "gel_creature"

# Simple green gel material
mat = bpy.data.materials.new(name="GelMat")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.3, 0.85, 0.45, 1)
    bsdf.inputs["Roughness"].default_value = 0.2
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = 0.15
gel.data.materials.append(mat)

# Export GLB (glTF 2.0)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "assets", "models", "gel", "gel_blender_example.glb")
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=False)
print("Wrote", out)
