/**
 * Phase 10 — procedural "authored" GLB packs for gels + enemies.
 * Distinct silhouettes per kind; replace anytime with Blender exports (same paths).
 *
 * Run: node scripts/make-placeholder-glbs.js
 * Temp/output only under project (G:).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'models');

function align4(n) {
  return (n + 3) & ~3;
}

function padBuffer(buf) {
  const n = align4(buf.length);
  if (n === buf.length) return buf;
  const out = Buffer.alloc(n);
  buf.copy(out);
  return out;
}

function sphere(cx, cy, cz, rx, ry, rz, stacks, slices) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= stacks; i++) {
    const v = i / stacks;
    const phi = v * Math.PI;
    for (let j = 0; j <= slices; j++) {
      const u = j / slices;
      const theta = u * Math.PI * 2;
      const x = cx + Math.sin(phi) * Math.cos(theta) * rx;
      const y = cy + Math.cos(phi) * ry;
      const z = cz + Math.sin(phi) * Math.sin(theta) * rz;
      positions.push(x, y, z);
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      normals.push(nx / len, ny / len, nz / len);
    }
  }
  const stride = slices + 1;
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, normals, indices };
}

function box(cx, cy, cz, sx, sy, sz) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const corners = [
    [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
    [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz],
    [-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz],
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz],
    [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz],
    [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]
  ];
  const faceN = [
    [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]
  ];
  const positions = [];
  const normals = [];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const c = corners[f * 4 + v];
      positions.push(c[0] + cx, c[1] + cy, c[2] + cz);
      normals.push(faceN[f][0], faceN[f][1], faceN[f][2]);
    }
  }
  const indices = [];
  for (let f = 0; f < 6; f++) {
    const o = f * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  return { positions, normals, indices };
}

function cone(cx, cy, cz, r, h, segs) {
  const positions = [cx, cy + h, cz];
  const normals = [0, 1, 0];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    positions.push(x, cy, z);
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    const len = Math.sqrt(nx * nx + 0.5 + nz * nz) || 1;
    normals.push(nx / len, 0.5 / len, nz / len);
  }
  const indices = [];
  for (let i = 1; i <= segs; i++) indices.push(0, i, i + 1);
  return { positions, normals, indices };
}

function mergeGeos(parts) {
  const positions = [];
  const normals = [];
  const indices = [];
  let base = 0;
  parts.forEach((g) => {
    const pos = g.positions;
    const nor = g.normals;
    for (let i = 0; i < pos.length; i++) {
      positions.push(pos[i]);
      normals.push(nor[i]);
    }
    const vertCount = pos.length / 3;
    g.indices.forEach((idx) => indices.push(idx + base));
    base += vertCount;
  });
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices)
  };
}

/**
 * Multi-part grounded gel (matches combat R3 language).
 * Not a single floating drop — feet, skirt, body, cheeks, crown + element kit.
 */
