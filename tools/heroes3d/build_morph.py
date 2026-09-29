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
    for F in FOOT:
        g = math.exp(-((d - F).length ** 2) / 0.26 ** 2); co += Vector((F.x, F.y, 0)).normalized() * 0.07 * g
    phi = math.atan2(y, x)
    sagk = 0.10 * math.exp(-((z + 0.18) / 0.20) ** 2) * (1 + 0.45 * math.sin(LOBES * phi + SEED))
    co.x *= 1 + sagk; co.y *= 1 + sagk
    if K['hook'] == 'skep':
        # straw bee skep: stacked horizontal ridge rings up the dome
        zn = (zz + ZB) / (P['ztop'] + ZB)
        if 0.18 < zn < 0.97:
            rid = max(0.0, math.sin(zn * math.pi * 11.0)) ** 1.6
            co.x *= 1 + 0.045 * rid; co.y *= 1 + 0.045 * rid
    co.x += 0.04 * max(0, z) ** 1.5
    n = _nz.noise(d * 1.7 + Vector((SEED * 3.1, 0, 0)))
    co += Vector((x, y, 0.4 * z)) * 0.028 * n
    co.z += LIFT; v.co = co
H = max(v.co.z for v in bm.verts)
EYE_Z = dict(water=0.52, fire=0.50, plant=0.50)[EL]
ZE = H * EYE_Z; MZ = H * (EYE_Z - 0.15)
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
for s, side in ((1, 'L'), (-1, 'R')):
    pts = [Vector((s * 0.36, 0.02, 0.50)), Vector((s * 0.60, -0.04, 0.47)), Vector((s * 0.80, -0.11, 0.39)), Vector((s * 0.92, -0.17, 0.33))]
    ARM_PTS[side] = pts
    MERGE.append(curve_tube('Arm' + side, [(pts[0], 1.25), (pts[1], 0.95), (pts[2], 0.72), (pts[3], 0.55)], 0.12, M_BODY, res=8))
    MERGE.append(uvs('ArmTip' + side, pts[3] + Vector((s * 0.02, -0.01, 0)), (0.075, 0.075, 0.07), M_BODY, 16, 10))
# drips + beads (element kit)
DRIPS = dict(water=[(-145, 0.60, 1.0), (-28, 0.66, 0.9), (160, 0.62, 1.0)],
             fire=[(-150, 0.50, 1.1), (40, 0.45, 0.9), (170, 0.52, 1.0)],
             plant=[(-135, 0.58, 1.0), (25, 0.60, 1.0), (150, 0.50, 0.8)])[EL]
for i, (az, zf, w) in enumerate(DRIPS):
    a_ = math.radians(az); dv = Vector((math.cos(a_), math.sin(a_), 0)); pts = []
    for k in range(6):
        t = k / 5; zc = H * zf * (1 - t) + 0.07 * t; p, n = surf0(dv, Vector((0, 0, zc)))
        pts.append((p - n * 0.012, (0.9 - 0.35 * t + 0.25 * t ** 6) * w))
    MERGE.append(curve_tube('Drip%d' % i, pts, 0.055, M_BODY, res=5))
    p, n = surf0(dv, Vector((0, 0, 0.06))); MERGE.append(uvs('Bead%d' % i, p + n * 0.015, (0.08 * w, 0.08 * w, 0.06 * w), M_BODY, 16, 10))

# ---------------- hero hooks (gel parts that fuse into the body) ----------------
CREST_MERGE = []   # gel fused into body but weighted to the crest bone (above the head)
if K['hook'] == 'canoe':
    # lower body flares into a shallow flat-bottomed canoe hull, bow + stern upturned. Long axis runs left/right
    # (across the fight camera) so the upturned bow never climbs into the face or reads as a snout.
    bm_ = bmesh.new(); bmesh.ops.create_uvsphere(bm_, u_segments=40, v_segments=20, radius=1.0)
    for v in bm_.verts:
        x, y, z = v.co; zz = z * (0.22 if z < 0 else 0.10)
        zz += 0.22 * abs(x) ** 4.0                     # upturned ends
        v.co = Vector((x * 0.98, y * 0.58 * (1 - 0.35 * abs(x) ** 2), max(-0.17, zz) + 0.18))
    me_ = bpy.data.meshes.new('Hull'); bm_.to_mesh(me_); bm_.free()
    MERGE.append(link(bpy.data.objects.new('Hull', me_))); me_.materials.append(M_BODY)
    # right arm ends in a broad oar blade (gel)
    tip = ARM_PTS['R'][3]
    MERGE.append(uvs('Oar', tip + Vector((-0.09, -0.04, -0.12)), (0.035, 0.12, 0.21), M_BODY, 20, 12, rot=(0.25, 0.0, 0.35)))
    MERGE.append(curve_tube('OarNeck', [(tip, 1.0), (tip + Vector((-0.06, -0.03, -0.06)), 0.7)], 0.05, M_BODY, res=4))
