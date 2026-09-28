/* ===== Live 3D combat arena (Three.js) — RSL-style full 3D battlefield =====
 * Only combat is 3D. Hub stays 2D. Gel death = structure collapse → melt puddle.
 * Painted gels / env / props: PAINTERLY FANTASY (docs/ART_STYLE.md) — not chibi.
 * Full GLB mesh gels = V2 / opt-in; V1 default = combat sprites + billboards.
 */
(function (global) {
  'use strict';

  /** Set during create() so figure builders can respect quality tier */
  var _combatQuality = 'high';

  var ELEMENT_HEX = {
    water: 0x4fc3f7, fire: 0xff7043, earth: 0xa1887f, wind: 0x80deea,
    plant: 0x66bb6a, lightning: 0xffee58, ice: 0xb3e5fc, shadow: 0x7e57c2,
    light: 0xfff59d, metal: 0xb0bec5, poison: 0xab47bc, crystal: 0xce93d8,
    lava: 0xff5722, storm: 0x90caf9, spirit: 0xe1bee7, void: 0x5c6bc0
  };

  var RARITY_EMISSIVE = {
    Common: 0.1, Uncommon: 0.14, Rare: 0.2, Epic: 0.28, Legendary: 0.38, Mythic: 0.46
  };

  /** Rarity → combat size multiplier (legacy; prefer SR_WORLD_SIZE) */
  var RARITY_SIZE = {
    Common: 0.92, Uncommon: 0.97, Rare: 1.04, Epic: 1.12, Legendary: 1.24, Mythic: 1.36
  };

  /**
   * Per-element gel identity — body proportions (not absolute height).
   * Absolute height lives in SR_WORLD_SIZE (worldSize.js).
   */
  var GEL_PROFILES = {
    water:     { size: 0.95, bodyH: 0.92, bodyW: 1.18, style: 'droplet', ornaments: 'drip', eyes: 2 },
    fire:      { size: 1.02, bodyH: 1.18, bodyW: 0.92, style: 'flame', ornaments: 'ember', eyes: 2 },
    earth:     { size: 1.22, bodyH: 0.86, bodyW: 1.28, style: 'chunk', ornaments: 'rocks', eyes: 2 },
    wind:      { size: 0.72, bodyH: 1.08, bodyW: 1.02, style: 'wispy', ornaments: 'swirl', eyes: 2, floatY: 0.14 },
    plant:     { size: 1.08, bodyH: 1.02, bodyW: 1.06, style: 'sprout', ornaments: 'leaf', eyes: 2 },
    lightning: { size: 0.80, bodyH: 1.28, bodyW: 0.82, style: 'spike', ornaments: 'bolt', eyes: 2 },
    ice:       { size: 1.00, bodyH: 1.08, bodyW: 0.96, style: 'crystal', ornaments: 'shard', eyes: 2 },
    shadow:    { size: 0.94, bodyH: 1.12, bodyW: 0.94, style: 'tendril', ornaments: 'mist', eyes: 2 },
    light:     { size: 0.98, bodyH: 1.00, bodyW: 1.00, style: 'orb', ornaments: 'halo', eyes: 2 },
    metal:     { size: 1.14, bodyH: 0.94, bodyW: 1.12, style: 'armor', ornaments: 'plate', eyes: 2 },
    poison:    { size: 0.90, bodyH: 0.96, bodyW: 1.14, style: 'bubble', ornaments: 'bubble', eyes: 2 },
    crystal:   { size: 1.04, bodyH: 1.16, bodyW: 0.88, style: 'gem', ornaments: 'facet', eyes: 2 },
    lava:      { size: 1.26, bodyH: 0.88, bodyW: 1.32, style: 'heavy', ornaments: 'crust', eyes: 2 },
    storm:     { size: 1.10, bodyH: 1.02, bodyW: 1.28, style: 'cloud', ornaments: 'spark', eyes: 2 },
    spirit:    { size: 0.76, bodyH: 1.22, bodyW: 0.88, style: 'ghost', ornaments: 'wisps', eyes: 2, floatY: 0.16 },
    void:      { size: 1.12, bodyH: 1.06, bodyW: 1.16, style: 'cosmos', ornaments: 'stars', eyes: 3 }
  };

  function gelProfile(element) {
    var low = elKey(element);
    return GEL_PROFILES[low] || GEL_PROFILES.water;
  }

  /** World-size API (absolute heights). Falls back if script order misses worldSize.js */
  function worldSizeApi() {
    return global.SR_WORLD_SIZE || null;
  }

  function resolveWorldSize(unit) {
    var api = worldSizeApi();
    if (api && typeof api.resolveWorldSize === 'function') return api.resolveWorldSize(unit);
    // Minimal fallback
    if (unit && (unit.isEnemy || unit.enemyKind) && unit.enemyKind !== 'slime') {
      return { height: 1.9 * enemyKindSize(unit.enemyKind || unit.kind), nativePlate: 2.2, role: 'enemy', kind: unit.enemyKind || 'beast' };
    }
    return { height: gelSizeMult(unit), nativePlate: 2.0, role: 'gel', kind: 'gel' };
  }

  function gelSizeMult(unit) {
    var api = worldSizeApi();
    if (api && typeof api.gelSizeMult === 'function') return api.gelSizeMult(unit);
    var p = gelProfile(unit && unit.element);
    var r = RARITY_SIZE[unit && unit.rarity] || 1;
    return (p.size || 1) * r;
  }

  /**
   * Pure RSL diagonal lane geometry (BL→TR). No Three/Phaser dependency.
   * Allies sideSign -1, foes +1; t 0 = near bottom-left, 1 = far top-right.
   */
  var LANE_DEFAULT = {
    // Longer diagonal so same-team slots have more room between champs
    bl: { x: -3.6, z: 3.2 },
    tr: { x: 3.8, z: -3.2 },
    // Distance from corridor centerline to each team row (full gap = 2×halfWidth)
    halfWidth: 2.75,
    t0: 0.08,
    t1: 0.92,
    // Keep teams in a straight row (no zig-zag / forward stagger)
    latStagger: 0
  };

  function computeLaneAxis(bl, tr) {
    bl = bl || LANE_DEFAULT.bl;
    tr = tr || LANE_DEFAULT.tr;
    var dx = tr.x - bl.x;
    var dz = tr.z - bl.z;
    var len = Math.sqrt(dx * dx + dz * dz) || 1;
    dx /= len;
    dz /= len;
    return {
      bl: bl,
      tr: tr,
      dx: dx,
      dz: dz,
      px: -dz,
      pz: dx,
      len: len
    };
  }

  /**
   * Pure lane slot for unit placement — same math as live arena layoutSlot.
   * @param {'ally'|'foe'} side
   */
  function computeLaneSlot(side, index, count, opts) {
    opts = opts || {};
    count = Math.max(1, count || 1);
    var u = count <= 1 ? 0.5 : index / (count - 1);
    // Spread farther along the lane when more champs share a line
    var t0 = opts.t0 != null ? opts.t0 : LANE_DEFAULT.t0;
    var t1 = opts.t1 != null ? opts.t1 : LANE_DEFAULT.t1;
    if (opts.t0 == null && opts.t1 == null && count >= 3) {
      var extra = Math.min(0.06, (count - 2) * 0.02);
      t0 = Math.max(0.04, t0 - extra);
      t1 = Math.min(0.96, t1 + extra);
    }
    var t = t0 + u * (t1 - t0);
    t = Math.max(0.04, Math.min(0.96, t));
    var axis = computeLaneAxis(opts.bl, opts.tr);
    var halfWidth = opts.halfWidth != null ? opts.halfWidth : LANE_DEFAULT.halfWidth;
    var sideSign = side === 'foe' ? 1 : -1;
    var lat = halfWidth;
    var x = axis.bl.x + axis.dx * (t * axis.len) + axis.px * lat * sideSign;
    var z = axis.bl.z + axis.dz * (t * axis.len) + axis.pz * lat * sideSign;
    // Perspective only (depth foreshortening) — same for both sides.
    // Absolute creature size comes from SR_WORLD_SIZE, not a foe shrink factor.
    var perspective = 0.94 + (1 - t) * 0.12;
    return {
      x: x,
      y: 0.02,
      z: z,
      scale: perspective,
      perspective: perspective,
      t: t,
      sideSign: sideSign,
      faceY: Math.atan2(axis.px * (side === 'foe' ? -1 : 1), axis.pz * (side === 'foe' ? -1 : 1))
    };
  }

  /** Hard-realm foe vs soft gel (matches createUnitFigure branching). */
  function unitIsSolidEnemy(unit) {
    return !!(unit && (unit.isEnemy || unit.enemyKind) && unit.enemyKind !== 'slime');
  }

  /**
   * Death presentation path for a combat figure / flags.
   * solid = hard collapse; gelMelt = plate squash+puddle; melt = mesh melt deform.
   */
  function deathPathForFlags(flags) {
    flags = flags || {};
    if (flags.solidEnemy) return 'solid';
    if (flags.gelImpostor || (flags.isImpostor && !flags.solidEnemy)) return 'gelMelt';
    return 'melt';
  }

  /**
   * Pure quality tier resolution (low / med / high).
   * opts.quality wins; else localStorage-like getter; else auto from size.
   */
  function resolveBattleQuality(opts) {
    opts = opts || {};
    var quality = String(opts.quality || '').toLowerCase();
    if (quality !== 'low' && quality !== 'med' && quality !== 'high') {
      var lq = '';
      if (typeof opts.getStoredQuality === 'function') {
        try { lq = opts.getStoredQuality() || ''; } catch (e) { lq = ''; }
      } else if (typeof localStorage !== 'undefined') {
        try { lq = localStorage.getItem('sr_battle_quality') || ''; } catch (e2) { lq = ''; }
      }
      quality = String(lq).toLowerCase();
    }
    if (quality !== 'low' && quality !== 'med' && quality !== 'high') {
      var width = opts.width || 1920;
      var dpr = opts.dpr || 1;
      quality = (width >= 1400 && dpr >= 1) ? 'high' : 'med';
    }
    return {
      id: quality,
      shadows: quality !== 'low',
      shadowMap: quality === 'high' ? 1024 : 512,
      exposure: quality === 'low' ? 1.22 : (quality === 'med' ? 1.32 : 1.42),
      motes: quality === 'low' ? 28 : (quality === 'med' ? 50 : 70),
      worldFx: quality !== 'low',
      fxTrails: quality === 'high',
      bloom: quality !== 'low',
      bloomStrength: quality === 'high' ? 0.38 : 0.26,
      bloomDownscale: quality === 'high' ? 4 : 5,
      antialias: quality !== 'low'
    };
  }

  /**
   * Relative kind size vs humanoid (legacy mult). Absolute heights: SR_WORLD_SIZE.
   * Ladder: insect < beast ≈ humanoid ≈ undead < elemental < plant < dragon < golem
   */
  var ENEMY_KIND_SIZE = {
    insect: 0.66, humanoid: 1.00, undead: 1.03, beast: 0.97,
    elemental: 1.18, plant: 1.42, dragon: 1.68, golem: 1.76
  };

  var ENEMY_RARITY_SIZE = {
    Common: 1.0, Uncommon: 1.04, Rare: 1.08, Epic: 1.14, Legendary: 1.22, Mythic: 1.30
  };

  function enemyKindSize(kind) {
    var api = worldSizeApi();
    if (api && typeof api.enemyKindSize === 'function') return api.enemyKindSize(kind);
    var k = String(kind || 'beast').toLowerCase();
    return ENEMY_KIND_SIZE[k] != null ? ENEMY_KIND_SIZE[k] : 1.0;
  }

  /** Final foe mult vs humanoid baseline (legacy). Prefer resolveWorldSize().height */
  function enemySizeMult(unit) {
    var api = worldSizeApi();
    if (api && typeof api.enemySizeMult === 'function') return api.enemySizeMult(unit);
    var kind = (unit && (unit.enemyKind || unit.kind)) || 'beast';
    var base = enemyKindSize(kind);
    var rar = ENEMY_RARITY_SIZE[(unit && unit.rarity) || 'Common'] || 1;
    var name = String((unit && unit.name) || '').toLowerCase();
    var nameMul = 1;
    if (/\b(hatchling|imp|lesser|pup|spawn|sapling|scout|whelp)\b/.test(name)) nameMul = 0.78;
    else if (/\b(giant|dire|elder|ancient|colossus|sovereign|tyrant|prime|great)\b/.test(name)) nameMul = 1.18;
    var power = (unit && unit.power) || 0;
    var powerMul = power >= 450 ? 1.12 : (power >= 320 ? 1.08 : (power >= 220 ? 1.04 : 1));
    return base * rar * nameMul * powerMul;
  }

  /**
   * Campaign battle zones — each chapter is a place, not a generic arena.
   * Stages inherit the chapter kit; light stage tint/prop density varies.
   */
  var ZONE_THEMES = {
    greenwild: {
      id: 'greenwild',
      label: 'Greenwild Forest',
      ground: 'moss',
      props: 'trees',
      particles: 'pollen',
      fog: 0x0c2218, skyTop: 0x3a6a58, skyBot: 0x142818,
      floor: 0x1f4a32, rim: 0x2d5c40, accent: 0x7dff9a,
      key: 0xfff2c8, fill: 0x88ffbb, rimLight: 0x66ccaa,
      hill: 0x0e281c, stone: 0x3a4a38, stoneDark: 0x243028,
      path: 0x88ffaa, allyStrip: 0x44ff88, foeStrip: 0xff7766,
      fogNear: 16, fogFar: 52, ambient: 0xc8e0d0, hemiSky: 0xc8f0d8,
      hasRunes: false, hasGem: false, hasBraziers: false, hasTorches: false, hasArch: false
    },
    crystal: {
      id: 'crystal',
      label: 'Crystal Mountains',
      ground: 'ice',
      props: 'crystals',
      particles: 'sparkle',
      fog: 0x0a1828, skyTop: 0x6a9ec8, skyBot: 0x1a3048,
      floor: 0x2a4a68, rim: 0x3a6a88, accent: 0x88eeff,
      key: 0xe8f4ff, fill: 0xaaddff, rimLight: 0x88aaff,
      hill: 0x1a3048, stone: 0x4a6a88, stoneDark: 0x2a4058,
      path: 0xaaffff, allyStrip: 0x66ccff, foeStrip: 0xff88aa,
      fogNear: 14, fogFar: 48, ambient: 0xd0e4f0, hemiSky: 0xd8eeff,
      hasRunes: true, hasGem: true, hasBraziers: false, hasTorches: false, hasArch: false
    },
    shadowfen: {
      id: 'shadowfen',
      label: 'Shadowfen Swamp',
      ground: 'mire',
      props: 'reeds',
      particles: 'mist',
      fog: 0x0c0818, skyTop: 0x2a2440, skyBot: 0x100c18,
      floor: 0x1a2430, rim: 0x2a3840, accent: 0xaa77ff,
      key: 0xc8b0e8, fill: 0x8866aa, rimLight: 0x6644aa,
      hill: 0x12101c, stone: 0x2a2838, stoneDark: 0x18141f,
      path: 0x9977cc, allyStrip: 0x66aa88, foeStrip: 0xcc66aa,
      fogNear: 10, fogFar: 38, ambient: 0xa090b0, hemiSky: 0x8870a8,
      hasRunes: true, hasGem: false, hasBraziers: false, hasTorches: true, hasArch: false
    },
    volcanic: {
      id: 'volcanic',
      label: 'Volcanic Wastes',
      ground: 'ash',
      props: 'spires',
      particles: 'ember',
      fog: 0x1a0c08, skyTop: 0x4a2010, skyBot: 0x1a0c08,
      floor: 0x2a1810, rim: 0x3a2218, accent: 0xff7733,
      key: 0xffcc88, fill: 0xff8844, rimLight: 0xff5522,
      hill: 0x1a100c, stone: 0x3a2820, stoneDark: 0x1a1210,
      path: 0xff8844, allyStrip: 0xffaa55, foeStrip: 0xff4466,
      fogNear: 12, fogFar: 44, ambient: 0xd0a080, hemiSky: 0xffc090,
      hasRunes: false, hasGem: false, hasBraziers: true, hasTorches: true, hasArch: false
    },
    celestial: {
      id: 'celestial',
      label: 'Celestial Peaks',
      ground: 'star',
      props: 'obelisks',
      particles: 'star',
      fog: 0x0a0818, skyTop: 0x1a1840, skyBot: 0x080610,
      floor: 0x1a1838, rim: 0x2a2858, accent: 0xd4b0ff,
      key: 0xffe8c8, fill: 0xccaaee, rimLight: 0x8866ff,
      hill: 0x121028, stone: 0x3a3860, stoneDark: 0x1a1830,
      path: 0xddbbff, allyStrip: 0xaaddff, foeStrip: 0xffaadd,
      fogNear: 16, fogFar: 55, ambient: 0xc0b8e0, hemiSky: 0xb0a8f0,
      hasRunes: true, hasGem: true, hasBraziers: false, hasTorches: false, hasArch: false
    },
    dungeon: {
      id: 'dungeon',
      label: 'Depth Raid',
      isArena: true,
      ground: 'stone',
      props: 'pillars',
      particles: 'dust',
      fog: 0x0a0814, skyTop: 0x1a1230, skyBot: 0x080610,
      floor: 0x1a1828, rim: 0x2a2438, accent: 0xaa77ff,
      key: 0xffd0a0, fill: 0xaa88ff, rimLight: 0x8866ff,
      hill: 0x0c0a14, stone: 0x2a2838, stoneDark: 0x16141f,
      path: 0xaa88ff, allyStrip: 0x66ffaa, foeStrip: 0xff6688,
      fogNear: 12, fogFar: 40, ambient: 0xb0a8c0, hemiSky: 0xa898d0,
      hasRunes: true, hasGem: true, hasBraziers: true, hasTorches: true, hasArch: false
    },
    default: {
      id: 'default',
      label: 'Soft Wilds',
      ground: 'moss',
      props: 'trees',
      particles: 'pollen',
      fog: 0x081218, skyTop: 0x163040, skyBot: 0x0a1810,
      floor: 0x1a3028, rim: 0x243830, accent: 0x77ffaa,
      key: 0xfff2dd, fill: 0xaaffcc, rimLight: 0x88aaff,
      hill: 0x0c1814, stone: 0x2a3830, stoneDark: 0x1a2420,
      path: 0x88ffcc, allyStrip: 0x44ff88, foeStrip: 0xff5566,
      fogNear: 18, fogFar: 48, ambient: 0xc8d8e0, hemiSky: 0xd0e8ff,
      hasRunes: false, hasGem: false, hasBraziers: false, hasTorches: false, hasArch: false
    }
  };

  /**
   * Named dungeon / boss arenas — still a formal arena (ring, pillars, runes)
   * but colored and dressed to match the dungeon name.
   */
  var DUNGEON_ARENA_THEMES = {
    forest_depths: {
      id: 'forest_depths', label: 'Forest Depths', isArena: true,
      ground: 'moss', props: 'trees', particles: 'pollen',
      fog: 0x0a1a12, skyTop: 0x1a3a28, skyBot: 0x081410,
      floor: 0x1a3a28, rim: 0x2a4a34, accent: 0x66ff99,
      key: 0xd8f0c8, fill: 0x88cc88, rimLight: 0x55aa77,
      hill: 0x0c2014, stone: 0x3a4a38, stoneDark: 0x1a2818,
      path: 0x88ffaa, allyStrip: 0x44ff88, foeStrip: 0xff8866,
      fogNear: 10, fogFar: 36, ambient: 0xb0d0b8, hemiSky: 0xa0c8a8,
      hasRunes: true, hasGem: false, hasBraziers: false, hasTorches: true, hasArch: false
    },
    crystal_caverns: {
      id: 'crystal_caverns', label: 'Crystal Caverns', isArena: true,
      ground: 'ice', props: 'crystals', particles: 'sparkle',
      fog: 0x081420, skyTop: 0x1a3050, skyBot: 0x060e18,
      floor: 0x1a3858, rim: 0x2a5080, accent: 0x88eeff,
      key: 0xe0f0ff, fill: 0x88bbdd, rimLight: 0x66aadd,
      hill: 0x0c1828, stone: 0x3a5a78, stoneDark: 0x1a2838,
      path: 0xaaffff, allyStrip: 0x66ccff, foeStrip: 0xff88aa,
      fogNear: 9, fogFar: 34, ambient: 0xb8d0e8, hemiSky: 0xc0dcf0,
      hasRunes: true, hasGem: true, hasBraziers: false, hasTorches: false, hasArch: false
    },
    shadow_abyss: {
      id: 'shadow_abyss', label: 'Shadow Abyss', isArena: true,
      ground: 'mire', props: 'reeds', particles: 'mist',
      fog: 0x080610, skyTop: 0x181028, skyBot: 0x060408,
      floor: 0x141020, rim: 0x241830, accent: 0xaa66ff,
      key: 0xc0a0e0, fill: 0x7755aa, rimLight: 0x6644aa,
      hill: 0x0c0814, stone: 0x2a2038, stoneDark: 0x120e18,
      path: 0x9977cc, allyStrip: 0x66aa88, foeStrip: 0xcc66aa,
      fogNear: 8, fogFar: 30, ambient: 0x9080a8, hemiSky: 0x8070a0,
      hasRunes: true, hasGem: true, hasBraziers: false, hasTorches: true, hasArch: false
    },
    ancient_temple: {
      id: 'ancient_temple', label: 'Ancient Temple', isArena: true,
      ground: 'stone', props: 'pillars', particles: 'dust',
      fog: 0x12100c, skyTop: 0x2a2418, skyBot: 0x0c0a08,
      floor: 0x2a2418, rim: 0x3a3428, accent: 0xd4b060,
      key: 0xffe8b0, fill: 0xccaa66, rimLight: 0xaa8844,
      hill: 0x1a1610, stone: 0x4a4030, stoneDark: 0x2a2418,
      path: 0xddbb77, allyStrip: 0x88cc88, foeStrip: 0xcc8866,
      fogNear: 10, fogFar: 36, ambient: 0xc0b090, hemiSky: 0xd0c0a0,
      hasRunes: true, hasGem: true, hasBraziers: true, hasTorches: true, hasArch: false
    },
    molten_core: {
      id: 'molten_core', label: 'Molten Core', isArena: true,
      ground: 'ash', props: 'spires', particles: 'ember',
      fog: 0x1a0a06, skyTop: 0x4a1810, skyBot: 0x120806,
      floor: 0x2a1410, rim: 0x3a1c14, accent: 0xff6622,
      key: 0xffcc88, fill: 0xff8844, rimLight: 0xff4422,
      hill: 0x140a08, stone: 0x3a2820, stoneDark: 0x1a100c,
      path: 0xff8844, allyStrip: 0xffaa55, foeStrip: 0xff4466,
      fogNear: 9, fogFar: 32, ambient: 0xd0a080, hemiSky: 0xffb080,
      hasRunes: true, hasGem: false, hasBraziers: true, hasTorches: true, hasArch: false
    },
    glacial_spire: {
      id: 'glacial_spire', label: 'Glacial Spire', isArena: true,
      ground: 'ice', props: 'crystals', particles: 'sparkle',
      fog: 0x0a141c, skyTop: 0x2a4a68, skyBot: 0x081018,
      floor: 0x1a3a58, rim: 0x2a5a7a, accent: 0xaaddff,
      key: 0xe8f4ff, fill: 0x88ccee, rimLight: 0x66aacc,
      hill: 0x101c28, stone: 0x4a6a88, stoneDark: 0x1a2838,
      path: 0xbbffff, allyStrip: 0x77ddff, foeStrip: 0xff99aa,
      fogNear: 10, fogFar: 36, ambient: 0xc0d8e8, hemiSky: 0xd0e8f8,
      hasRunes: true, hasGem: true, hasBraziers: false, hasTorches: false, hasArch: false
    },
    thunder_sanctum: {
      id: 'thunder_sanctum', label: 'Thunder Sanctum', isArena: true,
      ground: 'stone', props: 'obelisks', particles: 'sparkle',
      fog: 0x0c1018, skyTop: 0x1a2840, skyBot: 0x080c12,
      floor: 0x1a2438, rim: 0x2a3a58, accent: 0xffee66,
      key: 0xfff0c0, fill: 0xaaccff, rimLight: 0x6688ff,
      hill: 0x0e1420, stone: 0x3a4a60, stoneDark: 0x1a2030,
      path: 0xffee88, allyStrip: 0x88ccff, foeStrip: 0xffaa66,
      fogNear: 10, fogFar: 34, ambient: 0xb0c0d8, hemiSky: 0xc0d0e8,
      hasRunes: true, hasGem: true, hasBraziers: true, hasTorches: true, hasArch: false
    },
    abyssal_throne: {
      id: 'abyssal_throne', label: 'Abyssal Throne', isArena: true,
      ground: 'stone', props: 'pillars', particles: 'mist',
      fog: 0x06040c, skyTop: 0x140c20, skyBot: 0x040208,
      floor: 0x120c1c, rim: 0x221830, accent: 0xcc55ff,
      key: 0xd0a0ff, fill: 0x8866bb, rimLight: 0x7744aa,
      hill: 0x0a0610, stone: 0x2a1c38, stoneDark: 0x100c18,
      path: 0xaa66ff, allyStrip: 0x66ccaa, foeStrip: 0xff6688,
      fogNear: 8, fogFar: 30, ambient: 0x9070a8, hemiSky: 0x8060a0,
      hasRunes: true, hasGem: true, hasBraziers: true, hasTorches: true, hasArch: false
    },
    origin_core: {
      id: 'origin_core', label: 'Origin Core', isArena: true,
      ground: 'star', props: 'obelisks', particles: 'star',
      fog: 0x0a0814, skyTop: 0x2a2040, skyBot: 0x080610,
      floor: 0x1a1830, rim: 0x2a2850, accent: 0xffe8a0,
      key: 0xfff4d0, fill: 0xddccff, rimLight: 0xa080ff,
      hill: 0x100c1c, stone: 0x3a3860, stoneDark: 0x1a1830,
      path: 0xffe8aa, allyStrip: 0xaaddff, foeStrip: 0xffaadd,
      fogNear: 11, fogFar: 38, ambient: 0xc8c0e0, hemiSky: 0xd8d0f0,
      hasRunes: true, hasGem: true, hasBraziers: false, hasTorches: false, hasArch: false
    },
    // Boss raid arenas (themed to boss name / element)
    fire_dragon: {
      id: 'fire_dragon', label: 'Cinderwyrm Arena', isArena: true,
      ground: 'ash', props: 'spires', particles: 'ember',
      fog: 0x1a0804, skyTop: 0x4a1408, skyBot: 0x100604,
      floor: 0x2a1008, rim: 0x3a1810, accent: 0xff5522,
      key: 0xffbb77, fill: 0xff7733, rimLight: 0xff3311,
      hill: 0x140804, stone: 0x3a2018, stoneDark: 0x1a0c08,
      path: 0xff6622, allyStrip: 0xffaa55, foeStrip: 0xff3355,
      fogNear: 9, fogFar: 32, ambient: 0xd09070, hemiSky: 0xffa070,
      hasRunes: true, hasGem: true, hasBraziers: true, hasTorches: true, hasArch: false
    },
    stone_golem: {
      id: 'stone_golem', label: 'Ironmere Colossus Arena', isArena: true,
      ground: 'stone', props: 'pillars', particles: 'dust',
      fog: 0x121410, skyTop: 0x2a3028, skyBot: 0x0c100c,
      floor: 0x2a3028, rim: 0x3a4034, accent: 0xa09070,
      key: 0xe0d8c0, fill: 0xa8a088, rimLight: 0x889070,
      hill: 0x181c14, stone: 0x4a5040, stoneDark: 0x2a3020,
      path: 0xc0b090, allyStrip: 0x88bb88, foeStrip: 0xcc8866,
      fogNear: 10, fogFar: 36, ambient: 0xb8b8a0, hemiSky: 0xc8c8b0,
      hasRunes: true, hasGem: false, hasBraziers: true, hasTorches: true, hasArch: false
    },
    ancient_treant: {
      id: 'ancient_treant', label: 'Petrified Grove Arena', isArena: true,
      ground: 'moss', props: 'trees', particles: 'pollen',
      fog: 0x0a1810, skyTop: 0x1a3828, skyBot: 0x08120c,
      floor: 0x1a3428, rim: 0x2a4834, accent: 0x55dd77,
      key: 0xd0f0c0, fill: 0x77bb77, rimLight: 0x449966,
      hill: 0x0c2014, stone: 0x3a4a38, stoneDark: 0x1a2818,
      path: 0x77ee99, allyStrip: 0x44cc77, foeStrip: 0xff8866,
      fogNear: 10, fogFar: 34, ambient: 0xa8c8a8, hemiSky: 0xb0d0b0,
      hasRunes: true, hasGem: false, hasBraziers: false, hasTorches: true, hasArch: false
    },
    shadow_lich: {
      id: 'shadow_lich', label: 'Soft-Eater Arena', isArena: true,
      ground: 'stone', props: 'obelisks', particles: 'mist',
      fog: 0x080610, skyTop: 0x181020, skyBot: 0x040308,
      floor: 0x141018, rim: 0x241828, accent: 0x9966ff,
      key: 0xc0a0e8, fill: 0x7755aa, rimLight: 0x5533aa,
      hill: 0x0a0810, stone: 0x2a2038, stoneDark: 0x120e18,
      path: 0xaa77ff, allyStrip: 0x66aa99, foeStrip: 0xcc6699,
      fogNear: 8, fogFar: 30, ambient: 0x9080a8, hemiSky: 0x8070a0,
      hasRunes: true, hasGem: true, hasBraziers: true, hasTorches: true, hasArch: false
    },
    storm_sovereign: {
      id: 'storm_sovereign', label: 'Storm Geometry Arena', isArena: true,
      ground: 'stone', props: 'obelisks', particles: 'sparkle',
      fog: 0x0c1018, skyTop: 0x1a3048, skyBot: 0x080c12,
      floor: 0x1a2838, rim: 0x2a3a58, accent: 0x88ccff,
      key: 0xe0f0ff, fill: 0x88aadd, rimLight: 0x6688ff,
      hill: 0x0e1420, stone: 0x3a4a60, stoneDark: 0x1a2030,
      path: 0xaaddff, allyStrip: 0x77bbff, foeStrip: 0xffaa66,
      fogNear: 10, fogFar: 34, ambient: 0xb0c0d8, hemiSky: 0xc0d0e8,
      hasRunes: true, hasGem: true, hasBraziers: true, hasTorches: true, hasArch: false
    },
    divine_colossus: {
      id: 'divine_colossus', label: 'Prism Idol Arena', isArena: true,
      ground: 'star', props: 'obelisks', particles: 'star',
      fog: 0x0c0a14, skyTop: 0x2a2440, skyBot: 0x080610,
      floor: 0x1a1830, rim: 0x2a2850, accent: 0xffe8a0,
      key: 0xfff4d0, fill: 0xddccff, rimLight: 0xb0a0ff,
      hill: 0x100c1c, stone: 0x3a3860, stoneDark: 0x1a1830,
      path: 0xffe8aa, allyStrip: 0xaaddff, foeStrip: 0xffaadd,
      fogNear: 11, fogFar: 38, ambient: 0xc8c0e0, hemiSky: 0xd8d0f0,
      hasRunes: true, hasGem: true, hasBraziers: false, hasTorches: false, hasArch: false
    }
  };

  // Keep old name for any external refs
  var ARENA_THEMES = ZONE_THEMES;

  function elKey(el) {
    return String(el || 'water').toLowerCase();
  }

  function available() {
    return typeof global.THREE !== 'undefined';
  }

  function hashStr(s) {
    var h = 0;
    var str = String(s || '');
    var i;
    for (i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function cloneTheme(src) {
    var t = {};
    var k;
    for (k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) t[k] = src[k];
    }
    return t;
  }

  /**
   * Resolve campaign chapter zone (+ light stage variation).
   * opts: { region, zone, stage, dungeon, boss, arena }
   */
  function themeFromOpts(opts) {
    opts = opts || {};
    var stage = opts.stage || null;
    var region = String(
      opts.region ||
      opts.zone ||
      (stage && stage.region) ||
      ''
    ).toLowerCase();

    if (!region) {
      if (opts.dungeon || opts.boss) region = 'dungeon';
      else {
        var arenaKey = String(opts.arena || opts.theme || 'default').toLowerCase();
        if (arenaKey.indexOf('dungeon') >= 0 || arenaKey.indexOf('depth') >= 0) region = 'dungeon';
        else if (arenaKey.indexOf('crystal') >= 0) region = 'crystal';
        else if (arenaKey.indexOf('shadow') >= 0 || arenaKey.indexOf('fen') >= 0) region = 'shadowfen';
        else if (arenaKey.indexOf('volcan') >= 0 || arenaKey.indexOf('lava') >= 0) region = 'volcanic';
        else if (arenaKey.indexOf('celest') >= 0 || arenaKey.indexOf('star') >= 0) region = 'celestial';
        else if (arenaKey.indexOf('green') >= 0 || arenaKey.indexOf('wild') >= 0) region = 'greenwild';
        else region = 'default';
      }
    }

    // Map chapter aliases
    if (region === 'greenwild forest' || region === 'gw') region = 'greenwild';
    if (region === 'crystal mountains' || region === 'cm') region = 'crystal';
    if (region === 'shadowfen swamp' || region === 'sf') region = 'shadowfen';
    if (region === 'volcanic wastes' || region === 'vw') region = 'volcanic';
    if (region === 'celestial peaks' || region === 'cp') region = 'celestial';

    var base = ZONE_THEMES[region] || ZONE_THEMES.default;
    var theme = cloneTheme(base);

    // Per-stage flavor: tint accent/fog slightly so stages feel local within the chapter
    if (stage) {
      var el = elKey(stage.element);
      var elHex = ELEMENT_HEX[el];
      if (elHex != null) {
        // Soft-blend accent toward stage element
        theme.stageElement = el;
        theme.stageAccent = elHex;
        // Keep chapter accent primary; element used for path wash / motes
        theme.path = elHex;
      }
      var h = hashStr(stage.id || stage.name || '');
      // Boss stages: denser fog, brighter accent
      if (stage.boss) {
        theme.fogNear = Math.max(8, (theme.fogNear || 14) - 3);
        theme.hasGem = true;
        theme.hasRunes = true;
      }
      // Deterministic prop seed for layout jitter
      theme.seed = h;
      theme.stageName = stage.name || stage.id || '';
      theme.stageId = stage.id || '';
    } else {
      theme.seed = hashStr(
        region +
        ((opts.dungeon && opts.dungeon.id) || (opts.boss && opts.boss.id) || 'z')
      );
    }

    if (opts.dungeon) {
      var did = String(opts.dungeon.id || opts.zone || opts.region || '').toLowerCase();
      var dBase = DUNGEON_ARENA_THEMES[did] || ZONE_THEMES.dungeon;
      theme = cloneTheme(dBase);
      theme.isArena = true;
      theme.seed = hashStr(opts.dungeon.id || opts.dungeon.name || 'd');
      theme.stageName = opts.dungeon.name || theme.label || 'Dungeon';
      theme.dungeonId = did;
      var de = elKey(opts.dungeon.element);
      if (ELEMENT_HEX[de] != null) {
        theme.path = ELEMENT_HEX[de];
        theme.stageElement = de;
      }
    }
    if (opts.boss) {
      var bid = String(opts.boss.id || opts.zone || opts.region || '').toLowerCase();
      var bBase = DUNGEON_ARENA_THEMES[bid] || ZONE_THEMES.dungeon;
      theme = cloneTheme(bBase);
      theme.isArena = true;
      theme.seed = hashStr(opts.boss.id || opts.boss.name || 'b');
      theme.stageName = opts.boss.name || theme.label || 'Boss Raid';
      theme.dungeonId = bid;
      theme.hasGem = true;
      theme.hasRunes = true;
      var be = elKey(opts.boss.element);
      if (ELEMENT_HEX[be] != null) {
        theme.accent = ELEMENT_HEX[be];
        theme.path = ELEMENT_HEX[be];
        theme.stageElement = be;
      }
    }

    theme.envKey = resolveEnvKey(theme);
    // Natural monostand forest: one foliage family per battle (not mixed candy forest)
    theme.forestPalette = resolveForestPalette(theme);
    return theme;
  }

  /** Seeded pseudo-random 0..1 for stable per-stage prop placement */
  function seededRand(seed, n) {
    var x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  /**
   * Pick a single foliage monostand for tree battles.
   * green → mostly green trees; blue → mostly blue glow trees.
   * Silhouette variety within the pack is fine; mixed green+blue stands are not.
   */
  function resolveForestPalette(theme) {
    if (!theme) return 'green';
    var forced = theme.forestPalette || theme.treePalette;
    if (forced === 'green' || forced === 'blue') return forced;
    var id = String(theme.id || theme.dungeonId || '').toLowerCase();
    var seed = theme.seed || 1;
    // Mystic / crystal / night-peak chapters read as blue glow groves when trees appear
    var blueIds = {
      crystal: 1, celestial: 1, crystal_caverns: 1, glacial_spire: 1,
      thunder_sanctum: 1, origin_core: 1, divine_colossus: 1, storm_sovereign: 1
    };
    if (blueIds[id]) return 'blue';
    // Verdant forest chapters: green monostand by default; rare stable blue grove
    if (theme.props === 'trees' || id === 'greenwild' || id === 'forest_depths'
      || id === 'ancient_treant' || id === 'default') {
      // ~15% of stages are a blue-glow monostand (whole battle, not mixed)
      if (seededRand(seed, 901) > 0.85) return 'blue';
      return 'green';
    }
    return 'green';
  }

  /** Map theme id → env texture folder under assets/battle/env/ */
  function resolveEnvKey(theme) {
    if (!theme) return 'greenwild';
    if (theme.envKey) return theme.envKey;
    var id = String(theme.id || theme.dungeonId || '').toLowerCase();
    if (ZONE_THEMES[id] && !theme.isArena) return id;
    // Dungeon / boss → nearest kit
    var map = {
      forest_depths: 'greenwild',
      ancient_treant: 'greenwild',
      crystal_caverns: 'crystal',
      glacial_spire: 'crystal',
      shadow_abyss: 'shadowfen',
      abyssal_throne: 'shadowfen',
      shadow_lich: 'shadowfen',
      molten_core: 'volcanic',
      fire_dragon: 'volcanic',
      thunder_sanctum: 'celestial',
      origin_core: 'celestial',
      divine_colossus: 'celestial',
      storm_sovereign: 'celestial',
      ancient_temple: 'dungeon',
      stone_golem: 'dungeon',
      dungeon: 'dungeon'
    };
    if (map[id]) return map[id];
    if (theme.isArena) return 'dungeon';
    if (ZONE_THEMES[id]) return id;
    return 'greenwild';
  }

  var _texCache = {};
  /** Set from WebGLRenderer capabilities when arena boots */
  var _maxAnisotropy = 8;

  /** Apply sRGB + wrap settings shared by env maps */
  function finishEnvTexture(THREE, tex, opts) {
    if (!tex) return null;
    opts = opts || {};
    if (opts.repeat != null) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(opts.repeat, opts.repeat);
    } else {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }
    if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    else if (tex.encoding !== undefined && THREE.sRGBEncoding !== undefined) {
      tex.encoding = THREE.sRGBEncoding;
    }
    // Ground plates span a huge world floor — max anisotropy + mips keep them sharp
    var aniso = opts.ground
      ? Math.max(8, Math.min(16, _maxAnisotropy || 16))
      : Math.min(8, _maxAnisotropy || 8);
    if (tex.anisotropy !== undefined) tex.anisotropy = aniso;
    if (opts.ground) {
      if (THREE.LinearMipmapLinearFilter !== undefined) {
        tex.minFilter = THREE.LinearMipmapLinearFilter;
      }
      if (THREE.LinearFilter !== undefined) {
        tex.magFilter = THREE.LinearFilter;
      }
      tex.generateMipmaps = true;
    }
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Chroma-key studio backgrounds (hot pink / magenta / cyan / green) to alpha
   * so JPG prop cards cut out cleanly. Soft falloff + despill removes the
   * pink/purple fringe that hard keying leaves on anti-aliased edges.
   */
  function chromaKeyToTexture(THREE, image, opts) {
    opts = opts || {};
    var canvas = document.createElement('canvas');
    var w = image.naturalWidth || image.width;
    var h = image.naturalHeight || image.height;
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx || !w) return null;
    ctx.drawImage(image, 0, 0);
    var imgData;
    try {
      imgData = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      return null;
    }
    var d = imgData.data;
    var n = w * h;
    var alpha = new Float32Array(n);
    var i;
    var p;

    function screenScore(r, g, b) {
      /**
       * Studio key only — hot pink / magenta backdrop.
       * Must NOT eat crystal/prism purple, spirit pink, bandit skin, cream armor.
       */
      var mag = 0;
      var maxc = Math.max(r, g, b);
      var minc = Math.min(r, g, b);
      var sat = maxc - minc;
      var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // ——— Body protections (apply first) ———
      // Purple / indigo / crystal / void / spirit body: B clearly dominates R
      // (golem neon runes often have B≈R with higher G than pure studio — still protect interior purple when B>R)
      if (b > r + 12 && g > 35 && sat > 25) return 0;
      // Prism / crystal lavender gels: R+B high WITH real green (studio pink has g collapsed)
      // Fixes translucent Prism slimes in combat + champion detail chroma path
      if ((opts.gelKey || opts.magentaOnly) && lum > 48 && lum < 225 && sat > 28 &&
          r > 75 && b > 75 && g >= 50 && Math.abs(r - b) < 95 &&
          g > Math.min(r, b) * 0.22 &&
          !(g < 55 && r > 190 && b > 140 && (r - g) > 100)) {
        return 0;
      }
      // Blue-cyan gel body
      if (b > g + 15 && b > r + 20 && g > 50) return 0;
      // Warm fire / lava (high R, low B)
      if (r > 130 && g > 45 && b < 95 && (r - b) > 55) return 0;
      // Lightning / gold yellow body — keep solid (not salmon fringe)
      // Require low pink bias so gold AA into magenta is NOT protected
      if (r > 145 && g > 95 && b < 95 && (g - b) > 40 && (r - b) > 50 &&
          (Math.min(r, b) - g) < 8 && sat > 30) {
        return 0;
      }
      // Clean white / silver gel body (light/metal) — only true neutrals, no pink bias
      if (opts.gelKey && lum > 180 && sat < 36 && Math.abs(r - g) < 18 &&
          Math.abs(g - b) < 18 && Math.abs(r - b) < 22 &&
          (Math.min(r, b) - g) < 6 && r > 170 && g > 170 && b > 165) {
        return 0;
      }
      // Neutral skin / cloth (bandit face, leather) — mid sat, warm, NOT pink-magenta fringe
      // (earlier sat-only gate left hot-pink AA strips as "skin" → magenta bars beside golems)
      if (opts.enemyKey && lum > 40 && lum < 200 && sat < 90 &&
          r > 70 && g > 50 && b > 40 && Math.abs(r - g) < 70) {
        var pinkish = (Math.min(r, b) - g) > 12 && r > g + 18 && b > g + 12;
        var warmSkin = (r >= g - 8) && (g >= b - 18) && !pinkish;
        var leather = (r - b) > 22 && g > b * 0.85 && (Math.min(r, b) - g) < 8;
        if ((warmSkin || leather) && !pinkish) return 0;
      }
      // Cream armor / metal highlights (not pure letterbox white)
      if (opts.enemyKey && lum > 160 && lum < 235 && sat < 55 && g > 140 &&
          Math.abs(r - b) < 40) {
        return 0;
      }
      // Stone / moss golem greys-greens (low pink bias)
      if (opts.enemyKey && sat < 70 && g >= r - 15 && g >= b - 10 &&
          lum > 50 && lum < 190 && (Math.min(r, b) - g) < 5) {
        return 0;
      }

      // ——— True studio magenta / hot pink ———
      // Classic: high R+B, green much lower; R not far below B (studio pink, not purple)
      // Wolf: purple mud / pink drips share the key hue — we now KEY them aggressively
      // (acceptable art loss until beast plate is remade). Prefer clean silhouette.
      if (r > 145 && b > 120 && g < 105) {
        var gRel = g / Math.max(1, Math.min(r, b));
        if (gRel < 0.62 && (r - g) > 55 && (b - g) > 40) {
          mag = Math.min(1, ((r + b) * 0.5 - g * 1.55) / 120);
          // Pure studio #FF00AA-ish
          if (r > 200 && b > 160 && g < 90) mag = Math.max(mag, 0.97);
          if (r > 180 && b > 140 && g < 70 && (r - g) > 90) mag = Math.max(mag, 0.98);
          if (r > 220 && b > 200 && g < 50) mag = 1;
        }
      }
      // Near-#FF00FF solid key
      if (r > 230 && b > 220 && g < 45) mag = 1;
      // Enemy aggressive: studio hot pink field + residual AA (beast plate remade teal drips)
      if (opts.enemyKey) {
        // Hard studio field (measured beast BG ≈ 250,60,155)
        if (r > 185 && b > 110 && g < 95 && (r - g) > 70 && (b - g) > 30) {
          mag = Math.max(mag, 0.98);
        }
        // Mid pink AA fringe (blended edge into dark fur)
        if (r > 160 && b > 100 && g < 120 && (r - g) > 45 && (b - g) > 20 &&
            Math.min(r, b) - g > 18) {
          mag = Math.max(mag, Math.min(0.96, 0.6 + (Math.min(r, b) - g) / 70));
        }
        // Any remaining pink-magenta drip art (legacy plates) — key hard
        if (r > 140 && b > 90 && g < 105 && (r - g) > 35 && b <= r + 55 &&
            (Math.min(r, b) - g) > 18 && !(b > r + 20 && g > 50)) {
          mag = Math.max(mag, 0.9);
        }
        // Do NOT key teal/cyan slime accents (new wolf drips: high G+B, low R)
        if (g > 90 && b > 90 && r < 130 && (g + b) > r * 1.55) {
          mag = Math.min(mag, 0.05);
        }
      }

      // Soft AA fringe — gels/props: pink spill + dirty white-pink halo
      if (opts.gelKey || opts.propKey) {
        var spill = Math.min(r, b) - g;
        if (spill > 40 && r > 160 && b > 140 && g < 95 && b <= r + 15) {
          mag = Math.max(mag, Math.min(0.85, spill / 95));
        }
        // Dirty white / gold-adjacent pink fringe (light + gold gels) — hungrier
        if (opts.gelKey && lum > 130 && spill > 12 && r > 145 && b > 110 && g < 155 &&
            (r - g) > 16 && (b - g) > 8) {
          mag = Math.max(mag, Math.min(0.95, 0.45 + spill / 55));
        }
        // Soft glow AA: bright pink-tinted whites (cream light gels into studio BG)
        if (opts.gelKey && lum > 155 && r > 160 && b > 130 && g > 100 && g < 200 &&
            (r - g) > 10 && (b - g) > 6 && sat > 18) {
          mag = Math.max(mag, Math.min(0.92, 0.4 + ((r - g) + (b - g)) / 80));
        }
        // Salmon rim on gold plates (B raised into pink, not pure yellow low-B)
        if (opts.gelKey && r > 155 && g > 85 && b > 80 && b < 175 &&
            (r - g) > 22 && (g - b) < 50 && (r - b) < 100 && spill > 5) {
          mag = Math.max(mag, Math.min(0.9, 0.4 + (r - g) / 85));
        }
        // Gold plate with elevated B (common AA) — key even when G still high
        if (opts.gelKey && r > 170 && g > 100 && b > 95 && b < 160 &&
            (r - b) < 90 && (g - b) < 40 && (r - g) > 20) {
          mag = Math.max(mag, 0.72);
        }
      }
      // Enemy AA fringe — hungrier (includes mid pink)
      if (opts.enemyKey) {
        var spillE = Math.min(r, b) - g;
        if (spillE > 22 && r > 145 && b > 100 && g < 115 && b <= r + 40) {
          mag = Math.max(mag, Math.min(0.95, spillE / 70));
        }
      }

      // ——— Enemy body: green moss / dark fur / teal accents (beast wolf) ———
      if (opts.enemyKey) {
        // Dark green moss-fur body (not pink-mud)
        if (g > r + 8 && g > b + 5 && g > 45 && lum > 25 && lum < 180 && sat > 20 &&
            (Math.min(r, b) - g) < 10) {
          return 0;
        }
        // Teal glow / cyan slime drips on remade wolf (high G+B, low R)
        if (g > 75 && b > 75 && r < 140 && (g + b) > r * 1.5 && sat > 25 &&
            (Math.min(r, b) - g) < 15) {
          return 0;
        }
        // Near-black fur / outline
        if (lum < 55 && sat < 40 && g >= r - 5) return 0;
      }

      // Props (trees): still aggressive on pink fringe
      if (opts.propKey) {
        if (r > 150 && b > 150 && g < 100) mag = Math.max(mag, 0.99);
        if (r > 130 && b > 120 && g < 120 && (r - g) > 40 && (b - g) > 30) {
          mag = Math.max(mag, 0.9);
        }
        if (r > 220 && b > 200 && g < 40) mag = 1;
      }

      // Enemies: pure white letterbox pad only (very bright, low sat) — not armor cream
      if (opts.enemyKey) {
        if (lum > 242 && sat < 28 && r > 230 && g > 230 && b > 230) {
          mag = Math.max(mag, 0.95);
        }
      }

      // Combat gels: never cyan/green key
      if (opts.magentaOnly) return Math.min(1, mag);

      // Cyan / green screen (props only)
      var cy = 0;
      if (b > 140 && g > 120 && r < 140 && b > r + 25) {
        cy = Math.min(1, (b - r - 20) / 100);
      }
      var grn = 0;
      if (g > 150 && r < 120 && b < 120 && g > r + 35) {
        grn = Math.min(1, (g - Math.max(r, b) - 20) / 90);
      }
      return Math.max(mag, cy, grn);
    }

    function lumOf(r, g, b) {
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /**
     * Slime badge cutout: studio BGs are charcoal + soft blue-gray vignette + floor,
     * NOT a solid chroma screen. Flood-fill from image edges so only backdrop
     * connected to the border is removed (keeps dark eyes/core of the gel).
     */
    function cutoutDarkStudio() {
      var x;
      var y;
      var m = Math.max(4, Math.floor(Math.min(w, h) * 0.07));
      var corners = [];

      function sampleBox(x0, y0, x1, y1) {
        var sr = 0;
        var sg = 0;
        var sb = 0;
        var c = 0;
        var yy;
        var xx;
        for (yy = y0; yy < y1; yy += 2) {
          for (xx = x0; xx < x1; xx += 2) {
            var ii = (yy * w + xx) * 4;
            sr += d[ii];
            sg += d[ii + 1];
            sb += d[ii + 2];
            c++;
          }
        }
        if (!c) return { r: 20, g: 20, b: 24 };
        return { r: sr / c, g: sg / c, b: sb / c };
      }

      corners.push(sampleBox(0, 0, m, m));
      corners.push(sampleBox(w - m, 0, w, m));
      corners.push(sampleBox(0, h - m, m, h));
      corners.push(sampleBox(w - m, h - m, w, h));
      corners.push(sampleBox((w >> 1) - (m >> 1), 0, (w >> 1) + (m >> 1), m));
      corners.push(sampleBox((w >> 1) - (m >> 1), h - m, (w >> 1) + (m >> 1), h));
      corners.push(sampleBox(0, (h >> 1) - (m >> 1), m, (h >> 1) + (m >> 1)));
      corners.push(sampleBox(w - m, (h >> 1) - (m >> 1), w, (h >> 1) + (m >> 1)));

      function bgAffinity(r, g, b) {
        var lum = lumOf(r, g, b);
        var maxc = Math.max(r, g, b);
        var minc = Math.min(r, g, b);
        var sat = maxc - minc;
        var aff = 0;
        var si;

        // Near-black / charcoal studio
        if (lum < 28 && sat < 60) aff = 1;
        else if (lum < 48 && sat < 50) aff = Math.max(aff, 0.92);
        else if (lum < 68 && sat < 42) aff = Math.max(aff, 0.78);
        else if (lum < 88 && sat < 35) aff = Math.max(aff, 0.55);

        // Soft blue-gray / blue-white vignette (the square halo users see)
        if (sat < 50 && lum < 140 && b + 12 >= r && b + 6 >= g) {
          aff = Math.max(aff, 0.5 + (1 - sat / 50) * 0.45);
        }
        // Cool gray floor wash
        if (sat < 28 && lum < 100) {
          aff = Math.max(aff, 0.65 * (1 - lum / 100));
        }

        // Distance to corner/edge samples
        for (si = 0; si < corners.length; si++) {
          var s = corners[si];
          var dr = r - s.r;
          var dg = g - s.g;
          var db = b - s.b;
          var dist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (dist < 38) aff = Math.max(aff, 1 - dist / 38);
          else if (dist < 70) aff = Math.max(aff, 0.55 * (1 - (dist - 38) / 32));
        }

        // Protect vivid gel body (water cyan, plant green, fire orange…)
        if (sat > 60 && lum > 45 && lum < 230) aff = Math.min(aff, 0.08);
        if (sat > 80 && lum > 55) aff = 0;
        // Protect bright specular highlights on gel (high lum, any sat if not corner-like)
        if (lum > 160 && sat > 25) aff = Math.min(aff, 0.12);

        return aff;
      }

      var aff = new Float32Array(n);
      for (i = 0; i < n; i++) {
        p = i * 4;
        aff[i] = bgAffinity(d[p], d[p + 1], d[p + 2]);
      }

      // Flood-fill background from border only
      var isBg = new Uint8Array(n); // 1 = hard bg, 2 = soft fringe
      var queue = new Int32Array(n);
      var qh = 0;
      var qt = 0;

      function trySeed(x, y) {
        i = y * w + x;
        if (aff[i] >= 0.32 && !isBg[i]) {
          isBg[i] = 1;
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

      var dirs = [1, 0, -1, 0, 0, 1, 0, -1];
      while (qh < qt) {
        i = queue[qh++];
        var cx = i % w;
        var cy = (i / w) | 0;
        var di;
        for (di = 0; di < 8; di += 2) {
          var nx = cx + dirs[di];
          var ny = cy + dirs[di + 1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var ni = ny * w + nx;
          if (isBg[ni]) continue;
          if (aff[ni] >= 0.3) {
            isBg[ni] = 1;
            queue[qt++] = ni;
          } else if (aff[ni] >= 0.16) {
            isBg[ni] = 2; // fringe, don't flood through
          }
        }
      }

      // Dilate background 2px to eat anti-aliased square edge
      var dil = new Uint8Array(n);
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          i = y * w + x;
          if (isBg[i]) {
            dil[i] = isBg[i];
            continue;
          }
          var hit = 0;
          var dy;
          var dx;
          for (dy = -2; dy <= 2; dy++) {
            for (dx = -2; dx <= 2; dx++) {
              var nx2 = x + dx;
              var ny2 = y + dy;
              if (nx2 < 0 || ny2 < 0 || nx2 >= w || ny2 >= h) continue;
              if (isBg[ny2 * w + nx2] === 1) hit++;
            }
          }
          if (hit >= 3) dil[i] = 2;
        }
      }

      for (i = 0; i < n; i++) {
        p = i * 4;
        if (dil[i] === 1 || isBg[i] === 1) {
          alpha[i] = 0;
          d[p] = d[p + 1] = d[p + 2] = 0;
          d[p + 3] = 0;
        } else if (dil[i] === 2 || isBg[i] === 2) {
          var soft = Math.max(0, 1 - aff[i] * 1.4);
          alpha[i] = soft * 0.35;
          d[p + 3] = Math.round(alpha[i] * 255);
        } else {
          alpha[i] = 1;
          d[p + 3] = 255;
        }
      }
    }

    var alpha2 = alpha;
    var x;
    var y;

    if (opts.darkBg) {
      cutoutDarkStudio();
      alpha2 = alpha;
    } else {
      // Pass 1: soft alpha from chroma score
      // gel/enemy: only hard-cut true studio pink (preserve crystal / bandit body)
      // gels: hungrier hardCut so soft pink glow AA (light/gold plates) fully dies
      // enemy: hardCut so solid hot-pink fields (golem BG) fully die
      var hardCut = opts.propKey ? 0.52 : (opts.enemyKey ? 0.68 : (opts.gelKey ? 0.68 : 0.78));
      var softStart = opts.propKey ? 0.14 : ((opts.gelKey || opts.enemyKey) ? 0.28 : 0.22);
      var scoreMap = (opts.enemyKey || opts.gelKey) ? new Float32Array(n) : null;
      for (i = 0; i < n; i++) {
        p = i * 4;
        var score = screenScore(d[p], d[p + 1], d[p + 2]);
        if (scoreMap) scoreMap[i] = score;
        var a = 1 - score;
        if (score > hardCut) a = 0;
        else if (score > softStart) {
          a = Math.max(0, 1 - (score - softStart * 0.5) / (hardCut - softStart * 0.5 + 0.01));
        }
        alpha[i] = a;
      }

      // Enemy + gel: flood-fill studio pink from the border.
      // Critical for golem arm–body vertical corridor (hard pink must flood past body).
      // Gels: eats pink glow halo on light/gold plates.
      if (scoreMap && (opts.enemyKey || opts.gelKey)) {
        // Body-support is green/dark/warm NON-pink only (no longer shields pink drips)
        var bodySupport = new Uint8Array(n);
        for (i = 0; i < n; i++) {
          p = i * 4;
          var br = d[p];
          var bgc = d[p + 1];
          var bb = d[p + 2];
          var blum = 0.2126 * br + 0.7152 * bgc + 0.0722 * bb;
          var bspill = Math.min(br, bb) - bgc;
          if (opts.enemyKey) {
            // Green moss / dark fur / cream / warm skin — never pink-biased
            if (bspill < 12 && (bgc > br - 5 || blum < 85 ||
                (br > 70 && bgc > 55 && bb < 100 && (br - bb) > 15))) {
              if (!(br > 150 && bb > 100 && bgc < 115 && bspill > 18)) {
                bodySupport[i] = 1;
              }
            }
          } else if (opts.gelKey) {
            // True gold / clean white / cyan / prism body cores — block soft flood only
            var gGold = br > 150 && bgc > 105 && bb < 95 && (bgc - bb) > 40 && bspill < 6;
            var gWhite = blum > 185 && Math.abs(br - bgc) < 16 && Math.abs(bgc - bb) < 16 && bspill < 5;
            var gPrism = bgc >= 55 && br > 80 && bb > 80 && Math.abs(br - bb) < 90 &&
              bgc > Math.min(br, bb) * 0.24 && !(bgc < 55 && br > 200);
            var gCyan = bb > bgc + 15 && bb > br + 20 && bgc > 50;
            if ((gGold || gWhite || gPrism || gCyan) && bspill < 10) bodySupport[i] = 1;
          }
        }
        var isStudio = new Uint8Array(n);
        var q = new Int32Array(n);
        var qh = 0;
        var qt = 0;
        var seedTh = opts.gelKey ? 0.26 : 0.30;
        function seedEdge(sx, sy) {
          i = sy * w + sx;
          if (isStudio[i]) return;
          if (scoreMap[i] >= seedTh) {
            isStudio[i] = 1;
            q[qt++] = i;
          }
        }
        for (x = 0; x < w; x++) {
          seedEdge(x, 0);
          seedEdge(x, h - 1);
        }
        for (y = 0; y < h; y++) {
          seedEdge(0, y);
          seedEdge(w - 1, y);
        }
        while (qh < qt) {
          i = q[qh++];
          var cx = i % w;
          var cy = (i / w) | 0;
          var nb;
          for (nb = 0; nb < 4; nb++) {
            var nx = cx + (nb === 0 ? 1 : nb === 1 ? -1 : 0);
            var ny = cy + (nb === 2 ? 1 : nb === 3 ? -1 : 0);
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            var ni = ny * w + nx;
            if (isStudio[ni]) continue;
            var scN = scoreMap[ni];
            // Hard studio pink ALWAYS floods — even next to body (kills golem vertical bar)
            if (scN >= 0.52) {
              isStudio[ni] = 1;
              q[qt++] = ni;
              continue;
            }
            var touchBody = false;
            var tdx;
            var tdy;
            for (tdy = -1; tdy <= 1 && !touchBody; tdy++) {
              for (tdx = -1; tdx <= 1; tdx++) {
                if (!tdx && !tdy) continue;
                var tx = nx + tdx;
                var ty = ny + tdy;
                if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
                if (bodySupport[ty * w + tx]) touchBody = true;
              }
            }
            // Soft pink next to body: mark fringe, don't queue (preserve gel edge / moss)
            if (touchBody && scN < 0.52) {
              if (scN >= 0.22) isStudio[ni] = 2;
              continue;
            }
            if (scN >= (opts.gelKey ? 0.22 : 0.26)) {
              isStudio[ni] = 1;
              q[qt++] = ni;
            } else if (scN >= 0.12) {
              isStudio[ni] = 2; // soft fringe
            }
          }
        }
        for (i = 0; i < n; i++) {
          if (isStudio[i] === 1) alpha[i] = 0;
          else if (isStudio[i] === 2) alpha[i] = Math.min(alpha[i], opts.gelKey ? 0.05 : 0.06);
        }

        // Corridor / hole kill: thin vertical (or horizontal) magenta strips next to body
        // e.g. golem arm–torso gap that flood partially soft-tagged
        if (opts.enemyKey) {
          for (y = 1; y < h - 1; y++) {
            for (x = 1; x < w - 1; x++) {
              i = y * w + x;
              if (alpha[i] < 0.04) continue;
              if (scoreMap[i] < 0.35) continue;
              var aL = alpha[y * w + (x - 1)];
              var aR = alpha[y * w + (x + 1)];
              var aU = alpha[(y - 1) * w + x];
              var aD = alpha[(y + 1) * w + x];
              // Vertical bar: open L+R, solid-ish U/D or open
              if (aL < 0.2 && aR < 0.2 && scoreMap[i] >= 0.35) {
                alpha[i] = 0;
                continue;
              }
              // Horizontal seam
              if (aU < 0.2 && aD < 0.2 && scoreMap[i] >= 0.4) {
                alpha[i] = 0;
                continue;
              }
              // Isolated high-score pocket (3+ transparent 4-neighbors)
              var openN = (aL < 0.15 ? 1 : 0) + (aR < 0.15 ? 1 : 0) +
                (aU < 0.15 ? 1 : 0) + (aD < 0.15 ? 1 : 0);
              if (openN >= 3 && scoreMap[i] >= 0.3) alpha[i] = 0;
            }
          }
        }
      }

      // Pass 2: erode fringe — gentler on gels; enemies a touch firmer to clear pink bars
      var erodeRad = opts.propKey ? 2 : 1;
      var erodeKill = opts.propKey ? 3 : (opts.gelKey ? 5 : (opts.enemyKey ? 4 : 4));
      var erodeSoft = opts.propKey ? 2 : (opts.gelKey ? 4 : (opts.enemyKey ? 3 : 3));
      alpha2 = new Float32Array(n);
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          i = y * w + x;
          if (alpha[i] < 0.05) {
            alpha2[i] = 0;
            continue;
          }
          var kill = 0;
          var samples = 0;
          var dy;
          var dx;
          for (dy = -erodeRad; dy <= erodeRad; dy++) {
            for (dx = -erodeRad; dx <= erodeRad; dx++) {
              if (!dx && !dy) continue;
              var nx = x + dx;
              var ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              samples++;
              if (alpha[ny * w + nx] < 0.22) kill++;
            }
          }
          if (samples >= 5 && kill >= erodeKill) alpha2[i] = 0;
          else if (samples >= 5 && kill >= erodeSoft) alpha2[i] = alpha[i] * (opts.propKey ? 0.2 : 0.35);
          else alpha2[i] = alpha[i];
        }
      }

      // Prop trees: second light erode + kill residual pink edge pixels
      if (opts.propKey) {
        var alpha3 = new Float32Array(n);
        for (y = 0; y < h; y++) {
          for (x = 0; x < w; x++) {
            i = y * w + x;
            if (alpha2[i] < 0.08) {
              alpha3[i] = 0;
              continue;
            }
            p = i * 4;
            var rr = d[p];
            var gg = d[p + 1];
            var bb = d[p + 2];
            var spillE = Math.min(rr, bb) - gg;
            // Semi-transparent + still pink → drop
            if (alpha2[i] < 0.78 && spillE > 18 && rr > 90 && bb > 85) {
              alpha3[i] = 0;
              continue;
            }
            var kill2 = 0;
            var samp2 = 0;
            for (dy = -1; dy <= 1; dy++) {
              for (dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                nx = x + dx;
                ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                samp2++;
                if (alpha2[ny * w + nx] < 0.25) kill2++;
              }
            }
            if (samp2 >= 5 && kill2 >= 4) alpha3[i] = 0;
            else if (samp2 >= 5 && kill2 >= 3 && spillE > 10) alpha3[i] = alpha2[i] * 0.15;
            else alpha3[i] = alpha2[i];
          }
        }
        alpha2 = alpha3;
      }

      // Pass 3: write alpha + despill magenta from edge RGB
      for (i = 0; i < n; i++) {
        p = i * 4;
        var aOut = alpha2[i];
        if (aOut < (opts.propKey ? 0.08 : (opts.gelKey ? 0.05 : 0.04))) {
          d[p] = d[p + 1] = d[p + 2] = 0;
          d[p + 3] = 0;
          continue;
        }
        var r = d[p];
        var g = d[p + 1];
        var b = d[p + 2];
        var spill = Math.max(0, Math.min(r, b) - g);
        // Props: despill even near-opaque edge pixels that still carry pink
        if (opts.propKey) {
          if (spill > 5) {
            var pullP = spill * (aOut < 0.98 ? 1.15 : 0.55) + spill * 0.2;
            d[p] = Math.max(0, Math.min(255, r - pullP));
            d[p + 2] = Math.max(0, Math.min(255, b - pullP * 0.9));
            d[p + 1] = Math.max(0, Math.min(255, g + pullP * 0.12));
            r = d[p]; g = d[p + 1]; b = d[p + 2];
            spill = Math.max(0, Math.min(r, b) - g);
          }
          // Kill stubborn pink semi-edge after despill
          if (aOut < 0.85 && spill > 14) {
            d[p] = d[p + 1] = d[p + 2] = 0;
            d[p + 3] = 0;
            continue;
          }
        } else if (opts.gelKey || opts.enemyKey) {
          // Despill near edges; enemies: also kill remaining pink/purple mud
          var purpleBody = (b > r + 18 && g > 40 && (Math.min(r, b) - g) < 15);
          var warmBody = (r > 140 && g > 50 && b < 95 && (r - b) > 55 &&
            (Math.min(r, b) - g) < 12);
          var goldBody = opts.gelKey && r > 150 && g > 105 && b < 95 &&
            (g - b) > 40 && (r - b) > 50 && spill < 6;
          var cleanWhite = opts.gelKey && lumOf(r, g, b) > 185 &&
            Math.abs(r - g) < 16 && Math.abs(g - b) < 16 && spill < 5 &&
            r > 170 && g > 170 && b > 165;
          // Enemy: NO longer protect body pink (mud/drips may clip)
          if (!purpleBody && !warmBody && !goldBody && !cleanWhite &&
              (aOut < 0.92 || opts.enemyKey) && spill > 14) {
            var pullG = spill * (opts.enemyKey ? 0.95 : (1 - aOut) * 0.95);
            if (opts.enemyKey) pullG *= (aOut < 0.85 ? 1.35 : 1.05);
            if (opts.gelKey && aOut < 0.9) pullG *= 1.15;
            d[p] = Math.max(0, Math.min(255, r - pullG * 0.55));
            d[p + 2] = Math.max(0, Math.min(255, b - pullG * 0.9));
            d[p + 1] = Math.max(0, Math.min(255, g + pullG * 0.1));
            r = d[p]; g = d[p + 1]; b = d[p + 2];
            spill = Math.max(0, Math.min(r, b) - g);
          }
          // Drop nearly-gone fringe still screaming studio pink
          if (aOut < 0.42 && spill > 28 && r > 160 && b > 130 && g < 110) {
            d[p] = d[p + 1] = d[p + 2] = 0;
            d[p + 3] = 0;
            continue;
          }
          // Enemy: kill residual pink / purple-mud halo (aggressive — clips mud)
          if (opts.enemyKey && spill > 18 && r > 145 && b > 95 && g < 115 &&
              (r - g) > 35 && b <= r + 45) {
            // Fully drop semi-edge; strong despill on opaque mud remnants
            if (aOut < 0.88) {
              d[p] = d[p + 1] = d[p + 2] = 0;
              d[p + 3] = 0;
              continue;
            }
            // Opaque mud: still pull hard toward neutral (may look duller — OK)
            d[p] = Math.max(0, Math.min(255, r - spill * 0.7));
            d[p + 2] = Math.max(0, Math.min(255, b - spill * 0.75));
            d[p + 1] = Math.max(0, Math.min(255, g + spill * 0.2));
          }
          // Gel: dirty white / gold fringe with residual pink → drop or despill hard
          if (opts.gelKey && !goldBody && !cleanWhite) {
            var gelLum = lumOf(r, g, b);
            var pinkB = (r > g + 10 && b > g + 8) ? Math.min(r - g, b - g) : 0;
            // Any semi-edge still pink → kill (light/gold glow AA)
            if (aOut < 0.95 && pinkB > 12 && r > 145 && b > 115) {
              d[p] = d[p + 1] = d[p + 2] = 0;
              d[p + 3] = 0;
              continue;
            }
            // Opaque but pink-tinted bright edge → hard despill or drop
            if (gelLum > 140 && pinkB > 10 && spill > 8) {
              if (aOut < 0.98 && pinkB > 18) {
                d[p] = d[p + 1] = d[p + 2] = 0;
                d[p + 3] = 0;
                continue;
              }
              d[p] = Math.max(0, Math.min(255, r - pinkB * 0.75));
              d[p + 2] = Math.max(0, Math.min(255, b - pinkB * 0.7));
              d[p + 1] = Math.max(0, Math.min(255, g + pinkB * 0.2));
            }
            // Neighbor to transparency + any pink → kill (halo cleanup)
            if (aOut > 0.05 && pinkB > 8 && r > 140) {
              var edgeTouch = false;
              var ex = i % w;
              var ey = (i / w) | 0;
              var e4;
              for (e4 = 0; e4 < 4 && !edgeTouch; e4++) {
                var ex2 = ex + (e4 === 0 ? 1 : e4 === 1 ? -1 : 0);
                var ey2 = ey + (e4 === 2 ? 1 : e4 === 3 ? -1 : 0);
                if (ex2 < 0 || ey2 < 0 || ex2 >= w || ey2 >= h) { edgeTouch = true; break; }
                if (alpha2[ey2 * w + ex2] < 0.2) edgeTouch = true;
              }
              if (edgeTouch && pinkB > 10) {
                d[p] = d[p + 1] = d[p + 2] = 0;
                d[p + 3] = 0;
                continue;
              }
            }
          }
          // Enemy residual: hard-kill any remaining true studio pink (golem bar leftovers)
          if (opts.enemyKey && spill > 22 && r > 160 && b > 120 && g < 100 &&
              (r - g) > 50 && (b - g) > 30) {
            d[p] = d[p + 1] = d[p + 2] = 0;
            d[p + 3] = 0;
            continue;
          }
        } else if (aOut < 0.95) {
          if (spill > 8) {
            var pull = spill * (1 - aOut) * 0.95 + spill * 0.25;
            d[p] = Math.max(0, Math.min(255, r - pull));
            d[p + 2] = Math.max(0, Math.min(255, b - pull * 0.85));
            d[p + 1] = Math.max(0, Math.min(255, g + pull * 0.15));
          }
        }
        d[p + 3] = Math.round(aOut * 255);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    var tex = new THREE.CanvasTexture(canvas);
    tex.flipY = true;
    if (THREE.RGBAFormat !== undefined) tex.format = THREE.RGBAFormat;
    return finishEnvTexture(THREE, tex, opts);
  }

  function loadEnvTexture(THREE, url, opts) {
    opts = opts || {};
    // Always version battle art URLs (bust sticky browser cache of old ground/trees/foes)
    url = artUrl(url);
    var cacheKey = url + (opts.chroma ? '|chroma' : '') + (opts.darkBg ? '|dark' : '') +
      (opts.magentaOnly ? '|magOnly' : '') +
      (opts.gelKey ? '|gelKey8' : '') +
      (opts.propKey ? '|propKey2' : '') +
      (opts.enemyKey ? '|enemyKey8' : '') +
      (opts.ground ? '|ground2k' : '') +
      (opts.cutout ? '|' + opts.cutout : '') +
      (opts.repeat != null ? '|r' + opts.repeat : '');
    if (_texCache[cacheKey]) return _texCache[cacheKey];
    var tex = null;
    try {
      var loader = new THREE.TextureLoader();
      // Avoid browser reusing stale decoded bitmaps for same path without query
      if (loader.setWithCredentials) { /* no-op keep API */ }
      if (opts.chroma) {
        // Placeholder until image arrives; material map updates when ready
        tex = new THREE.Texture();
        tex.userData = tex.userData || {};
        loader.load(
          url,
          function (loaded) {
            var img = loaded.image;
            var keyed = chromaKeyToTexture(THREE, img, opts);
            if (keyed) {
              tex.image = keyed.image;
              tex.format = keyed.format;
              finishEnvTexture(THREE, tex, { repeat: null });
              tex.needsUpdate = true;
              tex.userData.loadOk = true;
              _texCache[cacheKey] = tex;
            } else {
              tex.image = img;
              finishEnvTexture(THREE, tex, opts);
              tex.needsUpdate = true;
              tex.userData.loadOk = true;
            }
          },
          undefined,
          function () {
            tex.userData.failed = true;
            delete _texCache[cacheKey];
          }
        );
      } else {
        tex = loader.load(
          url,
          function () {
            if (tex) tex.userData = tex.userData || {}, tex.userData.loadOk = true;
          },
          undefined,
          function () {
            if (tex) tex.userData = tex.userData || {}, tex.userData.failed = true;
            delete _texCache[cacheKey];
          }
        );
        finishEnvTexture(THREE, tex, opts);
      }
    } catch (e) {
      return null;
    }
    _texCache[cacheKey] = tex;
    return tex;
  }

  function envUrls(envKey, opts) {
    opts = opts || {};
    if (global.SR_ART && typeof global.SR_ART.envUrls === 'function') {
      return global.SR_ART.envUrls(envKey, opts);
    }
    var ver = (global.SR_ART && global.SR_ART.ART_CACHE_VER) || '1';
    var base = 'assets/battle/env/' + envKey + '/';
    var palette = opts.forestPalette || opts.palette || null;
    var stems;
    if (global.SR_ART && typeof global.SR_ART.forestPropStems === 'function') {
      stems = global.SR_ART.forestPropStems(palette, envKey);
    } else if (palette === 'green' && envKey === 'greenwild') {
      stems = ['prop_green', 'prop_green_b', 'prop_green_c', 'prop_green_d', 'prop_green_e'];
    } else if (palette === 'blue' && envKey === 'greenwild') {
      stems = ['prop_blue', 'prop_blue_b', 'prop_blue_c', 'prop_blue_d', 'prop_blue_e'];
    } else {
      stems = ['prop', 'prop_b', 'prop_c', 'prop_d', 'prop_e'];
    }
    var props = [];
    var i;
    for (i = 0; i < stems.length; i++) {
      props.push(base + stems[i] + '.jpg?srv=' + ver);
    }
    return {
      ground: base + 'ground.jpg?srv=' + ver,
      sky: base + 'sky.jpg?srv=' + ver,
      prop: props[0],
      props: props,
      forestPalette: palette
    };
  }

  function artUrl(path) {
    if (global.SR_ART && typeof global.SR_ART.assetUrl === 'function') {
      return global.SR_ART.assetUrl(path);
    }
    return path;
  }

  /** Textured sky dome (painted plate) — falls back to gradient dome */
  function makeTexturedSky(THREE, theme, skyTex) {
    if (!skyTex) return makeSkyDome(THREE, theme);
    var geo = new THREE.SphereGeometry(88, 56, 32);
    var mat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false
    });
    return new THREE.Mesh(geo, mat);
  }

  /** Camera-facing prop billboard (tree / rock / pillar card) */
  function makePropBillboard(THREE, propTex, scale) {
    scale = scale || 4.5;
    var mat = new THREE.SpriteMaterial({
      map: propTex,
      transparent: true,
      // High alphaTest kills residual magenta fringe after hard prop key
      alphaTest: 0.62,
      depthWrite: true,
      fog: true,
      sizeAttenuation: true
    });
    var spr = new THREE.Sprite(mat);
    // Trees should tower over gel sprites (~2u tall) — full scale, not skinny cards
    spr.scale.set(scale * 0.95, scale, 1);
    if (spr.center) spr.center.set(0.5, 0);
    else if (spr.material) {
      try { spr.center = new THREE.Vector2(0.5, 0); } catch (e) { /* ignore */ }
    }
    return spr;
  }

  /** Cached soft alpha maps for ground contact shadows (sprites can't cast maps). */
  var _propShadowTex = { tree: null, crystal: null, reed: null, spire: null };
  /** prop texture uuid → darkened silhouette canvas texture for ground cast */
  var _propSilhouetteShadow = {};

  function _paintSoftEllipse(ctx, cx, cy, rx, ry, a0) {
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(0,0,0,' + a0 + ')');
    g.addColorStop(0.42, 'rgba(0,0,0,' + (a0 * 0.55) + ')');
    g.addColorStop(0.75, 'rgba(0,0,0,' + (a0 * 0.16) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    if (ctx.ellipse) ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    else {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx, ry);
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.restore();
    }
    ctx.fill();
  }

  /**
   * Build a top-down alpha silhouette for env props.
   * tree: irregular crown + trunk stem (fallback when prop art isn't ready).
   */
  function getPropShadowTexture(THREE, kind) {
    kind = kind || 'tree';
    if (_propShadowTex[kind]) return _propShadowTex[kind];
    if (typeof document === 'undefined') return null;
    var c = document.createElement('canvas');
    c.width = 384;
    c.height = 384;
    var ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, 384, 384);

    if (kind === 'tree' || kind === 'trees' || kind === 'tree_canopy') {
      // HIGH-SUN top-down canopy footprint (not a tall side-view tree).
      // Dense crown blob near center — real trees cast mostly foliage from overhead.
      _paintSoftEllipse(ctx, 192, 200, 138, 118, 0.52);
      _paintSoftEllipse(ctx, 150, 185, 78, 72, 0.4);
      _paintSoftEllipse(ctx, 238, 190, 82, 70, 0.4);
      _paintSoftEllipse(ctx, 175, 235, 70, 58, 0.36);
      _paintSoftEllipse(ctx, 220, 230, 68, 55, 0.34);
      _paintSoftEllipse(ctx, 192, 155, 90, 62, 0.32);
      _paintSoftEllipse(ctx, 120, 210, 48, 42, 0.26);
      _paintSoftEllipse(ctx, 268, 208, 50, 44, 0.26);
      // Tiny trunk contact under center (high sun almost no stem cast)
      _paintSoftEllipse(ctx, 192, 248, 18, 14, 0.28);
    } else if (kind === 'crystal' || kind === 'crystals') {
      _paintSoftEllipse(ctx, 192, 170, 48, 120, 0.5);
      _paintSoftEllipse(ctx, 192, 140, 70, 52, 0.3);
      _paintSoftEllipse(ctx, 192, 280, 30, 20, 0.32);
    } else if (kind === 'reed' || kind === 'reeds') {
      _paintSoftEllipse(ctx, 175, 190, 18, 95, 0.42);
      _paintSoftEllipse(ctx, 205, 180, 16, 88, 0.38);
      _paintSoftEllipse(ctx, 192, 200, 22, 75, 0.3);
      _paintSoftEllipse(ctx, 192, 300, 40, 18, 0.3);
    } else if (kind === 'spire' || kind === 'obelisk' || kind === 'obelisks' || kind === 'spires') {
      _paintSoftEllipse(ctx, 192, 160, 36, 120, 0.48);
      _paintSoftEllipse(ctx, 192, 300, 48, 24, 0.34);
    } else {
      _paintSoftEllipse(ctx, 192, 192, 120, 95, 0.42);
    }

    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    tex.premultiplyAlpha = false;
    _propShadowTex[kind] = tex;
    return tex;
  }

  /**
   * Build a pure-black silhouette texture from a prop billboard map
   * (keeps alpha of the tree art → ground stamp looks like a real tree shadow).
   */
  function getSilhouetteShadowFromProp(THREE, propTex) {
    if (!propTex || !propTex.image) return null;
    var uid = propTex.uuid || propTex.id || '';
    if (uid && _propSilhouetteShadow[uid]) return _propSilhouetteShadow[uid];
    if (typeof document === 'undefined') return null;
    var img = propTex.image;
    var iw = img.naturalWidth || img.width || 0;
    var ih = img.naturalHeight || img.height || 0;
    if (!iw || !ih) return null;
    try {
      var c = document.createElement('canvas');
      // Cap size for perf; keep aspect
      var maxSide = 256;
      var sc = Math.min(1, maxSide / Math.max(iw, ih));
      c.width = Math.max(32, Math.floor(iw * sc));
      c.height = Math.max(32, Math.floor(ih * sc));
      var ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      var data = ctx.getImageData(0, 0, c.width, c.height);
      var d = data.data;
      var i;
      for (i = 0; i < d.length; i += 4) {
        var a = d[i + 3];
        // Keep alpha; force pure black RGB so it reads as shadow
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        // Soften fringe slightly so ground stamp isn't hard-edged
        if (a > 8 && a < 200) d[i + 3] = Math.floor(a * 0.85);
        else if (a <= 8) d[i + 3] = 0;
      }
      ctx.putImageData(data, 0, 0);
      var tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      tex.premultiplyAlpha = false;
      tex.flipY = propTex.flipY !== false;
      if (uid) _propSilhouetteShadow[uid] = tex;
      return tex;
    } catch (e) {
      return null;
    }
  }

  /**
   * Soft contact shadow under env props (sprites cannot cast light maps).
   * Trees: HIGH SUN — short, smooshed canopy footprint (top-down crown), not a
   * long side-view silhouette. Slight lean away from key light only.
   * Never offset the root off the trunk; never random-yaw the cast.
   *
   * @param {object} [opts] — { propTex, treeH, treeW, flipX }
   */
  function makePropContactShadow(THREE, radius, opacity, kind, opts) {
    opts = opts || {};
    radius = Math.max(0.55, radius || 1.4);
    opacity = opacity != null ? opacity : 0.75;
    kind = kind || 'blob';

    var mapKind = kind;
    if (kind === 'trees') mapKind = 'tree';
    if (kind === 'crystals') mapKind = 'crystal';
    if (kind === 'reeds') mapKind = 'reed';
    if (kind === 'obelisks' || kind === 'pillars' || kind === 'spires') mapKind = 'spire';

    // Key light is high (y≈18 vs xz≈12) → short ground cast, mostly canopy blob
    var castDx = -8;
    var castDz = -9;
    var castHLen = Math.sqrt(castDx * castDx + castDz * castDz) || 1;
    castDx /= castHLen;
    castDz /= castHLen;
    var castYaw = Math.atan2(castDx, castDz);

    var root = new THREE.Group();
    root.userData.isPropShadow = true;
    root.position.set(0, 0, 0);

    function groundMat(mOpts) {
      mOpts = mOpts || {};
      return new THREE.MeshBasicMaterial({
        color: mOpts.color != null ? mOpts.color : 0x000000,
        map: mOpts.map || null,
        transparent: true,
        opacity: mOpts.opacity != null ? mOpts.opacity : 0.45,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        alphaTest: mOpts.alphaTest != null ? mOpts.alphaTest : 0
      });
    }

    /**
     * Flat ground stamp. For high-sun canopy: nearly circular blob centered
     * on trunk with only a small offset along cast direction.
     */
    function addGroundStamp(parent, map, spanX, spanZ, y, opac, alphaTest, zOff, rotZ) {
      var mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        groundMat({
          map: map,
          opacity: opac,
          alphaTest: alphaTest != null ? alphaTest : 0.08
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      if (rotZ) mesh.rotation.z = rotZ;
      mesh.scale.set(spanX, spanZ, 1);
      if (opts.flipX) mesh.scale.x *= -1;
      mesh.position.set(0, y, zOff != null ? zOff : 0);
      parent.add(mesh);
      return mesh;
    }

    // —— TREE: high-sun canopy footprint (not elongated trunk→crown cast) ——
    if (mapKind === 'tree') {
      var tw = opts.treeW != null ? opts.treeW : radius * 2.1;
      // Canopy diameter on ground ≈ billboard width (top-down crown)
      var canopyD = Math.max(radius * 1.35, tw * 0.72);
      // High sun: cast length only a hair longer than canopy (slight smear, not tree-height)
      var smear = canopyD * 0.18;
      var spanX = canopyD * 1.02;
      var spanZ = canopyD * 0.92 + smear;

      var castG = new THREE.Group();
      castG.rotation.y = castYaw;
      root.add(castG);

      // Prefer top-down canopy stamp; prop side-silhouette would look like a long shadow
      var canopyTex = getPropShadowTexture(THREE, 'tree_canopy');
      // Soft contact under trunk (tiny)
      var foot = new THREE.Mesh(
        new THREE.CircleGeometry(1, 24),
        groundMat({ opacity: Math.min(0.28, opacity * 0.3) })
      );
      foot.rotation.x = -Math.PI / 2;
      foot.position.set(0, 0.05, 0);
      foot.scale.set(radius * 0.32, radius * 0.24, 1);
      foot.renderOrder = 1;
      root.add(foot);

      // Main canopy blob: almost centered, slight lean away from sun
      var zOff = smear * 0.55;
      if (canopyTex) {
        var cast = addGroundStamp(
          castG, canopyTex, spanX, spanZ, 0.085,
          Math.min(0.7, opacity * 0.92), 0.06, zOff, 0
        );
        cast.renderOrder = 3;
        var blur = addGroundStamp(
          castG, canopyTex, spanX * 1.14, spanZ * 1.12, 0.07,
          Math.min(0.26, opacity * 0.32), 0.04, zOff * 1.05, 0.15
        );
        blur.renderOrder = 2;
      } else {
        // Procedural fallback lobes
        var disc = new THREE.Mesh(
          new THREE.CircleGeometry(1, 36),
          groundMat({ opacity: Math.min(0.55, opacity * 0.7) })
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(0, 0.08, zOff);
        disc.scale.set(spanX * 0.52, spanZ * 0.48, 1);
        castG.add(disc);
      }
      return root;
    }

    // —— Generic / non-tree props ——
    var discR = radius * 0.85;
    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 36),
      groundMat({ opacity: Math.min(0.48, opacity * 0.65) })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, 0.06, 0);
    disc.scale.set(discR * 1.25, discR * 0.82, 1);
    disc.renderOrder = 1;
    root.add(disc);

    var tex = (mapKind !== 'blob') ? getPropShadowTexture(THREE, mapKind) : null;
    if (tex) {
      var castG2 = new THREE.Group();
      castG2.rotation.y = castYaw;
      root.add(castG2);
      var sx = radius * (mapKind === 'crystal' ? 1.15 : 1.35);
      // Short stamps for all props (high sun)
      var sz = radius * (mapKind === 'reed' ? 1.15 : 1.05);
      var stamp = addGroundStamp(
        castG2, tex, sx * 1.1, sz, 0.08,
        Math.min(0.75, opacity), 0.04, sz * 0.12, Math.PI
      );
      stamp.renderOrder = 2;
    }

    var halo = new THREE.Mesh(
      new THREE.CircleGeometry(1, 28),
      groundMat({ opacity: 0.16 })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(0, 0.05, 0);
    halo.scale.set(discR * 1.65, discR * 1.15, 1);
    halo.renderOrder = 0;
    root.add(halo);

    return root;
  }

  function makeWobblyGeo(THREE, segs) {
    segs = segs || 56;
    var geo = new THREE.SphereGeometry(1, segs, Math.floor(segs * 0.75));
    var pos = geo.attributes.position;
    var i;
    for (i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var y = pos.getY(i);
      var z = pos.getZ(i);
      var ny = y * 0.76 - 0.1;
      var widen = 1.06 + Math.max(0, -y) * 0.18;
      pos.setXYZ(i, x * widen, ny, z * 0.93);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  /** Procedural sky gradient on a large inward sphere */
  function makeSkyDome(THREE, theme) {
    var geo = new THREE.SphereGeometry(90, 36, 22);
    var cols = [];
    var pos = geo.attributes.position;
    var cTop = new THREE.Color(theme.skyTop);
    var cBot = new THREE.Color(theme.skyBot);
    var i;
    for (i = 0; i < pos.count; i++) {
      var y = pos.getY(i);
      var t = Math.max(0, Math.min(1, (y + 16) / 50));
      var c = cBot.clone().lerp(cTop, t * t);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    var mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false
    });
    return new THREE.Mesh(geo, mat);
  }

  var ENEMY_KINDS = [
    'beast', 'golem', 'humanoid', 'dragon', 'undead', 'plant', 'insect', 'elemental'
  ];

  function enemyImpostorUrl(kind) {
    var k = String(kind || 'beast').toLowerCase();
    if (ENEMY_KINDS.indexOf(k) < 0) k = 'beast';
    return artUrl('assets/battle/enemies/' + k + '.jpg');
  }

  /** Load painted enemy card with chroma-key (shared prop pipeline). */
  function loadEnemyImpostor(THREE, kind) {
    return loadEnvTexture(THREE, enemyImpostorUrl(kind), {
      chroma: true,
      magentaOnly: true,
      enemyKey: true
    });
  }

  /**
   * Painted impostor sprite for hard-realm foes (Phase 3).
   * Falls through to mesh silhouette if texture missing.
   */
  function createEnemyImpostorFigure(THREE, unit, kind, tint, tintColor) {
    var tex = loadEnemyImpostor(THREE, kind);
    if (!tex) return null;
    var artReady = !!(tex.userData && tex.userData.loadOk && tex.image);

    var root = new THREE.Group();
    // Soft element wash — keep art readable, slight kind color
    var mul = tintColor.clone().lerp(new THREE.Color(0xffffff), 0.55);
    var mat = new THREE.SpriteMaterial({
      map: tex,
      color: mul,
      transparent: true,
      // Low alphaTest — body must not vanish where paint is soft
      alphaTest: 0.12,
      depthWrite: true,
      fog: true,
      sizeAttenuation: true
    });
    // Fake emissive for hit/active pulse (sprites have no emissiveIntensity)
    mat.emissiveIntensity = 0;
    var baseColor = mul.clone();

    var spr = new THREE.Sprite(mat);
    // Fixed native plate heights — absolute world size applied as root scale at spawn
    var kindH = {
      insect: 1.70, beast: 2.00, humanoid: 2.20, undead: 2.25,
      elemental: 2.20, plant: 2.45, dragon: 2.55, golem: 2.75
    };
    var kindW = {
      insect: 1.90, beast: 2.20, humanoid: 1.65, undead: 1.60,
      elemental: 1.90, plant: 2.10, dragon: 2.45, golem: 2.30
    };
    var h = kindH[kind] != null ? kindH[kind] : 2.15;
    var w = kindW[kind] != null ? kindW[kind] : h * 0.82;
    spr.scale.set(w, h, 1);
    if (spr.center) spr.center.set(0.5, 0);
    else {
      try { spr.center = new THREE.Vector2(0.5, 0); } catch (e) { /* ignore */ }
    }
    // Root sits at feet; sprite grows upward from center.y=0
    spr.position.set(0, 0, 0);
    root.add(spr);

    // Ground weight: soft shadow + kind-tinted foot ring (no levitating cards)
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    root.add(shadow);
    var footRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 28),
      new THREE.MeshBasicMaterial({
        color: tintColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false
      })
    );
    footRing.rotation.x = -Math.PI / 2;
    footRing.position.y = 0.03;
    root.add(footRing);

    // Invisible proxy for code that expects shell.geometry
    var proxy = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.2, 0.4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    proxy.position.y = 0.6;
    root.add(proxy);

    var dummyGeo = proxy.geometry;
    var dummyBase = new Float32Array(dummyGeo.attributes.position.array.length);
    dummyBase.set(dummyGeo.attributes.position.array);

    return {
      root: root,
      shell: spr,
      core: spr,
      coreMat: mat,
      outline: null,
      mat: mat,
      geo: dummyGeo,
      base: dummyBase,
      eyes: [],
      hi: null,
      contactShadow: shadow,
      footRing: footRing,
      tint: tint,
      tintColor: tintColor,
      baseColor: baseColor,
      phase: Math.random() * Math.PI * 2,
      unitId: unit.id,
      isFoe: true,
      isEnemy: true,
      enemyKind: kind,
      solidEnemy: true,
      isImpostor: true,
      grounded: true,
      nativeHeight: h,
      nativeWidth: w,
      hasPaintedArt: artReady,
      artPending: !artReady,
      baseScale: 1,
      home: { x: 0, y: 0, z: 0 },
      hitFlash: 0,
      dead: false,
      melting: false,
      meltT: 0,
      activePulse: 0,
      baseEmissive: 0.2,
      puddle: null,
      droplets: []
    };
  }

  /**
   * Hard-realm fantasy enemy silhouette (not gel).
   * Priority:
   *   1) Painted impostor cards (best look — real enemy art)
   *   2) Procedural multi-part mesh (kind silhouettes below)
   *   3) Blender enemy_*.glb only if SR_FORCE_ENEMY_GLB=1
   *      (placeholder GLBs read as plain blobs — not preferred on HIGH)
   * Kinds: beast|golem|humanoid|dragon|undead|plant|insect|elemental
   */
  function createEnemyFigure(THREE, unit) {
    var kind = String(unit.enemyKind || unit.kind || 'beast').toLowerCase();
    if (ENEMY_KINDS.indexOf(kind) < 0) kind = 'beast';
    var low = elKey(unit.element);
    var tint = ELEMENT_HEX[low] || 0x888888;
    var tintColor = new THREE.Color(tint);

    // Opt-in only: placeholder enemy GLBs look worse than painted cards
    var forceEnemyGlb = !!global.SR_FORCE_ENEMY_GLB;
    if (!forceEnemyGlb) {
      try {
        forceEnemyGlb = (typeof localStorage !== 'undefined' &&
          localStorage.getItem('sr_force_enemy_glb') === '1');
      } catch (eF) { forceEnemyGlb = false; }
    }

    if (forceEnemyGlb && global.SR_MODELS && typeof global.SR_MODELS.tryEnemyFigure === 'function') {
      var glbFoeForced = global.SR_MODELS.tryEnemyFigure(THREE, unit, {
        tint: tint,
        baseEmissive: kind === 'undead' || kind === 'elemental' ? 0.4 : 0.22,
        targetHeight: 1.7 * enemyKindSize(kind),
        enemyKind: kind,
        roughness: kind === 'golem' || kind === 'elemental' ? 0.5 : 0.38,
        metalness: kind === 'golem' || kind === 'elemental' ? 0.4 : 0.12
      });
      if (glbFoeForced) return glbFoeForced;
    }

    // Painted impostors — RSL-class foe readability (art on card + foot ring)
    var impostor = createEnemyImpostorFigure(THREE, unit, kind, tint, tintColor);
    if (impostor) {
      if (impostor.artPending && impostor.root) {
        impostor.root.visible = false;
        // Unhide when placeholder map finishes (preload usually makes this sync)
        var waitN = 0;
        var waitId = setInterval(function () {
          waitN++;
          var map = impostor.mat && impostor.mat.map;
          var ok = map && map.userData && map.userData.loadOk && map.image;
          if (ok || waitN > 50) {
            clearInterval(waitId);
            impostor.artPending = false;
            impostor.hasPaintedArt = !!ok;
            if (impostor.root) impostor.root.visible = true;
          }
        }, 40);
      }
      return impostor;
    }

    var mat = new THREE.MeshStandardMaterial({
      color: tintColor.clone().multiplyScalar(0.85),
      roughness: kind === 'golem' || kind === 'elemental' ? 0.48 : 0.38,
      metalness: kind === 'golem' || kind === 'elemental' ? 0.42 : 0.14,
      emissive: tintColor.clone(),
      emissiveIntensity: kind === 'undead' || kind === 'elemental' ? 0.42 : 0.22,
      side: THREE.FrontSide
    });
    var darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1410, roughness: 0.8, metalness: 0.05
    });
    var accentMat = new THREE.MeshStandardMaterial({
      color: tintColor.clone(),
      roughness: 0.35,
      metalness: 0.25,
      emissive: tintColor.clone(),
      emissiveIntensity: 0.45
    });
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe8a0 });
    if (kind === 'undead') eyeMat = new THREE.MeshBasicMaterial({ color: 0x66ffaa });
    if (kind === 'dragon' || low === 'fire' || low === 'lava') {
      eyeMat = new THREE.MeshBasicMaterial({ color: 0xff6622 });
    }

    var root = new THREE.Group();
    var shell = null;
    var bodyParts = [];

    function addMesh(geo, material, y, sx, sy, sz) {
      var m = new THREE.Mesh(geo, material || mat);
      m.position.y = y || 0;
      if (sx) m.scale.set(sx, sy || sx, sz || sx);
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
      bodyParts.push(m);
      return m;
    }

    if (kind === 'golem') {
      shell = addMesh(new THREE.BoxGeometry(1.15, 1.4, 0.95), mat, 0.2);
      addMesh(new THREE.BoxGeometry(0.75, 0.6, 0.75), mat, 1.15);
      addMesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), darkMat, -0.1).position.x = -0.5;
      addMesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), darkMat, -0.1).position.x = 0.5;
      addMesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), accentMat, 0.85); // chest rune plate
    } else if (kind === 'humanoid') {
      shell = addMesh(new THREE.CylinderGeometry(0.36, 0.44, 1.15, 12), mat, 0.25);
      addMesh(new THREE.SphereGeometry(0.34, 14, 12), mat, 1.12);
      addMesh(new THREE.CylinderGeometry(0.12, 0.14, 0.75, 8), darkMat, 0.2).position.x = -0.5;
      addMesh(new THREE.CylinderGeometry(0.12, 0.14, 0.75, 8), darkMat, 0.2).position.x = 0.5;
      addMesh(new THREE.BoxGeometry(0.65, 0.18, 0.42), darkMat, 0.8);
      // cloak / cape
      addMesh(new THREE.BoxGeometry(0.55, 0.9, 0.12), darkMat, 0.35).position.z = -0.35;
    } else if (kind === 'dragon') {
      shell = addMesh(new THREE.SphereGeometry(0.72, 16, 14), mat, 0.3, 1.35, 0.8, 1.15);
      addMesh(new THREE.ConeGeometry(0.3, 0.75, 8), mat, 0.6).position.z = 0.8;
      var wingL = addMesh(new THREE.BoxGeometry(0.12, 0.95, 0.7), darkMat, 0.65);
      wingL.position.set(-0.85, 0.45, 0);
      wingL.rotation.z = 0.55;
      var wingR = addMesh(new THREE.BoxGeometry(0.12, 0.95, 0.7), darkMat, 0.65);
      wingR.position.set(0.85, 0.45, 0);
      wingR.rotation.z = -0.55;
      addMesh(new THREE.ConeGeometry(0.12, 0.4, 6), accentMat, 0.85).position.set(-0.2, 0.55, 0.5);
      addMesh(new THREE.ConeGeometry(0.12, 0.4, 6), accentMat, 0.85).position.set(0.2, 0.55, 0.5);
    } else if (kind === 'undead') {
      shell = addMesh(new THREE.CylinderGeometry(0.3, 0.34, 1.45, 10), mat, 0.3);
      addMesh(new THREE.SphereGeometry(0.3, 12, 10), mat, 1.25);
      addMesh(new THREE.BoxGeometry(0.75, 0.14, 0.4), darkMat, 0.75);
      addMesh(new THREE.SphereGeometry(0.5, 10, 8), accentMat, 0.9, 1.2, 0.5, 1.2); // aura
      if (accentMat.transparent !== undefined) {
        accentMat.transparent = true;
        accentMat.opacity = 0.45;
      }
    } else if (kind === 'plant') {
      shell = addMesh(new THREE.CylinderGeometry(0.28, 0.45, 1.3, 10), mat, 0.2);
      addMesh(new THREE.SphereGeometry(0.7, 14, 12), mat, 1.1, 1.25, 0.75, 1.25);
      addMesh(new THREE.ConeGeometry(0.22, 0.55, 6), darkMat, 1.0).position.x = -0.5;
      addMesh(new THREE.ConeGeometry(0.22, 0.55, 6), darkMat, 1.0).position.x = 0.5;
      addMesh(new THREE.ConeGeometry(0.18, 0.45, 6), accentMat, 1.35);
    } else if (kind === 'insect') {
      shell = addMesh(new THREE.SphereGeometry(0.48, 14, 12), mat, 0.15, 1.45, 0.75, 1.05);
      addMesh(new THREE.SphereGeometry(0.38, 12, 10), mat, 0.4).position.z = 0.6;
      addMesh(new THREE.SphereGeometry(0.3, 10, 8), mat, 0.18).position.z = -0.55;
      var li;
      for (li = 0; li < 3; li++) {
        var legL = addMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 5), darkMat, -0.1);
        legL.position.set(-0.45, -0.05, -0.28 + li * 0.28);
        legL.rotation.z = 0.65;
        var legR = addMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 5), darkMat, -0.1);
        legR.position.set(0.45, -0.05, -0.28 + li * 0.28);
        legR.rotation.z = -0.65;
      }
    } else if (kind === 'elemental') {
      shell = addMesh(new THREE.OctahedronGeometry(0.8, 0), mat, 0.4);
      addMesh(new THREE.OctahedronGeometry(0.42, 0), accentMat, 1.05);
      addMesh(new THREE.OctahedronGeometry(0.3, 0), mat, -0.1).position.x = -0.5;
      addMesh(new THREE.OctahedronGeometry(0.3, 0), mat, -0.1).position.x = 0.5;
      addMesh(new THREE.OctahedronGeometry(0.22, 0), accentMat, 0.5).position.z = 0.55;
    } else {
      shell = addMesh(new THREE.SphereGeometry(0.58, 16, 14), mat, 0.08, 1.4, 0.88, 1.05);
      addMesh(new THREE.SphereGeometry(0.4, 14, 12), mat, 0.5).position.z = 0.7;
      addMesh(new THREE.ConeGeometry(0.13, 0.3, 6), darkMat, 0.8).position.set(-0.2, 0.6, 0.55);
      addMesh(new THREE.ConeGeometry(0.13, 0.3, 6), darkMat, 0.8).position.set(0.2, 0.6, 0.55);
      addMesh(new THREE.ConeGeometry(0.16, 0.4, 6), darkMat, 0.25).position.z = -0.75;
    }

    var eyeY = kind === 'golem' ? 1.15 : (kind === 'humanoid' || kind === 'undead' ? 1.15 : 0.5);
    var eyeZ = kind === 'beast' || kind === 'dragon' ? 1.0 : 0.55;
    if (kind === 'golem') eyeZ = 0.42;
    if (kind === 'humanoid' || kind === 'undead') eyeZ = 0.38;
    var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), eyeMat);
    var eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), eyeMat);
    eyeL.position.set(-0.15, eyeY, eyeZ);
    eyeR.position.set(0.15, eyeY, eyeZ);
    root.add(eyeL, eyeR);

    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 22),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.55;
    root.add(shadow);

    if (!shell) shell = bodyParts[0];

    var dummyGeo = shell && shell.geometry ? shell.geometry : new THREE.SphereGeometry(0.5, 8, 6);
    var dummyBase = new Float32Array(
      dummyGeo.attributes && dummyGeo.attributes.position
        ? dummyGeo.attributes.position.array.length
        : 9
    );
    if (dummyGeo.attributes && dummyGeo.attributes.position) {
      dummyBase.set(dummyGeo.attributes.position.array);
    }

    return {
      root: root,
      shell: shell,
      core: shell,
      coreMat: mat,
      outline: null,
      mat: mat,
      geo: dummyGeo,
      base: dummyBase,
      eyes: [eyeL, eyeR],
      hi: null,
      contactShadow: shadow,
      tint: tint,
      tintColor: tintColor,
      baseColor: tintColor.clone(),
      phase: Math.random() * Math.PI * 2,
      unitId: unit.id,
      isFoe: true,
      isEnemy: true,
      enemyKind: kind,
      solidEnemy: true,
      isImpostor: false,
      nativeHeight: 1.80,
      baseScale: 1,
      home: { x: 0, y: 0, z: 0 },
      hitFlash: 0,
      dead: false,
      melting: false,
      meltT: 0,
      activePulse: 0,
      baseEmissive: mat.emissiveIntensity || 0.2,
      puddle: null,
      droplets: []
    };
  }

  function createUnitFigure(THREE, unit) {
    // Allies (and rare gel foes) stay soft gel; hard-realm foes get fantasy silhouettes
    if (unit && (unit.isEnemy || unit.enemyKind) && unit.enemyKind !== 'slime') {
      return createEnemyFigure(THREE, unit);
    }
    return createGelFigure(THREE, unit);
  }

  /**
   * Soft circular alpha mask for gel badge JPGs (NO color keying).
   * Preserves void/shadow/water body colors that chroma would eat.
   * Looks like a soft portrait orb — full art quality in combat.
   */
  function circularMaskToTexture(THREE, image, opts) {
    opts = opts || {};
    var canvas = document.createElement('canvas');
    var w = image.naturalWidth || image.width;
    var h = image.naturalHeight || image.height;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Slight zoom so feet/floor crop and the gel fills the disc
    var zoom = opts.zoom != null ? opts.zoom : 1.12;
    var dw = w * zoom;
    var dh = h * zoom;
    ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2 + h * 0.02, dw, dh);

    var imgData;
    try {
      imgData = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      return null;
    }
    var d = imgData.data;
    var cx = w * 0.5;
    var cy = h * 0.48; // bias up (eyes / body mass)
    var rOuter = Math.min(w, h) * (opts.radius != null ? opts.radius : 0.46);
    var rInner = rOuter * 0.82;
    var i;
    var x;
    var y;
    var p = 0;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        p = (y * w + x) * 4;
        var dx = x - cx;
        var dy = y - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var a;
        if (dist >= rOuter) a = 0;
        else if (dist <= rInner) a = 1;
        else a = 1 - (dist - rInner) / (rOuter - rInner);
        // Soft power curve for prettier edge
        a = a * a * (3 - 2 * a);
        d[p + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    var tex = new THREE.CanvasTexture(canvas);
    tex.flipY = true;
    if (THREE.RGBAFormat !== undefined) tex.format = THREE.RGBAFormat;
    return finishEnvTexture(THREE, tex, {});
  }

  function loadGelBadgeTexture(THREE, url) {
    var cacheKey = url + '|circMask-v2';
    if (_texCache[cacheKey]) return _texCache[cacheKey];
    var tex = new THREE.Texture();
    try {
      var loader = new THREE.TextureLoader();
      loader.load(url, function (loaded) {
        var masked = circularMaskToTexture(THREE, loaded.image, { zoom: 1.14, radius: 0.47 });
        if (masked) {
          tex.image = masked.image;
          finishEnvTexture(THREE, tex, {});
          tex.needsUpdate = true;
          _texCache[cacheKey] = tex;
        } else {
          tex.image = loaded.image;
          finishEnvTexture(THREE, tex, {});
          tex.needsUpdate = true;
        }
      });
    } catch (e) {
      return null;
    }
    _texCache[cacheKey] = tex;
    return tex;
  }

  /**
   * @param {string} element
   * @param {string} [variant]
   * @param {string} [form]
   * @param {object|number} [unitOrEvo] champion (purpleStars) or evo level number
   */
  function gelArtUrl(element, variant, form, unitOrEvo) {
    var low = elKey(element);
    var v = 'a';
    if (global.SR_ART && global.SR_ART.variantKey) v = global.SR_ART.variantKey(variant);
    else if (variant) v = String(variant).toLowerCase();
    var f = form || 'blob';
    var evoHint = unitOrEvo;
    var paths = (global.SR_ART && global.SR_ART.combatGelPathCandidates)
      ? global.SR_ART.combatGelPathCandidates(low, v, f, evoHint)
      : [
          'assets/battle/gels/combat/' + low + '_' + f + '_' + v + '.jpg',
          'assets/battle/gels/combat/' + low + '_' + v + '.jpg',
          'assets/battle/gels/combat/' + low + '_a.jpg'
        ];
    var attackPaths = (global.SR_ART && global.SR_ART.combatGelAttackPathCandidates)
      ? global.SR_ART.combatGelAttackPathCandidates(low, v, f, evoHint)
      : [
          'assets/battle/gels/combat/' + low + '_' + f + '_' + v + '_attack.jpg',
          'assets/battle/gels/combat/' + low + '_' + f + '_a_attack.jpg',
          'assets/battle/gels/combat/' + low + '_attack.jpg'
        ].concat(paths);
    var evo = 0;
    if (global.SR_ART && global.SR_ART.gelEvoLevel && unitOrEvo && typeof unitOrEvo === 'object') {
      evo = global.SR_ART.gelEvoLevel(unitOrEvo);
    } else if (typeof unitOrEvo === 'number') evo = unitOrEvo;
    return {
      combat: paths[0],
      candidates: paths,
      attackCandidates: attackPaths,
      attack: attackPaths[0],
      roster: 'assets/slimes/' + low + '.jpg',
      legacyCombat: 'assets/battle/gels/' + low + '.jpg',
      variant: v,
      form: f,
      evoLevel: evo
    };
  }

  /**
   * Pure pose controller — idle/attack texture keys without WebGL.
   * Used by combat figures and unit tests.
   */
  function createPoseController(opts) {
    opts = opts || {};
    var idleTex = opts.idleTex != null ? opts.idleTex : 'idle';
    var attackTex = opts.attackTex != null ? opts.attackTex : null;
    var current = 'idle';
    var restoreId = 0;
    return {
      getPose: function () { return current; },
      hasAttackArt: function () {
        return attackTex != null && attackTex !== idleTex;
      },
      getActiveTex: function () {
        return (current === 'attack' && attackTex != null) ? attackTex : idleTex;
      },
      getIdleTex: function () { return idleTex; },
      getAttackTex: function () { return attackTex; },
      setAttackTex: function (tex) {
        attackTex = tex;
      },
      setIdleTex: function (tex) {
        idleTex = tex;
        if (current === 'idle') { /* keep */ }
      },
      /** Enter attack pose if attack art exists; else stay idle. */
      setAttack: function () {
        if (attackTex != null && attackTex !== idleTex) {
          current = 'attack';
          return true;
        }
        current = 'idle';
        return false;
      },
      setIdle: function () {
        current = 'idle';
        return true;
      },
      /** Bump token so stale restore timers can no-op. */
      nextRestoreToken: function () {
        restoreId += 1;
        return restoreId;
      },
      isRestoreToken: function (tok) {
        return tok === restoreId;
      }
    };
  }

  /**
   * Preload combat gel + enemy plates into _texCache so spawn can dress
   * synchronously and skip the procedural-blob flash.
   * @param {object[]} units
   * @returns {Promise<{ok:boolean, count:number}>}
   */
  function preloadCombatArt(units) {
    var THREE = global.THREE;
    if (!THREE || typeof THREE.TextureLoader !== 'function') {
      return Promise.resolve({ ok: false, count: 0 });
    }
    units = units || [];
    var jobs = [];
    var seen = {};

    function enqueue(urls) {
      var list = (urls || []).filter(Boolean);
      if (!list.length) return;
      var key = list.join('|');
      if (seen[key]) return;
      seen[key] = true;
      jobs.push(new Promise(function (resolve) {
        loadChromaCandidates(THREE, list, { chroma: true, magentaOnly: true, gelKey: true }, function () {
          resolve();
        });
      }));
    }

    var ui;
    for (ui = 0; ui < units.length; ui++) {
      var u = units[ui];
      if (!u) continue;
      if (unitIsSolidEnemy(u)) {
        var kind = String(u.enemyKind || u.kind || 'beast').toLowerCase();
        if (ENEMY_KINDS.indexOf(kind) < 0) kind = 'beast';
        enqueue([enemyImpostorUrl(kind)]);
      } else {
        var artV = (global.SR_ART && typeof global.SR_ART.artVariantForUnit === 'function')
          ? global.SR_ART.artVariantForUnit(u)
          : (u.artVariant || 'a');
        var artForm = (global.SR_ART && typeof global.SR_ART.gelFormForUnit === 'function')
          ? global.SR_ART.gelFormForUnit(u)
          : 'blob';
        var urls = gelArtUrl(u.element, artV, artForm, u);
        var cands = (urls.candidates && urls.candidates.length) ? urls.candidates.slice() : [urls.combat];
        if (urls.legacyCombat) cands.push(urls.legacyCombat);
        if (urls.roster) cands.push(urls.roster);
        enqueue(cands);
        // Attack-pose pack (same chroma path; falls back to idle stems if missing)
        if (urls.attackCandidates && urls.attackCandidates.length) {
          enqueue(urls.attackCandidates);
        }
      }
    }

    if (!jobs.length) return Promise.resolve({ ok: true, count: 0 });
    return Promise.all(jobs).then(function () {
      return { ok: true, count: jobs.length };
    }).catch(function () {
      return { ok: false, count: jobs.length };
    });
  }

  /**
   * Load first chroma-keyed URL that succeeds (skip 404 / empty).
   * onDone(tex|null, usedChroma:boolean, url:string|null)
   */
  function loadChromaCandidates(THREE, urls, opts, onDone) {
    opts = opts || {};
    urls = urls || [];
    var i = 0;
    function tryNext() {
      if (i >= urls.length) {
        onDone(null, false, null);
        return;
      }
      var raw = urls[i++];
      var url = artUrl(raw);
      var cacheKey = url + (opts.chroma ? '|chroma' : '') + (opts.darkBg ? '|dark' : '') +
        (opts.magentaOnly ? '|magOnly' : '') +
        (opts.gelKey ? '|gelKey8' : '') +
        (opts.enemyKey ? '|enemyKey8' : '') +
        (opts.propKey ? '|propKey2' : '') +
        (opts.cutout ? '|' + opts.cutout : '') +
        (opts.repeat != null ? '|r' + opts.repeat : '');
      var cached = _texCache[cacheKey];
      if (cached) {
        if (cached.userData && cached.userData.failed) {
          tryNext();
          return;
        }
        if (cached.userData && cached.userData.loadOk && cached.image) {
          onDone(cached, !!opts.chroma, url);
          return;
        }
        // In-flight placeholder — wait briefly then fall through if still empty
        var waitN = 0;
        var waitId = setInterval(function () {
          waitN++;
          if (cached.userData && cached.userData.failed) {
            clearInterval(waitId);
            tryNext();
          } else if (cached.userData && cached.userData.loadOk && cached.image) {
            clearInterval(waitId);
            onDone(cached, !!opts.chroma, url);
          } else if (waitN > 40) {
            clearInterval(waitId);
            tryNext();
          }
        }, 50);
        return;
      }
      var loader = new THREE.TextureLoader();
      var tex = new THREE.Texture();
      tex.userData = { pending: true };
      _texCache[cacheKey] = tex;
      loader.load(
        url,
        function (loaded) {
          var img = loaded.image;
          if (!img || !(img.naturalWidth || img.width)) {
            tex.userData.failed = true;
            delete _texCache[cacheKey];
            tryNext();
            return;
          }
          var keyed = opts.chroma ? chromaKeyToTexture(THREE, img, opts) : null;
          if (keyed) {
            tex.image = keyed.image;
            tex.format = keyed.format;
            finishEnvTexture(THREE, tex, { repeat: null });
          } else {
            tex.image = img;
            finishEnvTexture(THREE, tex, opts);
          }
          tex.needsUpdate = true;
          tex.userData.loadOk = true;
          tex.userData.pending = false;
          _texCache[cacheKey] = tex;
          onDone(tex, !!opts.chroma, url);
        },
        undefined,
        function () {
          tex.userData.failed = true;
          tex.userData.pending = false;
          delete _texCache[cacheKey];
          tryNext();
        }
      );
    }
    tryNext();
  }

  /**
   * Dress a gel with combat-optimized full-body art.
   *
   * Mesh stays visible until art loads successfully — never hide body on a 404
   * placeholder (that was the “invisible slime” bug for variant b/c / shaped).
   */
  function dressGelWithArt(THREE, fig, unit) {
    if (!fig || !fig.root || !THREE || !unit) return fig;
    if (fig.faceArt || fig.combatSprite) return fig;

    var artV = (global.SR_ART && global.SR_ART.artVariantForUnit)
      ? global.SR_ART.artVariantForUnit(unit)
      : (unit.artVariant || 'a');
    var artForm = (global.SR_ART && global.SR_ART.gelFormForUnit)
      ? global.SR_ART.gelFormForUnit(unit)
      : 'blob';
    var urls = gelArtUrl(unit.element, artV, artForm, unit);
    var cands = (urls.candidates && urls.candidates.length)
      ? urls.candidates.slice()
      : [urls.combat];
    if (urls.legacyCombat) cands.push(urls.legacyCombat);
    if (urls.roster) cands.push(urls.roster);

    fig.artVariant = urls.variant || artV;
    fig.artForm = urls.form || artForm;
    fig.artEvoLevel = urls.evoLevel || 0;
    fig.artPending = true;

    loadChromaCandidates(THREE, cands, { chroma: true, magentaOnly: true, gelKey: true }, function (tex, usedChroma, okUrl) {
      if (!fig || !fig.root || fig.dead) return;
      if (!tex || !tex.image) {
        // Keep procedural multi-part visible
        fig.artPending = false;
        fig.artFailed = true;
        fig.root.visible = true;
        if (typeof console !== 'undefined' && console.log) {
          console.log('[Battle3D] combat art miss → procedural', unit.element, artForm, artV);
        }
        return;
      }

      // Painted gel plate uses fixed native size; world height = root scale only
      var nativeH = 2.0;
      var nativeW = 1.72;
      fig.nativeHeight = nativeH;
      fig.nativeWidth = nativeW;
      var sprMat = new THREE.SpriteMaterial({
        map: tex,
        color: 0xffffff,
        transparent: true,
        // Softer alphaTest — high values punched holes / wiped soft gel bodies
        alphaTest: usedChroma ? 0.1 : 0.08,
        depthWrite: true,
        fog: true,
        sizeAttenuation: true
      });
      var spr = new THREE.Sprite(sprMat);
      var h = nativeH;
      var w = nativeW;
      spr.scale.set(w, h, 1);
      if (spr.center) spr.center.set(0.5, 0);
      else {
        try { spr.center = new THREE.Vector2(0.5, 0); } catch (eC) { /* ignore */ }
      }
      spr.position.set(0, 0.02, 0);
      fig.root.add(spr);
      fig.combatSprite = spr;
      fig.faceArt = spr;
      fig.hasPaintedArt = true;
      fig.gelImpostor = true;
      fig.isImpostor = true;
      fig.mat = sprMat;
      fig.baseColor = new THREE.Color(0xffffff);
      fig.shell = spr;
      fig.core = spr;
      fig.combatArtUrl = okUrl;
      fig.idleTex = tex;
      fig.pose = 'idle';
      fig.poseCtrl = createPoseController({ idleTex: tex, attackTex: null });

      // Async load attack-pose plate (identity-matched); falls back to idle if miss
      var atkCands = (urls.attackCandidates && urls.attackCandidates.length)
        ? urls.attackCandidates.slice()
        : [];
      if (atkCands.length) {
        loadChromaCandidates(THREE, atkCands, { chroma: true, magentaOnly: true, gelKey: true }, function (atkTex, atkChroma, atkUrl) {
          if (!fig || fig.dead) return;
          if (atkTex && atkTex.image && atkUrl && /_attack\.jpg/i.test(String(atkUrl))) {
            fig.attackTex = atkTex;
            fig.attackArtUrl = atkUrl;
            if (fig.poseCtrl) fig.poseCtrl.setAttackTex(atkTex);
          } else {
            // No dedicated attack plate — keep idle for attack phase (criterion 4)
            fig.attackTex = null;
            fig.attackArtUrl = null;
          }
        });
      }

      function hideObj(o) {
        if (o) o.visible = false;
      }
      hideObj(fig.outline);
      if (fig.eyes && fig.eyes.length) {
        fig.eyes.forEach(function (e) { hideObj(e); });
      }
      hideObj(fig.hi);
      if (fig.parts) {
        Object.keys(fig.parts).forEach(function (k) {
          hideObj(fig.parts[k]);
        });
      }
      if (fig.root && fig.root.traverse) {
        fig.root.traverse(function (ch) {
          if (ch === spr) return;
          if (ch === fig.contactShadow) return;
          if (ch === fig.turnRing || ch === fig.turnDisc) return;
          if (ch.isMesh || ch.isSkinnedMesh) ch.visible = false;
          if (ch.isSprite && ch !== spr) ch.visible = false;
        });
      }
      spr.visible = true;
      if (fig.contactShadow) fig.contactShadow.visible = true;
      fig.artPending = false;
      fig.root.visible = true;
    });

    return fig;
  }

  /**
   * Beautiful combat ally: full badge art in a soft circular disc (no chroma holes).
   */
  function createGelImpostorFigure(THREE, unit, profile, tint, tintColor, baseEmissive) {
    var low = elKey(unit.element);
    var artV = (global.SR_ART && global.SR_ART.artVariantForUnit)
      ? global.SR_ART.artVariantForUnit(unit)
      : (unit.artVariant || 'a');
    var artForm = (global.SR_ART && global.SR_ART.gelFormForUnit)
      ? global.SR_ART.gelFormForUnit(unit)
      : 'blob';
    var urls = gelArtUrl(unit.element, artV, artForm, unit);
    var cands = (urls.candidates && urls.candidates.length) ? urls.candidates.slice() : [];
    cands.push('assets/battle/gels/combat/' + low + '_blob_a.jpg');
    cands.push('assets/battle/gels/combat/' + low + '_a.jpg');
    cands.push('assets/battle/gels/combat/' + low + '.jpg');
    cands.push('assets/slimes/' + low + '.jpg');

    var root = new THREE.Group();

    // Soft glow disc behind (element tint) — fantasy charm
    var glowMat = new THREE.SpriteMaterial({
      color: tintColor.clone(),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      fog: true,
      sizeAttenuation: true
    });
    var glow = new THREE.Sprite(glowMat);
    // Native plate proportions only — absolute size at spawn
    var h = 2.0 * (profile.bodyH || 1);
    var w = 1.72 * (profile.bodyW || 1);
    var gh = h * 1.12;
    glow.scale.set(gh * 0.95, gh * 0.95, 1);
    if (glow.center) glow.center.set(0.5, 0.15);
    root.add(glow);

    // Placeholder sprite — map filled when first candidate loads
    var mat = new THREE.SpriteMaterial({
      map: null,
      color: tintColor.clone(),
      transparent: true,
      opacity: 0.85,
      alphaTest: 0.05,
      depthWrite: true,
      fog: true,
      sizeAttenuation: true
    });
    mat.emissiveIntensity = 0;
    var spr = new THREE.Sprite(mat);
    spr.scale.set(w, h, 1);
    if (spr.center) spr.center.set(0.5, 0);
    else {
      try { spr.center = new THREE.Vector2(0.5, 0); } catch (e) { /* ignore */ }
    }
    root.add(spr);

    loadChromaCandidates(THREE, cands, { chroma: true, magentaOnly: true, gelKey: true }, function (tex, useChroma) {
      if (!tex || !tex.image) return;
      mat.map = tex;
      mat.color.setHex(0xffffff);
      mat.opacity = 1;
      mat.alphaTest = useChroma ? 0.28 : 0.1;
      mat.needsUpdate = true;
      if (useChroma) spr.scale.set(w, h, 1);
      else {
        var side = Math.max(w, h) * 0.98;
        spr.scale.set(side, side, 1);
      }
    });

    var shadowR = 0.55 + (profile.size || 1) * 0.4;
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(shadowR, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    root.add(shadow);

    var proxy = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.0, 0.35),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    proxy.position.y = 0.5;
    root.add(proxy);

    var dummyGeo = proxy.geometry;
    var dummyBase = new Float32Array(dummyGeo.attributes.position.array.length);
    dummyBase.set(dummyGeo.attributes.position.array);

    return {
      root: root,
      shell: spr,
      core: spr,
      coreMat: mat,
      outline: null,
      mat: mat,
      glowSprite: glow,
      glowMat: glowMat,
      geo: dummyGeo,
      base: dummyBase,
      eyes: [],
      hi: null,
      contactShadow: shadow,
      tint: tint,
      tintColor: tintColor,
      baseColor: new THREE.Color(0xffffff),
      phase: Math.random() * Math.PI * 2,
      unitId: unit.id,
      isFoe: !!unit.isFoe,
      isImpostor: true,
      gelImpostor: true,
      gelSize: gelSizeMult(unit),
      gelFloatY: profile.floatY || 0,
      solidEnemy: false,
      nativeHeight: h,
      nativeWidth: w,
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

  /** Element-shaped procedural gel when plate art unavailable */
  function makeGelBodyGeo(THREE, style) {
    var segs = 56;
    var geo = new THREE.SphereGeometry(1, segs, Math.floor(segs * 0.8));
    var pos = geo.attributes.position;
    var i;
    for (i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var y = pos.getY(i);
      var z = pos.getZ(i);
      var ny = y;
      var nx = x;
      var nz = z;
      // Distinct silhouettes per element style (complex slime language, not one drop)
      if (style === 'droplet') {
        // Teardrop with fat base, pointed crown
        ny = y * 0.68 - 0.18 + Math.max(0, y) * 0.08;
        var widen = 1.22 + Math.max(0, -y) * 0.38 - Math.max(0, y) * 0.12;
        nx = x * widen; nz = z * (0.9 + Math.max(0, -y) * 0.08);
      } else if (style === 'flame') {
        ny = y * 1.28 + Math.max(0, y) * 0.35;
        var fw = 1.0 - Math.max(0, y) * 0.28 + Math.max(0, -y) * 0.15;
        nx = x * fw * (1 + Math.sin(y * 6) * 0.06);
        nz = z * fw;
      } else if (style === 'chunk' || style === 'heavy') {
        // Squashed boulder gel
        ny = y * 0.62 - 0.12;
        nx = x * 1.38; nz = z * 1.2;
      } else if (style === 'wispy' || style === 'ghost') {
        ny = y * 1.22;
        nx = x * (0.82 + Math.sin(y * 5) * 0.14);
        nz = z * (0.78 + Math.cos(y * 4) * 0.1);
      } else if (style === 'spike') {
        ny = y * 1.4;
        nx = x * (0.72 + Math.max(0, -y) * 0.35);
        nz = z * 0.72;
      } else if (style === 'crystal' || style === 'gem') {
        ny = y * 1.22;
        // angular squash in XZ for faceted read
        nx = x * (0.78 + Math.abs(y) * 0.12);
        nz = z * (0.78 + Math.abs(x) * 0.08);
      } else if (style === 'cloud') {
        ny = y * 0.78 - 0.05;
        nx = x * 1.45; nz = z * 1.2;
      } else if (style === 'cosmos') {
        ny = y * 0.92;
        nx = x * 1.2 * (1 + Math.sin(y * 3) * 0.05);
        nz = z * 1.05;
      } else if (style === 'sprout' || style === 'orb' || style === 'blob') {
        ny = y * 0.8 - 0.12;
        var w1 = 1.14 + Math.max(0, -y) * 0.22;
        nx = x * w1; nz = z * 0.95;
      } else if (style === 'armor' || style === 'tendril' || style === 'bubble') {
        ny = y * 0.84 - 0.08;
        nx = x * 1.18; nz = z * 1.05;
      } else {
        ny = y * 0.76 - 0.1;
        var w0 = 1.1 + Math.max(0, -y) * 0.2;
        nx = x * w0; nz = z * 0.93;
      }
      pos.setXYZ(i, nx, ny, nz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * R3 — Multi-part grounded combat gel (not a floating water drop / not a badge sticker).
   * Feet + skirt on the floor; layered body, cheeks, element kit, rarity crown.
   * Only spirit/wind get a slight hover; everyone else plants on the arena.
   */
  function createComplexGroundedGel(THREE, unit) {
    var low = elKey(unit.element);
    var profile = gelProfile(low);
    var tint = ELEMENT_HEX[low] || 0x66bb6a;
    var tintColor = new THREE.Color(tint);
    var baseEmissive = Math.max(0.42, RARITY_EMISSIVE[unit.rarity] || 0.2);
    var bw = profile.bodyW || 1;
    var bh = profile.bodyH || 1;
    var rarity = unit.rarity || 'Common';
    var hovers = !!(profile.floatY && (low === 'spirit' || low === 'wind'));

    var rough = 0.16;
    var metal = 0.05;
    if (low === 'metal') { rough = 0.26; metal = 0.55; }
    if (low === 'crystal' || low === 'ice') { rough = 0.1; metal = 0.28; }
    if (low === 'lava' || low === 'fire') { rough = 0.3; metal = 0.08; }
    if (low === 'earth') { rough = 0.48; metal = 0.06; }
    if (low === 'shadow' || low === 'void') { rough = 0.32; metal = 0.18; }

    var bodyCol = tintColor.clone();
    if (low === 'void' || low === 'shadow') {
      bodyCol.offsetHSL(0, 0.1, 0.14);
      baseEmissive = Math.max(baseEmissive, 0.58);
    }
    if (low === 'water' || low === 'ice') bodyCol.offsetHSL(0, 0.06, 0.05);

    function gelMat(extraEm) {
      var em = baseEmissive * (extraEm != null ? extraEm : 1);
      if (THREE.MeshPhysicalMaterial) {
        try {
          var phys = {
            color: bodyCol.clone(),
            roughness: rough,
            metalness: metal,
            clearcoat: low === 'metal' ? 0.35 : 0.95,
            clearcoatRoughness: 0.09,
            emissive: bodyCol.clone(),
            emissiveIntensity: em,
            transparent: false,
            transmission: 0,
            side: THREE.FrontSide,
            depthWrite: true
          };
          // Sheen / soft specular rim (r-class gel read under key light)
          if (low === 'water' || low === 'ice' || low === 'crystal' || low === 'spirit') {
            phys.sheen = 0.55;
            phys.sheenRoughness = 0.35;
            phys.sheenColor = bodyCol.clone().offsetHSL(0, 0.05, 0.25);
          }
          if (low === 'fire' || low === 'lava' || low === 'lightning') {
            phys.clearcoat = 0.55;
            phys.emissiveIntensity = em * 1.15;
          }
          return new THREE.MeshPhysicalMaterial(phys);
        } catch (e) { /* fall through */ }
      }
      return new THREE.MeshStandardMaterial({
        color: bodyCol.clone(), roughness: rough, metalness: metal,
        emissive: bodyCol.clone(), emissiveIntensity: em
      });
    }

    var mat = gelMat(1);
    var matSoft = gelMat(0.75);
    var matBright = gelMat(1.25);
    // Pre-warm combat full-body art variants (magenta-only chroma pack)
    try {
      ['a', 'b', 'c'].forEach(function (vv) {
        loadEnvTexture(THREE, 'assets/battle/gels/combat/' + low + '_' + vv + '.jpg', {
          chroma: true, magentaOnly: true, gelKey: true
        });
      });
      loadEnvTexture(THREE, 'assets/battle/gels/combat/' + low + '.jpg', {
        chroma: true, magentaOnly: true, gelKey: true
      });
    } catch (eArt) { /* optional */ }

    // —— Geometry: main body sits above feet (y≈0.9 center) ——
    var geo = makeGelBodyGeo(THREE, profile.style || 'blob');
    var base = new Float32Array(geo.attributes.position.array.length);
    base.set(geo.attributes.position.array);

    var bodyY = 0.92;
    var shell = new THREE.Mesh(geo, mat);
    shell.castShadow = true;
    shell.receiveShadow = true;
    shell.scale.set(bw * 0.92, bh * 0.9, bw * 0.88);
    shell.position.y = bodyY;

    var outline = new THREE.Mesh(
      geo.clone(),
      new THREE.MeshBasicMaterial({ color: 0x020806, side: THREE.BackSide })
    );
    outline.scale.set(bw * 1.02, bh * 1.0, bw * 0.98);
    outline.position.y = bodyY;

    var core = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 22, 16),
      new THREE.MeshBasicMaterial({ color: bodyCol.clone().offsetHSL(0, 0.08, 0.18) })
    );
    core.scale.set(bw * 0.85, bh * 0.78, bw * 0.85);
    core.position.y = bodyY;

    // Cheek / side lobes (reads as “creature,” not single blob)
    var cheekGeo = new THREE.SphereGeometry(0.38, 16, 12);
    var cheekL = new THREE.Mesh(cheekGeo, matSoft);
    var cheekR = new THREE.Mesh(cheekGeo, matSoft);
    cheekL.scale.set(0.85 * bw, 0.7 * bh, 0.75);
    cheekR.scale.set(0.85 * bw, 0.7 * bh, 0.75);
    cheekL.position.set(-0.55 * bw, bodyY - 0.08, 0.15);
    cheekR.position.set(0.55 * bw, bodyY - 0.08, 0.15);
    cheekL.castShadow = true;
    cheekR.castShadow = true;

    // Top crown lobe
    var crown = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), matBright);
    crown.scale.set(0.75 * bw, 0.55 * bh, 0.7);
    crown.position.set(0, bodyY + 0.55 * bh, -0.05);
    crown.castShadow = true;

    // Feet — planted on ground (flattened spheres)
    var footMat = gelMat(0.9);
    var footGeo = new THREE.SphereGeometry(0.28, 14, 10);
    var footL = new THREE.Mesh(footGeo, footMat);
    var footR = new THREE.Mesh(footGeo, footMat);
    footL.scale.set(1.15, 0.45, 1.05);
    footR.scale.set(1.15, 0.45, 1.05);
    footL.position.set(-0.28 * bw, 0.1, 0.12);
    footR.position.set(0.28 * bw, 0.1, 0.12);
    footL.castShadow = true;
    footR.castShadow = true;
    footL.receiveShadow = true;
    footR.receiveShadow = true;

    // Wet skirt / slime puddle base (grounds the figure — no levitate)
    var skirt = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 20, 12),
      new THREE.MeshPhysicalMaterial
        ? new THREE.MeshPhysicalMaterial({
            color: bodyCol.clone(),
            roughness: 0.22,
            metalness: 0.05,
            clearcoat: 0.8,
            emissive: bodyCol.clone(),
            emissiveIntensity: baseEmissive * 0.5,
            transparent: true,
            opacity: 0.92
          })
        : new THREE.MeshStandardMaterial({
            color: bodyCol.clone(), roughness: 0.25, transparent: true, opacity: 0.9,
            emissive: bodyCol.clone(), emissiveIntensity: baseEmissive * 0.5
          })
    );
    skirt.scale.set(1.15 * bw, 0.22, 1.05 * bw);
    skirt.position.y = 0.12;
    skirt.receiveShadow = true;

    // Contact shadow
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85 + (profile.size || 1) * 0.2, 28),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.48, depthWrite: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;

    // Eyes on body face
    var eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a100c });
    var eyes = [];
    var eyeCount = profile.eyes || 2;
    var eyeY = bodyY + 0.18 * bh;
    var eyeZ = 0.68 * bw;
    var eyeSpread = 0.24 * bw;
    var ei;
    for (ei = 0; ei < eyeCount; ei++) {
      var ex = eyeCount === 1 ? 0
        : (eyeCount === 3 ? (ei - 1) * eyeSpread * 0.9 : (ei === 0 ? -eyeSpread : eyeSpread));
      var ey = eyeCount === 3 && ei === 1 ? eyeY + 0.14 : eyeY;
      var ew = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), eyeWhite);
      var pu = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), pupilMat);
      ew.position.set(ex, ey, eyeZ);
      pu.position.set(ex, ey, eyeZ + 0.09);
      eyes.push(ew, pu);
    }
    // Smile ridge
    var smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.035, 6, 12, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x1a2018 })
    );
    smile.position.set(0, bodyY - 0.12 * bh, 0.7 * bw);
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;

    var hi = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })
    );
    hi.position.set(-0.32 * bw, bodyY + 0.38 * bh, 0.55);

    // Element ornaments (richer kits)
    var ornaments = [];
    var ornMat = new THREE.MeshStandardMaterial({
      color: tintColor.clone().offsetHSL(0, 0.05, 0.12),
      emissive: tintColor.clone(),
      emissiveIntensity: baseEmissive * 0.9,
      roughness: 0.32,
      metalness: 0.2
    });
    function addOrn(mesh, y, x, z) {
      mesh.position.set(x || 0, y || 0, z || 0);
      mesh.castShadow = true;
      ornaments.push(mesh);
      return mesh;
    }
    var orn = profile.ornaments;
    if (orn === 'leaf' || orn === 'sprout') {
      addOrn(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 7), ornMat), bodyY + 0.75 * bh, -0.2, 0.05);
      addOrn(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 7), ornMat), bodyY + 0.65 * bh, 0.28, -0.08);
      addOrn(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), ornMat), bodyY + 0.35, 0.5, 0.2);
    } else if (orn === 'shard' || orn === 'facet') {
      addOrn(new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), ornMat), bodyY + 0.85 * bh, 0.05, 0);
      addOrn(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), ornMat), bodyY + 0.45, -0.5, 0.2);
      addOrn(new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), ornMat), bodyY + 0.3, 0.48, 0.15);
    } else if (orn === 'ember' || orn === 'crust') {
      addOrn(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 5), ornMat), bodyY + 0.7, 0.35, 0.15);
      ornaments[ornaments.length - 1].rotation.z = -0.5;
      addOrn(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), ornMat), bodyY + 0.25, -0.5, 0.2);
      addOrn(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), ornMat), bodyY + 0.55, 0.48, -0.1);
    } else if (orn === 'bolt' || orn === 'spark') {
      addOrn(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 4), ornMat), bodyY + 0.95, 0.15, 0);
      ornaments[ornaments.length - 1].rotation.z = 0.45;
      addOrn(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 4), ornMat), bodyY + 0.7, -0.35, 0.1);
      ornaments[ornaments.length - 1].rotation.z = -0.5;
    } else if (orn === 'halo') {
      var halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.045, 8, 28),
        new THREE.MeshBasicMaterial({ color: tintColor })
      );
      halo.rotation.x = Math.PI / 2.5;
      addOrn(halo, bodyY + 0.75 * bh, 0, 0);
    } else if (orn === 'plate') {
      addOrn(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.45), ornMat), bodyY - 0.15, 0, 0.55);
      addOrn(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.3), ornMat), bodyY + 0.35, 0, 0.6);
    } else if (orn === 'bubble') {
      addOrn(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), ornMat), bodyY + 0.55, 0.52, 0.25);
      addOrn(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), ornMat), bodyY + 0.8, -0.35, 0.3);
      addOrn(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), ornMat), bodyY + 0.35, 0.4, 0.4);
    } else if (orn === 'rocks') {
      addOrn(new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), ornMat), bodyY + 0.4, 0.52, 0.15);
      addOrn(new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), ornMat), bodyY + 0.2, -0.55, 0.12);
      addOrn(new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), ornMat), bodyY + 0.55, 0.15, -0.4);
    } else if (orn === 'stars') {
      addOrn(new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), ornMat), bodyY + 0.7, 0.45, 0.35);
      addOrn(new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), ornMat), bodyY + 0.4, -0.45, 0.4);
      addOrn(new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), ornMat), bodyY + 0.9, 0, 0.2);
    } else if (orn === 'drip') {
      addOrn(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), ornMat), 0.35, 0.35, 0.35);
      addOrn(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), ornMat), 0.28, -0.25, 0.4);
      addOrn(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), ornMat), 0.22, 0.1, 0.45);
    } else if (orn === 'mist' || orn === 'wisps' || orn === 'swirl') {
      addOrn(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 6, 16), ornMat), bodyY + 0.2, 0.4, 0);
      ornaments[ornaments.length - 1].rotation.y = 0.6;
      addOrn(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 16), ornMat), bodyY + 0.5, -0.35, 0.1);
    }

    // Rarity crown / crest (Epic+)
    if (rarity === 'Epic' || rarity === 'Legendary' || rarity === 'Mythic') {
      var crest = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.4, 5),
        new THREE.MeshStandardMaterial({
          color: rarity === 'Mythic' ? 0xf472b6 : (rarity === 'Legendary' ? 0xf59e0b : 0xc084fc),
          emissive: rarity === 'Legendary' ? 0xf59e0b : 0xc084fc,
          emissiveIntensity: 0.5,
          metalness: 0.5,
          roughness: 0.25
        })
      );
      crest.position.set(0, bodyY + 0.95 * bh, 0);
      ornaments.push(crest);
    }

    // Legendary+ floating aura disc (RSL-class rarity read)
    var rarityAura = null;
    if (rarity === 'Legendary' || rarity === 'Mythic') {
      var auraCol = rarity === 'Mythic' ? 0xf472b6 : 0xf59e0b;
      rarityAura = new THREE.Mesh(
        new THREE.TorusGeometry(0.72 * bw, 0.035, 8, 32),
        new THREE.MeshBasicMaterial({
          color: auraCol, transparent: true, opacity: 0.55, depthWrite: false
        })
      );
      rarityAura.rotation.x = Math.PI / 2;
      rarityAura.position.y = 0.08;
      ornaments.push(rarityAura);
    }

    // Tiny arm nubs (creature language)
    var armL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), matSoft);
    var armR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), matSoft);
    armL.scale.set(0.7, 0.55, 0.9);
    armR.scale.set(0.7, 0.55, 0.9);
    armL.position.set(-0.72 * bw, bodyY - 0.05, 0.25);
    armR.position.set(0.72 * bw, bodyY - 0.05, 0.25);

    var root = new THREE.Group();
    root.add(shadow);
    root.add(skirt);
    root.add(footL, footR);
    root.add(outline);
    root.add(core);
    root.add(shell);
    root.add(cheekL, cheekR, crown);
    root.add(armL, armR);
    eyes.forEach(function (e) { root.add(e); });
    root.add(smile);
    ornaments.forEach(function (o) { root.add(o); });
    root.add(hi);
    // smile ref for dressGelWithArt to hide when portrait has a face

    // Hover only for ethereal types; others stay planted
    var floatY = hovers ? Math.min(0.12, profile.floatY || 0.1) : 0;

    return {
      root: root,
      shell: shell,
      core: core,
      coreMat: core.material,
      outline: outline,
      mat: mat,
      geo: geo,
      base: base,
      eyes: eyes,
      hi: hi,
      contactShadow: shadow,
      parts: {
        cheekL: cheekL, cheekR: cheekR, crown: crown,
        footL: footL, footR: footR, skirt: skirt, armL: armL, armR: armR,
        rarityAura: rarityAura, smile: smile
      },
      tint: tint,
      tintColor: tintColor,
      phase: Math.random() * Math.PI * 2,
      unitId: unit.id,
      isFoe: !!unit.isFoe,
      isImpostor: false,
      gelImpostor: false,
      grounded: !hovers,
      gelSize: gelSizeMult(unit),
      gelFloatY: floatY,
      solidEnemy: false,
      // Combat art plate native (dressGelWithArt) — keep 2.0 so spawn scale matches painted size
      nativeHeight: 2.0,
      nativeWidth: 1.72,
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

  function createGelFigure(THREE, unit) {
    var low = elKey(unit.element);
    var profile = gelProfile(low);
    var tint = ELEMENT_HEX[low] || 0x66bb6a;
    var tintColor = new THREE.Color(tint);
    var baseEmissive = Math.max(0.45, RARITY_EMISSIVE[unit.rarity] || 0.2);

    // ═══════════════════════════════════════════════════════════════════
    // PRODUCT LOCK — sprites first (painterly combat plates).
    // Full 3D GLB gels are V2 / opt-in only (sr_use_gel_glb=1 or SR_USE_GEL_GLB).
    // Hub GFX quality only scales lights/shadows/FX — not mesh vs sprite.
    // ═══════════════════════════════════════════════════════════════════
    var forceGlbOnly = !!global.SR_USE_GEL_GLB;
    if (!forceGlbOnly) {
      try {
        forceGlbOnly = (typeof localStorage !== 'undefined' &&
          localStorage.getItem('sr_use_gel_glb') === '1');
      } catch (eG) { forceGlbOnly = false; }
    }

    // Opt-in GLB-only mode for art pipeline tests — never the ship default
    if (forceGlbOnly && global.SR_MODELS && typeof global.SR_MODELS.tryGelFigure === 'function') {
      var glbOnly = global.SR_MODELS.tryGelFigure(THREE, unit, {
        tint: tint,
        baseEmissive: baseEmissive,
        targetHeight: 1.55 * (profile.size || 1),
        gelSize: gelSizeMult(unit),
        gelFloatY: 0,
        roughness: low === 'metal' ? 0.28 : 0.18,
        metalness: low === 'metal' ? 0.45 : 0.08
      });
      if (glbOnly) {
        glbOnly.gelSize = gelSizeMult(unit);
        glbOnly.gelFloatY = 0;
        glbOnly.grounded = true;
        glbOnly.solidEnemy = false;
        glbOnly.nativeHeight = glbOnly.nativeHeight || 1.65;
        console.log('[Battle3D] gel GLB only (opt-in, no sprite)', unit.element);
        return glbOnly;
      }
    }

    // Ship path (all quality tiers): painted full-body combat plate.
    // Low GFX uses pure impostor (cheapest). Med/high use dress path so
    // form/evo/attack pose plates still apply — visual is still a sprite.
    var q = _combatQuality || 'high';
    if (q === 'low') {
      var paintedLow = createGelImpostorFigure(THREE, unit, profile, tint, tintColor, baseEmissive);
      if (paintedLow) return paintedLow;
    }

    // Med/high: dress combat chroma sprite onto a figure (mesh body hidden when art loads).
    // Do NOT stack Blender GLB blobs under the plate.
    var fig = createComplexGroundedGel(THREE, unit);
    fig.artPending = true;
    if (fig.root) fig.root.visible = false;
    dressGelWithArt(THREE, fig, unit);
    if (fig.root && !fig.artPending) fig.root.visible = true;
    return fig;
  }

  function applyWobble(fig, t) {
    if (fig.melting || fig.dead || fig.solidEnemy || fig.isImpostor) return;
    if (!fig.geo || !fig.geo.attributes || !fig.base) return;
    var pos = fig.geo.attributes.position;
    var base = fig.base;
    var phase = fig.phase || 0;
    var arr = pos.array;
    var i;
    for (i = 0; i < pos.count; i++) {
      var ix = i * 3;
      var bx = base[ix];
      var by = base[ix + 1];
      var bz = base[ix + 2];
      var nlen = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
      var wave =
        Math.sin(t * 2.0 + by * 5 + phase) * 0.022 +
        Math.sin(t * 2.8 + bx * 3.6 + phase) * 0.011;
      arr[ix] = bx + (bx / nlen) * wave;
      arr[ix + 1] = by + (by / nlen) * wave * 0.85;
      arr[ix + 2] = bz + (bz / nlen) * wave;
    }
    pos.needsUpdate = true;
  }

  /**
   * Collapse mesh into a melting blob (loses body structure → flat puddle shape).
   * amount: 0 intact → 1 fully melted
   */
  function applyMeltDeform(fig, amount) {
    var pos = fig.geo.attributes.position;
    var base = fig.base;
    var arr = pos.array;
    var a = Math.max(0, Math.min(1, amount));
    // Ease-in so structure holds then collapses
    var k = a * a * (3 - 2 * a);
    var i;
    for (i = 0; i < pos.count; i++) {
      var ix = i * 3;
      var bx = base[ix];
      var by = base[ix + 1];
      var bz = base[ix + 2];
      // Pull everything down; upper verts fall harder (structure failure)
      var heightFactor = (by + 1) * 0.5; // 0 bottom → 1 top
      var collapse = k * (0.55 + heightFactor * 1.35);
      var ny = by * (1 - collapse * 0.92) - k * 0.95;
      // Splash outward as it hits the ground plane of the mesh
      var outward = 1 + k * (0.35 + Math.max(0, -ny + 0.2) * 2.8 + heightFactor * 0.9);
      // Wobble chaos as cohesion fails
      var chaos = k * 0.12 * Math.sin(i * 1.7 + k * 9);
      arr[ix] = bx * outward + chaos * bx;
      arr[ix + 1] = ny;
      arr[ix + 2] = bz * outward + chaos * bz * 0.8;
    }
    pos.needsUpdate = true;
    fig.geo.computeVertexNormals();
  }

  function create(opts) {
    opts = opts || {};
    if (!available()) return null;

    var THREE = global.THREE;
    var theme = themeFromOpts(opts);
    var width = Math.max(640, opts.width || 1920);
    var height = Math.max(360, opts.height || 1080);
    // Keep 3D buffer at 1x logical res for reliable blit into Phaser (Safari-safe)
    var dpr = 1;

    // Offscreen WebGL canvas (NOT under Phaser — Safari makes Phaser canvas opaque so underlay fails)
    var glCanvas = document.createElement('canvas');
    glCanvas.width = width;
    glCanvas.height = height;
    glCanvas.setAttribute('data-battle3d-gl', '1');
    // Keep in DOM but invisible (some GPUs dislike fully detached canvases)
    glCanvas.style.cssText = 'position:fixed;left:-9999px;top:0;width:4px;height:4px;opacity:0;pointer-events:none;';
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(glCanvas);
    }

    // 2D canvas Phaser actually displays (updated every frame via drawImage)
    var blitCanvas = document.createElement('canvas');
    blitCanvas.width = width;
    blitCanvas.height = height;
    var blitCtx = blitCanvas.getContext('2d', { alpha: false, willReadFrequently: false });
    if (blitCtx) {
      blitCtx.fillStyle = '#0a1810';
      blitCtx.fillRect(0, 0, width, height);
    }

    var host = (typeof document !== 'undefined')
      ? document.getElementById('battle-3d-host')
      : null;
    if (host) {
      host.style.display = 'none';
      host.setAttribute('aria-hidden', 'true');
      while (host.firstChild) host.removeChild(host.firstChild);
    }

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
      console.warn('[Battle3D] WebGL failed', e);
      return null;
    }

    // —— Phase 4 quality tiers (low / med / high) ——
    var Q = resolveBattleQuality({
      quality: opts.quality,
      width: width,
      dpr: opts.dpr || 1
    });
    var quality = Q.id;
    _combatQuality = quality;
    console.log('[Battle3D] quality', Q.id);

    try {
      var gl = renderer.getContext && renderer.getContext();
      if (gl && gl.getParameter) {
        _maxAnisotropy = gl.getParameter(gl.MAX_TEXTURE_MAX_ANISOTROPY_EXT) ||
          gl.getParameter(0x84FF) || 16;
      } else if (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
        _maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
      }
    } catch (eAn) {
      _maxAnisotropy = 16;
    }
    renderer.setPixelRatio(
      quality === 'high' ? Math.min(opts.dpr || 1, 1.5)
        : (quality === 'med' ? Math.min(opts.dpr || 1, 1.25) : 1)
    );
    renderer.setSize(width, height, false);
    // Clear toward sky (not mud-dark fog) so edges stay vibrant
    var clearCol = theme.skyBot != null ? theme.skyBot : theme.fog;
    renderer.setClearColor(clearCol, 1);
    if (renderer.outputColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    if (renderer.toneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // Mild filmic grade — lifted exposure (no dark vignette wash)
      renderer.toneMappingExposure = Q.exposure;
    }
    renderer.shadowMap.enabled = !!Q.shadows;
    if (THREE.PCFSoftShadowMap) renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var scene = new THREE.Scene();
    // Light atmospheric haze only — avoid greying out the mid-field fight strip
    var fogNear = Math.max(22, (theme.fogNear || 16) + 10);
    var fogFar = Math.max(85, (theme.fogFar || 48) + 40);
    // Lift fog color toward sky so haze doesn't read as a dark veil
    var fogCol = new THREE.Color(theme.fog || 0x0c2218);
    if (theme.skyBot != null) {
      fogCol.lerp(new THREE.Color(theme.skyBot), 0.45);
    }
    scene.fog = new THREE.Fog(fogCol, fogNear, fogFar);

    // Raid-style: camera orbits arena center — yaw left while still looking at center
    var camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 140);
    // Base rig (pre-yaw): slightly pulled back so wider zone fills the frame
    var camLook = { x: 0.6, y: 0.55, z: -0.8 };
    var camBase = { x: -9.2, y: 6.4, z: 10.2 };
    // Yaw around look-at (still aimed at camLook). Negative = opposite of first try (user-preferred side).
    var CAM_YAW_LEFT_DEG = -30;
    var camHome = (function (base, look, yawDeg) {
      var rad = (yawDeg * Math.PI) / 180;
      var cos = Math.cos(rad);
      var sin = Math.sin(rad);
      var ox = base.x - look.x;
      var oy = base.y - look.y;
      var oz = base.z - look.z;
      // Rotate offset around world Y (look-at fixed)
      return {
        x: look.x + ox * cos + oz * sin,
        y: look.y + oy,
        z: look.z + (-ox * sin + oz * cos)
      };
    })(camBase, camLook, CAM_YAW_LEFT_DEG);
    camera.position.set(camHome.x, camHome.y, camHome.z);
    camera.lookAt(camLook.x, camLook.y, camLook.z);

    // Lane axis: bottom-left (near) → top-right (far) in XZ
    // Centerline + perpendicular used for two facing lines (allies | foes)
    var LANE = (function () {
      var bl = { x: -2.8, z: 2.5 };   // bottom-left end (near)
      var tr = { x: 2.9, z: -2.4 };   // top-right end (far)
      var dx = tr.x - bl.x;
      var dz = tr.z - bl.z;
      var len = Math.sqrt(dx * dx + dz * dz) || 1;
      dx /= len;
      dz /= len;
      // Perp in XZ (points "right" of travel BL→TR)
      var px = -dz;
      var pz = dx;
      return {
        bl: bl,
        tr: tr,
        dx: dx,
        dz: dz,
        px: px,
        pz: pz,
        // t: 0 = BL near, 1 = TR far
        len: len,
        point: function (t, side) {
          // side: -1 ally (left of path), +1 foe (right of path)
          // halfWidth = distance from corridor center to each team line
          var halfWidth = LANE_DEFAULT.halfWidth;
          var x = bl.x + dx * (t * len) + px * halfWidth * side;
          var z = bl.z + dz * (t * len) + pz * halfWidth * side;
          return { x: x, z: z };
        }
      };
    })();

    // —— Lighting (RSL-class: bright midfield, strong key, cool rim) ——
    scene.add(new THREE.AmbientLight(theme.ambient || 0xc8d8e0, quality === 'low' ? 0.88 : 1.0));
    var hemi = new THREE.HemisphereLight(theme.hemiSky || 0xd0e8ff, theme.floor, quality === 'high' ? 1.05 : 0.95);
    scene.add(hemi);

    // Steady key — soft shadows; wide frustum so forest props + figures both shade
    var key = new THREE.DirectionalLight(theme.key, quality === 'high' ? 1.72 : 1.58);
    key.position.set(8, 18, 9);
    key.castShadow = !!Q.shadows;
    key.shadow.mapSize.width = Q.shadowMap;
    key.shadow.mapSize.height = Q.shadowMap;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = quality === 'high' ? 70 : 55;
    // Cover near fight strip + mid/far tree belt (~30u scatter)
    var shSpan = quality === 'high' ? 34 : (quality === 'low' ? 18 : 26);
    key.shadow.camera.left = -shSpan;
    key.shadow.camera.right = shSpan;
    key.shadow.camera.top = shSpan;
    key.shadow.camera.bottom = -shSpan;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.045;
    key.shadow.radius = quality === 'high' ? 2.5 : 1.5;
    scene.add(key);

    var rim = new THREE.DirectionalLight(theme.rimLight, 0.72);
    rim.position.set(-6, 5, -4);
    scene.add(rim);

    var fill = new THREE.PointLight(theme.fill, 0.42, 32);
    fill.position.set(0, 4.5, 5);
    scene.add(fill);

    // Quiet scene lights only — no flickering ground wash / team mood pulses
    // (those read as flashing ovals on the floor)
    var torchL = null;
    var torchR = null;
    if (theme.isArena && theme.hasTorches) {
      var torchCol = theme.id === 'shadowfen' || theme.id === 'shadow_abyss' ? 0x8866aa : 0xcc8844;
      torchL = new THREE.PointLight(torchCol, 0.45, 12);
      torchL.position.set(-6.5, 3.5, -2.5);
      scene.add(torchL);
      torchR = new THREE.PointLight(torchCol, 0.45, 12);
      torchR.position.set(6.5, 3.5, -2.5);
      scene.add(torchR);
    }

    // —— Painted-realism env kit (sky + ground plate + billboard props) ——
    var isArena = !!theme.isArena;
    var envKey = theme.envKey || resolveEnvKey(theme);
    // Monostand foliage for tree battles (green OR blue — never random mix)
    var forestPalette = theme.forestPalette || resolveForestPalette(theme);
    theme.forestPalette = forestPalette;
    var urls = envUrls(envKey, {
      forestPalette: theme.props === 'trees' ? forestPalette : null
    });
    // Continuous floor texture (ClampToEdge, no RepeatWrapping tile grid).
    var groundTex = loadEnvTexture(THREE, urls.ground, { ground: true });
    var skyTex = loadEnvTexture(THREE, urls.sky, null);
    // Tree/prop billboards — one monostand palette pack; silhouette variety within family
    // magentaOnly: never green/cyan-key foliage
    var propTexList = [];
    var propSrcList = (urls.props && urls.props.length) ? urls.props : [urls.prop];
    var pi;
    for (pi = 0; pi < propSrcList.length; pi++) {
      var pt = loadEnvTexture(THREE, propSrcList[pi], {
        chroma: true,
        magentaOnly: true,
        propKey: true
      });
      if (pt) propTexList.push(pt);
    }
    var propTex = propTexList.length ? propTexList[0] : null;

    scene.add(makeTexturedSky(THREE, theme, skyTex));

    var seed = theme.seed || 1;
    // Round-robin index so dense forests don't stamp the same silhouette repeatedly
    var propPickCursor = Math.floor(seededRand(seed, 19) * 7);
    var accentCol = new THREE.Color(theme.accent);
    var pathCol = new THREE.Color(theme.path || theme.accent);
    var stoneMat = new THREE.MeshStandardMaterial({
      color: theme.stone || 0x2a3830, roughness: 0.78, metalness: 0.12
    });
    var stoneDark = new THREE.MeshStandardMaterial({
      color: theme.stoneDark || 0x1a2420, roughness: 0.85, metalness: 0.08
    });
    var goldMat = new THREE.MeshStandardMaterial({
      color: 0xc9a227, roughness: 0.35, metalness: 0.75,
      emissive: 0x553300, emissiveIntensity: 0.15
    });
    // Clay fallback canopy matches monostand (green or blue glow grove)
    var leafMat = new THREE.MeshStandardMaterial({
      color: forestPalette === 'blue' ? 0x3a6a9a : 0x2a6a40,
      roughness: 0.85, metalness: 0.05,
      emissive: forestPalette === 'blue' ? 0x0a2040 : 0x0a2814,
      emissiveIntensity: forestPalette === 'blue' ? 0.22 : 0.12
    });
    var crystalMat = new THREE.MeshStandardMaterial({
      color: theme.accent, roughness: 0.15, metalness: 0.55,
      emissive: theme.accent, emissiveIntensity: 0.35,
      transparent: true, opacity: 0.88
    });

    // —— Terrain: continuous world floor (forest clearing), NOT a floating pad ——
    // No translucent sphere "hills" — those read as green glass domes in-camera.
    // Depth comes from painted floor + tree billboards + sky only.
    var groundRough = theme.ground === 'ice' ? 0.35
      : (theme.ground === 'star' ? 0.45
        : (theme.ground === 'ash' ? 0.9
          : (theme.ground === 'mire' ? 0.75 : 0.88)));
    var groundMetal = theme.ground === 'ice' || theme.ground === 'star' ? 0.18 : 0.05;
    var wildGround = theme.props === 'trees' || theme.ground === 'moss' || theme.ground === 'mire'
      || theme.id === 'greenwild' || envKey === 'greenwild';
    // Large enough that plate edges stay off-screen (TR corner was clipping before)
    var floorSize = wildGround ? 140 : (isArena ? 110 : 128);

    var groundMat = new THREE.MeshStandardMaterial({
      map: groundTex || null,
      color: groundTex ? 0xffffff : (theme.floor || 0x1f4a32),
      roughness: groundRough,
      metalness: groundMetal,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    var worldFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSize, floorSize, 1, 1),
      groundMat
    );
    worldFloor.rotation.x = -Math.PI / 2;
    // Nudge center toward camera far / screen top-right so horizon edge is buried
    // under sky/fog instead of a visible plate corner
    worldFloor.position.set(4.5, 0, -5.5);
    worldFloor.receiveShadow = true;
    scene.add(worldFloor);

    // Formal raid lip ONLY for stone/dungeon-style arenas (not forest wilds)
    var formalRing = isArena && !wildGround && theme.props !== 'trees';
    if (formalRing) {
      var lip = new THREE.Mesh(
        new THREE.TorusGeometry(9.0, 0.14, 10, 56),
        new THREE.MeshStandardMaterial({
          color: theme.stone || 0x2a3830,
          roughness: 0.82,
          metalness: 0.12,
          emissive: theme.accent || 0x335544,
          emissiveIntensity: 0.12
        })
      );
      lip.rotation.x = Math.PI / 2;
      lip.position.y = 0.05;
      scene.add(lip);
      var lipOuter = new THREE.Mesh(
        new THREE.TorusGeometry(9.35, 0.06, 8, 48),
        new THREE.MeshStandardMaterial({
          color: theme.accent || 0x77ffaa,
          roughness: 0.55,
          metalness: 0.25,
          emissive: theme.accent || 0x77ffaa,
          emissiveIntensity: 0.18
        })
      );
      lipOuter.rotation.x = Math.PI / 2;
      lipOuter.position.y = 0.07;
      scene.add(lipOuter);
    }

    var runeRings = [];
    var gem = null;

    // —— Chapter props (edges of the battle zone) ——
    var braziers = [];

    /**
     * Block props that sit in the fight strip or between camera and champions.
     * tall=true for trees/obelisks that can occlude gels.
     */
    function propAllowed(x, z, tall) {
      // Clear diagonal battlefield (both team lines + corridor)
      var bl = LANE.bl;
      var tr = LANE.tr;
      var ldx = tr.x - bl.x;
      var ldz = tr.z - bl.z;
      var len = Math.sqrt(ldx * ldx + ldz * ldz) || 1;
      var ux = ldx / len;
      var uz = ldz / len;
      var wx = x - bl.x;
      var wz = z - bl.z;
      var along = wx * ux + wz * uz;
      var lat = wx * (-uz) + wz * ux;
      // Keep props outside both team lines + midfield (tracks LANE halfWidth)
      var laneHW = LANE_DEFAULT.halfWidth;
      var fightHalf = tall ? (laneHW + 2.1) : (laneHW + 1.35);
      if (along > -1.2 && along < len + 1.2 && Math.abs(lat) < fightHalf) return false;

      // Clear a cone from camera toward arena center (champions live here)
      var vx = camLook.x - camHome.x;
      var vz = camLook.z - camHome.z;
      var vlen = Math.sqrt(vx * vx + vz * vz) || 1;
      vx /= vlen;
      vz /= vlen;
      var fx = x - camHome.x;
      var fz = z - camHome.z;
      var alongView = fx * vx + fz * vz;
      var latView = Math.abs(fx * (-vz) + fz * vx);
      // Near camera: never place tall props
      if (alongView > 0 && alongView < 7.5 && latView < (tall ? 4.5 : 3.2)) return false;
      // Mid distance view corridor — no trees in front of gels
      if (tall && alongView > 0 && alongView < 16 && latView < 3.4) return false;
      // Absolute near-camera bubble
      var dCam = Math.sqrt(fx * fx + fz * fz);
      if (dCam < (tall ? 7.0 : 5.0)) return false;
      return true;
    }

    function placeAround(count, radius, fn, opts) {
      opts = opts || {};
      var tall = !!opts.tall;
      var i;
      var placed = 0;
      var ang0 = opts.ang0 != null ? opts.ang0 : 0;
      var angSpan = opts.angSpan != null ? opts.angSpan : Math.PI * 2;
      var jitter = opts.jitter != null ? opts.jitter : 1.4;
      for (i = 0; i < count * 5 && placed < count; i++) {
        // Sporadic: random slot along arc (not even spacing) + wide angle/radius noise
        var u = seededRand(seed, i * 17 + placed * 3 + 2);
        var t = ang0 + u * angSpan + (seededRand(seed, i + 3) - 0.5) * (angSpan / Math.max(3, count)) * jitter;
        var rMin = opts.rMin != null ? opts.rMin : (tall ? 0.88 : 0.84);
        var rMax = opts.rMax != null ? opts.rMax : 1.12;
        var r = radius * (rMin + seededRand(seed, i + 9) * (rMax - rMin));
        // Occasional push farther / pull closer so rings don't read as circles
        if (seededRand(seed, i + 51) > 0.72) r *= 0.82 + seededRand(seed, i + 52) * 0.45;
        var x = Math.cos(t) * r;
        var z = Math.sin(t) * r * (0.82 + seededRand(seed, i + 61) * 0.22);
        if (!propAllowed(x, z, tall)) continue;
        // Soft min-distance vs already placed (stored on fn via opts.used)
        var used = opts.used;
        if (used && used.length) {
          var minD = opts.minDist != null ? opts.minDist : (tall ? 3.2 : 2.4);
          var ok = true;
          var ui;
          for (ui = 0; ui < used.length; ui++) {
            var dx = x - used[ui][0];
            var dz = z - used[ui][1];
            if (dx * dx + dz * dz < minD * minD) { ok = false; break; }
          }
          if (!ok) continue;
          used.push([x, z]);
        }
        fn(x, z, placed);
        placed++;
      }
    }

    /**
     * Scatter props in a loose band — irregular clumps + gaps, not parade rings.
     * used entries may be [x,z] or {x,z,scale}; ground minDist only.
     */
    function placeScatter(count, rInner, rOuter, fn, opts) {
      opts = opts || {};
      var tall = !!opts.tall;
      var ang0 = opts.ang0 != null ? opts.ang0 : 0;
      var angSpan = opts.angSpan != null ? opts.angSpan : Math.PI * 2;
      var used = opts.used || [];
      var minD = opts.minDist != null ? opts.minDist : (tall ? 3.6 : 2.6);
      var placed = 0;
      var tries;
      for (tries = 0; tries < count * 8 && placed < count; tries++) {
        // Cluster bias: occasionally reuse previous angle neighborhood
        var t;
        if (placed > 0 && seededRand(seed, tries + 90) > 0.55 && used.length) {
          var prev = used[Math.floor(seededRand(seed, tries + 91) * used.length) % used.length];
          var px = prev.x != null ? prev.x : prev[0];
          var pz = prev.z != null ? prev.z : prev[1];
          var baseAng = Math.atan2(pz, px);
          t = baseAng + (seededRand(seed, tries + 92) - 0.5) * 0.9;
        } else {
          t = ang0 + seededRand(seed, tries + 11) * angSpan;
        }
        // Skip whole angular gaps so forest feels patchy
        if (seededRand(seed, tries + 77) > 0.88) continue;
        var rr = rInner + seededRand(seed, tries + 22) * (rOuter - rInner);
        // Squash Z a bit for camera-friendly depth
        var x = Math.cos(t) * rr;
        var z = Math.sin(t) * rr * (0.78 + seededRand(seed, tries + 33) * 0.28);
        if (!propAllowed(x, z, tall)) continue;
        var ok = true;
        var ui;
        for (ui = 0; ui < used.length; ui++) {
          var ux = used[ui].x != null ? used[ui].x : used[ui][0];
          var uz = used[ui].z != null ? used[ui].z : used[ui][1];
          var dx = x - ux;
          var dz = z - uz;
          if (dx * dx + dz * dz < minD * minD) { ok = false; break; }
        }
        if (!ok) continue;
        // Random skip after candidate — sparser look
        if (seededRand(seed, tries + 44) > 0.82) continue;
        used.push([x, z]);
        fn(x, z, placed);
        placed++;
      }
      opts.used = used;
      return used;
    }

    // Camera forward on XZ — used so overlapping canopies need real depth separation
    var viewFx = camLook.x - camHome.x;
    var viewFz = camLook.z - camHome.z;
    var viewFLen = Math.sqrt(viewFx * viewFx + viewFz * viewFz) || 1;
    viewFx /= viewFLen;
    viewFz /= viewFLen;
    // Camera right (XZ) — lateral screen axis
    var viewRx = -viewFz;
    var viewRz = viewFx;

    /**
     * Match addTree + addPaintedProp final size so spacing uses the scale we spawn.
     * Returns { scale, canopyR } where canopyR is half billboard width in world units.
     */
    function estimateTreeSize(x, z, i) {
      var dist = Math.sqrt(x * x + z * z);
      var base = dist < 15 ? 8.2 : (dist < 22 ? 10.5 : 13.5);
      base *= 0.9 + seededRand(seed, i + 88) * 0.28;
      var scale = base * (0.88 + seededRand(seed, i + 20) * 0.35);
      if (dist > 18) scale *= 1.18;
      if (dist > 24) scale *= 1.15;
      var hMul = 0.92 + seededRand(seed, i + 33) * 0.22;
      var wMul = 0.94 + seededRand(seed, i + 34) * 0.16;
      // Billboard height ≈ scale*hMul; width ≈ scale*wMul (square plane before stretch)
      var height = scale * hMul;
      var width = scale * wMul;
      return {
        scale: scale,
        height: height,
        canopyR: width * 0.42
      };
    }

    /** Horizontal canopy footprint radius for a billboard of given height scale. */
    function treeCanopyRadius(scaleOrSize) {
      if (scaleOrSize && typeof scaleOrSize === 'object' && scaleOrSize.canopyR != null) {
        return scaleOrSize.canopyR;
      }
      return (scaleOrSize || 10) * 0.38;
    }

    /**
     * Reject tree sites that would stack on each other.
     * Side-by-side at same depth need lateral gap ~ canopy sum;
     * if canopies cross in screen-lateral, depth along camera must be large enough
     * for the tree size so the rear one reads as behind, not glued on top.
     */
    function treePlacementOk(x, z, size, usedTrees) {
      var r = size.canopyR;
      var scale = size.scale;
      var depth = (x - camHome.x) * viewFx + (z - camHome.z) * viewFz;
      var lat = (x - camHome.x) * viewRx + (z - camHome.z) * viewRz;
      var ui;
      for (ui = 0; ui < usedTrees.length; ui++) {
        var o = usedTrees[ui];
        var dx = x - o.x;
        var dz = z - o.z;
        var ground = Math.sqrt(dx * dx + dz * dz);
        var rO = o.canopyR != null ? o.canopyR : treeCanopyRadius(o.scale);
        var rSum = r + rO;
        // Trunks / bases never share the same spot
        var trunkMin = Math.max(2.0, Math.min(r, rO) * 0.55);
        if (ground < trunkMin) return false;

        var dDepth = Math.abs(depth - o.depth);
        var dLat = Math.abs(lat - o.lat);

        // Comfortably side-by-side: canopies can brush (~20% soft overlap)
        var latClear = rSum * 0.72;
        if (dLat >= latClear) continue;

        // How hard canopies overlap on the lateral (screen) axis, 0..1+
        var latOverlap = 1 - dLat / latClear;
        if (latOverlap < 0) continue;

        // Depth needed scales with tree size — bigger canopies need more "behind" space
        // when they share the same screen column. Mild brush at low overlap is fine.
        var sizeRef = Math.max(scale, o.scale);
        var heightRef = Math.max(size.height || scale, o.height || o.scale);
        var needDepth = (0.22 + 0.68 * latOverlap) * heightRef * 0.48;
        // Far trees can sit a bit denser in depth (perspective compresses them)
        var avgDist = (Math.sqrt(x * x + z * z) + Math.sqrt(o.x * o.x + o.z * o.z)) * 0.5;
        if (avgDist > 22) needDepth *= 0.85;
        if (avgDist > 28) needDepth *= 0.88;
        // Hard floor: never glue two large trees with almost no depth
        needDepth = Math.max(needDepth, sizeRef * 0.2 * latOverlap);

        if (dDepth < needDepth) return false;

        // Even with depth, avoid almost-identical ground positions under heavy overlap
        if (latOverlap > 0.6 && ground < rSum * 0.32) return false;
      }
      return true;
    }

    /**
     * Scatter trees with size-aware depth/lateral separation (not isotropic minDist alone).
     * usedTrees: {x,z,scale,canopyR,height,depth,lat}[]
     */
    function placeTreeScatter(count, rInner, rOuter, usedTrees, opts) {
      opts = opts || {};
      var ang0 = opts.ang0 != null ? opts.ang0 : 0;
      var angSpan = opts.angSpan != null ? opts.angSpan : Math.PI * 2;
      var placed = 0;
      var tries;
      var maxTries = count * 20;
      for (tries = 0; tries < maxTries && placed < count; tries++) {
        var t;
        if (placed > 0 && usedTrees.length && seededRand(seed, tries + 90) > 0.58) {
          // Mild clump: near a neighbor angle, but placementOk still enforces depth
          var prev = usedTrees[Math.floor(seededRand(seed, tries + 91) * usedTrees.length) % usedTrees.length];
          t = Math.atan2(prev.z, prev.x) + (seededRand(seed, tries + 92) - 0.5) * 1.15;
        } else {
          t = ang0 + seededRand(seed, tries + 11) * angSpan;
        }
        // Patchy gaps
        if (seededRand(seed, tries + 77) > 0.92) continue;
        var rr = rInner + seededRand(seed, tries + 22) * (rOuter - rInner);
        // Prefer slight depth jitter so candidates aren't on a flat ring
        if (seededRand(seed, tries + 55) > 0.48) {
          rr += (seededRand(seed, tries + 56) - 0.5) * (rOuter - rInner) * 0.42;
          rr = Math.max(rInner * 0.9, Math.min(rOuter * 1.08, rr));
        }
        var x = Math.cos(t) * rr;
        var z = Math.sin(t) * rr * (0.78 + seededRand(seed, tries + 33) * 0.28);
        if (!propAllowed(x, z, true)) continue;

        var idx = usedTrees.length;
        var size = estimateTreeSize(x, z, idx);
        if (!treePlacementOk(x, z, size, usedTrees)) continue;
        // Occasional skip for air / gaps
        if (seededRand(seed, tries + 44) > 0.9) continue;

        var depth = (x - camHome.x) * viewFx + (z - camHome.z) * viewFz;
        var lat = (x - camHome.x) * viewRx + (z - camHome.z) * viewRz;
        usedTrees.push({
          x: x, z: z,
          scale: size.scale,
          height: size.height,
          canopyR: size.canopyR,
          depth: depth,
          lat: lat
        });
        addTree(x, z, idx);
        placed++;
      }
      return placed;
    }

    /**
     * Forest backdrop: wings + mid/far bands with gaps.
     * Trees never stack — overlapping silhouettes require depth ≈ size.
     */
    function placeForestTrees() {
      var usedTrees = [];
      // Near wings (clearer read next to arena)
      placeTreeScatter(8, 11, 16, usedTrees, { ang0: -0.75, angSpan: 1.1 });
      placeTreeScatter(8, 11, 16, usedTrees, { ang0: 2.1, angSpan: 1.1 });
      // Mid band — denser for RSL-class stage fill
      placeTreeScatter(14, 15, 22, usedTrees, { ang0: 0.0, angSpan: Math.PI * 1.3 });
      // Far silhouette
      placeTreeScatter(14, 22, 30, usedTrees, { ang0: -0.2, angSpan: Math.PI * 1.4 });
      // Outer + loners
      placeTreeScatter(10, 27, 36, usedTrees, { ang0: -0.4, angSpan: Math.PI * 1.55 });
      placeTreeScatter(7, 17, 32, usedTrees, { ang0: -0.55, angSpan: Math.PI * 1.65 });
    }

    /** Painted prop card when kit exists; clay fallback if texture missing */
    function addPaintedProp(x, z, i, baseScale) {
      baseScale = baseScale || 4.2;
      // Prefer successfully loaded prop maps (skip 404 placeholders)
      var texPool = (propTexList.length ? propTexList : (propTex ? [propTex] : [])).filter(function (t) {
        return t && !t.userData.failed && (t.image || t.userData.loadOk !== false);
      });
      // Before any load completes, still allow first entry (async fill)
      if (!texPool.length && propTexList.length) texPool = [propTexList[0]];
      if (texPool.length) {
        // Mix variants: mostly round-robin through the pack, with occasional random hop
        // so forests feel like several similar trees — not a clone army
        var pick;
        if (seededRand(seed, i + 41) > 0.35) {
          pick = propPickCursor % texPool.length;
          propPickCursor += 1 + (seededRand(seed, i + 42) > 0.7 ? 1 : 0);
        } else {
          pick = Math.floor(seededRand(seed, i + 43) * texPool.length) % texPool.length;
        }
        var useTex = texPool[pick];
        if (useTex.userData && useTex.userData.failed) {
          addTreeClay(x, z, i);
          return;
        }
        // Trees must read taller than combat gels (~2u); keep them forest-scale
        var scale = baseScale * (0.88 + seededRand(seed, i + 20) * 0.35);
        var dist = Math.sqrt(x * x + z * z);
        if (dist > 18) scale *= 1.18;
        if (dist > 24) scale *= 1.15;
        // Mild silhouette stretch only — monostand palette already fixed (no hue drift)
        var hMul = 0.92 + seededRand(seed, i + 33) * 0.22;
        var wMul = 0.94 + seededRand(seed, i + 34) * 0.16;
        var spr = makePropBillboard(THREE, useTex, scale);
        spr.scale.y *= hMul;
        spr.scale.x *= wMul;
        if (spr.material) {
          spr.material = spr.material.clone();
          spr.material.alphaTest = 0.64;
          // Flip ~half for branch variety without new textures
          if (seededRand(seed, i + 7) > 0.48) spr.scale.x *= -1;
          // Keep white — foliage color comes from the monostand pack only
          if (spr.material.color) spr.material.color.setRGB(1, 1, 1);
        }
        // Group: billboard + shape-aware contact shadow (sprites don't cast maps)
        var propG = new THREE.Group();
        propG.position.set(x, 0, z);
        propG.add(spr);
        var treeW = Math.abs(spr.scale.x);
        var treeH = Math.abs(spr.scale.y);
        var footR = Math.max(1.0, treeW * 0.34 + treeH * 0.06);
        var dist2 = Math.sqrt(x * x + z * z);
        var opac = dist2 > 22 ? 0.5 : (dist2 > 16 ? 0.62 : 0.78);
        var shadowKind = theme.props || 'tree';
        // Pass prop map so trees get real alpha-silhouette shadows (not a disc)
        function attachShadow() {
          // Drop any prior prop shadow children
          var ci;
          for (ci = propG.children.length - 1; ci >= 0; ci--) {
            var ch = propG.children[ci];
            if (ch && ch.userData && ch.userData.isPropShadow) propG.remove(ch);
          }
          var sh = makePropContactShadow(THREE, footR, opac, shadowKind, {
            propTex: useTex,
            treeW: treeW,
            treeH: treeH,
            flipX: spr.scale.x < 0
          });
          // Do not random-yaw: cast must follow key light from trunk base
          propG.add(sh);
        }
        attachShadow();
        // Prop maps load async — rebuild silhouette once image/chroma is ready
        if ((shadowKind === 'tree' || shadowKind === 'trees') && useTex && !useTex.image) {
          var tries = 0;
          var iv = setInterval(function () {
            tries++;
            if ((useTex && useTex.image) || tries > 30) {
              clearInterval(iv);
              try { attachShadow(); } catch (eSh) { /* ignore */ }
            }
          }, 100);
        }
        scene.add(propG);
        return;
      }
      // Geometry fallback (pre-kit)
      addTreeClay(x, z, i);
    }

    function addTreeClay(x, z, i) {
      var g = new THREE.Group();
      var h = 6.5 + seededRand(seed, i + 20) * 4.5;
      var trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.38, h * 0.55, 8),
        stoneDark
      );
      trunk.position.y = h * 0.22;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      g.add(trunk);
      var canopy = new THREE.Mesh(
        new THREE.SphereGeometry(1.6 + seededRand(seed, i) * 0.9, 10, 8),
        leafMat
      );
      canopy.position.y = h * 0.55;
      canopy.scale.set(1.25, 0.9, 1.25);
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      g.add(canopy);
      var claySh = makePropContactShadow(
        THREE,
        1.55 + seededRand(seed, i + 9) * 0.65,
        0.65,
        'tree'
      );
      g.add(claySh);
      g.position.set(x, 0, z);
      scene.add(g);
    }

    function addTree(x, z, i) {
      // Towers over gels (~2u) — near trees still clearly taller
      var dist = Math.sqrt(x * x + z * z);
      var base = dist < 15 ? 8.2 : (dist < 22 ? 10.5 : 13.5);
      base *= 0.9 + seededRand(seed, i + 88) * 0.28;
      addPaintedProp(x, z, i, base);
    }
    function addCrystal(x, z, i) { addPaintedProp(x, z, i, 3.8); }
    function addReed(x, z, i) { addPaintedProp(x, z, i, 3.4); }
    function addSpire(x, z, i) { addPaintedProp(x, z, i, 4.0); }
    function addObelisk(x, z, i) { addPaintedProp(x, z, i, 4.6); }

    function addPillar(x, z, h) {
      h = h || 4.0;
      var g = new THREE.Group();
      var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, h, 12), stoneMat);
      shaft.position.y = h * 0.5;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      g.add(shaft);
      var base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.28, 12), stoneDark);
      base.position.y = 0.14;
      base.castShadow = true;
      base.receiveShadow = true;
      g.add(base);
      g.add(makePropContactShadow(THREE, 0.9, 0.55, 'spire'));
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 0.35, 12), stoneDark);
      cap.position.y = h + 0.1;
      g.add(cap);
      var orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 12, 10),
        new THREE.MeshStandardMaterial({
          color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.9,
          roughness: 0.2, metalness: 0.3
        })
      );
      orb.position.y = h + 0.42;
      g.add(orb);
      g.position.set(x, 0, z);
      scene.add(g);
      return g;
    }

    function addBrazier(x, z) {
      var g = new THREE.Group();
      var bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.45, 10), goldMat);
      bowl.position.y = 0.9;
      bowl.castShadow = true;
      g.add(bowl);
      var stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.85, 8), stoneDark);
      stand.position.y = 0.42;
      stand.castShadow = true;
      g.add(stand);
      g.add(makePropContactShadow(THREE, 0.52, 0.5, 'blob'));
      var flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.85 })
      );
      flame.position.y = 1.25;
      flame.scale.set(1, 1.4, 1);
      g.add(flame);
      // Low steady light (no flicker) so ground doesn't strobe
      var light = new THREE.PointLight(0xff7722, 0.35, 7);
      light.position.y = 1.4;
      g.add(light);
      g.position.set(x, 0, z);
      g.userData.flame = flame;
      scene.add(g);
      return g;
    }

    // Edge scenery — denser scatter for RSL-class stage (fight strip stays clear)
    if (theme.props === 'trees') {
      placeForestTrees();
    } else if (theme.props === 'crystals') {
      var cUsed = [];
      placeScatter(9, 12, 17, addCrystal, { tall: true, used: cUsed, minDist: 3.0, ang0: 0.1, angSpan: Math.PI * 1.35 });
      placeScatter(8, 18, 28, addCrystal, { tall: true, used: cUsed, minDist: 3.4, ang0: 0, angSpan: Math.PI * 1.45 });
      placeScatter(5, 24, 32, addCrystal, { tall: true, used: cUsed, minDist: 3.8, ang0: 0.2, angSpan: Math.PI * 1.2 });
    } else if (theme.props === 'reeds') {
      var rUsed = [];
      placeScatter(10, 12, 17, addReed, { tall: true, used: rUsed, minDist: 2.4, ang0: 0.1, angSpan: Math.PI * 1.35 });
      placeScatter(8, 18, 28, addReed, { tall: true, used: rUsed, minDist: 2.8, ang0: 0, angSpan: Math.PI * 1.45 });
    } else if (theme.props === 'spires') {
      var sUsed = [];
      placeScatter(9, 12, 17, addSpire, { tall: true, used: sUsed, minDist: 3.2, ang0: 0.15, angSpan: Math.PI * 1.3 });
      placeScatter(8, 18, 28, addSpire, { tall: true, used: sUsed, minDist: 3.6, ang0: 0, angSpan: Math.PI * 1.4 });
    } else if (theme.props === 'obelisks') {
      var oUsed = [];
      placeScatter(7, 12, 17, addObelisk, { tall: true, used: oUsed, minDist: 3.6, ang0: 0.15, angSpan: Math.PI * 1.25 });
      placeScatter(7, 18, 28, addObelisk, { tall: true, used: oUsed, minDist: 4.0, ang0: 0, angSpan: Math.PI * 1.35 });
    } else if (isArena) {
      // Dungeon / formal arena: painted pillars when kit exists
      if (propTex) {
        var pUsed = [];
        placeScatter(7, 12, 16, addObelisk, { tall: true, used: pUsed, minDist: 3.8, ang0: 0.2, angSpan: Math.PI * 1.25 });
        placeScatter(6, 18, 26, addObelisk, { tall: true, used: pUsed, minDist: 4.2, ang0: 0.1, angSpan: Math.PI * 1.35 });
      } else {
        var pillarSpots = [
          [-8.5, -6.5, 4.6], [8.5, -6.5, 4.6],
          [-9.5, 0.5, 4.0], [9.5, 0.5, 4.0],
          [-7.5, 6.0, 4.4], [7.5, 6.0, 4.4]
        ];
        pillarSpots.forEach(function (s) {
          if (propAllowed(s[0], s[1], true)) addPillar(s[0], s[1], s[2]);
        });
      }
    }

    // Braziers only on formal dungeons — not forest clearings
    if (theme.hasBraziers && isArena) {
      braziers = [
        addBrazier(-6.2, -3.0),
        addBrazier(6.2, -3.0),
        addBrazier(-5.0, 4.5),
        addBrazier(5.0, 4.5)
      ];
    }

    // Arches removed — boxy stone gates looked misplaced in forest/raid layouts.

    // Atmosphere particles (pollen / sparkle / mist / ember / star / dust)
    var motes = [];
    var moteColor = theme.particles === 'ember' ? 0xff8844
      : (theme.particles === 'sparkle' || theme.particles === 'star' ? theme.accent
        : (theme.particles === 'mist' ? 0xaa99cc
          : (theme.particles === 'dust' ? 0xccbbaa : 0xccffdd)));
    var moteGeo = new THREE.SphereGeometry(
      theme.particles === 'mist' ? 0.08 : 0.03, 6, 4
    );
    var moteMat = new THREE.MeshBasicMaterial({
      color: moteColor, transparent: true,
      opacity: theme.particles === 'mist' ? 0.2 : 0.35,
      depthWrite: false
    });
    var moteCount = Math.min(Q.motes, theme.particles === 'star' ? Q.motes : Math.floor(Q.motes * 0.85));
    var mi;
    for (mi = 0; mi < moteCount; mi++) {
      var mote = new THREE.Mesh(moteGeo, moteMat.clone ? moteMat.clone() : moteMat);
      mote.position.set(
        (seededRand(seed, mi + 100) - 0.5) * 28,
        0.5 + seededRand(seed, mi + 200) * 6,
        (seededRand(seed, mi + 300) - 0.5) * 24
      );
      mote.userData.phase = seededRand(seed, mi + 400) * Math.PI * 2;
      mote.userData.speed = 0.25 + seededRand(seed, mi + 500) * 0.55;
      if (theme.particles === 'ember') {
        mote.userData.rise = 0.01 + seededRand(seed, mi + 600) * 0.02;
      }
      scene.add(mote);
      motes.push(mote);
    }

    // Keep haze airy — mid-field fight strip stays bright and colorful
    if (scene.fog && scene.fog.isFog) {
      scene.fog.near = Math.max(24, fogNear);
      scene.fog.far = Math.max(90, fogFar);
      scene.fog.color.copy(fogCol);
    }
    renderer.setClearColor(clearCol, 1);

    var figures = {};
    var clock = 0;
    var textureKey = opts.textureKey || 'battle_world_3d';
    var phaserGame = opts.game || null;
    var disposed = false;
    var anims = [];
    var puddlePool = [];
    var useDomLayer = false; // disabled — Safari-opaque Phaser hides underlay
    var useBlit = true;

    // Offscreen buffers for restrained bloom (Phase 6 post)
    var bloomSmall = null;
    var bloomSmallCtx = null;
    var bloomBlur = null;
    var bloomBlurCtx = null;
    if (Q.bloom && typeof document !== 'undefined') {
      try {
        var bw = Math.max(32, Math.floor(width / Q.bloomDownscale));
        var bh = Math.max(32, Math.floor(height / Q.bloomDownscale));
        bloomSmall = document.createElement('canvas');
        bloomSmall.width = bw;
        bloomSmall.height = bh;
        bloomSmallCtx = bloomSmall.getContext('2d', { alpha: false });
        bloomBlur = document.createElement('canvas');
        bloomBlur.width = bw;
        bloomBlur.height = bh;
        bloomBlurCtx = bloomBlur.getContext('2d', { alpha: false });
      } catch (eBloom) {
        Q.bloom = false;
      }
    }

    function syncDomToPhaser() {
      // no-op (blit path)
    }

    /**
     * Soft bloom on bright areas only — dual-scale canvas composite.
     * Keeps arena readable (not a milky wash); skills/emissives get a glow.
     */
    function applyCanvasBloom() {
      if (!Q.bloom || !bloomSmallCtx || !bloomBlurCtx || !blitCtx) return;
      var bw = bloomSmall.width;
      var bh = bloomSmall.height;
      var s = Q.bloomStrength;

      // 1) Downsample full frame
      bloomSmallCtx.globalCompositeOperation = 'copy';
      bloomSmallCtx.drawImage(glCanvas, 0, 0, bw, bh);

      // 2) Extract/boost brights via hard-light self composite (cheap threshold)
      bloomBlurCtx.globalCompositeOperation = 'copy';
      bloomBlurCtx.drawImage(bloomSmall, 0, 0);
      bloomBlurCtx.globalCompositeOperation = 'lighten';
      bloomBlurCtx.globalAlpha = 0.65;
      bloomBlurCtx.drawImage(bloomSmall, 0, 0);
      bloomBlurCtx.globalAlpha = 1;

      // 3) Fake blur: multi-offset draws (separable-ish stack)
      bloomSmallCtx.globalCompositeOperation = 'copy';
      bloomSmallCtx.globalAlpha = 1;
      bloomSmallCtx.drawImage(bloomBlur, 0, 0);
      bloomSmallCtx.globalCompositeOperation = 'source-over';
      var offsets = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [2, 0], [-2, 0], [0, 2], [0, -2],
        [1, 1], [-1, 1], [1, -1], [-1, -1]
      ];
      var oi;
      bloomSmallCtx.globalAlpha = 0.12;
      for (oi = 0; oi < offsets.length; oi++) {
        bloomSmallCtx.drawImage(bloomBlur, offsets[oi][0], offsets[oi][1]);
      }
      bloomSmallCtx.globalAlpha = 1;

      // 4) Screen-blend bloom layer back onto full-res blit (already has base frame)
      blitCtx.save();
      blitCtx.globalCompositeOperation = 'screen';
      blitCtx.globalAlpha = s;
      blitCtx.drawImage(bloomSmall, 0, 0, width, height);
      // Second softer pass for high quality
      if (Q.id === 'high') {
        blitCtx.globalAlpha = s * 0.45;
        blitCtx.drawImage(bloomSmall, -1, -1, width + 2, height + 2);
      }
      blitCtx.restore();
    }

    function blitToPhaserCanvas() {
      if (!blitCtx) return;
      try {
        blitCtx.globalCompositeOperation = 'copy';
        blitCtx.globalAlpha = 1;
        blitCtx.drawImage(glCanvas, 0, 0, width, height);
        applyCanvasBloom();
      } catch (e) {
        // Security / context lost
        if (!blitToPhaserCanvas._err) {
          console.warn('[Battle3D] blit failed', e);
          blitToPhaserCanvas._err = true;
        }
      }
    }

    /**
     * RSL lane formation:
     *  Path runs bottom-left (near) → top-right (far).
     *  Allies stand in a diagonal line on one side of the lane.
     *  Foes stand in a facing line on the opposite side.
     *  Both look across the path at each other.
     */
    function layoutSlot(side, index, count) {
      // Shared pure math (unit-testable via SR_BATTLE3D.computeLaneSlot)
      return computeLaneSlot(side, index, count, {
        bl: LANE.bl,
        tr: LANE.tr,
        halfWidth: LANE_DEFAULT.halfWidth
      });
    }

    function spawnUnit(unit, index, count) {
      if (!unit || unit.id == null) return null;
      var fig = createUnitFigure(THREE, unit);
      var isFoe = !!unit.isFoe || !!unit.isEnemy;
      fig.isFoe = isFoe;
      var slot = layoutSlot(isFoe ? 'foe' : 'ally', index, count);

      // Absolute world height (≈ meters) — enemies taller than gels by design
      var sizeInfo = resolveWorldSize(unit);
      fig.worldSize = sizeInfo;
      unit.worldSize = sizeInfo;
      var native = fig.nativeHeight || sizeInfo.nativePlate || 2.0;
      var perspective = slot.perspective != null ? slot.perspective : slot.scale;
      var rootScale;
      var api = worldSizeApi();
      if (api && typeof api.combatRootScale === 'function') {
        rootScale = api.combatRootScale(sizeInfo, perspective, native);
      } else {
        rootScale = Math.max(0.32, Math.min(2.6, (sizeInfo.height / native) * perspective));
      }
      // Grounded feet
      slot.y = 0.02 + (fig.gelFloatY || 0);
      slot.scale = rootScale;
      fig.gelSize = sizeInfo.role === 'gel' ? sizeInfo.mult : (fig.gelSize || 1);
      fig.enemySizeMul = sizeInfo.role === 'enemy' ? sizeInfo.mult : null;

      fig.home = { x: slot.x, y: slot.y, z: slot.z };
      fig.baseScale = rootScale;
      fig.root.position.set(slot.x, slot.y, slot.z);
      fig.root.scale.setScalar(rootScale);
      // Contact shadow tracks creature footprint
      if (fig.contactShadow) {
        var foot = Math.max(0.55, Math.sqrt(sizeInfo.height / 1.2));
        fig.contactShadow.scale.set(foot, foot, 1);
      }

      // Face across the corridor at the opposing line.
      // Eyes/highlight are built on local +Z — set yaw so +Z points toward the enemy team.
      // (Do NOT use lookAt: it aims local -Z, which made faces point the wrong way.)
      var towardOpp = isFoe ? -1 : 1; // allies → foe side (+perp), foes → ally side (-perp)
      var faceDx = LANE.px * towardOpp;
      var faceDz = LANE.pz * towardOpp;
      fig.root.rotation.x = 0;
      fig.root.rotation.z = 0;
      fig.root.rotation.y = Math.atan2(faceDx, faceDz);
      fig.faceY = fig.root.rotation.y;

      // Mark bosses/elites for FX — size already applied via worldSize
      if (isFoe) {
        var rar = String(unit.rarity || 'Common');
        fig.isBoss = !!unit.isBoss || !!unit.boss || rar === 'Legendary' || rar === 'Mythic' ||
          (rar === 'Epic' && (unit.power || 0) >= 200) ||
          (unit.power || 0) >= 320;
      }

      // R5+ active-turn ground ring (RSL "this unit acts" telegraph)
      if (!fig.turnRing) {
        var trCol = isFoe ? 0xff8866 : 0x88ffcc;
        var turnRing = new THREE.Mesh(
          new THREE.RingGeometry(0.55, 0.78, 36),
          new THREE.MeshBasicMaterial({
            color: trCol, transparent: true, opacity: 0, side: THREE.DoubleSide,
            depthWrite: false, fog: false
          })
        );
        turnRing.rotation.x = -Math.PI / 2;
        turnRing.position.y = 0.04;
        turnRing.visible = false;
        fig.root.add(turnRing);
        fig.turnRing = turnRing;
        // Inner pulse disc
        var turnDisc = new THREE.Mesh(
          new THREE.CircleGeometry(0.42, 28),
          new THREE.MeshBasicMaterial({
            color: trCol, transparent: true, opacity: 0, side: THREE.DoubleSide,
            depthWrite: false, fog: false
          })
        );
        turnDisc.rotation.x = -Math.PI / 2;
        turnDisc.position.y = 0.035;
        turnDisc.visible = false;
        fig.root.add(turnDisc);
        fig.turnDisc = turnDisc;
      }

      // Keep hidden while combat art still loading (load veil covers this window)
      if (fig.artPending) {
        fig.root.visible = false;
      } else {
        fig.root.visible = true;
        if (fig.shell) fig.shell.visible = true;
      }
      scene.add(fig.root);
      figures[unit.id] = fig;
      console.log('[Battle3D] spawn', unit.name || unit.id, unit.element,
        isFoe ? 'foe' : 'ally',
        fig.enemyKind ? ('kind=' + fig.enemyKind) : '',
        'scale=' + slot.scale.toFixed(2),
        fig.enemySizeMul ? ('kindMul=' + fig.enemySizeMul.toFixed(2)) : '',
        fig.worldSize ? ('h=' + fig.worldSize.height.toFixed(2)) : '',
        fig.artPending ? 'artPending' : (fig.hasPaintedArt ? 'artOk' : ''),
        'faceY=' + fig.faceY.toFixed(2), 'lane t=' + slot.t.toFixed(2),
        fig.isBoss ? 'BOSS' : '');
      return fig;
    }

    function spawnTeams(allies, foes) {
      var i;
      allies = allies || [];
      foes = foes || [];
      for (i = 0; i < foes.length; i++) spawnUnit(foes[i], i, foes.length);
      for (i = 0; i < allies.length; i++) spawnUnit(allies[i], i, allies.length);
      console.log('[Battle3D] teams spawned', {
        allies: allies.length,
        foes: foes.length,
        figures: Object.keys(figures).length
      });
    }

    /** Remove a figure from the arena (between-wave foe swap). */
    function removeUnit(unitId) {
      var fig = figures[unitId];
      if (!fig) return false;
      try {
        if (fig.root) {
          scene.remove(fig.root);
          fig.root.traverse(function (ch) {
            if (ch.geometry) ch.geometry.dispose();
            if (ch.material) {
              if (Array.isArray(ch.material)) ch.material.forEach(function (m) { m.dispose && m.dispose(); });
              else if (ch.material.dispose) ch.material.dispose();
            }
          });
        }
      } catch (eRem) { /* ignore */ }
      delete figures[unitId];
      return true;
    }

    /**
     * Swap in a new foe pack without touching allies (dungeon multi-wave).
     * @returns {{ removed: number, added: number }}
     */
    function replaceFoeTeam(foes) {
      foes = foes || [];
      var removed = 0;
      var ids = Object.keys(figures);
      var i;
      for (i = 0; i < ids.length; i++) {
        var f = figures[ids[i]];
        if (f && (f.isFoe || f.isEnemy)) {
          if (removeUnit(ids[i])) removed++;
        }
      }
      for (i = 0; i < foes.length; i++) {
        spawnUnit(foes[i], i, foes.length);
      }
      console.log('[Battle3D] replaceFoeTeam', { removed: removed, added: foes.length });
      return { removed: removed, added: foes.length };
    }

    /** Wait until no figure has artPending (or timeout). Forces show on timeout. */
    function waitArtReady(timeoutMs) {
      timeoutMs = timeoutMs != null ? timeoutMs : 4500;
      return new Promise(function (resolve) {
        var start = Date.now();
        function finish(timedOut) {
          var id;
          var left = 0;
          for (id in figures) {
            if (!Object.prototype.hasOwnProperty.call(figures, id)) continue;
            var f = figures[id];
            if (f && f.artPending) left++;
            if (f && f.root) {
              f.artPending = false;
              f.root.visible = true;
            }
          }
          resolve({ ok: !timedOut, pending: left, timedOut: !!timedOut });
        }
        function check() {
          var id;
          var pending = 0;
          for (id in figures) {
            if (!Object.prototype.hasOwnProperty.call(figures, id)) continue;
            if (figures[id] && figures[id].artPending) pending++;
          }
          if (pending === 0) {
            finish(false);
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            finish(true);
            return;
          }
          setTimeout(check, 40);
        }
        check();
      });
    }

    function preloadUnitArt(units) {
      return preloadCombatArt(units);
    }

    /**
     * Project unit to screen for HUD.
     * Returns feet anchor (for nameplates below the body) + approximate body height in px
     * so small gels don't get half-covered by fixed offsets.
     */
    function project(unitId) {
      var fig = figures[unitId];
      if (!fig) return null;
      var hx = fig.home ? fig.home.x : 0;
      var hz = fig.home ? fig.home.z : 0;
      // World height of unit (root scale / gel size)
      var worldH = 1.35;
      if (fig.root && fig.root.scale && fig.root.scale.y) {
        worldH = Math.max(0.55, fig.root.scale.y * 1.85);
      } else if (fig.gelSize) {
        worldH = Math.max(0.55, fig.gelSize * 1.5);
      } else if (fig.baseScale) {
        worldH = Math.max(0.55, fig.baseScale * 1.6);
      }
      if (fig.isEnemy || fig.isFoe) worldH = Math.max(worldH, 1.4);

      var foot = new THREE.Vector3(hx, 0.04, hz);
      var chest = new THREE.Vector3(hx, worldH * 0.45, hz);
      var top = new THREE.Vector3(hx, worldH * 0.92, hz);
      if (fig.melting || fig.dead) {
        foot.y = 0.08;
        chest.y = 0.2;
        top.y = 0.28;
      } else if (fig.root) {
        // Prefer live root XZ (lunge / bob) but keep Y anchors absolute-ish
        var wp = new THREE.Vector3();
        fig.root.getWorldPosition(wp);
        foot.x = wp.x;
        foot.z = wp.z;
        chest.x = wp.x;
        chest.z = wp.z;
        top.x = wp.x;
        top.z = wp.z;
      }
      foot.project(camera);
      chest.project(camera);
      top.project(camera);
      var sx = function (v) { return (v.x * 0.5 + 0.5) * width; };
      var sy = function (v) { return (-v.y * 0.5 + 0.5) * height; };
      var footY = sy(foot);
      var topY = sy(top);
      var bodyPx = Math.max(28, Math.abs(footY - topY));
      return {
        // Feet = primary HUD anchor (nameplate sits below this)
        x: sx(foot),
        y: footY,
        chestY: sy(chest),
        topY: topY,
        bodyPx: bodyPx,
        worldH: worldH,
        visible: foot.z < 1
      };
    }

    function makePuddle(fig) {
      var puddleMat = new THREE.MeshPhysicalMaterial
        ? new THREE.MeshPhysicalMaterial({
            color: fig.tint,
            roughness: 0.08,
            metalness: 0.05,
            transparent: true,
            opacity: 0.0,
            emissive: fig.tintColor.clone(),
            emissiveIntensity: 0.25,
            side: THREE.DoubleSide
          })
        : new THREE.MeshStandardMaterial({
            color: fig.tint, transparent: true, opacity: 0,
            emissive: fig.tintColor.clone(), emissiveIntensity: 0.2, side: THREE.DoubleSide
          });
      if (puddleMat.transmission !== undefined) {
        puddleMat.transmission = 0.55;
        puddleMat.thickness = 0.4;
        puddleMat.ior = 1.33;
      }
      var puddle = new THREE.Mesh(new THREE.CircleGeometry(0.15, 40), puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(fig.home.x, 0.06, fig.home.z);
      scene.add(puddle);
      fig.puddle = puddle;
      puddlePool.push(puddle);
      return puddle;
    }

    function spawnDroplets(fig, count) {
      var n = count || 10;
      var i;
      for (i = 0; i < n; i++) {
        var dropMat = new THREE.MeshPhysicalMaterial
          ? new THREE.MeshPhysicalMaterial({
              color: fig.tint,
              roughness: 0.1,
              transparent: true,
              opacity: 0.9,
              emissive: fig.tintColor.clone(),
              emissiveIntensity: 0.2
            })
          : new THREE.MeshBasicMaterial({ color: fig.tint, transparent: true, opacity: 0.85 });
        if (dropMat.transmission !== undefined) {
          dropMat.transmission = 0.5;
          dropMat.thickness = 0.3;
        }
        var drop = new THREE.Mesh(
          new THREE.SphereGeometry(0.06 + Math.random() * 0.07, 10, 8),
          dropMat
        );
        var ang = Math.random() * Math.PI * 2;
        var dist = 0.15 + Math.random() * 0.35;
        drop.position.set(
          fig.home.x + Math.cos(ang) * dist * 0.3,
          fig.home.y + 0.2 + Math.random() * 0.5,
          fig.home.z + Math.sin(ang) * dist * 0.3
        );
        drop.userData = {
          vx: Math.cos(ang) * (0.8 + Math.random() * 1.4),
          vy: 0.4 + Math.random() * 1.2,
          vz: Math.sin(ang) * (0.8 + Math.random() * 1.4),
          life: 0.55 + Math.random() * 0.45,
          age: 0,
          fig: fig
        };
        scene.add(drop);
        fig.droplets.push(drop);
      }
    }

    /**
     * Hard-realm death: solid collapse / fade (no gel puddle).
     */
    function solidDeath(unitId) {
      var fig = figures[unitId];
      if (!fig || fig.melting || fig.dead) return;
      fig.melting = true;
      fig.meltT = 0;
      fig.activePulse = 0;
      if (fig.mat) {
        fig.mat.transparent = true;
        if (fig.mat.depthWrite != null) fig.mat.depthWrite = false;
      }
      anims.push({
        t: 0,
        dur: 0.85,
        tag: 'solidDeath',
        unitId: unitId,
        update: function (u) {
          fig.meltT = u;
          var sink = u * u;
          fig.root.position.y = fig.home.y * (1 - sink * 0.7) + 0.02;
          fig.root.scale.set(
            fig.baseScale * (1 + sink * 0.35),
            fig.baseScale * (1 - sink * 0.92),
            fig.baseScale * (1 + sink * 0.2)
          );
          if (fig.mat) {
            if (fig.isImpostor) {
              fig.mat.opacity = Math.max(0, 1 - u * 1.05);
              if (fig.mat.color && fig.baseColor) {
                fig.mat.color.copy(fig.baseColor).lerp(new THREE.Color(0x220000), u * 0.5);
              }
            } else {
              fig.mat.opacity = Math.max(0.05, 1 - u);
              if (fig.mat.emissiveIntensity != null) {
                fig.mat.emissiveIntensity = fig.baseEmissive * (1 - u);
              }
            }
          }
          if (fig.eyes) {
            fig.eyes.forEach(function (e) {
              if (!e) return;
              e.scale.setScalar(Math.max(0.01, 1 - u * 1.4));
              if (e.material) {
                e.material.transparent = true;
                e.material.opacity = Math.max(0, 1 - u * 1.5);
              }
              if (u > 0.7) e.visible = false;
            });
          }
          if (fig.contactShadow) {
            fig.contactShadow.material.opacity = 0.4 * (1 - u);
            fig.contactShadow.scale.set(1 + u, 1 + u, 1);
          }
          // Slight crumple jiggle
          if (u > 0.15 && u < 0.8) {
            fig.root.position.x = fig.home.x + Math.sin(u * 50) * 0.05 * (1 - u);
            fig.root.rotation.z = Math.sin(u * 20) * 0.12 * u;
          }
        },
        done: function () {
          fig.melting = false;
          fig.dead = true;
          fig.root.visible = false;
          if (fig.contactShadow) fig.contactShadow.visible = false;
        }
      });
    }

    /**
     * Melt death: gel body loses structure, collapses into liquid, puddle remains.
     * Hard-realm foes use solidDeath instead.
     */
    function meltDeath(unitId) {
      var fig = figures[unitId];
      if (!fig || fig.melting || fig.dead) return;
      if (fig.solidEnemy) {
        solidDeath(unitId);
        // Phase C: hard foes still get element residual punctuation
        if (Q.worldFx && fig.home) {
          spawnElementResidual(
            { x: fig.home.x, y: 0.1, z: fig.home.z },
            fig.tint || fig.element || 'Earth',
            'kill'
          );
        }
        return;
      }
      // Kill residual — element aftershock as body collapses
      if (Q.worldFx && fig.home) {
        spawnElementResidual(
          { x: fig.home.x, y: 0.1, z: fig.home.z },
          fig.tint || (fig.unit && fig.unit.element) || 'Water',
          'kill'
        );
      }
      // Painted gel plates: squash + fade into puddle (no mesh deform)
      if (fig.gelImpostor || (fig.isImpostor && !fig.solidEnemy)) {
        fig.melting = true;
        fig.meltT = 0;
        fig.activePulse = 0;
        if (fig.mat) {
          fig.mat.transparent = true;
          if (fig.mat.depthWrite != null) fig.mat.depthWrite = false;
        }
        makePuddle(fig);
        anims.push({
          t: 0,
          dur: 1.1,
          tag: 'gelImpostorMelt',
          unitId: unitId,
          update: function (u) {
            fig.meltT = u;
            var sink = u * u;
            fig.root.position.y = fig.home.y * (1 - sink * 0.9) + 0.05;
            fig.root.scale.set(
              fig.baseScale * (1 + sink * 0.7),
              fig.baseScale * (1 - sink * 0.9),
              fig.baseScale * (1 + sink * 0.5)
            );
            if (fig.mat) fig.mat.opacity = Math.max(0, 1 - u * 1.05);
            if (fig.contactShadow) {
              fig.contactShadow.scale.set(1 + u * 1.8, 1 + u * 1.8, 1);
              fig.contactShadow.material.opacity = 0.4 * (1 - u * 0.7);
            }
            if (fig.puddle) {
              var pr = 0.25 + u * u * 1.5;
              fig.puddle.scale.set(pr, pr, 1);
              fig.puddle.material.opacity = Math.min(0.8, u * 1.1);
            }
          },
          done: function () {
            fig.melting = false;
            fig.dead = true;
            fig.root.visible = false;
            if (fig.contactShadow) fig.contactShadow.visible = false;
            if (fig.puddle) {
              fig.puddle.scale.set(1.6, 1.6, 1);
              fig.puddle.material.opacity = 0.7;
            }
          }
        });
        return;
      }
      fig.melting = true;
      fig.meltT = 0;
      fig.activePulse = 0;

      // Disable transmission mid-melt can look odd — keep gel look, fade opacity
      fig.mat.transparent = true;
      if ('transmission' in fig.mat) {
        // reduce transmission so deform reads clearly
        fig.mat.transmission = Math.min(fig.mat.transmission || 0, 0.25);
      }
      fig.mat.depthWrite = true;

      makePuddle(fig);

      // Hide eyes gradually handled in tick; start droplet splash mid-melt via anim flag
      var splashDone = false;
      anims.push({
        t: 0,
        dur: 1.35,
        tag: 'melt',
        unitId: unitId,
        update: function (u) {
          fig.meltT = u;
          // Phase curve: hold → collapse → puddle
          var collapse = u < 0.15 ? u / 0.15 * 0.12 : 0.12 + (u - 0.15) / 0.85 * 0.88;
          applyMeltDeform(fig, collapse);

          // Squash root toward floor
          var sink = u * u;
          fig.root.position.y = fig.home.y * (1 - sink * 0.92) + 0.08 * (1 - sink);
          fig.root.scale.set(
            fig.baseScale * (1 + sink * 0.85),
            fig.baseScale * (1 - sink * 0.88),
            fig.baseScale * (1 + sink * 0.85)
          );

          // Eyes lose focus / sink into mass
          var eyeFade = Math.max(0, 1 - u * 2.2);
          fig.eyes.forEach(function (e) {
            e.scale.setScalar(eyeFade);
            e.material.opacity = eyeFade;
            e.material.transparent = true;
            if (eyeFade < 0.05) e.visible = false;
          });
          if (fig.hi) {
            fig.hi.material.opacity = 0.4 * eyeFade;
            if (eyeFade < 0.1) fig.hi.visible = false;
          }

          // Core dissolves
          fig.coreMat.opacity = 0.42 * (1 - u);
          fig.core.scale.set(
            0.92 * (1 + u * 1.4),
            0.86 * (1 - u * 0.9),
            0.92 * (1 + u * 1.4)
          );

          // Shell becomes more liquid
          fig.mat.opacity = Math.max(0.05, 1 - u * 0.95);
          fig.mat.emissiveIntensity = fig.baseEmissive * (1 - u * 0.7) + 0.05;
          if (fig.mat.roughness != null) {
            fig.mat.roughness = 0.12 + u * 0.35;
          }

          // Contact shadow spreads into puddle shape
          if (fig.contactShadow) {
            var cs = 1 + u * 2.2;
            fig.contactShadow.scale.set(cs, cs, 1);
            fig.contactShadow.material.opacity = 0.38 * (1 - u * 0.7);
          }

          // Puddle grows as body melts
          if (fig.puddle) {
            var pr = 0.2 + u * u * 1.55;
            fig.puddle.scale.set(pr, pr, 1);
            fig.puddle.material.opacity = Math.min(0.82, u * 1.1);
            if (fig.puddle.material.emissiveIntensity != null) {
              fig.puddle.material.emissiveIntensity = 0.35 * (1 - u * 0.4);
            }
          }

          // Droplet splash when structure breaks (~40%)
          if (!splashDone && u >= 0.38) {
            splashDone = true;
            spawnDroplets(fig, 14);
          }

          // Slight random jiggle as cohesion fails
          if (u > 0.2 && u < 0.85) {
            fig.root.position.x = fig.home.x + Math.sin(u * 40) * 0.04 * (1 - u);
            fig.root.position.z = fig.home.z + Math.cos(u * 35) * 0.03 * (1 - u);
          }
        },
        done: function () {
          fig.melting = false;
          fig.dead = true;
          fig.root.position.set(fig.home.x, 0.05, fig.home.z);
          // Hide body; leave puddle
          fig.shell.visible = false;
          fig.core.visible = false;
          fig.eyes.forEach(function (e) { e.visible = false; });
          if (fig.hi) fig.hi.visible = false;
          if (fig.contactShadow) fig.contactShadow.visible = false;
          if (fig.puddle) {
            fig.puddle.scale.set(1.7, 1.7, 1);
            fig.puddle.material.opacity = 0.72;
          }
          // Slow puddle fade residual (stain)
          anims.push({
            t: 0,
            dur: 4.5,
            update: function (u2) {
              if (!fig.puddle) return;
              fig.puddle.material.opacity = 0.72 * (1 - u2 * 0.55);
              var s = 1.7 + u2 * 0.35;
              fig.puddle.scale.set(s, s, 1);
            },
            done: function () {}
          });
        }
      });
    }

    function setAlive(unitId, alive) {
      var fig = figures[unitId];
      if (!fig) return;
      if (!alive) {
        if (!fig.dead && !fig.melting) meltDeath(unitId);
        return;
      }
      // Revive (rare)
      fig.dead = false;
      fig.melting = false;
      fig.shell.visible = true;
      fig.core.visible = true;
      fig.mat.opacity = 1;
      fig.root.scale.setScalar(fig.baseScale);
      fig.root.position.set(fig.home.x, fig.home.y, fig.home.z);
      applyMeltDeform(fig, 0);
      // restore base verts
      var pos = fig.geo.attributes.position;
      pos.array.set(fig.base);
      pos.needsUpdate = true;
      fig.geo.computeVertexNormals();
    }

    function setActive(unitId, on) {
      Object.keys(figures).forEach(function (id) {
        var f = figures[id];
        if (f.dead || f.melting) return;
        f.activePulse = (on && String(id) === String(unitId)) ? 1 : 0;
      });
    }

    function pulse(unitId) {
      var fig = figures[unitId];
      if (!fig || fig.dead || fig.melting) return;
      anims.push({
        t: 0,
        dur: 0.35,
        update: function (u) {
          if (fig.melting) return;
          var s = fig.baseScale * (1 + Math.sin(u * Math.PI) * 0.12);
          fig.root.scale.setScalar(s);
        },
        done: function () {
          if (!fig.melting && !fig.dead) fig.root.scale.setScalar(fig.baseScale);
        }
      });
    }

    /**
     * Apply idle/attack texture on gel impostor material.
     * @returns {boolean} true if map actually changed
     */
    function applyFigurePoseMap(fig, pose) {
      if (!fig || !fig.mat) return false;
      var want = pose === 'attack' ? 'attack' : 'idle';
      var tex = null;
      if (want === 'attack' && fig.attackTex) tex = fig.attackTex;
      else tex = fig.idleTex || (fig.mat && fig.mat.map) || null;
      if (!tex) return false;
      if (fig.poseCtrl) {
        if (want === 'attack') fig.poseCtrl.setAttack();
        else fig.poseCtrl.setIdle();
      }
      if (fig.mat.map === tex && fig.pose === want) return false;
      fig.mat.map = tex;
      fig.mat.needsUpdate = true;
      fig.pose = want;
      return true;
    }

    /**
     * Attack pose for the forward half of a lunge; restored as the unit returns.
     * Prefer lunge-synced pose (see lunge) over this free-timer path.
     * holdSec only used when called outside lunge (legacy / tests).
     */
    function playAttackPose(unitId, holdSec) {
      var fig = figures[unitId];
      if (!fig || fig.dead || fig.melting) return false;
      if (!(fig.gelImpostor || fig.isImpostor) || fig.solidEnemy) return false;
      if (!fig.attackTex || !fig.idleTex || fig.attackTex === fig.idleTex) {
        return false;
      }
      // Default matches lunge duration so free calls don't outlive the bounce
      holdSec = holdSec != null ? holdSec : 0.42;
      var token = fig.poseCtrl
        ? fig.poseCtrl.nextRestoreToken()
        : ((fig._poseTok = (fig._poseTok || 0) + 1));
      fig._poseRestoreToken = token;

      applyFigurePoseMap(fig, 'attack');
      if (fig.mat && fig.mat.emissiveIntensity != null) {
        fig.mat.emissiveIntensity = (fig.baseEmissive || 0.35) + 0.4;
      }
      // Restore as soon as hold ends (no extra settle delay stack)
      anims.push({
        t: 0,
        dur: Math.max(0.12, holdSec * 0.55),
        update: function () { /* hold attack through forward arc */ },
        done: function () {
          if (fig._poseRestoreToken !== token) return;
          restoreIdlePose(unitId, true);
        }
      });
      return true;
    }

    /**
     * @param {boolean} [instant] snap map back (no 0.14s settle) — use on lunge return
     */
    function restoreIdlePose(unitId, instant) {
      var fig = figures[unitId];
      if (!fig || fig.dead || fig.melting) return false;
      if (fig.pose === 'idle' && (!fig.poseCtrl || fig.poseCtrl.getPose() === 'idle')) {
        if (fig.mat && fig.mat.emissiveIntensity != null) {
          fig.mat.emissiveIntensity = fig.baseEmissive || 0.35;
        }
        return true;
      }
      if (instant) {
        applyFigurePoseMap(fig, 'idle');
        if (fig.mat && fig.mat.emissiveIntensity != null) {
          fig.mat.emissiveIntensity = fig.baseEmissive || 0.35;
        }
        return true;
      }
      var restored = false;
      anims.push({
        t: 0,
        dur: 0.08,
        update: function (u) {
          if (fig.melting || fig.dead) return;
          if (!restored && u >= 0.25) {
            applyFigurePoseMap(fig, 'idle');
            restored = true;
          }
          if (fig.mat && fig.mat.emissiveIntensity != null) {
            var base = fig.baseEmissive || 0.35;
            fig.mat.emissiveIntensity = base + (fig.mat.emissiveIntensity - base) * (1 - u);
          }
        },
        done: function () {
          if (fig.melting || fig.dead) return;
          if (!restored) applyFigurePoseMap(fig, 'idle');
          if (fig.mat && fig.mat.emissiveIntensity != null) {
            fig.mat.emissiveIntensity = fig.baseEmissive || 0.35;
          }
        }
      });
      return true;
    }

    /**
     * Snap gel to attack plate immediately (cast start).
     * Lunge bounce happens later at actualize; restore idle on lunge return.
     */
    function beginAttackPose(unitId) {
      var fig = figures[unitId];
      if (!fig || fig.dead || fig.melting) return false;
      if (fig.solidEnemy || fig.isEnemy) return false;
      if (!(fig.gelImpostor || fig.isImpostor)) return false;
      if (!fig.attackTex || !fig.idleTex || fig.attackTex === fig.idleTex) return false;
      var token = fig.poseCtrl
        ? fig.poseCtrl.nextRestoreToken()
        : ((fig._poseTok = (fig._poseTok || 0) + 1));
      fig._poseRestoreToken = token;
      fig._attackPoseHeld = true;
      applyFigurePoseMap(fig, 'attack');
      if (fig.mat && fig.mat.emissiveIntensity != null) {
        fig.mat.emissiveIntensity = (fig.baseEmissive || 0.35) + 0.4;
      }
      return true;
    }

    /**
     * Forward bounce toward target — timed to attack actualize (after cast spool).
     * @param {string} unitId
     * @param {string|null} towardId
     * @param {object} [opts]
     * @param {boolean} [opts.poseOwned] attack pose already on from beginAttackPose
     * @param {number} [opts.dur] bounce duration seconds (default 0.42)
     */
    function lunge(unitId, towardId, opts) {
      opts = opts || {};
      var fig = figures[unitId];
      var target = towardId != null ? figures[towardId] : null;
      if (!fig || fig.dead || fig.melting) return;
      // Lunge across the lane toward the enemy line
      // Bounce = actualize. Pose may already be held from cast start (poseOwned).
      var across = fig.isFoe ? -1 : 1;
      var amp = 0.55;
      if (target) {
        var tdx = target.home.x - fig.home.x;
        var tdz = target.home.z - fig.home.z;
        var tlen = Math.sqrt(tdx * tdx + tdz * tdz) || 1;
        var lx = (tdx / tlen) * amp;
        var lz = (tdz / tlen) * amp;
      } else {
        var lx = LANE.px * across * amp;
        var lz = LANE.pz * across * amp;
      }
      var grounded = !!(fig.grounded || (fig.parts && fig.parts.footL));
      var canPose = !fig.isFoe && !fig.solidEnemy &&
        fig.attackTex && fig.idleTex && fig.attackTex !== fig.idleTex &&
        (fig.gelImpostor || fig.isImpostor);
      var poseOwned = !!(opts.poseOwned && fig._attackPoseHeld && canPose);
      var useAttackPose = canPose;
      var poseToken = fig._poseRestoreToken || null;
      if (useAttackPose && !poseOwned) {
        poseToken = fig.poseCtrl
          ? fig.poseCtrl.nextRestoreToken()
          : ((fig._poseTok = (fig._poseTok || 0) + 1));
        fig._poseRestoreToken = poseToken;
      }
      var poseOn = !!poseOwned; // already in attack plate during cast
      var poseOff = false;
      // sin(u*π): 0→1 forward (peak ~0.5), 1→0 return.
      // Squash/stretch is GEL-ONLY (gelImpostor). Hard foes: rigid hop.
      var isGel = !!fig.gelImpostor;
      var lungeDur = typeof opts.dur === 'number' ? opts.dur : 0.42;
      anims.push({
        t: 0,
        dur: lungeDur,
        update: function (u) {
          if (fig.melting) return;
          var ease = Math.sin(u * Math.PI);
          // Vertical velocity proxy: + takeoff, 0 apex, − landing
          var vPhase = Math.cos(u * Math.PI);
          fig.root.position.x = fig.home.x + lx * ease;
          fig.root.position.z = fig.home.z + lz * ease;
          // Grounded: hop low; floaters: higher arc. Enemies still bounce in Y only.
          fig.root.position.y = fig.home.y + ease * (grounded ? (isGel ? 0.08 : 0.10) : 0.18);
          // Attack lean toward target (gels lean more; foes slight)
          var lean = Math.atan2(lx, lz) * (isGel ? 0.15 : 0.06) * ease;
          fig.root.rotation.x = grounded ? (isGel ? -0.12 : -0.04) * ease : -0.06 * ease;
          fig.root.rotation.z = lean;

          // Soft gel physics: stretch tall in air, squash on crouch / land (volume-ish)
          // Non-slimes: uniform scale only — bounce is position, never squash/stretch
          var yMul = 1;
          var xzMul = 1;
          if (isGel) {
            // Crouch load at start, stretch while airborne, squash on return/land
            var crouch = u < 0.14 ? (1 - u / 0.14) * 0.055 : 0;
            var airStretch = ease * 0.065;
            // Landing squash builds as we fall (vPhase negative) and ease drops
            var landSquash = 0;
            if (vPhase < 0) {
              landSquash = (-vPhase) * (1 - ease) * 0.07;
            }
            // Brief extra settle squash in last ~12% of return
            if (u > 0.88) {
              landSquash += (u - 0.88) / 0.12 * 0.04;
            }
            yMul = 1 - crouch + airStretch - landSquash;
            // Keep roughly constant volume: expand sideways when short, narrow when tall
            xzMul = 1 + (1 - yMul) * 0.85;
            // Tiny secondary jiggle so it feels soft, not a hard scale key
            var jiggle = Math.sin(u * Math.PI * 2) * 0.012 * ease;
            yMul += jiggle;
            xzMul -= jiggle * 0.7;
          }
          fig.root.scale.set(
            fig.baseScale * xzMul,
            fig.baseScale * yMul,
            fig.baseScale * xzMul
          );

          if (useAttackPose && fig._poseRestoreToken === poseToken) {
            // Enter attack if not already held from cast
            if (!poseOn && u >= 0.03) {
              applyFigurePoseMap(fig, 'attack');
              poseOn = true;
              if (fig.mat && fig.mat.emissiveIntensity != null) {
                fig.mat.emissiveIntensity = (fig.baseEmissive || 0.35) + 0.35;
              }
            }
            // Back to idle as soon as we start returning (past peak ease)
            if (poseOn && !poseOff && u >= 0.52) {
              applyFigurePoseMap(fig, 'idle');
              poseOff = true;
              if (fig.mat && fig.mat.emissiveIntensity != null) {
                fig.mat.emissiveIntensity = fig.baseEmissive || 0.35;
              }
            }
          }
        },
        done: function () {
          if (fig.melting || fig.dead) return;
          fig.root.position.x = fig.home.x;
          fig.root.rotation.x = 0;
          fig.root.rotation.z = 0;
          fig.root.position.z = fig.home.z;
          fig.root.position.y = fig.home.y;
          // Soft settle: gels pop back to base scale (idle bob resumes next tick)
          fig.root.scale.setScalar(fig.baseScale);
          // Guarantee idle pose when feet are home (end of actualize bounce)
          if (useAttackPose && fig._poseRestoreToken === poseToken) {
            applyFigurePoseMap(fig, 'idle');
            if (fig.mat && fig.mat.emissiveIntensity != null) {
              fig.mat.emissiveIntensity = fig.baseEmissive || 0.35;
            }
          }
          fig._attackPoseHeld = false;
        }
      });
    }

    function hitFlash(unitId, crit) {
      var fig = figures[unitId];
      if (!fig || fig.dead || fig.melting) return;
      fig.hitFlash = crit ? 1 : 0.7;
      var baseX = fig.home.x;
      anims.push({
        t: 0,
        dur: crit ? 0.28 : 0.2,
        update: function (u) {
          if (fig.melting) return;
          var shake = Math.sin(u * Math.PI * 8) * (crit ? 0.14 : 0.08) * (1 - u);
          fig.root.position.x = baseX + shake;
        },
        done: function () {
          if (!fig.melting) fig.root.position.x = fig.home.x;
        }
      });
      if (crit && Q.worldFx) cameraPunch(0.12);
    }

    /** Subtle camera punch (crit / big hits) — no screen dimming */
    function cameraPunch(amount) {
      amount = amount || 0.1;
      var ox = camHome.x;
      var oy = camHome.y;
      var oz = camHome.z;
      anims.push({
        t: 0,
        dur: 0.22,
        update: function (u) {
          var s = Math.sin(u * Math.PI) * amount * (1 - u);
          camera.position.set(ox + s * 0.35, oy + s * 0.12, oz + s * 0.2);
          camera.lookAt(camLook.x, camLook.y, camLook.z);
        },
        done: function () {
          camera.position.set(ox, oy, oz);
          camera.lookAt(camLook.x, camLook.y, camLook.z);
        }
      });
    }

    function elementColor3(el) {
      var hex = ELEMENT_HEX[elKey(el)] || 0x88ffaa;
      return new THREE.Color(hex);
    }

    function figChest(fig) {
      if (!fig) return new THREE.Vector3(0, 0.8, 0);
      return new THREE.Vector3(
        fig.home.x,
        fig.home.y + (fig.isImpostor ? fig.baseScale * 1.1 : fig.baseScale * 0.95),
        fig.home.z
      );
    }

    /** R5v2 — per-element projectile mesh language (readable at a glance) */
    function makeSkillProjectileMesh(el, isCloud) {
      var low = elKey(el);
      var col = elementColor3(low);
      var geo;
      if (isCloud) {
        geo = new THREE.SphereGeometry(0.32, 12, 10);
      } else if (low === 'fire' || low === 'lava') {
        geo = new THREE.ConeGeometry(0.14, 0.42, 8);
      } else if (low === 'ice' || low === 'crystal') {
        geo = new THREE.OctahedronGeometry(0.2, 0);
      } else if (low === 'lightning' || low === 'storm') {
        geo = new THREE.ConeGeometry(0.08, 0.48, 4);
      } else if (low === 'earth' || low === 'metal') {
        geo = new THREE.DodecahedronGeometry(0.18, 0);
      } else if (low === 'plant') {
        geo = new THREE.ConeGeometry(0.12, 0.36, 6);
      } else if (low === 'shadow' || low === 'void' || low === 'poison') {
        geo = new THREE.SphereGeometry(0.2, 10, 8);
      } else if (low === 'light' || low === 'spirit') {
        geo = new THREE.OctahedronGeometry(0.16, 0);
      } else {
        // water / wind / default — soft gel orb
        geo = new THREE.SphereGeometry(0.18, 14, 12);
      }
      var mat = new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: isCloud ? 0.75 : 0.98,
        depthWrite: false, fog: false
      });
      var mesh = new THREE.Mesh(geo, mat);
      if (low === 'fire' || low === 'lava' || low === 'lightning' || low === 'storm' || low === 'plant') {
        mesh.rotation.x = Math.PI / 2;
      }
      return mesh;
    }

    /**
     * World-space impact burst.
     * Phase C: crit = gold core fork + star shards + punch (not just more particles).
     * R5+: dual ground rings + stronger element flash for Raid-readable hits.
     */
    function impactBurst(unitId, element, crit) {
      if (!Q.worldFx) return;
      var fig = figures[unitId];
      if (!fig) return;
      var col = elementColor3(element || fig.tint);
      var gold = new THREE.Color(0xffe066);
      var origin = figChest(fig);
      // Crit: bright gold core; normal: element core
      var coreCol = crit ? gold.clone() : col;
      var core = new THREE.Mesh(
        new THREE.SphereGeometry(crit ? 0.42 : 0.22, 12, 10),
        new THREE.MeshBasicMaterial({
          color: coreCol, transparent: true, opacity: 0.95, depthWrite: false, fog: false
        })
      );
      core.position.copy(origin);
      scene.add(core);
      // Outer element flash (always) — bigger on crit
      var flashShell = new THREE.Mesh(
        new THREE.SphereGeometry(crit ? 0.28 : 0.18, 10, 8),
        new THREE.MeshBasicMaterial({
          color: crit ? 0xffffff : col,
          transparent: true,
          opacity: crit ? 0.85 : 0.55,
          depthWrite: false,
          fog: false
        })
      );
      flashShell.position.copy(origin);
      scene.add(flashShell);
      if (crit) cameraPunch(0.14);

      var sparks = [];
      var n = crit ? 16 : 7;
      var si;
      for (si = 0; si < n; si++) {
        var isGoldSpark = crit && si % 2 === 0;
        var sp = new THREE.Mesh(
          new THREE.SphereGeometry((crit ? 0.06 : 0.05) + Math.random() * 0.04, 6, 5),
          new THREE.MeshBasicMaterial({
            color: isGoldSpark ? gold : col.clone().lerp(new THREE.Color(0xffffff), 0.35),
            transparent: true, opacity: 0.95, depthWrite: false, fog: false
          })
        );
        sp.position.copy(origin);
        var speed = crit ? 4.5 : 3.5;
        sp.userData.v = new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          0.8 + Math.random() * (crit ? 3.0 : 2.2),
          (Math.random() - 0.5) * speed
        );
        scene.add(sp);
        sparks.push(sp);
      }
      // Dual ground flash rings (inner element + outer soft) — reads as hit zone
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(0.15, crit ? 0.65 : 0.45, 24),
        new THREE.MeshBasicMaterial({
          color: crit ? gold : col, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
          depthWrite: false, fog: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(fig.home.x, 0.08, fig.home.z);
      scene.add(ring);
      var ring2 = new THREE.Mesh(
        new THREE.RingGeometry(0.4, crit ? 1.05 : 0.75, 28),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
          depthWrite: false, fog: false
        })
      );
      ring2.rotation.x = -Math.PI / 2;
      ring2.position.set(fig.home.x, 0.07, fig.home.z);
      scene.add(ring2);
      // Crit: gold star-ring shards; normal: element shards
      var shards = [];
      var elLow = elKey(element || fig.tint);
      var shardN = crit ? 10 : 3;
      var si2;
      for (si2 = 0; si2 < shardN; si2++) {
        var shardGeo = crit
          ? new THREE.OctahedronGeometry(0.1, 0)
          : (elLow === 'ice' || elLow === 'crystal')
            ? new THREE.OctahedronGeometry(0.08, 0)
            : (elLow === 'fire' || elLow === 'lava')
              ? new THREE.ConeGeometry(0.05, 0.16, 5)
              : new THREE.SphereGeometry(0.06, 5, 4);
        var sh = new THREE.Mesh(
          shardGeo,
          new THREE.MeshBasicMaterial({
            color: crit ? gold : col, transparent: true, opacity: 0.95, depthWrite: false, fog: false
          })
        );
        sh.position.copy(origin);
        var ang = (si2 / shardN) * Math.PI * 2 + Math.random() * 0.3;
        var rad = crit ? 3.2 : 2.2;
        sh.userData.v = new THREE.Vector3(Math.cos(ang) * rad, 1.2 + Math.random() * (crit ? 1.4 : 1), Math.sin(ang) * rad);
        scene.add(sh);
        shards.push(sh);
      }

      anims.push({
        t: 0,
        dur: crit ? 0.55 : 0.32,
        update: function (u) {
          var grow = 1 + u * (crit ? 4.0 : 2.2);
          core.scale.setScalar(grow);
          if (core.material) core.material.opacity = 0.95 * (1 - u);
          if (flashShell) {
            flashShell.scale.setScalar(1 + u * 5);
            if (flashShell.material) flashShell.material.opacity = 0.85 * (1 - u);
          }
          ring.scale.setScalar(1 + u * (crit ? 5.5 : 4));
          if (ring.material) ring.material.opacity = 0.8 * (1 - u);
          if (ring2) {
            ring2.scale.setScalar(1 + u * (crit ? 4.2 : 3.2));
            if (ring2.material) ring2.material.opacity = 0.4 * (1 - u * 0.95);
          }
          var sk;
          for (sk = 0; sk < shards.length; sk++) {
            var shd = shards[sk];
            shd.position.x = origin.x + shd.userData.v.x * u;
            shd.position.y = origin.y + shd.userData.v.y * u;
            shd.position.z = origin.z + shd.userData.v.z * u;
            shd.rotation.x += crit ? 0.35 : 0.2;
            shd.rotation.y += crit ? 0.25 : 0.1;
            if (shd.material) shd.material.opacity = 0.95 * (1 - u);
          }
          var j;
          for (j = 0; j < sparks.length; j++) {
            var s = sparks[j];
            s.position.x = origin.x + s.userData.v.x * u;
            s.position.y = origin.y + s.userData.v.y * u - u * u * 1.2;
            s.position.z = origin.z + s.userData.v.z * u;
            if (s.material) s.material.opacity = 0.95 * (1 - u);
          }
        },
        done: function () {
          scene.remove(core);
          if (core.geometry) core.geometry.dispose();
          if (core.material) core.material.dispose();
          if (flashShell) {
            scene.remove(flashShell);
            if (flashShell.geometry) flashShell.geometry.dispose();
            if (flashShell.material) flashShell.material.dispose();
          }
          scene.remove(ring);
          if (ring.geometry) ring.geometry.dispose();
          if (ring.material) ring.material.dispose();
          if (ring2) {
            scene.remove(ring2);
            if (ring2.geometry) ring2.geometry.dispose();
            if (ring2.material) ring2.material.dispose();
          }
          sparks.forEach(function (s) {
            scene.remove(s);
            if (s.geometry) s.geometry.dispose();
            if (s.material) s.material.dispose();
          });
          shards.forEach(function (s) {
            scene.remove(s);
            if (s.geometry) s.geometry.dispose();
            if (s.material) s.material.dispose();
          });
        }
      });
    }

    /** Element residual decal under a figure (kill punctuation / aftershocks) */
    function spawnElementResidual(at, element, kind) {
      if (!Q.worldFx || !at) return;
      var col = elementColor3(element);
      var el = elKey(element);
      kind = kind || el;
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(0.12, 0.6, 24),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
          depthWrite: false, fog: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(at.x, 0.07, at.z);
      scene.add(ring);
      var bits = [];
      var bi;
      var bitN = 5;
      for (bi = 0; bi < bitN; bi++) {
        var geo = (el === 'fire' || el === 'lava')
          ? new THREE.ConeGeometry(0.05, 0.14, 5)
          : (el === 'ice' || el === 'crystal')
            ? new THREE.OctahedronGeometry(0.07, 0)
            : new THREE.SphereGeometry(0.06, 5, 4);
        var bit = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.85, depthWrite: false, fog: false
        }));
        bit.position.set(
          at.x + (Math.random() - 0.5) * 0.7,
          0.12,
          at.z + (Math.random() - 0.5) * 0.7
        );
        bit.userData.vy = 0.3 + Math.random() * 0.5;
        scene.add(bit);
        bits.push(bit);
      }
      anims.push({
        t: 0,
        dur: 0.7,
        update: function (u) {
          ring.scale.setScalar(1 + u * 1.6);
          if (ring.material) ring.material.opacity = 0.6 * (1 - u);
          bits.forEach(function (b) {
            b.position.y = 0.12 + u * (b.userData.vy || 0.4);
            if (b.material) b.material.opacity = 0.85 * (1 - u);
          });
        },
        done: function () {
          scene.remove(ring);
          if (ring.geometry) ring.geometry.dispose();
          if (ring.material) ring.material.dispose();
          bits.forEach(function (b) {
            scene.remove(b);
            if (b.geometry) b.geometry.dispose();
            if (b.material) b.material.dispose();
          });
        }
      });
    }

    /**
     * R5+ cast windup — dual floor rings + rising column + motes on caster.
     * Phase B: cast profile id tweaks silhouette (magma / spark / water / default).
     * Goal: you can see WHO is casting before the projectile leaves.
     */
    function castWindup(fromFig, col, thenFn, castProfile, castSec) {
      if (!fromFig || !Q.worldFx) {
        if (thenFn) thenFn();
        return;
      }
      var hx = fromFig.home.x;
      var hz = fromFig.home.z;
      var hy = fromFig.home.y + (fromFig.baseScale || 1) * 0.2;
      var cp = String(castProfile || 'cast_default');
      // Dynamic spool: basic ~0.05s, magic ability ~0.35s, signature ~0.55s+
      var windDur = typeof castSec === 'number' ? castSec : 0.14;
      windDur = Math.max(0.04, Math.min(0.9, windDur));
      var ringCol = col.clone ? col.clone() : new THREE.Color(col);
      var colmCol = col.clone ? col.clone() : new THREE.Color(col);
      var ringInner = 0.18;
      var ringOuter = 0.62;
      var colmH = 1.55;
      var sparkN = windDur > 0.35 ? 10 : (windDur > 0.15 ? 7 : 4);
      if (cp === 'magma_runes' || cp === 'ember_charge') {
        ringCol = new THREE.Color(0xff6622);
        colmCol = new THREE.Color(0xffaa44);
        ringOuter = 0.78 + windDur * 0.3;
        colmH = 1.65 + windDur * 0.9;
      } else if (cp === 'spark_build') {
        ringCol = new THREE.Color(0xffffff);
        colmCol = col;
        ringInner = 0.08;
        ringOuter = 0.48;
        colmH = 1.75 + windDur * 1.1;
      } else if (cp === 'rise_water') {
        ringOuter = 0.85;
        colmH = 1.15 + windDur * 0.7;
      } else if (cp === 'heavy_raise') {
        ringOuter = 0.72;
        colmH = 0.95 + windDur * 0.45;
      } else if (cp === 'drip_charge' || cp === 'prism_charge') {
        ringOuter = 0.68;
        colmH = 1.4 + windDur * 0.75;
      }
      // Inner ring (tight)
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(ringInner, ringOuter * 0.55, 32),
        new THREE.MeshBasicMaterial({
          color: ringCol, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
          depthWrite: false, fog: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(hx, 0.11, hz);
      scene.add(ring);
      // Outer telegraph ring (expands hard — Raid "I'm casting")
      var ringOuterM = new THREE.Mesh(
        new THREE.RingGeometry(ringOuter * 0.5, ringOuter * 1.15, 36),
        new THREE.MeshBasicMaterial({
          color: colmCol, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
          depthWrite: false, fog: false
        })
      );
      ringOuterM.rotation.x = -Math.PI / 2;
      ringOuterM.position.set(hx, 0.09, hz);
      scene.add(ringOuterM);
      // Vertical charge column
      var colm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.26, colmH, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: colmCol, transparent: true, opacity: 0.55, depthWrite: false, fog: false,
          side: THREE.DoubleSide
        })
      );
      colm.position.set(hx, hy + colmH * 0.35, hz);
      scene.add(colm);
      // Soft glow sphere at chest
      var orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, fog: false
        })
      );
      orb.position.set(hx, hy + 0.55, hz);
      scene.add(orb);
      // Rising rune sparks — element-tinted
      var sparks = [];
      var si;
      for (si = 0; si < sparkN; si++) {
        var sp = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 6, 5),
          new THREE.MeshBasicMaterial({
            color: si % 2 === 0 ? 0xffffff : ringCol,
            transparent: true, opacity: 0.95, depthWrite: false, fog: false
          })
        );
        var ang = (si / sparkN) * Math.PI * 2;
        sp.position.set(hx + Math.cos(ang) * 0.32, hy, hz + Math.sin(ang) * 0.32);
        sp.userData.ang = ang;
        scene.add(sp);
        sparks.push(sp);
      }
      // Point light pulse on caster (quality-gated via existing lights budget)
      var castLight = null;
      if (Q.worldFx) {
        castLight = new THREE.PointLight(ringCol.getHex ? ringCol.getHex() : 0xffffff, 0.9, 6);
        castLight.position.set(hx, hy + 0.9, hz);
        scene.add(castLight);
      }
      if (fromFig.mat && fromFig.mat.emissiveIntensity != null) {
        fromFig.mat.emissiveIntensity = (fromFig.baseEmissive || 0.4) + 0.55;
      }
      // Impostor color flash
      if (fromFig.isImpostor && fromFig.mat && fromFig.mat.color && fromFig.baseColor) {
        fromFig.mat.color.copy(fromFig.baseColor).lerp(new THREE.Color(0xffffff), 0.45);
      }
      anims.push({
        t: 0,
        dur: windDur,
        update: function (u) {
          // Ease-in charge: slow start, swell near release (magic spool feel)
          var charge = u * u * (3 - 2 * u);
          if (windDur > 0.25) charge = Math.pow(u, 1.35);
          ring.scale.setScalar(1 + charge * (1.2 + windDur));
          if (ring.material) ring.material.opacity = 0.95 * (0.6 + 0.4 * (1 - u * 0.3));
          ringOuterM.scale.setScalar(1 + charge * (1.8 + windDur * 0.8));
          if (ringOuterM.material) ringOuterM.material.opacity = 0.55 * (1 - u * 0.5);
          colm.scale.y = 0.4 + charge * 1.9;
          colm.position.y = hy + 0.25 + charge * (0.55 + windDur * 0.95);
          if (colm.material) colm.material.opacity = 0.4 + charge * 0.4;
          orb.scale.setScalar(0.7 + charge * 1.6);
          if (orb.material) orb.material.opacity = 0.75 * (0.5 + 0.5 * charge) * (1 - u * 0.4);
          if (castLight) castLight.intensity = 0.5 + charge * 1.4;
          var k;
          for (k = 0; k < sparks.length; k++) {
            var a2 = sparks[k].userData.ang + u * 2.2;
            var rad = 0.28 + charge * 0.35;
            sparks[k].position.x = hx + Math.cos(a2) * rad;
            sparks[k].position.z = hz + Math.sin(a2) * rad;
            sparks[k].position.y = hy + charge * (1.15 + windDur * 0.9) + Math.sin(u * 14 + k) * 0.06;
            if (sparks[k].material) sparks[k].material.opacity = 0.95 * (1 - u * 0.8);
          }
        },
        done: function () {
          scene.remove(ring);
          scene.remove(ringOuterM);
          scene.remove(colm);
          scene.remove(orb);
          if (castLight) scene.remove(castLight);
          if (ring.geometry) ring.geometry.dispose();
          if (ring.material) ring.material.dispose();
          if (ringOuterM.geometry) ringOuterM.geometry.dispose();
          if (ringOuterM.material) ringOuterM.material.dispose();
          if (colm.geometry) colm.geometry.dispose();
          if (colm.material) colm.material.dispose();
          if (orb.geometry) orb.geometry.dispose();
          if (orb.material) orb.material.dispose();
          sparks.forEach(function (s) {
            scene.remove(s);
            if (s.geometry) s.geometry.dispose();
            if (s.material) s.material.dispose();
          });
          if (fromFig.mat && fromFig.mat.emissiveIntensity != null) {
            fromFig.mat.emissiveIntensity = fromFig.baseEmissive || 0.4;
          }
          if (fromFig.isImpostor && fromFig.mat && fromFig.mat.color && fromFig.baseColor) {
            fromFig.mat.color.copy(fromFig.baseColor);
          }
          if (thenFn) thenFn();
        }
      });
    }

    // ─── Painted FX billboards (assets/battle/fx/*.png) ───
    var paintedFxCache = {};
    var PAINTED_FX_STEMS = [
      'fire_impact', 'fire_comet', 'heal_bloom', 'buff_ward',
      'poison_cloud', 'ice_shatter', 'water_splash', 'lightning_bolt'
    ];

    function paintedFxUrl(stem) {
      var ver = (global.SR_ART && global.SR_ART.ART_CACHE_VER) || '1';
      return 'assets/battle/fx/' + stem + '.png?srv=' + ver;
    }

    function preloadPaintedFx() {
      if (!THREE || typeof THREE.TextureLoader !== 'function') return;
      var loader = new THREE.TextureLoader();
      var i;
      for (i = 0; i < PAINTED_FX_STEMS.length; i++) {
        (function (stem) {
          if (paintedFxCache[stem]) return;
          paintedFxCache[stem] = null;
          loader.load(
            paintedFxUrl(stem),
            function (tex) {
              try {
                if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
              } catch (eCs) { /* */ }
              tex.needsUpdate = true;
              paintedFxCache[stem] = tex;
            },
            undefined,
            function () { paintedFxCache[stem] = false; }
          );
        })(PAINTED_FX_STEMS[i]);
      }
    }
    preloadPaintedFx();

    /**
     * Spawn a camera-facing painted VFX sprite at world pos.
     * opts: { scale, grow, dur, opacity, additive, aspectW, aspectH, yOff, spin, follow }
     */
    function spawnPaintedFx(stem, pos, opts) {
      opts = opts || {};
      if (!Q.worldFx || !pos) return null;
      var tex = paintedFxCache[stem];
      if (!tex || tex === false) return null;
      var mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: opts.opacity != null ? opts.opacity : 0.98,
        depthWrite: false,
        fog: false,
        blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      var spr = new THREE.Sprite(mat);
      var sc = opts.scale != null ? opts.scale : 1.9;
      var aw = opts.aspectW != null ? opts.aspectW : 1;
      var ah = opts.aspectH != null ? opts.aspectH : 1;
      spr.scale.set(sc * aw, sc * ah, 1);
      spr.position.copy(pos);
      if (opts.yOff) spr.position.y += opts.yOff;
      scene.add(spr);
      var dur = opts.dur != null ? opts.dur : 0.48;
      var grow = opts.grow != null ? opts.grow : 1.85;
      var baseOp = opts.opacity != null ? opts.opacity : 0.98;
      anims.push({
        t: 0,
        dur: dur,
        update: function (u) {
          var s = sc * (1 + u * (grow - 1));
          spr.scale.set(s * aw, s * ah, 1);
          if (mat) mat.opacity = baseOp * (1 - u * u);
          if (opts.follow && opts.follow.x != null) {
            spr.position.x = opts.follow.x;
            spr.position.y = opts.follow.y + (opts.yOff || 0);
            spr.position.z = opts.follow.z;
          }
          if (opts.spin && mat) mat.rotation = u * opts.spin;
        },
        done: function () {
          scene.remove(spr);
          if (mat) mat.dispose();
        }
      });
      return spr;
    }

    /** Pick painted impact/travel stems from skill/element/recipe */
    function paintedFxStems(opts, impactId, travelId, skillId) {
      var el = elKey(opts.element || '');
      var out = { impact: null, travel: null };
      skillId = String(skillId || '').toLowerCase();
      impactId = String(impactId || '');
      travelId = String(travelId || '');
      if (travelId === 'fire_comet' || impactId === 'scorch_bloom' || el === 'fire' || el === 'lava' ||
          skillId.indexOf('blaze') >= 0 || skillId.indexOf('inferno') >= 0) {
        out.travel = 'fire_comet';
        out.impact = 'fire_impact';
      } else if (impactId === 'eruption') {
        out.impact = 'fire_impact';
      } else if (travelId === 'water_arc' || impactId === 'ripple_rings' || el === 'water' ||
                 skillId.indexOf('splash') >= 0 || skillId.indexOf('tidal') >= 0) {
        out.impact = 'water_splash';
      } else if (travelId === 'venom_glob' || impactId === 'toxic_splotch' || el === 'poison' ||
                 skillId.indexOf('poison') >= 0 || skillId.indexOf('miasma') >= 0) {
        out.impact = 'poison_cloud';
      } else if (travelId === 'ice_shard' || impactId === 'shatter_star' || el === 'ice' || el === 'crystal' ||
                 skillId.indexOf('freeze') >= 0 || skillId.indexOf('ice') >= 0 || skillId.indexOf('blizzard') >= 0) {
        out.impact = 'ice_shatter';
      } else if (travelId === 'lightning_fork' || impactId === 'flash_core' ||
                 el === 'lightning' || el === 'storm' ||
                 skillId.indexOf('bolt') >= 0 || skillId.indexOf('storm') >= 0) {
        out.impact = 'lightning_bolt';
      } else if (impactId === 'green_rain' || impactId === 'halo_flash' ||
                 skillId.indexOf('heal') >= 0 || skillId.indexOf('mend') >= 0) {
        out.impact = 'heal_bloom';
      } else if (impactId === 'lattice' || skillId.indexOf('shield') >= 0 ||
                 skillId.indexOf('guard') >= 0 || skillId.indexOf('veil') >= 0 ||
                 skillId.indexOf('shell') >= 0) {
        out.impact = 'buff_ward';
      }
      return out;
    }

    /**
     * World-space skill delivery (Phase 4 + VFX Phase A/B catalog).
     * opts.recipe from SR_COMBAT_VFX.resolveRecipe drives tier + unique silhouettes.
     * delivery: projectile|beam|melee|aoe|cloud|heal|buff
     */
    function skillFx(opts) {
      opts = opts || {};
      if (!Q.worldFx) {
        if (opts.onDone) opts.onDone();
        return false;
      }
      // Resolve data-driven recipe when catalog present
      var VFX = global.SR_COMBAT_VFX;
      var recipe = opts.recipe || null;
      if (!recipe && VFX && typeof VFX.resolveRecipe === 'function') {
        recipe = VFX.resolveRecipe({
          skillId: opts.skillId,
          element: opts.element,
          kind: opts.kind,
          aoe: opts.aoe,
          deliveryHint: opts.delivery,
          cd: opts.cd,
          mult: opts.mult
        });
      }
      if (recipe) {
        opts.recipe = recipe;
        opts.fxTier = recipe.fxTier;
        opts.delivery = recipe._mapDelivery || recipe.delivery || opts.delivery;
        if (recipe.budget && recipe.budget.cameraPunch && !opts.crit) {
          cameraPunch(recipe.budget.cameraPunch * (recipe.fxTier === 'signature' ? 1.15 : 1));
        }
      }
      var fromFig = figures[opts.fromId];
      var toFig = figures[opts.toId];
      var delivery = String(opts.delivery || 'projectile').toLowerCase();
      var col = elementColor3(opts.element);
      var from = figChest(fromFig || { home: { x: 0, y: 0.8, z: 1 }, baseScale: 1, isImpostor: false });
      var to = figChest(toFig || { home: { x: 0, y: 0.8, z: -1 }, baseScale: 1, isImpostor: false });

      // Timeline:
      //   1) Attack pose RIGHT AWAY (cast windup / charge) — plate readable first
      //   2) Brief pose-lead hold so the strike frame lands before bounce
      //   3) Bounce-forward (lunge) + delivery (actualize)
      //   4) Idle pose restored as lunge returns home
      var isSupport = delivery === 'heal' || delivery === 'buff';
      var poseReady = false;
      if (opts.fromId != null && !isSupport) {
        poseReady = beginAttackPose(opts.fromId);
      }

      // Dynamic cast spool: basic = near-instant; magic/ability/signature charge up
      var castSec = (recipe && recipe.budget && recipe.budget.castSec != null)
        ? recipe.budget.castSec
        : (opts.fxTier === 'signature' ? 0.55 : opts.fxTier === 'ability' ? 0.32 : 0.06);
      // Basic attacks skip formal windup (snappy). Heals get a short soft charge.
      var skipWindup = opts.fxTier === 'basic' || (delivery === 'melee' && opts.fxTier === 'basic');
      if (isSupport) {
        // Soft mend/shield charge — shorter than hard magic but not instant
        castSec = Math.min(castSec, 0.28);
        skipWindup = false;
      }

      // Pose-lead: attack plate holds, then bounce + hit (seconds).
      // Basics need the longest lead (no cast spool). Abilities already charged.
      var poseLead = 0.10;
      if (opts.fxTier === 'basic') poseLead = 0.12;
      else if (opts.fxTier === 'signature') poseLead = 0.09;
      else if (opts.fxTier === 'ability') poseLead = 0.08;
      if (isSupport) poseLead = 0.05;
      // Optional override from recipe budget
      if (recipe && recipe.budget && recipe.budget.poseLeadSec != null) {
        poseLead = Math.max(0, Number(recipe.budget.poseLeadSec) || 0);
      }
      if (opts.poseLeadSec != null) {
        poseLead = Math.max(0, Number(opts.poseLeadSec) || 0);
      }

      function actualize() {
        // Bounce + VFX after pose has been readable for poseLead
        if (opts.fromId != null && !isSupport) {
          lunge(opts.fromId, opts.toId, { poseOwned: poseReady, dur: 0.42 });
        }
        // Refresh chest points after any pose change
        from = figChest(fromFig || { home: { x: from.x, y: from.y, z: from.z }, baseScale: 1, isImpostor: false });
        to = figChest(toFig || { home: { x: to.x, y: to.y, z: to.z }, baseScale: 1, isImpostor: false });
        skillFxDeliver(opts, fromFig, toFig, delivery, col, from, to);
      }

      function scheduleActualize(delaySec) {
        delaySec = Math.max(0, delaySec || 0);
        if (delaySec < 0.02) {
          actualize();
          return;
        }
        anims.push({
          t: 0,
          dur: delaySec,
          update: function () { /* pose hold */ },
          done: function () { actualize(); }
        });
      }

      if (!skipWindup && fromFig && castSec > 0.04) {
        // Charge first, then brief pose-lead, then bounce
        castWindup(fromFig, col, function () {
          scheduleActualize(poseLead);
        }, recipe && recipe.cast, castSec);
        return true;
      }
      // Basic / near-zero cast: plate now → short hold → bounce + hit
      scheduleActualize(poseLead);
      return true;
    }

    /** Dispose mesh helper */
    function disposeMesh(m) {
      if (!m) return;
      scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach(function (mm) { mm.dispose(); });
        else m.material.dispose();
      }
    }

    /**
     * Phase B — unique silhouette runners keyed by recipe.impact / travel.
     * Blind-test: Blaze ≠ Bolt ≠ Splash ≠ Inferno ≠ Crush ≠ Venom ≠ Mend ≠ Shield.
     */
    function skillFxDeliver(opts, fromFig, toFig, delivery, col, from, to) {
      var tierMul = 1;
      var doResidual = false;
      var residualId = null;
      var impactId = null;
      var travelId = null;
      var skillId = String(opts.skillId || (opts.recipe && opts.recipe.skillId) || '').toLowerCase();
      if (opts.recipe) {
        if (opts.recipe.budget) {
          tierMul = opts.recipe.budget.durationMul || 1;
          doResidual = !!opts.recipe.budget.residual && Q.worldFx;
        }
        residualId = opts.recipe.residual || null;
        impactId = opts.recipe.impact || null;
        travelId = opts.recipe.travel || null;
      }
      opts._tierMul = tierMul;
      opts._doResidual = doResidual;
      opts._painted = paintedFxStems(opts, impactId, travelId, skillId);
      // Refresh chest points after windup
      from = figChest(fromFig || { home: { x: from.x, y: from.y, z: from.z }, baseScale: 1, isImpostor: false });
      to = figChest(toFig || { home: { x: to.x, y: to.y, z: to.z }, baseScale: 1, isImpostor: false });

      function spawnResidual(at, c, kind) {
        if (!opts._doResidual || !at) return;
        kind = kind || residualId || 'default';
        var parts = [];
        var ring = new THREE.Mesh(
          new THREE.RingGeometry(0.12, kind === 'embers' || kind === 'ember_ground' ? 0.7 : 0.5, 24),
          new THREE.MeshBasicMaterial({
            color: c, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
            depthWrite: false, fog: false
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(at.x, 0.08, at.z);
        scene.add(ring);
        parts.push(ring);
        // Signature residual extras
        if (kind === 'embers' || kind === 'ember_ground') {
          var ei;
          for (ei = 0; ei < 5; ei++) {
            var emb = new THREE.Mesh(
              new THREE.SphereGeometry(0.06, 6, 5),
              new THREE.MeshBasicMaterial({
                color: 0xff8844, transparent: true, opacity: 0.85, depthWrite: false, fog: false
              })
            );
            emb.position.set(at.x + (Math.random() - 0.5) * 0.8, 0.15, at.z + (Math.random() - 0.5) * 0.8);
            emb.userData.vy = 0.4 + Math.random() * 0.5;
            scene.add(emb);
            parts.push(emb);
          }
        } else if (kind === 'puddle' || kind === 'fumes' || kind === 'spores') {
          var pud = new THREE.Mesh(
            new THREE.CircleGeometry(0.45, 20),
            new THREE.MeshBasicMaterial({
              color: c, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
              depthWrite: false, fog: false
            })
          );
          pud.rotation.x = -Math.PI / 2;
          pud.position.set(at.x, 0.06, at.z);
          scene.add(pud);
          parts.push(pud);
        } else if (kind === 'rubble') {
          var ri;
          for (ri = 0; ri < 4; ri++) {
            var rock = new THREE.Mesh(
              new THREE.DodecahedronGeometry(0.08, 0),
              new THREE.MeshBasicMaterial({
                color: c.clone().lerp(new THREE.Color(0x665544), 0.4),
                transparent: true, opacity: 0.85, depthWrite: false, fog: false
              })
            );
            rock.position.set(at.x + (Math.random() - 0.5) * 0.7, 0.1, at.z + (Math.random() - 0.5) * 0.7);
            scene.add(rock);
            parts.push(rock);
          }
        }
        anims.push({
          t: 0,
          dur: (kind === 'ember_ground' ? 0.85 : 0.55) * tierMul,
          update: function (u) {
            ring.scale.setScalar(1 + u * 1.5);
            if (ring.material) ring.material.opacity = 0.55 * (1 - u);
            var pi;
            for (pi = 1; pi < parts.length; pi++) {
              var p = parts[pi];
              if (p.userData && p.userData.vy) {
                p.position.y = 0.15 + u * p.userData.vy;
              }
              if (p.material) p.material.opacity = (p.material.opacity || 0.8) * (1 - u * 0.15);
              if (p.material && u > 0.5) p.material.opacity *= 0.96;
            }
          },
          done: function () {
            parts.forEach(disposeMesh);
          }
        });
      }

      // ─── Phase B unique silhouettes ───
      var routed = trySignatureFx(opts, delivery, col, from, to, skillId, impactId, travelId, tierMul, spawnResidual);
      if (routed) return true;

      // ─── Generic delivery fallbacks (Phase A paths) ───
      if (delivery === 'heal' || delivery === 'buff') {
        return runMendOrShieldFx(opts, delivery, col, from, to, skillId, impactId, tierMul, spawnResidual);
      }

      if (delivery === 'aoe') {
        return runGenericAoeFx(opts, col, from, to, impactId, tierMul, spawnResidual);
      }

      if (delivery === 'melee') {
        return runGenericMeleeFx(opts, col, from, to, impactId, tierMul, spawnResidual);
      }

      if (delivery === 'beam') {
        return runGenericBeamFx(opts, col, from, to, impactId, tierMul, spawnResidual);
      }

      // projectile / cloud default
      return runGenericProjectileFx(opts, delivery, col, from, to, travelId, tierMul, spawnResidual);
    }

    /** Route to unique spectacle when recipe profiles are known */
    function trySignatureFx(opts, delivery, col, from, to, skillId, impactId, travelId, tierMul, spawnResidual) {
      var el = elKey(opts.element || (opts.recipe && opts.recipe.element) || '');
      // Inferno / eruption set-piece
      if (impactId === 'eruption' || skillId === 'inferno') {
        return runInfernoFx(opts, col, from, to, tierMul, spawnResidual);
      }
      // Lightning fork
      if (travelId === 'lightning_fork' ||
          ((skillId === 'bolt' || skillId.indexOf('bolt') >= 0) && delivery === 'beam') ||
          (impactId === 'flash_core' && delivery === 'beam') ||
          ((el === 'lightning' || el === 'storm' || el === 'light') && delivery === 'beam')) {
        return runBoltFx(opts, col, from, to, tierMul, spawnResidual);
      }
      // Fire comet — also lava / fire basics
      if (travelId === 'fire_comet' || impactId === 'scorch_bloom' || skillId === 'blaze' ||
          skillId === 'blaze_focus' || skillId.indexOf('fire') >= 0 || skillId.indexOf('lava') >= 0 ||
          el === 'fire' || el === 'lava') {
        if (delivery === 'aoe' && (skillId === 'inferno' || impactId === 'eruption')) {
          /* handled above */
        } else if (delivery !== 'buff' && delivery !== 'heal') {
          return runBlazeFx(opts, col, from, to, tierMul, spawnResidual);
        }
      }
      // Water splash / tidal
      if (impactId === 'ripple_rings' || travelId === 'water_arc' || skillId === 'splash' ||
          skillId === 'tidal_surge' || el === 'water') {
        if (delivery !== 'heal' && delivery !== 'buff') {
          return runSplashFx(opts, col, from, to, tierMul, spawnResidual);
        }
      }
      // Poison / venom
      if (impactId === 'toxic_splotch' || travelId === 'venom_glob' || skillId === 'poison' ||
          skillId.indexOf('venom') >= 0 || skillId.indexOf('miasma') >= 0 || el === 'poison') {
        return runVenomFx(opts, col, from, to, tierMul, spawnResidual);
      }
      // Crush / quake ground
      if (impactId === 'ground_dust' || skillId === 'smash' || skillId === 'quake' ||
          skillId.indexOf('crush') >= 0 || el === 'earth' || el === 'metal') {
        if (delivery === 'melee' || delivery === 'aoe' || impactId === 'ground_dust') {
          return runCrushFx(opts, col, from, to, tierMul, spawnResidual);
        }
      }
      // Ice shard
      if (travelId === 'ice_shard' || impactId === 'shatter_star' || skillId === 'freeze' ||
          skillId.indexOf('ice') >= 0 || skillId.indexOf('frost') >= 0 || skillId.indexOf('blizzard') >= 0 ||
          el === 'ice' || el === 'crystal') {
        if (delivery !== 'buff' && delivery !== 'heal') {
          return runIceFx(opts, col, from, to, tierMul, spawnResidual);
        }
      }
      // Shadow / void dark bloom
      if (impactId === 'dark_bloom' || travelId === 'shadow_suck' || el === 'shadow' || el === 'void' ||
          skillId.indexOf('void') >= 0 || skillId.indexOf('night') >= 0 || skillId.indexOf('haunt') >= 0) {
        if (delivery !== 'buff' && delivery !== 'heal') {
          return runDarkFx(opts, col, from, to, tierMul, spawnResidual);
        }
      }
      // Wind gust
      if (impactId === 'gust_lines' || travelId === 'gust_streak' || el === 'wind' ||
          skillId.indexOf('cyclone') >= 0 || skillId.indexOf('tempest') >= 0 || skillId.indexOf('wind') >= 0) {
        if (delivery !== 'buff' && delivery !== 'heal') {
          return runWindFx(opts, col, from, to, tierMul, spawnResidual);
        }
      }
      // Plant / vine
      if (impactId === 'moss_burst' || el === 'plant' || skillId.indexOf('overgrowth') >= 0 ||
          skillId.indexOf('vine') >= 0) {
        if (delivery !== 'heal' && delivery !== 'buff') {
          return runPlantFx(opts, col, from, to, tierMul, spawnResidual);
        }
      }
      return false;
    }

    /** Rising flame particle field (shared by blaze / inferno / burn residual) */
    function spawnFlamePillar(at, scale, dur, onDone) {
      scale = scale || 1;
      dur = dur || 0.55;
      var flames = [];
      var n = Math.floor(14 * scale);
      var fi;
      var palette = [0xfff2aa, 0xffcc44, 0xff7722, 0xff4400, 0xcc2200];
      for (fi = 0; fi < n; fi++) {
        var h = 0.18 + Math.random() * 0.35 * scale;
        var r = 0.04 + Math.random() * 0.08 * scale;
        var cone = new THREE.Mesh(
          new THREE.ConeGeometry(r, h, 6),
          new THREE.MeshBasicMaterial({
            color: palette[fi % palette.length],
            transparent: true, opacity: 0.92, depthWrite: false, fog: false
          })
        );
        var ang = Math.random() * Math.PI * 2;
        var rad = Math.random() * 0.35 * scale;
        cone.position.set(at.x + Math.cos(ang) * rad, at.y * 0.2 + 0.1, at.z + Math.sin(ang) * rad);
        cone.userData.baseY = cone.position.y;
        cone.userData.vy = 1.2 + Math.random() * 2.2 * scale;
        cone.userData.spin = (Math.random() - 0.5) * 0.4;
        cone.userData.phase = Math.random() * Math.PI * 2;
        scene.add(cone);
        flames.push(cone);
      }
      // Hot core glow
      var core = new THREE.Mesh(
        new THREE.SphereGeometry(0.18 * scale, 10, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffeebb, transparent: true, opacity: 0.95, depthWrite: false, fog: false
        })
      );
      core.position.set(at.x, 0.25, at.z);
      scene.add(core);
      var heat = new THREE.Mesh(
        new THREE.SphereGeometry(0.35 * scale, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xff6622, transparent: true, opacity: 0.45, depthWrite: false, fog: false
        })
      );
      heat.position.set(at.x, 0.35, at.z);
      scene.add(heat);
      anims.push({
        t: 0,
        dur: dur,
        update: function (u) {
          var i;
          for (i = 0; i < flames.length; i++) {
            var f = flames[i];
            var wobble = Math.sin(u * 18 + f.userData.phase) * 0.06;
            f.position.y = f.userData.baseY + u * f.userData.vy;
            f.position.x += wobble * 0.15;
            f.rotation.z += f.userData.spin;
            f.scale.x = 1 + Math.sin(u * 12 + i) * 0.25;
            f.scale.y = 1 + u * 1.8;
            if (f.material) f.material.opacity = 0.95 * (1 - u * u);
          }
          core.scale.setScalar(1 + u * 2.5);
          if (core.material) core.material.opacity = 0.95 * (1 - u);
          heat.scale.setScalar(1 + u * 3.5);
          if (heat.material) heat.material.opacity = 0.45 * (1 - u);
        },
        done: function () {
          flames.forEach(disposeMesh);
          disposeMesh(core);
          disposeMesh(heat);
          if (onDone) onDone();
        }
      });
    }

    /** Dark / void suck bloom */
    function runDarkFx(opts, col, from, to, tierMul, spawnResidual) {
      var orbs = [];
      var oi;
      for (oi = 0; oi < 8; oi++) {
        var o = new THREE.Mesh(
          new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 8, 6),
          new THREE.MeshBasicMaterial({
            color: oi % 2 ? 0x220033 : col, transparent: true, opacity: 0.85, depthWrite: false, fog: false
          })
        );
        var ang = (oi / 8) * Math.PI * 2;
        o.position.set(to.x + Math.cos(ang) * 1.2, to.y + 0.3, to.z + Math.sin(ang) * 1.2);
        o.userData.from = o.position.clone();
        scene.add(o);
        orbs.push(o);
      }
      var voidCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0x110022, transparent: true, opacity: 0.95, depthWrite: false, fog: false })
      );
      voidCore.position.copy(to);
      scene.add(voidCore);
      anims.push({
        t: 0, dur: 0.5 * tierMul,
        update: function (u) {
          orbs.forEach(function (o) {
            o.position.lerpVectors(o.userData.from, to, u * u);
            if (o.material) o.material.opacity = 0.9 * (1 - u * 0.5);
          });
          voidCore.scale.setScalar(1 + u * 3);
          if (voidCore.material) voidCore.material.opacity = 0.95 * (1 - u);
        },
        done: function () {
          orbs.forEach(disposeMesh);
          disposeMesh(voidCore);
          spawnResidual(to, col, 'smoke');
          if (opts.onDone) opts.onDone();
        }
      });
      return true;
    }

    /** Wind slash / cyclone ribbons */
    function runWindFx(opts, col, from, to, tierMul, spawnResidual) {
      var ribbons = [];
      var ri;
      for (ri = 0; ri < 5; ri++) {
        var plane = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6 + ri * 0.15, 0.12),
          new THREE.MeshBasicMaterial({
            color: ri === 0 ? 0xffffff : col, transparent: true, opacity: 0.8,
            side: THREE.DoubleSide, depthWrite: false, fog: false
          })
        );
        plane.position.copy(from).lerp(to, 0.2);
        plane.lookAt(to);
        plane.userData.off = (ri - 2) * 0.12;
        scene.add(plane);
        ribbons.push(plane);
      }
      anims.push({
        t: 0, dur: 0.4 * tierMul,
        update: function (u) {
          ribbons.forEach(function (p, i) {
            var t = Math.min(1, u * 1.2 + i * 0.04);
            p.position.lerpVectors(from, to, t);
            p.position.y += Math.sin(u * Math.PI * 2 + i) * 0.2 + p.userData.off;
            p.scale.x = 1 + u * 0.8;
            if (p.material) p.material.opacity = 0.85 * (1 - u);
          });
        },
        done: function () {
          ribbons.forEach(disposeMesh);
          // Gust ring at target
          var ring = new THREE.Mesh(
            new THREE.RingGeometry(0.2, 0.9, 32),
            new THREE.MeshBasicMaterial({
              color: col, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
              depthWrite: false, fog: false
            })
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(to.x, 0.1, to.z);
          scene.add(ring);
          anims.push({
            t: 0, dur: 0.35 * tierMul,
            update: function (u) {
              ring.scale.setScalar(1 + u * 3);
              if (ring.material) ring.material.opacity = 0.75 * (1 - u);
            },
            done: function () {
              disposeMesh(ring);
              spawnResidual(to, col, 'leaves');
              if (opts.onDone) opts.onDone();
            }
          });
        }
      });
      return true;
    }

    /** Plant vine lash + spore burst */
    function runPlantFx(opts, col, from, to, tierMul, spawnResidual) {
      var vines = [];
      var vi;
      for (vi = 0; vi < 4; vi++) {
        var mid = from.clone().lerp(to, 0.45);
        mid.y += 0.3 + vi * 0.1;
        mid.x += (vi - 1.5) * 0.15;
        var dist = from.distanceTo(to) * 0.9 || 1;
        var vine = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.07, dist, 6, 1, true),
          new THREE.MeshBasicMaterial({
            color: col, transparent: true, opacity: 0.9, depthWrite: false, fog: false
          })
        );
        vine.position.copy(mid);
        vine.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          to.clone().sub(from).normalize()
        );
        scene.add(vine);
        vines.push(vine);
      }
      anims.push({
        t: 0, dur: 0.36 * tierMul,
        update: function (u) {
          vines.forEach(function (v, i) {
            v.scale.y = Math.min(1, u * 1.5 + i * 0.05);
            if (v.material) v.material.opacity = 0.9 * (u < 0.7 ? 1 : (1 - (u - 0.7) / 0.3));
          });
        },
        done: function () {
          vines.forEach(disposeMesh);
          var spores = [];
          var si;
          for (si = 0; si < 12; si++) {
            var sp = new THREE.Mesh(
              new THREE.SphereGeometry(0.06, 6, 5),
              new THREE.MeshBasicMaterial({
                color: si % 2 ? 0xaaff66 : col, transparent: true, opacity: 0.85, depthWrite: false, fog: false
              })
            );
            sp.position.copy(to);
            var ang = (si / 12) * Math.PI * 2;
            sp.userData.v = new THREE.Vector3(Math.cos(ang) * 1.4, 0.9 + Math.random(), Math.sin(ang) * 1.4);
            scene.add(sp);
            spores.push(sp);
          }
          anims.push({
            t: 0, dur: 0.4 * tierMul,
            update: function (u) {
              spores.forEach(function (sp) {
                sp.position.x = to.x + sp.userData.v.x * u;
                sp.position.y = to.y + sp.userData.v.y * u - u * u * 1.2;
                sp.position.z = to.z + sp.userData.v.z * u;
                if (sp.material) sp.material.opacity = 0.85 * (1 - u);
              });
            },
            done: function () {
              spores.forEach(disposeMesh);
              spawnResidual(to, col, 'spores');
              if (opts.onDone) opts.onDone();
            }
          });
        }
      });
      return true;
    }

    /** Inferno — multi-pillar flame eruption (reads as real fire) */
    function runInfernoFx(opts, col, from, to, tierMul, spawnResidual) {
      if (opts.crit) cameraPunch(0.16);
      else cameraPunch(0.12);
      var center = from.clone();
      spawnPaintedFx('fire_impact', center, {
        scale: 3.0, grow: 2.4, dur: 0.7 * tierMul, additive: true, yOff: 0.2
      });
      // Second delayed boom for multi-hit read
      anims.push({
        t: 0, dur: 0.28 * tierMul,
        update: function () {},
        done: function () {
          spawnPaintedFx('fire_impact', center, {
            scale: 2.4, grow: 2.0, dur: 0.55 * tierMul, additive: true, yOff: 0.1
          });
        }
      });
      var hitTicks = opts.multiHit != null ? opts.multiHit : 3;
      var rings = [];
      var ri;
      for (ri = 0; ri < 4; ri++) {
        var ring = new THREE.Mesh(
          new THREE.RingGeometry(0.25 + ri * 0.08, 1.0 + ri * 0.15, 36),
          new THREE.MeshBasicMaterial({
            color: ri % 2 === 0 ? 0xff6622 : 0xffaa44, transparent: true, opacity: 0.85,
            side: THREE.DoubleSide, depthWrite: false, fog: false
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(center.x, 0.08 + ri * 0.02, center.z);
        ring.userData.delay = ri * 0.08;
        scene.add(ring);
        rings.push(ring);
      }
      // Staggered flame pillars around caster
      var pillarPts = [];
      for (ri = 0; ri < 5; ri++) {
        var ang = (ri / 5) * Math.PI * 2;
        pillarPts.push(new THREE.Vector3(
          center.x + Math.cos(ang) * 0.7,
          0,
          center.z + Math.sin(ang) * 0.7
        ));
      }
      pillarPts.push(center.clone());
      var ticksFired = 0;
      var pillarsStarted = 0;
      anims.push({
        t: 0,
        dur: 1.05 * tierMul,
        update: function (u) {
          var i;
          for (i = 0; i < rings.length; i++) {
            var lu = Math.max(0, Math.min(1, (u - rings[i].userData.delay) / 0.75));
            rings[i].scale.setScalar(1 + lu * 5.5);
            if (rings[i].material) rings[i].material.opacity = 0.85 * (1 - lu);
          }
          var wantPillars = Math.min(pillarPts.length, 1 + Math.floor(u * pillarPts.length * 1.2));
          while (pillarsStarted < wantPillars) {
            spawnFlamePillar(pillarPts[pillarsStarted], 1.1 + pillarsStarted * 0.08, 0.55 * tierMul, null);
            pillarsStarted++;
          }
          var wantTick = Math.min(hitTicks, 1 + Math.floor(u * hitTicks));
          while (ticksFired < wantTick) {
            ticksFired++;
            if (opts.onHitTick) {
              try { opts.onHitTick(ticksFired, hitTicks); } catch (eT) { /* */ }
            }
            if (ticksFired > 1) cameraPunch(0.06);
          }
        },
        done: function () {
          rings.forEach(disposeMesh);
          spawnResidual(center, col, 'ember_ground');
          // Extra ground fire residual
          spawnFlamePillar(center, 0.7, 0.4, function () {
            if (opts.onDone) opts.onDone();
          });
        }
      });
      return true;
    }

    /** Bolt — multi-fork lightning + Phase C chain jumps to secondary foes */
    function runBoltFx(opts, col, from, to, tierMul, spawnResidual) {
      spawnPaintedFx('lightning_bolt', to, {
        scale: 2.4, grow: 1.5, dur: 0.4 * tierMul, additive: true,
        aspectW: 0.65, aspectH: 1.55, yOff: 0.35, opacity: 0.95
      });
      var forks = [];
      var nFork = 3;
      var fi;
      for (fi = 0; fi < nFork; fi++) {
        var jitter = new THREE.Vector3(
          (Math.random() - 0.5) * 0.45,
          (Math.random() - 0.5) * 0.35,
          (Math.random() - 0.5) * 0.45
        );
        var tip = to.clone().add(jitter);
        var mid = from.clone().lerp(tip, 0.5);
        var dist = from.distanceTo(tip) || 1;
        var beam = new THREE.Mesh(
          new THREE.CylinderGeometry(fi === 0 ? 0.07 : 0.035, fi === 0 ? 0.04 : 0.02, dist, 6, 1, true),
          new THREE.MeshBasicMaterial({
            color: fi === 0 ? 0xffffff : col, transparent: true, opacity: 0.95,
            depthWrite: false, fog: false
          })
        );
        beam.position.copy(mid);
        beam.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          tip.clone().sub(from).normalize()
        );
        scene.add(beam);
        forks.push(beam);
      }
      // Flash sphere at impact
      var flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 10, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, fog: false
        })
      );
      flash.position.copy(to);
      scene.add(flash);

      // Phase C: chain arcs primary → secondary targets (visual, optional)
      var chainBeams = [];
      var chainIds = opts.chainToIds || [];
      var ci;
      for (ci = 0; ci < Math.min(3, chainIds.length); ci++) {
        var cFig = figures[chainIds[ci]];
        if (!cFig || cFig.dead) continue;
        var cTo = figChest(cFig);
        var cMid = to.clone().lerp(cTo, 0.5);
        var cDist = to.distanceTo(cTo) || 1;
        var cBeam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.02, cDist, 5, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0xaaddff, transparent: true, opacity: 0, depthWrite: false, fog: false
          })
        );
        cBeam.position.copy(cMid);
        cBeam.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          cTo.clone().sub(to).normalize()
        );
        cBeam.userData.delay = 0.35 + ci * 0.12;
        scene.add(cBeam);
        chainBeams.push({ mesh: cBeam, targetId: chainIds[ci] });
      }

      anims.push({
        t: 0,
        dur: (0.32 + chainBeams.length * 0.12) * tierMul,
        update: function (u) {
          var pulse = u < 0.25 ? u * 4 : (1 - u) * 1.3;
          var i;
          for (i = 0; i < forks.length; i++) {
            if (forks[i].material) forks[i].material.opacity = Math.min(1, pulse * (i === 0 ? 1 : 0.7));
            forks[i].scale.x = forks[i].scale.z = 0.5 + Math.sin(u * Math.PI * 3 + i) * 0.5;
          }
          flash.scale.setScalar(1 + u * 3.5);
          if (flash.material) flash.material.opacity = 0.95 * (1 - u);
          // Chain fade-in after primary flash
          chainBeams.forEach(function (cb, idx) {
            var local = (u - 0.28 - idx * 0.08) / 0.35;
            if (local < 0) {
              if (cb.mesh.material) cb.mesh.material.opacity = 0;
              return;
            }
            local = Math.min(1, Math.max(0, local));
            if (cb.mesh.material) {
              cb.mesh.material.opacity = 0.9 * (local < 0.5 ? local * 2 : (1 - local) * 2);
            }
            cb.mesh.scale.x = cb.mesh.scale.z = 0.5 + Math.sin(local * Math.PI) * 0.6;
          });
        },
        done: function () {
          forks.forEach(disposeMesh);
          disposeMesh(flash);
          chainBeams.forEach(function (cb) {
            disposeMesh(cb.mesh);
            // Small spark at chain target
            if (cb.targetId) impactBurst(cb.targetId, opts.element || 'Lightning', false);
          });
          spawnResidual(to, col, 'crackles');
          if (opts.onDone) opts.onDone();
        }
      });
      return true;
    }

    /** Blaze — painted fire comet + impact plate, with procedural flame support */
    function runBlazeFx(opts, col, from, to, tierMul, spawnResidual) {
      if (opts.crit) cameraPunch(0.12);
      var isBasic = opts.fxTier === 'basic';
      var scale = isBasic ? 0.72 : 1;
      var usePaint = !!(paintedFxCache.fire_comet && paintedFxCache.fire_comet !== false);
      var paintedComet = null;
      var followPos = from.clone();
      if (usePaint) {
        paintedComet = spawnPaintedFx('fire_comet', from, {
          scale: isBasic ? 1.35 : 1.85,
          aspectW: 2.4,
          aspectH: 0.85,
          grow: 1.05,
          dur: (isBasic ? 0.34 : 0.44) * tierMul,
          opacity: 1,
          additive: true,
          follow: followPos,
          yOff: 0.05
        });
      }
      // Layered comet geometry (fallback / dual-layer glow under paint)
      var outer = new THREE.Mesh(
        new THREE.ConeGeometry(0.28 * scale, 0.9 * scale, 10),
        new THREE.MeshBasicMaterial({
          color: 0xff3300, transparent: true, opacity: usePaint ? 0.25 : 0.75, depthWrite: false, fog: false
        })
      );
      var mid = new THREE.Mesh(
        new THREE.ConeGeometry(0.18 * scale, 0.7 * scale, 8),
        new THREE.MeshBasicMaterial({
          color: 0xff8822, transparent: true, opacity: usePaint ? 0.35 : 0.95, depthWrite: false, fog: false
        })
      );
      var core = new THREE.Mesh(
        new THREE.SphereGeometry(0.14 * scale, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xfff6cc, transparent: true, opacity: usePaint ? 0.5 : 1, depthWrite: false, fog: false
        })
      );
      var glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.32 * scale, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xff6622, transparent: true, opacity: usePaint ? 0.2 : 0.4, depthWrite: false, fog: false
        })
      );
      [outer, mid, core, glow].forEach(function (m) {
        m.position.copy(from);
        scene.add(m);
      });
      var trails = [];
      var flameColors = [0xfff0aa, 0xffcc44, 0xff7722, 0xff4400, 0xee2200];
      anims.push({
        t: 0,
        dur: (isBasic ? 0.32 : 0.42) * tierMul,
        update: function (u) {
          var ease = u * u * (3 - 2 * u);
          var pos = new THREE.Vector3().lerpVectors(from, to, ease);
          pos.y += Math.sin(ease * Math.PI) * (isBasic ? 0.45 : 0.75);
          followPos.copy(pos);
          outer.position.copy(pos);
          mid.position.copy(pos);
          core.position.copy(pos);
          glow.position.copy(pos);
          try {
            outer.lookAt(to); outer.rotateX(Math.PI / 2);
            mid.lookAt(to); mid.rotateX(Math.PI / 2);
          } catch (eL) { /* */ }
          outer.scale.setScalar(0.9 + Math.sin(u * 20) * 0.12);
          mid.scale.setScalar(1 + Math.sin(u * 24) * 0.1);
          glow.scale.setScalar(1 + Math.sin(u * 16) * 0.2);
          // Dense ember trail (lighter when paint present)
          if (!usePaint || (Math.floor(u * 20) % 2) === 0) {
            var nSpawn = usePaint ? 1 : (isBasic ? 2 : 3);
            var si;
            for (si = 0; si < nSpawn; si++) {
              var fc = flameColors[(Math.random() * flameColors.length) | 0];
              var em = new THREE.Mesh(
                new THREE.ConeGeometry(0.05 + Math.random() * 0.04, 0.12 + Math.random() * 0.1, 5),
                new THREE.MeshBasicMaterial({
                  color: fc, transparent: true, opacity: 0.9, depthWrite: false, fog: false
                })
              );
              em.position.copy(pos);
              em.position.x += (Math.random() - 0.5) * 0.2;
              em.position.z += (Math.random() - 0.5) * 0.2;
              em.userData.vy = 0.8 + Math.random() * 1.4;
              em.userData.age = 0;
              scene.add(em);
              trails.push(em);
            }
          }
          var ti;
          for (ti = trails.length - 1; ti >= 0; ti--) {
            var tr = trails[ti];
            tr.userData.age += 0.08;
            tr.position.y += tr.userData.vy * 0.06;
            tr.scale.y = 1 + tr.userData.age * 0.8;
            if (tr.material) tr.material.opacity = Math.max(0, 0.9 * (1 - tr.userData.age));
            if (tr.userData.age > 1) {
              disposeMesh(tr);
              trails.splice(ti, 1);
            }
          }
        },
        done: function () {
          disposeMesh(outer);
          disposeMesh(mid);
          disposeMesh(core);
          disposeMesh(glow);
          trails.forEach(disposeMesh);
          // Painted fire impact bloom (hero read)
          spawnPaintedFx('fire_impact', to, {
            scale: isBasic ? 2.0 : 2.6,
            grow: 2.1,
            dur: 0.55 * tierMul,
            additive: true,
            yOff: 0.15
          });
          // Impact: scorch ring + flame pillar support
          var scorch = new THREE.Mesh(
            new THREE.RingGeometry(0.12, 0.95, 32),
            new THREE.MeshBasicMaterial({
              color: 0x662200, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
              depthWrite: false, fog: false
            })
          );
          scorch.rotation.x = -Math.PI / 2;
          scorch.position.set(to.x, 0.07, to.z);
          scene.add(scorch);
          var flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 12, 10),
            new THREE.MeshBasicMaterial({
              color: 0xffeebb, transparent: true, opacity: 0.95, depthWrite: false, fog: false
            })
          );
          flash.position.copy(to);
          scene.add(flash);
          anims.push({
            t: 0, dur: 0.28 * tierMul,
            update: function (u) {
              scorch.scale.setScalar(1 + u * 2.2);
              if (scorch.material) scorch.material.opacity = 0.8 * (1 - u);
              flash.scale.setScalar(1 + u * 3.5);
              if (flash.material) flash.material.opacity = 0.95 * (1 - u);
            },
            done: function () {
              disposeMesh(scorch);
              disposeMesh(flash);
              spawnFlamePillar(to, isBasic ? 0.85 : 1.25, 0.5 * tierMul, function () {
                spawnResidual(to, col, 'embers');
                if (opts.onDone) opts.onDone();
              });
            }
          });
        }
      });
      return true;
    }

    /** Splash — expanding water crown + multi-ripple AOE */
    function runSplashFx(opts, col, from, to, tierMul, spawnResidual) {
      var center = to && to.distanceTo(from) > 0.01 ? to : from;
      // Prefer caster for AOE splash telegraph then expand
      center = from.clone();
      spawnPaintedFx('water_splash', center, {
        scale: 2.4, grow: 1.9, dur: 0.6 * tierMul, yOff: 0.35, opacity: 0.95
      });
      var crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.08, 8, 20),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.9, depthWrite: false, fog: false
        })
      );
      crown.position.set(center.x, 0.35, center.z);
      scene.add(crown);
      var ripples = [];
      var ri;
      for (ri = 0; ri < 3; ri++) {
        var r = new THREE.Mesh(
          new THREE.RingGeometry(0.15, 0.35 + ri * 0.15, 32),
          new THREE.MeshBasicMaterial({
            color: ri === 0 ? 0xffffff : col, transparent: true, opacity: 0.8,
            side: THREE.DoubleSide, depthWrite: false, fog: false
          })
        );
        r.rotation.x = -Math.PI / 2;
        r.position.set(center.x, 0.1 + ri * 0.02, center.z);
        scene.add(r);
        ripples.push(r);
      }
      // Droplets up
      var drops = [];
      for (ri = 0; ri < 8; ri++) {
        var d = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 6, 5),
          new THREE.MeshBasicMaterial({
            color: col, transparent: true, opacity: 0.9, depthWrite: false, fog: false
          })
        );
        var ang = (ri / 8) * Math.PI * 2;
        d.position.set(center.x, 0.3, center.z);
        d.userData.vx = Math.cos(ang) * 1.2;
        d.userData.vz = Math.sin(ang) * 1.2;
        d.userData.vy = 1.5 + Math.random() * 0.5;
        scene.add(d);
        drops.push(d);
      }
      anims.push({
        t: 0,
        dur: 0.55 * tierMul,
        update: function (u) {
          crown.position.y = 0.35 + u * 0.8;
          crown.scale.setScalar(1 + u * 2.5);
          if (crown.material) crown.material.opacity = 0.9 * (1 - u);
          var i;
          for (i = 0; i < ripples.length; i++) {
            var lu = Math.max(0, (u - i * 0.08) / 0.85);
            ripples[i].scale.setScalar(1 + lu * (3.5 + i));
            if (ripples[i].material) ripples[i].material.opacity = 0.8 * (1 - lu);
          }
          for (i = 0; i < drops.length; i++) {
            var dd = drops[i];
            dd.position.x = center.x + dd.userData.vx * u;
            dd.position.z = center.z + dd.userData.vz * u;
            dd.position.y = 0.3 + dd.userData.vy * u - u * u * 2.2;
            if (dd.material) dd.material.opacity = 0.9 * (1 - u);
          }
        },
        done: function () {
          disposeMesh(crown);
          ripples.forEach(disposeMesh);
          drops.forEach(disposeMesh);
          spawnResidual(center, col, 'puddle');
          if (opts.onDone) opts.onDone();
        }
      });
      return true;
    }

    /** Venom — slow glob + cling cloud on target */
    function runVenomFx(opts, col, from, to, tierMul, spawnResidual) {
      var glob = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0x66aa22, transparent: true, opacity: 0.88, depthWrite: false, fog: false
        })
      );
      glob.position.copy(from);
      scene.add(glob);
      var drip = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.22, 6),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.8, depthWrite: false, fog: false
        })
      );
      drip.position.copy(from);
      scene.add(drip);
      anims.push({
        t: 0,
        dur: 0.48 * tierMul,
        update: function (u) {
          var ease = u * u * (3 - 2 * u);
          glob.position.lerpVectors(from, to, ease);
          glob.position.y += Math.sin(ease * Math.PI) * 0.3;
          glob.scale.setScalar(1 + Math.sin(u * Math.PI * 4) * 0.12);
          drip.position.copy(glob.position);
          drip.position.y -= 0.15;
        },
        done: function () {
          disposeMesh(glob);
          disposeMesh(drip);
          spawnPaintedFx('poison_cloud', to, {
            scale: 2.2, grow: 1.7, dur: 0.65 * tierMul, yOff: 0.2, opacity: 0.95
          });
          // Cling cloud
          var cloud = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 12, 10),
            new THREE.MeshBasicMaterial({
              color: 0x558822, transparent: true, opacity: 0.65, depthWrite: false, fog: false
            })
          );
          cloud.position.copy(to);
          scene.add(cloud);
          var fumes = [];
          var fi;
          for (fi = 0; fi < 6; fi++) {
            var f = new THREE.Mesh(
              new THREE.SphereGeometry(0.1, 6, 5),
              new THREE.MeshBasicMaterial({
                color: col, transparent: true, opacity: 0.7, depthWrite: false, fog: false
              })
            );
            f.position.copy(to);
            f.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8);
            scene.add(f);
            fumes.push(f);
          }
          anims.push({
            t: 0, dur: 0.5 * tierMul,
            update: function (u) {
              cloud.scale.setScalar(1 + u * 1.8);
              if (cloud.material) cloud.material.opacity = 0.65 * (1 - u);
              fumes.forEach(function (f) {
                f.position.x = to.x + f.userData.v.x * u;
                f.position.y = to.y + f.userData.v.y * u;
                f.position.z = to.z + f.userData.v.z * u;
                if (f.material) f.material.opacity = 0.7 * (1 - u);
              });
            },
            done: function () {
              disposeMesh(cloud);
              fumes.forEach(disposeMesh);
              spawnResidual(to, col, 'fumes');
              if (opts.onDone) opts.onDone();
            }
          });
        }
      });
      return true;
    }

    /** Crush / quake — multi-hit slam (primary + aftershock) + dust */
    function runCrushFx(opts, col, from, to, tierMul, spawnResidual) {
      if (opts.crit) cameraPunch(0.1);
      var fist = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.28, 0),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.95, depthWrite: false, fog: false
        })
      );
      fist.position.set(from.x, from.y + 1.2, from.z);
      scene.add(fist);
      var target = to.clone();
      var multiHit = opts.multiHit != null ? opts.multiHit : 2;

      function spawnShock(scaleMul, onEnd) {
        var shock = new THREE.Mesh(
          new THREE.RingGeometry(0.2, 1.1 * scaleMul, 36),
          new THREE.MeshBasicMaterial({
            color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
            depthWrite: false, fog: false
          })
        );
        shock.rotation.x = -Math.PI / 2;
        shock.position.set(target.x, 0.1, target.z);
        scene.add(shock);
        var dust = [];
        var di;
        for (di = 0; di < 7; di++) {
          var du = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.06, 0),
            new THREE.MeshBasicMaterial({
              color: 0x887766, transparent: true, opacity: 0.85, depthWrite: false, fog: false
            })
          );
          var ang = (di / 7) * Math.PI * 2;
          du.position.set(target.x, 0.15, target.z);
          du.userData.v = new THREE.Vector3(Math.cos(ang) * 1.5 * scaleMul, 0.6 + Math.random() * 0.5, Math.sin(ang) * 1.5 * scaleMul);
          scene.add(du);
          dust.push(du);
        }
        anims.push({
          t: 0, dur: 0.38 * tierMul,
          update: function (u) {
            shock.scale.setScalar(1 + u * 3.5);
            if (shock.material) shock.material.opacity = 0.9 * (1 - u);
            dust.forEach(function (du) {
              du.position.x = target.x + du.userData.v.x * u;
              du.position.y = 0.15 + du.userData.v.y * u - u * u * 1.5;
              du.position.z = target.z + du.userData.v.z * u;
              if (du.material) du.material.opacity = 0.85 * (1 - u);
            });
          },
          done: function () {
            disposeMesh(shock);
            dust.forEach(disposeMesh);
            if (onEnd) onEnd();
          }
        });
      }

      anims.push({
        t: 0,
        dur: 0.36 * tierMul,
        update: function (u) {
          // Rise then slam
          if (u < 0.35) {
            fist.position.y = from.y + 1.2 + u * 0.8;
            fist.position.x = from.x;
            fist.position.z = from.z;
          } else {
            var s = (u - 0.35) / 0.65;
            fist.position.lerpVectors(
              new THREE.Vector3(from.x, from.y + 1.5, from.z),
              new THREE.Vector3(target.x, 0.25, target.z),
              s * s
            );
          }
          fist.rotation.x += 0.15;
          fist.rotation.z += 0.1;
        },
        done: function () {
          disposeMesh(fist);
          if (opts.onHitTick) {
            try { opts.onHitTick(1, multiHit); } catch (e1) { /* */ }
          }
          // Primary shock
          spawnShock(1, function () {
            if (multiHit < 2) {
              spawnResidual(target, col, 'rubble');
              if (opts.onDone) opts.onDone();
              return;
            }
            // Aftershock second hit
            cameraPunch(0.06);
            if (opts.onHitTick) {
              try { opts.onHitTick(2, multiHit); } catch (e2) { /* */ }
            }
            spawnShock(1.25, function () {
              spawnResidual(target, col, 'rubble');
              if (opts.onDone) opts.onDone();
            });
          });
        }
      });
      return true;
    }

    /** Ice shard projectile + shatter star */
    function runIceFx(opts, col, from, to, tierMul, spawnResidual) {
      var shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22, 0),
        new THREE.MeshBasicMaterial({
          color: 0xaaddff, transparent: true, opacity: 0.95, depthWrite: false, fog: false
        })
      );
      shard.position.copy(from);
      scene.add(shard);
      anims.push({
        t: 0,
        dur: 0.34 * tierMul,
        update: function (u) {
          var ease = u * u * (3 - 2 * u);
          shard.position.lerpVectors(from, to, ease);
          shard.rotation.x += 0.25;
          shard.rotation.y += 0.2;
        },
        done: function () {
          disposeMesh(shard);
          spawnPaintedFx('ice_shatter', to, {
            scale: 2.3, grow: 2.0, dur: 0.55 * tierMul, additive: true, yOff: 0.15
          });
          var star = [];
          var si;
          for (si = 0; si < 6; si++) {
            var sh = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.1, 0),
              new THREE.MeshBasicMaterial({
                color: col, transparent: true, opacity: 0.95, depthWrite: false, fog: false
              })
            );
            sh.position.copy(to);
            var ang = (si / 6) * Math.PI * 2;
            sh.userData.v = new THREE.Vector3(Math.cos(ang) * 2, 0.8 + Math.random(), Math.sin(ang) * 2);
            scene.add(sh);
            star.push(sh);
          }
          var flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 10, 8),
            new THREE.MeshBasicMaterial({
              color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, fog: false
            })
          );
          flash.position.copy(to);
          scene.add(flash);
          anims.push({
            t: 0, dur: 0.35 * tierMul,
            update: function (u) {
              star.forEach(function (sh) {
                sh.position.x = to.x + sh.userData.v.x * u;
                sh.position.y = to.y + sh.userData.v.y * u;
                sh.position.z = to.z + sh.userData.v.z * u;
                sh.rotation.x += 0.2;
                if (sh.material) sh.material.opacity = 0.95 * (1 - u);
              });
              flash.scale.setScalar(1 + u * 2.5);
              if (flash.material) flash.material.opacity = 0.9 * (1 - u);
            },
            done: function () {
              star.forEach(disposeMesh);
              disposeMesh(flash);
              spawnResidual(to, col, 'frost');
              if (opts.onDone) opts.onDone();
            }
          });
        }
      });
      return true;
    }

    function runMendOrShieldFx(opts, delivery, col, from, to, skillId, impactId, tierMul, spawnResidual) {
      var isShield = delivery === 'buff' || impactId === 'lattice' ||
        skillId.indexOf('shield') >= 0 || skillId.indexOf('guard') >= 0 ||
        skillId.indexOf('veil') >= 0 || skillId.indexOf('shell') >= 0;
      var target = (to && to.distanceTo && from.distanceTo(to) > 0.05) ? to : from;
      if (isShield) {
        spawnPaintedFx('buff_ward', target, {
          scale: 2.0, grow: 1.6, dur: 0.7 * tierMul, yOff: 0.2, opacity: 0.95, additive: true
        });
        // Multi-layer lattice ward — dome + hex rings + sparkles
        var dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 16, 12),
          new THREE.MeshBasicMaterial({
            color: col, transparent: true, opacity: 0.4, depthWrite: false, fog: false,
            wireframe: true
          })
        );
        dome.position.copy(target);
        scene.add(dome);
        var dome2 = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 12, 10),
          new THREE.MeshBasicMaterial({
            color: 0xaaffee, transparent: true, opacity: 0.35, depthWrite: false, fog: false
          })
        );
        dome2.position.copy(target);
        scene.add(dome2);
        var rings = [];
        var ri;
        for (ri = 0; ri < 3; ri++) {
          var ring = new THREE.Mesh(
            new THREE.RingGeometry(0.3 + ri * 0.12, 0.45 + ri * 0.12, 6 + ri * 2),
            new THREE.MeshBasicMaterial({
              color: ri === 0 ? 0xffffff : col, transparent: true, opacity: 0.85,
              side: THREE.DoubleSide, depthWrite: false, fog: false
            })
          );
          ring.rotation.x = -Math.PI / 2 + ri * 0.15;
          ring.position.set(target.x, 0.12 + ri * 0.08, target.z);
          scene.add(ring);
          rings.push(ring);
        }
        var sparks = [];
        for (ri = 0; ri < 10; ri++) {
          var sp = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.06, 0),
            new THREE.MeshBasicMaterial({
              color: 0xccffff, transparent: true, opacity: 0.9, depthWrite: false, fog: false
            })
          );
          var ang = (ri / 10) * Math.PI * 2;
          sp.position.set(target.x + Math.cos(ang) * 0.5, target.y, target.z + Math.sin(ang) * 0.5);
          sp.userData.ang = ang;
          scene.add(sp);
          sparks.push(sp);
        }
        anims.push({
          t: 0, dur: 0.62 * tierMul,
          update: function (u) {
            dome.scale.setScalar(0.5 + u * 1.3);
            dome.rotation.y = u * Math.PI * 1.5;
            if (dome.material) dome.material.opacity = 0.45 * (1 - u * 0.55);
            dome2.scale.setScalar(0.7 + u * 0.9);
            if (dome2.material) dome2.material.opacity = 0.4 * (1 - u);
            rings.forEach(function (ring, i) {
              ring.scale.setScalar(1 + u * (1.2 + i * 0.3));
              ring.rotation.z = u * (1 + i * 0.5);
              if (ring.material) ring.material.opacity = 0.85 * (1 - u);
            });
            sparks.forEach(function (sp) {
              sp.position.y = target.y + Math.sin(u * Math.PI * 2 + sp.userData.ang) * 0.4 + u * 0.5;
              sp.position.x = target.x + Math.cos(sp.userData.ang + u * 3) * (0.5 + u * 0.3);
              sp.position.z = target.z + Math.sin(sp.userData.ang + u * 3) * (0.5 + u * 0.3);
              if (sp.material) sp.material.opacity = 0.9 * (1 - u);
            });
          },
          done: function () {
            disposeMesh(dome);
            disposeMesh(dome2);
            rings.forEach(disposeMesh);
            sparks.forEach(disposeMesh);
            if (opts.onDone) opts.onDone();
          }
        });
        return true;
      }
      // Mend — painted heal bloom + rising orbs
      var healCol = new THREE.Color(0x66ffaa);
      var hi;
      var healCount = opts.fxTier === 'signature' ? 14 : 10;
      var at = target;
      spawnPaintedFx('heal_bloom', at, {
        scale: 2.1, grow: 1.7, dur: 0.7 * tierMul, yOff: 0.25, opacity: 0.95, additive: true
      });
      // Soft pulse shell
      var pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 14, 12),
        new THREE.MeshBasicMaterial({
          color: healCol, transparent: true, opacity: 0.5, depthWrite: false, fog: false
        })
      );
      pulse.position.copy(at);
      scene.add(pulse);
      for (hi = 0; hi < healCount; hi++) {
        (function (idx) {
          var orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.09 + Math.random() * 0.04, 8, 6),
            new THREE.MeshBasicMaterial({
              color: idx % 2 ? 0xaaffcc : healCol, transparent: true, opacity: 0.95,
              depthWrite: false, fog: false
            })
          );
          var ang = (idx / healCount) * Math.PI * 2;
          orb.position.set(
            at.x + Math.cos(ang) * 0.35,
            at.y - 0.1,
            at.z + Math.sin(ang) * 0.35
          );
          scene.add(orb);
          anims.push({
            t: 0,
            dur: (0.55 + idx * 0.025) * tierMul,
            update: function (u) {
              orb.position.y = at.y - 0.1 + u * 1.6;
              orb.position.x = at.x + Math.cos(ang + u * 2) * (0.35 * (1 - u * 0.4));
              orb.position.z = at.z + Math.sin(ang + u * 2) * (0.35 * (1 - u * 0.4));
              if (orb.material) orb.material.opacity = 0.95 * (1 - u);
              orb.scale.setScalar(1 + u * 1.1);
            },
            done: function () { disposeMesh(orb); }
          });
        })(hi);
      }
      // Soft rain
      var rain = [];
      for (hi = 0; hi < 16; hi++) {
        var drop = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 5, 4),
          new THREE.MeshBasicMaterial({
            color: healCol, transparent: true, opacity: 0.85, depthWrite: false, fog: false
          })
        );
        drop.position.set(
          at.x + (Math.random() - 0.5) * 1.1,
          at.y + 1.4 + Math.random() * 0.4,
          at.z + (Math.random() - 0.5) * 1.1
        );
        drop.userData.vy = 0.9 + Math.random() * 0.5;
        scene.add(drop);
        rain.push(drop);
      }
      // Ground heal ring
      var hRing = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.7, 28),
        new THREE.MeshBasicMaterial({
          color: healCol, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
          depthWrite: false, fog: false
        })
      );
      hRing.rotation.x = -Math.PI / 2;
      hRing.position.set(at.x, 0.08, at.z);
      scene.add(hRing);
      anims.push({
        t: 0, dur: 0.65 * tierMul,
        update: function (u) {
          pulse.scale.setScalar(1 + u * 2.2);
          if (pulse.material) pulse.material.opacity = 0.5 * (1 - u);
          hRing.scale.setScalar(1 + u * 2);
          if (hRing.material) hRing.material.opacity = 0.7 * (1 - u);
          rain.forEach(function (d) {
            d.position.y -= d.userData.vy * 0.05;
            if (d.material) d.material.opacity = 0.85 * (1 - u);
          });
        },
        done: function () {
          disposeMesh(pulse);
          disposeMesh(hRing);
          rain.forEach(disposeMesh);
          spawnResidual(at, healCol, 'soft_glow');
          if (opts.onDone) opts.onDone();
        }
      });
      return true;
    }

    function runGenericAoeFx(opts, col, from, to, impactId, tierMul, spawnResidual) {
      var el = elKey(opts.element || '');
      // Fire/lava AOE → inferno-lite pillars
      if (el === 'fire' || el === 'lava') {
        return runInfernoFx(opts, col, from, to, tierMul * 0.85, spawnResidual);
      }
      var rings = [];
      var ri;
      for (ri = 0; ri < 3; ri++) {
        var aoe = new THREE.Mesh(
          new THREE.RingGeometry(0.2 + ri * 0.1, 1.1 + ri * 0.2, 40),
          new THREE.MeshBasicMaterial({
            color: ri === 0 ? 0xffffff : col, transparent: true, opacity: 0.85 - ri * 0.1,
            side: THREE.DoubleSide, depthWrite: false, fog: false
          })
        );
        aoe.rotation.x = -Math.PI / 2;
        aoe.position.set(from.x, 0.1 + ri * 0.03, from.z);
        aoe.userData.delay = ri * 0.07;
        scene.add(aoe);
        rings.push(aoe);
      }
      // Vertical burst columns
      var cols = [];
      for (ri = 0; ri < 6; ri++) {
        var ang = (ri / 6) * Math.PI * 2;
        var colm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.14, 0.3, 6, 1, true),
          new THREE.MeshBasicMaterial({
            color: col, transparent: true, opacity: 0.75, depthWrite: false, fog: false,
            side: THREE.DoubleSide
          })
        );
        colm.position.set(from.x + Math.cos(ang) * 0.5, 0.25, from.z + Math.sin(ang) * 0.5);
        scene.add(colm);
        cols.push(colm);
      }
      var shockBits = [];
      for (ri = 0; ri < 12; ri++) {
        var bit = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 6, 5),
          new THREE.MeshBasicMaterial({
            color: col, transparent: true, opacity: 0.9, depthWrite: false, fog: false
          })
        );
        bit.position.copy(from);
        var a2 = (ri / 12) * Math.PI * 2;
        bit.userData.v = new THREE.Vector3(Math.cos(a2) * 2.2, 0.8 + Math.random(), Math.sin(a2) * 2.2);
        scene.add(bit);
        shockBits.push(bit);
      }
      anims.push({
        t: 0,
        dur: 0.55 * tierMul,
        update: function (u) {
          rings.forEach(function (aoe) {
            var lu = Math.max(0, Math.min(1, (u - aoe.userData.delay) / 0.8));
            aoe.scale.setScalar(1 + lu * 4.5 * (opts.fxTier === 'signature' ? 1.25 : 1));
            if (aoe.material) aoe.material.opacity = 0.8 * (1 - lu);
          });
          cols.forEach(function (c) {
            c.position.y = 0.25 + u * 1.8;
            c.scale.y = 1 + u * 4;
            if (c.material) c.material.opacity = 0.75 * (1 - u);
          });
          shockBits.forEach(function (b) {
            b.position.x = from.x + b.userData.v.x * u;
            b.position.y = from.y + b.userData.v.y * u - u * u * 1.5;
            b.position.z = from.z + b.userData.v.z * u;
            if (b.material) b.material.opacity = 0.9 * (1 - u);
          });
        },
        done: function () {
          rings.forEach(disposeMesh);
          cols.forEach(disposeMesh);
          shockBits.forEach(disposeMesh);
          spawnResidual(from, col);
          if (opts.onDone) opts.onDone();
        }
      });
      return true;
    }

    function runGenericMeleeFx(opts, col, from, to, impactId, tierMul, spawnResidual) {
      // Dual slash arcs + impact sparks
      var slash = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.28),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
          depthWrite: false, fog: false
        })
      );
      var slash2 = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.18),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
          depthWrite: false, fog: false
        })
      );
      slash.position.copy(from).lerp(to, 0.4);
      slash.position.y += 0.25;
      slash.lookAt(to);
      slash2.position.copy(from).lerp(to, 0.5);
      slash2.position.y += 0.1;
      slash2.lookAt(to);
      slash2.rotateZ(0.4);
      scene.add(slash);
      scene.add(slash2);
      anims.push({
        t: 0,
        dur: 0.26 * tierMul,
        update: function (u) {
          slash.scale.set(1 + u * 1.1, 1, 1);
          slash2.scale.set(1 + u * 0.9, 1, 1);
          slash.position.lerpVectors(from, to, 0.25 + u * 0.55);
          slash2.position.lerpVectors(from, to, 0.35 + u * 0.5);
          if (slash.material) slash.material.opacity = 0.9 * (1 - u);
          if (slash2.material) slash2.material.opacity = 0.75 * (1 - u);
        },
        done: function () {
          disposeMesh(slash);
          disposeMesh(slash2);
          // Impact spark burst
          var sparks = [];
          var si;
          for (si = 0; si < 10; si++) {
            var sp = new THREE.Mesh(
              new THREE.SphereGeometry(0.05, 5, 4),
              new THREE.MeshBasicMaterial({
                color: si % 2 ? 0xffffff : col, transparent: true, opacity: 0.95,
                depthWrite: false, fog: false
              })
            );
            sp.position.copy(to);
            var ang = (si / 10) * Math.PI * 2;
            sp.userData.v = new THREE.Vector3(Math.cos(ang) * 1.8, 0.6 + Math.random(), Math.sin(ang) * 1.8);
            scene.add(sp);
            sparks.push(sp);
          }
          anims.push({
            t: 0, dur: 0.28 * tierMul,
            update: function (u) {
              sparks.forEach(function (sp) {
                sp.position.x = to.x + sp.userData.v.x * u;
                sp.position.y = to.y + sp.userData.v.y * u;
                sp.position.z = to.z + sp.userData.v.z * u;
                if (sp.material) sp.material.opacity = 0.95 * (1 - u);
              });
            },
            done: function () {
              sparks.forEach(disposeMesh);
              spawnResidual(to, col);
              if (opts.onDone) opts.onDone();
            }
          });
        }
      });
      return true;
    }

    function runGenericBeamFx(opts, col, from, to, impactId, tierMul, spawnResidual) {
      var mid = from.clone().lerp(to, 0.5);
      var dist = from.distanceTo(to) || 1;
      // Outer glow beam + core
      var beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.07, dist, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.55, depthWrite: false, fog: false
        })
      );
      var core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.03, dist, 6, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, fog: false
        })
      );
      var dir = to.clone().sub(from).normalize();
      [beam, core].forEach(function (b) {
        b.position.copy(mid);
        b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        scene.add(b);
      });
      var tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, fog: false
        })
      );
      tip.position.copy(to);
      scene.add(tip);
      anims.push({
        t: 0,
        dur: 0.34 * tierMul,
        update: function (u) {
          var pulse = u < 0.3 ? u / 0.3 : (1 - u) * 1.2;
          if (beam.material) beam.material.opacity = 0.6 * Math.min(1, pulse);
          if (core.material) core.material.opacity = 0.95 * Math.min(1, pulse);
          beam.scale.x = beam.scale.z = 0.7 + Math.sin(u * Math.PI * 4) * 0.5;
          core.scale.x = core.scale.z = 0.5 + Math.sin(u * Math.PI * 5) * 0.6;
          tip.scale.setScalar(1 + u * 2.5);
          if (tip.material) tip.material.opacity = 0.95 * (1 - u);
        },
        done: function () {
          disposeMesh(beam);
          disposeMesh(core);
          disposeMesh(tip);
          spawnResidual(to, col);
          if (opts.onDone) opts.onDone();
        }
      });
      return true;
    }

    function runGenericProjectileFx(opts, delivery, col, from, to, travelId, tierMul, spawnResidual) {
      var isCloud = delivery === 'cloud';
      var ball = makeSkillProjectileMesh(opts.element, isCloud);
      // Slightly larger cores so projectiles read at combat distance
      ball.scale.setScalar(isCloud ? 1.15 : 1.25);
      ball.position.copy(from);
      scene.add(ball);
      var coreBall = new THREE.Mesh(
        new THREE.SphereGeometry(isCloud ? 0.14 : 0.1, 10, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, fog: false
        })
      );
      coreBall.position.copy(from);
      scene.add(coreBall);
      // Soft glow shell for readable travel
      var glowShell = new THREE.Mesh(
        new THREE.SphereGeometry(isCloud ? 0.28 : 0.2, 10, 8),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.35, depthWrite: false, fog: false
        })
      );
      glowShell.position.copy(from);
      scene.add(glowShell);
      var trails = [];
      var dur = (isCloud ? 0.48 : 0.32) * tierMul;
      // All tiers get trails on med/high — basics thinner
      var doTrails = Q.worldFx;
      var trailEvery = opts.fxTier === 'basic' ? 3 : 2;
      if (opts.crit) cameraPunch(0.1);
      anims.push({
        t: 0,
        dur: dur,
        update: function (u) {
          var ease = u * u * (3 - 2 * u);
          ball.position.lerpVectors(from, to, ease);
          ball.position.y += Math.sin(ease * Math.PI) * (isCloud ? 0.35 : 0.55);
          if (ball.lookAt) {
            try { ball.lookAt(to); } catch (eLook) { /* ignore */ }
          }
          ball.rotation.z += 0.18;
          coreBall.position.copy(ball.position);
          glowShell.position.copy(ball.position);
          glowShell.scale.setScalar(1 + Math.sin(u * Math.PI) * 0.35);
          if (doTrails && (Math.floor(u * 28) % trailEvery === 0)) {
            var tr = new THREE.Mesh(
              new THREE.SphereGeometry(isCloud ? 0.15 : 0.1, 6, 5),
              new THREE.MeshBasicMaterial({
                color: col, transparent: true, opacity: 0.7, depthWrite: false, fog: false
              })
            );
            tr.position.copy(ball.position);
            scene.add(tr);
            trails.push({ mesh: tr, age: 0 });
          }
          var ti;
          for (ti = trails.length - 1; ti >= 0; ti--) {
            trails[ti].age += 0.07;
            if (trails[ti].mesh.material) {
              trails[ti].mesh.material.opacity = Math.max(0, 0.65 * (1 - trails[ti].age));
            }
            trails[ti].mesh.scale.multiplyScalar(0.94);
            if (trails[ti].age > 1) {
              disposeMesh(trails[ti].mesh);
              trails.splice(ti, 1);
            }
          }
        },
        done: function () {
          disposeMesh(ball);
          disposeMesh(coreBall);
          disposeMesh(glowShell);
          trails.forEach(function (t) { disposeMesh(t.mesh); });
          spawnResidual(to, col);
          if (opts.onDone) opts.onDone();
        }
      });
      return true;
    }

    function registerTexture(game) {
      phaserGame = game || phaserGame;
      if (!phaserGame || !phaserGame.textures) return false;
      // First paint so texture is not empty
      renderer.render(scene, camera);
      blitToPhaserCanvas();
      if (phaserGame.textures.exists(textureKey)) {
        try { phaserGame.textures.remove(textureKey); } catch (e) {}
      }
      phaserGame.textures.addCanvas(textureKey, blitCanvas);
      console.log('[Battle3D] Phaser blit texture registered', textureKey, width + 'x' + height);
      return true;
    }

    function refreshTexture() {
      if (!phaserGame || !phaserGame.textures || !phaserGame.textures.exists(textureKey)) return;
      var tex = phaserGame.textures.get(textureKey);
      if (!tex) return;
      // CanvasTexture / Source update so WebGL re-samples the 2D blit canvas
      try {
        if (typeof tex.refresh === 'function') tex.refresh();
        else if (tex.source && tex.source[0] && typeof tex.source[0].update === 'function') {
          tex.source[0].update();
        }
      } catch (e) {}
    }

    function mount(game) {
      phaserGame = game || phaserGame;
      registerTexture(phaserGame);
      renderer.render(scene, camera);
      blitToPhaserCanvas();
      refreshTexture();
      return true;
    }

    function tickDroplets(dt) {
      Object.keys(figures).forEach(function (id) {
        var fig = figures[id];
        if (!fig.droplets || !fig.droplets.length) return;
        var keep = [];
        fig.droplets.forEach(function (drop) {
          var d = drop.userData;
          d.age += dt;
          d.vy -= 4.5 * dt;
          drop.position.x += d.vx * dt;
          drop.position.y += d.vy * dt;
          drop.position.z += d.vz * dt;
          // Flatten when hitting floor
          if (drop.position.y < 0.08) {
            drop.position.y = 0.08;
            d.vy *= -0.15;
            d.vx *= 0.7;
            d.vz *= 0.7;
            drop.scale.y = Math.max(0.2, drop.scale.y * 0.85);
            drop.scale.x = Math.min(2.2, drop.scale.x * 1.08);
            drop.scale.z = Math.min(2.2, drop.scale.z * 1.08);
          }
          var lifeU = d.age / d.life;
          if (drop.material) {
            drop.material.opacity = Math.max(0, 0.9 * (1 - lifeU));
          }
          if (lifeU < 1) keep.push(drop);
          else {
            scene.remove(drop);
            if (drop.geometry) drop.geometry.dispose();
            if (drop.material) drop.material.dispose();
          }
        });
        fig.droplets = keep;
      });
    }

    function tick(dt) {
      if (disposed) return;
      dt = Math.min(0.05, dt || 0.016);
      clock += dt;

      // Anims
      var next = [];
      var a;
      for (a = 0; a < anims.length; a++) {
        var an = anims[a];
        an.t += dt;
        var u = Math.min(1, an.t / an.dur);
        if (an.update) an.update(u);
        if (u >= 1) {
          if (an.done) an.done();
        } else {
          next.push(an);
        }
      }
      anims = next;

      tickDroplets(dt);

      // Idle + atmosphere
      var ids = Object.keys(figures);
      var fi;
      for (fi = 0; fi < ids.length; fi++) {
        var fig = figures[ids[fi]];
        if (fig.dead || fig.melting) continue;
        if ((fi + Math.floor(clock * 18)) % 2 === 0) {
          applyWobble(fig, clock + fig.phase);
        }
        var bob = Math.sin(clock * 1.55 + fig.phase) * 0.03;
        var faceBase = fig.faceY != null ? fig.faceY : (fig.isFoe ? 0.6 : -0.4);
        fig.root.rotation.y = faceBase + Math.sin(clock * 0.45 + fig.phase) * 0.05;

        // Soft elemental halo behind gel portrait billboards
        if (fig.glowMat) {
          var gBase = 0.24 + Math.sin(clock * 1.7 + fig.phase) * 0.06;
          if (fig.activePulse > 0) gBase += 0.14;
          if (fig.hitFlash > 0) gBase += fig.hitFlash * 0.22;
          fig.glowMat.opacity = Math.min(0.55, gBase);
        }

        // Soft gel physics idle: subtle vertical stretch/squash (volume-ish).
        // GEL impostors only — hard foes / wolves bounce in Y, never scale-warp.
        var grounded = !!(fig.grounded || (fig.parts && fig.parts.footL));
        var isGelIdle = !!fig.gelImpostor;
        var jAmp = isGelIdle ? (grounded ? 0.038 : 0.028) : 0;
        var gelBreath = Math.sin(clock * 2.05 + fig.phase);
        // When bob is high, stretch a bit taller; when low, settle wider
        var squash = isGelIdle ? (1 + gelBreath * jAmp) : 1;       // X/Z
        var stretch = isGelIdle ? (1 - gelBreath * jAmp * 0.92) : 1; // Y
        // Secondary part personality (cheeks / arms / crown breathe)
        if (fig.parts) {
          var partBreath = Math.sin(clock * 2.4 + fig.phase) * 0.04;
          if (fig.parts.cheekL) {
            fig.parts.cheekL.scale.y = 0.7 * (1 + partBreath);
            fig.parts.cheekR.scale.y = 0.7 * (1 + partBreath);
          }
          if (fig.parts.armL) {
            fig.parts.armL.rotation.z = 0.25 + partBreath;
            fig.parts.armR.rotation.z = -0.25 - partBreath;
          }
          if (fig.parts.crown) {
            fig.parts.crown.position.y = 0.92 + 0.55 + partBreath * 0.5;
          }
          if (fig.parts.rarityAura) {
            fig.parts.rarityAura.rotation.z = clock * 0.8 + fig.phase;
            if (fig.parts.rarityAura.material) {
              fig.parts.rarityAura.material.opacity = 0.4 + Math.sin(clock * 2.5 + fig.phase) * 0.15;
            }
          }
        }

        // Active-turn ground ring pulse (R5+)
        if (fig.turnRing) {
          if (fig.activePulse > 0) {
            fig.turnRing.visible = true;
            if (fig.turnDisc) fig.turnDisc.visible = true;
            var tp = 0.55 + Math.sin(clock * 8) * 0.25;
            if (fig.turnRing.material) fig.turnRing.material.opacity = tp;
            if (fig.turnDisc && fig.turnDisc.material) {
              fig.turnDisc.material.opacity = 0.12 + Math.sin(clock * 6) * 0.06;
            }
            var trs = 1 + Math.sin(clock * 7) * 0.08;
            fig.turnRing.scale.set(trs, trs, 1);
          } else {
            fig.turnRing.visible = false;
            if (fig.turnDisc) fig.turnDisc.visible = false;
            if (fig.turnRing.material) fig.turnRing.material.opacity = 0;
          }
        }

        if (fig.activePulse > 0) {
          if (fig.isImpostor && fig.mat && fig.mat.color && fig.baseColor) {
            var pulseT = 0.12 + Math.sin(clock * 9) * 0.06;
            fig.mat.color.copy(fig.baseColor).lerp(new THREE.Color(0xffffff), pulseT);
          } else if (fig.mat && fig.mat.emissiveIntensity != null) {
            fig.mat.emissiveIntensity = fig.baseEmissive + 0.28 + Math.sin(clock * 9) * 0.1;
          }
          if (Math.abs(fig.root.position.z - fig.home.z) < 0.05) {
            if (grounded) {
              fig.root.position.y = fig.home.y + (isGelIdle ? bob * 0.7 : bob * 0.35);
              if (isGelIdle) {
                fig.root.scale.set(
                  fig.baseScale * squash * 1.04,
                  fig.baseScale * stretch * 1.06,
                  fig.baseScale * squash * 1.04
                );
              } else {
                // Hard foes: rigid plate, pulse only via bob / tint
                fig.root.scale.set(fig.baseScale, fig.baseScale, fig.baseScale);
              }
            } else {
              fig.root.position.y = fig.home.y + bob + 0.08;
            }
          }
          if (fig.contactShadow) {
            fig.contactShadow.material.opacity = 0.25 + Math.sin(clock * 8) * 0.08;
          }
        } else {
          if (fig.hitFlash > 0) {
            fig.hitFlash = Math.max(0, fig.hitFlash - dt * 3);
            if (fig.isImpostor && fig.mat && fig.mat.color && fig.baseColor) {
              fig.mat.color.copy(fig.baseColor).lerp(new THREE.Color(0xffffff), fig.hitFlash * 0.85);
            } else if (fig.mat && fig.mat.emissiveIntensity != null) {
              fig.mat.emissiveIntensity = fig.baseEmissive + 0.55 * fig.hitFlash;
            }
          } else if (fig.isImpostor && fig.mat && fig.mat.color && fig.baseColor) {
            fig.mat.color.lerp(fig.baseColor, 0.12);
          } else if (fig.mat && fig.mat.emissiveIntensity != null) {
            fig.mat.emissiveIntensity += (fig.baseEmissive - fig.mat.emissiveIntensity) * 0.08;
          }
          if (Math.abs(fig.root.position.z - fig.home.z) < 0.05 &&
              Math.abs(fig.root.position.x - fig.home.x) < 0.05) {
            if (grounded) {
              // Planted bounce — gels squash; hard foes bob Y only (no stretch)
              var plantBob = isGelIdle ? bob * 0.85 : bob * 0.40;
              fig.root.position.y = fig.home.y + plantBob;
              if (isGelIdle) {
                fig.root.scale.set(
                  fig.baseScale * squash,
                  fig.baseScale * stretch,
                  fig.baseScale * squash
                );
              } else {
                fig.root.scale.set(fig.baseScale, fig.baseScale, fig.baseScale);
              }
            } else {
              var gelBob = isGelIdle ? bob * 1.35 : bob;
              fig.root.position.y = fig.home.y + gelBob;
              // Hover gels still breathe — soft vertical expand/contract
              if (isGelIdle) {
                fig.root.scale.set(
                  fig.baseScale * squash,
                  fig.baseScale * stretch,
                  fig.baseScale * squash
                );
              } else {
                fig.root.scale.set(fig.baseScale, fig.baseScale, fig.baseScale);
              }
            }
          }
          if (fig.contactShadow) fig.contactShadow.material.opacity = grounded ? 0.48 : 0.38;
        }
      }

      // Gentle flame mesh only (no light intensity flicker → no ground flash)
      if (braziers && braziers.length) {
        braziers.forEach(function (b, bi) {
          var fl = b.userData.flame;
          if (fl) {
            var f = 0.95 + Math.sin(clock * 4 + bi) * 0.04;
            fl.scale.set(f, 1.25 + f * 0.15, f);
          }
        });
      }

      // Soft dust / pollen drift (stable opacity — no strobing)
      motes.forEach(function (m) {
        if (m.userData.rise) {
          m.position.y += m.userData.rise * 0.5;
          if (m.position.y > 5.5) m.position.y = 0.4;
        } else {
          m.position.y += Math.sin(clock * m.userData.speed * 0.5 + m.userData.phase) * 0.001;
        }
        m.position.x += Math.cos(clock * 0.12 + m.userData.phase) * 0.0008;
        if (m.material && m.material.opacity != null) {
          m.material.opacity = 0.18;
        }
      });

      // Very subtle camera drift (locked enough to not feel like a zoom loop)
      camera.position.x = camHome.x + Math.sin(clock * 0.08) * 0.04;
      camera.position.y = camHome.y + Math.sin(clock * 0.06) * 0.025;
      camera.position.z = camHome.z + Math.cos(clock * 0.07) * 0.03;
      camera.lookAt(camLook.x, camLook.y, camLook.z);

      renderer.render(scene, camera);
      blitToPhaserCanvas();
      refreshTexture();
    }

    function resize(w, h, newDpr) {
      width = w;
      height = h;
      glCanvas.width = width;
      glCanvas.height = height;
      blitCanvas.width = width;
      blitCanvas.height = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (phaserGame && phaserGame.textures && phaserGame.textures.exists(textureKey)) {
        try { phaserGame.textures.remove(textureKey); } catch (e) {}
        phaserGame.textures.addCanvas(textureKey, blitCanvas);
      }
    }

    function dispose() {
      disposed = true;
      Object.keys(figures).forEach(function (id) {
        var fig = figures[id];
        scene.remove(fig.root);
        if (fig.geo) fig.geo.dispose();
        if (fig.mat) fig.mat.dispose();
        if (fig.puddle) {
          scene.remove(fig.puddle);
          if (fig.puddle.geometry) fig.puddle.geometry.dispose();
          if (fig.puddle.material) fig.puddle.material.dispose();
        }
        (fig.droplets || []).forEach(function (d) {
          scene.remove(d);
          if (d.geometry) d.geometry.dispose();
          if (d.material) d.material.dispose();
        });
      });
      figures = {};
      if (renderer) renderer.dispose();
      if (glCanvas && glCanvas.parentNode) {
        try { glCanvas.parentNode.removeChild(glCanvas); } catch (e) {}
      }
      if (host) {
        host.style.display = 'none';
        host.setAttribute('aria-hidden', 'true');
      }
      if (phaserGame && phaserGame.textures && phaserGame.textures.exists(textureKey)) {
        try { phaserGame.textures.remove(textureKey); } catch (e) {}
      }
    }

    renderer.render(scene, camera);
    blitToPhaserCanvas();

    return {
      textureKey: textureKey,
      canvas: blitCanvas,
      glCanvas: glCanvas,
      width: width,
      height: height,
      useDomLayer: false,
      useBlit: true,
      spawnTeams: spawnTeams,
      spawnUnit: spawnUnit,
      removeUnit: removeUnit,
      replaceFoeTeam: replaceFoeTeam,
      preloadUnitArt: preloadUnitArt,
      waitArtReady: waitArtReady,
      project: project,
      setAlive: setAlive,
      meltDeath: meltDeath,
      setActive: setActive,
      pulse: pulse,
      lunge: lunge,
      beginAttackPose: beginAttackPose,
      playAttackPose: playAttackPose,
      restoreIdlePose: restoreIdlePose,
      applyFigurePoseMap: applyFigurePoseMap,
      hitFlash: hitFlash,
      skillFx: skillFx,
      impactBurst: impactBurst,
      cameraPunch: cameraPunch,
      quality: Q.id,
      registerTexture: registerTexture,
      mount: mount,
      syncDomToPhaser: syncDomToPhaser,
      tick: tick,
      resize: resize,
      dispose: dispose,
      isLive: true
    };
  }

  global.SR_BATTLE3D = {
    available: available,
    create: create,
    themeFromOpts: themeFromOpts,
    preloadCombatArt: preloadCombatArt,
    createPoseController: createPoseController,
    gelArtUrl: gelArtUrl,
    resolveForestPalette: resolveForestPalette,
    resolveWorldSize: resolveWorldSize,
    gelSizeMult: gelSizeMult,
    enemySizeMult: enemySizeMult,
    enemyKindSize: enemyKindSize,
    ZONE_THEMES: ZONE_THEMES,
    DUNGEON_ARENA_THEMES: DUNGEON_ARENA_THEMES,
    ARENA_THEMES: ARENA_THEMES,
    ELEMENT_HEX: ELEMENT_HEX,
    ENEMY_KIND_SIZE: ENEMY_KIND_SIZE,
    GEL_PROFILES: GEL_PROFILES,
    // Pure helpers for tests + tools (no WebGL)
    LANE_DEFAULT: LANE_DEFAULT,
    computeLaneAxis: computeLaneAxis,
    computeLaneSlot: computeLaneSlot,
    unitIsSolidEnemy: unitIsSolidEnemy,
    deathPathForFlags: deathPathForFlags,
    resolveBattleQuality: resolveBattleQuality,
    gelProfile: gelProfile
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SR_BATTLE3D;
  }
})(typeof window !== 'undefined' ? window : global);
