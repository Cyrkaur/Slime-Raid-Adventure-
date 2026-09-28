/* Raid-style tutorial finale — pick one of four gels to keep as Epic */
(function (global) {
  'use strict';

  class TutorialPickScene extends Phaser.Scene {
    constructor() {
      super({ key: 'TutorialPickScene' });
    }

    create() {
      if (global.SR_UI && global.SR_UI.installCrispText) global.SR_UI.installCrispText(this);
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      const DATA = global.SR_DATA || {};

      this.cameras.main.setBackgroundColor('#0a0e12');
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_champions_video', {
        wash: 0.22, washColor: 0x0a0e12, fallbackImage: 'mode_champions'
      }))) {
        if (UI.paintModeBg) UI.paintModeBg(this, 'mode_champions', '#0a0e12', 0.4);
      }

      const cands = (global.SR_STATE.ensureTutorialCandidates
        ? global.SR_STATE.ensureTutorialCandidates(state)
        : (state.tutorialCandidates || []));

      this.add.text(w / 2, 48, 'CHOOSE YOUR EPIC', {
        fontFamily: 'Georgia, serif', fontSize: '32px', color: '#ffe8a0', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 5
      }).setOrigin(0.5).setDepth(20);
      this.add.text(w / 2, 92,
        'You fought with all four · pick one to keep as a true Epic bond.\n' +
        'The others return to the soft wilds. Campaign opens with this gel alone.', {
          fontFamily: 'system-ui', fontSize: '15px', color: '#c8d8c8', align: 'center',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(20);

      if (!cands.length) {
        this.add.text(w / 2, h / 2, 'No candidates — resetting tutorial…', {
          fontFamily: 'system-ui', fontSize: '16px', color: '#ffaaaa'
        }).setOrigin(0.5);
        this.time.delayedCall(600, () => {
          if (global.SR_STATE.skipTutorialWithPick) global.SR_STATE.skipTutorialWithPick(state);
          this.scene.start('HubScene');
        });
        return;
      }

      const cardW = Math.min(280, (w - 100) / 4 - 12);
      const cardH = Math.min(420, h * 0.58);
      const gap = 18;
      const totalW = cands.length * cardW + (cands.length - 1) * gap;
      const startX = w / 2 - totalW / 2 + cardW / 2;
      const cy = h * 0.52;
      let locked = false;

      cands.forEach((champ, i) => {
        const cx = startX + i * (cardW + gap);
        const rarCol = (DATA.getRarityColor && DATA.getRarityColor('Epic')) || '#a855f7';
        const rarNum = Phaser.Display.Color.HexStringToColor(rarCol).color || 0xa855f7;

        const root = this.add.container(cx, cy).setDepth(30);
        const plate = this.add.rectangle(0, 0, cardW, cardH, 0x0a0e12, 0.96)
          .setStrokeStyle(2.5, rarNum, 0.95)
          .setInteractive({ useHandCursor: true });
        root.add(plate);
        root.add(this.add.rectangle(0, 0, cardW - 12, cardH - 12, 0x000000, 0)
          .setStrokeStyle(1, 0xe8d5a0, 0.25));
        root.add(this.add.text(0, -cardH / 2 + 28, 'EPIC', {
          fontFamily: 'system-ui', fontSize: '12px', color: rarCol, fontStyle: 'bold',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5));

        if (UI.addSlimePortrait) {
          UI.addSlimePortrait(this, cx, cy - 40, Math.min(160, cardW * 0.7), champ.element, 32, {
            mode: 'badge', ring: true, rarity: 'Epic', champ: champ, showStars: false, bob: true
          });
        }

        root.add(this.add.text(0, cardH / 2 - 100, champ.name || 'Gel', {
          fontFamily: 'Georgia, serif', fontSize: '18px', color: '#f4ffe8', fontStyle: 'bold',
          stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5));
        root.add(this.add.text(0, cardH / 2 - 72, (champ.element || '') + '  ·  Lv 10 Epic', {
          fontFamily: 'system-ui', fontSize: '13px', color: '#a8e0c0'
        }).setOrigin(0.5));
        root.add(this.add.text(0, cardH / 2 - 42, 'Tap to bond', {
          fontFamily: 'system-ui', fontSize: '12px', color: '#ffe8a0', fontStyle: 'bold'
        }).setOrigin(0.5));

        plate.on('pointerover', () => {
          if (!locked) root.setScale(1.05);
        });
        plate.on('pointerout', () => root.setScale(1));
        plate.on('pointerdown', () => {
          if (locked) return;
          locked = true;
          if (global.SR_AUDIO && global.SR_AUDIO.play) global.SR_AUDIO.play('evolve');
          const res = global.SR_STATE.finalizeTutorialPick
            ? global.SR_STATE.finalizeTutorialPick(state, champ.id)
            : { ok: false };
          if (!res.ok) {
            locked = false;
            if (UI.toast) UI.toast(this, res.error || 'Pick failed', false);
            return;
          }
          if (UI.toast) {
            UI.toast(this,
              (res.champion && res.champion.name) + ' is yours · Epic bond sealed!',
              true);
          }
          this.cameras.main.flash(280, 200, 160, 255);
          this.time.delayedCall(700, () => {
            this.scene.start('HubScene', { postTutorial: true });
          });
        });
      });
    }
  }

  global.TutorialPickScene = TutorialPickScene;
})(typeof window !== 'undefined' ? window : global);
