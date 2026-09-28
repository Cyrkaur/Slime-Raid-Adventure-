/* Soft beginning — Lyra intro dialogue + name prompt */
(function (global) {
  'use strict';

  class IntroScene extends Phaser.Scene {
    constructor() {
      super({ key: 'IntroScene' });
    }

    init(data) {
      this.force = !!(data && data.force);
      this.skipTutorial = !!(data && data.skipTutorial);
    }

    create() {
      if (global.SR_UI && global.SR_UI.installCrispText) global.SR_UI.installCrispText(this);
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
      global.SR_GAME_STATE = state;
      const DATA = global.SR_DATA || {};
      const intro = DATA.PLAYER_INTRO || { title: 'A Soft Beginning', pages: [], dismissLabel: 'Continue' };
      const guide = DATA.GUIDE_NPC || { name: 'Lyra Softbough', title: 'Haven Loremistress' };

      this.page = 0;
      this.pages = intro.pages || [];
      this._namePromptOpen = false;
      this._pendingTutorial = true;

      // Dim village behind
      this.cameras.main.setBackgroundColor('#02140c');
      if (this.textures.exists('hub_bg')) {
        this.add.image(w / 2, h / 2, 'hub_bg').setDisplaySize(w, h).setAlpha(0.35).setDepth(0);
      }
      this.add.rectangle(w / 2, h / 2, w, h, 0x02140c, 0.55).setDepth(1);

      // Dialogue panel
      const panelW = Math.min(1100, w - 80);
      const panelH = Math.min(520, h - 100);
      this.add.rectangle(w / 2, h / 2, panelW, panelH, 0x0c1a14, 0.96)
        .setStrokeStyle(3, 0xc9a44a).setDepth(10);

      // Left portrait
      const px = w / 2 - panelW / 2 + 160;
      const py = h / 2 - 20;
      this.add.rectangle(px, py, 240, 320, 0x0a1810, 0.9)
        .setStrokeStyle(2, 0x88aa77).setDepth(11);
      if (this.textures.exists('lyra_guide')) {
        this.add.image(px, py - 20, 'lyra_guide').setDisplaySize(200, 240).setDepth(12);
      } else {
        this.add.circle(px, py - 20, 80, 0x2a5530).setDepth(12);
        this.add.text(px, py - 20, '🌿', { fontSize: '64px' }).setOrigin(0.5).setDepth(13);
      }
      this.add.text(px, py + 130, guide.name || 'Lyra Softbough', {
        fontFamily: 'Georgia, serif', fontSize: '16px', color: '#e8ffd4', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(12);
      this.add.text(px, py + 152, guide.title || 'Haven Loremistress', {
        fontFamily: 'system-ui', fontSize: '12px', color: '#88bb99'
      }).setOrigin(0.5).setDepth(12);

      // Right speech column
      const sx = w / 2 + 80;
      this._speechX = sx;
      this._panelH = panelH;
      this.add.text(sx, h / 2 - panelH / 2 + 36, 'RAID OF THE GEL', {
        fontFamily: 'system-ui', fontSize: '12px', color: '#88aa77', letterSpacing: 2
      }).setOrigin(0.5).setDepth(12);
      this.add.text(sx, h / 2 - panelH / 2 + 64, intro.title || 'A Soft Beginning', {
        fontFamily: 'Georgia, serif', fontSize: '28px', color: '#f0ffe8'
      }).setOrigin(0.5).setDepth(12);

      this.kickerText = this.add.text(sx - 280, h / 2 - 80, '', {
        fontFamily: 'system-ui', fontSize: '13px', color: '#ffeeaa', fontStyle: 'bold'
      }).setDepth(12);
      this.bodyText = this.add.text(sx - 280, h / 2 - 50, '', {
        fontFamily: 'system-ui', fontSize: '16px', color: '#d8f0e0',
        wordWrap: { width: panelW * 0.52 }, lineSpacing: 6
      }).setDepth(12);

      this.dotsText = this.add.text(sx, h / 2 + panelH / 2 - 100, '', {
        fontFamily: 'system-ui', fontSize: '18px', color: '#88aa77'
      }).setOrigin(0.5).setDepth(12);

      // Actions
      const UI = global.SR_UI;
      const btnY = h / 2 + panelH / 2 - 48;
      this._btnY = btnY;
      this.skipBtn = UI.addButton(this, sx - 120, btnY, 160, 42, 'Skip for now', 0x333322, () => {
        this._pendingTutorial = false;
        this._beginNamePrompt();
      });
      this.nextBtn = UI.addButton(this, sx + 100, btnY, 200, 42, 'Continue', 0x1a5530, () => {
        this._onNext();
      });

      this.events.once('shutdown', () => this._destroyNameDom());
      this.events.once('destroy', () => this._destroyNameDom());

      this._renderPage();
    }

    _renderPage() {
      const intro = (global.SR_DATA && global.SR_DATA.PLAYER_INTRO) || {};
      const p = this.pages[this.page] || { kicker: '', body: '', speaker: 'Lyra' };
      this.kickerText.setText(p.kicker || '');
      this.bodyText.setText((p.speaker || 'Lyra Softbough') + ' —  ' + (p.body || ''));
      this.dotsText.setText(this.pages.map((_, i) => (i === this.page ? '●' : '○')).join('  '));
      const last = this.page >= this.pages.length - 1;
      if (this.nextBtn && this.nextBtn.text) {
        this.nextBtn.text.setText(last ? 'What is your name?' : 'Continue');
      }
    }

    _onNext() {
      if (this._namePromptOpen) return;
      if (this.page >= this.pages.length - 1) {
        this._pendingTutorial = true;
        this._beginNamePrompt();
      } else {
        this.page++;
        this._renderPage();
      }
    }

    _beginNamePrompt() {
      if (this._namePromptOpen) return;
      this._namePromptOpen = true;

      const intro = (global.SR_DATA && global.SR_DATA.PLAYER_INTRO) || {};
      const np = intro.namePrompt || {};
      const speaker = np.speaker || 'Lyra Softbough';
      const body = np.body ||
        'Before you step into the Haven, tell me what the Softened Realms should call you.';
      const placeholder = np.placeholder || 'Your name…';
      const maxLen = np.maxLen || 18;
      const confirmLabel = np.confirmLabel || 'That is my name';
      const skipLabel = np.skipLabel || 'Call me Keeper';

      this.kickerText.setText(np.kicker || 'Your name');
      this.bodyText.setText(speaker + ' —  ' + body);
      this.dotsText.setText('✦');

      // Hide dialogue buttons while DOM input is active
      try {
        if (this.nextBtn && this.nextBtn.root) this.nextBtn.root.setVisible(false);
        else if (this.nextBtn && this.nextBtn.bg) this.nextBtn.bg.setVisible(false);
        if (this.skipBtn && this.skipBtn.root) this.skipBtn.root.setVisible(false);
        else if (this.skipBtn && this.skipBtn.bg) this.skipBtn.bg.setVisible(false);
        if (this.nextBtn && this.nextBtn.text) this.nextBtn.text.setVisible(false);
        if (this.skipBtn && this.skipBtn.text) this.skipBtn.text.setVisible(false);
      } catch (eH) { /* ignore */ }

      this._mountNameDom({
        placeholder: placeholder,
        maxLen: maxLen,
        confirmLabel: confirmLabel,
        skipLabel: skipLabel,
        defaultName: np.defaultName || 'Keeper'
      });
    }

    _mountNameDom(cfg) {
      this._destroyNameDom();
      const parent = document.getElementById('game-container') || document.body;
      const game = global.SR_PHASER_GAME;
      const canvas = game && game.canvas;

      const wrap = document.createElement('div');
      wrap.id = 'sr-name-prompt';
      wrap.setAttribute('aria-label', 'Enter your name');
      wrap.style.cssText = [
        'position:absolute',
        'z-index:50',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'gap:12px',
        'pointer-events:auto',
        'font-family:Inter,system-ui,sans-serif'
      ].join(';');

      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = cfg.maxLen || 18;
      input.placeholder = cfg.placeholder || 'Your name…';
      input.autocomplete = 'nickname';
      input.spellcheck = false;
      input.style.cssText = [
        'width:min(320px,70vw)',
        'padding:12px 16px',
        'border-radius:10px',
        'border:2px solid #c9a44a',
        'background:#0a1810',
        'color:#f0ffe8',
        'font-size:18px',
        'font-weight:600',
        'outline:none',
        'box-shadow:0 4px 24px rgba(0,0,0,0.45)',
        'text-align:center'
      ].join(';');

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';

      function mkBtn(label, solid) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.style.cssText = [
          'padding:10px 18px',
          'border-radius:8px',
          'border:2px solid ' + (solid ? '#88cc77' : '#886633'),
          'background:' + (solid ? '#1a5530' : '#2a2210'),
          'color:' + (solid ? '#e8ffe8' : '#ffe8c8'),
          'font-size:14px',
          'font-weight:700',
          'cursor:pointer',
          'font-family:inherit'
        ].join(';');
        return b;
      }

      const confirm = mkBtn(cfg.confirmLabel || 'That is my name', true);
      const keep = mkBtn(cfg.skipLabel || 'Call me Keeper', false);
      row.appendChild(confirm);
      row.appendChild(keep);
      wrap.appendChild(input);
      wrap.appendChild(row);
      parent.appendChild(wrap);
      this._nameDom = wrap;

      const syncPos = () => {
        if (!canvas || !parent) return;
        const cRect = canvas.getBoundingClientRect();
        const pRect = parent.getBoundingClientRect();
        // Sit over the speech column / button area of the intro panel
        const left = cRect.left - pRect.left + cRect.width * 0.52;
        const top = cRect.top - pRect.top + cRect.height * 0.58;
        wrap.style.left = Math.round(left) + 'px';
        wrap.style.top = Math.round(top) + 'px';
        wrap.style.transform = 'translate(-50%, -50%)';
      };
      syncPos();
      this._nameResize = () => syncPos();
      window.addEventListener('resize', this._nameResize);
      requestAnimationFrame(syncPos);

      const commit = (raw) => {
        const state = global.SR_GAME_STATE || global.SR_STATE.loadState();
        global.SR_GAME_STATE = state;
        if (global.SR_STATE && global.SR_STATE.setPlayerName) {
          global.SR_STATE.setPlayerName(state, raw);
        } else {
          if (!state.player) state.player = {};
          state.player.name = String(raw || cfg.defaultName || 'Keeper').trim() || 'Keeper';
          if (global.SR_STATE && global.SR_STATE.saveState) global.SR_STATE.saveState(state);
        }
        this._destroyNameDom();
        this._finishAfterName();
      };

      confirm.addEventListener('click', () => commit(input.value));
      keep.addEventListener('click', () => commit(cfg.defaultName || 'Keeper'));
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          commit(input.value);
        }
      });

      // Focus after layout
      setTimeout(() => {
        try { input.focus(); } catch (e) { /* ignore */ }
      }, 80);
    }

    _destroyNameDom() {
      if (this._nameResize) {
        window.removeEventListener('resize', this._nameResize);
        this._nameResize = null;
      }
      if (this._nameDom && this._nameDom.parentNode) {
        this._nameDom.parentNode.removeChild(this._nameDom);
      }
      this._nameDom = null;
    }

    _finishAfterName() {
      const state = global.SR_GAME_STATE;
      if (global.SR_STATE.markIntroSeen) global.SR_STATE.markIntroSeen(state);
      else {
        state.introSeen = true;
        if (global.SR_STATE.saveState) global.SR_STATE.saveState(state);
      }
      const goTutorial = this._pendingTutorial && !this.skipTutorial && !state.tutorialSeen &&
        !(state.flags && state.flags.tutorialPickDone);

      // Skip path: auto Epic pick → hub
      if (!goTutorial) {
        if (!state.tutorialSeen && !(state.flags && state.flags.tutorialPickDone)) {
          if (global.SR_STATE.skipTutorialWithPick) {
            global.SR_STATE.skipTutorialWithPick(state);
          }
        }
        this.scene.start('HubScene');
        return;
      }

      // Raid-style: straight into tutorial battles (use each of 4 gels)
      this._startTutorialBattle(0);
    }

    /**
     * Sequential mini-battles: one gel per wave, then pick scene.
     */
    _startTutorialBattle(waveIndex) {
      const state = global.SR_GAME_STATE;
      const cands = global.SR_STATE.ensureTutorialCandidates
        ? global.SR_STATE.ensureTutorialCandidates(state)
        : [];
      const wi = Math.max(0, Math.min(3, waveIndex | 0));
      const gel = cands[wi];
      if (!gel) {
        this.scene.start('TutorialPickScene');
        return;
      }
      const foe = global.SR_STATE.buildTutorialFoe
        ? global.SR_STATE.buildTutorialFoe(wi)
        : null;
      this.scene.start('BattleScene', {
        tutorial: true,
        tutorialIndex: wi,
        tutorialTotal: 4,
        party: [gel],
        foes: foe ? [foe] : undefined,
        region: 'greenwild',
        arena: 'greenwild',
        spar: false
      });
    }

    _finish(startTutorial) {
      // Legacy path — still route through name if missing
      this._pendingTutorial = !!startTutorial;
      const state = global.SR_GAME_STATE;
      const hasName = state && state.player && String(state.player.name || '').trim();
      if (!hasName) {
        this._beginNamePrompt();
        return;
      }
      this._finishAfterName();
    }
  }

  global.IntroScene = IntroScene;
})(typeof window !== 'undefined' ? window : global);
