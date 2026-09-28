/* Phaser 3 boot — Raid of the Gel (window-scale + HiDPI) */
(function () {
  'use strict';

  /** Design resolution — layouts are authored at 16:9 Full HD */
  var DESIGN_W = 1920;
  var DESIGN_H = 1080;

  function boot() {
    if (typeof Phaser === 'undefined') {
      console.error('Phaser failed to load');
      document.body.innerHTML =
        '<p style="color:#faa;font-family:system-ui;padding:24px">Phaser CDN failed to load. Check network and refresh.</p>';
      return;
    }

    var PreBattle = (typeof PreBattleScene !== 'undefined' && PreBattleScene)
      || (typeof window !== 'undefined' && window.PreBattleScene)
      || null;
    if (!PreBattle) {
      console.error('[Raid] PreBattleScene missing — pre-battle setup will not open');
    }

    var TutPick = (typeof TutorialPickScene !== 'undefined' && TutorialPickScene)
      || (typeof window !== 'undefined' && window.TutorialPickScene)
      || null;

    var scenes = [
      BootScene,
      HubScene,
      IntroScene,
      TutPick,
      PreBattle,
      BattleScene,
      RosterScene,
      ChampionDetailScene,
      CampaignScene,
      SummonScene,
      DungeonScene,
      VaultScene,
      GreatHallScene,
      AlchemyScene,
      WorkshopScene,
      MarketScene,
      EternityScene,
      ChronicleScene
    ].filter(Boolean);

    // HiDPI: sharper text when CSS-scaled up to 2K / Retina (cap 2 for GPU cost)
    var dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

    var config = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: DESIGN_W,
      height: DESIGN_H,
      backgroundColor: '#02140c',
      transparent: true,
      // Backing-store multiplier vs logical size — stays sharp when FIT scales canvas
      resolution: dpr,
      scale: {
        // Fill the window as large as possible while keeping 16:9 (letterbox if needed)
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        autoRound: true,
        width: DESIGN_W,
        height: DESIGN_H,
        expandParent: true,
        // Optional fullscreen API target
        fullscreenTarget: document.getElementById('game-container') || undefined
      },
      scene: scenes,
      render: {
        antialias: true,
        antialiasGL: true,
        roundPixels: true,
        pixelArt: false,
        powerPreference: 'high-performance',
        mipmapFilter: 'LINEAR',
        clearBeforeRender: true,
        transparent: true
      },
      fps: { target: 60, forceSetTimeOut: false },
      banner: false
    };

    var game = new Phaser.Game(config);
    window.SR_PHASER_GAME = game;
    window.SR_GAME_SIZE = {
      width: DESIGN_W,
      height: DESIGN_H,
      designW: DESIGN_W,
      designH: DESIGN_H,
      dpr: dpr,
      displayScale: 1
    };

    function refreshScaleMetrics() {
      try {
        if (game.scale) game.scale.refresh();
      } catch (e) { /* ignore */ }
      var sc = game.scale;
      var ds = 1;
      if (sc && sc.displayScale) {
        ds = (sc.displayScale.x + sc.displayScale.y) * 0.5;
      } else if (sc && sc.canvas) {
        var cw = sc.canvas.clientWidth || DESIGN_W;
        ds = cw / DESIGN_W;
      }
      window.SR_GAME_SIZE = {
        width: DESIGN_W,
        height: DESIGN_H,
        designW: DESIGN_W,
        designH: DESIGN_H,
        dpr: dpr,
        displayScale: ds,
        canvasCssW: sc && sc.canvas ? sc.canvas.clientWidth : null,
        canvasCssH: sc && sc.canvas ? sc.canvas.clientHeight : null
      };
      // Let combat 3D / video layers re-align under the canvas
      try {
        window.dispatchEvent(new CustomEvent('sr-scale-refresh', { detail: window.SR_GAME_SIZE }));
      } catch (e2) { /* ignore */ }
    }

    game.events.once('ready', function () {
      refreshScaleMetrics();
    });

    // Window resize + fullscreen + orientation
    var resizeTimer = null;
    function onViewportChange() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refreshScaleMetrics, 50);
    }
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    document.addEventListener('fullscreenchange', onViewportChange);
    document.addEventListener('webkitfullscreenchange', onViewportChange);

    if (game.scale) {
      game.scale.on('resize', function () {
        refreshScaleMetrics();
      });
    }

    // F11-style: optional double-click on empty chrome not needed; Esc exits FS
    // Expose helper for settings menu later
    window.SR_toggleFullscreen = function () {
      try {
        if (game.scale.isFullscreen) game.scale.stopFullscreen();
        else game.scale.startFullscreen();
      } catch (e) {
        // Fallback to browser Fullscreen API on container
        var el = document.getElementById('game-container') || document.documentElement;
        if (!document.fullscreenElement) {
          if (el.requestFullscreen) el.requestFullscreen();
          else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    };

    console.log('[Raid of the Gel] Phaser game booted', {
      design: DESIGN_W + 'x' + DESIGN_H,
      resolution: dpr,
      scaleMode: 'FIT',
      scenes: scenes.map(function (s) { return s.name || 'Scene'; }),
      hubModes: (window.SR_DATA && window.SR_DATA.HUB_MODES && window.SR_DATA.HUB_MODES.length) || 0
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
