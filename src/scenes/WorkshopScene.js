/* Workshop facility upgrades */
(function (global) {
  'use strict';

  class WorkshopScene extends Phaser.Scene {
    constructor() {
      super({ key: 'WorkshopScene' });
    }

    create() {
      const w = this.cameras.main.width;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      // Craft hall art (forge + workbenches — distinct from alchemy lab)
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_workshop_video', {
        wash: 0.14, washColor: 0x12100a, fallbackImage: 'mode_workshop'
      }))) {
        UI.paintModeBg(this, 'mode_workshop', '#12100a', 0.45);
      }
      UI.addBackButton(this);
      UI.addTitle(this, 'Workshop', 'Build and upgrade facilities · forge, hall, and refinery');
      UI.addCurrencyStrip(this, state, 40);

      this.add.text(w / 2, 110, 'Refined Essence: ' + Math.floor(state.resources.refinedEssence || 0), {
        fontFamily: 'system-ui', fontSize: '14px', color: '#ffeeaa'
      }).setOrigin(0.5).setDepth(50);

      const ups = (global.SR_DATA && global.SR_DATA.WORKSHOP_UPGRADES) || [];
      ups.forEach((u, i) => {
        const y = 170 + i * 80;
        const lvl = (state.workshop && state.workshop[u.id]) || 0;
        const go = () => {
          const res = global.SR_STATE.upgradeWorkshop(state, u.id);
          UI.toast(this, res.ok ? u.name + ' → Lv ' + res.level : res.error, res.ok);
          if (res.ok) this.scene.restart();
        };
        if (UI.addListRow) {
          UI.addListRow(this, w / 2, y, w - 120, 64, {
            title: u.name + '  ·  Lv ' + lvl,
            sub: u.desc + '  ·  Cost ' + u.gold + 'g + ' + u.essence + ' refined',
            right: 'Upgrade ›',
            onClick: go,
            depth: 40
          });
        } else {
          const bg = this.add.rectangle(w / 2, y, w - 120, 68, 0x0c1016, 0.95)
            .setStrokeStyle(2, 0xc9a44a).setInteractive({ useHandCursor: true }).setDepth(40);
          bg.on('pointerdown', go);
        }
      });

      UI.addButton(this, w / 2, 440, 320, 44, 'Advanced Workshop (+8% power)', 0x443311, () => {
        const res = global.SR_STATE.upgradeWorkshop(state, 'advanced');
        UI.toast(this, res.ok ? 'Advanced workshop complete' : res.error, res.ok);
        if (res.ok) this.scene.restart();
      });
    }
  }

  global.WorkshopScene = WorkshopScene;
})(typeof window !== 'undefined' ? window : global);
