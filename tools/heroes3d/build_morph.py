# Blender 5.x: build a named Epic hero on the MORPH body (blob + two gel tentacle arms + brow ridge)
# = element kit (gel body features) + hero layer (hook deform, ornaments, gel twist, idle).
# usage: Blender -b -P build_morph.py -- <heroId> <outdir>      -> hero_<heroId>.glb (+ _lod1, _lod2)
# Materials: GelBody / GelCore / GelEye / GelEyeShine / GelMouth / GelBubble / Ember / InnerLeaf / Spore are
# restyled at runtime by heroGel3d.js (element kit); Orn_* ornaments keep the colours authored here.
import bpy, bmesh, sys, math, os, random
from mathutils import Vector, Matrix, noise as _nz
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--') + 1:]
HID = a[0]; OUT = a[1]; IN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'in')
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = 30

# ---------------- hero kits (hero layer on top of the element kit) ----------------
KITS = {
  'water_epic_pell':  dict(el='water', body=dict(rx=0.57, ztop=0.92, taper=0.20, tip=0.03, spread=0.05), seed=7,  hook='canoe', crest='water'),
  'fire_epic_brann':  dict(el='fire',  body=dict(rx=0.64, ztop=0.80, taper=0.10, tip=0.00, spread=0.04), seed=13, hook='brazier', crest=None),
  'plant_epic_comb':  dict(el='plant', body=dict(rx=0.62, ztop=0.96, taper=0.30, tip=0.00, spread=0.06), seed=21, hook='skep', crest=None),
}
K = KITS[HID]; EL = K['el']; P = K['body']; SEED = K['seed']
rng = random.Random(SEED)
ZB = 0.30; LIFT = 0.28; FRONT = -math.pi / 2

def mat(name, col, rough=0.3, emit=None, estr=1.0, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = estr
    return m
ELCOL = dict(water=(0.35, 0.70, 1.0), fire=(1.0, 0.38, 0.12), plant=(0.35, 0.85, 0.35))[EL]
M_BODY = mat('GelBody', ELCOL, 0.15)
M_CORE = mat('GelCore', tuple(min(1, c * 1.2) for c in ELCOL), 0.3, emit=ELCOL)
M_EYE = mat('GelEye', (0.02, 0.03, 0.07), 0.05)
M_SHINE = mat('GelEyeShine', (1, 1, 1), 0.2, emit=(1, 1, 1))
M_MOUTH = mat('GelMouth', (0.08, 0.02, 0.04), 0.4)
def link(ob): sc.collection.objects.link(ob); return ob
def smooth(e0, e1, x):
    t = max(0, min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)
def adist(a_, b_): return (a_ - b_ + math.pi) % (2 * math.pi) - math.pi

# ---------------- body: sculpted quad sphere ----------------
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=2.0)
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=33, use_grid_fill=True)
FOOT = [Vector((s * 0.42, -0.45, -0.78)).normalized() for s in (1, -1)]
LOBES = dict(water=4, fire=5, plant=3)[EL]
for v in bm.verts:
    d = v.co.normalized(); x, y, z = d
    zz = z * (P['ztop'] if z > 0 else ZB)
    rr = Vector((x, y, 0)).length
    zz = max(zz, -0.27 + 0.03 * (1 - min(1, rr)))
    hs = 1.0 - P['taper'] * max(0, z) ** 2.2
    hs *= 1.0 + P['spread'] * math.exp(-((z + 0.25) / 0.28) ** 2)
    zz += P['tip'] * max(0, z - 0.75) ** 2 * 4
    co = Vector((x * P['rx'] * hs, y * P['rx'] * hs, zz))
    if K['hook'] == 'skep':
        # Serif Batch A: rounded dome skep, width 1.18 x height, 5 coil bands + dome cap, 0.08 W notches at each seam
        SK_H = 1.20; SK_W = 1.18 * SK_H; SK_N = 0.08 * SK_W
        def sk_rv(zn): return (SK_W / 2 - SK_N) * (1 - 0.22 * smooth(0.0, 0.66, zn))     # bell: widest band at the floor
        def sk_r(zn):
            if zn < 0.65:
                t_ = (zn / 0.13) % 1.0
                if zn < 0.065: return sk_rv(zn) + SK_N * (0.80 + 0.20 * math.sqrt(max(0.0, 1 - (1 - zn / 0.065) ** 2)))  # flat floor band
                return sk_rv(zn) + SK_N * max(0.0, 1 - (2 * t_ - 1) ** 2) ** 0.3   # flatter coil face, crisper seam notch
            rs = sk_rv(0.65); a_ = rs + SK_N * 0.9
            if zn < 0.70: u_ = (zn - 0.70) / 0.05; return rs + (a_ - rs) * math.sqrt(max(0.0, 1 - u_ * u_))
            u_ = min(1.0, (zn - 0.70) / 0.30); return a_ * math.sqrt(max(0.0, 1 - u_ * u_)) ** 0.85
        tp = math.acos(max(-1.0, min(1.0, z))) / math.pi
        dxy = Vector((x, y, 0)); dxy = dxy.normalized() if dxy.length > 1e-6 else Vector((0, 0, 0))
        if tp < 0.86:
            zn = 1 - tp / 0.86; rad = sk_r(zn); zs_ = zn * SK_H
        else:
            zn = 0.0; rad = sk_r(0.0) * (1 - (tp - 0.86) / 0.14) ** 0.5; zs_ = 0.0
        # entrance arch at the base front (0.22 W wide x 0.16 W tall), pushed in and dark inside
        aw = 0.11 * SK_W; ah = 0.16 * SK_W
        dxa = adist(math.atan2(y, x), FRONT) * rad
        if abs(dxa) < aw + 0.03 and zs_ < ah + 0.03:
            ztop_a = ah * math.sqrt(max(0.0, 1 - (min(abs(dxa), aw) / aw) ** 2))
            f_ = smooth(-0.015, 0.02, ztop_a - zs_) * smooth(-0.015, 0.02, aw - abs(dxa))
            rad -= 0.20 * f_
        v.co = Vector((dxy.x * rad, dxy.y * rad, zs_ + 0.02)); continue
    if K['hook'] == 'canoe':
        co.y *= 1 - 0.20 * (1 - smooth(-0.05, 0.30, zz))      # narrow the waterline so the body fits the hull beam
    for F in FOOT:
        g = math.exp(-((d - F).length ** 2) / 0.26 ** 2); co += Vector((F.x, F.y, 0)).normalized() * 0.07 * g
    phi = math.atan2(y, x)
    sagk = 0.10 * math.exp(-((z + 0.18) / 0.20) ** 2) * (1 + 0.45 * math.sin(LOBES * phi + SEED))
    co.x *= 1 + sagk; co.y *= 1 + sagk
    co.x += 0.04 * max(0, z) ** 1.5
    n = _nz.noise(d * 1.7 + Vector((SEED * 3.1, 0, 0)))
    co += Vector((x, y, 0.4 * z)) * 0.028 * n
    co.z += LIFT; v.co = co
