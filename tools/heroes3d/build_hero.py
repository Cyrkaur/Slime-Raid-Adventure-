# Blender 5.2: build a slime hero (base|water|fire|plant) -> GLB LOD0/1/2
# usage: Blender -b -P build_hero.py -- <element> <outdir>
import bpy, bmesh, sys, math, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--')+1:]
EL = a[0]; OUT = a[1]; IN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'in')
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = 30

P = dict(base=dict(rx=0.60, ztop=0.92, taper=0.16, tip=0.04, spread=0.05, arm=0.20),
         water=dict(rx=0.56, ztop=1.02, taper=0.30, tip=0.22, spread=0.06, arm=0.21),
         fire=dict(rx=0.68, ztop=0.76, taper=0.06, tip=0.00, spread=0.04, arm=0.18),
         plant=dict(rx=0.63, ztop=0.86, taper=0.10, tip=0.00, spread=0.07, arm=0.19))[EL]
ZB = 0.30   # bottom half-height before flatten
LIFT = 0.28 # after flatten, bottom sits at z=0

def mat(name, col, rough=0.3, emit=None, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 1.0
    return m

ELCOL = dict(base=(0.55,0.85,0.75), water=(0.35,0.70,1.0), fire=(1.0,0.38,0.12), plant=(0.35,0.85,0.35))[EL]
M_BODY = mat('GelBody', ELCOL, 0.15)
M_CORE = mat('GelCore', tuple(min(1,c*1.2) for c in ELCOL), 0.3, emit=ELCOL)
M_EYE = mat('GelEye', (0.02,0.03,0.07), 0.05)
M_SHINE = mat('GelEyeShine', (1,1,1), 0.2, emit=(1,1,1))
M_MOUTH = mat('GelMouth', (0.08,0.02,0.04), 0.4)

def link(ob):
    sc.collection.objects.link(ob); return ob

def gauss(d, c, s):
    return math.exp(-((d - c).length ** 2) / (s * s))

# ---------- body: quad sphere ----------
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=2.0)
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=21, use_grid_fill=True)
ARM = [Vector((s*0.93, 0.05, -0.25)).normalized() for s in (1, -1)]
FOOT = [Vector((s*0.42, -0.45, -0.78)).normalized() for s in (1, -1)]
for v in bm.verts:
    d = v.co.normalized()
    x, y, z = d
    r = Vector((x, y, 0))
    zz = z * (P['ztop'] if z > 0 else ZB)
    zz = max(zz, -0.27 + 0.03 * (1 - min(1, r.length)))  # flattened sole
    hs = 1.0 - P['taper'] * max(0, z) ** 2.2
    hs *= 1.0 + P['spread'] * math.exp(-((z + 0.25) / 0.28) ** 2)
    zz += P['tip'] * max(0, z - 0.75) ** 2 * 4
    co = Vector((x * P['rx'] * hs, y * P['rx'] * hs, zz))
    for A in ARM:
        g = gauss(d, A, 0.30)
        co += Vector((A.x, A.y, 0)).normalized() * P['arm'] * g + Vector((0, 0, -0.10 * g))
    for F in FOOT:
        g = gauss(d, F, 0.26)
        co += Vector((F.x, F.y, 0)).normalized() * 0.07 * g
    co.z += LIFT
    v.co = co
me = bpy.data.meshes.new('body'); bm.to_mesh(me); bm.free()
body = link(bpy.data.objects.new('GelBody', me)); me.materials.append(M_BODY)
for p in me.polygons: p.use_smooth = True
H = max(v.co.z for v in me.vertices)
print('BODY tris', sum(len(p.vertices) - 2 for p in me.polygons), 'H', round(H, 3))

bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
def surf(dirv, orig=None):
    orig = orig or Vector((0, 0, H * 0.45))
    hit = bvh.ray_cast(orig + dirv.normalized() * 3.0, -dirv.normalized())
    return hit[0], hit[1]

HEAD_OBJS, BODY_OBJS = [], []
def uvs(name, loc, sc3, m, seg=24, ring=16):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=1.0)
    bmesh.ops.scale(bm, vec=sc3, verts=bm.verts)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = link(bpy.data.objects.new(name, me)); o.location = loc; me.materials.append(m); return o

