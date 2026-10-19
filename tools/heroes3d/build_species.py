# Blender 4.2+: build a species slime by INFLATING its approved concept silhouette (front outline matches the card).
# usage: blender -b -P build_species.py -- <key> <mask.png> <outdir> [hover]
#   key = <element>_<rarity>_a  e.g. water_common_a ; hover = world lift for weightless species (Stormcore)
# Output sp_<key>.glb (+_lod1,_lod2). Materials GelBody/GelEye/GelEyeShine restyled at runtime (heroGel3d.js).
import bpy, sys, math, os
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--') + 1:]
KEY, MASK, OUT = a[0], a[1], a[2]; HOVER = float(a[3]) if len(a) > 3 else 0.0; EYEF = float(a[4]) if len(a) > 4 else None
SCALE = float(a[5]) if len(a) > 5 else 1.0; GLOWMAP = a[6] if len(a) > 6 else None
NOFACE = True   # ruling Oct 19 2026 (Reed/Serif): species have no face; approved cards + standing rule 6 win
EL = KEY.split('_')[0]
WORLD_PER_CW = 0.42          # world units per concept "W" (360 px); same for every lineage so C/U/R keep their size ratio
DEPTH = 0.82                 # front-to-back thickness vs a round cross-section
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = 30
def link(ob): sc.collection.objects.link(ob); return ob
def mat(name, col, rough=0.3, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 1.0
    return m
ELCOL = dict(water=(0.35, 0.7, 1.0), lightning=(1.0, 0.94, 0.38), earth=(0.55, 0.42, 0.28), poison=(0.45, 0.25, 0.65)).get(EL, (0.7, 0.7, 0.7))
M_BODY = mat('GelBody', ELCOL, 0.15); M_EYE = mat('GelEye', (0.02, 0.03, 0.07), 0.05); M_SHINE = mat('GelEyeShine', (1, 1, 1), 0.2, (1, 1, 1))

# ---- mask -> inflated heightfield ----
img = bpy.data.images.load(MASK); w0, h0 = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(h0, w0, img.channels)  # bottom row first
al = px[..., 3] if img.channels == 4 else px[..., 0]
if al.min() > 0.99: al = px[..., 0]   # greyscale mask (white = body) loads with an opaque alpha
ys, xs = np.where(al > 0.5); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
STEP = max(1, int(round((y1 - y0) / 230)))
m = al[y0:y1 + 1:STEP, x0:x1 + 1:STEP] > 0.5
m = np.pad(m, 2); H_, W_ = m.shape
cell = STEP / 360.0 * WORLD_PER_CW * SCALE
# brute-force Euclidean distance to the outline
inside = m; er = inside.copy()
er[1:-1, 1:-1] = inside[1:-1, 1:-1] & inside[:-2, 1:-1] & inside[2:, 1:-1] & inside[1:-1, :-2] & inside[1:-1, 2:]
by, bx = np.where(inside & ~er); B = np.stack([by, bx], 1).astype(np.float32)
iy, ix = np.where(inside); D = np.zeros(m.shape, np.float32)
for s in range(0, len(iy), 4000):
    P = np.stack([iy[s:s + 4000], ix[s:s + 4000]], 1).astype(np.float32)
    d = np.sqrt(((P[:, None, :] - B[None, :, :]) ** 2).sum(-1)).min(1)
    D[iy[s:s + 4000], ix[s:s + 4000]] = d + 0.5
R = D.max()
Hh = np.sqrt(np.clip(2 * R * D - D * D, 0, None)) * DEPTH * cell   # half thickness
if EL == 'lightning':   # bolt lobes stay thin, lens-flat blades that thin to the tip (no round tubes); only the core is a ball
    Hh = np.minimum(Hh, D * cell * 0.55 * DEPTH)
    core = np.zeros_like(D); cyx = np.array(np.unravel_index(np.argmax(D), D.shape), np.float32)
    yy, xx = np.mgrid[0:D.shape[0], 0:D.shape[1]]; rr = np.hypot(yy - cyx[0], xx - cyx[1])
    full = np.sqrt(np.clip(2 * R * D - D * D, 0, None)) * DEPTH * cell
    w = np.clip((R * 1.15 - rr) / (R * 0.25), 0, 1); Hh = Hh * (1 - w) + full * w
Hh[~inside] = 0
# closed surface: nodes sit between pixels; outline nodes are shared by front and back (thickness 0)
verts = []; faces = []; idx = {}
P = np.pad(inside, 1); HP = np.pad(Hh, 1)
def node(side, j, i):   # node at the corner shared by pixels (j-1..j, i-1..i)
    blk = P[j:j + 2, i:i + 2]
    edge = not blk.all()
    k = ('e', j, i) if edge else (side, j, i)
    if k not in idx:
        h = 0.0 if edge else float(HP[j:j + 2, i:i + 2].mean())
        idx[k] = len(verts); verts.append(((i - 2) * cell, -side * h, (j - 2) * cell))
    return idx[k]
for side in (1, -1):
    for j in range(H_):
        for i in range(W_):
            if inside[j, i]:
                f = [node(side, j, i), node(side, j, i + 1), node(side, j + 1, i + 1), node(side, j + 1, i)]
                faces.append(f if side > 0 else f[::-1])
me = bpy.data.meshes.new('body'); me.from_pydata(verts, [], faces); me.update()
body = link(bpy.data.objects.new('body', me))
# centre x on the base, ground at z = 0 (+ hover)
xs_ = [v[0] for v in verts]; zs_ = [v[2] for v in verts if v[1] != 0 or True]
zmin = min(v[2] for v in verts); base = [v[0] for v in verts if v[2] < zmin + 0.06 and abs(v[1]) > 0.002] or xs_
xc = (min(base) + max(base)) / 2
for v in body.data.vertices: v.co.x -= xc; v.co.z -= zmin - HOVER
XC0, ZM0 = xc, zmin - HOVER
bpy.context.view_layer.objects.active = body; body.select_set(True)
rm = body.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.008 if EL == 'lightning' else 0.011; bpy.ops.object.modifier_apply(modifier='rm')
smm = body.modifiers.new('sm', 'CORRECTIVE_SMOOTH'); smm.iterations = 2 if EL == 'lightning' else 6; smm.smooth_type = 'LENGTH_WEIGHTED'; smm.use_only_smooth = True
bpy.ops.object.modifier_apply(modifier='sm')
t0 = sum(len(p.vertices) - 2 for p in body.data.polygons)
dc = body.modifiers.new('dc', 'DECIMATE'); dc.ratio = min(1, 6800 / t0); bpy.ops.object.modifier_apply(modifier='dc')
body.data.materials.clear(); body.data.materials.append(M_BODY)
for p in body.data.polygons: p.use_smooth = True
Z = [v.co.z for v in body.data.vertices]; ZLO, ZHI = min(Z), max(Z); H = ZHI - ZLO
print('BODY tris', sum(len(p.vertices) - 2 for p in body.data.polygons), 'H', round(H, 3), 'W', round(W_ * cell, 3))

HEAD = []
if GLOWMAP:   # Stormcore: bake glow (white-hot core + light pulled out along the bolt ridges) into vertex colour
    gi = bpy.data.images.load(GLOWMAP); gw, gh = gi.size
    gp = np.array(gi.pixels[:], dtype=np.float32).reshape(gh, gw, gi.channels)[..., 0]
    ca = body.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for v in body.data.vertices:
        i = (v.co.x + XC0) / cell + 2; j = (v.co.z + ZM0) / cell + 2   # back to mask grid
        gx = int(round(x0 + (i - 2) * STEP)); gy = int(round(y0 + (j - 2) * STEP))
        g = float(gp[min(gh - 1, max(0, gy)), min(gw - 1, max(0, gx))]) if 0 <= gx < gw and 0 <= gy < gh else 0.0
        ca.data[v.index].color = (g, g, g, 1.0)
if not NOFACE:
    raise SystemExit('faces are off for species (Oct 19 ruling)')
ALL = [body] + HEAD
for o in ALL: bpy.context.view_layer.objects.active = o; o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); bpy.ops.object.select_all(action='DESELECT')