BOT0 = min(v.co.z for v in bm.verts); W = max(v.co.x for v in bm.verts) - min(v.co.x for v in bm.verts)
Hb = max(v.co.z for v in bm.verts) - BOT0          # body height, seat to top of gel (Serif's H)
DZ = 0.0
if K['hook'] == 'canoe':
    SUB = 0.18 * Hb                                   # body depth inside the hull
    sl_ = [v.co.x for v in bm.verts if abs(v.co.z - (BOT0 + SUB)) < 0.03]
    W = max(sl_) - min(sl_)                          # Serif's W = visible body width at the gunwale line
    DZ = 0.33 * W - SUB - BOT0
if K['hook'] == 'brazier':
    RIMZ = 0.06 * W + 0.17 * Hb + 0.537 * W                          # ball feet + stubby legs + bowl below the rim
    DZ = (RIMZ - 0.60 * Hb) - BOT0                                  # rim at 60% of H above the seat
for v in bm.verts: v.co.z += DZ
BOT = BOT0 + DZ; H = max(v.co.z for v in bm.verts)
def hz(f): return BOT + f * (H - BOT)
EYE_Z = dict(water=0.52, fire=0.76, plant=0.50)[EL]
if K['hook'] == 'skep': EYE_Z = 0.455            # centre of coil band 4, clear of the seams
ZE = hz(EYE_Z); MZ = ZE - (0.10 if EL == 'fire' else 0.15) * (H - BOT)
print('MEASURE W', round(W, 3), 'Hb', round(Hb, 3), 'BOT', round(BOT, 3), 'H', round(H, 3))
AE = [math.atan2(-1, s * 0.42) for s in (1, -1)]
# face sculpt: morph = defined eye shape -> firmer brow ridge + deeper socket than the blob
for v in bm.verts:
    co = v.co; rr = Vector((co.x, co.y, 0)).length
    if rr < 1e-4: continue
    phi = math.atan2(co.y, co.x); out = Vector((co.x, co.y, 0)) / rr; dsp = 0.0
    for k, ae in enumerate(AE):
        s = 1 if k == 0 else -1; dx = adist(phi, ae) * rr
        dsp += 0.060 * math.exp(-(dx / 0.13) ** 2 - ((co.z - (ZE + 0.225 + 0.012 * s)) / 0.034) ** 2)   # brow ridge
        dsp -= 0.040 * math.exp(-(dx / 0.09) ** 2 - ((co.z - ZE) / 0.085) ** 2)                        # socket
        dcx = adist(phi, FRONT + s * 0.62) * rr
        dsp += 0.030 * math.exp(-(dcx / 0.10) ** 2 - ((co.z - (ZE - 0.10)) / 0.07) ** 2)               # cheek
    dm = adist(phi, FRONT) * rr
    dsp += 0.028 * math.exp(-(dm / 0.12) ** 2 - ((co.z - (MZ - 0.045)) / 0.028) ** 2)
    dsp -= 0.014 * math.exp(-(dm / 0.10) ** 2 - ((co.z - MZ) / 0.016) ** 2)
    co += out * dsp
me = bpy.data.meshes.new('body'); bm.to_mesh(me); bm.free()
body = link(bpy.data.objects.new('GelBody', me)); me.materials.append(M_BODY)
bvh0 = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
def surf0(dirv, orig):
    hit = bvh0.ray_cast(orig + dirv.normalized() * 3.0, -dirv.normalized()); return hit[0], hit[1]

def curve_tube(name, pts, radius, m, res=7, bres=3):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for i, (co, r) in enumerate(pts):
        bp = sp.bezier_points[i]; bp.co = co; bp.radius = r; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cu.bevel_depth = radius; cu.bevel_resolution = bres; cu.resolution_u = res; cu.use_fill_caps = True
    o = link(bpy.data.objects.new(name, cu)); o.data.materials.append(m)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    o = bpy.context.view_layer.objects.active
    for p in o.data.polygons: p.use_smooth = True
    return o
def uvs(name, loc, sc3, m, seg=24, ring=16, rot=None):
    bm_ = bmesh.new(); bmesh.ops.create_uvsphere(bm_, u_segments=seg, v_segments=ring, radius=1.0)
    bmesh.ops.scale(bm_, vec=sc3, verts=bm_.verts)
    me_ = bpy.data.meshes.new(name); bm_.to_mesh(me_); bm_.free()
    for p in me_.polygons: p.use_smooth = True
    o = link(bpy.data.objects.new(name, me_)); o.location = loc; me_.materials.append(m)
    if rot: o.rotation_euler = rot
    return o
def cyl(name, loc, r, depth, m, verts=12, rot=None, r2=None):
    bm_ = bmesh.new()
    bmesh.ops.create_cone(bm_, cap_ends=True, segments=verts, radius1=r, radius2=(r if r2 is None else r2), depth=depth)
    me_ = bpy.data.meshes.new(name); bm_.to_mesh(me_); bm_.free()
    o = link(bpy.data.objects.new(name, me_)); o.location = loc; me_.materials.append(m)
    if rot: o.rotation_euler = rot
    return o
def lathe(name, prof, m, seg=40, loc=(0, 0, 0)):
    """prof = [(r, z), ...] bottom->top; closed ring surface (no caps)."""
    bm_ = bmesh.new(); rings = []
    for (r, z) in prof:
        rings.append([bm_.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)])
    for j in range(len(rings) - 1):
        for i in range(seg):
            bm_.faces.new((rings[j][i], rings[j][(i + 1) % seg], rings[j + 1][(i + 1) % seg], rings[j + 1][i]))
    me_ = bpy.data.meshes.new(name); bm_.to_mesh(me_); bm_.free()
    for p in me_.polygons: p.use_smooth = True
    o = link(bpy.data.objects.new(name, me_)); o.location = loc; me_.materials.append(m); return o