# ---------- face ----------
EYE_Z = {'fire': 0.50, 'plant': 0.52}.get(EL, 0.52)
for s in (1, -1):
    p, n = surf(Vector((s * 0.42, -1.0, 0.0)), Vector((0, 0, H * EYE_Z)))
    e = uvs('Eye' + ('L' if s > 0 else 'R'), p - n * 0.04, (0.14, 0.06, 0.185 if EL != 'plant' else 0.15), M_EYE, 20, 12)
    e.rotation_euler = (0, 0, math.atan2(n.x, -n.y)); HEAD_OBJS.append(e)
    sh = uvs('EyeShine', p + n * 0.02 + Vector((0.035 * s - 0.03, 0, 0.07)), (0.05, 0.025, 0.05), M_SHINE, 12, 8); HEAD_OBJS.append(sh)
    sh2 = uvs('EyeShine2', p + n * 0.02 + Vector((0.04 * s + 0.02, 0, -0.06)), (0.022, 0.012, 0.022), M_SHINE, 10, 6); HEAD_OBJS.append(sh2)
def curve_tube(name, pts, radius, m, taper_end=0.0, res=7):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for i, (co, r) in enumerate(pts):
        bp = sp.bezier_points[i]; bp.co = co; bp.radius = r
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cu.bevel_depth = radius; cu.bevel_resolution = 2; cu.resolution_u = res; cu.use_fill_caps = True
    o = link(bpy.data.objects.new(name, cu)); o.data.materials.append(m)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    o = bpy.context.view_layer.objects.active
    for p in o.data.polygons: p.use_smooth = True
    return o

MZ = H * (EYE_Z - 0.15)
mpts = []
for k in range(7):
    t = -1 + 2 * k / 6
    p, n = surf(Vector((0.10 * t, -1, 0)), Vector((0, 0, MZ + 0.035 * t * t)))
    mpts.append((p + n * 0.004, 1.0 - 0.35 * abs(t)))
M_MOUTH_ = M_MOUTH
mouth = curve_tube('Mouth', mpts, 0.016, M_MOUTH, res=3); HEAD_OBJS.append(mouth)

# ---------- core ----------
core = uvs('GelCore', Vector((0, 0.03, H * 0.36)), (P['rx'] * 0.52, P['rx'] * 0.48, H * 0.26), M_CORE, 20, 12); BODY_OBJS.append(core)

# ---------- element ornaments ----------
if EL == 'water':
    # signature: wave crest curling forward off the crown
    t = Vector((0, 0.05, H - 0.06))
    crest = curve_tube('Crest', [(t + Vector((0.04, 0, -0.04)), 1.0), (t + Vector((-0.12, 0.0, 0.20)), 0.85), (t + Vector((0.02, 0, 0.42)), 0.66),
                                 (t + Vector((0.26, -0.02, 0.44)), 0.48), (t + Vector((0.40, -0.03, 0.28)), 0.30), (t + Vector((0.33, -0.03, 0.14)), 0.12)],
                       0.15, M_BODY); HEAD_OBJS.append(crest)
    M_BUB = mat('GelBubble', (0.8, 0.95, 1.0), 0.05)
    for i, (bx, by, bz, br) in enumerate([(0.62, -0.10, 0.95, 0.06), (-0.66, 0.0, 0.80, 0.045), (0.50, 0.12, 1.25, 0.035)]):
        HEAD_OBJS.append(uvs('Bubble%d' % i, Vector((bx, by, bz)), (br, br, br), M_BUB, 14, 8))
