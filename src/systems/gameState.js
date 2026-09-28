/* ===== Hub loop: roster, summon, campaign, dungeons, economy, save ===== */
(function (global) {
  'use strict';

  var DATA = global.SR_DATA || (typeof require !== 'undefined' ? require('../data/gameData.js') : null);
  var SAVE_KEY = 'slimeRaidPhaserSave_v1';
  var _idSeq = 1;

  function nextId() {
    return Date.now() + (_idSeq++);
  }

  function createChampion(opts) {
    opts = opts || {};
    var el = opts.element || ((DATA && DATA.ELEMENTS) || ['Water'])[Math.floor(Math.random() * 4)];
    var rarity = opts.rarity || 'Common';
    var rp = (DATA && DATA.RARITY_POWER && DATA.RARITY_POWER[rarity]) || 1;
    var level = opts.level || 1;
    var base = 40 + level * 12;
    var power = (typeof opts.power === 'number' && isFinite(opts.power) && opts.power > 0)
      ? Math.floor(opts.power)
      : Math.floor(base * rp * (0.9 + Math.random() * 0.2));
    var species = (DATA && DATA.SPECIES && DATA.SPECIES[el]) || (el + ' Slime');
    var traits = Array.isArray(opts.traits)
      ? opts.traits.slice()
      : (DATA && DATA.rollTraitsForRarity ? DATA.rollTraitsForRarity(rarity) : []);
    var equipment = opts.equipment && typeof opts.equipment === 'object' ? opts.equipment : {};
    var id = opts.id != null ? opts.id : nextId();
    var displayName = opts.name;
    if (!displayName) {
      if (DATA && typeof DATA.generateChampionName === 'function') {
        displayName = DATA.generateChampionName(el, rarity, id);
      } else if (global.SR_CHAMPION_NAMES && typeof global.SR_CHAMPION_NAMES.generateChampionName === 'function') {
        displayName = global.SR_CHAMPION_NAMES.generateChampionName(el, rarity, id);
      } else {
        displayName = species;
      }
    }
    var artVariant = opts.artVariant;
    if (artVariant == null || artVariant === '') {
      // Stable per-champion silhouette within element (a/b/c combat sprites)
      if (global.SR_ART && typeof global.SR_ART.artVariantForUnit === 'function') {
        artVariant = global.SR_ART.artVariantForUnit({
          id: id,
          name: displayName || species,
          element: el,
          rarity: rarity
        });
      } else {
        artVariant = 'a';
      }
    }
    var baseStars = (DATA && DATA.getBaseStars)
      ? DATA.getBaseStars(rarity)
      : ({ Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5, Mythic: 6 }[rarity] || 1);
    var purple = opts.purpleStars != null ? opts.purpleStars : (opts.evolutionLevel || 0);
    purple = Math.max(0, Math.floor(Number(purple) || 0));
    if (baseStars > 0) purple = Math.min(baseStars, purple);
    else purple = 0; // no star path
    var skillIds = Array.isArray(opts.skillIds) && opts.skillIds.length
      ? opts.skillIds.slice()
      : (DATA && typeof DATA.getChampionSkillIds === 'function'
        ? DATA.getChampionSkillIds({ element: el, rarity: rarity })
        : null);
    var champ = {
      id: id,
      name: displayName,
      species: species,
      element: el,
      rarity: rarity,
      level: level,
      power: power,
      exp: opts.exp || 0,
      locked: !!opts.locked,
      /** Fixed by rarity; never raised by evolve. Mythic = 6★. */
      baseStars: baseStars,
      /** Awakened (purple) stars — max = baseStars. Aliased as evolutionLevel for legacy. */
      purpleStars: purple,
      evolutionLevel: purple,
      traits: traits,
      equipment: equipment,
      formTier: opts.formTier || null,
      /** Combat sprite pose key: a | b | c */
      artVariant: String(artVariant).toLowerCase(),
      /** Themed skill kit ids (element × rarity unlock). Combat rebuilds from kit if missing. */
      skillIds: skillIds
    };
    // Derive combat attributes (traits/gear) without writing them back into base power
    if (DATA && DATA.computeChampionAttributes) {
      champ.attributes = DATA.computeChampionAttributes(champ);
    } else {
      champ.attributes = { power: power, atk: Math.floor(power * 0.28), hp: Math.floor(power * 2), def: 10, res: 8, spd: 100, crit: 8 };
    }
    return champ;
  }

  /**
   * Soft cap for base power (stored on champ.power). Derived combat power
   * (traits/gear) lives only on attributes — never write it back into power
   * or every refresh compounds multipliers into the millions.
   */
  function estimateBasePower(champ) {
    var level = Math.max(1, champ.level || 1);
    var evo = Math.max(0, champ.purpleStars != null ? champ.purpleStars : (champ.evolutionLevel || 0));
    var rp = (DATA && DATA.RARITY_POWER && DATA.RARITY_POWER[champ.rarity]) || 1;
    return Math.floor((40 + level * 12 + evo * 35) * rp);
  }

  /** Max level: 50 + purpleStars×10. */
  function getChampionMaxLevel(champ) {
    if (DATA && DATA.getChampionMaxLevel) return DATA.getChampionMaxLevel(champ);
    var purple = Math.max(0, champ && (champ.purpleStars != null ? champ.purpleStars : champ.evolutionLevel) || 0);
    return 50 + purple * 10;
  }

  /**
   * EXP to next level — front-loaded early (1→15 snappy), steeper toward cap.
   * Old 40+12×lv made early fights feel frozen at Lv2.
   */
  function expToNextChampLevel(level) {
    level = Math.max(1, Math.floor(level || 1));
    if (level < 15) {
      // Lv1→2 ≈ 20, Lv10→11 ≈ 65, Lv14→15 ≈ 84
      return 15 + level * 5;
    }
    if (level < 35) {
      // Mid grind: ~100 → ~340
      return 90 + (level - 15) * 12;
    }
    // Late (35→50+): deliberate
    return 280 + (level - 35) * 22;
  }

  /**
   * Grant champion EXP and level up until cap. Power ticks gently per level.
   */
  function grantChampionExp(champ, amount) {
    if (!champ || !amount) return { levels: 0 };
    var maxLv = getChampionMaxLevel(champ);
    var lv = Math.max(1, champ.level || 1);
    if (lv > maxLv) {
      champ.level = maxLv;
      champ.exp = 0;
      return { levels: 0, maxed: true };
    }
    if (lv >= maxLv) {
      champ.level = maxLv;
      champ.exp = 0;
      return { levels: 0, maxed: true };
    }
    champ.exp = (champ.exp || 0) + Math.max(0, Math.floor(amount));
    var gained = 0;
    var purple = Math.max(0, champ.purpleStars != null ? champ.purpleStars : (champ.evolutionLevel || 0));
    // Safety: never infinite-loop if curve misconfigured
    var guard = 0;
    while (champ.level < maxLv && champ.exp >= expToNextChampLevel(champ.level) && guard < 200) {
      guard++;
      champ.exp -= expToNextChampLevel(champ.level);
      champ.level += 1;
      champ.power = (champ.power || estimateBasePower(champ)) + 2 + Math.floor(purple * 0.5);
      gained++;
    }
    if (champ.level >= maxLv) {
      champ.level = maxLv;
      champ.exp = 0;
    }
    sanitizeChampionPower(champ);
    refreshChampionDerived(champ);
    return { levels: gained, maxed: champ.level >= maxLv };
  }

  function grantPartyExp(state, amount) {
    getParty(state).forEach(function (c) {
      grantChampionExp(c, amount);
    });
  }

  function maxReasonableBasePower(champ) {
    // Generous headroom for wins/fuse/party grinds, still far below "a million"
    return Math.floor(estimateBasePower(champ) * 4 + 800);
  }

  function sanitizeChampionPower(champ) {
    if (!champ) return champ;
    var p = Number(champ.power);
    if (!isFinite(p) || p < 1) {
      champ.power = estimateBasePower(champ);
      return champ;
    }
    var cap = maxReasonableBasePower(champ);
    // Hard safety for save corruption / old compounding bug
    if (p > cap || p > 25000) {
      champ.power = Math.min(cap, Math.max(estimateBasePower(champ), 50));
    } else {
      champ.power = Math.floor(p);
    }
    return champ;
  }

  function refreshChampionDerived(champ) {
    if (!champ) return champ;
    if (!Array.isArray(champ.traits)) champ.traits = [];
    if (!champ.equipment || typeof champ.equipment !== 'object') champ.equipment = {};
    sanitizeChampionPower(champ);
    if (DATA && DATA.computeChampionAttributes) {
      // attributes.power may include gear/traits — display/combat only, not stored base
      champ.attributes = DATA.computeChampionAttributes(champ);
    }
    return champ;
  }

  function equipArtifact(state, champId, slotId, artifactId) {
    var champ = (state.roster || []).find(function (c) { return c.id === champId; });
    if (!champ) return { ok: false, error: 'Champion not found' };
    if (!champ.equipment) champ.equipment = {};
    slotId = normalizeArtifactSlot(slotId);
    var art = (state.artifacts || []).find(function (a) { return a.id === artifactId; });
    if (!art) return { ok: false, error: 'Artifact not found' };
    // Free whatever is currently in this slot (Raid replace)
    var prev = champ.equipment[slotId];
    if (prev && prev.id != null && prev.id !== artifactId) {
      var prevArt = (state.artifacts || []).find(function (a) { return a.id === prev.id; });
      if (prevArt) {
        delete prevArt.equippedTo;
        delete prevArt.equippedSlot;
      }
      delete champ.equipment[slotId];
    }
    // Unequip this relic from anyone else / any other slot
    (state.roster || []).forEach(function (c) {
      if (!c.equipment) return;
      Object.keys(c.equipment).forEach(function (s) {
        if (c.equipment[s] && c.equipment[s].id === artifactId) {
          delete c.equipment[s];
        }
      });
    });
    (state.artifacts || []).forEach(function (a) {
      if (a.id === artifactId) {
        delete a.equippedTo;
        delete a.equippedSlot;
      }
    });
    // Map vault relic into slot shape
    var slots = (DATA && DATA.ARTIFACT_SLOTS) || [];
    var slotDef = slots.find(function (s) { return s.id === slotId; }) || { id: slotId, stat: 'power' };
    var setName = art.set || art.setId || art.setName || 'Life';
    // Name from set × slot so equipping a vault piece into a helm never reads as a weapon
    var displayName = nameForArtifact(setName, slotId);
    champ.equipment[slotId] = {
      id: art.id,
      name: displayName,
      set: setName,
      setName: setName,
      mainStat: art.mainStat || slotDef.stat || 'power',
      value: art.power || art.value || 5,
      level: art.level || 1,
      rarity: art.rarity || 'Common',
      slotHint: slotId
    };
    art.name = displayName;
    art.set = setName;
    art.setName = setName;
    art.slotHint = slotId;
    art.equippedTo = champId;
    art.equippedSlot = slotId;
    refreshChampionDerived(champ);
    saveState(state);
    return { ok: true, champ: champ };
  }

  function unequipArtifact(state, champId, slotId) {
    var champ = (state.roster || []).find(function (c) { return c.id === champId; });
    if (!champ || !champ.equipment) return { ok: false, error: 'Nothing equipped' };
    var piece = champ.equipment[slotId];
    if (!piece) return { ok: false, error: 'Empty slot' };
    delete champ.equipment[slotId];
    var art = (state.artifacts || []).find(function (a) { return a.id === piece.id; });
    if (art) {
      delete art.equippedTo;
      delete art.equippedSlot;
    }
    refreshChampionDerived(champ);
    saveState(state);
    return { ok: true };
  }

  function rollRarity(table) {
    var r = Math.random();
    var cum = 0;
    var order = ['Mythic', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      if (table[k] == null) continue;
      cum += table[k];
      if (r < cum) return k;
    }
    return 'Common';
  }

  var RARITY_RANK = {
    Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5
  };

  function rarityRank(rarity) {
    var n = RARITY_RANK[rarity];
    return n == null ? 0 : n;
  }

  function summonCostFor(type, count) {
    var spec = (DATA && DATA.SUMMON_COSTS && DATA.SUMMON_COSTS[type]) || null;
    if (!spec) {
      spec = type === 'premium'
        ? { currency: 'divineShards', one: 280, ten: 2500 }
        : type === 'ancient'
          ? { currency: 'voidShards', one: 140, ten: 1260 }
          : { currency: 'slimeShards', one: 90, ten: 800 };
    }
    return {
      currency: spec.currency,
      amount: count === 10 ? spec.ten : spec.one
    };
  }

  function pitySpecFor(type) {
    return (DATA && DATA.SUMMON_PITY && DATA.SUMMON_PITY[type]) || null;
  }

  function pityCounterKey(type, spec) {
    if (spec && spec.counter) return spec.counter;
    if (type === 'premium') return 'pityPremium';
    if (type === 'ancient') return 'pityAncient';
    return 'pityRegular';
  }

  /**
   * Rate-table roll, then hard pity: if the banner counter is at bound-1,
   * this pull is the pity rarity (or already rolled that high). Hitting the
   * floor rarity resets the counter; otherwise it increments.
   */
  function rollSummonRarity(state, type) {
    var rates = (DATA && DATA.SUMMON_RATES && DATA.SUMMON_RATES[type]) || { Common: 1 };
    var pity = pitySpecFor(type);
    var key = pityCounterKey(type, pity);
    if (!state.summon) state.summon = { pityRegular: 0, pityPremium: 0, pityAncient: 0 };
    var count = state.summon[key] || 0;
    var rarity;
    var pityForced = false;
    if (pity && pity.bound > 0 && (count + 1) >= pity.bound) {
      rarity = pity.rarity;
      pityForced = true;
    } else {
      rarity = rollRarity(rates);
    }
    if (pity && rarityRank(rarity) >= rarityRank(pity.rarity)) {
      state.summon[key] = 0;
    } else {
      state.summon[key] = count + 1;
    }
    return { rarity: rarity, pityForced: pityForced };
  }

  function defaultResources() {
    return {
      gold: 500,
      slimeShards: 400,
      divineShards: 50,
      voidShards: 20,
      jelly: 40,
      wood: 60,
      stone: 40,
      herbs: 35,
      berries: 25,
      manaShards: 20,
      slimeEssence: 30,
      shadowEssence: 10,
      crystal: 12,
      refinedEssence: 5,
      arcaneDust: 8,
      trainingScrolls: 0,
      battleElixir: 1,
      healingSalve: 1,
      fertilityPotion: 0,
      focusElixir: 0,
      shadowSilk: 0,
      explorerTonic: 0,
      alchemicalCatalyst: 0
    };
  }

  /**
   * Haven kit — equips a starter Life 2pc on the lead, Offense on second,
   * and leaves a spare Defense piece in the vault so gear is real day one.
   */
  function grantHavenStarterKit(state) {
    if (!state) return { ok: false };
    if (!state.flags) state.flags = {};
    if (state.flags.havenKitGranted) return { ok: true, already: true };
    state.flags.havenKitGranted = true;
    state.artifacts = state.artifacts || [];
    var roster = state.roster || [];
    var lead = roster[0] || null;
    var second = roster[1] || null;
    var plan = [
      { set: 'Life', slotId: 'weapon', power: 8, rarity: 'Uncommon', champ: lead },
      { set: 'Life', slotId: 'chest', power: 8, rarity: 'Uncommon', champ: lead },
      { set: 'Offense', slotId: 'gloves', power: 6, rarity: 'Common', champ: second },
      { set: 'Defense', slotId: 'shield', power: 6, rarity: 'Common', champ: null }
    ];
    var equipped = 0;
    plan.forEach(function (g) {
      var art = createArtifact({
        set: g.set,
        slotId: g.slotId,
        power: g.power,
        rarity: g.rarity,
        name: (g.set === 'Life' ? 'Haven ' : '') + nameForArtifact(g.set, g.slotId)
      });
      grantGearToVault(state, art);
      if (g.champ && g.champ.id != null) {
        var res = equipArtifact(state, g.champ.id, g.slotId, art.id);
        if (res && res.ok) equipped++;
      }
    });
    return { ok: true, equipped: equipped, vault: (state.artifacts || []).length };
  }

  /**
   * Raid-style tutorial pool: four gels you fight with one-by-one, then keep one as Epic.
   * Not on roster until finalizeTutorialPick.
   */
  function buildTutorialCandidates() {
    return [
      createChampion({
        element: 'Water', rarity: 'Uncommon', level: 6, name: 'Tidekin',
        power: 110
      }),
      createChampion({
        element: 'Fire', rarity: 'Uncommon', level: 6, name: 'Emberkin',
        power: 115
      }),
      createChampion({
        element: 'Plant', rarity: 'Uncommon', level: 6, name: 'Bloomkin',
        power: 105
      }),
      createChampion({
        element: 'Earth', rarity: 'Uncommon', level: 6, name: 'Stonekin',
        power: 112
      })
    ].map(function (c) {
      c._tutorialTemp = true;
      refreshChampionDerived(c);
      return c;
    });
  }

  /** Foes for tutorial mini-battle index 0..3 — beatable solo, not free. */
  function buildTutorialFoe(waveIndex) {
    var wi = Math.max(0, Math.min(3, waveIndex | 0));
    var packs = [
      { name: 'Hard-Realm Scout', element: 'Earth', rarity: 'Common', level: 4, power: 78, enemyKind: 'humanoid' },
      { name: 'Ash Bandit', element: 'Fire', rarity: 'Common', level: 5, power: 88, enemyKind: 'humanoid' },
      { name: 'Thornling', element: 'Plant', rarity: 'Uncommon', level: 5, power: 92, enemyKind: 'plant' },
      { name: 'Rubble Golem', element: 'Earth', rarity: 'Uncommon', level: 6, power: 100, enemyKind: 'golem' }
    ];
    var p = packs[wi] || packs[0];
    return createEnemy({
      name: p.name,
      element: p.element,
      rarity: p.rarity,
      level: p.level,
      power: p.power,
      enemyKind: p.enemyKind
    });
  }

  function ensureTutorialCandidates(state) {
    if (!state) return [];
    if (Array.isArray(state.tutorialCandidates) && state.tutorialCandidates.length === 4) {
      return state.tutorialCandidates;
    }
    state.tutorialCandidates = buildTutorialCandidates();
    saveState(state);
    return state.tutorialCandidates;
  }

  /**
   * Keep one tutorial gel as Epic starter; clear the rest.
   * Grants Haven kit on the chosen gel.
   */
  function finalizeTutorialPick(state, candidateId) {
    if (!state) return { ok: false, error: 'No state' };
    var cands = ensureTutorialCandidates(state);
    var pick = null;
    var i;
    for (i = 0; i < cands.length; i++) {
      if (cands[i].id === candidateId || String(cands[i].id) === String(candidateId)) {
        pick = cands[i];
        break;
      }
    }
    if (!pick) pick = cands[0];
    if (!pick) return { ok: false, error: 'No candidates' };

    // Promote to Epic starter (Raid free-epic feel)
    pick.rarity = 'Epic';
    pick.level = 10;
    pick.exp = 0;
    pick.baseStars = (DATA && DATA.getBaseStars) ? DATA.getBaseStars('Epic') : 4;
    pick.purpleStars = 0;
    pick.evolutionLevel = 0;
    pick.locked = false;
    delete pick._tutorialTemp;
    // Solid mid starter power for solo campaign (not god-mode)
    pick.power = Math.max(
      estimateBasePower(pick),
      Math.floor((40 + pick.level * 12 + 20) * ((DATA && DATA.RARITY_POWER && DATA.RARITY_POWER.Epic) || 1.6))
    );
    sanitizeChampionPower(pick);
    refreshChampionDerived(pick);

    state.roster = [pick];
    state.partyIds = [pick.id];
    state.tutorialCandidates = null;
    state.tutorialSeen = true;
    state.tutorialStep = 99;
    if (!state.flags) state.flags = {};
    state.flags.tutorialPickDone = true;
    state.flags.tutorialBattleDone = true;
    state.flags.havenKitGranted = false; // allow kit on this gel
    grantHavenStarterKit(state);
    // Re-apply kit to the single gel (grantHavenStarterKit uses roster[0])
    saveState(state);
    return { ok: true, champion: pick };
  }

  /** Skip path: auto-pick middle candidate as Epic. */
  function skipTutorialWithPick(state) {
    var cands = ensureTutorialCandidates(state);
    var pick = cands[1] || cands[0];
    return finalizeTutorialPick(state, pick && pick.id);
  }

  function defaultState() {
    // Raid-style: empty roster until tutorial battle + Epic pick
    var state = {
      resources: defaultResources(),
      roster: [],
      partyIds: [],
      tutorialCandidates: null,
      campaign: { selectedStage: 'gw1', progress: {} },
      dungeons: { cleared: {}, bossWins: {} },
      summon: { pityRegular: 0, pityPremium: 0, pityAncient: 0, banner: 'celestial' },
      player: {
        name: '',
        level: 1,
        exp: 0,
        statPoints: 3,
        stats: { taming: 0, alchemy: 0, combat: 0, leadership: 0, endurance: 0 }
      },
      workshop: { incubator: 0, trainingHall: 0, refinery: 0 },
      eternity: { voidFloor: 1, convergences: 0, claimedMilestones: {} },
      artifacts: [],
      flags: {
        battleElixirActive: false,
        explorerTonicCharges: 0,
        globalPowerBonus: 1,
        havenKitGranted: false,
        tutorialPickDone: false,
        tutorialBattleDone: false
      },
      introSeen: false,
      tutorialSeen: false,
      tutorialStep: 0,
      stats: {
        wins: 0, losses: 0, summons: 0, fusions: 0, evolutions: 0,
        dungeonClears: 0, goldSpent: 0, crafts: 0
      }
    };
    return state;
  }

  function loadState() {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          // Empty roster is valid mid-tutorial (Raid pick flow)
          if (parsed && typeof parsed === 'object' &&
              (Array.isArray(parsed.roster) || parsed.introSeen != null || parsed.tutorialSeen != null)) {
            return sanitize(parsed);
          }
        }
      }
    } catch (e) { /* ignore */ }
    return defaultState();
  }

  function mergeResources(r) {
    var d = defaultResources();
    Object.keys(d).forEach(function (k) {
      if (r[k] == null) r[k] = d[k];
    });
    return r;
  }

  function sanitize(s) {
    if (!s.resources) s.resources = defaultResources();
    else s.resources = mergeResources(s.resources);
    if (!Array.isArray(s.roster)) s.roster = [];
    if (!Array.isArray(s.partyIds)) s.partyIds = s.roster.slice(0, 4).map(function (c) { return c.id; });
    if (!s.campaign) s.campaign = { selectedStage: 'gw1', progress: {} };
    if (!s.campaign.progress) s.campaign.progress = {};
    if (!s.dungeons) s.dungeons = { cleared: {}, bossWins: {} };
    if (!s.dungeons.cleared) s.dungeons.cleared = {};
    if (!s.dungeons.bossWins) s.dungeons.bossWins = {};
    if (!s.summon) s.summon = { pityRegular: 0, pityPremium: 0, pityAncient: 0, banner: 'celestial' };
    if (!s.player) s.player = { name: '', level: 1, exp: 0, statPoints: 3, stats: {} };
    if (s.player.name == null) s.player.name = '';
    if (!s.player.stats) s.player.stats = { taming: 0, alchemy: 0, combat: 0, leadership: 0, endurance: 0 };
    if (s.player.statPoints == null) s.player.statPoints = 0;
    if (!s.workshop) s.workshop = { incubator: 0, trainingHall: 0, refinery: 0 };
    if (!s.eternity) s.eternity = { voidFloor: 1, convergences: 0, claimedMilestones: {} };
    if (!s.eternity.claimedMilestones) s.eternity.claimedMilestones = {};
    if (!Array.isArray(s.artifacts)) s.artifacts = [];
    if (!s.flags) s.flags = { battleElixirActive: false, explorerTonicCharges: 0, globalPowerBonus: 1 };
    if (s.flags.globalPowerBonus == null) s.flags.globalPowerBonus = 1;
    if (typeof s.introSeen !== 'boolean') s.introSeen = false;
    if (typeof s.tutorialSeen !== 'boolean') s.tutorialSeen = false;
    if (s.tutorialStep == null) s.tutorialStep = 0;
    if (!s.flags) s.flags = {};
    if (typeof s.flags.tutorialPickDone !== 'boolean') {
      // Legacy saves with a roster already past the pick step
      s.flags.tutorialPickDone = !!(s.tutorialSeen || (s.roster && s.roster.length));
    }
    if (typeof s.flags.tutorialBattleDone !== 'boolean') {
      s.flags.tutorialBattleDone = !!s.flags.tutorialPickDone;
    }
    if (s.tutorialCandidates != null && !Array.isArray(s.tutorialCandidates)) {
      s.tutorialCandidates = null;
    }
    if (!s.stats) s.stats = { wins: 0, losses: 0, summons: 0, fusions: 0, evolutions: 0, dungeonClears: 0, goldSpent: 0, crafts: 0 };
    s.roster.forEach(function (c) {
      if (c.id == null) c.id = nextId();
      if (!c.element) c.element = 'Water';
      if (!c.rarity) c.rarity = 'Common';
      if (!c.level) c.level = 1;
      if (c.exp == null) c.exp = 0;
      // Star path: fixed base by rarity; purple = times evolved (capped)
      var base = (DATA && DATA.getBaseStars) ? DATA.getBaseStars(c) : 1;
      c.baseStars = base;
      var pur = c.purpleStars != null ? c.purpleStars : (c.evolutionLevel || 0);
      pur = Math.max(0, Math.floor(Number(pur) || 0));
      if (base <= 0) pur = 0;
      else pur = Math.min(base, pur);
      c.purpleStars = pur;
      c.evolutionLevel = pur; // legacy alias
      var maxLv = getChampionMaxLevel(c);
      if ((c.level || 1) > maxLv) c.level = maxLv;
      if (!c.power) c.power = estimateBasePower(c);
      if (!Array.isArray(c.traits)) {
        c.traits = (DATA && DATA.rollTraitsForRarity) ? DATA.rollTraitsForRarity(c.rarity) : [];
      }
      if (!c.equipment || typeof c.equipment !== 'object') c.equipment = {};
      if (!c.artVariant) {
        c.artVariant = (global.SR_ART && global.SR_ART.artVariantForUnit)
          ? global.SR_ART.artVariantForUnit(c)
          : 'a';
      }
      // Themed skill kit — refresh when missing or rarity unlock grew the kit
      if (DATA && typeof DATA.getChampionSkillIds === 'function') {
        var want = DATA.getChampionSkillIds(c);
        var have = Array.isArray(c.skillIds) ? c.skillIds : [];
        // Refresh if empty, shorter than rarity unlock, or only legacy generic ids
        var legacyOnly = have.length > 0 && have.every(function (id) {
          return id === 'basic' || id === 'smash' || id === 'heal' || id === 'shield';
        });
        if (!have.length || have.length < want.length || legacyOnly) {
          c.skillIds = want;
        }
      }
      // Fix old saves where trait/gear power was written back into base every refresh
      sanitizeChampionPower(c);
      refreshChampionDerived(c);
      // Migrate equipment slot keys armor→chest, ring→gloves
      if (c.equipment) {
        if (c.equipment.armor && !c.equipment.chest) {
          c.equipment.chest = c.equipment.armor;
          delete c.equipment.armor;
        }
        if (c.equipment.ring && !c.equipment.gloves) {
          // Prefer existing gloves; only move ring if gloves empty
          if (!c.equipment.gloves) c.equipment.gloves = c.equipment.ring;
          delete c.equipment.ring;
        }
      }
    });
    sanitizeArtifactNames(s);
    return s;
  }

  function saveState(state) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      }
    } catch (e) { /* ignore */ }
    return state;
  }

  /**
   * Full wipe → empty new-game state (Raid tutorial will re-seed Epic + kit).
   * Clears vault gear, equipped copies, roster, and all slimeRaid* localStorage keys.
   */
  function resetGame() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SAVE_KEY);
        // Scrub any legacy / sibling keys so Restart never leaves old vault gear
        var scrub = [];
        var li;
        for (li = 0; li < localStorage.length; li++) {
          var lk = localStorage.key(li);
          if (lk && (lk.indexOf('slimeRaid') === 0 || lk.indexOf('slime-raid') === 0 ||
              lk.indexOf('SlimeRaid') === 0)) {
            scrub.push(lk);
          }
        }
        for (li = 0; li < scrub.length; li++) {
          try { localStorage.removeItem(scrub[li]); } catch (e2) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }

    var fresh = defaultState();
    // Hard-empty any mutable bags (defense in depth)
    fresh.roster = [];
    fresh.partyIds = [];
    fresh.artifacts = [];
    fresh.tutorialCandidates = null;
    fresh.introSeen = false;
    fresh.tutorialSeen = false;
    fresh.tutorialStep = 0;
    fresh.campaign = { selectedStage: 'gw1', progress: {} };
    fresh.dungeons = { cleared: {}, bossWins: {} };
    fresh.stats = {
      wins: 0, losses: 0, summons: 0, fusions: 0, evolutions: 0,
      dungeonClears: 0, goldSpent: 0, crafts: 0
    };
    fresh.flags = {
      battleElixirActive: false,
      explorerTonicCharges: 0,
      globalPowerBonus: 1,
      havenKitGranted: false,
      tutorialPickDone: false,
      tutorialBattleDone: false,
      hubCoachDone: false,
      equipCoachDone: false,
      firstCampaignWin: false,
      battleCoachDone: false
    };
    if (fresh.player) {
      fresh.player.name = '';
      fresh.player.level = 1;
      fresh.player.exp = 0;
      fresh.player.statPoints = 3;
      fresh.player.stats = { taming: 0, alchemy: 0, combat: 0, leadership: 0, endurance: 0 };
    }
    // Wipe in-memory global before rewrite so no scene reuses old refs
    try {
      if (typeof global !== 'undefined') global.SR_GAME_STATE = fresh;
      if (typeof window !== 'undefined') window.SR_GAME_STATE = fresh;
    } catch (e3) { /* ignore */ }
    saveState(fresh);
    return fresh;
  }

  /**
   * Display / match-up power (Raid-weighted stats + gear + traits).
   * Always refresh derived attrs so hub and pre-battle never disagree.
   */
  function championDisplayPower(champ) {
    if (!champ) return 0;
    refreshChampionDerived(champ);
    if (champ.attributes && champ.attributes.power != null) {
      return Math.max(0, Math.floor(Number(champ.attributes.power) || 0));
    }
    return Math.max(0, Math.floor(Number(champ.power) || 0));
  }

  function markIntroSeen(state) {
    state.introSeen = true;
    saveState(state);
    return state;
  }

  function markTutorialSeen(state) {
    state.tutorialSeen = true;
    state.tutorialStep = 0;
    saveState(state);
    return state;
  }

  /** Display name for the Haven-Keeper (badge, UI). Falls back to "Keeper". */
  function playerDisplayName(state) {
    var n = state && state.player && state.player.name;
    n = String(n || '').trim();
    return n || 'Keeper';
  }

  /**
   * Set the player's name (from Lyra's intro prompt).
   * @returns {{ ok: boolean, name?: string, error?: string }}
   */
  function setPlayerName(state, raw) {
    if (!state) return { ok: false, error: 'No save' };
    if (!state.player) state.player = { name: '', level: 1, exp: 0, statPoints: 0, stats: {} };
    var name = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    // Strip control chars / angle brackets
    name = name.replace(/[<>\u0000-\u001f]/g, '');
    if (!name) name = 'Keeper';
    if (name.length > 18) name = name.slice(0, 18).trim();
    state.player.name = name;
    saveState(state);
    return { ok: true, name: name };
  }

  function getParty(state) {
    var map = {};
    state.roster.forEach(function (c) { map[c.id] = c; });
    var maxParty = 4 + Math.min(2, (state.player && state.player.stats && state.player.stats.leadership) || 0);
    var party = (state.partyIds || []).map(function (id) { return map[id]; }).filter(Boolean).slice(0, maxParty);
    if (!party.length && state.roster.length) {
      party = state.roster.slice(0, Math.min(4, maxParty));
      state.partyIds = party.map(function (c) { return c.id; });
    }
    return party;
  }

  function partyPower(state) {
    var bonus = (state.flags && state.flags.globalPowerBonus) || 1;
    var combat = (state.player && state.player.stats && state.player.stats.combat) || 0;
    bonus *= 1 + combat * 0.025;
    if (state.flags && state.flags.battleElixirActive) bonus *= 1.25;
    return Math.floor(getParty(state).reduce(function (s, c) {
      // Same Raid PWR number as pre-battle / champion sheet (gear + traits)
      return s + championDisplayPower(c);
    }, 0) * bonus);
  }

  function performSummon(state, type, count) {
    type = type || 'regular';
    count = count || 1;
    var cost = summonCostFor(type, count);
    var costKey = cost.currency;
    var amount = cost.amount;
    if ((state.resources[costKey] || 0) < amount) {
      return { ok: false, error: 'Not enough shards', results: [] };
    }
    state.resources[costKey] -= amount;
    var results = [];
    var pityHits = 0;
    for (var i = 0; i < count; i++) {
      var rolled = rollSummonRarity(state, type);
      var rarity = rolled.rarity;
      if (rolled.pityForced) pityHits += 1;
      var el = (DATA && DATA.ELEMENTS)
        ? DATA.ELEMENTS[Math.floor(Math.random() * DATA.ELEMENTS.length)]
        : 'Water';
      var champ = createChampion({ element: el, rarity: rarity, level: 1 });
      state.roster.push(champ);
      results.push(champ);
      state.stats.summons = (state.stats.summons || 0) + 1;
    }
    saveState(state);
    return { ok: true, results: results, pityHits: pityHits };
  }

  function stageUnlocked(state, stage) {
    var stages = (DATA && DATA.CAMPAIGN_STAGES) || [];
    var idx = stages.findIndex(function (s) { return s.id === stage.id; });
    if (idx <= 0) return true;
    var prev = stages[idx - 1];
    var prog = state.campaign.progress[prev.id];
    return prog && prog.stars >= 1;
  }

  function dungeonUnlocked(state, dungeon, index) {
    if (index <= 0) return true;
    var prev = (DATA.DUNGEONS || [])[index - 1];
    return prev && state.dungeons.cleared[prev.id];
  }

  /**
   * Fantasy hard-realm foe (not a gel champion).
   * Carries enemyKind for 3D silhouette + combat still uses element/power.
   */
  function createEnemy(opts) {
    opts = opts || {};
    var el = opts.element || 'Earth';
    var rarity = opts.rarity || 'Common';
    var level = opts.level || 1;
    var power = (typeof opts.power === 'number' && opts.power > 0)
      ? Math.floor(opts.power)
      : Math.floor((40 + level * 12) * ((DATA && DATA.RARITY_POWER && DATA.RARITY_POWER[rarity]) || 1));
    var kind = opts.enemyKind || opts.kind || 'beast';
    return {
      id: opts.id != null ? opts.id : nextId(),
      name: opts.name || 'Hard-Realm Foe',
      species: opts.species || opts.name || 'Foe',
      element: el,
      rarity: rarity,
      level: level,
      power: power,
      exp: 0,
      locked: false,
      evolutionLevel: 0,
      traits: [],
      equipment: {},
      // Flags for combat + 3D
      isEnemy: true,
      enemyKind: kind,
      isBoss: !!opts.isBoss,
      // Optional absolute height override (worldSize.js)
      worldHeight: opts.worldHeight || opts.height || undefined,
      attributes: {
        power: power,
        atk: Math.floor(power * 0.28),
        hp: Math.floor(power * 2),
        def: 10,
        res: 8,
        spd: 95 + Math.floor(Math.random() * 20),
        crit: 6
      }
    };
  }

  function pickFromPool(pool, preferElement) {
    pool = pool || [];
    if (!pool.length) {
      return { name: 'Hard-Realm Invader', kind: 'beast', element: preferElement || 'Earth' };
    }
    var filtered = preferElement
      ? pool.filter(function (e) { return e.element === preferElement; })
      : pool;
    if (!filtered.length) filtered = pool;
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  function enemyPoolForStage(stage) {
    var region = (stage && stage.region) || 'greenwild';
    var pools = (DATA && DATA.ENEMY_POOLS) || {};
    return pools[region] || pools.greenwild || [];
  }

  function enemyPoolForDungeon(dungeon) {
    var id = (dungeon && dungeon.id) || '';
    var pools = (DATA && DATA.ENEMY_POOLS) || {};
    if (pools[id]) return pools[id];
    // Fall back by dungeon element region mapping
    var el = (dungeon && dungeon.element) || 'Earth';
    if (el === 'Plant' || el === 'Earth' || el === 'Wind') return pools.greenwild || [];
    if (el === 'Ice' || el === 'Crystal' || el === 'Metal') return pools.crystal || [];
    if (el === 'Shadow' || el === 'Poison') return pools.shadowfen || [];
    if (el === 'Fire' || el === 'Lava') return pools.volcanic || [];
    if (el === 'Light' || el === 'Spirit' || el === 'Void' || el === 'Lightning' || el === 'Storm') {
      return pools.celestial || [];
    }
    return pools.greenwild || [];
  }

  function makeStageFoes(stage) {
    var power = (stage && stage.power) || 100;
    var el = (stage && stage.element) || 'Earth';
    var pool = enemyPoolForStage(stage);
    var foes = [];

    // Trash pack — zone fantasy fauna
    var a = pickFromPool(pool, el);
    foes.push(createEnemy({
      name: a.name,
      enemyKind: a.kind,
      element: a.element || el,
      rarity: 'Common',
      level: Math.max(1, Math.floor(power / 40)),
      power: Math.floor(power * 0.7)
    }));

    if (stage && stage.boss) {
      // Chapter boss: epic creature from the zone (not "Stage Name Tyrant")
      var b = pickFromPool(pool, el);
      var bossKind = b.kind;
      if (bossKind === 'insect') bossKind = 'beast';
      foes.push(createEnemy({
        name: b.name,
        enemyKind: bossKind || 'golem',
        element: b.element || el,
        rarity: 'Epic',
        level: Math.max(5, Math.floor(power / 35)),
        power: power,
        isBoss: true
      }));
    } else {
      var c = pickFromPool(pool, null);
      foes.push(createEnemy({
        name: c.name,
        enemyKind: c.kind,
        element: c.element || el,
        rarity: 'Uncommon',
        level: Math.max(2, Math.floor(power / 45)),
        power: Math.floor(power * 0.9)
      }));
    }
    return foes;
  }

  /** Total waves for a dungeon (1–5). */
  function dungeonWaveCount(dungeon) {
    var n = dungeon && dungeon.waves != null ? Number(dungeon.waves) : 1;
    if (!isFinite(n) || n < 1) n = 1;
    return Math.max(1, Math.min(5, Math.floor(n)));
  }

  /**
   * Build foes for dungeon wave (0-based index).
   * Wave 1 softer trash → mid escalates → final wave rare/epic punch.
   */
  function makeDungeonWaveFoes(dungeon, waveIndex) {
    var total = dungeonWaveCount(dungeon);
    var w = Math.max(0, Math.min(total - 1, Math.floor(Number(waveIndex) || 0)));
    var power = (dungeon && dungeon.power) || 150;
    var el = (dungeon && dungeon.element) || 'Earth';
    var pool = enemyPoolForDungeon(dungeon);
    // Scale power across waves (final ~15% above base, first ~28% below)
    var t = total <= 1 ? 1 : w / (total - 1);
    var waveMul = 0.72 + t * 0.43; // 0.72 → 1.15
    var roles;
    if (total === 1) {
      roles = [
        { rarity: 'Common', mult: 0.55, levelDiv: 50 },
        { rarity: 'Uncommon', mult: 0.75, levelDiv: 45 },
        { rarity: 'Rare', mult: 1.0, levelDiv: 40 }
      ];
    } else if (w === 0) {
      roles = [
        { rarity: 'Common', mult: 0.48, levelDiv: 55 },
        { rarity: 'Common', mult: 0.52, levelDiv: 52 },
        { rarity: 'Uncommon', mult: 0.68, levelDiv: 48 }
      ];
    } else if (w >= total - 1) {
      roles = [
        { rarity: 'Uncommon', mult: 0.82, levelDiv: 44 },
        { rarity: 'Rare', mult: 1.05, levelDiv: 38 },
        { rarity: 'Epic', mult: 1.22, levelDiv: 34 }
      ];
    } else {
      roles = [
        { rarity: 'Common', mult: 0.58, levelDiv: 50 },
        { rarity: 'Uncommon', mult: 0.78, levelDiv: 44 },
        { rarity: 'Rare', mult: 0.98, levelDiv: 40 }
      ];
    }
    var used = {};
    return roles.map(function (role, ri) {
      var p = pickFromPool(pool, null);
      var tries = 0;
      while (used[p.name] && tries < 8) {
        p = pickFromPool(pool, null);
        tries++;
      }
      used[p.name] = true;
      var isFinal = w >= total - 1 && ri === roles.length - 1;
      return createEnemy({
        name: isFinal ? (p.name + ' (Apex)') : p.name,
        enemyKind: p.kind,
        element: p.element || el,
        rarity: role.rarity,
        level: Math.max(2, Math.floor(power * waveMul / role.levelDiv)),
        power: Math.floor(power * role.mult * waveMul),
        isBoss: !!isFinal && total > 1
      });
    });
  }

  /** Wave 1 pack (backward-compatible entry point). */
  function makeDungeonFoes(dungeon) {
    return makeDungeonWaveFoes(dungeon, 0);
  }

  function makeBossFoes(boss) {
    var bid = (boss && boss.id) || '';
    var minions = (DATA && DATA.BOSS_MINIONS && DATA.BOSS_MINIONS[bid]) || [
      { name: 'Hard-Realm Minion', kind: 'beast', element: (boss && boss.element) || 'Fire' }
    ];
    var m = minions[Math.floor(Math.random() * minions.length)];
    var pack = [
      createEnemy({
        name: m.name,
        enemyKind: m.kind,
        element: m.element || boss.element,
        rarity: 'Epic',
        level: 12,
        power: Math.floor((boss.power || 280) * 0.55)
      }),
      createEnemy({
        name: boss.name,
        enemyKind: boss.enemyKind || 'dragon',
        element: boss.element || 'Fire',
        rarity: 'Legendary',
        level: 18,
        power: boss.power || 280,
        isBoss: true
      })
    ];
    return pack;
  }

  /**
   * Roll a gear piece into the vault.
   * @param {object} opts
   *   set — force set name
   *   setPool — pick random from these sets (dungeon)
   *   randomSet — any ARTIFACT_SETS key (campaign)
   *   powerMin / powerMax
   *   source — label for naming ('Campaign', 'Dungeon', …)
   */
  function rollGearDrop(opts) {
    opts = opts || {};
    var validSets = (DATA && DATA.ARTIFACT_SETS) ? Object.keys(DATA.ARTIFACT_SETS) : ['Life', 'Offense', 'Defense', 'Speed', 'Critical', 'Perception'];
    var setName = opts.set || null;
    if (!setName && opts.setPool && opts.setPool.length) {
      var pool = opts.setPool.filter(function (s) { return validSets.indexOf(s) >= 0; });
      if (!pool.length) pool = validSets;
      setName = pool[Math.floor(Math.random() * pool.length)];
    }
    if (!setName || opts.randomSet) {
      setName = validSets[Math.floor(Math.random() * validSets.length)];
    }
    if (validSets.indexOf(setName) < 0) setName = validSets[0] || 'Life';
    var pMin = opts.powerMin != null ? opts.powerMin : 4;
    var pMax = opts.powerMax != null ? opts.powerMax : 14;
    if (pMax < pMin) pMax = pMin;
    var power = pMin + Math.floor(Math.random() * (pMax - pMin + 1));
    var slots = (DATA && DATA.ARTIFACT_SLOTS) || [];
    var slotId = opts.slotId ||
      (slots.length ? slots[Math.floor(Math.random() * slots.length)].id : 'weapon');
    return createArtifact({
      set: setName,
      slotId: slotId,
      power: power,
      rarity: opts.rarity || (power >= 12 ? 'Rare' : power >= 8 ? 'Uncommon' : 'Common')
    });
  }

  function grantGearToVault(state, art) {
    if (!art || !state) return null;
    state.artifacts = state.artifacts || [];
    state.artifacts.push(art);
    return art;
  }

  function recordStageWin(state, stageId, stars) {
    stars = stars || 1;
    var prev = state.campaign.progress[stageId] || { stars: 0 };
    var isFirstClear = !(prev.stars > 0);
    state.campaign.progress[stageId] = { stars: Math.max(prev.stars || 0, stars) };
    state.stats.wins = (state.stats.wins || 0) + 1;
    var gold = 40 + stars * 20;
    var shards = 10 + stars * 5;
    // First clear of a stage: slightly sweeter spoils
    if (isFirstClear) {
      gold += 25;
      shards += 8;
    }
    state.resources.gold = (state.resources.gold || 0) + gold;
    state.resources.slimeShards = (state.resources.slimeShards || 0) + shards;
    // Front-loaded XP: early levels should move after a few clears
    var partyExp = 70 + stars * 18;
    if (isFirstClear) partyExp = Math.floor(partyExp * 1.18);
    var partySnap = getParty(state).map(function (c) {
      return { id: c.id, name: c.name, level: Math.max(1, c.level || 1) };
    });
    grantPartyExp(state, partyExp);
    if (state.flags) state.flags.battleElixirActive = false;
    grantPlayerExp(state, 8 + stars * 2 + (isFirstClear ? 3 : 0));

    // Campaign: random-set gear drop (chance scales with stars)
    var rewards = [
      { icon: '🪙', label: 'Gold', amount: gold },
      { icon: '💎', label: 'Slime Shards', amount: shards },
      { icon: '⭐', label: 'Stars', amount: stars },
      { icon: '📈', label: 'Party EXP', amount: partyExp }
    ];
    // Visible level-ups (makes the XP curve feel real)
    var totalLv = 0;
    var who = [];
    getParty(state).forEach(function (c) {
      var before = null;
      for (var si = 0; si < partySnap.length; si++) {
        if (partySnap[si].id === c.id) { before = partySnap[si]; break; }
      }
      if (before && (c.level || 1) > before.level) {
        var gained = (c.level || 1) - before.level;
        totalLv += gained;
        who.push(c.name || 'Gel');
      }
    });
    if (totalLv > 0) {
      var whoLabel = who.length <= 2
        ? who.join(' & ')
        : (who[0] + ' +' + (who.length - 1));
      rewards.push({
        icon: '⬆️',
        label: whoLabel + ' leveled',
        amount: '+' + totalLv
      });
    }
    // Guarantee gear on first clear of a stage; otherwise star-scaled chance
    var dropChance = 0.42 + Math.min(0.35, (stars || 1) * 0.12);
    var gear = null;
    if (isFirstClear || Math.random() < dropChance) {
      var stageIdx = 1;
      if (stageId && typeof stageId === 'string') {
        var m = stageId.match(/(\d+)/);
        if (m) stageIdx = Math.max(1, parseInt(m[1], 10) || 1);
      }
      gear = rollGearDrop({
        randomSet: true,
        source: 'Campaign',
        powerMin: 4 + Math.min(8, Math.floor(stageIdx / 3)),
        powerMax: 10 + Math.min(10, Math.floor(stageIdx / 2)) + stars
      });
      grantGearToVault(state, gear);
      rewards.push({
        icon: '🛡️',
        label: (gear.set || 'Gear') + (isFirstClear ? ' (first clear)' : ' Relic'),
        amount: '+' + (gear.power || 0)
      });
    }

    saveState(state);
    return { rewards: rewards, gear: gear, firstClear: isFirstClear, levelsGained: totalLv };
  }

  function recordDungeonWin(state, dungeonId) {
    state.dungeons.cleared[dungeonId] = (state.dungeons.cleared[dungeonId] || 0) + 1;
    state.stats.dungeonClears = (state.stats.dungeonClears || 0) + 1;
    state.stats.wins = (state.stats.wins || 0) + 1;
    state.resources.gold = (state.resources.gold || 0) + 80;
    state.resources.slimeEssence = (state.resources.slimeEssence || 0) + 6;
    state.resources.jelly = (state.resources.jelly || 0) + 10;

    // Dungeon: always drop gear from that dungeon's set pool
    var dDef = ((DATA && DATA.DUNGEONS) || []).find(function (d) { return d.id === dungeonId; });
    var setPool = (dDef && dDef.gear && dDef.gear.length) ? dDef.gear.slice() : null;
    var powerScale = dDef && dDef.power ? Math.floor(dDef.power / 40) : 4;
    var relic = rollGearDrop({
      setPool: setPool,
      source: (dDef && dDef.name) || 'Dungeon',
      powerMin: 6 + Math.min(8, powerScale),
      powerMax: 12 + Math.min(12, powerScale)
    });
    grantGearToVault(state, relic);

    var dungeonExp = 110;
    grantPartyExp(state, dungeonExp);
    if (state.flags) state.flags.battleElixirActive = false;
    grantPlayerExp(state, 12);
    saveState(state);
    return {
      rewards: [
        { icon: '🪙', label: 'Gold', amount: 80 },
        { icon: '💠', label: 'Slime Essence', amount: 6 },
        { icon: '🍮', label: 'Jelly', amount: 10 },
        {
          icon: '🛡️',
          label: (relic.set || 'Set') + ' Relic',
          amount: '+' + (relic.power || 0)
        },
        { icon: '📈', label: 'Party EXP', amount: dungeonExp }
      ],
      gear: relic
    };
  }

  function recordBossWin(state, bossId) {
    state.dungeons.bossWins[bossId] = (state.dungeons.bossWins[bossId] || 0) + 1;
    state.stats.wins = (state.stats.wins || 0) + 1;
    state.resources.gold = (state.resources.gold || 0) + 150;
    state.resources.divineShards = (state.resources.divineShards || 0) + 3;
    state.resources.manaShards = (state.resources.manaShards || 0) + 10;

    // Boss: strong random-set drop (farm any set at higher power)
    var bDef = ((DATA && DATA.BOSSES) || []).find(function (b) { return b.id === bossId; });
    var bossGear = rollGearDrop({
      randomSet: true,
      source: (bDef && bDef.name) || 'Boss',
      powerMin: 12,
      powerMax: 22,
      rarity: 'Epic'
    });
    grantGearToVault(state, bossGear);

    var bossExp = 160;
    grantPartyExp(state, bossExp);
    if (state.flags) state.flags.battleElixirActive = false;
    grantPlayerExp(state, 20);
    saveState(state);
    return {
      rewards: [
        { icon: '🪙', label: 'Gold', amount: 150 },
        { icon: '✨', label: 'Divine Shards', amount: 3 },
        { icon: '🔮', label: 'Mana Shards', amount: 10 },
        {
          icon: '🛡️',
          label: (bossGear.set || 'Set') + ' Relic',
          amount: '+' + (bossGear.power || 0)
        },
        { icon: '📈', label: 'Party EXP', amount: bossExp }
      ],
      gear: bossGear
    };
  }

  function recordSparWin(state) {
    state.stats.wins = (state.stats.wins || 0) + 1;
    var gold = 25;
    var jelly = 5;
    state.resources.gold = (state.resources.gold || 0) + gold;
    state.resources.jelly = (state.resources.jelly || 0) + jelly;
    var sparExp = 35;
    grantPartyExp(state, sparExp);
    if (state.flags) state.flags.battleElixirActive = false;
    grantPlayerExp(state, 4);
    saveState(state);
    return {
      rewards: [
        { icon: '🪙', label: 'Gold', amount: gold },
        { icon: '🍮', label: 'Jelly', amount: jelly },
        { icon: '📈', label: 'Party EXP', amount: sparExp }
      ]
    };
  }

  function recordLoss(state) {
    state.stats.losses = (state.stats.losses || 0) + 1;
    if (state.flags) state.flags.battleElixirActive = false;
    saveState(state);
    return { rewards: [] };
  }

  function grantPlayerExp(state, amount) {
    state.player = state.player || { level: 1, exp: 0, statPoints: 0, stats: {} };
    state.player.exp = (state.player.exp || 0) + amount;
    while (state.player.exp >= state.player.level * 50) {
      state.player.exp -= state.player.level * 50;
      state.player.level += 1;
      state.player.statPoints = (state.player.statPoints || 0) + 1;
    }
  }

  function spendStatPoint(state, statId) {
    var stats = (DATA && DATA.PLAYER_STATS) || [];
    var found = stats.some(function (s) { return s.id === statId; });
    if (!found) return { ok: false, error: 'Unknown stat' };
    if ((state.player.statPoints || 0) < 1) return { ok: false, error: 'No stat points' };
    state.player.statPoints -= 1;
    state.player.stats[statId] = (state.player.stats[statId] || 0) + 1;
    saveState(state);
    return { ok: true, value: state.player.stats[statId] };
  }

  function buyItem(state, itemId) {
    var items = (DATA && DATA.MARKET_ITEMS) || [];
    var item = items.find(function (i) { return i.id === itemId; });
    if (!item) return { ok: false, error: 'Unknown item' };
    var cur = item.currency || 'gold';
    if ((state.resources[cur] || 0) < item.cost) return { ok: false, error: 'Not enough ' + cur };
    state.resources[cur] -= item.cost;
    state.stats.goldSpent = (state.stats.goldSpent || 0) + (cur === 'gold' ? item.cost : 0);
    Object.keys(item.grant || {}).forEach(function (k) {
      state.resources[k] = (state.resources[k] || 0) + item.grant[k];
    });
    saveState(state);
    return { ok: true, item: item };
  }

  function craftRecipe(state, recipeId) {
    var recipes = (DATA && DATA.ALCHEMY_RECIPES) || [];
    var rec = recipes.find(function (r) { return r.id === recipeId; });
    if (!rec) return { ok: false, error: 'Unknown recipe' };
    var alchemy = (state.player && state.player.stats && state.player.stats.alchemy) || 0;
    var refinery = (state.workshop && state.workshop.refinery) || 0;
    var bonus = 1 + alchemy * 0.04 + (rec.id === 'refine_essence' ? refinery * 0.15 : 0);
    var keys = Object.keys(rec.cost || {});
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if ((state.resources[k] || 0) < rec.cost[k]) {
        return { ok: false, error: 'Need more ' + k };
      }
    }
    keys.forEach(function (k) { state.resources[k] -= rec.cost[k]; });
    Object.keys(rec.grant || {}).forEach(function (k) {
      var amt = Math.floor((rec.grant[k] || 0) * bonus);
      state.resources[k] = (state.resources[k] || 0) + amt;
      if (k === 'explorerTonic') {
        state.flags.explorerTonicCharges = (state.flags.explorerTonicCharges || 0) + amt;
      }
    });
    if (rec.globalPower) {
      state.flags.globalPowerBonus = (state.flags.globalPowerBonus || 1) * rec.globalPower;
    }
    state.stats.crafts = (state.stats.crafts || 0) + 1;
    saveState(state);
    return { ok: true, recipe: rec };
  }

  function transmute(state, kind) {
    if (kind === 'gold_to_mana') {
      if ((state.resources.gold || 0) < 100) return { ok: false, error: 'Need 100 Gold' };
      state.resources.gold -= 100;
      state.resources.manaShards = (state.resources.manaShards || 0) + 8;
      saveState(state);
      return { ok: true };
    }
    if (kind === 'mana_to_divine') {
      if ((state.resources.manaShards || 0) < 50) return { ok: false, error: 'Need 50 Mana Shards' };
      state.resources.manaShards -= 50;
      state.resources.divineShards = (state.resources.divineShards || 0) + 3;
      saveState(state);
      return { ok: true };
    }
    return { ok: false, error: 'Unknown transmute' };
  }

  function useBattleElixir(state) {
    if ((state.resources.battleElixir || 0) < 1) return { ok: false, error: 'No Battle Elixirs' };
    state.resources.battleElixir -= 1;
    state.flags.battleElixirActive = true;
    saveState(state);
    return { ok: true };
  }

  function useHealingSalve(state) {
    if ((state.resources.healingSalve || 0) < 1) return { ok: false, error: 'No Healing Salve' };
    state.resources.healingSalve -= 1;
    var total = 0;
    state.roster.forEach(function (c) {
      var g = 20 + Math.floor(Math.random() * 12);
      grantChampionExp(c, g);
      total += g;
    });
    saveState(state);
    return { ok: true, exp: total };
  }

  function upgradeWorkshop(state, type) {
    if (type === 'advanced') {
      if ((state.resources.gold || 0) < 800 || (state.resources.manaShards || 0) < 25 || (state.resources.divineShards || 0) < 8) {
        return { ok: false, error: 'Need 800 Gold + 25 Mana + 8 Divine' };
      }
      state.resources.gold -= 800;
      state.resources.manaShards -= 25;
      state.resources.divineShards -= 8;
      state.flags.globalPowerBonus = (state.flags.globalPowerBonus || 1) * 1.08;
      saveState(state);
      return { ok: true, type: 'advanced' };
    }
    var ups = (DATA && DATA.WORKSHOP_UPGRADES) || [];
    var def = ups.find(function (u) { return u.id === type; });
    if (!def) return { ok: false, error: 'Unknown upgrade' };
    if ((state.resources.gold || 0) < def.gold || (state.resources.refinedEssence || 0) < def.essence) {
      return { ok: false, error: 'Need ' + def.gold + ' Gold + ' + def.essence + ' Refined Essence' };
    }
    state.resources.gold -= def.gold;
    state.resources.refinedEssence -= def.essence;
    state.workshop[type] = (state.workshop[type] || 0) + 1;
    saveState(state);
    return { ok: true, level: state.workshop[type] };
  }

  function fuseSlimes(state) {
    var unlocked = state.roster.filter(function (s) { return !s.locked; });
    if (unlocked.length < 2) return { ok: false, error: 'Need 2 unlocked slimes' };
    var s1 = null, s2 = null;
    for (var i = 0; i < unlocked.length; i++) {
      for (var j = i + 1; j < unlocked.length; j++) {
        if (unlocked[i].rarity === unlocked[j].rarity) {
          s1 = unlocked[i]; s2 = unlocked[j]; break;
        }
      }
      if (s1) break;
    }
    if (!s1) return { ok: false, error: 'Need two of the same rarity' };
    var base = s1.power >= s2.power ? s1 : s2;
    var sac = base === s1 ? s2 : s1;
    base.level = Math.max(base.level, sac.level) + 3;
    base.exp = 0;
    // Fuse: merge base power only (not compounded display power)
    base.power = Math.floor((sanitizeChampionPower(base).power + sanitizeChampionPower(sac).power) * 0.65);
    sanitizeChampionPower(base);
    var bp = Math.max(base.purpleStars || 0, base.evolutionLevel || 0);
    var sp = Math.max(sac.purpleStars || 0, sac.evolutionLevel || 0);
    var merged = Math.max(bp, sp);
    var baseStars = (DATA && DATA.getBaseStars) ? DATA.getBaseStars(base) : (base.baseStars || 1);
    merged = Math.min(baseStars, Math.max(0, merged));
    base.baseStars = baseStars;
    base.purpleStars = merged;
    base.evolutionLevel = merged;
    state.roster = state.roster.filter(function (c) { return c.id !== sac.id; });
    state.partyIds = (state.partyIds || []).filter(function (id) { return id !== sac.id; });
    state.stats.fusions = (state.stats.fusions || 0) + 1;
    saveState(state);
    return { ok: true, kept: base, sacrificed: sac.name };
  }

  function championBaseStars(champ) {
    if (DATA && DATA.getBaseStars) return DATA.getBaseStars(champ);
    return champ && champ.baseStars != null ? champ.baseStars : 1;
  }

  function championPurpleStars(champ) {
    if (DATA && DATA.getPurpleStars) return DATA.getPurpleStars(champ);
    var base = championBaseStars(champ);
    var n = champ && (champ.purpleStars != null ? champ.purpleStars : champ.evolutionLevel) || 0;
    if (base <= 0) return 0;
    return Math.min(base, Math.max(0, Math.floor(n)));
  }

  /** Eligible fodder: unlocked, not target, same base star count. */
  function listEvolveFodder(state, targetId) {
    var target = (state.roster || []).find(function (c) { return c.id === targetId; });
    if (!target) return [];
    var needStars = championBaseStars(target);
    if (needStars <= 0) return [];
    return (state.roster || []).filter(function (c) {
      if (c.id === targetId) return false;
      if (c.locked) return false;
      return championBaseStars(c) === needStars;
    });
  }

  function evolvePreview(state, targetId) {
    var target = (state.roster || []).find(function (c) { return c.id === targetId; });
    if (!target) return { ok: false, error: 'Champion not found' };
    var base = championBaseStars(target);
    var purple = championPurpleStars(target);
    var maxLv = getChampionMaxLevel(target);
    var level = Math.max(1, target.level || 1);
    if (purple >= base) {
      return {
        ok: false,
        maxed: true,
        baseStars: base,
        purpleStars: purple,
        maxLevel: maxLv,
        error: 'All ' + base + ' stars are already purple'
      };
    }
    var levelReq = maxLv; // must be at current cap (50, then 60, 70, …)
    var need = (DATA && DATA.fodderNeededForNextEvo)
      ? DATA.fodderNeededForNextEvo(target)
      : (purple + 1);
    var fodder = listEvolveFodder(state, targetId);
    var levelOk = level >= levelReq;
    var nextMax = maxLv + 10; // +10 cap after this purple
    var fodderOk = fodder.length >= need;
    return {
      ok: true, // UI may open; canEvolve says if confirm is allowed
      canEvolve: levelOk && fodderOk,
      baseStars: base,
      purpleStars: purple,
      nextPurple: purple + 1,
      fodderNeeded: need,
      fodderAvailable: fodder.length,
      fodder: fodder,
      canAfford: fodderOk,
      level: level,
      maxLevel: maxLv,
      levelReq: levelReq,
      levelOk: levelOk,
      nextMaxLevel: nextMax,
      error: !levelOk
        ? 'Need level ' + levelReq + ' to evolve (currently Lv ' + level + ')'
        : (!fodderOk
          ? 'Need ' + need + ' unlocked ' + base + '★ fodder'
          : null)
    };
  }

  /**
   * Star evolve at level cap: consume fodder → one star turns purple,
   * level resets to 1, cap +10, power soft-nerfed from peak (not wiped).
   */
  function evolveChampion(state, targetId, fodderIds) {
    fodderIds = fodderIds || [];
    var preview = evolvePreview(state, targetId);
    if (preview.maxed) return preview;
    if (!preview.levelOk) {
      return {
        ok: false,
        error: preview.error || ('Need level ' + preview.levelReq + ' to evolve'),
        levelReq: preview.levelReq,
        level: preview.level
      };
    }
    var need = preview.fodderNeeded;
    var ids = [];
    var seen = {};
    fodderIds.forEach(function (id) {
      if (id == null || seen[id] || id === targetId) return;
      seen[id] = true;
      ids.push(id);
    });
    if (ids.length !== need) {
      return {
        ok: false,
        error: 'Select exactly ' + need + ' champion' + (need === 1 ? '' : 's') +
          ' of ' + preview.baseStars + '★ to consume',
        fodderNeeded: need,
        selected: ids.length
      };
    }
    var target = (state.roster || []).find(function (c) { return c.id === targetId; });
    var needStars = preview.baseStars;
    var toRemove = [];
    for (var i = 0; i < ids.length; i++) {
      var f = (state.roster || []).find(function (c) { return c.id === ids[i]; });
      if (!f) return { ok: false, error: 'Fodder not found in roster' };
      if (f.locked) return { ok: false, error: f.name + ' is locked' };
      if (championBaseStars(f) !== needStars) {
        return { ok: false, error: f.name + ' is not a ' + needStars + '★ champion' };
      }
      toRemove.push(f);
    }
    // Consume fodder
    var removeSet = {};
    toRemove.forEach(function (f) { removeSet[f.id] = true; });
    state.roster = (state.roster || []).filter(function (c) { return !removeSet[c.id]; });
    state.partyIds = (state.partyIds || []).filter(function (id) { return !removeSet[id]; });

    var prevLevel = target.level || 1;
    var prevPower = sanitizeChampionPower(target).power || estimateBasePower(target);
    var purple = championPurpleStars(target) + 1;
    target.baseStars = needStars;
    target.purpleStars = purple;
    target.evolutionLevel = purple;
    // Reset to Lv1; new cap = 50 + purple×10
    target.level = 1;
    target.exp = 0;
    // Soft keep ~72% of peak power + small purple floor (not a full wipe)
    var floorP = estimateBasePower(target);
    target.power = Math.max(
      floorP,
      Math.floor(prevPower * 0.72) + 6 + purple * 4
    );
    sanitizeChampionPower(target);
    refreshChampionDerived(target);
    state.stats.evolutions = (state.stats.evolutions || 0) + 1;
    saveState(state);
    return {
      ok: true,
      slime: target,
      champion: target,
      purpleStars: purple,
      baseStars: needStars,
      maxLevel: getChampionMaxLevel(target),
      prevLevel: prevLevel,
      prevPower: prevPower,
      powerAfter: target.power,
      rarity: target.rarity,
      mythicFlourish: String(target.rarity || '') === 'Mythic',
      fullConstellation: purple >= needStars,
      consumed: toRemove.map(function (f) { return f.name; })
    };
  }

  /**
   * Legacy auto-evolve removed — must select fodder via evolveChampion.
   * Kept as a stub so old calls get a clear error (tests use evolveChampion).
   */
  function evolveSlime(state, targetId, fodderIds) {
    if (targetId != null && fodderIds) {
      return evolveChampion(state, targetId, fodderIds);
    }
    return {
      ok: false,
      error: 'Open a champion and choose fodder to evolve (star system)'
    };
  }

  function slimeParty(state) {
    var now = Date.now();
    var cd = 60 * 60 * 1000;
    if (state.flags.lastSlimeParty && now - state.flags.lastSlimeParty < cd) {
      var min = Math.ceil((cd - (now - state.flags.lastSlimeParty)) / 60000);
      return { ok: false, error: 'Cooldown ~' + min + ' min' };
    }
    state.roster.forEach(function (s) {
      grantChampionExp(s, 45);
    });
    var jelly = 3 + Math.floor(Math.random() * 4);
    state.resources.jelly = (state.resources.jelly || 0) + jelly;
    state.flags.lastSlimeParty = now;
    grantPlayerExp(state, 6);
    saveState(state);
    return { ok: true, jelly: jelly };
  }

  /** Sync vault artifact stats into any equipped champion slot copies. */
  function syncEquippedArtifactCopy(state, art) {
    if (!art || !state) return;
    (state.roster || []).forEach(function (c) {
      if (!c.equipment) return;
      Object.keys(c.equipment).forEach(function (sid) {
        var p = c.equipment[sid];
        if (p && p.id === art.id) {
          p.level = art.level;
          p.value = art.power || art.value || p.value;
          p.name = art.name;
          p.rarity = art.rarity;
          p.set = art.set || p.set;
          p.setName = art.set || p.setName;
        }
      });
      refreshChampionDerived(c);
    });
  }

  /**
   * Guaranteed upgrade (legacy vault tap). Prefer enhanceArtifact for Raid-style chance.
   */
  function upgradeArtifact(state, artifactId) {
    var art = (state.artifacts || []).find(function (a) { return a.id === artifactId; });
    if (!art) return { ok: false, error: 'No artifact' };
    var level = art.level || 1;
    if (level >= 16) return { ok: false, error: 'Max level (+16)' };
    var cost = 30 + level * 20;
    if ((state.resources.gold || 0) < cost) return { ok: false, error: 'Need ' + cost + ' Gold' };
    state.resources.gold -= cost;
    art.level = level + 1;
    art.power = (art.power || 5) + 3;
    syncEquippedArtifactCopy(state, art);
    saveState(state);
    return { ok: true, success: true, artifact: art, costGold: cost, chance: 1 };
  }

  /**
   * Raid-style enhance: pay cost, roll success chance by level.
   * Chance starts high and drops as level rises (player sees % before anim).
   * @returns {{ ok, success?, chance, costGold, costEssence, artifact?, error?, failAt? }}
   */
  function enhanceArtifact(state, artifactId) {
    var art = (state.artifacts || []).find(function (a) { return a.id === artifactId; });
    if (!art) return { ok: false, error: 'No artifact' };
    var level = art.level || 1;
    if (level >= 16) return { ok: false, error: 'Max level (+16)' };
    // Success chance: ~100% at +1 → ~28% near +16
    var chance = Math.max(0.28, Math.min(1, 1.02 - (level - 1) * 0.055));
    chance = Math.round(chance * 100) / 100;
    var costGold = 45 + level * 38;
    var costEssence = level >= 4 ? Math.floor((level - 2) / 2) : 0;
    if ((state.resources.gold || 0) < costGold) {
      return { ok: false, error: 'Need ' + costGold + ' Gold', chance: chance, costGold: costGold, costEssence: costEssence };
    }
    if (costEssence > 0 && (state.resources.slimeEssence || 0) < costEssence) {
      return {
        ok: false,
        error: 'Need ' + costEssence + ' Slime Essence',
        chance: chance,
        costGold: costGold,
        costEssence: costEssence
      };
    }
    state.resources.gold -= costGold;
    if (costEssence > 0) state.resources.slimeEssence = (state.resources.slimeEssence || 0) - costEssence;

    var roll = Math.random();
    var success = roll < chance;
    // Where the bar “dies” on fail (struggle zone 70–92%)
    var failAt = success ? 1 : (0.70 + Math.random() * 0.22);

    if (success) {
      art.level = level + 1;
      art.power = (art.power || art.value || 5) + 2 + Math.floor(level / 3);
      art.value = art.power;
      syncEquippedArtifactCopy(state, art);
    }
    saveState(state);
    return {
      ok: true,
      success: success,
      chance: chance,
      roll: roll,
      failAt: failAt,
      costGold: costGold,
      costEssence: costEssence,
      artifact: art,
      levelBefore: level,
      levelAfter: art.level || level
    };
  }

  /** Preview enhance cost/chance without spending. */
  function enhanceArtifactPreview(state, artifactId) {
    var art = (state.artifacts || []).find(function (a) { return a.id === artifactId; });
    if (!art) return { ok: false, error: 'No artifact' };
    var level = art.level || 1;
    if (level >= 16) return { ok: false, error: 'Max level (+16)', maxed: true };
    var chance = Math.max(0.28, Math.min(1, 1.02 - (level - 1) * 0.055));
    chance = Math.round(chance * 100) / 100;
    var costGold = 45 + level * 38;
    var costEssence = level >= 4 ? Math.floor((level - 2) / 2) : 0;
    return {
      ok: true,
      artifact: art,
      level: level,
      nextLevel: level + 1,
      chance: chance,
      costGold: costGold,
      costEssence: costEssence,
      canAfford:
        (state.resources.gold || 0) >= costGold &&
        (costEssence <= 0 || (state.resources.slimeEssence || 0) >= costEssence)
    };
  }

  /** Normalize legacy slot ids (armor→chest, ring→gloves). */
  function normalizeArtifactSlot(slotId) {
    var s = String(slotId || 'weapon');
    if (s === 'armor') return 'chest';
    if (s === 'ring') return 'gloves';
    return s;
  }

  /**
   * Proper Raid-style piece name for set × slot (never "Weapon of Life" on a helm).
   */
  function nameForArtifact(setName, slotId) {
    if (DATA && typeof DATA.artifactPieceName === 'function') {
      return DATA.artifactPieceName(setName, slotId);
    }
    var slots = (DATA && DATA.ARTIFACT_SLOTS) || [];
    var slot = normalizeArtifactSlot(slotId);
    var slotDef = null;
    var i;
    for (i = 0; i < slots.length; i++) {
      if (slots[i].id === slot) { slotDef = slots[i]; break; }
    }
    return (setName || 'Relic') + ' ' + ((slotDef && slotDef.name) || 'Relic');
  }

  /** Create a vault relic (for loot / starter grants). */
  function createArtifact(opts) {
    opts = opts || {};
    var sets = (DATA && DATA.ARTIFACT_SETS) ? Object.keys(DATA.ARTIFACT_SETS) : ['Life', 'Offense', 'Defense'];
    var slots = (DATA && DATA.ARTIFACT_SLOTS) || [];
    var setName = opts.set || sets[Math.floor(Math.random() * sets.length)] || 'Life';
    var slot = normalizeArtifactSlot(
      opts.slotId || (slots[Math.floor(Math.random() * slots.length)] || {}).id || 'weapon'
    );
    var slotDef = null;
    var si;
    for (si = 0; si < slots.length; si++) {
      if (slots[si].id === slot) { slotDef = slots[si]; break; }
    }
    if (!slotDef) slotDef = { id: slot, name: 'Relic', stat: 'power' };
    var rar = opts.rarity || 'Common';
    var power = opts.power != null ? opts.power : (4 + Math.floor(Math.random() * 10));
    var niceName = opts.name || nameForArtifact(setName, slot);
    return {
      id: opts.id != null ? opts.id : nextId(),
      name: niceName,
      set: setName,
      setName: setName,
      slotHint: slot,
      mainStat: opts.mainStat || slotDef.stat || 'power',
      power: power,
      value: power,
      level: opts.level || 1,
      rarity: rar
    };
  }

  /**
   * Fix legacy names like "Weapon of Life" / wrong slot titles on load.
   */
  function sanitizeArtifactNames(state) {
    var arts = state && state.artifacts;
    if (!arts || !arts.length) return;
    var i;
    for (i = 0; i < arts.length; i++) {
      var a = arts[i];
      if (!a) continue;
      a.slotHint = normalizeArtifactSlot(a.slotHint || a.slot || 'weapon');
      a.set = a.set || a.setName || 'Life';
      a.setName = a.set;
      // Rewrite dumb "X of Set" names and generic "Set Relic"
      var nm = String(a.name || '');
      var dumb = / of (Life|Offense|Defense|Speed|Critical|Perception)$/i.test(nm) ||
        /^(Life|Offense|Defense|Speed|Critical|Perception) Relic$/i.test(nm) ||
        / Relic$/i.test(nm) ||
        !nm;
      if (dumb) {
        a.name = nameForArtifact(a.set, a.slotHint);
      }
    }
  }

  /** Free vault pieces for a slot (not equipped). */
  function freeArtifactsForSlot(state, slotId) {
    var list = state.artifacts || [];
    return list.filter(function (a) {
      if (a.equippedTo) return false;
      // Prefer matching slotHint when present; always allow general relics
      if (a.slotHint && slotId && a.slotHint !== slotId) return true; // still show all free
      return true;
    });
  }

  function claimMilestone(state, mid) {
    var list = (DATA && DATA.MILESTONES) || [];
    var m = list.find(function (x) { return x.id === mid; });
    if (!m) return { ok: false, error: 'Unknown milestone' };
    if (state.eternity.claimedMilestones[mid]) return { ok: false, error: 'Already claimed' };
    if (!m.check(state)) return { ok: false, error: 'Not complete' };
    state.eternity.claimedMilestones[mid] = true;
    Object.keys(m.reward || {}).forEach(function (k) {
      state.resources[k] = (state.resources[k] || 0) + m.reward[k];
    });
    saveState(state);
    return { ok: true, reward: m.reward };
  }

  function runVoidTower(state) {
    if ((state.player.level || 1) < 5) {
      // Port softens HTML Lv90 gate for playability; still scales with floor
      // Keep a soft gate of player level 5 for first climb
      return { ok: false, error: 'Reach player level 5 first' };
    }
    var floor = state.eternity.voidFloor || 1;
    var foePower = 80 + floor * 35;
    var partyP = partyPower(state);
    var win = partyP >= foePower * 0.85;
    if (win) {
      state.eternity.voidFloor = floor + 1;
      state.stats.wins = (state.stats.wins || 0) + 1;
      state.resources.voidShards = (state.resources.voidShards || 0) + 2 + Math.floor(floor / 5);
      state.resources.gold = (state.resources.gold || 0) + 30 + floor * 5;
      grantPlayerExp(state, 10);
      saveState(state);
      return { ok: true, won: true, floor: floor, next: state.eternity.voidFloor };
    }
    state.stats.losses = (state.stats.losses || 0) + 1;
    saveState(state);
    return { ok: true, won: false, floor: floor, party: partyP, need: Math.floor(foePower * 0.85) };
  }

  function divineConvergence(state) {
    var cost = 30 + (state.eternity.convergences || 0) * 15;
    if ((state.resources.divineShards || 0) < cost) {
      return { ok: false, error: 'Need ' + cost + ' Divine Shards' };
    }
    state.resources.divineShards -= cost;
    state.eternity.convergences = (state.eternity.convergences || 0) + 1;
    state.flags.globalPowerBonus = (state.flags.globalPowerBonus || 1) * 1.03;
    state.resources.voidShards = (state.resources.voidShards || 0) + 10;
    grantPlayerExp(state, 25);
    saveState(state);
    return { ok: true, cost: cost, convergences: state.eternity.convergences };
  }

  function inventoryLines(state) {
    var r = state.resources || {};
    var keys = Object.keys(r).filter(function (k) { return (r[k] || 0) > 0; }).sort();
    return keys.map(function (k) {
      return { key: k, amount: Math.floor(r[k] || 0) };
    });
  }

  /**
   * Dev / QA grant — top up summon currencies (and useful combat mats).
   * amount defaults to 20000. Saves state. Live boot does NOT call this
   * unless applyBootEconomy sees localStorage sr_dev_shards === '1'.
   */
  function grantDevShards(state, amount) {
    amount = typeof amount === 'number' && amount > 0 ? Math.floor(amount) : 20000;
    if (!state) state = loadState();
    if (!state.resources) state.resources = defaultResources();
    var r = state.resources;
    // All three summon banners
    r.slimeShards = Math.max(r.slimeShards || 0, amount);   // regular
    r.divineShards = Math.max(r.divineShards || 0, amount); // premium
    r.voidShards = Math.max(r.voidShards || 0, amount);     // ancient
    // Handy for other systems while testing
    r.gold = Math.max(r.gold || 0, amount);
    r.manaShards = Math.max(r.manaShards || 0, amount);
    r.jelly = Math.max(r.jelly || 0, amount);
    r.slimeEssence = Math.max(r.slimeEssence || 0, amount);
    saveState(state);
    return {
      ok: true,
      amount: amount,
      slimeShards: r.slimeShards,
      divineShards: r.divineShards,
      voidShards: r.voidShards
    };
  }

  function shouldGrantDevShards() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage || !localStorage.getItem) {
        return false;
      }
      return localStorage.getItem('sr_dev_shards') === '1';
    } catch (e) {
      return false;
    }
  }

  /** BootScene.create economy hook — opt-in QA bank only. */
  function applyBootEconomy(state) {
    if (!state) state = loadState();
    if (!shouldGrantDevShards()) {
      return { ok: false, skipped: true };
    }
    return grantDevShards(state, 20000);
  }

  var API = {
    SAVE_KEY: SAVE_KEY,
    createChampion: createChampion,
    createEnemy: createEnemy,
    refreshChampionDerived: refreshChampionDerived,
    equipArtifact: equipArtifact,
    unequipArtifact: unequipArtifact,
    enhanceArtifact: enhanceArtifact,
    enhanceArtifactPreview: enhanceArtifactPreview,
    createArtifact: createArtifact,
    rollGearDrop: rollGearDrop,
    grantGearToVault: grantGearToVault,
    grantHavenStarterKit: grantHavenStarterKit,
    freeArtifactsForSlot: freeArtifactsForSlot,
    syncEquippedArtifactCopy: syncEquippedArtifactCopy,
    upgradeArtifact: upgradeArtifact,
    defaultState: defaultState,
    loadState: loadState,
    saveState: saveState,
    resetGame: resetGame,
    championDisplayPower: championDisplayPower,
    buildTutorialCandidates: buildTutorialCandidates,
    buildTutorialFoe: buildTutorialFoe,
    ensureTutorialCandidates: ensureTutorialCandidates,
    finalizeTutorialPick: finalizeTutorialPick,
    skipTutorialWithPick: skipTutorialWithPick,
    markIntroSeen: markIntroSeen,
    markTutorialSeen: markTutorialSeen,
    playerDisplayName: playerDisplayName,
    setPlayerName: setPlayerName,
    getParty: getParty,
    partyPower: partyPower,
    performSummon: performSummon,
    grantDevShards: grantDevShards,
    shouldGrantDevShards: shouldGrantDevShards,
    applyBootEconomy: applyBootEconomy,
    stageUnlocked: stageUnlocked,
    dungeonUnlocked: dungeonUnlocked,
    makeStageFoes: makeStageFoes,
    makeDungeonFoes: makeDungeonFoes,
    makeDungeonWaveFoes: makeDungeonWaveFoes,
    dungeonWaveCount: dungeonWaveCount,
    makeBossFoes: makeBossFoes,
    recordStageWin: recordStageWin,
    recordDungeonWin: recordDungeonWin,
    recordBossWin: recordBossWin,
    recordSparWin: recordSparWin,
    recordLoss: recordLoss,
    grantPlayerExp: grantPlayerExp,
    spendStatPoint: spendStatPoint,
    buyItem: buyItem,
    craftRecipe: craftRecipe,
    transmute: transmute,
    useBattleElixir: useBattleElixir,
    useHealingSalve: useHealingSalve,
    upgradeWorkshop: upgradeWorkshop,
    fuseSlimes: fuseSlimes,
    evolveSlime: evolveSlime,
    evolveChampion: evolveChampion,
    evolvePreview: evolvePreview,
    listEvolveFodder: listEvolveFodder,
    championBaseStars: championBaseStars,
    championPurpleStars: championPurpleStars,
    getChampionMaxLevel: getChampionMaxLevel,
    grantChampionExp: grantChampionExp,
    grantPartyExp: grantPartyExp,
    expToNextChampLevel: expToNextChampLevel,
    slimeParty: slimeParty,
    claimMilestone: claimMilestone,
    runVoidTower: runVoidTower,
    divineConvergence: divineConvergence,
    inventoryLines: inventoryLines,
    rollRarity: rollRarity,
    rollSummonRarity: rollSummonRarity,
    summonCostFor: summonCostFor
  };

  global.SR_STATE = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : global);
