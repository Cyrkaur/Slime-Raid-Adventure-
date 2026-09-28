/* ===== Phase 5 model pipeline — GLB prefer, impostor/procedural fallback =====
 * Paths:
 *   assets/models/gel/gel_base.glb
 *   assets/models/gel/gel_{element}.glb   (optional override)
 *   assets/models/enemy/enemy_{kind}.glb
 *   assets/models/prop/prop_{zone}.glb    (future scenery)
 *
 * Loading: window.SR_loadGLB from gltfBridge.js (module). Rebuilds meshes with
 * the combat THREE (global) so WebGL stays on one renderer.
 */
(function (global) {
  'use strict';

  var _ready = Object.create(null); // url → { meshes }
  var _failed = Object.create(null);
  var _pending = Object.create(null);

  function elKey(el) {
    return String(el || 'water').toLowerCase();
  }

  function gelUrls(element) {
    var low = elKey(element);
    // Primary + shared base (base exists; use loadFirst at runtime so we don't 404)
    return [
      'assets/models/gel/gel_' + low + '.glb',
      'assets/models/gel/gel_base.glb'
    ];
  }

  function enemyUrls(kind) {
    var k = String(kind || 'beast').toLowerCase();
    // Only primary — enemy_base.glb is not shipped (avoid 404 spam)
    return [
      'assets/models/enemy/enemy_' + k + '.glb'
    ];
  }

  function propUrls(zone) {
    var z = String(zone || 'greenwild').toLowerCase();
    return [
      'assets/models/prop/prop_' + z + '.glb'
    ];
  }

  /** Primary gel path only (for preload — base warmed once separately) */
  function gelUrlPrimary(element) {
    return 'assets/models/gel/gel_' + elKey(element) + '.glb';
  }

  function enemyUrlPrimary(kind) {
    return 'assets/models/enemy/enemy_' + String(kind || 'beast').toLowerCase() + '.glb';
  }

  /**
   * Tiny GET the python http.server log will print (user often watches that terminal,
   * not the browser DevTools console). Uses a dedicated probe path so it never
   * collides with real GLB loads / caches.
   */
  function serverBreadcrumb(tag, detail) {
    try {
      var q = 'sr=' + encodeURIComponent(tag || 'ping') +
        '&d=' + encodeURIComponent(String(detail || '').slice(0, 180)) +
        '&t=' + Date.now();
      // 1x1 probe — always 404 is fine; server still logs the line
      fetch('assets/models/__sr_probe__?' + q, { method: 'GET', cache: 'no-store' })
        .catch(function () { /* 404 expected */ });
    } catch (eB) { /* ignore */ }
  }

  function hasLoader() {
    return typeof global.SR_loadGLB === 'function';
  }

  /**
   * gltfBridge.js is type=module (async). Combat can start before SR_loadGLB exists.
   * Wait for the bridge — never permanently fail just because it is late.
   */
  var _loaderWait = null;
  function waitForLoader(timeoutMs) {
    if (hasLoader()) return Promise.resolve(true);
    if (_loaderWait) return _loaderWait;
    timeoutMs = timeoutMs != null ? timeoutMs : 5000;
    _loaderWait = new Promise(function (resolve) {
      var done = false;
      var poll = null;
      var timer = null;
      function finish(ok) {
        if (done) return;
        done = true;
        try {
          if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('sr-gltf-ready', onReady);
          }
        } catch (eR) { /* ignore */ }
        if (poll) clearInterval(poll);
        if (timer) clearTimeout(timer);
        _loaderWait = null;
        resolve(!!ok);
      }
      function onReady() { finish(hasLoader()); }
      try {
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('sr-gltf-ready', onReady);
        }
      } catch (eA) { /* Node / non-DOM */ }
      poll = setInterval(function () {
        if (hasLoader()) finish(true);
      }, 40);
      timer = setTimeout(function () {
        finish(hasLoader());
      }, timeoutMs);
    });
    return _loaderWait;
  }

  function loadOne(url, opts) {
    opts = opts || {};
    if (_ready[url]) return Promise.resolve(_ready[url]);
    // Soft fail cache: skip unless force retry
    if (_failed[url] && !opts.force) return Promise.resolve(null);
    if (_pending[url]) return _pending[url];

    _pending[url] = waitForLoader(5000).then(function (ok) {
      if (!ok || !hasLoader()) {
        delete _pending[url];
        console.warn('[Models] skip (no GLTF bridge yet):', url);
        return null;
      }
      return global.SR_loadGLB(url).then(function (payload) {
        delete _pending[url];
        if (!payload || !payload.meshes || !payload.meshes.length) {
          _failed[url] = true;
          console.warn('[Models] empty mesh pack:', url);
          return null;
        }
        delete _failed[url];
        _ready[url] = payload;
        return payload;
      }).catch(function (err) {
        delete _pending[url];
        _failed[url] = true;
        console.warn('[Models] load failed:', url, err && (err.message || err));
        return null;
      });
    });
    return _pending[url];
  }

  /** Sequential loads — avoids concurrent GLTFLoader flakes; returns per-url status */
  function loadAllSerial(urls, force) {
    var results = [];
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.resolve(results);
      var u = urls[i++];
      return loadOne(u, { force: !!force }).then(function (p) {
        results.push({ url: u, ok: !!p, meshes: p && p.meshes ? p.meshes.length : 0 });
        return next();
      });
    }
    return next();
  }

  /** Try urls in order; first success wins */
  function loadFirst(urls) {
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.resolve(null);
      var u = urls[i++];
      return loadOne(u).then(function (p) {
        return p || next();
      });
    }
    return next();
  }

  function getCachedGel(element) {
    var urls = gelUrls(element);
    var i;
    for (i = 0; i < urls.length; i++) {
      if (_ready[urls[i]]) return _ready[urls[i]];
    }
    return null;
  }

  function getCachedEnemy(kind) {
    var urls = enemyUrls(kind);
    var i;
    for (i = 0; i < urls.length; i++) {
      if (_ready[urls[i]]) return _ready[urls[i]];
    }
    return null;
  }

  /**
   * Warm cache for combat units.
   * - Loads real gel_*.glb + enemy_*.glb only (no missing prop/base 404 spam)
   * - Browser console.log + server-log breadcrumb (python -m http.server)
   */
  /** Hero3d pilots (heroGel3d.js) load alongside the legacy GLB warm-up. */
  function preloadForUnits(units, opts) {
    var core = preloadForUnitsCore(units, opts);
    var H = global.SR_HERO3D;
    if (!H || typeof H.preload !== 'function') return core;
    var heroP = H.preload(units).catch(function (e) {
      console.warn('[Models] hero3d preload error', e && e.message);
      return null;
    });
    return Promise.all([core, heroP]).then(function (r) {
      var res = r[0];
      if (res && typeof res === 'object' && r[1]) res.hero3d = r[1];
      return res;
    });
  }

  function preloadForUnitsCore(units, opts) {
    opts = opts || {};
    var urls = [];
    var seen = Object.create(null);
    function want(url) {
      if (!url || seen[url]) return;
      seen[url] = 1;
      urls.push(url);
    }

    var nAlly = 0;
    var nFoe = 0;
    // Enemy placeholder GLBs are opt-in (painted impostors look better in combat)
    var loadEnemyGlb = !!(opts.loadEnemyGlb || global.SR_FORCE_ENEMY_GLB);
    if (!loadEnemyGlb) {
      try {
        loadEnemyGlb = (typeof localStorage !== 'undefined' &&
          localStorage.getItem('sr_force_enemy_glb') === '1');
      } catch (eEg) { loadEnemyGlb = false; }
    }
    (units || []).forEach(function (u) {
      if (!u) return;
      var foe = !!(u.isEnemy || u.isFoe || u.enemyKind);
      if (foe) {
        nFoe++;
        if (loadEnemyGlb) want(enemyUrlPrimary(u.enemyKind || u.kind || 'beast'));
      } else {
        nAlly++;
        want(gelUrlPrimary(u.element));
      }
    });
    // Shared gel fallback (exists on disk)
    if (nAlly > 0) want('assets/models/gel/gel_base.glb');

    // Zone props are optional art — only if explicitly requested (files not shipped yet)
    if (opts.loadProps && opts.zone) {
      propUrls(opts.zone).forEach(want);
    }

    // Always retry this battle's URLs (clear sticky fails from earlier races)
    urls.forEach(function (u) { delete _failed[u]; });
    try {
      if (global.SR_GLTF_BRIDGE && typeof global.SR_GLTF_BRIDGE.clearCache === 'function') {
        // Don't clear entire cache every fight — only if many misses last time
        // (full clear reserved for force). Keep warm cache for re-fights.
      }
    } catch (eClr) { /* ignore */ }

    var urlShort = urls.map(function (u) {
      return u.replace(/^assets\/models\//, '');
    }).join(',');
    serverBreadcrumb('battle_preload_start', 'u=' + (units || []).length + ',n=' + urls.length + ',' + urlShort.slice(0, 120));

    console.log('[Models] preload start', {
      units: (units || []).length,
      allies: nAlly,
      foes: nFoe,
      urls: urls.length,
      hasLoader: hasLoader(),
      list: urls
    });

    if (!urls.length) {
      console.log('[Models] preloaded 0 GLB pack(s) (no unit urls)');
      serverBreadcrumb('battle_preload_done', 'loaded=0');
      return Promise.resolve({ ok: true, loaded: 0, urls: 0, hasLoader: hasLoader() });
    }

    return waitForLoader(5000).then(function (bridgeOk) {
      if (!bridgeOk) {
        console.warn('[Models] GLTF bridge never ready — procedural gels only. Check gltfBridge.js module load.');
        serverBreadcrumb('battle_preload_done', 'no-bridge');
        return { ok: false, loaded: 0, urls: urls.length, hasLoader: false, reason: 'no-bridge' };
      }
      // Serial load so each GET appears cleanly in the server log and GLTFLoader stays stable
      return loadAllSerial(urls, true).then(function (details) {
        var n = details.filter(function (d) { return d.ok; }).length;
        var failed = details.length - n;
        var failNames = details.filter(function (d) { return !d.ok; })
          .map(function (d) { return d.url.replace(/^assets\/models\//, ''); });
        console.log('[Models] preloaded', n, 'GLB pack(s)', {
          loaded: n,
          failed: failed,
          urls: urls.length,
          hasLoader: true,
          cachedKeys: Object.keys(_ready).length,
          details: details
        });
        serverBreadcrumb(
          'battle_preload_done',
          'loaded=' + n + ',failed=' + failed +
            (failNames.length ? ',miss=' + failNames.join('+') : '')
        );
        if (n === 0) {
          console.warn('[Models] 0 packs loaded — fight will use procedural gels. Browser: F12 → Console/Network.');
        }
        return {
          ok: n > 0,
          loaded: n,
          failed: failed,
          urls: urls.length,
          hasLoader: true,
          details: details
        };
      });
    });
  }

  /**
   * Rebuild GLB mesh data with combat THREE instance.
   * @returns {THREE.Group|null}
   */
  function buildGroup(THREE, payload, opts) {
    opts = opts || {};
    if (!THREE || !payload || !payload.meshes || !payload.meshes.length) return null;

    var root = new THREE.Group();
    var tint = opts.tintColor || new THREE.Color(0xffffff);
    if (!(tint.isColor)) tint = new THREE.Color(tint);
    var baseEmissive = opts.emissiveIntensity != null ? opts.emissiveIntensity : 0.22;
    var rough = opts.roughness != null ? opts.roughness : 0.38;
    var metal = opts.metalness != null ? opts.metalness : 0.12;

    var shell = null;
    var mats = [];
    var i;
    for (i = 0; i < payload.meshes.length; i++) {
      var m = payload.meshes[i];
      if (!m.pos || m.pos.length < 9) continue;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
      if (m.nor && m.nor.length === m.pos.length) {
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(m.nor, 3));
      } else {
        geo.computeVertexNormals();
      }
      if (m.idx && m.idx.length) {
        var maxIndex = 0;
        var j;
        for (j = 0; j < m.idx.length; j++) if (m.idx[j] > maxIndex) maxIndex = m.idx[j];
        if (maxIndex > 65535) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(m.idx), 1));
        else geo.setIndex(new THREE.BufferAttribute(new Uint16Array(m.idx), 1));
      }
      var mat;
      if (THREE.MeshPhysicalMaterial && !opts.isEnemy) {
        try {
          mat = new THREE.MeshPhysicalMaterial({
            color: tint.clone(),
            roughness: rough,
            metalness: metal,
            clearcoat: 0.92,
            clearcoatRoughness: 0.08,
            sheen: 0.4,
            sheenRoughness: 0.4,
            sheenColor: tint.clone().offsetHSL(0, 0.05, 0.2),
            emissive: tint.clone(),
            emissiveIntensity: baseEmissive,
            side: THREE.FrontSide
          });
        } catch (ePhys) {
          // Fallback without sheen (older THREE)
          try {
            mat = new THREE.MeshPhysicalMaterial({
              color: tint.clone(),
              roughness: rough,
              metalness: metal,
              clearcoat: 0.9,
              clearcoatRoughness: 0.1,
              emissive: tint.clone(),
              emissiveIntensity: baseEmissive,
              side: THREE.FrontSide
            });
          } catch (e2) {
            mat = null;
          }
        }
      }
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color: tint.clone(),
          roughness: rough,
          metalness: metal,
          emissive: tint.clone(),
          emissiveIntensity: baseEmissive,
          side: THREE.FrontSide
        });
      }
      mats.push(mat);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (m.matrix && m.matrix.length === 16) {
        var mx = new THREE.Matrix4();
        mx.fromArray(m.matrix);
        mesh.applyMatrix4(mx);
      }
      root.add(mesh);
      if (!shell) shell = mesh;
    }
    if (!shell) return null;

    // Normalize: target height, feet on y=0
    root.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(root);
    var size = new THREE.Vector3();
    box.getSize(size);
    var targetH = opts.targetHeight != null ? opts.targetHeight : 1.7;
    var maxDim = Math.max(size.y, size.x * 0.5, size.z * 0.5, 0.05);
    var s = targetH / maxDim;
    root.scale.setScalar(s);
    root.updateMatrixWorld(true);
    box.setFromObject(root);
    root.position.y -= box.min.y;

    root.userData.shell = shell;
    root.userData.materials = mats;
    root.userData.isGLB = true;
    return root;
  }

  /**
   * Wrap a GLB group into the same figure contract as battleWorld3d figures.
   */
  function figureFromGLB(THREE, unit, payload, kindOpts) {
    kindOpts = kindOpts || {};
    var isFoe = !!(unit && (unit.isFoe || unit.isEnemy || unit.enemyKind));
    var tintHex = kindOpts.tint != null ? kindOpts.tint : 0x88ccaa;
    var tintColor = new THREE.Color(tintHex);
    var baseEmissive = kindOpts.baseEmissive != null ? kindOpts.baseEmissive : 0.25;
    var targetH = kindOpts.targetHeight != null ? kindOpts.targetHeight : (isFoe ? 1.85 : 1.45);

    var group = buildGroup(THREE, payload, {
      tintColor: tintColor,
      emissiveIntensity: baseEmissive,
      targetHeight: targetH,
      roughness: kindOpts.roughness,
      metalness: kindOpts.metalness
    });
    if (!group) return null;

    var shell = group.userData.shell;
    var mat = group.userData.materials[0];
    var root = new THREE.Group();
    root.add(group);

    var shadowR = isFoe ? 0.9 : 0.7;
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(shadowR, 22),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    root.add(shadow);

    var dummyGeo = shell.geometry;
    var dummyBase = new Float32Array(dummyGeo.attributes.position.array.length);
    dummyBase.set(dummyGeo.attributes.position.array);

    return {
      root: root,
      shell: shell,
      core: shell,
      coreMat: mat,
      outline: null,
      mat: mat,
      geo: dummyGeo,
      base: dummyBase,
      eyes: [],
      hi: null,
      contactShadow: shadow,
      tint: tintHex,
      tintColor: tintColor,
      baseColor: tintColor.clone(),
      phase: Math.random() * Math.PI * 2,
      unitId: unit && unit.id,
      isFoe: isFoe,
      isEnemy: isFoe,
      enemyKind: kindOpts.enemyKind || (unit && (unit.enemyKind || unit.kind)) || null,
      solidEnemy: !!isFoe && kindOpts.enemyKind !== 'slime',
      isImpostor: false,
      isGLB: true,
      gelImpostor: false,
      gelSize: kindOpts.gelSize || 1,
      gelFloatY: kindOpts.gelFloatY || 0,
      baseScale: 1,
      home: { x: 0, y: 0, z: 0 },
      hitFlash: 0,
      dead: false,
      melting: false,
      meltT: 0,
      activePulse: 0,
      baseEmissive: baseEmissive,
      puddle: null,
      droplets: []
    };
  }

  function tryGelFigure(THREE, unit, opts) {
    var payload = getCachedGel(unit && unit.element);
    if (!payload) return null;
    opts = opts || {};
    opts.isEnemy = false;
    var fig = figureFromGLB(THREE, unit, payload, opts);
    if (fig) {
      fig.grounded = true;
      fig.gelFloatY = 0;
      fig.solidEnemy = false;
      fig.isGLB = true;
      // Soft idle squash still works via root.scale in battle tick
    }
    return fig;
  }

  function tryEnemyFigure(THREE, unit, opts) {
    var kind = (unit && (unit.enemyKind || unit.kind)) || 'beast';
    var payload = getCachedEnemy(kind);
    if (!payload) return null;
    opts = opts || {};
    opts.enemyKind = kind;
    opts.isEnemy = true;
    var fig = figureFromGLB(THREE, unit, payload, opts);
    if (fig) {
      fig.grounded = true;
      fig.solidEnemy = true;
    }
    return fig;
  }

  global.SR_MODELS = {
    gelUrls: gelUrls,
    enemyUrls: enemyUrls,
    propUrls: propUrls,
    gelUrlPrimary: gelUrlPrimary,
    enemyUrlPrimary: enemyUrlPrimary,
    hasLoader: hasLoader,
    waitForLoader: waitForLoader,
    loadOne: loadOne,
    loadAllSerial: loadAllSerial,
    preloadForUnits: preloadForUnits,
    serverBreadcrumb: serverBreadcrumb,
    getCachedGel: getCachedGel,
    getCachedEnemy: getCachedEnemy,
    buildGroup: buildGroup,
    figureFromGLB: figureFromGLB,
    tryGelFigure: tryGelFigure,
    tryEnemyFigure: tryEnemyFigure,
    _ready: _ready,
    _failed: _failed
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SR_MODELS;
  }
})(typeof window !== 'undefined' ? window : global);