elif K['hook'] == 'brazier':
    # tall narrow torch-cone flame rising from the top (gel; hot tip via the fire kit's tip glow)
    b0 = Vector((0.0, 0.04, H - 0.14))
    CREST_MERGE.append(curve_tube('Torch', [(b0, 1.5), (b0 + Vector((0.02, 0, 0.20)), 1.05), (b0 + Vector((-0.03, 0, 0.42)), 0.62),
                                             (b0 + Vector((0.02, 0, 0.62)), 0.28), (b0 + Vector((0.00, 0, 0.78)), 0.03)], 0.13, M_BODY, res=8))
    for i, (ox, hgt) in enumerate([(0.20, 0.26), (-0.21, 0.24)]):
        bb = Vector((ox, 0.10, H - 0.20))
        MERGE.append(curve_tube('Lick%d' % i, [(bb, 1.1), (bb + Vector((ox * 0.3, 0, hgt * 0.5)), 0.6), (bb + Vector((ox * 0.5, 0, hgt)), 0.05)], 0.08, M_BODY, res=5))
elif K['hook'] == 'skep':
    pass   # the skep ridges are sculpted into the body above

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
core = uvs('GelCore', Vector((0.02, 0.04, H * 0.36)), (P['rx'] * 0.46, P['rx'] * 0.42, H * 0.22), M_CORE, 18, 10); BODYO.append(core)
if EL == 'water':
    M_BUB = mat('GelBubble', (0.85, 0.97, 1.0), 0.05)
    # gel twist (Pell): a waterline. Lower half crystal clear, upper half full of small suspended bubbles
    for i, q in enumerate(inside_pts(26, 0.5, H * 0.50, H * 0.80, 0.07)):
        r_ = rng.uniform(0.012, 0.03); BODYO.append(uvs('InBubble%d' % i, q, (r_, r_, r_), M_BUB, 8, 5))
    for i, (bx, by, bz, br) in enumerate([(0.62, -0.10, 0.98, 0.05), (-0.66, 0.0, 0.84, 0.035)]):
        HEAD.append(uvs('Bubble%d' % i, Vector((bx, by, bz)), (br, br, br), M_BUB, 12, 7))
elif EL == 'fire':
    M_EM = mat('Ember', (1.0, 0.6, 0.15), 0.4, emit=(1.0, 0.5, 0.1))
    for i, q in enumerate(inside_pts(12, 0.5, 0.10, H * 0.80)):
        r_ = rng.uniform(0.014, 0.03); BODYO.append(uvs('Ember%d' % i, q, (r_, r_, r_ * 1.4), M_EM, 7, 4))
elif EL == 'plant':
    M_SP = mat('Spore', (0.85, 1.0, 0.55), 0.4, emit=(0.6, 0.9, 0.3))
    # gel twist (Comb): hexagonal honeycomb cells suspended around the amber honey core
    M_COMB = mat('Orn_Comb', (1.0, 0.66, 0.16), 0.35, emit=(1.0, 0.55, 0.08), estr=0.9)
    for i, q in enumerate(inside_pts(15, 0.50, H * 0.14, H * 0.66, 0.075)):
        BODYO.append(cyl('Comb%d' % i, q, rng.uniform(0.055, 0.075), 0.04, M_COMB, verts=6, rot=(rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0, 3))))

