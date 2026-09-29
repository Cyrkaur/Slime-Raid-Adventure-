/* ===== Ported slime data (from Slime Adventure — full hub feature set) ===== */
(function (global) {
  'use strict';

  // Optional expansion modules (browser: script tags; Node: require)
  var CW = global.SR_CAMPAIGN_WORLD || null;
  var CN = global.SR_CHAMPION_NAMES || null;
  var SL = global.SR_STORY_LORE || null;
  var HR = global.SR_HERO_ROSTER || null;
  try {
    if (!HR && typeof require !== 'undefined') HR = require('./heroRoster.js');
    if (!CW && typeof require !== 'undefined') CW = require('./campaignWorld.js');
    if (!CN && typeof require !== 'undefined') CN = require('./championNames.js');
    if (!SL && typeof require !== 'undefined') SL = require('./storyLore.js');
  } catch (eLoad) { /* browser without modules */ }

  var ELEMENTS = [
    'Water', 'Fire', 'Earth', 'Wind', 'Plant', 'Lightning', 'Ice', 'Shadow',
    'Light', 'Metal', 'Poison', 'Crystal', 'Lava', 'Storm', 'Spirit', 'Void'
  ];

  var ELEMENT_CHART = {
    Water: { strong: ['Fire', 'Lava'], weak: ['Lightning', 'Ice', 'Plant'] },
    Fire: { strong: ['Plant', 'Ice', 'Wind'], weak: ['Water', 'Earth', 'Lava'] },
    Earth: { strong: ['Lightning', 'Fire', 'Poison'], weak: ['Wind', 'Water', 'Plant'] },
    Wind: { strong: ['Plant', 'Poison', 'Earth'], weak: ['Lightning', 'Ice', 'Storm'] },
    Plant: { strong: ['Water', 'Earth', 'Poison'], weak: ['Fire', 'Lava', 'Wind'] },
    Lightning: { strong: ['Water', 'Wind', 'Metal'], weak: ['Earth', 'Plant', 'Storm'] },
    Ice: { strong: ['Water', 'Plant', 'Wind'], weak: ['Fire', 'Lava', 'Lightning'] },
    Shadow: { strong: ['Light', 'Spirit', 'Void'], weak: ['Light', 'Crystal', 'Storm'] },
    Light: { strong: ['Shadow', 'Void', 'Poison'], weak: ['Shadow', 'Void', 'Metal'] },
    Metal: { strong: ['Lightning', 'Ice', 'Crystal'], weak: ['Fire', 'Lava', 'Poison'] },
    Poison: { strong: ['Plant', 'Water', 'Spirit'], weak: ['Earth', 'Wind', 'Light'] },
    Crystal: { strong: ['Shadow', 'Void', 'Lightning'], weak: ['Metal', 'Fire', 'Lava'] },
    Lava: { strong: ['Plant', 'Ice', 'Metal'], weak: ['Water', 'Earth', 'Wind'] },
    Storm: { strong: ['Wind', 'Lightning', 'Water'], weak: ['Earth', 'Metal', 'Crystal'] },
    Spirit: { strong: ['Shadow', 'Poison', 'Void'], weak: ['Light', 'Crystal', 'Metal'] },
    Void: { strong: ['Light', 'Shadow', 'Spirit'], weak: ['Crystal', 'Storm', 'Metal'] }
  };

  var RARITY_POWER = {
    Common: 1, Uncommon: 1.15, Rare: 1.35, Epic: 1.6, Legendary: 1.95, Mythic: 2.4
  };

  /**
   * Skills catalog.
   * artKey      — circle plate stem (assets/battle/skills/{artKey}.png|jpg)
   * artCategory — family fallback (basic / ranged / heal / buff)
   * Unique per-skill / per-champ art can land later under the same artKey or a new stem.
   *
   * Kit slots (see ELEMENT_SKILL_KITS):
   *   basic · signature · utility · ultimate
   */
  var SKILL_DEFS = {
    // ── Shared legacy ids (kept for saves / older foes) ──
    basic:   { id: 'basic',   name: 'Gel Strike', mult: 1.0,  cd: 0, icon: '💥', artKey: 'basic',   artCategory: 'basic' },
    smash:   { id: 'smash',   name: 'Crush',     mult: 1.45, cd: 2, icon: '🔨', artKey: 'smash',   artCategory: 'basic' },
    splash:  { id: 'splash',  name: 'Splash',    mult: 0.85, cd: 3, aoe: true, icon: '💦', artKey: 'splash',  artCategory: 'ranged' },
    heal:    { id: 'heal',    name: 'Mend',      mult: 0,    cd: 3, heal: 0.28, icon: '💚', artKey: 'heal',    artCategory: 'heal' },
    shield:  { id: 'shield',  name: 'Gel Shield', mult: 0.7,  cd: 3, icon: '🛡️', artKey: 'shield',  artCategory: 'buff' },
    blaze:   { id: 'blaze',   name: 'Blaze',     mult: 1.55, cd: 2, icon: '🔥', artKey: 'blaze',   artCategory: 'ranged' },
    bolt:    { id: 'bolt',    name: 'Bolt',      mult: 1.5,  cd: 2, icon: '⚡', artKey: 'bolt',    artCategory: 'ranged' },
    poison:  { id: 'poison',  name: 'Venom',     mult: 1.2,  cd: 2, icon: '☠️', artKey: 'poison',  artCategory: 'ranged' },
    inferno: { id: 'inferno', name: 'Inferno',   mult: 1.8,  cd: 4, aoe: true, icon: '🌋', artKey: 'inferno', artCategory: 'ranged' },

    // ── Water · Tideborn ──
    water_basic:   { id: 'water_basic',   name: 'Tide Slap',    mult: 1.0,  cd: 0, icon: '💧', artKey: 'basic',  artCategory: 'basic' },
    water_mend:    { id: 'water_mend',    name: 'Cooling Mend', mult: 0,    cd: 3, heal: 0.30, icon: '🌊', artKey: 'heal',   artCategory: 'heal' },
    tidal_surge:   { id: 'tidal_surge',   name: 'Tidal Surge',  mult: 0.95, cd: 4, aoe: true, icon: '🌊', artKey: 'splash', artCategory: 'ranged' },

    // ── Fire · Emberkin ──
    fire_basic:    { id: 'fire_basic',    name: 'Ember Jab',    mult: 1.05, cd: 0, icon: '🔥', artKey: 'basic',   artCategory: 'basic' },
    heat_guard:    { id: 'heat_guard',    name: 'Heat Guard',   mult: 0.75, cd: 3, icon: '🛡️', artKey: 'shield',  artCategory: 'buff' },

    // ── Earth · Stoneward ──
    earth_basic:   { id: 'earth_basic',   name: 'Pebble Tap',   mult: 1.0,  cd: 0, icon: '🪨', artKey: 'basic',  artCategory: 'basic' },
    earth_shield:  { id: 'earth_shield',  name: 'Stone Shell',  mult: 0.65, cd: 3, icon: '🛡️', artKey: 'shield', artCategory: 'buff' },
    quake:         { id: 'quake',         name: 'Quake',        mult: 1.0,  cd: 4, aoe: true, icon: '⛰️', artKey: 'smash',  artCategory: 'basic' },

    // ── Wind · Zephyr ──
    wind_basic:    { id: 'wind_basic',    name: 'Gust Flick',   mult: 1.0,  cd: 0, icon: '🍃', artKey: 'basic',  artCategory: 'basic' },
    wind_slash:    { id: 'wind_slash',    name: 'Shear',        mult: 1.4,  cd: 2, icon: '💨', artKey: 'bolt',   artCategory: 'ranged' },
    zephyr_veil:   { id: 'zephyr_veil',   name: 'Zephyr Veil',  mult: 0.7,  cd: 3, icon: '🌬️', artKey: 'shield', artCategory: 'buff' },
    cyclone:       { id: 'cyclone',       name: 'Cyclone',      mult: 0.9,  cd: 4, aoe: true, icon: '🌪️', artKey: 'ranged', artCategory: 'ranged' },

    // ── Plant · Bloomkin ──
    plant_basic:   { id: 'plant_basic',   name: 'Vine Whip',    mult: 1.0,  cd: 0, icon: '🌿', artKey: 'basic',  artCategory: 'basic' },
    plant_mend:    { id: 'plant_mend',    name: 'Bloom Mend',   mult: 0,    cd: 3, heal: 0.32, icon: '💚', artKey: 'heal',   artCategory: 'heal' },
    sap_guard:     { id: 'sap_guard',     name: 'Sap Guard',    mult: 0.7,  cd: 3, icon: '🛡️', artKey: 'shield', artCategory: 'buff' },
    overgrowth:    { id: 'overgrowth',    name: 'Overgrowth',   mult: 0.88, cd: 4, aoe: true, icon: '🌳', artKey: 'poison', artCategory: 'ranged' },

    // ── Lightning · Stormcore ──
    lightning_basic: { id: 'lightning_basic', name: 'Spark',      mult: 1.05, cd: 0, icon: '⚡', artKey: 'basic',  artCategory: 'basic' },
    charge_shell:  { id: 'charge_shell',  name: 'Charge Shell', mult: 0.72, cd: 3, icon: '🔋', artKey: 'shield', artCategory: 'buff' },
    chain_storm:   { id: 'chain_storm',   name: 'Chain Storm',  mult: 1.05, cd: 4, aoe: true, icon: '🌩️', artKey: 'bolt',   artCategory: 'ranged' },

    // ── Ice · Frostgel ──
    ice_basic:     { id: 'ice_basic',     name: 'Frost Nip',    mult: 1.0,  cd: 0, icon: '❄️', artKey: 'basic',  artCategory: 'basic' },
    ice_spike:     { id: 'ice_spike',     name: 'Ice Spike',    mult: 1.5,  cd: 2, icon: '🧊', artKey: 'smash',  artCategory: 'basic' },
    frost_shell:   { id: 'frost_shell',   name: 'Frost Shell',  mult: 0.68, cd: 3, icon: '🛡️', artKey: 'shield', artCategory: 'buff' },
    blizzard:      { id: 'blizzard',      name: 'Blizzard',     mult: 0.92, cd: 4, aoe: true, icon: '🌨️', artKey: 'ranged', artCategory: 'ranged' },

    // ── Shadow · Shade ──
    shadow_basic:  { id: 'shadow_basic',  name: 'Shade Pinch',  mult: 1.05, cd: 0, icon: '🌑', artKey: 'basic',  artCategory: 'basic' },
    fade_cloak:    { id: 'fade_cloak',    name: 'Fade Cloak',   mult: 0.72, cd: 3, icon: '🖤', artKey: 'shield', artCategory: 'buff' },
    nightfall:     { id: 'nightfall',     name: 'Nightfall',    mult: 1.0,  cd: 4, aoe: true, icon: '🌃', artKey: 'poison', artCategory: 'ranged' },

    // ── Light · Lumina ──
    light_basic:   { id: 'light_basic',   name: 'Gleam Tap',    mult: 1.0,  cd: 0, icon: '✨', artKey: 'basic',  artCategory: 'basic' },
    radiance:      { id: 'radiance',      name: 'Radiance',     mult: 1.45, cd: 2, icon: '☀️', artKey: 'bolt',   artCategory: 'ranged' },
    light_mend:    { id: 'light_mend',    name: 'Dawn Mend',    mult: 0,    cd: 3, heal: 0.30, icon: '💛', artKey: 'heal',   artCategory: 'heal' },
    solar_bloom:   { id: 'solar_bloom',   name: 'Solar Bloom',  mult: 0.95, cd: 4, aoe: true, icon: '🌟', artKey: 'blaze',  artCategory: 'ranged' },

    // ── Metal · Steelgel ──
    metal_basic:   { id: 'metal_basic',   name: 'Rivet Jab',    mult: 1.05, cd: 0, icon: '⚙️', artKey: 'basic',  artCategory: 'basic' },
    metal_edge:    { id: 'metal_edge',    name: 'Edge Crush',   mult: 1.5,  cd: 2, icon: '⚔️', artKey: 'smash',  artCategory: 'basic' },
    iron_guard:    { id: 'iron_guard',    name: 'Iron Guard',   mult: 0.7,  cd: 3, icon: '🛡️', artKey: 'shield', artCategory: 'buff' },
    shatter:       { id: 'shatter',       name: 'Shatter',      mult: 1.05, cd: 4, aoe: true, icon: '💥', artKey: 'smash',  artCategory: 'basic' },

    // ── Poison · Venomkin ──
    poison_basic:  { id: 'poison_basic',  name: 'Toxin Tap',    mult: 1.0,  cd: 0, icon: '🦠', artKey: 'basic',  artCategory: 'basic' },
    cloud_veil:    { id: 'cloud_veil',    name: 'Cloud Veil',   mult: 0.7,  cd: 3, icon: '☁️', artKey: 'shield', artCategory: 'buff' },
    miasma:        { id: 'miasma',        name: 'Miasma',       mult: 0.95, cd: 4, aoe: true, icon: '☠️', artKey: 'poison', artCategory: 'ranged' },

    // ── Crystal · Prism ──
    crystal_basic: { id: 'crystal_basic', name: 'Facet Tap',    mult: 1.0,  cd: 0, icon: '💎', artKey: 'basic',  artCategory: 'basic' },
    prism_bolt:    { id: 'prism_bolt',    name: 'Prism Bolt',   mult: 1.5,  cd: 2, icon: '🔮', artKey: 'bolt',   artCategory: 'ranged' },
    prism_guard:   { id: 'prism_guard',   name: 'Prism Guard',  mult: 0.72, cd: 3, icon: '🛡️', artKey: 'shield', artCategory: 'buff' },
    shatterbeam:   { id: 'shatterbeam',   name: 'Shatterbeam',  mult: 1.0,  cd: 4, aoe: true, icon: '💠', artKey: 'ranged', artCategory: 'ranged' },

    // ── Lava · Magma ──
    lava_basic:    { id: 'lava_basic',    name: 'Magma Jab',    mult: 1.08, cd: 0, icon: '🌋', artKey: 'basic',   artCategory: 'basic' },
    molten_shell:  { id: 'molten_shell',  name: 'Molten Shell', mult: 0.75, cd: 3, icon: '🛡️', artKey: 'shield',  artCategory: 'buff' },

    // ── Storm · Tempest ──
    storm_basic:   { id: 'storm_basic',   name: 'Gale Tap',     mult: 1.05, cd: 0, icon: '⛈️', artKey: 'basic',  artCategory: 'basic' },
    storm_guard:   { id: 'storm_guard',   name: 'Storm Guard',  mult: 0.72, cd: 3, icon: '🛡️', artKey: 'shield', artCategory: 'buff' },
    tempest:       { id: 'tempest',       name: 'Tempest',      mult: 1.0,  cd: 4, aoe: true, icon: '🌪️', artKey: 'bolt',   artCategory: 'ranged' },

    // ── Spirit · Wisp ──
    spirit_basic:  { id: 'spirit_basic',  name: 'Wisp Touch',   mult: 1.0,  cd: 0, icon: '👻', artKey: 'basic',  artCategory: 'basic' },
    haunt:         { id: 'haunt',         name: 'Haunt',        mult: 1.4,  cd: 2, icon: '💜', artKey: 'poison', artCategory: 'ranged' },
    spirit_mend:   { id: 'spirit_mend',   name: 'Soul Mend',    mult: 0,    cd: 3, heal: 0.30, icon: '🕊️', artKey: 'heal',   artCategory: 'heal' },
    soul_wave:     { id: 'soul_wave',     name: 'Soul Wave',    mult: 0.9,  cd: 4, aoe: true, icon: '🌌', artKey: 'ranged', artCategory: 'ranged' },

    // ── Void · Abyss ──
    void_basic:    { id: 'void_basic',    name: 'Null Tap',     mult: 1.05, cd: 0, icon: '⬛', artKey: 'basic',  artCategory: 'basic' },
    void_drain:    { id: 'void_drain',    name: 'Null Bite',    mult: 1.45, cd: 2, icon: '🕳️', artKey: 'poison', artCategory: 'ranged' },
    void_shell:    { id: 'void_shell',    name: 'Void Shell',   mult: 0.7,  cd: 3, icon: '🛡️', artKey: 'shield', artCategory: 'buff' },
    collapse:      { id: 'collapse',      name: 'Collapse',     mult: 1.1,  cd: 4, aoe: true, icon: '🌑', artKey: 'inferno', artCategory: 'ranged' }
  };

  /** Category plates (shared family art). */
  var SKILL_ART_CATEGORIES = ['basic', 'ranged', 'heal', 'buff'];

  /**
   * Art stems to load at boot (unique plates + category + auto HUD).
   * New themed skills reuse these stems until champ-unique art ships.
   */
  var SKILL_ART_KEYS = [
    'basic', 'ranged', 'heal', 'buff',
    'smash', 'splash', 'blaze', 'bolt', 'poison', 'inferno', 'shield',
    'auto'
  ];

  /**
   * Per-element skill kit (theme identity).
   * Slot order: basic → signature → utility → ultimate
   * Rarity gates how many slots open (see getChampionSkillIds).
   */
  var ELEMENT_SKILL_KITS = {
    Water:     { basic: 'water_basic',     signature: 'splash',      utility: 'water_mend',    ultimate: 'tidal_surge' },
    Fire:      { basic: 'fire_basic',      signature: 'blaze',       utility: 'heat_guard',    ultimate: 'inferno' },
    Earth:     { basic: 'earth_basic',     signature: 'smash',       utility: 'earth_shield',  ultimate: 'quake' },
    Wind:      { basic: 'wind_basic',      signature: 'wind_slash',  utility: 'zephyr_veil',   ultimate: 'cyclone' },
    Plant:     { basic: 'plant_basic',     signature: 'plant_mend',  utility: 'sap_guard',     ultimate: 'overgrowth' },
    Lightning: { basic: 'lightning_basic', signature: 'bolt',        utility: 'charge_shell',  ultimate: 'chain_storm' },
    Ice:       { basic: 'ice_basic',       signature: 'ice_spike',   utility: 'frost_shell',   ultimate: 'blizzard' },
    Shadow:    { basic: 'shadow_basic',    signature: 'poison',      utility: 'fade_cloak',    ultimate: 'nightfall' },
    Light:     { basic: 'light_basic',     signature: 'radiance',    utility: 'light_mend',    ultimate: 'solar_bloom' },
    Metal:     { basic: 'metal_basic',     signature: 'metal_edge',  utility: 'iron_guard',    ultimate: 'shatter' },
    Poison:    { basic: 'poison_basic',    signature: 'poison',      utility: 'cloud_veil',    ultimate: 'miasma' },
    Crystal:   { basic: 'crystal_basic',   signature: 'prism_bolt',  utility: 'prism_guard',   ultimate: 'shatterbeam' },
    Lava:      { basic: 'lava_basic',      signature: 'blaze',       utility: 'molten_shell',  ultimate: 'inferno' },
    Storm:     { basic: 'storm_basic',     signature: 'bolt',        utility: 'storm_guard',   ultimate: 'tempest' },
    Spirit:    { basic: 'spirit_basic',    signature: 'haunt',       utility: 'spirit_mend',   ultimate: 'soul_wave' },
    Void:      { basic: 'void_basic',      signature: 'void_drain',  utility: 'void_shell',    ultimate: 'collapse' }
  };

  /** Legacy signature map (banner / UI shorthand). */
  var ELEMENT_SKILL = {
    Water: 'splash', Fire: 'blaze', Earth: 'smash', Wind: 'wind_slash', Plant: 'plant_mend',
    Lightning: 'bolt', Ice: 'ice_spike', Shadow: 'poison', Light: 'light_mend', Metal: 'metal_edge',
    Poison: 'poison', Crystal: 'prism_bolt', Lava: 'inferno', Storm: 'bolt', Spirit: 'spirit_mend', Void: 'void_drain'
  };

  /**
   * How many kit slots open by rarity.
   * Common/Uncommon: basic + signature
   * Rare: + utility
   * Epic+: + ultimate
   */
  function skillSlotCountForRarity(rarity) {
    var r = String(rarity || 'Common');
    if (r === 'Mythic' || r === 'Legendary' || r === 'Epic') return 4;
    if (r === 'Rare') return 3;
    return 2;
  }

  /**
   * Ordered skill ids for a champion (element kit + rarity unlock).
   * @param {object|string} champOrElement
   * @param {string} [rarity]
   * @returns {string[]}
   */
  function getChampionSkillIds(champOrElement, rarity) {
    var el = 'Water';
    var rar = rarity || 'Common';
    if (champOrElement && typeof champOrElement === 'object') {
      el = champOrElement.element || 'Water';
      rar = champOrElement.rarity || rar;
      // Explicit override list (future champ-unique kits)
      if (Array.isArray(champOrElement.skillIds) && champOrElement.skillIds.length) {
        return champOrElement.skillIds.slice();
      }
    } else if (typeof champOrElement === 'string') {
      el = champOrElement;
    }
    var kit = ELEMENT_SKILL_KITS[el] || ELEMENT_SKILL_KITS.Water;
    var slots = ['basic', 'signature', 'utility', 'ultimate'];
    var n = skillSlotCountForRarity(rar);
    var ids = [];
    var i;
    for (i = 0; i < n; i++) {
      var sid = kit[slots[i]];
      if (sid && ids.indexOf(sid) < 0) ids.push(sid);
    }
    if (!ids.length) ids.push('basic');
    return ids;
  }

  /**
   * Full skill objects for combat / UI (from kit or champ.skillIds).
   * @param {object} champ
   * @returns {object[]}
   */
  function getChampionSkills(champ) {
    champ = champ || {};
    var ids = getChampionSkillIds(champ);
    var out = [];
    var i;
    for (i = 0; i < ids.length; i++) {
      var def = SKILL_DEFS[ids[i]];
      if (def) {
        out.push(Object.assign({}, def));
      } else {
        out.push({ id: ids[i], name: ids[i], mult: 1, cd: 0, artKey: 'basic', artCategory: 'basic' });
      }
    }
    return out;
  }

  /** Campaign chapters (Raid-style: pick chapter → stage map) — expanded world if loaded */
  var CAMPAIGN_REGIONS = (CW && CW.CAMPAIGN_REGIONS && CW.CAMPAIGN_REGIONS.length)
    ? CW.CAMPAIGN_REGIONS
    : [
      {
        id: 'greenwild', name: 'Greenwild Forest', chapter: 'I — Soft Roots', chapterNum: 1,
        color: 0x1a5530, accent: 0x66ff99, mapBg: 0x0a2014,
        mapKey: 'map_greenwild', mapFile: 'greenwild.jpg',
        blurb: 'Moss paths and soft roots. Learn the gel way under living canopy.'
      },
      {
        id: 'crystal', name: 'Crystal Mountains', chapter: 'II — Hard Light', chapterNum: 2,
        color: 0x1a3355, accent: 0x88ddff, mapBg: 0x0a1524,
        mapKey: 'map_crystal', mapFile: 'crystal.jpg',
        blurb: 'Frozen spires and refracted light. Precision over soft mud.'
      },
      {
        id: 'shadowfen', name: 'Shadowfen Swamp', chapter: 'III — Wet Night', chapterNum: 3,
        color: 0x2a1a40, accent: 0xaa77ff, mapBg: 0x100c18,
        mapKey: 'map_shadowfen', mapFile: 'shadowfen.jpg',
        blurb: 'Mist, poison, and whispering bogs. Trust nothing that glows purple.'
      },
      {
        id: 'volcanic', name: 'Volcanic Wastes', chapter: 'IV — Open Vein', chapterNum: 4,
        color: 0x442211, accent: 0xff8844, mapBg: 0x180c08,
        mapKey: 'map_volcanic', mapFile: 'volcanic.jpg',
        blurb: 'Ash fields and open magma. Heat hardens even soft gel.'
      },
      {
        id: 'celestial', name: 'Celestial Peaks', chapter: 'V — Above Softness', chapterNum: 5,
        color: 0x2a2540, accent: 0xd4b0ff, mapBg: 0x0a0818,
        mapKey: 'map_celestial', mapFile: 'celestial.jpg',
        blurb: 'Star roads and silent thrones. The soft sky still has teeth.'
      }
    ];

  /**
   * Build campaign stages. Expanded world: 10 chapters × 15 stages (150) with blurbs.
   * Unlock order is linear across the full list (clear → next).
   */
  function buildCampaignStages() {
    if (CW && typeof CW.buildCampaignStages === 'function') {
      return CW.buildCampaignStages();
    }
    // Minimal fallback if expansion module missing
    return [
      {
        id: 'gw1', region: 'greenwild', chapter: 1, index: 1, name: 'Whispering Glade',
        power: 55, element: 'Plant', boss: false, mapX: 0.1, mapY: 0.48,
        blurb: 'Soft first step of the Softened Realms.', lore: 'Soft first step of the Softened Realms.'
      },
      {
        id: 'gw2', region: 'greenwild', chapter: 1, index: 2, name: 'Dewdrop Trail',
        power: 70, element: 'Water', boss: true, mapX: 0.5, mapY: 0.5,
        blurb: 'A short trail for boot fallback only.', lore: 'A short trail for boot fallback only.'
      }
    ];
  }

  var CAMPAIGN_STAGES = buildCampaignStages();

  function getStageLore(stage) {
    if (CW && typeof CW.getStageLore === 'function') return CW.getStageLore(stage);
    if (!stage) return '';
    return String(stage.blurb || stage.lore || '');
  }

  function generateChampionName(element, rarity, seed) {
    if (CN && typeof CN.generateChampionName === 'function') {
      return CN.generateChampionName(element, rarity, seed);
    }
    var species = (SPECIES && SPECIES[element]) || ((element || 'Gel') + ' Slime');
    return String(species).slice(0, 22);
  }

  /** Full HTML hub mode list — every mode must have a Phaser scene route */
  var HUB_MODES = [
    { id: 'campaign', label: 'Campaign', scene: 'CampaignScene', art: 'mode_campaign', artFile: 'campaign.jpg', tab: 0 },
    { id: 'dungeons', label: 'Dungeons', scene: 'DungeonScene', art: 'mode_dungeons', artFile: 'dungeons.jpg', tab: 1 },
    { id: 'champions', label: 'Champions', scene: 'RosterScene', art: 'mode_champions', artFile: 'champions.jpg', tab: 2 },
    { id: 'summon', label: 'Summon', scene: 'SummonScene', art: 'mode_summon', artFile: 'summon.jpg', tab: 10 },
    { id: 'vault', label: 'Vault', scene: 'VaultScene', art: 'mode_vault', artFile: 'vault.jpg', tab: 3 },
    { id: 'great_hall', label: 'Great Hall', scene: 'GreatHallScene', art: 'mode_great_hall', artFile: 'great-hall.jpg', tab: 4 },
    { id: 'alchemy', label: 'Alchemy', scene: 'AlchemyScene', art: 'mode_alchemy', artFile: 'alchemy.jpg', tab: 5 },
    { id: 'workshop', label: 'Workshop', scene: 'WorkshopScene', art: 'mode_workshop', artFile: 'workshop.jpg', tab: 6 },
    { id: 'market', label: 'Market', scene: 'MarketScene', art: 'mode_market', artFile: 'market.jpg', tab: 7 },
    { id: 'eternity', label: 'Eternity', scene: 'EternityScene', art: 'mode_eternity', artFile: 'eternity.jpg', tab: 8 },
    { id: 'chronicle', label: 'Chronicle', scene: 'ChronicleScene', art: 'mode_chronicle', artFile: 'chronicle.jpg', tab: 9 }
  ];

  /**
   * Dungeon set pools — clears only drop gear from these set names
   * (must match ARTIFACT_SETS keys). Campaign drops any set at random.
   */
  var DUNGEONS = [
    { id: 'forest_depths', name: 'Forest Depths', element: 'Plant', waves: 3, power: 120, gear: ['Life', 'Perception'] },
    { id: 'crystal_caverns', name: 'Crystal Caverns', element: 'Crystal', waves: 3, power: 160, gear: ['Perception', 'Defense'] },
    { id: 'shadow_abyss', name: 'Shadow Abyss', element: 'Shadow', waves: 3, power: 200, gear: ['Defense', 'Critical'] },
    { id: 'ancient_temple', name: 'Ancient Temple', element: 'Earth', waves: 3, power: 240, gear: ['Perception', 'Life'] },
    { id: 'molten_core', name: 'Molten Core', element: 'Fire', waves: 3, power: 280, gear: ['Offense', 'Critical'] },
    { id: 'glacial_spire', name: 'Glacial Spire', element: 'Ice', waves: 3, power: 320, gear: ['Defense', 'Life'] },
    { id: 'thunder_sanctum', name: 'Thunder Sanctum', element: 'Lightning', waves: 3, power: 360, gear: ['Speed', 'Offense'] },
    { id: 'abyssal_throne', name: 'Abyssal Throne', element: 'Shadow', waves: 3, power: 420, gear: ['Defense', 'Critical', 'Offense'] },
    { id: 'origin_core', name: 'Origin Core', element: 'Light', waves: 3, power: 500, gear: ['Life', 'Offense', 'Speed'] }
  ];

  /**
   * Apex Incursions — hard-realm raid bosses (geometry / hardened invaders),
   * not generic fantasy stock names. IDs stable for save keys & arena themes.
   */
  var BOSSES = [
    {
      id: 'fire_dragon',
      name: 'Cinderwyrm',
      title: 'Hard Vein Drake',
      element: 'Fire',
      power: 280,
      rec: 'Water / Ice',
      enemyKind: 'dragon',
      blurb: 'A drake whose scales calcified into pure angle — fire that forgot how to soften.'
    },
    {
      id: 'stone_golem',
      name: 'Ironmere Colossus',
      title: 'Angle-Bound Construct',
      element: 'Earth',
      power: 320,
      rec: 'Wind / Lightning',
      enemyKind: 'golem',
      blurb: 'Foundry stone given a grid-mind. Soft gel cracks where its footsteps land.'
    },
    {
      id: 'ancient_treant',
      name: 'Petrified Grove',
      title: 'Hardwood That Was Soft',
      element: 'Plant',
      power: 360,
      rec: 'Fire / Lava',
      enemyKind: 'plant',
      blurb: 'A grove the Void Cracks froze mid-sway — roots of living geometry.'
    },
    {
      id: 'shadow_lich',
      name: 'Soft-Eater',
      title: 'Umbral Crack-Lord',
      element: 'Shadow',
      power: 400,
      rec: 'Light / Spirit',
      enemyKind: 'undead',
      blurb: 'Feeds on gel-memory. Where it walks, names go thin and cold.'
    },
    {
      id: 'storm_sovereign',
      name: 'Storm Geometry',
      title: 'Sky-Angle Sovereign',
      element: 'Storm',
      power: 450,
      rec: 'Metal / Crystal',
      enemyKind: 'elemental',
      blurb: 'Lightning drawn on a ruler’s edge — a living theorem of the hard sky.'
    },
    {
      id: 'divine_colossus',
      name: 'Prism Idol',
      title: 'Hard Light Colossus',
      element: 'Light',
      power: 520,
      rec: 'Shadow / Void',
      enemyKind: 'humanoid',
      blurb: 'A idol of unsoftened light. Beauty without mercy; brilliance without give.'
    }
  ];

  /**
   * Fantasy hard-realm enemies (not gel champions).
   * kind drives 3D silhouette: beast|golem|humanoid|dragon|undead|plant|insect|elemental
   * Campaign regions + dungeon ids share pools.
   */
  /**
   * Reasonable hard-realm combatants only (creatures / raiders / constructs).
   * No terrain-as-enemy names (river, moss, ash-as-noun, etc.).
   */
  var ENEMY_POOLS = {
    greenwild: [
      { name: 'Timber Wolf', kind: 'beast', element: 'Earth' },
      { name: 'Bandit', kind: 'humanoid', element: 'Wind' },
      { name: 'Stone Golem', kind: 'golem', element: 'Earth' },
      { name: 'Wild Boar', kind: 'beast', element: 'Earth' },
      { name: 'Vine Crawler', kind: 'insect', element: 'Plant' },
      { name: 'Goblin Archer', kind: 'humanoid', element: 'Plant' },
      { name: 'Dire Stag', kind: 'beast', element: 'Plant' },
      { name: 'Treant Sapling', kind: 'plant', element: 'Plant' }
    ],
    crystal: [
      { name: 'Frost Wolf', kind: 'beast', element: 'Ice' },
      { name: 'Crystal Golem', kind: 'golem', element: 'Crystal' },
      { name: 'Ice Wraith', kind: 'undead', element: 'Ice' },
      { name: 'Cave Spider', kind: 'insect', element: 'Crystal' },
      { name: 'Mountain Raider', kind: 'humanoid', element: 'Metal' },
      { name: 'Frost Elemental', kind: 'elemental', element: 'Ice' },
      { name: 'Yeti', kind: 'beast', element: 'Ice' },
      { name: 'Ice Sentinel', kind: 'golem', element: 'Ice' }
    ],
    shadowfen: [
      { name: 'Swamp Serpent', kind: 'beast', element: 'Poison' },
      { name: 'Ghoul', kind: 'undead', element: 'Shadow' },
      { name: 'Will-o\'-Wisp', kind: 'elemental', element: 'Spirit' },
      { name: 'Swamp Stalker', kind: 'beast', element: 'Shadow' },
      { name: 'Cultist', kind: 'humanoid', element: 'Shadow' },
      { name: 'Giant Leech', kind: 'insect', element: 'Poison' },
      { name: 'Blight Treant', kind: 'plant', element: 'Plant' },
      { name: 'Mud Golem', kind: 'golem', element: 'Earth' }
    ],
    volcanic: [
      { name: 'Fire Drake', kind: 'dragon', element: 'Fire' },
      { name: 'Magma Golem', kind: 'golem', element: 'Lava' },
      { name: 'Imp', kind: 'humanoid', element: 'Fire' },
      { name: 'Fire Beetle', kind: 'insect', element: 'Lava' },
      { name: 'Hellhound', kind: 'beast', element: 'Fire' },
      { name: 'Obsidian Knight', kind: 'humanoid', element: 'Metal' },
      { name: 'Flame Elemental', kind: 'elemental', element: 'Fire' },
      { name: 'Lava Drake', kind: 'dragon', element: 'Lava' }
    ],
    celestial: [
      { name: 'Seraph', kind: 'humanoid', element: 'Light' },
      { name: 'Void Hound', kind: 'beast', element: 'Void' },
      { name: 'Astral Wraith', kind: 'undead', element: 'Spirit' },
      { name: 'Storm Herald', kind: 'humanoid', element: 'Lightning' },
      { name: 'Storm Elemental', kind: 'elemental', element: 'Storm' },
      { name: 'Marble Golem', kind: 'golem', element: 'Light' },
      { name: 'Void Drake', kind: 'dragon', element: 'Void' },
      { name: 'Celestial Guard', kind: 'humanoid', element: 'Light' }
    ],
    forest_depths: [
      { name: 'Dire Wolf', kind: 'beast', element: 'Earth' },
      { name: 'Shadow Panther', kind: 'beast', element: 'Shadow' },
      { name: 'Wood Golem', kind: 'golem', element: 'Earth' },
      { name: 'Giant Spider', kind: 'insect', element: 'Poison' },
      { name: 'Bandit Scout', kind: 'humanoid', element: 'Wind' }
    ],
    crystal_caverns: [
      { name: 'Cave Bat', kind: 'beast', element: 'Wind' },
      { name: 'Crystal Golem', kind: 'golem', element: 'Crystal' },
      { name: 'Crystal Spider', kind: 'insect', element: 'Crystal' },
      { name: 'Cave Shade', kind: 'undead', element: 'Shadow' }
    ],
    shadow_abyss: [
      { name: 'Abyss Crawler', kind: 'insect', element: 'Shadow' },
      { name: 'Dark Knight', kind: 'humanoid', element: 'Shadow' },
      { name: 'Void Hound', kind: 'beast', element: 'Void' },
      { name: 'Shadow Elemental', kind: 'elemental', element: 'Shadow' }
    ],
    ancient_temple: [
      { name: 'Temple Guard', kind: 'humanoid', element: 'Earth' },
      { name: 'Stone Idol', kind: 'golem', element: 'Earth' },
      { name: 'Cursed Priest', kind: 'undead', element: 'Spirit' },
      { name: 'Giant Scorpion', kind: 'insect', element: 'Earth' }
    ],
    molten_core: [
      { name: 'Fire Imp', kind: 'humanoid', element: 'Fire' },
      { name: 'Magma Beetle', kind: 'insect', element: 'Lava' },
      { name: 'Magma Golem', kind: 'golem', element: 'Lava' },
      { name: 'Fire Drake', kind: 'dragon', element: 'Fire' }
    ],
    glacial_spire: [
      { name: 'Ice Warden', kind: 'humanoid', element: 'Ice' },
      { name: 'Frost Golem', kind: 'golem', element: 'Ice' },
      { name: 'Ice Drake', kind: 'dragon', element: 'Ice' },
      { name: 'Frost Wraith', kind: 'undead', element: 'Spirit' }
    ],
    thunder_sanctum: [
      { name: 'Storm Acolyte', kind: 'humanoid', element: 'Lightning' },
      { name: 'Thunder Hawk', kind: 'beast', element: 'Wind' },
      { name: 'Lightning Elemental', kind: 'elemental', element: 'Lightning' },
      { name: 'Iron Golem', kind: 'golem', element: 'Metal' }
    ],
    abyssal_throne: [
      { name: 'Throne Guard', kind: 'humanoid', element: 'Shadow' },
      { name: 'Abyss Drake', kind: 'dragon', element: 'Shadow' },
      { name: 'Dread Knight', kind: 'undead', element: 'Shadow' },
      { name: 'Void Elemental', kind: 'elemental', element: 'Void' }
    ],
    origin_core: [
      { name: 'Origin Sentinel', kind: 'humanoid', element: 'Light' },
      { name: 'Primordial Golem', kind: 'golem', element: 'Light' },
      { name: 'Light Seraph', kind: 'humanoid', element: 'Spirit' },
      { name: 'Radiant Elemental', kind: 'elemental', element: 'Light' }
    ]
  };

  var BOSS_MINIONS = {
    fire_dragon: [
      { name: 'Hard Vein Spark', kind: 'dragon', element: 'Fire' },
      { name: 'Ash-Grid Hound', kind: 'beast', element: 'Fire' }
    ],
    stone_golem: [
      { name: 'Angle Shard', kind: 'golem', element: 'Earth' },
      { name: 'Foundry Wight', kind: 'undead', element: 'Earth' }
    ],
    ancient_treant: [
      { name: 'Hardwood Sapling', kind: 'plant', element: 'Plant' },
      { name: 'Geometry Vine', kind: 'insect', element: 'Plant' }
    ],
    shadow_lich: [
      { name: 'Name-Thinned Shade', kind: 'undead', element: 'Shadow' },
      { name: 'Crack Hound', kind: 'beast', element: 'Shadow' }
    ],
    storm_sovereign: [
      { name: 'Ruler-Edge Bolt', kind: 'elemental', element: 'Storm' },
      { name: 'Sky-Angle Acolyte', kind: 'humanoid', element: 'Lightning' }
    ],
    divine_colossus: [
      { name: 'Unsoftened Ray', kind: 'elemental', element: 'Light' },
      { name: 'Hard Light Guard', kind: 'humanoid', element: 'Light' }
    ]
  };

  var MARKET_ITEMS = [
    { id: 'jellyPack', name: 'Jelly Pack', cost: 50, currency: 'gold', grant: { jelly: 25 } },
    { id: 'manaPack', name: 'Mana Pack', cost: 120, currency: 'gold', grant: { manaShards: 15 } },
    { id: 'woodPack', name: 'Wood Pack', cost: 40, currency: 'gold', grant: { wood: 30 } },
    { id: 'herbPack', name: 'Herb Pack', cost: 35, currency: 'gold', grant: { herbs: 25 } },
    { id: 'shardPack', name: 'Slime Shard Pack', cost: 200, currency: 'gold', grant: { slimeShards: 40 } },
    { id: 'divinePack', name: 'Divine Shard Pack', cost: 350, currency: 'gold', grant: { divineShards: 40 } },
    { id: 'voidPack', name: 'Void Shard Pack', cost: 450, currency: 'gold', grant: { voidShards: 20 } }
  ];

  var ALCHEMY_RECIPES = [
    { id: 'wood_to_scrolls', name: 'Training Scrolls', cost: { wood: 45 }, grant: { trainingScrolls: 10 } },
    { id: 'stone_to_elixir', name: 'Battle Elixir', cost: { stone: 30, jelly: 15 }, grant: { battleElixir: 8 } },
    { id: 'herbs_to_salve', name: 'Healing Salve', cost: { herbs: 25, jelly: 10 }, grant: { healingSalve: 9 } },
    { id: 'berries_to_fertility', name: 'Fertility Potion', cost: { jelly: 35, berries: 20 }, grant: { fertilityPotion: 6 } },
    { id: 'essence_to_mana', name: 'Mana Infused Gel', cost: { slimeEssence: 15, manaShards: 12 }, grant: { focusElixir: 7 } },
    { id: 'shadow_to_silk', name: 'Shadow Silk', cost: { shadowEssence: 20, crystal: 10 }, grant: { shadowSilk: 5 } },
    { id: 'refine_essence', name: 'Refined Essence', cost: { slimeEssence: 20, jelly: 8 }, grant: { refinedEssence: 3 } },
    { id: 'make_explorer_tonic', name: "Explorer's Tonic", cost: { herbs: 20, jelly: 15, wood: 8 }, grant: { explorerTonic: 3 } },
    { id: 'make_power_serum', name: 'Power Serum', cost: { slimeEssence: 25, manaShards: 15, shadowEssence: 10 }, grant: {}, globalPower: 1.02 },
    { id: 'make_alchemical_catalyst', name: 'Alchemical Catalyst', cost: { refinedEssence: 30, divineShards: 8, arcaneDust: 15 }, grant: { alchemicalCatalyst: 1 } }
  ];

  var WORKSHOP_UPGRADES = [
    { id: 'incubator', name: 'Incubator', gold: 120, essence: 8, desc: 'Faster breeding / hatch bonuses' },
    { id: 'trainingHall', name: 'Training Hall', gold: 150, essence: 10, desc: 'Better training EXP' },
    { id: 'refinery', name: 'Refinery', gold: 180, essence: 12, desc: '+15% refined essence per level' }
  ];

  var PLAYER_STATS = [
    { id: 'taming', name: 'Taming', desc: '+3% better rarity' },
    { id: 'alchemy', name: 'Alchemy', desc: '+4% better yields' },
    { id: 'combat', name: 'Combat', desc: '+2.5% team power' },
    { id: 'leadership', name: 'Leadership', desc: '+1 party slot (cap 6)' },
    { id: 'endurance', name: 'Endurance', desc: '+5% daily rewards' }
  ];

  var MILESTONES = [
    { id: 'first_win', name: 'First Victory', check: function (s) { return (s.stats && s.stats.wins) >= 1; }, reward: { gold: 100 } },
    { id: 'ten_summons', name: 'Ten Summons', check: function (s) { return (s.stats && s.stats.summons) >= 10; }, reward: { slimeShards: 50 } },
    { id: 'roster_8', name: 'Party of Eight', check: function (s) { return (s.roster || []).length >= 8; }, reward: { divineShards: 5 } },
    { id: 'campaign_boss', name: 'Chapter Boss', check: function (s) {
      return s.campaign && s.campaign.progress && s.campaign.progress.gw5 && s.campaign.progress.gw5.stars >= 1;
    }, reward: { gold: 250, manaShards: 20 } },
    { id: 'dungeon_clear', name: 'Dungeon Delver', check: function (s) {
      return s.dungeons && Object.keys(s.dungeons.cleared || {}).length >= 1;
    }, reward: { jelly: 40 } }
  ];

  var SUMMON_RATES = {
    regular: { Common: 0.55, Uncommon: 0.28, Rare: 0.12, Epic: 0.04, Legendary: 0.01 },
    premium: { Rare: 0.55, Epic: 0.32, Legendary: 0.11, Mythic: 0.02 },
    ancient: { Epic: 0.5, Legendary: 0.35, Mythic: 0.15 }
  };

  /** Shard prices the summon path and banner UI both read. */
  var SUMMON_COSTS = {
    regular: { currency: 'slimeShards', one: 90, ten: 800 },
    premium: { currency: 'divineShards', one: 280, ten: 2500 },
    ancient: { currency: 'voidShards', one: 140, ten: 1260 }
  };

  /**
   * Hard pity: after `bound` pulls without the floor rarity, the next roll
   * is that rarity (or higher). Counters live on state.summon.pity*.
   */
  var SUMMON_PITY = {
    regular: { bound: 90, rarity: 'Legendary', counter: 'pityRegular' },
    premium: { bound: 60, rarity: 'Legendary', counter: 'pityPremium' },
    ancient: { bound: 30, rarity: 'Mythic', counter: 'pityAncient' }
  };

  var SPECIES = {
    Water: 'Aqua Slime', Fire: 'Blaze Slime', Earth: 'Terra Slime', Wind: 'Zephyr Slime',
    Plant: 'Bloom Slime', Lightning: 'Bolt Slime', Ice: 'Frost Slime', Shadow: 'Shade Slime',
    Light: 'Lumina Slime', Metal: 'Steel Sliime', Poison: 'Venom Sliime', Crystal: 'Prism Slime',
    Lava: 'Magma Slime', Storm: 'Tempest Slime', Spirit: 'Wisp Slime', Void: 'Abyss Slime'
  };
  // fix typos
  SPECIES.Metal = 'Steel Slime';
  SPECIES.Poison = 'Venom Slime';

  var ELEMENT_LORE = {
    Water: { title: 'Tideborn', role: 'Controller', affinity: 'Extinguishes Fire & Lava', personality: 'Calm, adaptive', signature: 'Splash / Mend', blurb: 'Tidal gel that flows around threats and cools the field.', extended: 'Tideborn cores form where rivers meet wild essence. They favor control and sustain over raw smash.' },
    Fire: { title: 'Emberkin', role: 'Striker', affinity: 'Burns Plant, Ice, Wind', personality: 'Bold, restless', signature: 'Blaze / Inferno', blurb: 'Living heat that thrives on pressure and aggressive tempos.', extended: 'Emberkin rise from forge vents and dry summer wilds. They hit hard and hate standing still.' },
    Earth: { title: 'Stoneward', role: 'Guardian', affinity: 'Grounds Lightning & Fire', personality: 'Steady, stubborn', signature: 'Crush / Gel Shield', blurb: 'Dense mineral gel that anchors the line and soaks blows.', extended: 'Stoneward cores sleep under hills until a Haven-Keeper wakes them with patience and stone-song.' },
    Wind: { title: 'Zephyr', role: 'Skirmisher', affinity: 'Scours Plant, Poison, Earth', personality: 'Playful, fleeting', signature: 'Bolt / Rush', blurb: 'Airy gel that darts between foes and softens impact.', extended: 'Zephyr slime rides storm edges and ridge winds, never staying one shape for long.' },
    Plant: { title: 'Bloomkin', role: 'Support', affinity: 'Drinks Water & Earth', personality: 'Gentle, stubborn growth', signature: 'Mend / Bloom', blurb: 'Living sap that knits wounds and slow-binds the careless.', extended: 'Bloomkin bloom after rain in Greenwild clearings; they heal allies and root the ground.' },
    Lightning: { title: 'Stormcore', role: 'Burst DPS', affinity: 'Shocks Water, Wind, Metal', personality: 'Sharp, impatient', signature: 'Bolt / Chain', blurb: 'Crackling gel that builds meter faster than most.', extended: 'Stormcores gather on peaks where thunder kisses the Softened Realms.' },
    Ice: { title: 'Frostgel', role: 'Control', affinity: 'Chills Water, Plant, Wind', personality: 'Cool, precise', signature: 'Crush / Freeze', blurb: 'Brittle-looking but exact — freezes openings for the party.', extended: 'Frostgel packs the high passes and glacial spires of chapter two.' },
    Shadow: { title: 'Shade', role: 'Assassin', affinity: 'Devours Light, Spirit, Void', personality: 'Quiet, cunning', personality2: 'Quiet', signature: 'Venom / Fade', blurb: 'Night-ink gel that slips past defenses and poisons focus.', extended: 'Shade cores pool under ruins where sunlight rarely reaches.' },
    Light: { title: 'Lumina', role: 'Support / Purge', affinity: 'Banishes Shadow, Void, Poison', personality: 'Bright, earnest', signature: 'Mend / Radiance', blurb: 'Warm radiance gel that restores and reveals weak points.', extended: 'Lumina gather near shrines and Origin Core echoes.' },
    Metal: { title: 'Steelgel', role: 'Bruiser', affinity: 'Cuts Lightning, Ice, Crystal', personality: 'Hard, loyal', signature: 'Crush / Edge', blurb: 'Forged slime with a dense shell and heavy swings.', extended: 'Steelgel forms in abandoned workshops and mineral veins.' },
    Poison: { title: 'Venomkin', role: 'DoT / Debuff', affinity: 'Corrodes Plant, Water, Spirit', personality: 'Sly, patient', signature: 'Venom / Cloud', blurb: 'Toxic gel that weakens foes over time.', extended: 'Venomkin prefer bog mists and alchemical spill sites.' },
    Crystal: { title: 'Prism', role: 'Hybrid', affinity: 'Refracts Shadow, Void, Lightning', personality: 'Curious, brittle-bright', signature: 'Bolt / Prism', blurb: 'Faceted gel that bends energy and sparkles under stress.', extended: 'Prism cores grow in deep crystal caverns.' },
    Lava: { title: 'Magma', role: 'Heavy Striker', affinity: 'Melts Plant, Ice, Metal', personality: 'Fierce, slow-burn', signature: 'Inferno / Slam', blurb: 'Molten core that erupts after a long charge.', extended: 'Magma kin sleep under volcano calderas until war drums shake them free.' },
    Storm: { title: 'Tempest', role: 'AoE Control', affinity: 'Sweeps Wind, Lightning, Water', personality: 'Wild, free', signature: 'Bolt / Gale', blurb: 'A living squall of gel and charge.', extended: 'Tempest slime rides hurricane skirts along coastal cliffs.' },
    Spirit: { title: 'Wisp', role: 'Support / Hex', affinity: 'Touches Shadow, Poison, Void', personality: 'Dreamy, kind', signature: 'Mend / Haunt', blurb: 'Soft spirit gel that soothes allies and unsettles foes.', extended: 'Wisps drift near old battlefields where memory still hums.' },
    Void: { title: 'Abyss', role: 'Specialist', affinity: 'Unmakes Light, Shadow, Spirit', personality: 'Distant, hungry', signature: 'Venom / Collapse', blurb: 'Rare null-gel that eats patterns other elements rely on.', extended: 'Abyss cores surface only near Eternity rifts and Void Tower floors.' }
  };

  /**
   * Fixed star count by rarity (does not change when you evolve).
   * Evolution turns stars purple (awakened) — max purples = base stars.
   * Common 1 → Uncommon 2 → Rare 3 → Epic 4 → Legendary 5 → Mythic 6
   */
  var RARITY_BASE_STARS = {
    Common: 1,
    Uncommon: 2,
    Rare: 3,
    Epic: 4,
    Legendary: 5,
    Mythic: 6
  };

  var RARITY_LORE = {
    Common: { blurb: 'Everyday gel — soft blob, eager to grow.', bio: 'Common cores form freely in the wilds as simple blobby masses; little form control yet.', stars: 1 },
    Uncommon: { blurb: 'A sharper spark of will and color.', bio: 'Uncommon slimes stay mostly blobby, with the first hints of stubby nubs and personality.', stars: 2 },
    Rare: { blurb: 'Hardened by rare essence veins.', bio: 'Rare champions firm their affinity; some begin pushing soft blob-arms when stressed.', stars: 3 },
    Epic: { blurb: 'Morph form control — clear blob-arms.', bio: 'Epic gel can hold semi-shaped tentacle arms while remaining a slime mass in battle, and rises to an Ascended shaped torso at three awakenings.', stars: 4 },
    Legendary: { blurb: 'Named legend with an Ascended silhouette.', bio: 'Legendary cores hold an Ascended form (shaped torso, arms, element armor) and become Shape-Bound near-humanoid gel at five awakenings.', stars: 5 },
    Mythic: { blurb: 'Once-per-era gel, Shape-Bound by default.', bio: 'Mythic gel arrives Shape-Bound: a near-humanoid gel figure with face, hands, and drips, always gel at the core.', stars: 6 }
  };

  /** Fixed base stars from rarity only (saved baseStars is rewritten on load). */
  function getBaseStars(champOrRarity) {
    var rar = typeof champOrRarity === 'string'
      ? champOrRarity
      : (champOrRarity && champOrRarity.rarity) || 'Common';
    if (RARITY_BASE_STARS[rar] != null) return RARITY_BASE_STARS[rar];
    var lore = RARITY_LORE[rar];
    return lore && lore.stars != null ? lore.stars : 1;
  }

  /**
   * Purple (awakened) stars — how many times evolved.
   * Uses evolutionLevel as the stored count (legacy-compatible).
   */
  function getPurpleStars(champ) {
    if (!champ) return 0;
    var base = getBaseStars(champ);
    if (base <= 0) return 0; // no star path
    var n = champ.purpleStars != null ? champ.purpleStars : (champ.evolutionLevel || 0);
    n = Math.max(0, Math.floor(Number(n) || 0));
    return Math.min(base, n);
  }

  /** True if more purple stars can still be filled. */
  function canEvolveStars(champ) {
    if (!champ) return false;
    var base = getBaseStars(champ);
    if (base <= 0) return false;
    return getPurpleStars(champ) < base;
  }

  /**
   * Fodder count required to awaken the next star.
   * Progressive: 1st purple needs 1 same-star food, 2nd needs 2, …
   */
  function fodderNeededForNextEvo(champ) {
    if (!canEvolveStars(champ)) return 0;
    return getPurpleStars(champ) + 1;
  }

  /** Base level cap before any purple stars. Each purple +10 to cap. */
  var CHAMPION_BASE_MAX_LEVEL = 50;
  var CHAMPION_LEVEL_PER_PURPLE = 10;

  /**
   * Max level for a champion: 50 + (purpleStars × 10).
   * Must be at this cap to awaken the next purple star.
   */
  function getChampionMaxLevel(champ) {
    var purple = getPurpleStars(champ);
    return CHAMPION_BASE_MAX_LEVEL + purple * CHAMPION_LEVEL_PER_PURPLE;
  }

  /** Level required to perform the next evolution (current cap). */
  function getEvolveLevelRequirement(champ) {
    if (!canEvolveStars(champ)) return null;
    return getChampionMaxLevel(champ);
  }

  /**
   * Traits — family tags drive synergy readout + stacked bonuses.
   * family: combat | training | economy | bloodline
   */
  var TRAIT_DEFINITIONS = {
    quick_learner: {
      name: 'Quick Learner', tier: 'Common', family: 'training',
      desc: '+8% EXP from training.', expMul: 1.08
    },
    training_focused: {
      name: 'Training Focused', tier: 'Uncommon', family: 'training',
      desc: '+14% EXP from training missions.', expMul: 1.14
    },
    endurance_specialist: {
      name: 'Endurance Specialist', tier: 'Rare', family: 'training',
      desc: '+22% EXP from long training.', expMul: 1.22
    },
    training_prodigy: {
      name: 'Training Prodigy', tier: 'Epic', family: 'training',
      desc: '+30% EXP from all training.', expMul: 1.30
    },
    combat_instinct: {
      name: 'Combat Instinct', tier: 'Common', family: 'combat',
      desc: '+6% ATK / HP / DEF (combat stats).', powerMul: 1.06
    },
    elemental_adept: {
      name: 'Elemental Adept', tier: 'Uncommon', family: 'combat',
      desc: '+8% damage on strong affinity matchups.', affinityBonus: 0.08
    },
    combat_veteran: {
      name: 'Combat Veteran', tier: 'Rare', family: 'combat',
      desc: '+18% ATK / HP / DEF.', powerMul: 1.18
    },
    battle_hardened: {
      name: 'Battle Hardened', tier: 'Epic', family: 'combat',
      desc: '+25% ATK / HP / DEF · slight taken reduction.', powerMul: 1.25, damageTaken: 0.97
    },
    jelly_producer: {
      name: 'Jelly Producer', tier: 'Common', family: 'economy',
      desc: 'Extra Jelly from parties.', jellyMul: 1.12
    },
    resourceful: {
      name: 'Resourceful', tier: 'Uncommon', family: 'economy',
      desc: '+12% exploration resources.', resourceMul: 1.12
    },
    essence_harvester: {
      name: 'Essence Harvester', tier: 'Rare', family: 'economy',
      desc: '+20% essence from dungeons.', essenceMul: 1.20
    },
    stable_bloodline: {
      name: 'Stable Bloodline', tier: 'Common', family: 'bloodline',
      desc: 'Slightly better breeding rarity.', breedBonus: 0.04
    },
    rare_lineage: {
      name: 'Rare Lineage', tier: 'Rare', family: 'bloodline',
      desc: '+15% breeding rarity odds.', breedBonus: 0.15
    }
  };

  /**
   * Synergy recipes — self (on one champ) or party (across roster in battle).
   * min: trait count needed in the family or listed keys.
   */
  var TRAIT_SYNERGIES = [
    {
      id: 'blade_instinct',
      name: 'Blade Instinct',
      scope: 'self',
      family: 'combat',
      min: 2,
      blurb: 'Two combat traits — sharper strikes',
      mods: { atk: 1.05, critAdd: 3 }
    },
    {
      id: 'iron_gel',
      name: 'Iron Gel',
      scope: 'self',
      requires: ['battle_hardened'],
      withFamily: 'combat',
      minExtra: 1,
      blurb: 'Battle Hardened + another combat trait',
      mods: { damageTaken: 0.96, def: 1.06 }
    },
    {
      id: 'scholar_path',
      name: 'Scholar Path',
      scope: 'self',
      family: 'training',
      min: 2,
      blurb: 'Twin training traits — faster growth',
      mods: { expMul: 1.10 }
    },
    {
      id: 'soft_economy',
      name: 'Soft Economy',
      scope: 'self',
      family: 'economy',
      min: 2,
      blurb: 'Twin economy traits — richer spoils',
      mods: { resourceMul: 1.08 }
    },
    {
      id: 'true_line',
      name: 'True Line',
      scope: 'self',
      family: 'bloodline',
      min: 2,
      blurb: 'Stable + Rare lineage',
      mods: { breedBonus: 0.08 }
    },
    // Party-wide (checked on full party trait bag)
    {
      id: 'war_council',
      name: 'War Council',
      scope: 'party',
      family: 'combat',
      min: 3,
      blurb: '3+ combat traits in party — meter pressure',
      mods: { spd: 1.04, atk: 1.03 }
    },
    {
      id: 'study_circle',
      name: 'Study Circle',
      scope: 'party',
      family: 'training',
      min: 2,
      blurb: '2+ training traits in party — shared EXP edge',
      mods: { expMul: 1.06 }
    },
    {
      id: 'foragers',
      name: 'Foragers',
      scope: 'party',
      family: 'economy',
      min: 2,
      blurb: '2+ economy traits — better campaign spoils',
      mods: { resourceMul: 1.05 }
    },
    {
      id: 'blood_bond',
      name: 'Blood Bond',
      scope: 'party',
      family: 'bloodline',
      min: 2,
      blurb: '2+ bloodline traits — party resolve',
      mods: { hp: 1.04, res: 1.05 }
    }
  ];

  /**
   * Six artifact slots (Raid kit layout order for UI).
   * stat = main stat key applied from the piece.
   */
  var ARTIFACT_SLOTS = [
    { id: 'weapon', name: 'Weapon', icon: '⚔️', stat: 'atk', short: 'WPN' },
    { id: 'helm', name: 'Helm', icon: '⛑️', stat: 'hp', short: 'HLM' },
    { id: 'shield', name: 'Shield', icon: '🛡️', stat: 'hp', short: 'SHD' },
    { id: 'gloves', name: 'Gauntlets', icon: '🧤', stat: 'atk', short: 'GNT' },
    { id: 'chest', name: 'Chest', icon: '🦺', stat: 'hp', short: 'CHT' },
    { id: 'boots', name: 'Boots', icon: '👢', stat: 'spd', short: 'BTS' }
  ];
  // Legacy id aliases (saves may use armor/ring)
  ARTIFACT_SLOTS._legacy = { armor: 'chest', ring: 'gloves' };

  /**
   * Artifact sets — Raid-style bonuses (2pc / 4pc when UI shows progress).
   * color = hex for borders / kit glow.
   */
  var ARTIFACT_SETS = {
    Life: {
      name: 'Life', color: '#4ade80', colorNum: 0x4ade80,
      bonus: '2pc HP +8%  ·  4pc HP +15%',
      bonus2: 'HP +8%', bonus4: 'HP +15%',
      blurb: 'Soft growth and lasting gel'
    },
    Offense: {
      name: 'Offense', color: '#f87171', colorNum: 0xf87171,
      bonus: '2pc ATK +8%  ·  4pc ATK +15%',
      bonus2: 'ATK +8%', bonus4: 'ATK +15%',
      blurb: 'Hard strikes for Soft-Binders'
    },
    Defense: {
      name: 'Defense', color: '#94a3b8', colorNum: 0x94a3b8,
      bonus: '2pc Taken −6%  ·  4pc Taken −12%',
      bonus2: 'Taken −6%', bonus4: 'Taken −12%',
      blurb: 'Stone-steady shells'
    },
    Speed: {
      name: 'Speed', color: '#86efac', colorNum: 0x86efac,
      bonus: '2pc SPD +6%  ·  4pc SPD +12%',
      bonus2: 'SPD +6%', bonus4: 'SPD +12%',
      blurb: 'First to fill the turn meter'
    },
    Critical: {
      name: 'Critical', color: '#fbbf24', colorNum: 0xfbbf24,
      bonus: '2pc Crit +8%  ·  4pc Crit +16%',
      bonus2: 'Crit +8%', bonus4: 'Crit +16%',
      blurb: 'Precision cracks in hard geometry'
    },
    Perception: {
      name: 'Perception', color: '#fde047', colorNum: 0xfde047,
      bonus: '2pc Affinity +4%  ·  4pc Affinity +8%',
      bonus2: 'Affinity +4%', bonus4: 'Affinity +8%',
      blurb: 'See the soft path through battle'
    }
  };

  /**
   * Piece names by set × slot (never "Weapon of Life" on a helm).
   * Raid-style: set flavour + correct piece type.
   */
  var ARTIFACT_PIECE_NAMES = {
    Life: {
      weapon: 'Living Edge', helm: 'Vital Circlet', shield: 'Heartguard',
      gloves: 'Bloom Gauntlets', chest: 'Sapwood Plate', boots: 'Rootwalkers',
      armor: 'Sapwood Plate', ring: 'Bloom Band'
    },
    Offense: {
      weapon: 'Savage Cleaver', helm: 'Warhelm', shield: 'Bloodward',
      gloves: 'Crimson Fists', chest: 'Raid Cuirass', boots: 'Strikestep Boots',
      armor: 'Raid Cuirass', ring: 'Blood Signet'
    },
    Defense: {
      weapon: 'Bastion Spear', helm: 'Iron Circlet', shield: 'Bulwark',
      gloves: 'Stone Gauntlets', chest: 'Rampart Plate', boots: 'Anchor Greaves',
      armor: 'Rampart Plate', ring: 'Iron Band'
    },
    Speed: {
      weapon: 'Gale Blade', helm: 'Swift Cap', shield: 'Windguard',
      gloves: 'Zephyr Grips', chest: 'Skysail Coat', boots: 'Windwalkers',
      armor: 'Skysail Coat', ring: 'Gale Ring'
    },
    Critical: {
      weapon: 'Precision Edge', helm: 'Hawk Visor', shield: 'Focus Guard',
      gloves: 'Keen Gauntlets', chest: 'Markplate', boots: 'Huntstep Boots',
      armor: 'Markplate', ring: 'Hawk Signet'
    },
    Perception: {
      weapon: 'Seer\'s Needle', helm: 'Oracle Hood', shield: 'Aegis of Sight',
      gloves: 'Rune Grips', chest: 'Insight Robe', boots: 'Pathfinders',
      armor: 'Insight Robe', ring: 'Oracle Band'
    }
  };

  /** Resolve display name for a set + slot (RSL-style piece title). */
  function artifactPieceName(setName, slotId) {
    var set = String(setName || 'Life');
    var slot = String(slotId || 'weapon');
    // Legacy slot aliases
    if (slot === 'armor') slot = 'chest';
    if (slot === 'ring') slot = 'gloves';
    var pack = ARTIFACT_PIECE_NAMES[set];
    if (pack && pack[slot]) return pack[slot];
    var slots = ARTIFACT_SLOTS;
    var sd = null;
    var i;
    for (i = 0; i < slots.length; i++) {
      if (slots[i].id === slot) { sd = slots[i]; break; }
    }
    var piece = (sd && sd.name) || 'Relic';
    return set + ' ' + piece;
  }

  var GUIDE_NPC = {
    id: 'lyra',
    name: 'Lyra Softbough',
    title: 'Haven Loremistress',
    race: 'Woodland elf',
    portrait: 'assets/characters/lyra-guide.jpg',
    greeting: 'Welcome home, Keeper.'
  };

  var PLAYER_INTRO = {
    title: 'A Soft Beginning',
    dismissLabel: 'I am ready, Lyra',
    namePrompt: {
      kicker: 'Your name',
      speaker: 'Lyra Softbough',
      body:
        'Before you step into the Haven, tell me what the Softened Realms should call you. ' +
        'Speak your name, Keeper — I will write it on the village records.',
      placeholder: 'Your name…',
      confirmLabel: 'That is my name',
      skipLabel: 'Call me Keeper',
      defaultName: 'Keeper',
      maxLen: 18
    },
    pages: [
      {
        kicker: 'Welcome',
        speaker: 'Lyra Softbough',
        body:
          'Welcome home, Keeper. I am Lyra Softbough — loremistress of this Haven. ' +
          'You are the soft-blooded soul the Primordial Gel chose: a Haven-Keeper, a slime tamer, a Soft-Binder. ' +
          'You build this Village, bond living gel into Champions, and stand behind them when hard geometry invades the map.'
      },
      {
        kicker: 'Your calling',
        speaker: 'Lyra Softbough',
        body:
          'As a child a Void Crack opened above your hamlet. A Tideborn slime melted a hard-shard into rain on your arms and stayed. ' +
          'That bond woke the Keeper sense — you hear Element-songs others mistake for weather. ' +
          'Without Keepers, gel drifts mindless or dies as glass. With you, the Softened Realms still have a chance to remain soft.'
      },
      {
        kicker: 'The threat',
        speaker: 'Lyra Softbough',
        body:
          'The Void Cracks widen. Hard-realm invaders freeze, burn, and shatter what should stay fluid. ' +
          'Your Haven is a warm lamp on a map that wants to become pure angles. ' +
          'Bond Champions, equip soft relics, and push the cracks back — from Greenwild Forest through Crystal Mountains, ' +
          'Shadowfen, Volcanic Wastes, Tidecall Coast, Ironmere, Stormmarch, Celestial Peaks, and Voidmarch — until Origin Nexus.'
      },
      {
        kicker: 'Your first steps',
        speaker: 'Lyra Softbough',
        body:
          'I will guide you gently, as finished Havens always do for new Keepers. ' +
          'Begin on Greenwild’s Whispering Glade — Act I, Soft Roots. Campaign opens the map; Champions hold your party; ' +
          'Vault and Artifacts grow their soft power; Summon answers when shards allow. ' +
          'When you are ready, say the word — Chronicle holds me if you ever wish to hear the ten acts again.'
      }
    ]
  };

  var TUTORIAL_STEPS = [
    {
      id: 'village',
      title: 'Your Haven',
      target: 'hub',
      speech:
        'This is your Village — the soft heart of your story. Portals ring the green: Campaign, Dungeons, Champions, Summon, and more. ' +
        'Currencies rest in the bar above. You never fight alone while this Haven stands.'
    },
    {
      id: 'campaign',
      title: 'Campaign trails',
      target: 'campaign',
      speech:
        'Open Campaign when you are ready to explore. Start in Greenwild Forest — Whispering Glade, first step of Act I Soft Roots. ' +
        'Explore a node, win the arena with skills or Auto, and claim soft spoils. Nine more chapters wait beyond, ending at Origin Nexus.'
    },
    {
      id: 'champions',
      title: 'Champions & party',
      target: 'champions',
      speech:
        'In Champions you tend your roster and choose a party of up to five for battle. ' +
        'Tap a slime to open their detail — Stats, Lore, Traits, and Artifacts. Lock the ones you love so fusion cannot steal them.'
    },
    {
      id: 'artifacts',
      title: 'Artifacts & sets',
      target: 'vault',
      speech:
        'The Vault and champion Artifacts tabs hold soft relics with hard usefulness. ' +
        'Pieces belong to sets: Life, Offense, Defense, Speed, and more. Two pieces wake a set bonus. Equip them on your champions to grow their power.'
    },
    {
      id: 'summon',
      title: 'Summon & Chronicle',
      target: 'summon',
      speech:
        'Summon when shards allow — new gel answers the portal. Chronicle holds the codex and your story with me. ' +
        'You know enough to begin, Keeper. Greenwild is breathing. Let us make it proud.'
    }
  ];

  var LORE = {
    premise:
      'In the Softened Realms, living gel and wild essence birthed the slimes. ' +
      'Haven-Keepers — Soft-Binders — bond champions against Void Cracks and hard-realm geometry. ' +
      'Lyra Softbough of the Haven keeps Chronicle so place-names and gel names are not erased.',
    acts: (SL && SL.STORY_ACTS && SL.STORY_ACTS.length)
      ? SL.STORY_ACTS.map(function (a) {
        return { title: a.title, text: a.body, regionId: a.regionId, act: a.act };
      })
      : [
        { title: 'Act I — Soft Roots', text: 'Clear Greenwild glades and learn the gel way under living canopy while Void Cracks remain distant rumors.' },
        { title: 'Act II — Hard Light', text: 'Crystal peaks test precision with ice and prism light before soft gel meets true hard geometry.' },
        { title: 'Act III — Wet Night', text: 'Shadowfen mists hide poison and shade; Keepers refuse to let the bog freeze into angles.' },
        { title: 'Act IV — Open Vein', text: 'Volcanic wastes wake Emberkin and Magma kin as ash falls like hard snow.' },
        { title: 'Act V — Primordial Heart', text: 'The climb ends at Origin Nexus where soft essence first learned to hold shape — or begins again.' }
      ],
    elements: ELEMENTS.map(function (el) {
      var pack = ELEMENT_LORE[el] || {};
      return {
        element: el,
        blurb: pack.blurb || (el + ' gel shapes champions of the ' + (SPECIES[el] || el) + ' line.'),
        title: pack.title,
        role: pack.role
      };
    })
  };

  function getAffinityMultiplier(atkEl, defEl) {
    var chart = ELEMENT_CHART[atkEl];
    if (!chart) return 1;
    if (chart.strong && chart.strong.indexOf(defEl) >= 0) return 1.35;
    if (chart.weak && chart.weak.indexOf(defEl) >= 0) return 0.72;
    return 1;
  }

  function slimeArtKey(element, variant) {
    var e = String(element || 'water').toLowerCase();
    var v = String(variant || 'a').toLowerCase();
    if (v !== 'a' && v !== 'b' && v !== 'c') v = 'a';
    // Canonical: combat full-body sprites with pose variants
    return 'assets/battle/gels/combat/' + e + '_' + v + '.jpg';
  }

  /**
   * Ordered Phaser texture keys to try for a skill circle plate.
   * Prefer unique artKey → skill id → artCategory → basic.
   * @param {object|string} skill skill instance or id string
   * @returns {string[]}
   */
  function skillArtTextureCandidates(skill) {
    var id = '';
    var sk = skill;
    if (typeof skill === 'string') {
      id = skill;
      sk = SKILL_DEFS[id] || { id: id };
    } else if (skill && skill.id) {
      id = String(skill.id);
    }
    var def = SKILL_DEFS[id] || {};
    var keys = [];
    function add(k) {
      if (!k) return;
      k = String(k);
      if (keys.indexOf('skill_' + k) < 0) keys.push('skill_' + k);
    }
    add(sk.artKey || def.artKey);
    add(id);
    add(sk.artCategory || def.artCategory);
    // Heuristic category if def missing
    if (sk.heal || def.heal) add('heal');
    if (id === 'shield' || /shield|buff|guard/i.test((sk.name || def.name || ''))) add('buff');
    if (sk.aoe || def.aoe) add('ranged');
    add('basic');
    return keys;
  }

  function getRarityColor(rarity) {
    return ({
      Common: '#9ca3af', Uncommon: '#22c55e', Rare: '#3b82f6',
      Epic: '#a855f7', Legendary: '#f59e0b', Mythic: '#ef4444'
    })[rarity] || '#9ca3af';
  }

  /**
   * Form ladder (4 tiers, matches docs/HERO_DESIGN.md §2):
   *   blob     — Common, Uncommon, most Rare
   *   morph    — Epic, ~1 in 3 Rare, anything at evo 2+
   *   ascended — Legendary, Epic at evo 3+
   *   humanoid — Mythic, Legendary at evo 5+ (Shape-Bound)
   * An explicit formTier wins; the legacy key 'shaped' maps to 'humanoid'.
   */
  function resolveFormTier(slime) {
    if (!slime) return 'blob';
    if (slime.formTier === 'humanoid' || slime.formTier === 'shaped') return 'humanoid';
    if (slime.formTier === 'ascended') return 'ascended';
    if (slime.formTier === 'morph') return 'morph';
    if (slime.formTier === 'blob') return 'blob';
    var r = slime.rarity || 'Common';
    var evo = slime.evolutionLevel || 0;
    var seed = slime.id != null ? slime.id : (slime.name || slime.element || '0');
    if (r === 'Mythic') return 'humanoid';
    if (r === 'Legendary' && evo >= 5) return 'humanoid';
    if (r === 'Legendary' || (r === 'Epic' && evo >= 3)) return 'ascended';
    if (r === 'Epic' || evo >= 2) return 'morph';
    // Some Rare begin forming blob-arms (~1 in 3), same as combat art
    if (r === 'Rare') {
      var h = 2166136261;
      var s = String(seed);
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      if (((h >>> 0) % 3) === 0) return 'morph';
    }
    return 'blob';
  }

  function getElementLore(element) {
    var el = ELEMENT_LORE[element];
    if (el) return el;
    return {
      title: element || 'Unknown', role: 'Wild', affinity: 'Uncharted',
      personality: '???', signature: 'Goo Strike',
      blurb: 'An unclassified gel signature.', extended: ''
    };
  }

  function getChampionLoreBlurb(slime) {
    if (!slime) return null;
    var el = getElementLore(slime.element);
    var rar = RARITY_LORE[slime.rarity] || RARITY_LORE.Common;
    if (SL && typeof SL.buildChampionLore === 'function') {
      return SL.buildChampionLore(slime, el, rar, resolveFormTier);
    }
    var form = resolveFormTier(slime);
    var formText = form === 'humanoid' ? 'Shape-bound mythic presence'
      : form === 'ascended' ? 'Shaped form control'
      : form === 'morph' ? 'Morphing blob-arms'
      : 'Classic blobby gel';
    var championBio = (el.extended || el.blurb || '') + ' ' + (rar.bio || rar.blurb || '');
    championBio = championBio.trim();
    if (championBio.length < 120) {
      championBio += ' Softened Realms Keepers record such bonds so hard geometry never erases a name without a story.';
    }
    return {
      elementTitle: el.title,
      role: el.role,
      blurb: el.blurb,
      extended: el.extended || el.blurb,
      personality: el.personality,
      signature: el.signature,
      affinity: el.affinity,
      rarityBlurb: rar.blurb,
      championBio: championBio,
      history: championBio,
      bio: championBio,
      formText: formText,
      form: form,
      rarity: slime.rarity || 'Common',
      nameLine: (slime.name || el.title) + ' — ' + (slime.element || '') + ' ' + (el.title || '')
    };
  }

  function getStoryActs() {
    if (SL && typeof SL.getStoryActs === 'function') return SL.getStoryActs();
    return (LORE.acts || []).map(function (a, i) {
      return { act: i + 1, title: a.title, body: a.text || a.body || '', regionId: a.regionId || null };
    });
  }

  function rollTraitsForRarity(rarity) {
    var keys = Object.keys(TRAIT_DEFINITIONS);
    var chance = ({ Common: 0.35, Uncommon: 0.5, Rare: 0.7, Epic: 0.85, Legendary: 0.95, Mythic: 1 })[rarity] || 0.4;
    var out = [];
    if (Math.random() > chance) return out;
    var first = keys[Math.floor(Math.random() * keys.length)];
    out.push(first);
    if (Math.random() < 0.35 && rarity !== 'Common') {
      var second = keys[Math.floor(Math.random() * keys.length)];
      if (second !== first) out.push(second);
    }
    return out;
  }

  function traitFamily(key) {
    var d = TRAIT_DEFINITIONS[key];
    return (d && d.family) || 'combat';
  }

  function countTraitFamilies(traits) {
    var counts = { combat: 0, training: 0, economy: 0, bloodline: 0 };
    (traits || []).forEach(function (t) {
      var f = traitFamily(t);
      if (counts[f] != null) counts[f] += 1;
      else counts[f] = 1;
    });
    return counts;
  }

  /**
   * Self synergies for one champion's trait list.
   * @returns {{ active: object[], mods: object, lines: string[] }}
   */
  function computeSelfTraitSynergies(traits) {
    traits = traits || [];
    var set = {};
    traits.forEach(function (t) { set[t] = true; });
    var fam = countTraitFamilies(traits);
    var active = [];
    var mods = {
      atk: 1, hp: 1, def: 1, spd: 1, res: 1,
      critAdd: 0, damageTaken: 1, affinityBonus: 0,
      expMul: 1, resourceMul: 1, breedBonus: 0
    };

    TRAIT_SYNERGIES.forEach(function (syn) {
      if (syn.scope !== 'self') return;
      var ok = false;
      if (syn.family && fam[syn.family] >= (syn.min || 2)) ok = true;
      if (syn.requires && syn.requires.length) {
        var hasReq = syn.requires.every(function (k) { return set[k]; });
        if (!hasReq) ok = false;
        else if (syn.withFamily) {
          var extra = fam[syn.withFamily] - syn.requires.filter(function (k) {
            return traitFamily(k) === syn.withFamily;
          }).length;
          ok = extra >= (syn.minExtra || 1);
        } else ok = true;
      }
      if (!ok) return;
      active.push(syn);
      var m = syn.mods || {};
      if (m.atk) mods.atk *= m.atk;
      if (m.hp) mods.hp *= m.hp;
      if (m.def) mods.def *= m.def;
      if (m.spd) mods.spd *= m.spd;
      if (m.res) mods.res *= m.res;
      if (m.critAdd) mods.critAdd += m.critAdd;
      if (m.damageTaken) mods.damageTaken *= m.damageTaken;
      if (m.affinityBonus) mods.affinityBonus += m.affinityBonus;
      if (m.expMul) mods.expMul *= m.expMul;
      if (m.resourceMul) mods.resourceMul *= m.resourceMul;
      if (m.breedBonus) mods.breedBonus += m.breedBonus;
    });

    // Base trait effects (stack from definitions)
    traits.forEach(function (t) {
      var d = TRAIT_DEFINITIONS[t];
      if (!d) return;
      if (d.powerMul) {
        mods.atk *= d.powerMul;
        mods.hp *= d.powerMul;
        mods.def *= d.powerMul;
      }
      if (d.affinityBonus) mods.affinityBonus += d.affinityBonus;
      if (d.damageTaken) mods.damageTaken *= d.damageTaken;
      if (d.expMul) mods.expMul *= d.expMul;
      if (d.resourceMul) mods.resourceMul *= d.resourceMul;
      if (d.essenceMul) mods.resourceMul *= d.essenceMul;
      if (d.jellyMul) mods.resourceMul *= d.jellyMul;
      if (d.breedBonus) mods.breedBonus += d.breedBonus;
    });

    var lines = active.map(function (s) {
      return s.name + ' — ' + s.blurb;
    });
    return { active: active, mods: mods, lines: lines, families: fam };
  }

  /**
   * Party synergies from all traits across party champions.
   * @param {object[]} party — champion-like objects with .traits
   */
  function computePartyTraitSynergies(party) {
    party = party || [];
    var bag = [];
    party.forEach(function (c) {
      (c && c.traits || []).forEach(function (t) { bag.push(t); });
    });
    var fam = countTraitFamilies(bag);
    var active = [];
    var mods = {
      atk: 1, hp: 1, def: 1, spd: 1, res: 1,
      critAdd: 0, damageTaken: 1, affinityBonus: 0,
      expMul: 1, resourceMul: 1
    };
    TRAIT_SYNERGIES.forEach(function (syn) {
      if (syn.scope !== 'party') return;
      if (syn.family && fam[syn.family] >= (syn.min || 2)) {
        active.push(syn);
        var m = syn.mods || {};
        if (m.atk) mods.atk *= m.atk;
        if (m.hp) mods.hp *= m.hp;
        if (m.def) mods.def *= m.def;
        if (m.spd) mods.spd *= m.spd;
        if (m.res) mods.res *= m.res;
        if (m.critAdd) mods.critAdd += m.critAdd;
        if (m.damageTaken) mods.damageTaken *= m.damageTaken;
        if (m.expMul) mods.expMul *= m.expMul;
        if (m.resourceMul) mods.resourceMul *= m.resourceMul;
      }
    });
    var lines = active.map(function (s) {
      return s.name + ' — ' + s.blurb;
    });
    // Progress hints for near-synergies
    var hints = [];
    TRAIT_SYNERGIES.forEach(function (syn) {
      if (syn.scope !== 'party' || !syn.family) return;
      var n = fam[syn.family] || 0;
      var need = syn.min || 2;
      if (n > 0 && n < need) {
        hints.push(syn.name + ' (' + n + '/' + need + ' ' + syn.family + ')');
      }
    });
    return {
      active: active,
      mods: mods,
      lines: lines,
      hints: hints,
      families: fam,
      traitCount: bag.length
    };
  }

  /** Full trait readout for UI (self + optional party context). */
  function getTraitSynergyReadout(champ, party) {
    var self = computeSelfTraitSynergies((champ && champ.traits) || []);
    var partySyn = party && party.length
      ? computePartyTraitSynergies(party)
      : { active: [], lines: [], hints: [], mods: {}, families: {} };
    return {
      self: self,
      party: partySyn,
      allLines: self.lines.concat(partySyn.lines || [])
    };
  }

  /**
   * Count equipped pieces per artifact set (skips legacy armor/ring dupes).
   */
  function countEquipmentSets(equipment) {
    var counts = {};
    var eq = equipment || {};
    var seenIds = {};
    Object.keys(eq).forEach(function (slot) {
      if (slot === 'armor' || slot === 'ring') return;
      var piece = eq[slot];
      if (!piece) return;
      if (piece.id != null) {
        if (seenIds[piece.id]) return;
        seenIds[piece.id] = true;
      }
      var sn = piece.set || piece.setName || '';
      if (!sn) return;
      counts[sn] = (counts[sn] || 0) + 1;
    });
    return counts;
  }

  /**
   * Raid-style set bonus modifiers from equipped kit.
   * 2pc unlocks, 4pc strengthens (matches ARTIFACT_SETS copy).
   */
  function computeSetBonusMods(equipment) {
    var counts = countEquipmentSets(equipment);
    var mods = {
      hp: 1,
      atk: 1,
      spd: 1,
      critAdd: 0,
      damageTaken: 1,
      affinityAdd: 0,
      sets: []
    };
    Object.keys(counts).forEach(function (sn) {
      var n = counts[sn];
      if (n < 2) return;
      var tier = n >= 4 ? 4 : 2;
      mods.sets.push({ set: sn, count: n, tier: tier });
      if (sn === 'Life') {
        mods.hp *= (tier === 4 ? 1.15 : 1.08);
      } else if (sn === 'Offense') {
        mods.atk *= (tier === 4 ? 1.15 : 1.08);
      } else if (sn === 'Defense') {
        mods.damageTaken *= (tier === 4 ? 0.88 : 0.94);
      } else if (sn === 'Speed') {
        mods.spd *= (tier === 4 ? 1.12 : 1.06);
      } else if (sn === 'Critical') {
        mods.critAdd += (tier === 4 ? 16 : 8);
      } else if (sn === 'Perception') {
        mods.affinityAdd += (tier === 4 ? 0.08 : 0.04);
      }
    });
    return mods;
  }

  /**
   * Raid-style champion Power Score from final stats.
   * Plarium: HP is primary; then SPD, C.RATE, damage stats, RES; ACC weaker
   * unless debuffs (we keep a soft ACC weight). Exact Raid formula is private —
   * this mirrors the public priority ranking + community reverse-engineering shape.
   *
   * @param {object} s { hp, atk, def, spd, crit, critDmg, res, acc }
   * @returns {number} integer power score
   */
  function computeRaidPowerScore(s) {
    s = s || {};
    var hp = Math.max(0, Number(s.hp) || 0);
    var atk = Math.max(0, Number(s.atk) || 0);
    var def = Math.max(0, Number(s.def) || 0);
    var spd = Math.max(0, Number(s.spd) || 0);
    var crit = Math.max(0, Math.min(100, Number(s.crit) || 0));       // C.RATE %
    var critDmg = Math.max(0, Number(s.critDmg) != null ? Number(s.critDmg) : 50); // C.DMG %
    var res = Math.max(0, Number(s.res) || 0);
    var acc = Math.max(0, Number(s.acc) || 0);

    // Weights for OUR stat ranges (HP hundreds–low thousands, not Raid 10k–50k).
    // Relative priority matches Plarium: HP key → SPD / CRate / dmg / RES → ACC.
    var score =
      hp * 0.50 +          // Health Points (primary)
      atk * 1.40 +         // Attack (damage)
      def * 1.30 +         // Defense
      spd * 2.20 +         // Speed (high impact in Raid ranking)
      crit * 4.50 +        // Critical Rate points
      critDmg * 1.70 +     // Critical Damage points
      res * 1.55 +         // Debuff Resistance
      acc * 0.85;          // Debuff Accuracy (less impact without debuff kits)

    // Soft floor so brand-new champs never show 0 PWR
    return Math.max(80, Math.floor(score));
  }

  function computeChampionAttributes(slime) {
    slime = slime || {};
    // Base power is permanent storage (growth seed); display PWR is Raid-scored from stats
    var basePwr = Math.max(28, Math.floor(Number(slime.power) || 80));
    if (!isFinite(basePwr) || basePwr > 100000) basePwr = 80;
    var level = slime.level || 1;
    var evo = slime.purpleStars != null ? slime.purpleStars : (slime.evolutionLevel || 0);
    evo = Math.max(0, Math.floor(Number(evo) || 0));
    var eq = slime.equipment || {};

    // Trait + synergy mods (self only here; party synergies applied at battle start)
    var traitSyn = computeSelfTraitSynergies(slime.traits || []);
    var tMods = traitSyn.mods;

    var atk = Math.floor(basePwr * 0.28) + level * 2 + evo * 4;
    var hp = Math.floor(basePwr * 2.1) + level * 8 + evo * 12;
    var spd = Math.floor(88 + level * 3.2 + basePwr * 0.05 + evo * 2);
    var def = Math.floor(basePwr * 0.12) + level + evo * 2;
    var res = Math.floor(basePwr * 0.1) + Math.floor(level * 0.8) + evo;
    var acc = Math.floor(basePwr * 0.08) + Math.floor(level * 0.7) + evo * 2;
    Object.keys(eq).forEach(function (slot) {
      if (slot === 'armor' || slot === 'ring') return;
      var piece = eq[slot];
      if (!piece) return;
      var v = Math.min(200, (piece.value || 0) + (piece.level || 0) * 2);
      if (piece.mainStat === 'atk' || slot === 'weapon' || slot === 'gloves') atk += v;
      else if (piece.mainStat === 'hp' || slot === 'helm' || slot === 'chest' || slot === 'shield' || slot === 'armor') hp += v * 3;
      else if (piece.mainStat === 'spd' || slot === 'boots') spd += Math.floor(v * 0.8);
      else if (piece.mainStat === 'def') def += v;
      else if (piece.mainStat === 'res') res += v;
      else if (piece.mainStat === 'acc') acc += v;
      else if (piece.mainStat === 'power') { atk += Math.floor(v * 0.4); hp += v; def += Math.floor(v * 0.25); }
    });

    // Apply trait self-mods
    atk = Math.floor(atk * (tMods.atk || 1));
    hp = Math.floor(hp * (tMods.hp || 1));
    def = Math.floor(def * (tMods.def || 1));
    spd = Math.floor(spd * (tMods.spd || 1));
    res = Math.floor(res * (tMods.res || 1));

    // Raid set bonuses (2pc / 4pc) — live in combat via attributes
    var setMods = computeSetBonusMods(eq);
    atk = Math.floor(atk * setMods.atk);
    hp = Math.floor(hp * setMods.hp);
    spd = Math.floor(spd * setMods.spd);
    // Defense set soft-bumps DEF for score/display (damageTakenMul still combat path)
    if (setMods.damageTaken < 1) {
      def = Math.floor(def * (1 + (1 - setMods.damageTaken) * 0.9));
    }

    var crit = 8 + evo * 2 + ((slime.rarity === 'Legendary' || slime.rarity === 'Mythic') ? 6 : 0);
    crit += setMods.critAdd + (tMods.critAdd || 0);
    // Crit Damage % — Raid default ~50%, grows lightly with evo/rarity
    var critDmg = 50 + evo * 5 +
      ((slime.rarity === 'Legendary' || slime.rarity === 'Mythic') ? 10 :
        (slime.rarity === 'Epic' ? 5 : 0));
    // Critical set: small C.DMG bump at 4pc feel
    if (setMods.critAdd >= 16) critDmg += 12;
    else if (setMods.critAdd >= 8) critDmg += 5;
    // Perception set soft-bumps ACC (debuff edge)
    if (setMods.affinityAdd > 0) {
      acc = Math.floor(acc * (1 + setMods.affinityAdd * 2.5));
    }

    var damageTakenMul = setMods.damageTaken * (tMods.damageTaken || 1);
    var affinityBonus = (setMods.affinityAdd || 0) + (tMods.affinityBonus || 0);

    // Optional party synergy mods (when caller passes _partySynergyMods)
    var pMods = slime._partySynergyMods || null;
    if (pMods) {
      atk = Math.floor(atk * (pMods.atk || 1));
      hp = Math.floor(hp * (pMods.hp || 1));
      def = Math.floor(def * (pMods.def || 1));
      spd = Math.floor(spd * (pMods.spd || 1));
      res = Math.floor(res * (pMods.res || 1));
      if (pMods.critAdd) crit += pMods.critAdd;
      if (pMods.damageTaken) damageTakenMul *= pMods.damageTaken;
    }

    // Display / ranking power = Raid-style weighted stats (not raw basePwr)
    var pwr = computeRaidPowerScore({
      hp: hp, atk: atk, def: def, spd: spd,
      crit: crit, critDmg: critDmg, res: res, acc: acc
    });

    return {
      power: pwr,
      basePower: basePwr,
      atk: atk,
      hp: hp,
      def: def,
      res: res,
      acc: acc,
      spd: spd,
      crit: crit,
      critDmg: critDmg,
      // Combat multipliers from sets + traits (also used by SR_COMBAT)
      damageTakenMul: damageTakenMul,
      affinityBonus: affinityBonus,
      setBonuses: setMods.sets,
      traitSynergies: traitSyn.active,
      traitSynergyLines: traitSyn.lines,
      expMul: tMods.expMul || 1,
      resourceMul: tMods.resourceMul || 1
    };
  }

  global.SR_DATA = {
    ELEMENTS: ELEMENTS,
    ELEMENT_CHART: ELEMENT_CHART,
    RARITY_POWER: RARITY_POWER,
    SKILL_DEFS: SKILL_DEFS,
    SKILL_ART_CATEGORIES: SKILL_ART_CATEGORIES,
    SKILL_ART_KEYS: SKILL_ART_KEYS,
    ELEMENT_SKILL_KITS: ELEMENT_SKILL_KITS,
    skillArtTextureCandidates: skillArtTextureCandidates,
    skillSlotCountForRarity: skillSlotCountForRarity,
    getChampionSkillIds: getChampionSkillIds,
    getChampionSkills: getChampionSkills,
    ELEMENT_SKILL: ELEMENT_SKILL,
    CAMPAIGN_STAGES: CAMPAIGN_STAGES,
    CAMPAIGN_REGIONS: CAMPAIGN_REGIONS,
    HUB_MODES: HUB_MODES,
    DUNGEONS: DUNGEONS,
    BOSSES: BOSSES,
    ENEMY_POOLS: ENEMY_POOLS,
    BOSS_MINIONS: BOSS_MINIONS,
    MARKET_ITEMS: MARKET_ITEMS,
    ALCHEMY_RECIPES: ALCHEMY_RECIPES,
    WORKSHOP_UPGRADES: WORKSHOP_UPGRADES,
    PLAYER_STATS: PLAYER_STATS,
    MILESTONES: MILESTONES,
    SUMMON_RATES: SUMMON_RATES,
    SUMMON_COSTS: SUMMON_COSTS,
    SUMMON_PITY: SUMMON_PITY,
    SPECIES: SPECIES,
    LORE: LORE,
    GUIDE_NPC: GUIDE_NPC,
    PLAYER_INTRO: PLAYER_INTRO,
    TUTORIAL_STEPS: TUTORIAL_STEPS,
    ELEMENT_LORE: ELEMENT_LORE,
    RARITY_LORE: RARITY_LORE,
    RARITY_BASE_STARS: RARITY_BASE_STARS,
    TRAIT_DEFINITIONS: TRAIT_DEFINITIONS,
    TRAIT_SYNERGIES: TRAIT_SYNERGIES,
    traitFamily: traitFamily,
    countTraitFamilies: countTraitFamilies,
    computeSelfTraitSynergies: computeSelfTraitSynergies,
    computePartyTraitSynergies: computePartyTraitSynergies,
    getTraitSynergyReadout: getTraitSynergyReadout,
    ARTIFACT_SLOTS: ARTIFACT_SLOTS,
    ARTIFACT_SETS: ARTIFACT_SETS,
    ARTIFACT_PIECE_NAMES: ARTIFACT_PIECE_NAMES,
    artifactPieceName: artifactPieceName,
    getAffinityMultiplier: getAffinityMultiplier,
    slimeArtKey: slimeArtKey,
    getRarityColor: getRarityColor,
    resolveFormTier: resolveFormTier,
    getElementLore: getElementLore,
    getChampionLoreBlurb: getChampionLoreBlurb,
    getStageLore: getStageLore,
    getStoryActs: getStoryActs,
    generateChampionName: generateChampionName,
    HERO_ROSTER: HR,
    getNamedHero: function (el, rar) { return HR && HR.getNamedHero ? HR.getNamedHero(el, rar) : null; },
    rollTraitsForRarity: rollTraitsForRarity,
    computeChampionAttributes: computeChampionAttributes,
    computeRaidPowerScore: computeRaidPowerScore,
    countEquipmentSets: countEquipmentSets,
    computeSetBonusMods: computeSetBonusMods,
    getBaseStars: getBaseStars,
    getPurpleStars: getPurpleStars,
    canEvolveStars: canEvolveStars,
    fodderNeededForNextEvo: fodderNeededForNextEvo,
    CHAMPION_BASE_MAX_LEVEL: CHAMPION_BASE_MAX_LEVEL,
    CHAMPION_LEVEL_PER_PURPLE: CHAMPION_LEVEL_PER_PURPLE,
    getChampionMaxLevel: getChampionMaxLevel,
    getEvolveLevelRequirement: getEvolveLevelRequirement
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SR_DATA;
  }
})(typeof window !== 'undefined' ? window : global);
