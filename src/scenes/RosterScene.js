/* Champion roster — badges + card borders tinted by rarity */
(function (global) {
  'use strict';

  class RosterScene extends Phaser.Scene {
    constructor() {
      super({ key: 'RosterScene' });
    }

    create() {
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_champions_video', {
        wash: 0.18, washColor: 0x0a0e12, fallbackImage: 'mode_champions'
      }))) {
        UI.paintModeBg(this, 'mode_champions', '#0a0e12', 0.32);
      }
      UI.addBackButton(this);
      UI.addTitle(this, 'Champions', 'Tap a card for details · star toggles party');
      // Currencies own the top-right — do not place action buttons there
      if (UI.addCurrencyStrip) UI.addCurrencyStrip(this, state, 40);

      const maxParty = 4 + Math.min(2, (state.player && state.player.stats && state.player.stats.leadership) || 0);
      // Action row under header (left), clear of currency pills
      const actionY = 88;
      this.add.text(24, actionY - 2, 'Roster ' + state.roster.length + ' · Party max ' + maxParty, {
        fontFamily: 'system-ui', fontSize: '13px', color: '#b8e8cc',
        stroke: '#000', strokeThickness: 2
      }).setDepth(50);

      const btnH = 32;
      const btnGap = 10;
      let bx = 24;
      // Place actions to the right of roster label
      const labelW = 210;
      bx = 24 + labelW;
      UI.addButton(this, bx + 50, actionY + 4, 100, btnH, 'Party!', 0x1a1820, () => {
        const res = global.SR_STATE.slimeParty(state);
        UI.toast(this, res.ok ? 'Slime Party +' + res.jelly + ' jelly' : res.error, res.ok);
        if (res.ok) this.scene.restart();
      });
      bx += 100 + btnGap;
      UI.addButton(this, bx + 45, actionY + 4, 90, btnH, 'Fuse', 0x442255, () => {
        const res = global.SR_STATE.fuseSlimes(state);
        UI.toast(this, res.ok ? 'Fused into ' + res.kept.name : res.error, res.ok);
        if (res.ok) this.scene.restart();
      });
      bx += 90 + btnGap;
      // Evolve is on champion sheet (pick fodder) — no auto-consume here
      UI.addButton(this, bx + 48, actionY + 4, 96, btnH, 'Evolve?', 0x442255, () => {
        UI.toast(this, 'Open a champion → Evolve → pick fodder of matching ★', true);
      });

      const partySet = {};
      (state.partyIds || []).forEach((id) => { partySet[id] = true; });
      const DATA = global.SR_DATA || {};

      const cols = 4;
      const cardW = 280;
      const cardH = 190;
      const startY = 140;
      state.roster.forEach((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 40 + cardW / 2 + col * (cardW + 20);
        const y = startY + cardH / 2 + row * (cardH + 18);
        if (y > h - 20) return;

        const inParty = !!partySet[c.id];
        const base = (DATA.getBaseStars && DATA.getBaseStars(c)) || c.baseStars || 1;
        const pur = (DATA.getPurpleStars && DATA.getPurpleStars(c)) || c.purpleStars || 0;
        const rar = c.rarity || 'Common';
        const rarColor = (UI.rarityColor && UI.rarityColor(rar)) || 0x9ca3af;
        const rarHex = (UI.rarityHex && UI.rarityHex(rar)) || '#9ca3af';

        // Card frame — village ink/panel tones (not green); rarity border; party = thicker + slightly lighter
        const T = (UI && UI.THEME) || {};
        const fillIdle = T.panel != null ? T.panel : 0x0a1410;
        const fillParty = T.panelLite != null ? T.panelLite : 0x141a20;
        const frame = this.add.rectangle(x, y, cardW, cardH, inParty ? fillParty : fillIdle, 0.94)
          .setStrokeStyle(inParty ? 4 : 2, inParty ? (T.gold || 0xc9a44a) : rarColor, inParty ? 0.95 : 0.85)
          .setInteractive({ useHandCursor: true }).setDepth(40);

        // Badge with rarity ring
        UI.addSlimePortrait(this, x - 78, y - 6, 120, c.element, 42, {
          mode: 'badge',
          champ: c,
          artVariant: c.artVariant,
          rarity: rar
        });

        this.add.text(x + 18, y - 58, c.name, {
          fontFamily: 'system-ui', fontSize: '16px', color: '#f0ffe8', fontStyle: 'bold',
          wordWrap: { width: 140 }
        }).setDepth(43);
        // Stars live on the portrait (gold / purple)
        const maxLv = (DATA.getChampionMaxLevel && DATA.getChampionMaxLevel(c)) ||
          (50 + (pur || 0) * 10);
        this.add.text(x + 18, y - 28, c.element + ' · ' + rar, {
          fontFamily: 'system-ui', fontSize: '13px', color: rarHex
        }).setDepth(43);
        this.add.text(x + 18, y + 2, 'Lv' + (c.level || 1) + '/' + maxLv + ' · ' + c.power + ' PWR', {
          fontFamily: 'system-ui', fontSize: '14px', color: '#ffeeaa'
        }).setDepth(43);
        this.add.text(x + 18, y + 36, 'Tap for details · evolve', {
          fontFamily: 'system-ui', fontSize: '12px', color: '#88a090'
        }).setDepth(43);

        frame.on('pointerdown', () => {
          if (global.SR_TRANSIT && global.SR_TRANSIT.go) {
            global.SR_TRANSIT.go(this, 'ChampionDetailScene', { champId: c.id, returnScene: 'RosterScene' });
          } else {
            this.scene.start('ChampionDetailScene', { champId: c.id, returnScene: 'RosterScene' });
          }
        });
        frame.on('pointerover', () => frame.setStrokeStyle(4, 0xe8d5a0, 1));
        frame.on('pointerout', () =>
          frame.setStrokeStyle(inParty ? 4 : 2, inParty ? ((UI.THEME && UI.THEME.gold) || 0xc9a44a) : rarColor, 0.9));

        const star = this.add.text(x + cardW / 2 - 18, y - cardH / 2 + 14, inParty ? '★' : '☆', {
          fontFamily: 'system-ui', fontSize: '22px', color: inParty ? rarHex : '#668877'
        }).setOrigin(0.5).setDepth(45).setInteractive({ useHandCursor: true });
        star.on('pointerdown', (ptr) => {
          if (ptr && ptr.event) ptr.event.stopPropagation();
          const ids = state.partyIds || [];
          const idx = ids.indexOf(c.id);
          if (idx >= 0) ids.splice(idx, 1);
          else if (ids.length < maxParty) ids.push(c.id);
          else { UI.toast(this, 'Party full', false); return; }
          state.partyIds = ids;
          global.SR_STATE.saveState(state);
          this.scene.restart();
        });
      });
    }
  }

  global.RosterScene = RosterScene;
})(typeof window !== 'undefined' ? window : global);
