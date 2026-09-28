/* Dungeons & Boss Raids — polished list rows + live video */
(function (global) {
  'use strict';

  class DungeonScene extends Phaser.Scene {
    constructor() {
      super({ key: 'DungeonScene' });
    }

    create() {
      if (global.SR_UI && global.SR_UI.installCrispText) global.SR_UI.installCrispText(this);
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;

      this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'dungeon_bg_video', {
        wash: 0.14,
        washColor: 0x0a0e12,
        fallbackImage: 'mode_dungeons'
      }))) {
        if (UI && UI.paintModeBg) UI.paintModeBg(this, 'mode_dungeons', '#0a0e12');
        else if (this.textures.exists('mode_dungeons')) {
          this.add.image(w / 2, h / 2, 'mode_dungeons').setDisplaySize(w, h).setDepth(0);
        } else {
          this.cameras.main.setBackgroundColor('#0a0e12');
        }
      }

      UI.addBackButton(this);
      UI.addTitle(this, 'Dungeons & Incursions', 'Wave delves · set gear pools · hard-realm apex foes');
      UI.addCurrencyStrip(this, state, 40);

      const pp = global.SR_STATE.partyPower(state);
      this.add.text(24, 100, 'Party Power: ' + pp + (state.flags.battleElixirActive ? '  ·  elixir armed' : ''), {
        fontFamily: 'system-ui', fontSize: '13px', color: '#c9a44a',
        stroke: '#000', strokeThickness: 2
      }).setDepth(50);

      UI.addButton(this, w - 120, 100, 180, 36, 'Use Battle Elixir', 0x443311, () => {
        const r = global.SR_STATE.useBattleElixir(state);
        UI.toast(this, r.ok ? 'Elixir armed +25% power' : r.error, r.ok);
        if (r.ok) this.scene.restart();
      });

      this.add.text(40, 138, 'REGULAR DUNGEONS', {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffe8a0', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 3
      }).setDepth(50);

      const dungeons = (global.SR_DATA && global.SR_DATA.DUNGEONS) || [];
      const rowW = Math.min(560, w - 80);
      dungeons.forEach((d, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 40 + rowW / 2 + col * (rowW + 24);
        const y = 178 + row * 62;
        const unlocked = global.SR_STATE.dungeonUnlocked(state, d, i);
        const clears = (state.dungeons.cleared[d.id] || 0);
        const sets = (d.gear && d.gear.length) ? d.gear.join(' / ') : 'random';
        const waves = (global.SR_STATE.dungeonWaveCount
          ? global.SR_STATE.dungeonWaveCount(d)
          : Math.max(1, d.waves || 1));
        const go = () => {
          const payload = {
            dungeon: d,
            region: d.id,
            zone: d.id,
            arena: d.id,
            waveIndex: 0,
            // First wave only — BattleScene escalates remaining waves
            foes: global.SR_STATE.makeDungeonWaveFoes
              ? global.SR_STATE.makeDungeonWaveFoes(d, 0)
              : global.SR_STATE.makeDungeonFoes(d),
            returnScene: 'DungeonScene'
          };
          if (typeof global.SR_startPreBattle === 'function') {
            global.SR_startPreBattle(this, payload);
          } else {
            this.scene.start('BattleScene', payload);
          }
        };
        if (UI.addListRow) {
          UI.addListRow(this, x, y, rowW, 52, {
            title: (unlocked ? '🗡  ' : '🔒  ') + d.name,
            sub: d.element + ' · ' + waves + ' waves · PWR ' + d.power +
              ' · ' + sets + ' gear · clears ×' + clears,
            right: unlocked ? 'Enter ›' : 'Locked',
            locked: !unlocked,
            stroke: unlocked ? 0xc9a44a : 0x3a4048,
            onClick: unlocked ? go : null,
            depth: 40
          });
        } else {
          const bg = this.add.rectangle(x, y, rowW, 52, unlocked ? 0x0c1016 : 0x12151a, 0.94)
            .setStrokeStyle(2, unlocked ? 0xc9a44a : 0x444).setDepth(40);
          this.add.text(x - rowW / 2 + 16, y, d.name, {
            fontFamily: 'system-ui', fontSize: '14px', color: unlocked ? '#e8ffd4' : '#666'
          }).setOrigin(0, 0.5).setDepth(41);
          if (unlocked) {
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', go);
          }
        }
      });

      this.add.text(40, 420, 'APEX INCURSIONS', {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: '#e8c090', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 3
      }).setDepth(50);
      this.add.text(40, 440, 'Hard-realm lords · not of the Softened gel', {
        fontFamily: 'system-ui', fontSize: '11px', color: '#887766'
      }).setDepth(50);

      const bosses = (global.SR_DATA && global.SR_DATA.BOSSES) || [];
      const bossW = Math.min(200, (w - 80) / Math.max(1, bosses.length) - 12);
      bosses.forEach((b, i) => {
        const x = 50 + bossW / 2 + i * (bossW + 14);
        const y = 500;
        const wins = (state.dungeons.bossWins[b.id] || 0);
        const goBoss = () => {
          const payload = {
            boss: b,
            region: b.id,
            zone: b.id,
            arena: b.id,
            foes: global.SR_STATE.makeBossFoes(b),
            returnScene: 'DungeonScene'
          };
          if (typeof global.SR_startPreBattle === 'function') {
            global.SR_startPreBattle(this, payload);
          } else {
            this.scene.start('BattleScene', payload);
          }
        };
        // Clean flat card — same quiet language as campaign battle panel
        const card = this.add.rectangle(x, y, bossW, 92, 0x0a0e12, 0.92)
          .setStrokeStyle(1.5, 0xc9a44a, 0.7)
          .setInteractive({ useHandCursor: true })
          .setDepth(40);
        this.add.rectangle(x, y - 20, bossW - 28, 1, 0xc9a44a, 0.28).setDepth(41);
        this.add.text(x, y - 28, b.name, {
          fontFamily: 'Georgia, serif', fontSize: '13px', color: '#f0e8d8', fontStyle: 'bold',
          align: 'center', wordWrap: { width: bossW - 20 },
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(42);
        this.add.text(x, y + 2, b.title || b.element, {
          fontFamily: 'system-ui', fontSize: '10px', color: '#887766',
          align: 'center', wordWrap: { width: bossW - 18 }
        }).setOrigin(0.5).setDepth(42);
        this.add.text(x, y + 28, b.element + ' · PWR ' + b.power + ' · ×' + wins, {
          fontFamily: 'system-ui', fontSize: '11px', color: '#c9a44a'
        }).setOrigin(0.5).setDepth(42);
        card.on('pointerover', () => {
          card.setStrokeStyle(2, 0xe8d5a0, 1);
          card.setFillStyle(0x12161c, 0.96);
        });
        card.on('pointerout', () => {
          card.setStrokeStyle(1.5, 0xc9a44a, 0.7);
          card.setFillStyle(0x0a0e12, 0.92);
        });
        card.on('pointerdown', goBoss);
      });
    }
  }

  global.DungeonScene = DungeonScene;
})(typeof window !== 'undefined' ? window : global);
