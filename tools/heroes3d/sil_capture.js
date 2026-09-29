// Silhouette acceptance capture: same GLB and rig as combat, every mesh drawn flat black on white.
// Evaluate in a running game page (window.THREE, SR_HERO3D, SR_STATE ready). Returns
// { pngs: { '<heroId>_fight': dataURL, '<heroId>_portrait': dataURL } } at SIZE squared.
// fight    = front camera as in battleWorld3d (FOV 32, about 22 deg elevation, hero faces camera)
// portrait = portrait_capture.js camera (FOV 20, yaw -20 deg, auto-framed)
(async function (HEROES, SIZE) {
  var T = window.THREE, H = window.SR_HERO3D, S = window.SR_STATE;
  var R = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setSize(SIZE, SIZE);
  var units = HEROES.map(function (h) {
    var el = h.split('_')[0]; el = el.charAt(0).toUpperCase() + el.slice(1);
    return S.createChampion({ element: el, rarity: 'Epic', level: 20, heroId: h });
  });
  await H.preload(units, { quality: 'high' });
  var black = new T.MeshBasicMaterial({ color: 0x000000, side: T.DoubleSide });
  var out = {};
  for (var ui = 0; ui < units.length; ui++) {
    var u = units[ui], sc = new T.Scene();
    sc.background = new T.Color(0xffffff); sc.overrideMaterial = black;
    var fig = H.makeFigure(T, u, { renderer: R, quality: 'high', eyeTier: 'mid', faceCamYaw: 0 });
    if (!fig) { out[u.heroId + '_fight'] = out[u.heroId + '_portrait'] = null; continue; }
    if (fig.contactShadow) fig.contactShadow.visible = false;
    sc.add(fig.root);
    if (fig.eyes && fig.eyes.st) { fig.eyes.st.blinkIn = 99; fig.eyes.st.blinkT = -1; fig.eyes.st.glanceIn = 99; }
    for (var k = 0; k < 40; k++) fig.heroTick(1 / 60, [fig]);
    fig.root.traverse(function (o) { if (o.isSprite || o.isPoints) o.visible = false; });
    var box = new T.Box3().setFromObject(fig.model), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3());
    var span = Math.max(sz.y, sz.x, sz.z) * 1.15;
    var el = T.MathUtils.degToRad(22), fc = new T.PerspectiveCamera(32, 1, 0.1, 200);
    var fd = span / 2 / Math.tan(T.MathUtils.degToRad(16)) * 1.05;
    fc.position.set(c.x, c.y + Math.sin(el) * fd, c.z + Math.cos(el) * fd); fc.lookAt(c.x, c.y, c.z);
    R.render(sc, fc); out[u.heroId + '_fight'] = R.domElement.toDataURL('image/png');
    var pc = new T.PerspectiveCamera(20, 1, 0.1, 100), ps = Math.max(sz.y, sz.x, sz.z) * 1.12;
    var d = ps / 2 / Math.tan(T.MathUtils.degToRad(10)), yaw = T.MathUtils.degToRad(-20);
    pc.position.set(c.x + Math.sin(yaw) * d, c.y + ps * 0.22, c.z + Math.cos(yaw) * d); pc.lookAt(c.x, c.y - ps * 0.02, c.z);
    R.render(sc, pc); out[u.heroId + '_portrait'] = R.domElement.toDataURL('image/png');
    fig.heroDispose(); sc.remove(fig.root);
  }
  R.dispose();
  return { pngs: out };
})(window.__PORTRAIT_HEROES || ['water_epic_pell', 'fire_epic_brann', 'plant_epic_comb'], window.__PORTRAIT_SIZE || 768)
