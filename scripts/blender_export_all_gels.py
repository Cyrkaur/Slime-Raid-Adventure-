"""
Export multi-part grounded gel + enemy GLBs via Blender (R6 art pack).
  npm run models:blender
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender_export_all_gels.py

v2: clearer per-element silhouettes, pupils, coat sheen, rarity-ready forms,
    distinct enemy kinds with planted feet.
"""
import os
import math
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_GEL = os.path.join(ROOT, "assets", "models", "gel")
OUT_ENEMY = os.path.join(ROOT, "assets", "models", "enemy")
os.makedirs(OUT_GEL, exist_ok=True)
os.makedirs(OUT_ENEMY, exist_ok=True)

ELEMENTS = {
    "base": (0.4, 0.85, 0.55),
    "water": (0.31, 0.76, 0.97),
    "fire": (1.0, 0.44, 0.26),
    "earth": (0.63, 0.53, 0.5),
    "wind": (0.5, 0.87, 0.92),
    "plant": (0.4, 0.73, 0.42),
    "lightning": (1.0, 0.93, 0.35),
    "ice": (0.7, 0.9, 0.99),
    "shadow": (0.49, 0.34, 0.76),
    "light": (1.0, 0.96, 0.62),
    "metal": (0.69, 0.75, 0.77),
    "poison": (0.67, 0.28, 0.74),
    "crystal": (0.81, 0.58, 0.85),
    "lava": (1.0, 0.34, 0.13),
    "storm": (0.56, 0.79, 0.98),
    "spirit": (0.88, 0.75, 0.91),
    "void": (0.36, 0.42, 0.75),
}

