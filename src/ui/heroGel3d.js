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
  // Per element gel look. attenuation = colour light picks up travelling through the body.
  var LOOK = {
    water: { color: 0x3aa6ff, atten: 0x0a4cff, attenDist: 0.24, core: 0x7fd6ff, sheen: 0x6fbfff, rim: 0x5fc8ff, scale: 1.36, trans: 0.62, thick: 1.3 },
    fire:  { color: 0xff8a5a, atten: 0xe8300a, attenDist: 0.30, core: 0xffc040, sheen: 0xffe0c0, rim: 0xffa040, scale: 1.40 },
    plant: { color: 0x8fe07a, atten: 0x1f8f1e, attenDist: 0.35, core: 0xd6ff7a, sheen: 0xeaffd8, rim: 0xb8ff7a, scale: 1.38 }
  };
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

  // Fresnel rim glow on the body (rarity-scaled), injected into the physical shader.
  function addRim(mat, rimColor, rimStrength) {
    mat.userData.rim = { value: new THREE.Color(rimColor).multiplyScalar(rimStrength) };
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uRim = mat.userData.rim;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
        .replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n' +
          '{ float fr = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);\n' +
          '  totalEmissiveRadiance += uRim * pow(fr, 3.0); }');
    };
    mat.customProgramCacheKey = function () { return 'heroRim'; };
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

  function makeFigure(T, unit, opts) {
    opts = opts || {};
    if (!enabled() || !unit || !isPilot(unit.element)) return null;
    if (unit.isFoe || unit.isEnemy || unit.enemyKind) return null;
    var q = opts.quality || currentQuality();
    var gltf = gltfCache[urlFor(unit.element, q)] || gltfCache[urlFor(unit.element, 'high')];
    if (!gltf) return null;
    var el = elKey(unit.element);
    var look = LOOK[el];
    var rar = RARITY[unit.rarity] || RARITY.Common;
    var env = envFor(opts.renderer);

    var model = SkeletonUtils.clone(gltf.scene);
    model.scale.setScalar(look.scale);
    // Turn the face part-way toward the fight camera (allies face the foe line otherwise → profile view).
    model.rotation.y = (opts.faceCamYaw != null ? opts.faceCamYaw : HERO_FACE_CAM_YAW);
    var body = null, core = null, mats = [];
    model.traverse(function (o) {
      if (!o.isMesh) return;
      o.frustumCulled = false; // skinned bounds don't follow bones
      o.castShadow = !!opts.shadows; o.receiveShadow = false;
      var src = o.material, name = (src && src.name) || '';
      var m;
      if (name === 'GelBody') {
        m = new THREE.MeshPhysicalMaterial({
          color: look.color, roughness: 0.14, metalness: 0.0,
          transmission: q === 'low' ? 0.0 : (look.trans || 0.82), thickness: look.thick || 0.9, ior: 1.33,
          attenuationColor: new THREE.Color(look.atten), attenuationDistance: look.attenDist,
          clearcoat: 1.0, clearcoatRoughness: 0.06,
          sheen: 0.35, sheenRoughness: 0.4, sheenColor: new THREE.Color(look.sheen),
          iridescence: rar.irid, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 520],
          emissive: new THREE.Color(look.rim), emissiveIntensity: rar.emis,
          envMapIntensity: 1.1, specularIntensity: 1.0
        });
        if (q === 'low') { m.transparent = false; }
        addRim(m, look.rim, rar.rim);
        if (!body || o.name === 'body' || o.name === 'GelBody') body = o;
      } else if (name === 'GelCore') {
        m = new THREE.MeshStandardMaterial({
          color: look.core, emissive: new THREE.Color(look.core), emissiveIntensity: 0.55,
          roughness: 0.5, transparent: false
        });
        core = o;
      } else if (name === 'GelEye') {
        m = new THREE.MeshPhysicalMaterial({ color: 0x0a0f22, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
      } else if (name === 'GelEyeShine') {
        m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      } else if (name === 'GelMouth') {
        m = new THREE.MeshStandardMaterial({ color: 0x3a0d1a, roughness: 0.5 });
      } else if (name === 'GelBubble') {
        m = new THREE.MeshPhysicalMaterial({ color: 0xe6f7ff, roughness: 0.02, transmission: q === 'low' ? 0 : 0.9, thickness: 0.1, ior: 1.2, clearcoat: 1, iridescence: 0.6 });
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
    function play(name, fade) {
      var a = actions[name]; if (!a) return;
      fade = fade == null ? 0.1 : fade;
      if (name === 'idle') {
        a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false;
      } else {
        a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
      }
      a.enabled = true; a.reset(); a.setEffectiveWeight(1); a.setEffectiveTimeScale(1);
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
      mixer: mixer, actions: actions, clip: null, element: unit.element,
      playClip: function (n, f) { if (fig.dead && n !== 'idle') return; play(n, f); },
      heroTick: function (dt) {
        if (fig.activePulse > 0 && lastActive <= 0 && !fig.dead && !fig.melting && fig.clip === 'idle') play('hop', 0.08);
        lastActive = fig.activePulse;
        mixer.update(dt);
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
    makeFigure: makeFigure, urlFor: urlFor, CLIPS: CLIPS, _cache: gltfCache, _failed: failed, _live: live
  };
  window.dispatchEvent(new Event('sr-hero3d-ready'));
  console.log('[Hero3D] ready (pilots: water, fire, plant)');
})();