elif EL == 'fire':
    M_FL = mat('Flame', (1.0, 0.55, 0.1), 0.4, emit=(1.0, 0.45, 0.05))
    ring = [(0, 0.62, 0.0), (0.26, 0.46, 0.35), (-0.26, 0.46, -0.35), (0.44, 0.32, 0.8), (-0.44, 0.32, -0.8), (0.12, 0.36, 2.6), (-0.14, 0.34, -2.7)]
    for i, (ox, hgt, ang) in enumerate(ring):
        base = Vector((ox, 0.06 if abs(ang) < 2 else 0.22, H - 0.10 - abs(ox) * 0.35))
        lean = Vector((ox * 0.55, 0.0, 0))
        pts = [(base, 1.0), (base + lean * 0.4 + Vector((0.05 * math.sin(i), 0, hgt * 0.35)), 0.8),
               (base + lean * 0.8 + Vector((-0.07 * math.cos(i), 0, hgt * 0.7)), 0.45), (base + lean + Vector((0.04, 0, hgt)), 0.02)]
        HEAD_OBJS.append(curve_tube('Flame%d' % i, pts, 0.15 if i == 0 else 0.11, M_FL, res=5))
elif EL == 'plant':
    def imp(f, keep):
        before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=os.path.join(IN, f))
        new = [o for o in bpy.data.objects if o not in before]; got = None
        for o in new:
            if o.type == 'MESH' and o.name.startswith(keep) and got is None: got = o
        for o in new:
            if o is not got: bpy.data.objects.remove(o, do_unlink=True)
        sc_ = got.matrix_world.to_scale(); got.parent = None; got.matrix_world = Matrix.Diagonal((*sc_, 1.0))
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = got; got.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS'); got.location = (0, 0, 0); got.select_set(False)
        return got
    for s in (1, -1):
        lf = imp('monstera_leaf_cc0.glb', 'monstera')
        lf.scale = (0.62, 0.62, 0.62); lf.location = (s * 0.30, 0.06, H + 0.02)
        lf.rotation_euler = (math.radians(-12), math.radians(s * 38), math.radians(s * -90))
        for m in lf.data.materials: m.name = 'Orn_Leaf'
        HEAD_OBJS.append(lf)
    fl = imp('flower_bushes_cc0.glb', 'Petals')
    fl.scale = (0.75, 0.75, 0.75); fl.location = (0, -0.02, H + 0.10)
    for m in fl.data.materials: m.name = 'Orn_Flower'
    HEAD_OBJS.append(fl)
    M_ST = mat('Orn_Stem', (0.2, 0.55, 0.15), 0.5)
    HEAD_OBJS.append(curve_tube('Stem', [(Vector((0, 0.02, H - 0.08)), 1.0), (Vector((0.02, 0.0, H + 0.08)), 0.7)], 0.035, M_ST, res=3))

# apply transforms on all mesh parts
for o in [body] + HEAD_OBJS + BODY_OBJS:
    bpy.context.view_layer.objects.active = o; o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.select_all(action='DESELECT')

# ---------- rig ----------
arm_d = bpy.data.armatures.new('GelRig'); rig = link(bpy.data.objects.new('GelRig', arm_d))
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
def bone(n, h, t, par=None):
    b = arm_d.edit_bones.new(n); b.head = h; b.tail = t
    if par: b.parent = arm_d.edit_bones[par]
    return b
bone('root', (0, 0, 0), (0, 0, 0.22))
bone('body', (0, 0, 0.22), (0, 0, H * 0.55), 'root')
bone('head', (0, 0, H * 0.55), (0, 0, H * 1.0), 'body')
bone('arm.L', (0.30, 0, 0.38), (0.72, 0, 0.26), 'body')
bone('arm.R', (-0.30, 0, 0.38), (-0.72, 0, 0.26), 'body')
bpy.ops.object.mode_set(mode='OBJECT')

def smooth(e0, e1, x):
    t = max(0, min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)
def weight(o, fn):
    for n in ('root', 'body', 'head', 'arm.L', 'arm.R'): o.vertex_groups.new(name=n)
    for v in o.data.vertices:
        for n, w in fn(v.co).items():
            if w > 1e-3: o.vertex_groups[n].add([v.index], w, 'REPLACE')
    md = o.modifiers.new('Armature', 'ARMATURE'); md.object = rig; o.parent = rig