HEAD, BODYO, ROOTO, ARML, ARMR, CREST, ORBIT = [], [], [], [], [], [], []
MERGE = []
# ---------------- tentacle arms (morph) ----------------
ARM_PTS = {}
def V(x, y, z): return Vector((x, y, z))
for s, side in ((1, 'L'), (-1, 'R')):
    rad_, fac_, tip_r = 0.12, (1.25, 0.95, 0.72, 0.55), 0.075
    pts = [V(s * 0.36, 0.02, 0.50), V(s * 0.60, -0.04, 0.47), V(s * 0.80, -0.11, 0.39), V(s * 0.92, -0.17, 0.33)]
    if K['hook'] == 'canoe' and side == 'R':      # oar arm: shoulder to a hand 0.65 W out, 0.9 W up
        pts = [V(-0.38, -0.02, BOT + 0.50), V(-0.56, -0.05, BOT + 0.66), V(-0.70, -0.07, 0.80 * W), V(-0.65 * W, -0.08, 0.90 * W)]
    elif K['hook'] == 'canoe':                    # short left arm resting on the near gunwale
        pts = [V(0.38, -0.02, BOT + 0.50), V(0.54, -0.16, BOT + 0.48), V(0.64, -0.32, 0.33 * W + 0.12), V(0.68, -0.46, 0.33 * W + 0.06)]
        fac_ = (1.2, 0.95, 0.8, 0.7)
    elif K['hook'] == 'brazier':                  # small nubs resting on the rim, stopping short of the rim corners
        pts = [V(s * 0.48, -0.10, RIMZ + 0.12), V(s * 0.64, -0.22, RIMZ + 0.10), V(s * 0.76, -0.34, RIMZ + 0.085), V(s * 0.82, -0.42, RIMZ + 0.08)]
        rad_, fac_, tip_r = 0.094, (1.15, 1.0, 0.95, 0.9), 0.088
    elif K['hook'] == 'skep':                     # short arms tucked in front of the lower ridges, hands either side of the mouth, door left clear
        pts = [V(s * 0.36, -0.56, 0.42), V(s * 0.31, -0.74, 0.37), V(s * 0.27, -0.83, 0.34), V(s * 0.23, -0.87, 0.33)]
        fac_ = (1.1, 0.9, 0.75, 0.62)
    ARM_PTS[side] = pts
    MERGE.append(curve_tube('Arm' + side, [(pts[0], fac_[0]), (pts[1], fac_[1]), (pts[2], fac_[2]), (pts[3], fac_[3])], rad_, M_BODY, res=8))
    MERGE.append(uvs('ArmTip' + side, pts[3] + (pts[3] - pts[2]).normalized() * 0.02, (tip_r, tip_r, tip_r * 0.93), M_BODY, 16, 10))
# drips + beads (element kit)
DRIPS = dict(water=[(-145, 0.60, 1.0), (-28, 0.66, 0.9), (160, 0.62, 1.0)],
             fire=[(-150, 0.50, 1.1), (40, 0.45, 0.9), (170, 0.52, 1.0)],
             plant=[(-135, 0.58, 1.0), (25, 0.60, 1.0), (150, 0.50, 0.8)])[EL]
if K['hook'] in ('canoe', 'brazier', 'skep'): DRIPS = []
for i, (az, zf, w) in enumerate(DRIPS):
    a_ = math.radians(az); dv = Vector((math.cos(a_), math.sin(a_), 0)); pts = []
    for k in range(6):
        t = k / 5; zc = H * zf * (1 - t) + 0.07 * t; p, n = surf0(dv, Vector((0, 0, zc)))
        pts.append((p - n * 0.012, (0.9 - 0.35 * t + 0.25 * t ** 6) * w))
    MERGE.append(curve_tube('Drip%d' % i, pts, 0.055, M_BODY, res=5))
    p, n = surf0(dv, Vector((0, 0, 0.06))); MERGE.append(uvs('Bead%d' % i, p + n * 0.015, (0.08 * w, 0.08 * w, 0.06 * w), M_BODY, 16, 10))

# ---------------- hero hooks (gel parts that fuse into the body) ----------------
CREST_MERGE = []   # gel fused into body but weighted to the crest bone (above the head)
if K['hook'] == 'brazier':
    # Serif Batch A flame: 1.0 H tall, base 0.40 W, belly <= 0.50 W, one tongue per side, S-curl tip leaning right
    FL = [(0.20, 0.00), (0.24, 0.12), (0.25, 0.28), (0.22, 0.44), (0.17, 0.55), (0.105, 0.635), (0.16, 0.72), (0.19, 0.83),
          (0.12, 0.775), (0.08, 0.80), (0.065, 0.88), (0.09, 0.95), (0.15, 1.00),
          (0.08, 0.985), (0.03, 0.95), (0.00, 0.90), (-0.03, 0.82), (-0.07, 0.73), (-0.10, 0.625), (-0.215, 0.70),
          (-0.16, 0.57), (-0.19, 0.48), (-0.23, 0.36), (-0.25, 0.22), (-0.23, 0.10), (-0.20, 0.00)]
    z0 = H - 0.20; FH = 1.0 * Hb + 0.20; TH = 0.36
    bmf = bmesh.new(); vs_ = [bmf.verts.new((fx * W, 0.0, z0 + fz * FH)) for fx, fz in FL]
    fc = bmf.faces.new(vs_); ex = bmesh.ops.extrude_face_region(bmf, geom=[fc])
    for v_ in bmf.verts:
        if v_.co.y == 0.0 and v_ not in vs_: pass
    new_vs = [e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)]
    for v_ in new_vs: v_.co.y = TH
    for v_ in bmf.verts:
        fz = (v_.co.z - z0) / FH; v_.co.y = (v_.co.y - TH / 2) * (1 - 0.65 * fz) + 0.04
    bmesh.ops.recalc_face_normals(bmf, faces=bmf.faces[:])
    mef = bpy.data.meshes.new('Flame'); bmf.to_mesh(mef); bmf.free()
    CREST_MERGE.append(link(bpy.data.objects.new('Flame', mef)))

# fuse body + arms + drips + hooks into one watertight gel
bpy.ops.object.select_all(action='DESELECT')
for o in [body] + MERGE + CREST_MERGE: o.select_set(True)
bpy.context.view_layer.objects.active = body; bpy.ops.object.join()
rm = body.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.011; rm.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier='rm')
sm = body.modifiers.new('sm', 'CORRECTIVE_SMOOTH'); sm.iterations = 4; sm.smooth_type = 'LENGTH_WEIGHTED'; sm.use_only_smooth = True
bpy.ops.object.modifier_apply(modifier='sm')
t0 = sum(len(p.vertices) - 2 for p in body.data.polygons)
dc = body.modifiers.new('dc', 'DECIMATE'); dc.ratio = 6800 / t0; bpy.ops.object.modifier_apply(modifier='dc')
body.data.materials.clear(); body.data.materials.append(M_BODY)
for p in body.data.polygons: p.use_smooth = True
HT = max(v.co.z for v in body.data.vertices)
print('BODY tris', sum(len(p.vertices) - 2 for p in body.data.polygons), 'H', round(H, 3), 'top', round(HT, 3))
bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
def surf(dirv, orig=None):
    orig = orig or Vector((0, 0, H * 0.45)); hit = bvh.ray_cast(orig + dirv.normalized() * 3.0, -dirv.normalized()); return hit[0], hit[1]

