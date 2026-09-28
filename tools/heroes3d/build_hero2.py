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


from mathutils import noise as _nz
import random
SEED = dict(base=1, water=7, fire=13, plant=21)[EL]
rng = random.Random(SEED)
P2 = dict(base=dict(lean=0.05, nz=0.030, sag=0.11, lobes=3),
          water=dict(lean=0.06, nz=0.028, sag=0.10, lobes=4),
          fire=dict(lean=-0.05, nz=0.040, sag=0.08, lobes=5),
          plant=dict(lean=0.05, nz=0.036, sag=0.13, lobes=3))[EL]
FRONT = -math.pi / 2

def smoothstep(e0, e1, x):
    t = max(0, min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)

# ---------- body: dense quad sphere, sculpted, later voxel-remeshed with features ----------
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=2.0)
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=33, use_grid_fill=True)
ARM = [Vector((s*0.93, 0.05, -0.25)).normalized() for s in (1, -1)]
FOOT = [Vector((s*0.42, -0.45, -0.78)).normalized() for s in (1, -1)]
ARMAMP = (1.0, 0.8)  # asymmetric arms
for v in bm.verts:
    d = v.co.normalized()
    x, y, z = d
    r = Vector((x, y, 0))
    zz = z * (P['ztop'] if z > 0 else ZB)
    zz = max(zz, -0.27 + 0.03 * (1 - min(1, r.length)))
    hs = 1.0 - P['taper'] * max(0, z) ** 2.2
    hs *= 1.0 + P['spread'] * math.exp(-((z + 0.25) / 0.28) ** 2)
    zz += P['tip'] * max(0, z - 0.75) ** 2 * 4
    co = Vector((x * P['rx'] * hs, y * P['rx'] * hs, zz))
    for k, A in enumerate(ARM):
        g = gauss(d, A, 0.30)
        co += Vector((A.x, A.y, 0)).normalized() * P['arm'] * ARMAMP[k] * g + Vector((0, 0, -0.10 * g))
    for F in FOOT:
        g = gauss(d, F, 0.26)
        co += Vector((F.x, F.y, 0)).normalized() * 0.07 * g
    # sag: heavy lobed roll just above the sole, gel slumping outward
    phi = math.atan2(y, x)
    sagk = P2['sag'] * math.exp(-((z + 0.18) / 0.20) ** 2) * (1 + 0.45 * math.sin(P2['lobes'] * phi + SEED))
    co.x *= 1 + sagk; co.y *= 1 + sagk
    # asymmetry: lean + low-frequency lumps
    co.x += P2['lean'] * max(0, z) ** 1.5
    n = _nz.noise(d * 1.7 + Vector((SEED * 3.1, 0, 0)))
    co += Vector((x, y, 0.4 * z)) * P2['nz'] * n
    co.z += LIFT
    v.co = co
H = max(v.co.z for v in bm.verts)
EYE_Z = {'fire': 0.50, 'plant': 0.52}.get(EL, 0.52)
ZE = H * EYE_Z; MZ = H * (EYE_Z - 0.15)
AE = [math.atan2(-1, s * 0.42) for s in (1, -1)]
def adist(a, b):
    d = (a - b + math.pi) % (2 * math.pi) - math.pi; return d
# face sculpt: brow ridges, eye sockets, cheeks, a lip under the mouth, a mouth crease
for v in bm.verts:
    co = v.co; rr = Vector((co.x, co.y, 0)).length
    if rr < 1e-4: continue
    phi = math.atan2(co.y, co.x); out = Vector((co.x, co.y, 0)) / rr
    dsp = 0.0
    for k, ae in enumerate(AE):
        s = 1 if k == 0 else -1
        dx = adist(phi, ae) * rr
        dsp += 0.045 * math.exp(-(dx / 0.12) ** 2 - ((co.z - (ZE + 0.235 + 0.010 * s)) / 0.035) ** 2)  # brow (kept above the eye so it reads soft, not angry)
        dsp -= 0.030 * math.exp(-(dx / 0.085) ** 2 - ((co.z - ZE) / 0.08) ** 2)                      # socket
        dcx = adist(phi, FRONT + s * 0.62) * rr
        dsp += 0.030 * math.exp(-(dcx / 0.10) ** 2 - ((co.z - (ZE - 0.10)) / 0.07) ** 2)             # cheek
    dm = adist(phi, FRONT) * rr
    dsp += 0.028 * math.exp(-(dm / 0.12) ** 2 - ((co.z - (MZ - 0.045)) / 0.028) ** 2)                # lower lip
    dsp -= 0.014 * math.exp(-(dm / 0.10) ** 2 - ((co.z - MZ) / 0.016) ** 2)                          # crease
    co += out * dsp
