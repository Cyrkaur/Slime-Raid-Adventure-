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
  // Named heroes with their own morph-body GLB (assets/models/heroes/hero_<heroId>[_lod1|_lod2].glb).
  // Epic batch 1 (R5a pilot trio). Everyone else keeps the element gel.
  var HERO_MODELS = { water_epic_pell: 1, fire_epic_brann: 1, plant_epic_comb: 1 };
  // Per-hero overrides on top of the element PROPS (kit colours that the element default would fight).
  var HERO_KITS = {
    plant_epic_comb: { core: 0xffb030, coreGlow: 1.1, trans: 0.93, attenDist: 0.55, thick: 0.8, cloud: 0.04, moss: 0.22, sss: 0.07 },  // clearer window onto the honeycomb
    fire_epic_brann: { coreGlow: 0.85 }
  };
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
  function heroKey(unit) {
    var id = unit && (unit.heroId || (unit.slime && unit.slime.heroId));
    return id && HERO_MODELS[id] ? id : null;
  }
  function hasModel(unit) { return !!unit && (!!heroKey(unit) || isPilot(unit.element)); }
  function heroUrl(id, q) { return 'assets/models/heroes/hero_' + id + lodSuffix(q) + '.glb'; }
  /** GLB for this unit: its named-hero body when it has one, else the element gel. */
  function modelUrl(unit, q) { var h = heroKey(unit); return h ? heroUrl(h, q) : urlFor(unit.element, q); }

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
      if (!hasModel(u)) return;
      var url = modelUrl(u, q);
      if (urls.indexOf(url) < 0) urls.push(url);
      // element gel as the fallback body if a hero GLB fails
      if (heroKey(u) && isPilot(u.element) && urls.indexOf(urlFor(u.element, q)) < 0) urls.push(urlFor(u.element, q));
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
  // ---- v4 eyes (founder eye rules, Sep 28): stylized eyes suspended INSIDE the gel just under the surface.
  //      Big dark pupils + 1-2 catchlights, no realistic irises. They lag + wobble behind the squash/stretch.
  //      Element flavor in the details; evolution reads through the eyes (base / mid / top). ----
  var EYE_DEF = { eyeIris: 0x3fd0b0, eyeIris2: 0x0e5a48, eyeGlow: 0.0, eyePupil: 'round', eyeFrost: 0, eyeSclera: 0xf6f9ff,
    eyeShine: 0xffffff, eyeMetal: 0, eyeMag: 1.0, eyeSink: 0.55, eyeLag: 0.75 };
  var EYE_PROPS = {
    water:  { eyeIris: 0x46c8ff, eyeIris2: 0x0b3f9a, eyeMag: 1.14, eyeLag: 0.95, eyeOverGel: 1 }, // magnified, loosest; drawn over the gel (no refraction blotch)
    fire:   { eyeIris: 0xffb43a, eyeIris2: 0xc2360a, eyeGlow: 0.5, eyeSclera: 0xfff4e8 }, // ember glow in the pupil rim
    plant:  { eyeIris: 0xb4ec52, eyeIris2: 0x2a6e16, eyeSclera: 0xf6ffee, eyeLag: 0.6, eyeMag: 1.15 },
    lava:   { eyeIris: 0xffa020, eyeIris2: 0xa01c00, eyeGlow: 1.5, eyeSclera: 0xffe6c8, eyeLag: 0.4 },
    ice:    { eyeIris: 0xd4f8ff, eyeIris2: 0x2a78b4, eyeFrost: 1.0, eyeLag: 0.35 },
    metal:  { eyeIris: 0xdce4ec, eyeIris2: 0x46505c, eyeMetal: 1.0, eyeSclera: 0xb8c2cc, eyeLag: 0.3 }, // polished bead
    poison: { eyeIris: 0xd0ff50, eyeIris2: 0x5a1a8a, eyeGlow: 0.4 },
    shadow: { eyeIris: 0xd090ff, eyeIris2: 0x2a0a50, eyeGlow: 0.5, eyePupil: 'slit', eyeSclera: 0xe6dcff },
    void:   { eyeIris: 0xe070ff, eyeIris2: 0x180030, eyeGlow: 0.7, eyePupil: 'slit', eyeSclera: 0xdcd0f0 },
    crystal:{ eyeIris: 0xf8c8ff, eyeIris2: 0x8a3ac0 },
    light:  { eyeIris: 0xffe28a, eyeIris2: 0xc08a10, eyeGlow: 0.5, eyeShine: 0xfff0c0, eyeSclera: 0xfffaf0 }, // white-gold
    lightning: { eyeIris: 0xfff870, eyeIris2: 0xb08a00, eyeGlow: 0.6, eyePupil: 'slit' },
    earth:  { eyeIris: 0xd8a860, eyeIris2: 0x5a3414, eyeLag: 0.4 },
    spirit: { eyeIris: 0xc8f4ff, eyeIris2: 0x4a8ac8, eyeGlow: 0.35 },
    storm:  { eyeIris: 0xa8c8ff, eyeIris2: 0x1e3a8a, eyeGlow: 0.25 },
    wind:   { eyeIris: 0xc8fff0, eyeIris2: 0x2a8a70 }
  };
  Object.keys(EYE_PROPS).forEach(function (k) { if (PROPS[k]) { var e = EYE_PROPS[k], j; for (j in e) PROPS[k][j] = e[j]; } });
  for (var _ek in EYE_DEF) BASE_PROPS[_ek] = EYE_DEF[_ek];

  // Evolution tier for the eyes: base = big round baby eyes; mid = defined shape + gel brow;
  // top (or fusion) = glowing irises + runes. u/l = resting lid edges for that tier.
  var EYE_TIERS = {
    base: { u: 0.90, l: -0.97, brow: false, runes: false, iris: false },
    mid:  { u: 0.66, l: -0.80, brow: true,  runes: false, iris: false },
    top:  { u: 0.70, l: -0.84, brow: true,  runes: true,  iris: true }
  };
  function eyeTierFor(unit, opts) {
    if (opts && EYE_TIERS[opts.eyeTier]) return opts.eyeTier;
    if (!unit) return 'base';
    if (unit.isFusion || unit.fusion) return 'top';
    var evo = unit.purpleStars != null ? unit.purpleStars : (unit.evolutionLevel || 0);
    evo = Math.max(0, Number(evo) || 0);
    return evo >= 3 ? 'top' : (evo >= 1 ? 'mid' : 'base');
  }

  // Named-hero bodies are sculpted with a defined socket + gel brow, so their eyes start at 'mid'.
  function heroEyeTier(unit, opts, hk) {
    var t = eyeTierFor(unit, opts);
    return (hk && t === 'base' && !(opts && opts.eyeTier)) ? 'mid' : t;
  }

  var _eyeTex = Object.create(null), _eyeGeo = Object.create(null);
  var RUNE_NEAR = 2.6, RUNE_FAR = 5.0, IRIS_FAR_BOOST = 1.3, PULL_DEPTHS = 2.2;
  var _eyeWp = new THREE.Vector3(), _camWp = new THREE.Vector3(), _eyeCol = new THREE.Vector3();
  function hexCss(h, mul, a) {
    var c = new THREE.Color(h); if (mul != null) c.multiplyScalar(mul);
    var s = Math.round(Math.min(1, c.r) * 255) + ',' + Math.round(Math.min(1, c.g) * 255) + ',' + Math.round(Math.min(1, c.b) * 255);
    return a != null ? 'rgba(' + s + ',' + a + ')' : 'rgb(' + s + ')';
  }
  // Stylized eye textures (planar front UV, radius 0.5 = ball edge). kind 'baby': big dark pupil with an element-tinted
  // rim + soft lower glow; kind 'glow': top-tier glowing iris ring around a big pupil. Each has a matching glow map.
  function eyeTextures(pr, kind) {
    var key = [kind, pr.eyeIris, pr.eyeIris2, pr.eyePupil, pr.eyeSclera].join('|');
    if (_eyeTex[key]) return _eyeTex[key];
    var N = 256, cx = N / 2, R = N * 0.40;
    function mk() { var c = document.createElement('canvas'); c.width = c.height = N; return c; }
    var cA = mk(), g = cA.getContext('2d'), cG = mk(), gg = cG.getContext('2d');
    var sg = g.createRadialGradient(cx, cx, N * 0.25, cx, cx, N * 0.5);
    sg.addColorStop(0, hexCss(pr.eyeSclera)); sg.addColorStop(0.8, hexCss(pr.eyeSclera, 0.93)); sg.addColorStop(1, hexCss(pr.eyeSclera, 0.7));
    g.fillStyle = sg; g.fillRect(0, 0, N, N); gg.fillStyle = '#000'; gg.fillRect(0, 0, N, N);
    function disc(ctx, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.fill(); }
    var slit = pr.eyePupil === 'slit';
    if (kind === 'glow') {
      // glowing iris ring (flat, stylized) + big dark pupil
      var ig = g.createRadialGradient(cx, cx, R * 0.5, cx, cx, R);
      ig.addColorStop(0, hexCss(pr.eyeIris, 1.05)); ig.addColorStop(0.7, hexCss(pr.eyeIris, 0.9)); ig.addColorStop(0.92, hexCss(pr.eyeIris2, 1.2)); ig.addColorStop(1, hexCss(pr.eyeIris2));
      disc(g, R, ig);
      var gl = gg.createRadialGradient(cx, cx, R * 0.5, cx, cx, R);
      gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.8, '#e0e0e0'); gl.addColorStop(1, '#707070'); disc(gg, R, gl);
      g.fillStyle = gg.fillStyle = '#000'; g.fillStyle = '#05060c';
      if (slit) { g.beginPath(); g.ellipse(cx, cx, R * 0.16, R * 0.86, 0, 0, Math.PI * 2); g.fill(); gg.beginPath(); gg.ellipse(cx, cx, R * 0.16, R * 0.86, 0, 0, Math.PI * 2); gg.fill(); }
      else { disc(g, R * 0.5, '#05060c'); disc(gg, R * 0.5, '#000'); }
    } else if (slit) {
      // slit pupil on a flat element-colored field (stylized, no fibres)
      var fg = g.createRadialGradient(cx, cx - R * 0.2, R * 0.2, cx, cx, R);
      fg.addColorStop(0, hexCss(pr.eyeIris, 1.1)); fg.addColorStop(1, hexCss(pr.eyeIris2)); disc(g, R, fg);
      g.fillStyle = '#05060c'; g.beginPath(); g.ellipse(cx, cx, R * 0.2, R * 0.9, 0, 0, Math.PI * 2); g.fill();
      var sgl = gg.createRadialGradient(cx, cx, R * 0.3, cx, cx, R); sgl.addColorStop(0, '#888'); sgl.addColorStop(1, '#222'); disc(gg, R, sgl);
      gg.fillStyle = '#000'; gg.beginPath(); gg.ellipse(cx, cx, R * 0.2, R * 0.9, 0, 0, Math.PI * 2); gg.fill();
    } else {
      // big round baby pupil: near-black, element-tinted rim, soft lower glow crescent
      var pg = g.createRadialGradient(cx, cx - R * 0.15, R * 0.2, cx, cx, R);
      pg.addColorStop(0, '#07080f'); pg.addColorStop(0.72, '#0a0c16'); pg.addColorStop(0.93, hexCss(pr.eyeIris2, 0.8)); pg.addColorStop(1, hexCss(pr.eyeIris2, 0.5));
      disc(g, R, pg);
      var cr = g.createRadialGradient(cx, cx + R * 0.55, R * 0.05, cx, cx + R * 0.55, R * 0.62);
      cr.addColorStop(0, hexCss(pr.eyeIris, 1, 0.75)); cr.addColorStop(1, hexCss(pr.eyeIris, 1, 0));
      g.save(); g.beginPath(); g.arc(cx, cx, R * 0.96, 0, Math.PI * 2); g.clip(); g.fillStyle = cr; g.fillRect(0, 0, N, N); g.restore();
      // glow map: rim + crescent (drives ember glow for fire / lava)
      var gr = gg.createRadialGradient(cx, cx, R * 0.78, cx, cx, R); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.7, '#aaaaaa'); gr.addColorStop(1, '#333333');
      disc(gg, R, gr);
      var cg2 = gg.createRadialGradient(cx, cx + R * 0.55, R * 0.05, cx, cx + R * 0.55, R * 0.6); cg2.addColorStop(0, '#ffffff'); cg2.addColorStop(1, 'rgba(0,0,0,0)');
      gg.save(); gg.beginPath(); gg.arc(cx, cx, R * 0.96, 0, Math.PI * 2); gg.clip(); gg.fillStyle = cg2; gg.fillRect(0, 0, N, N); gg.restore();
    }
    function tex(c) { var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; return t; }
    return (_eyeTex[key] = { map: tex(cA), glow: tex(cG) });
  }
  var _runeTex = null;
  function runeTex() {
    if (_runeTex) return _runeTex;
    var N = 256, c = document.createElement('canvas'); c.width = c.height = N; var g = c.getContext('2d'), cx = N / 2;
    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var band = g.createRadialGradient(cx, cx, N * 0.31, cx, cx, N * 0.49);
    band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.28)'); band.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = band; g.fillRect(0, 0, N, N);
    g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineWidth = N * 0.05;
    g.beginPath(); g.arc(cx, cx, N * 0.47, 0, Math.PI * 2); g.stroke();
    g.lineWidth = N * 0.038; g.beginPath(); g.arc(cx, cx, N * 0.33, 0, Math.PI * 2); g.stroke();
    g.lineWidth = N * 0.04;
    for (var i = 0; i < 9; i++) {           // simple angular glyphs between the two rings
      var a = i / 9 * Math.PI * 2; g.save(); g.translate(cx + Math.cos(a) * N * 0.40, cx + Math.sin(a) * N * 0.40); g.rotate(a + Math.PI / 2);
      var h = N * 0.045, w = N * 0.03; g.beginPath(); g.moveTo(0, -h); g.lineTo(0, h);
      var t = (rnd() * 4) | 0;
      if (t === 0) { g.moveTo(0, -h * 0.3); g.lineTo(w, -h); } else if (t === 1) { g.moveTo(-w, -h * 0.2); g.lineTo(w, h * 0.4); }
      else if (t === 2) { g.moveTo(0, 0); g.lineTo(w, -h * 0.5); g.lineTo(0, -h); } else { g.moveTo(-w, h); g.lineTo(w, -h * 0.1); }
      g.stroke(); g.restore();
    }
    _runeTex = new THREE.CanvasTexture(c); return _runeTex;
  }
  function eyeGeos(hiQ) {
    var k = hiQ ? 'h' : 'l';
    if (_eyeGeo[k]) return _eyeGeo[k];
    var s = hiQ ? 1 : 0.6;
    var ball = new THREE.SphereGeometry(1, Math.round(28 * s), Math.round(20 * s));
    var p = ball.attributes.position, uv = ball.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.5 + 0.5, p.getY(i) * 0.5 + 0.5); // planar front projection
    var cornea = new THREE.SphereGeometry(1, Math.round(28 * s), Math.round(12 * s), 0, Math.PI * 2, 0, Math.PI / 2);
    cornea.rotateX(Math.PI / 2); // cap faces +Z
    var lidU = new THREE.SphereGeometry(1, Math.round(22 * s), Math.round(8 * s), 0, Math.PI, 0, Math.PI / 2);
    var lidL = new THREE.SphereGeometry(1, Math.round(22 * s), Math.round(8 * s), 0, Math.PI, Math.PI / 2, Math.PI / 2);
    var lash = new THREE.TorusGeometry(1.0, 0.035, 4, Math.round(16 * s), Math.PI * 0.56); lash.rotateZ(Math.PI * 0.22); lash.rotateX(Math.PI / 2);
    var frost = new THREE.TorusGeometry(1.0, 0.1, Math.round(6 * s), Math.round(28 * s));
    var brow = new THREE.TorusGeometry(1.0, 0.13, Math.round(6 * s), Math.round(18 * s), Math.PI * 0.62); brow.rotateZ(Math.PI * 0.19);
    var rune = new THREE.RingGeometry(1.08, 1.5, 40, 1);
    var ruv = rune.attributes.uv, rp = rune.attributes.position;
    for (var j = 0; j < rp.count; j++) ruv.setXY(j, rp.getX(j) / 3.2 + 0.5, rp.getY(j) / 3.2 + 0.5);
    var dot = new THREE.CircleGeometry(1, 16);
    var bar = new THREE.BoxGeometry(1.5, 0.2, 0.08);
    return (_eyeGeo[k] = { ball: ball, cornea: cornea, lidU: lidU, lidL: lidL, lash: lash, frost: frost, brow: brow, rune: rune, dot: dot, bar: bar });
  }
  var EXPR = {            // upper / lower lid edge height (unit eye space, 1 = top), pupil scale (repeat), eye scale
    rest:   { u: 0.90, l: -0.97, ir: 1.0, es: 1.0 },
    squint: { u: 0.30, l: -0.48, ir: 1.05, es: 0.97 },
    focus:  { u: 0.62, l: -0.82, ir: 1.08, es: 1.0 },
    wide:   { u: 1.10, l: -1.10, ir: 1.3, es: 1.12 },
    closed: { u: -0.04, l: 0.04, ir: 1.0, es: 0.96 }
  };
  var CLIP_EXPR = { attack: ['squint', 0.55], cast: ['focus', 0.7], hit: ['wide', 0.45], hop: ['rest', 0] };

  // Overlay eye parts: rendered in the transparent pass (after the transmissive gel, and left out of the
  // transmission buffer, so the body no longer refracts a smeared, blue-attenuated ghost of the eye onto the
  // cheeks), with the depth pulled toward the camera by uPull so the gel surface in front doesn't hide them.
  function overlayEye(m, pull, ro) {
    m.transparent = true;
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uPull = pull;
      sh.vertexShader = 'uniform float uPull;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n  gl_Position = projectionMatrix * vec4(mvPosition.xyz * max(0.0, 1.0 - uPull / max(1e-3, length(mvPosition.xyz))), 1.0);');
    };
    m.customProgramCacheKey = function () { return 'eyeOver-' + m.type; };
    return m;
  }
  function makeEyes(model, pr, hiQ, env, mats, tierName) {
    var head = model.getObjectByName('head');
    var eyeMeshes = [];
    model.traverse(function (o) { if (o.isSkinnedMesh && o.material && (o.material.name === 'GelEye' || (o.userData._eyeSrc && !o.userData._eyeShine))) eyeMeshes.push(o); });
    if (!head || !eyeMeshes.length) return null;
    var sides = { L: null, R: null }, v = new THREE.Vector3();
    eyeMeshes.forEach(function (m) {
      var pa = m.geometry.attributes.position, bm = m.bindMatrix;
      for (var i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(bm);
        var s = v.x >= 0 ? 'L' : 'R';
        var b = sides[s] || (sides[s] = { min: v.clone(), max: v.clone(), mesh: m });
        b.min.min(v); b.max.max(v);
      }
    });
    var TB = eyeTextures(pr, 'baby'), TG = eyeTextures(pr, 'glow'), G = eyeGeos(hiQ);
    var bodyCol = new THREE.Color(pr.color);
    var M = {
      ball: new THREE.MeshPhysicalMaterial({ map: TB.map, emissiveMap: TB.glow, emissive: new THREE.Color(pr.eyeIris), emissiveIntensity: pr.eyeGlow,
        roughness: pr.eyeMetal ? 0.12 : 0.3, metalness: pr.eyeMetal ? 0.85 : 0, clearcoat: 1.0, clearcoatRoughness: 0.02, envMapIntensity: pr.eyeMetal ? 1.6 : 0.8 }),
      cornea: (hiQ && !pr.eyeOverGel) ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1.0, thickness: 0.06, ior: 1.376, roughness: 0.0,
        clearcoat: 1.0, clearcoatRoughness: 0.0, specularIntensity: 1.0, envMapIntensity: 1.8 })
        : new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.0, clearcoat: 1.0, envMapIntensity: 1.8, depthWrite: false }),
      lid: new THREE.MeshPhysicalMaterial({ color: bodyCol.clone().multiplyScalar(0.92), roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.04,
        sheen: 0.3, sheenColor: new THREE.Color(pr.sheenCol), emissive: bodyCol.clone().multiplyScalar(0.18), envMapIntensity: 1.3 }),
      lash: new THREE.MeshStandardMaterial({ color: bodyCol.clone().multiplyScalar(0.38), roughness: 0.4 }),
      brow: new THREE.MeshPhysicalMaterial({ color: bodyCol.clone().multiplyScalar(0.62), roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.03,
        emissive: bodyCol.clone().multiplyScalar(0.12), envMapIntensity: 1.3 }),
      frost: new THREE.MeshStandardMaterial({ color: 0xeaffff, roughness: 0.6, emissive: new THREE.Color(0x9fdcff), emissiveIntensity: 0.5 }),
      rune: new THREE.MeshBasicMaterial({ map: runeTex(), color: new THREE.Color(pr.eyeIris).multiplyScalar(RUNE_NEAR), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
      shine: new THREE.MeshBasicMaterial({ color: pr.eyeShine, toneMapped: false }),
      xbar: new THREE.MeshStandardMaterial({ color: 0x2a0c18, roughness: 0.5 })
    };
    var pull = { value: 0 }, over = !!pr.eyeOverGel;
    // rune always overlays (additive glow on top of the gel); water overlays the whole eye
    overlayEye(M.rune, pull);
    if (over) ['cornea', 'lid', 'lash', 'brow', 'frost', 'shine', 'xbar'].forEach(function (k) { overlayEye(M[k], pull); });
    Object.keys(M).forEach(function (k) { if (env && 'envMap' in M[k] && !M[k].isMeshBasicMaterial) M[k].envMap = env; mats.push(M[k]); });
    var headIdx = -1, sk = null;
    var rigs = [];
    var sink = pr.eyeSink;   // how far (in eye depths) the eye hangs back under the gel surface
    ['L', 'R'].forEach(function (s) {
      var b = sides[s]; if (!b) return;
      sk = b.mesh.skeleton; headIdx = sk.bones.indexOf(head);
      var toBone = new THREE.Matrix4().copy(headIdx >= 0 ? sk.boneInverses[headIdx] : new THREE.Matrix4());
      var c = b.min.clone().add(b.max).multiplyScalar(0.5);
      var hy = (b.max.y - b.min.y) * 0.5 * pr.eyeMag, hx = (pr.eyeHx || 0.14) * pr.eyeMag, hz = 0.075;
      var fwd = new THREE.Vector3(c.x, 0, c.z).normalize();
      var rot = new THREE.Matrix4().extractRotation(toBone);
      var zAx = fwd.clone().applyMatrix4(rot).normalize(), yAx = new THREE.Vector3(0, 1, 0).applyMatrix4(rot).normalize();
      var xAx = new THREE.Vector3().crossVectors(yAx, zAx).normalize(); yAx.crossVectors(zAx, xAx);
      var q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx));
      var bonePos = c.clone().applyMatrix4(toBone);
      var bs = new THREE.Vector3(); toBone.decompose(new THREE.Vector3(), new THREE.Quaternion(), bs);
      var root = new THREE.Group(); root.name = 'EyeRig' + s; root.position.copy(bonePos); root.quaternion.copy(q);
      var unit = new THREE.Group(); unit.scale.set(hx * bs.x, hy * bs.y, hz * bs.z); unit.position.z = -sink * hz * bs.z; root.add(unit);
      function mesh(geo, mat, ro) { var m = new THREE.Mesh(geo, mat); m.frustumCulled = false; if (ro != null) m.renderOrder = ro; return m; }
      var ball = mesh(G.ball, M.ball, over ? 20 : null); unit.add(ball);
      var cornea = mesh(G.cornea, M.cornea, over ? 25 : null); cornea.scale.set(1.03, 1.03, 1.28); unit.add(cornea);
      var frost = null; if (pr.eyeFrost) { frost = mesh(G.frost, M.frost); frost.position.z = 0.45; unit.add(frost); }
      var lidsG = new THREE.Group(); lidsG.scale.set(1.09, 1.09, 1.42); unit.add(lidsG);
      var lidU = mesh(G.lidU, M.lid, over ? 21 : null); lidsG.add(lidU);
      var lash = mesh(G.lash, M.lash, over ? 22 : null); lash.scale.set(1.01, 1, 1.01); lidU.add(lash);
      var lidL = mesh(G.lidL, M.lid, over ? 21 : null); lidsG.add(lidL);
      // mid/top: gel brow arc above the eye, tilted down toward the nose (determined look)
      var brow = mesh(G.brow, M.brow, over ? 22 : null); brow.position.set(0, 0.28, 0.75); brow.scale.set(1.18, 1.0, 1.0);
      brow.rotation.z = (s === 'L' ? -1 : 1) * 0.16; unit.add(brow);
      // top: rune ring around the eye
      var rune = mesh(G.rune, M.rune, 26); rune.position.z = 0.55; rune.scale.setScalar(1.15); unit.add(rune);
      var zc = function (x, y) { return 1.28 * Math.sqrt(Math.max(0, 1 - x * x - y * y)) + 0.08; };
      var sh1 = mesh(G.dot, M.shine, over ? 24 : null); sh1.position.set(-0.32, 0.36, zc(-0.32, 0.36)); sh1.scale.set(0.24, 0.22, 1); unit.add(sh1);
      var sh2 = mesh(G.dot, M.shine, over ? 24 : null); sh2.position.set(0.30, -0.34, zc(0.30, -0.34)); sh2.scale.set(0.1, 0.09, 1); unit.add(sh2);
      var xg = new THREE.Group(); xg.position.z = 1.5; xg.visible = false; unit.add(xg);
      var x1 = mesh(G.bar, M.xbar); x1.rotation.z = 0.8; var x2 = mesh(G.bar, M.xbar); x2.rotation.z = -0.8; xg.add(x1); xg.add(x2);
      head.add(root);
      var bm = M.ball.clone(); if (over) overlayEye(bm, pull); ball.material = bm; mats.push(bm);
      // fight-distance read: measure how big the eye is on screen (fraction of view height) each frame
      ball.onBeforeRender = function (rdr, scn, cam) {
        if (!cam || !cam.isPerspectiveCamera) return;
        unit.getWorldPosition(_eyeWp); cam.getWorldPosition(_camWp);
        var d = Math.max(1e-3, _eyeWp.distanceTo(_camWp)), sx = _eyeCol.setFromMatrixColumn(unit.matrixWorld, 0).length();
        st.frac = sx * 2 / (2 * d * Math.tan(cam.fov * Math.PI / 360));
        if (over) pull.value = _eyeCol.setFromMatrixColumn(unit.matrixWorld, 2).length() * PULL_DEPTHS;
      };
      var tx = { baby: { map: TB.map.clone(), glow: TB.glow.clone() }, glow: { map: TG.map.clone(), glow: TG.glow.clone() } };
      ['baby', 'glow'].forEach(function (kk) { tx[kk].map.needsUpdate = true; tx[kk].glow.needsUpdate = true; });
      rigs.push({ s: s, root: root, unit: unit, basePos: bonePos.clone(), bindC: c, rotB: rot, lidU: lidU, lidL: lidL, x: xg, ballMat: bm, tx: tx,
        map: tx.baby.map, glow: tx.baby.glow, cornea: cornea, sh1: sh1, sh2: sh2, brow: brow, rune: rune, frost: frost,
        sp: new THREE.Vector3(), sv: new THREE.Vector3(), prevW: null, eyeW: hx * bs.x });
    });
    M.ball.map = null; M.ball.emissiveMap = null;
    var st = { u: EXPR.rest.u, l: EXPR.rest.l, ir: 1, es: 1, expr: 'rest', exprT: 0, blinkIn: 1.5 + Math.random() * 2.5, blinkT: -1,
      gx: 0, gy: 0, tgx: 0, tgy: 0, look: null, lookT: 0, glanceIn: 1 + Math.random() * 2, dead: false, tier: 'base', runeA: 0, frac: 1, far: 0 };
    var tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4(), off = new THREE.Vector3(), wp = new THREE.Vector3(), dl = new THREE.Vector3(),
      pq = new THREE.Quaternion(), ps = new THREE.Vector3();
    function setTier(t) {
      if (!EYE_TIERS[t]) t = 'base'; st.tier = t; var T = EYE_TIERS[t];
      rigs.forEach(function (r) {
        var k = T.iris ? 'glow' : 'baby'; r.map = r.tx[k].map; r.glow = r.tx[k].glow;
        r.ballMat.map = r.map; r.ballMat.emissiveMap = r.glow;
        r.ballMat.emissiveIntensity = T.iris ? Math.max(0.8, pr.eyeGlow * 1.2) : pr.eyeGlow; r.irisBase = r.ballMat.emissiveIntensity; r.ballMat.needsUpdate = true;
        r.brow.visible = T.brow; r.rune.visible = T.runes;
      });
    }
    function setExpr(name, dur) { st.expr = name; st.exprT = dur || 0; }
    function lookAt(obj, dur) { st.look = obj || null; st.lookT = dur || 1.2; }
    function tick(dt, U, figs, self) {
      var h = Math.min(dt, 1 / 20);
      if (st.exprT > 0) { st.exprT -= dt; if (st.exprT <= 0 && !st.dead) st.expr = 'rest'; }
      var E = EXPR[st.dead ? 'closed' : st.expr] || EXPR.rest, TT = EYE_TIERS[st.tier];
      var bu = E.u, bl = E.l;
      if (!st.dead && st.expr === 'rest') { bu = TT.u; bl = TT.l; }
      if (!st.dead) {
        st.blinkIn -= dt;
        if (st.blinkIn <= 0 && st.blinkT < 0) { st.blinkT = 0; st.blinkIn = 2.2 + Math.random() * 3.2 + (Math.random() < 0.2 ? -1.8 : 0); }
        if (st.blinkT >= 0) {
          st.blinkT += dt; var bt = st.blinkT / 0.16;
          if (bt >= 1) st.blinkT = -1; else { var k = Math.sin(bt * Math.PI); bu = bu + (EXPR.closed.u - bu) * k; bl = bl + (EXPR.closed.l - bl) * k; }
        }
      }
      var a = 1 - Math.exp(-h * (st.blinkT >= 0 ? 60 : 16));
      st.u += (bu - st.u) * a; st.l += (bl - st.l) * a;
      var a2 = 1 - Math.exp(-h * 10); st.ir += (E.ir - st.ir) * a2; st.es += (E.es - st.es) * a2;
      if (st.lookT > 0) st.lookT -= dt; else st.look = null;
      if (!st.look && figs && !st.dead) {
        st.glanceIn -= dt;
        if (st.glanceIn <= 0) {
          st.glanceIn = 1.4 + Math.random() * 2.6;
          var foes = []; for (var id in figs) { var f = figs[id]; if (f && f.isFoe && !f.dead && f.root) foes.push(f); }
          if (foes.length && Math.random() < 0.75) { st.look = foes[(Math.random() * foes.length) | 0].root; st.lookT = 0.9 + Math.random() * 1.4; }
        }
      }
      st.runeA += dt * 0.35;
      // far = 1 once the eye is ~1.5% of view height or less (fight distance), 0 in close-ups
      var ft = Math.max(0, Math.min(1, (0.05 - st.frac) / 0.035)); ft = ft * ft * (3 - 2 * ft);
      st.far += (ft - st.far) * (1 - Math.exp(-h * 8));
      if (TT.runes) M.rune.color.set(pr.eyeIris).multiplyScalar(RUNE_NEAR + (RUNE_FAR - RUNE_NEAR) * st.far);
      rigs.forEach(function (r) {
        // lag + wobble: the eye hangs in the gel, so when the head moves (hop / squash / lunge) it trails behind,
        // then springs back with a little overshoot. Spring offset lives in head-bone space.
        var par = r.root.parent; par.updateWorldMatrix(true, false); par.matrixWorld.decompose(wp, pq, ps);
        if (r.prevW && dt > 0) {
          dl.copy(wp).sub(r.prevW);
          if (dl.lengthSq() < 0.25) { dl.applyQuaternion(pq.invert()).divideScalar(ps.x || 1); r.sp.addScaledVector(dl, -pr.eyeLag * 0.35); }
        }
        r.prevW = (r.prevW || new THREE.Vector3()).copy(wp);
        var K = 170, C = 7.5;
        r.sv.addScaledVector(r.sp, -K * h).multiplyScalar(Math.max(0, 1 - C * h)); r.sp.addScaledVector(r.sv, h);
        var lim = r.eyeW * 0.3; if (r.sp.length() > lim) r.sp.setLength(lim);
        off.set(0, 0, 0);
        if (U) {
          var p = r.bindC, hw = Math.min(1.6, Math.max(0, p.y / 1.1)); hw *= hw; var ph = U.uTime.value * U.uJigFreq.value, am = U.uJigAmp.value * hw;
          off.set(Math.sin(ph + p.y * 4 + p.z * 3) * am, Math.sin(ph * 1.3 + p.x * 5 + p.z * 2) * am * 0.45, Math.cos(ph * 0.87 + p.y * 3.5 + p.x * 3) * am);
          off.applyMatrix4(r.rotB);
        }
        r.root.position.copy(r.basePos).add(off).add(r.sp);
        r.root.scale.setScalar(st.es);
        r.lidU.rotation.x = -Math.asin(Math.max(-1, Math.min(1, st.u)));
        r.lidL.rotation.x = -Math.asin(Math.max(-1, Math.min(1, st.l)));
        r.lidU.visible = st.u < 0.82; r.lidL.visible = st.l > -0.9;
        r.x.visible = st.dead;
        r.sh1.visible = r.sh2.visible = !st.dead;
        r.rune.rotation.z = (r.s === 'L' ? 1 : -1) * st.runeA;
        r.rune.scale.setScalar(1.15 + 0.2 * st.far);
        if (TT.iris && r.irisBase != null) r.ballMat.emissiveIntensity = r.irisBase * (1 + IRIS_FAR_BOOST * st.far);
      });
      var tgx = 0, tgy = 0;
      if (st.look && rigs.length) {
        var r0 = rigs[0]; r0.root.updateWorldMatrix(true, false);
        st.look.getWorldPosition(tmpV); tmpV.y += 0.6;
        tmpM.copy(r0.root.matrixWorld).invert(); tmpV.applyMatrix4(tmpM);
        var d = tmpV.normalize();
        tgx = Math.max(-0.5, Math.min(0.5, Math.atan2(d.x, Math.max(0.2, d.z)))); tgy = Math.max(-0.35, Math.min(0.35, Math.atan2(d.y, Math.max(0.2, d.z))));
      }
      var a3 = 1 - Math.exp(-h * 14); st.gx += (tgx - st.gx) * a3; st.gy += (tgy - st.gy) * a3;
      rigs.forEach(function (r) {
        var rp = st.ir, ox = 0.5 * (1 - rp) - st.gx * 0.3 * rp, oy = 0.5 * (1 - rp) - st.gy * 0.3 * rp;
        r.map.repeat.set(rp, rp); r.map.offset.set(ox, oy); r.glow.repeat.set(rp, rp); r.glow.offset.set(ox, oy);
      });
    }
    setTier(tierName);
    return {
      rigs: rigs, st: st, setExpr: setExpr, lookAt: lookAt, tick: tick, setTier: setTier,
      faint: function () { st.dead = true; st.look = null; },
      revive: function () { st.dead = false; st.expr = 'rest'; st.exprT = 0; }
    };
  }

  // Squash-spring impulses per clip start (scaled by element squash).
  var SQUASH_KICK = { hop: -1.6, attack: -2.2, hit: 3.2, cast: -1.4, faint: 2.0 };

  function makeFigure(T, unit, opts) {
    opts = opts || {};
    if (!enabled() || !unit || !hasModel(unit)) return null;
    if (unit.isFoe || unit.isEnemy || unit.enemyKind) return null;
    var q = opts.quality || currentQuality();
    var hk = heroKey(unit);
    var gltf = hk ? (gltfCache[heroUrl(hk, q)] || gltfCache[heroUrl(hk, 'high')]) : null;
    if (!gltf) { hk = null; gltf = isPilot(unit.element) ? (gltfCache[urlFor(unit.element, q)] || gltfCache[urlFor(unit.element, 'high')]) : null; }
    if (!gltf) return null;
    var el = elKey(unit.element);
    var pr = propsFor(el);
    if (hk && HERO_KITS[hk]) pr = Object.assign({}, pr, HERO_KITS[hk]);
    var look = pr;
    var rar = RARITY[unit.rarity] || RARITY.Common;
    var env = envFor(opts.renderer);
    var U = jigUniforms(pr);
    // Viscosity: scale the baked root squash in the clips once per GLB by this element's squash multiplier.
    if (!gltf.userData) gltf.userData = {};
    if (gltf.userData.squashFor !== el) { // (hero GLBs are single-element, so el is stable per GLB)
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
        o.userData._eyeSrc = true; if (!opts.legacyEyes) o.visible = false; // v3: replaced by the modeled eye rig
      } else if (name === 'GelEyeShine') {
        m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
        o.userData._eyeSrc = true; o.userData._eyeShine = true; if (!opts.legacyEyes) o.visible = false;
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
      } else if (src && hk && /^Orn_/.test(name)) {
        m = src.clone(); // named-hero kit (canoe, brazier iron, comb cells…): keep its authored colours
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

    var eyes = opts.legacyEyes ? null : makeEyes(model, pr, hiQ, env, mats, heroEyeTier(unit, opts, hk));
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
      if (eyes) { var ce = CLIP_EXPR[name]; if (ce) eyes.setExpr(ce[0], ce[1]); if (name === 'faint') eyes.faint(); }
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
      eyes: eyes,
      heroLook: function (obj, dur) { if (eyes) eyes.lookAt(obj, dur); },
      heroTick: function (dt, figs) {
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
        if (eyes) eyes.tick(dt, U, figs, fig);
      },
      heroRevive: function () {
        fig.dead = false; fig.melting = false; model.visible = true; shadow.visible = true;
        if (actions.faint) actions.faint.stop();
        if (eyes) eyes.revive();
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
    enabled: enabled, isPilot: isPilot, hasModel: hasModel, modelUrl: modelUrl, HERO_MODELS: HERO_MODELS, HERO_KITS: HERO_KITS, preload: preload, ready: ready,
    makeFigure: makeFigure, urlFor: urlFor, CLIPS: CLIPS, _cache: gltfCache, _failed: failed, _live: live, PROPS: PROPS, propsFor: propsFor, EXPR: EXPR, EYE_TIERS: EYE_TIERS, eyeTierFor: eyeTierFor
  };
  window.dispatchEvent(new Event('sr-hero3d-ready'));
  console.log('[Hero3D] ready (pilots: water, fire, plant)');
})();
