/* Live 3D combat arena (Three.js) + SPD turn meter — hub stays 2D (RSL-style) */
(function (global) {
  'use strict';

  class BattleScene extends Phaser.Scene {
    constructor() {
      super({ key: 'BattleScene' });
    }

    init(data) {
      this.battleData = data || {};
    }

    create() {
      if (global.SR_UI && global.SR_UI.installCrispText) global.SR_UI.installCrispText(this);
      // Hub/mode DOM video must not sit under combat (same z as 3d host)
      if (global.SR_MODE_VIDEO && global.SR_MODE_VIDEO.hide) global.SR_MODE_VIDEO.hide();
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const C = global.SR_COMBAT;

      this.live3d = false;
      this.world3d = null;
      this.events.once('shutdown', () => this._teardown3d());
      this.events.once('destroy', () => this._teardown3d());

      // Prefer live Three.js arena as a DOM layer under the Phaser HUD
      if (global.SR_BATTLE3D && global.SR_BATTLE3D.available && global.SR_BATTLE3D.available()) {
        try {
          const dpr = (global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || Math.min(window.devicePixelRatio || 1, 2);
          const stage = this.battleData.stage || null;
          const region = this.battleData.region || this.battleData.zone ||
            (stage && stage.region) || null;
          let qOpt = null;
          try {
            qOpt = (typeof localStorage !== 'undefined' && localStorage.getItem('sr_battle_quality')) || null;
          } catch (eQ) { qOpt = null; }
          this.world3d = global.SR_BATTLE3D.create({
            width: w,
            height: h,
            dpr: Math.min(dpr, 1.25),
            game: this.game,
            textureKey: 'battle_world_3d',
            quality: qOpt || undefined,
            // Chapter battle zone (Greenwild / Crystal / Shadowfen / Volcanic / Celestial)
            region: region,
            zone: region,
            stage: stage,
            dungeon: this.battleData.dungeon || null,
            boss: this.battleData.boss || null,
            arena: this.battleData.arena || region ||
              (this.battleData.dungeon || this.battleData.boss ? 'dungeon' : 'greenwild')
          });
          if (this.world3d) {
            if (this.world3d.mount) this.world3d.mount(this.game);
            else this.world3d.registerTexture(this.game);
            // 3D is blitted into a Phaser texture (Safari-safe — not a DOM underlay)
            this.cameras.main.setBackgroundColor('#020a08');
            this.battle3dBg = this.add.image(w / 2, h / 2, this.world3d.textureKey)
              .setDisplaySize(w, h)
              .setDepth(0)
              .setName('battle3dBg')
              .setOrigin(0.5);
            this.live3d = true;
            if (global.SR_SLIME3D && global.SR_SLIME3D.stopLoop) global.SR_SLIME3D.stopLoop();
            console.log('[Battle] LIVE 3D arena active (blit→Phaser)', {
              key: this.world3d.textureKey,
              tex: this.textures.exists(this.world3d.textureKey),
              quality: qOpt || '(auto)',
              hasModelsApi: !!(global.SR_MODELS && global.SR_MODELS.preloadForUnits),
              hasGlbLoader: typeof global.SR_loadGLB === 'function'
            });
          }
        } catch (e) {
          console.warn('[Battle] live 3D failed, using 2.5D fallback', e);
          this.world3d = null;
          this.live3d = false;
        }
      } else {
        console.warn('[Battle] SR_BATTLE3D / THREE missing — 2.5D fallback', {
          hasAPI: !!global.SR_BATTLE3D,
          hasThree: typeof THREE !== 'undefined'
        });
      }

      if (!this.live3d) {
        // Fallback: depth JPG + vanishing floor (OLD look)
        this.cameras.main.setBackgroundColor('#0a1820');
        const arenaKey = this.battleData.arena || 'arena_wilds';
        if (this.textures.exists(arenaKey)) {
          this.add.image(w / 2, h * 0.42, arenaKey).setDisplaySize(w * 1.05, h * 0.85).setAlpha(0.9).setDepth(0);
        }
        this.add.rectangle(w / 2, h * 0.78, w, h * 0.45, 0x0a1a12, 0.55).setDepth(1);
        for (let i = 0; i < 8; i++) {
          const y = h * 0.42 + i * 22;
          const alpha = 0.05 + i * 0.03;
          this.add.rectangle(w / 2, y, w * (0.4 + i * 0.08), 1, 0x77ffaa, alpha).setDepth(2);
        }
      }

      // Prefer party arranged on PreBattle setup screen
      let party = (this.battleData.party && this.battleData.party.length)
        ? this.battleData.party
        : global.SR_STATE.getParty(state);
      // Multi-wave dungeon delve state
      this._waveIndex = 0;
      this._totalWaves = 1;
      if (this.battleData.dungeon) {
        const d = this.battleData.dungeon;
        this._totalWaves = (global.SR_STATE.dungeonWaveCount
          ? global.SR_STATE.dungeonWaveCount(d)
          : Math.max(1, d.waves || 1));
        this._waveIndex = Math.max(0, this.battleData.waveIndex || 0);
      }

      let foes;
      if (this.battleData.foes && this.battleData.foes.length && !this.battleData.dungeon) {
        foes = this.battleData.foes;
      } else if (this.battleData.stage) {
        foes = global.SR_STATE.makeStageFoes(this.battleData.stage);
      } else if (this.battleData.dungeon) {
        foes = global.SR_STATE.makeDungeonWaveFoes
          ? global.SR_STATE.makeDungeonWaveFoes(this.battleData.dungeon, this._waveIndex)
          : global.SR_STATE.makeDungeonFoes(this.battleData.dungeon);
      } else if (this.battleData.boss) {
        foes = global.SR_STATE.makeBossFoes(this.battleData.boss);
      } else if (this.battleData.foes && this.battleData.foes.length) {
        foes = this.battleData.foes;
      } else {
        foes = [
          global.SR_STATE.createChampion({ element: 'Fire', rarity: 'Uncommon', level: 4, name: 'Spar Bandit', power: 95 }),
          global.SR_STATE.createChampion({ element: 'Earth', rarity: 'Common', level: 3, name: 'Moss Golem', power: 80 })
        ];
      }

      this.battle = C.createBattle(party, foes, {
        auto: false,
        waveIndex: this._waveIndex,
        totalWaves: this._totalWaves
      });
      this.auto = false;
      this.unitSprites = { allies: [], foes: [] };
      this.meterBars = [];
      this.hpBars = [];
      // Gate combat until load veil finishes (avoids blob → sprite pop-in)
      this.busy = true;
      this._battleReady = false;
      this._resultsShown = false;
      this.floatLayer = this.add.container(0, 0).setDepth(250);

      // Mode badge — chapter zone name when live 3D
      let zoneLabel = 'Battle Zone';
      if (this.live3d && global.SR_BATTLE3D && global.SR_BATTLE3D.themeFromOpts) {
        try {
          const zt = global.SR_BATTLE3D.themeFromOpts({
            region: this.battleData.region || this.battleData.zone,
            stage: this.battleData.stage,
            dungeon: this.battleData.dungeon,
            boss: this.battleData.boss,
            arena: this.battleData.arena
          });
          zoneLabel = (zt && zt.label) || zoneLabel;
          if (this.battleData.stage && this.battleData.stage.name) {
            zoneLabel += ' · ' + this.battleData.stage.name;
          }
        } catch (e) { /* ignore */ }
      }
      if (this.battleData.dungeon && this._totalWaves > 1) {
        zoneLabel += ' · Wave ' + (this._waveIndex + 1) + '/' + this._totalWaves;
      }

      // Persistent wave chip (dungeons with multiple waves)
      this._waveBanner = null;
      if (this.battleData.dungeon && this._totalWaves > 1) {
        const ww = this.cameras.main.width;
        this._waveBanner = this.add.text(ww / 2, 52, this._waveLabel(), {
          fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold',
          color: '#ffe8a0', stroke: '#041208', strokeThickness: 4
        }).setOrigin(0.5).setDepth(190);
        if (this._waveBanner.setResolution) {
          this._waveBanner.setResolution((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2);
        }
      }

      // Full-screen veil while combat art warms (painterly plates / enemy cards)
      this._showBattleLoad(zoneLabel);

      if (this.live3d && this.world3d) {
        const units = [].concat(this.battle.allies || [], this.battle.foes || []);
        const zone = this.battleData.region || this.battleData.zone ||
          (this.battleData.stage && this.battleData.stage.region) || null;

        const sceneAlive = () => !!(this.sys && this.sys.isActive && this.sys.isActive());

        const spawnFigures = () => {
          if (!this.world3d || !sceneAlive()) return;
          this.world3d.spawnTeams(this.battle.allies, this.battle.foes);
          this.world3d.tick(0);
          this.battle.foes.forEach((u) => {
            const spr = this._spawnUnitLive(u);
            this.unitSprites.foes.push(spr);
          });
          this.battle.allies.forEach((u) => {
            const spr = this._spawnUnitLive(u);
            this.unitSprites.allies.push(spr);
          });
          this._sync3dHud();
        };

        const finishReveal = () => {
          if (!sceneAlive() || this._battleReady) return;
          this._setBattleLoadProgress(1, 'Ready!');
          if (this.world3d) {
            try { this.world3d.tick(0); } catch (eT) { /* ignore */ }
          }
          this._hideBattleLoad(() => {
            if (!sceneAlive()) return;
            this._battleReady = true;
            this.busy = false;
            try { this._refreshHud(); } catch (eH) { console.warn('[Battle] refreshHud', eH); }
            this._maybeBattleCoach();
            this.time.delayedCall(120, () => {
              if (sceneAlive()) {
                try { this._beginTurn(); } catch (eB) {
                  console.warn('[Battle] beginTurn', eB);
                  this.busy = false;
                }
              }
            });
          });
        };

        const revealBattle = () => {
          if (!sceneAlive()) return;
          const artWait = (this.world3d && this.world3d.waitArtReady)
            ? this.world3d.waitArtReady(2800)
            : Promise.resolve({ ok: true });
          // Hard ceiling so a stuck promise never freezes combat forever
          const ceiling = new Promise((resolve) => {
            this.time.delayedCall(5000, () => resolve({ ok: false, timedOut: true, forced: true }));
          });
          Promise.race([artWait, ceiling]).then((res) => {
            if (!sceneAlive()) return;
            console.log('[Battle] art ready → reveal', res || {});
            finishReveal();
          }).catch(() => {
            finishReveal();
          });
        };

        // Warm combat plates + optional GLB, then spawn under the veil
        this._setBattleLoadProgress(0.12, 'Loading field models…');
        const modelsP = (global.SR_MODELS && typeof global.SR_MODELS.preloadForUnits === 'function')
          ? global.SR_MODELS.preloadForUnits(units, { zone: zone, loadProps: false })
            .then((res) => {
              console.log('[Battle] models preload', res || {});
              this._setBattleLoadProgress(0.42, 'Models ready…');
            })
            .catch((err) => {
              console.warn('[Battle] models preload error', err);
              this._setBattleLoadProgress(0.42, 'Models skipped…');
              if (global.SR_MODELS && global.SR_MODELS.serverBreadcrumb) {
                global.SR_MODELS.serverBreadcrumb('battle_preload_error', String(err && err.message || err));
              }
            })
          : Promise.resolve().then(() => this._setBattleLoadProgress(0.42, 'Preparing champions…'));

        const artP = (this.world3d.preloadUnitArt)
          ? this.world3d.preloadUnitArt(units).then((res) => {
              console.log('[Battle] combat art preload', res || {});
              this._setBattleLoadProgress(0.72, 'Champion art ready…');
            }).catch((err) => {
              console.warn('[Battle] combat art preload error', err);
              this._setBattleLoadProgress(0.72, 'Art fallback…');
            })
          : Promise.resolve().then(() => this._setBattleLoadProgress(0.72, 'Spawning teams…'));

        // Also force-reveal if preload hangs (models CDN, etc.)
        this.time.delayedCall(6500, () => {
          if (!sceneAlive() || this._battleReady) return;
          console.warn('[Battle] force-reveal after load timeout');
          this._setBattleLoadProgress(0.95, 'Entering…');
          try { spawnFigures(); } catch (eS) { /* may already have spawned */ }
          finishReveal();
        });

        Promise.all([modelsP, artP]).then(() => {
          this._setBattleLoadProgress(0.88, 'Spawning teams…');
          spawnFigures();
          this._setBattleLoadProgress(0.94, 'Finalizing field…');
          revealBattle();
        }).catch(() => {
          this._setBattleLoadProgress(0.9, 'Recovering…');
          spawnFigures();
          revealBattle();
        });
      } else {
        const layout = C.computeArenaLayout(
          this.battle.allies.length,
          this.battle.foes.length,
          w,
          h
        );
        this.battle.foes.forEach((u, i) => {
          const pos = layout.foes[i] || { x: w * 0.7, y: h * 0.3, depth: 12, scale: 0.75 };
          const spr = this._spawnUnit(u, pos);
          this.unitSprites.foes.push(spr);
        });
        this.battle.allies.forEach((u, i) => {
          const pos = layout.allies[i] || { x: w * 0.25, y: h * 0.62, depth: 55, scale: 1 };
          const spr = this._spawnUnit(u, pos);
          this.unitSprites.allies.push(spr);
        });
        this._hideBattleLoad(() => {
          this._battleReady = true;
          this.busy = false;
          this._maybeBattleCoach();
          this.time.delayedCall(120, () => this._beginTurn());
        });
      }
      // Raid-style top chrome: zone label + turn-order strip
      this.modeBadge = null;
      this.statusText = null;
      this._buildRaidTopChrome(w, h);
      const bootMsg = document.getElementById('boot-msg');
      if (bootMsg) {
        bootMsg.textContent = this.live3d
          ? 'Combat: LIVE 3D arena (Three.js under HUD)'
          : 'Combat: 2.5D fallback — open console for errors';
        bootMsg.style.color = this.live3d ? '#66cc99' : '#cc6644';
      }

      // Raid skill callout (plate + skill art + name) — hidden until ability fires
      this._calloutParts = [];
      this._buildSkillCalloutChrome(w, h);

      // Auto toggle — Softened Realms medallion (not flat green rect)
      this._buildAutoToggle(w);

      // Back — same danger capsule as mode Village buttons
      if (global.SR_UI && global.SR_UI.addBackButton) {
        global.SR_UI.addBackButton(this, 70, 40, {
          label: '←  Village',
          scene: 'HubScene',
          depth: 200
        });
      }

      this.skillButtons = [];
      this._ensureVfxTextures();
      this._refreshHud();
      // _beginTurn is started after load veil (see revealBattle / 2.5D path)
    }

    /** Full-screen cover while combat art warms — painterly plate + progress bar */
    _showBattleLoad(zoneLabel) {
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      if (this._loadLayer) {
        try { this._loadLayer.destroy(true); } catch (e) { /* ignore */ }
        this._loadLayer = null;
      }
      const layer = this.add.container(0, 0).setDepth(520);
      const dpr = (global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2;

      // Painterly fantasy load plate (assets/ui/battle_load.jpg) — cover crop
      let bg;
      if (this.textures.exists('ui_battle_load')) {
        bg = this.add.image(w / 2, h / 2, 'ui_battle_load').setOrigin(0.5);
        const tw = bg.width || 1920;
        const th = bg.height || 1080;
        const scale = Math.max(w / tw, h / th) * 1.02;
        bg.setScale(scale);
      } else {
        bg = this.add.rectangle(w / 2, h / 2, w + 4, h + 4, 0x06140e, 1);
      }
      const vig = this.add.rectangle(w / 2, h / 2, w + 4, h + 4, 0x04100a, 0.38);
      const bandW = Math.min(w * 0.78, 720);
      const titleBand = this.add.rectangle(w / 2, h / 2 - 8, bandW, 200, 0x06140e, 0.48)
        .setStrokeStyle(1, 0xc9a44a, 0.32);

      const title = this.add.text(w / 2, h / 2 - 58, 'Entering battle', {
        fontFamily: 'Georgia, serif',
        fontSize: '32px',
        color: '#f0ffe8',
        stroke: '#0a2010',
        strokeThickness: 6
      }).setOrigin(0.5);
      if (title.setResolution) title.setResolution(dpr);

      const sub = this.add.text(w / 2, h / 2 - 18, zoneLabel || 'Preparing the field…', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#b8e8c8',
        stroke: '#000',
        strokeThickness: 4
      }).setOrigin(0.5);
      if (sub.setResolution) sub.setResolution(dpr);

      // Loading bar track + fill
      const barW = Math.min(bandW - 80, 520);
      const barH = 16;
      const barY = h / 2 + 28;
      const track = this.add.rectangle(w / 2, barY, barW, barH, 0x0a1a12, 0.95)
        .setStrokeStyle(2, 0xc9a44a, 0.55);
      const fill = this.add.rectangle(w / 2 - barW / 2 + 2, barY, 4, barH - 6, 0x55dd88, 1)
        .setOrigin(0, 0.5);
      const pctTxt = this.add.text(w / 2, barY + 28, '0%', {
        fontFamily: 'system-ui',
        fontSize: '14px',
        color: '#88e0a8',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3
      }).setOrigin(0.5);
      if (pctTxt.setResolution) pctTxt.setResolution(dpr);

      const status = this.add.text(w / 2, barY + 52, 'Warming the arena…', {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#9abba8',
        stroke: '#000',
        strokeThickness: 3
      }).setOrigin(0.5);
      if (status.setResolution) status.setResolution(dpr);

      layer.add([bg, vig, titleBand, title, sub, track, fill, pctTxt, status]);
      this._loadLayer = layer;
      this._loadBar = { track: track, fill: fill, pctTxt: pctTxt, status: status, barW: barW, barH: barH };
      this._loadProgress = 0.04;
      this._setBattleLoadProgress(0.04, 'Warming the arena…');

      if (this._loadDotTimer) {
        try { this._loadDotTimer.remove(false); } catch (e2) { /* ignore */ }
      }
      // Smooth creep so the bar never looks stuck while promises resolve
      this._loadDotTimer = this.time.addEvent({
        delay: 90,
        loop: true,
        callback: () => {
          if (!this._loadBar || this._battleReady) return;
          const cur = this._loadProgress || 0;
          if (cur < 0.88) {
            const creep = 0.008 + (0.88 - cur) * 0.012;
            this._setBattleLoadProgress(Math.min(0.88, cur + creep), null);
          }
        }
      });
    }

    /**
     * Update battle load bar (0–1) and optional status label.
     */
    _setBattleLoadProgress(p, statusMsg) {
      this._loadProgress = Math.max(0, Math.min(1, p == null ? this._loadProgress : p));
      const bar = this._loadBar;
      if (!bar || !bar.fill) return;
      const inner = Math.max(4, (bar.barW - 4) * this._loadProgress);
      bar.fill.width = inner;
      bar.fill.x = this.cameras.main.width / 2 - bar.barW / 2 + 2;
      if (bar.pctTxt) bar.pctTxt.setText(Math.floor(this._loadProgress * 100) + '%');
      if (statusMsg != null && bar.status) bar.status.setText(statusMsg);
    }

    _hideBattleLoad(done) {
      if (this._loadDotTimer) {
        try { this._loadDotTimer.remove(false); } catch (e) { /* ignore */ }
        this._loadDotTimer = null;
      }
      const layer = this._loadLayer;
      if (!layer) {
        if (done) done();
        return;
      }
      this.tweens.add({
        targets: layer,
        alpha: 0,
        duration: 340,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          try { layer.destroy(true); } catch (e2) { /* ignore */ }
          if (this._loadLayer === layer) this._loadLayer = null;
          if (done) done();
        }
      });
    }

    update(_t, dt) {
      if (this.live3d && this.world3d) {
        if (this.world3d.syncDomToPhaser) this.world3d.syncDomToPhaser();
        this.world3d.tick((dt || 16) / 1000);
        this._sync3dHud();
        this._syncTargetMarkers();
      }
    }

    _teardown3d() {
      if (this.world3d) {
        try { this.world3d.dispose(); } catch (e) {}
        this.world3d = null;
      }
      this.live3d = false;
      // Resume portrait gel loop for hub/detail
      if (global.SR_SLIME3D && global.SR_SLIME3D.startLoop && this.game) {
        try { global.SR_SLIME3D.startLoop(this.game); } catch (e) {}
      }
    }

    _rarityStroke(unit) {
      const map = {
        Common: 0x9ca3af, Uncommon: 0x4ade80, Rare: 0x60a5fa,
        Epic: 0xc084fc, Legendary: 0xf59e0b, Mythic: 0xf472b6
      };
      return map[unit && unit.rarity] || (unit && unit.isFoe ? 0xaa5544 : 0x55aa77);
    }

    /**
     * Raid-style HP: fixed bar width, each box ≈ fixed HP chunk (250 HP).
     * Higher maxHp → more / smaller boxes (same total width, denser).
     */
    _hpSegmentLayout(maxHp, barW) {
      const SEG_HP = 250; // one pip per ~250 HP (Raid-like chunk scale)
      const gap = 1.5;
      // Cap density so pips stay readable; very high HP still densifies
      const n = Math.max(1, Math.min(36, Math.ceil(Math.max(1, maxHp) / SEG_HP)));
      const boxW = Math.max(3, (barW - gap * (n - 1)) / n);
      return { n, boxW, gap, segHp: SEG_HP, barW };
    }

    /** Build / rebuild segment rects under a unit sprite handle */
    _buildHpBoxes(s, x, y) {
      if (s.hpBoxes) {
        s.hpBoxes.forEach((b) => { try { b.destroy(); } catch (e) { /* */ } });
      }
      s.hpBoxes = [];
      const u = s.unit;
      const barW = s.barW || 100;
      const layout = this._hpSegmentLayout(u.maxHp || 1, barW);
      s.hpLayout = layout;
      const fillCol = u.isFoe ? 0xe83a4a : 0x3dcc7a;
      const emptyCol = 0x121816;
      const left = x - barW / 2;
      const boxH = 10;
      for (let i = 0; i < layout.n; i++) {
        const bx = left + i * (layout.boxW + layout.gap) + layout.boxW / 2;
        const box = this.add.rectangle(bx, y, layout.boxW, boxH, emptyCol, 0.95)
          .setStrokeStyle(1, 0x000000, 0.65)
          .setDepth(201);
        box.setData('fillCol', fillCol);
        box.setData('emptyCol', emptyCol);
        s.hpBoxes.push(box);
      }
      // thin outer frame
      if (s.hpFrame) {
        try { s.hpFrame.destroy(); } catch (e2) { /* */ }
      }
      s.hpFrame = this.add.rectangle(x, y, barW + 5, boxH + 4, 0x000000, 0.4)
        .setStrokeStyle(1, 0x2a3a30, 0.75)
        .setDepth(200);
    }

    _updateHpBoxes(s) {
      if (!s.hpBoxes || !s.hpBoxes.length || !s.unit) return;
      const u = s.unit;
      const layout = s.hpLayout || this._hpSegmentLayout(u.maxHp || 1, s.barW || 100);
      const hp = Math.max(0, u.hp || 0);
      // Fill from left: each box is one 250-HP chunk; last partial dims
      const filled = hp / layout.segHp;
      const ratio = u.maxHp > 0 ? hp / u.maxHp : 0;
      // Low HP warning tint (Raid-like urgency)
      const lowHp = ratio > 0 && ratio <= 0.28;
      for (let i = 0; i < s.hpBoxes.length; i++) {
        const box = s.hpBoxes[i];
        let fillCol = box.getData('fillCol') || 0x3dcc7a;
        if (lowHp) fillCol = u.isFoe ? 0xff6644 : 0xe8c040;
        const emptyCol = box.getData('emptyCol') || 0x121816;
        if (filled >= i + 1) {
          box.setFillStyle(fillCol, 0.98);
          box.setAlpha(1);
        } else if (filled > i) {
          const t = filled - i;
          box.setFillStyle(fillCol, 0.32 + 0.66 * t);
          box.setAlpha(1);
        } else {
          box.setFillStyle(emptyCol, 0.92);
          box.setAlpha(u.alive === false ? 0.22 : 0.88);
        }
      }
    }

    /**
     * Raid HUD for live 3D — nameplate + rarity accent + HP pips + numbers + turn meter.
     * (Highest RSL-readability lever: units must be identifiable without the log.)
     */
    /**
     * Screen-space nameplate layout from projected feet.
     * Small gels get more clearance under the body; tall champs stay compact.
     */
    _hudLayoutFromProject(p) {
      p = p || {};
      const footY = p.y != null ? p.y : 400;
      const bodyPx = p.bodyPx != null ? p.bodyPx : 90;
      // Clearance below feet: scale with size so tiny gels aren't half-covered
      // Small body (~40–70px) → larger gap; tall (~140px+) → modest gap
      const clear = Math.round(
        Math.max(22, Math.min(48, 56 - bodyPx * 0.18))
      );
      const nameY = footY + clear + 16;
      const barY = nameY + 22;
      return {
        x: p.x != null ? p.x : 400,
        footY: footY,
        nameY: nameY,
        barY: barY,
        bodyPx: bodyPx,
        clear: clear
      };
    }

    _spawnUnitLive(unit) {
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const p = (this.world3d && this.world3d.project(unit.id)) || {
        x: unit.isFoe ? w * 0.7 : w * 0.3,
        y: unit.isFoe ? h * 0.35 : h * 0.6,
        bodyPx: 90
      };
      const lay = this._hudLayoutFromProject(p);
      const pos = { x: lay.x, y: lay.footY, depth: unit.isFoe ? 20 : 60, scale: 1 };
      const img = this.add.circle(pos.x, pos.y, 4, 0xffffff, 0).setDepth(pos.depth);
      const barW = 122;
      const nameY = lay.nameY;
      const barY = lay.barY;
      const rarCol = this._rarityStroke(unit);
      const dpr = (global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2;

      // Active-turn ground ellipse at feet
      const turnRing = this.add.ellipse(pos.x, lay.footY + 4, 58, 18, 0xffee88, 0)
        .setStrokeStyle(2.5, 0xffee88, 0).setDepth(197);

      // Nameplate plate (soft dark card under name) — below feet
      const plate = this.add.rectangle(pos.x, nameY + 2, barW + 16, 48, 0x060c0a, 0.55)
        .setStrokeStyle(1.5, rarCol, 0.75)
        .setDepth(198);

      const name = this.add.text(pos.x, nameY - 6, unit.name || (unit.isFoe ? 'Foe' : 'Gel'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: unit.isFoe ? '#ffc8c0' : '#d8ffe8',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: barW + 8 }
      }).setOrigin(0.5).setDepth(202);
      if (name.setResolution) name.setResolution(dpr);

      // Rarity / element micro-tag
      const tag = this.add.text(pos.x, nameY + 10, (unit.rarity || 'Common') + ' · ' + (unit.element || ''), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: unit.isFoe ? '#e8a090' : '#a8d4b8',
        stroke: '#000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(202);
      if (tag.setResolution) tag.setResolution(dpr);

      const s = {
        unit, img, name, tag, plate,
        hpBg: null, hpFill: null, hpText: null,
        tmBg: null, tmFill: null, turnRing,
        hpBoxes: [], hpFrame: null, hpLayout: null,
        pos, live3d: true, plateW: barW + 16, barW,
        _hudBodyPx: lay.bodyPx
      };
      this._buildHpBoxes(s, pos.x, barY);
      this._updateHpBoxes(s);

      // Numeric HP (Raid-style absolute read)
      s.hpText = this.add.text(pos.x + barW / 2 + 4, barY, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#e8fff0',
        stroke: '#000',
        strokeThickness: 3
      }).setOrigin(0, 0.5).setDepth(203);
      if (s.hpText.setResolution) s.hpText.setResolution(dpr);
      this._updateHpNumber(s);

      s.tmBg = this.add.rectangle(pos.x, barY + 12, barW, 5, 0x0c1018, 0.9)
        .setStrokeStyle(1, 0x1a2430, 0.8).setDepth(200);
      s.tmFill = this.add.rectangle(pos.x - barW / 2, barY + 12, 0, 3, 0x5a9eef)
        .setOrigin(0, 0.5).setDepth(201);
      return s;
    }

    _updateHpNumber(s) {
      if (!s || !s.hpText || !s.unit) return;
      const u = s.unit;
      const hp = Math.max(0, Math.floor(u.hp || 0));
      const max = Math.max(1, Math.floor(u.maxHp || 1));
      s.hpText.setText(hp + '/' + max);
      const ratio = hp / max;
      s.hpText.setColor(ratio <= 0.28 ? '#ffcc66' : (u.isFoe ? '#ffd0c8' : '#e8fff0'));
    }

    _sync3dHud() {
      if (!this.world3d) return;
      const all = this.unitSprites.allies.concat(this.unitSprites.foes);
      all.forEach((s) => {
        if (!s || !s.unit) return;
        const p = this.world3d.project(s.unit.id);
        if (!p) return;
        const lay = this._hudLayoutFromProject(p);
        s.pos.x = lay.x;
        s.pos.y = lay.footY;
        s._hudBodyPx = lay.bodyPx;
        if (s.img) s.img.setPosition(lay.x, lay.footY);
        const nameY = lay.nameY;
        const barY = lay.barY;
        const barW = s.barW || 122;
        if (s.turnRing) s.turnRing.setPosition(lay.x, lay.footY + 4);
        if (s.plate) s.plate.setPosition(lay.x, nameY + 2);
        if (s.name) s.name.setPosition(lay.x, nameY - 6);
        if (s.tag) s.tag.setPosition(lay.x, nameY + 10);
        if (s.hpFrame) s.hpFrame.setPosition(lay.x, barY);
        if (s.hpBoxes && s.hpBoxes.length) {
          const layout = s.hpLayout || this._hpSegmentLayout(s.unit.maxHp || 1, barW);
          const left = lay.x - barW / 2;
          for (let i = 0; i < s.hpBoxes.length; i++) {
            const bx = left + i * (layout.boxW + layout.gap) + layout.boxW / 2;
            s.hpBoxes[i].setPosition(bx, barY);
          }
        }
        if (s.hpText) s.hpText.setPosition(lay.x + barW / 2 + 4, barY);
        if (s.tmBg) s.tmBg.setPosition(lay.x, barY + 12);
        if (s.tmFill) s.tmFill.setPosition(lay.x - barW / 2, barY + 12);
        // Keep status chips under the moving nameplate
        if (s._statusIcons && s._statusIcons.length && s.unit) {
          this._updateStatusIcons(s, s.unit);
        }
      });
    }

    /**
     * Top chrome: zone name + Raid-style turn-order portrait strip.
     */
    _buildRaidTopChrome(w, h) {
      const dpr = (global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2;
      const zone = this._battleLocationName ? this._battleLocationName() : 'Battle';

      // Soft top band (does not dim the arena mid-field)
      this._raidTopBand = this.add.rectangle(w / 2, 28, w, 72, 0x040a08, 0.42).setDepth(190);

      this._zoneTitle = this.add.text(w / 2, 18, zone, {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#e8ffd4',
        stroke: '#0a2010',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(195);
      if (this._zoneTitle.setResolution) this._zoneTitle.setResolution(dpr);

      this._zoneSub = this.add.text(w / 2, 36, 'Turn order', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#88aa99',
        stroke: '#000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(195);
      if (this._zoneSub.setResolution) this._zoneSub.setResolution(dpr);

      this._turnStripNodes = [];
      this._turnStripY = 58;
    }

    /** Unit combat speed for turn preview (respects chill/root). */
    _unitCombatSpeed(u) {
      if (!u) return 100;
      if (global.SR_COMBAT && typeof global.SR_COMBAT.effectiveSpeed === 'function') {
        return global.SR_COMBAT.effectiveSpeed(u);
      }
      return u.speed || (u.attributes && u.attributes.spd) || 100;
    }

    /** Predicted turn order from current meters + speed (Raid strip feel). */
    _getTurnOrderPreview(limit) {
      limit = limit || 8;
      if (!this.battle) return [];
      const living = []
        .concat(this.battle.allies || [])
        .concat(this.battle.foes || [])
        .filter((u) => u && u.alive !== false);
      const full = (global.SR_COMBAT && global.SR_COMBAT.TURN_METER_FULL) || 100;
      return living.slice().sort((a, b) => {
        const ta = a.turnMeter || 0;
        const tb = b.turnMeter || 0;
        // Units already at full meter act first
        const ra = ta >= full ? 2 : 1;
        const rb = tb >= full ? 2 : 1;
        if (rb !== ra) return rb - ra;
        if (tb !== ta) return tb - ta;
        return this._unitCombatSpeed(b) - this._unitCombatSpeed(a);
      }).slice(0, limit);
    }

    _refreshTurnStrip() {
      (this._turnStripNodes || []).forEach((n) => {
        try {
          if (n && n._maskGfx) { try { n._maskGfx.destroy(); } catch (eM) { /* */ } }
          if (n && n.destroy) n.destroy();
        } catch (e) { /* */ }
      });
      this._turnStripNodes = [];
      if (!this.battle) return;

      const order = this._getTurnOrderPreview(8);
      if (!order.length) return;
      const w = this.cameras.main.width;
      const y = this._turnStripY || 58;
      const size = 40;
      const gap = 10;
      const totalW = order.length * size + (order.length - 1) * gap;
      let x = w / 2 - totalW / 2 + size / 2;
      const actor = this.battle.currentActor;
      const dpr = (global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2;

      // Soft tray under portraits
      const tray = this.add.rectangle(w / 2, y, totalW + 28, size + 22, 0x040a08, 0.5)
        .setStrokeStyle(1.5, 0xc9a44a, 0.35)
        .setDepth(195);
      this._turnStripNodes.push(tray);

      order.forEach((u, i) => {
        const isAct = !!(actor && (actor === u || actor.id === u.id));
        const rar = this._rarityStroke(u);
        const foeCol = 0xcc5544;
        const ringCol = isAct ? 0xffee88 : (u.isFoe ? foeCol : rar);
        const ring = this.add.circle(x, y, size / 2 + 2.5, 0x000000, 0)
          .setStrokeStyle(isAct ? 3.5 : 2, ringCol, isAct ? 1 : 0.8)
          .setDepth(196);
        this._turnStripNodes.push(ring);

        // Mini portrait: ally gel / enemy kind plate / tint fallback
        let face;
        const gelKey = 'slime_' + String(u.element || 'water').toLowerCase();
        const enemyKey = u.enemyKind ? ('enemy_' + String(u.enemyKind).toLowerCase()) : null;
        const texKey = (!u.isFoe && this.textures.exists(gelKey))
          ? gelKey
          : (enemyKey && this.textures.exists(enemyKey) ? enemyKey : null);
        if (texKey) {
          face = this.add.image(x, y, texKey).setDisplaySize(size - 2, size - 2).setDepth(197);
          try {
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffffff);
            g.fillCircle(x, y, size / 2 - 2);
            face.setMask(g.createGeometryMask());
            face._maskGfx = g;
          } catch (eM) { /* ok */ }
        } else {
          const tint = (global.SR_UI && global.SR_UI.ELEMENT_TINT &&
            global.SR_UI.ELEMENT_TINT[u.element]) || (u.isFoe ? 0x884444 : 0x2e7d32);
          face = this.add.circle(x, y, size / 2 - 2, tint, 0.95).setDepth(197);
        }
        this._turnStripNodes.push(face);

        // Order index (RSL-style sequence)
        const num = this.add.text(x - size / 2 + 2, y - size / 2 + 1, String(i + 1), {
          fontFamily: 'system-ui', fontSize: '10px', fontStyle: 'bold',
          color: isAct ? '#ffee88' : '#c8d8cc',
          stroke: '#000', strokeThickness: 3
        }).setOrigin(0, 0).setDepth(199);
        if (num.setResolution) num.setResolution(dpr);
        this._turnStripNodes.push(num);

        if (i === 0 || isAct) {
          const lab = this.add.text(x, y + size / 2 + 7, isAct ? 'NOW' : 'NEXT', {
            fontFamily: 'system-ui', fontSize: '9px', fontStyle: 'bold',
            color: isAct ? '#ffee88' : '#88ccaa',
            stroke: '#000', strokeThickness: 2
          }).setOrigin(0.5, 0).setDepth(198);
          if (lab.setResolution) lab.setResolution(dpr);
          this._turnStripNodes.push(lab);
        }

        if (isAct && this.tweens) {
          this.tweens.add({
            targets: ring, scaleX: 1.14, scaleY: 1.14,
            duration: 380, yoyo: true, repeat: -1
          });
        }
        x += size + gap;
      });
    }

    /** Runtime particle/spark textures for fancy combat VFX */
    _ensureVfxTextures() {
      if (this.textures.exists('vfx_spark')) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      // Soft spark
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 7);
      g.generateTexture('vfx_spark', 16, 16);
      g.clear();
      // Soft glow blob
      g.fillStyle(0xffffff, 1);
      g.fillCircle(16, 16, 14);
      g.generateTexture('vfx_glow', 32, 32);
      g.clear();
      // Diamond shard
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(8, 0, 16, 16, 0, 16);
      g.generateTexture('vfx_shard', 16, 16);
      g.destroy();
    }

    _spawnUnit(unit, pos) {
      // Larger realistic figures at 1080p
      const size = 160 * pos.scale;
      let img;
      const isHardFoe = !!(unit.isFoe && (unit.isEnemy || unit.enemyKind));
      if (!isHardFoe && global.SR_UI && global.SR_UI.addSlimePortrait) {
        // Allies: 3D gel, no badge ring
        const portrait = global.SR_UI.addSlimePortrait(this, pos.x, pos.y, size, unit.element, pos.depth, {
          mode: 'badge',
          ring: false,
          artVariant: unit.artVariant,
          champ: unit,
          // No stars on combat sprites — only UI portraits/badges
          showStars: false
        });
        img = portrait;
      } else if (isHardFoe) {
        // 2.5D fallback: angular hard-realm mark (not a slime badge)
        const col = (global.SR_UI && global.SR_UI.ELEMENT_TINT &&
          global.SR_UI.ELEMENT_TINT[unit.element]) || 0x884444;
        img = this.add.container(pos.x, pos.y).setDepth(pos.depth);
        const body = this.add.rectangle(0, 4, size * 0.55, size * 0.65, col, 0.95)
          .setStrokeStyle(3, 0xffccaa);
        const head = this.add.rectangle(0, -size * 0.28, size * 0.38, size * 0.32, col, 0.95)
          .setStrokeStyle(2, 0xffe8c8);
        img.add([body, head]);
      } else {
        const key = 'slime_' + String(unit.element || 'water').toLowerCase();
        if (this.textures.exists(key)) {
          img = this.add.image(pos.x, pos.y, key).setDisplaySize(size, size).setDepth(pos.depth);
        } else {
          img = this.add.circle(pos.x, pos.y, size * 0.4, unit.isFoe ? 0x884444 : 0x2e7d32)
            .setStrokeStyle(2, 0x77ffaa).setDepth(pos.depth);
        }
      }
      // Name + segmented HP bar under (same 250-HP pips as live 3D)
      const barY = pos.y + size * 0.52;
      const barW = 100;
      const name = this.add.text(pos.x, barY, unit.name || 'Foe', {
        fontFamily: 'system-ui', fontSize: '12px', color: unit.isFoe ? '#ffaaaa' : '#aaffcc',
        stroke: '#000', strokeThickness: 3,
        align: 'center', wordWrap: { width: 110 }
      }).setOrigin(0.5).setDepth(pos.depth + 5);
      const tmBg = this.add.rectangle(pos.x, barY + 26, barW, 5, 0x222233).setDepth(pos.depth + 5);
      const tmFill = this.add.rectangle(pos.x - barW / 2, barY + 26, 0, 3, 0x88aaff)
        .setOrigin(0, 0.5).setDepth(pos.depth + 6);
      const s = {
        unit, img, name, hpBg: null, hpFill: null, tmBg, tmFill, pos,
        hpBoxes: [], hpFrame: null, hpLayout: null, barW, live3d: false
      };
      this._buildHpBoxes(s, pos.x, barY + 14);
      // Raise segment depth above nameplate art
      if (s.hpBoxes) s.hpBoxes.forEach((b) => b.setDepth(pos.depth + 6));
      if (s.hpFrame) s.hpFrame.setDepth(pos.depth + 5);
      this._updateHpBoxes(s);
      return s;
    }

    _refreshHud() {
      const barWDefault = this.live3d ? 122 : 76;
      const actor = this.battle && this.battle.currentActor;
      const all = this.unitSprites.allies.concat(this.unitSprites.foes);
      all.forEach((s) => {
        const u = s.unit;
        if (!u) return;
        const barW = s.barW || barWDefault;

        // Rebuild boxes if maxHp segment count changed (level-up rare mid-fight)
        if (s.hpBoxes) {
          const want = this._hpSegmentLayout(u.maxHp || 1, barW).n;
          if (want !== s.hpBoxes.length && s.pos) {
            const by = s.live3d
              ? ((s.pos.y || 0) + 54)
              : ((s.pos.y || 0) + (s.pos.scale ? 160 * s.pos.scale * 0.52 : 80) + 14);
            this._buildHpBoxes(s, s.pos.x, by);
            if (!s.live3d && s.pos) {
              const d = (s.pos.depth || 50) + 6;
              if (s.hpBoxes) s.hpBoxes.forEach((b) => b.setDepth(d));
              if (s.hpFrame) s.hpFrame.setDepth(d - 1);
            }
          }
          this._updateHpBoxes(s);
        } else if (s.hpFill) {
          const ratio = u.maxHp > 0 ? u.hp / u.maxHp : 0;
          this.tweens.add({
            targets: s.hpFill,
            width: Math.max(0, barW * ratio),
            duration: 180,
            ease: 'Quad.easeOut'
          });
          s.hpFill.setFillStyle(u.isFoe ? 0xff3355 : 0x33ee88);
        }
        this._updateHpNumber(s);

        const tm = Math.min(1, (u.turnMeter || 0) / global.SR_COMBAT.TURN_METER_FULL);
        if (s.tmFill) s.tmFill.width = Math.max(0, barW * tm);

        const isActive = !!(actor && u && (actor === u || actor.id === u.id) && u.alive);
        if (s.turnRing) {
          s.turnRing.setStrokeStyle(2.5, 0xffee88, isActive ? 0.95 : 0);
          if (isActive) {
            s.turnRing.setScale(1);
            if (!s._turnPulse) {
              s._turnPulse = this.tweens.add({
                targets: s.turnRing, scaleX: 1.2, scaleY: 1.2, alpha: 0.55,
                yoyo: true, repeat: -1, duration: 420
              });
            }
          } else if (s._turnPulse) {
            s._turnPulse.stop();
            s._turnPulse = null;
            s.turnRing.setAlpha(1);
          }
        }
        // Nameplate rarity stroke brightens on active turn (RSL "who's acting")
        if (s.plate && s.plate.setStrokeStyle) {
          const rar = this._rarityStroke(u);
          s.plate.setStrokeStyle(isActive ? 2.5 : 1.5, isActive ? 0xffee88 : rar, isActive ? 1 : 0.75);
          s.plate.setFillStyle(0x060c0a, isActive ? 0.72 : 0.55);
          if (isActive && !s._platePulse && this.tweens) {
            s._platePulse = this.tweens.add({
              targets: s.plate, scaleX: 1.045, scaleY: 1.06,
              duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
          } else if (!isActive && s._platePulse) {
            try { s._platePulse.stop(); } catch (ePl) { /* */ }
            s._platePulse = null;
            s.plate.setScale(1);
          }
        }
        if (s.name && isActive) {
          s.name.setColor('#ffeeaa');
        } else if (s.name) {
          s.name.setColor(u.isFoe ? '#ffc8c0' : '#d8ffe8');
        }

        if (this.live3d && this.world3d) {
          this.world3d.setAlive(u.id, !!u.alive);
        } else if (s.img && s.img.setAlpha) {
          s.img.setAlpha(u.alive ? 1 : 0.28);
        }

        // Status icon row under HP (burn / poison / ward …)
        this._updateStatusIcons(s, u);

        const hudBits = []
          .concat(s.hpBoxes || [])
          .concat([s.hpFrame, s.tmBg, s.tmFill, s.hpBg, s.hpFill, s.plate, s.name, s.tag, s.hpText]);
        if (!u.alive) {
          hudBits.forEach((o) => { if (o && o.setAlpha) o.setAlpha(0.22); });
          if (s.turnRing) s.turnRing.setStrokeStyle(0, 0, 0);
        } else {
          hudBits.forEach((o) => {
            if (!o || !o.setAlpha) return;
            if (o === s.plate) o.setAlpha(isActive ? 0.72 : 0.55);
            else o.setAlpha(1);
          });
          if (s.tmBg) s.tmBg.setAlpha(0.9);
        }
      });

      // Raid turn-order strip
      try { this._refreshTurnStrip(); } catch (eTs) { /* ignore */ }
    }

    _updateStatusIcons(spr, unit) {
      if (!spr) return;
      const statuses = (unit && unit.alive && unit.statuses) || [];
      if (!spr._statusIcons) spr._statusIcons = [];
      // Clear old
      spr._statusIcons.forEach((t) => { try { t.destroy(); } catch (e) { /* */ } });
      spr._statusIcons = [];
      if (!statuses.length || !spr.pos) return;
      const baseX = spr.pos.x;
      // live3d pos.y is feet; chips sit under the HP / turn-meter row
      let baseY;
      if (spr.live3d) {
        const lay = this._hudLayoutFromProject({
          x: spr.pos.x,
          y: spr.pos.y,
          bodyPx: spr._hudBodyPx != null ? spr._hudBodyPx : 90
        });
        baseY = lay.barY + 26;
      } else {
        baseY = (spr.pos.y || 0) + (spr.pos.scale ? 160 * spr.pos.scale * 0.52 : 80) + 34;
      }
      const d = (spr.pos.depth || 50) + 12;
      const dpr = (global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2;
      const n = Math.min(4, statuses.length);
      const startX = baseX - ((n - 1) * 24) / 2;
      statuses.slice(0, 4).forEach((st, i) => {
        const col = (st.color != null) ? st.color : 0x886644;
        const px = startX + i * 24;
        // Colored pill disc (Raid debuff chip)
        const disc = this.add.circle(px, baseY, 11, col, 0.92)
          .setStrokeStyle(1.5, 0x000000, 0.65)
          .setDepth(d);
        const label = (st.icon || '•');
        const txt = this.add.text(px, baseY - 1, label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2
        }).setOrigin(0.5).setDepth(d + 1);
        if (txt.setResolution) txt.setResolution(dpr);
        spr._statusIcons.push(disc, txt);
        if (st.duration > 1) {
          const dur = this.add.text(px + 7, baseY + 6, String(st.duration), {
            fontFamily: 'system-ui', fontSize: '9px', fontStyle: 'bold',
            color: '#ffe8a0', stroke: '#000', strokeThickness: 2
          }).setOrigin(0.5).setDepth(d + 2);
          if (dur.setResolution) dur.setResolution(dpr);
          spr._statusIcons.push(dur);
        }
      });
    }

    _clearSkillButtons() {
      (this.skillButtons || []).forEach((b) => {
        try {
          if (b && b._maskGfx) {
            try { b._maskGfx.destroy(); } catch (eM) { /* */ }
          }
          if (b && b.destroy) b.destroy();
        } catch (e) { /* ignore */ }
      });
      this.skillButtons = [];
      this._skillWheel = null;
    }

    /**
     * Map skill → category family (fallback when unique art missing).
     */
    _skillArtCategory(sk) {
      const id = String((sk && sk.id) || 'basic');
      const def = (global.SR_DATA && global.SR_DATA.SKILL_DEFS && global.SR_DATA.SKILL_DEFS[id]) || {};
      if (def.artCategory) return def.artCategory;
      if (sk.heal) return 'heal';
      if (id === 'shield' || /shield|buff|guard|barrier/i.test(sk.name || '')) return 'buff';
      if (sk.aoe || /splash|bolt|blaze|poison|inferno|venom|beam|blast/i.test(id + ' ' + (sk.name || ''))) {
        return 'ranged';
      }
      return 'basic';
    }

    /**
     * Phaser texture for a skill circle.
     * Prefer unique artKey / skill id plate, then category, then basic.
     * Path for future champ-unique art: set sk.artKey or SKILL_DEFS[id].artKey.
     */
    _skillCircleTexKey(sk) {
      let cands = null;
      if (global.SR_DATA && global.SR_DATA.skillArtTextureCandidates) {
        cands = global.SR_DATA.skillArtTextureCandidates(sk);
      }
      if (!cands || !cands.length) {
        const id = String((sk && sk.id) || 'basic');
        const def = (global.SR_DATA && global.SR_DATA.SKILL_DEFS && global.SR_DATA.SKILL_DEFS[id]) || {};
        cands = [
          def.artKey ? 'skill_' + def.artKey : null,
          'skill_' + id,
          'skill_' + this._skillArtCategory(sk),
          'skill_basic'
        ].filter(Boolean);
      }
      for (let i = 0; i < cands.length; i++) {
        if (this.textures.exists(cands[i])) return cands[i];
      }
      return null;
    }

    /**
     * Softened Realms AUTO medallion (top-right).
     * Uses skill_auto plate when loaded; gold ring + ON/OFF state.
     */
    _buildAutoToggle(w) {
      const ax = w - 56;
      const ay = 44;
      const R = 26;
      const depth = 200;
      const self = this;
      this._autoParts = [];

      const shadow = this.add.ellipse(ax + 2, ay + R * 0.72, R * 1.7, R * 0.42, 0x000000, 0.4)
        .setDepth(depth);
      this._autoParts.push(shadow);

      // Soft idle glow (brightens when ON)
      this._autoGlow = this.add.circle(ax, ay, R + 10, 0xc9a44a, 0.1).setDepth(depth);
      this._autoParts.push(this._autoGlow);

      let icon;
      if (this.textures.exists('skill_auto')) {
        icon = this.add.image(ax, ay, 'skill_auto').setDisplaySize(R * 2.05, R * 2.05).setDepth(depth + 1);
        try {
          const maskG = this.make.graphics({ x: 0, y: 0, add: false });
          maskG.fillStyle(0xffffff);
          maskG.fillCircle(ax, ay, R - 1);
          icon.setMask(maskG.createGeometryMask());
          icon._maskGfx = maskG;
        } catch (eM) { /* unmasked ok */ }
      } else {
        icon = this.add.circle(ax, ay, R, 0x12161c, 0.95).setDepth(depth + 1);
      }
      this.autoIcon = icon;
      this._autoParts.push(icon);

      this._autoRing = this.add.circle(ax, ay, R + 1, 0x000000, 0)
        .setStrokeStyle(3, 0xc9a44a, 0.9).setDepth(depth + 2);
      this._autoParts.push(this._autoRing);
      this._autoInner = this.add.circle(ax, ay, R - 4, 0x000000, 0)
        .setStrokeStyle(1.5, 0xe8d5a0, 0.35).setDepth(depth + 2);
      this._autoParts.push(this._autoInner);

      this.autoLabel = this.add.text(ax, ay + R + 12, 'AUTO', {
        fontFamily: 'system-ui', fontSize: '11px', fontStyle: 'bold',
        color: '#c9a44a', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5, 0).setDepth(depth + 3);
      this._autoParts.push(this.autoLabel);

      this.autoStateLab = this.add.text(ax, ay + R + 26, 'OFF', {
        fontFamily: 'system-ui', fontSize: '10px',
        color: '#8a9090', stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5, 0).setDepth(depth + 3);
      this._autoParts.push(this.autoStateLab);

      this.autoBtn = this.add.circle(ax, ay, R + 8, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true }).setDepth(depth + 4);
      this._autoParts.push(this.autoBtn);

      this.autoBtn.on('pointerover', () => {
        if (this._autoRing) this._autoRing.setStrokeStyle(3.5, 0xffe8a0, 1);
        if (icon.setScale) icon.setScale(1.06);
      });
      this.autoBtn.on('pointerout', () => {
        this._refreshAutoVisual();
        if (icon.setScale) icon.setScale(1);
      });
      this.autoBtn.on('pointerdown', () => {
        this.auto = !this.auto;
        if (this.battle) this.battle.auto = this.auto;
        this._refreshAutoVisual();
        if (this.auto) this._tryContinue();
      });

      this._refreshAutoVisual();
    }

    _refreshAutoVisual() {
      const on = !!this.auto;
      if (this._autoRing) {
        this._autoRing.setStrokeStyle(3, on ? 0x66ffaa : 0xc9a44a, on ? 1 : 0.9);
      }
      if (this._autoGlow) {
        this._autoGlow.setFillStyle(on ? 0x44ff99 : 0xc9a44a, on ? 0.28 : 0.1);
      }
      if (this.autoLabel) {
        this.autoLabel.setColor(on ? '#a8ffd0' : '#c9a44a');
      }
      if (this.autoStateLab) {
        this.autoStateLab.setText(on ? 'ON' : 'OFF');
        this.autoStateLab.setColor(on ? '#88ffbb' : '#8a9090');
      }
      if (this.autoIcon && this.autoIcon.setAlpha) {
        this.autoIcon.setAlpha(on ? 1 : 0.88);
      }
      // Subtle pulse when auto is live
      if (this._autoPulseTween) {
        try { this._autoPulseTween.stop(); } catch (e) { /* */ }
        this._autoPulseTween = null;
      }
      if (on && this._autoGlow && this.tweens) {
        this._autoPulseTween = this.tweens.add({
          targets: this._autoGlow, scaleX: 1.18, scaleY: 1.18, alpha: 0.12,
          duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      } else if (this._autoGlow) {
        this._autoGlow.setScale(1);
      }
    }

    /**
     * Draw radial cooldown pie (remaining fraction covered by dim wedge).
     * fraction 1 = full CD just started; 0 = ready.
     * Sweep clockwise from top (raid-style).
     */
    _drawSkillCdPie(g, x, y, r, fraction) {
      g.clear();
      if (!fraction || fraction <= 0.001) return;
      const f = Math.max(0, Math.min(1, fraction));
      // Full dim plate under pie for readability
      g.fillStyle(0x040a08, 0.38);
      g.fillCircle(x, y, r);
      // Pie wedge of remaining CD (darker)
      g.fillStyle(0x020605, 0.72);
      g.beginPath();
      g.moveTo(x, y);
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * f;
      g.arc(x, y, r + 0.5, start, end, false);
      g.closePath();
      g.fillPath();
    }

    /**
     * Raid HUD: skill circles stacked in the bottom-right corner.
     * Bright skill art always under; CD shows remaining turns + pie dim wipe.
     */
    _showSkillButtons(actor) {
      this._clearSkillButtons();
      if (!actor || actor.isFoe || this.auto) return;
      // Show ALL skills (including CD) — raid bars never hide abilities
      const list = (actor.skills && actor.skills.length) ? actor.skills : [];
      if (!list.length) return;

      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      // Slightly larger skill circles (Raid readability)
      const diam = Math.min(92, Math.max(74, Math.floor(w * 0.074)));
      const gap = 16;
      const marginR = 30;
      const marginB = 28;
      const r = diam / 2;
      const n = list.length;
      const totalW = n * diam + (n - 1) * gap;
      const baseX = w - marginR - totalW + r;
      const y = h - marginB - r;
      const depth = 210;

      // Raid skill dock — soft plate behind the skill row (readability over busy arena)
      const dockW = totalW + 48;
      const dockH = diam + 52;
      const dockX = w - marginR - totalW / 2;
      const dockY = y - 6;
      const dock = this.add.rectangle(dockX, dockY, dockW, dockH, 0x06100c, 0.62)
        .setStrokeStyle(2, 0xc9a44a, 0.55)
        .setDepth(depth - 2);
      const dockSheen = this.add.rectangle(dockX, dockY - dockH * 0.32, dockW - 12, 4, 0xffe08a, 0.12)
        .setDepth(depth - 1);
      this.skillButtons.push(dock, dockSheen);

      // Actor chip above the row
      const chip = this.add.text(w - marginR - 8, y - r - 18, '⚔  ' + (actor.name || 'Champion'), {
        fontFamily: 'system-ui',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffe8a0',
        stroke: '#000',
        strokeThickness: 4
      }).setOrigin(1, 1).setDepth(depth + 4);
      if (chip.setResolution) {
        chip.setResolution((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2);
      }
      this.skillButtons.push(chip);

      // Element / rarity micro line under name
      const meta = this.add.text(w - marginR - 8, y - r - 4,
        (actor.element || '') + ' · ' + (actor.rarity || 'Common'), {
          fontFamily: 'system-ui',
          fontSize: '11px',
          color: '#88ccaa',
          stroke: '#000',
          strokeThickness: 3
        }).setOrigin(1, 1).setDepth(depth + 4);
      if (meta.setResolution) meta.setResolution((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2);
      this.skillButtons.push(meta);

      list.forEach((sk, i) => {
        const x = baseX + i * (diam + gap);
        const ready = !(sk.cooldownLeft > 0);
        const maxCd = Math.max(0, sk.cd || 0);
        const left = Math.max(0, sk.cooldownLeft || 0);
        // Remaining CD fraction for pie (1 = just used / full wait, 0 = ready)
        const frac = maxCd > 0 ? left / maxCd : 0;

        const texKey = this._skillCircleTexKey(sk);
        let icon;
        if (texKey && this.textures.exists(texKey)) {
          icon = this.add.image(x, y, texKey).setDisplaySize(diam, diam).setDepth(depth);
          // Clip magenta studio pad to a circle (unique + category plates)
          try {
            const maskG = this.make.graphics({ x: 0, y: 0, add: false });
            maskG.fillStyle(0xffffff);
            maskG.fillCircle(x, y, r - 0.5);
            icon.setMask(maskG.createGeometryMask());
            icon._maskGfx = maskG;
          } catch (eMask) { /* unmasked */ }
        } else {
          icon = this.add.circle(x, y, r, 0x1a4a32, 1).setStrokeStyle(3, 0xc9a44a).setDepth(depth);
        }
        if (!ready && icon.setAlpha) icon.setAlpha(0.92);

        // Soft ground shadow under skill orb
        const skShadow = this.add.ellipse(x + 1, y + r * 0.72, diam * 0.85, r * 0.4, 0x000000, 0.35)
          .setDepth(depth - 1);

        const hit = this.add.circle(x, y, r + 2, 0xffffff, 0.001).setDepth(depth + 3);
        const ring = this.add.circle(x, y, r + 1, 0x000000, 0)
          .setStrokeStyle(3, ready ? 0xffe088 : 0x445544, ready ? 0.95 : 0.55)
          .setDepth(depth + 1);
        const innerRim = this.add.circle(x, y, r - 3, 0x000000, 0)
          .setStrokeStyle(1.5, ready ? 0xe8d5a0 : 0x334433, ready ? 0.4 : 0.2)
          .setDepth(depth + 1);

        // Cooldown pie — dark wedge shrinks as turns tick down
        const pie = this.add.graphics().setDepth(depth + 2);
        if (!ready && frac > 0) {
          this._drawSkillCdPie(pie, x, y, r - 1, frac);
        }

        let cdNum = null;
        if (!ready && left > 0) {
          cdNum = this.add.text(x, y, String(left), {
            fontFamily: 'Georgia, serif',
            fontSize: String(Math.floor(diam * 0.42)) + 'px',
            fontStyle: 'bold',
            color: '#fff8e0',
            stroke: '#0a1208',
            strokeThickness: 5
          }).setOrigin(0.5).setDepth(depth + 5);
          if (cdNum.setResolution) {
            cdNum.setResolution((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2);
          }
        }

        if (ready) {
          hit.setInteractive({ useHandCursor: true });
          hit.on('pointerover', () => {
            ring.setStrokeStyle(4, 0xffffaa, 1);
            if (icon.setDisplaySize) icon.setDisplaySize(diam * 1.07, diam * 1.07);
          });
          hit.on('pointerout', () => {
            ring.setStrokeStyle(3, 0xffe088, 0.95);
            if (icon.setDisplaySize) icon.setDisplaySize(diam, diam);
          });
          hit.on('pointerdown', () => {
            if (this.busy) return;
            // Raid: skill first → then pick target (not auto-fire)
            this._selectSkillForTargeting(sk, ring, icon, diam);
          });
        }

        // Skill name under orb (Raid-readable)
        const skLab = this.add.text(x, y + r + 12, String(sk.name || sk.id || 'Skill').slice(0, 12), {
          fontFamily: 'system-ui',
          fontSize: '10px',
          color: ready ? '#e8ffe8' : '#889988',
          stroke: '#000',
          strokeThickness: 3,
          align: 'center',
          wordWrap: { width: diam + 8 }
        }).setOrigin(0.5, 0).setDepth(depth + 4);
        if (skLab.setResolution) {
          skLab.setResolution((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2);
        }

        this.skillButtons.push(skShadow, icon, hit, ring, innerRim, pie, skLab);
        if (cdNum) this.skillButtons.push(cdNum);
      });
    }

    /** Clear target reticles (does not clear skill wheel). */
    _clearTargetMarkers() {
      (this._targetMarkers || []).forEach((o) => {
        try { if (o && o.destroy) o.destroy(); } catch (e) { /* */ }
      });
      this._targetMarkers = [];
      if (this._targetHint) {
        try { this._targetHint.destroy(); } catch (e2) { /* */ }
        this._targetHint = null;
      }
      // Strip unit hit zones
      (this.unitSprites.allies || []).concat(this.unitSprites.foes || []).forEach((s) => {
        if (s && s.targetHit) {
          try { s.targetHit.destroy(); } catch (e3) { /* */ }
          s.targetHit = null;
        }
        if (s && s.targetReticle) {
          try { s.targetReticle.destroy(); } catch (e4) { /* */ }
          s.targetReticle = null;
        }
      });
    }

    _cancelTargeting() {
      this._pendingSkill = null;
      this._targetMode = false;
      this._clearTargetMarkers();
      // Restore skill ring highlights
      if (this.battle && this.battle.currentActor && !this.battle.currentActor.isFoe && !this.auto) {
        // leave skills up; status back to turn prompt
        const a = this.battle.currentActor;
        if (this.statusText) this.statusText.setText((a.name || 'Champion') + "'s turn — choose a skill");
      }
    }

    /**
     * Targeting: single-target skills pick one unit; AOE skills fire immediately (no ALL).
     * Damage → foes; heal → allies. Single and area never mix.
     */
    _selectSkillForTargeting(sk, ring, icon, diam) {
      if (!sk || this.busy) return;
      // Toggle off if same skill re-clicked
      if (this._pendingSkill && this._pendingSkill.id === sk.id) {
        this._cancelTargeting();
        if (ring) ring.setStrokeStyle(3, 0xffe088, 0.95);
        return;
      }
      this._clearTargetMarkers();
      this._pendingSkill = sk;
      this._targetMode = true;

      const isHeal = !!sk.heal;
      const isAoe = !!sk.aoe;
      const pool = isHeal
        ? (this.unitSprites.allies || []).filter((s) => s.unit && s.unit.alive)
        : (this.unitSprites.foes || []).filter((s) => s.unit && s.unit.alive);

      if (!pool.length) {
        this._playerAct(sk.id, null);
        return;
      }

      // AOE: no target pick — skill flag owns the multi-hit
      if (isAoe) {
        if (this.statusText) {
          this.statusText.setText(isHeal ? 'Area mend!' : (sk.name || 'AOE') + '!');
        }
        this._playerAct(sk.id, null);
        return;
      }

      // Single living target → no need to pick
      if (pool.length === 1) {
        this._playerAct(sk.id, pool[0].unit.id);
        return;
      }

      if (this.statusText) {
        this.statusText.setText(isHeal ? 'Select ally to heal' : 'Select a target');
      }

      // Highlight armed skill
      if (ring) ring.setStrokeStyle(4, 0x66ffcc, 1);

      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const dpr = (global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2;

      // Cancel hint (no ALL — single-target only)
      const hint = this.add.text(w / 2, h - 100, 'Click one target  ·  skill again to cancel', {
        fontFamily: 'system-ui', fontSize: '12px', color: '#a8c8b0',
        stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(214);
      if (hint.setResolution) hint.setResolution(dpr);
      this._targetHint = hint;
      this._targetMarkers.push(hint);

      // Per-unit reticle + hit area (single target only)
      const reticleCol = isHeal ? 0x66ffaa : 0xff6644;
      pool.forEach((s) => {
        const ux = (s.pos && s.pos.x) || 0;
        const uy = (s.pos && s.pos.y) || 0;
        const ret = this.add.ellipse(ux, uy + 10, 64, 22, reticleCol, 0.12)
          .setStrokeStyle(3, reticleCol, 0.95).setDepth(205);
        this.tweens.add({
          targets: ret, scaleX: 1.12, scaleY: 1.12, alpha: 0.85,
          yoyo: true, repeat: -1, duration: 480
        });
        const hitZ = this.add.circle(ux, uy, 48, 0xffffff, 0.001)
          .setDepth(206).setInteractive({ useHandCursor: true });
        hitZ.on('pointerover', () => ret.setStrokeStyle(4, 0xffff88, 1));
        hitZ.on('pointerout', () => ret.setStrokeStyle(3, reticleCol, 0.95));
        hitZ.on('pointerdown', () => {
          if (this.busy || !this._pendingSkill) return;
          this._playerAct(this._pendingSkill.id, s.unit.id);
        });
        s.targetReticle = ret;
        s.targetHit = hitZ;
        this._targetMarkers.push(ret, hitZ);
      });
    }

    /** Keep target reticles glued to projected unit positions */
    _syncTargetMarkers() {
      if (!this._targetMode) return;
      (this.unitSprites.allies || []).concat(this.unitSprites.foes || []).forEach((s) => {
        if (!s || !s.pos) return;
        if (s.targetReticle) s.targetReticle.setPosition(s.pos.x, s.pos.y + 10);
        if (s.targetHit) s.targetHit.setPosition(s.pos.x, s.pos.y);
      });
    }

    _beginTurn() {
      this._cancelTargeting();
      if (this.battle.status !== 'ongoing') {
        this._endBattle();
        return;
      }
      const actor = global.SR_COMBAT.nextActor(this.battle);
      // DoT / status ticks from turn start
      this._showStatusTicks(this.battle.lastStatusTicks);
      this._refreshHud();
      if (!actor) {
        // Died to DoT mid-turn
        if (this.battle.status !== 'ongoing') {
          this._endBattle();
          return;
        }
        this.time.delayedCall(280, () => this._beginTurn());
        return;
      }
      // statusText was removed from HUD — never call setText on null (froze skill UI)
      if (this.statusText) {
        this.statusText.setText(actor.name + "'s turn" + (actor.isFoe || this.auto ? '' : ' — choose a skill'));
      }
      try {
        if (this.live3d && this.world3d && actor) {
          this.world3d.setActive(actor.id, true);
        }
        const spr = this._findSprite(actor);
        if (spr) {
          this._pulseActor(spr);
        }
      } catch (eBegin) {
        console.warn('[Battle] beginTurn visual', eBegin);
      }

      if (actor.isFoe || this.auto) {
        this.busy = true;
        this._clearSkillButtons();
        this.time.delayedCall(380, () => {
          try {
            global.SR_COMBAT.resolveTurn(this.battle);
            this._playActionVfx(() => this._afterAct());
          } catch (eFoe) {
            console.warn('[Battle] foe act', eFoe);
            this.busy = false;
            this._afterAct();
          }
        });
      } else {
        this.busy = false;
        try {
          this._showSkillButtons(actor);
        } catch (eSk) {
          console.warn('[Battle] skill buttons', eSk);
        }
      }
    }

    _playerAct(skillId, targetId) {
      this.busy = true;
      this._pendingSkill = null;
      this._targetMode = false;
      this._clearTargetMarkers();
      this._clearSkillButtons();
      global.SR_COMBAT.resolveTurn(this.battle, skillId, targetId);
      this._playActionVfx(() => this._afterAct());
    }

    _waveLabel() {
      const wi = (this.battle && this.battle.waveIndex != null)
        ? this.battle.waveIndex
        : this._waveIndex;
      const tw = (this.battle && this.battle.totalWaves) || this._totalWaves || 1;
      return 'WAVE  ' + (wi + 1) + '  /  ' + tw;
    }

    /** First fight / tutorial gel: how to use skills */
    _maybeBattleCoach() {
      const TUT = global.SR_TUTORIAL;
      const state = global.SR_GAME_STATE;
      // Tutorial mini-battles: always tip once per gel
      if (this.battleData.tutorial) {
        if (this._tutorialCoachShown) return;
        this._tutorialCoachShown = true;
        const gel = (this.battleData.party && this.battleData.party[0]) || {};
        const n = (this.battleData.tutorialIndex || 0) + 1;
        const t = this.battleData.tutorialTotal || 4;
        if (TUT && TUT.showTip) {
          TUT.showTip(this, {
            title: 'Trial  ' + n + ' / ' + t + '  ·  ' + (gel.name || 'Gel'),
            body: 'Command ' + (gel.name || 'this gel') + ' alone.\n' +
              'Tap a skill, then the foe. Watch ADV / WEAK.\n' +
              'Win all four trials — then pick one Epic to keep forever.',
            primaryLabel: 'I understand',
            y: this.cameras.main.height * 0.32,
            height: 210,
            depth: 300
          });
        }
        return;
      }
      if (!TUT || !TUT.needsBattleCoach(state)) return;
      TUT.showTip(this, {
        title: 'Your first arena',
        body: 'When a champion is ready, tap a skill — then a foe.\n' +
          'Single-target hits one enemy; area skills hit all.\n' +
          'AUTO finishes fights for you. ADV / WEAK floats show affinity.',
        primaryLabel: 'Fight!',
        y: this.cameras.main.height * 0.32,
        height: 200,
        depth: 300,
        onPrimary: () => {
          if (TUT.markBattleCoachDone) TUT.markBattleCoachDone(state);
        }
      });
    }

    _afterAct() {
      this._refreshHud();
      this.busy = false;
      if (this.battle.status !== 'ongoing') {
        // Mid-dungeon win → next wave instead of results splash
        if (this.battle.status === 'win' && this._hasMoreWaves()) {
          this.time.delayedCall(420, () => this._advanceDungeonWave());
          return;
        }
        this.time.delayedCall(400, () => this._endBattle());
        return;
      }
      this.time.delayedCall(280, () => this._beginTurn());
    }

    _hasMoreWaves() {
      if (!this.battleData.dungeon) return false;
      const wi = this.battle.waveIndex != null ? this.battle.waveIndex : this._waveIndex;
      const tw = this.battle.totalWaves || this._totalWaves || 1;
      return wi + 1 < tw;
    }

    /**
     * Multi-wave dungeon: interstitial banner → soft heal → new foe pack → continue.
     * Party HP carries between waves (Raid-style delve).
     */
    _advanceDungeonWave() {
      if (!this.battleData.dungeon || this._resultsShown) return;
      this.busy = true;
      this._clearSkillButtons();
      this._cancelTargeting && this._cancelTargeting();

      const nextIdx = (this.battle.waveIndex != null ? this.battle.waveIndex : this._waveIndex) + 1;
      const total = this.battle.totalWaves || this._totalWaves || 1;
      const d = this.battleData.dungeon;
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;

      // Interstitial veil + banner
      const veil = this.add.rectangle(w / 2, h / 2, w + 4, h + 4, 0x05080c, 0)
        .setDepth(350);
      this.tweens.add({ targets: veil, alpha: 0.72, duration: 280 });
      const banner = this.add.text(w / 2, h * 0.38, 'WAVE CLEARED', {
        fontFamily: 'Georgia, serif', fontSize: '36px', fontStyle: 'bold',
        color: '#ffe8a0', stroke: '#041208', strokeThickness: 6
      }).setOrigin(0.5).setDepth(351).setAlpha(0).setScale(0.85);
      const sub = this.add.text(w / 2, h * 0.38 + 44,
        'Incoming  ·  Wave ' + (nextIdx + 1) + ' of ' + total, {
          fontFamily: 'system-ui', fontSize: '16px', color: '#c8e0d0',
          stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(351).setAlpha(0);
      if (banner.setResolution) banner.setResolution((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2);
      if (sub.setResolution) sub.setResolution((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2);
      this.tweens.add({
        targets: banner, alpha: 1, scale: 1.05, duration: 320, ease: 'Back.easeOut'
      });
      this.tweens.add({ targets: sub, alpha: 1, delay: 120, duration: 280 });
      this.cameras.main.flash(180, 180, 200, 140);

      // Build next pack while banner plays
      const nextFoes = global.SR_STATE.makeDungeonWaveFoes
        ? global.SR_STATE.makeDungeonWaveFoes(d, nextIdx)
        : global.SR_STATE.makeDungeonFoes(d);

      this.time.delayedCall(1100, () => {
        // Soft heal + replace foes in combat state
        if (global.SR_COMBAT.advanceWave) {
          global.SR_COMBAT.advanceWave(this.battle, nextFoes, {
            healFrac: 0.14,
            totalWaves: total
          });
        } else {
          this.battle.foes = nextFoes.map((s) => global.SR_COMBAT.makeCombatant(s, true));
          this.battle.status = 'ongoing';
          this.battle.waveIndex = nextIdx;
        }
        this._waveIndex = this.battle.waveIndex;
        this._totalWaves = total;

        // Tear down old foe HUD sprites
        (this.unitSprites.foes || []).forEach((s) => {
          try {
            if (s.hpBoxes) s.hpBoxes.forEach((b) => b.destroy());
            if (s.hpFrame) s.hpFrame.destroy();
            if (s.tmBg) s.tmBg.destroy();
            if (s.tmFill) s.tmFill.destroy();
            if (s.turnRing) s.turnRing.destroy();
            if (s.img) s.img.destroy();
            if (s.name) s.name.destroy();
          } catch (eCl) { /* */ }
        });
        this.unitSprites.foes = [];

        // 3D: swap foe plates
        if (this.live3d && this.world3d && this.world3d.replaceFoeTeam) {
          this.world3d.replaceFoeTeam(this.battle.foes);
          this.battle.foes.forEach((u) => {
            const spr = this._spawnUnitLive(u);
            this.unitSprites.foes.push(spr);
          });
          this._sync3dHud();
        } else {
          // 2.5D fallback layout
          const layout = global.SR_COMBAT.computeArenaLayout
            ? global.SR_COMBAT.computeArenaLayout(
              this.battle.allies.length, this.battle.foes.length,
              this.cameras.main.width, this.cameras.main.height
            )
            : null;
          this.battle.foes.forEach((u, i) => {
            const pos = (layout && layout.foes[i]) || {
              x: this.cameras.main.width * 0.7,
              y: this.cameras.main.height * 0.35,
              depth: 20, scale: 0.85
            };
            this.unitSprites.foes.push(this._spawnUnit(u, pos));
          });
        }

        if (this._waveBanner) this._waveBanner.setText(this._waveLabel());

        this.tweens.add({
          targets: [veil, banner, sub], alpha: 0, duration: 320, delay: 80,
          onComplete: () => {
            try { veil.destroy(); banner.destroy(); sub.destroy(); } catch (eD) { /* */ }
            this.busy = false;
            this._refreshHud();
            // Brief beat then next turn
            this.time.delayedCall(200, () => this._beginTurn());
          }
        });
      });
    }

    _tryContinue() {
      if (this.busy || this.battle.status !== 'ongoing') return;
      if (this._targetMode) this._cancelTargeting();
      const actor = this.battle.currentActor;
      if (actor && !actor.isFoe) {
        this.busy = true;
        this._clearSkillButtons();
        global.SR_COMBAT.resolveTurn(this.battle);
        this._playActionVfx(() => this._afterAct());
      }
    }

    _findSprite(unit) {
      if (!unit) return null;
      const all = this.unitSprites.allies.concat(this.unitSprites.foes);
      return all.find((s) => s.unit === unit || (s.unit && s.unit.id === unit.id)) || null;
    }

    _findSpriteById(id) {
      const all = this.unitSprites.allies.concat(this.unitSprites.foes);
      return all.find((s) => s.unit && s.unit.id === id) || null;
    }

    _spriteWorldPos(spr) {
      if (!spr) return { x: this.cameras.main.width / 2, y: this.cameras.main.height / 2 };
      return { x: spr.pos.x, y: spr.pos.y };
    }

    _pulseActor(spr) {
      if (!spr) return;
      if (this.live3d && this.world3d && spr.unit) {
        this.world3d.pulse(spr.unit.id);
        // Soft ground ring in screen space
        const ring = this.add.circle(spr.pos.x, spr.pos.y + 40, 10, 0xffee88, 0.0)
          .setStrokeStyle(3, 0xffee88, 0.85).setDepth(180);
        this.tweens.add({
          targets: ring, scaleX: 3.5, scaleY: 1.4, alpha: 0, duration: 420,
          onComplete: () => ring.destroy()
        });
        return;
      }
      const target = spr.img;
      if (!target) return;
      const ring = this.add.circle(spr.pos.x, spr.pos.y + 8, 8, 0xffee88, 0.0)
        .setStrokeStyle(3, 0xffee88, 0.9).setDepth(spr.pos.depth + 8);
      this.tweens.add({
        targets: ring, scaleX: 3.2, scaleY: 1.6, alpha: 0, duration: 420,
        onComplete: () => ring.destroy()
      });
      this.tweens.add({
        targets: target, scaleX: (target.scaleX || 1) * 1.08, scaleY: (target.scaleY || 1) * 1.08,
        yoyo: true, duration: 160, ease: 'Sine.easeInOut'
      });
    }

    /**
     * Raid-style skill banner: plate + optional skill art circle + skill name + actor.
     */
    _buildSkillCalloutChrome(w, h) {
      const dpr = (global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2;
      const cy = Math.min(148, Math.floor(h * 0.14));
      this._calloutY = cy;
      this._calloutPlate = this.add.rectangle(w / 2, cy, 420, 64, 0x060c0a, 0.82)
        .setStrokeStyle(2.5, 0xc9a44a, 0.9)
        .setDepth(218)
        .setAlpha(0);
      this._calloutSheen = this.add.rectangle(w / 2, cy - 22, 380, 3, 0xffe08a, 0.2)
        .setDepth(219)
        .setAlpha(0);
      this._calloutIconBg = this.add.circle(w / 2 - 150, cy, 26, 0x0a1410, 0.95)
        .setStrokeStyle(2, 0xc9a44a, 0.85)
        .setDepth(219)
        .setAlpha(0);
      this._calloutIcon = this.add.circle(w / 2 - 150, cy, 20, 0x224433, 0.01)
        .setDepth(220)
        .setAlpha(0);
      this.actionCallout = this.add.text(w / 2 + 10, cy - 8, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffe8a0',
        stroke: '#0a2010',
        strokeThickness: 5
      }).setOrigin(0.5).setDepth(221).setAlpha(0);
      if (this.actionCallout.setResolution) this.actionCallout.setResolution(dpr);
      this._calloutActor = this.add.text(w / 2 + 10, cy + 16, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#a8d4b8',
        stroke: '#000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(221).setAlpha(0);
      if (this._calloutActor.setResolution) this._calloutActor.setResolution(dpr);
      this._calloutParts = [
        this._calloutPlate, this._calloutSheen, this._calloutIconBg,
        this._calloutIcon, this.actionCallout, this._calloutActor
      ];
    }

    _showSkillCallout(action) {
      if (!action) return;
      // Ensure chrome exists (live3d / 2.5D both)
      if (!this.actionCallout) {
        this._buildSkillCalloutChrome(this.cameras.main.width, this.cameras.main.height);
      }
      const icon = action.skillIcon || '✨';
      const name = action.skillName || 'Attack';
      const who = action.actorName || '';
      const el = action.actorElement || '';
      this.actionCallout.setText(icon + '  ' + name);
      if (this._calloutActor) {
        this._calloutActor.setText(who + (el ? '  ·  ' + el : ''));
      }

      // Skill art circle when available
      const skId = action.skillId || '';
      let artKey = null;
      if (this.textures.exists('skill_' + skId)) artKey = 'skill_' + skId;
      else if (this.textures.exists('skill_basic') && (skId === 'basic' || /_basic$/.test(skId))) {
        artKey = 'skill_basic';
      } else {
        const cat = this._skillArtCategory
          ? this._skillArtCategory({ id: skId, name: name, heal: action.kind === 'heal' })
          : null;
        if (cat && this.textures.exists('skill_' + cat)) artKey = 'skill_' + cat;
      }
      const w = this.cameras.main.width;
      const cy = this._calloutY || 148;
      if (this._calloutIcon) {
        try { this._calloutIcon.destroy(); } catch (e) { /* */ }
        this._calloutIcon = null;
      }
      if (artKey) {
        this._calloutIcon = this.add.image(w / 2 - 150, cy, artKey)
          .setDisplaySize(48, 48).setDepth(220).setAlpha(0);
        try {
          const g = this.make.graphics({ x: 0, y: 0, add: false });
          g.fillStyle(0xffffff);
          g.fillCircle(w / 2 - 150, cy, 22);
          this._calloutIcon.setMask(g.createGeometryMask());
          this._calloutIcon._maskGfx = g;
        } catch (eM) { /* */ }
      } else {
        this._calloutIcon = this.add.text(w / 2 - 150, cy, icon, {
          fontSize: '28px', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(220).setAlpha(0);
      }

      const parts = [
        this._calloutPlate, this._calloutSheen, this._calloutIconBg,
        this._calloutIcon, this.actionCallout, this._calloutActor
      ].filter(Boolean);
      parts.forEach((p) => {
        if (p.setAlpha) p.setAlpha(1);
        if (p.setScale) p.setScale(0.88);
      });
      this.tweens.add({
        targets: parts, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.easeOut'
      });
      this.tweens.add({
        targets: parts, alpha: 0, delay: 900, duration: 320
      });
    }

    /** Floating combat number over a unit — crit + affinity ADV/WEAK callouts */
    _floatNumber(x, y, amount, opts) {
      opts = opts || {};
      const isHeal = opts.kind === 'heal';
      const isDot = opts.kind === 'dot' || opts.kind === 'status';
      const isBuff = opts.kind === 'buff';
      const isCrit = !!opts.crit;
      const aff = opts.affinity != null ? opts.affinity : 1;
      const tag = opts.affinityTag ||
        (aff > 1.001 ? 'strong' : aff < 0.999 ? 'weak' : 'neutral');
      let color = isHeal ? '#66ffaa' : (isCrit ? '#ffee55' : '#ff6655');
      if (isDot) color = opts.statusColor || '#ff8844';
      if (isBuff) color = '#aaffee';
      if (!isHeal && !isDot && !isBuff && tag === 'strong') color = '#ff9a4a';
      if (!isHeal && !isDot && !isBuff && tag === 'weak') color = '#8aa0ff';
      const prefix = isHeal || isBuff ? '+' : '-';
      let label;
      if (isBuff) {
        label = (opts.statusIcon || '🛡') + ' ' + (opts.statusName || 'Ward');
      } else if (isDot && opts.statusName) {
        label = (opts.statusIcon || '') + ' ' + opts.statusName + ' ' + prefix + amount;
      } else {
        label = (isCrit ? 'CRIT ' : '') + prefix + amount;
        if (!isHeal && tag === 'strong') label += '  ADV';
        if (!isHeal && tag === 'weak') label += '  WEAK';
      }
      const size = isCrit ? 28 : (isHeal || isDot ? 20 : 24);
      const t = this.add.text(x + (Math.random() * 16 - 8), y - 20, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: size + 'px',
        fontStyle: 'bold',
        color: color,
        stroke: '#000000',
        strokeThickness: 5
      }).setOrigin(0.5).setDepth(260);
      if (t.setResolution) t.setResolution((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2);
      this.tweens.add({
        targets: t,
        y: y - 70 - Math.random() * 20,
        alpha: 0,
        scale: isCrit ? 1.35 : (tag === 'strong' ? 1.2 : 1.1),
        duration: isCrit ? 900 : 720,
        ease: 'Cubic.easeOut',
        onComplete: () => t.destroy()
      });
      // Separate ADV/WEAK chip under the number for readability (Raid-style affinity feedback)
      if (!isHeal && !isDot && !isBuff && tag !== 'neutral') {
        const chipColor = tag === 'strong' ? '#ffb070' : '#a8b8ff';
        const chip = this.add.text(x, y + 6, tag === 'strong' ? '▲ STRONG' : '▼ WEAK', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: chipColor,
          stroke: '#000000',
          strokeThickness: 4
        }).setOrigin(0.5).setDepth(261).setAlpha(0.95);
        if (chip.setResolution) chip.setResolution((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2);
        this.tweens.add({
          targets: chip,
          y: y - 36,
          alpha: 0,
          duration: 780,
          ease: 'Cubic.easeOut',
          onComplete: () => chip.destroy()
        });
      }
    }

    /** Show DoT ticks from turn-start status processing */
    _showStatusTicks(ticks) {
      if (!ticks || !ticks.length) return;
      ticks.forEach((tk, i) => {
        this.time.delayedCall(i * 90, () => {
          const tSpr = this._findSpriteById(tk.targetId);
          const p = this._spriteWorldPos(tSpr);
          this._floatNumber(p.x, p.y - 16, tk.amount, {
            kind: 'dot',
            statusName: tk.name,
            statusIcon: tk.icon,
            statusColor: tk.color != null
              ? '#' + (tk.color >>> 0).toString(16).padStart(6, '0')
              : '#ff8844'
          });
          if (tSpr) this._hitFlash(tSpr, tk.color || 0xff6622, false);
          if (this.live3d && this.world3d && this.world3d.impactBurst && tk.targetId != null) {
            this.world3d.impactBurst(tk.targetId, 'Fire', false);
          }
          this._refreshHud();
        });
      });
    }

    /** Status proc chip (BURN! POISON!) above hit target */
    _floatStatusProc(x, y, st) {
      if (!st) return;
      const label = (st.icon || '✨') + ' ' + String(st.name || st.id || 'Status').toUpperCase() + '!';
      const hex = st.color != null
        ? '#' + (st.color >>> 0).toString(16).padStart(6, '0')
        : '#ffaa66';
      const t = this.add.text(x, y - 36, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: hex,
        stroke: '#000000',
        strokeThickness: 5
      }).setOrigin(0.5).setDepth(265);
      if (t.setResolution) t.setResolution((global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) || 2);
      this.tweens.add({
        targets: t,
        y: y - 90,
        alpha: 0,
        scale: 1.25,
        duration: 950,
        ease: 'Cubic.easeOut',
        onComplete: () => t.destroy()
      });
    }

    _elementColor(el) {
      const map = (global.SR_UI && global.SR_UI.ELEMENT_TINT) || {};
      return map[el] || 0x77ffaa;
    }

    _deliveryFor(action) {
      const el = String(action.actorElement || 'Water');
      const id = String(action.skillId || action.skillName || '').toLowerCase();
      if (action.kind === 'heal' || id.indexOf('heal') >= 0 || id.indexOf('mend') >= 0) return 'heal';
      if (action.kind === 'buff' || /guard|shield|veil|shell|cloak|ward/i.test(id)) return 'buff';
      if (action.aoe || id.indexOf('splash') >= 0 || id.indexOf('inferno') >= 0) return 'aoe';
      if (el === 'Lightning' || el === 'Storm' || id.indexOf('bolt') >= 0) return 'beam';
      if (el === 'Earth' || el === 'Metal' || id.indexOf('smash') >= 0 || id.indexOf('crush') >= 0) return 'melee';
      if (el === 'Shadow' || el === 'Poison' || el === 'Void') return 'cloud';
      if (el === 'Fire' || el === 'Lava') return 'projectile';
      return 'projectile';
    }

    _burstParticles(x, y, color, count, opts) {
      opts = opts || {};
      const key = this.textures.exists('vfx_spark') ? 'vfx_spark' : null;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const dist = (opts.dist || 50) * (0.5 + Math.random() * 0.7);
        const px = x + Math.cos(ang) * 4;
        const py = y + Math.sin(ang) * 4;
        let p;
        if (key) {
          p = this.add.image(px, py, key).setTint(color).setDepth(250)
            .setDisplaySize(opts.size || 12, opts.size || 12).setAlpha(0.95);
        } else {
          p = this.add.circle(px, py, (opts.size || 6) / 2, color, 0.95).setDepth(250);
        }
        this.tweens.add({
          targets: p,
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist - (opts.up || 20),
          alpha: 0,
          scale: opts.endScale || 0.2,
          duration: opts.dur || (280 + Math.random() * 200),
          ease: 'Cubic.easeOut',
          onComplete: () => p.destroy()
        });
      }
    }

    _hitFlash(spr, color, crit) {
      if (!spr) return;
      const x = spr.pos.x;
      const y = spr.pos.y;
      if (this.live3d && this.world3d && spr.unit) {
        this.world3d.hitFlash(spr.unit.id, crit);
      }
      const ring = this.add.circle(x, y, 12, color, 0.0)
        .setStrokeStyle(4, color, 0.95).setDepth(248);
      this.tweens.add({
        targets: ring, scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 320,
        onComplete: () => ring.destroy()
      });
      if (this.textures.exists('vfx_glow')) {
        const glow = this.add.image(x, y, 'vfx_glow').setTint(color).setDepth(247)
          .setDisplaySize(40, 40).setAlpha(0.9);
        this.tweens.add({
          targets: glow, scaleX: 3, scaleY: 3, alpha: 0, duration: 300,
          onComplete: () => glow.destroy()
        });
      }
      this._burstParticles(x, y, crit ? 0xffee55 : color, crit ? 16 : 10, {
        dist: crit ? 80 : 55, size: crit ? 16 : 11, up: 30
      });
      if (spr.img && !this.live3d) {
        const baseX = spr.pos.x;
        spr.img.x = baseX;
        this.tweens.add({
          targets: spr.img, x: baseX + (crit ? 14 : 8),
          duration: 35, yoyo: true, repeat: crit ? 4 : 3,
          onComplete: () => { if (spr.img) spr.img.x = baseX; }
        });
      }
      this.cameras.main.shake(crit ? 100 : 60, crit ? 0.006 : 0.003);
    }

    _spawnTrail(x, y, color, life) {
      let p;
      if (this.textures.exists('vfx_glow')) {
        p = this.add.image(x, y, 'vfx_glow').setTint(color).setDepth(238)
          .setDisplaySize(22, 22).setAlpha(0.55);
      } else {
        p = this.add.circle(x, y, 8, color, 0.5).setDepth(238);
      }
      this.tweens.add({
        targets: p, alpha: 0, scale: 0.2, duration: life || 220,
        onComplete: () => p.destroy()
      });
    }

    /** Fancy elemental projectile with trail + particles */
    _projectile(from, to, color, element, onHit) {
      const el = String(element || 'Water');
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const ang = Math.atan2(dy, dx);
      const dur = 260 + Math.random() * 40;

      // Core bolt
      let core;
      if (this.textures.exists('vfx_glow')) {
        core = this.add.image(from.x, from.y, 'vfx_glow').setTint(color).setDepth(242)
          .setDisplaySize(36, 28).setRotation(ang).setAlpha(0.95);
      } else {
        core = this.add.circle(from.x, from.y, 12, color, 0.95)
          .setStrokeStyle(2, 0xffffff, 0.7).setDepth(242);
      }

      // Secondary highlight
      const tip = this.add.circle(from.x, from.y, 5, 0xffffff, 0.85).setDepth(243);

      // Element flavor particles along path
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        this.time.delayedCall((dur * i) / (steps + 1), () => {
          const t = i / (steps + 1);
          const px = from.x + dx * t + (Math.random() * 12 - 6);
          const py = from.y + dy * t + (Math.random() * 12 - 6);
          this._spawnTrail(px, py, color, 180);
          if (el === 'Fire' || el === 'Lava') {
            const ember = this.add.circle(px, py, 3 + Math.random() * 3, 0xffaa33, 0.9).setDepth(241);
            this.tweens.add({
              targets: ember, y: py - 25, alpha: 0, duration: 280, onComplete: () => ember.destroy()
            });
          } else if (el === 'Water' || el === 'Ice') {
            const drop = this.add.circle(px, py, 2 + Math.random() * 2, 0xaaddff, 0.85).setDepth(241);
            this.tweens.add({
              targets: drop, y: py + 18, alpha: 0, duration: 260, onComplete: () => drop.destroy()
            });
          } else if (el === 'Plant') {
            const leaf = this.add.ellipse(px, py, 8, 4, 0x66cc55, 0.9).setDepth(241).setAngle(ang * 57);
            this.tweens.add({
              targets: leaf, angle: leaf.angle + 90, alpha: 0, duration: 300, onComplete: () => leaf.destroy()
            });
          }
        });
      }

      this.tweens.add({
        targets: [core, tip],
        x: to.x,
        y: to.y,
        duration: dur,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          if (core.x != null) this._spawnTrail(core.x, core.y, color, 160);
        },
        onComplete: () => {
          core.destroy();
          tip.destroy();
          this._burstParticles(to.x, to.y, color, 14, { dist: 70, size: 14, up: 25, dur: 350 });
          // Impact flash star
          const star = this.add.star(to.x, to.y, 5, 6, 18, color, 0.95).setDepth(245);
          this.tweens.add({
            targets: star, scale: 2.2, alpha: 0, angle: 40, duration: 280,
            onComplete: () => star.destroy()
          });
          if (onHit) onHit();
        }
      });
    }

    _beamAttack(from, to, color, onHit) {
      const g = this.add.graphics().setDepth(240);
      const segs = 10;
      const draw = (jitter) => {
        g.clear();
        g.lineStyle(5, color, 0.9);
        g.beginPath();
        g.moveTo(from.x, from.y);
        for (let i = 1; i < segs; i++) {
          const t = i / segs;
          const jx = (Math.random() - 0.5) * jitter;
          const jy = (Math.random() - 0.5) * jitter;
          g.lineTo(from.x + (to.x - from.x) * t + jx, from.y + (to.y - from.y) * t + jy);
        }
        g.lineTo(to.x, to.y);
        g.strokePath();
        g.lineStyle(2, 0xffffff, 0.7);
        g.beginPath();
        g.moveTo(from.x, from.y);
        g.lineTo(to.x, to.y);
        g.strokePath();
      };
      draw(18);
      let n = 0;
      const flick = this.time.addEvent({
        delay: 40,
        repeat: 5,
        callback: () => { draw(12 + n * 2); n++; }
      });
      this.time.delayedCall(280, () => {
        flick.remove(false);
        g.destroy();
        this._burstParticles(to.x, to.y, color, 18, { dist: 90, size: 12 });
        this.cameras.main.flash(80, 200, 220, 255, false);
        if (onHit) onHit();
      });
    }

    _meleeSlash(from, to, color, onHit) {
      // Arc slash toward target
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 - 30;
      const arc = this.add.graphics().setDepth(242);
      const ang0 = Math.atan2(from.y - midY, from.x - midX);
      let prog = 0;
      const drawArc = () => {
        arc.clear();
        arc.lineStyle(8, color, 0.85);
        arc.beginPath();
        const steps = 16;
        for (let i = 0; i <= steps * prog; i++) {
          const a = ang0 + (i / steps) * 1.8 - 0.3;
          const r = 55 + i * 2;
          const px = midX + Math.cos(a) * r;
          const py = midY + Math.sin(a) * r * 0.7;
          if (i === 0) arc.moveTo(px, py);
          else arc.lineTo(px, py);
        }
        arc.strokePath();
        arc.lineStyle(3, 0xffffff, 0.6);
        arc.strokePath();
      };
      this.tweens.add({
        targets: { p: 0 },
        p: 1,
        duration: 200,
        onUpdate: (tw, t) => { prog = t.p; drawArc(); },
        onComplete: () => {
          arc.destroy();
          this._burstParticles(to.x, to.y, color, 12, { dist: 60 });
          if (onHit) onHit();
        }
      });
    }

    _cloudAttack(from, to, color, onHit) {
      // Poison/shadow cloud drifts to target
      const blobs = [];
      for (let i = 0; i < 7; i++) {
        const b = this.add.circle(
          from.x + (Math.random() * 30 - 15),
          from.y + (Math.random() * 20 - 10),
          14 + Math.random() * 12,
          color,
          0.35 + Math.random() * 0.25
        ).setDepth(236);
        blobs.push(b);
        this.tweens.add({
          targets: b,
          x: to.x + (Math.random() * 40 - 20),
          y: to.y + (Math.random() * 30 - 15),
          scale: 1.6,
          alpha: 0.15,
          duration: 380 + Math.random() * 80,
          ease: 'Sine.easeInOut'
        });
      }
      this.time.delayedCall(400, () => {
        blobs.forEach((b) => {
          this.tweens.add({
            targets: b, alpha: 0, scale: 2.2, duration: 200, onComplete: () => b.destroy()
          });
        });
        this._burstParticles(to.x, to.y, color, 12, { dist: 50 });
        if (onHit) onHit();
      });
    }

    _aoeRing(x, y, color, element) {
      const el = String(element || '');
      // Expanding shockwave
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 70, () => {
          const ring = this.add.circle(x, y, 16, color, 0.0)
            .setStrokeStyle(4 - i, color, 0.9 - i * 0.2).setDepth(235);
          this.tweens.add({
            targets: ring, scaleX: 4.5 + i, scaleY: 2.4 + i * 0.3, alpha: 0, duration: 480,
            onComplete: () => ring.destroy()
          });
        });
      }
      this._burstParticles(x, y, color, 20, { dist: 100, size: 14, up: 10, dur: 450 });
      if (el === 'Fire' || el === 'Lava') {
        for (let i = 0; i < 8; i++) {
          const f = this.add.circle(x, y, 6, 0xff6622, 0.9).setDepth(236);
          const a = (Math.PI * 2 * i) / 8;
          this.tweens.add({
            targets: f, x: x + Math.cos(a) * 70, y: y + Math.sin(a) * 40 - 20,
            alpha: 0, duration: 400, onComplete: () => f.destroy()
          });
        }
      }
    }

    _healSparkle(spr) {
      if (!spr) return;
      const x = spr.pos.x;
      const y = spr.pos.y;
      // Rising green cross / sparkles
      for (let i = 0; i < 10; i++) {
        const p = this.add.circle(
          x + (Math.random() * 40 - 20),
          y + 16,
          3 + Math.random() * 3,
          0x66ffaa, 0.95
        ).setDepth(245);
        this.tweens.add({
          targets: p,
          y: y - 50 - Math.random() * 30,
          alpha: 0,
          duration: 500 + Math.random() * 250,
          onComplete: () => p.destroy()
        });
      }
      if (this.textures.exists('vfx_glow')) {
        const g = this.add.image(x, y, 'vfx_glow').setTint(0x66ffaa).setDepth(244)
          .setDisplaySize(50, 50).setAlpha(0.6);
        this.tweens.add({
          targets: g, scale: 2.5, alpha: 0, duration: 450, onComplete: () => g.destroy()
        });
      }
    }

    /**
     * Play full action presentation from battle.lastAction then call done.
     */
    _playActionVfx(done) {
      const action = this.battle.lastAction;
      if (!action) {
        this._refreshHud();
        if (done) done();
        return;
      }

      const actorSpr = this._findSpriteById(action.actorId);
      const from = this._spriteWorldPos(actorSpr);
      const color = this._elementColor(action.actorElement);
      const delivery = this._deliveryFor(action);

      this._showSkillCallout(action);
      this._pulseActor(actorSpr || { pos: from, img: null });

      // Procedural combat SFX (volume via hub ⚙ Sound)
      if (global.SR_AUDIO) {
        const anyCrit = (action.hits || []).some((h) => h && h.crit);
        const healHit = (action.hits || []).some((h) => h && h.kind === 'heal');
        if (global.SR_AUDIO.play) global.SR_AUDIO.play('cast');
        if (global.SR_AUDIO.playCombat) {
          this.time.delayedCall(80, () => {
            global.SR_AUDIO.playCombat({
              skillId: action.skillId || action.skill,
              element: action.actorElement,
              crit: anyCrit,
              heal: healHit,
              kind: healHit ? 'heal' : (action.kind || null)
            });
          });
        }
      }

      const firstHit = (action.hits && action.hits[0]) || null;
      const firstSpr = firstHit ? this._findSpriteById(firstHit.targetId) : null;
      const to = this._spriteWorldPos(firstSpr);

      // Attack plate at cast start → brief pose-lead → bounce + hit (skillFx).

      const finishHits = () => {
        const recipe = this._actionFxRecipe;
        const multiHit = (recipe && recipe.multiHit) || 1;
        const multiGap = (recipe && recipe.multiHitGapMs) || 100;
        (action.hits || []).forEach((hit, i) => {
          // Phase C multi-hit: primary damage float once; aftershock impacts for spectacle
          for (let m = 0; m < multiHit; m++) {
            this.time.delayedCall(i * 80 + m * multiGap, () => {
              const tSpr = this._findSpriteById(hit.targetId);
              const p = this._spriteWorldPos(tSpr);
              if (hit.kind === 'heal') {
                if (m === 0) {
                  this._floatNumber(p.x, p.y - 10, hit.amount, { kind: 'heal' });
                  this._healSparkle(tSpr);
                }
                if (this.live3d && this.world3d && this.world3d.impactBurst && hit.targetId != null) {
                  this.world3d.impactBurst(hit.targetId, action.actorElement || 'Plant', false);
                }
              } else if (hit.kind === 'buff') {
                if (m === 0) {
                  this._floatNumber(p.x, p.y - 10, 0, {
                    kind: 'buff',
                    statusName: (hit.statusApplied && hit.statusApplied.name) || 'Ward',
                    statusIcon: (hit.statusApplied && hit.statusApplied.icon) || '🛡️'
                  });
                  this._healSparkle(tSpr);
                }
              } else {
                if (m === 0) {
                  this._floatNumber(p.x, p.y - 10, hit.amount, {
                    kind: 'damage',
                    crit: hit.crit,
                    affinity: hit.affinity,
                    affinityTag: hit.affinityTag
                  });
                  this._hitFlash(tSpr, hit.crit ? 0xffee55 : color, hit.crit);
                  // Crit screen edge flash (Phase C HUD accent)
                  if (hit.crit) {
                    this.cameras.main.flash(90, 255, 220, 80, false);
                  }
                  // Elemental status proc (BURN! POISON!)
                  if (hit.statusApplied) {
                    this.time.delayedCall(120, () => {
                      this._floatStatusProc(p.x, p.y - 20, hit.statusApplied);
                    });
                  }
                } else {
                  // Aftershock float (partial visual only)
                  const sub = Math.max(1, Math.floor(hit.amount * 0.15));
                  this._floatNumber(p.x + (m * 6 - 6), p.y - 6, sub, {
                    kind: 'damage', crit: false, affinity: 1
                  });
                }
                if (this.live3d && this.world3d && this.world3d.impactBurst && hit.targetId != null) {
                  // Crit fork only on primary tick
                  this.world3d.impactBurst(hit.targetId, action.actorElement, m === 0 && !!hit.crit);
                }
                if (m === 0 && hit.killed && tSpr) {
                  if (this.live3d && this.world3d) {
                    if (this.world3d.meltDeath) this.world3d.meltDeath(hit.targetId);
                    else this.world3d.setAlive(hit.targetId, false);
                    const p2 = this._spriteWorldPos(tSpr);
                    for (let ri = 0; ri < 3; ri++) {
                      this.time.delayedCall(ri * 120, () => {
                        const col = this._elementColor((tSpr.unit && tSpr.unit.element) || action.actorElement);
                        const ring = this.add.circle(p2.x, p2.y + 50, 8, col, 0.0)
                          .setStrokeStyle(3, col, 0.7).setDepth(230);
                        this.tweens.add({
                          targets: ring, scaleX: 4 + ri, scaleY: 1.6 + ri * 0.2, alpha: 0, duration: 500,
                          onComplete: () => ring.destroy()
                        });
                      });
                    }
                  } else if (tSpr.img) {
                    this.tweens.add({
                      targets: tSpr.img, alpha: 0.25, angle: tSpr.unit && tSpr.unit.isFoe ? 12 : -8,
                      duration: 350
                    });
                  }
                }
              }
              if (m === 0) this._refreshHud();
            });
          }
        });
        // Hold turn until spectacle finishes — multi-hit + magic longer
        const anyKill = (action.hits || []).some((h) => h.killed);
        const hintMs = (recipe && recipe.budget && recipe.budget.totalHintMs) || 520;
        const multiExtra = multiHit > 1 ? (multiHit - 1) * multiGap : 0;
        const wait = Math.max(360, Math.round(hintMs * 0.45)) +
          Math.min(450, (action.hits || []).length * 70) + multiExtra +
          (anyKill && this.live3d ? 700 : 0);
        this.time.delayedCall(wait, () => {
          if (done) done();
        });
      };

      // Resolve recipe early for timing (2.5D + 3D)
      const VFX = global.SR_COMBAT_VFX;
      let recipe = null;
      if (VFX && typeof VFX.resolveRecipe === 'function') {
        recipe = VFX.resolveRecipe({
          skillId: action.skillId,
          element: action.actorElement,
          kind: action.kind,
          aoe: action.aoe,
          deliveryHint: delivery
        });
      }
      this._actionFxRecipe = recipe;
      const castMs = recipe && recipe.budget ? Math.round((recipe.budget.castSec || 0.1) * 1000) : 100;
      const fxTier = recipe ? recipe.fxTier : 'ability';

      // Basic 2.5D: brief pose lean, then punch (matches 3D pose-lead)
      if (!this.live3d && actorSpr && actorSpr.img && fxTier === 'basic') {
        const baseX = actorSpr.img.x;
        const dir = (to.x >= from.x) ? 14 : -14;
        const poseLeadMs = 110;
        this.tweens.add({
          targets: actorSpr.img,
          scaleX: (actorSpr.img.scaleX || 1) * 1.06,
          scaleY: (actorSpr.img.scaleY || 1) * 0.97,
          duration: poseLeadMs,
          ease: 'Sine.easeOut'
        });
        this.time.delayedCall(poseLeadMs, () => {
          if (!actorSpr.img) return;
          this.tweens.add({
            targets: actorSpr.img,
            x: baseX + dir,
            scaleX: actorSpr.img.scaleX || 1,
            scaleY: actorSpr.img.scaleY || 1,
            duration: 90,
            yoyo: true,
            ease: 'Quad.easeOut'
          });
        });
      }

      // Live 3D: attack plate → pose-lead → bounce + delivery
      if (this.live3d && this.world3d && this.world3d.skillFx) {
        const crit0 = !!(firstHit && firstHit.crit);
        const fxDelivery = (recipe && (recipe._mapDelivery || recipe.delivery)) || delivery;
        // Phase C: chain bolt secondary targets (other living foes)
        let chainToIds = [];
        if (recipe && recipe.chain) {
          const primaryId = firstHit ? firstHit.targetId : null;
          const foeSide = (this.battle.foes || []).concat(this.battle.allies || []);
          foeSide.forEach((u) => {
            if (!u || !u.alive || u.id === primaryId || u.id === action.actorId) return;
            // Only chain onto the opposing side of the actor
            const actorIsFoe = !!(action.actorId && this.battle.foes.some((f) => f && f.id === action.actorId));
            const uIsFoe = !!(this.battle.foes || []).some((f) => f && f.id === u.id);
            if (actorIsFoe === uIsFoe) return; // same side — skip
            chainToIds.push(u.id);
          });
          chainToIds = chainToIds.slice(0, 3);
        }
        if (crit0 && this.world3d.cameraPunch) this.world3d.cameraPunch(0.14);
        else if (this.world3d.cameraPunch && fxDelivery === 'aoe') this.world3d.cameraPunch(0.08);
        const used = this.world3d.skillFx({
          fromId: action.actorId,
          toId: firstHit ? firstHit.targetId : null,
          element: action.actorElement,
          skillId: action.skillId,
          kind: action.kind,
          aoe: action.aoe,
          delivery: fxDelivery,
          recipe: recipe,
          fxTier: fxTier,
          multiHit: recipe ? recipe.multiHit : 1,
          chainToIds: chainToIds,
          crit: crit0,
          onDone: finishHits
        });
        if (used) return;
      }

      // 2.5D fallback without worldFx: pose-like windup, bounce on actualize
      if (!this.live3d && actorSpr && actorSpr.img && fxTier !== 'basic') {
        // Hold a charged lean during cast, then punch forward at actualize
        const baseX = actorSpr.img.x;
        const dir = (to.x >= from.x) ? 1 : -1;
        this.tweens.add({
          targets: actorSpr.img,
          scaleX: (actorSpr.img.scaleX || 1) * 1.08,
          scaleY: (actorSpr.img.scaleY || 1) * 0.96,
          duration: Math.max(60, castMs * 0.85),
          ease: 'Sine.easeIn'
        });
        this.time.delayedCall(Math.max(40, castMs), () => {
          if (!actorSpr.img) return;
          this.tweens.add({
            targets: actorSpr.img,
            x: baseX + dir * 22,
            scaleX: (actorSpr.img.scaleX || 1) * 0.95,
            scaleY: (actorSpr.img.scaleY || 1) * 1.06,
            duration: 160,
            yoyo: true,
            ease: 'Quad.easeOut'
          });
        });
      }

      // 2.5D / no-FX: delay hits until cast spool completes (actualize)
      const afterCast = (fn) => {
        const d = fxTier === 'basic' ? 40 : castMs;
        if (d > 50) this.time.delayedCall(d, fn);
        else fn();
      };

      if (delivery === 'heal') {
        this._healSparkle(actorSpr);
        afterCast(() => this.time.delayedCall(120, finishHits));
        return;
      }

      if (delivery === 'aoe') {
        afterCast(() => {
          this._aoeRing(from.x, from.y, color, action.actorElement);
          this.time.delayedCall(180, () => {
            (action.hits || []).forEach((hit) => {
              const tSpr = this._findSpriteById(hit.targetId);
              const p = this._spriteWorldPos(tSpr);
              this._aoeRing(p.x, p.y, color, action.actorElement);
            });
            finishHits();
          });
        });
        return;
      }

      if (delivery === 'beam') {
        afterCast(() => this._beamAttack(from, to, color, finishHits));
        return;
      }
      if (delivery === 'melee') {
        afterCast(() => this._meleeSlash(from, to, color, finishHits));
        return;
      }
      if (delivery === 'cloud') {
        afterCast(() => this._cloudAttack(from, to, color, finishHits));
        return;
      }

      afterCast(() => this._projectile(from, to, color, action.actorElement, finishHits));
    }

    _battleLocationName() {
      if (this.battleData.tutorial) {
        const n = (this.battleData.tutorialIndex || 0) + 1;
        const t = this.battleData.tutorialTotal || 4;
        const gel = (this.battleData.party && this.battleData.party[0] && this.battleData.party[0].name) || 'Gel';
        return 'Tutorial  ·  ' + gel + '  (' + n + '/' + t + ')';
      }
      if (this.battleData.stage) return this.battleData.stage.name || 'Campaign';
      if (this.battleData.dungeon) return this.battleData.dungeon.name || 'Dungeon';
      if (this.battleData.boss) return this.battleData.boss.name || 'Boss Raid';
      if (this.battleData.spar) return 'Village Spar';
      return 'Battle';
    }

    /** Raid tutorial: next gel battle or pick scene (no campaign loot). */
    _finishTutorialBattle(win) {
      const wi = this.battleData.tutorialIndex || 0;
      const total = this.battleData.tutorialTotal || 4;
      const state = global.SR_GAME_STATE;
      if (!win) {
        // Soft retry same gel
        if (global.SR_UI && global.SR_UI.toast) {
          global.SR_UI.toast(this, 'Try again — use skills and watch affinity!', false);
        }
        this.time.delayedCall(500, () => {
          this.scene.restart({
            tutorial: true,
            tutorialIndex: wi,
            tutorialTotal: total,
            party: this.battleData.party,
            foes: this.battleData.foes,
            region: 'greenwild',
            arena: 'greenwild'
          });
        });
        return;
      }
      if (wi + 1 < total) {
        const cands = global.SR_STATE.ensureTutorialCandidates
          ? global.SR_STATE.ensureTutorialCandidates(state)
          : [];
        const next = cands[wi + 1];
        const foe = global.SR_STATE.buildTutorialFoe
          ? global.SR_STATE.buildTutorialFoe(wi + 1)
          : null;
        if (global.SR_UI && global.SR_UI.toast) {
          global.SR_UI.toast(this, 'Bond felt · next gel: ' + (next && next.name || '…'), true);
        }
        this.time.delayedCall(650, () => {
          this.scene.start('BattleScene', {
            tutorial: true,
            tutorialIndex: wi + 1,
            tutorialTotal: total,
            party: next ? [next] : this.battleData.party,
            foes: foe ? [foe] : undefined,
            region: 'greenwild',
            arena: 'greenwild'
          });
        });
        return;
      }
      if (state && state.flags) state.flags.tutorialBattleDone = true;
      if (global.SR_STATE && global.SR_STATE.saveState) global.SR_STATE.saveState(state);
      this.time.delayedCall(500, () => {
        this.scene.start('TutorialPickScene');
      });
    }

    _endBattle() {
      if (this._resultsShown) return;
      this._resultsShown = true;
      this._clearSkillButtons();
      this._cancelTargeting && this._cancelTargeting();
      const win = this.battle.status === 'win';
      // Victory/defeat shown on results panel — no top status banner

      // Tutorial path: no loot; chain battles or pick
      if (this.battleData.tutorial) {
        if (global.SR_AUDIO && global.SR_AUDIO.play) {
          global.SR_AUDIO.play(win ? 'win' : 'lose');
        }
        this._finishTutorialBattle(win);
        return;
      }

      const state = global.SR_GAME_STATE;
      let rewardPack = { rewards: [] };
      if (win) {
        if (this.battleData.stage) {
          rewardPack = global.SR_STATE.recordStageWin(state, this.battleData.stage.id, 3) || rewardPack;
          // 3rd party gel after 2 clears (RSL early team density)
          if (global.SR_TUTORIAL && global.SR_TUTORIAL.maybeGrantThirdBuddy) {
            try { global.SR_TUTORIAL.maybeGrantThirdBuddy(state, rewardPack); } catch (e3) { /* */ }
          }
          // First campaign win: bonus gold/shards + guaranteed Life relic
          if (global.SR_TUTORIAL && global.SR_TUTORIAL.applyFirstWinBonus) {
            global.SR_TUTORIAL.applyFirstWinBonus(state, rewardPack);
          }
        } else if (this.battleData.dungeon) {
          rewardPack = global.SR_STATE.recordDungeonWin(state, this.battleData.dungeon.id) || rewardPack;
        } else if (this.battleData.boss) {
          rewardPack = global.SR_STATE.recordBossWin(state, this.battleData.boss.id) || rewardPack;
        } else if (global.SR_STATE.recordSparWin) {
          rewardPack = global.SR_STATE.recordSparWin(state) || rewardPack;
        } else {
          state.stats.wins = (state.stats.wins || 0) + 1;
          global.SR_STATE.saveState(state);
        }
      } else {
        rewardPack = global.SR_STATE.recordLoss(state) || rewardPack;
      }

      const summary = global.SR_COMBAT.getBattleSummary
        ? global.SR_COMBAT.getBattleSummary(this.battle)
        : { turns: this.battle.turns, allies: [], foes: [], elapsedSec: 1 };

      // Short beat before splash (like HTML delay)
      if (global.SR_AUDIO && global.SR_AUDIO.play) {
        global.SR_AUDIO.play(win ? 'win' : 'lose');
      }
      this.time.delayedCall(380, () => {
        this._showResultsSplash(win, summary, rewardPack.rewards || [], this._battleLocationName());
      });
    }

    /**
     * Softened Realms battle results — ink panel, spoils, stats, champion rows.
     */
    _showResultsSplash(win, summary, rewards, locationName) {
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const depth = 400;
      const UI = global.SR_UI;
      const gold = 0xc9a44a;
      const goldLite = 0xe8d5a0;
      const accent = win ? gold : 0xe8a080;
      const accentHex = win ? '#ffe8a0' : '#ffc8b0';
      const titleHex = win ? '#f0e8d4' : '#f0d0c8';

      // Soft ink veil (not pure black cut)
      const veil = this.add.rectangle(w / 2, h / 2, w + 4, h + 4, 0x05080c, 0)
        .setDepth(depth);
      this.tweens.add({ targets: veil, alpha: 0.82, duration: 320 });
      // Top / bottom vignette wash
      const vig = this.add.graphics().setDepth(depth);
      vig.fillStyle(0x000000, 0.45);
      vig.fillRect(0, 0, w, 90);
      vig.fillRect(0, h - 100, w, 100);

      [this._calloutPlate, this._calloutSheen, this._calloutIconBg,
        this._calloutIcon, this.actionCallout, this._calloutActor].forEach((p) => {
        if (p && p.setAlpha) p.setAlpha(0);
      });
      if (this.autoBtn) this.autoBtn.disableInteractive();
      if (this._autoParts) {
        this._autoParts.forEach((p) => {
          try { if (p && p.setAlpha) p.setAlpha(0.25); } catch (e) { /* */ }
        });
      }

      // Particles — gold confetti (win) or ash (defeat)
      const pCols = win
        ? [0xc9a44a, 0xffe8a0, 0x88ccaa, 0xffffff]
        : [0x886666, 0xaa8877, 0x554444];
      for (let i = 0; i < (win ? 36 : 18); i++) {
        const px0 = w * (0.1 + Math.random() * 0.8);
        const py0 = -20 - Math.random() * 80;
        const sz = win ? (4 + Math.random() * 7) : (3 + Math.random() * 5);
        const bit = this.add.rectangle(
          px0, py0, sz, sz * (0.5 + Math.random()),
          pCols[i % pCols.length], 0.85 + Math.random() * 0.15
        ).setDepth(depth + 20).setAngle(Math.random() * 360);
        this.tweens.add({
          targets: bit,
          y: h + 30,
          x: px0 + (Math.random() - 0.5) * 160,
          alpha: 0,
          angle: bit.angle + 120 + Math.random() * 200,
          duration: 1100 + Math.random() * 900,
          delay: Math.random() * 200,
          ease: 'Cubic.easeIn'
        });
      }
      if (win) this.cameras.main.flash(220, 200, 180, 120);
      else this.cameras.main.shake(160, 0.004);

      // Main sheet
      const panelW = Math.min(1020, w - 48);
      const panelH = Math.min(640, h - 40);
      const px = w / 2;
      const py = h / 2 + 6;
      const top = py - panelH / 2;
      const root = this.add.container(px, py).setDepth(depth + 1).setScale(0.88).setAlpha(0);

      // Soft drop shadow
      root.add(this.add.ellipse(0, panelH * 0.46, panelW * 0.92, 36, 0x000000, 0.4));
      // Ink plate
      const plate = this.add.rectangle(0, 0, panelW, panelH, 0x0a0e12, 0.96)
        .setStrokeStyle(2.5, accent, 0.92);
      root.add(plate);
      // Inner gold rim
      root.add(this.add.rectangle(0, 0, panelW - 14, panelH - 14, 0x000000, 0)
        .setStrokeStyle(1.2, goldLite, 0.28));
      // Corner ticks
      const tick = (ox, oy, sx, sy) => {
        const g = this.add.graphics();
        g.lineStyle(2, gold, 0.7);
        g.beginPath();
        g.moveTo(ox, oy + sy * 14);
        g.lineTo(ox, oy);
        g.lineTo(ox + sx * 14, oy);
        g.strokePath();
        root.add(g);
      };
      const hw = panelW / 2 - 10;
      const hh = panelH / 2 - 10;
      tick(-hw, -hh, 1, 1);
      tick(hw, -hh, -1, 1);
      tick(-hw, hh, 1, -1);
      tick(hw, hh, -1, -1);

      this.tweens.add({
        targets: root, scale: 1, alpha: 1, duration: 380, ease: 'Back.easeOut'
      });

      // ── Header ──
      let yLocal = -panelH / 2 + 36;
      const banner = this.add.text(0, yLocal, win ? 'Victory' : 'Defeat', {
        fontFamily: 'Georgia, serif', fontSize: '40px', fontStyle: 'bold',
        color: titleHex, stroke: '#000000', strokeThickness: 6
      }).setOrigin(0.5);
      root.add(banner);
      // Gold underline
      root.add(this.add.rectangle(0, yLocal + 26, 160, 2, accent, 0.75));
      yLocal += 48;

      const subBits = [
        locationName || 'Battle',
        (summary.turns || 0) + ' turns',
        (summary.elapsedSec || 1) + 's'
      ];
      // Stars from rewards if present
      const starReward = (rewards || []).find((r) => /star/i.test(r.label || ''));
      if (starReward && starReward.amount != null) {
        const n = Math.min(3, Math.max(0, Number(starReward.amount) || 0));
        subBits.push('★'.repeat(n) + '☆'.repeat(3 - n));
      }
      root.add(this.add.text(0, yLocal, subBits.join('  ·  '), {
        fontFamily: 'system-ui', fontSize: '13px', color: '#9aa89a',
        stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5));
      yLocal += 28;

      // ── Team parade ──
      const lineAllies = (summary.allies || []).slice(0, 6);
      const mvpId = summary.mvp && summary.mvp.id;
      if (lineAllies.length) {
        const gap = Math.min(78, Math.floor((panelW - 80) / Math.max(1, lineAllies.length)));
        const startX = -((lineAllies.length - 1) * gap) / 2;
        lineAllies.forEach((a, i) => {
          const lx = startX + i * gap;
          const ly = yLocal + 8;
          const isMvp = a.id === mvpId && (a.damageDealt || 0) > 0;
          // Soft ground shadow
          root.add(this.add.ellipse(lx + 1, ly + 28, 44, 14, 0x000000, 0.35));
          if (isMvp) {
            const glow = this.add.circle(lx, ly, 34, gold, 0.16);
            root.add(glow);
            if (this.tweens) {
              this.tweens.add({
                targets: glow, scaleX: 1.15, scaleY: 1.15, alpha: 0.06,
                duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
              });
            }
          }
          root.add(this.add.circle(lx, ly, 30, 0x0c1016, 0.95)
            .setStrokeStyle(2.5, isMvp ? gold : (a.alive ? 0x4a5560 : 0x3a3030), 0.9));
          if (UI && UI.addSlimePortrait) {
            const por = UI.addSlimePortrait(this, px + lx, py + ly, 48, a.element, depth + 5, {
              mode: 'badge',
              rarity: a.rarity || 'Common',
              ring: false,
              showStars: false,
              fixedSize: true,
              artVariant: a.artVariant,
              champ: a
            });
            if (por) {
              // Keep world-space portrait; dim fallen
              if (!a.alive && por.setAlpha) por.setAlpha(0.4);
              if (por.setScale) {
                por.setScale(0.3);
                this.tweens.add({
                  targets: por, scale: 1, duration: 320, delay: 80 + i * 50, ease: 'Back.easeOut'
                });
              }
            }
          }
          if (isMvp) {
            root.add(this.add.text(lx, ly - 36, '★ MVP', {
              fontFamily: 'system-ui', fontSize: '10px', fontStyle: 'bold',
              color: '#ffe8a0', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5));
          }
          if (!a.alive) {
            root.add(this.add.text(lx, ly + 32, 'fallen', {
              fontFamily: 'system-ui', fontSize: '9px', color: '#886666'
            }).setOrigin(0.5));
          }
        });
        yLocal += 72;
      }

      // ── Section: Spoils ──
      yLocal = this._resultsSectionLabel(root, 0, yLocal, win ? 'Spoils of Softness' : 'No Spoils', accentHex);
      yLocal += 8;
      const chips = (rewards && rewards.length)
        ? rewards
        : (win
          ? [{ icon: '🗺️', label: 'Stage Clear', amount: '✓' }]
          : [{ icon: '💨', label: 'Retreat', amount: '—' }]);
      const chipN = Math.min(9, chips.length);
      const chipW = 108;
      const chipGap = 12;
      // Up to three rows of 3 reward chips (first-hour spoils can be dense)
      chips.slice(0, 9).forEach((r, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const nThisRow = Math.min(3, chipN - row * 3);
        const rowW = nThisRow * chipW + Math.max(0, nThisRow - 1) * chipGap;
        const cx = -rowW / 2 + chipW / 2 + col * (chipW + chipGap);
        const cy = yLocal + 22 + row * 56;
        root.add(this.add.rectangle(cx, cy, chipW - 4, 48, 0x12161c, 0.95)
          .setStrokeStyle(1.5, gold, 0.45));
        root.add(this.add.rectangle(cx - (chipW - 4) / 2 + 3, cy, 3, 40, gold, 0.65));
        root.add(this.add.text(cx + 4, cy - 9,
          (r.icon || '✦') + '  ' + (r.amount != null ? r.amount : ''), {
            fontFamily: 'system-ui', fontSize: '14px', fontStyle: 'bold',
            color: '#ffe8a0', stroke: '#000', strokeThickness: 2
          }).setOrigin(0.5));
        root.add(this.add.text(cx + 4, cy + 12, String(r.label || '').slice(0, 16), {
          fontFamily: 'system-ui', fontSize: '10px', color: '#9aa89a'
        }).setOrigin(0.5));
      });
      yLocal += chips.length > 6 ? 174 : (chips.length > 3 ? 118 : 62);

      // ── Section: Battle stats ──
      yLocal = this._resultsSectionLabel(root, 0, yLocal, 'Battle Stats', accentHex);
      yLocal += 10;
      const cells = [
        { v: summary.turns || 0, l: 'Turns', c: '#e8e0d0' },
        { v: (summary.elapsedSec || 1) + 's', l: 'Time', c: '#e8e0d0' },
        { v: this._fmtNum(summary.totalDamageToFoe || 0), l: 'Dealt', c: '#ffcc88' },
        { v: this._fmtNum(summary.totalDamageToParty || 0), l: 'Taken', c: '#ffaaaa' },
        { v: summary.crits || 0, l: 'Crits', c: '#ffe8a0' },
        { v: summary.skillsUsed || 0, l: 'Skills', c: '#c8d8ff' }
      ];
      const cellW = 96;
      const cellGap = 10;
      const statsW = cells.length * cellW + (cells.length - 1) * cellGap;
      const statsStart = -statsW / 2 + cellW / 2;
      cells.forEach((c, i) => {
        const cx = statsStart + i * (cellW + cellGap);
        const cy = yLocal + 20;
        root.add(this.add.rectangle(cx, cy, cellW - 2, 44, 0x0c1016, 0.94)
          .setStrokeStyle(1, 0x3a4048, 0.7));
        root.add(this.add.text(cx, cy - 8, String(c.v), {
          fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold',
          color: c.c, stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5));
        root.add(this.add.text(cx, cy + 12, c.l, {
          fontFamily: 'system-ui', fontSize: '10px', color: '#7a8a80'
        }).setOrigin(0.5));
      });
      yLocal += 58;

      // ── Section: Champions ──
      yLocal = this._resultsSectionLabel(root, 0, yLocal, 'Champions', accentHex);
      yLocal += 6;

      const allyList = (summary.allies || []).slice(0, 5);
      const maxDmg = Math.max(1, ...allyList.map((a) => a.damageDealt || 0));
      const maxTaken = Math.max(1, ...allyList.map((a) => a.damageTaken || 0));
      // Fit rows above CTA — compact when party is large
      const roomForRows = Math.max(120, (panelH / 2 - 40) - yLocal - 20);
      const rowH = Math.min(42, Math.max(34, Math.floor(roomForRows / Math.max(1, allyList.length)) - 4));
      const rowW = panelW - 48;
      allyList.forEach((a, i) => {
        const rowY = yLocal + 24 + i * (rowH + 4);
        const isMvp = a.id === mvpId && (a.damageDealt || 0) > 0;
        // Row plate
        root.add(this.add.rectangle(0, rowY, rowW, rowH, isMvp ? 0x1a1810 : 0x0c1016, isMvp ? 0.92 : 0.88)
          .setStrokeStyle(1.2, isMvp ? gold : 0x2a3038, isMvp ? 0.75 : 0.5));
        if (isMvp) {
          root.add(this.add.rectangle(-rowW / 2 + 3, rowY, 4, rowH - 8, gold, 0.85));
        }

        // Portrait (world coords for mask)
        const portX = -rowW / 2 + 28;
        if (UI && UI.addSlimePortrait) {
          UI.addSlimePortrait(this, px + portX, py + rowY, 34, a.element, depth + 6, {
            mode: 'badge',
            rarity: a.rarity || 'Common',
            ring: false,
            showStars: false,
            fixedSize: true,
            artVariant: a.artVariant,
            champ: a
          });
        }

        const nameX = -rowW / 2 + 54;
        const shortName = String(a.name || 'Ally').slice(0, 16);
        root.add(this.add.text(nameX, rowY - 8,
          (a.alive ? '' : '† ') + shortName + (isMvp ? '  ·  MVP' : ''), {
            fontFamily: 'system-ui', fontSize: '13px', fontStyle: isMvp ? 'bold' : 'normal',
            color: isMvp ? '#ffe8a0' : (a.alive ? '#e8e0d0' : '#777'),
            stroke: '#000', strokeThickness: 2
          }).setOrigin(0, 0.5));
        root.add(this.add.text(nameX, rowY + 10,
          (a.element || '') + '  ·  ' + (a.rarity || 'Common'), {
            fontFamily: 'system-ui', fontSize: '10px', color: '#7a8a80'
          }).setOrigin(0, 0.5));

        // Damage bar + numbers
        const barX = 40;
        const barW = 120;
        const dmgPct = Math.min(1, (a.damageDealt || 0) / maxDmg);
        const takPct = Math.min(1, (a.damageTaken || 0) / maxTaken);
        root.add(this.add.text(barX - 4, rowY - 10, 'DMG', {
          fontFamily: 'system-ui', fontSize: '9px', color: '#7a8a80'
        }).setOrigin(1, 0.5));
        root.add(this.add.rectangle(barX + barW / 2, rowY - 10, barW, 6, 0x1a1e24, 1));
        if (dmgPct > 0) {
          root.add(this.add.rectangle(barX + (barW * dmgPct) / 2, rowY - 10, barW * dmgPct, 6, 0xc9a44a, 1));
        }
        root.add(this.add.text(barX + barW + 8, rowY - 10, this._fmtNum(a.damageDealt || 0), {
          fontFamily: 'system-ui', fontSize: '11px', color: '#ffcc88', fontStyle: 'bold'
        }).setOrigin(0, 0.5));

        root.add(this.add.text(barX - 4, rowY + 10, 'TKN', {
          fontFamily: 'system-ui', fontSize: '9px', color: '#7a8a80'
        }).setOrigin(1, 0.5));
        root.add(this.add.rectangle(barX + barW / 2, rowY + 10, barW, 6, 0x1a1e24, 1));
        if (takPct > 0) {
          root.add(this.add.rectangle(barX + (barW * takPct) / 2, rowY + 10, barW * takPct, 6, 0xc07070, 1));
        }
        root.add(this.add.text(barX + barW + 8, rowY + 10, this._fmtNum(a.damageTaken || 0), {
          fontFamily: 'system-ui', fontSize: '11px', color: '#ffaaaa'
        }).setOrigin(0, 0.5));

        // Right meta: skills / crits / heals
        const metaX = rowW / 2 - 16;
        const meta = [
          'Skl ' + (a.skillsUsed || 0),
          'Crit ' + (a.critsLanded || 0)
        ];
        if (a.healsDone) meta.push('Heal ' + this._fmtNum(a.healsDone));
        root.add(this.add.text(metaX, rowY, meta.join('  ·  '), {
          fontFamily: 'system-ui', fontSize: '11px', color: '#8a9a90',
          align: 'right'
        }).setOrigin(1, 0.5));
      });

      yLocal += 24 + allyList.length * (rowH + 4) + 8;

      // Foes compact line (if room)
      const foes = (summary.foes || []).slice(0, 4);
      if (foes.length && yLocal < panelH / 2 - 70) {
        root.add(this.add.text(0, yLocal, 'Opponents', {
          fontFamily: 'system-ui', fontSize: '11px', color: '#8a7068', fontStyle: 'bold'
        }).setOrigin(0.5));
        yLocal += 16;
        const foeLine = foes.map((f) => {
          const mark = f.alive ? '·' : '†';
          return mark + ' ' + String(f.name || 'Foe').slice(0, 12);
        }).join('    ');
        root.add(this.add.text(0, yLocal, foeLine, {
          fontFamily: 'system-ui', fontSize: '11px', color: '#7a6060'
        }).setOrigin(0.5));
      }

      // ── CTA ──
      const btnY = panelH / 2 - 36;
      const btnLabel = win ? 'Collect & Continue' : 'Continue';
      const leave = () => {
        if (this.battleData.stage) {
          this.scene.start('CampaignScene', {
            region: this.battleData.returnRegion || this.battleData.region ||
              this.battleData.stage.region,
            stageId: this.battleData.stage.id
          });
        } else if (this.battleData.dungeon || this.battleData.boss) {
          this.scene.start('DungeonScene');
        } else {
          this.scene.start('HubScene');
        }
      };

      if (UI && UI.addButton) {
        // World-space button under panel
        const res = UI.addButton(this, px, py + btnY, 280, 48, btnLabel,
          win ? 0x1a1820 : 0x2a1818, leave, depth + 10);
        if (res && res.root) {
          res.root.setScale(0.9);
          res.root.setAlpha(0);
          this.tweens.add({
            targets: res.root, scale: 1, alpha: 1, duration: 300, delay: 220, ease: 'Back.easeOut'
          });
        }
      } else {
        const btn = this.add.rectangle(px, py + btnY, 260, 46, 0x1a1820, 0.98)
          .setStrokeStyle(2, accent, 0.95)
          .setInteractive({ useHandCursor: true })
          .setDepth(depth + 10);
        this.add.text(px, py + btnY, btnLabel, {
          fontFamily: 'system-ui', fontSize: '16px', color: '#f0e8d4', fontStyle: 'bold',
          stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(depth + 11);
        btn.on('pointerover', () => btn.setStrokeStyle(2, goldLite, 1));
        btn.on('pointerout', () => btn.setStrokeStyle(2, accent, 0.95));
        btn.on('pointerdown', leave);
      }
    }

    _resultsSectionLabel(root, x, y, label, colorHex) {
      root.add(this.add.text(x, y, label, {
        fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold',
        color: colorHex || '#c9a44a', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5));
      // Soft rules either side
      root.add(this.add.rectangle(x - 110, y, 70, 1, 0xc9a44a, 0.25));
      root.add(this.add.rectangle(x + 110, y, 70, 1, 0xc9a44a, 0.25));
      return y + 14;
    }

    _fmtNum(n) {
      n = Math.floor(Number(n) || 0);
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
      return String(n);
    }
  }

  global.BattleScene = BattleScene;
})(typeof window !== 'undefined' ? window : global);
