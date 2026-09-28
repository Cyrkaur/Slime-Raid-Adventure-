/* ===== R2 — Live 3D champion showcase (RSL preview class) =====
 * Single-figure Three stage → blit canvas → Phaser texture.
 * Drag yaw + idle orbit. Not used for hub lists.
 */
(function (global) {
  'use strict';

  var ELEMENT_HEX = {
    water: 0x4fc3f7, fire: 0xff7043, earth: 0xa1887f, wind: 0x80deea,
    plant: 0x66bb6a, lightning: 0xffee58, ice: 0xb3e5fc, shadow: 0x7e57c2,
    light: 0xfff59d, metal: 0xb0bec5, poison: 0xab47bc, crystal: 0xce93d8,
    lava: 0xff5722, storm: 0x90caf9, spirit: 0xe1bee7, void: 0x5c6bc0
  };

  var RARITY_GLOW = {
    Common: 0x9ca3af, Uncommon: 0x4ade80, Rare: 0x60a5fa,
    Epic: 0xc084fc, Legendary: 0xf59e0b, Mythic: 0xf472b6
  };

  function elKey(el) {
    return String(el || 'water').toLowerCase();
  }

  function available() {
    return typeof global.THREE !== 'undefined';
  }

  function makeWobblyGeo(THREE) {
    var geo = new THREE.SphereGeometry(1, 56, 42);
    var pos = geo.attributes.position;
    var i;
    for (i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var y = pos.getY(i);
      var z = pos.getZ(i);
      var ny = y * 0.76 - 0.08;
      var widen = 1.06 + Math.max(0, -y) * 0.16;
      pos.setXYZ(i, x * widen, ny, z * 0.93);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Create live showcase. Returns API or null.
   * opts: {
   *   width, height, dpr, element, rarity, name, game, textureKey,
   *   artImage — HTMLImageElement|HTMLCanvasElement (gentle UI / combat cutout),
   *   artUrl — optional path if artImage not ready,
   *   preferArt — default true: hide procedural body when painted plate loads
   * }
   */
  function create(opts) {
    opts = opts || {};
    if (!available()) return null;
    var THREE = global.THREE;
    var width = Math.max(256, opts.width || 512);
    var height = Math.max(256, opts.height || 640);
    var dpr = Math.min(opts.dpr || 1, 1.5);
    var el = elKey(opts.element);
    var tint = ELEMENT_HEX[el] || 0x66bb6a;
    var rarCol = RARITY_GLOW[opts.rarity] || 0xc9a44a;
    var textureKey = opts.textureKey || ('champ_show_' + el + '_' + Math.random().toString(36).slice(2, 7));
    var preferArt = opts.preferArt !== false;

    var glCanvas = document.createElement('canvas');
    glCanvas.width = Math.floor(width * dpr);
    glCanvas.height = Math.floor(height * dpr);
    glCanvas.style.cssText = 'position:fixed;left:-9999px;top:0;width:4px;height:4px;opacity:0;pointer-events:none;';
    if (typeof document !== 'undefined' && document.body) document.body.appendChild(glCanvas);

    var blitCanvas = document.createElement('canvas');
    blitCanvas.width = width;
    blitCanvas.height = height;
    var blitCtx = blitCanvas.getContext('2d', { alpha: false });

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: glCanvas,
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
    } catch (e) {
      console.warn('[ChampShow] WebGL fail', e);
      return null;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x050c0a, 1);
    if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (renderer.toneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.42;
    }
    renderer.shadowMap.enabled = true;
    if (THREE.PCFSoftShadowMap) renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x071210, 7, 20);

    var camera = new THREE.PerspectiveCamera(26, width / height, 0.1, 40);
    camera.position.set(0.4, 1.65, 5.6);
    camera.lookAt(0, 0.65, 0);

    // Studio lighting (RSL preview class — brighter key + rarity rim)
    scene.add(new THREE.AmbientLight(0xd0e0f0, 0.62));
    scene.add(new THREE.HemisphereLight(0xf0f6ff, 0x1a2820, 0.85));
    var key = new THREE.DirectionalLight(0xfff6e8, 2.05);
    key.position.set(2.8, 5.8, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0003;
    scene.add(key);
    var rim = new THREE.DirectionalLight(rarCol, 1.35);
    rim.position.set(-3.4, 2.4, -1.6);
    scene.add(rim);
    var fill = new THREE.PointLight(tint, 0.85, 14);
    fill.position.set(0, 1.3, 3.6);
    scene.add(fill);
    var under = new THREE.PointLight(rarCol, 0.65, 9);
    under.position.set(0, 0.2, 0.55);
    scene.add(under);
    // Cool kick light (studio rim from camera-right)
    var kick = new THREE.DirectionalLight(0xaaccff, 0.45);
    kick.position.set(2.2, 1.2, 4.0);
    scene.add(kick);

    // Gradient backdrop (vertex colors) — deeper studio feel than flat plane
    var backGeo = new THREE.PlaneGeometry(12, 10, 1, 8);
    var backCols = [];
    var bpos = backGeo.attributes.position;
    var bi;
    var cTop = new THREE.Color(0x142820);
    var cBot = new THREE.Color(0x060e0c);
    for (bi = 0; bi < bpos.count; bi++) {
      var ty = (bpos.getY(bi) + 5) / 10;
      var cc = cBot.clone().lerp(cTop, Math.max(0, Math.min(1, ty)));
      // Subtle rarity tint near top
      if (ty > 0.55) cc.lerp(new THREE.Color(rarCol), 0.12 * ((ty - 0.55) / 0.45));
      backCols.push(cc.r, cc.g, cc.b);
    }
    backGeo.setAttribute('color', new THREE.Float32BufferAttribute(backCols, 3));
    var back = new THREE.Mesh(backGeo, new THREE.MeshBasicMaterial({
      vertexColors: true, fog: false, depthWrite: false
    }));
    back.position.set(0, 2.2, -3.8);
    scene.add(back);

    // Pedestal — double-tier with gold + rarity rings
    var pedMat = new THREE.MeshStandardMaterial({
      color: 0x1c2a24, metalness: 0.5, roughness: 0.32,
      emissive: new THREE.Color(rarCol), emissiveIntensity: 0.16
    });
    var pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.4, 0.3, 48), pedMat);
    pedestal.position.y = 0.15;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    scene.add(pedestal);
    var pedTop = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.12, 0.1, 48),
      new THREE.MeshStandardMaterial({
        color: 0x243830, metalness: 0.55, roughness: 0.28,
        emissive: new THREE.Color(rarCol), emissiveIntensity: 0.1
      })
    );
    pedTop.position.y = 0.32;
    pedTop.receiveShadow = true;
    scene.add(pedTop);
    // Outer gold rim
    var ringGold = new THREE.Mesh(
      new THREE.TorusGeometry(1.28, 0.035, 10, 48),
      new THREE.MeshStandardMaterial({
        color: 0xc9a44a, emissive: 0xc9a44a, emissiveIntensity: 0.35,
        metalness: 0.7, roughness: 0.22
      })
    );
    ringGold.rotation.x = Math.PI / 2;
    ringGold.position.y = 0.34;
    scene.add(ringGold);
    // Inner rarity ring (spins)
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.045, 12, 48),
      new THREE.MeshStandardMaterial({
        color: rarCol, emissive: rarCol, emissiveIntensity: 0.7,
        metalness: 0.6, roughness: 0.22
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.36;
    scene.add(ring);
    var floorGlow = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 48),
      new THREE.MeshBasicMaterial({ color: rarCol, transparent: true, opacity: 0.22 })
    );
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.y = 0.02;
    scene.add(floorGlow);
    // Soft outer vignette disc
    var floorOuter = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 })
    );
    floorOuter.rotation.x = -Math.PI / 2;
    floorOuter.position.y = 0.015;
    scene.add(floorOuter);

    // Floating studio motes (rarity-tinted)
    var motes = [];
    var mi;
    for (mi = 0; mi < 18; mi++) {
      var mote = new THREE.Mesh(
        new THREE.SphereGeometry(0.025 + Math.random() * 0.03, 6, 5),
        new THREE.MeshBasicMaterial({
          color: mi % 3 === 0 ? rarCol : 0xffffff,
          transparent: true,
          opacity: 0.35 + Math.random() * 0.35,
          depthWrite: false
        })
      );
      mote.position.set(
        (Math.random() - 0.5) * 3.5,
        0.6 + Math.random() * 2.4,
        (Math.random() - 0.5) * 2.2 - 0.5
      );
      mote.userData.phase = Math.random() * Math.PI * 2;
      mote.userData.speed = 0.35 + Math.random() * 0.55;
      scene.add(mote);
      motes.push(mote);
    }

    // Multi-part grounded gel (fallback when no painted plate) + optional combat art impostor
    var mat;
    if (THREE.MeshPhysicalMaterial) {
      mat = new THREE.MeshPhysicalMaterial({
        color: tint,
        roughness: 0.16,
        metalness: el === 'metal' ? 0.4 : 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        emissive: new THREE.Color(tint),
        emissiveIntensity: 0.28,
        transparent: false
      });
      if ('transmission' in mat) {
        mat.transmission = 0.12;
        mat.thickness = 1.0;
        mat.ior = 1.38;
      }
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: tint, roughness: 0.2, emissive: new THREE.Color(tint), emissiveIntensity: 0.25
      });
    }
    var matSoft = mat.clone ? mat.clone() : mat;
    var geo = makeWobblyGeo(THREE);
    var base = new Float32Array(geo.attributes.position.array.length);
    base.set(geo.attributes.position.array);
    var bodyY = 1.05;
    var shell = new THREE.Mesh(geo, mat);
    shell.castShadow = true;
    shell.receiveShadow = true;
    shell.position.y = bodyY;
    shell.scale.set(1.0, 0.95, 0.95);

    var core = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 22, 16),
      new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.4 })
    );
    core.position.y = bodyY;

    var cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), matSoft);
    var cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), matSoft);
    cheekL.scale.set(0.9, 0.7, 0.8);
    cheekR.scale.set(0.9, 0.7, 0.8);
    cheekL.position.set(-0.52, bodyY - 0.05, 0.12);
    cheekR.position.set(0.52, bodyY - 0.05, 0.12);

    var footL = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), mat);
    var footR = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), mat);
    footL.scale.set(1.2, 0.42, 1.1);
    footR.scale.set(1.2, 0.42, 1.1);
    footL.position.set(-0.28, 0.42, 0.15);
    footR.position.set(0.28, 0.42, 0.15);
    footL.castShadow = true;
    footR.castShadow = true;

    var skirt = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 16, 10),
      new THREE.MeshStandardMaterial({
        color: tint, roughness: 0.25, emissive: new THREE.Color(tint),
        emissiveIntensity: 0.15, transparent: true, opacity: 0.9
      })
    );
    skirt.scale.set(1.1, 0.2, 1.0);
    skirt.position.y = 0.42;

    var eyeGeo = new THREE.SphereGeometry(0.11, 14, 12);
    var eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var pupM = new THREE.MeshBasicMaterial({ color: 0x111811 });
    var eyeL = new THREE.Mesh(eyeGeo, eyeW);
    var eyeR = new THREE.Mesh(eyeGeo, eyeW);
    eyeL.position.set(-0.22, bodyY + 0.18, 0.7);
    eyeR.position.set(0.22, bodyY + 0.18, 0.7);
    var pupL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), pupM);
    var pupR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), pupM);
    pupL.position.set(-0.22, bodyY + 0.18, 0.78);
    pupR.position.set(0.22, bodyY + 0.18, 0.78);
    var hi = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false })
    );
    hi.position.set(-0.32, bodyY + 0.35, 0.55);

    var procParts = [skirt, footL, footR, core, shell, cheekL, cheekR, eyeL, eyeR, pupL, pupR, hi];
    var root = new THREE.Group();
    var pi;
    for (pi = 0; pi < procParts.length; pi++) root.add(procParts[pi]);
    root.position.y = 0.05;
    scene.add(root);

    // Soft contact shadow under figure (reads better with painted card)
    var contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.38;
    root.add(contactShadow);

    var artSprite = null;
    var artMap = null;
    var hasPaintedArt = false;

    function setProcVisible(on) {
      var j;
      for (j = 0; j < procParts.length; j++) {
        if (procParts[j]) procParts[j].visible = !!on;
      }
    }

    function applyPaintedArt(imageSource) {
      if (!imageSource || disposed) return false;
      var iw = imageSource.naturalWidth || imageSource.width || 0;
      var ih = imageSource.naturalHeight || imageSource.height || 0;
      if (!iw || !ih) return false;
      try {
        if (artSprite) {
          root.remove(artSprite);
          if (artSprite.material) {
            if (artSprite.material.map) artSprite.material.map.dispose();
            artSprite.material.dispose();
          }
          artSprite = null;
          artMap = null;
        }
        // Canvas (chroma cutout) or Image both work as Texture sources
        if (imageSource instanceof HTMLCanvasElement ||
            (typeof OffscreenCanvas !== 'undefined' && imageSource instanceof OffscreenCanvas)) {
          artMap = new THREE.CanvasTexture(imageSource);
        } else {
          artMap = new THREE.Texture(imageSource);
        }
        if (artMap.colorSpace !== undefined && THREE.SRGBColorSpace) {
          artMap.colorSpace = THREE.SRGBColorSpace;
        }
        artMap.needsUpdate = true;
        var sprMat = new THREE.SpriteMaterial({
          map: artMap,
          color: 0xffffff,
          transparent: true,
          alphaTest: 0.08,
          depthWrite: true,
          fog: true,
          sizeAttenuation: true
        });
        artSprite = new THREE.Sprite(sprMat);
        // Full-body combat plate proportions (taller than square badge)
        var nativeH = 2.15;
        var nativeW = nativeH * (iw / ih);
        if (nativeW > 2.05) {
          nativeW = 2.05;
          nativeH = nativeW * (ih / iw);
        }
        if (nativeH < 1.7) nativeH = 1.7;
        artSprite.scale.set(nativeW, nativeH, 1);
        if (artSprite.center) artSprite.center.set(0.5, 0);
        else {
          try { artSprite.center = new THREE.Vector2(0.5, 0); } catch (eC) { /* ignore */ }
        }
        // Stand on pedestal top (~0.37)
        artSprite.position.set(0, 0.02, 0);
        root.add(artSprite);
        hasPaintedArt = true;
        if (preferArt) setProcVisible(false);
        return true;
      } catch (eArt) {
        console.warn('[ChampShow] art impostor failed', eArt && eArt.message);
        return false;
      }
    }

    // Initial art from opts (Phaser chroma canvas / image)
    if (opts.artImage) applyPaintedArt(opts.artImage);
    else if (opts.artUrl && typeof Image !== 'undefined') {
      var bootImg = new Image();
      bootImg.crossOrigin = 'anonymous';
      bootImg.onload = function () {
        if (preferArt && global.SR_ART && global.SR_ART.magentaChromaToCanvas) {
          var keyed = global.SR_ART.magentaChromaToCanvas(bootImg, { gentle: true });
          if (keyed) applyPaintedArt(keyed);
          else applyPaintedArt(bootImg);
        } else {
          applyPaintedArt(bootImg);
        }
      };
      bootImg.src = opts.artUrl;
    }

    var yaw = -0.35;
    var idle = true;
    var clock = 0;
    var disposed = false;
    var phaserGame = opts.game || null;
    var _raf = 0;

    function applyWobble(t) {
      if (hasPaintedArt) return; // painted plate doesn't use mesh wobble
      var pos = geo.attributes.position;
      var arr = pos.array;
      var i;
      for (i = 0; i < pos.count; i++) {
        var ix = i * 3;
        var bx = base[ix];
        var by = base[ix + 1];
        var bz = base[ix + 2];
        var nlen = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
        var wave = Math.sin(t * 2 + by * 5) * 0.02 + Math.sin(t * 2.7 + bx * 4) * 0.01;
        arr[ix] = bx + (bx / nlen) * wave;
        arr[ix + 1] = by + (by / nlen) * wave * 0.85;
        arr[ix + 2] = bz + (bz / nlen) * wave;
      }
      pos.needsUpdate = true;
    }

    function blit() {
      if (!blitCtx) return;
      try {
        blitCtx.drawImage(glCanvas, 0, 0, width, height);
      } catch (e) { /* ignore */ }
      if (!phaserGame || !phaserGame.textures || !phaserGame.textures.exists(textureKey)) return;
      var tex = phaserGame.textures.get(textureKey);
      if (tex && typeof tex.refresh === 'function') {
        try { tex.refresh(); } catch (e2) {}
      } else if (tex && tex.source && tex.source[0] && typeof tex.source[0].update === 'function') {
        try { tex.source[0].update(); } catch (e3) {}
      }
    }

    function tick(dt) {
      if (disposed) return;
      dt = Math.min(0.05, dt || 0.016);
      clock += dt;
      if (idle) yaw += dt * 0.32;
      applyWobble(clock);
      root.rotation.y = yaw;
      // Grounded squash bounce (lighter for painted cards so art stays readable)
      var squashAmp = hasPaintedArt ? 0.018 : 0.035;
      var squash = Math.sin(clock * 1.55) * squashAmp;
      root.position.y = 0.05 + Math.abs(squash) * 0.12;
      root.scale.set(1 + squash * 0.35, 1 - squash * 0.45, 1 + squash * 0.35);
      if (!hasPaintedArt) shell.rotation.y = Math.sin(clock * 0.55) * 0.04;
      ring.rotation.z = clock * 0.42;
      if (ringGold) ringGold.rotation.z = -clock * 0.22;
      under.intensity = 0.5 + Math.sin(clock * 2.8) * 0.12;
      fill.intensity = 0.75 + Math.sin(clock * 1.6) * 0.1;
      // Slow camera orbit dolly (RSL preview feel)
      camera.position.x = 0.4 + Math.sin(clock * 0.22) * 0.22;
      camera.position.y = 1.65 + Math.sin(clock * 0.15) * 0.06;
      camera.position.z = 5.55 + Math.cos(clock * 0.18) * 0.12;
      camera.lookAt(0, 0.72, 0);
      // Motes drift
      var mi2;
      for (mi2 = 0; mi2 < motes.length; mi2++) {
        var m = motes[mi2];
        var ph = m.userData.phase + clock * m.userData.speed;
        m.position.y += Math.sin(ph) * 0.002;
        m.position.x += Math.cos(ph * 0.7) * 0.0015;
        if (m.material) m.material.opacity = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(ph));
      }
      // Floor glow pulse
      if (floorGlow && floorGlow.material) {
        floorGlow.material.opacity = 0.16 + 0.08 * (0.5 + 0.5 * Math.sin(clock * 2.2));
      }
      if (contactShadow && contactShadow.material) {
        contactShadow.material.opacity = hasPaintedArt
          ? (0.32 + 0.06 * (0.5 + 0.5 * Math.sin(clock * 1.8)))
          : 0.22;
      }
      renderer.render(scene, camera);
      blit();
    }

    function registerTexture(game) {
      phaserGame = game || phaserGame;
      if (!phaserGame || !phaserGame.textures) return false;
      renderer.render(scene, camera);
      blit();
      if (phaserGame.textures.exists(textureKey)) {
        try { phaserGame.textures.remove(textureKey); } catch (e) {}
      }
      phaserGame.textures.addCanvas(textureKey, blitCanvas);
      return true;
    }

    function startLoop() {
      if (_raf) cancelAnimationFrame(_raf);
      var last = performance.now();
      function loop(now) {
        if (disposed) return;
        tick((now - last) / 1000);
        last = now;
        _raf = requestAnimationFrame(loop);
      }
      _raf = requestAnimationFrame(loop);
    }

    function stopLoop() {
      if (_raf) cancelAnimationFrame(_raf);
      _raf = 0;
    }

    function addYaw(delta) {
      yaw += delta || 0;
      idle = false;
    }

    function setIdle(on) {
      idle = !!on;
    }

    function setArtImage(imageSource) {
      return applyPaintedArt(imageSource);
    }

    function dispose() {
      disposed = true;
      stopLoop();
      scene.remove(root);
      if (artSprite) {
        if (artSprite.material) {
          if (artSprite.material.map) artSprite.material.map.dispose();
          artSprite.material.dispose();
        }
        artSprite = null;
      }
      if (geo) geo.dispose();
      if (mat) mat.dispose();
      if (renderer) renderer.dispose();
      if (glCanvas && glCanvas.parentNode) {
        try { glCanvas.parentNode.removeChild(glCanvas); } catch (e) {}
      }
      if (phaserGame && phaserGame.textures && phaserGame.textures.exists(textureKey)) {
        try { phaserGame.textures.remove(textureKey); } catch (e) {}
      }
    }

    registerTexture(phaserGame);
    startLoop();

    return {
      textureKey: textureKey,
      canvas: blitCanvas,
      addYaw: addYaw,
      setIdle: setIdle,
      setArtImage: setArtImage,
      hasPaintedArt: function () { return hasPaintedArt; },
      tick: tick,
      startLoop: startLoop,
      stopLoop: stopLoop,
      registerTexture: registerTexture,
      dispose: dispose,
      isLive: true
    };
  }

  global.SR_CHAMP_SHOW = {
    available: available,
    create: create
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SR_CHAMP_SHOW;
  }
})(typeof window !== 'undefined' ? window : global);
