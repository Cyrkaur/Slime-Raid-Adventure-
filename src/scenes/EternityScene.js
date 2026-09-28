/* Eternity — milestones, void tower, divine convergence */
(function (global) {
  'use strict';

  class EternityScene extends Phaser.Scene {
    constructor() {
      super({ key: 'EternityScene' });
    }

    create() {
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      // Cosmic eternity vista (floating isles — not the dungeon cave)
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_eternity_video', {
        wash: 0.12, washColor: 0x100818, fallbackImage: 'mode_eternity'
      }))) {
        UI.paintModeBg(this, 'mode_eternity', '#100818', 0.4);
      }
      UI.addBackButton(this);
      UI.addTitle(this, 'Eternity', 'Milestones · Void Tower · Convergence');
      UI.addCurrencyStrip(this, state, 40);

      this.add.text(24, 105, 'Permanent Milestones', {
        fontFamily: 'system-ui', fontSize: '15px', color: '#e0c8ff', fontStyle: 'bold'
      }).setDepth(50);

      const milestones = (global.SR_DATA && global.SR_DATA.MILESTONES) || [];
      milestones.forEach((m, i) => {
        const claimed = !!(state.eternity.claimedMilestones && state.eternity.claimedMilestones[m.id]);
        const ready = !claimed && m.check(state);
        const y = 140 + i * 42;
        const color = claimed ? 0x223322 : (ready ? 0x3a2a55 : 0x222228);
        UI.addButton(this, w / 2, y, w - 80, 36,
          (claimed ? '✓ ' : ready ? '★ ' : '○ ') + m.name + (claimed ? ' (claimed)' : ready ? ' — claim' : ''),
          color, () => {
            if (claimed) { UI.toast(this, 'Already claimed', false); return; }
            const res = global.SR_STATE.claimMilestone(state, m.id);
            UI.toast(this, res.ok ? 'Claimed ' + m.name : res.error, res.ok);
            if (res.ok) this.scene.restart();
          });
      });

      const floor = (state.eternity && state.eternity.voidFloor) || 1;
      UI.addButton(this, w / 2 - 160, h - 70, 280, 44,
        'Climb Void Tower (Floor ' + floor + ')', 0x442266, () => {
          const res = global.SR_STATE.runVoidTower(state);
          if (!res.ok) { UI.toast(this, res.error, false); return; }
          UI.toast(this, res.won ? 'Floor ' + res.floor + ' cleared → ' + res.next : 'Fell on floor ' + res.floor + ' (need ~' + res.need + ' power)', res.won);
          this.time.delayedCall(900, () => this.scene.restart());
        });

      const convCost = 30 + ((state.eternity && state.eternity.convergences) || 0) * 15;
      UI.addButton(this, w / 2 + 180, h - 70, 280, 44,
        'Divine Convergence (' + convCost + '✨)', 0x554422, () => {
          const res = global.SR_STATE.divineConvergence(state);
          UI.toast(this, res.ok ? 'Convergence #' + res.convergences + ' (+3% power)' : res.error, res.ok);
          if (res.ok) this.scene.restart();
        });
    }
  }

  global.EternityScene = EternityScene;
})(typeof window !== 'undefined' ? window : global);