me = bpy.data.meshes.new('body'); bm.to_mesh(me); bm.free()
body = link(bpy.data.objects.new('GelBody', me)); me.materials.append(M_BODY)
bvh0 = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
def surf0(dirv, orig):
    hit = bvh0.ray_cast(orig + dirv.normalized() * 3.0, -dirv.normalized()); return hit[0], hit[1]

def curve_tube(name, pts, radius, m, taper_end=0.0, res=7):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for i, (co, r) in enumerate(pts):
        bp = sp.bezier_points[i]; bp.co = co; bp.radius = r
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cu.bevel_depth = radius; cu.bevel_resolution = 3; cu.resolution_u = res; cu.use_fill_caps = True
    o = link(bpy.data.objects.new(name, cu)); o.data.materials.append(m)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    o = bpy.context.view_layer.objects.active
    for p in o.data.polygons: p.use_smooth = True
    return o
HEAD_OBJS, BODY_OBJS, ROOT_OBJS = [], [], []
def uvs(name, loc, sc3, m, seg=24, ring=16):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=1.0)
    bmesh.ops.scale(bm, vec=sc3, verts=bm.verts)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = link(bpy.data.objects.new(name, me)); o.location = loc; me.materials.append(m); return o

# ---------- drips: gel running down the sides into beads at the base ----------
MERGE = []
DRIPS = dict(base=[(-140, 0.55, 1.0), (-30, 0.62, 0.8), (35, 0.50, 0.9), (165, 0.58, 1.0)],
             water=[(-145, 0.60, 1.0), (-28, 0.66, 0.9), (30, 0.55, 0.8), (160, 0.62, 1.0), (-178, 0.45, 0.7)],
             fire=[(-150, 0.50, 1.1), (-25, 0.55, 1.0), (40, 0.45, 0.9), (170, 0.52, 1.0)],
             plant=[(-135, 0.58, 1.0), (-35, 0.55, 0.9), (25, 0.60, 1.0), (150, 0.50, 0.8), (-175, 0.62, 0.9)])[EL]
for i, (az, zf, w) in enumerate(DRIPS):
    a = math.radians(az); dv = Vector((math.cos(a), math.sin(a), 0))
    pts = []
    N = 6
    for k in range(N):
        t = k / (N - 1)
        zc = H * zf * (1 - t) + 0.07 * t
        p, n = surf0(dv, Vector((0, 0, zc)))
        pts.append((p - n * 0.012, (0.9 - 0.35 * t + 0.25 * t ** 6) * w))
    MERGE.append(curve_tube('Drip%d' % i, pts, 0.058, M_BODY, res=5))
    p, n = surf0(dv, Vector((0, 0, 0.06)))
    MERGE.append(uvs('Bead%d' % i, p + n * 0.015 + Vector((0, 0, 0.0)), (0.085 * w, 0.085 * w, 0.065 * w), M_BODY, 16, 10))
# puddle droplets on the ground beside it (separate, root-weighted)
for i, (az, dr, sz) in enumerate([(-120, 0.16, 0.05), (-55, 0.22, 0.035), (140, 0.14, 0.045)]):
    a = math.radians(az); dv = Vector((math.cos(a), math.sin(a), 0))
    p, n = surf0(dv, Vector((0, 0, 0.03)))
    q = Vector((p.x, p.y, 0)) + dv * dr; q.z = sz * 0.35
    ROOT_OBJS.append(uvs('Drop%d' % i, q, (sz * 1.3, sz, sz * 0.45), M_BODY, 12, 6))

# ---------- element features fused into the body ----------
if EL == 'water':
    t = Vector((0, 0.05, H - 0.07))
    MERGE.append(curve_tube('Crest', [(t + Vector((0.06, 0, -0.10)), 1.35), (t + Vector((-0.12, 0.0, 0.18)), 0.95), (t + Vector((0.02, 0, 0.42)), 0.70),
                                  (t + Vector((0.26, -0.02, 0.45)), 0.50), (t + Vector((0.41, -0.03, 0.29)), 0.34), (t + Vector((0.34, -0.03, 0.15)), 0.18)],
                        0.15, M_BODY, res=9))
    # a smaller back ripple fin
    t2 = Vector((-0.18, 0.22, H - 0.22))
    MERGE.append(curve_tube('Ripple', [(t2, 1.0), (t2 + Vector((-0.10, 0.06, 0.14)), 0.6), (t2 + Vector((0.02, 0.10, 0.22)), 0.15)], 0.08, M_BODY, res=6))
