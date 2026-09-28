/* Alchemy lab — recipes, transmute, consumables (ink + gold list language) */
(function (global) {
  'use strict';

  class AlchemyScene extends Phaser.Scene {
    constructor() {
      super({ key: 'AlchemyScene' });
    }

    create() {
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_alchemy_video', {
        wash: 0.14, washColor: 0x0a0e12, fallbackImage: 'mode_alchemy'
      }))) {
        UI.paintModeBg(this, 'mode_alchemy', '#0a0e12');
      }
      UI.addBackButton(this);
      UI.addTitle(this, 'Alchemy Lab', 'Convert resources into tools');
      UI.addCurrencyStrip(this, state, 40);

      const alchemy = (state.player && state.player.stats && state.player.stats.alchemy) || 0;
      // Bonus strip — ink plate, not jade
      if (UI.addInkPanel) {
        UI.addInkPanel(this, w / 2, 108, Math.min(520, w - 80), 36, {
          depth: 40, stroke: 0xc9a44a, alpha: 0.9
        });
      } else {
        this.add.rectangle(w / 2, 108, Math.min(520, w - 80), 36, 0x0a0e12, 0.92)
          .setStrokeStyle(2, 0xc9a44a, 0.85).setDepth(40);
      }
      this.add.text(w / 2, 108, 'Alchemy yield  ·  +' + (alchemy * 4) + '%  (Great Hall skill)', {
        fontFamily: 'system-ui', fontSize: '13px', color: '#e8d5a0', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 3
      }).setOrigin(0.5).setDepth(50);

      const recipes = (global.SR_DATA && global.SR_DATA.ALCHEMY_RECIPES) || [];
      const listTop = 150;
      const rowH = 52;
      const listW = Math.min(920, w - 80);
      const cx = w / 2;

      recipes.forEach((rec, i) => {
        const y = listTop + i * rowH;
        const costStr = Object.keys(rec.cost || {})
          .map((k) => rec.cost[k] + ' ' + k)
          .join(' + ');
        const grantKeys = Object.keys(rec.grant || {});
        let grantStr = grantKeys.length
          ? grantKeys.map((k) => '+' + rec.grant[k] + ' ' + k).join(', ')
          : (rec.globalPower ? 'Global power ×' + rec.globalPower : 'Special');
        const canAfford = this._canAfford(state, rec.cost);
        if (UI.addListRow) {
          UI.addListRow(this, cx, y, listW, rowH - 8, {
            title: rec.name,
            sub: costStr,
            right: canAfford ? grantStr : 'Need mats',
            locked: false,
            stroke: canAfford ? 0xc9a44a : 0x5a5040,
            fill: canAfford ? 0x0c1016 : 0x12141a,
            depth: 40,
            onClick: () => {
              const res = global.SR_STATE.craftRecipe(state, rec.id);
              UI.toast(this, res.ok ? 'Crafted ' + rec.name : res.error, res.ok);
              if (res.ok) this.scene.restart();
            }
          });
        } else {
          UI.addButton(this, cx, y, listW, rowH - 10,
            rec.name + '  ·  ' + costStr, canAfford ? 0x1a2820 : 0x222222, () => {
              const res = global.SR_STATE.craftRecipe(state, rec.id);
              UI.toast(this, res.ok ? 'Crafted ' + rec.name : res.error, res.ok);
              if (res.ok) this.scene.restart();
            });
        }
      });

      // Transmute / consumable footer
      const footY = Math.min(h - 72, listTop + recipes.length * rowH + 28);
      if (UI.addInkPanel) {
        UI.addInkPanel(this, cx, footY + 8, listW, 96, {
          depth: 38, stroke: 0xc9a44a, alpha: 0.88
        });
      }
      this.add.text(cx, footY - 28, 'Transmute  ·  Consumables', {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffe8a0', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 3
      }).setOrigin(0.5).setDepth(50);

      const btnW = Math.min(240, (listW - 40) / 3);
      UI.addButton(this, cx - btnW - 12, footY + 18, btnW, 40, 'Gold → Mana (100)', 0x1a2820, () => {
        const res = global.SR_STATE.transmute(state, 'gold_to_mana');
        UI.toast(this, res.ok ? 'Transmuted to Mana' : res.error, res.ok);
        if (res.ok) this.scene.restart();
      });
      UI.addButton(this, cx, footY + 18, btnW, 40, 'Mana → Divine (50)', 0x1a1a28, () => {
        const res = global.SR_STATE.transmute(state, 'mana_to_divine');
        UI.toast(this, res.ok ? 'Transmuted to Divine' : res.error, res.ok);
        if (res.ok) this.scene.restart();
      });
      UI.addButton(this, cx + btnW + 12, footY + 18, btnW, 40, 'Healing Salve (EXP)', 0x1a2820, () => {
        const res = global.SR_STATE.useHealingSalve(state);
        UI.toast(this, res.ok ? 'Salve: +' + res.exp + ' EXP total' : res.error, res.ok);
        if (res.ok) this.scene.restart();
      });
    }

    _canAfford(state, cost) {
      if (!cost) return true;
      const r = state.resources || {};
      return Object.keys(cost).every((k) => (r[k] || 0) >= cost[k]);
    }
  }

  global.AlchemyScene = AlchemyScene;
})(typeof window !== 'undefined' ? window : global);
