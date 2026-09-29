/* Champion detail — Raid-style single sheet (stage left + full sheet right, no empty tabs) */
(function (global) {
  'use strict';

  class ChampionDetailScene extends Phaser.Scene {
    constructor() {
      super({ key: 'ChampionDetailScene' });
    }

    init(data) {
      this.champId = data && data.champId;
      this.returnScene = (data && data.returnScene) || 'RosterScene';
    }

    create() {
      if (global.SR_UI && global.SR_UI.installCrispText) global.SR_UI.installCrispText(this);
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const UI = global.SR_UI;
      const DATA = global.SR_DATA || {};

      if (!(global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.install(this, 'mode_champions_video', {
        wash: 0.18, washColor: 0x0a0e12, fallbackImage: 'mode_champions'
      }))) {
        UI.paintModeBg(this, 'mode_champions', '#0a0e12', 0.32);
      }

      const backLabel = (UI.backLabelForScene && UI.backLabelForScene(this.returnScene))
        || '←  Back';
      if (UI.addBackButton) {
        UI.addBackButton(this, 70, 40, {
          label: backLabel,
          scene: this.returnScene
        });
      }

      let champ = (state.roster || []).find((c) => c.id === this.champId);
      if (!champ) {
        this.add.text(w / 2, h / 2, 'Champion not found', {
          fontFamily: 'system-ui', fontSize: '18px', color: '#ffaaaa'
        }).setOrigin(0.5);
        return;
      }
      if (global.SR_STATE.refreshChampionDerived) global.SR_STATE.refreshChampionDerived(champ);

      const rarityColor = (DATA.getRarityColor && DATA.getRarityColor(champ.rarity)) || '#77ffaa';
      const lore = (DATA.getChampionLoreBlurb && DATA.getChampionLoreBlurb(champ)) || null;
      const form = (DATA.resolveFormTier && DATA.resolveFormTier(champ)) || 'blob';
      const formLabel = form === 'humanoid' ? 'Mythic shape'
        : form === 'ascended' ? 'Legendary shape'
        : form === 'morph' ? 'Morph arms'
        : 'Blob form';
      const attrs = champ.attributes || (DATA.computeChampionAttributes && DATA.computeChampionAttributes(champ)) || {};
      const inParty = (state.partyIds || []).indexOf(champ.id) >= 0;
      const baseStars = (DATA.getBaseStars && DATA.getBaseStars(champ)) ||
        (global.SR_STATE.championBaseStars && global.SR_STATE.championBaseStars(champ)) || 2;
      const purpleStars = (DATA.getPurpleStars && DATA.getPurpleStars(champ)) ||
        (global.SR_STATE.championPurpleStars && global.SR_STATE.championPurpleStars(champ)) || 0;
      const rarNum = Phaser.Display.Color.HexStringToColor(rarityColor).color || 0xc9a44a;

      // ——— LEFT: champion stage (Raid portrait column) ———
      const stageX = w * 0.22;
      const stageW = Math.min(480, w * 0.42);

      // Stage plate: village ink/charcoal (not green), rarity only on stroke/glow
      this.add.rectangle(stageX, h * 0.52, stageW + 18, h * 0.82, rarNum, 0.10).setDepth(8);
      this.add.rectangle(stageX, h * 0.52, stageW + 4, h * 0.80, 0x0a0e12, 0.96)
        .setStrokeStyle(2, rarNum, 0.9).setDepth(9);
      for (let bi = 0; bi < 5; bi++) {
        this.add.rectangle(stageX, h * 0.24 + bi * (h * 0.12), stageW * 0.9, h * 0.11, 0x141a20, 0.04 + bi * 0.015)
          .setDepth(10);
      }
      this.add.ellipse(stageX, h * 0.54, stageW * 0.55, 42, 0x000000, 0.45).setDepth(11);
      this.add.ellipse(stageX, h * 0.54, stageW * 0.42, 28, rarNum, 0.12).setDepth(11);

      const portraitSize = Math.min(420, stageW * 0.88, h * 0.48);
      const portraitY = h * 0.40;
      // Live 3D showcase stage (RSL preview): painted gel on pedestal + drag yaw.
      // Falls back to 2D portrait if WebGL / show API unavailable.
      this._mountChampionStage(stageX, portraitY, portraitSize, stageW, champ, rarNum);

      this.events.once('shutdown', () => {
        this._teardownChampionStage();
      });

      // Name plate under stage (Raid-style identity block)
      const namePlate = this.add.text(stageX, h * 0.62, champ.name, {
        fontFamily: 'Georgia, serif', fontSize: '26px', color: '#f4ffe8',
        stroke: '#000', strokeThickness: 5
      }).setOrigin(0.5).setDepth(14);
      // Named legends can be long ("The First Rain That Had a Name"): shrink to fit
      for (let fs = 24; namePlate.width > stageW * 0.94 && fs >= 15; fs -= 2) namePlate.setFontSize(fs);
      // Fixed rarity stars: purple = evolved, gold = not yet
      this._drawStarRow(stageX, h * 0.658, baseStars, purpleStars, 22);
      this.add.text(stageX, h * 0.695, champ.rarity.toUpperCase() +
        (baseStars > 0
          ? '  ·  ' + purpleStars + '/' + baseStars + ' purple'
          : '  ·  no star path'), {
        fontFamily: 'system-ui', fontSize: '14px', color: rarityColor, fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(14);
      this.add.text(stageX, h * 0.725,
        champ.element + '  ·  ' + formLabel + (inParty ? '  ·  ★ Party' : ''), {
          fontFamily: 'system-ui', fontSize: '13px', color: '#a8e0c0'
        }).setOrigin(0.5).setDepth(14);
      if (lore && lore.named && lore.epithet) {
        this.add.text(stageX, h * 0.80, '“' + lore.epithet + '”', {
          fontFamily: 'Georgia, serif', fontSize: '13px', color: '#f3e3b0', fontStyle: 'italic',
          align: 'center', wordWrap: { width: stageW * 0.9 }
        }).setOrigin(0.5).setDepth(14);
      }
      if (lore) {
        this.add.text(stageX, h * 0.76, (lore.role || '') + '  ·  ' + (lore.personality || ''), {
          fontFamily: 'system-ui', fontSize: '12px', color: '#c8ddc8',
          align: 'center', wordWrap: { width: stageW * 0.9 }
        }).setOrigin(0.5).setDepth(14);
      }

      // ——— RIGHT: single Raid-style sheet (stats + lore + traits + gear) ———
      const panelX = w * 0.64;
      const panelW = Math.min(780, w * 0.58);
      const panelTop = 58;
      const panelH = h - 120;
      // Sheet fill matches village bars / dark ink panels (not green jade)
      this.add.rectangle(panelX, h * 0.5, panelW, panelH, 0x0a0e12, 0.94)
        .setStrokeStyle(2, rarNum, 0.55).setDepth(10);
      // Header strip
      this.add.rectangle(panelX, panelTop + 22, panelW - 8, 44, 0x10141a, 0.96)
        .setStrokeStyle(1, 0xc9a44a, 0.4).setDepth(11);
      this.add.text(panelX - panelW / 2 + 24, panelTop + 22, 'CHAMPION SHEET', {
        fontFamily: 'Georgia, serif', fontSize: '15px', color: '#ffe8a0', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 3
      }).setOrigin(0, 0.5).setDepth(12);
      const maxLv = (DATA.getChampionMaxLevel && DATA.getChampionMaxLevel(champ)) ||
        (global.SR_STATE.getChampionMaxLevel && global.SR_STATE.getChampionMaxLevel(champ)) || 50;
      this.add.text(panelX + panelW / 2 - 24, panelTop + 22,
        'Lv ' + (champ.level || 1) + '/' + maxLv + '   ·   PWR ' + (attrs.power || champ.power || 0), {
          fontFamily: 'system-ui', fontSize: '14px', color: '#e8ffd4', fontStyle: 'bold'
        }).setOrigin(1, 0.5).setDepth(12);

      const left = panelX - panelW / 2 + 28;
      const contentW = panelW - 56;
      let y = panelTop + 56;

      // —— Stats (compact bars, Raid-like) ——
      y = this._sectionTitle(left, y, contentW, 'Attributes');
      // Raid-style sheet: Power is weighted score; C.RATE / C.DMG / RES / ACC shown
      const statRows = [
        ['Power', attrs.power || champ.power || 0, 0xffdd77, 8000],
        ['ATK', attrs.atk || 0, 0xff8866, 800],
        ['HP', attrs.hp || 0, 0x66ee99, 5000],
        ['DEF', attrs.def || 0, 0x88aacc, 500],
        ['SPD', attrs.spd || 0, 0xaaddff, 320],
        ['C.RATE', attrs.crit || 0, 0xffcc66, 100],
        ['C.DMG', attrs.critDmg != null ? attrs.critDmg : 50, 0xffaa55, 200],
        ['RES', attrs.res || 0, 0x99bbdd, 400],
        ['ACC', attrs.acc || 0, 0xbb99dd, 400]
      ];
      statRows.forEach((r) => {
        y = this._statBar(left, y, contentW, r[0], r[1], r[2], r[3]);
      });
      // EXP (to next level; 0 when at cap)
      const exp = champ.exp || 0;
      const atCap = (champ.level || 1) >= maxLv;
      const nextExp = atCap ? 1 : ((global.SR_STATE.expToNextChampLevel &&
        global.SR_STATE.expToNextChampLevel(champ.level || 1)) || 95);
      y = this._statBar(left, y + 4, contentW, 'EXP', atCap ? 1 : exp, 0x55dd88, nextExp,
        atCap ? 'MAX Lv ' + maxLv : (exp + ' / ' + nextExp));
      y += 10;

      // —— Lore (scrollable full text) ——
      y = this._sectionTitle(left, y, contentW, 'Lore');
      const bio = (lore && (lore.championBio || lore.extended || lore.blurb)) ||
        'A gel champion of the Softened Realms.';
      const kitLine = (lore && lore.signature ? 'Kit · ' + lore.signature : 'Kit · Gel Strike') +
        (lore && lore.affinity ? '   ·   ' + lore.affinity : '');
      y = this._addScrollableLore(left, y, contentW, bio, kitLine);
      y += 10;

      // —— Traits + synergy readout ——
      y = this._sectionTitle(left, y, contentW, 'Traits & Synergies');
      const traits = champ.traits || [];
      const defs = DATA.TRAIT_DEFINITIONS || {};
      const party = (global.SR_STATE.getParty && global.SR_STATE.getParty(state)) || [];
      const readout = (DATA.getTraitSynergyReadout
        ? DATA.getTraitSynergyReadout(champ, party)
        : null);
      if (!traits.length) {
        this.add.text(left, y, 'No traits yet — grow through battles & summons.', {
          fontFamily: 'system-ui', fontSize: '12px', color: '#88aa99'
        }).setDepth(15);
        y += 28;
      } else {
        let cx = left;
        let cy = y;
        const chipH = 28;
        const gap = 8;
        const tierColor = {
          Common: 0x6b7280, Uncommon: 0x22c55e, Rare: 0x3b82f6,
          Epic: 0xa855f7, Legendary: 0xf59e0b
        };
        const familyColor = {
          combat: 0xf87171, training: 0x60a5fa, economy: 0xfbbf24, bloodline: 0xc084fc
        };
        traits.forEach((key) => {
          const def = defs[key] || { name: key, tier: 'Common', family: 'combat' };
          const label = def.name || key;
          const tw = Math.min(contentW, 28 + label.length * 8);
          if (cx + tw > left + contentW) {
            cx = left;
            cy += chipH + gap;
          }
          const col = familyColor[def.family] || tierColor[def.tier] || 0x66aa88;
          this.add.rectangle(cx + tw / 2, cy + chipH / 2, tw, chipH, 0x12161c, 0.95)
            .setStrokeStyle(2, col, 0.9).setDepth(14);
          this.add.text(cx + tw / 2, cy + chipH / 2, label, {
            fontFamily: 'system-ui', fontSize: '12px', color: '#e8ffd4', fontStyle: 'bold'
          }).setOrigin(0.5).setDepth(15);
          // Short desc under last chip row later
          cx += tw + gap;
        });
        y = cy + chipH + 8;
        // Trait effect lines
        traits.forEach((key) => {
          const def = defs[key];
          if (!def || !def.desc) return;
          this.add.text(left, y, '· ' + (def.name || key) + ': ' + def.desc, {
            fontFamily: 'system-ui', fontSize: '11px', color: '#a8c0b0',
            wordWrap: { width: contentW }
          }).setDepth(15);
          y += 16;
        });
        y += 4;
      }
      // Active self synergies
      const selfLines = (readout && readout.self && readout.self.lines) ||
        (attrs.traitSynergyLines) || [];
      if (selfLines.length) {
        this.add.text(left, y, 'SELF SYNERGY', {
          fontFamily: 'system-ui', fontSize: '11px', color: '#ffe8a0', fontStyle: 'bold'
        }).setDepth(15);
        y += 16;
        selfLines.forEach((line) => {
          this.add.text(left, y, '✦ ' + line, {
            fontFamily: 'system-ui', fontSize: '12px', color: '#e8d5a0',
            wordWrap: { width: contentW }
          }).setDepth(15);
          y += 17;
        });
        y += 4;
      }
      // Party synergies (from current party)
      const partyLines = (readout && readout.party && readout.party.lines) || [];
      const partyHints = (readout && readout.party && readout.party.hints) || [];
      if (partyLines.length) {
        this.add.text(left, y, 'PARTY SYNERGY (active roster)', {
          fontFamily: 'system-ui', fontSize: '11px', color: '#88e0aa', fontStyle: 'bold'
        }).setDepth(15);
        y += 16;
        partyLines.forEach((line) => {
          this.add.text(left, y, '✦ ' + line, {
            fontFamily: 'system-ui', fontSize: '12px', color: '#a8e0c0',
            wordWrap: { width: contentW }
          }).setDepth(15);
          y += 17;
        });
        y += 4;
      } else if (partyHints.length) {
        this.add.text(left, y, 'PARTY (progress)', {
          fontFamily: 'system-ui', fontSize: '11px', color: '#889988', fontStyle: 'bold'
        }).setDepth(15);
        y += 16;
        partyHints.slice(0, 3).forEach((h) => {
          this.add.text(left, y, '· ' + h, {
            fontFamily: 'system-ui', fontSize: '11px', color: '#7a9088'
          }).setDepth(15);
          y += 15;
        });
        y += 4;
      }
      y += 6;

      // —— Artifacts (compact 3×2 grid) ——
      y = this._sectionTitle(left, y, contentW, 'Artifacts');
      y = this._drawGearGrid(left, y, contentW, champ, state, UI, DATA);

      // Bottom actions
      const maxParty = 4 + Math.min(2, (state.player && state.player.stats && state.player.stats.leadership) || 0);
      const restart = () => {
        this.scene.restart({ champId: champ.id, returnScene: this.returnScene });
      };
      UI.addButton(this, w * 0.48, h - 42, 160, 40, inParty ? '★ Leave Party' : '★ Join Party', 0x2a5530, () => {
        const ids = state.partyIds || [];
        const idx = ids.indexOf(champ.id);
        if (idx >= 0) ids.splice(idx, 1);
        else if (ids.length < maxParty) ids.push(champ.id);
        else { UI.toast(this, 'Party full (max ' + maxParty + ')', false); return; }
        state.partyIds = ids;
        global.SR_STATE.saveState(state);
        restart();
      });
      UI.addButton(this, w * 0.62, h - 42, 130, 40, champ.locked ? '🔓 Unlock' : '🔒 Lock', 0x443322, () => {
        champ.locked = !champ.locked;
        global.SR_STATE.saveState(state);
        restart();
      });
      UI.addButton(this, w * 0.74, h - 42, 120, 40, '🌟 Evolve', 0x553311, () => {
        this._openEvolveModal(champ, state, UI, DATA, restart);
      });
      if (UI.addBackButton) {
        UI.addBackButton(this, w * 0.88, h - 42, {
          label: '←  Village',
          scene: 'HubScene',
          depth: 50
        });
      }
    }

    /**
     * Resolve painted gel source for the live stage (prefer gentle UI cutouts).
     */
    _resolveDetailArtImage(champ) {
      if (!champ || !this.textures) return null;
      const low = String(champ.element || 'water').toLowerCase();
      const artV = champ.artVariant ||
        (global.SR_ART && global.SR_ART.artVariantForUnit
          ? global.SR_ART.artVariantForUnit(champ) : 'a');
      const artF = (global.SR_ART && global.SR_ART.gelFormForUnit)
        ? global.SR_ART.gelFormForUnit(champ) : 'blob';
      let evo = 0;
      if (global.SR_ART && global.SR_ART.gelEvoLevel) evo = global.SR_ART.gelEvoLevel(champ);

      let combatKeys = (global.SR_ART && global.SR_ART.phaserGelKeyCandidates)
        ? global.SR_ART.phaserGelKeyCandidates(low, artV, artF)
        : ['slime_' + low];
      if (evo >= 1) {
        const evoKeys = [];
        for (let e = evo; e >= 1; e--) evoKeys.push('slime_' + low + '_evo' + e);
        combatKeys = evoKeys.concat(combatKeys);
      }
      const toUi = (global.SR_ART && global.SR_ART.uiGelDestKey)
        ? global.SR_ART.uiGelDestKey.bind(global.SR_ART)
        : (k) => (k && k.indexOf('slime_') === 0 && k.indexOf('slime_ui_') !== 0
          ? 'slime_ui_' + k.slice(6) : null);
      const tryKeys = [];
      combatKeys.forEach((k) => {
        const u = toUi(k);
        if (u) tryKeys.push(u);
      });
      combatKeys.forEach((k) => tryKeys.push(k));

      for (let i = 0; i < tryKeys.length; i++) {
        const key = tryKeys[i];
        if (!this.textures.exists(key)) continue;
        try {
          const src = this.textures.get(key).getSourceImage();
          if (src && (src.width || src.naturalWidth)) return src;
        } catch (e) { /* next */ }
      }
      return null;
    }

    /**
     * Live 3D champion stage (pedestal + painted plate + drag spin).
     * Falls back to 2D slime portrait if showcase fails.
     */
    _mountChampionStage(stageX, portraitY, portraitSize, stageW, champ, rarNum) {
      const UI = global.SR_UI;
      const showApi = global.SR_CHAMP_SHOW;
      const canShow = showApi && showApi.available && showApi.available() && showApi.create;

      this._teardownChampionStage();

      if (canShow) {
        const stageH = Math.min(portraitSize * 1.35, this.cameras.main.height * 0.58);
        const stageWPx = Math.min(portraitSize * 1.05, stageW * 0.95);
        const artImage = this._resolveDetailArtImage(champ);
        let show = null;
        try {
          show = showApi.create({
            width: Math.round(stageWPx),
            height: Math.round(stageH),
            dpr: Math.min((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 1.5, 1.5),
            element: champ.element,
            rarity: champ.rarity,
            name: champ.name,
            game: this.game,
            textureKey: 'champ_detail_show_' + (champ.id || champ.element || 'x'),
            artImage: artImage || undefined,
            preferArt: true
          });
        } catch (eShow) {
          console.warn('[ChampDetail] showcase create failed', eShow && eShow.message);
          show = null;
        }

        if (show && show.textureKey) {
          if (show.registerTexture) show.registerTexture(this.game);
          // Late art if boot registration finished after create
          if (!artImage && show.setArtImage) {
            this.time.delayedCall(80, () => {
              const late = this._resolveDetailArtImage(champ);
              if (late && show.setArtImage) show.setArtImage(late);
            });
          }
          const img = this.add.image(stageX, portraitY + 8, show.textureKey)
            .setDisplaySize(stageWPx, stageH)
            .setDepth(13);
          this._detailShow = show;
          this._detailPortrait = img;
          this._detailShowImg = img;

          // Drag-to-spin hit zone over the stage
          const hit = this.add.rectangle(stageX, portraitY + 8, stageWPx, stageH, 0x000000, 0.001)
            .setDepth(14)
            .setInteractive({ useHandCursor: true, draggable: false });
          let dragging = false;
          let lastX = 0;
          hit.on('pointerdown', (ptr) => {
            dragging = true;
            lastX = ptr.x;
            if (show.setIdle) show.setIdle(false);
          });
          hit.on('pointerup', () => {
            dragging = false;
            // Resume gentle auto-orbit after a short pause
            this.time.delayedCall(900, () => {
              if (this._detailShow && this._detailShow.setIdle) this._detailShow.setIdle(true);
            });
          });
          hit.on('pointerupoutside', () => { dragging = false; });
          hit.on('pointermove', (ptr) => {
            if (!dragging || !this._detailShow) return;
            const dx = ptr.x - lastX;
            lastX = ptr.x;
            if (this._detailShow.addYaw) this._detailShow.addYaw(dx * 0.012);
          });
          this._detailShowHit = hit;

          this.add.text(stageX, portraitY + stageH * 0.48 + 6, 'Drag to rotate', {
            fontFamily: 'system-ui', fontSize: '11px', color: '#8a9a88'
          }).setOrigin(0.5).setDepth(14).setAlpha(0.85);

          // Soft rarity halo behind blit (stage already has ellipse)
          this.add.ellipse(stageX, portraitY + stageH * 0.28, stageWPx * 0.55, 28, rarNum, 0.08)
            .setDepth(12);
          return;
        }
      }

      // 2D fallback — same gentle UI path as before
      if (UI && UI.addSlimePortrait) {
        this._detailPortrait = UI.addSlimePortrait(this, stageX, portraitY, portraitSize, champ.element, 13, {
          mode: 'detail',
          ring: false,
          rarity: champ.rarity,
          champ: champ,
          artVariant: champ.artVariant,
          bob: true,
          showStars: false
        });
        if (this._detailPortrait && this.tweens) {
          this.tweens.add({
            targets: this._detailPortrait,
            scaleX: 1.03, scaleY: 1.03,
            duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
          });
        }
      }
    }

    _teardownChampionStage() {
      if (this._detailShow) {
        try { this._detailShow.dispose(); } catch (e) { /* ignore */ }
        this._detailShow = null;
      }
      if (this._detailShowHit) {
        try { this._detailShowHit.destroy(); } catch (e2) { /* ignore */ }
        this._detailShowHit = null;
      }
      if (this._detailShowImg) {
        try { this._detailShowImg.destroy(); } catch (e3) { /* ignore */ }
        this._detailShowImg = null;
      }
      this._detailPortrait = null;
    }

    /**
     * Draw fixed star row: first `purple` are purple, rest gold.
     * Edge case base≤0 (legacy) → sealed note; Mythic ships with 6★.
     */
    _drawStarRow(cx, cy, baseStars, purpleStars, size) {
      size = size || 20;
      if (!baseStars || baseStars <= 0) {
        this.add.text(cx, cy, '✦ No star path', {
          fontFamily: 'system-ui', fontSize: '13px', color: '#f472b6', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(14);
        return;
      }
      const gap = size + 6;
      const totalW = baseStars * gap - 6;
      let x0 = cx - totalW / 2 + size / 2;
      for (let i = 0; i < baseStars; i++) {
        const isPurple = i < purpleStars;
        this.add.text(x0 + i * gap, cy, '★', {
          fontFamily: 'system-ui',
          fontSize: size + 'px',
          color: isPurple ? '#c084fc' : '#f5d76e',
          stroke: '#1a0a20',
          strokeThickness: 4
        }).setOrigin(0.5).setDepth(14);
      }
    }

    /**
     * Raid-style evolve: pick fodder of matching star count to turn one star purple.
     * Mythic uses the same 6★ path, then gets a ritual flourish on success.
     */
    _openEvolveModal(champ, state, UI, DATA, onDone) {
      const preview = global.SR_STATE.evolvePreview
        ? global.SR_STATE.evolvePreview(state, champ.id)
        : null;
      if (!preview) {
        UI.toast(this, 'Evolve system unavailable — hard refresh', false);
        return;
      }
      if (preview.maxed) {
        UI.toast(this, preview.error || 'Fully purple already', false);
        return;
      }
      if (!preview.ok && !preview.levelReq) {
        UI.toast(this, preview.error || 'Cannot evolve', false);
        return;
      }

      // Close any gear modal first
      if (global.SR_GEAR_UI && global.SR_GEAR_UI.closeModal) global.SR_GEAR_UI.closeModal(this);
      if (this._evoModal) {
        try { this._evoModal.destroy(true); } catch (e) { /* ignore */ }
        this._evoModal = null;
      }

      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const root = this.add.container(0, 0).setDepth(430);
      this._evoModal = root;
      const dim = this.add.rectangle(w / 2, h / 2, w + 8, h + 8, 0x000000, 0.72)
        .setInteractive();
      dim.on('pointerdown', () => {
        try { root.destroy(true); } catch (e2) { /* ignore */ }
        this._evoModal = null;
      });
      const pw = Math.min(620, w - 50);
      const ph = Math.min(620, h - 60);
      const cx = w / 2;
      const cy = h / 2;
      // Ink plate + purple accent (awaken language) + gold corner ticks
      const shadow = this.add.ellipse(cx, cy + ph * 0.46, pw * 0.9, 28, 0x000000, 0.35);
      const panel = this.add.rectangle(cx, cy, pw, ph, 0x0a0e12, 0.98)
        .setStrokeStyle(2.5, 0xc084fc, 0.95);
      const rim = this.add.rectangle(cx, cy, pw - 12, ph - 12, 0x000000, 0)
        .setStrokeStyle(1.2, 0xe8d5a0, 0.28);
      const g = this.add.graphics();
      g.lineStyle(2, 0xc9a44a, 0.7);
      const hw = pw / 2 - 6;
      const hh = ph / 2 - 6;
      const tc = 14;
      const tick = (ox, oy, sx, sy) => {
        g.beginPath();
        g.moveTo(cx + ox, cy + oy + sy * tc);
        g.lineTo(cx + ox, cy + oy);
        g.lineTo(cx + ox + sx * tc, cy + oy);
        g.strokePath();
      };
      tick(-hw, -hh, 1, 1);
      tick(hw, -hh, -1, 1);
      tick(-hw, hh, 1, -1);
      tick(hw, hh, -1, -1);
      const title = this.add.text(cx, cy - ph / 2 + 28, 'Evolve  ·  ' + champ.name, {
        fontFamily: 'Georgia, serif', fontSize: '22px', color: '#e9d5ff', fontStyle: 'bold',
        stroke: '#1a0a20', strokeThickness: 4
      }).setOrigin(0.5);
      const closeX = this.add.text(cx + pw / 2 - 22, cy - ph / 2 + 22, '✕', {
        fontFamily: 'system-ui', fontSize: '18px', color: '#a090b0'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      closeX.on('pointerover', () => closeX.setColor('#ffe8a0'));
      closeX.on('pointerout', () => closeX.setColor('#a090b0'));
      closeX.on('pointerdown', () => {
        try { root.destroy(true); } catch (e3) { /* ignore */ }
        this._evoModal = null;
      });
      root.add([dim, shadow, panel, rim, g, title, closeX]);

      // Star preview: next will turn purple
      const starY = cy - ph / 2 + 72;
      const starGap = 28;
      const base = preview.baseStars;
      const pur = preview.purpleStars;
      const starStartX = cx - ((base - 1) * starGap) / 2;
      for (let i = 0; i < base; i++) {
        let col = '#f5d76e';
        if (i < pur) col = '#c084fc';
        else if (i === pur) col = '#e9d5ff'; // next to awaken
        const st = this.add.text(starStartX + i * starGap, starY, '★', {
          fontFamily: 'system-ui', fontSize: '26px', color: col,
          stroke: '#1a0a20', strokeThickness: 4
        }).setOrigin(0.5);
        root.add(st);
        if (i === pur) {
          this.tweens.add({
            targets: st, scaleX: 1.2, scaleY: 1.2,
            yoyo: true, duration: 500, repeat: -1
          });
        }
      }

      const need = preview.fodderNeeded;
      const levelReq = preview.levelReq || preview.maxLevel || 50;
      const nextMax = preview.nextMaxLevel || (levelReq + 10);
      const lvOk = !!preview.levelOk;
      const info = this.add.text(cx, starY + 36,
        'Awaken star ' + (pur + 1) + ' of ' + base +
        '\nRequires  Lv ' + levelReq + '  (you: Lv ' + (preview.level || 1) + '/' + (preview.maxLevel || levelReq) + ')' +
        (lvOk ? '  ✓' : '  ✗ train more') +
        '\nOn success: reset to Lv 1 · cap → ' + nextMax + ' · soft power keep' +
        '\nConsume  ' + need + '  ×  ' + base + '★  fodder  ·  avail ' + preview.fodderAvailable, {
          fontFamily: 'system-ui', fontSize: '13px', color: lvOk ? '#d4c4e8' : '#ffccaa',
          align: 'center', lineSpacing: 4
        }).setOrigin(0.5);
      root.add(info);

      const selected = {};
      let selectedCount = 0;
      const listTop = cy - ph / 2 + 160;
      const rowH = 48;
      const fodder = preview.fodder || [];
      const maxShow = Math.min(fodder.length, 7);

      const countLabel = this.add.text(cx, cy + ph / 2 - 78,
        'Selected  0 / ' + need, {
          fontFamily: 'system-ui', fontSize: '15px', color: '#ffeeaa', fontStyle: 'bold'
        }).setOrigin(0.5);
      root.add(countLabel);

      const refreshCount = () => {
        countLabel.setText('Selected  ' + selectedCount + ' / ' + need);
        countLabel.setColor(selectedCount === need ? '#aaffcc' : '#ffeeaa');
      };

      if (!fodder.length) {
        const empty = this.add.text(cx, listTop + 40,
          'No unlocked ' + base + '★ champions to consume.\nSummon or unlock more of this star tier.', {
            fontFamily: 'system-ui', fontSize: '14px', color: '#a88', align: 'center'
          }).setOrigin(0.5);
        root.add(empty);
      } else {
        fodder.slice(0, maxShow).forEach((f, i) => {
          const ry = listTop + i * rowH;
          const row = this.add.rectangle(cx, ry, pw - 48, rowH - 8, 0x15201a, 0.98)
            .setStrokeStyle(1, 0x8866aa, 0.7)
            .setInteractive({ useHandCursor: true });
          const mark = this.add.text(cx - pw / 2 + 40, ry, '○', {
            fontFamily: 'system-ui', fontSize: '18px', color: '#8866aa'
          }).setOrigin(0.5);
          const lab = this.add.text(cx - pw / 2 + 58, ry,
            (f.name || 'Gel') + '  ·  ' + (f.rarity || '') + '  ·  Lv' + (f.level || 1) +
            '  ·  ' + base + '★', {
              fontFamily: 'system-ui', fontSize: '13px', color: '#e8ffd4'
            }).setOrigin(0, 0.5);
          root.add([row, mark, lab]);
          row.on('pointerdown', () => {
            if (selected[f.id]) {
              delete selected[f.id];
              selectedCount--;
              mark.setText('○');
              mark.setColor('#8866aa');
              row.setFillStyle(0x15201a, 0.98);
            } else {
              if (selectedCount >= need) {
                UI.toast(this, 'Already selected ' + need, false);
                return;
              }
              selected[f.id] = true;
              selectedCount++;
              mark.setText('●');
              mark.setColor('#c084fc');
              row.setFillStyle(0x2a1840, 0.98);
            }
            refreshCount();
          });
        });
        if (fodder.length > maxShow) {
          const more = this.add.text(cx, listTop + maxShow * rowH + 4,
            '+' + (fodder.length - maxShow) + ' more eligible', {
              fontFamily: 'system-ui', fontSize: '12px', color: '#889'
            }).setOrigin(0.5);
          root.add(more);
        }
      }

      const confY = cy + ph / 2 - 36;
      const doConfirm = () => {
        if (!lvOk) {
          UI.toast(this, 'Need level ' + levelReq + ' to evolve', false);
          return;
        }
        if (selectedCount !== need) {
          UI.toast(this, 'Select exactly ' + need + ' fodder', false);
          return;
        }
        const ids = Object.keys(selected).map((k) => {
          const n = Number(k);
          return isFinite(n) && String(n) === k ? n : k;
        });
        const typed = ids.map((id) => {
          const hit = (state.roster || []).find((c) => c.id == id);
          return hit ? hit.id : id;
        });
        const res = global.SR_STATE.evolveChampion(state, champ.id, typed);
        if (!res.ok) {
          UI.toast(this, res.error || 'Evolve failed', false);
          return;
        }
        try { root.destroy(true); } catch (e4) { /* ignore */ }
        this._evoModal = null;

        const pct = Math.round((res.powerAfter / (res.prevPower || 1)) * 100);
        const toastMsg = champ.name + ' → ' + res.purpleStars + '/' + res.baseStars +
          ' purple ★ · Lv1/' + res.maxLevel + ' (kept ~' + pct + '% power)';
        const finish = () => {
          UI.toast(this, toastMsg, true);
          if (typeof onDone === 'function') onDone();
        };

        if (global.SR_AUDIO && global.SR_AUDIO.play) global.SR_AUDIO.play('evolve');
        // Mythic-only ritual (common→legend keeps the quick toast path)
        if (String(champ.rarity || '') === 'Mythic') {
          this._playMythicEvolveFlourish(champ, res, finish);
        } else {
          finish();
        }
      };
      if (UI.addButton) {
        const confBtn = UI.addButton(this, cx, confY, 300, 44,
          lvOk ? 'Awaken star  (consume)' : 'Reach Lv ' + levelReq + ' first',
          lvOk ? 0x2a1840 : 0x222222, doConfirm, 432);
        if (confBtn && confBtn.root) root.add(confBtn.root);
        else if (confBtn) root.add(confBtn);
      } else {
        const conf = this.add.rectangle(cx, confY, 280, 44, lvOk ? 0x4a1a6a : 0x333333, 1)
          .setStrokeStyle(2, lvOk ? 0xc084fc : 0x666666, 0.9)
          .setInteractive({ useHandCursor: true });
        const confT = this.add.text(cx, confY,
          lvOk ? 'Awaken star  (consume)' : 'Reach Lv ' + levelReq + ' first', {
          fontFamily: 'system-ui', fontSize: '15px', color: lvOk ? '#f5e8ff' : '#999', fontStyle: 'bold'
        }).setOrigin(0.5);
        root.add([conf, confT]);
        conf.on('pointerdown', doConfirm);
      }
    }

    /**
     * Soft sparkle burst for mythic awaken ceremony.
     */
    _evoSparkles(x, y, color, count, parent) {
      const n = count || 12;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.45;
        const dist = 50 + Math.random() * 90;
        const p = this.add.circle(x, y, 2.5 + Math.random() * 3.5, color, 0.95).setDepth(505);
        if (parent) parent.add(p);
        this.tweens.add({
          targets: p,
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist - 28,
          alpha: 0,
          scale: 0.15,
          duration: 420 + Math.random() * 280,
          ease: 'Cubic.easeOut',
          onComplete: () => { try { p.destroy(); } catch (e) { /* ignore */ } }
        });
      }
    }

    /**
     * Mythic-only evolve flourish — pillar, rings, star cascade, title card.
     * Full 6/6 purple gets a longer "constellation" beat.
     */
    _playMythicEvolveFlourish(champ, res, onComplete) {
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const base = Math.max(1, res.baseStars || 6);
      const pur = Math.max(0, res.purpleStars || 1);
      const full = pur >= base;
      const pink = 0xf472b6;
      const gold = 0xfbbf24;
      const root = this.add.container(0, 0).setDepth(500);
      this._evoFlourish = root;

      const dim = this.add.rectangle(w / 2, h / 2, w + 24, h + 24, 0x100818, 0.78);
      root.add(dim);

      // Rising light pillar (summon-capsule energy)
      const pillar = this.add.rectangle(w / 2, h * 0.58, 30, 28, pink, 0.62);
      root.add(pillar);
      this.tweens.add({
        targets: pillar,
        displayHeight: h * 0.72,
        displayWidth: full ? 110 : 86,
        y: h * 0.40,
        alpha: 0.12,
        duration: 640,
        ease: 'Cubic.easeOut'
      });

      // Expanding rings
      const ringN = full ? 5 : 3;
      for (let i = 0; i < ringN; i++) {
        const ring = this.add.circle(w / 2, h * 0.48, 18, pink, 0)
          .setStrokeStyle(2.5, i % 2 === 0 ? pink : gold, 0.95);
        root.add(ring);
        this.tweens.add({
          targets: ring,
          scaleX: 6 + i * 2.2,
          scaleY: 6 + i * 2.2,
          alpha: 0,
          duration: 820 + i * 140,
          delay: i * 70,
          ease: 'Cubic.easeOut',
          onComplete: () => { try { ring.destroy(); } catch (e) { /* ignore */ } }
        });
      }

      this._evoSparkles(w / 2, h * 0.48, pink, full ? 28 : 18, root);
      this._evoSparkles(w / 2, h * 0.46, gold, full ? 16 : 10, root);

      // Title card
      const titleStr = full ? 'FULL MYTHIC CONSTELLATION' : 'MYTHIC AWAKENING';
      const title = this.add.text(w / 2, h * 0.22, titleStr, {
        fontFamily: 'Georgia, serif',
        fontSize: full ? '30px' : '26px',
        color: '#fce7f3',
        fontStyle: 'bold',
        stroke: '#1a0a20',
        strokeThickness: 6
      }).setOrigin(0.5).setAlpha(0).setScale(0.55);
      const sub = this.add.text(w / 2, h * 0.285,
        (champ.name || 'Mythic gel') + '  ·  star ' + pur + ' of ' + base +
        (full ? '  ·  sealed apex' : ''), {
          fontFamily: 'system-ui', fontSize: '15px', color: '#e9d5ff',
          stroke: '#1a0a20', strokeThickness: 3
        }).setOrigin(0.5).setAlpha(0);
      root.add([title, sub]);
      this.tweens.add({
        targets: title, alpha: 1, scaleX: 1, scaleY: 1,
        duration: 480, ease: 'Back.easeOut'
      });
      this.tweens.add({
        targets: sub, alpha: 1, duration: 360, delay: 160
      });

      // Star cascade — prior purples solid; newly awakened star pulses in
      const gap = 34;
      const starY = h * 0.50;
      const starStartX = w / 2 - ((base - 1) * gap) / 2;
      for (let i = 0; i < base; i++) {
        const isNew = i === pur - 1;
        const isPur = i < pur;
        let col = '#f5d76e';
        if (isPur) col = '#c084fc';
        if (isNew) col = '#fce7f3';
        const st = this.add.text(starStartX + i * gap, starY, '★', {
          fontFamily: 'system-ui', fontSize: isNew ? '36px' : '26px', color: col,
          stroke: '#1a0a20', strokeThickness: 5
        }).setOrigin(0.5).setAlpha(isNew ? 0 : 1).setScale(isNew ? 0.3 : 1);
        root.add(st);
        if (isNew) {
          this.tweens.add({
            targets: st, alpha: 1, scaleX: 1.35, scaleY: 1.35,
            duration: 420, delay: 280, ease: 'Back.easeOut',
            onComplete: () => {
              st.setColor('#c084fc');
              this.tweens.add({
                targets: st, scaleX: 1, scaleY: 1, duration: 280, ease: 'Sine.easeOut'
              });
            }
          });
        } else if (isPur) {
          this.tweens.add({
            targets: st, scaleX: 1.08, scaleY: 1.08,
            yoyo: true, duration: 320, delay: i * 40, ease: 'Sine.easeInOut'
          });
        }
      }

      // Soft camera flash (pink)
      try {
        if (this.cameras && this.cameras.main && this.cameras.main.flash) {
          this.cameras.main.flash(full ? 360 : 240, 244, 114, 182, false, null, full ? 0.42 : 0.28);
        }
      } catch (eFlash) { /* ignore */ }

      // Portrait punch if still on stage
      if (this._detailPortrait) {
        this.tweens.add({
          targets: this._detailPortrait,
          scaleX: 1.12, scaleY: 1.12,
          duration: 380, yoyo: true, ease: 'Sine.easeOut'
        });
      }

      const hold = full ? 2300 : 1750;
      this.time.delayedCall(hold, () => {
        this.tweens.add({
          targets: root, alpha: 0, duration: 280,
          onComplete: () => {
            try { root.destroy(true); } catch (e5) { /* ignore */ }
            this._evoFlourish = null;
            if (typeof onComplete === 'function') onComplete();
          }
        });
      });
    }

    _sectionTitle(x, y, w, label) {
      this.add.text(x, y, label, {
        fontFamily: 'Georgia, serif', fontSize: '15px', color: '#ffe8a0', fontStyle: 'bold',
        stroke: '#041208', strokeThickness: 3
      }).setDepth(15);
      this.add.rectangle(x + w / 2, y + 18, w, 1, 0xc9a44a, 0.25).setDepth(14);
      return y + 28;
    }

    /**
     * Fixed-height lore viewport — full bio, wheel / drag to scroll.
     * Returns y just below the box.
     */
    _addScrollableLore(x, y, w, bio, kitLine) {
      const boxH = 118;
      const pad = 10;
      const depth = 15;

      // Frame
      this.add.rectangle(x + w / 2, y + boxH / 2, w, boxH, 0x0a0e12, 0.95)
        .setStrokeStyle(1, 0x3a4048, 0.75).setDepth(depth);

      // Full text (untruncated)
      const body = this.add.text(0, 0, String(bio || ''), {
        fontFamily: 'system-ui', fontSize: '13px', color: '#c8e0d0',
        wordWrap: { width: w - pad * 2 }, lineSpacing: 4
      }).setOrigin(0, 0).setDepth(depth + 2);

      const kit = this.add.text(0, body.height + 10, String(kitLine || ''), {
        fontFamily: 'system-ui', fontSize: '12px', color: '#aaffcc',
        wordWrap: { width: w - pad * 2 }
      }).setOrigin(0, 0).setDepth(depth + 2);

      const contentH = body.height + 10 + kit.height + 4;
      const viewH = boxH - pad * 2;
      const maxScroll = Math.max(0, contentH - viewH);

      // Content container (masked)
      const content = this.add.container(x + pad, y + pad).setDepth(depth + 2);
      content.add([body, kit]);

      // Geometry mask for the viewport
      const maskGfx = this.make.graphics({ x: 0, y: 0, add: false });
      maskGfx.fillStyle(0xffffff);
      maskGfx.fillRect(x + 2, y + 2, w - 4, boxH - 4);
      const mask = maskGfx.createGeometryMask();
      content.setMask(mask);

      // Invisible hit zone for wheel + drag
      const hit = this.add.rectangle(x + w / 2, y + boxH / 2, w, boxH, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: maxScroll > 0 })
        .setDepth(depth + 3);

      let scroll = 0;
      const applyScroll = () => {
        scroll = Math.max(0, Math.min(maxScroll, scroll));
        content.y = y + pad - scroll;
        if (thumb) {
          const trackH = boxH - 16;
          const thumbH = maxScroll > 0
            ? Math.max(18, trackH * (viewH / contentH))
            : trackH;
          const travel = trackH - thumbH;
          const t = maxScroll > 0 ? scroll / maxScroll : 0;
          thumb.height = thumbH;
          thumb.y = y + 8 + thumbH / 2 + travel * t;
          thumb.setVisible(maxScroll > 0);
        }
        if (hint) hint.setVisible(maxScroll > 0 && scroll < 2);
      };

      // Scroll track / thumb
      let thumb = null;
      if (maxScroll > 0) {
        this.add.rectangle(x + w - 6, y + boxH / 2, 4, boxH - 12, 0x1a2a22, 0.9)
          .setDepth(depth + 1);
        thumb = this.add.rectangle(x + w - 6, y + 20, 4, 24, 0xc9a44a, 0.85)
          .setDepth(depth + 4);
      }

      const hint = maxScroll > 0
        ? this.add.text(x + w / 2, y + boxH - 2, '↕ scroll lore', {
            fontFamily: 'system-ui', fontSize: '10px', color: '#6a8878'
          }).setOrigin(0.5, 1).setDepth(depth + 4)
        : null;

      let dragY = null;
      hit.on('pointerdown', (pointer) => {
        if (maxScroll <= 0) return;
        dragY = pointer.y;
      });
      hit.on('pointermove', (pointer) => {
        if (dragY == null || maxScroll <= 0) return;
        if (!pointer.isDown) {
          dragY = null;
          return;
        }
        const dy = pointer.y - dragY;
        dragY = pointer.y;
        scroll -= dy;
        applyScroll();
      });
      hit.on('pointerup', () => { dragY = null; });
      hit.on('pointerout', () => { dragY = null; });

      // Wheel when pointer is over the lore box
      const onWheel = (pointer, over, dx, dy) => {
        if (maxScroll <= 0) return;
        const b = hit.getBounds();
        if (pointer.x < b.x || pointer.x > b.right ||
            pointer.y < b.y || pointer.y > b.bottom) return;
        scroll += (typeof dy === 'number' ? dy : 0) * 0.45;
        applyScroll();
      };
      this.input.on('wheel', onWheel);
      this.events.once('shutdown', () => {
        try {
          this.input.off('wheel', onWheel);
          if (maskGfx) maskGfx.destroy();
        } catch (e) { /* ignore */ }
      });

      applyScroll();

      return y + boxH + (maxScroll > 0 ? 14 : 6);
    }

    _statBar(x, y, w, label, value, color, maxRef, valueLabel) {
      const max = Math.max(1, maxRef || 100);
      const pct = Math.max(0.04, Math.min(1, Number(value) / max));
      this.add.text(x, y, label, {
        fontFamily: 'system-ui', fontSize: '12px', color: '#88bba0', fontStyle: 'bold'
      }).setDepth(15);
      this.add.text(x + w, y, valueLabel != null ? String(valueLabel) : String(value), {
        fontFamily: 'system-ui', fontSize: '12px', color: '#f0ffe8', fontStyle: 'bold'
      }).setOrigin(1, 0).setDepth(15);
      const barY = y + 18;
      this.add.rectangle(x + w / 2, barY, w, 10, 0x1a2a20, 1).setDepth(15);
      this.add.rectangle(x + (w * pct) / 2, barY, w * pct, 8, color, 1).setDepth(16);
      return y + 32;
    }

    /**
     * Raid-style artifact kit — 6 slots in a hex ring around the champ column,
     * set-colored frames, level badge, main stat, set progress (2pc/4pc).
     */
    _drawGearGrid(x, y, w, champ, state, UI, DATA) {
      const slots = DATA.ARTIFACT_SLOTS || [];
      const sets = DATA.ARTIFACT_SETS || {};
      const inv = state.artifacts || [];
      const free = inv.filter((a) => !a.equippedTo);
      const gold = 0xc9a44a;
      const goldLite = 0xe8d5a0;

      // Section header (Raid kit language)
      this.add.text(x, y, 'ARTIFACTS', {
        fontFamily: 'system-ui', fontSize: '13px', fontStyle: 'bold', color: '#c9a44a',
        stroke: '#000', strokeThickness: 3
      }).setDepth(15);
      this.add.rectangle(x + 88, y + 8, Math.min(w - 100, 200), 1, gold, 0.35).setOrigin(0, 0.5).setDepth(14);
      this.add.text(x + w, y, free.length + ' in vault', {
        fontFamily: 'system-ui', fontSize: '11px', color: '#7a8a80'
      }).setOrigin(1, 0).setDepth(15);
      y += 26;

      if (!champ.equipment) champ.equipment = {};
      // Migrate legacy keys for display
      if (champ.equipment.armor && !champ.equipment.chest) champ.equipment.chest = champ.equipment.armor;
      if (champ.equipment.ring && !champ.equipment.gloves) champ.equipment.gloves = champ.equipment.ring;

      const GEAR = global.SR_GEAR_UI;
      const restart = () => {
        this.scene.restart({ champId: champ.id, returnScene: this.returnScene });
      };

      // Slot size — hex-ish diamonds via rotated squares look busy; use rounded plates
      const slotSize = Math.min(92, Math.floor((w - 24) / 3) - 8);
      const gap = 10;
      const cols = 3;
      const statLabel = { atk: 'ATK', hp: 'HP', spd: 'SPD', power: 'PWR' };

      const hexColor = (hex, fallback) => {
        try {
          return Phaser.Display.Color.HexStringToColor(hex || '#556666').color || fallback;
        } catch (e) { return fallback; }
      };

      slots.forEach((slot, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = x + slotSize / 2 + col * (slotSize + gap) +
          Math.max(0, (w - cols * (slotSize + gap) + gap) / 2);
        const cy = y + slotSize / 2 + row * (slotSize + gap + 6) + 4;
        const piece = champ.equipment[slot.id] ||
          (slot.id === 'chest' ? champ.equipment.armor : null) ||
          (slot.id === 'gloves' ? champ.equipment.ring : null);
        const setKey = piece && (piece.set || piece.setName);
        const setDef = setKey ? sets[setKey] : null;
        const setColor = setDef ? setDef.color : null;
        const strokeCol = piece
          ? hexColor(setColor, gold)
          : 0x3a4048;
        const filled = !!piece;

        // Soft drop shadow
        this.add.ellipse(cx + 2, cy + slotSize * 0.42, slotSize * 0.85, 14, 0x000000, 0.35).setDepth(13);

        // Outer gold tick plate
        const outer = this.add.rectangle(cx, cy, slotSize + 4, slotSize + 4, 0x0a0e12, 0.2)
          .setStrokeStyle(1.5, filled ? strokeCol : 0x2a3038, filled ? 0.85 : 0.45)
          .setDepth(14);
        const bg = this.add.rectangle(cx, cy, slotSize, slotSize, filled ? 0x12161c : 0x0a0e12, 0.96)
          .setStrokeStyle(2.5, strokeCol, filled ? 0.95 : 0.55)
          .setInteractive({ useHandCursor: true })
          .setDepth(14);

        // Corner ticks (Raid kit ornament)
        const tick = (ox, oy, sx, sy) => {
          const g = this.add.graphics().setDepth(15);
          g.lineStyle(1.5, filled ? goldLite : 0x4a5058, filled ? 0.75 : 0.35);
          const hw = slotSize / 2 - 4;
          const hh = slotSize / 2 - 4;
          g.beginPath();
          g.moveTo(cx + ox * hw, cy + oy * hh + sy * 10);
          g.lineTo(cx + ox * hw, cy + oy * hh);
          g.lineTo(cx + ox * hw + sx * 10, cy + oy * hh);
          g.strokePath();
        };
        tick(-1, -1, 1, 1);
        tick(1, -1, -1, 1);
        tick(-1, 1, 1, -1);
        tick(1, 1, -1, -1);

        // Slot type label (top)
        this.add.text(cx, cy - slotSize / 2 + 11, (slot.icon || '·') + ' ' + (slot.short || slot.name), {
          fontFamily: 'system-ui', fontSize: '10px', fontStyle: 'bold',
          color: filled ? '#e8e0d0' : '#5a6570',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(16);

        if (filled) {
          // Level badge
          this.add.rectangle(cx + slotSize / 2 - 16, cy - slotSize / 2 + 12, 28, 16, 0x1a1820, 0.95)
            .setStrokeStyle(1, gold, 0.8).setDepth(16);
          this.add.text(cx + slotSize / 2 - 16, cy - slotSize / 2 + 12, '+' + (piece.level || 1), {
            fontFamily: 'system-ui', fontSize: '10px', fontStyle: 'bold', color: '#ffe8a0'
          }).setOrigin(0.5).setDepth(17);

          // Piece name (wrapped short)
          const nm = String(piece.name || 'Relic');
          this.add.text(cx, cy - 4, nm.length > 14 ? nm.slice(0, 13) + '…' : nm, {
            fontFamily: 'Georgia, serif', fontSize: '11px', color: '#f0e8d4',
            align: 'center', wordWrap: { width: slotSize - 12 },
            stroke: '#000', strokeThickness: 2
          }).setOrigin(0.5).setDepth(16);

          // Set name + main stat
          const st = statLabel[piece.mainStat] || 'PWR';
          this.add.text(cx, cy + 16, (piece.set || piece.setName || '') + '  ·  ' + st, {
            fontFamily: 'system-ui', fontSize: '10px', color: setColor || '#9aa89a'
          }).setOrigin(0.5).setDepth(16);
          this.add.text(cx, cy + slotSize / 2 - 14, '+' + (piece.value || piece.power || 0), {
            fontFamily: 'system-ui', fontSize: '14px', fontStyle: 'bold', color: '#ffe8a0',
            stroke: '#000', strokeThickness: 3
          }).setOrigin(0.5).setDepth(16);
        } else {
          // Empty Raid slot — big faded icon
          this.add.text(cx, cy - 2, slot.icon || '◇', {
            fontFamily: 'system-ui', fontSize: '28px', color: '#2a3038'
          }).setOrigin(0.5).setDepth(15);
          this.add.text(cx, cy + 22, 'Empty', {
            fontFamily: 'system-ui', fontSize: '11px', color: '#4a5560'
          }).setOrigin(0.5).setDepth(15);
        }

        bg.on('pointerover', () => {
          bg.setStrokeStyle(3, goldLite, 1);
          outer.setStrokeStyle(1.5, gold, 0.7);
        });
        bg.on('pointerout', () => {
          bg.setStrokeStyle(2.5, strokeCol, filled ? 0.95 : 0.55);
          outer.setStrokeStyle(1.5, filled ? strokeCol : 0x2a3038, filled ? 0.85 : 0.45);
        });
        bg.on('pointerdown', () => {
          if (!GEAR) {
            UI.toast(this, 'Gear UI missing — hard refresh', false);
            return;
          }
          if (filled) {
            GEAR.openEquippedMenu(this, {
              champ: champ, state: state, slot: slot, piece: piece,
              UI: UI, DATA: DATA, onDone: restart
            });
          } else {
            GEAR.openArtifactPicker(this, {
              champ: champ, state: state, slot: slot,
              UI: UI, DATA: DATA, onEquipped: restart
            });
          }
        });
      });

      const rows = Math.ceil(slots.length / cols);
      let setY = y + rows * (slotSize + gap + 6) + 12;

      // Set progress — Raid 2pc / 4pc style
      const equippedSets = {};
      Object.keys(champ.equipment || {}).forEach((sid) => {
        if (sid === 'armor' || sid === 'ring') return; // legacy keys mirrored above
        const p = champ.equipment[sid];
        if (!p) return;
        const sn = p.set || p.setName || 'Life';
        equippedSets[sn] = (equippedSets[sn] || 0) + 1;
      });
      const setKeys = Object.keys(equippedSets);
      if (setKeys.length) {
        this.add.text(x, setY, 'SET BONUSES', {
          fontFamily: 'system-ui', fontSize: '11px', fontStyle: 'bold', color: '#c9a44a',
          stroke: '#000', strokeThickness: 2
        }).setDepth(15);
        setY += 18;
        setKeys.forEach((sn) => {
          const n = equippedSets[sn];
          const def = sets[sn] || { bonus: '', color: '#77ffaa' };
          const col = def.color || '#aaffcc';
          const barW = Math.min(160, w * 0.45);
          // Progress 0–6
          this.add.rectangle(x + barW / 2, setY + 4, barW, 6, 0x1a1e24, 1).setDepth(14);
          const fillN = Math.min(6, n);
          if (fillN > 0) {
            this.add.rectangle(x + (barW * fillN / 6) / 2, setY + 4, barW * fillN / 6, 6,
              hexColor(col, gold), 1).setDepth(15);
          }
          const tier = n >= 4 ? (def.bonus4 || def.bonus || '4pc active')
            : (n >= 2 ? (def.bonus2 || def.bonus || '2pc active') : 'Need 2 for set');
          this.add.text(x + barW + 10, setY, sn + '  ' + n + '/6  ·  ' + tier, {
            fontFamily: 'system-ui', fontSize: '11px',
            color: n >= 2 ? col : '#6a7068'
          }).setOrigin(0, 0.5).setDepth(15);
          setY += 20;
        });
      } else {
        this.add.text(x, setY, 'Equip matching set pieces — 2pc unlocks a bonus, 4pc strengthens it.', {
          fontFamily: 'system-ui', fontSize: '11px', color: '#5a6570',
          wordWrap: { width: w }
        }).setDepth(15);
        setY += 28;
      }
      return setY + 12;
    }
  }

  global.ChampionDetailScene = ChampionDetailScene;
})(typeof window !== 'undefined' ? window : global);