# ---------------- face ----------------
EYE_SZ = dict(water=(0.14, 0.06, 0.185), fire=(0.14, 0.06, 0.18), plant=(0.14, 0.06, 0.17))[EL]
for s in (1, -1):
    p, n = surf(Vector((s * 0.42, -1.0, 0.0)), Vector((0, 0, ZE)))
    e = uvs('Eye' + ('L' if s > 0 else 'R'), p - n * 0.035, EYE_SZ, M_EYE, 20, 12); e.rotation_euler = (0, 0, math.atan2(n.x, -n.y)); HEAD.append(e)
    HEAD.append(uvs('EyeShine', p + n * 0.025 + Vector((0.035 * s - 0.03, 0, 0.07)), (0.05, 0.025, 0.05), M_SHINE, 12, 8))
    HEAD.append(uvs('EyeShine2', p + n * 0.025 + Vector((0.04 * s + 0.02, 0, -0.06)), (0.022, 0.012, 0.022), M_SHINE, 10, 6))
mpts = []
for k in range(7):
    t = -1 + 2 * k / 6; p, n = surf(Vector((0.10 * t, -1, 0)), Vector((0, 0, MZ + 0.035 * t * t))); mpts.append((p + n * 0.002, 1.0 - 0.35 * abs(t)))
HEAD.append(curve_tube('Mouth', mpts, 0.016, M_MOUTH, res=3))

# ---------------- inside the gel ----------------
def inside_pts(n, rx, zlo, zhi, margin=0.09):
    out = []
    while len(out) < n:
        q = Vector((rng.uniform(-1, 1) * rx, rng.uniform(-1, 1) * rx * 0.8, rng.uniform(zlo, zhi)))
        pp, nn = surf(Vector((q.x, q.y, 0)) if (q.x or q.y) else Vector((1, 0, 0)), Vector((0, 0, q.z)))
        if pp is None: continue
        if Vector((q.x, q.y, 0)).length < Vector((pp.x, pp.y, 0)).length - margin: out.append(q)
    return out
core = uvs('GelCore', Vector((0.02, 0.04, hz(0.36))), (P['rx'] * 0.46, P['rx'] * 0.42, (H - BOT) * 0.22), M_CORE, 18, 10); BODYO.append(core)
if EL == 'water':
    M_BUB = mat('GelBubble', (0.85, 0.97, 1.0), 0.05)
    # gel twist (Pell): a waterline. Lower half crystal clear, upper half full of small suspended bubbles
    for i, q in enumerate(inside_pts(26, 0.5, hz(0.50), hz(0.80), 0.07)):
        r_ = rng.uniform(0.012, 0.03); BODYO.append(uvs('InBubble%d' % i, q, (r_, r_, r_), M_BUB, 8, 5))
    for i, (bx, by, bz, br) in enumerate([(0.62, -0.10, hz(0.80), 0.05), (-0.20, 0.30, hz(0.95), 0.035)]):
        HEAD.append(uvs('Bubble%d' % i, Vector((bx, by, bz)), (br, br, br), M_BUB, 12, 7))
elif EL == 'fire':
    M_EM = mat('Ember', (1.0, 0.6, 0.15), 0.4, emit=(1.0, 0.5, 0.1))
    for i, q in enumerate(inside_pts(12, 0.5, hz(0.62), hz(0.85))):
        r_ = rng.uniform(0.014, 0.03); BODYO.append(uvs('Ember%d' % i, q, (r_, r_, r_ * 1.4), M_EM, 7, 4))
elif EL == 'plant':
    M_SP = mat('Spore', (0.85, 1.0, 0.55), 0.4, emit=(0.6, 0.9, 0.3))
    # gel twist (Comb): a glowing honeycomb panel in the belly, facing the camera behind a clear gel window
    M_COMB = mat('Orn_Comb', (1.0, 0.62, 0.12), 0.35, emit=(1.0, 0.55, 0.06), estr=1.6)
    M_WAX = mat('Orn_Wax', (0.55, 0.30, 0.06), 0.5)
    cr = 0.062; cz = 0.29; cx0 = -0.24     # honeycomb patch on the front-left flank, clear of the mouth
    pf, nf = surf(Vector((0, -1, 0)), Vector((0, 0, cz)))
    cy_ = pf.y + 0.10
    for row in range(-1, 2):
        for col in range(-2, 3):
            dx = (col + (0.5 if row % 2 else 0)) * cr * 1.78; x_ = cx0 + dx; z_ = cz + row * cr * 1.55
            if (dx / 0.20) ** 2 + ((z_ - cz) / 0.15) ** 2 > 1.0: continue
            # each cell sits just under the skin (thin gel over it), facing out along the local normal
            az = -1.0 + dx / 0.62     # azimuth around the dome, front-left
            ps, ns = surf(Vector((math.sin(az), -math.cos(az), 0)), Vector((0, 0, z_)))
            if ps is None: continue
            cc = ps + ns * 0.006     # proud of the skin so the glow reads at fight distance
            q_ = ns.to_track_quat('Z', 'Y').to_euler()
            BODYO.append(cyl('Comb_%d_%d' % (row, col), cc, cr * 0.84, 0.03, M_COMB, verts=6, rot=(q_.x, q_.y, q_.z)))
    BODYO.append(uvs('CombBack', Vector((math.sin(-1.0) * 0.34, -math.cos(-1.0) * 0.34, cz)), (0.20, 0.04, 0.16), M_WAX, 20, 10))
# ---------------- ornaments (separate, authored colours) ----------------
def aim_rot(dv):
    q_ = dv.normalized().to_track_quat('Z', 'Y').to_euler(); return (q_.x, q_.y, q_.z)
def ray_down(x, y):
    hit = bvh.ray_cast(Vector((x, y, 4.0)), Vector((0, 0, -1))); return hit[0], hit[1]
