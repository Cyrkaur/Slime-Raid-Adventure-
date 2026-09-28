/* Shard summon / acquisition — painted summoning circle + reveal theater (Phase 9) */
(function (global) {
  'use strict';

  class SummonScene extends Phaser.Scene {
    constructor() {
      super({ key: 'SummonScene' });
    }

    create() {
      if (global.SR_UI && global.SR_UI.installCrispText) global.SR_UI.installCrispText(this);
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;

      // Live summon circle loop (portal glow / motes) or static art
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_summon_video', {
        wash: 0.1, washColor: 0x1a1030, fallbackImage: 'mode_summon'
      }))) {
        if (UI && UI.paintModeBg) {
          UI.paintModeBg(this, 'mode_summon', '#1a1030');
        } else {
          this.cameras.main.setBackgroundColor('#1a1030');
          if (this.textures.exists('mode_summon')) {
            this.add.image(w / 2, h / 2, 'mode_summon').setDisplaySize(w, h).setAlpha(1).setDepth(0);
          }
        }
      }

      // Summoning rings (animated on pull)
      this._ringGfx = this.add.graphics().setDepth(2);
      this._drawIdleRings(w / 2, h * 0.58);

      if (UI && UI.addBackButton) {
        UI.addBackButton(this, 70, 40, { label: '←  Village', scene: 'HubScene' });
      }

      if (UI && UI.addTitle) {
        UI.addTitle(this, 'Summoning Circle', 'Spend shards · call gel champions from the soft void');
      } else {
        this.add.text(w / 2, 36, 'Summoning Circle', {
          fontFamily: 'Georgia, serif', fontSize: '28px', color: '#e8d4ff',
          stroke: '#1a0830', strokeThickness: 4
        }).setOrigin(0.5).setDepth(40);
      }

      if (UI && UI.addCurrencyStrip) UI.addCurrencyStrip(this, state, 40);

      // Shard readout — ink plate (gold stroke shared with village language)
      if (UI && UI.addInkPanel) {
        UI.addInkPanel(this, w / 2, 118, 540, 44, {
          depth: 20, stroke: 0xc9a44a, alpha: 0.92
        });
      } else {
        this.add.rectangle(w / 2, 118, 540, 44, 0x0a0e12, 0.9)
          .setStrokeStyle(2, 0xc9a44a, 0.9).setDepth(20);
      }
      this.resText = this.add.text(w / 2, 118, '', {
        fontFamily: 'system-ui', fontSize: '16px', color: '#ffe8a0', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 3
      }).setOrigin(0.5).setDepth(21);
      this.pityText = this.add.text(w / 2, 148, '', {
        fontFamily: 'system-ui', fontSize: '12px', color: '#c8b8e0',
        stroke: '#041208', strokeThickness: 3
      }).setOrigin(0.5).setDepth(21);
      this._refreshRes();

      // Banner cards — costs from published SUMMON_COSTS
      this._busy = false;
      const costSub = (type, n) => {
        const spec = (global.SR_DATA && global.SR_DATA.SUMMON_COSTS && global.SR_DATA.SUMMON_COSTS[type]) || {};
        const amt = n === 10 ? spec.ten : spec.one;
        const names = { slimeShards: 'slime shards', divineShards: 'divine shards', voidShards: 'void shards' };
        return amt + ' ' + (names[spec.currency] || spec.currency || 'shards');
      };
      const banners = [
        { x: w / 2 - 250, y: 220, label: '💎  Regular ×1', sub: costSub('regular', 1), type: 'regular', count: 1, stroke: 0xb39ddb },
        { x: w / 2 + 250, y: 220, label: '💎  Regular ×10', sub: costSub('regular', 10), type: 'regular', count: 10, stroke: 0xb39ddb },
        { x: w / 2 - 250, y: 288, label: '✨  Premium ×1', sub: costSub('premium', 1), type: 'premium', count: 1, stroke: 0xffd080 },
        { x: w / 2 + 250, y: 288, label: '✨  Premium ×10', sub: costSub('premium', 10), type: 'premium', count: 10, stroke: 0xffd080 },
        { x: w / 2 - 250, y: 356, label: '🖤  Ancient ×1', sub: costSub('ancient', 1), type: 'ancient', count: 1, stroke: 0x8866aa },
        { x: w / 2 + 250, y: 356, label: '🖤  Ancient ×10', sub: costSub('ancient', 10), type: 'ancient', count: 10, stroke: 0x8866aa }
      ];

      this.add.text(w / 2, 178, 'Choose a banner', {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffe8a0', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 3
      }).setOrigin(0.5).setDepth(20);

      banners.forEach((b) => {
        if (UI && UI.addListRow) {
          UI.addListRow(this, b.x, b.y, 460, 54, {
            title: b.label,
            sub: b.sub,
            right: 'Pull ›',
            stroke: b.stroke,
            fill: 0x0c1016,
            depth: 25,
            onClick: () => {
              if (!this._busy) this._pull(b.type, b.count);
            }
          });
        } else if (UI && UI.addButton) {
          UI.addButton(this, b.x, b.y, 440, 50, b.label + '  ·  ' + b.sub, 0x1a1820, () => {
            if (!this._busy) this._pull(b.type, b.count);
          }, 25);
        } else {
          const bg = this.add.rectangle(b.x, b.y, 440, 52, 0x0c1016, 0.94)
            .setStrokeStyle(2, b.stroke).setInteractive({ useHandCursor: true }).setDepth(25);
          this.add.text(b.x, b.y, b.label, {
            fontFamily: 'system-ui', fontSize: '15px', color: '#f8f0ff', fontStyle: 'bold'
          }).setOrigin(0.5).setDepth(26);
          bg.on('pointerdown', () => { if (!this._busy) this._pull(b.type, b.count); });
        }
      });

      // Result plate over the painted circle
      const resultY = h * 0.62;
      if (UI && UI.addInkPanel) {
        UI.addInkPanel(this, w / 2, resultY + 20, Math.min(900, w - 80), 220, {
          depth: 15, stroke: 0xc9a44a, alpha: 0.72
        });
      } else {
        this.add.rectangle(w / 2, resultY + 20, Math.min(900, w - 80), 220, 0x0a0e12, 0.7)
          .setStrokeStyle(2, 0xc9a44a, 0.55).setDepth(15);
      }

      this.resultText = this.add.text(w / 2, resultY - 60, 'The circle waits · pull champions with shards', {
        fontFamily: 'system-ui', fontSize: '16px', color: '#e8e0d0', align: 'center',
        wordWrap: { width: w - 120 }
      }).setOrigin(0.5).setDepth(22);

      this.resultIcons = [];
      this._fxNodes = [];
      this._resultY = resultY + 30;
      this._circleX = w / 2;
      this._circleY = h * 0.58;
    }

    _drawIdleRings(cx, cy) {
      if (!this._ringGfx) return;
      this._ringGfx.clear();
      const r = Math.min(this.cameras.main.width, this.cameras.main.height);
      this._ringGfx.lineStyle(2, 0xb39ddb, 0.4);
      this._ringGfx.strokeCircle(cx, cy, r * 0.18);
      this._ringGfx.lineStyle(1, 0x88eeff, 0.25);
      this._ringGfx.strokeCircle(cx, cy, r * 0.14);
    }

    _refreshRes() {
      const state = global.SR_GAME_STATE || {};
      const r = state.resources || {};
      this.resText.setText(
        '💎  ' + Math.floor(r.slimeShards || 0) +
        '     ✨  ' + Math.floor(r.divineShards || 0) +
        '     🖤  ' + Math.floor(r.voidShards || 0)
      );
      if (this.pityText) {
        const pity = (global.SR_DATA && global.SR_DATA.SUMMON_PITY) || {};
        const sm = state.summon || {};
        const line = (type, label) => {
          const spec = pity[type] || {};
          const key = spec.counter || ('pity' + type.charAt(0).toUpperCase() + type.slice(1));
          const cur = sm[key] || 0;
          const bound = spec.bound || 0;
          return label + ' ' + cur + '/' + bound;
        };
        this.pityText.setText(
          'Pity  ·  ' + line('regular', 'Regular') +
          '   ' + line('premium', 'Premium') +
          '   ' + line('ancient', 'Ancient')
        );
      }
    }

    _clearFx() {
      (this._fxNodes || []).forEach((n) => {
        try { n.destroy(); } catch (e) { /* ignore */ }
      });
      this._fxNodes = [];
    }

    _rarityNum(rarity) {
      if (global.SR_UI && global.SR_UI.rarityColor) return global.SR_UI.rarityColor(rarity);
      const map = {
        Common: 0x9ca3af, Uncommon: 0x4ade80, Rare: 0x60a5fa,
        Epic: 0xc084fc, Legendary: 0xfbbf24, Mythic: 0xff66aa
      };
      return map[rarity] || 0x9ca3af;
    }

    _rarityRank(rarity) {
      const order = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
      const i = order.indexOf(rarity || 'Common');
      return i < 0 ? 0 : i;
    }

    /** Expanding ring burst at (x,y) */
    _burstRing(x, y, color, scale, dur) {
      const ring = this.add.circle(x, y, 10, color, 0)
        .setStrokeStyle(3, color, 0.95)
        .setDepth(48)
        .setScale(0.3);
      this._fxNodes.push(ring);
      this.tweens.add({
        targets: ring,
        scale: scale || 4,
        alpha: 0,
        duration: dur || 480,
        ease: 'Cubic.easeOut',
        onComplete: () => { try { ring.destroy(); } catch (e) { /* ignore */ } }
      });
    }

    /** Soft sparkle particles */
    _sparkles(x, y, color, count) {
      for (let i = 0; i < (count || 8); i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const dist = 40 + Math.random() * 50;
        const p = this.add.circle(x, y, 3 + Math.random() * 3, color, 0.95).setDepth(52);
        this._fxNodes.push(p);
        this.tweens.add({
          targets: p,
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist - 20,
          alpha: 0,
          scale: 0.2,
          duration: 350 + Math.random() * 200,
          ease: 'Cubic.easeOut',
          onComplete: () => { try { p.destroy(); } catch (e) { /* ignore */ } }
        });
      }
    }

    /** R7 — light pillar + circle pulse before results land */
    _playCirclePulse(bestRarity, onDone) {
      const cx = this._circleX;
      const cy = this._circleY;
      const col = this._rarityNum(bestRarity);
      const rank = this._rarityRank(bestRarity);
      const h = this.cameras.main.height;

      // Rising light pillar (summon capsule feel)
      const pillar = this.add.rectangle(cx, cy, 36, 20, col, 0.55)
        .setDepth(46);
      this._fxNodes.push(pillar);
      this.tweens.add({
        targets: pillar,
        displayHeight: h * 0.55,
        displayWidth: 70 + rank * 8,
        y: cy - h * 0.08,
        alpha: 0.15,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => { try { pillar.destroy(); } catch (e) { /* ignore */ } }
      });
      // Capsule oval
      const cap = this.add.ellipse(cx, cy - 20, 48, 70, 0xffffff, 0.35).setDepth(47);
      this._fxNodes.push(cap);
      this.tweens.add({
        targets: cap, scaleX: 2.4, scaleY: 2.8, alpha: 0, duration: 480,
        onComplete: () => { try { cap.destroy(); } catch (e) { /* ignore */ } }
      });

      this._burstRing(cx, cy, 0xb39ddb, 3.2, 400);
      this.time.delayedCall(80, () => this._burstRing(cx, cy, col, 4.5, 500));
      if (rank >= 3) {
        this.time.delayedCall(140, () => this._burstRing(cx, cy, 0xffeeaa, 5.5, 600));
        this.cameras.main.shake(120, 0.004);
      }
      if (rank >= 4) {
        this.cameras.main.flash(180, 255, 240, 180);
      }

      const flash = this.add.rectangle(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
        this.cameras.main.width,
        this.cameras.main.height,
        col,
        0.2
      ).setDepth(45);
      this._fxNodes.push(flash);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 300,
        onComplete: () => { try { flash.destroy(); } catch (e) { /* ignore */ } }
      });

      this.time.delayedCall(280, () => { if (onDone) onDone(); });
    }

    /** R7 — staggered reveal with 3D gel preference + name tags */
    _revealResults(results) {
      const w = this.cameras.main.width;
      const n = Math.min(results.length, 10);
      const y = this._resultY || 480;
      const spacing = n > 6 ? 86 : 96;
      const UI = global.SR_UI;

      let best = results[0];
      results.forEach((c) => {
        if (this._rarityRank(c.rarity) > this._rarityRank(best && best.rarity)) best = c;
      });

      results.slice(0, 10).forEach((c, i) => {
        const x = w / 2 - (n - 1) * (spacing / 2) + i * spacing;
        const delay = 100 + i * 120;
        const col = this._rarityNum(c.rarity || 'Common');
        const rank = this._rarityRank(c.rarity);

        this.time.delayedCall(delay, () => {
          if (!this.sys || !this.sys.isActive()) return;

          // Soft pedestal under each pull
          const ped = this.add.ellipse(x, y + 28, 52, 16, col, 0.25).setDepth(48);
          this.resultIcons.push(ped);

          let spr;
          if (UI && UI.addSlimePortrait) {
            // Prefer live 3D gel look on reveal (falls back inside addSlimePortrait)
            spr = UI.addSlimePortrait(this, x, y, rank >= 3 ? 84 : 76, c.element, 55, {
              mode: 'badge',
              rarity: c.rarity || 'Common',
              champ: c,
              artVariant: c.artVariant,
              ring: rank >= 2,
              bob: true
            });
          } else {
            const key = 'slime_' + String(c.element || 'water').toLowerCase();
            spr = this.textures.exists(key)
              ? this.add.image(x, y, key).setDisplaySize(64, 64).setDepth(50)
              : this.add.circle(x, y, 28, 0x7e57c2).setDepth(50);
          }

          if (spr && spr.setScale) {
            spr.setScale(0.12);
            spr.setAlpha(0);
            this.tweens.add({
              targets: spr,
              scale: 1,
              alpha: 1,
              duration: 360,
              ease: 'Back.easeOut'
            });
          } else if (spr && spr.setAlpha) {
            spr.setAlpha(0);
            this.tweens.add({ targets: spr, alpha: 1, duration: 280 });
          }

          this.resultIcons.push(spr);

          this._burstRing(x, y, col, rank >= 3 ? 3.4 : 2.3, 440);
          this._sparkles(x, y, col, rank >= 4 ? 16 : (rank >= 2 ? 11 : 7));

          const rarHex = (UI && UI.rarityHex && UI.rarityHex(c.rarity)) || '#e8d4ff';
          const tag = this.add.text(x, y + 50, (c.rarity || 'Common'), {
            fontFamily: 'system-ui', fontSize: rank >= 3 ? '13px' : '11px',
            color: rarHex, fontStyle: 'bold',
            stroke: '#0a0618', strokeThickness: 3
          }).setOrigin(0.5).setDepth(56).setAlpha(0);
          const nm = this.add.text(x, y + 66, String(c.name || 'Gel').split(' ')[0], {
            fontFamily: 'system-ui', fontSize: '11px', color: '#d8c8f0',
            stroke: '#0a0618', strokeThickness: 3
          }).setOrigin(0.5).setDepth(56).setAlpha(0);
          this.resultIcons.push(tag, nm);
          this.tweens.add({
            targets: [tag, nm],
            alpha: 1,
            duration: 280,
            ease: 'Cubic.easeOut'
          });

          if (rank >= 3) {
            const glow = this.add.circle(x, y, 40, col, 0.4).setDepth(49);
            this._fxNodes.push(glow);
            this.tweens.add({
              targets: glow,
              scale: 2.4,
              alpha: 0,
              duration: 520,
              onComplete: () => { try { glow.destroy(); } catch (e) { /* ignore */ } }
            });
          }
        });
      });

      this.time.delayedCall(140 + Math.min(n, 5) * 120, () => {
        if (!this.sys || !this.sys.isActive()) return;
        const bestLine = best
          ? ('★ Best · ' + (best.rarity || '') + ' ' + (best.name || 'Gel'))
          : '';
        const names = results.map((c) => (c.rarity || '') + ' ' + (c.name || 'Gel')).join('  ·  ');
        this.resultText.setColor('#f0e8ff');
        this.resultText.setText(
          '✦ Summoned ' + results.length + ' champions!\n' +
          (bestLine ? bestLine + '\n' : '') +
          names
        );
      });

      const totalMs = 280 + n * 120 + 450;
      this.time.delayedCall(totalMs, () => {
        this._busy = false;
      });
    }

    _pull(type, count) {
      if (this._busy) return;
      const state = global.SR_GAME_STATE;
      const res = global.SR_STATE.performSummon(state, type, count);
      this._refreshRes();

      this.resultIcons.forEach((o) => {
        try { o.destroy(); } catch (e) { /* ignore */ }
      });
      this.resultIcons = [];
      this._clearFx();

      if (!res.ok) {
        this.resultText.setText(res.error || 'Cannot summon');
        this.resultText.setColor('#ff8888');
        return;
      }

      this._busy = true;
      this.resultText.setColor('#e8d4ff');
      this.resultText.setText('The circle answers…');
      if (global.SR_AUDIO && global.SR_AUDIO.play) global.SR_AUDIO.play('summon');

      let bestR = 'Common';
      (res.results || []).forEach((c) => {
        if (this._rarityRank(c.rarity) > this._rarityRank(bestR)) bestR = c.rarity || 'Common';
      });

      this._playCirclePulse(bestR, () => {
        this._revealResults(res.results || []);
      });
    }
  }

  global.SummonScene = SummonScene;
})(typeof window !== 'undefined' ? window : global);
