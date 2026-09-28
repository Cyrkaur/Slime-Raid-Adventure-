/* ===== Combat VFX catalog — data-driven skill FX recipes (Phase A + B) =====
 * Pure data + resolvers. No Phaser/Three scene logic.
 * battleWorld3d runners read recipes (delivery + cast/travel/impact profiles).
 * Phase B: impact/travel ids select unique silhouettes (inferno, bolt, blaze…).
 */
(function (global) {
  'use strict';

  /**
   * Tier budgets — attack timing is skill-type dynamic (not multi-turn).
   * castSec: spool-up windup before travel/impact (magic longer than basic).
   * durationMul: scales travel + impact anim length.
   * totalHintMs: used by BattleScene to hold the turn until spectacle ends.
   */
  var TIER_BUDGET = {
    basic: {
      durationMul: 0.92, particleMul: 1.15, residual: true, cameraPunch: 0.04,
      // poseLeadSec: attack plate readable before bounce/impact
      castSec: 0.06, poseLeadSec: 0.12, totalHintMs: 640
    },
    ability: {
      durationMul: 1.28, particleMul: 1.55, residual: true, cameraPunch: 0.09,
      castSec: 0.38, poseLeadSec: 0.08, totalHintMs: 1180
    },
    signature: {
      durationMul: 1.58, particleMul: 2.0, residual: true, cameraPunch: 0.16,
      castSec: 0.62, poseLeadSec: 0.09, totalHintMs: 1720
    }
  };

  /** Delivery-based cast spool (magic / AOE charge longer; melee snappier) */
  var DELIVERY_CAST = {
    melee: 0.72,
    projectile: 1.15,
    beam: 1.25,
    cloud: 1.2,
    aoe: 1.35,
    heal: 0.95,
    buff: 1.05
  };

  /**
   * Per-skill recipes. Keys match SKILL_DEFS ids (+ element kit ids).
   * delivery: projectile|beam|melee|aoe|cloud|heal|buff
   * Profiles are ids for future unique runners; Phase A maps them to existing delivery paths.
   */
  var SKILL_RECIPES = {
    // Shared legacy kit
    basic:   { fxTier: 'basic',     delivery: 'melee',      cast: 'gel_snap',      travel: null,            impact: 'soft_splat',    residual: null },
    smash:   { fxTier: 'ability',   delivery: 'melee',      cast: 'heavy_raise',   travel: null,            impact: 'ground_dust',   residual: 'rubble', multiHit: 2, multiHitGapMs: 140 },
    splash:  { fxTier: 'ability',   delivery: 'aoe',        cast: 'rise_water',    travel: 'water_arc',     impact: 'ripple_rings',  residual: 'puddle' },
    heal:    { fxTier: 'ability',   delivery: 'heal',       cast: 'mend_orbs',     travel: null,            impact: 'green_rain',    residual: 'soft_glow' },
    shield:  { fxTier: 'ability',   delivery: 'buff',       cast: 'shell_bloom',   travel: null,            impact: 'lattice',       residual: null },
    blaze:   { fxTier: 'ability',   delivery: 'projectile', cast: 'ember_charge',  travel: 'fire_comet',    impact: 'scorch_bloom',  residual: 'embers' },
    bolt:    { fxTier: 'ability',   delivery: 'beam',       cast: 'spark_build',   travel: 'lightning_fork', impact: 'flash_core',   residual: 'crackles', chain: true },
    poison:  { fxTier: 'ability',   delivery: 'cloud',      cast: 'drip_charge',   travel: 'venom_glob',    impact: 'toxic_splotch', residual: 'fumes' },
    inferno: { fxTier: 'signature', delivery: 'aoe',        cast: 'magma_runes',   travel: 'meteor_arc',    impact: 'eruption',      residual: 'ember_ground', multiHit: 3, multiHitGapMs: 110 },

    // Element kits — distinct single-target / AOE silhouettes per element
    water_basic:   { fxTier: 'basic',   delivery: 'projectile', cast: 'rise_water', travel: 'water_arc', impact: 'ripple_rings', residual: 'puddle' },
    water_mend:    { fxTier: 'ability', delivery: 'heal',       cast: 'mend_orbs', impact: 'green_rain', residual: 'soft_glow' },
    tidal_surge:   { fxTier: 'signature', delivery: 'aoe',      cast: 'rise_water', travel: 'water_arc', impact: 'ripple_rings', residual: 'puddle', multiHit: 2, multiHitGapMs: 120 },

    fire_basic:    { fxTier: 'basic',   delivery: 'projectile', cast: 'ember_charge', travel: 'fire_comet', impact: 'scorch_bloom', residual: 'embers' },
    heat_guard:    { fxTier: 'ability', delivery: 'buff',       cast: 'ember_charge', impact: 'lattice', residual: 'embers' },
    blaze_focus:   { fxTier: 'ability', delivery: 'projectile', cast: 'ember_charge', travel: 'fire_comet', impact: 'scorch_bloom', residual: 'embers' },

    earth_basic:   { fxTier: 'basic',   delivery: 'melee',      cast: 'heavy_raise', impact: 'ground_dust', residual: 'rubble' },
    earth_shield:  { fxTier: 'ability', delivery: 'buff',       cast: 'shell_bloom', impact: 'lattice' },
    quake:         { fxTier: 'signature', delivery: 'aoe',      cast: 'heavy_raise', impact: 'ground_dust', residual: 'rubble', multiHit: 2, multiHitGapMs: 130 },

    wind_basic:    { fxTier: 'basic',   delivery: 'beam',       cast: 'spark_build', travel: 'gust_streak', impact: 'gust_lines', residual: 'leaves' },
    wind_slash:    { fxTier: 'ability', delivery: 'beam',       cast: 'spark_build', travel: 'gust_streak', impact: 'gust_lines', residual: 'leaves' },
    zephyr_veil:   { fxTier: 'ability', delivery: 'buff',       cast: 'shell_bloom', impact: 'lattice' },
    cyclone:       { fxTier: 'signature', delivery: 'aoe',      cast: 'rise_water', impact: 'gust_lines', residual: 'leaves', multiHit: 2, multiHitGapMs: 110 },

    plant_basic:   { fxTier: 'basic',   delivery: 'melee',      cast: 'vine_rise', impact: 'moss_burst', residual: 'spores' },
    plant_mend:    { fxTier: 'ability', delivery: 'heal',       cast: 'mend_orbs', impact: 'green_rain', residual: 'spores' },
    sap_guard:     { fxTier: 'ability', delivery: 'buff',       cast: 'shell_bloom', impact: 'lattice', residual: 'spores' },
    overgrowth:    { fxTier: 'signature', delivery: 'aoe',      cast: 'vine_rise', impact: 'moss_burst', residual: 'spores', multiHit: 2, multiHitGapMs: 120 },

    lightning_basic: { fxTier: 'basic', delivery: 'beam',       cast: 'spark_build', travel: 'lightning_fork', impact: 'flash_core', residual: 'crackles' },
    charge_shell:  { fxTier: 'ability', delivery: 'buff',       cast: 'spark_build', impact: 'lattice', residual: 'crackles' },
    // note: shared `bolt` key above already defines chain; keep in sync if re-added

    ice_basic:     { fxTier: 'basic',   delivery: 'projectile', cast: 'prism_charge', travel: 'ice_shard', impact: 'shatter_star', residual: 'frost' },
    frost_guard:   { fxTier: 'ability', delivery: 'buff',       cast: 'prism_charge', impact: 'lattice', residual: 'frost' },
    freeze:        { fxTier: 'ability', delivery: 'projectile', cast: 'prism_charge', travel: 'ice_shard', impact: 'shatter_star', residual: 'frost' },

    shadow_basic:  { fxTier: 'basic',   delivery: 'cloud',      cast: 'drip_charge', travel: 'shadow_suck', impact: 'dark_bloom', residual: 'smoke' },
    umbral_veil:   { fxTier: 'ability', delivery: 'buff',       cast: 'shell_bloom', impact: 'lattice', residual: 'smoke' },
    void_bite:     { fxTier: 'ability', delivery: 'cloud',      cast: 'drip_charge', travel: 'shadow_suck', impact: 'dark_bloom', residual: 'smoke' },

    light_basic:   { fxTier: 'basic',   delivery: 'beam',       cast: 'halo_charge', travel: 'lightning_fork', impact: 'flash_core', residual: 'soft_glow' },
    light_mend:    { fxTier: 'ability', delivery: 'heal',       cast: 'mend_orbs', impact: 'halo_flash', residual: 'soft_glow' },
    radiance:      { fxTier: 'ability', delivery: 'beam',       cast: 'halo_charge', travel: 'lightning_fork', impact: 'flash_core', residual: 'soft_glow' },
    radiant_burst: { fxTier: 'signature', delivery: 'aoe',      cast: 'halo_charge', impact: 'flash_core', residual: 'soft_glow', multiHit: 2, multiHitGapMs: 110 },
    solar_bloom:   { fxTier: 'signature', delivery: 'aoe',      cast: 'halo_charge', impact: 'flash_core', residual: 'soft_glow', multiHit: 2, multiHitGapMs: 120 },

    // Phase D — remaining element kits (reuse runners; unique silhouette via cast/impact ids)
    ice_spike:     { fxTier: 'ability',   delivery: 'projectile', cast: 'prism_charge', travel: 'ice_shard', impact: 'shatter_star', residual: 'frost' },
    frost_shell:   { fxTier: 'ability',   delivery: 'buff',       cast: 'shell_bloom', impact: 'lattice' },
    blizzard:      { fxTier: 'signature', delivery: 'aoe',        cast: 'prism_charge', impact: 'shatter_star', residual: 'frost', multiHit: 2, multiHitGapMs: 130 },

    fade_cloak:    { fxTier: 'ability',   delivery: 'buff',       cast: 'shell_bloom', impact: 'lattice' },
    nightfall:     { fxTier: 'signature', delivery: 'aoe',        cast: 'drip_charge', impact: 'dark_bloom', residual: 'smoke', multiHit: 2, multiHitGapMs: 120 },

    metal_basic:   { fxTier: 'basic',     delivery: 'melee',      cast: 'heavy_raise', impact: 'ground_dust', residual: 'rubble' },
    metal_edge:    { fxTier: 'ability',   delivery: 'melee',      cast: 'heavy_raise', impact: 'ground_dust', residual: 'rubble', multiHit: 2, multiHitGapMs: 90 },
    iron_guard:    { fxTier: 'ability',   delivery: 'buff',       cast: 'shell_bloom', impact: 'lattice' },
    shatter:       { fxTier: 'signature', delivery: 'aoe',        cast: 'heavy_raise', impact: 'ground_dust', residual: 'rubble', multiHit: 2, multiHitGapMs: 130 },

    poison_basic:  { fxTier: 'basic',     delivery: 'cloud',      cast: 'drip_charge', travel: 'venom_glob', impact: 'toxic_splotch', residual: 'fumes' },
    cloud_veil:    { fxTier: 'ability',   delivery: 'buff',       cast: 'shell_bloom', impact: 'lattice', residual: 'fumes' },
    miasma:        { fxTier: 'signature', delivery: 'aoe',        cast: 'drip_charge', travel: 'venom_glob', impact: 'toxic_splotch', residual: 'fumes', multiHit: 2, multiHitGapMs: 120 },

    crystal_basic: { fxTier: 'basic',     delivery: 'projectile', cast: 'prism_charge', travel: 'ice_shard', impact: 'shatter_star', residual: 'frost' },
    prism_bolt:    { fxTier: 'ability',   delivery: 'beam',       cast: 'prism_charge', travel: 'lightning_fork', impact: 'flash_core', residual: 'crackles', chain: true },
    prism_guard:   { fxTier: 'ability',   delivery: 'buff',       cast: 'prism_charge', impact: 'lattice', residual: 'frost' },
    shatterbeam:   { fxTier: 'signature', delivery: 'aoe',        cast: 'prism_charge', impact: 'shatter_star', residual: 'frost', multiHit: 2, multiHitGapMs: 110 },

    lava_basic:    { fxTier: 'basic',     delivery: 'projectile', cast: 'ember_charge', travel: 'fire_comet', impact: 'scorch_bloom', residual: 'embers' },
    molten_shell:  { fxTier: 'ability',   delivery: 'buff',       cast: 'magma_runes', impact: 'lattice', residual: 'embers' },

    storm_basic:   { fxTier: 'basic',     delivery: 'beam',       cast: 'spark_build', travel: 'lightning_fork', impact: 'flash_core', residual: 'crackles' },
    storm_guard:   { fxTier: 'ability',   delivery: 'buff',       cast: 'spark_build', impact: 'lattice', residual: 'crackles' },
    chain_storm:   { fxTier: 'signature', delivery: 'aoe',        cast: 'spark_build', travel: 'lightning_fork', impact: 'flash_core', residual: 'crackles', multiHit: 3, multiHitGapMs: 100, chain: true },
    tempest:       { fxTier: 'signature', delivery: 'aoe',        cast: 'spark_build', impact: 'gust_lines', residual: 'leaves', multiHit: 2, multiHitGapMs: 120 },

    spirit_basic:  { fxTier: 'basic',     delivery: 'cloud',      cast: 'halo_charge', travel: 'shadow_suck', impact: 'halo_flash', residual: 'soft_glow' },
    haunt:         { fxTier: 'ability',   delivery: 'cloud',      cast: 'drip_charge', travel: 'shadow_suck', impact: 'dark_bloom', residual: 'smoke' },
    spirit_mend:   { fxTier: 'ability',   delivery: 'heal',       cast: 'mend_orbs', impact: 'green_rain', residual: 'soft_glow' },
    soul_wave:     { fxTier: 'signature', delivery: 'aoe',        cast: 'halo_charge', impact: 'halo_flash', residual: 'soft_glow', multiHit: 2, multiHitGapMs: 130 },

    void_basic:    { fxTier: 'basic',     delivery: 'cloud',      cast: 'drip_charge', travel: 'shadow_suck', impact: 'dark_bloom', residual: 'smoke' },
    void_drain:    { fxTier: 'ability',   delivery: 'cloud',      cast: 'drip_charge', travel: 'shadow_suck', impact: 'dark_bloom', residual: 'smoke' },
    void_shell:    { fxTier: 'ability',   delivery: 'buff',       cast: 'shell_bloom', impact: 'lattice', residual: 'smoke' },
    collapse:      { fxTier: 'signature', delivery: 'aoe',        cast: 'magma_runes', impact: 'dark_bloom', residual: 'smoke', multiHit: 3, multiHitGapMs: 110 }
  };

  /** Map shared skill id "basic" → element kit basic for unique silhouettes */
  function elementBasicId(element) {
    var el = String(element || 'Water').toLowerCase();
    var key = el + '_basic';
    return SKILL_RECIPES[key] ? key : null;
  }

  /** Fallback delivery from artCategory / element when skill id unknown */
  function deliveryFromHints(skillId, element, kind, aoe) {
    var id = String(skillId || '').toLowerCase();
    var el = String(element || 'Water');
    if (kind === 'heal' || id.indexOf('heal') >= 0 || id.indexOf('mend') >= 0) return 'heal';
    if (id.indexOf('shield') >= 0 || id.indexOf('guard') >= 0 || id.indexOf('veil') >= 0 || id.indexOf('shell') >= 0) return 'buff';
    if (aoe || id.indexOf('splash') >= 0 || id.indexOf('inferno') >= 0 || id.indexOf('quake') >= 0 || id.indexOf('cyclone') >= 0) return 'aoe';
    if (el === 'Lightning' || el === 'Storm' || id.indexOf('bolt') >= 0 || id.indexOf('spark') >= 0) return 'beam';
    if (el === 'Earth' || el === 'Metal' || id.indexOf('smash') >= 0 || id.indexOf('crush') >= 0) return 'melee';
    if (el === 'Shadow' || el === 'Poison' || el === 'Void' || id.indexOf('venom') >= 0 || id.indexOf('poison') >= 0) return 'cloud';
    return 'projectile';
  }

  function tierFromSkillDef(skillId, cd, aoe, mult) {
    var id = String(skillId || '').toLowerCase();
    if (id === 'basic' || id.indexOf('_basic') >= 0 || (cd === 0 && !aoe && (mult == null || mult <= 1.1))) {
      return 'basic';
    }
    if (aoe || (cd != null && cd >= 4) || (mult != null && mult >= 1.7) ||
        id.indexOf('inferno') >= 0 || id.indexOf('surge') >= 0 || id.indexOf('quake') >= 0 ||
        id.indexOf('cyclone') >= 0 || id.indexOf('overgrowth') >= 0 || id.indexOf('radiant') >= 0) {
      return 'signature';
    }
    return 'ability';
  }

  /**
   * Resolve full recipe for a combat action.
   * @param {object} opts { skillId, element, kind, aoe, deliveryHint }
   */
  function resolveRecipe(opts) {
    opts = opts || {};
    var skillId = opts.skillId || opts.id || 'basic';
    // Shared "basic" / "heal" / "shield" → element-flavoured silhouette when possible
    if ((skillId === 'basic' || skillId === 'gel_strike') && opts.element) {
      var elBasic = elementBasicId(opts.element);
      if (elBasic) skillId = elBasic;
    }
    if ((skillId === 'heal' || skillId === 'mend') && opts.element) {
      var el = String(opts.element);
      if (el === 'Water' && SKILL_RECIPES.water_mend) skillId = 'water_mend';
      else if (el === 'Plant' && SKILL_RECIPES.plant_mend) skillId = 'plant_mend';
      else if (el === 'Light' && SKILL_RECIPES.light_mend) skillId = 'light_mend';
      else if (el === 'Spirit' && SKILL_RECIPES.spirit_mend) skillId = 'spirit_mend';
    }
    var base = SKILL_RECIPES[skillId] ? Object.assign({}, SKILL_RECIPES[skillId]) : null;
    if (!base) {
      var del = opts.deliveryHint || deliveryFromHints(skillId, opts.element, opts.kind, opts.aoe);
      var tier = tierFromSkillDef(skillId, opts.cd, opts.aoe, opts.mult);
      base = {
        fxTier: tier,
        delivery: del,
        cast: tier === 'basic' ? 'gel_snap' : 'cast_default',
        travel: del === 'projectile' || del === 'beam' || del === 'cloud' ? 'travel_default' : null,
        impact: 'impact_default',
        residual: tier === 'signature' ? 'ember_ground' : null
      };
    }
    // Buffs share shield-like presentation until dedicated runner exists
    if (base.delivery === 'buff') {
      base._mapDelivery = 'buff';
    } else {
      base._mapDelivery = base.delivery;
    }
    var budget = Object.assign({}, TIER_BUDGET[base.fxTier] || TIER_BUDGET.ability);
    // Magic / AOE spool longer; melee basics stay snappy
    var delKey = base.delivery || 'projectile';
    var castMul = DELIVERY_CAST[delKey] != null ? DELIVERY_CAST[delKey] : 1;
    // Heavy melee ability (crush) — short cast, weight in impact
    if (base.cast === 'heavy_raise' || base.impact === 'ground_dust') {
      castMul = Math.min(castMul, 0.85);
    }
    // Magma / signature magic — extra charge feel
    if (base.cast === 'magma_runes' || base.cast === 'ember_charge' || base.cast === 'prism_charge') {
      castMul *= 1.2;
    }
    budget.castSec = Math.max(0.04, (budget.castSec || 0.2) * castMul);
    if (budget.poseLeadSec == null) budget.poseLeadSec = 0.1;
    budget.totalHintMs = Math.round(
      (budget.totalHintMs || 900) * (0.85 + castMul * 0.2) * (budget.durationMul || 1)
    ) + Math.round((budget.poseLeadSec || 0) * 1000);
    base.budget = budget;
    base.skillId = skillId;
    base.element = opts.element || null;
    // Phase C spectacle flags (from recipe or defaults)
    if (base.multiHit == null) base.multiHit = 1;
    if (base.multiHitGapMs == null) base.multiHitGapMs = 100;
    if (base.chain == null) base.chain = false;
    return base;
  }

  function getTierBudget(fxTier) {
    return TIER_BUDGET[fxTier] || TIER_BUDGET.ability;
  }

  var API = {
    TIER_BUDGET: TIER_BUDGET,
    DELIVERY_CAST: DELIVERY_CAST,
    SKILL_RECIPES: SKILL_RECIPES,
    resolveRecipe: resolveRecipe,
    getTierBudget: getTierBudget,
    deliveryFromHints: deliveryFromHints,
    tierFromSkillDef: tierFromSkillDef
  };

  /** Phase B profile ids that have unique 3D runners (not generic delivery only) */
  var UNIQUE_IMPACTS = {
    eruption: 1, flash_core: 1, scorch_bloom: 1, ripple_rings: 1,
    toxic_splotch: 1, ground_dust: 1, shatter_star: 1, lattice: 1, green_rain: 1,
    dark_bloom: 1, moss_burst: 1, gust_lines: 1, halo_flash: 1
  };
  var UNIQUE_TRAVELS = {
    fire_comet: 1, lightning_fork: 1, water_arc: 1, venom_glob: 1, ice_shard: 1,
    gust_streak: 1, shadow_suck: 1, meteor_arc: 1
  };

  function hasUniqueSilhouette(recipe) {
    if (!recipe) return false;
    return !!(UNIQUE_IMPACTS[recipe.impact] || UNIQUE_TRAVELS[recipe.travel]);
  }

  API.UNIQUE_IMPACTS = UNIQUE_IMPACTS;
  API.UNIQUE_TRAVELS = UNIQUE_TRAVELS;
  API.hasUniqueSilhouette = hasUniqueSilhouette;

  global.SR_COMBAT_VFX = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : global);