if K['hook'] == 'canoe':
    M_WOOD = mat('Orn_Wood', (0.24, 0.11, 0.04), 0.6)
    M_GUN = mat('Orn_Gunwale', (0.13, 0.06, 0.02), 0.5)
    M_STRIPE = mat('Orn_Stripe', (0.95, 0.92, 0.82), 0.5)
    M_PAD = mat('Orn_Paddle', (0.62, 0.40, 0.18), 0.55)
    M_KELP = mat('Orn_Kelp', (0.16, 0.42, 0.20), 0.6)
    M_SHELL = mat('Orn_Shell', (0.98, 0.86, 0.78), 0.4)
    # Serif Batch A canoe: long axis across the screen (face to camera). 2.4 W tip to tip, 0.33 W deep,
    # flat bottom ~1.4 W, bow + stern tips +0.34 W above the gunwale, rising only in the last 0.35 W.
    L_ = 1.2 * W; BEAM = 0.42 * W; D_ = 0.33 * W; XF = 0.70 * W; RISE = 0.34 * W; RZ = 0.35 * W
    NU, NV = 40, 10
    def cg(ax): return D_ + RISE * max(0.0, (ax - (L_ - RZ)) / RZ) ** 1.8                     # gunwale height
    def cb(ax): return 0.0 if ax < XF else (D_ + RISE - 0.03) * ((ax - XF) / (L_ - XF)) ** 1.7  # keel (rocker)
    def cw(ax): return max(0.006, BEAM * max(0.0, 1 - (ax / L_) ** 2.4) ** 0.55)                # half-beam
    def lean(ax, z): return 0.05 * W * max(0.0, (z - D_) / RISE)                                 # tips lean outward
    bmh = bmesh.new(); grid = []
    for i in range(NU + 1):
        x = -L_ + 2 * L_ * i / NU; ax = abs(x); sg = 1 if x >= 0 else -1; row = []
        for j in range(NV + 1):
            th = math.pi * j / NV; zg, zb = cg(ax), cb(ax)
            z = zg - (zg - zb) * math.sin(th) ** 0.35
            row.append(bmh.verts.new((x + sg * lean(ax, z), cw(ax) * math.cos(th), z)))
        grid.append(row)
    for i in range(NU):
        for j in range(NV):
            bmh.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
        bmh.faces.new((grid[i][NV], grid[i + 1][NV], grid[i + 1][0], grid[i][0]))   # deck (under the gel mid-ships)
    bmesh.ops.remove_doubles(bmh, verts=bmh.verts[:], dist=0.004)
    bmesh.ops.recalc_face_normals(bmh, faces=bmh.faces[:])
    meh = bpy.data.meshes.new('Canoe'); bmh.to_mesh(meh); bmh.free()
    for p_ in meh.polygons: p_.use_smooth = True
    canoe = link(bpy.data.objects.new('Canoe', meh)); meh.materials.append(M_WOOD); BODYO.append(canoe)
    for sd in (1, -1):
        us = [-0.97 + 1.94 * k / 16 for k in range(17)]
        pts_ = [(Vector((u * L_ + (1 if u >= 0 else -1) * lean(abs(u) * L_, cg(abs(u) * L_)), sd * cw(abs(u) * L_), cg(abs(u) * L_) + 0.012)), 1.0) for u in us]
        BODYO.append(curve_tube('Gunwale%d' % (sd > 0), pts_, 0.034, M_GUN, res=3, bres=1))
        st_ = []
        for u in [-0.85 + 1.7 * k / 12 for k in range(13)]:
            ax = abs(u) * L_; zs = cg(ax) - (cg(ax) - cb(ax)) * 0.30
            st_.append((Vector((u * L_, sd * cw(ax) * 0.99, zs)), 1.0))
        BODYO.append(curve_tube('Stripe%d' % (sd > 0), st_, 0.02, M_STRIPE, res=2, bres=1))
    # paddle: straight shaft from the hand, canoe-paddle blade 0.50 W x 1.05 H, 22 deg off vertical, leaning out
    hand = ARM_PTS['R'][3]; ang = math.radians(22); dvec = Vector((-math.sin(ang), 0, math.cos(ang)))
    SH_L = 0.42 * W; SH_R = 0.045 * W; BW = 0.50 * W; BL = 1.05 * Hb; BT = 0.05 * W
    ARMR.append(cyl('PaddleShaft', hand + dvec * (SH_L / 2 - 0.04), SH_R, SH_L + 0.14, M_PAD, verts=10, rot=aim_rot(dvec)))
    out = []
    NB = 24
    for k in range(NB + 1):
        sl = BL * k / NB
        if sl < 0.14 * BL: hw = SH_R + (BW / 2 - SH_R) * smooth(0, 1, sl / (0.14 * BL))
        elif sl < BL - BW / 2: hw = BW / 2 * (1 - 0.05 * sl / BL)
        else:
            u_ = (sl - (BL - BW / 2)) / (BW / 2); hw = BW / 2 * (1 - 0.05) * math.sqrt(max(0.0, 1 - u_ * u_))
        out.append((hw, sl))
    ring = [(hw, sl) for hw, sl in out] + [(-hw, sl) for hw, sl in reversed(out)]
    bmp = bmesh.new(); vv = []
    seen = set()
    for hw, sl in ring:
        key = (round(hw, 5), round(sl, 5))
        if key in seen: continue
        seen.add(key); vv.append(bmp.verts.new((hw, -BT / 2, sl)))
    fp = bmp.faces.new(vv); exr = bmesh.ops.extrude_face_region(bmp, geom=[fp])
    for e in exr['geom']:
        if isinstance(e, bmesh.types.BMVert): e.co.y += BT
    bmesh.ops.recalc_face_normals(bmp, faces=bmp.faces[:])
    mep = bpy.data.meshes.new('PaddleBlade'); bmp.to_mesh(mep); bmp.free()
    blade = link(bpy.data.objects.new('PaddleBlade', mep)); mep.materials.append(M_PAD)
    blade.location = hand + dvec * SH_L; blade.rotation_euler = (0, -ang, 0); ARMR.append(blade)
    # small ornaments inside the silhouette: kelp-rope sash low across the front, shell charm on its knot
    kp = []
    for k in range(9):
        a_ = FRONT + (-0.9 + 1.8 * k / 8); ps, ns = surf(Vector((math.cos(a_), math.sin(a_), 0)), Vector((0, 0, D_ + 0.11 + 0.03 * abs(k - 4) / 4)))
        if ps is not None: kp.append((ps + ns * 0.012, 1.0))
    BODYO.append(curve_tube('KelpSash', kp, 0.026, M_KELP, res=3, bres=1))
    ps, ns = surf(Vector((0.25, -1, 0)), Vector((0, 0, D_ + 0.08)))
    BODYO.append(uvs('ShellCharm', ps + ns * 0.03, (0.045, 0.02, 0.04), M_SHELL, 8, 6, rot=(0, 0, math.atan2(ns.x, -ns.y))))