# ---- rig (same bone names as the hero rig; arms unused) ----
arm_d = bpy.data.armatures.new('GelRig'); rig = link(bpy.data.objects.new('GelRig', arm_d))
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
def bone(n, h, t, par=None):
    b = arm_d.edit_bones.new(n); b.head = h; b.tail = t
    if par: b.parent = arm_d.edit_bones[par]
BONES = ['root', 'body', 'head', 'arm.L', 'arm.R', 'crest', 'orbit']
bone('root', (0, 0, 0), (0, 0, 0.2)); bone('body', (0, 0, ZLO + 0.2 * H), (0, 0, ZLO + H * 0.55), 'root'); bone('head', (0, 0, ZLO + H * 0.55), (0, 0, ZHI), 'body')
bone('arm.L', (0.3, 0, ZLO + H * .4), (0.5, 0, ZLO + H * .4), 'body'); bone('arm.R', (-0.3, 0, ZLO + H * .4), (-0.5, 0, ZLO + H * .4), 'body')
bone('crest', (0, 0, ZHI - 0.1), (0, 0, ZHI + 0.4), 'head'); bone('orbit', (0, 0, 0.3), (0, 0, 0.8), 'root')
bpy.ops.object.mode_set(mode='OBJECT')
def smooth(e0, e1, x): t = max(0, min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)
def weight(o, fn):
    for n in BONES: o.vertex_groups.new(name=n)
    for v in o.data.vertices:
        for n, w_ in fn(v.co).items():
            if w_ > 1e-3: o.vertex_groups[n].add([v.index], w_, 'REPLACE')
    md = o.modifiers.new('Armature', 'ARMATURE'); md.object = rig; o.parent = rig
