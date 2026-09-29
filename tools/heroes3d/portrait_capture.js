// In-engine hero portrait capture (MODEL FIRST): same GLB, same gel shader, same eye rig as combat.
// Evaluate in a running game page (window.THREE, SR_HERO3D, SR_STATE ready). Returns
// { pngs: { '<heroId>_<tier>': dataURL } } — 768² RGBA, transparent background.
// Transparency is recovered by rendering each pose twice (black + white background) and
// difference-matting, so refraction/transmission through the gel stays honest.
// Fixed rig: 3/4 camera (yaw -20°), warm key camera-left, cool fill, strong back rim, sky/ground hemi.
(async function (HEROES, TIERS, SIZE) {
  var T = window.THREE, H = window.SR_HERO3D, S = window.SR_STATE;
  var R = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setSize(SIZE, SIZE);
  R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
  var units = HEROES.map(function (h) {
    var el = h.split('_')[0]; el = el.charAt(0).toUpperCase() + el.slice(1);
    return S.createChampion({ element: el, rarity: 'Epic', level: 20, heroId: h });
  });
  await H.preload(units, { quality: 'high' });
  var cv = document.createElement('canvas'); cv.width = cv.height = SIZE; var cx = cv.getContext('2d');
  function grab() { cx.clearRect(0, 0, SIZE, SIZE); cx.drawImage(R.domElement, 0, 0); return cx.getImageData(0, 0, SIZE, SIZE); }
  var out = {};
  for (var ui = 0; ui < units.length; ui++) {
    for (var ti = 0; ti < TIERS.length; ti++) {
      var u = units[ui], tier = TIERS[ti];
      var sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xd8ecff, 0x6a5a40, 1.0));
      var key = new T.DirectionalLight(0xfff1dc, 1.9); key.position.set(-2.2, 3.0, 2.6); sc.add(key);
      var fill = new T.DirectionalLight(0xcfe2ff, 0.5); fill.position.set(2.6, 0.8, 2.0); sc.add(fill);
      var rim = new T.DirectionalLight(0xe6f4ff, 1.6); rim.position.set(1.4, 2.2, -3.0); sc.add(rim);
      var fig = H.makeFigure(T, u, { renderer: R, quality: 'high', eyeTier: tier, faceCamYaw: 0 });
      if (!fig) { out[u.heroId + '_' + tier] = null; continue; }
      if (fig.contactShadow) fig.contactShadow.visible = false;
      sc.add(fig.root);
      if (fig.eyes && fig.eyes.st) { fig.eyes.st.blinkIn = 99; fig.eyes.st.blinkT = -1; fig.eyes.st.glanceIn = 99; }
      for (var k = 0; k < 40; k++) fig.heroTick(1 / 60, [fig]);
      var box = new T.Box3().setFromObject(fig.model), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3());
      var cam = new T.PerspectiveCamera(20, 1, 0.1, 100), span = Math.max(sz.y, sz.x, sz.z) * 1.12;
      var d = span / 2 / Math.tan(T.MathUtils.degToRad(10)), yaw = T.MathUtils.degToRad(-20);
      cam.position.set(c.x + Math.sin(yaw) * d, c.y + span * 0.22, c.z + Math.cos(yaw) * d); cam.lookAt(c.x, c.y - span * 0.02, c.z);
      sc.background = new T.Color(0x000000); R.render(sc, cam); var B = grab();
      sc.background = new T.Color(0xffffff); R.render(sc, cam); var W = grab();
      var o = cx.createImageData(SIZE, SIZE);
      for (var i = 0; i < o.data.length; i += 4) {
        var a = 1 - ((W.data[i] - B.data[i]) + (W.data[i + 1] - B.data[i + 1]) + (W.data[i + 2] - B.data[i + 2])) / 765;
        a = Math.max(0, Math.min(1, a));
        o.data[i] = a > 0.004 ? Math.min(255, B.data[i] / a) : 0;
        o.data[i + 1] = a > 0.004 ? Math.min(255, B.data[i + 1] / a) : 0;
        o.data[i + 2] = a > 0.004 ? Math.min(255, B.data[i + 2] / a) : 0;
        o.data[i + 3] = Math.round(a * 255);
      }
      cx.putImageData(o, 0, 0); out[u.heroId + '_' + tier] = cv.toDataURL('image/png');
      fig.heroDispose(); sc.remove(fig.root);
    }
  }
  R.dispose();
  return { pngs: out };
})(window.__PORTRAIT_HEROES || ['water_epic_pell', 'fire_epic_brann', 'plant_epic_comb'], window.__PORTRAIT_TIERS || ['mid', 'top'], window.__PORTRAIT_SIZE || 768)