def body_w(co):
    z = co.z / H
    wh = smooth(0.48, 0.82, z); wr = 1 - smooth(0.05, 0.30, z); wb = max(0, 1 - wh - wr)
    w = {'root': wr, 'body': wb, 'head': wh}
    for s, n in ((1, 'arm.L'), (-1, 'arm.R')):
        ga = math.exp(-(((co.x * s) - 0.62) / 0.18) ** 2 - ((co.z - 0.32) / 0.2) ** 2) if co.x * s > 0.3 else 0
        if ga > 0.01:
            for k in w: w[k] *= (1 - ga)
            w[n] = ga
    tot = sum(w.values()); return {k: v / tot for k, v in w.items()}
weight(body, body_w)
for o in HEAD_OBJS: weight(o, lambda co: {'head': 1.0})
for o in BODY_OBJS: weight(o, lambda co: {'body': 1.0})

# ---------- animation ----------
rig.animation_data_create()
PB = rig.pose.bones
for pb in PB: pb.rotation_mode = 'XYZ'
def clip(name, frames, keys, loop=True):
    act = bpy.data.actions.new(name); rig.animation_data.action = act
    for pb in PB:
        pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    for f in sorted(set([0, frames] + [k[0] for k in keys])):
        for pb in PB:
            pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
        for (kf, bn, ch, val) in keys:
            if kf == f: setattr(PB[bn], ch, val)
        if loop and f == frames:
            for (kf, bn, ch, val) in keys:
                if kf == 0: setattr(PB[bn], ch, val)
        for pb in PB:
            for ch in ('location', 'rotation_euler', 'scale'): pb.keyframe_insert(ch, frame=f)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, 0, act); tr.mute = True
    rig.animation_data.action = None
    return act
S = lambda sx, sy, sz: (sx, sy, sz)   # bone local: Y along bone (up)
# idle 60f loop: breathe
clip('idle', 60, [(0, 'root', 'scale', S(1, 1, 1)), (30, 'root', 'scale', S(1.035, 0.955, 1.035)),
                  (15, 'head', 'rotation_euler', (0.04, 0, 0.03)), (45, 'head', 'rotation_euler', (-0.03, 0, -0.03)),
                  (15, 'arm.L', 'rotation_euler', (0, 0, 0.12)), (45, 'arm.L', 'rotation_euler', (0, 0, -0.08)),
                  (15, 'arm.R', 'rotation_euler', (0, 0, -0.12)), (45, 'arm.R', 'rotation_euler', (0, 0, 0.08))])
# hop 24f: anticipate, launch, air stretch, land squash, settle
clip('hop', 24, [(4, 'root', 'scale', S(1.18, 0.78, 1.18)), (8, 'root', 'scale', S(0.86, 1.22, 0.86)), (8, 'root', 'location', (0, 0.25, 0)),
                 (12, 'root', 'location', (0, 0.42, 0)), (12, 'root', 'scale', S(0.94, 1.08, 0.94)), (17, 'root', 'location', (0, 0, 0)),
                 (18, 'root', 'scale', S(1.22, 0.76, 1.22)), (21, 'root', 'scale', S(0.97, 1.04, 0.97)),
                 (8, 'arm.L', 'rotation_euler', (0, 0, 0.5)), (8, 'arm.R', 'rotation_euler', (0, 0, -0.5)),
                 (14, 'head', 'rotation_euler', (-0.12, 0, 0)), (19, 'head', 'rotation_euler', (0.14, 0, 0))], loop=False)
# attack 21f: squash back, lunge forward stretch, recover (front = -Y blender; bone-local Z ~ world -Y for upright bones)
clip('attack', 21, [(5, 'root', 'scale', S(1.15, 0.84, 1.15)), (5, 'body', 'rotation_euler', (-0.22, 0, 0)),
                    (9, 'root', 'scale', S(0.84, 1.18, 0.84)), (9, 'body', 'rotation_euler', (0.42, 0, 0)), (9, 'head', 'rotation_euler', (0.25, 0, 0)),
                    (9, 'arm.L', 'rotation_euler', (0.9, 0, 0.3)), (9, 'arm.R', 'rotation_euler', (0.9, 0, -0.3)),
                    (13, 'root', 'scale', S(1.1, 0.9, 1.1)), (13, 'body', 'rotation_euler', (0.2, 0, 0)),
                    (17, 'body', 'rotation_euler', (-0.06, 0, 0))], loop=False)