function gelCreature(element) {
  const el = String(element || 'base').toLowerCase();
  const parts = [];
  // Ground skirt + feet (planted)
  parts.push(sphere(0, 0.12, 0, 0.72, 0.16, 0.65, 10, 14));
  parts.push(sphere(-0.28, 0.1, 0.1, 0.22, 0.1, 0.2, 6, 8));
  parts.push(sphere(0.28, 0.1, 0.1, 0.22, 0.1, 0.2, 6, 8));
  // Main body
  let bodyY = 0.85;
  let brx = 0.52, bry = 0.48, brz = 0.48;
  if (el === 'fire' || el === 'lava') {
    bry = 0.62; brx = 0.42; brz = 0.42;
  } else if (el === 'earth' || el === 'metal') {
    bry = 0.4; brx = 0.65; brz = 0.58;
  } else if (el === 'wind' || el === 'spirit') {
    bry = 0.58; brx = 0.4; brz = 0.4;
  } else if (el === 'lightning' || el === 'storm') {
    bry = 0.7; brx = 0.36; brz = 0.36;
  } else if (el === 'water' || el === 'ice') {
    bry = 0.5; brx = 0.55; brz = 0.48;
  }
  parts.push(sphere(0, bodyY, 0, brx, bry, brz, 14, 18));
  // Cheeks
  parts.push(sphere(-0.42, bodyY - 0.05, 0.15, 0.22, 0.18, 0.2, 8, 10));
  parts.push(sphere(0.42, bodyY - 0.05, 0.15, 0.22, 0.18, 0.2, 8, 10));
  // Crown lobe
  parts.push(sphere(0, bodyY + bry * 0.75, -0.02, brx * 0.55, bry * 0.4, brz * 0.5, 8, 10));
  // Arm nubs
  parts.push(sphere(-0.58, bodyY - 0.05, 0.2, 0.14, 0.12, 0.16, 6, 8));
  parts.push(sphere(0.58, bodyY - 0.05, 0.2, 0.14, 0.12, 0.16, 6, 8));
  // Element kits
  if (el === 'fire' || el === 'lava') {
    parts.push(cone(0.2, bodyY + 0.55, 0.1, 0.12, 0.35, 6));
    parts.push(cone(-0.15, bodyY + 0.45, -0.05, 0.1, 0.28, 5));
  } else if (el === 'plant') {
    parts.push(cone(-0.15, bodyY + 0.55, 0.05, 0.14, 0.4, 6));
    parts.push(cone(0.2, bodyY + 0.5, -0.05, 0.12, 0.32, 6));
  } else if (el === 'ice' || el === 'crystal') {
    parts.push(cone(0.1, bodyY + 0.6, 0, 0.1, 0.35, 4));
    parts.push(sphere(-0.35, bodyY + 0.2, 0.25, 0.12, 0.18, 0.12, 6, 6));
  } else if (el === 'lightning' || el === 'storm') {
    parts.push(cone(0.15, bodyY + 0.7, 0, 0.08, 0.4, 4));
    parts.push(cone(-0.2, bodyY + 0.55, 0.05, 0.07, 0.32, 4));
  } else if (el === 'earth' || el === 'metal') {
    parts.push(sphere(0.4, bodyY + 0.15, 0.2, 0.16, 0.14, 0.14, 6, 6));
    parts.push(sphere(-0.45, bodyY + 0.05, 0.15, 0.14, 0.12, 0.12, 6, 6));
  } else if (el === 'void' || el === 'shadow') {
    parts.push(sphere(0.35, bodyY + 0.35, 0.3, 0.1, 0.1, 0.1, 6, 6));
    parts.push(sphere(-0.3, bodyY + 0.25, 0.35, 0.08, 0.08, 0.08, 5, 5));
  } else if (el === 'water') {
    parts.push(sphere(0.25, 0.35, 0.35, 0.1, 0.12, 0.1, 6, 6));
    parts.push(sphere(-0.2, 0.28, 0.38, 0.08, 0.1, 0.08, 5, 5));
  }
  // Eyes (white-ish beads on front)
  parts.push(sphere(-0.16, bodyY + 0.12, 0.42, 0.09, 0.1, 0.06, 6, 6));
  parts.push(sphere(0.16, bodyY + 0.12, 0.42, 0.09, 0.1, 0.06, 6, 6));
  return mergeGeos(parts);
}

function gelBlob() {
  return gelCreature('base');
}

function kindGeo(kind) {
  if (kind === 'golem') {
    return mergeGeos([
      box(0, 0.7, 0, 0.9, 1.0, 0.7),
      box(0, 1.35, 0, 0.55, 0.45, 0.55),
      box(-0.55, 0.55, 0, 0.28, 0.7, 0.28),
      box(0.55, 0.55, 0, 0.28, 0.7, 0.28),
      box(0, 0.95, 0.35, 0.4, 0.15, 0.15)
    ]);
  }
  if (kind === 'humanoid') {
    return mergeGeos([
      sphere(0, 1.15, 0, 0.22, 0.24, 0.22, 8, 10),
      box(0, 0.65, 0, 0.45, 0.7, 0.28),
      box(-0.38, 0.55, 0, 0.14, 0.55, 0.14),
      box(0.38, 0.55, 0, 0.14, 0.55, 0.14),
      box(0, 0.9, 0, 0.55, 0.12, 0.2)
    ]);
  }
  if (kind === 'dragon') {
    return mergeGeos([
      sphere(0, 0.55, 0, 0.55, 0.35, 0.45, 10, 14),
      sphere(0, 0.7, 0.55, 0.28, 0.25, 0.3, 8, 10),
      cone(0, 0.75, 0.9, 0.12, 0.35, 6),
      box(-0.55, 0.75, 0, 0.12, 0.55, 0.4),
      box(0.55, 0.75, 0, 0.12, 0.55, 0.4)
    ]);
  }
  if (kind === 'undead') {
    return mergeGeos([
      sphere(0, 1.2, 0, 0.2, 0.22, 0.2, 8, 10),
      box(0, 0.65, 0, 0.32, 0.9, 0.28),
      box(0, 0.9, 0, 0.55, 0.1, 0.2),
      sphere(0, 0.85, 0, 0.4, 0.25, 0.35, 8, 10)
    ]);
  }
  if (kind === 'plant') {
    return mergeGeos([
      sphere(0, 0.9, 0, 0.45, 0.4, 0.45, 10, 12),
      box(0, 0.4, 0, 0.25, 0.55, 0.25),
      cone(-0.35, 0.95, 0, 0.15, 0.4, 5),
      cone(0.35, 0.95, 0, 0.15, 0.4, 5),
      cone(0, 1.25, 0, 0.12, 0.35, 5)
    ]);
  }
  if (kind === 'insect') {
    return mergeGeos([
      sphere(0, 0.35, 0, 0.4, 0.28, 0.35, 8, 12),
      sphere(0, 0.4, 0.4, 0.28, 0.25, 0.28, 8, 10),
      sphere(0, 0.3, -0.4, 0.22, 0.2, 0.22, 6, 8),
      box(-0.35, 0.15, 0.1, 0.08, 0.35, 0.08),
      box(0.35, 0.15, 0.1, 0.08, 0.35, 0.08),
      box(-0.35, 0.15, -0.15, 0.08, 0.35, 0.08),
      box(0.35, 0.15, -0.15, 0.08, 0.35, 0.08)
    ]);
  }
  if (kind === 'elemental') {
    return mergeGeos([
      sphere(0, 0.7, 0, 0.4, 0.45, 0.4, 8, 10),
      sphere(0, 1.15, 0, 0.22, 0.25, 0.22, 6, 8),
      sphere(-0.35, 0.5, 0, 0.18, 0.2, 0.18, 6, 8),
      sphere(0.35, 0.5, 0, 0.18, 0.2, 0.18, 6, 8)
    ]);
  }
  // beast default
  return mergeGeos([
    sphere(0, 0.4, 0, 0.5, 0.35, 0.4, 10, 14),
    sphere(0, 0.55, 0.5, 0.28, 0.25, 0.28, 8, 10),
    cone(-0.12, 0.75, 0.55, 0.06, 0.2, 5),
    cone(0.12, 0.75, 0.55, 0.06, 0.2, 5),
    cone(0, 0.35, -0.55, 0.08, 0.25, 5)
  ]);
}

