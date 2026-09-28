/* ===== Soft 3D gel slimes (Three.js) — solid gel only, no badge texture =====
 * Streamed into Phaser as slime3d_{element} canvas textures.
 */
(function (global) {
  'use strict';

  var SIZE = 384;
  var _ready = false;
  var _failed = false;
  var _entries = {};
  var _renderer = null;
  var _scene = null;
  var _camera = null;
  var _clock = 0;
  var _raf = 0;
  var _phaserGame = null;
  var _envMap = null;
  /** Per-element yaw override for detail-stage drag spin (radians). null = idle sway only */
  var _spinYaw = {};

  function hasThree() {
    return typeof global.THREE !== 'undefined';
  }

  function elKey(element) {
    return String(element || 'water').toLowerCase();
  }

  function textureKey(element) {
    return 'slime3d_' + elKey(element);
  }

  function elementTintHex(elLower) {
    var map = {
      water: 0x4fc3f7, fire: 0xff7043, earth: 0xa1887f, wind: 0x80deea,
      plant: 0x66bb6a, lightning: 0xffee58, ice: 0xb3e5fc, shadow: 0x7e57c2,
      light: 0xfff59d, metal: 0xb0bec5, poison: 0xab47bc, crystal: 0xce93d8,
      lava: 0xff5722, storm: 0x90caf9, spirit: 0xe1bee7, void: 0x5c6bc0
    };
    return map[elLower] || 0x66bb6a;
  }

  /** Match battleWorld3d GEL_PROFILES — portrait 3D gels must vary by element */
  var GEL_PROFILES = {
    water:     { size: 0.95, bodyH: 0.90, bodyW: 1.15, style: 'droplet', eyes: 2 },
    fire:      { size: 1.02, bodyH: 1.16, bodyW: 0.92, style: 'flame', eyes: 2 },
    earth:     { size: 1.25, bodyH: 0.86, bodyW: 1.25, style: 'chunk', eyes: 2 },
    wind:      { size: 0.72, bodyH: 1.06, bodyW: 1.00, style: 'wispy', eyes: 2 },
    plant:     { size: 1.08, bodyH: 1.00, bodyW: 1.05, style: 'sprout', eyes: 2 },
    lightning: { size: 0.78, bodyH: 1.24, bodyW: 0.82, style: 'spike', eyes: 2 },
    ice:       { size: 1.00, bodyH: 1.08, bodyW: 0.95, style: 'crystal', eyes: 2 },
    shadow:    { size: 0.92, bodyH: 1.10, bodyW: 0.94, style: 'tendril', eyes: 2 },
    light:     { size: 0.98, bodyH: 1.00, bodyW: 1.00, style: 'orb', eyes: 2 },
    metal:     { size: 1.15, bodyH: 0.94, bodyW: 1.10, style: 'armor', eyes: 2 },
    poison:    { size: 0.88, bodyH: 0.96, bodyW: 1.12, style: 'bubble', eyes: 2 },
    crystal:   { size: 1.04, bodyH: 1.14, bodyW: 0.88, style: 'gem', eyes: 2 },
    lava:      { size: 1.28, bodyH: 0.88, bodyW: 1.28, style: 'heavy', eyes: 2 },
    storm:     { size: 1.10, bodyH: 1.00, bodyW: 1.24, style: 'cloud', eyes: 2 },
    spirit:    { size: 0.74, bodyH: 1.18, bodyW: 0.88, style: 'ghost', eyes: 2 },
    void:      { size: 1.12, bodyH: 1.04, bodyW: 1.12, style: 'cosmos', eyes: 3 }
  };

  function gelProfile(elLower) {
    return GEL_PROFILES[elLower] || GEL_PROFILES.water;
  }

  function initRenderer() {
    if (_renderer || !hasThree()) return !!_renderer;
    var THREE = global.THREE;
    try {
      _renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });
      _renderer.setSize(SIZE, SIZE, false);
      _renderer.setPixelRatio(Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2));
      _renderer.setClearColor(0x000000, 0);
      if (_renderer.outputColorSpace !== undefined) {
        _renderer.outputColorSpace = THREE.SRGBColorSpace;
      }
      if (_renderer.toneMapping !== undefined) {
        _renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // RSL-class champion stage: brighter filmic read
        _renderer.toneMappingExposure = 1.28;
      }

      _scene = new THREE.Scene();
      _camera = new THREE.PerspectiveCamera(24, 1, 0.1, 40);
      // Slightly elevated 3/4 hero angle (preview stage, not flat orthographic)
      _camera.position.set(0.15, 0.55, 5.15);
      _camera.lookAt(0, 0.05, 0);

      _scene.add(new THREE.AmbientLight(0xe8f0ff, 0.55));
      var key = new THREE.DirectionalLight(0xfff4e0, 1.75);
      key.position.set(2.2, 4.0, 3.4);
      _scene.add(key);
      var rim = new THREE.DirectionalLight(0x88bbff, 1.15);
      rim.position.set(-2.8, 1.4, -1.6);
      _scene.add(rim);
      var fill = new THREE.PointLight(0xffe8cc, 0.7, 16);
      fill.position.set(0, -0.4, 2.8);
      _scene.add(fill);
      var front = new THREE.DirectionalLight(0xffffff, 0.65);
      front.position.set(0, 0.4, 5.2);
      _scene.add(front);
      // Soft under-light so gel volume reads (champion stage)
      var under = new THREE.PointLight(0x66aaff, 0.35, 10);
      under.position.set(0, -1.4, 0.5);
      _scene.add(under);

      // Tier B: soft studio env map (gradient cube) for richer gel reflections
      try {
        _envMap = makeStudioEnvMap(THREE);
        if (_envMap) _scene.environment = _envMap;
      } catch (eEnv) {
        console.warn('[Slime3D] env map skip', eEnv && eEnv.message);
      }

      return true;
    } catch (e) {
      console.warn('[Slime3D] WebGL init failed', e);
      _failed = true;
      return false;
    }
  }

  /** Procedural 6-face studio HDR-ish cube → env map for MeshPhysical reflections */
  function makeStudioEnvMap(THREE) {
    if (!THREE.CubeTexture || !THREE.CubeTextureLoader) {
      // Build CubeTexture manually from canvases
    }
    var size = 64;
    var faces = [];
    // order: +X -X +Y -Y +Z -Z
    var colors = [
      ['#f0e8d8', '#88aacc'], // +X warm → cool
      ['#d8e8f0', '#6688aa'], // -X
      ['#fff8ee', '#c8d8e8'], // +Y bright sky
      ['#3a3028', '#1a1814'], // -Y ground
      ['#e8f0ff', '#90a8c0'], // +Z
      ['#e0d8c8', '#708090']  // -Z
    ];
    var i;
    for (i = 0; i < 6; i++) {
      var c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      var ctx = c.getContext('2d');
      var g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, colors[i][0]);
      g.addColorStop(1, colors[i][1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      // soft highlight blob
      var rg = ctx.createRadialGradient(size * 0.35, size * 0.3, 2, size * 0.35, size * 0.3, size * 0.45);
      rg.addColorStop(0, 'rgba(255,255,255,0.55)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, size, size);
      faces.push(c);
    }
    var cube = new THREE.CubeTexture(faces);
    cube.needsUpdate = true;
    if (THREE.SRGBColorSpace !== undefined) cube.colorSpace = THREE.SRGBColorSpace;
    else if (cube.encoding !== undefined && THREE.sRGBEncoding !== undefined) {
      cube.encoding = THREE.sRGBEncoding;
    }
    return cube;
  }

  function makeElementSphere(style) {
    var THREE = global.THREE;
    var geo = new THREE.SphereGeometry(1, 56, 44);
    var pos = geo.attributes.position;
    var i;
    for (i = 0; i < pos.count; i++) {
      var y = pos.getY(i);
      var x = pos.getX(i);
      var z = pos.getZ(i);
      var ny = y;
      var nx = x;
      var nz = z;
      if (style === 'droplet') {
        ny = y * 0.72 - 0.1;
        var w = 1.12 + Math.max(0, -y) * 0.26;
        nx = x * w; nz = z * 0.92;
      } else if (style === 'flame') {
        ny = y * 1.14 + Math.max(0, y) * 0.22;
        nx = x * (0.94 - Math.max(0, y) * 0.14);
        nz = z * (0.94 - Math.max(0, y) * 0.14);
      } else if (style === 'chunk' || style === 'heavy') {
        ny = y * 0.78; nx = x * 1.18; nz = z * 1.04;
      } else if (style === 'wispy' || style === 'ghost') {
        ny = y * 1.1; nx = x * (0.9 + Math.sin(y * 4) * 0.07); nz = z * 0.88;
      } else if (style === 'spike') {
        ny = y * 1.22; nx = x * 0.86; nz = z * 0.86;
      } else if (style === 'crystal' || style === 'gem') {
        ny = y * 1.08; nx = x * 0.88; nz = z * 0.88;
      } else if (style === 'cloud') {
        ny = y * 0.9; nx = x * 1.22; nz = z * 1.04;
      } else if (style === 'cosmos') {
        ny = y * 0.95; nx = x * 1.1; nz = z * 1.0;
      } else {
        ny = y * 0.78 - 0.08;
        var w0 = 1.04 + Math.max(0, -y) * 0.14;
        nx = x * w0; nz = z * 0.94;
      }
      pos.setXYZ(i, nx, ny, nz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  function createEntry(elLower) {
    var THREE = global.THREE;
    var canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;

    var profile = gelProfile(elLower);
    var geo = makeElementSphere(profile.style || 'blob');
    var base = new Float32Array(geo.attributes.position.array.length);
    base.set(geo.attributes.position.array);
    var tint = elementTintHex(elLower);

    var rough = 0.16;
    var metal = 0.0;
    if (elLower === 'metal') { rough = 0.28; metal = 0.45; }
    if (elLower === 'crystal' || elLower === 'ice') { rough = 0.1; metal = 0.2; }
    if (elLower === 'earth') { rough = 0.45; metal = 0.05; }
    if (elLower === 'lava' || elLower === 'fire') { rough = 0.28; metal = 0.05; }

    var shellMat;
    if (THREE.MeshPhysicalMaterial) {
      shellMat = new THREE.MeshPhysicalMaterial({
        color: tint,
        roughness: rough,
        metalness: metal,
        clearcoat: elLower === 'metal' ? 0.45 : 1.0,
        clearcoatRoughness: 0.09,
        transparent: true,
        opacity: 0.92,
        depthWrite: true,
        side: THREE.FrontSide,
        emissive: new THREE.Color(tint),
        emissiveIntensity: elLower === 'light' || elLower === 'lightning' ? 0.28 : 0.14,
        envMap: _envMap || null,
        envMapIntensity: _envMap ? 1.15 : 0
      });
      if ('transmission' in shellMat) {
        // Soft transmission + env = Tier B “juicy gel” look (opaque enough to always read)
        // Keep transmission modest so gels never go invisible without HDRI
        shellMat.transmission = (elLower === 'metal' || elLower === 'earth') ? 0.08 : 0.22;
        shellMat.thickness = 0.95;
        shellMat.ior = 1.38;
        shellMat.opacity = 1;
      }
    } else {
      shellMat = new THREE.MeshStandardMaterial({
        color: tint, roughness: rough, metalness: metal, transparent: true, opacity: 0.9,
        emissive: new THREE.Color(tint), emissiveIntensity: 0.12,
        envMap: _envMap || null,
        envMapIntensity: _envMap ? 0.7 : 0
      });
    }

    // Inner core for depth (reads through soft shell)
    var coreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tint).offsetHSL(0, 0.05, 0.12),
      roughness: 0.55,
      metalness: 0.05,
      emissive: new THREE.Color(tint),
      emissiveIntensity: 0.35
    });

    var shell = new THREE.Mesh(geo, shellMat);
    shell.position.y = -0.02;
    // Frame-fill scale × element body proportions × overall size family
    var baseS = 0.82 * (profile.size || 1);
    shell.scale.set(
      baseS * (profile.bodyW || 1),
      baseS * (profile.bodyH || 1) * 0.95,
      baseS * (profile.bodyW || 1) * 0.96
    );

    var core = new THREE.Mesh(geo.clone(), coreMat);
    core.scale.copy(shell.scale).multiplyScalar(0.62);
    core.position.y = shell.position.y;

    var group = new THREE.Group();
    group.add(core);
    group.add(shell);

    // Element ornaments (same language as combat)
    var ornMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tint).offsetHSL(0, 0, 0.12),
      emissive: new THREE.Color(tint),
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.15
    });
    var style = profile.style;
    if (style === 'sprout' || elLower === 'plant') {
      var leaf = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 6), ornMat);
      leaf.position.set(-0.12, 0.72, 0.05);
      group.add(leaf);
    } else if (style === 'crystal' || style === 'gem') {
      var shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), ornMat);
      shard.position.set(0.08, 0.78, 0);
      group.add(shard);
    } else if (style === 'flame' || style === 'heavy') {
      var ember = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), ornMat);
      ember.position.set(0.35, 0.55, 0.2);
      group.add(ember);
    } else if (style === 'spike') {
      var bolt = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 4), ornMat);
      bolt.position.set(0.15, 0.85, 0);
      bolt.rotation.z = 0.35;
      group.add(bolt);
    } else if (elLower === 'light') {
      var halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.03, 8, 24),
        new THREE.MeshBasicMaterial({ color: tint })
      );
      halo.rotation.x = Math.PI / 2.5;
      halo.position.y = 0.65;
      group.add(halo);
    } else if (elLower === 'metal') {
      var plate = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.32), ornMat);
      plate.position.set(0, 0.1, 0.48);
      group.add(plate);
    } else if (elLower === 'void' || style === 'cosmos') {
      var star = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), ornMat);
      star.position.set(0.32, 0.55, 0.28);
      group.add(star);
    }

    // Eyes — void gets a third eye
    var eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var pupilMat = new THREE.MeshBasicMaterial({ color: 0x111811 });
    var eyeCount = profile.eyes || 2;
    var ei;
    for (ei = 0; ei < eyeCount; ei++) {
      var ex = eyeCount === 3 ? (ei - 1) * 0.18 : (ei === 0 ? -0.2 : 0.2);
      var ey = eyeCount === 3 && ei === 1 ? 0.26 : 0.16;
      var ew = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), eyeWhite);
      var pu = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), pupilMat);
      ew.position.set(ex, ey, 0.62);
      pu.position.set(ex, ey, 0.7);
      group.add(ew, pu);
    }

    var hi = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false })
    );
    hi.position.set(-0.28, 0.38 * (profile.bodyH || 1), 0.52);
    group.add(hi);

    // Fit tall/wide gels in the camera frame
    var fit = 1 / Math.max(profile.bodyH || 1, profile.bodyW || 1, 1);
    group.scale.setScalar(0.95 + fit * 0.08);

    _entries[elLower] = {
      canvas: canvas,
      mesh: group,
      shell: shell,
      face: null,
      geo: geo,
      base: base,
      profile: profile,
      phase: Math.random() * Math.PI * 2
    };
  }

  function bakeAll(elements) {
    if (!hasThree()) {
      _failed = true;
      return Promise.resolve({ ok: false, reason: 'no THREE' });
    }
    if (!initRenderer()) {
      return Promise.resolve({ ok: false, reason: 'no webgl' });
    }
    var ok = [];
    (elements || []).forEach(function (el) {
      var low = elKey(el);
      try {
        createEntry(low);
        renderOne(low, 0);
        ok.push(low);
      } catch (e) {
        console.warn('[Slime3D] skip', low, e && e.message);
      }
    });
    _ready = ok.length > 0;
    return Promise.resolve({ ok: _ready, count: ok.length });
  }

  function applyWobble(entry, t) {
    var pos = entry.geo.attributes.position;
    var base = entry.base;
    var phase = entry.phase || 0;
    var arr = pos.array;
    var i;
    for (i = 0; i < pos.count; i++) {
      var ix = i * 3;
      var bx = base[ix];
      var by = base[ix + 1];
      var bz = base[ix + 2];
      var nlen = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
      var wave =
        Math.sin(t * 2.0 + by * 5 + phase) * 0.024 +
        Math.sin(t * 2.9 + bx * 3.8 + phase) * 0.012;
      arr[ix] = bx + (bx / nlen) * wave;
      arr[ix + 1] = by + (by / nlen) * wave * 0.85;
      arr[ix + 2] = bz + (bz / nlen) * wave;
    }
    pos.needsUpdate = true;
    entry.geo.computeVertexNormals();
  }

  function renderOne(elLower, t) {
    if (!_renderer || !_entries[elLower]) return;
    var entry = _entries[elLower];
    for (var i = _scene.children.length - 1; i >= 0; i--) {
      var ch = _scene.children[i];
      if (ch.isMesh || ch.isGroup) _scene.remove(ch);
    }
    applyWobble(entry, t + entry.phase);
    var yaw = _spinYaw[elLower];
    if (yaw != null && isFinite(yaw)) {
      entry.mesh.rotation.y = yaw;
      entry.mesh.rotation.x = Math.sin(t * 0.5 + entry.phase) * 0.02;
    } else {
      entry.mesh.rotation.y = Math.sin(t * 0.4 + entry.phase) * 0.1;
      entry.mesh.rotation.x = Math.sin(t * 0.6 + entry.phase) * 0.035;
    }
    entry.mesh.position.y = Math.sin(t * 1.5 + entry.phase) * 0.018;
    _scene.add(entry.mesh);

    _renderer.setRenderTarget(null);
    _renderer.clear();
    _renderer.render(_scene, _camera);

    var ctx = entry.canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    var pad = Math.floor(SIZE * 0.08);
    ctx.drawImage(_renderer.domElement, pad, pad, SIZE - pad * 2, SIZE - pad * 2);

    if (_phaserGame && _phaserGame.textures && _phaserGame.textures.exists(textureKey(elLower))) {
      var tex = _phaserGame.textures.get(textureKey(elLower));
      if (tex) {
        if (typeof tex.refresh === 'function') tex.refresh();
        else if (tex.source && tex.source[0] && tex.source[0].update) tex.source[0].update();
      }
    }
  }

  function registerWithPhaser(game) {
    _phaserGame = game;
    if (!game || !game.textures) return 0;
    var n = 0;
    Object.keys(_entries).forEach(function (low) {
      var key = textureKey(low);
      if (game.textures.exists(key)) game.textures.remove(key);
      game.textures.addCanvas(key, _entries[low].canvas);
      n++;
    });
    return n;
  }

  function tick() {
    if (!_ready || _failed) return;
    _clock += 0.016;
    var t = _clock;
    var keys = Object.keys(_entries);
    if (!keys.length) return;
    var batch = 4;
    var start = Math.floor(t * 28) % keys.length;
    for (var i = 0; i < batch; i++) {
      renderOne(keys[(start + i) % keys.length], t);
    }
  }

  function startLoop(game) {
    if (game) registerWithPhaser(game);
    if (_raf) cancelAnimationFrame(_raf);
    function loop() {
      tick();
      _raf = requestAnimationFrame(loop);
    }
    _raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (_raf) cancelAnimationFrame(_raf);
    _raf = 0;
  }

  function setSpinYaw(element, yawRad) {
    var low = elKey(element);
    if (yawRad == null) delete _spinYaw[low];
    else _spinYaw[low] = yawRad;
  }

  function addSpinYaw(element, deltaRad) {
    var low = elKey(element);
    var cur = _spinYaw[low];
    if (cur == null || !isFinite(cur)) cur = 0;
    _spinYaw[low] = cur + (deltaRad || 0);
    return _spinYaw[low];
  }

  function clearSpinYaw(element) {
    if (element == null) {
      _spinYaw = {};
      return;
    }
    delete _spinYaw[elKey(element)];
  }

  function getSpinYaw(element) {
    var low = elKey(element);
    return _spinYaw[low] != null && isFinite(_spinYaw[low]) ? _spinYaw[low] : null;
  }

  global.SR_SLIME3D = {
    SIZE: SIZE,
    bakeAll: bakeAll,
    registerWithPhaser: registerWithPhaser,
    startLoop: startLoop,
    stopLoop: stopLoop,
    textureKey: textureKey,
    isReady: function () { return _ready && !_failed; },
    hasElement: function (el) { return !!_entries[elKey(el)]; },
    renderOne: renderOne,
    tick: tick,
    setSpinYaw: setSpinYaw,
    addSpinYaw: addSpinYaw,
    clearSpinYaw: clearSpinYaw,
    getSpinYaw: getSpinYaw
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SR_SLIME3D;
  }
})(typeof window !== 'undefined' ? window : global);