# cast 30f: rise, stretch tall, arms up, wobble
clip('cast', 30, [(6, 'root', 'scale', S(1.1, 0.88, 1.1)), (12, 'root', 'scale', S(0.88, 1.2, 0.88)),
                  (12, 'arm.L', 'rotation_euler', (0, 0, 1.1)), (12, 'arm.R', 'rotation_euler', (0, 0, -1.1)),
                  (16, 'head', 'rotation_euler', (-0.18, 0, 0.1)), (20, 'head', 'rotation_euler', (-0.14, 0, -0.1)),
                  (20, 'arm.L', 'rotation_euler', (0, 0, 1.0)), (20, 'arm.R', 'rotation_euler', (0, 0, -1.0)),
                  (22, 'root', 'scale', S(0.92, 1.12, 0.92)), (26, 'root', 'scale', S(1.06, 0.94, 1.06))], loop=False)
# hit 14f: squash back, jiggle
clip('hit', 14, [(2, 'root', 'scale', S(1.2, 0.8, 1.2)), (2, 'body', 'rotation_euler', (-0.35, 0, 0.05)), (2, 'head', 'rotation_euler', (-0.25, 0, 0)),
                 (5, 'root', 'scale', S(0.9, 1.1, 0.9)), (5, 'body', 'rotation_euler', (0.12, 0, -0.04)),
                 (8, 'root', 'scale', S(1.06, 0.94, 1.06)), (8, 'body', 'rotation_euler', (-0.06, 0, 0)),
                 (11, 'root', 'scale', S(0.98, 1.02, 0.98))], loop=False)
# faint 36f: sag, melt flat (hold last frame)
clip('faint', 36, [(6, 'root', 'scale', S(0.95, 1.08, 0.95)), (6, 'head', 'rotation_euler', (0.2, 0, 0.1)),
                   (18, 'root', 'scale', S(1.3, 0.6, 1.3)), (18, 'head', 'rotation_euler', (0.5, 0, 0.2)),
                   (18, 'arm.L', 'rotation_euler', (0, 0, -0.6)), (18, 'arm.R', 'rotation_euler', (0, 0, 0.6)),
                   (36, 'root', 'scale', S(1.6, 0.22, 1.6)), (36, 'head', 'rotation_euler', (0.7, 0, 0.2)),
                   (36, 'arm.L', 'rotation_euler', (0, 0, -0.9)), (36, 'arm.R', 'rotation_euler', (0, 0, 0.9))], loop=False)
for tr in rig.animation_data.nla_tracks: tr.mute = False

# ---------- export ----------
os.makedirs(OUT, exist_ok=True)
PARTS = [body] + HEAD_OBJS + BODY_OBJS
def tris(objs): return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
# textures <= 1k
for im in bpy.data.images:
    if im.size[0] > 1024 or im.size[1] > 1024:
        f = 1024 / max(im.size); im.scale(int(im.size[0] * f), int(im.size[1] * f))
def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for o in PARTS: o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False,
                              export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
                              export_yup=True, export_lights=False, export_cameras=False, export_extras=True,
                              export_force_sampling=True, export_optimize_animation_size=True)
    print('EXPORTED', path, os.path.getsize(path), 'tris', tris(PARTS))
name = 'gel_' + EL
export(os.path.join(OUT, name + '.glb'))
for lod, target in (('_lod1', 3000), ('_lod2', 800)):
    if lod == '_lod2':
        for o in list(PARTS):
            if o.name.startswith(('EyeShine2', 'Bubble2', 'Flame5', 'Flame6', 'Stem', 'Mouth')):
                PARTS.remove(o)
    tot = tris(PARTS); r = min(1.0, target / tot)
    for o in PARTS:
        t = tris([o])
        if t < 40: continue
        d = o.modifiers.new('dec', 'DECIMATE'); d.ratio = max(r, 24.0 / t)
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.modifier_move_to_index(modifier='dec', index=0); bpy.ops.object.modifier_apply(modifier='dec')
    export(os.path.join(OUT, name + lod + '.glb'))
print('DONE', EL, 'H', round(H, 3))