function writeGlb(filePath, geo, name) {
  const posBuf = Buffer.from(geo.positions.buffer, geo.positions.byteOffset, geo.positions.byteLength);
  const norBuf = Buffer.from(geo.normals.buffer, geo.normals.byteOffset, geo.normals.byteLength);
  const idxBuf = Buffer.from(geo.indices.buffer, geo.indices.byteOffset, geo.indices.byteLength);

  const posOff = 0;
  const norOff = align4(posBuf.length);
  const idxOff = norOff + align4(norBuf.length);
  const binLen = idxOff + align4(idxBuf.length);
  const bin = Buffer.alloc(binLen);
  posBuf.copy(bin, posOff);
  norBuf.copy(bin, norOff);
  idxBuf.copy(bin, idxOff);

  const vertexCount = geo.positions.length / 3;
  const indexCount = geo.indices.length;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < geo.positions.length; i += 3) {
    const x = geo.positions[i], y = geo.positions[i + 1], z = geo.positions[i + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }

  const gltf = {
    asset: { version: '2.0', generator: 'make-placeholder-glbs.js phase10' },
    scene: 0,
    scenes: [{ name: name, nodes: [0] }],
    nodes: [{ mesh: 0, name: name }],
    meshes: [{
      name: name,
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        indices: 2,
        mode: 4
      }]
    }],
    accessors: [
      {
        bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3',
        max: [maxX, maxY, maxZ], min: [minX, minY, minZ]
      },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: indexCount, type: 'SCALAR' }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: posOff, byteLength: posBuf.length, target: 34962 },
      { buffer: 0, byteOffset: norOff, byteLength: norBuf.length, target: 34962 },
      { buffer: 0, byteOffset: idxOff, byteLength: idxBuf.length, target: 34963 }
    ],
    buffers: [{ byteLength: binLen }]
  };

  const json = padBuffer(Buffer.from(JSON.stringify(gltf), 'utf8'));
  const binPadded = padBuffer(bin);
  const totalLen = 12 + 8 + json.length + 8 + binPadded.length;
  const out = Buffer.alloc(totalLen);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLen, 8);
  out.writeUInt32LE(json.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  json.copy(out, 20);
  const binChunkStart = 20 + json.length;
  out.writeUInt32LE(binPadded.length, binChunkStart);
  out.writeUInt32LE(0x004e4942, binChunkStart + 4);
  binPadded.copy(out, binChunkStart + 8);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, out);
  return out.length;
}

function main() {
  const written = [];
  const allGels = [
    'base', 'water', 'fire', 'earth', 'wind', 'plant', 'lightning', 'ice',
    'shadow', 'light', 'metal', 'poison', 'crystal', 'lava', 'storm', 'spirit', 'void'
  ];
  for (const el of allGels) {
    const name = el === 'base' ? 'gel_base' : 'gel_' + el;
    const f = path.join(OUT, 'gel', name + '.glb');
    const geo = gelCreature(el === 'base' ? 'water' : el);
    written.push({ f, n: writeGlb(f, geo, name) });
  }

  const kinds = ['beast', 'golem', 'humanoid', 'dragon', 'undead', 'plant', 'insect', 'elemental'];
  for (const k of kinds) {
    const f = path.join(OUT, 'enemy', 'enemy_' + k + '.glb');
    written.push({ f, n: writeGlb(f, kindGeo(k), 'enemy_' + k) });
  }

  let total = 0;
  written.forEach((w) => {
    total += w.n;
    console.log('wrote', path.relative(ROOT, w.f), w.n, 'bytes');
  });
  console.log('total', total, 'bytes in', written.length, 'files');
  console.log('Tip: combat uses procedural multi-part gels by default (richer materials).');
  console.log('Set window.SR_USE_GEL_GLB=1 to force these GLBs. Replace any file with Blender export anytime.');
}

main();
