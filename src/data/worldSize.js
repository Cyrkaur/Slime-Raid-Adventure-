/* ===== World size canon — absolute heights for combat readability =====
 *
 * Size follows what the creature *is*, not which side it fights on.
 * Not every enemy is taller than every gel — a common blob is a little guy
 * next to a stone golem, but a mythic/boss gel can stand with (or above)
 * a bandit and challenge larger threats.
 *
 * Soft fantasy: 1 world unit ≈ 1 meter.
 *
 * Ladder (typical):
 *   common blob gel   ~0.75–0.90m   pocket companion
 *   rare / epic gel   ~1.05–1.30m   trained fighter
 *   mythic gel        ~1.45–1.75m   apex companion (knight-scale)
 *   boss gel          ~1.9–2.8m     raid presence — can rival big foes
 *   insect            ~1.05–1.20m   fantasy bug (often > common gel, < person)
 *   beast / humanoid  ~1.65–1.95m   wolf · bandit · knight
 *   plant / elemental ~2.2–2.7m
 *   dragon / golem    ~3.1–3.5m     (+ boss nudge)
 *   trees             ~9–13m        always tower over combatants
 *
 * Combat root scale = (height / nativePlateHeight) × perspective
 * — apply size once on the root, never on plate and root together.
 */
(function (global) {
  'use strict';

  var UNIT = 'm';

  /**
   * Size classes — coarse band for UI / AI / future systems.
   * height ≈ meters; class is derived, not a second independent stat.
   */
  var SIZE_CLASS = {
    tiny:   { min: 0,    max: 0.85, label: 'Tiny' },
    small:  { min: 0.85, max: 1.25, label: 'Small' },
    medium: { min: 1.25, max: 1.95, label: 'Medium' },
    large:  { min: 1.95, max: 2.75, label: 'Large' },
    huge:   { min: 2.75, max: 3.80, label: 'Huge' },
    colossal: { min: 3.80, max: 99, label: 'Colossal' }
  };

  /** Narrative reference cards (docs / tools) */
  var REFERENCE = {
    gel_common_blob: { height: 0.70, sizeClass: 'tiny',  label: 'Common blob', note: 'Little guy — pocket companion' },
    gel_epic:        { height: 1.15, sizeClass: 'small', label: 'Epic gel', note: 'Trained gel — clear step up' },
    gel_legendary:   { height: 1.55, sizeClass: 'medium', label: 'Legendary gel', note: 'Noticeably larger than commons' },
    gel_mythic:      { height: 1.75, sizeClass: 'medium', label: 'Mythic gel', note: 'Apex companion presence' },
    gel_boss:        { height: 2.40, sizeClass: 'large', label: 'Boss gel', note: 'Raid gel — can match big threats' },
    insect:          { height: 1.12, sizeClass: 'small', label: 'Insect', note: 'Fantasy bug — bigger than a blob, not a golem' },
    beast:           { height: 1.70, sizeClass: 'medium', label: 'Beast', note: 'Wolf / boar / hound' },
    humanoid:        { height: 1.88, sizeClass: 'medium', label: 'Humanoid', note: 'Adult knight / bandit' },
    undead:          { height: 1.92, sizeClass: 'medium', label: 'Undead', note: 'Gaunt tall' },
    elemental:       { height: 2.20, sizeClass: 'large', label: 'Elemental', note: 'Floating mass' },
    plant:           { height: 2.65, sizeClass: 'large', label: 'Plant mass', note: 'Treant / vine bulk' },
    dragon:          { height: 3.15, sizeClass: 'huge', label: 'Drake', note: 'Combat-scale dragon' },
    golem:           { height: 3.35, sizeClass: 'huge', label: 'Golem', note: 'Stone brute — dwarfs common gels' },
    tree_near:       { height: 9.0,  sizeClass: 'colossal', label: 'Near tree', note: 'Forest bole' },
    tree_far:        { height: 13.0, sizeClass: 'colossal', label: 'Far tree', note: 'Backdrop canopy' }
  };

  /** Enemy kind base height (m). Kind is primary; rarity / boss only nudge. */
  var ENEMY_HEIGHT = {
    insect: 1.12,     // big bug — often taller than a common blob, shorter than a person
    beast: 1.70,
    humanoid: 1.88,
    undead: 1.92,
    elemental: 2.20,
    plant: 2.65,
    dragon: 3.15,
    golem: 3.35
  };

  /** Soft gel base before element / rarity / form / boss */
  var GEL_BASE_HEIGHT = 0.95;

  /** Element body mass (visual identity — chunky earth vs wispy wind) */
  var GEL_ELEMENT_SIZE = {
    water: 0.94, fire: 1.00, earth: 1.18, wind: 0.70,
    plant: 1.05, lightning: 0.78, ice: 0.98, shadow: 0.92,
    light: 0.96, metal: 1.12, poison: 0.88, crystal: 1.02,
    lava: 1.22, storm: 1.08, spirit: 0.74, void: 1.10
  };

  /**
   * Rarity growth for gels. Commons stay small; legend+ read clearly bigger.
   * Boss flag can push further (see resolveGelSize).
   */
  var GEL_RARITY_SIZE = {
    Common: 0.88,
    Uncommon: 0.94,
    Rare: 1.04,
    Epic: 1.18,
    Legendary: 1.44,  // clear step up from small commons
    Mythic: 1.58
  };

  /**
   * Form tier — blob is the “little guy”; shaped (legend+) has presence.
   * A common circle-blob should read clearly smaller than a golem.
   */
  var GEL_FORM_SIZE = {
    blob: 0.88,
    morph: 1.02,
    shaped: 1.16
  };

  /** Enemy rarity — mild; never invert insect vs golem */
  var ENEMY_RARITY_SIZE = {
    Common: 1.00,
    Uncommon: 1.03,
    Rare: 1.06,
    Epic: 1.10,
    Legendary: 1.16,
    Mythic: 1.22
  };

  /** Unscaled combat plate height (sprite local Y) */
  var NATIVE_PLATE = {
    gel: 2.00,
    insect: 1.70,
    beast: 2.00,
    humanoid: 2.20,
    undead: 2.25,
    elemental: 2.20,
    plant: 2.45,
    dragon: 2.55,
    golem: 2.75,
    meshEnemy: 1.80,
    meshGel: 1.65
  };

  function elKey(el) {
    return String(el || 'water').toLowerCase().replace(/\s+/g, '');
  }

  function rarityKey(r) {
    var s = String(r || 'Common');
    return GEL_RARITY_SIZE[s] != null ? s : 'Common';
  }

  function formTierForUnit(unit) {
    if (global.SR_ART && typeof global.SR_ART.gelFormForUnit === 'function') {
      try { return global.SR_ART.gelFormForUnit(unit) || 'blob'; } catch (e) { /* fall */ }
    }
    if (global.SR_DATA && typeof global.SR_DATA.resolveFormTier === 'function') {
      try { return global.SR_DATA.resolveFormTier(unit) || 'blob'; } catch (e2) { /* fall */ }
    }
    var rar = rarityKey(unit && unit.rarity);
    if (rar === 'Mythic' || rar === 'Legendary') return 'shaped';
    if (rar === 'Epic') return 'morph';
    return 'blob';
  }

  function isSolidEnemy(unit) {
    return !!(unit && (unit.isEnemy || unit.enemyKind) && unit.enemyKind !== 'slime');
  }

  function isBossUnit(unit) {
    if (!unit) return false;
    if (unit.isBoss || unit.boss || unit.bossUnit) return true;
    var rar = rarityKey(unit.rarity);
    var power = Number(unit.power) || 0;
    // Named raid bosses / chapter bosses often flag power high + legend+
    if ((rar === 'Legendary' || rar === 'Mythic') && power >= 300 && (unit.isEnemy || unit.isFoe)) {
      return true;
    }
    return false;
  }

  function enemyKindOf(unit) {
    var k = String((unit && (unit.enemyKind || unit.kind)) || 'beast').toLowerCase();
    if (ENEMY_HEIGHT[k] == null) k = 'beast';
    return k;
  }

  function sizeClassForHeight(h) {
    var keys = ['tiny', 'small', 'medium', 'large', 'huge', 'colossal'];
    var i;
    for (i = 0; i < keys.length; i++) {
      var band = SIZE_CLASS[keys[i]];
      if (h >= band.min && h < band.max) return keys[i];
    }
    return 'medium';
  }

  function attachClass(info) {
    info.sizeClass = sizeClassForHeight(info.height);
    info.sizeClassLabel = (SIZE_CLASS[info.sizeClass] && SIZE_CLASS[info.sizeClass].label) || info.sizeClass;
    return info;
  }

  /**
   * Absolute combat height in world units (≈ meters).
   * @returns {object} height, widthHint, sizeClass, kind, role, breakdown, …
   */
  function resolveWorldSize(unit) {
    if (!unit) {
      return attachClass({
        height: GEL_BASE_HEIGHT * 0.88 * 0.88,
        widthHint: 0.7,
        kind: 'gel',
        role: 'gel',
        label: 'Gel',
        nativePlate: NATIVE_PLATE.gel,
        mult: 1,
        breakdown: { base: GEL_BASE_HEIGHT }
      });
    }

    if (isSolidEnemy(unit)) {
      return resolveEnemySize(unit);
    }
    return resolveGelSize(unit);
  }

  function resolveGelSize(unit) {
    var el = elKey(unit.element);
    var rar = rarityKey(unit.rarity);
    var form = formTierForUnit(unit);
    var base = GEL_BASE_HEIGHT;
    var elMul = GEL_ELEMENT_SIZE[el] != null ? GEL_ELEMENT_SIZE[el] : 1;
    var rarMul = GEL_RARITY_SIZE[rar] || 1;
    var formMul = GEL_FORM_SIZE[form] || 1;

    // Purple-star evolution: somewhat bigger per awaken (matches evo plate art)
    var evo = 0;
    if (unit.purpleStars != null) evo = Math.floor(Number(unit.purpleStars) || 0);
    else if (unit.evolutionLevel != null) evo = Math.floor(Number(unit.evolutionLevel) || 0);
    if (evo < 0) evo = 0;
    if (evo > 6) evo = 6;
    var evoMul = 1 + Math.min(0.28, evo * 0.07); // evo1 ≈ +7%

    // Boss gels (raid / chapter slime bosses) get real presence — can rival big foes
    var boss = isBossUnit(unit);
    var bossMul = 1;
    if (boss) {
      bossMul = rar === 'Mythic' ? 1.55 : (rar === 'Legendary' ? 1.42 : 1.32);
    } else if (unit.isFoe && (rar === 'Mythic' || rar === 'Legendary')) {
      // Elite foe gels (not full boss flag) — a bit larger than ally peers
      bossMul = 1.08;
    }

    var forceH = unit.worldHeight || unit.height || unit.sizeHeight;
    var height = forceH != null
      ? Number(forceH)
      : base * elMul * rarMul * formMul * evoMul * bossMul;

    // Clamps — commons stay tiny; legend/mythic get room to read larger vs small gels
    var floor = form === 'blob' && rar === 'Common' ? 0.62 : 0.68;
    var ceil = boss
      ? 2.95
      : (rar === 'Mythic' ? 2.05
        : (rar === 'Legendary' ? 1.95
          : (rar === 'Epic' ? 1.45 : 1.35)));
    height = Math.max(floor, Math.min(ceil, height));

    var widthHint = height * (el === 'earth' || el === 'lava' ? 1.05 : (form === 'blob' ? 0.95 : 0.88));
    var label = (boss ? 'Boss ' : '') + (rar !== 'Common' ? rar + ' ' : '') + el + ' gel';

    return attachClass({
      height: height,
      widthHint: widthHint,
      kind: 'gel',
      role: 'gel',
      element: el,
      rarity: rar,
      form: form,
      boss: boss,
      label: label,
      nativePlate: NATIVE_PLATE.gel,
      mult: height / GEL_BASE_HEIGHT,
      breakdown: {
        base: base,
        element: elMul,
        rarity: rarMul,
        form: formMul,
        boss: bossMul
      }
    });
  }

  function resolveEnemySize(unit) {
    var kind = enemyKindOf(unit);
    var rar = rarityKey(unit.rarity);
    var base = ENEMY_HEIGHT[kind] != null ? ENEMY_HEIGHT[kind] : 1.70;
    var rarMul = ENEMY_RARITY_SIZE[rar] || 1;
    var name = String(unit.name || '').toLowerCase();
    var nameMul = 1;
    // Dimunitive name → smaller instance of the kind (imp, hatchling)
    if (/\b(hatchling|imp|lesser|pup|spawn|sapling|scout|whelp|young|tiny|small)\b/.test(name)) {
      nameMul = 0.78;
    } else if (/\b(giant|dire|elder|ancient|colossus|sovereign|tyrant|prime|great|titan)\b/.test(name)) {
      nameMul = 1.16;
    }

    var boss = isBossUnit(unit);
    var bossMul = boss ? 1.18 : 1;
    // Power is combat strength, not height — only a tiny elite nudge
    var power = Number(unit.power) || 0;
    var powerMul = power >= 480 ? 1.06 : (power >= 350 ? 1.03 : 1);

    var forceH = unit.worldHeight || unit.height || unit.sizeHeight;
    var height = forceH != null
      ? Number(forceH)
      : base * rarMul * nameMul * bossMul * powerMul;

    // Kind floors/ceils keep hierarchy: insect never as tall as golem base
    var floor = kind === 'insect' ? 0.80 : (kind === 'beast' || kind === 'humanoid' ? 1.15 : 1.35);
    var ceil = 3.5;
    if (kind === 'golem' || kind === 'dragon') ceil = boss ? 4.4 : 3.9;
    else if (kind === 'plant' || kind === 'elemental') ceil = boss ? 3.6 : 3.2;
    else if (kind === 'insect') ceil = boss ? 1.85 : 1.45;
    height = Math.max(floor, Math.min(ceil, height));

    var widthMul = {
      insect: 1.08, beast: 1.05, humanoid: 0.72, undead: 0.7,
      elemental: 0.85, plant: 0.9, dragon: 1.05, golem: 0.95
    };
    var widthHint = height * (widthMul[kind] != null ? widthMul[kind] : 0.85);
    var native = NATIVE_PLATE[kind] != null ? NATIVE_PLATE[kind] : NATIVE_PLATE.beast;

    return attachClass({
      height: height,
      widthHint: widthHint,
      kind: kind,
      role: 'enemy',
      rarity: rar,
      boss: boss,
      label: (unit.name || kind),
      nativePlate: native,
      mult: height / (ENEMY_HEIGHT.humanoid || 1.88),
      breakdown: {
        base: base,
        rarity: rarMul,
        name: nameMul,
        boss: bossMul,
        power: powerMul
      }
    });
  }

  /**
   * Root scale for a figure given world size + lane perspective (≈1).
   */
  function combatRootScale(size, perspective, nativeOverride) {
    size = size || resolveWorldSize(null);
    var native = nativeOverride || size.nativePlate || NATIVE_PLATE.gel;
    var persp = perspective != null ? perspective : 1;
    var s = (size.height / native) * persp;
    return Math.max(0.28, Math.min(2.7, s));
  }

  function gelSizeMult(unit) {
    var s = resolveGelSize(unit || {});
    return s.height / GEL_BASE_HEIGHT;
  }

  function enemySizeMult(unit) {
    var s = resolveEnemySize(unit || { enemyKind: 'beast' });
    return s.height / (ENEMY_HEIGHT.humanoid || 1.88);
  }

  function enemyKindSize(kind) {
    var h = ENEMY_HEIGHT[String(kind || 'beast').toLowerCase()];
    if (h == null) h = ENEMY_HEIGHT.beast;
    return h / (ENEMY_HEIGHT.humanoid || 1.88);
  }

  function sizeBlurb(unit) {
    var s = resolveWorldSize(unit);
    return s.label + ' · ' + s.sizeClassLabel + ' · ~' + s.height.toFixed(2) + UNIT;
  }

  /**
   * Compare two units: positive if a is taller than b.
   * Useful for tests / debug overlays.
   */
  function compareHeight(a, b) {
    return resolveWorldSize(a).height - resolveWorldSize(b).height;
  }

  var api = {
    UNIT: UNIT,
    SIZE_CLASS: SIZE_CLASS,
    REFERENCE: REFERENCE,
    ENEMY_HEIGHT: ENEMY_HEIGHT,
    GEL_BASE_HEIGHT: GEL_BASE_HEIGHT,
    GEL_ELEMENT_SIZE: GEL_ELEMENT_SIZE,
    GEL_RARITY_SIZE: GEL_RARITY_SIZE,
    GEL_FORM_SIZE: GEL_FORM_SIZE,
    ENEMY_RARITY_SIZE: ENEMY_RARITY_SIZE,
    NATIVE_PLATE: NATIVE_PLATE,
    resolveWorldSize: resolveWorldSize,
    resolveGelSize: resolveGelSize,
    resolveEnemySize: resolveEnemySize,
    combatRootScale: combatRootScale,
    gelSizeMult: gelSizeMult,
    enemySizeMult: enemySizeMult,
    enemyKindSize: enemyKindSize,
    sizeClassForHeight: sizeClassForHeight,
    sizeBlurb: sizeBlurb,
    compareHeight: compareHeight,
    isSolidEnemy: isSolidEnemy,
    isBossUnit: isBossUnit
  };

  global.SR_WORLD_SIZE = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : global);