elif EL == 'fire':
    ring = [(0, 0.66, 0.0, 0.17), (0.25, 0.50, 0.35, 0.13), (-0.26, 0.48, -0.35, 0.13), (0.43, 0.34, 0.8, 0.11), (-0.44, 0.33, -0.8, 0.11), (0.1, 0.40, 2.6, 0.12), (-0.14, 0.36, -2.7, 0.11)]
    for i, (ox, hgt, ang, rad) in enumerate(ring):
        base = Vector((ox, 0.06 if abs(ang) < 2 else 0.22, H - 0.16 - abs(ox) * 0.35))
        lean = Vector((ox * 0.6, 0.0, 0))
        pts = [(base, 1.25), (base + lean * 0.4 + Vector((0.05 * math.sin(i), 0, hgt * 0.38)), 0.85),
               (base + lean * 0.8 + Vector((-0.07 * math.cos(i), 0, hgt * 0.72)), 0.42), (base + lean + Vector((0.05, 0, hgt)), 0.04)]
        MERGE.append(curve_tube('Flame%d' % i, pts, rad, M_BODY, res=6))
elif EL == 'plant':
    # two gel sprout lobes grow out of the crown; the leaves sit on their tips
    SPROUT = []
    for s in (1, -1):
        b0 = Vector((s * 0.10, 0.04, H - 0.14)); tip = Vector((s * 0.36, 0.07, H + 0.24))
        MERGE.append(curve_tube('Sprout', [(b0, 1.4), ((b0 + tip) / 2 + Vector((0, 0, 0.06)), 0.8), (tip, 0.5)], 0.12, M_BODY, res=6))
        SPROUT.append(tip)

# fuse body + drips + features into one watertight gel, then reduce
bpy.ops.object.select_all(action='DESELECT')
for o in [body] + MERGE: o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
rm = body.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.011; rm.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier='rm')
sm = body.modifiers.new('sm', 'CORRECTIVE_SMOOTH'); sm.iterations = 4; sm.smooth_type = 'LENGTH_WEIGHTED'; sm.use_only_smooth = True
bpy.ops.object.modifier_apply(modifier='sm')
BODY_TARGET = dict(base=6200, water=6000, fire=6000, plant=5600)[EL]
t0 = sum(len(p.vertices) - 2 for p in body.data.polygons)
dc = body.modifiers.new('dc', 'DECIMATE'); dc.ratio = BODY_TARGET / t0
bpy.ops.object.modifier_apply(modifier='dc')
body.data.materials.clear(); body.data.materials.append(M_BODY)
for p in body.data.polygons: p.use_smooth = True
me = body.data
print('BODY tris', sum(len(p.vertices) - 2 for p in me.polygons), 'H', round(H, 3), 'top', round(max(v.co.z for v in me.vertices), 3), 'from', t0)

bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
def surf(dirv, orig=None):
    orig = orig or Vector((0, 0, H * 0.45))
    hit = bvh.ray_cast(orig + dirv.normalized() * 3.0, -dirv.normalized())
    return hit[0], hit[1]

# ---------- face ----------
for s in (1, -1):
    p, n = surf(Vector((s * 0.42, -1.0, 0.0)), Vector((0, 0, ZE)))
    e = uvs('Eye' + ('L' if s > 0 else 'R'), p - n * 0.035, (0.14, 0.06, 0.185 if EL != 'plant' else 0.15), M_EYE, 20, 12)
    e.rotation_euler = (0, 0, math.atan2(n.x, -n.y)); HEAD_OBJS.append(e)
    sh = uvs('EyeShine', p + n * 0.025 + Vector((0.035 * s - 0.03, 0, 0.07)), (0.05, 0.025, 0.05), M_SHINE, 12, 8); HEAD_OBJS.append(sh)
    sh2 = uvs('EyeShine2', p + n * 0.025 + Vector((0.04 * s + 0.02, 0, -0.06)), (0.022, 0.012, 0.022), M_SHINE, 10, 6); HEAD_OBJS.append(sh2)
mpts = []
for k in range(7):
    t = -1 + 2 * k / 6
    p, n = surf(Vector((0.10 * t, -1, 0)), Vector((0, 0, MZ + 0.035 * t * t)))
    mpts.append((p + n * 0.002, 1.0 - 0.35 * abs(t)))
mouth = curve_tube('Mouth', mpts, 0.016, M_MOUTH, res=3); HEAD_OBJS.append(mouth)

# ---------- core + suspended particles (visible through the gel) ----------
core = uvs('GelCore', Vector((0.02, 0.04, H * 0.36)), (P['rx'] * 0.50, P['rx'] * 0.46, H * 0.24), M_CORE, 18, 10); BODY_OBJS.append(core)
def inside_pts(n, rx, zlo, zhi):
    out = []
    while len(out) < n:
        q = Vector((rng.uniform(-1, 1) * rx, rng.uniform(-1, 1) * rx * 0.8, rng.uniform(zlo, zhi)))
        pp, nn = surf(Vector((q.x, q.y, 0)) if (q.x or q.y) else Vector((1, 0, 0)), Vector((0, 0, q.z)))
        if pp is None: continue
        if Vector((q.x, q.y, 0)).length < Vector((pp.x, pp.y, 0)).length - 0.09: out.append(q)
    return out
