/* ===== First-hour onboarding coach (Hub → Campaign → first fight) =====
 * Lightweight tips + step flags. No multi-scene state machine required.
 */
(function (global) {
  'use strict';

  function getState() {
    return global.SR_GAME_STATE || (global.SR_STATE && global.SR_STATE.loadState()) || null;
  }

  function save(state) {
    if (global.SR_STATE && global.SR_STATE.saveState) global.SR_STATE.saveState(state);
  }

  function flags(state) {
    state = state || getState();
    if (!state) return {};
    if (!state.flags) state.flags = {};
    return state.flags;
  }

  /** Hub coach after Epic pick — point at Campaign (not before tutorial) */
  function needsHubCoach(state) {
    state = state || getState();
    if (!state || !state.introSeen) return false;
    // Only after Raid pick is done
    if (!(flags(state).tutorialPickDone || state.tutorialSeen)) return false;
    // Once-only: use battleCoachDone / hubCoach flag
    if (flags(state).hubCoachDone) return false;
    // Show once right after pick until dismissed or first campaign win
    if (flags(state).firstCampaignWin) return false;
    return true;
  }

  /** Pulse Campaign / first stage until first campaign win */
  function needsCampaignNudge(state) {
    state = state || getState();
    if (!state) return false;
    if (flags(state).firstCampaignWin) return false;
    if (!(flags(state).tutorialPickDone || state.tutorialSeen)) return false;
    return !!state.introSeen && !flags(state).firstCampaignWin;
  }

  /** In-combat skill/target tips for first non-tutorial fight */
  function needsBattleCoach(state) {
    state = state || getState();
    if (!state) return false;
    if (!(flags(state).tutorialPickDone || state.tutorialSeen)) return false;
    return !!state.introSeen && !flags(state).battleCoachDone;
  }

  function markBattleCoachDone(state) {
    state = state || getState();
    if (!state) return;
    flags(state).battleCoachDone = true;
    save(state);
  }

  function markHubCoachDone(state) {
    state = state || getState();
    if (!state) return;
    flags(state).hubCoachDone = true;
    // Do not force tutorialSeen here — pick already sets it
    if (!state.tutorialSeen && flags(state).tutorialPickDone) {
      state.tutorialSeen = true;
      state.tutorialStep = 99;
    }
    save(state);
  }

  function markFirstCampaignWin(state) {
    state = state || getState();
    if (!state) return false;
    var f = flags(state);
    if (f.firstCampaignWin) return false;
    f.firstCampaignWin = true;
    f.battleCoachDone = true;
    if (!state.tutorialSeen) {
      state.tutorialSeen = true;
      state.tutorialStep = 99;
    }
    save(state);
    return true;
  }

  /**
   * Soft tip panel. Returns { root, destroy }.
   * opts: { title, body, y, primaryLabel, onPrimary, secondaryLabel, onSecondary, depth }
   */
  function showTip(scene, opts) {
    opts = opts || {};
    var w = scene.cameras.main.width;
    var h = scene.cameras.main.height;
    var UI = global.SR_UI;
    var depth = opts.depth != null ? opts.depth : 280;
    var panelW = Math.min(opts.width || 620, w - 48);
    var panelH = opts.height || 168;
    var cx = w / 2;
    var cy = opts.y != null ? opts.y : h * 0.38;
    var root = scene.add.container(cx, cy).setDepth(depth).setAlpha(0).setScale(0.92);

    var plate = scene.add.rectangle(0, 0, panelW, panelH, 0x0a1014, 0.96)
      .setStrokeStyle(2.5, 0xc9a44a, 0.95);
    root.add(plate);
    root.add(scene.add.rectangle(0, 0, panelW - 12, panelH - 12, 0x000000, 0)
      .setStrokeStyle(1, 0xe8d5a0, 0.25));

    var title = scene.add.text(0, -panelH / 2 + 28, opts.title || 'Lyra Softbough', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#ffe8a0', fontStyle: 'bold',
      stroke: '#041208', strokeThickness: 3
    }).setOrigin(0.5);
    root.add(title);

    var body = scene.add.text(0, -4, opts.body || '', {
      fontFamily: 'system-ui', fontSize: '14px', color: '#d8f0e0',
      align: 'center', wordWrap: { width: panelW - 48 }, lineSpacing: 4
    }).setOrigin(0.5);
    root.add(body);

    var destroyed = false;
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      try { root.destroy(true); } catch (e) { /* */ }
    }

    var btnY = panelH / 2 - 36;
    var primaryLabel = opts.primaryLabel || 'Got it';
    var b = scene.add.rectangle(0, btnY, Math.min(200, panelW * 0.42), 36, 0x1a2820)
      .setStrokeStyle(2, 0xc9a44a).setInteractive({ useHandCursor: true });
    root.add(b);
    root.add(scene.add.text(0, btnY, primaryLabel, {
      fontFamily: 'system-ui', fontSize: '14px', color: '#e8ffd4', fontStyle: 'bold'
    }).setOrigin(0.5));
    b.on('pointerover', function () { b.setStrokeStyle(2, 0xffe8a0); });
    b.on('pointerout', function () { b.setStrokeStyle(2, 0xc9a44a); });
    b.on('pointerdown', function () {
      destroy();
      if (opts.onPrimary) opts.onPrimary();
    });

    if (opts.secondaryLabel) {
      var skip = scene.add.text(0, panelH / 2 - 10, opts.secondaryLabel, {
        fontFamily: 'system-ui', fontSize: '12px', color: '#88a090'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      root.add(skip);
      skip.on('pointerdown', function () {
        destroy();
        if (opts.onSecondary) opts.onSecondary();
      });
    }
    void UI;

    scene.tweens.add({
      targets: root, alpha: 1, scale: 1, duration: 280, ease: 'Back.easeOut'
    });

    return { root: root, destroy: destroy };
  }

  /** Soft pulsing ring around a world point (campaign pin / hub chip). */
  function pulseAt(scene, x, y, opts) {
    opts = opts || {};
    var col = opts.color != null ? opts.color : 0xffe088;
    var depth = opts.depth != null ? opts.depth : 120;
    var ring = scene.add.circle(x, y, opts.radius || 28, col, 0)
      .setStrokeStyle(3, col, 0.95).setDepth(depth);
    scene.tweens.add({
      targets: ring, scaleX: 1.45, scaleY: 1.45, alpha: 0.2,
      yoyo: true, repeat: -1, duration: 700
    });
    return ring;
  }

  /** After first campaign win: nudge toward Champions / Vault equip. */
  function needsEquipCoach(state) {
    state = state || getState();
    if (!state) return false;
    var f = flags(state);
    return !!f.firstCampaignWin && !f.equipCoachDone;
  }

  function markEquipCoachDone(state) {
    state = state || getState();
    if (!state) return;
    flags(state).equipCoachDone = true;
    save(state);
  }

  /**
   * First campaign win: guarantee gear + bonus spoils once.
   * Auto-equips the Life relic onto the party lead when possible.
   * Mutates reward list; returns { firstWin, bonusGold, bonusShards, equipped }.
   */
  function applyFirstWinBonus(state, rewardPack) {
    rewardPack = rewardPack || { rewards: [] };
    var first = markFirstCampaignWin(state);
    if (!first) return { firstWin: false, bonusGold: 0, bonusShards: 0, equipped: false };

    var bonusGold = 80;
    var bonusShards = 35;
    var bonusJelly = 6;
    state.resources.gold = (state.resources.gold || 0) + bonusGold;
    state.resources.slimeShards = (state.resources.slimeShards || 0) + bonusShards;
    state.resources.jelly = (state.resources.jelly || 0) + bonusJelly;

    rewardPack.rewards = rewardPack.rewards || [];
    rewardPack.rewards.push(
      { icon: '🎁', label: 'First Victory Gold', amount: bonusGold },
      { icon: '✨', label: 'First Victory Shards', amount: bonusShards },
      { icon: '🍮', label: 'Victory Jelly', amount: bonusJelly }
    );

    var equipped = false;
    var buddy = null;
    // Always grant a Life-set relic; equip onto party lead free slot if possible
    if (global.SR_STATE && global.SR_STATE.rollGearDrop) {
      var art = global.SR_STATE.rollGearDrop({
        set: 'Life', powerMin: 8, powerMax: 12, source: 'First Victory',
        slotId: 'helm', rarity: 'Uncommon'
      });
      if (art && global.SR_STATE.grantGearToVault) {
        global.SR_STATE.grantGearToVault(state, art);
        rewardPack.rewards.push({
          icon: '🛡️', label: (art.name || 'Life Relic') + ' (first win)', amount: 1
        });
        var lead = null;
        if (global.SR_STATE.getParty) {
          var party = global.SR_STATE.getParty(state) || [];
          lead = party[0] || null;
        }
        if (!lead && state.roster && state.roster[0]) lead = state.roster[0];
        if (lead && global.SR_STATE.equipArtifact) {
          var slots = (global.SR_DATA && global.SR_DATA.ARTIFACT_SLOTS) || [
            { id: 'weapon' }, { id: 'helm' }, { id: 'shield' },
            { id: 'gloves' }, { id: 'chest' }, { id: 'boots' }
          ];
          var preferred = art.slotHint || art.slotId || 'helm';
          var slotId = preferred;
          if (lead.equipment && lead.equipment[slotId]) {
            var free = null;
            for (var i = 0; i < slots.length; i++) {
              var sid = slots[i].id;
              if (!lead.equipment[sid]) { free = sid; break; }
            }
            slotId = free || preferred;
          }
          if (slotId) {
            var eq = global.SR_STATE.equipArtifact(state, lead.id, slotId, art.id);
            if (eq && eq.ok) {
              equipped = true;
              rewardPack.rewards.push({
                icon: '🔗',
                label: 'Equipped on ' + (lead.name || 'lead'),
                amount: '✓'
              });
            }
          }
        }
      }
    }

    // Raid-style: after solo Epic start, first win bonds a free partner gel
    if (global.SR_STATE && global.SR_STATE.createChampion &&
        (state.roster || []).length < 2) {
      var leadEl = (state.roster && state.roster[0] && state.roster[0].element) || 'Water';
      var partners = {
        Water: 'Plant', Fire: 'Earth', Plant: 'Water', Earth: 'Fire',
        Lightning: 'Wind', Ice: 'Water', Shadow: 'Poison', Light: 'Spirit',
        Metal: 'Earth', Poison: 'Plant', Crystal: 'Ice', Lava: 'Fire',
        Storm: 'Wind', Spirit: 'Light', Void: 'Shadow', Wind: 'Lightning'
      };
      var buddyEl = partners[leadEl] || 'Earth';
      buddy = global.SR_STATE.createChampion({
        element: buddyEl,
        rarity: 'Rare',
        level: 8
      });
      if (buddy) {
        buddy.level = 8;
        state.roster = state.roster || [];
        state.roster.push(buddy);
        state.partyIds = state.partyIds || [];
        if (state.partyIds.indexOf(buddy.id) < 0 && state.partyIds.length < 4) {
          state.partyIds.push(buddy.id);
        }
        rewardPack.rewards.push({
          icon: '🤝',
          label: (buddy.name || 'Bond gel') + ' joins!',
          amount: 'Rare'
        });
      }
    }

    // Queue equip coach for next hub visit
    flags(state).equipCoachDone = false;
    save(state);
    return {
      firstWin: true,
      bonusGold: bonusGold,
      bonusShards: bonusShards,
      equipped: equipped,
      buddy: buddy
    };
  }

  /**
   * After 2+ campaign stage wins with only 2 gels, grant a 3rd Rare partner
   * (RSL early-party density: solo Epic → duo → trio without summon grind).
   */
  function maybeGrantThirdBuddy(state, rewardPack) {
    rewardPack = rewardPack || { rewards: [] };
    rewardPack.rewards = rewardPack.rewards || [];
    state = state || {};
    if (!global.SR_STATE || !global.SR_STATE.createChampion) {
      return { granted: false };
    }
    if (flags(state).thirdBuddyDone) return { granted: false };
    if ((state.roster || []).length !== 2) return { granted: false };

    var cleared = 0;
    var prog = (state.campaign && state.campaign.progress) || state.stageStars || {};
    if (prog && typeof prog === 'object') {
      Object.keys(prog).forEach(function (k) {
        var e = prog[k];
        if (e == null) return;
        if (typeof e === 'number' && e > 0) cleared += 1;
        else if (e && (e.stars > 0 || e.won || e === true)) cleared += 1;
      });
    }
    if (cleared < 2) return { granted: false };

    var lead2 = (state.roster[0] && state.roster[0].element) || 'Water';
    var thirdMap = {
      Water: 'Lightning', Fire: 'Ice', Plant: 'Shadow', Earth: 'Wind',
      Lightning: 'Metal', Ice: 'Crystal', Shadow: 'Light', Light: 'Void',
      Metal: 'Lava', Poison: 'Storm', Crystal: 'Spirit', Lava: 'Poison',
      Storm: 'Crystal', Spirit: 'Plant', Void: 'Fire', Wind: 'Earth'
    };
    var thirdEl = thirdMap[lead2] || 'Lightning';
    var third = global.SR_STATE.createChampion({
      element: thirdEl,
      rarity: 'Rare',
      level: 10
    });
    if (!third) return { granted: false };
    third.level = 10;
    state.roster.push(third);
    state.partyIds = state.partyIds || [];
    if (state.partyIds.indexOf(third.id) < 0 && state.partyIds.length < 4) {
      state.partyIds.push(third.id);
    }
    flags(state).thirdBuddyDone = true;
    rewardPack.rewards.push({
      icon: '✨',
      label: (third.name || 'Ally gel') + ' answers the call!',
      amount: 'Rare'
    });
    save(state);
    return { granted: true, gel: third };
  }

  var API = {
    needsHubCoach: needsHubCoach,
    needsCampaignNudge: needsCampaignNudge,
    needsBattleCoach: needsBattleCoach,
    needsEquipCoach: needsEquipCoach,
    markBattleCoachDone: markBattleCoachDone,
    markHubCoachDone: markHubCoachDone,
    markFirstCampaignWin: markFirstCampaignWin,
    markEquipCoachDone: markEquipCoachDone,
    showTip: showTip,
    pulseAt: pulseAt,
    applyFirstWinBonus: applyFirstWinBonus,
    maybeGrantThirdBuddy: maybeGrantThirdBuddy
  };

  global.SR_TUTORIAL = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : global);
