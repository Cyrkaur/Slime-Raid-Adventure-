/* ===== Shared art pipeline — PAINTERLY FANTASY (default non-3D style) =====
 * Style bible: docs/ART_STYLE.md
 * Canonical gels: assets/battle/gels/combat/{el}_{blob|morph|shaped}_{a|b|c}.jpg
 * Magenta key cutouts. Same pack for battle, hub, roster, detail, summon.
 * Full 3D Blender meshes = V2 / opt-in only (not this pipeline’s look).
 */
(function (global) {
  'use strict';

  /**
   * Locked default for all painted / 2D / impostor art.
   * Do not introduce chibi / flat cartoon as a second default without an explicit product change.
   */
  var STYLE_ID = 'painterly-fantasy';
  var STYLE_LABEL = 'Painterly Fantasy';
  /**
   * Product presentation mode (ship default).
   * 'sprites' — combat gels + foes + hub/detail use painted plates / impostors.
   * 'glb'     — V2 / opt-in full meshes only (sr_use_gel_glb / SR_USE_GEL_GLB).
   * Do not switch the ship default without an explicit product decision.
   */
  var PRESENTATION = 'sprites';
  /** North-star reference asset (campaign map) */
  var STYLE_NORTH_STAR = 'assets/maps/greenwild.jpg';
  /** Studio chroma for cutout cards (gels, props, enemies) */
  var CHROMA_HEX = '#FF00FF';

  var ELEMENTS = [
    'water', 'fire', 'earth', 'wind', 'plant', 'lightning', 'ice', 'shadow',
    'light', 'metal', 'poison', 'crystal', 'lava', 'storm', 'spirit', 'void'
  ];

  /** Pose / silhouette variants within an element theme */
  var VARIANTS = ['a', 'b', 'c'];

  var ENV_KEYS = ['greenwild', 'crystal', 'shadowfen', 'volcanic', 'celestial', 'dungeon'];

  /**
   * Bump when replacing JPGs so browser/THREE caches don't serve old ground/trees/foes.
   * Also append on BootScene load URLs.
   */
  var ART_CACHE_VER = '20260825ab';

  /**
   * Form complexity lore (painterly combat sprites):
   * blob   — soft gel mass, maybe stubby nubs (Common–Uncommon, most Rare)
   * morph  — clear blob-arm tentacles, still mostly blobby (Epic / ~1/3 Rare)
   * shaped — deliberate elemental silhouette, still a slime not a humanoid
   *          (Legendary / Mythic; highest form control — may show thicker arms/crests)
   */
  var FORMS = ['blob', 'morph', 'shaped'];

  function assetUrl(path) {
    if (!path) return path;
    var p = String(path);
    if (p.indexOf('data:') === 0 || p.indexOf('blob:') === 0) return p;
    // Idempotent — don't stack ?srv=
    if (p.indexOf('srv=') >= 0) return p;
    return p + (p.indexOf('?') >= 0 ? '&' : '?') + 'srv=' + ART_CACHE_VER;
  }

  function elKey(el) {
    return String(el || 'water').toLowerCase();
  }

  function variantKey(v) {
    var s = String(v || 'a').toLowerCase();
    if (VARIANTS.indexOf(s) >= 0) return s;
    var n = parseInt(s, 10);
    if (!isNaN(n)) return VARIANTS[((n % 3) + 3) % 3];
    return 'a';
  }

  /** Stable hash → 0..mod-1 */
  function hashMod(str, mod) {
    var h = 2166136261;
    var s = String(str || '0');
    var i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % (mod || 3));
  }

  /**
   * Lore form control: rarer gels hold more complex shapes.
   */
  function gelFormForUnit(unit) {
    if (!unit) return 'blob';
    if (unit.artForm && FORMS.indexOf(String(unit.artForm).toLowerCase()) >= 0) {
      return String(unit.artForm).toLowerCase();
    }
    var rar = String(unit.rarity || 'Common');
    var tier = String(unit.formTier || '');
    var seed = unit.id != null ? unit.id : (unit.name || unit.element || '0');
    if (tier === 'humanoid' || rar === 'Mythic') return 'shaped';
    if (tier === 'ascended' || rar === 'Legendary') return 'shaped';
    if (tier === 'morph' || rar === 'Epic') return 'morph';
    // Some Rare have started to form arms (1 in 3)
    if (rar === 'Rare' && hashMod(seed, 3) === 0) return 'morph';
    return 'blob';
  }

  /**
   * Pick variant letter for a champion unit.
   * Uses unit.artVariant if set; else stable hash of id/name.
   */
  function artVariantForUnit(unit) {
    if (!unit) return 'a';
    if (unit.artVariant != null && unit.artVariant !== '') {
      return variantKey(unit.artVariant);
    }
    var seed = unit.id != null ? unit.id
      : ((unit.name || '') + '|' + (unit.element || '') + '|' + (unit.rarity || ''));
    var idx = hashMod(seed, 3);
    var rar = String(unit.rarity || 'Common');
    if ((rar === 'Legendary' || rar === 'Mythic') && idx === 0) idx = 2;
    if (rar === 'Epic' && idx === 0) idx = 1;
    return VARIANTS[idx];
  }

  /**
   * Combat gel paths — painterly fantasy style.
   * Prefer form-specific art, then pose variant, then generic.
   * Files:
   *   {el}_{form}_{v}.jpg   e.g. water_blob_a, fire_shaped_b
   *   {el}_{v}.jpg          legacy pose pack
   *   {el}_shaped.jpg / {el}_morph.jpg  single-form fallbacks
   */
  function combatGelPath(element, variant, form) {
    var el = elKey(element);
    var v = variantKey(variant);
    var f = form || 'blob';
    return assetUrl('assets/battle/gels/combat/' + el + '_' + f + '_' + v + '.jpg');
  }

  /**
   * Purple-star / evolution level for art selection (0 = base idle).
   * Matches gameState purpleStars (aliased as evolutionLevel).
   */
  function gelEvoLevel(unit) {
    if (!unit) return 0;
    var n = unit.purpleStars != null ? unit.purpleStars : unit.evolutionLevel;
    n = Math.floor(Number(n) || 0);
    if (n < 0) n = 0;
    if (n > 6) n = 6;
    return n;
  }

  /**
   * Evolution plate path: {el}_{form}_{v}_evo{N}.jpg
   * e.g. water_blob_a_evo1.jpg — first awaken visual.
   */
  function combatGelEvoPath(element, variant, form, evo) {
    var el = elKey(element);
    var v = variantKey(variant);
    var f = form || 'blob';
    var e = Math.max(1, Math.floor(Number(evo) || 1));
    return assetUrl('assets/battle/gels/combat/' + el + '_' + f + '_' + v + '_evo' + e + '.jpg');
  }

  /**
   * Attack-pose plate path (single strong strike pose for combat windup/lunge).
   * Stem: {el}_{form}_{v}_attack.jpg  e.g. water_blob_a_attack.jpg
   */
  function combatGelAttackPath(element, variant, form) {
    var el = elKey(element);
    var v = variantKey(variant);
    var f = form || 'blob';
    return assetUrl('assets/battle/gels/combat/' + el + '_' + f + '_' + v + '_attack.jpg');
  }

  /**
   * Idle combat gel candidates.
   * @param {string} element
   * @param {string} [variant]
   * @param {string} [form]
   * @param {object|number} [unitOrEvo] unit (for evo level) or number evo
   */
  function combatGelPathCandidates(element, variant, form, unitOrEvo) {
    var el = elKey(element);
    var v = variantKey(variant);
    var f = form || 'blob';
    var evo = 0;
    if (typeof unitOrEvo === 'number') evo = Math.max(0, Math.floor(unitOrEvo));
    else if (unitOrEvo && typeof unitOrEvo === 'object') evo = gelEvoLevel(unitOrEvo);
    var list = [];
    var seen = {};
    function add(p) {
      var u = assetUrl(p);
      if (seen[u]) return;
      seen[u] = true;
      list.push(u);
    }
    // Evolution plates first (highest evo down to evo1), then base idle
    var e;
    for (e = evo; e >= 1; e--) {
      add('assets/battle/gels/combat/' + el + '_' + f + '_' + v + '_evo' + e + '.jpg');
      if (v !== 'a') add('assets/battle/gels/combat/' + el + '_' + f + '_a_evo' + e + '.jpg');
      add('assets/battle/gels/combat/' + el + '_' + f + '_evo' + e + '.jpg');
      if (f === 'shaped') {
        add('assets/battle/gels/combat/' + el + '_morph_a_evo' + e + '.jpg');
        add('assets/battle/gels/combat/' + el + '_morph_evo' + e + '.jpg');
      }
      if (f === 'shaped' || f === 'morph') {
        add('assets/battle/gels/combat/' + el + '_blob_a_evo' + e + '.jpg');
        add('assets/battle/gels/combat/' + el + '_blob_evo' + e + '.jpg');
      }
      add('assets/battle/gels/combat/' + el + '_a_evo' + e + '.jpg');
      add('assets/battle/gels/combat/' + el + '_evo' + e + '.jpg');
    }
    // Prefer _a first — most complete pack. Variant b/c often 404 and used to
    // leave an empty sprite while the procedural mesh was already hidden.
    add('assets/battle/gels/combat/' + el + '_' + f + '_a.jpg');
    if (v !== 'a') add('assets/battle/gels/combat/' + el + '_' + f + '_' + v + '.jpg');
    add('assets/battle/gels/combat/' + el + '_' + f + '.jpg');
    // Fall down form ladder: shaped → morph → blob
    if (f === 'shaped') {
      add('assets/battle/gels/combat/' + el + '_morph_a.jpg');
      if (v !== 'a') add('assets/battle/gels/combat/' + el + '_morph_' + v + '.jpg');
      add('assets/battle/gels/combat/' + el + '_morph.jpg');
    }
    if (f === 'shaped' || f === 'morph') {
      add('assets/battle/gels/combat/' + el + '_blob_a.jpg');
      if (v !== 'a') add('assets/battle/gels/combat/' + el + '_blob_' + v + '.jpg');
    }
    // Legacy a/b/c pack (painterly blobs)
    add('assets/battle/gels/combat/' + el + '_a.jpg');
    if (v !== 'a') add('assets/battle/gels/combat/' + el + '_' + v + '.jpg');
    add('assets/battle/gels/combat/' + el + '.jpg');
    return list;
  }

  /**
   * Attack-pose candidates for a unit identity, then fall down to idle plates.
   * Safe when attack art is missing — last candidates are idle combat paths.
   * Prefer: evo attack (if evolved) → form+variant attack → form attack → element attack → idle ladder.
   * @param {object|number} [unitOrEvo]
   */
  function combatGelAttackPathCandidates(element, variant, form, unitOrEvo) {
    var el = elKey(element);
    var v = variantKey(variant);
    var f = form || 'blob';
    var evo = 0;
    if (typeof unitOrEvo === 'number') evo = Math.max(0, Math.floor(unitOrEvo));
    else if (unitOrEvo && typeof unitOrEvo === 'object') evo = gelEvoLevel(unitOrEvo);
    var list = [];
    var seen = {};
    function add(p) {
      var u = assetUrl(p);
      if (seen[u]) return;
      seen[u] = true;
      list.push(u);
    }
    var e;
    for (e = evo; e >= 1; e--) {
      add('assets/battle/gels/combat/' + el + '_' + f + '_' + v + '_evo' + e + '_attack.jpg');
      add('assets/battle/gels/combat/' + el + '_' + f + '_a_evo' + e + '_attack.jpg');
      add('assets/battle/gels/combat/' + el + '_blob_a_evo' + e + '_attack.jpg');
      add('assets/battle/gels/combat/' + el + '_evo' + e + '_attack.jpg');
    }
    // Exact attack pose for this form/variant
    add('assets/battle/gels/combat/' + el + '_' + f + '_' + v + '_attack.jpg');
    if (v !== 'a') add('assets/battle/gels/combat/' + el + '_' + f + '_a_attack.jpg');
    add('assets/battle/gels/combat/' + el + '_' + f + '_attack.jpg');
    // Form ladder attack
    if (f === 'shaped') {
      add('assets/battle/gels/combat/' + el + '_morph_a_attack.jpg');
      add('assets/battle/gels/combat/' + el + '_morph_attack.jpg');
    }
    if (f === 'shaped' || f === 'morph') {
      add('assets/battle/gels/combat/' + el + '_blob_a_attack.jpg');
      add('assets/battle/gels/combat/' + el + '_blob_attack.jpg');
    }
    // Short element attack stem
    add('assets/battle/gels/combat/' + el + '_a_attack.jpg');
    add('assets/battle/gels/combat/' + el + '_attack.jpg');
    // Fallback: evo idle then base idle
    if (evo >= 1) {
      add('assets/battle/gels/combat/' + el + '_' + f + '_' + v + '_evo' + evo + '.jpg');
      add('assets/battle/gels/combat/' + el + '_' + f + '_a_evo' + evo + '.jpg');
      add('assets/battle/gels/combat/' + el + '_blob_a_evo' + evo + '.jpg');
      add('assets/battle/gels/combat/' + el + '_evo' + evo + '.jpg');
    }
    add('assets/battle/gels/combat/' + el + '_' + f + '_a.jpg');
    if (v !== 'a') add('assets/battle/gels/combat/' + el + '_' + f + '_' + v + '.jpg');
    add('assets/battle/gels/combat/' + el + '_' + f + '.jpg');
    if (f === 'shaped') {
      add('assets/battle/gels/combat/' + el + '_morph_a.jpg');
      add('assets/battle/gels/combat/' + el + '_morph.jpg');
    }
    if (f === 'shaped' || f === 'morph') {
      add('assets/battle/gels/combat/' + el + '_blob_a.jpg');
    }
    add('assets/battle/gels/combat/' + el + '_a.jpg');
    add('assets/battle/gels/combat/' + el + '.jpg');
    return list;
  }

  /**
   * Resolve idle plate for a unit with evo awareness.
   * @param {object} unit
   * @param {function(string):boolean} [existsFn]
   */
  function resolveGelIdleArt(unit, existsFn) {
    unit = unit || {};
    var el = unit.element || 'water';
    var v = artVariantForUnit(unit);
    var f = gelFormForUnit(unit);
    var evo = gelEvoLevel(unit);
    var cands = combatGelPathCandidates(el, v, f, evo);
    var i;
    function stripQ(u) { return String(u || '').replace(/\?.*$/, ''); }
    function isEvoStem(u) { return /_evo\d+/i.test(stripQ(u)); }
    var url = null;
    if (typeof existsFn === 'function') {
      for (i = 0; i < cands.length; i++) {
        if (existsFn(stripQ(cands[i]))) { url = cands[i]; break; }
      }
    } else {
      url = cands[0] || null;
    }
    return {
      url: url,
      candidates: cands,
      evoLevel: evo,
      usedEvoArt: !!(url && isEvoStem(url)),
      element: elKey(el),
      form: f,
      variant: variantKey(v)
    };
  }

  /**
   * Pure helper: first attack candidate that exists on disk (Node) or prefer first attack stem.
   * Browser combat uses loadChromaCandidates on the full list.
   * @param {object} unit { element, artVariant, rarity, artForm }
   * @param {function(string):boolean} [existsFn] optional path existence check (relative to project)
   * @returns {{ attackUrl: string|null, idleUrl: string|null, candidates: string[], usedFallback: boolean }}
   */
  function resolveGelAttackArt(unit, existsFn) {
    unit = unit || {};
    var el = unit.element || 'water';
    var v = (typeof artVariantForUnit === 'function')
      ? artVariantForUnit(unit)
      : (unit.artVariant || 'a');
    var f = (typeof gelFormForUnit === 'function')
      ? gelFormForUnit(unit)
      : (unit.artForm || 'blob');
    var evo = gelEvoLevel(unit);
    var attackCands = combatGelAttackPathCandidates(el, v, f, evo);
    var idleCands = combatGelPathCandidates(el, v, f, evo);
    var attackUrl = null;
    var idleUrl = null;
    var i;
    function stripQ(u) {
      return String(u || '').replace(/\?.*$/, '');
    }
    function isAttackStem(u) {
      return /_attack\.jpg/i.test(stripQ(u));
    }
    if (typeof existsFn === 'function') {
      for (i = 0; i < attackCands.length; i++) {
        var rel = stripQ(attackCands[i]);
        if (existsFn(rel) && isAttackStem(rel)) {
          attackUrl = attackCands[i];
          break;
        }
      }
      for (i = 0; i < idleCands.length; i++) {
        if (existsFn(stripQ(idleCands[i]))) {
          idleUrl = idleCands[i];
          break;
        }
      }
    } else {
      // Prefer first attack stem as canonical intent; idle is first idle candidate
      for (i = 0; i < attackCands.length; i++) {
        if (isAttackStem(attackCands[i])) {
          attackUrl = attackCands[i];
          break;
        }
      }
      idleUrl = idleCands[0] || null;
    }
    var usedFallback = !attackUrl;
    if (!attackUrl && idleUrl) attackUrl = idleUrl;
    return {
      attackUrl: attackUrl,
      idleUrl: idleUrl,
      candidates: attackCands,
      idleCandidates: idleCands,
      usedFallback: usedFallback,
      element: elKey(el),
      form: f,
      variant: variantKey(v)
    };
  }

  /** Phaser texture key for a gel (after boot chroma register). */
  function phaserGelKey(element, variant, form) {
    var el = elKey(element);
    var v = variantKey(variant);
    var f = form || 'blob';
    if (f !== 'blob') return 'slime_' + el + '_' + f + (v === 'a' ? '' : '_' + v);
    if (v === 'a') return 'slime_' + el;
    return 'slime_' + el + '_' + v;
  }

  function phaserGelKeyCandidates(element, variant, form) {
    var el = elKey(element);
    var v = variantKey(variant);
    var f = form || gelFormForUnit({ element: el, artVariant: v });
    var keys = [];
    function add(k) { if (keys.indexOf(k) < 0) keys.push(k); }
    if (f === 'shaped') {
      add('slime_' + el + '_shaped' + (v !== 'a' ? '_' + v : ''));
      add('slime_' + el + '_shaped');
      add('slime_' + el + '_morph');
    }
    if (f === 'morph' || f === 'shaped') {
      add('slime_' + el + '_morph' + (v !== 'a' ? '_' + v : ''));
      add('slime_' + el + '_morph');
    }
    if (v === 'a') add('slime_' + el);
    else add('slime_' + el + '_' + v);
    add('slime_' + el + '_a');
    add('slime_' + el);
    add('slime_legacy_' + el);
    return keys;
  }

  function rosterGelPath(element) {
    return 'assets/slimes/' + elKey(element) + '.jpg';
  }

  function enemyPath(kind) {
    return assetUrl('assets/battle/enemies/' + String(kind || 'beast').toLowerCase() + '.jpg');
  }

  function envPropPath(zone) {
    return assetUrl('assets/battle/env/' + String(zone || 'greenwild').toLowerCase() + '/prop.jpg');
  }

  /**
   * Prop filename stems for a forest monostand palette.
   * Natural forests: one dominant foliage family per battle (green OR blue),
   * silhouette variety within that family — not a random green/blue mix.
   * Greenwild ships prop_green* + prop_blue* (+ legacy prop* = blue family).
   * Other zones only have prop* — monostand is still "one pack," just shared cards.
   */
  function forestPropStems(palette, zone) {
    var p = String(palette || '').toLowerCase();
    var z = String(zone || '').toLowerCase();
    var hasMonoPack = !z || z === 'greenwild';
    if (p === 'green' && hasMonoPack) {
      return ['prop_green', 'prop_green_b', 'prop_green_c', 'prop_green_d', 'prop_green_e'];
    }
    if (p === 'blue' && hasMonoPack) {
      // Blue pack + legacy prop.jpg…e (same blue family on greenwild)
      return ['prop_blue', 'prop_blue_b', 'prop_blue_c', 'prop_blue_d', 'prop_blue_e'];
    }
    // Unspecified or non-greenwild kit: single legacy family only
    return ['prop', 'prop_b', 'prop_c', 'prop_d', 'prop_e'];
  }

  /**
   * @param {string} zone env kit folder
   * @param {object} [opts]
   * @param {'green'|'blue'|null} [opts.forestPalette] monostand foliage family
   */
  function envUrls(zone, opts) {
    opts = opts || {};
    var z = String(zone || 'greenwild').toLowerCase();
    var base = 'assets/battle/env/' + z + '/';
    var palette = opts.forestPalette || opts.palette || null;
    var stems = forestPropStems(palette, z);
    var propList = [];
    var si;
    for (si = 0; si < stems.length; si++) {
      propList.push(assetUrl(base + stems[si] + '.jpg'));
    }
    return {
      ground: assetUrl(base + 'ground.jpg'),
      sky: assetUrl(base + 'sky.jpg'),
      prop: propList[0],
      props: propList,
      forestPalette: palette || null
    };
  }

  /**
   * Studio hot-pink / magenta key → canvas with alpha (O(n), boot-safe).
   * Does NOT key cyan/blue/green gel bodies.
   *
   * Combat JPGs use ~#E61AA0 studio. We flood-fill from the border using a
   * single average key colour (not per-pixel sample loops — that hung boot).
   * UI textures are processed at ≤512px for speed.
   *
   * @param {HTMLImageElement|CanvasImageSource} image
   * @param {object} [opts]
   * @param {boolean} [opts.enemySafe] — protect bandit skin / cream armor
   *   (matches arena enemyKey3 body rules; pre-battle + hub enemy plates)
   */
  function magentaChromaToCanvas(image, opts) {
    opts = opts || {};
    var enemySafe = !!(opts.enemySafe || opts.enemyKey);
    // Gentle: hub / champion-detail portraits — keep translucent gel body;
    // combat keeps aggressive fringe kill so arena never shows magenta bars.
    var gentle = !!(opts.gentle || opts.uiSafe || opts.detailSafe);
    if (!image) return null;
    var srcW = image.naturalWidth || image.width;
    var srcH = image.naturalHeight || image.height;
    if (!srcW || !srcH) return null;

    // Cap work for boot: combat 512²; gentle UI can go a bit higher for detail stage
    var maxDim = gentle ? 768 : 512;
    var scale = 1;
    if (srcW > maxDim || srcH > maxDim) {
      scale = maxDim / Math.max(srcW, srcH);
    }
    var w = Math.max(1, Math.round(srcW * scale));
    var h = Math.max(1, Math.round(srcH * scale));

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, w, h);
    var imgData;
    try {
      imgData = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      return null;
    }
    var d = imgData.data;
    var n = w * h;
    var i;
    var p;
    var x;
    var y;

    // Average corner key colour (few samples only)
    var kr = 0;
    var kg = 0;
    var kb = 0;
    var kc = 0;
    function acc(sx, sy) {
      var ii = (sy * w + sx) * 4;
      var rr = d[ii];
      var gg = d[ii + 1];
      var bb = d[ii + 2];
      // Only count pink-ish corner pixels as key
      if (rr > 120 && bb > 80 && gg < 140 && (rr - gg) > 20) {
        kr += rr; kg += gg; kb += bb; kc++;
      }
    }
    var m = Math.max(2, (Math.min(w, h) * 0.05) | 0);
    for (y = 0; y < m; y += 2) {
      for (x = 0; x < m; x += 2) {
        acc(x, y);
        acc(w - 1 - x, y);
        acc(x, h - 1 - y);
        acc(w - 1 - x, h - 1 - y);
      }
    }
    if (kc < 1) {
      kr = 230; kg = 20; kb = 160; // fallback studio pink
    } else {
      kr /= kc; kg /= kc; kb /= kc;
    }

    var aff = new Float32Array(n);
    for (i = 0; i < n; i++) {
      p = i * 4;
      var r = d[p];
      var g = d[p + 1];
      var b = d[p + 2];
      var mag = 0;
      var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      var sat = Math.max(r, g, b) - Math.min(r, g, b);
      var spill0 = Math.min(r, b) - g;
      var pinkBias = (r > g + 12 && b > g + 10) ? Math.min(r - g, b - g) : 0;
      var gMinusB = g - b;

      // ——— Enemy body protections (bandit face, leather, cream armor) ———
      // Same spirit as battleWorld3d enemyKey3: skin is warm mid-sat, NOT studio pink.
      if (enemySafe) {
        if (lum > 40 && lum < 200 && sat < 95 &&
            r > 70 && g > 50 && b > 40 && Math.abs(r - g) < 75 &&
            // Not hot studio magenta (G very low relative to R+B)
            !(r > 160 && b > 140 && g < 100 && (r - g) > 55 && (b - g) > 40)) {
          aff[i] = 0;
          continue;
        }
        // Cream armor / metal highlights
        if (lum > 160 && lum < 235 && sat < 55 && g > 140) {
          aff[i] = 0;
          continue;
        }
        // Warm leather / wood browns (low B, moderate sat — not magenta)
        if (r > 90 && g > 55 && b < 110 && (r - b) > 25 && sat < 110 &&
            pinkBias < 20 && g > b * 0.85) {
          aff[i] = 0;
          continue;
        }
      }

      // ——— Gel body protections (before studio pink scoring) ———
      // Prism / crystal / spirit lavender: R+B both high WITH real green volume.
      // Studio hot pink has g very low (~0–40); painted prism bodies keep g ≳ 50–80.
      // Without this, crystal gels go partially transparent in hub / champion detail.
      var isPrismBody = !enemySafe && lum > 48 && lum < 225 && sat > 28 &&
        r > 75 && b > 75 && g >= 50 && Math.abs(r - b) < 95 &&
        g > Math.min(r, b) * 0.22 &&
        // Not pure studio #FF00xx (g collapsed)
        !(g < 55 && r > 190 && b > 140 && (r - g) > 100);
      if (isPrismBody) {
        aff[i] = 0;
        continue;
      }

      // Protect purple/crystal/spirit bodies (B dominates) and cyan gels
      if (b > r + 12 && g > 35) mag = 0;
      else if (b > g + 15 && b > r + 20 && g > 50) mag = 0;
      else if (r > 90 && b > 80) {
        var gRel = g / Math.max(1, Math.min(r, b));
        // Stricter studio pink only — require g clearly collapsed
        if (gRel < 0.55 && g < 95 && (r - g) > 55 && (b - g) > 45) {
          mag = Math.min(1, ((r + b) * 0.5 - g * 1.5) / 130);
          if (r > 200 && b > 160 && g < 90) mag = Math.max(mag, 0.95);
          if (r > 180 && b > 140 && g < 70 && (r - g) > 90) mag = Math.max(mag, 0.97);
        }
        // Soft fringe only when very pink AND low green (not crystal lavender)
        if (spill0 > 45 && r > 170 && b > 150 && g < 85 && b <= r + 15) {
          mag = Math.max(mag, Math.min(0.8, spill0 / 100));
        }
      }
      // Dirty white pink fringe — combat is hungrier; gentle only true studio fringe
      if (!gentle) {
        if (lum > 130 && pinkBias > 12 && r > 145 && b > 120 && g < 160) {
          mag = Math.max(mag, Math.min(0.94, pinkBias / 42));
        }
        if (lum > 150 && pinkBias > 16 && r > 160 && b > 135 && g < 170) {
          mag = Math.max(mag, Math.min(0.95, pinkBias / 48));
        }
        // Soft cream glow into studio pink (light plates)
        if (lum > 155 && r > 160 && b > 130 && g > 100 && g < 200 &&
            (r - g) > 10 && (b - g) > 6 && sat > 16) {
          mag = Math.max(mag, Math.min(0.92, 0.42 + pinkBias / 40));
        }
      } else {
        // UI/detail: only kill obvious hot-pink halo, not translucent gel flesh
        if (lum > 145 && pinkBias > 28 && r > 175 && b > 155 && g < 120 &&
            (r - g) > 55 && (b - g) > 40) {
          mag = Math.max(mag, Math.min(0.9, pinkBias / 55));
        }
      }

      // Salmon / warm-magenta fringe — combat only (eats detail-stage gel volume)
      var purpleLean = (b > r - 10 && b > g + 15 && g > 40);
      if (!enemySafe && !purpleLean && !gentle) {
        if (r > 165 && b > 75 && (r - g) > 32 && gMinusB < 48 && b > 70) {
          // Not pure lightning yellow (those keep g-b > ~50 and b < 90)
          if (!(b < 85 && gMinusB > 40 && g > 100)) {
            var salmon = Math.min(1, 0.5 + (r - g) / 85 + Math.max(0, 40 - gMinusB) / 65);
            mag = Math.max(mag, salmon);
          }
        }
        // Red-pink rim even when B ≈ G (common AA on yellow bolts / gold)
        if (r > 175 && g > 90 && g < 165 && b > 80 && b < 175 &&
            (r - g) > 40 && Math.abs(g - b) < 40) {
          mag = Math.max(mag, 0.78);
        }
        // Hot salmon: very high R, mid G, mid B
        if (r > 195 && g > 80 && g < 155 && b > 85 && b < 185 && (r - Math.max(g, b)) > 35) {
          mag = Math.max(mag, 0.88);
        }
        // Soft gold-to-pink AA (light/gold gels)
        if (r > 170 && g > 110 && b > 95 && b < 160 && gMinusB < 35 &&
            (r - g) > 25 && spill0 > 8) {
          mag = Math.max(mag, 0.65);
        }
      }

      // Enemy aggressive: pink/purple mud scores as key (wolf may lose mud drips)
      if (enemySafe) {
        if (r > 155 && b > 100 && g < 115 && (r - g) > 40 && (b - g) > 25 &&
            spill0 > 22) {
          mag = Math.max(mag, Math.min(0.94, 0.55 + spill0 / 80));
        }
        if (r > 190 && b > 120 && g < 85 && (r - g) > 80) {
          mag = Math.max(mag, 0.97);
        }
      }

      // Distance to average key — skip when body is prism/lavender (would false-hit)
      if (!purpleLean || g < 55) {
        var dr = r - kr;
        var dg = g - kg;
        var db = b - kb;
        var dist2 = dr * dr + dg * dg + db * db;
        if (gentle) {
          // UI/detail: only score as key when pixel is truly studio-pink AND near key
          // (translucent gel flesh often sits near magenta in RGB without being chroma)
          if (g < 105 && pinkBias > 22 && (r - g) > 45 && (b - g) > 30) {
            if (dist2 < 34 * 34) mag = Math.max(mag, 1 - Math.sqrt(dist2) / 34);
            else if (dist2 < 58 * 58) mag = Math.max(mag, 0.35 * (1 - (Math.sqrt(dist2) - 34) / 24));
          }
        } else {
          if (dist2 < 48 * 48) mag = Math.max(mag, 1 - Math.sqrt(dist2) / 48);
          else if (dist2 < 90 * 90) mag = Math.max(mag, 0.5 * (1 - (Math.sqrt(dist2) - 48) / 42));
        }
      }
      // Gentle body guard: keep mid-tone gel volume (crystal / shadow / pink gels)
      if (gentle && lum > 45 && lum < 210 && g > 55 && sat > 18 && pinkBias < 40 &&
          !(r > 185 && b > 160 && g < 95 && (r - g) > 70)) {
        mag = Math.min(mag, 0.22);
      }

      // Protect warm fire/lava (low B — not salmon fringe)
      if (r > 140 && g > 50 && b < 85 && (r - b) > 65 && pinkBias < 18 && gMinusB > 30) {
        mag = Math.min(mag, 0.08);
      }
      // Protect pure lightning / gold yellow body (high R+G, distinctly low B)
      if (r > 150 && g > 100 && b < 90 && (g - b) > 45 && (r - b) > 55 && pinkBias < 8) {
        mag = Math.min(mag, 0.05);
      }
      // Protect gold body only when B stays well below G (not salmon)
      if (r > 150 && g > 105 && b < 95 && (r - b) > 50 && (g - b) > 40 &&
          pinkBias < 8 && spill0 < 6) {
        mag = Math.min(mag, 0.05);
      }
      // Protect CLEAN white/silver only
      if (lum > 185 && sat < 34 && Math.abs(r - g) < 16 && Math.abs(g - b) < 16 &&
          Math.abs(r - b) < 22 && pinkBias < 6 && spill0 < 5 &&
          r > 170 && g > 170 && b > 165) {
        mag = Math.min(mag, 0.06);
      }
      // Vivid non-pink body
      if (sat > 70 && lum > 50 && lum < 210 && mag < 0.3 && pinkBias < 14 &&
          (g - b) > 25) {
        mag = Math.min(mag, 0.1);
      }

      // Re-assert prism / lavender gel body after all scoring
      if (!enemySafe && lum > 48 && lum < 225 && g >= 52 && r > 80 && b > 80 &&
          Math.abs(r - b) < 90 && g > Math.min(r, b) * 0.24 &&
          !(g < 60 && r > 200 && (r - g) > 110)) {
        mag = 0;
      }

      // Final enemy re-assert: never key protected skin after key-distance score
      if (enemySafe && mag > 0 && lum > 45 && lum < 195 && sat < 90 &&
          r > 75 && g > 55 && b > 45 && Math.abs(r - g) < 70 &&
          !(r > 170 && b > 150 && g < 95 && (r - g) > 60)) {
        mag = 0;
      }

      aff[i] = mag;
    }

    // Flood-fill from border (combat hungrier; gentle UI keeps more body)
    var isKey = new Uint8Array(n);
    var queue = new Int32Array(n);
    var qh = 0;
    var qt = 0;
    var seedTh = gentle ? 0.34 : 0.22;
    var expandTh = gentle ? 0.26 : 0.16;
    var softTh = gentle ? 0.16 : 0.08;
    function trySeed(sx, sy) {
      i = sy * w + sx;
      if (isKey[i]) return;
      if (aff[i] >= seedTh) {
        isKey[i] = 1;
        queue[qt++] = i;
      }
    }
    for (x = 0; x < w; x++) {
      trySeed(x, 0);
      trySeed(x, h - 1);
    }
    for (y = 0; y < h; y++) {
      trySeed(0, y);
      trySeed(w - 1, y);
    }
    while (qh < qt) {
      i = queue[qh++];
      var cx = i % w;
      var cy = (i / w) | 0;
      var nb;
      for (nb = 0; nb < 4; nb++) {
        var nx = cx + (nb === 0 ? 1 : nb === 1 ? -1 : 0);
        var ny = cy + (nb === 2 ? 1 : nb === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var ni = ny * w + nx;
        if (isKey[ni]) continue;
        if (aff[ni] >= expandTh) {
          isKey[ni] = 1;
          queue[qt++] = ni;
        } else if (aff[ni] >= softTh) {
          isKey[ni] = 2;
        }
      }
    }

    // Dilate hard key + aggressively into pink-tinted bright fringe (white effects)
    // Enemies / gentle UI: one lighter expand pass only — don't eat into body midtones
    var dil = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      if (isKey[i] === 1) dil[i] = 1;
      else if (isKey[i] === 2) dil[i] = 2;
      if (aff[i] >= (gentle ? 0.88 : 0.78)) dil[i] = 1;
      else if (aff[i] >= (gentle ? 0.58 : 0.45) && !dil[i]) dil[i] = 2;
    }
    // Two rounds of neighbor expand — kills magenta halo around white glints
    // (enemies / gentle UI: single gentler round)
    var round;
    var dilRounds = (enemySafe || gentle) ? 1 : 2;
    for (round = 0; round < dilRounds; round++) {
      var dil2 = new Uint8Array(dil);
      for (i = 0; i < n; i++) {
        if (dil[i] !== 1) continue;
        cx = i % w;
        cy = (i / w) | 0;
        for (nb = 0; nb < 4; nb++) {
          nx = cx + (nb === 0 ? 1 : nb === 1 ? -1 : 0);
          ny = cy + (nb === 2 ? 1 : nb === 3 ? -1 : 0);
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          ni = ny * w + nx;
          if (dil2[ni] === 1) continue;
          p = ni * 4;
          var rn = d[p];
          var gn = d[p + 1];
          var bn = d[p + 2];
          var ln = 0.2126 * rn + 0.7152 * gn + 0.0722 * bn;
          var pb = (rn > gn + 10 && bn > gn + 8) ? Math.min(rn - gn, bn - gn) : 0;
          var sp = Math.min(rn, bn) - gn;
          // Expand into pink / dirty-white fringe (gentle = studio pink only)
          var gmb = gn - bn;
          var salmonN = !enemySafe && !gentle && (rn > 165 && bn > 75 && (rn - gn) > 32 && gmb < 48 && bn > 70 &&
            !(bn < 85 && gmb > 40));
          // Enemy / gentle: only expand into true studio pink affinity
          if (enemySafe || gentle) {
            if (aff[ni] >= (gentle ? 0.36 : 0.28) ||
                (pb > (gentle ? 30 : 22) && rn > 175 && bn > 155 && gn < 95 &&
                 (rn - gn) > 55 && (bn - gn) > 40)) {
              dil2[ni] = 1;
            } else if (aff[ni] >= (gentle ? 0.2 : 0.12)) {
              if (!dil2[ni]) dil2[ni] = 2;
            }
          } else if (aff[ni] >= 0.1 || pb > 12 || salmonN ||
              (ln > 145 && sp > 10 && rn > 150 && bn > 130)) {
            dil2[ni] = 1;
          } else if (aff[ni] >= 0.05 || pb > 8 || (rn > 180 && (rn - gn) > 40 && gmb < 40)) {
            if (!dil2[ni]) dil2[ni] = 2;
          }
        }
      }
      dil = dil2;
    }

    // Write alpha + despill (gentler on enemy bodies)
    for (i = 0; i < n; i++) {
      p = i * 4;
      var r2 = d[p];
      var g2 = d[p + 1];
      var b2 = d[p + 2];
      var srcA = d[p + 3] / 255;
      var aOut = 1;
      if (dil[i] === 1) aOut = 0;
      else if (dil[i] === 2) aOut = Math.max(0, 0.1 * (1 - aff[i]));
      else if (aff[i] > 0.65) aOut = 0;
      else if (aff[i] > 0.22) aOut = Math.max(0, 1 - (aff[i] - 0.12) / 0.55);
      aOut *= srcA;

      if (aOut < 0.04) {
        d[p] = d[p + 1] = d[p + 2] = 0;
        d[p + 3] = 0;
        continue;
      }

      var spill = Math.max(0, Math.min(r2, b2) - g2);
      var pinkB = (r2 > g2 + 12 && b2 > g2 + 10) ? Math.min(r2 - g2, b2 - g2) : 0;
      var lum2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
      var isDirtyWhite = (lum2 > 145 && pinkB > 12 && r2 > 150 && b2 > 130);
      var isGoldBody = (r2 > 150 && g2 > 100 && b2 < 145 && (r2 - b2) > 40 &&
        g2 > b2 * 0.9 && pinkB < 16);
      var isCleanWhite = (lum2 > 185 && Math.abs(r2 - g2) < 20 && Math.abs(g2 - b2) < 20 && pinkB < 10);
      var isWarmFire = (b2 + 35 < r2 && g2 > 40 && b2 < 100 && pinkB < 18);
      // Bandit/skin midtones — never hole-punch or hard-despill
      var isEnemySkin = enemySafe && lum2 > 45 && lum2 < 200 &&
        Math.max(r2, g2, b2) - Math.min(r2, g2, b2) < 95 &&
        r2 > 70 && g2 > 50 && b2 > 40 && Math.abs(r2 - g2) < 75 &&
        !(r2 > 170 && b2 > 150 && g2 < 95 && (r2 - g2) > 60);

      // Dirty white specular fringe → drop hard (skip for enemy skin)
      if (!isEnemySkin && isDirtyWhite && (aOut < 0.98 || pinkB > 14 || spill > 12)) {
        if (pinkB > 12 || spill > 10 || aOut < 0.92) {
          d[p] = d[p + 1] = d[p + 2] = 0;
          d[p + 3] = 0;
          continue;
        }
      }
      // Salmon fringe on bolt yellow / gold (B raised, not pure gold low-B)
      var gmb2 = g2 - b2;
      var isSalmon = (r2 > 160 && b2 > 75 && (r2 - g2) > 28 && gmb2 < 50 && b2 > 70 &&
        !(b2 < 85 && gmb2 > 40 && g2 > 100));
      if (!enemySafe && isSalmon && (aOut < 0.97 || (r2 - g2) > 45 || gmb2 < 32)) {
        d[p] = d[p + 1] = d[p + 2] = 0;
        d[p + 3] = 0;
        continue;
      }
      // Enemy: kill residual pink/purple mud (wolf — accept art loss until remake)
      if (enemySafe && !isEnemySkin && pinkB > 18 && spill > 16 && r2 > 145 && b2 > 95 &&
          g2 < 120 && (r2 - g2) > 35) {
        if (aOut < 0.9 || pinkB > 28) {
          d[p] = d[p + 1] = d[p + 2] = 0;
          d[p + 3] = 0;
          continue;
        }
      }

      if (!isEnemySkin && (spill > 4 || pinkB > 10 || (!enemySafe && isSalmon)) &&
          !isWarmFire && !isCleanWhite) {
        var edgeBoost = aOut < 0.94 ? 1.25 : (isGoldBody ? 0.85 : 0.55);
        if (isDirtyWhite) edgeBoost = 1.4;
        if (enemySafe) edgeBoost *= 0.45; // light despill only
        var pull = Math.max(spill, pinkB * 0.7) * edgeBoost + (pinkB > 18 ? 12 : 0);
        if (enemySafe) {
          // Despill only near transparent edges — never punch body holes
          if (aOut < 0.88 && spill > 18) {
            var pullE = spill * (1 - aOut) * 0.7;
            d[p] = Math.max(0, Math.min(255, r2 - pullE * 0.45));
            d[p + 2] = Math.max(0, Math.min(255, b2 - pullE * 0.8));
            d[p + 1] = Math.max(0, Math.min(255, g2 + pullE * 0.08));
          }
        } else if (isGoldBody || isDirtyWhite) {
          d[p + 2] = Math.max(0, Math.min(255, b2 - pull * 1.25));
          d[p] = Math.max(0, Math.min(255, r2 - pull * 0.45));
          d[p + 1] = Math.max(0, Math.min(255, g2 + pull * 0.1));
        } else {
          d[p] = Math.max(0, Math.min(255, r2 - pull));
          d[p + 2] = Math.max(0, Math.min(255, b2 - pull * 0.95));
          d[p + 1] = Math.max(0, Math.min(255, g2 + pull * 0.12));
        }
        // Combat only: hole-punch semi-transparent pink fringe (kills detail gel volume)
        if (!enemySafe && !gentle) {
          r2 = d[p];
          g2 = d[p + 1];
          b2 = d[p + 2];
          spill = Math.max(0, Math.min(r2, b2) - g2);
          pinkB = (r2 > g2 + 12 && b2 > g2 + 10) ? Math.min(r2 - g2, b2 - g2) : 0;
          if (aOut < 0.85 && (spill > 10 || pinkB > 14) && r2 > 100 && b2 > 90) {
            d[p] = d[p + 1] = d[p + 2] = 0;
            d[p + 3] = 0;
            continue;
          }
        }
      }
      d[p + 3] = Math.round(aOut * 255);
    }

    // Final edge pass: kill magenta / dirty-white rings next to transparency
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        i = y * w + x;
        p = i * 4;
        if (d[p + 3] < 35) continue;
        var nearClear = 0;
        var dy;
        var dx;
        for (dy = -1; dy <= 1; dy++) {
          for (dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            if (d[((y + dy) * w + (x + dx)) * 4 + 3] < 28) nearClear++;
          }
        }
        if (nearClear < 1) continue;
        r2 = d[p];
        g2 = d[p + 1];
        b2 = d[p + 2];
        lum2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
        pinkB = (r2 > g2 + 10 && b2 > g2 + 8) ? Math.min(r2 - g2, b2 - g2) : 0;
        spill = Math.max(0, Math.min(r2, b2) - g2);
        gmb2 = g2 - b2;
        isSalmon = (r2 > 165 && b2 > 75 && (r2 - g2) > 30 && gmb2 < 48 && b2 > 70 &&
          !(b2 < 85 && gmb2 > 40));
        // Enemy / gentle UI: only true studio pink fringe next to clear
        if (enemySafe || gentle) {
          var needN = gentle ? 2 : 1;
          if (nearClear >= needN && r2 > 180 && b2 > 160 && g2 < 90 &&
              (r2 - g2) > 60 && (b2 - g2) > 45) {
            d[p] = d[p + 1] = d[p + 2] = 0;
            d[p + 3] = 0;
          }
          continue;
        }
        // Magenta edge OR pink-white halo OR salmon bolt fringe
        if ((r2 > g2 + 16 && b2 > g2 + 12 && spill > 8) ||
            (lum2 > 140 && pinkB > 12 && r2 > 150 && b2 > 125) ||
            (nearClear >= 1 && isSalmon) ||
            (nearClear >= 2 && pinkB > 10 && r2 > 130 && b2 > 110) ||
            (nearClear >= 2 && r2 > 180 && (r2 - g2) > 40 && gmb2 < 40 && b2 > 85)) {
          d[p] = d[p + 1] = d[p + 2] = 0;
          d[p + 3] = 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  function registerOneGel(scene, rawKey, destKey, chromaOpts) {
    if (!scene.textures.exists(rawKey)) return false;
    var srcImage = null;
    try {
      srcImage = scene.textures.get(rawKey).getSourceImage();
    } catch (e) { return false; }
    if (!srcImage) return false;
    var canvas = magentaChromaToCanvas(srcImage, chromaOpts || {});
    if (!canvas) return false;
    try {
      if (scene.textures.exists(destKey)) scene.textures.remove(destKey);
      scene.textures.addCanvas(destKey, canvas);
      return true;
    } catch (e2) {
      return false;
    }
  }

  /**
   * Combat dest `slime_water` → UI dest `slime_ui_water` (gentle chroma for detail/hub).
   * Skips legacy keys and already-ui keys.
   */
  function uiGelDestKey(combatDest) {
    if (!combatDest || combatDest.indexOf('slime_') !== 0) return null;
    if (combatDest.indexOf('slime_ui_') === 0) return null;
    if (combatDest.indexOf('slime_legacy_') === 0) return null;
    if (combatDest.indexOf('slime3d_') === 0) return null;
    return 'slime_ui_' + combatDest.slice('slime_'.length);
  }

  /** Prefer gentle UI keys for portraits; fall back to combat cutouts. */
  function uiGelKeyFromCombat(combatKey) {
    return uiGelDestKey(combatKey);
  }

  /**
   * Re-key UI cutouts that ship with magenta/pink fringe (tamer badge, etc.).
   * Safe to call after Boot load.image('ui_tamer_badge', …).
   */
  function registerPhaserUiCutouts(scene) {
    if (!scene || !scene.textures) return { ok: false, count: 0 };
    var count = 0;
    var keys = ['ui_tamer_badge'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!scene.textures.exists(k)) continue;
      // Re-key in place: read source, write canvas under same key
      if (registerOneGel(scene, k, k)) count++;
    }
    return { ok: count > 0, count: count };
  }

  /** Build [rawKey, destKey] pairs for combat gels (defaults first). */
  function combatGelRegisterJobs() {
    var jobs = [];
    var i;
    var j;
    // Pass 1: primary portrait keys (hub/roster needs these ASAP)
    for (i = 0; i < ELEMENTS.length; i++) {
      var low = ELEMENTS[i];
      jobs.push(['slime_raw_' + low + '_blob_a', 'slime_' + low]);
      jobs.push(['slime_raw_' + low + '_a', 'slime_' + low]); // fallback if blob missing
      jobs.push(['slime_raw_' + low, 'slime_' + low]);
      jobs.push(['slime_raw_' + low + '_blob_a', 'slime_' + low + '_a']);
      jobs.push(['slime_raw_' + low + '_a', 'slime_' + low + '_a']);
    }
    // Pass 2: variants + forms
    for (i = 0; i < ELEMENTS.length; i++) {
      low = ELEMENTS[i];
      for (j = 0; j < VARIANTS.length; j++) {
        var v = VARIANTS[j];
        if (v === 'a') continue;
        jobs.push(['slime_raw_' + low + '_blob_' + v, 'slime_' + low + '_' + v]);
        jobs.push(['slime_raw_' + low + '_' + v, 'slime_' + low + '_' + v]);
      }
      jobs.push(['slime_raw_' + low + '_morph_a', 'slime_' + low + '_morph']);
      jobs.push(['slime_raw_' + low + '_morph', 'slime_' + low + '_morph']);
      jobs.push(['slime_raw_' + low + '_shaped_a', 'slime_' + low + '_shaped']);
      jobs.push(['slime_raw_' + low + '_shaped', 'slime_' + low + '_shaped']);
      for (j = 0; j < VARIANTS.length; j++) {
        v = VARIANTS[j];
        if (v === 'a') continue;
        jobs.push(['slime_raw_' + low + '_morph_' + v, 'slime_' + low + '_morph_' + v]);
        jobs.push(['slime_raw_' + low + '_shaped_' + v, 'slime_' + low + '_shaped_' + v]);
      }
      // Evolution lv1 portraits
      jobs.push(['slime_raw_' + low + '_evo1', 'slime_' + low + '_evo1']);
    }
    return jobs;
  }

  /**
   * Sync register (tests / small packs). Prefer async at boot.
   * Also registers slime_ui_* with gentle chroma for champion detail / hub portraits.
   */
  function registerPhaserCombatGels(scene) {
    if (!scene || !scene.textures) return { ok: false, count: 0 };
    var jobs = combatGelRegisterJobs();
    var count = 0;
    var uiCount = 0;
    var done = {};
    var doneUi = {};
    var i;
    for (i = 0; i < jobs.length; i++) {
      var dest = jobs[i][1];
      if (!(done[dest] && scene.textures.exists(dest))) {
        if (registerOneGel(scene, jobs[i][0], dest)) {
          count++;
          done[dest] = true;
        }
      }
      // Soft key for large UI portraits (detail stage) — combat keys stay aggressive
      var uiDest = uiGelDestKey(dest);
      if (uiDest && !(doneUi[uiDest] && scene.textures.exists(uiDest))) {
        if (registerOneGel(scene, jobs[i][0], uiDest, { gentle: true })) {
          uiCount++;
          doneUi[uiDest] = true;
        }
      }
    }
    console.log('[Art] registered combat gel sprites', count, '+ ui gentle', uiCount);
    return { ok: count > 0, count: count, uiCount: uiCount };
  }

  /**
   * Chunked chroma register so boot never freezes the main thread at 100%.
   * @param {Phaser.Scene} scene
   * @param {object} [opts]
   * @param {function} [opts.onProgress] (0..1, doneCount, total)
   * @param {function} [opts.onDone] ({ok, count})
   * @param {number} [opts.msPerSlice=12]
   */
  function registerPhaserCombatGelsAsync(scene, opts) {
    opts = opts || {};
    if (!scene || !scene.textures) {
      if (opts.onDone) opts.onDone({ ok: false, count: 0 });
      return;
    }
    var jobs = combatGelRegisterJobs();
    var i = 0;
    var count = 0;
    var uiCount = 0;
    var done = {};
    var doneUi = {};
    var ms = opts.msPerSlice != null ? opts.msPerSlice : 12;
    var total = jobs.length;

    function slice() {
      var t0 = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
      while (i < total) {
        var raw = jobs[i][0];
        var dest = jobs[i][1];
        i++;
        if (!(done[dest] && scene.textures.exists(dest))) {
          if (registerOneGel(scene, raw, dest)) {
            count++;
            done[dest] = true;
          }
        }
        // Soft key for champion detail / hub portraits (same raw, gentler cut)
        var uiDest = uiGelDestKey(dest);
        if (uiDest && !(doneUi[uiDest] && scene.textures.exists(uiDest))) {
          if (registerOneGel(scene, raw, uiDest, { gentle: true })) {
            uiCount++;
            doneUi[uiDest] = true;
          }
        }
        var now = (typeof performance !== 'undefined' && performance.now)
          ? performance.now() : Date.now();
        if (now - t0 >= ms) break;
      }
      if (opts.onProgress) {
        try { opts.onProgress(i / total, i, total); } catch (eP) { /* ignore */ }
      }
      if (i < total) {
        setTimeout(slice, 0);
      } else {
        console.log('[Art] registered combat gel sprites (async)', count, '+ ui gentle', uiCount);
        if (opts.onDone) opts.onDone({ ok: count > 0, count: count, uiCount: uiCount });
      }
    }
    setTimeout(slice, 0);
  }

  function registerPhaserEnemies(scene, kinds) {
    kinds = kinds || [
      'beast', 'golem', 'humanoid', 'dragon', 'undead', 'plant', 'insect', 'elemental'
    ];
    if (!scene || !scene.textures) return { ok: false, count: 0 };
    var count = 0;
    var i;
    var enemyOpts = { enemySafe: true };
    for (i = 0; i < kinds.length; i++) {
      var k = kinds[i];
      // enemySafe: protect bandit faces / cream armor (parity with arena enemyKey3)
      if (registerOneGel(scene, 'enemy_raw_' + k, 'enemy_' + k, enemyOpts)) count++;
      else if (registerOneGel(scene, 'enemy_' + k, 'enemy_' + k, enemyOpts)) count++;
    }
    return { ok: count > 0, count: count };
  }

  global.SR_ART = {
    STYLE_ID: STYLE_ID,
    STYLE_LABEL: STYLE_LABEL,
    PRESENTATION: PRESENTATION,
    STYLE_NORTH_STAR: STYLE_NORTH_STAR,
    CHROMA_HEX: CHROMA_HEX,
    ELEMENTS: ELEMENTS,
    VARIANTS: VARIANTS,
    FORMS: FORMS,
    ENV_KEYS: ENV_KEYS,
    ART_CACHE_VER: ART_CACHE_VER,
    assetUrl: assetUrl,
    elKey: elKey,
    variantKey: variantKey,
    hashMod: hashMod,
    gelFormForUnit: gelFormForUnit,
    artVariantForUnit: artVariantForUnit,
    gelEvoLevel: gelEvoLevel,
    combatGelPath: combatGelPath,
    combatGelEvoPath: combatGelEvoPath,
    combatGelPathCandidates: combatGelPathCandidates,
    combatGelAttackPath: combatGelAttackPath,
    combatGelAttackPathCandidates: combatGelAttackPathCandidates,
    resolveGelAttackArt: resolveGelAttackArt,
    resolveGelIdleArt: resolveGelIdleArt,
    phaserGelKey: phaserGelKey,
    phaserGelKeyCandidates: phaserGelKeyCandidates,
    rosterGelPath: rosterGelPath,
    enemyPath: enemyPath,
    envPropPath: envPropPath,
    forestPropStems: forestPropStems,
    envUrls: envUrls,
    magentaChromaToCanvas: magentaChromaToCanvas,
    uiGelDestKey: uiGelDestKey,
    uiGelKeyFromCombat: uiGelKeyFromCombat,
    registerPhaserCombatGels: registerPhaserCombatGels,
    registerPhaserCombatGelsAsync: registerPhaserCombatGelsAsync,
    registerPhaserEnemies: registerPhaserEnemies,
    registerPhaserUiCutouts: registerPhaserUiCutouts
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SR_ART;
  }
})(typeof window !== 'undefined' ? window : global);
