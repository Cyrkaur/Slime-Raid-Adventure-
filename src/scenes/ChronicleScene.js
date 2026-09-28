/* Chronicle — lore codex + lifetime records */
(function (global) {
  'use strict';

  class ChronicleScene extends Phaser.Scene {
    constructor() {
      super({ key: 'ChronicleScene' });
    }

    create() {
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_chronicle_video', {
        wash: 0.14, washColor: 0x0a1218, fallbackImage: 'mode_chronicle'
      }))) {
        UI.paintModeBg(this, 'mode_chronicle', '#0a1218');
      }
      UI.addBackButton(this);
      UI.addTitle(this, 'Chronicle & Codex', 'World story and playthrough records');
      // No currency strip — lore/records page only

      const lore = (global.SR_DATA && global.SR_DATA.LORE) || {};
      this.add.text(40, 110, 'The Softened Realms', {
        fontFamily: 'Georgia, serif', fontSize: '18px', color: '#e8ffd4'
      }).setDepth(50);
      this.add.text(40, 140, lore.premise || '', {
        fontFamily: 'system-ui', fontSize: '13px', color: '#aaccbb',
        wordWrap: { width: w / 2 - 60 }
      }).setDepth(50);

      (lore.acts || []).forEach((act, i) => {
        this.add.text(40, 210 + i * 48, act.title, {
          fontFamily: 'system-ui', fontSize: '13px', color: '#ffeeaa', fontStyle: 'bold'
        }).setDepth(50);
        this.add.text(40, 228 + i * 48, act.text, {
          fontFamily: 'system-ui', fontSize: '12px', color: '#88aa99'
        }).setDepth(50);
      });

      // Records panel — polished ink frame
      const st = state.stats || {};
      const p = state.player || {};
      const lines = [
        'Wins: ' + (st.wins || 0),
        'Losses: ' + (st.losses || 0),
        'Summons: ' + (st.summons || 0),
        'Fusions: ' + (st.fusions || 0),
        'Evolutions: ' + (st.evolutions || 0),
        'Dungeon clears: ' + (st.dungeonClears || 0),
        'Crafts: ' + (st.crafts || 0),
        'Roster size: ' + (state.roster || []).length,
        'Tamer level: ' + (p.level || 1),
        'Void floor: ' + ((state.eternity && state.eternity.voidFloor) || 1),
        'Convergences: ' + ((state.eternity && state.eternity.convergences) || 0),
        'Global power ×' + ((state.flags && state.flags.globalPowerBonus) || 1).toFixed(2)
      ];
      const rx = w * 0.72;
      const ry = h * 0.55;
      const rw = w * 0.42;
      const rh = h * 0.7;
      if (UI.addInkPanel) {
        UI.addInkPanel(this, rx, ry, rw, rh, { depth: 40, stroke: 0xc9a44a, alpha: 0.92 });
      } else {
        this.add.rectangle(rx, ry, rw, rh, 0x0a0e12, 0.9)
          .setStrokeStyle(2, 0xc9a44a).setDepth(40);
      }
      this.add.text(rx, 120, 'Records', {
        fontFamily: 'Georgia, serif', fontSize: '18px', color: '#ffe8a0',
        stroke: '#041208', strokeThickness: 3
      }).setOrigin(0.5).setDepth(50);
      lines.forEach((line, i) => {
        this.add.text(w * 0.55, 160 + i * 26, line, {
          fontFamily: 'system-ui', fontSize: '13px', color: '#c8d8c8'
        }).setDepth(50);
      });

      // Element chips — ink + gold (element codex strip)
      const els = (global.SR_DATA && global.SR_DATA.ELEMENTS) || [];
      const show = els.slice(0, 12);
      const chipW = 96;
      const chipH = 28;
      const cols = Math.min(6, show.length || 1);
      const stripW = cols * (chipW + 8) - 8;
      const startX = 40 + chipW / 2;
      this.add.text(40, h - 118, 'Elements of the Softened Realms', {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#ffe8a0', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 3
      }).setDepth(50);
      show.forEach((el, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (chipW + 8);
        const y = h - 82 + row * (chipH + 8);
        const name = typeof el === 'string' ? el : (el.name || el.id || '?');
        this.add.rectangle(x, y, chipW, chipH, 0x0a0e12, 0.94)
          .setStrokeStyle(1.5, 0xc9a44a, 0.75).setDepth(49);
        this.add.rectangle(x - chipW / 2 + 3, y, 3, chipH - 8, 0xc9a44a, 0.7).setDepth(50);
        this.add.text(x + 2, y, name, {
          fontFamily: 'system-ui', fontSize: '11px', color: '#e8ffd4', fontStyle: 'bold',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(50);
      });
      void stripW;
    }
  }

  global.ChronicleScene = ChronicleScene;
})(typeof window !== 'undefined' ? window : global);