elif K['hook'] == 'brazier':
    M_IRON = mat('Orn_Iron', (0.14, 0.12, 0.11), 0.5, metal=0.75)
    M_COAL = mat('Orn_Coal', (0.07, 0.035, 0.025), 0.8, emit=(0.9, 0.22, 0.04), estr=0.35)
    M_RAG = mat('Orn_Rag', (1.0, 0.10, 0.05), 0.7, emit=(1.0, 0.08, 0.02), estr=0.35)
    # Serif Batch A pot: ONE crisp flat lip at 60% H, dia 1.55 W, 0.07 W thick, hard corners; deep bowl 0.62 W, rounded bottom
    RO = 0.775 * W; RB = 0.72 * W; DP = 0.62 * W; LT = 0.07 * W; RI = 0.66 * W
    prof = [(0.002, RIMZ - DP)]
    for k in range(1, 10):
        d_ = DP * (1 - k / 9); prof.append((RB * math.sqrt(max(0.0, 1 - (d_ / DP) ** 2)) if k < 9 else RB, RIMZ - LT - d_ * (DP - LT) / DP))
    prof += [(RO - 0.006, RIMZ - LT), (RO, RIMZ - LT + 0.006), (RO, RIMZ - 0.006), (RO - 0.006, RIMZ), (RI + 0.006, RIMZ), (RI, RIMZ - 0.006), (RI, RIMZ - 0.075)]
    bowl = lathe('Brazier', prof, M_IRON, seg=36); BODYO.append(bowl)
    BODYO.append(lathe('Coals', [(RI + 0.004, RIMZ - 0.07), (0.62 * RI, RIMZ - 0.055), (0.30 * W, RIMZ - 0.05)], M_COAL, seg=24))
    # four stubby legs 0.10 W thick, ball feet r 0.06 W, 0.41 W from center, ring turned 20 deg so all four show
    rb = 0.06 * W
    for i in range(4):
        ag = math.radians(45 + 90 * i + 20); cs, sn = math.cos(ag), math.sin(ag)
        top = Vector((cs * 0.36 * W, sn * 0.36 * W, RIMZ - 0.537 * W + 0.05)); foot = Vector((cs * 0.41 * W, sn * 0.41 * W, rb))
        dv = top - foot
        BODYO.append(cyl('BrazLeg%d' % i, (top + foot) / 2, 0.05 * W, dv.length, M_IRON, verts=10, rot=aim_rot(dv)))
        BODYO.append(uvs('BrazFoot%d' % i, foot, (rb, rb, rb), M_IRON, 10, 6))
    for i, azd in enumerate((-125, -95, -85, -55)):
        ag = math.radians(azd); zr = RIMZ - 0.20; rr = RB * math.sqrt(max(0.0, 1 - ((0.20 - LT) / DP) ** 2)) + 0.004
        BODYO.append(uvs('Rivet%d' % i, Vector((math.cos(ag) * rr, math.sin(ag) * rr, zr)), (0.028, 0.028, 0.028), M_IRON, 6, 4))
    # signal rag knotted on the left nub, two short tails hanging down the bowl front inside its outline
    a2, a3 = ARM_PTS['L'][2], ARM_PTS['L'][3]
    band = lathe('RagBand', [(0.100, -0.055), (0.116, 0.0), (0.100, 0.055)], M_RAG, seg=18, loc=tuple((a2 + a3) / 2)); band.rotation_euler = aim_rot(a3 - a2); ARML.append(band)
    ARML.append(uvs('RagKnot', Vector((0.78, -0.62, RIMZ + 0.06)), (0.06, 0.05, 0.05), M_RAG, 10, 6))
    ARML.append(uvs('RagDrape', Vector((0.76, -0.80, RIMZ + 0.02)), (0.055, 0.05, 0.035), M_RAG, 10, 6))
    for j, (x_, y_, dz, tw) in enumerate([(0.70, -0.87, -0.15, 0.2), (0.83, -0.80, -0.12, -0.25)]):
        ag = math.atan2(y_, x_)
        ARML.append(uvs('RagTail%d' % j, Vector((x_, y_, RIMZ + dz)), (0.05, 0.016, 0.13), M_RAG, 10, 6, rot=(0.0, tw, ag + math.pi / 2)))
elif K['hook'] == 'skep':
    M_CLOVER = mat('Orn_Clover', (1.0, 0.86, 0.93), 0.5)
    M_DOOR = mat('Orn_Door', (0.03, 0.025, 0.02), 0.9)
    SK_W = 1.18 * 1.20
    # dark inside the entrance arch
    aw = 0.11 * SK_W; ah = 0.16 * SK_W
    pd, nd = surf(Vector((0, -1, 0)), Vector((0, 0, 0.02 + ah * 0.45)))
    BODYO.append(uvs('DoorDark', Vector((0, pd.y + 0.012, 0.03 + ah * 0.48)), (aw * 0.92, 0.03, ah * 0.48), M_DOOR, 12, 7))
    # clover crown: 5 blossom bumps (r 0.04-0.06 W) on the dome top, so they break the outline
    for i in range(5):
        ag = 2 * math.pi * i / 5 + 0.3; rr = 0.20 * SK_W * (0.55 if i % 2 else 1.0)
        ph, nh = ray_down(math.cos(ag) * rr, math.sin(ag) * rr); r_ = SK_W * (0.04 + 0.01 * (i % 3))
        HEAD.append(uvs('Clover%d' % i, ph + nh * r_ * 0.55, (r_, r_, r_ * 0.8), M_CLOVER, 10, 6))
    M_MOTE = mat('Spore', (1.0, 0.92, 0.45), 0.4, emit=(1.0, 0.8, 0.3))
    # 4 free pollen motes (r 0.035-0.045 W) orbiting ~0.8 W from center
    for i, (azd, zf, rf) in enumerate([(200, 0.62, 0.040), (340, 0.85, 0.036), (20, 0.40, 0.044), (160, 0.28, 0.038)]):
        ag = math.radians(azd); rr = 0.8 * SK_W; r_ = rf * SK_W
        ORBIT.append(uvs('Mote%d' % i, Vector((math.cos(ag) * rr, math.sin(ag) * rr, H * zf)), (r_, r_, r_), M_MOTE, 10, 6))
if EL == 'water' and K.get('crest') == 'water':
    pass
# ---------------- apply transforms ----------------
ALL = [body] + HEAD + BODYO + ROOTO + ARML + ARMR + CREST + ORBIT
for o in ALL: bpy.context.view_layer.objects.active = o; o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); bpy.ops.object.select_all(action='DESELECT')

