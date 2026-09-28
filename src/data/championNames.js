/* ===== Element-aware champion name banks + generator =====
 * Used by createChampion / summon. Deterministic when seed provided.
 */
(function (global) {
  'use strict';

  var MAX_NAME_LEN = 22;

  /** Per-element given names / cores (large pools). */
  var ELEMENT_NAMES = {
    Water: [
      'Tide', 'Ripple', 'Mirel', 'Brook', 'Neris', 'Kelp', 'Foam', 'Brine', 'Coral', 'Dew',
      'Lumenwave', 'Softcurrent', 'Marrowsea', 'Gill', 'Pearl', 'Cascade', 'Lagoon', 'Mistfin',
      'Aqualin', 'Silt', 'Harbor', 'Rivulet', 'Nacre', 'Whirl', 'Mistral-deep', 'Sponge',
      'Plume', 'Eddy', 'Shoreling', 'Rainwell', 'Marrowtide', 'Azurel', 'Drench', 'Softsalt'
    ],
    Fire: [
      'Ember', 'Cinder', 'Pyra', 'Scorch', 'Kindle', 'Flare', 'Ashen', 'Brand', 'Hearth', 'Coal',
      'Solflare', 'Forgeheart', 'Glimmer', 'Blazen', 'Torch', 'Smolder', 'Vesta', 'Ignis',
      'Char', 'Furnace', 'Spark', 'Pyre', 'Heatling', 'Lavafin', 'Crimson', 'Warmcore',
      'Brandish', 'Kindlewood', 'Soot', 'Flint', 'Pyrelight', 'Ashsong', 'Emberkin', 'Sunblot'
    ],
    Earth: [
      'Terra', 'Moss', 'Gran', 'Loam', 'Boulder', 'Clay', 'Root', 'Pebble', 'Marrowstone', 'Hill',
      'Stoneward', 'Ridge', 'Marble', 'Ochre', 'Dust', 'Quarry', 'Mound', 'Basalt',
      'Soil', 'Cairn', 'Warden', 'Grit', 'Earthen', 'Slab', 'Thornsoil', 'Bedrock',
      'Moundkin', 'Gravel', 'Softstone', 'Cliff', 'Dale', 'Humus', 'Rubble', 'Anchor'
    ],
    Wind: [
      'Zephyr', 'Gale', 'Siroc', 'Wispwind', 'Breeze', 'Draft', 'Skirl', 'Mistral', 'Feather', 'Gust',
      'Airy', 'Softgust', 'Cloudling', 'Whisper', 'Kite', 'Spiral', 'Eddywind', 'Skyfin',
      'Flutter', 'Haze', 'Ridgewind', 'Puff', 'Aeros', 'Drift', 'Vane', 'Softsky',
      'Cyclin', 'Boreal', 'Sheer', 'Winglet', 'Curl', 'Nimbus', 'Sailsong', 'Updraft'
    ],
    Plant: [
      'Bloom', 'Sprout', 'Fern', 'Mossy', 'Petal', 'Ivy', 'Thorn', 'Sap', 'Grove', 'Seed',
      'Bloomkin', 'Lichen', 'Bramble', 'Willow', 'Clover', 'Orchid', 'Vine', 'Canopy',
      'Rootlet', 'Greenheart', 'Mossveil', 'Blossom', 'Sappy', 'Leaf', 'Briar', 'Pollen',
      'Softwood', 'Meadow', 'Bud', 'Tendril', 'Chlor', 'Mossbell', 'Honeysap', 'Verdant'
    ],
    Lightning: [
      'Bolt', 'Arc', 'Spark', 'Jolt', 'Volt', 'Flash', 'Static', 'Ion', 'Thunder', 'Crack',
      'Stormcore', 'Fulgur', 'Zap', 'Charge', 'Lumenbolt', 'Skyspark', 'Wire', 'Pulse',
      'Striker', 'Coil', 'Nimbuspark', 'Amp', 'Shock', 'Galvan', 'Livewire', 'Sparkfen',
      'Boltkin', 'Arcane-flash', 'Current', 'Surge', 'Razorflash', 'Skyneedle', 'Cracklip', 'Ionheart'
    ],
    Ice: [
      'Frost', 'Rime', 'Glace', 'Hail', 'Shard', 'Snow', 'Chill', 'Crystalice', 'Sleet', 'Hoar',
      'Frostgel', 'Icelin', 'Glacier', 'Nip', 'Winter', 'Pale', 'Frostbite', 'Clearice',
      'Softfreeze', 'Icewell', 'Rimebell', 'Flurry', 'Perma', 'Glassfrost', 'Chillkin', 'Snowcap',
      'Iceheart', 'Shiver', 'Coldwell', 'Frostsong', 'Aurorine', 'Boreal-soft', 'Icebloom', 'Quietice'
    ],
    Shadow: [
      'Shade', 'Dusk', 'Murk', 'Gloam', 'Umbra', 'Night', 'Veil', 'Gloom', 'Silent', 'Wraith',
      'Shadowfen', 'Dim', 'Noir', 'Crypt', 'Softnight', 'Duskveil', 'Penumbra', 'Hush',
      'Ink', 'Hollow', 'Nightwillow', 'Fade', 'Gloamkin', 'Murklin', 'Shadewell', 'Blackroot',
      'Quietdark', 'Softshade', 'Eventide', 'Umbral', 'Nightbell', 'Sable', 'Duskmire', 'Obscura'
    ],
    Light: [
      'Lumina', 'Radiant', 'Glow', 'Halo', 'Dawn', 'Beacon', 'Sol', 'Shine', 'Aure', 'Prismlight',
      'Softsun', 'Lumen', 'Gleam', 'Bright', 'Daywell', 'Haloed', 'Lucent', 'Goldray',
      'Morning', 'Candela', 'Shrine', 'Warmlight', 'Luminel', 'Sunsoft', 'Glowkin', 'Ray',
      'Aurelin', 'Daybell', 'Lighthollow', 'Kindlelight', 'Palegrace', 'Lumenheart', 'Radios', 'Glimmer'
    ],
    Metal: [
      'Steel', 'Iron', 'Chrome', 'Alloy', 'Forge', 'Anvil', 'Nail', 'Wire', 'Ingot', 'Plate',
      'Steelgel', 'Silversoft', 'Copper', 'Tin', 'Ore', 'Hammer', 'Gear', 'Boltmetal',
      'Quench', 'Smelt', 'Softsteel', 'Riveter', 'Chain', 'Blade', 'Foundry', 'Slag',
      'Ironmere', 'Gilt', 'Marrowiron', 'Clink', 'Tempered', 'Softiron', 'Metalkin', 'Anvilheart'
    ],
    Poison: [
      'Venom', 'Toxin', 'Bile', 'Miasma', 'Asp', 'Nettle', 'Acrid', 'Vile', 'Slick', 'Sting',
      'Venomkin', 'Poisonfen', 'Blight', 'Serpent', 'Marrowbile', 'Softvenom', 'Gall', 'Sporetox',
      'Ichor', 'Fang', 'Nightasp', 'Corrode', 'Venomwell', 'Tangletox', 'Sickle', 'Mirevenom',
      'Acidsoft', 'Viper', 'Blightkin', 'Toxinbell', 'Ashvenom', 'Softgall', 'Venomsong', 'Nettleheart'
    ],
    Crystal: [
      'Prism', 'Facet', 'Quartz', 'Jewel', 'Shard', 'Opal', 'Gleamcrystal', 'Geo', 'Lattice', 'Sparkle',
      'Prismcore', 'Crystaline', 'Gem', 'Refract', 'Softprism', 'Amethyst', 'Diamondust', 'Clearshell',
      'Facetkin', 'Crystalwell', 'Shinefacet', 'Mirrorgel', 'Quartzbell', 'Prismheart', 'Geode', 'Luster',
      'Crystalpath', 'Softshard', 'Jewelkin', 'Faceted', 'Glimmerice', 'Prismarch', 'Crystal song', 'Opaline'
    ],
    Lava: [
      'Magma', 'Scoria', 'Basalt', 'Cinderflow', 'Pyroclast', 'Molten', 'Caldera', 'Obsid', 'Flow', 'Heatvein',
      'Magmakin', 'Lavafin', 'Crater', 'Ashflow', 'Softmagma', 'Emberflow', 'Slagheart', 'Veinfire',
      'Furnacegel', 'Magmabelt', 'Hotwell', 'Cinderkin', 'Basaltsoft', 'Lava song', 'Moltenbell', 'Crust',
      'Openvein', 'Magmacrown', 'Heatkin', 'Scoriasoft', 'Flowstone', 'Magmaheart', 'Pyreflow', 'Calderin'
    ],
    Storm: [
      'Tempest', 'Squall', 'Galeheart', 'Hurricane', 'Monsoon', 'Thunder', 'Cloudburst', 'Deluge', 'Front', 'Pressure',
      'Tempestkin', 'Stormbell', 'Skysquall', 'Softstorm', 'Galechoir', 'Stormwell', 'Rainlash', 'Windlash',
      'Stormcore', 'Nimbus', 'Cyclone', 'Stormarch', 'Thunderfin', 'Skybreak', 'Stormsong', 'Wetlightning',
      'Tempestheart', 'Stormkin', 'Cloudcut', 'Stormmarch', 'Galeprism', 'Stormlip', 'Raincore', 'Skywrack'
    ],
    Spirit: [
      'Wisp', 'Echo', 'Haunt', 'Soul', 'Memory', 'Dream', 'Phantom', 'Softghost', 'Remnant', 'Muse',
      'Wispkin', 'Spiritwell', 'Echogel', 'Kindred', 'Afterglow', 'Spiritbell', 'Marrowsoul', 'Quietname',
      'Softspirit', 'Hauntkin', 'Dreamfin', 'Soulwell', 'Wispsong', 'Spiritheart', 'Echoed', 'Gentlehaunt',
      'Spiritarch', 'Muse gel', 'Remnantkin', 'Dreamwell', 'Soulsoft', 'Wispbell', 'Memory gel', 'Kindhaunt'
    ],
    Void: [
      'Abyss', 'Null', 'Rift', 'Hollow', 'Absence', 'Unmake', 'Quietvoid', 'Crack', 'Nil', 'Empty',
      'Abysskin', 'Voidwell', 'Nullgel', 'Riftfin', 'Softvoid', 'Voidbell', 'Unmade', 'Cracklip',
      'Voidmarch', 'Nullheart', 'Abysssong', 'Riftkin', 'Hollowsoft', 'Voidcore', 'Nilwell', 'Emptysong',
      'Voidarch', 'Crackwell', 'Abysshell', 'Nullsoft', 'Riftsong', 'Voidkin', 'Unmaking', 'Quietcrack'
    ]
  };

  var SUFFIXES = [
    '', '', '', // often no suffix
    'kin', 'gel', 'soft', 'well', 'bell', 'heart', 'song',
    'fin', 'core', 'ling', 'bloom', 'ward', 'veil', 'march', 'path'
  ];

  var RARITY_PREFIX = {
    Common: ['', '', 'Little ', 'Soft '],
    Uncommon: ['', 'Bright ', 'Keen ', 'True '],
    Rare: ['', 'Deep ', 'Wild ', 'High '],
    Epic: ['', 'Grand ', 'Storm-', 'Elder '],
    Legendary: ['', 'Lord ', 'Lady ', 'Named ', 'Great '],
    Mythic: ['', 'Mythic ', 'Primordial ', 'Origin ', 'Eternal ']
  };

  function hashStr(str) {
    var h = 2166136261;
    var s = String(str || '0');
    var i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(arr, h, salt) {
    if (!arr || !arr.length) return '';
    var x = (h + (salt || 0) * 2654435761) >>> 0;
    return arr[x % arr.length];
  }

  /**
   * Generate a champion display name.
   * @param {string} element
   * @param {string} [rarity]
   * @param {string|number} [seed] — id/name for determinism
   */
  function generateChampionName(element, rarity, seed) {
    var el = String(element || 'Water');
    // normalize title case key
    var key = el.charAt(0).toUpperCase() + el.slice(1).toLowerCase();
    if (key === 'Lightning') key = 'Lightning';
    var pool = ELEMENT_NAMES[key] || ELEMENT_NAMES.Water;
    var rar = rarity || 'Common';
    var h = hashStr(seed != null ? seed : (el + '|' + rar + '|' + Math.random()));
    var core = pick(pool, h, 1);
    var suf = pick(SUFFIXES, h, 2);
    // Avoid double suffix if core already ends with it
    var name = core;
    if (suf && core.toLowerCase().indexOf(suf.toLowerCase()) < 0 && core.length + suf.length <= MAX_NAME_LEN) {
      // Space only for wordy suffixes rarely — prefer concat for gel feel
      if (suf === 'song' || suf === 'path' || suf === 'march' || suf === 'ward') {
        name = core + suf;
      } else if (suf === 'kin' || suf === 'gel' || suf === 'soft' || suf === 'well' ||
                 suf === 'bell' || suf === 'heart' || suf === 'fin' || suf === 'core' ||
                 suf === 'ling' || suf === 'bloom' || suf === 'veil') {
        name = core + suf;
      } else {
        name = core + suf;
      }
    }
    var prefPool = RARITY_PREFIX[rar] || RARITY_PREFIX.Common;
    var pref = pick(prefPool, h, 3);
    // Epic+ sometimes get prefix; Common rarely
    if (pref && (rar === 'Legendary' || rar === 'Mythic' || (h % 5 === 0))) {
      var withPref = (pref + name).trim();
      if (withPref.length <= MAX_NAME_LEN) name = withPref;
    }
    name = String(name).replace(/\s+/g, ' ').trim();
    if (name.length > MAX_NAME_LEN) name = name.slice(0, MAX_NAME_LEN).trim();
    if (!name) name = (key + ' Gel').slice(0, MAX_NAME_LEN);
    return name;
  }

  var API = {
    MAX_NAME_LEN: MAX_NAME_LEN,
    ELEMENT_NAMES: ELEMENT_NAMES,
    generateChampionName: generateChampionName,
    hashStr: hashStr
  };

  global.SR_CHAMPION_NAMES = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : global);