def body_w(co):
    z = (co.z - ZLO) / H; wh = smooth(0.45, 0.85, z); wr = 1 - smooth(0.05, 0.30, z); wb = max(0, 1 - wh - wr)
    t = wh + wr + wb; return {'root': wr / t, 'body': wb / t, 'head': wh / t}
weight(body, body_w)
for o in HEAD: weight(o, lambda co: {'head': 1.0})

rig.animation_data_create(); PB = rig.pose.bones
for pb in PB: pb.rotation_mode = 'XYZ'
def clip(name, frames, keys, loop=True):
    act = bpy.data.actions.new(name); rig.animation_data.action = act
    for f in sorted(set([0, frames] + [k[0] for k in keys])):
        for pb in PB: pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
        for (kf, bn, ch, val) in keys:
            if kf == f or (loop and f == frames and kf == 0): setattr(PB[bn], ch, val)
        for pb in PB:
            for ch in ('location', 'rotation_euler', 'scale'): pb.keyframe_insert(ch, frame=f)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, act); tr.mute = True
    rig.animation_data.action = None
S = lambda x, y, z: (x, y, z)
if EL == 'lightning':
    # weightless: hovers and crackles, never squashes down or sags; faint = shrinks and fizzles UP, not a puddle
    clip('idle', 60, [(0, 'root', 'location', (0, 0, 0)), (30, 'root', 'location', (0, 0.06, 0)), (15, 'head', 'rotation_euler', (0, 0.05, 0.04)),
                      (45, 'head', 'rotation_euler', (0, -0.05, -0.04)), (8, 'root', 'scale', S(1.03, 1.03, 1.03)), (11, 'root', 'scale', S(0.99, 0.99, 0.99)),
                      (40, 'root', 'scale', S(1.02, 1.02, 1.02)), (43, 'root', 'scale', S(1, 1, 1))])
    clip('hop', 20, [(6, 'root', 'location', (0, 0.35, 0)), (12, 'root', 'location', (0, 0.42, 0)), (18, 'root', 'location', (0, 0.02, 0))], loop=False)
    clip('attack', 18, [(4, 'root', 'scale', S(0.94, 0.94, 0.94)), (8, 'root', 'scale', S(1.18, 1.18, 1.18)), (8, 'body', 'rotation_euler', (0.3, 0, 0)), (14, 'root', 'scale', S(1, 1, 1))], loop=False)
    clip('cast', 30, [(10, 'root', 'location', (0, 0.15, 0)), (12, 'root', 'scale', S(1.15, 1.15, 1.15)), (16, 'root', 'scale', S(1.05, 1.05, 1.05)), (20, 'root', 'scale', S(1.2, 1.2, 1.2)), (28, 'root', 'scale', S(1, 1, 1))], loop=False)
    clip('hit', 14, [(2, 'body', 'rotation_euler', (-0.3, 0, 0.08)), (2, 'root', 'scale', S(0.9, 0.9, 0.9)), (6, 'body', 'rotation_euler', (0.1, 0, -0.05)), (10, 'root', 'scale', S(1, 1, 1))], loop=False)
    clip('faint', 36, [(10, 'root', 'location', (0, 0.1, 0)), (10, 'root', 'scale', S(1.1, 1.1, 1.1)), (36, 'root', 'location', (0, 0.3, 0)), (36, 'root', 'scale', S(0.05, 0.05, 0.05))], loop=False)
