/* ===== Multi-act story spine + expanded champion lore helpers ===== */
(function (global) {
  'use strict';

  /**
   * Ten-act spine aligned to CAMPAIGN_REGIONS chapterNum order.
   * Body prose ≥80 chars each; coherent Softened Realms chronology.
   */
  var STORY_ACTS = [
    {
      act: 1, regionId: 'greenwild', title: 'Act I — Soft Roots',
      body:
        'In Greenwild Forest the Haven-Keeper first learns that living gel listens. Soft roots and moss paths hide Tideborn and Bloomkin lessons while Void Cracks remain distant rumors. Whispering Glade forgives new Keepers; the Softened Realms still believe in gentle weather.'
    },
    {
      act: 2, regionId: 'crystal', title: 'Act II — Hard Light',
      body:
        'Crystal Mountains teach precision. Ice and prism light are the first hard geometries many Keepers meet. Glacier Core waits where soft gel must choose care over rush, and Hard Light Spire proves that beauty can cut.'
    },
    {
      act: 3, regionId: 'shadowfen', title: 'Act III — Wet Night',
      body:
        'Shadowfen Swamp swallows names in purple fog. Poison and Shade cores thrive where sunlight fails. Abyssal Mire marks the night’s deepest claim — yet even here soft moss remembers rain, and Keepers refuse to let the bog freeze into angles.'
    },
    {
      act: 4, regionId: 'volcanic', title: 'Act IV — Open Vein',
      body:
        'Volcanic Wastes open the land’s hot blood. Emberkin and Magma kin wake as ash falls like hard snow. Infernal Spire and Open Vein Throne demand parties that can endure heat without becoming glass themselves.'
    },
    {
      act: 5, regionId: 'tidecall', title: 'Act V — Salt Choir',
      body:
        'Tidecall Coast sings older hymns than Greenwild’s brooks. Water and Storm gel answer salt caves and tidebells. The Softened Realms widen beyond forest myth; the sea reminds Keepers that softness can be vast.'
    },
    {
      act: 6, regionId: 'ironmere', title: 'Act VI — Forged Quiet',
      body:
        'Ironmere Foundries remember hammer-song and abandoned workshops. Steelgel holds the line while hard-realm invaders try to re-forge the map into pure angles. Forged Quiet is the calm before the sky itself cracks.'
    },
    {
      act: 7, regionId: 'stormmarch', title: 'Act VII — Skybreak',
      body:
        'Stormmarch Ridges gather Lightning and Tempest where thunder kisses soft peaks. Skybreak Tyrant waits above cloudcut roads. The Void listens closer now; every bolt is both weapon and warning.'
    },
    {
      act: 8, regionId: 'celestial', title: 'Act VIII — Above Softness',
      body:
        'Celestial Peaks thin the map into star roads and silent thrones. Light and Spirit gel walk where myth becomes weather. Peak Above Softness is not heaven — it is height, and height has teeth.'
    },
    {
      act: 9, regionId: 'voidmarch', title: 'Act IX — Crack Mouth',
      body:
        'Voidmarch Marches are the border of unmaking. Place-names fray; Abyss gel and hard invaders share one broken horizon. Crack Mouth is the campaign’s long shadow before the Origin Nexus answers.'
    },
    {
      act: 10, regionId: 'origin', title: 'Act X — Primordial Heart',
      body:
        'Origin Nexus is where soft essence first learned to hold shape. The Haven-Keeper’s path meets the Primordial Gel’s remembered core. Origin Sovereign ends the climb — or begins the Softened Realms again under a warmer sky.'
    }
  ];

  /** Expanded rarity lore for multi-part champion bios. */
  var RARITY_LORE_EXTRA = {
    Common: {
      blurb: 'Everyday gel — soft blob, eager to grow under a Keeper’s hand.',
      bio: 'Common cores form freely in the Softened Realms as simple blobby masses with little form control. They learn fast when bonded and fail gently when pushed too hard by hard-realm geometry.'
    },
    Uncommon: {
      blurb: 'A sharper spark of will, color, and half-remembered Element-song.',
      bio: 'Uncommon slimes stay mostly blobby, with the first hints of stubby nubs and personality. Haven records say they choose Keepers as often as Keepers choose them.'
    },
    Rare: {
      blurb: 'Hardened by rare essence veins and longer soft seasons.',
      bio: 'Rare champions firm their affinity; some begin pushing soft blob-arms when stressed. Their biographies already include a named place — a glade, a pass, a bog — where they first held shape.'
    },
    Epic: {
      blurb: 'Morph form control — clear blob-arms and battlefield will.',
      bio: 'Epic gel can hold semi-shaped tentacle arms while remaining a slime mass in battle, and at three awakenings it rises into an Ascended form with a shaped torso. Softened Realms legends list them among Haven defenders who turned Void scouts back without losing their softness.'
    },
    Legendary: {
      blurb: 'Named legend with an Ascended elemental silhouette.',
      bio: 'Legendary cores hold an Ascended form: a shaped torso, arms, and element armor or crown pieces, all still gel. At five awakenings they become Shape-Bound, a near-humanoid gel figure, never true hard-realm flesh. Keepers speak their names in Chronicle entries that outlast single campaigns.'
    },
    Mythic: {
      blurb: 'Once-per-era gel, Shape-Bound by default.',
      bio: 'Mythic gel arrives Shape-Bound: a near-humanoid figure of face, hands, and drips, always gel at the core. They appear near Origin echoes and Void Tower floors where the Softened Realms remember how softness began.'
    }
  };

  function getStoryActs() {
    return STORY_ACTS.slice();
  }

  /**
   * Build multi-part champion lore from element pack + rarity + form.
   * Ensures role/personality/bio fields and combined bio length for UI + tests.
   */
  /** Named Epic / Legendary / Mythic hero on this unit (by heroId), else null. */
  function namedHeroFor(slime) {
    if (!slime || !slime.heroId) return null;
    var HR = global.SR_HERO_ROSTER || null;
    if (!HR && typeof require !== 'undefined') {
      try { HR = require('./heroRoster.js'); } catch (e) { HR = null; }
    }
    return HR && HR.getHeroById ? HR.getHeroById(slime.heroId) : null;
  }

  function buildChampionLore(slime, elementLore, rarityLore, resolveFormTier) {
    if (!slime) return null;
    var el = elementLore || {};
    var rarBase = rarityLore || {};
    var rarExtra = RARITY_LORE_EXTRA[slime.rarity] || RARITY_LORE_EXTRA.Common;
    var rar = {
      blurb: rarExtra.blurb || rarBase.blurb || '',
      bio: rarExtra.bio || rarBase.bio || rarBase.blurb || ''
    };
    var form = resolveFormTier ? resolveFormTier(slime) : 'blob';
    var formText = form === 'humanoid' ? 'Shape-bound mythic presence'
      : form === 'ascended' ? 'Shaped form control'
      : form === 'morph' ? 'Morphing blob-arms'
      : 'Classic blobby gel';
    var role = el.role || 'Wild gel';
    var personality = el.personality || 'Uncharted mood';
    var named = namedHeroFor(slime);
    if (named) {
      var nBio = (named.bio + ' ' + (el.extended || el.blurb || '')).replace(/\s+/g, ' ').trim();
      var sigLine = named.signature && named.signature.name
        ? named.signature.name + (named.signature.text ? ': ' + named.signature.text : '')
        : (el.signature || 'Gel Strike');
      return {
        heroId: named.id,
        named: true,
        epithet: named.epithet || '',
        heroTitle: named.title || '',
        elementTitle: el.title || (slime.element || 'Gel'),
        role: named.role || role,
        personality: personality,
        blurb: named.epithet || el.blurb || '',
        extended: el.extended || el.blurb || '',
        signature: sigLine,
        signatureSkill: named.signature || null,
        affinity: el.affinity || 'Uncharted',
        rarityBlurb: rar.blurb,
        championBio: nBio,
        history: nBio,
        bio: nBio,
        formText: formText,
        form: form,
        rarity: slime.rarity || 'Common',
        nameLine: named.name + ' — ' + (named.epithet || '')
      };
    }
    var history =
      (el.extended || el.blurb || 'An unclassified gel signature walks the Softened Realms.') +
      ' ' +
      (rar.bio || rar.blurb || '') +
      ' In Haven speech they are called ' + (slime.name || el.title || 'Nameless') +
      ', a ' + (slime.element || 'wild') + ' champion bonded under Void Crack weather.';
    var championBio = history.replace(/\s+/g, ' ').trim();
    // Guarantee minimum prose depth for UI / tests
    if (championBio.length < 120) {
      championBio += ' Softened Realms Keepers record such bonds so that hard geometry never erases a name without a story.';
    }
    return {
      elementTitle: el.title || (slime.element || 'Gel'),
      role: role,
      personality: personality,
      blurb: el.blurb || '',
      extended: el.extended || el.blurb || '',
      signature: el.signature || 'Gel Strike',
      affinity: el.affinity || 'Uncharted',
      rarityBlurb: rar.blurb,
      championBio: championBio,
      history: championBio,
      bio: championBio,
      formText: formText,
      form: form,
      rarity: slime.rarity || 'Common',
      nameLine: (slime.name || el.title || 'Gel') + ' — ' + (slime.element || '') + ' ' + (el.title || '')
    };
  }

  var API = {
    STORY_ACTS: STORY_ACTS,
    RARITY_LORE_EXTRA: RARITY_LORE_EXTRA,
    getStoryActs: getStoryActs,
    buildChampionLore: buildChampionLore
  };

  global.SR_STORY_LORE = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : global);
