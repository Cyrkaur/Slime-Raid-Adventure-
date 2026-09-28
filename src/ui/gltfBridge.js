/**
 * Phase 5 — GLTF bridge (ES module).
 *
 * IMPORTANT: Do NOT use GLTFLoader.load(url) with relative paths when this module
 * is loaded from a CDN-mapped importmap context — path resolution can flake.
 * Always: fetch(arrayBuffer from page origin) → loader.parse(buffer).
 *
 * Exposes: window.SR_loadGLB(url) → Promise<{ meshes: MeshData[] }>
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

(function () {
  var loader = new GLTFLoader();
  var cache = Object.create(null);
  var queue = Promise.resolve();

  function pageUrl(relOrAbs) {
    var raw = String(relOrAbs || '').split('?')[0].split('#')[0];
    try {
      return new URL(raw, window.location.href).href;
    } catch (e) {
      return raw;
    }
  }

  function extractMeshes(gltf) {
    var meshes = [];
    if (!gltf || !gltf.scene) return meshes;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(function (child) {
      if (!child.isMesh || !child.geometry) return;
      var geo = child.geometry;
      var posAttr = geo.attributes && geo.attributes.position;
      if (!posAttr) return;
      var pos;
      try {
        pos = typeof posAttr.toArray === 'function'
          ? Array.from(posAttr.toArray())
          : Array.from(posAttr.array);
      } catch (e1) {
        try { pos = Array.from(posAttr.array); } catch (e2) { return; }
      }
      if (!pos || pos.length < 9) return;
      var nor = null;
      if (geo.attributes.normal) {
        try {
          nor = typeof geo.attributes.normal.toArray === 'function'
            ? Array.from(geo.attributes.normal.toArray())
            : Array.from(geo.attributes.normal.array);
        } catch (eN) { nor = null; }
      }
      var idx = null;
      if (geo.index) {
        try { idx = Array.from(geo.index.array); } catch (eI) { idx = null; }
      }
      meshes.push({
        pos: pos,
        nor: nor,
        idx: idx,
        matrix: child.matrixWorld ? Array.from(child.matrixWorld.elements) : null,
        name: child.name || ''
      });
    });
    return meshes;
  }

  function parseBuffer(url, abs, buffer) {
    return new Promise(function (resolve, reject) {
      try {
        loader.parse(
          buffer,
          // resourcePath: same directory as the glb (for external bins — we use .glb so unused)
          abs.replace(/[^/]+$/, ''),
          function (gltf) {
            var meshes = extractMeshes(gltf);
            var payload = { url: url, abs: abs, meshes: meshes };
            if (!meshes.length) {
              console.warn('[GLTFBridge] parse ok but 0 meshes:', url);
            } else {
              console.log('[GLTFBridge] ok', url, 'meshes=' + meshes.length,
                'verts~' + Math.floor((meshes[0].pos.length || 0) / 3));
            }
            resolve(payload);
          },
          function (err) {
            console.warn('[GLTFBridge] parse fail', url, err && (err.message || err));
            reject(err || new Error('parse failed: ' + url));
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  function loadGLBOnce(url) {
    var abs = pageUrl(url);
    var cacheKey = abs;
    if (cache[cacheKey]) return Promise.resolve(cache[cacheKey]);
    if (cache[url]) return Promise.resolve(cache[url]);

    console.log('[GLTFBridge] fetch', abs);
    return fetch(abs, { cache: 'reload' })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status + ' for ' + abs);
        }
        return res.arrayBuffer();
      })
      .then(function (buf) {
        if (!buf || buf.byteLength < 20) {
          throw new Error('GLB too small: ' + abs + ' bytes=' + (buf && buf.byteLength));
        }
        // Quick magic check: glTF
        var mag = new Uint8Array(buf, 0, 4);
        var magicOk = mag[0] === 0x67 && mag[1] === 0x6c && mag[2] === 0x54 && mag[3] === 0x46;
        if (!magicOk) {
          throw new Error('Not a GLB (bad magic) ' + abs);
        }
        return parseBuffer(url, abs, buf);
      })
      .then(function (payload) {
        cache[cacheKey] = payload;
        cache[url] = payload;
        return payload;
      });
  }

  /** One-at-a-time queue (stable under combat preload). */
  function loadGLB(url) {
    var run = queue.then(function () {
      return loadGLBOnce(url);
    });
    queue = run.then(function () { /* keep chain */ }, function () { /* keep chain after fail */ });
    return run;
  }

  void THREE;

  if (typeof window !== 'undefined') {
    window.SR_loadGLB = loadGLB;
    window.SR_GLTF_BRIDGE = {
      loadGLB: loadGLB,
      cache: cache,
      pageUrl: pageUrl,
      clearCache: function () {
        Object.keys(cache).forEach(function (k) { delete cache[k]; });
      }
    };
    window.dispatchEvent(new Event('sr-gltf-ready'));
    console.log('[GLTFBridge] ready (fetch+parse) — assets/models/*.glb');
  }
})();