else:
    clip('idle', 90, [(22, 'root', 'scale', S(1.03, 0.965, 1.03)), (67, 'root', 'scale', S(0.99, 1.015, 0.99)), (0, 'body', 'rotation_euler', (0, 0.05, 0)),
                      (45, 'body', 'rotation_euler', (0, -0.05, 0)), (22, 'head', 'rotation_euler', (0.03, 0, 0.04)), (67, 'head', 'rotation_euler', (-0.02, 0, -0.04))])
    clip('hop', 24, [(4, 'root', 'scale', S(1.18, 0.78, 1.18)), (8, 'root', 'scale', S(0.86, 1.22, 0.86)), (8, 'root', 'location', (0, 0.25, 0)), (12, 'root', 'location', (0, 0.42, 0)),
                     (12, 'root', 'scale', S(0.94, 1.08, 0.94)), (17, 'root', 'location', (0, 0, 0)), (18, 'root', 'scale', S(1.22, 0.76, 1.22)), (21, 'root', 'scale', S(0.97, 1.04, 0.97))], loop=False)
    clip('attack', 21, [(5, 'root', 'scale', S(1.15, 0.84, 1.15)), (5, 'body', 'rotation_euler', (-0.22, 0, 0)), (9, 'root', 'scale', S(0.84, 1.18, 0.84)), (9, 'body', 'rotation_euler', (0.42, 0, 0)),
                        (9, 'head', 'rotation_euler', (0.25, 0, 0)), (13, 'root', 'scale', S(1.1, 0.9, 1.1)), (17, 'body', 'rotation_euler', (-0.06, 0, 0))], loop=False)
    clip('cast', 30, [(6, 'root', 'scale', S(1.1, 0.88, 1.1)), (12, 'root', 'scale', S(0.88, 1.2, 0.88)), (16, 'head', 'rotation_euler', (-0.18, 0, 0.1)), (22, 'root', 'scale', S(0.92, 1.12, 0.92)), (26, 'root', 'scale', S(1.06, 0.94, 1.06))], loop=False)
    clip('hit', 14, [(2, 'root', 'scale', S(1.2, 0.8, 1.2)), (2, 'body', 'rotation_euler', (-0.35, 0, 0.05)), (5, 'root', 'scale', S(0.9, 1.1, 0.9)), (8, 'root', 'scale', S(1.06, 0.94, 1.06)), (11, 'root', 'scale', S(0.98, 1.02, 0.98))], loop=False)
    clip('faint', 36, [(6, 'root', 'scale', S(0.95, 1.08, 0.95)), (18, 'root', 'scale', S(1.3, 0.6, 1.3)), (36, 'root', 'scale', S(1.6, 0.22, 1.6)), (36, 'head', 'rotation_euler', (0.6, 0, 0.2))], loop=False)
for tr in rig.animation_data.nla_tracks: tr.mute = False

os.makedirs(OUT, exist_ok=True); PARTS = list(ALL)
def tris(objs): return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
def export(path):
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
    for o in PARTS: o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_animations=True,
                              export_animation_mode='ACTIONS', export_skins=True, export_yup=True, export_force_sampling=True)
    print('EXPORTED', path, os.path.getsize(path), 'tris', tris(PARTS))
name = 'sp_' + KEY
export(os.path.join(OUT, name + '.glb'))
for lod, target in (('_lod1', 3400), ('_lod2', 900)):
    r = min(1.0, target / tris(PARTS))
    for o in PARTS:
        t = tris([o])
        if t < 40: continue
        d = o.modifiers.new('dec', 'DECIMATE'); d.ratio = max(r, 24.0 / t)
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.modifier_move_to_index(modifier='dec', index=0); bpy.ops.object.modifier_apply(modifier='dec')
    export(os.path.join(OUT, name + lod + '.glb'))
print('DONE', KEY, 'H', round(H, 3), 'hover', HOVER)