if EL in ('water', 'base'):
    M_BUB = mat('GelBubble', (0.85, 0.97, 1.0), 0.05)
    for i, q in enumerate(inside_pts(12, 0.5, 0.12, H * 0.72)):
        r_ = rng.uniform(0.018, 0.045); BODY_OBJS.append(uvs('InBubble%d' % i, q, (r_, r_, r_), M_BUB, 8, 5))
    for i, (bx, by, bz, br) in enumerate([(0.64, -0.10, 0.95, 0.055), (-0.68, 0.0, 0.80, 0.04), (0.52, 0.12, 1.28, 0.03)]):
        HEAD_OBJS.append(uvs('Bubble%d' % i, Vector((bx, by, bz)), (br, br, br), M_BUB, 12, 7))
elif EL == 'fire':
    M_EM = mat('Ember', (1.0, 0.6, 0.15), 0.4, emit=(1.0, 0.5, 0.1))
    for i, q in enumerate(inside_pts(14, 0.5, 0.10, H * 0.80)):
        r_ = rng.uniform(0.014, 0.032); BODY_OBJS.append(uvs('Ember%d' % i, q, (r_, r_, r_ * 1.4), M_EM, 7, 4))
elif EL == 'plant':
    M_IL = mat('InnerLeaf', (0.18, 0.55, 0.14), 0.5)
    M_SP = mat('Spore', (0.85, 1.0, 0.55), 0.4, emit=(0.6, 0.9, 0.3))
    def leaflet(name, loc, size, rz, rx_):
        bm_ = bmesh.new()
        vs = [bm_.verts.new(c) for c in [(0, -1, 0), (0.42, -0.35, 0.12), (0.34, 0.4, 0.1), (0, 1, 0), (-0.34, 0.4, 0.1), (-0.42, -0.35, 0.12), (0, 0, 0.18)]]
        for a_, b_ in [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 0)]: bm_.faces.new((vs[a_], vs[b_], vs[6]))
        bmesh.ops.scale(bm_, vec=(size * 0.6, size, size), verts=bm_.verts)
        me_ = bpy.data.meshes.new(name); bm_.to_mesh(me_); bm_.free()
        o = link(bpy.data.objects.new(name, me_)); o.location = loc; o.rotation_euler = (rx_, 0, rz); me_.materials.append(M_IL)
        for p in me_.polygons: p.use_smooth = True
        return o
    for i, q in enumerate(inside_pts(9, 0.5, 0.12, H * 0.72)):
        BODY_OBJS.append(leaflet('InLeaf%d' % i, q, rng.uniform(0.06, 0.10), rng.uniform(0, 6.28), rng.uniform(-1.2, 1.2)))
    for i, q in enumerate(inside_pts(10, 0.5, 0.10, H * 0.75)):
        r_ = rng.uniform(0.010, 0.02); BODY_OBJS.append(uvs('Spore%d' % i, q, (r_, r_, r_), M_SP, 6, 4))

# ---------- ornaments that stay separate ----------
if EL == 'plant':
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
    for k, s in enumerate((1, -1)):
        lf = imp('monstera_leaf_cc0.glb', 'monstera')
        lf.scale = (0.58, 0.58, 0.58); lf.location = SPROUT[k] + Vector((s * 0.07, 0, 0.0))
        lf.rotation_euler = (math.radians(-12), math.radians(s * 38), math.radians(s * -90))
        for m in lf.data.materials: m.name = 'Orn_Leaf'
        HEAD_OBJS.append(lf)
    fl = imp('flower_bushes_cc0.glb', 'Petals')
    fl.scale = (0.7, 0.7, 0.7); fl.location = (0.02, -0.02, H - 0.02)
    for m in fl.data.materials: m.name = 'Orn_Flower'
    HEAD_OBJS.append(fl)

# apply transforms on all mesh parts
for o in [body] + HEAD_OBJS + BODY_OBJS + ROOT_OBJS:
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
for o in ROOT_OBJS: weight(o, lambda co: {'root': 1.0})

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
PARTS = [body] + HEAD_OBJS + BODY_OBJS + ROOT_OBJS
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
            if o.name.startswith(('EyeShine2', 'Bubble2', 'Mouth', 'InBubble', 'Ember', 'InLeaf', 'Spore', 'Drop')):
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