# ---------------- ornaments (separate, authored colours) ----------------
if K['hook'] == 'canoe':
    M_KELP = mat('Orn_Kelp', (0.16, 0.34, 0.12), 0.6)
    M_SHELL = mat('Orn_Shell', (1.0, 0.82, 0.74), 0.35)
    # kelp-rope sash tied diagonally across the front (right shoulder -> left hip), hugging the surface
    sp = []
    for k in range(9):
        t = k / 8; ang = FRONT + (-0.85 + 1.7 * t); z = H * (0.27 - 0.17 * t)
        p, n = surf(Vector((math.cos(ang), math.sin(ang), 0)), Vector((0, 0, z))); sp.append((p + n * 0.012, 1.0))
    BODYO.append(curve_tube('Sash', sp, 0.03, M_KELP, res=4, bres=1))
    knot = sp[5][0]
    BODYO.append(uvs('SashKnot', knot, (0.035, 0.03, 0.03), M_KELP, 10, 6))
    BODYO.append(curve_tube('CharmCord', [(knot, 1.0), (knot + Vector((0.005, -0.02, -0.06)), 1.0)], 0.006, M_KELP, res=3, bres=1))
    sh = cyl('ShellCharm', knot + Vector((0.005, -0.025, -0.085)), 0.03, 0.035, M_SHELL, verts=10, r2=0.004, rot=(math.pi, 0, 0)); BODYO.append(sh)
elif K['hook'] == 'brazier':
    M_IRON = mat('Orn_Iron', (0.10, 0.09, 0.085), 0.55, metal=0.8)
    M_RAG = mat('Orn_Rag', (0.85, 0.18, 0.10), 0.8)
    # soot-black iron brazier bowl ringing the upper body, below the eyes; four short decorative legs
    zb = H * 0.20; zt = H * 0.37
    pr0, _ = surf(Vector((1, 0, 0)), Vector((0, 0, zb))); pr1, _ = surf(Vector((1, 0, 0)), Vector((0, 0, zt)))
    r0 = abs(pr0.x) + 0.03; r1 = abs(pr1.x) + 0.05
    prof = [(r0, zb), (r0 + 0.025, zb + 0.02), ((r0 + r1) / 2 + 0.05, (zb + zt) / 2), (r1 + 0.05, zt - 0.01), (r1 + 0.075, zt), (r1 + 0.06, zt + 0.018), (r1 + 0.02, zt + 0.012),
            ((r0 + r1) / 2 + 0.02, (zb + zt) / 2), (r0 - 0.01, zb + 0.01), (r0, zb)]
    bowl = lathe('Brazier', prof, M_IRON, seg=44); BODYO.append(bowl)
    for i in range(4):
        ag = math.radians(45 + 90 * i); rr = (r0 + r1) / 2 + 0.06
        c = Vector((math.cos(ag) * rr, math.sin(ag) * rr, zb - 0.02))
        BODYO.append(cyl('BrazLeg%d' % i, c, 0.022, 0.12, M_IRON, verts=8, r2=0.012, rot=(math.sin(ag) * 0.35, -math.cos(ag) * 0.35, 0)))
        BODYO.append(uvs('Rivet%d' % i, Vector((math.cos(ag + 0.78) * (r1 + 0.06), math.sin(ag + 0.78) * (r1 + 0.06), zt - 0.03)), (0.016, 0.016, 0.016), M_IRON, 8, 5))
    # knotted signal rag on the left arm
    ap = ARM_PTS['L'][2]
    ARML.append(lathe('RagBand', [(0.098, -0.032), (0.108, 0.0), (0.098, 0.032)], M_RAG, seg=18, loc=tuple(ap)))
    ARML[-1].rotation_euler = (0, math.radians(68), 0)
    ARML.append(uvs('RagKnot', ap + Vector((0.0, -0.10, 0.02)), (0.03, 0.025, 0.03), M_RAG, 10, 6))
    for j, (dx, dz) in enumerate([(0.03, -0.09), (-0.02, -0.08)]):
        ARML.append(uvs('RagTail%d' % j, ap + Vector((dx, -0.11, dz)), (0.018, 0.008, 0.05), M_RAG, 10, 6, rot=(0.2, 0.3 * (1 - 2 * j), 0)))
