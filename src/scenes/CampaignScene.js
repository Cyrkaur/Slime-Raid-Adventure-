/* Campaign — Raid-style: pick chapter → stage map with location nodes */
(function (global) {
  'use strict';

  class CampaignScene extends Phaser.Scene {
    constructor() {
      super({ key: 'CampaignScene' });
    }

    init(data) {
      this._openRegion = (data && (data.region || data.chapter)) || null;
      this._selectedStageId = (data && data.stageId) || null;
    }

    create() {
      if (global.SR_UI && global.SR_UI.installCrispText) global.SR_UI.installCrispText(this);
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      this.state = state;
      this.DATA = global.SR_DATA || {};
      this.UI = global.SR_UI;
      this.W = w;
      this.H = h;

      // Gate: Raid tutorial must finish (Epic pick) before campaign trails
      if (!(state.flags && state.flags.tutorialPickDone) && !state.tutorialSeen) {
        if (this.UI && this.UI.toast) {
          this.UI.toast(this, 'Complete the soft trial first', false);
        }
        this.scene.start('HubScene');
        return;
      }
      if (!(state.roster || []).length) {
        if (this.UI && this.UI.toast) {
          this.UI.toast(this, 'Bond a gel before campaign', false);
        }
        this.scene.start('HubScene');
        return;
      }

      if (this._openRegion) {
        this.showChapterMap(this._openRegion);
      } else {
        this.showChapterSelect();
      }
    }

    _paintBg(color, artKey) {
      // Live campaign map loop (subtle dust / candle) when available
      if (global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_campaign_video', {
        wash: 0.14,
        washColor: 0x0c1e16,
        fallbackImage: artKey || 'mode_campaign'
      })) {
        return;
      }
      if (this.UI && this.UI.paintModeBg) {
        this.UI.paintModeBg(this, artKey || 'mode_campaign', color || '#0c1e16');
      } else {
        this.cameras.main.setBackgroundColor(color || '#0c1e16');
      }
    }

    _title(text, y) {
      return this.add.text(this.W / 2, y || 36, text, {
        fontFamily: 'Georgia, serif', fontSize: '28px', color: '#e8ffd4',
        stroke: '#0a2010', strokeThickness: 4
      }).setOrigin(0.5).setDepth(40);
    }

    _back(label, onClick) {
      if (this.UI && this.UI.addBackButton) {
        let text = label || '←  Village';
        if (text === '← Hub' || text === 'Hub') text = '←  Village';
        this.UI.addBackButton(this, 70, 40, { label: text, onClick: onClick });
        return;
      }
      const back = this.add.rectangle(70, 40, 100, 36, 0x3a1810, 0.92)
        .setStrokeStyle(2, 0xddaa66)
        .setInteractive({ useHandCursor: true })
        .setDepth(50);
      this.add.text(70, 40, label || '← Back', {
        fontFamily: 'system-ui', fontSize: '14px', color: '#ffe8c8', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(51);
      back.on('pointerdown', onClick);
    }

    // ─────────────────────────────────────────────
    // VIEW 1 — Softened Realms chapter journey (orbs on a soft path)
    // ─────────────────────────────────────────────
    showChapterSelect() {
      const w = this.W;
      const h = this.H;
      const regions = this.DATA.CAMPAIGN_REGIONS || [];
      const stages = this.DATA.CAMPAIGN_STAGES || [];
      const state = this.state;
      const UI = this.UI;

      // Keep live campaign video
      this._paintBg('#0a0e12', 'mode_campaign');
      if (UI && UI.addTitle) {
        UI.addTitle(this, 'Softened Realms', 'Walk the soft path · ten chapters against hard geometry');
      } else {
        this._title('Softened Realms', 40);
      }
      this._back('←  Village', () => {
        if (global.SR_TRANSIT && global.SR_TRANSIT.go) global.SR_TRANSIT.go(this, 'HubScene');
        else this.scene.start('HubScene');
      });

      // 2×5 circular medallions on an S-path (not square cards)
      const n = regions.length || 1;
      const cols = 5;
      const R = Math.min(70, Math.floor((w - 140) / cols / 2 - 6));
      const gapX = Math.min(40, Math.max(16, (w - 100 - cols * R * 2) / Math.max(1, cols - 1)));
      const rowGap = Math.min(210, Math.max(170, h * 0.22));
      const totalW = cols * (R * 2) + (cols - 1) * gapX;
      const startX = (w - totalW) / 2 + R;
      const row1Y = h * 0.36;
      const row2Y = row1Y + rowGap;

      const nodeOf = (i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        // Second row runs right→left for an S-journey
        const c = row === 0 ? col : (cols - 1 - col);
        return {
          x: startX + c * (R * 2 + gapX),
          y: row === 0 ? row1Y : row2Y,
          row: row
        };
      };

      // First-hour: nudge toward Greenwild (first chapter)
      this._maybeCampaignChapterCoach(regions, nodeOf);

      // Soft path ribbon under orbs
      const pathG = this.add.graphics().setDepth(8);
      for (let i = 0; i < n - 1; i++) {
        const a = nodeOf(i);
        const b = nodeOf(i + 1);
        const regNext = regions[i + 1];
        const fs = regNext && stages.find((s) => s.region === regNext.id);
        const unlockedNext = fs ? global.SR_STATE.stageUnlocked(state, fs) : false;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 + (a.row === b.row ? ((i % 2) ? 26 : -26) : 0);
        pathG.lineStyle(14, 0xc9a44a, unlockedNext ? 0.1 : 0.05);
        pathG.beginPath(); pathG.moveTo(a.x, a.y); pathG.lineTo(mx, my); pathG.lineTo(b.x, b.y); pathG.strokePath();
        pathG.lineStyle(3, unlockedNext ? 0xc9a44a : 0x3a4048, unlockedNext ? 0.4 : 0.15);
        pathG.beginPath(); pathG.moveTo(a.x, a.y); pathG.lineTo(mx, my); pathG.lineTo(b.x, b.y); pathG.strokePath();
      }

      // Clean focus line at bottom (hover/tap updates text — no busy panel)
      const focusY = h - 72;
      const focusTitle = this.add.text(w / 2, focusY - 16, 'Hover a chapter · tap to open its map', {
        fontFamily: 'Georgia, serif', fontSize: '18px', color: '#e8dcc0',
        stroke: '#000', strokeThickness: 4
      }).setOrigin(0.5).setDepth(50);
      const focusBody = this.add.text(w / 2, focusY + 12, '', {
        fontFamily: 'system-ui', fontSize: '13px', color: '#9aa89a',
        align: 'center', wordWrap: { width: w - 140 },
        stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(50);

      let selectedId = null;
      const setFocus = (reg, meta) => {
        selectedId = reg.id;
        const ch = reg.chapter || ('Chapter ' + (reg.chapterNum || ''));
        focusTitle.setText(ch + '  ·  ' + reg.name);
        if (!meta.open) {
          focusBody.setText('Locked — clear the previous chapter boss to open this soft path.');
        } else {
          const short = (reg.blurb || '').length > 140 ? (reg.blurb || '').slice(0, 137) + '…' : (reg.blurb || '');
          focusBody.setText(
            short + '  ·  ' + meta.cleared + '/' + meta.total + ' locations' +
            (meta.bossDown ? '  ·  Boss clear' : '  ·  Boss waits at the last pin')
          );
        }
      };

      regions.forEach((reg, i) => {
        const pos = nodeOf(i);
        const x = pos.x;
        const y = pos.y;
        const regStages = stages.filter((s) => s.region === reg.id);
        const cleared = regStages.filter((s) => {
          const p = state.campaign.progress[s.id];
          return p && p.stars >= 1;
        }).length;
        const first = regStages[0];
        const chapterOpen = first ? global.SR_STATE.stageUnlocked(state, first) : false;
        const boss = regStages.find((s) => s.boss);
        const bossDown = !!(boss && state.campaign.progress[boss.id] && state.campaign.progress[boss.id].stars >= 1);
        const accent = reg.accent || 0xc9a44a;
        const meta = { open: chapterOpen, cleared: cleared, total: regStages.length, bossDown: bossDown };
        const isFrontier = chapterOpen && cleared < regStages.length;

        const root = this.add.container(x, y).setDepth(20);
        root.add(this.add.ellipse(0, R * 0.88, R * 1.75, R * 0.42, 0x000000, chapterOpen ? 0.42 : 0.2));

        if (isFrontier) {
          const glow = this.add.circle(0, 0, R + 14, accent, 0.18);
          root.add(glow);
          if (this.tweens) {
            this.tweens.add({
              targets: glow, scaleX: 1.14, scaleY: 1.14, alpha: 0.07,
              duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
          }
        }

        const ring = this.add.circle(0, 0, R, 0x0a0e12, chapterOpen ? 0.94 : 0.55)
          .setStrokeStyle(4, chapterOpen ? accent : 0x3a4048, chapterOpen ? 0.95 : 0.4);
        root.add(ring);
        root.add(this.add.circle(0, 0, R - 5, 0x000000, 0)
          .setStrokeStyle(1.5, chapterOpen ? 0xe8d5a0 : 0x2a3030, chapterOpen ? 0.35 : 0.18));

        // Circular map portrait (soft wash so video still peeks around)
        const mapKey = reg.mapKey || ('map_' + reg.id);
        if (chapterOpen && this.textures.exists(mapKey)) {
          const img = this.add.image(0, 0, mapKey).setDisplaySize(R * 1.92, R * 1.92).setAlpha(0.88);
          const maskG = this.make.graphics({ x: 0, y: 0, add: false });
          maskG.fillStyle(0xffffff);
          maskG.fillCircle(x, y, R - 7);
          img.setMask(maskG.createGeometryMask());
          root.add(img);
          root.add(this.add.circle(0, 0, R - 7, 0x000000, 0.32));
        } else {
          root.add(this.add.circle(0, 0, R - 7, chapterOpen ? (reg.color || 0x1a2430) : 0x12151a, chapterOpen ? 0.5 : 0.35));
        }

        const roman = (reg.chapter || '').split('—')[0].trim() || String(reg.chapterNum || (i + 1));
        root.add(this.add.text(0, -8, roman, {
          fontFamily: 'Georgia, serif', fontSize: Math.max(18, Math.floor(R * 0.4)) + 'px',
          color: chapterOpen ? '#f4ffe8' : '#555',
          stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5));

        if (chapterOpen && regStages.length) {
          root.add(this.add.text(0, R * 0.3, Math.round((cleared / regStages.length) * 100) + '%', {
            fontFamily: 'system-ui', fontSize: '11px', color: '#c9a44a',
            stroke: '#000', strokeThickness: 3
          }).setOrigin(0.5));
        } else if (!chapterOpen) {
          root.add(this.add.text(0, R * 0.24, '🔒', { fontFamily: 'system-ui', fontSize: '15px' }).setOrigin(0.5));
        }

        root.add(this.add.text(0, R + 16, reg.name, {
          fontFamily: 'Georgia, serif', fontSize: '13px',
          color: chapterOpen ? '#e8e0d0' : '#555',
          align: 'center', wordWrap: { width: R * 2.7 },
          stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5, 0));

        const hit = this.add.circle(0, 0, R + 10, 0xffffff, 0.001);
        root.add(hit);
        hit.setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => {
          if (chapterOpen) root.setScale(1.1);
          setFocus(reg, meta);
        });
        hit.on('pointerout', () => {
          if (selectedId !== reg.id) root.setScale(1);
          else if (chapterOpen) root.setScale(1.06);
        });
        if (chapterOpen) {
          hit.on('pointerdown', () => this.scene.restart({ region: reg.id }));
        }

        if (!selectedId && isFrontier) {
          setFocus(reg, meta);
          root.setScale(1.06);
        }
      });

      if (!selectedId && regions[0]) {
        const r0 = regions[0];
        const rs = stages.filter((s) => s.region === r0.id);
        const cl = rs.filter((s) => (state.campaign.progress[s.id] || {}).stars >= 1).length;
        const fo = rs[0] ? global.SR_STATE.stageUnlocked(state, rs[0]) : false;
        setFocus(r0, { open: fo, cleared: cl, total: rs.length, bossDown: false });
      }
    }

    /** First-hour: tip + pulse on first chapter orb */
    _maybeCampaignChapterCoach(regions, nodeOf) {
      const TUT = global.SR_TUTORIAL;
      if (!TUT || !TUT.needsCampaignNudge(this.state)) return;
      const first = regions[0];
      if (!first) return;
      const pos = nodeOf(0);
      if (TUT.pulseAt) TUT.pulseAt(this, pos.x, pos.y, { radius: 42, depth: 45 });
      // One tip per open (don't spam if returning mid-tutorial)
      if (this.state.flags && this.state.flags.campaignChapterTipShown) return;
      if (!this.state.flags) this.state.flags = {};
      this.state.flags.campaignChapterTipShown = true;
      if (global.SR_STATE && global.SR_STATE.saveState) global.SR_STATE.saveState(this.state);
      TUT.showTip(this, {
        title: 'First soft path',
        body: 'Tap ' + (first.name || 'Greenwild Forest') +
          ' — then choose Whispering Glade for your first fight. Win spoils wait at the end.',
        primaryLabel: 'Understood',
        y: this.H * 0.22,
        height: 170
      });
    }

    /** First-hour: tip + pulse first unlocked stage pin */
    _maybeCampaignStageCoach(regStages, nodePos) {
      const TUT = global.SR_TUTORIAL;
      if (!TUT || !TUT.needsCampaignNudge(this.state)) return;
      const first = regStages.find((s) => global.SR_STATE.stageUnlocked(this.state, s));
      if (!first) return;
      const idx = regStages.indexOf(first);
      const pos = nodePos(first, idx);
      if (TUT.pulseAt) TUT.pulseAt(this, pos.x, pos.y, { radius: 36, depth: 45 });
      if (this.state.flags && this.state.flags.campaignStageTipShown) return;
      if (!this.state.flags) this.state.flags = {};
      this.state.flags.campaignStageTipShown = true;
      if (global.SR_STATE && global.SR_STATE.saveState) global.SR_STATE.saveState(this.state);
      TUT.showTip(this, {
        title: first.name || 'First location',
        body: 'Select this pin, then press Battle. Arrange your party on the next screen, then fight with skills — or Auto.',
        primaryLabel: 'Let\'s go',
        y: this.H * 0.2,
        height: 170
      });
    }

    /**
     * Hand-painted chapter map image (full-screen), same art language as campaign.jpg.
     * Location pings sit on top. Soft vignette keeps UI readable.
     */
    drawChapterMapArt(reg) {
      const w = this.W;
      const h = this.H;
      const mapKey = reg.mapKey || ('map_' + (reg.id || 'greenwild'));
      const fallback = 'mode_campaign';

      this.cameras.main.setBackgroundColor(reg.mapBg || 0x0c1e16);

      let key = null;
      if (this.textures.exists(mapKey)) key = mapKey;
      else if (this.textures.exists(fallback)) key = fallback;

      if (key) {
        const img = this.add.image(w / 2, h / 2, key).setDepth(2);
        const scale = Math.max(w / img.width, h / img.height);
        img.setScale(scale);
        img.setAlpha(1);
      }
      // Full-bright map — no dimming wash; title/detail panels carry their own contrast
    }

    // ─────────────────────────────────────────────
    // VIEW 2 — Chapter stage journey (medallions on soft path over map art)
    // ─────────────────────────────────────────────
    showChapterMap(regionId) {
      const w = this.W;
      const h = this.H;
      const state = this.state;
      const regions = this.DATA.CAMPAIGN_REGIONS || [];
      const stages = this.DATA.CAMPAIGN_STAGES || [];
      const reg = regions.find((r) => r.id === regionId) || regions[0];
      if (!reg) {
        this.showChapterSelect();
        return;
      }

      const regStages = stages.filter((s) => s.region === reg.id)
        .sort((a, b) => (a.index || 0) - (b.index || 0));
      const n = regStages.length || 1;
      const accent = reg.accent || 0xc9a44a;

      // Painted chapter map stays the star
      this.drawChapterMapArt(reg);
      // Soft top/bottom vignette so UI reads without a busy box
      const vig = this.add.graphics().setDepth(5);
      vig.fillStyle(0x000000, 0.35);
      vig.fillRect(0, 0, w, 100);
      vig.fillStyle(0x000000, 0.45);
      vig.fillRect(0, h - 130, w, 130);

      if (this.UI && this.UI.addTitle) {
        this.UI.addTitle(this, reg.name, (reg.chapter || 'Chapter') + '  ·  Softened Realms');
      } else {
        this._title(reg.chapter + '  ·  ' + reg.name, 34);
      }
      this._back('←  Chapters', () => this.scene.restart({}));

      // Layout: soft path of circular location medallions
      // Prefer author mapX/mapY when present; else distribute along a gentle arc
      const mapX = w / 2;
      const mapY = h * 0.48;
      const mapW = Math.min(w - 120, 1480);
      const mapH = Math.min(h - 220, 620);

      const nodePos = (st, idx) => {
        if (st.mapX != null && st.mapY != null) {
          return {
            x: mapX - mapW / 2 + 50 + st.mapX * (mapW - 100),
            y: mapY - mapH / 2 + 40 + st.mapY * (mapH - 80)
          };
        }
        // Fallback arc: left→right with soft vertical wave
        const t = n <= 1 ? 0.5 : idx / (n - 1);
        return {
          x: mapX - mapW / 2 + 60 + t * (mapW - 120),
          y: mapY + Math.sin(t * Math.PI * 1.15 + 0.2) * (mapH * 0.22)
        };
      };

      // Soft path ribbon
      const pathG = this.add.graphics().setDepth(8);
      for (let i = 0; i < n - 1; i++) {
        const a = nodePos(regStages[i], i);
        const b = nodePos(regStages[i + 1], i + 1);
        const unlockedNext = global.SR_STATE.stageUnlocked(state, regStages[i + 1]);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 + ((i % 2 === 0) ? -22 : 22);
        pathG.lineStyle(12, accent, unlockedNext ? 0.12 : 0.05);
        pathG.beginPath(); pathG.moveTo(a.x, a.y); pathG.lineTo(mx, my); pathG.lineTo(b.x, b.y); pathG.strokePath();
        pathG.lineStyle(3, unlockedNext ? accent : 0x3a4048, unlockedNext ? 0.5 : 0.18);
        pathG.beginPath(); pathG.moveTo(a.x, a.y); pathG.lineTo(mx, my); pathG.lineTo(b.x, b.y); pathG.strokePath();
      }

      // Clean bottom focus — updates only on click selection (not hover)
      const focusY = h - 58;
      const focusTitle = this.add.text(w / 2, focusY - 28, 'Tap a location to select it', {
        fontFamily: 'Georgia, serif', fontSize: '20px', color: '#f0e8d4',
        stroke: '#000', strokeThickness: 5
      }).setOrigin(0.5).setDepth(55);
      const focusBody = this.add.text(w / 2, focusY + 2, 'Selected pin glows gold · Battle uses that location only', {
        fontFamily: 'system-ui', fontSize: '13px', color: '#b0b8a8',
        align: 'center', wordWrap: { width: Math.min(720, w - 280) },
        stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(55);

      // Simple battle CTA — flat, quiet
      let ctaHandler = null;
      const cta = this.add.rectangle(w / 2, h - 28, 200, 40, 0x12161c, 0.95)
        .setStrokeStyle(1.5, accent, 0.85)
        .setDepth(56)
        .setInteractive({ useHandCursor: true });
      const ctaLab = this.add.text(w / 2, h - 28, 'Battle', {
        fontFamily: 'system-ui', fontSize: '15px', color: '#f0ffe8', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(57);
      // First-hour stage pin coach (after pins laid out below — call deferred)
      this.time.delayedCall(80, () => {
        this._maybeCampaignStageCoach(regStages, nodePos);
      });

      cta.on('pointerover', () => {
        if (cta.input && cta.input.enabled) {
          cta.setFillStyle(0x1a2030, 1);
          cta.setStrokeStyle(2, 0xe8d5a0, 1);
        }
      });
      cta.on('pointerout', () => {
        cta.setFillStyle(0x12161c, 0.95);
        cta.setStrokeStyle(1.5, accent, 0.85);
      });
      cta.on('pointerdown', () => { if (ctaHandler) ctaHandler(); });

      const startBattle = (st) => {
        if (!st || !global.SR_STATE.stageUnlocked(state, st)) return;
        const payload = {
          stage: st,
          region: st.region,
          zone: st.region,
          arena: st.region,
          returnRegion: reg.id,
          returnScene: 'CampaignScene',
          returnData: { region: reg.id }
        };
        if (typeof global.SR_startPreBattle === 'function') {
          global.SR_startPreBattle(this, payload);
        } else {
          this.scene.start('BattleScene', payload);
        }
      };

      // Selection is click-only (hover never changes battle target)
      let selected = null;
      const nodeMeta = {}; // id → { root, ring, selRing, nameLab, baseStroke, R, unlocked, ... }

      const paintSelection = () => {
        Object.keys(nodeMeta).forEach((id) => {
          const m = nodeMeta[id];
          if (!m) return;
          const isSel = selected && selected.id === id;
          // Scale: selected always larger; hover only slightly if not selected
          if (isSel) m.root.setScale(1.18);
          else if (!m.hovered) m.root.setScale(1);

          if (m.ring && m.ring.setStrokeStyle) {
            if (isSel) {
              m.ring.setStrokeStyle(m.isBoss ? 5 : 4.5, 0xffe8a0, 1);
            } else {
              m.ring.setStrokeStyle(m.isBoss ? 4 : 3, m.baseStroke, m.unlocked ? 0.95 : 0.4);
            }
          }
          if (m.selRing) {
            m.selRing.setVisible(!!isSel);
            m.selRing.setAlpha(isSel ? 0.95 : 0);
          }
          if (m.selGlow) {
            m.selGlow.setVisible(!!isSel);
          }
          if (m.nameLab) {
            m.nameLab.setColor(isSel ? '#ffe8a0' : (m.unlocked ? '#e8e0d0' : '#555'));
            if (m.nameLab.setFontStyle) m.nameLab.setFontStyle(isSel ? 'bold' : 'normal');
          }
          if (m.selBadge) {
            m.selBadge.setVisible(!!isSel);
          }
          // Selected pins sit above neighbors
          m.root.setDepth(isSel ? 20 : 12);
        });
      };

      const setSelection = (st) => {
        if (!st) return;
        selected = st;
        this._selectedStageId = st.id;
        paintSelection();

        const unlocked = global.SR_STATE.stageUnlocked(state, st);
        const prog = (state.campaign.progress && state.campaign.progress[st.id]) || { stars: 0 };
        const stars = '★'.repeat(prog.stars || 0) + '☆'.repeat(3 - (prog.stars || 0));
        let lore = (this.DATA.getStageLore && this.DATA.getStageLore(st)) || st.blurb || st.lore || '';
        if (lore.length > 110) lore = lore.slice(0, 107) + '…';
        focusTitle.setText((st.boss ? '👑  ' : '') + st.name + (unlocked ? '' : '  ·  Locked'));
        focusBody.setText(
          (unlocked ? 'Selected  ·  ' : 'Locked  ·  ') +
          (st.boss ? 'Chapter boss  ·  ' : 'Location ' + (st.index || '?') + '/' + n + '  ·  ') +
          st.element + '  ·  Rec. ' + st.power + '  ·  ' + stars +
          (lore ? '  ·  ' + lore : '')
        );
        if (unlocked) {
          ctaLab.setText(st.boss ? 'Boss Battle' : 'Battle');
          ctaLab.setColor('#f0ffe8');
          cta.setStrokeStyle(1.5, st.boss ? 0xe8a060 : accent, 0.9);
          cta.setInteractive({ useHandCursor: true });
          ctaHandler = () => startBattle(st);
        } else {
          ctaLab.setText('Locked');
          ctaLab.setColor('#666');
          cta.setStrokeStyle(1.5, 0x444444, 0.5);
          cta.disableInteractive();
          ctaHandler = null;
        }
      };

      // Location medallions
      regStages.forEach((st, idx) => {
        const p = nodePos(st, idx);
        const unlocked = global.SR_STATE.stageUnlocked(state, st);
        const prog = (state.campaign.progress && state.campaign.progress[st.id]) || { stars: 0 };
        const cleared = (prog.stars || 0) >= 1;
        const isBoss = !!st.boss;
        const isCurrent = unlocked && !cleared;
        const R = isBoss ? 38 : 28;
        const stroke = !unlocked ? 0x3a4048
          : (isBoss ? 0xe8a060 : (cleared ? 0xc9a44a : accent));
        const fill = !unlocked ? 0x14161a
          : (isBoss ? 0x2a1a10 : 0x0a0e12);

        const root = this.add.container(p.x, p.y).setDepth(12);

        // Ground soft shadow
        root.add(this.add.ellipse(2, R * 0.75, R * 1.6, R * 0.45, 0x000000, unlocked ? 0.4 : 0.2));

        // Selection glow (hidden until selected)
        const selGlow = this.add.circle(0, 0, R + 16, 0xffe8a0, 0.0).setVisible(false);
        root.add(selGlow);

        if (isCurrent) {
          const glow = this.add.circle(0, 0, R + 12, accent, 0.18);
          root.add(glow);
          if (this.tweens) {
            this.tweens.add({
              targets: glow, scaleX: 1.14, scaleY: 1.14, alpha: 0.07,
              duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
          }
        }

        // Outer selection ring (gold dashed feel — thick stroke when selected)
        const selRing = this.add.circle(0, 0, R + 8, 0x000000, 0)
          .setStrokeStyle(3, 0xffe8a0, 0.95)
          .setVisible(false);
        root.add(selRing);

        const ring = this.add.circle(0, 0, R, fill, unlocked ? 0.94 : 0.5)
          .setStrokeStyle(isBoss ? 4 : 3, stroke, unlocked ? 0.95 : 0.4);
        root.add(ring);
        if (unlocked) {
          root.add(this.add.circle(0, 0, R - 5, 0x000000, 0)
            .setStrokeStyle(1.5, 0xe8d5a0, isBoss ? 0.45 : 0.28));
        }

        // Soft accent fill disc (region color wash — no busy art)
        root.add(this.add.circle(0, 0, R - 7, unlocked ? accent : 0x222222, unlocked ? 0.22 : 0.1));

        const icon = isBoss ? '👑' : (cleared ? '★' : String(st.index || idx + 1));
        root.add(this.add.text(0, isBoss ? -2 : 0, icon, {
          fontFamily: isBoss ? 'system-ui' : 'Georgia, serif',
          fontSize: (isBoss ? 22 : 16) + 'px',
          color: unlocked ? '#f4ffe8' : '#555',
          fontStyle: 'bold',
          stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5));

        // Name under medallion
        const nameLab = this.add.text(0, R + 12, st.name, {
          fontFamily: 'system-ui', fontSize: isBoss ? '12px' : '11px',
          color: unlocked ? '#e8e0d0' : '#555',
          align: 'center', wordWrap: { width: Math.max(90, R * 3.2) },
          stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5, 0);
        root.add(nameLab);

        // Selected badge under name
        const selBadge = this.add.text(0, R + 28, '▼  Selected', {
          fontFamily: 'system-ui', fontSize: '10px', fontStyle: 'bold',
          color: '#ffe8a0', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5, 0).setVisible(false);
        root.add(selBadge);

        if (this.tweens) {
          this.tweens.add({
            targets: selRing, scaleX: 1.08, scaleY: 1.08, alpha: 0.55,
            duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
          });
          this.tweens.add({
            targets: selGlow, alpha: 0.22, scaleX: 1.12, scaleY: 1.12,
            duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
          });
        }

        const hit = this.add.circle(0, 0, R + 12, 0xffffff, 0.001);
        root.add(hit);
        hit.setInteractive({ useHandCursor: unlocked });

        nodeMeta[st.id] = {
          root: root,
          ring: ring,
          selRing: selRing,
          selGlow: selGlow,
          nameLab: nameLab,
          selBadge: selBadge,
          baseStroke: stroke,
          R: R,
          unlocked: unlocked,
          isBoss: isBoss,
          hovered: false
        };

        // Hover = preview scale only — does NOT change selection / battle target
        hit.on('pointerover', () => {
          const m = nodeMeta[st.id];
          if (!m) return;
          m.hovered = true;
          if (!selected || selected.id !== st.id) {
            if (unlocked) root.setScale(1.08);
          }
        });
        hit.on('pointerout', () => {
          const m = nodeMeta[st.id];
          if (!m) return;
          m.hovered = false;
          if (!selected || selected.id !== st.id) root.setScale(1);
          else root.setScale(1.18);
        });
        hit.on('pointerdown', () => {
          setSelection(st);
        });
      });

      // Initial selection: prior pick, frontier, last clear, or first — click still required to change
      let auto = null;
      if (this._selectedStageId) {
        auto = regStages.find((s) => s.id === this._selectedStageId) || null;
      }
      if (!auto) {
        auto = regStages.find((s) => global.SR_STATE.stageUnlocked(state, s) &&
          !((state.campaign.progress[s.id] || {}).stars >= 1));
      }
      if (!auto) {
        auto = [...regStages].reverse().find((s) => (state.campaign.progress[s.id] || {}).stars >= 1)
          || regStages[0];
      }
      if (auto) setSelection(auto);
    }
  }

  global.CampaignScene = CampaignScene;
})(typeof window !== 'undefined' ? window : global);
