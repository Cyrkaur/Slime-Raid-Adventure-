/* ===== Raid-style pre-battle setup =====
 * Softened Realms medallions · Your team | VS | Enemies · roster strip · Start
 * Enemy portraits use enemySafe chroma (same body protection as arena).
 */
(function (global) {
  'use strict';

  // Fixed base stars by rarity
  var RARITY_STARS = {
    Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5, Mythic: 6
  };

  var RARITY_COL = {
    Common: 0x9ca3af, Uncommon: 0x4ade80, Rare: 0x60a5fa,
    Epic: 0xc084fc, Legendary: 0xf59e0b, Mythic: 0xf472b6
  };

  var ELEMENT_TINT = {
    Water: 0x4fc3f7, Fire: 0xff7043, Earth: 0xa1887f, Wind: 0x80deea,
    Plant: 0x66bb6a, Lightning: 0xffee58, Ice: 0xb3e5fc, Shadow: 0x7e57c2,
    Light: 0xfff59d, Metal: 0xb0bec5, Poison: 0xab47bc, Crystal: 0xce93d8,
    Lava: 0xff5722, Storm: 0x90caf9, Spirit: 0xe1bee7, Void: 0x5c6bc0
  };

  function starsFor(unit) {
    if (!unit) return 1;
    if (global.SR_DATA && global.SR_DATA.getBaseStars) {
      return global.SR_DATA.getBaseStars(unit);
    }
    if (unit.baseStars != null) return Math.max(0, Math.min(6, Number(unit.baseStars) || 0));
    if (unit.stars != null) return Math.max(0, Math.min(6, Number(unit.stars) || 0));
    return RARITY_STARS[unit.rarity] != null ? RARITY_STARS[unit.rarity] : 1;
  }

  function rarityColor(unit) {
    return RARITY_COL[(unit && unit.rarity) || 'Common'] || 0x9ca3af;
  }

  function champPower(c) {
    if (!c) return 0;
    // Same Raid PWR as hub / champion sheet (includes gear + traits)
    if (global.SR_STATE && global.SR_STATE.championDisplayPower) {
      return global.SR_STATE.championDisplayPower(c);
    }
    if (global.SR_STATE && global.SR_STATE.refreshChampionDerived) {
      global.SR_STATE.refreshChampionDerived(c);
    }
    return Math.floor((c.attributes && c.attributes.power) || c.power || 0);
  }

  function elTint(el) {
    var k = String(el || 'Water');
    return ELEMENT_TINT[k] || ELEMENT_TINT[k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()] || 0x66bb6a;
  }

  function purpleStarsOf(unit) {
    if (!unit) return 0;
    var pur = 0;
    if (global.SR_DATA && global.SR_DATA.getPurpleStars) pur = global.SR_DATA.getPurpleStars(unit);
    else if (unit.purpleStars != null) pur = unit.purpleStars || 0;
    else if (unit.evolutionLevel) pur = unit.evolutionLevel || 0;
    var stars = starsFor(unit);
    return Math.min(stars, Math.max(0, pur));
  }

  // Phaser must exist when this file loads (same pattern as other scenes)
  var BaseScene = (typeof Phaser !== 'undefined' && Phaser.Scene) ? Phaser.Scene : function () {};

  class PreBattleScene extends BaseScene {
    constructor() {
      super({ key: 'PreBattleScene' });
    }

    init(data) {
      this.battleData = data || {};
      this._selectedRosterId = null;
      this._slotNodes = [];
      this._rosterNodes = [];
      this._foeNodes = [];
      this._layoutFx = [];
    }

    create() {
      try {
        this._build();
      } catch (err) {
        console.error('[PreBattle] create failed', err && err.stack ? err.stack : err);
        this._showFatal(err);
      }
    }

    _showFatal(err) {
      try {
        var w = (this.cameras && this.cameras.main && this.cameras.main.width) || 1920;
        var h = (this.cameras && this.cameras.main && this.cameras.main.height) || 1080;
        if (this.cameras && this.cameras.main) {
          this.cameras.main.setBackgroundColor('#1a0808');
        }
        this.add.rectangle(w / 2, h / 2, w, h, 0x1a0808, 1);
        this.add.text(w / 2, h / 2 - 40, 'Pre-battle setup error', {
          fontFamily: 'system-ui', fontSize: '28px', color: '#ffaaaa'
        }).setOrigin(0.5);
        var msg = String((err && (err.message || err.stack || err)) || 'Unknown error');
        // Safari often says "undefined is not an object" without a stack tip
        this.add.text(w / 2, h / 2 + 20, msg, {
          fontFamily: 'system-ui', fontSize: '14px', color: '#ffcccc',
          wordWrap: { width: w * 0.7 }, align: 'center'
        }).setOrigin(0.5);
        var retScene = 'CampaignScene';
        try {
          if (this.battleData && this.battleData.dungeon) retScene = 'DungeonScene';
          else if (this.battleData && this.battleData.boss) retScene = 'DungeonScene';
        } catch (eR) { /* */ }
        var self = this;
        var t = this.add.text(w / 2, h / 2 + 90, 'Tap to return', {
          fontFamily: 'system-ui', fontSize: '16px', color: '#ffffff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        t.on('pointerdown', function () {
          try { self.scene.start(retScene, {}); } catch (e3) {
            try { self.scene.start('HubScene'); } catch (e4) { /* */ }
          }
        });
      } catch (e2) {
        console.error('[PreBattle] fatal UI failed', e2);
      }
    }

    _build() {
      if (global.SR_UI && global.SR_UI.installCrispText) {
        try { global.SR_UI.installCrispText(this); } catch (e) { /* ignore */ }
      }

      var w = this.cameras.main.width;
      var h = this.cameras.main.height;

      var state = global.SR_GAME_STATE;
      if (!state && global.SR_STATE && typeof global.SR_STATE.loadState === 'function') {
        state = global.SR_STATE.loadState();
      }
      if (!state) state = { roster: [], partyIds: [], resources: {}, player: { stats: {} }, flags: {} };
      global.SR_GAME_STATE = state;
      this._state = state;

      var leadership = (state.player && state.player.stats && state.player.stats.leadership) || 0;
      this._maxSlots = Math.min(6, Math.max(3, 4 + Math.min(2, leadership)));

      var party = [];
      try {
        if (global.SR_STATE && typeof global.SR_STATE.getParty === 'function') {
          party = global.SR_STATE.getParty(state) || [];
        }
      } catch (eP) {
        party = (state.roster || []).slice(0, 4);
      }

      this._slotIds = [];
      this._synergyNodes = [];
      this._rosterNodes = [];
      this._slotNodes = [];
      this._foeNodes = [];
      var i;
      for (i = 0; i < this._maxSlots; i++) {
        this._slotIds[i] = (party[i] && party[i].id != null) ? party[i].id : null;
      }

      try {
        this._foes = this._resolveFoes() || [];
      } catch (eFoes) {
        console.warn('[PreBattle] foes resolve', eFoes);
        this._foes = [
          { name: 'Foe A', element: 'Fire', rarity: 'Uncommon', level: 4, power: 90, enemyKind: 'beast' }
        ];
      }
      this._title = this._resolveTitle();
      this._recPower = this._resolveRecPower();
      this._returnScene = this.battleData.returnScene ||
        (this.battleData.stage ? 'CampaignScene'
          : (this.battleData.dungeon || this.battleData.boss ? 'DungeonScene' : 'HubScene'));
      this._returnData = this.battleData.returnData ||
        (this.battleData.returnRegion ? { region: this.battleData.returnRegion } : {});

      // Opaque fill — game canvas is transparent for 3D combat
      this.cameras.main.setBackgroundColor('#0a0e12');
      this.add.rectangle(w / 2, h / 2, w + 8, h + 8, 0x0a0e12, 1).setDepth(-10);

      // Background plate
      try {
        if (this.textures.exists('ui_battle_load')) {
          var bg = this.add.image(w / 2, h / 2, 'ui_battle_load').setOrigin(0.5).setDepth(0);
          var sc = Math.max(w / Math.max(1, bg.width || 1920), h / Math.max(1, bg.height || 1080)) * 1.02;
          bg.setScale(sc).setAlpha(0.5);
        } else if (this.textures.exists('hub_bg')) {
          this.add.image(w / 2, h / 2, 'hub_bg').setDisplaySize(w, h).setAlpha(0.38).setDepth(0);
        }
      } catch (eBg) {
        console.warn('[PreBattle] bg skip', eBg);
      }
      // Soft vignette (matches Softened Realms chapter map)
      var vig = this.add.graphics().setDepth(1);
      vig.fillStyle(0x000000, 0.4);
      vig.fillRect(0, 0, w, 110);
      vig.fillStyle(0x000000, 0.5);
      vig.fillRect(0, h - 250, w, 250);
      this.add.rectangle(w / 2, h / 2, w + 4, h + 4, 0x0a0e12, 0.28).setDepth(1);

      var UI = global.SR_UI;
      if (UI && UI.addTitle) {
        UI.addTitle(this, this._title, this._headerSub());
        this._subText = null;
      } else {
        this.add.text(w / 2, 36, this._title, {
          fontFamily: 'Georgia, serif', fontSize: '28px', color: '#f0e8d4',
          stroke: '#0a0e12', strokeThickness: 5
        }).setOrigin(0.5).setDepth(20);
        this._subText = this.add.text(w / 2, 68, this._headerSub(), {
          fontFamily: 'system-ui', fontSize: '14px', color: '#c9a44a',
          stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(20);
      }

      var self = this;
      if (UI && UI.addBackButton) {
        var backLab = (UI.backLabelForScene && UI.backLabelForScene(this._returnScene)) || '←  Back';
        UI.addBackButton(this, 70, 40, {
          label: backLab,
          onClick: function () {
            self.scene.start(self._returnScene, self._returnData || {});
          }
        });
      } else {
        var back = this.add.text(28, 28, '←  Back', {
          fontFamily: 'system-ui', fontSize: '18px', color: '#c8e8d0',
          stroke: '#000', strokeThickness: 4
        }).setDepth(30).setInteractive({ useHandCursor: true });
        back.on('pointerdown', function () {
          self.scene.start(self._returnScene, self._returnData || {});
        });
      }

      // Soft path ribbon under team ↔ foes (journey language)
      var pathG = this.add.graphics().setDepth(8);
      var allyCx = w * 0.26;
      var foeCx = w * 0.74;
      var midY = h * 0.36;
      pathG.lineStyle(16, 0xc9a44a, 0.08);
      pathG.beginPath();
      pathG.moveTo(allyCx, midY);
      pathG.lineTo(w / 2, midY - 8);
      pathG.lineTo(foeCx, midY);
      pathG.strokePath();
      pathG.lineStyle(3, 0xc9a44a, 0.32);
      pathG.beginPath();
      pathG.moveTo(allyCx, midY);
      pathG.lineTo(w / 2, midY - 8);
      pathG.lineTo(foeCx, midY);
      pathG.strokePath();

      // Section labels (clear of title band)
      this.add.text(allyCx, 102, 'YOUR TEAM', {
        fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold', color: '#c9a44a',
        stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(15);
      this.add.text(foeCx, 102, 'ENEMIES', {
        fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold', color: '#e8a080',
        stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(15);

      // VS medallion (center)
      var vsR = 42;
      this.add.ellipse(w / 2 + 2, midY + vsR * 0.7, vsR * 1.7, vsR * 0.4, 0x000000, 0.4).setDepth(24);
      var vsGlow = this.add.circle(w / 2, midY, vsR + 12, 0xc9a44a, 0.12).setDepth(24);
      if (this.tweens) {
        this.tweens.add({
          targets: vsGlow, scaleX: 1.12, scaleY: 1.12, alpha: 0.05,
          duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      }
      this.add.circle(w / 2, midY, vsR, 0x12161c, 0.96)
        .setStrokeStyle(3, 0xc9a44a, 0.95).setDepth(25);
      this.add.circle(w / 2, midY, vsR - 5, 0x000000, 0)
        .setStrokeStyle(1.5, 0xe8d5a0, 0.4).setDepth(25);
      this.add.text(w / 2, midY, 'VS', {
        fontFamily: 'Georgia, serif', fontSize: '28px', fontStyle: 'bold',
        color: '#ffe8a0', stroke: '#1a1008', strokeThickness: 5
      }).setOrigin(0.5).setDepth(26);

      // Power match-up: Team · rating · Rec
      this._powerText = this.add.text(allyCx, 120, '', {
        fontFamily: 'system-ui', fontSize: '14px', fontStyle: 'bold',
        color: '#ffe8a0', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(15);
      this._matchText = this.add.text(w / 2, midY + vsR + 22, '', {
        fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold',
        color: '#c8e0d0', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(26);
      this._recText = this.add.text(foeCx, 120, 'Rec  ' + this._recPower, {
        fontFamily: 'system-ui', fontSize: '13px', color: '#ffccaa',
        stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(15);

      // Affinity tip vs primary foe elements
      this._affinityText = this.add.text(foeCx, 138, '', {
        fontFamily: 'system-ui', fontSize: '11px', color: '#a8c0b8',
        stroke: '#000', strokeThickness: 2, align: 'center', wordWrap: { width: 280 }
      }).setOrigin(0.5).setDepth(15);

      this._drawAllySlots(allyCx, midY);
      this._drawEnemyCards(foeCx, midY);

      // Party synergy bar (between team row and roster — no title overlap)
      this._synergyNodes = [];
      this._drawPartySynergyStrip(w, h);

      // Quick setup actions
      this._drawSetupActions(w, h);

      // Focus tip
      this.add.text(w / 2, h - 248, 'Tap roster to fill · tap slot to clear · select then slot to swap', {
        fontFamily: 'system-ui', fontSize: '12px', color: '#9aa89a',
        stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(15);

      this._drawRosterStrip();

      var startY = h - 44;
      if (UI && UI.addButton) {
        var startRes = UI.addButton(this, w / 2, startY, 300, 48, 'START BATTLE', 0x1a1820, function () {
          self._startBattle();
        }, 40);
        this._startBtn = startRes && startRes.hit;
        this._startLab = startRes && startRes.text;
        this._startRoot = startRes && startRes.root;
      } else {
        this._startBtn = this.add.rectangle(w / 2, startY, 280, 48, 0x1a1820, 1)
          .setStrokeStyle(2, 0xc9a44a, 0.95).setDepth(40)
          .setInteractive({ useHandCursor: true });
        this._startLab = this.add.text(w / 2, startY, 'START BATTLE', {
          fontFamily: 'system-ui', fontSize: '17px', fontStyle: 'bold',
          color: '#f0ffe8', stroke: '#0a0e12', strokeThickness: 4
        }).setOrigin(0.5).setDepth(41);
        this._startBtn.on('pointerdown', function () { self._startBattle(); });
      }

      this._refreshPower();
      this._refreshAffinityHint();
      this._refreshStartBtn();
      console.log('[PreBattle] ready', {
        slots: this._maxSlots,
        party: this._slotIds.filter(Boolean).length,
        foes: (this._foes || []).length,
        title: this._title
      });
    }

    _headerSub() {
      var bd = this.battleData || {};
      if (bd.stage) return String(bd.stage.element || '') + '  ·  Soft path battle';
      if (bd.dungeon) {
        var waves = (global.SR_STATE && global.SR_STATE.dungeonWaveCount)
          ? global.SR_STATE.dungeonWaveCount(bd.dungeon)
          : Math.max(1, (bd.dungeon.waves || 1));
        return String(bd.dungeon.element || '') + '  ·  ' + waves +
          '-wave dungeon  ·  HP carries';
      }
      if (bd.boss) return String(bd.boss.element || '') + '  ·  Boss raid';
      return 'Prepare your team';
    }

    _resolveTitle() {
      var bd = this.battleData || {};
      if (bd.stage && bd.stage.name) return bd.stage.name;
      if (bd.dungeon && bd.dungeon.name) return bd.dungeon.name;
      if (bd.boss && bd.boss.name) return bd.boss.name;
      return 'Prepare for Battle';
    }

    _currentPartyChamps() {
      var party = [];
      var self = this;
      (this._slotIds || []).forEach(function (id) {
        var c = self._champById(id);
        if (c) party.push(c);
      });
      return party;
    }

    /** Active / near party trait synergies — between team row and roster */
    _drawPartySynergyStrip(w, h) {
      if (!this._synergyNodes) this._synergyNodes = [];
      this._destroyNodes(this._synergyNodes);
      this._synergyNodes = [];
      try {
        var DATA = global.SR_DATA || {};
        var party = this._currentPartyChamps();
        var syn = { lines: [], hints: [] };
        if (typeof DATA.computePartyTraitSynergies === 'function') {
          syn = DATA.computePartyTraitSynergies(party) || syn;
        }
        // Sit above the focus tip / below medallions
        var y = h * 0.36 + 118;
        var line = '';
        var col = '#667770';
        if (syn.lines && syn.lines.length) {
          line = '✦  ' + syn.lines.join('   ·   ');
          col = '#88e0aa';
        } else if (syn.hints && syn.hints.length) {
          line = 'Synergy progress: ' + syn.hints.slice(0, 2).join(' · ');
          col = '#8a9a90';
        } else if (party.length) {
          line = 'Stack combat / training traits for party synergies';
          col = '#667770';
        } else {
          line = 'Fill slots from the roster below';
          col = '#667770';
        }
        var bg = this.add.rectangle(w / 2, y, Math.min(w - 80, 920), 28, 0x0a1014, 0.75)
          .setStrokeStyle(1, 0xc9a44a, 0.28).setDepth(21);
        var txt = this.add.text(w / 2, y, line, {
          fontFamily: 'system-ui', fontSize: '12px', color: col, fontStyle: 'bold',
          stroke: '#041208', strokeThickness: 3,
          wordWrap: { width: Math.min(w - 100, 880) }, align: 'center'
        }).setOrigin(0.5).setDepth(22);
        this._synergyNodes.push(bg, txt);
      } catch (eSyn) {
        console.warn('[PreBattle] synergy strip', eSyn);
      }
    }

    /** Auto-fill strongest free champs · Clear party */
    _drawSetupActions(w, h) {
      var self = this;
      var y = h - 200;
      var mkBtn = function (x, label, onClick) {
        var bg = self.add.rectangle(x, y, 130, 32, 0x12161c, 0.92)
          .setStrokeStyle(1.5, 0xc9a44a, 0.7).setDepth(30)
          .setInteractive({ useHandCursor: true });
        var lab = self.add.text(x, y, label, {
          fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold', color: '#e8e0d0',
          stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(31);
        bg.on('pointerover', function () { bg.setStrokeStyle(2, 0xffe8a0, 1); });
        bg.on('pointerout', function () { bg.setStrokeStyle(1.5, 0xc9a44a, 0.7); });
        bg.on('pointerdown', onClick);
        return { bg: bg, lab: lab };
      };
      mkBtn(w / 2 - 80, 'Auto-fill', function () { self._autoFillParty(); });
      mkBtn(w / 2 + 80, 'Clear team', function () { self._clearParty(); });
    }

    _autoFillParty() {
      var roster = this._validRoster().slice();
      roster.sort(function (a, b) {
        return champPower(b) - champPower(a);
      });
      var used = {};
      var i;
      // Keep existing picks; fill empties with strongest remaining
      for (i = 0; i < (this._slotIds || []).length; i++) {
        if (this._slotIds[i] != null) used[this._slotIds[i]] = true;
      }
      var ri = 0;
      for (i = 0; i < (this._slotIds || []).length; i++) {
        if (this._slotIds[i] != null) continue;
        while (ri < roster.length && roster[ri] && used[roster[ri].id]) ri++;
        if (ri >= roster.length || !roster[ri]) break;
        this._slotIds[i] = roster[ri].id;
        used[roster[ri].id] = true;
        ri++;
      }
      this._selectedRosterId = null;
      this._redrawAll();
    }

    _clearParty() {
      var i;
      for (i = 0; i < this._slotIds.length; i++) this._slotIds[i] = null;
      this._selectedRosterId = null;
      this._redrawAll();
    }

    _refreshAffinityHint() {
      if (!this._affinityText || typeof this._affinityText.setText !== 'function') return;
      try {
        var foes = this._foes || [];
        if (!foes.length) {
          this._affinityText.setText('');
          return;
        }
        // Count foe elements
        var counts = {};
        for (var fi = 0; fi < foes.length; fi++) {
          var f = foes[fi];
          if (!f) continue;
          var el = f.element || 'Earth';
          counts[el] = (counts[el] || 0) + 1;
        }
        var keys = Object.keys(counts);
        if (!keys.length) {
          this._affinityText.setText('');
          return;
        }
        var top = keys.sort(function (a, b) { return counts[b] - counts[a]; })[0];
        // Suggest elements strong vs top foe element
        var DATA = global.SR_DATA || {};
        var tips = [];
        var elements = DATA.ELEMENTS || Object.keys(DATA.ELEMENT_CHART || {});
        var chartAll = DATA.ELEMENT_CHART || {};
        for (var ei = 0; ei < elements.length; ei++) {
          var elName = elements[ei];
          var chart = chartAll[elName];
          if (chart && chart.strong && chart.strong.indexOf && chart.strong.indexOf(top) >= 0) {
            tips.push(elName);
          }
        }
        if (tips.length) {
          this._affinityText.setText('Foes lean ' + top + '  ·  bring ' + tips.slice(0, 3).join(' / '));
          if (this._affinityText.setColor) this._affinityText.setColor('#88ccaa');
        } else {
          this._affinityText.setText('Foes: ' + keys.join(', '));
          if (this._affinityText.setColor) this._affinityText.setColor('#a8c0b8');
        }
      } catch (eAff) {
        console.warn('[PreBattle] affinity hint', eAff);
        try { this._affinityText.setText(''); } catch (e2) { /* */ }
      }
    }

    _resolveRecPower() {
      var bd = this.battleData || {};
      if (bd.stage && bd.stage.power) return bd.stage.power;
      if (bd.dungeon && bd.dungeon.power) return bd.dungeon.power;
      if (bd.boss && bd.boss.power) return bd.boss.power;
      var foes = this._foes || [];
      var s = 0;
      for (var i = 0; i < foes.length; i++) s += foes[i].power || 0;
      return s || 100;
    }

    _resolveFoes() {
      var bd = this.battleData || {};
      try {
        if (bd.foes && bd.foes.length) return bd.foes.slice();
        if (bd.stage && global.SR_STATE && global.SR_STATE.makeStageFoes) {
          return global.SR_STATE.makeStageFoes(bd.stage) || [];
        }
        if (bd.dungeon && global.SR_STATE) {
          if (global.SR_STATE.makeDungeonWaveFoes) {
            return global.SR_STATE.makeDungeonWaveFoes(bd.dungeon, 0) || [];
          }
          if (global.SR_STATE.makeDungeonFoes) {
            return global.SR_STATE.makeDungeonFoes(bd.dungeon) || [];
          }
        }
        if (bd.boss && global.SR_STATE && global.SR_STATE.makeBossFoes) {
          return global.SR_STATE.makeBossFoes(bd.boss) || [];
        }
      } catch (e) {
        console.warn('[PreBattle] foes resolve failed', e);
      }
      return [
        { name: 'Foe A', element: 'Fire', rarity: 'Uncommon', level: 4, power: 90, enemyKind: 'beast' },
        { name: 'Foe B', element: 'Earth', rarity: 'Common', level: 3, power: 70, enemyKind: 'golem' }
      ];
    }

    _champById(id) {
      if (id == null) return null;
      var r = (this._state && this._state.roster) || [];
      for (var i = 0; i < r.length; i++) {
        if (r[i] && r[i].id === id) return r[i];
      }
      return null;
    }

    /** Valid champion objects only (skips holes / corrupt save entries) */
    _validRoster() {
      var r = (this._state && this._state.roster) || [];
      var out = [];
      for (var i = 0; i < r.length; i++) {
        if (r[i] && r[i].id != null) out.push(r[i]);
      }
      return out;
    }

    _teamPower() {
      var sum = 0;
      for (var i = 0; i < this._slotIds.length; i++) {
        sum += champPower(this._champById(this._slotIds[i]));
      }
      var state = this._state || {};
      var bonus = (state.flags && state.flags.globalPowerBonus) || 1;
      var combat = (state.player && state.player.stats && state.player.stats.combat) || 0;
      bonus *= 1 + combat * 0.025;
      if (state.flags && state.flags.battleElixirActive) bonus *= 1.25;
      return Math.floor(sum * bonus);
    }

    _refreshPower() {
      var p = this._teamPower();
      var rec = this._recPower || 0;
      var ratio = rec > 0 ? p / rec : 1;
      var rating = 'Even';
      var col = '#ffe8a0';
      if (ratio >= 1.35) { rating = 'Dominating'; col = '#66eeaa'; }
      else if (ratio >= 1.05) { rating = 'Favored'; col = '#b8e890'; }
      else if (ratio >= 0.85) { rating = 'Even'; col = '#ffe8a0'; }
      else if (ratio >= 0.65) { rating = 'Tough'; col = '#ffbb77'; }
      else { rating = 'Deadly'; col = '#ff8866'; }
      if (this._powerText) {
        this._powerText.setText('Team  ' + p);
        this._powerText.setColor(col);
      }
      if (this._matchText) {
        this._matchText.setText(rating + '  ·  ' + p + ' vs ' + rec);
        this._matchText.setColor(col);
      }
      if (this._recText) {
        this._recText.setText('Rec  ' + rec);
      }
    }

    _refreshStartBtn() {
      var n = 0;
      for (var i = 0; i < this._slotIds.length; i++) if (this._slotIds[i] != null) n++;
      var ready = n >= 1;
      if (this._startRoot) {
        this._startRoot.setAlpha(ready ? 1 : 0.5);
      } else if (this._startBtn) {
        if (this._startBtn.setFillStyle) {
          this._startBtn.setFillStyle(ready ? 0x1a1820 : 0x2a2a2a, 1);
        }
        this._startBtn.setAlpha(ready ? 1 : 0.55);
      }
      if (this._startLab && this._startLab.setColor) {
        this._startLab.setColor(ready ? '#f0ffe8' : '#888');
      }
    }

    _destroyNodes(list) {
      function wipe(obj) {
        if (!obj) return;
        try {
          if (obj._maskGfx) { try { obj._maskGfx.destroy(); } catch (eM) { /* */ } }
          // Container: free masks on children first
          if (obj.list && obj.list.length) {
            var kids = obj.list.slice();
            for (var ki = 0; ki < kids.length; ki++) wipe(kids[ki]);
          }
          if (obj.destroy) obj.destroy();
        } catch (e) { /* */ }
      }
      (list || []).forEach(function (n) {
        try {
          if (n && n.parts) {
            n.parts.forEach(wipe);
          } else {
            wipe(n);
          }
        } catch (e2) { /* */ }
      });
    }

    /**
     * Circular Softened Realms medallion (ally slot / enemy / roster).
     */
    _drawMedallion(x, y, R, unit, opts) {
      opts = opts || {};
      var depth = opts.depth != null ? opts.depth : 20;
      var enemy = !!opts.enemy;
      var empty = !unit;
      var rarCol = unit ? rarityColor(unit) : 0x3a4048;
      var strokeCol = empty ? 0x3a4048 : (enemy ? 0xe8a080 : rarCol);
      var parts = [];
      var root = this.add.container(x, y).setDepth(depth);
      parts.push(root);

      // Soft ground shadow
      root.add(this.add.ellipse(2, R * 0.78, R * 1.65, R * 0.42, 0x000000, empty ? 0.18 : 0.4));

      if (opts.selected) {
        var glow = this.add.circle(0, 0, R + 14, 0x66ffcc, 0.18);
        root.add(glow);
        if (this.tweens) {
          this.tweens.add({
            targets: glow, scaleX: 1.12, scaleY: 1.12, alpha: 0.07,
            duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
          });
        }
      }

      var fill = empty ? 0x12151a : (enemy ? 0x1a1210 : 0x0a0e12);
      var ring = this.add.circle(0, 0, R, fill, empty ? 0.55 : 0.94)
        .setStrokeStyle(empty ? 2 : 3.5, strokeCol, empty ? 0.4 : 0.95);
      root.add(ring);
      if (!empty) {
        root.add(this.add.circle(0, 0, R - 5, 0x000000, 0)
          .setStrokeStyle(1.5, enemy ? 0xffc8a0 : 0xe8d5a0, enemy ? 0.35 : 0.4));
      }

      if (empty) {
        root.add(this.add.text(0, -4, opts.emptyLabel || '·', {
          fontFamily: 'system-ui', fontSize: Math.max(11, Math.floor(R * 0.28)) + 'px',
          color: '#5a6570', align: 'center'
        }).setOrigin(0.5));
        root.add(this.add.text(0, R * 0.28, 'empty', {
          fontFamily: 'system-ui', fontSize: '10px', color: '#4a5560'
        }).setOrigin(0.5));
      } else {
        // Portrait disc
        this._paintMedallionArt(root, 0, 0, R - 8, unit, enemy, x, y);

        // Level chip
        var lvBg = this.add.rectangle(-R * 0.55, -R * 0.62, 34, 16, 0x0a0e12, 0.92)
          .setStrokeStyle(1, strokeCol, 0.8);
        root.add(lvBg);
        root.add(this.add.text(-R * 0.55, -R * 0.62, 'Lv' + (unit.level || 1), {
          fontFamily: 'system-ui', fontSize: '10px', fontStyle: 'bold', color: '#e8ffe8'
        }).setOrigin(0.5));

        // Stars
        var stars = starsFor(unit);
        var pur = purpleStarsOf(unit);
        var starY = R * 0.55;
        if (stars <= 0) {
          root.add(this.add.text(0, starY, '✦', {
            fontFamily: 'system-ui', fontSize: '11px', color: '#f472b6',
            stroke: '#000', strokeThickness: 3
          }).setOrigin(0.5));
        } else {
          var purStr = new Array(pur + 1).join('★');
          var goldStr = new Array((stars - pur) + 1).join('★');
          var starFs = Math.max(9, Math.min(13, Math.floor(R * 0.22)));
          if (purStr) {
            root.add(this.add.text(-(stars - pur) * 4.5, starY, purStr, {
              fontFamily: 'system-ui', fontSize: starFs + 'px', color: '#c084fc',
              stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5));
          }
          if (goldStr) {
            root.add(this.add.text(pur * 4.5, starY, goldStr, {
              fontFamily: 'system-ui', fontSize: starFs + 'px', color: '#ffd56a',
              stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5));
          }
        }

        // Name + power under medallion
        var nm = String(unit.name || 'Champ').split(' ').slice(0, 2).join(' ');
        root.add(this.add.text(0, R + 14, nm, {
          fontFamily: 'Georgia, serif', fontSize: Math.max(11, Math.min(13, Math.floor(R * 0.24))) + 'px',
          color: enemy ? '#ffd0c8' : '#e8e0d0',
          align: 'center', wordWrap: { width: R * 2.6 },
          stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5, 0));
        root.add(this.add.text(0, R + 30, 'PWR ' + champPower(unit), {
          fontFamily: 'system-ui', fontSize: '11px', fontStyle: 'bold',
          color: '#ffe8a0', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5, 0));
      }

      if (opts.dimmed) root.setAlpha(0.42);

      var hit = this.add.circle(0, 0, R + 10, 0xffffff, 0.001);
      root.add(hit);
      hit.setInteractive({ useHandCursor: true });
      if (!opts.noHover) {
        hit.on('pointerover', function () { root.setScale(1.08); });
        hit.on('pointerout', function () { root.setScale(opts.selected ? 1.06 : 1); });
      }

      return { parts: parts, hit: hit, unit: unit, root: root, R: R };
    }

    /**
     * Paint circular portrait art into a medallion container.
     * Enemies: enemySafe chromed enemy_* first (bandit faces solid like arena).
     * Allies: chromed gel plate with circle mask.
     */
    _paintMedallionArt(root, lx, ly, r, unit, enemy, worldX, worldY) {
      if (!root || !unit) return;
      var rarCol = rarityColor(unit);
      var key = null;

      try {
        if (enemy && unit.enemyKind) {
          var kind = String(unit.enemyKind || 'beast').toLowerCase();
          var eKeys = ['enemy_' + kind, 'enemy_raw_' + kind];
          for (var k = 0; k < eKeys.length; k++) {
            if (this.textures && this.textures.exists(eKeys[k])) { key = eKeys[k]; break; }
          }
        } else {
          var el = String(unit.element || 'water').toLowerCase();
          // Prefer SR_ART candidate keys when present
          if (global.SR_ART && typeof global.SR_ART.phaserGelKeyCandidates === 'function') {
            var form = 'blob';
            try {
              if (typeof global.SR_ART.gelFormForUnit === 'function') {
                form = global.SR_ART.gelFormForUnit(unit) || 'blob';
              }
            } catch (eForm) { form = 'blob'; }
            var cands = global.SR_ART.phaserGelKeyCandidates(
              unit.element,
              unit.artVariant,
              form
            ) || [];
            for (var c = 0; c < cands.length; c++) {
              if (this.textures && this.textures.exists(cands[c])) { key = cands[c]; break; }
            }
          }
          if (!key) {
            var gelKeys = [
              'slime_' + el, 'slime_' + el + '_a', 'slime_' + el + '_blob_a',
              'slime_raw_' + el, 'slime_raw_' + el + '_a', 'slime_legacy_' + el
            ];
            for (var g = 0; g < gelKeys.length; g++) {
              if (this.textures && this.textures.exists(gelKeys[g])) { key = gelKeys[g]; break; }
            }
          }
        }
      } catch (eKey) {
        console.warn('[PreBattle] art key resolve', eKey);
        key = null;
      }

      if (key) {
        try {
          var img = this.add.image(lx, ly - r * 0.04, key)
            .setDisplaySize(r * 1.95, r * (enemy ? 2.05 : 2.0));
          try {
            if (this.make && typeof this.make.graphics === 'function') {
              var maskG = this.make.graphics({ x: 0, y: 0, add: false });
              maskG.fillStyle(0xffffff);
              maskG.fillCircle((worldX || 0) + lx, (worldY || 0) + ly, Math.max(2, r - 1));
              if (typeof img.setMask === 'function' && maskG.createGeometryMask) {
                img.setMask(maskG.createGeometryMask());
                img._maskGfx = maskG;
              }
            }
          } catch (eMask) { /* unmasked fallback */ }
          root.add(img);
          root.add(this.add.circle(lx, ly, Math.max(2, r - 1), 0x000000, enemy ? 0.1 : 0.06));
          return;
        } catch (eImg) {
          console.warn('[PreBattle] portrait image', eImg);
        }
      }

      // Tinted disc fallback
      var col = enemy ? 0x884444 : elTint(unit && unit.element);
      root.add(this.add.circle(lx, ly + 2, r * 0.85, col, 0.92)
        .setStrokeStyle(2, rarCol, 0.75));
    }

    _drawAllySlots(cx, cy) {
      this._destroyNodes(this._slotNodes);
      this._slotNodes = [];
      var n = this._maxSlots;
      var R = n > 5 ? 48 : (n > 4 ? 52 : 56);
      var gap = n > 5 ? 18 : 22;
      var totalW = n * (R * 2) + (n - 1) * gap;
      var left = cx - totalW / 2 + R;
      var self = this;
      for (var i = 0; i < n; i++) {
        (function (slotIndex) {
          var x = left + slotIndex * (R * 2 + gap);
          // Soft arc so row feels less flat
          var y = cy + Math.sin((slotIndex / Math.max(1, n - 1)) * Math.PI) * 10;
          var champ = self._champById(self._slotIds[slotIndex]);
          var node = self._drawMedallion(x, y, R, champ, {
            emptyLabel: String(slotIndex + 1),
            depth: 20
          });
          node.hit.on('pointerdown', function () { self._onSlotClick(slotIndex); });
          self._slotNodes.push(node);
        })(i);
      }
    }

    _drawEnemyCards(cx, cy) {
      this._destroyNodes(this._foeNodes);
      this._foeNodes = [];
      var foes = (this._foes || []).filter(function (f) { return !!f; });
      if (!foes.length) {
        foes = [{ name: 'Foe', element: 'Earth', rarity: 'Common', level: 1, power: 50, enemyKind: 'beast' }];
      }
      var n = Math.max(1, foes.length);
      var R = n > 4 ? 46 : (n > 3 ? 50 : 54);
      var gap = 18;
      var totalW = n * (R * 2) + Math.max(0, n - 1) * gap;
      var left = cx - totalW / 2 + R;
      var den = Math.max(1, n - 1);
      for (var i = 0; i < foes.length; i++) {
        var f = foes[i];
        var view = {
          name: (f && f.name) || 'Foe',
          element: (f && f.element) || 'Earth',
          rarity: (f && f.rarity) || 'Common',
          level: (f && f.level) || 1,
          power: (f && f.power) || 0,
          enemyKind: (f && (f.enemyKind || f.kind)) || 'beast',
          isEnemy: true
        };
        var y = cy + Math.sin((i / den) * Math.PI) * 8;
        var node = this._drawMedallion(left + i * (R * 2 + gap), y, R, view, {
          enemy: true,
          depth: 20,
          noHover: true
        });
        this._foeNodes.push(node);
      }
    }

    _onSlotClick(slotIndex) {
      if (this._selectedRosterId != null) {
        var sel = this._selectedRosterId;
        for (var i = 0; i < this._slotIds.length; i++) {
          if (this._slotIds[i] === sel) this._slotIds[i] = null;
        }
        this._slotIds[slotIndex] = sel;
        this._selectedRosterId = null;
        this._redrawAll();
        return;
      }
      if (this._slotIds[slotIndex] != null) {
        this._slotIds[slotIndex] = null;
        this._redrawAll();
      }
    }

    _onRosterClick(champId) {
      if (champId == null) return;
      if (this._selectedRosterId === champId) {
        this._selectedRosterId = null;
        this._drawRosterStrip();
        return;
      }
      var empty = -1;
      var i;
      for (i = 0; i < this._slotIds.length; i++) {
        if (this._slotIds[i] == null) { empty = i; break; }
      }
      var already = this._slotIds.indexOf(champId) >= 0;
      if (empty >= 0 && !already) {
        this._slotIds[empty] = champId;
        this._selectedRosterId = null;
        this._redrawAll();
        return;
      }
      this._selectedRosterId = champId;
      this._drawRosterStrip();
      if (this._subText) this._subText.setText('Selected — tap a team slot to place / swap');
    }

    _redrawAll() {
      var w = this.cameras.main.width;
      var h = this.cameras.main.height;
      this._drawAllySlots(w * 0.26, h * 0.36);
      this._drawRosterStrip();
      this._drawPartySynergyStrip(w, h);
      this._refreshPower();
      this._refreshAffinityHint();
      this._refreshStartBtn();
      if (this._subText) this._subText.setText(this._headerSub());
    }

    _drawRosterStrip() {
      this._destroyNodes(this._rosterNodes);
      this._rosterNodes = [];
      var w = this.cameras.main.width;
      var h = this.cameras.main.height;
      var roster = this._validRoster().slice();
      var inSlot = {};
      var i;
      for (i = 0; i < (this._slotIds || []).length; i++) {
        if (this._slotIds[i] != null) inSlot[this._slotIds[i]] = true;
      }
      var self = this;
      roster.sort(function (a, b) {
        if (!a || !b) return 0;
        var ai = inSlot[a.id] ? 0 : 1;
        var bi = inSlot[b.id] ? 0 : 1;
        if (ai !== bi) return ai - bi;
        return champPower(b) - champPower(a);
      });

      var R = 36;
      var gap = 14;
      var maxShow = Math.min(roster.length, 12);
      var totalW = maxShow * (R * 2) + Math.max(0, maxShow - 1) * gap;
      var left = w / 2 - totalW / 2 + R;
      // Leave room for Auto-fill / Clear row above tray
      var y = h - 158;

      // Ink tray under roster orbs
      var trayW = Math.min(w - 48, totalW + 56);
      var tray = this.add.rectangle(w / 2, y + 8, trayW, R * 2 + 52, 0x0a0e12, 0.72)
        .setStrokeStyle(1.5, 0xc9a44a, 0.35).setDepth(17);
      this._rosterNodes.push(tray);
      var rosterLab = this.add.text(w / 2, y - R - 18, 'ROSTER', {
        fontFamily: 'system-ui', fontSize: '11px', fontStyle: 'bold', color: '#c9a44a',
        stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(18);
      this._rosterNodes.push(rosterLab);

      for (i = 0; i < maxShow; i++) {
        (function (c, idx) {
          var x = left + idx * (R * 2 + gap);
          var placed = !!inSlot[c.id];
          var selected = self._selectedRosterId === c.id;
          var node = self._drawMedallion(x, y, R, c, {
            depth: 19,
            selected: selected,
            dimmed: placed
          });
          node.hit.on('pointerdown', function () {
            if (placed && self._selectedRosterId == null) {
              for (var s = 0; s < self._slotIds.length; s++) {
                if (self._slotIds[s] === c.id) self._slotIds[s] = null;
              }
              self._redrawAll();
              return;
            }
            self._onRosterClick(c.id);
          });
          self._rosterNodes.push(node);
        })(roster[i], i);
      }
    }

    _startBattle() {
      var partyChamps = [];
      var i;
      for (i = 0; i < this._slotIds.length; i++) {
        var c = this._champById(this._slotIds[i]);
        if (c) partyChamps.push(c);
      }
      if (!partyChamps.length) return;

      var state = this._state;
      state.partyIds = partyChamps.map(function (c) { return c.id; });
      if (global.SR_STATE && typeof global.SR_STATE.saveState === 'function') {
        try { global.SR_STATE.saveState(state); } catch (e) { /* */ }
      }
      global.SR_GAME_STATE = state;

      var payload = {};
      var bd = this.battleData || {};
      var k;
      for (k in bd) {
        if (Object.prototype.hasOwnProperty.call(bd, k)) payload[k] = bd[k];
      }
      payload.party = partyChamps;
      payload.foes = this._foes;
      payload.fromPreBattle = true;
      this.scene.start('BattleScene', payload);
    }
  }

  global.PreBattleScene = PreBattleScene;
  if (typeof window !== 'undefined') window.PreBattleScene = PreBattleScene;

  /**
   * Reliable launch — dynamically registers the scene if the game boot list
   * missed it, then starts. Falls back to BattleScene so the player is never stuck.
   */
  function startPreBattle(fromScene, data) {
    data = data || {};
    var PBS = global.PreBattleScene || (typeof window !== 'undefined' && window.PreBattleScene);
    if (!fromScene || !fromScene.scene) {
      console.error('[PreBattle] no fromScene');
      return false;
    }
    try {
      var mgr = fromScene.scene;
      // Ensure registered under key PreBattleScene
      var existing = null;
      try { existing = mgr.get('PreBattleScene'); } catch (e0) { existing = null; }
      if (!existing && PBS) {
        try {
          mgr.add('PreBattleScene', PBS, false);
          console.log('[PreBattle] dynamically registered scene');
        } catch (eAdd) {
          console.warn('[PreBattle] scene.add', eAdd && eAdd.message);
        }
      }
      if (PBS || existing) {
        mgr.start('PreBattleScene', data);
        console.log('[PreBattle] started with', data.stage && data.stage.name, data.dungeon && data.dungeon.name);
        return true;
      }
    } catch (eStart) {
      console.error('[PreBattle] start failed', eStart);
    }
    // Fallback — go straight into combat
    console.warn('[PreBattle] fallback → BattleScene');
    try {
      fromScene.scene.start('BattleScene', data);
      return true;
    } catch (e2) {
      console.error('[PreBattle] BattleScene fallback failed', e2);
      return false;
    }
  }

  global.SR_startPreBattle = startPreBattle;
  if (typeof window !== 'undefined') window.SR_startPreBattle = startPreBattle;
})(typeof window !== 'undefined' ? window : global);