# ---------------- rig ----------------
arm_d = bpy.data.armatures.new('GelRig'); rig = link(bpy.data.objects.new('GelRig', arm_d))
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
def bone(n, h, t, par=None):
    b = arm_d.edit_bones.new(n); b.head = h; b.tail = t
    if par: b.parent = arm_d.edit_bones[par]
    return b
BONES = ['root', 'body', 'head', 'arm.L', 'arm.R', 'crest', 'orbit']
bone('root', (0, 0, 0), (0, 0, 0.22)); bone('body', (0, 0, 0.22), (0, 0, H * 0.55), 'root'); bone('head', (0, 0, H * 0.55), (0, 0, H * 1.0), 'body')
bone('arm.L', tuple(ARM_PTS['L'][0]), tuple(ARM_PTS['L'][3]), 'body'); bone('arm.R', tuple(ARM_PTS['R'][0]), tuple(ARM_PTS['R'][3]), 'body')
bone('crest', (0, 0.04, H - 0.10), (0, 0.04, H + 0.5), 'head'); bone('orbit', (0, 0, 0.3), (0, 0, 0.8), 'root')
bpy.ops.object.mode_set(mode='OBJECT')
def seg_d(p, a_, b_):
    ab = b_ - a_; t = max(0, min(1, (p - a_).dot(ab) / ab.length_squared)); return (p - (a_ + ab * t)).length, t
def weight(o, fn):
    for n in BONES: o.vertex_groups.new(name=n)
    for v in o.data.vertices:
        for n, w in fn(v.co).items():
            if w > 1e-3: o.vertex_groups[n].add([v.index], w, 'REPLACE')
    md = o.modifiers.new('Armature', 'ARMATURE'); md.object = rig; o.parent = rig
def body_w(co):
    z = co.z / H
    wh = smooth(0.48, 0.82, z); wr = 1 - smooth(0.05, 0.30, z); wb = max(0, 1 - wh - wr)
    w = {'root': wr, 'body': wb, 'head': wh}
    if K['hook'] == 'brazier' and co.z > H - 0.06 and abs(co.x) < 0.45:
        wc = smooth(H - 0.06, H + 0.10, co.z); w = {k: v * (1 - wc) for k, v in w.items()}; w['crest'] = wc
    for side, s in (('L', 1), ('R', -1)):
        pts = ARM_PTS[side]
        if co.x * s < 0.30: continue
        dd, t = seg_d(co, pts[0], pts[3] + (pts[3] - pts[2]) * 0.8)
        ga = smooth(0.30, 0.46, co.x * s) * math.exp(-(dd / 0.22) ** 2)
        if ga > 0.01:
            w = {k: v * (1 - ga) for k, v in w.items()}; w['arm.' + side] = ga
    tot = sum(w.values()); return {k: v / tot for k, v in w.items()}
weight(body, body_w)
for o in HEAD: weight(o, lambda co: {'head': 1.0})
for o in BODYO: weight(o, lambda co: {'body': 1.0})
for o in ROOTO: weight(o, lambda co: {'root': 1.0})
for o in ARML: weight(o, lambda co: {'arm.L': 1.0})
for o in ARMR: weight(o, lambda co: {'arm.R': 1.0})
for o in CREST: weight(o, lambda co: {'crest': 1.0})
for o in ORBIT: weight(o, lambda co: {'orbit': 1.0})

# ---------------- animation ----------------
rig.animation_data_create(); PB = rig.pose.bones
for pb in PB: pb.rotation_mode = 'XYZ'
def clip(name, frames, keys, loop=True):
    act = bpy.data.actions.new(name); rig.animation_data.action = act
    for f in sorted(set([0, frames] + [k[0] for k in keys])):
        for pb in PB: pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
        for (kf, bn, ch, val) in keys:
            if kf == f: setattr(PB[bn], ch, val)
        if loop and f == frames:
            for (kf, bn, ch, val) in keys:
                if kf == 0: setattr(PB[bn], ch, val)
        for pb in PB:
            for ch in ('location', 'rotation_euler', 'scale'): pb.keyframe_insert(ch, frame=f)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, act); tr.mute = True
    rig.animation_data.action = None; return act
S = lambda sx, sy, sz: (sx, sy, sz)
ORB = [(f, 'orbit', 'rotation_euler', (0, 2 * math.pi * f / 90.0, 0)) for f in range(0, 91, 10)] if ORBIT else []
if K['hook'] == 'canoe':
    # slow rowing stroke with the oar arm; body rocks fore and aft on the stroke (90f)
    idle = [(0, 'arm.R', 'rotation_euler', (-0.12, 0, 0.03)), (30, 'arm.R', 'rotation_euler', (0.22, 0, -0.06)), (55, 'arm.R', 'rotation_euler', (0.08, 0, 0.06)),
            (0, 'body', 'rotation_euler', (-0.05, 0, 0)), (30, 'body', 'rotation_euler', (0.07, 0, 0)), (60, 'body', 'rotation_euler', (-0.02, 0, 0)),
            (15, 'root', 'scale', S(1.03, 0.96, 1.03)), (60, 'root', 'scale', S(0.99, 1.02, 0.99)),
            (20, 'arm.L', 'rotation_euler', (0, 0, 0.10)), (65, 'arm.L', 'rotation_euler', (0, 0, -0.06))]; IDLE_N = 90
elif K['hook'] == 'brazier':
    # proud breathing, then a SHOUT: torch cone flares taller, arms thrown wide (90f)
    idle = [(0, 'root', 'scale', S(1, 1, 1)), (20, 'root', 'scale', S(1.03, 0.96, 1.03)), (40, 'root', 'scale', S(1.0, 1.0, 1.0)),
            (52, 'root', 'scale', S(0.98, 1.04, 0.98)), (52, 'crest', 'scale', S(1.04, 1.12, 1.04)), (52, 'arm.L', 'rotation_euler', (0, 0, 0.85)), (52, 'arm.R', 'rotation_euler', (0, 0, -0.85)),
            (52, 'head', 'rotation_euler', (-0.16, 0, 0)), (64, 'crest', 'scale', S(1.0, 1.06, 1.0)), (72, 'root', 'scale', S(1.02, 0.98, 1.02)),
            (80, 'crest', 'scale', S(1, 1, 1)), (80, 'arm.L', 'rotation_euler', (0, 0, 0.05)), (80, 'arm.R', 'rotation_euler', (0, 0, -0.05)), (80, 'head', 'rotation_euler', (0.02, 0, 0))]; IDLE_N = 90
