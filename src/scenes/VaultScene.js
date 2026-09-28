/* Vault — inventory + set farming clarity + Raid-style artifact enhance */
(function (global) {
  'use strict';

  class VaultScene extends Phaser.Scene {
    constructor() {
      super({ key: 'VaultScene' });
    }

    create() {
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      const DATA = global.SR_DATA || {};
      const SETS = DATA.ARTIFACT_SETS || {};
      const SET_ORDER = Object.keys(SETS).length
        ? Object.keys(SETS)
        : ['Life', 'Offense', 'Defense', 'Speed', 'Critical', 'Perception'];

      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_vault_video', {
        wash: 0.14, washColor: 0x0c1418, fallbackImage: 'mode_vault'
      }))) {
        UI.paintModeBg(this, 'mode_vault', '#0c1418', 0.48);
      }
      UI.addBackButton(this);
      UI.addTitle(this, 'Vault', 'Materials · set farming · artifact enhance');
      UI.addCurrencyStrip(this, state, 40);

      // ── Materials (compact strip) ──
      this.add.text(24, 100, 'Materials', {
        fontFamily: 'system-ui', fontSize: '14px', color: '#ffeeaa', fontStyle: 'bold'
      }).setDepth(50);
      const lines = global.SR_STATE.inventoryLines(state);
      const showMats = lines.slice(0, 12);
      showMats.forEach((row, i) => {
        const col = i % 6;
        const r = Math.floor(i / 6);
        this.add.text(30 + col * 155, 122 + r * 22, row.key + ': ' + row.amount, {
          fontFamily: 'system-ui', fontSize: '11px', color: '#c8e8d8'
        }).setDepth(50);
      });

      // ── Set progress (farming clarity) ──
      const arts = state.artifacts || [];
      const setCounts = {};
      SET_ORDER.forEach((s) => { setCounts[s] = { total: 0, free: 0, equipped: 0 }; });
      arts.forEach((a) => {
        const sn = a.set || a.setName || '';
        if (!setCounts[sn]) setCounts[sn] = { total: 0, free: 0, equipped: 0 };
        setCounts[sn].total += 1;
        if (a.equippedTo) setCounts[sn].equipped += 1;
        else setCounts[sn].free += 1;
      });

      this.add.text(24, 175, 'SET PROGRESS  ·  farm 2pc / 4pc kits', {
        fontFamily: 'system-ui', fontSize: '13px', fontStyle: 'bold', color: '#c9a44a',
        stroke: '#000', strokeThickness: 3
      }).setDepth(50);

      SET_ORDER.forEach((sn, i) => {
        const sc = setCounts[sn] || { total: 0, free: 0, equipped: 0 };
        const meta = SETS[sn] || {};
        const colHex = meta.color || '#c9a44a';
        let stroke = 0xc9a44a;
        try {
          stroke = Phaser.Display.Color.HexStringToColor(colHex).color || 0xc9a44a;
        } catch (e) { /* ignore */ }
        const x = 40 + (i % 6) * 155;
        const y = 210 + Math.floor(i / 6) * 52;
        const ready2 = sc.total >= 2;
        const ready4 = sc.total >= 4;
        const badge = ready4 ? '4pc' : (ready2 ? '2pc' : sc.total + '/2');
        const bg = this.add.rectangle(x + 60, y, 140, 44, 0x0c1016, 0.92)
          .setStrokeStyle(2, stroke).setDepth(40);
        this.add.text(x + 60, y - 8, sn, {
          fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold', color: colHex
        }).setOrigin(0.5).setDepth(50);
        this.add.text(x + 60, y + 10, sc.total + ' pcs · ' + badge + (sc.free ? ' · ' + sc.free + ' free' : ''), {
          fontFamily: 'system-ui', fontSize: '10px', color: ready2 ? '#a8e0c0' : '#8899aa'
        }).setOrigin(0.5).setDepth(50);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          const cur = this.registry.get('vaultSetFilter') || 'All';
          this.registry.set('vaultSetFilter', cur === sn ? 'All' : sn);
          this.scene.restart();
        });
      });

      // Persist filter across scene.restart via registry
      const filter = this.registry.get('vaultSetFilter') || 'All';

      const filterY = 270;
      this.add.text(24, filterY, 'FILTER', {
        fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold', color: '#88a090'
      }).setDepth(50);

      const filters = ['All'].concat(SET_ORDER);
      const chipNodes = [];
      filters.forEach((fname, i) => {
        const meta = SETS[fname] || {};
        const colHex = fname === 'All' ? '#c9a44a' : (meta.color || '#c9a44a');
        let stroke = 0xc9a44a;
        try {
          stroke = Phaser.Display.Color.HexStringToColor(colHex).color || 0xc9a44a;
        } catch (e) { /* ignore */ }
        const active = filter === fname;
        const x = 90 + i * 92;
        const chip = this.add.rectangle(x, filterY + 18, 86, 28, active ? 0x1a2830 : 0x0c1016, 0.95)
          .setStrokeStyle(active ? 2 : 1, stroke).setDepth(40)
          .setInteractive({ useHandCursor: true });
        const lab = this.add.text(x, filterY + 18, fname, {
          fontFamily: 'system-ui', fontSize: '11px', fontStyle: 'bold',
          color: active ? colHex : '#aab8b0'
        }).setOrigin(0.5).setDepth(50);
        chip.on('pointerdown', () => {
          this.registry.set('vaultSetFilter', fname);
          this.scene.restart();
        });
        chipNodes.push(chip, lab);
      });

      // ── Artifact list ──
      const filtered = filter === 'All'
        ? arts.slice()
        : arts.filter((a) => (a.set || a.setName) === filter);

      // Free pieces first (farming / enhance), then equipped
      filtered.sort((a, b) => {
        const ae = a.equippedTo ? 1 : 0;
        const be = b.equippedTo ? 1 : 0;
        if (ae !== be) return ae - be;
        return (b.level || 1) - (a.level || 1);
      });

      this.add.text(24, 320,
        'ARTIFACTS  ·  ' + filtered.length + (filter === 'All' ? '' : ' ' + filter) +
        ' of ' + arts.length + '  ·  tap to enhance  ·  dungeon set pools farm 2/4pc', {
        fontFamily: 'system-ui', fontSize: '13px', fontStyle: 'bold', color: '#c9a44a',
        stroke: '#000', strokeThickness: 3
      }).setDepth(50);

      // Farm tip: which dungeons drop the filtered set
      if (filter !== 'All' && DATA.DUNGEONS) {
        const farms = (DATA.DUNGEONS || []).filter((d) => (d.gear || []).indexOf(filter) >= 0);
        const tip = farms.length
          ? 'Farm: ' + farms.map((d) => d.name).slice(0, 4).join(' · ')
          : 'Farm: Campaign random drops · any dungeon with this set';
        this.add.text(24, 342, tip, {
          fontFamily: 'system-ui', fontSize: '11px', color: '#78a898'
        }).setDepth(50);
      }

      const GEAR = global.SR_GEAR_UI;
      const listTop = filter !== 'All' && DATA.DUNGEONS ? 365 : 350;
      if (!filtered.length) {
        this.add.text(24, listTop,
          filter === 'All'
            ? 'No relics yet. Campaign stages drop random sets · dungeons drop that dungeon\'s sets.'
            : 'No ' + filter + ' pieces yet. Run matching dungeons (see farm tip) or campaign.', {
          fontFamily: 'system-ui', fontSize: '13px', color: '#88ccaa', wordWrap: { width: w - 60 }
        }).setDepth(50);
      } else {
        const maxShow = 16;
        filtered.slice(0, maxShow).forEach((a, i) => {
          const x = 140 + (i % 4) * 220;
          const y = listTop + 30 + Math.floor(i / 4) * 72;
          const meta = SETS[a.set] || {};
          const sc = meta.color || '#c9a44a';
          let stroke = 0xc9a44a;
          try {
            stroke = Phaser.Display.Color.HexStringToColor(sc).color || 0xc9a44a;
          } catch (e) { /* ignore */ }
          const equipNote = a.equippedTo ? 'equipped' : 'vault';
          const open = () => {
            if (!GEAR) {
              UI.toast(this, 'Gear UI missing — hard refresh', false);
              return;
            }
            GEAR.openVaultEnhance(this, {
              state: state,
              artifact: a,
              UI: UI,
              onDone: () => this.scene.restart()
            });
          };
          if (UI.addListRow) {
            UI.addListRow(this, x, y, 200, 58, {
              title: (a.name || 'Relic') + '  +' + (a.level || 1),
              sub: (a.set || 'Relic') + ' · +' + (a.power || a.value || 0) + ' · ' + equipNote,
              right: 'Enhance',
              stroke: stroke,
              onClick: open,
              depth: 40
            });
          } else {
            const bg = this.add.rectangle(x, y, 200, 62, 0x0c1016, 0.95)
              .setStrokeStyle(2, stroke).setInteractive({ useHandCursor: true }).setDepth(40);
            bg.on('pointerdown', open);
            this.add.text(x, y - 8, (a.name || 'Relic') + ' +' + (a.level || 1), {
              fontFamily: 'system-ui', fontSize: '12px', color: '#e8f0e8'
            }).setOrigin(0.5).setDepth(50);
            this.add.text(x, y + 12, (a.set || '') + ' · ' + equipNote, {
              fontFamily: 'system-ui', fontSize: '11px', color: sc
            }).setOrigin(0.5).setDepth(50);
          }
        });
        if (filtered.length > maxShow) {
          this.add.text(24, h - 36, '+' + (filtered.length - maxShow) + ' more — enhance to free list slots or filter by set', {
            fontFamily: 'system-ui', fontSize: '11px', color: '#778888'
          }).setDepth(50);
        }
      }

      // Silence unused
      void chipNodes;
      void w;
    }
  }

  global.VaultScene = VaultScene;
})(typeof window !== 'undefined' ? window : global);
