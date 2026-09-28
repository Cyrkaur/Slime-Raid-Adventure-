/* ===== Expanded campaign world — 10 chapters, 150 linear stages =====
 * Softened Realms chronology: Soft Roots → Origin Nexus.
 * Pure data for Node tests + browser (global.SR_CAMPAIGN_WORLD).
 */
(function (global) {
  'use strict';

  /**
   * Ten campaign regions in story order (chapterNum 1..10).
   * mapKey reuses existing map art where files exist; later chapters share celestial/volcanic/etc.
   */
  var CAMPAIGN_REGIONS = [
    {
      id: 'greenwild', name: 'Greenwild Forest', chapter: 'I — Soft Roots', chapterNum: 1,
      color: 0x1a5530, accent: 0x66ff99, mapBg: 0x0a2014,
      mapKey: 'map_greenwild', mapFile: 'greenwild.jpg',
      blurb: 'Moss paths and living canopy. The Haven’s first soft frontier, where Keepers learn to hear Element-song under leaf-light.'
    },
    {
      id: 'crystal', name: 'Crystal Mountains', chapter: 'II — Hard Light', chapterNum: 2,
      color: 0x1a3355, accent: 0x88ddff, mapBg: 0x0a1524,
      mapKey: 'map_crystal', mapFile: 'crystal.jpg',
      blurb: 'Frozen spires and prism shelves. Hard geometry first tests soft gel with ice, metal, and refracted light.'
    },
    {
      id: 'shadowfen', name: 'Shadowfen Swamp', chapter: 'III — Wet Night', chapterNum: 3,
      color: 0x2a1a40, accent: 0xaa77ff, mapBg: 0x100c18,
      mapKey: 'map_shadowfen', mapFile: 'shadowfen.jpg',
      blurb: 'Mist, poison, and whispering bogs. The Softened Realms grow secretive as Void-stained water claims the lowlands.'
    },
    {
      id: 'volcanic', name: 'Volcanic Wastes', chapter: 'IV — Open Vein', chapterNum: 4,
      color: 0x442211, accent: 0xff8844, mapBg: 0x180c08,
      mapKey: 'map_volcanic', mapFile: 'volcanic.jpg',
      blurb: 'Ash fields and open magma. Heat hardens even soft gel; Emberkin and Magma kin wake under war-drums.'
    },
    {
      id: 'tidecall', name: 'Tidecall Coast', chapter: 'V — Salt Choir', chapterNum: 5,
      color: 0x0a3a48, accent: 0x44ddee, mapBg: 0x061820,
      mapKey: 'map_greenwild', mapFile: 'greenwild.jpg',
      blurb: 'Tide-cut cliffs and singing salt caves. Water and Storm gel answer the sea’s older hymns beyond Greenwild’s rivers.'
    },
    {
      id: 'ironmere', name: 'Ironmere Foundries', chapter: 'VI — Forged Quiet', chapterNum: 6,
      color: 0x3a3a44, accent: 0xc0c8d0, mapBg: 0x12141a,
      mapKey: 'map_crystal', mapFile: 'crystal.jpg',
      blurb: 'Abandoned workshops and mineral veins. Steelgel remembers hammer-song; hard-realm geometry tries to re-forge the Softened map into pure angles.'
    },
    {
      id: 'stormmarch', name: 'Stormmarch Ridges', chapter: 'VII — Skybreak', chapterNum: 7,
      color: 0x1a2848, accent: 0xffee66, mapBg: 0x0a1020,
      mapKey: 'map_volcanic', mapFile: 'volcanic.jpg',
      blurb: 'Ridge winds and thunder skirts. Lightning and Tempest cores gather where the sky itself cracks toward the Void.'
    },
    {
      id: 'celestial', name: 'Celestial Peaks', chapter: 'VIII — Above Softness', chapterNum: 8,
      color: 0x2a2540, accent: 0xd4b0ff, mapBg: 0x0a0818,
      mapKey: 'map_celestial', mapFile: 'celestial.jpg',
      blurb: 'Star roads and silent thrones. The soft sky still has teeth; Light and Spirit gel walk where maps thin into myth.'
    },
    {
      id: 'voidmarch', name: 'Voidmarch Marches', chapter: 'IX — Crack Mouth', chapterNum: 9,
      color: 0x1a0a28, accent: 0xb080ff, mapBg: 0x0c0614,
      mapKey: 'map_shadowfen', mapFile: 'shadowfen.jpg',
      blurb: 'Borderlands of unmaking. Void Cracks open wide enough to swallow place-names; Abyss gel and hard invaders share the same broken horizon.'
    },
    {
      id: 'origin', name: 'Origin Nexus', chapter: 'X — Primordial Heart', chapterNum: 10,
      color: 0x2a1840, accent: 0xffd0a0, mapBg: 0x100818,
      mapKey: 'map_celestial', mapFile: 'celestial.jpg',
      blurb: 'Where soft essence first learned to hold shape. The Haven-Keeper’s path ends — or begins again — at the Primordial Gel’s remembered core.'
    }
  ];

  /** Flavor fragments for stage blurbs (combined uniquely per stage). */
  var BLURB_OPEN = [
    'The trail softens underfoot.',
    'A Haven-lamp glows faint on the ridge.',
    'Element-song hums in the stones.',
    'Hard-shard frost still clings to the grass.',
    'The air tastes of old rain and new fear.',
    'Lyra’s maps mark this place with a careful hand.',
    'Gel-moss thrives where invaders failed to finish the job.',
    'A Void whisper threads the wind, then falls silent.',
    'Champions pause; even soft beasts know a threshold.',
    'The Softened Realms remember a kinder weather here.'
  ];
  var BLURB_THREAT = [
    'Hard-realm scouts leave angular footprints that do not melt.',
    'A crack in the sky shows pure geometry for a breath.',
    'Invader glass dust glitters where gel once sang.',
    'The land rejects straight edges — for now.',
    'Something tall and wrong watches from the next fold of map.',
    'Essence pools thin when the Void listens too closely.',
    'A boss-scent of iron and cold mathematics rides the air.',
    'Soft roots still hold, but they strain.',
    'The enemy prefers clean lines; this place still curves.',
    'Keepers before you left a soft mark — and a warning.'
  ];
  var BLURB_CLOSE = [
    'Clear it, and the next path opens without shame.',
    'Victory here feeds the Haven’s warm lamp.',
    'Bond your champions tightly; the climb steepens after this.',
    'The story of the Softened Realms turns another leaf.',
    'What you spare grows; what you shatter stays hard.',
    'Lyra will write this win into the Chronicle if you let her.',
    'Power rises as the map’s soft roads lengthen behind you.',
    'The Primordial Gel would smile — if gel could smile.',
    'Press on; the Origin Nexus still waits beyond the last ridge.',
    'No Haven stands alone while Keepers walk.'
  ];

  /**
   * Chapter defs: 15 stages each (last = boss). 10 × 15 = 150 stages.
   * Power rises continuously across the full campaign.
   */
  function chapterDefs() {
    return [
      {
        // Solo Epic starter (~Lv10 + Life 2pc): moderately easy — not free
        // Target ~2× survival margin early, tightens by chapter end
        region: 'greenwild', prefix: 'gw', chapter: 1, count: 15,
        powerStart: 195, powerEnd: 380,
        elements: ['Plant', 'Earth', 'Wind', 'Plant', 'Water', 'Earth', 'Wind', 'Plant',
          'Earth', 'Wind', 'Plant', 'Earth', 'Plant', 'Water', 'Plant'],
        names: [
          'Whispering Glade', 'Dewdrop Trail', 'Old Oak Hollow', 'Fern Spiral',
          'Mossy Brook', 'Hidden Grove', 'Willow Bend', 'Sprout Clearing',
          'Rootbridge', 'Canopy Stair', 'Amber Hollow', 'Softwood Gate',
          'Heartwood Path', 'Ancient Roots', 'Greenwild Heart'
        ]
      },
      {
        region: 'crystal', prefix: 'cm', chapter: 2, count: 15,
        powerStart: 400, powerEnd: 620,
        elements: ['Crystal', 'Ice', 'Crystal', 'Ice', 'Metal', 'Ice', 'Crystal', 'Lightning',
          'Ice', 'Crystal', 'Ice', 'Metal', 'Crystal', 'Ice', 'Ice'],
        names: [
          'Crystal Path', 'Shimmer Pass', 'Frozen Peak', 'Prism Shelf',
          'Hail Hollow', 'Mirror Scree', 'Glacier Stair', 'Blue Vein',
          'Rime Arch', 'Shard Garden', 'Quiet Crevasse', 'Silver Col',
          'Aurora Notch', 'Glacier Core', 'Hard Light Spire'
        ]
      },
      {
        region: 'shadowfen', prefix: 'sf', chapter: 3, count: 15,
        powerStart: 500, powerEnd: 830,
        elements: ['Shadow', 'Poison', 'Shadow', 'Earth', 'Plant', 'Poison', 'Shadow',
          'Poison', 'Earth', 'Shadow', 'Plant', 'Poison', 'Shadow', 'Poison', 'Shadow'],
        names: [
          'Murkwood Trail', 'Lantern Bog', 'Bog of Whispers', "Witch's Hollow",
          'Blackroot Depths', 'Thornveil Marsh', 'Reed Crypt', 'Fogfen Crossing',
          'Leechpool', 'Nightwillow', 'Rotgrove', 'Mire Bell',
          'Hagstone', 'Drowned Choir', 'Abyssal Mire'
        ]
      },
      {
        region: 'volcanic', prefix: 'vw', chapter: 4, count: 15,
        powerStart: 850, powerEnd: 1280,
        elements: ['Fire', 'Lava', 'Fire', 'Lava', 'Earth', 'Fire', 'Lava', 'Fire',
          'Lava', 'Metal', 'Fire', 'Lava', 'Fire', 'Lava', 'Fire'],
        names: [
          'Ashen Fields', 'Cinder Road', 'Lava Rivers', 'Ember Peak',
          'Scoria Flat', 'Magma Core', 'Basalt Stair', 'Charred Spine',
          'Furnace Gulch', 'Obsidian Gate', 'Soot Crown', 'Crater Rim',
          'Vein of Fire', 'Infernal Spire', 'Open Vein Throne'
        ]
      },
      {
        region: 'tidecall', prefix: 'tc', chapter: 5, count: 15,
        powerStart: 1300, powerEnd: 1650,
        elements: ['Water', 'Storm', 'Water', 'Wind', 'Water', 'Storm', 'Ice', 'Water',
          'Storm', 'Plant', 'Water', 'Storm', 'Water', 'Lightning', 'Water'],
        names: [
          'Saltglass Beach', 'Kelp Arch', 'Choir Cavern', 'Brine Stair',
          'Pearl Fen', 'Undertow Road', 'Gullspire', 'Foamhollow',
          'Tidebell Reach', 'Coral Softgate', 'Stormwrack Cove', 'Moonpool Shelf',
          'Siren Reed', 'Deep Salt Heart', 'Tidecall Sovereign'
        ]
      },
      {
        region: 'ironmere', prefix: 'im', chapter: 6, count: 15,
        powerStart: 1680, powerEnd: 2100,
        elements: ['Metal', 'Fire', 'Metal', 'Earth', 'Metal', 'Lightning', 'Metal', 'Earth',
          'Metal', 'Lava', 'Metal', 'Crystal', 'Metal', 'Fire', 'Metal'],
        names: [
          'Slag Path', 'Quench Yard', 'Anvil Green', 'Wirecanopy',
          'Rustfen', 'Gearshadow Hall', 'Bloom of Iron', 'Smelter Stair',
          'Nailwind Pass', 'Quiet Forge', 'Chaingarden', 'Cinder Archive',
          'Softsteel Gate', 'Foundry Deep', 'Ironmere Crown'
        ]
      },
      {
        region: 'stormmarch', prefix: 'sm', chapter: 7, count: 15,
        powerStart: 2140, powerEnd: 2650,
        elements: ['Lightning', 'Storm', 'Wind', 'Lightning', 'Storm', 'Lightning', 'Wind',
          'Storm', 'Lightning', 'Metal', 'Storm', 'Lightning', 'Wind', 'Storm', 'Lightning'],
        names: [
          'Gale Steppe', 'Thunderlip Ridge', 'Sparkfen', 'Cloudcut Road',
          'Ion Hollow', 'Skybreak Camp', 'Boltgarden', 'Windscar Col',
          'Static Marsh', 'Tempest Stair', 'Arcway', 'Stormbell Notch',
          'Fulgur Gate', 'Crown of Charge', 'Skybreak Tyrant'
        ]
      },
      {
        region: 'celestial', prefix: 'cp', chapter: 8, count: 15,
        powerStart: 2700, powerEnd: 3300,
        elements: ['Light', 'Spirit', 'Lightning', 'Storm', 'Light', 'Spirit', 'Lightning',
          'Storm', 'Light', 'Spirit', 'Void', 'Storm', 'Light', 'Spirit', 'Light'],
        names: [
          'Starlit Path', 'Moonveil Ridge', 'Astral Observatory', 'Nexus of Stars',
          'Silver Steps', 'Comet Shelf', 'Void Overlook', 'Aurora Span',
          'Zenith Garden', 'Orbit Gate', 'Quiet Nebula', 'Crown of Dust',
          'Halo Reach', 'Throne of the Cosmos', 'Peak Above Softness'
        ]
      },
      {
        region: 'voidmarch', prefix: 'vm', chapter: 9, count: 15,
        powerStart: 3350, powerEnd: 4100,
        elements: ['Void', 'Shadow', 'Void', 'Spirit', 'Void', 'Shadow', 'Crystal', 'Void',
          'Shadow', 'Void', 'Poison', 'Void', 'Shadow', 'Void', 'Void'],
        names: [
          'Unname Shore', 'Anglefield', 'Nullreed Marsh', 'Cracklip Road',
          'Forgotten Softness', 'Hard Horizon', 'Eraser Fen', 'Quiet Unmaking',
          'Glassbloom Ruin', 'Voidbell Stair', 'March of Absence', 'Riftgarden',
          'Keeper’s Warning', 'Mouth of the Crack', 'Voidmarch Apex'
        ]
      },
      {
        region: 'origin', prefix: 'on', chapter: 10, count: 15,
        powerStart: 4200, powerEnd: 5200,
        elements: ['Spirit', 'Light', 'Void', 'Water', 'Fire', 'Earth', 'Plant', 'Lightning',
          'Ice', 'Shadow', 'Metal', 'Crystal', 'Storm', 'Lava', 'Void'],
        names: [
          'First Soft Road', 'Memory of Rain', 'Gelcradle', 'Song Before Names',
          'Keeper’s Echo', 'Prism of Beginnings', 'Warm Core Path', 'Sibling Elements',
          'Haven’s Reflection', 'Unbroken Curve', 'Last Soft Gate', 'Heartwood of Worlds',
          'Primordial Choir', 'Nexus Deep', 'Origin Sovereign'
        ]
      }
    ];
  }

  function stageBlurb(regionName, stageName, chapter, index, count, isBoss) {
    var o = BLURB_OPEN[(chapter * 7 + index * 3) % BLURB_OPEN.length];
    var t = BLURB_THREAT[(chapter * 5 + index * 11) % BLURB_THREAT.length];
    var c = BLURB_CLOSE[(chapter * 3 + index * 13) % BLURB_CLOSE.length];
    var bossBit = isBoss
      ? (' The chapter’s boss waits here — a hard-realm champion or a soft legend gone sharp — at ' + stageName + '.')
      : (' Location ' + index + ' of ' + count + ' on the ' + regionName + ' map.');
    return (o + ' ' + t + bossBit + ' ' + c).trim();
  }

  function buildCampaignStages() {
    var defs = chapterDefs();
    var out = [];
    var gi;
    for (gi = 0; gi < defs.length; gi++) {
      var d = defs[gi];
      var reg = null;
      var ri;
      for (ri = 0; ri < CAMPAIGN_REGIONS.length; ri++) {
        if (CAMPAIGN_REGIONS[ri].id === d.region) {
          reg = CAMPAIGN_REGIONS[ri];
          break;
        }
      }
      var regionName = reg ? reg.name : d.region;
      var n = d.count;
      var i;
      for (i = 0; i < n; i++) {
        var t = n <= 1 ? 0 : i / (n - 1);
        var power = Math.round(d.powerStart + (d.powerEnd - d.powerStart) * t);
        var mapX = 0.10 + t * 0.80;
        var mapY = 0.48 + Math.sin(t * Math.PI * 2.4) * 0.22 + ((i % 2) * 0.03 - 0.015);
        mapY = Math.max(0.18, Math.min(0.82, mapY));
        var isBoss = i === n - 1;
        var name = d.names[i] || ('Location ' + (i + 1));
        out.push({
          id: d.prefix + (i + 1),
          region: d.region,
          chapter: d.chapter,
          index: i + 1,
          name: name,
          power: power,
          element: d.elements[i] || 'Earth',
          boss: isBoss,
          mapX: Math.round(mapX * 1000) / 1000,
          mapY: Math.round(mapY * 1000) / 1000,
          blurb: stageBlurb(regionName, name, d.chapter, i + 1, n, isBoss),
          lore: stageBlurb(regionName, name, d.chapter, i + 1, n, isBoss)
        });
      }
    }
    return out;
  }

  /** Per-stage lore helper (UI / tests). */
  function getStageLore(stage) {
    if (!stage) return '';
    if (stage.blurb) return String(stage.blurb);
    if (stage.lore) return String(stage.lore);
    return '';
  }

  var API = {
    CAMPAIGN_REGIONS: CAMPAIGN_REGIONS,
    buildCampaignStages: buildCampaignStages,
    getStageLore: getStageLore
  };

  global.SR_CAMPAIGN_WORLD = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : global);
