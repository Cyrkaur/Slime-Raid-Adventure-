/**
 * Slime heroes 3D (pilot: Water / Fire / Plant).
 *
 * Skinned, animated gel heroes built in Blender (assets/models/gel/gel_<el>[_lod1|_lod2].glb)
 * rendered with a physical gel material (transmission, attenuation, clearcoat, sheen,
 * iridescence) lit by a CC0 Poly Haven HDRI (assets/env/meadow_2_1k.hdr).
 *
 * Loaders come from vendor/three-addons-g/, which the importmap scope binds to the
 * classic global THREE (vendor/three.min.js) so every object is from the same THREE
 * instance the combat renderer uses.
 *
 * Exposes window.SR_HERO3D:
 *   enabled(), isPilot(element), preload(units) → Promise, ready(element, quality),
 *   makeFigure(THREE, unit, opts) → battleWorld3d figure contract (or null → sprite fallback)
 * Kill switch: localStorage sr_hero3d = '0' (or window.SR_HERO3D_OFF = true) → sprites.
 */
import { GLTFLoader } from '../../vendor/three-addons-g/loaders/GLTFLoader.js';
import { RGBELoader } from '../../vendor/three-addons-g/loaders/RGBELoader.js';
import * as SkeletonUtils from '../../vendor/three-addons-g/utils/SkeletonUtils.js';

