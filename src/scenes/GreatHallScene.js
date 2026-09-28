/* Great Hall — player master skills / stat points */
(function (global) {
  'use strict';

  class GreatHallScene extends Phaser.Scene {
    constructor() {
      super({ key: 'GreatHallScene' });
    }

    create() {
      const w = this.cameras.main.width;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_great_hall_video', {
        wash: 0.14, washColor: 0x14100c, fallbackImage: 'mode_great_hall'
      }))) {
        UI.paintModeBg(this, 'mode_great_hall', '#14100c');
      }
      UI.addBackButton(this);
      UI.addTitle(this, 'Great Hall', 'Spend stat points as a slime master');
      UI.addCurrencyStrip(this, state, 40);

      const p = state.player || {};
      this.add.text(w / 2, 110, 'Tamer Lv ' + (p.level || 1) + ' · EXP ' + (p.exp || 0) + ' · Points ' + (p.statPoints || 0), {
        fontFamily: 'system-ui', fontSize: '15px', color: '#ffeeaa'
      }).setOrigin(0.5).setDepth(50);

      const stats = (global.SR_DATA && global.SR_DATA.PLAYER_STATS) || [];
      stats.forEach((st, i) => {
        const y = 160 + i * 58;
        const val = (p.stats && p.stats[st.id]) || 0;
        const go = () => {
          const res = global.SR_STATE.spendStatPoint(state, st.id);
          UI.toast(this, res.ok ? st.name + ' → ' + res.value : res.error, res.ok);
          if (res.ok) this.scene.restart();
        };
        if (UI.addListRow) {
          UI.addListRow(this, w / 2, y, w - 100, 50, {
            title: st.name + '  ·  Lv ' + val,
            sub: st.desc,
            right: '+ Point',
            onClick: go,
            depth: 40
          });
        } else {
          const bg = this.add.rectangle(w / 2, y, w - 100, 50, 0x0c1016, 0.92)
            .setStrokeStyle(2, 0xc9a44a).setInteractive({ useHandCursor: true }).setDepth(40);
          bg.on('pointerdown', go);
        }
      });
    }
  }

  global.GreatHallScene = GreatHallScene;
})(typeof window !== 'undefined' ? window : global);
