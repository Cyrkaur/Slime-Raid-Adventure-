/* Page travel — new bg covers the old (no black / green intermediate).
 *
 *   SR_TRANSIT.go(scene, 'RosterScene');
 *
 * Video: next clip loads on the spare layer, then sits fully opaque on top of
 * the current clip; old is dropped. Phaser UI swaps with scene.start — no
 * camera fadeOut (that was the black flash).
 */
(function (global) {
  'use strict';

  var _busy = false;
  var _timers = [];

  var SCENE_VIDEO = {
    HubScene: 'hub_bg_video',
    CampaignScene: 'mode_campaign_video',
    DungeonScene: 'dungeon_bg_video',
    RosterScene: 'mode_champions_video',
    ChampionDetailScene: 'mode_champions_video',
    SummonScene: 'mode_summon_video',
    VaultScene: 'mode_vault_video',
    GreatHallScene: 'mode_great_hall_video',
    AlchemyScene: 'mode_alchemy_video',
    WorkshopScene: 'mode_workshop_video',
    MarketScene: 'mode_market_video',
    EternityScene: 'mode_eternity_video',
    ChronicleScene: 'mode_chronicle_video'
  };

  function _clearTimers() {
    for (var i = 0; i < _timers.length; i++) {
      try { clearTimeout(_timers[i]); } catch (e) { /* ignore */ }
    }
    _timers = [];
  }

  function _later(fn, ms) {
    var id = setTimeout(fn, ms);
    _timers.push(id);
    return id;
  }

  /**
   * @param {Phaser.Scene} fromScene
   * @param {string} targetKey
   * @param {object} [data]
   * @param {object} [opts]
   * @param {boolean} [opts.instant]
   */
  function go(fromScene, targetKey, data, opts) {
    opts = opts || {};
    if (!fromScene || !targetKey) return;

    if (opts.instant || _busy) {
      try {
        if (data != null) fromScene.scene.start(targetKey, data);
        else fromScene.scene.start(targetKey);
      } catch (e) {
        console.warn('[Transit] start failed', targetKey, e);
      }
      return;
    }

    try {
      if (fromScene.scene.key === targetKey && data == null) return;
    } catch (e0) { /* ignore */ }

    _busy = true;
    _clearTimers();

    // 1) Cover old bg with new (never fade through black)
    var vKey = SCENE_VIDEO[targetKey];
    if (vKey && global.SR_MODE_VIDEO && typeof global.SR_MODE_VIDEO.switchTo === 'function') {
      try {
        global.SR_MODE_VIDEO.switchTo(vKey, { cover: true });
      } catch (eW) { /* ignore */ }
    }

    // 2) Swap UI immediately — no camera fadeOut/fadeIn
    try {
      if (fromScene.cameras && fromScene.cameras.main) {
        // Cancel any leftover fade from older builds so we don't stick black
        try {
          if (typeof fromScene.cameras.main.resetFX === 'function') {
            fromScene.cameras.main.resetFX();
          } else if (fromScene.cameras.main.fadeEffect &&
                     typeof fromScene.cameras.main.fadeEffect.reset === 'function') {
            fromScene.cameras.main.fadeEffect.reset();
          }
        } catch (eFx) { /* ignore */ }
      }
      if (data != null) fromScene.scene.start(targetKey, data);
      else fromScene.scene.start(targetKey);
    } catch (eS) {
      console.warn('[Transit] start failed', targetKey, eS);
      _busy = false;
      return;
    }

    // Brief lock so double-clicks don't stack
    _later(function () {
      _busy = false;
    }, 120);
  }

  function cancel() {
    _clearTimers();
    _busy = false;
    var veil = document.getElementById('sr-page-veil');
    if (veil) {
      veil.style.opacity = '0';
      veil.style.display = 'none';
      veil.style.pointerEvents = 'none';
    }
  }

  global.SR_TRANSIT = {
    go: go,
    cancel: cancel,
    SCENE_VIDEO: SCENE_VIDEO
  };

  if (global.SR_UI) {
    global.SR_UI.goScene = function (scene, key, data, opts) {
      go(scene, key, data, opts);
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SR_TRANSIT;
  }
})(typeof window !== 'undefined' ? window : global);
