/* Village hub — Raid-style premium chrome over painted village */
(function (global) {
  'use strict';

  var MODE_ICONS = {
    campaign: '🗺️',
    dungeons: '⚔️',
    champions: '🛡️',
    summon: '✨',
    vault: '💎',
    great_hall: '🏛️',
    alchemy: '🧪',
    workshop: '🔨',
    market: '🪙',
    eternity: '🌌',
    chronicle: '📜'
  };

  class HubScene extends Phaser.Scene {
    constructor() {
      super({ key: 'HubScene' });
    }

    init(data) {
      this._startTutorial = !!(data && data.startTutorial);
      this._postTutorial = !!(data && data.postTutorial);
    }

    create() {
      if (global.SR_UI && global.SR_UI.installCrispText) global.SR_UI.installCrispText(this);
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      let state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      const T = (UI && UI.THEME) || {};

      if (!state.introSeen) {
        this.scene.start('IntroScene');
        return;
      }

      // Mid-tutorial: resume gel trials or pick (cannot use hub yet)
      const pickDone = !!(state.flags && state.flags.tutorialPickDone) || !!state.tutorialSeen;
      if (!pickDone) {
        this._resumeTutorial(state);
        return;
      }

      // ——— Village stage: native DOM video under canvas (smooth 24fps) ———
      // Phaser Video re-uploads frames to WebGL and dual-decode crossfade
      // looked choppy vs watching the mp4 directly. SR_MODE_VIDEO uses one
      // hardware-decoded <video> under a transparent camera.
      this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'hub_bg_video', {
        wash: 0.14,
        washColor: 0x02140c,
        fallbackImage: 'hub_bg',
        fadeSec: 0.7 // soft dissolve at loop so it feels continuous, not a hard cut
      }))) {
        this.cameras.main.setBackgroundColor('#0c2818');
        if (this.textures.exists('hub_bg')) {
          this.add.image(w / 2, h / 2, 'hub_bg').setDisplaySize(w, h).setDepth(0);
        }
      }
      // Top vignette
      const vig = this.add.graphics().setDepth(2);
      vig.fillStyle(0x000000, 0.4);
      vig.fillRect(0, 0, w, 88);
      // Compact bottom wash under travel cards only
      vig.fillStyle(0x000000, 0.4);
      vig.fillRect(0, h - 150, w, 150);

      // Currency: top-right, same Y as mode-page back buttons (left stays free)
      UI.addCurrencyStrip(this, state, 40);

      // Center title — text only
      this.add.text(w / 2, 30, 'RAID OF THE GEL', {
        fontFamily: (T.fontTitle) || 'Cinzel, Georgia, serif',
        fontSize: '26px', color: '#f0ffe8',
        stroke: '#0a2a1a', strokeThickness: 5
      }).setOrigin(0.5).setDepth(13);
      this.add.text(w / 2, 52, 'Village Haven', {
        fontFamily: (T.fontBody) || 'Inter, system-ui, sans-serif',
        fontSize: '13px', color: '#ffe8a0', fontStyle: 'bold',
        stroke: '#0a2a1a', strokeThickness: 3
      }).setOrigin(0.5).setDepth(13);

      // ⚙ Settings (GFX + Restart) — top-left, clear of party column
      if (UI.addSettingsMenu) {
        UI.addSettingsMenu(this, 48, 40, {
          depth: 50,
          onRestart: () => {
            const fresh = global.SR_STATE.resetGame();
            global.SR_GAME_STATE = fresh;
            // Drop any scene-local caches of old roster/vault
            try {
              if (this.registry) this.registry.remove('partyCache');
            } catch (eReg) { /* ignore */ }
            if (global.SR_UI && global.SR_UI.toast) {
              global.SR_UI.toast(this, 'Save wiped · vault & gear cleared', true);
            }
            this.scene.start('IntroScene', { force: true, skipTutorial: false });
          }
        });
      }

      // ——— Active party (portraits on village art) ———
      const party = global.SR_STATE.getParty(state);
      const portraitSize = 100;
      // Space columns by longest full name so plates don’t collide
      let maxNameChars = 6;
      party.forEach((c) => {
        const n = String(c.name || 'Gel');
        if (n.length > maxNameChars) maxNameChars = n.length;
      });
      const partyGap = Math.max(150, Math.min(220, 70 + maxNameChars * 9));

      this.add.text(48, 98, '⚔  ACTIVE PARTY', {
        fontFamily: (T.fontTitle) || 'Cinzel, Georgia, serif',
        fontSize: '16px', color: '#ffe8a0', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 4
      }).setDepth(14);

      party.forEach((c, i) => {
        const x = 90 + i * partyGap;
        const y = 178;
        const fullName = String(c.name || 'Gel');
        // Root so portrait + label hover-scale together (like travel nav chips)
        const root = this.add.container(x, y).setDepth(15);
        const portrait = UI.addSlimePortrait(this, 0, 0, portraitSize, c.element, 0, {
          mode: 'badge',
          champ: c,
          artVariant: c.artVariant,
          rarity: c.rarity || 'Common'
        });
        if (portrait) root.add(portrait);

        // Stars sit at ~portraitSize*0.48 — keep nameplate below them
        const nameY = portraitSize * 0.78;
        const nameTxt = this.add.text(0, nameY, fullName, {
          fontFamily: 'system-ui', fontSize: '12px', color: '#f0fff4', fontStyle: 'bold',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        const plateW = Math.max(110, Math.min(partyGap - 10, Math.ceil(nameTxt.width + 36)));
        let plate = null;
        if (UI.addUiPlate) {
          plate = UI.addUiPlate(this, (UI.UI_TEX && UI.UI_TEX.pill) || 'ui_currency_pill',
            0, nameY, plateW, 30, 0, { alpha: 1, mode: 'fillH', minW: plateW });
        } else {
          plate = this.add.rectangle(0, nameY, plateW, 24, 0x0a1410, 0.75)
            .setStrokeStyle(1, 0xc9a44a, 0.6);
        }
        if (plate) root.add(plate);
        root.add(nameTxt);
        // Raid PWR (gear+traits) — same number as pre-battle / sheet, not raw base
        if (global.SR_STATE.refreshChampionDerived) {
          global.SR_STATE.refreshChampionDerived(c);
        }
        const dispPwr = (global.SR_STATE.championDisplayPower
          ? global.SR_STATE.championDisplayPower(c)
          : ((c.attributes && c.attributes.power) || c.power || 0));
        const pwrTxt = this.add.text(0, portraitSize * 0.98, 'PWR ' + dispPwr, {
          fontFamily: 'system-ui', fontSize: '11px', color: '#88ccaa',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        root.add(pwrTxt);

        const hit = this.add.circle(0, portraitSize * 0.12, portraitSize * 0.62, 0xffffff, 0.001)
          .setInteractive({ useHandCursor: true });
        root.add(hit);
        root.setScale(1);
        if (UI.wireHover) {
          UI.wireHover(hit, {
            paintFill: false,
            hoverScale: 1.06,
            idleScale: 1,
            scaleTarget: root
          });
        } else {
          hit.on('pointerover', () => {
            if (this.tweens) {
              this.tweens.killTweensOf(root);
              this.tweens.add({
                targets: root, scaleX: 1.06, scaleY: 1.06, duration: 110, ease: 'Sine.easeOut'
              });
            } else root.setScale(1.06);
          });
          hit.on('pointerout', () => {
            if (this.tweens) {
              this.tweens.killTweensOf(root);
              this.tweens.add({
                targets: root, scaleX: 1, scaleY: 1, duration: 110, ease: 'Sine.easeOut'
              });
            } else root.setScale(1);
          });
        }
        hit.on('pointerdown', () => {
          if (global.SR_TRANSIT && global.SR_TRANSIT.go) {
            global.SR_TRANSIT.go(this, 'ChampionDetailScene', { champId: c.id, returnScene: 'HubScene' });
          } else {
            this.scene.start('ChampionDetailScene', { champId: c.id, returnScene: 'HubScene' });
          }
        });
      });

      // ——— Tamer badge (right) — below currency / top bar, not overlapping ———
      const statsX = w - 148;
      // Badge is ~310 tall; center ~ mid party column, clear of y≈40 currency strip
      const statsY = 268;
      if (UI.addTamerBadge) {
        UI.addTamerBadge(this, statsX, statsY, state, { depth: 14, w: 220, h: 290 });
      } else {
        const tamerLv = (state.player && state.player.level) || 1;
        const pp = (global.SR_STATE.partyPower && global.SR_STATE.partyPower(state)) || 0;
        this.add.rectangle(statsX, statsY, 200, 260, 0x0a1612, 0.9)
          .setStrokeStyle(2, 0xc9a44a).setDepth(14);
        this.add.text(statsX, statsY - 90, 'TAMER', {
          fontFamily: (T.fontTitle) || 'Cinzel, Georgia, serif',
          fontSize: '14px', color: '#c9a44a', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(15);
        this.add.text(statsX, statsY - 50, 'Level ' + tamerLv, {
          fontFamily: 'system-ui', fontSize: '22px', color: '#f0ffe8', fontStyle: 'bold',
          stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(15);
        this.add.text(statsX, statsY + 10,
          'Party Power  ' + pp +
          '\nRecord  W ' + (state.stats.wins || 0) + ' / L ' + (state.stats.losses || 0) +
          '\nSummons  ' + (state.stats.summons || 0),
          {
            fontFamily: 'system-ui', fontSize: '13px', color: '#b8e8cc', align: 'center',
            lineSpacing: 4
          }
        ).setOrigin(0.5).setDepth(15);
      }

      // ——— Bottom travel strip: compact dock, cards sit ON it (not floating above) ———
      const modes = (global.SR_DATA && global.SR_DATA.HUB_MODES) || [];
      const pad = 8;
      const gap = 5;
      const n = Math.max(1, modes.length);
      // Base size then +50%
      let chipW = Math.floor((w - pad * 2 - gap * (n - 1)) / n);
      chipW = Math.max(120, Math.min(160, chipW));
      chipW = Math.floor(chipW * 1.5);
      let chipH = Math.floor(72 * 1.5); // 108
      let totalW = n * chipW + (n - 1) * gap;
      const avail = w - pad * 2;
      if (totalW > avail) {
        chipW = Math.floor((avail - gap * (n - 1)) / n);
        chipH = Math.floor(chipW * 0.72);
        chipH = Math.max(100, Math.min(120, chipH));
        totalW = n * chipW + (n - 1) * gap;
      }
      // Seat cards on the bottom edge — center Y so bottoms clear the frame slightly
      const marginBottom = 12;
      const chipY = h - chipH / 2 - marginBottom;
      // Small TRAVEL label just above the card tops (tight strip, not a tall dock)
      this.add.text(w / 2, chipY - chipH / 2 - 14, 'TRAVEL', {
        fontFamily: (T.fontTitle) || 'Cinzel, Georgia, serif',
        fontSize: '12px', color: '#c9a44a', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 4
      }).setOrigin(0.5).setDepth(40);

      const startX = (w - totalW) / 2 + chipW / 2;
      this._modeChips = {};
      modes.forEach((m, i) => {
        const x = startX + i * (chipW + gap);
        const icon = MODE_ICONS[m.id] || '';
        const chip = UI.addHubNavChip(this, x, chipY, chipW, chipH, m.label, icon, () => {
          // Campaign locked until tutorial pick is done
          if (m.id === 'campaign' && !(state.flags && state.flags.tutorialPickDone) &&
              !state.tutorialSeen) {
            if (UI.toast) UI.toast(this, 'Finish the soft trial first', false);
            return;
          }
          if (m.id === 'campaign' && !(state.roster || []).length) {
            if (UI.toast) UI.toast(this, 'Bond a gel first (tutorial pick)', false);
            return;
          }
          if (global.SR_TRANSIT && global.SR_TRANSIT.go) {
            global.SR_TRANSIT.go(this, m.scene);
          } else if (UI.goScene) {
            UI.goScene(this, m.scene);
          } else {
            this.scene.start(m.scene);
          }
        });
        this._modeChips[m.id] = chip;
      });

      // Guided first-run coach (after Epic pick → Campaign)
      const TUT = global.SR_TUTORIAL;
      if (this._postTutorial || (TUT && TUT.needsHubCoach(state))) {
        this._runHubCoach(state);
      } else if (TUT && TUT.needsEquipCoach && TUT.needsEquipCoach(state)) {
        this._runEquipCoach(state);
      } else if (TUT && TUT.needsCampaignNudge(state) && this._modeChips.campaign) {
        const chip = this._modeChips.campaign;
        const cx = chip.x != null ? chip.x : (chip.list && chip.list[0] && chip.list[0].x);
        const cy = chip.y != null ? chip.y : chipY;
        if (cx != null && TUT.pulseAt) {
          this._campaignPulse = TUT.pulseAt(this, cx, cy, { radius: chipH * 0.42, depth: 55 });
        }
      }
    }

    /** Resume Raid tutorial mid-flow (battle chain or pick). */
    _resumeTutorial(state) {
      const battleDone = !!(state.flags && state.flags.tutorialBattleDone);
      if (battleDone) {
        this.scene.start('TutorialPickScene');
        return;
      }
      const cands = global.SR_STATE.ensureTutorialCandidates
        ? global.SR_STATE.ensureTutorialCandidates(state)
        : [];
      // Start from first gel if interrupted
      const wi = 0;
      const gel = cands[wi];
      const foe = global.SR_STATE.buildTutorialFoe
        ? global.SR_STATE.buildTutorialFoe(wi)
        : null;
      this.scene.start('BattleScene', {
        tutorial: true,
        tutorialIndex: wi,
        tutorialTotal: 4,
        party: gel ? [gel] : [],
        foes: foe ? [foe] : undefined,
        region: 'greenwild',
        arena: 'greenwild'
      });
    }

    /**
     * Post-first-win: point player at Champions / Vault for gear & levels.
     */
    _runEquipCoach(state) {
      const TUT = global.SR_TUTORIAL;
      if (!TUT || !TUT.showTip) return;
      const chip = (this._modeChips && (this._modeChips.champions || this._modeChips.roster || this._modeChips.vault)) || null;
      let pulse = null;
      if (chip && TUT.pulseAt) {
        const cx = chip.x != null ? chip.x : null;
        const cy = chip.y != null ? chip.y : null;
        if (cx != null && cy != null) {
          pulse = TUT.pulseAt(this, cx, cy, { radius: 48, depth: 55, color: 0x4ade80 });
        }
      }
      const dismiss = () => {
        if (pulse) try { pulse.destroy(); } catch (e) { /* */ }
        if (TUT.markEquipCoachDone) TUT.markEquipCoachDone(state);
      };
      const goChamps = () => {
        dismiss();
        const target = 'RosterScene';
        if (global.SR_TRANSIT && global.SR_TRANSIT.go) global.SR_TRANSIT.go(this, target);
        else this.scene.start(target);
      };
      TUT.showTip(this, {
        title: 'Spoils & Soft Steel',
        body: 'First victory! Your lead gel may already wear a Life relic.\n' +
          'Open Champions → pick a gel → Gear to swap vault drops.\n' +
          'Vault stores extras · levels rose from that fight — keep clearing trails.',
        primaryLabel: 'Open Champions',
        secondaryLabel: 'Got it',
        y: this.cameras.main.height * 0.36,
        height: 220,
        onPrimary: goChamps,
        onSecondary: dismiss
      });
    }

    /**
     * Two-step first-hour coach: welcome → send player to Campaign.
     * Uses TUTORIAL_STEPS copy when available.
     */
    _runHubCoach(state) {
      const TUT = global.SR_TUTORIAL;
      const steps = (global.SR_DATA && global.SR_DATA.TUTORIAL_STEPS) || [];
      const village = steps.find((s) => s.id === 'village') || {
        title: 'Your Haven',
        speech: 'Welcome home, Keeper. Portals ring the village — Campaign starts your story.'
      };
      const campaign = steps.find((s) => s.id === 'campaign') || {
        title: 'Campaign trails',
        speech: 'Open Campaign and clear Whispering Glade — your first fight on the Soft Roots path.'
      };

      // Pulse Campaign chip while coaching
      const chip = this._modeChips && this._modeChips.campaign;
      let pulse = null;
      if (chip && TUT && TUT.pulseAt) {
        const cx = chip.x != null ? chip.x : null;
        const cy = chip.y != null ? chip.y : null;
        // Hub chips may be containers — fall back to TRAVEL row estimate
        if (cx != null && cy != null) {
          pulse = TUT.pulseAt(this, cx, cy, { radius: 48, depth: 55 });
        }
      }

      const goCampaign = () => {
        if (pulse) try { pulse.destroy(); } catch (e) { /* */ }
        if (TUT) TUT.markHubCoachDone(state);
        if (global.SR_TRANSIT && global.SR_TRANSIT.go) {
          global.SR_TRANSIT.go(this, 'CampaignScene');
        } else {
          this.scene.start('CampaignScene');
        }
      };

      const gel = (state.roster && state.roster[0]) || null;
      const gelName = (gel && gel.name) || 'your Epic gel';

      // Post-tutorial: single step → Campaign with solo gel
      TUT.showTip(this, {
        title: 'The Soft Roots open',
        body: gelName + ' stands alone for now — an Epic bond.\n' +
          'Campaign trails start moderately hard; gear and levels will help.\n' +
          'Open Campaign → Whispering Glade when you are ready.',
        primaryLabel: 'Start Campaign',
        secondaryLabel: 'Explore Haven first',
        y: this.cameras.main.height * 0.36,
        height: 220,
        onPrimary: goCampaign,
        onSecondary: () => {
          if (pulse) try { pulse.destroy(); } catch (e2) { /* */ }
          TUT.markHubCoachDone(state);
        }
      });
      void village;
      void campaign;
    }
  }

  global.HubScene = HubScene;
})(typeof window !== 'undefined' ? window : global);