elif K['hook'] == 'skep':
    M_CLOV = mat('Orn_Clover', (1.0, 0.50, 0.72), 0.6, emit=(1.0, 0.35, 0.6), estr=0.25)
    M_CLEAF = mat('Orn_CloverLeaf', (0.20, 0.55, 0.16), 0.6)
    M_MOTE = mat('Spore', (1.0, 0.92, 0.45), 0.4, emit=(1.0, 0.8, 0.3))
    # clover-flower crown around the top of the dome
    for i in range(7):
        ag = 2 * math.pi * i / 7 + 0.2; zc = HT - 0.10
        p, n = surf(Vector((math.cos(ag), math.sin(ag), 0)), Vector((0, 0, zc)))
        if p is None: continue
        c = p + n * 0.03 + Vector((0, 0, 0.02))
        for j2 in range(3):   # clover head = a tight cluster of little pink florets, not one bead
            a2 = ag + 2.1 * j2
            HEAD.append(uvs('Clover%d_%d' % (i, j2), c + Vector((math.cos(a2) * 0.022, math.sin(a2) * 0.022, 0.012 * j2)), (0.03, 0.03, 0.034), M_CLOV, 10, 6))
        for j in range(3):
            aj = ag + (j - 1) * 0.7
            HEAD.append(uvs('CLeaf%d_%d' % (i, j), p + n * 0.01 + Vector((math.cos(aj) * 0.05, math.sin(aj) * 0.05, -0.01)), (0.055, 0.04, 0.01), M_CLEAF, 10, 5, rot=(0, 0.3, aj)))
    # glowing pollen motes orbiting like bees (orbit bone spins them)
    for i in range(5):
        ag = 2 * math.pi * i / 5; rr = P['rx'] + 0.26 + 0.05 * (i % 2)
        ORBIT.append(uvs('Mote%d' % i, Vector((math.cos(ag) * rr, math.sin(ag) * rr, H * (0.55 + 0.12 * math.sin(ag * 2)))), (0.028, 0.028, 0.028), M_MOTE, 10, 6))
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
    if K['hook'] == 'brazier' and co.z > H - 0.06 and abs(co.x) < 0.16:
        wc = smooth(H - 0.06, H + 0.10, co.z); w = {k: v * (1 - wc) for k, v in w.items()}; w['crest'] = wc
    for side, s in (('L', 1), ('R', -1)):
        pts = ARM_PTS[side]
        if co.x * s < 0.30: continue
        dd, t = seg_d(co, pts[0], pts[3] + (pts[3] - pts[2]) * 0.8)
        ga = smooth(0.30, 0.46, co.x * s) * math.exp(-(dd / 0.22) ** 2)
        if K['hook'] == 'canoe' and side == 'R' and co.z < 0.36 and co.x * s > 0.72: ga = max(ga, smooth(0.72, 0.82, co.x * s))
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
    idle = [(0, 'arm.R', 'rotation_euler', (-0.55, 0, 0.10)), (30, 'arm.R', 'rotation_euler', (0.75, 0, -0.25)), (55, 'arm.R', 'rotation_euler', (0.35, 0, 0.35)),
            (0, 'body', 'rotation_euler', (-0.05, 0, 0)), (30, 'body', 'rotation_euler', (0.10, 0, 0)), (60, 'body', 'rotation_euler', (-0.02, 0, 0)),
            (15, 'root', 'scale', S(1.03, 0.96, 1.03)), (60, 'root', 'scale', S(0.99, 1.02, 0.99)),
            (20, 'arm.L', 'rotation_euler', (0, 0, 0.10)), (65, 'arm.L', 'rotation_euler', (0, 0, -0.06))]; IDLE_N = 90
elif K['hook'] == 'brazier':
    # proud breathing, then a SHOUT: torch cone flares taller, arms thrown wide (90f)
    idle = [(0, 'root', 'scale', S(1, 1, 1)), (20, 'root', 'scale', S(1.03, 0.96, 1.03)), (40, 'root', 'scale', S(1.0, 1.0, 1.0)),
            (52, 'root', 'scale', S(0.92, 1.12, 0.92)), (52, 'crest', 'scale', S(1.12, 1.55, 1.12)), (52, 'arm.L', 'rotation_euler', (0, 0, 0.85)), (52, 'arm.R', 'rotation_euler', (0, 0, -0.85)),
            (52, 'head', 'rotation_euler', (-0.16, 0, 0)), (64, 'crest', 'scale', S(1.0, 1.25, 1.0)), (72, 'root', 'scale', S(1.02, 0.98, 1.02)),
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