ENEMY_KINDS = ["beast", "golem", "humanoid", "dragon", "undead", "plant", "insect", "elemental"]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def _assign_mat(obj, mat):
    if not mat or not obj:
        return
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def add_uv_sphere(name, loc, scale, mat=None, segs=22, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.shade_smooth()
    _assign_mat(obj, mat)
    return obj


def add_cone(name, loc, r, h, mat=None, verts=7):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, depth=h, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    _assign_mat(obj, mat)
    return obj


def add_ico(name, loc, r, mat=None, sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    _assign_mat(obj, mat)
    return obj


def add_torus(name, loc, major, minor, mat=None):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, location=loc,
        major_segments=28, minor_segments=10
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    _assign_mat(obj, mat)
    return obj


def add_cube(name, loc, scale, mat=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    _assign_mat(obj, mat)
    return obj


def add_cylinder(name, loc, r, depth, mat=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    _assign_mat(obj, mat)
    return obj


def make_mat(name, rgb, metallic=0.08, rough=0.18, emit=0.22, coat=0.85):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metallic
        # Keep mostly opaque so combat renderer stays solid (no invisible transmission gels)
        for key in ("Transmission Weight", "Transmission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = 0.05
                break
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (rgb[0], rgb[1], rgb[2], 1)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emit
        # Clearcoat / coat sheen (Blender 4+)
        for key, val in (("Coat Weight", coat), ("Coat Roughness", 0.08),
                         ("Clearcoat", coat), ("Clearcoat Roughness", 0.08)):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = val
    return mat


def join_all(active_name="body"):
    bpy.ops.object.select_all(action="SELECT")
    active = bpy.data.objects.get(active_name) or bpy.context.selected_objects[0]
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.join()
    return bpy.context.active_object


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
    )


def gel_body_params(el):
    """Distinct silhouettes per element — readable at combat distance."""
    # returns (body_scale xyz, body_y)
    if el in ("fire", "lava"):
        return (0.42, 0.4, 0.68), 0.98
    if el in ("lightning", "storm"):
        return (0.4, 0.4, 0.72), 1.0
    if el in ("earth", "metal"):
        return (0.72, 0.66, 0.4), 0.72
    if el in ("wind", "spirit"):
        return (0.4, 0.42, 0.62), 1.05
    if el in ("water", "ice"):
        return (0.6, 0.54, 0.52), 0.9
    if el in ("shadow", "void", "poison"):
        return (0.5, 0.48, 0.58), 0.95
    if el in ("crystal", "light"):
        return (0.5, 0.48, 0.58), 0.95
    if el == "plant":
        return (0.58, 0.55, 0.5), 0.88
    return (0.55, 0.52, 0.5), 0.9


def build_gel(el, rgb):
    clear_scene()
    metallic = 0.48 if el == "metal" else (0.28 if el in ("crystal", "ice") else 0.08)
    rough = 0.28 if el in ("earth", "metal") else (0.12 if el in ("water", "ice", "crystal") else 0.16)
    emit = 0.35 if el in ("fire", "lava", "lightning", "light") else 0.2
    coat = 0.4 if el == "metal" else 0.92
    mat = make_mat("gel_" + el, rgb, metallic=metallic, rough=rough, emit=emit, coat=coat)
    accent = make_mat(
        "acc_" + el,
        (min(1, rgb[0] * 1.15), min(1, rgb[1] * 1.1), min(1, rgb[2] * 1.1)),
        metallic=min(1, metallic + 0.15),
        rough=max(0.08, rough - 0.04),
        emit=emit + 0.12,
        coat=coat,
    )
    eye_w = make_mat("eye_w_" + el, (0.98, 0.98, 0.98), 0, 0.45, 0.05, 0.2)
    eye_p = make_mat("eye_p_" + el, (0.05, 0.08, 0.06), 0, 0.6, 0.0, 0.0)

    br, by = gel_body_params(el)
    # Feet + wet skirt — planted (no levitate)
    add_uv_sphere("skirt", (0, 0, 0.11), (0.82 * br[0] / 0.55, 0.78 * br[1] / 0.55, 0.16), mat)
    add_uv_sphere("foot_L", (-0.3 * br[0] / 0.55, 0.12, 0.09), (0.26, 0.24, 0.1), mat)
    add_uv_sphere("foot_R", (0.3 * br[0] / 0.55, 0.12, 0.09), (0.26, 0.24, 0.1), mat)

    add_uv_sphere("body", (0, 0, by), br, mat)
    add_uv_sphere("cheek_L", (-0.48 * br[0] / 0.55, 0.16, by - 0.06), (0.26, 0.22, 0.18), mat)
    add_uv_sphere("cheek_R", (0.48 * br[0] / 0.55, 0.16, by - 0.06), (0.26, 0.22, 0.18), mat)
    add_uv_sphere("crown", (0, -0.06, by + br[2] * 0.72), (0.4 * br[0] / 0.55, 0.36, 0.28), accent)
    add_uv_sphere("arm_L", (-0.68 * br[0] / 0.55, 0.22, by - 0.02), (0.17, 0.2, 0.13), mat)
    add_uv_sphere("arm_R", (0.68 * br[0] / 0.55, 0.22, by - 0.02), (0.17, 0.2, 0.13), mat)

    # Eyes + pupils facing +Y (combat faces across lane after yaw)
    ey = by + 0.12
    ez = 0.5 * max(br[0], br[1])
    add_uv_sphere("eye_L", (-0.17, ez, ey), (0.11, 0.07, 0.1), eye_w, segs=14, rings=10)
    add_uv_sphere("eye_R", (0.17, ez, ey), (0.11, 0.07, 0.1), eye_w, segs=14, rings=10)
    add_uv_sphere("pupil_L", (-0.17, ez + 0.06, ey), (0.045, 0.03, 0.045), eye_p, segs=10, rings=8)
    add_uv_sphere("pupil_R", (0.17, ez + 0.06, ey), (0.045, 0.03, 0.045), eye_p, segs=10, rings=8)

    # Element ornaments — silhouette language
    if el in ("fire", "lava"):
        c1 = add_cone("flame", (0.12, 0.08, by + br[2] * 0.95), 0.13, 0.42, accent, verts=5)
        c1.rotation_euler[0] = 0.15
        c2 = add_cone("flame2", (-0.14, 0.05, by + br[2] * 0.85), 0.1, 0.34, accent, verts=5)
        c2.rotation_euler[2] = -0.35
        add_uv_sphere("ember", (0.38, 0.2, by + 0.15), (0.1, 0.1, 0.1), accent)
    elif el == "plant":
        add_cone("leaf", (-0.12, 0.05, by + br[2] * 0.95), 0.15, 0.44, accent, verts=6)
        add_cone("leaf2", (0.2, -0.04, by + br[2] * 0.82), 0.12, 0.36, accent, verts=6)
        add_uv_sphere("berry", (0.42, 0.22, by + 0.05), (0.09, 0.09, 0.09), accent)
    elif el in ("ice", "crystal"):
        add_ico("shard", (0.08, 0.05, by + br[2] * 1.0), 0.18, accent, sub=0)
        add_ico("shard2", (-0.32, 0.18, by + 0.2), 0.12, accent, sub=0)
        add_ico("shard3", (0.35, 0.12, by + 0.1), 0.1, accent, sub=0)
    elif el in ("lightning", "storm"):
        b1 = add_cone("bolt", (0.1, 0, by + br[2] * 1.1), 0.07, 0.48, accent, verts=4)
        b1.rotation_euler[2] = 0.4
        b2 = add_cone("bolt2", (-0.2, 0.05, by + br[2] * 0.9), 0.06, 0.38, accent, verts=4)
        b2.rotation_euler[2] = -0.5
    elif el in ("earth", "metal"):
        add_ico("rock", (0.48, 0.14, by + 0.05), 0.16, accent, sub=0)
        add_ico("rock2", (-0.5, 0.1, by), 0.14, accent, sub=0)
        if el == "metal":
            add_cube("plate", (0, 0.42, by - 0.05), (0.35, 0.08, 0.22), accent)
    elif el in ("void", "shadow", "poison"):
        add_ico("star", (0.34, 0.3, by + 0.28), 0.11, accent, sub=0)
        add_ico("star2", (-0.3, 0.32, by + 0.18), 0.09, accent, sub=0)
        add_torus("ring", (0, 0, by + 0.15), 0.42, 0.035, accent)
    elif el == "water":
        add_uv_sphere("drip", (0.28, 0.38, 0.32), (0.1, 0.1, 0.16), accent)
        add_uv_sphere("drip2", (-0.22, 0.4, 0.26), (0.08, 0.08, 0.13), accent)
        add_uv_sphere("drip3", (0.05, 0.45, 0.2), (0.06, 0.06, 0.1), accent)
    elif el == "light":
        t = add_torus("halo", (0, 0, by + br[2] * 0.95), 0.42, 0.04, accent)
        t.rotation_euler[0] = math.radians(70)
        add_ico("spark", (0.3, 0.25, by + 0.35), 0.08, accent, sub=0)
    elif el in ("wind", "spirit"):
        t = add_torus("wisp", (0.35, 0.05, by + 0.1), 0.28, 0.03, accent)
        t.rotation_euler[1] = 0.6
        t2 = add_torus("wisp2", (-0.3, 0.08, by + 0.35), 0.22, 0.025, accent)
        t2.rotation_euler[0] = 0.4
    else:
        # base — soft drip beads
        add_uv_sphere("bead", (0.4, 0.25, by), (0.09, 0.09, 0.09), accent)

    gel = join_all("body")
    gel.name = "gel_" + el
    out = os.path.join(OUT_GEL, "gel_" + el + ".glb")
    export_glb(out)
    print("Wrote", out)
    return out


def build_enemy(kind):
    clear_scene()
    palette = {
        "beast": (0.62, 0.42, 0.32),
        "golem": (0.55, 0.52, 0.48),
        "humanoid": (0.48, 0.4, 0.45),
        "dragon": (0.55, 0.28, 0.22),
        "undead": (0.45, 0.52, 0.42),
        "plant": (0.35, 0.55, 0.3),
        "insect": (0.55, 0.5, 0.25),
        "elemental": (0.4, 0.55, 0.75),
    }
    rgb = palette.get(kind, (0.55, 0.45, 0.4))
    mat = make_mat("enemy_" + kind, rgb, metallic=0.18, rough=0.42, emit=0.08, coat=0.25)
    dark = make_mat("dark_" + kind, (0.12, 0.1, 0.09), 0.05, 0.7, 0.0, 0.05)
    glow = make_mat("glow_" + kind, (min(1, rgb[0] * 1.3), min(1, rgb[1] * 1.2), min(1, rgb[2] * 1.2)),
                    0.1, 0.25, 0.35, 0.4)

    # Shared contact feet for grounded read
    add_uv_sphere("foot_L", (-0.22, 0.12, 0.08), (0.18, 0.16, 0.08), dark)
    add_uv_sphere("foot_R", (0.22, 0.12, 0.08), (0.18, 0.16, 0.08), dark)

    if kind == "golem":
        add_cube("torso", (0, 0, 0.75), (0.55, 0.42, 0.72), mat)
        add_cube("head", (0, 0, 1.4), (0.36, 0.34, 0.3), mat)
        add_cube("leg_L", (-0.28, 0, 0.28), (0.16, 0.18, 0.4), dark)
        add_cube("leg_R", (0.28, 0, 0.28), (0.16, 0.18, 0.4), dark)
        add_cube("arm_L", (-0.55, 0, 0.85), (0.16, 0.16, 0.5), dark)
        add_cube("arm_R", (0.55, 0, 0.85), (0.16, 0.16, 0.5), dark)
        add_ico("core", (0, 0.28, 0.85), 0.12, glow, sub=0)
    elif kind == "dragon":
        add_uv_sphere("body", (0, 0, 0.55), (0.55, 0.42, 0.38), mat)
        add_uv_sphere("head", (0, 0.55, 0.75), (0.3, 0.28, 0.26), mat)
        sn = add_cone("snout", (0, 0.92, 0.7), 0.12, 0.38, mat, verts=6)
        sn.rotation_euler[0] = math.radians(90)
        w = add_cube("wing_L", (-0.75, 0, 0.85), (0.08, 0.45, 0.55), dark)
        w.rotation_euler[1] = 0.55
        w2 = add_cube("wing_R", (0.75, 0, 0.85), (0.08, 0.45, 0.55), dark)
        w2.rotation_euler[1] = -0.55
        add_cone("horn_L", (-0.12, 0.5, 1.0), 0.05, 0.22, dark, verts=5)
        add_cone("horn_R", (0.12, 0.5, 1.0), 0.05, 0.22, dark, verts=5)
        add_cone("tail", (0, -0.65, 0.4), 0.1, 0.4, dark, verts=6)
    elif kind == "insect":
        add_uv_sphere("thorax", (0, 0, 0.4), (0.38, 0.32, 0.28), mat)
        add_uv_sphere("head", (0, 0.42, 0.45), (0.26, 0.26, 0.24), mat)
        add_uv_sphere("abdomen", (0, -0.42, 0.32), (0.28, 0.3, 0.24), mat)
        for i, x in enumerate((-0.38, 0.38)):
            for j, z in enumerate((0.2, 0.0, -0.15)):
                leg = add_cube("leg_%d_%d" % (i, j), (x, z, 0.12), (0.04, 0.05, 0.28), dark)
                leg.rotation_euler[0] = 0.35 if z >= 0 else -0.2
        add_cone("mand_L", (-0.1, 0.62, 0.4), 0.04, 0.16, dark, verts=4)
        add_cone("mand_R", (0.1, 0.62, 0.4), 0.04, 0.16, dark, verts=4)
    elif kind == "humanoid":
        add_cylinder("torso", (0, 0, 0.7), 0.28, 0.75, mat)
        add_uv_sphere("head", (0, 0, 1.25), (0.24, 0.22, 0.26), mat)
        add_cube("arm_L", (-0.42, 0, 0.7), (0.1, 0.1, 0.42), dark)
        add_cube("arm_R", (0.42, 0, 0.7), (0.1, 0.1, 0.42), dark)
        add_cube("leg_L", (-0.14, 0, 0.28), (0.1, 0.12, 0.4), dark)
        add_cube("leg_R", (0.14, 0, 0.28), (0.1, 0.12, 0.4), dark)
        add_cube("blade", (0.55, 0.15, 0.85), (0.04, 0.08, 0.45), glow)
    elif kind == "plant":
        add_cylinder("stem", (0, 0, 0.4), 0.14, 0.55, dark)
        add_uv_sphere("bulb", (0, 0, 0.95), (0.48, 0.45, 0.42), mat)
        add_cone("leaf_L", (-0.35, 0, 1.15), 0.16, 0.42, glow, verts=6)
        add_cone("leaf_R", (0.35, 0, 1.1), 0.14, 0.38, glow, verts=6)
        add_cone("leaf_B", (0, -0.25, 1.2), 0.12, 0.35, glow, verts=6)
        add_uv_sphere("mouth", (0, 0.35, 0.95), (0.18, 0.12, 0.14), dark)
    elif kind == "undead":
        add_cylinder("ribs", (0, 0, 0.65), 0.22, 0.95, mat)
        add_uv_sphere("skull", (0, 0, 1.3), (0.24, 0.22, 0.26), mat)
        add_uv_sphere("cloak", (0, -0.12, 0.75), (0.42, 0.22, 0.55), dark)
        add_cube("arm_L", (-0.38, 0, 0.7), (0.08, 0.08, 0.45), dark)
        add_cube("arm_R", (0.38, 0, 0.7), (0.08, 0.08, 0.45), dark)
        add_ico("eye_glow", (0, 0.18, 1.32), 0.06, glow, sub=0)
    elif kind == "elemental":
        add_uv_sphere("core", (0, 0, 0.8), (0.38, 0.38, 0.42), glow)
        add_uv_sphere("shell", (0, 0, 0.8), (0.52, 0.52, 0.55), mat)
        add_uv_sphere("orb1", (-0.45, 0.1, 0.55), (0.16, 0.16, 0.18), glow)
        add_uv_sphere("orb2", (0.45, 0.1, 0.55), (0.16, 0.16, 0.18), glow)
        add_uv_sphere("orb3", (0, 0, 1.25), (0.18, 0.18, 0.2), glow)
        add_torus("orbit", (0, 0, 0.8), 0.55, 0.04, dark)
    else:  # beast
        add_uv_sphere("body", (0, 0, 0.42), (0.52, 0.4, 0.36), mat)
        add_uv_sphere("head", (0, 0.48, 0.58), (0.3, 0.28, 0.26), mat)
        add_cone("ear_L", (-0.14, 0.48, 0.82), 0.06, 0.22, dark, verts=5)
        add_cone("ear_R", (0.14, 0.48, 0.82), 0.06, 0.22, dark, verts=5)
        add_cone("snout", (0, 0.75, 0.52), 0.1, 0.22, mat, verts=6)
        add_cone("tail", (0, -0.58, 0.38), 0.09, 0.32, dark, verts=6)
        add_uv_sphere("haunch_L", (-0.28, -0.1, 0.28), (0.16, 0.18, 0.16), mat)
        add_uv_sphere("haunch_R", (0.28, -0.1, 0.28), (0.16, 0.18, 0.16), mat)

    # Prefer body as join root when present
    active = "body" if bpy.data.objects.get("body") else (
        "torso" if bpy.data.objects.get("torso") else (
            "core" if bpy.data.objects.get("core") else (
                "thorax" if bpy.data.objects.get("thorax") else (
                    "ribs" if bpy.data.objects.get("ribs") else (
                        "bulb" if bpy.data.objects.get("bulb") else "foot_L"
                    )
                )
            )
        )
    )
    join_all(active)
    out = os.path.join(OUT_ENEMY, "enemy_" + kind + ".glb")
    export_glb(out)
    print("Wrote", out)


def main():
    for el, rgb in ELEMENTS.items():
        build_gel(el, rgb)
    for k in ENEMY_KINDS:
        build_enemy(k)
    print("DONE blender export v2 all gels + enemies")


if __name__ == "__main__":
    main()