else:
    # gentle humming sway; motes circle (90f)
    idle = [(0, 'body', 'rotation_euler', (0, 0.06, 0)), (45, 'body', 'rotation_euler', (0, -0.06, 0)),
            (22, 'head', 'rotation_euler', (0.03, 0, 0.05)), (67, 'head', 'rotation_euler', (-0.02, 0, -0.05)),
            (22, 'root', 'scale', S(1.03, 0.965, 1.03)), (67, 'root', 'scale', S(0.99, 1.015, 0.99)),
            (22, 'arm.L', 'rotation_euler', (0, 0, 0.14)), (67, 'arm.L', 'rotation_euler', (0, 0, -0.06)),
            (22, 'arm.R', 'rotation_euler', (0, 0, -0.06)), (67, 'arm.R', 'rotation_euler', (0, 0, 0.14))] + ORB; IDLE_N = 90
clip('idle', IDLE_N, idle)
clip('hop', 24, [(4, 'root', 'scale', S(1.18, 0.78, 1.18)), (8, 'root', 'scale', S(0.86, 1.22, 0.86)), (8, 'root', 'location', (0, 0.25, 0)),
                 (12, 'root', 'location', (0, 0.42, 0)), (12, 'root', 'scale', S(0.94, 1.08, 0.94)), (17, 'root', 'location', (0, 0, 0)),
                 (18, 'root', 'scale', S(1.22, 0.76, 1.22)), (21, 'root', 'scale', S(0.97, 1.04, 0.97)),
                 (8, 'arm.L', 'rotation_euler', (0, 0, 0.6)), (8, 'arm.R', 'rotation_euler', (0, 0, -0.6)),
                 (14, 'head', 'rotation_euler', (-0.12, 0, 0)), (19, 'head', 'rotation_euler', (0.14, 0, 0))], loop=False)
clip('attack', 21, [(5, 'root', 'scale', S(1.15, 0.84, 1.15)), (5, 'body', 'rotation_euler', (-0.22, 0, 0)), (5, 'arm.L', 'rotation_euler', (-0.6, 0, 0.3)),
                    (9, 'root', 'scale', S(0.84, 1.18, 0.84)), (9, 'body', 'rotation_euler', (0.42, 0, 0)), (9, 'head', 'rotation_euler', (0.25, 0, 0)),
                    (9, 'arm.L', 'rotation_euler', (1.2, 0, 0.3)), (9, 'arm.R', 'rotation_euler', (1.2, 0, -0.3)),
                    (13, 'root', 'scale', S(1.1, 0.9, 1.1)), (13, 'body', 'rotation_euler', (0.2, 0, 0)), (17, 'body', 'rotation_euler', (-0.06, 0, 0))], loop=False)
clip('cast', 30, [(6, 'root', 'scale', S(1.1, 0.88, 1.1)), (12, 'root', 'scale', S(0.88, 1.2, 0.88)), (12, 'crest', 'scale', S(1.1, 1.3, 1.1)),
                  (12, 'arm.L', 'rotation_euler', (0, 0, 1.2)), (12, 'arm.R', 'rotation_euler', (0, 0, -1.2)),
                  (16, 'head', 'rotation_euler', (-0.18, 0, 0.1)), (20, 'head', 'rotation_euler', (-0.14, 0, -0.1)),
                  (20, 'arm.L', 'rotation_euler', (0, 0, 1.05)), (20, 'arm.R', 'rotation_euler', (0, 0, -1.05)),
                  (22, 'root', 'scale', S(0.92, 1.12, 0.92)), (26, 'root', 'scale', S(1.06, 0.94, 1.06))], loop=False)
clip('hit', 14, [(2, 'root', 'scale', S(1.2, 0.8, 1.2)), (2, 'body', 'rotation_euler', (-0.35, 0, 0.05)), (2, 'head', 'rotation_euler', (-0.25, 0, 0)),
                 (2, 'arm.L', 'rotation_euler', (0, 0, 0.5)), (2, 'arm.R', 'rotation_euler', (0, 0, -0.5)),
                 (5, 'root', 'scale', S(0.9, 1.1, 0.9)), (5, 'body', 'rotation_euler', (0.12, 0, -0.04)),
                 (8, 'root', 'scale', S(1.06, 0.94, 1.06)), (8, 'body', 'rotation_euler', (-0.06, 0, 0)), (11, 'root', 'scale', S(0.98, 1.02, 0.98))], loop=False)
clip('faint', 36, [(6, 'root', 'scale', S(0.95, 1.08, 0.95)), (6, 'head', 'rotation_euler', (0.2, 0, 0.1)),
                   (18, 'root', 'scale', S(1.3, 0.6, 1.3)), (18, 'head', 'rotation_euler', (0.5, 0, 0.2)),
                   (18, 'arm.L', 'rotation_euler', (0, 0, -0.7)), (18, 'arm.R', 'rotation_euler', (0, 0, 0.7)),
                   (36, 'root', 'scale', S(1.6, 0.22, 1.6)), (36, 'head', 'rotation_euler', (0.7, 0, 0.2)),
                   (36, 'arm.L', 'rotation_euler', (0, 0, -1.0)), (36, 'arm.R', 'rotation_euler', (0, 0, 1.0))], loop=False)
for tr in rig.animation_data.nla_tracks: tr.mute = False

# ---------------- export ----------------
os.makedirs(OUT, exist_ok=True)
PARTS = list(ALL)
def tris(objs): return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
def export(path):
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
    for o in PARTS: o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False,
                              export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
                              export_yup=True, export_lights=False, export_cameras=False, export_extras=True,
                              export_force_sampling=True, export_optimize_animation_size=True)
    print('EXPORTED', path, os.path.getsize(path), 'tris', tris(PARTS))
name = 'hero_' + HID
export(os.path.join(OUT, name + '.glb'))
for lod, target in (('_lod1', 3400), ('_lod2', 900)):
    if lod == '_lod2':
        for o in list(PARTS):
            if o.name.startswith(('EyeShine2', 'Bubble1', 'Mouth', 'InBubble', 'Ember', 'Comb', 'Rivet', 'RagTail', 'CLeaf', 'CharmCord')): PARTS.remove(o)
    tot = tris(PARTS); r = min(1.0, target / tot)
    for o in PARTS:
        t = tris([o])
        if t < 40: continue
        d = o.modifiers.new('dec', 'DECIMATE'); d.ratio = max(r, 24.0 / t)
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.modifier_move_to_index(modifier='dec', index=0); bpy.ops.object.modifier_apply(modifier='dec')
    export(os.path.join(OUT, name + lod + '.glb'))
print('DONE', HID, 'H', round(H, 3), 'top', round(HT, 3))