(function () {
  var THREE = window.THREE;
  if (!THREE) { console.warn('[Hero3D] no global THREE'); return; }

  var PILOTS = { water: 1, fire: 1, plant: 1 };
  var CLIPS = ['idle', 'hop', 'attack', 'cast', 'hit', 'faint'];
  /**
   * Per-element slime properties: material AND motion.
   *   Material: color, atten(uation colour)/attenDist, trans(mission), thick(ness), rough, ccRough,
   *     ior, sheen, cloud (milky scatter), core/coreGlow, rim, ripple (surface normal noise), caustic,
   *     sss (thick-base glow), glowTip (hot tips, fire), crust (dark mottled skin), moss, frost, murk, metal.
   *   Motion: jigAmp/jigFreq (surface jiggle, world units / rad·s⁻¹), stiff/damp (squash spring),
   *     squash (multiplier on baked clip squash + impulses), ts (clip time scale: viscosity).
   * Pilots with models today: water, fire, plant. The rest are ready for when their GLBs land.
   */
  var BASE_PROPS = {
    color: 0x8fe0c0, atten: 0x2aa080, attenDist: 0.35, trans: 0.8, thick: 1.0, rough: 0.07, ccRough: 0.03, ior: 1.34,
    sheen: 0.25, sheenCol: 0xffffff, cloud: 0.0, core: 0xc8ffe8, coreGlow: 0.45, rim: 0xa0ffe0, ripple: 0.35, rippleScale: 5.0,
    rippleSpeed: 0.6, caustic: 0.25, caustCol: 0xffffff, sss: 0.10, sssCol: 0xffffff, glowTip: 0.0, tipCol: 0xffc040,
    crust: 0.0, moss: 0.0, mossCol: 0x2f6a1c, frost: 0.0, murk: 0.0, murkCol: 0x3a3020, metal: 0.0,
    jigAmp: 0.02, jigFreq: 6.0, stiff: 200, damp: 9, squash: 1.0, ts: 1.0, scale: 1.36
  };
  var PROPS = {
    // clear, high transmission, fast bouncy jiggle
    water:  { color: 0x5ab8ff, atten: 0x2a8cff, attenDist: 0.22, trans: 0.95, noCore: true, thick: 1.1, rough: 0.03, ccRough: 0.015, ior: 1.33,
              sheen: 0.15, sheenCol: 0x9fdcff, core: 0x9fe4ff, coreGlow: 0.25, rim: 0x7fdcff, ripple: 0.45, rippleScale: 6.0, rippleSpeed: 1.1,
              caustic: 0.55, caustCol: 0xcff4ff, sss: 0.06, sssCol: 0x5ab8ff, jigAmp: 0.032, jigFreq: 10.0, stiff: 340, damp: 6.5, squash: 1.25, ts: 1.15, scale: 1.36 },
    // hot gel: glowing core, flame tips burn, flickery quick wobble
    fire:   { color: 0xff7a40, atten: 0xd82a06, attenDist: 0.16, trans: 0.72, thick: 1.4, rough: 0.06, ccRough: 0.03, ior: 1.36,
              sheen: 0.3, sheenCol: 0xffd0a0, core: 0xffc040, coreGlow: 1.1, rim: 0xffa040, ripple: 0.30, rippleScale: 5.0, rippleSpeed: 1.6,
              caustic: 0.12, caustCol: 0xffd070, sss: 0.30, sssCol: 0xff5a10, glowTip: 1.6, tipCol: 0xffb030,
              jigAmp: 0.024, jigFreq: 8.5, stiff: 240, damp: 8, squash: 1.0, ts: 1.05, scale: 1.40 },
    // cloudy, mossy base, leaves suspended inside, soft slow sway
    plant:  { color: 0x62c24a, atten: 0x1f7f1a, attenDist: 0.12, trans: 0.60, thick: 1.6, rough: 0.12, ccRough: 0.04, ior: 1.35,
              sheen: 0.25, sheenCol: 0xa8ff80, cloud: 0.25, core: 0xd6ff7a, coreGlow: 0.35, rim: 0xb8ff7a, ripple: 0.35, rippleScale: 4.5, rippleSpeed: 0.45,
              caustic: 0.15, caustCol: 0xeaffb0, sss: 0.16, sssCol: 0x9aff5a, moss: 0.65, mossCol: 0x2d6a18,
              jigAmp: 0.020, jigFreq: 4.8, stiff: 150, damp: 9, squash: 0.9, ts: 0.95, scale: 1.38 },
    // thick, glowing core, slow viscous sag, dark crust
    lava:   { color: 0xff5a1a, atten: 0xa01800, attenDist: 0.12, trans: 0.25, thick: 2.0, rough: 0.2, ior: 1.45, core: 0xffa020, coreGlow: 1.6,
              rim: 0xff6010, ripple: 0.25, rippleSpeed: 0.25, caustic: 0.1, sss: 0.45, sssCol: 0xff3a00, glowTip: 0.4, tipCol: 0xff8020, crust: 0.8,
              jigAmp: 0.010, jigFreq: 2.2, stiff: 60, damp: 11, squash: 0.7, ts: 0.72 },
    // semi-frozen, stiff tight wobble, frost rim
    ice:    { color: 0xc8f0ff, atten: 0x5ab0e0, attenDist: 0.6, trans: 0.85, thick: 1.2, rough: 0.22, ccRough: 0.08, ior: 1.31, core: 0xe8faff,
              coreGlow: 0.3, rim: 0xe8ffff, ripple: 0.15, rippleSpeed: 0.1, caustic: 0.3, frost: 0.8, jigAmp: 0.006, jigFreq: 15, stiff: 700, damp: 26, squash: 0.45, ts: 1.0 },
    // mercury: fully reflective, heavy slow ripple
    metal:  { color: 0xd8dde6, atten: 0x808890, attenDist: 1.0, trans: 0.0, thick: 0.5, rough: 0.05, ccRough: 0.02, metal: 1.0, sheen: 0.0,
              core: 0x9aa4b0, coreGlow: 0.0, rim: 0xffffff, ripple: 0.5, rippleScale: 3.5, rippleSpeed: 0.35, caustic: 0.0, sss: 0.0,
              jigAmp: 0.014, jigFreq: 4.0, stiff: 180, damp: 16, squash: 0.6, ts: 0.85 },
    // murky, bubbling, loose wobble
    poison: { color: 0x9a5ad8, atten: 0x3a0a60, attenDist: 0.18, trans: 0.45, thick: 1.5, rough: 0.1, core: 0xc6ff4a, coreGlow: 0.7,
              rim: 0xb0ff60, ripple: 0.55, rippleSpeed: 1.4, caustic: 0.2, caustCol: 0xc6ff4a, murk: 0.6, murkCol: 0x2a3a10,
              jigAmp: 0.03, jigFreq: 6.0, stiff: 140, damp: 5, squash: 1.1, ts: 1.0 },
    earth:     { color: 0xb08a5a, atten: 0x5a3a1a, attenDist: 0.15, trans: 0.3, thick: 1.8, rough: 0.3, crust: 0.5, jigAmp: 0.008, jigFreq: 3, stiff: 120, damp: 14, squash: 0.6, ts: 0.8 },
    crystal:   { color: 0xf0b0ff, atten: 0xa050d0, attenDist: 0.5, trans: 0.92, rough: 0.02, ior: 1.5, caustic: 0.6, jigAmp: 0.008, jigFreq: 12, stiff: 520, damp: 20, squash: 0.5 },
    light:     { color: 0xfff4c0, atten: 0xffd060, attenDist: 0.5, trans: 0.85, coreGlow: 1.2, core: 0xfff0a0, caustic: 0.6, caustCol: 0xfff0b0, jigAmp: 0.02, jigFreq: 7 },
    lightning: { color: 0xfff060, atten: 0xc0a000, attenDist: 0.4, trans: 0.8, coreGlow: 1.3, core: 0xffffa0, ripple: 0.6, rippleSpeed: 3.0, jigAmp: 0.022, jigFreq: 16, stiff: 420, damp: 7 },
    shadow:    { color: 0x5a4a8a, atten: 0x100820, attenDist: 0.12, trans: 0.5, murk: 0.4, murkCol: 0x100818, coreGlow: 0.6, core: 0x9a6aff, jigAmp: 0.02, jigFreq: 4 },
    spirit:    { color: 0xd8f8ff, atten: 0x80d0ff, attenDist: 0.8, trans: 0.95, rough: 0.1, cloud: 0.3, coreGlow: 0.8, jigAmp: 0.03, jigFreq: 3.5, stiff: 90, damp: 6, ts: 0.9 },
    storm:     { color: 0x7a9ad8, atten: 0x203a80, attenDist: 0.25, trans: 0.7, ripple: 0.6, rippleSpeed: 2.2, jigAmp: 0.028, jigFreq: 11, stiff: 300, damp: 6 },
    void:      { color: 0x3a2060, atten: 0x080010, attenDist: 0.1, trans: 0.35, murk: 0.5, murkCol: 0x05000a, coreGlow: 0.9, core: 0xc040ff, jigAmp: 0.016, jigFreq: 3, stiff: 100, damp: 10, ts: 0.85 },
    wind:      { color: 0xc8ffe8, atten: 0x60c0a0, attenDist: 0.6, trans: 0.9, cloud: 0.2, ripple: 0.5, rippleSpeed: 2.0, jigAmp: 0.03, jigFreq: 9, stiff: 260, damp: 6 }
  };
  function propsFor(el) {
    var o = {}, k, src = PROPS[el] || {};
    for (k in BASE_PROPS) o[k] = BASE_PROPS[k];
    for (k in src) o[k] = src[k];
    return o;
  }
  // Rarity = material presets only (trim / rim glow / iridescence).
  var RARITY = {
    Common:    { irid: 0.0,  rim: 0.35, emis: 0.05, trim: 0.0 },
    Uncommon:  { irid: 0.1,  rim: 0.45, emis: 0.06, trim: 0.0 },
    Rare:      { irid: 0.3,  rim: 0.6,  emis: 0.08, trim: 0.15 },
    Epic:      { irid: 0.35, rim: 0.8,  emis: 0.10, trim: 0.3 },
    Legendary: { irid: 0.85, rim: 1.0,  emis: 0.13, trim: 0.55 },
    Mythic:    { irid: 1.0,  rim: 1.2,  emis: 0.16, trim: 0.8 }
  };

  var HERO_FACE_CAM_YAW = -1.25;
  var loader = new GLTFLoader();
  var gltfCache = Object.create(null);   // url → gltf
  var failed = Object.create(null);
  var pending = Object.create(null);
  var hdrTex = null, hdrPromise = null;
  var envByRenderer = new WeakMap();

  function elKey(e) { return String(e || '').toLowerCase(); }
  function enabled() {
    if (window.SR_HERO3D_OFF) return false;
    try { if (localStorage.getItem('sr_hero3d') === '0') return false; } catch (e) {}
    return true;
  }
  function isPilot(element) { return !!PILOTS[elKey(element)]; }
  function lodSuffix(q) { return q === 'low' ? '_lod2' : (q === 'med' ? '_lod1' : ''); }
  function urlFor(element, q) { return 'assets/models/gel/gel_' + elKey(element) + lodSuffix(q) + '.glb'; }

  function fetchBuf(url) {
    return fetch(new URL(url, window.location.href).href).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return r.arrayBuffer();
    });
  }
  function loadGLTF(url) {
    if (gltfCache[url]) return Promise.resolve(gltfCache[url]);
    if (pending[url]) return pending[url];
    pending[url] = fetchBuf(url).then(function (buf) {
      return new Promise(function (res, rej) {
        loader.parse(buf, new URL(url, window.location.href).href.replace(/[^/]+$/, ''), res, rej);
      });
    }).then(function (g) {
      gltfCache[url] = g; delete failed[url]; return g;
    }).catch(function (err) {
      failed[url] = String(err && err.message || err);
      console.warn('[Hero3D] load fail', url, failed[url]);
      return null;
    }).finally(function () { delete pending[url]; });
    return pending[url];
  }
  function loadHDR() {
    if (hdrTex) return Promise.resolve(hdrTex);
    if (hdrPromise) return hdrPromise;
    hdrPromise = fetchBuf('assets/env/meadow_2_1k.hdr').then(function (buf) {
      var rl = new RGBELoader();
      var data = rl.parse(buf);
      var t = new THREE.DataTexture(data.data, data.width, data.height, THREE.RGBAFormat, data.type);
      t.colorSpace = THREE.LinearSRGBColorSpace;
      t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
      t.flipY = true; t.mapping = THREE.EquirectangularReflectionMapping; t.needsUpdate = true;
      hdrTex = t; return t;
    }).catch(function (e) { console.warn('[Hero3D] HDR fail', e); return null; });
    return hdrPromise;
  }
  function envFor(renderer) {
    if (!renderer || !hdrTex) return null;
    var e = envByRenderer.get(renderer);
    if (e) return e;
    var pm = new THREE.PMREMGenerator(renderer);
    e = pm.fromEquirectangular(hdrTex).texture;
    pm.dispose();
    envByRenderer.set(renderer, e);
    return e;
  }

  function currentQuality() {
    try { return localStorage.getItem('sr_battle_quality') || 'high'; } catch (e) { return 'high'; }
  }

  /** Preload hero GLBs (current quality LOD) + HDRI for the allies in this fight. */
  function preload(units, opts) {
    if (!enabled()) return Promise.resolve({ hero3d: 0, off: true });
    var q = (opts && opts.quality) || currentQuality();
    var urls = [];
    (units || []).forEach(function (u) {
      if (!u || u.isFoe || u.isEnemy || u.enemyKind) return;
      if (!isPilot(u.element)) return;
      var url = urlFor(u.element, q);
      if (urls.indexOf(url) < 0) urls.push(url);
    });
    if (!urls.length) return Promise.resolve({ hero3d: 0 });
    var t0 = performance.now();
    return Promise.all([loadHDR()].concat(urls.map(loadGLTF))).then(function (r) {
      var ok = r.slice(1).filter(Boolean).length;
      console.log('[Hero3D] preload', ok + '/' + urls.length, Math.round(performance.now() - t0) + 'ms');
      return { hero3d: ok, of: urls.length };
    });
  }

  function ready(element, q) { return !!gltfCache[urlFor(element, q || currentQuality())]; }

  // ---- slime shader: surface jiggle (vertex), ripple normals, thickness variation, wet rim,
  //      fake subsurface, inner caustic, element masks (tip glow, crust, moss, frost, murk). ----
  var GLSL_NOISE = [
    'float hHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
    'float vNoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(hHash(i), hHash(i + vec3(1,0,0)), f.x), mix(hHash(i + vec3(0,1,0)), hHash(i + vec3(1,1,0)), f.x), f.y),',
    '             mix(mix(hHash(i + vec3(0,0,1)), hHash(i + vec3(1,0,1)), f.x), mix(hHash(i + vec3(0,1,1)), hHash(i + vec3(1,1,1)), f.x), f.y), f.z); }'
  ].join('\n');
  var JIG_VS = [
    '#include <begin_vertex>',
    'vObjPos = position;',
    '{ float hw = clamp(position.y / 1.1, 0.0, 1.6); hw *= hw;',
    '  float ph = uTime * uJigFreq;',
    '  transformed.x += sin(ph + position.y * 4.0 + position.z * 3.0) * uJigAmp * hw;',
    '  transformed.z += cos(ph * 0.87 + position.y * 3.5 + position.x * 3.0) * uJigAmp * hw;',
    '  transformed.y += sin(ph * 1.3 + position.x * 5.0 + position.z * 2.0) * uJigAmp * 0.45 * hw; }'
  ].join('\n');
  function jigUniforms(pr) {
    return { uTime: { value: Math.random() * 10 }, uJigAmp: { value: pr.jigAmp }, uJigFreq: { value: pr.jigFreq } };
  }
  function addJiggle(mat, U, key) {
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = U.uTime; sh.uniforms.uJigAmp = U.uJigAmp; sh.uniforms.uJigFreq = U.uJigFreq;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uJigAmp; uniform float uJigFreq; varying vec3 vObjPos;')
        .replace('#include <begin_vertex>', JIG_VS);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;');
    };
    mat.customProgramCacheKey = function () { return 'heroJig-' + (key || mat.type); };
  }
  function addSlime(mat, U, pr, rar) {
    var C = function (h) { return { value: new THREE.Color(h) }; };
    var S = {
      uRim: { value: new THREE.Color(pr.rim).multiplyScalar(rar.rim) },
      uRipple: { value: pr.ripple }, uRippleScale: { value: pr.rippleScale }, uRippleSpeed: { value: pr.rippleSpeed },
      uCaustic: { value: pr.caustic }, uCaustCol: C(pr.caustCol), uSSS: { value: pr.sss }, uSSSCol: C(pr.sssCol),
      uGlowTip: { value: pr.glowTip }, uTipCol: C(pr.tipCol), uCrust: { value: pr.crust }, uMoss: { value: pr.moss }, uMossCol: C(pr.mossCol),
      uFrost: { value: pr.frost }, uMurk: { value: pr.murk }, uMurkCol: C(pr.murkCol), uCloud: { value: pr.cloud }
    };
    mat.userData.slime = S;
    mat.onBeforeCompile = function (sh) {
      var k; for (k in S) sh.uniforms[k] = S[k];
      sh.uniforms.uTime = U.uTime; sh.uniforms.uJigAmp = U.uJigAmp; sh.uniforms.uJigFreq = U.uJigFreq;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uJigAmp; uniform float uJigFreq; varying vec3 vObjPos;')
        .replace('#include <begin_vertex>', JIG_VS);
      var decl = '\nuniform float uTime; varying vec3 vObjPos;\n' +
        'uniform vec3 uRim; uniform float uRipple, uRippleScale, uRippleSpeed, uCaustic, uSSS, uGlowTip, uCrust, uMoss, uFrost, uMurk, uCloud;\n' +
        'uniform vec3 uCaustCol, uSSSCol, uTipCol, uMossCol, uMurkCol;\n' + GLSL_NOISE + '\n' +
        'float slimeH(vec3 p){ vec3 q = p * uRippleScale + vec3(0.0, uTime * uRippleSpeed, uTime * uRippleSpeed * 0.6);\n' +
        '  return vNoise(q) * 0.65 + vNoise(q * 2.3 + 7.1) * 0.35; }\n';
      var fs = sh.fragmentShader.replace('#include <common>', '#include <common>' + decl);
      // element colour masks (moss at the base, crust mottling, murk), cloudy scatter
      fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' +
        '{ float hgt = vObjPos.y / 1.1; float n1 = vNoise(vObjPos * 7.0); float n2 = vNoise(vObjPos * 17.0 + 3.0);\n' +
        '  diffuseColor.rgb = mix(diffuseColor.rgb, uMossCol, uMoss * smoothstep(0.55, 0.12, hgt + (n2 - 0.5) * 0.25) * smoothstep(0.30, 0.65, n1));\n' +
        '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.045, 0.035), uCrust * smoothstep(0.48, 0.62, n1 * 0.7 + n2 * 0.3));\n' +
        '  diffuseColor.rgb = mix(diffuseColor.rgb, uMurkCol, uMurk * n1);\n' +
        '  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + 0.04, uCloud * n2); }');
      // wet ripple: bump the shading normal from an animated noise height field
      fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nvec3 slimeGeoN = normal;\n' +
        '{ vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float h = slimeH(vObjPos);\n' +
        '  float dhx = dFdx(h), dhy = dFdy(h); vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);\n' +
        '  vec3 grd = sign(det) * (dhx * r1 + dhy * r2); normal = normalize(abs(det) * normal - grd * uRipple * 0.0045); }');
      fs = fs.replace('#include <clearcoat_normal_fragment_maps>', '#include <clearcoat_normal_fragment_maps>\nclearcoatNormal = normalize(mix(clearcoatNormal, normal, 0.8));');
      // thickness varies: thick sagging base, thin crown, lumpy inside
      fs = fs.replace('material.thickness = thickness;',
        'material.thickness = thickness * mix(1.5, 0.75, clamp(vObjPos.y / 1.3, 0.0, 1.0)) * (0.75 + 0.5 * vNoise(vObjPos * 3.0));');
      // wet glossy rim + subsurface glow + inner caustic + hot tips + frost rim
      fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' +
        '{ float fr = 1.0 - clamp(dot(normalize(slimeGeoN), normalize(vViewPosition)), 0.0, 1.0); float hgt = vObjPos.y / 1.1;\n' +
        '  totalEmissiveRadiance += uRim * pow(fr, 4.0) * 0.9;\n' +
        '  totalEmissiveRadiance += uSSSCol * uSSS * (1.0 - fr) * clamp(1.1 - hgt * 0.8, 0.2, 1.1);\n' +
        '  vec3 cq = vObjPos * 5.5 + vec3(0.0, uTime * 0.35, uTime * 0.2); float cA = vNoise(cq), cB = vNoise(cq * 1.7 + 4.3);\n' +
        '  float cau = pow(clamp(1.0 - abs(cA - cB) * 5.0, 0.0, 1.0), 5.0);\n' +
        '  totalEmissiveRadiance += uCaustCol * uCaustic * cau * (1.0 - fr) * 0.35;\n' +
        '  totalEmissiveRadiance += uTipCol * uGlowTip * smoothstep(0.62, 1.35, hgt) * (0.8 + 0.4 * sin(uTime * 9.0 + vObjPos.x * 11.0));\n' +
        '  totalEmissiveRadiance += vec3(0.85, 0.95, 1.0) * uFrost * 0.5 * pow(fr, 1.6) * (0.6 + 0.4 * vNoise(vObjPos * 30.0)); }');
      sh.fragmentShader = fs;
    };
    mat.customProgramCacheKey = function () { return 'heroSlime2'; };
  }

  function softShadowTex() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'); var gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    // Multiply-blended (white = no change) so it sits in the OPAQUE pass and also shows
    // through the transmissive gel body (transparent meshes are skipped by transmission).
    gr.addColorStop(0, 'rgb(60,60,60)'); gr.addColorStop(0.45, 'rgb(90,90,90)'); gr.addColorStop(0.75, 'rgb(175,175,175)'); gr.addColorStop(1, 'rgb(255,255,255)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  var _shadowTex = null;

  /**
   * Build a battle figure. Returns null (→ caller uses the sprite path) when not a pilot,
   * disabled, or the GLB is not loaded.
   */
  // Live hero figures (read-only handle for capture/QA tools).
  var live = [];
  // Squash-spring impulses per clip start (scaled by element squash).
  var SQUASH_KICK = { hop: -1.6, attack: -2.2, hit: 3.2, cast: -1.4, faint: 2.0 };

  function makeFigure(T, unit, opts) {
    opts = opts || {};
    if (!enabled() || !unit || !isPilot(unit.element)) return null;
    if (unit.isFoe || unit.isEnemy || unit.enemyKind) return null;
    var q = opts.quality || currentQuality();
    var gltf = gltfCache[urlFor(unit.element, q)] || gltfCache[urlFor(unit.element, 'high')];
    if (!gltf) return null;
    var el = elKey(unit.element);
    var pr = propsFor(el);
    var look = pr;
    var rar = RARITY[unit.rarity] || RARITY.Common;
    var env = envFor(opts.renderer);
    var U = jigUniforms(pr);
    // Viscosity: scale the baked root squash in the clips once per GLB by this element's squash multiplier.
    if (!gltf.userData) gltf.userData = {};
    if (gltf.userData.squashFor !== el) {
      var mul = pr.squash / (gltf.userData.squashMul || 1);
      (gltf.animations || []).forEach(function (clip) {
        clip.tracks.forEach(function (tr) {
          if (!/\.scale$/.test(tr.name)) return;
          for (var i = 0; i < tr.values.length; i++) tr.values[i] = 1 + (tr.values[i] - 1) * mul;
        });
      });
      gltf.userData.squashFor = el; gltf.userData.squashMul = pr.squash;
    }

    var model = SkeletonUtils.clone(gltf.scene);
    model.scale.setScalar(pr.scale);
    // Turn the face part-way toward the fight camera (allies face the foe line otherwise → profile view).
    model.rotation.y = (opts.faceCamYaw != null ? opts.faceCamYaw : HERO_FACE_CAM_YAW);
    var body = null, core = null, mats = [];
    var hiQ = q !== 'low';
    model.traverse(function (o) {
      if (!o.isMesh) return;
      o.frustumCulled = false; // skinned bounds don't follow bones
      o.castShadow = !!opts.shadows; o.receiveShadow = false;
      var src = o.material, name = (src && src.name) || '';
      var m, slime = false;
      if (name === 'GelBody') {
        m = new THREE.MeshPhysicalMaterial({
          color: pr.color, roughness: pr.rough, metalness: pr.metal,
          transmission: hiQ ? pr.trans : 0.0, thickness: pr.thick, ior: pr.ior,
          attenuationColor: new THREE.Color(pr.atten), attenuationDistance: pr.attenDist,
          clearcoat: 1.0, clearcoatRoughness: pr.ccRough,
          sheen: pr.sheen, sheenRoughness: 0.35, sheenColor: new THREE.Color(pr.sheenCol),
          iridescence: rar.irid, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 520],
          // saturated body-colour emissive: the active-turn pulse (+0.28) glows in-hue instead of washing to white
          emissive: new THREE.Color(pr.color).multiplyScalar(0.5), emissiveIntensity: rar.emis,
          envMapIntensity: pr.metal > 0.5 ? 1.6 : 1.3, specularIntensity: 1.0
        });
        if (!hiQ) { m.transparent = false; m.roughness = Math.min(m.roughness, 0.1); }
        addSlime(m, U, pr, rar); slime = true;
        if (!body || o.name === 'body' || o.name === 'GelBody') body = o;
      } else if (name === 'GelCore') {
        m = new THREE.MeshStandardMaterial({
          color: pr.core, emissive: new THREE.Color(pr.core), emissiveIntensity: 0.2 + pr.coreGlow * 0.6,
          roughness: 0.5, transparent: false
        });
        core = o;
        if (pr.noCore) o.visible = false; // clear water: bubbles only, no opaque core (reads purple through blue gel)
      } else if (name === 'GelEye') {
        m = new THREE.MeshPhysicalMaterial({ color: 0x0a0f22, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
      } else if (name === 'GelEyeShine') {
        m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      } else if (name === 'GelMouth') {
        m = new THREE.MeshStandardMaterial({ color: 0x3a0d1a, roughness: 0.5 });
      } else if (name === 'GelBubble') {
        m = new THREE.MeshPhysicalMaterial({ color: 0xeefaff, roughness: 0.02, transmission: hiQ ? 0.9 : 0, thickness: 0.08, ior: 1.2,
          clearcoat: 1, iridescence: 0.6, emissive: new THREE.Color(pr.caustCol), emissiveIntensity: 0.12 });
      } else if (name === 'Ember') {
        m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc040).multiplyScalar(1.6 + rar.trim), toneMapped: false });
      } else if (name === 'InnerLeaf') {
        m = new THREE.MeshStandardMaterial({ color: 0x3f9a2c, emissive: new THREE.Color(0x2f7a18), emissiveIntensity: 0.25, roughness: 0.6, side: THREE.DoubleSide });
      } else if (name === 'Spore') {
        m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeaffa0).multiplyScalar(1.2), toneMapped: false });
      } else if (name === 'Flame') {
        var fl = new THREE.Color(0xff5a0a).lerp(new THREE.Color(0xffc23a), 0.25 + rar.trim * 0.5);
        m = new THREE.MeshStandardMaterial({ color: 0xff6a10, emissive: fl, emissiveIntensity: 0.42 + rar.trim * 0.3, roughness: 0.55 });
      } else if (name === 'Orn_Flower') {
        m = new THREE.MeshStandardMaterial({ color: 0xff8cc6, emissive: new THREE.Color(0xff5fa8), emissiveIntensity: 0.12 + rar.trim * 0.4, roughness: 0.55 });
      } else if (name === 'Orn_Stem') {
        m = new THREE.MeshStandardMaterial({ color: 0x3f9a2c, roughness: 0.6 });
      } else if (src) {
        m = src.clone(); // e.g. CC0 monstera leaf (textured)
        if (m.emissive && rar.trim) { m.emissive.set(0x9cff6a); m.emissiveIntensity = rar.trim * 0.18; }
      }
      if (m) {
        if (env && 'envMap' in m) m.envMap = env;
        // everything rides the same surface jiggle so eyes / ornaments / inner bits stay attached
        if (!slime) addJiggle(m, U, name || m.type);
        o.material = m; mats.push(m);
      }
    });
    if (!body) { console.warn('[Hero3D] no GelBody in', el); return null; }

    var root = new THREE.Group();
    root.add(model);

    if (!_shadowTex) _shadowTex = softShadowTex();
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 32),
      new THREE.MeshBasicMaterial({
        map: _shadowTex, color: 0xffffff, transparent: false, depthWrite: false,
        blending: THREE.MultiplyBlending, premultipliedAlpha: false, toneMapped: false, fog: false
      })
    );
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.035; shadow.renderOrder = 1;
    root.add(shadow);

    // Animation
    var mixer = new THREE.AnimationMixer(model);
    var actions = {};
    (gltf.animations || []).forEach(function (clip) { actions[clip.name] = mixer.clipAction(clip); });
    var cur = null, lastActive = 0;
    // Squash spring (per element stiffness / damping): s>0 = flattened, s<0 = stretched.
    var spring = { s: 0, v: 0 };
    var baseScale = pr.scale;
    function play(name, fade) {
      var a = actions[name]; if (!a) return;
      fade = fade == null ? 0.1 : fade;
      if (name === 'idle') {
        a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false;
      } else {
        a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
      }
      a.enabled = true; a.reset(); a.setEffectiveWeight(1); a.setEffectiveTimeScale(pr.ts);
      var imp = SQUASH_KICK[name]; if (imp) spring.v += imp * pr.squash;
      if (cur && cur !== a) { a.crossFadeFrom(cur, fade, false); } else { a.fadeIn(fade); }
      a.play(); cur = a; fig.clip = name;
    }
    mixer.addEventListener('finished', function (e) {
      if (!actions.faint || e.action === actions.faint) return;
      if (fig.dead || fig.melting) return;
      play('idle', 0.18);
    });

    var tintHex = new THREE.Color(look.atten).getHex();
    var fig = {
      root: root, model: model, shell: body, core: core || body,
      coreMat: core ? core.material : body.material,
      outline: null, mat: body.material, mats: mats,
      geo: null, base: null, eyes: [], hi: null,
      contactShadow: shadow,
      tint: tintHex, tintColor: new THREE.Color(tintHex), baseColor: new THREE.Color(look.color),
      phase: Math.random() * Math.PI * 2, unitId: unit.id,
      isFoe: false, isEnemy: false, enemyKind: null, solidEnemy: false,
      isImpostor: false, isGLB: true, isHero3d: true, gelImpostor: false,
      grounded: true, gelSize: opts.gelSize || 1, gelFloatY: 0,
      nativeHeight: 2.0, nativeWidth: 1.72,
      baseScale: 1, home: { x: 0, y: 0, z: 0 },
      hitFlash: 0, dead: false, melting: false, meltT: 0, activePulse: 0,
      baseEmissive: rar.emis, puddle: null, droplets: [],
      mixer: mixer, actions: actions, props: pr, spring: spring, slimeU: U, clip: null, element: unit.element,
      playClip: function (n, f) { if (fig.dead && n !== 'idle') return; play(n, f); },
      heroTick: function (dt) {
        if (fig.activePulse > 0 && lastActive <= 0 && !fig.dead && !fig.melting && fig.clip === 'idle') play('hop', 0.08);
        lastActive = fig.activePulse;
        mixer.update(dt);
        var h = Math.min(dt, 1 / 30);
        spring.v += (-pr.stiff * spring.s - pr.damp * spring.v) * h;
        spring.s += spring.v * h;
        if (spring.s > 0.35) { spring.s = 0.35; spring.v = 0; } else if (spring.s < -0.3) { spring.s = -0.3; spring.v = 0; }
        var sq = spring.s;
        model.scale.set(baseScale * (1 + sq * 0.55), baseScale * (1 - sq), baseScale * (1 + sq * 0.55));
        U.uTime.value += dt;
        U.uJigAmp.value = pr.jigAmp * (1 + Math.min(3, Math.abs(spring.v) * 0.5));
      },
      heroRevive: function () {
        fig.dead = false; fig.melting = false; model.visible = true; shadow.visible = true;
        if (actions.faint) actions.faint.stop();
        play('idle', 0.05);
      },
      heroDispose: function () {
        mixer.stopAllAction();
        mats.forEach(function (m) { m.dispose(); });
        var li = live.indexOf(fig); if (li >= 0) live.splice(li, 1);
        shadow.geometry.dispose(); shadow.material.dispose();
      }
    };
    // Random phase so a lineup doesn't breathe in lockstep.
    play('idle', 0);
    if (actions.idle) actions.idle.time = Math.random() * actions.idle.getClip().duration;
    live.push(fig);
    return fig;
  }

  window.SR_HERO3D = {
    enabled: enabled, isPilot: isPilot, preload: preload, ready: ready,
    makeFigure: makeFigure, urlFor: urlFor, CLIPS: CLIPS, _cache: gltfCache, _failed: failed, _live: live, PROPS: PROPS, propsFor: propsFor
  };
  window.dispatchEvent(new Event('sr-hero3d-ready'));
  console.log('[Hero3D] ready (pilots: water, fire, plant)');
})();
