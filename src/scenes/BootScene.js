/* Boot + preload — painted splash + premium progress bar */
(function (global) {
  'use strict';

  var BOOT_TIPS = [
    'Gathering soft realms…',
    'Warming the village fountain…',
    'Shaping gel champions…',
    'Unrolling campaign maps…',
    'Polishing dungeon torches…',
    'Tuning the summoning circle…',
    'Packing vault shelves…'
  ];

  class BootScene extends Phaser.Scene {
    constructor() {
      super({ key: 'BootScene' });
    }

    preload() {
      // Resolve assets relative to the page (works with npm start / any port)
      try {
        const base = (typeof document !== 'undefined' && document.baseURI)
          ? document.baseURI.replace(/[^/]*$/, '')
          : '';
        if (base) this.load.setBaseURL(base);
      } catch (e) { /* ignore */ }

      this._loadFails = [];
      this.load.on('loaderror', (file) => {
        this._loadFails.push(file && (file.key || file.src) || 'unknown');
        console.warn('[Boot] load failed', file && file.src);
      });

      const artV = (global.SR_ART && global.SR_ART.ART_CACHE_VER) || '1';
      const q = (u) => u + (u.indexOf('?') >= 0 ? '&' : '?') + 'srv=' + artV;

      // ——— Splash graphic (loads first) ———
      this.load.image('boot_bg', q('assets/village-hub.jpg'));
      // Boot marks = combat sprites (same art as badges / battle)
      this.load.image('boot_mark', q('assets/battle/gels/combat/plant_a.jpg'));
      this.load.image('boot_mark_b', q('assets/battle/gels/combat/water_a.jpg'));
      this.load.image('boot_mark_c', q('assets/battle/gels/combat/fire_a.jpg'));

      this._buildLoadingChrome();

      this.load.on('filecomplete-image-boot_bg', () => this._attachBootArt());
      this.load.on('filecomplete-image-boot_mark', () => this._attachBootMark());

      // ——— Rest of game assets ———
      const els = (global.SR_DATA && global.SR_DATA.ELEMENTS) || [
        'Water', 'Fire', 'Earth', 'Wind', 'Plant', 'Lightning', 'Ice', 'Shadow',
        'Light', 'Metal', 'Poison', 'Crystal', 'Lava', 'Storm', 'Spirit', 'Void'
      ];
      els.forEach((el) => {
        const low = el.toLowerCase();
        // Painterly blob pack (default) + morph/shaped for rarer form control
        // ?srv= busts browser cache when art overhaul lands
        ['a', 'b', 'c'].forEach((v) => {
          this.load.image('slime_raw_' + low + '_blob_' + v,
            q('assets/battle/gels/combat/' + low + '_blob_' + v + '.jpg'));
          this.load.image('slime_raw_' + low + '_' + v,
            q('assets/battle/gels/combat/' + low + '_' + v + '.jpg'));
        });
        this.load.image('slime_raw_' + low, q('assets/battle/gels/combat/' + low + '.jpg'));
        this.load.image('slime_raw_' + low + '_morph_a',
          q('assets/battle/gels/combat/' + low + '_morph_a.jpg'));
        this.load.image('slime_raw_' + low + '_morph',
          q('assets/battle/gels/combat/' + low + '_morph.jpg'));
        this.load.image('slime_raw_' + low + '_shaped_a',
          q('assets/battle/gels/combat/' + low + '_shaped_a.jpg'));
        this.load.image('slime_raw_' + low + '_shaped',
          q('assets/battle/gels/combat/' + low + '_shaped.jpg'));
        // Evolution lv1 idle (first purple star) — chroma-registered as slime_{el}_evo1
        this.load.image('slime_raw_' + low + '_evo1',
          q('assets/battle/gels/combat/' + low + '_blob_a_evo1.jpg'));
        this.load.image('slime_legacy_' + low, q('assets/slimes/' + low + '.jpg'));
      });
      this.load.image('arena_wilds', q('assets/arenas/wilds-depth.jpg'));
      this.load.image('arena_dungeon', q('assets/arenas/dungeon-depth.jpg'));
      this.load.image('hub_bg', q('assets/village-hub.jpg'));
      // Painterly fantasy UI chrome — transparent PNG controls (pop, no stretch bars)
      this.load.image('ui_panel', q('assets/ui/panel.jpg'));
      this.load.image('ui_button', q('assets/ui/button.png'));
      this.load.image('ui_button_danger', q('assets/ui/button_danger.png'));
      this.load.image('ui_title_banner', q('assets/ui/title_banner.jpg'));
      this.load.image('ui_currency_pill', q('assets/ui/currency_pill.png'));
      this.load.image('ui_mode_chip', q('assets/ui/mode_chip.png'));
      this.load.image('ui_tamer_badge', q('assets/ui/tamer_badge.png'));
      this.load.image('ui_battle_load', q('assets/ui/battle_load.jpg'));
      // Raid skill circle plates: unique per skill id + category fallbacks + auto HUD
      // Prefer .png (chroma-clean pack) then .jpg (newer unique art)
      const skillKeys = (global.SR_DATA && global.SR_DATA.SKILL_ART_KEYS) || [
        'basic', 'ranged', 'heal', 'buff',
        'smash', 'splash', 'blaze', 'bolt', 'poison', 'inferno', 'shield', 'auto'
      ];
      skillKeys.forEach((stem) => {
        const base = 'assets/battle/skills/' + stem;
        // Load png first when present; also queue jpg under same key only if png absent —
        // Phaser keeps first successful key. Prefer explicit dual attempt via file list.
        // Use png for classic plates, jpg for new unique icons.
        const preferPng = ['basic', 'ranged', 'heal', 'buff', 'shield'].indexOf(stem) >= 0;
        if (preferPng) {
          this.load.image('skill_' + stem, q(base + '.png'));
        } else {
          this.load.image('skill_' + stem, q(base + '.jpg'));
        }
      });
      // Videos: never put ?query on mp4 URLs — Phaser Loader mis-detects type (null.type crash)
      const loadVid = (key, url) => {
        try {
          this.load.video(key, url, 'loadeddata', false, true);
        } catch (eVid) {
          console.warn('[Boot] skip video', key, eVid && eVid.message);
        }
      };
      loadVid('hub_bg_video', 'assets/village-hub-loop.mp4');
      // Mode page video loops (native DOM player via SR_MODE_VIDEO — smooth vs WebGL upload)
      loadVid('dungeon_bg_video', 'assets/dungeon-hall-loop.mp4');
      loadVid('mode_campaign_video', 'assets/modes/campaign-loop.mp4');
      loadVid('mode_champions_video', 'assets/modes/champions-loop.mp4');
      loadVid('mode_summon_video', 'assets/modes/summon-loop.mp4');
      loadVid('mode_vault_video', 'assets/modes/vault-loop.mp4');
      loadVid('mode_great_hall_video', 'assets/modes/great-hall-loop.mp4');
      loadVid('mode_alchemy_video', 'assets/modes/alchemy-loop.mp4');
      loadVid('mode_workshop_video', 'assets/modes/workshop-loop.mp4');
      loadVid('mode_market_video', 'assets/modes/market-loop.mp4');
      loadVid('mode_eternity_video', 'assets/modes/eternity-loop.mp4');
      loadVid('mode_chronicle_video', 'assets/modes/chronicle-loop.mp4');
      this.load.image('lyra_guide', q('assets/characters/lyra-guide.jpg'));

      const chapterMaps = ['greenwild', 'crystal', 'shadowfen', 'volcanic', 'celestial'];
      chapterMaps.forEach((id) => {
        this.load.image('map_' + id, q('assets/maps/' + id + '.jpg'));
      });

      const envKits = ['greenwild', 'crystal', 'shadowfen', 'volcanic', 'celestial', 'dungeon'];
      envKits.forEach((id) => {
        const base = 'assets/battle/env/' + id + '/';
        // Cache-bust env plates so art overhaul always reaches the client
        this.load.image('env_' + id + '_ground', q(base + 'ground.jpg'));
        this.load.image('env_' + id + '_sky', q(base + 'sky.jpg'));
        this.load.image('env_' + id + '_prop', q(base + 'prop.jpg'));
        // Extra tree/prop silhouettes (optional files — 404 is ok / ignored)
        ['b', 'c', 'd', 'e'].forEach((suf) => {
          this.load.image('env_' + id + '_prop_' + suf, q(base + 'prop_' + suf + '.jpg'));
        });
      });

      const enemyKinds = [
        'beast', 'golem', 'humanoid', 'dragon', 'undead', 'plant', 'insect', 'elemental'
      ];
      enemyKinds.forEach((k) => {
        // Raw magenta; create() chromas to enemy_{k} with alpha
        this.load.image('enemy_raw_' + k, q('assets/battle/enemies/' + k + '.jpg'));
        this.load.image('enemy_' + k, q('assets/battle/enemies/' + k + '.jpg'));
      });

      const modes = (global.SR_DATA && global.SR_DATA.HUB_MODES) || [];
      modes.forEach((m) => {
        if (m.art && m.artFile) {
          this.load.image(m.art, q('assets/modes/' + m.artFile));
        }
      });

      this.load.on('progress', (v) => this._setProgress(v));
      this.load.on('complete', () => {
        if (this._statusText) this._statusText.setText('Preparing champions…');
        if (this._pctText) this._pctText.setText('100%');
      });
    }

    /** Decorative UI that works before any texture is ready */
    _buildLoadingChrome() {
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      this.cameras.main.setBackgroundColor('#041810');

      // Deep gradient panels (no art yet)
      this.add.rectangle(w / 2, h / 2, w, h, 0x02140c, 1).setDepth(0);
      this._vignette = this.add.graphics().setDepth(1);
      this._vignette.fillStyle(0x000000, 0.45);
      this._vignette.fillRect(0, 0, w, h * 0.18);
      this._vignette.fillRect(0, h * 0.82, w, h * 0.18);

      // Center card
      const cardW = Math.min(520, w * 0.72);
      const cardH = 220;
      const cy = h * 0.52;
      this._card = this.add.rectangle(w / 2, cy, cardW, cardH, 0x0a1e14, 0.88)
        .setStrokeStyle(2, 0xc9a44a)
        .setDepth(10);
      // Gold accent line
      this.add.rectangle(w / 2, cy - cardH / 2 + 8, cardW - 24, 3, 0xffe08a, 0.35).setDepth(11);

      this._title = this.add.text(w / 2, cy - 62, 'Raid of the Gel', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: Math.min(36, w * 0.045) + 'px',
        color: '#f0ffe8',
        stroke: '#0a2010',
        strokeThickness: 5
      }).setOrigin(0.5).setDepth(12);

      this._subtitle = this.add.text(w / 2, cy - 28, 'Soft Realms · Soft Hearts', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#a8d4b8'
      }).setOrigin(0.5).setDepth(12);

      // Progress track
      const barW = Math.min(360, cardW - 80);
      this._barW = barW;
      this._barTrack = this.add.rectangle(w / 2, cy + 28, barW, 18, 0x12281c, 1)
        .setStrokeStyle(2, 0x77ffaa)
        .setDepth(12);
      this._barFill = this.add.rectangle(w / 2 - barW / 2 + 3, cy + 28, 4, 12, 0x77ffaa)
        .setOrigin(0, 0.5)
        .setDepth(13);
      // Soft glow under fill
      this._barGlow = this.add.rectangle(w / 2 - barW / 2 + 3, cy + 28, 4, 16, 0xaaffcc, 0.25)
        .setOrigin(0, 0.5)
        .setDepth(12);

      this._pctText = this.add.text(w / 2, cy + 28, '0%', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '11px',
        color: '#042418',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(14);

      this._statusText = this.add.text(w / 2, cy + 58, BOOT_TIPS[0], {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        color: '#88ccaa'
      }).setOrigin(0.5).setDepth(12);

      this._tipIndex = 0;
      this._tipTimer = this.time.addEvent({
        delay: 1600,
        loop: true,
        callback: () => {
          if (!this._statusText || !this.sys.isActive()) return;
          // Don't override final status
          if (this._progressDone) return;
          this._tipIndex = (this._tipIndex + 1) % BOOT_TIPS.length;
          this._statusText.setText(BOOT_TIPS[this._tipIndex]);
        }
      });

      // Corner ornament ticks
      const tick = this.add.graphics().setDepth(11);
      const tw = cardW / 2 - 8;
      const th = cardH / 2 - 8;
      tick.lineStyle(2, 0xc9a44a, 0.7);
      // TL
      tick.lineBetween(w / 2 - tw, cy - th, w / 2 - tw + 18, cy - th);
      tick.lineBetween(w / 2 - tw, cy - th, w / 2 - tw, cy - th + 18);
      // TR
      tick.lineBetween(w / 2 + tw, cy - th, w / 2 + tw - 18, cy - th);
      tick.lineBetween(w / 2 + tw, cy - th, w / 2 + tw, cy - th + 18);
      // BL
      tick.lineBetween(w / 2 - tw, cy + th, w / 2 - tw + 18, cy + th);
      tick.lineBetween(w / 2 - tw, cy + th, w / 2 - tw, cy + th - 18);
      // BR
      tick.lineBetween(w / 2 + tw, cy + th, w / 2 + tw - 18, cy + th);
      tick.lineBetween(w / 2 + tw, cy + th, w / 2 + tw, cy + th - 18);

      this._markSlot = { x: w / 2, y: cy - 110 };
    }

    _attachBootArt() {
      if (!this.textures.exists('boot_bg') || this._bgImg) return;
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      this._bgImg = this.add.image(w / 2, h / 2, 'boot_bg')
        .setDisplaySize(w, h)
        .setDepth(0)
        .setAlpha(0);
      // Dim so the loading card stays readable
      this._bgDim = this.add.rectangle(w / 2, h / 2, w, h, 0x02140c, 0.55).setDepth(1);
      this.tweens.add({ targets: this._bgImg, alpha: 1, duration: 500 });
    }

    _attachBootMark() {
      if (!this.textures.exists('boot_mark') || this._markImg) return;
      // Combat gels ship on hot-magenta studio — key before first paint
      // so the load-screen gel never flashes magenta.
      try {
        if (global.SR_ART && typeof global.SR_ART.magentaChromaToCanvas === 'function') {
          var srcImg = this.textures.get('boot_mark').getSourceImage();
          var keyed = global.SR_ART.magentaChromaToCanvas(srcImg, {});
          if (keyed) {
            if (this.textures.exists('boot_mark')) this.textures.remove('boot_mark');
            this.textures.addCanvas('boot_mark', keyed);
          }
        }
      } catch (eKey) {
        console.warn('[Boot] boot_mark chroma failed', eKey && eKey.message);
      }
      const s = this._markSlot || { x: this.cameras.main.width / 2, y: 120 };
      // Soft ring
      this.add.circle(s.x, s.y, 52, 0x0a1a12, 0.9)
        .setStrokeStyle(3, 0xc9a44a)
        .setDepth(15);
      this._markImg = this.add.image(s.x, s.y, 'boot_mark')
        .setDisplaySize(88, 88)
        .setDepth(16)
        .setAlpha(0);
      // Circular mask
      try {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff);
        g.fillCircle(s.x, s.y, 44);
        this._markImg.setMask(g.createGeometryMask());
      } catch (e) { /* ignore */ }
      this.tweens.add({
        targets: this._markImg,
        alpha: 1,
        duration: 450
      });
      // Gentle bob
      this.tweens.add({
        targets: this._markImg,
        y: s.y - 6,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    _setProgress(v) {
      const barW = this._barW || 360;
      const fillW = Math.max(4, (barW - 6) * v);
      if (this._barFill) this._barFill.width = fillW;
      if (this._barGlow) this._barGlow.width = fillW;
      if (this._pctText) this._pctText.setText(Math.floor(v * 100) + '%');
    }

    create() {
      this._progressDone = true;
      if (this._statusText) this._statusText.setText('Preparing champions…');

      if (!global.SR_GAME_STATE) {
        global.SR_GAME_STATE = global.SR_STATE.loadState();
      }
      // QA shard bank is opt-in only (localStorage sr_dev_shards === '1')
      try {
        if (global.SR_STATE && global.SR_STATE.applyBootEconomy) {
          var grant = global.SR_STATE.applyBootEconomy(global.SR_GAME_STATE);
          if (grant && grant.ok) console.log('[Boot] Dev shards ready', grant);
        }
      } catch (eDev) { /* ignore */ }

      if (this._loadFails && this._loadFails.length) {
        console.warn('[Boot] failed assets:', this._loadFails.length, this._loadFails.slice(0, 8));
      }
      if (global.SR_UI && global.SR_UI.installCrispText && this.scene && this.scene.manager) {
        var keys = this.scene.manager.keys || {};
        var self = this;
        Object.keys(keys).forEach(function (k) {
          try {
            var sc = self.scene.manager.getScene(k);
            if (sc) global.SR_UI.installCrispText(sc);
          } catch (e) { /* ignore */ }
        });
      }

      // Ensure pre-battle scene is always registered (fixes black screen if boot list missed it)
      try {
        var PBS = global.PreBattleScene || (typeof window !== 'undefined' && window.PreBattleScene);
        if (PBS && this.scene && !this.scene.get('PreBattleScene')) {
          this.scene.add('PreBattleScene', PBS, false);
          console.log('[Boot] registered PreBattleScene');
        }
      } catch (ePre) {
        console.warn('[Boot] PreBattle register', ePre && ePre.message);
      }

      var goHub = function () {
        this.scene.start('HubScene');
      }.bind(this);

      var finishArtThenHub = function () {
        // Sprite-first: skip heavy 3D bake unless localStorage sr_bake_slime3d=1
        var forceBake3d = false;
        try {
          forceBake3d = (typeof localStorage !== 'undefined' &&
            localStorage.getItem('sr_bake_slime3d') === '1');
        } catch (eF) { forceBake3d = false; }

        var els = (global.SR_DATA && global.SR_DATA.ELEMENTS) || [];
        if (forceBake3d && global.SR_SLIME3D && typeof global.SR_SLIME3D.bakeAll === 'function' &&
            typeof THREE !== 'undefined') {
          if (this._statusText) this._statusText.setText('Shaping 3D gel champions…');
          global.SR_SLIME3D.bakeAll(els, function (el) {
            return (global.SR_ART && global.SR_ART.combatGelPath)
              ? global.SR_ART.combatGelPath(el)
              : 'assets/battle/gels/combat/' + String(el).toLowerCase() + '.jpg';
          }).then(function (res) {
            console.log('[Boot] Slime3D bake', res);
            if (res && res.ok) {
              global.SR_SLIME3D.registerWithPhaser(this.game);
              global.SR_SLIME3D.startLoop(this.game);
            }
            goHub();
          }.bind(this)).catch(function (e) {
            console.warn('[Boot] Slime3D bake failed', e);
            goHub();
          });
        } else {
          goHub();
        }
      }.bind(this);

      // Combat-sprite path: chunked magenta key (never block the main thread at 100%)
      if (this._statusText) this._statusText.setText('Cutting combat gel sprites…');
      var self = this;
      var afterGels = function () {
        try {
          if (global.SR_ART && global.SR_ART.registerPhaserEnemies) {
            global.SR_ART.registerPhaserEnemies(self);
          }
          if (global.SR_ART && global.SR_ART.registerPhaserUiCutouts) {
            global.SR_ART.registerPhaserUiCutouts(self);
          }
        } catch (eArt2) {
          console.warn('[Boot] enemy/ui cutout register failed', eArt2);
        }
        finishArtThenHub();
      };

      try {
        if (global.SR_ART && global.SR_ART.registerPhaserCombatGelsAsync) {
          global.SR_ART.registerPhaserCombatGelsAsync(this, {
            msPerSlice: 10,
            onProgress: function (p) {
              var pct = Math.floor(p * 100);
              if (self._statusText) {
                self._statusText.setText('Cutting combat gel sprites… ' + pct + '%');
              }
              // Keep bar full; show cut progress in label only
              if (self._pctText) self._pctText.setText(pct + '%');
            },
            onDone: function () {
              afterGels();
            }
          });
        } else if (global.SR_ART && global.SR_ART.registerPhaserCombatGels) {
          global.SR_ART.registerPhaserCombatGels(this);
          afterGels();
        } else {
          afterGels();
        }
      } catch (eArt) {
        console.warn('[Boot] combat art register failed', eArt);
        afterGels();
      }
    }
  }

  global.BootScene = BootScene;
})(typeof window !== 'undefined' ? window : global);
