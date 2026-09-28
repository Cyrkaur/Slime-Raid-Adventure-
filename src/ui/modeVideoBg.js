/* Smooth looping video backgrounds via dual native DOM <video>.
 *
 * - Hardware-composited under transparent Phaser canvas (smooth motion).
 * - Dual-layer dissolve at clip end (infinite feel, no hard cut).
 * - Same videoKey across scene restarts / tabs / champion switches:
 *   keep playing — never seek or reload.
 * - Page changes: keep last frame up until the next clip is ready (no dark flash).
 * - Shutdown only releases after a short deferral so the next scene can claim
 *   ownership first; Battle calls hide() explicitly.
 */
(function (global) {
  'use strict';

  var HOST_ID = 'sr-bg-video-host';
  var _resizeBound = null;
  var _scaleHandler = null;
  var _raf = null;
  var _state = null;
  var _gen = 0;
  var _switchSeq = 0;
  var _timers = [];
  var _releaseTimer = null;

  var KEY_URLS = {
    hub_bg_video: 'assets/village-hub-loop.mp4',
    dungeon_bg_video: 'assets/dungeon-hall-loop.mp4',
    mode_campaign_video: 'assets/modes/campaign-loop.mp4',
    mode_champions_video: 'assets/modes/champions-loop.mp4',
    mode_summon_video: 'assets/modes/summon-loop.mp4',
    mode_vault_video: 'assets/modes/vault-loop.mp4',
    mode_great_hall_video: 'assets/modes/great-hall-loop.mp4',
    mode_alchemy_video: 'assets/modes/alchemy-loop.mp4',
    mode_workshop_video: 'assets/modes/workshop-loop.mp4',
    mode_market_video: 'assets/modes/market-loop.mp4',
    mode_eternity_video: 'assets/modes/eternity-loop.mp4',
    mode_chronicle_video: 'assets/modes/chronicle-loop.mp4'
  };

  /**
   * @param {Phaser.Scene} scene
   * @param {string} videoKey
   * @param {object} [opts]
   * @returns {boolean}
   */
  function install(scene, videoKey, opts) {
    opts = opts || {};
    var w = scene.cameras.main.width;
    var h = scene.cameras.main.height;
    var wash = opts.wash != null ? opts.wash : 0.12;
    var washColor = opts.washColor != null ? opts.washColor : 0x02140c;
    var fadeSec = opts.fadeSec != null ? opts.fadeSec : 0.55;

    // Cancel any pending “nobody claimed the player” release
    _cancelRelease();

    var url = _resolveUrl(scene, videoKey);
    if (!url) {
      var failGen = ++_gen;
      _scheduleRelease(failGen);
      if (opts.fallbackImage && scene.textures.exists(opts.fallbackImage)) {
        scene.add.image(w / 2, h / 2, opts.fallbackImage).setDisplaySize(w, h).setDepth(0);
      }
      return false;
    }

    var myGen = ++_gen;
    var ok = false;

    try {
      // Mid-switch for THIS key (transit already called switchTo): adopt ownership
      // only — keep the same switchId so the pending cover/reveal still runs.
      if (_state && _state.active && _state.switching && _state.videoKey === videoKey) {
        _state.gen = myGen;
        ok = true;
      } else if (_isFullyPlayingKey(videoKey)) {
        ok = _claimExisting(myGen, videoKey, fadeSec);
      } else {
        // Wrong clip, village stuck, or no switch in flight — force this page's file
        ok = _installOrSwitch(scene, videoKey, url, fadeSec, myGen, { cover: true });
      }
    } catch (e) {
      console.warn('[ModeVideo] install failed', videoKey, e);
      ok = false;
    }

    if (!ok) {
      try {
        if (scene.cache.video && scene.cache.video.exists(videoKey)) {
          ok = _installPhaserSingle(scene, videoKey, w, h, myGen);
        }
      } catch (e2) {
        console.warn('[ModeVideo] Phaser fallback failed', videoKey, e2);
      }
    }

    if (!ok) {
      _scheduleRelease(myGen);
      if (opts.fallbackImage && scene.textures.exists(opts.fallbackImage)) {
        scene.add.image(w / 2, h / 2, opts.fallbackImage).setDisplaySize(w, h).setDepth(0);
      }
      return false;
    }

    try {
      scene.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    } catch (eBg) { /* ignore */ }

    if (wash > 0) {
      scene.add.rectangle(w / 2, h / 2, w, h, washColor, wash).setDepth(1);
    }

    scene.events.once('shutdown', function () {
      if (_gen === myGen) _scheduleRelease(myGen);
    });

    return true;
  }

  function _resolveUrl(scene, videoKey) {
    if (KEY_URLS[videoKey]) return KEY_URLS[videoKey];
    try {
      var entry = scene.cache.video && scene.cache.video.get(videoKey);
      if (!entry) return null;
      if (typeof entry === 'string' && entry) return entry;
      if (entry.src) return entry.src;
      if (entry.currentSrc) return entry.currentSrc;
      if (entry.url) return entry.url;
      if (entry.source && entry.source[0] && entry.source[0].url) {
        return entry.source[0].url;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function _isHostVisible() {
    var host = document.getElementById(HOST_ID);
    return !!(host && host.style.display !== 'none');
  }

  /** True if primary element is actually playing this key's file (not just labeled). */
  function _primarySrcMatches(videoKey) {
    if (!_state || !_state.els) return false;
    var url = KEY_URLS[videoKey];
    if (!url) return false;
    var pri = _state.els[_state.primary];
    if (!pri) return false;
    var src = '';
    try {
      src = pri.currentSrc || pri.src || '';
    } catch (e) {
      return false;
    }
    if (!src) return false;
    // Match absolute or relative forms of the asset path
    var leaf = url.split('/').pop();
    if (leaf && src.indexOf(leaf) >= 0) return true;
    return _urlsEqual(src, url);
  }

  function _isFullyPlayingKey(videoKey) {
    if (!_state || !_state.active || _state.videoKey !== videoKey) return false;
    if (_state.switching) return false;
    if (!_isHostVisible()) return false;
    if (!_primarySrcMatches(videoKey)) return false;
    var pri = _state.els && _state.els[_state.primary];
    if (!pri) return false;
    try {
      if (pri.error) return false;
    } catch (e) {
      return false;
    }
    return true;
  }

  /** @deprecated use _isFullyPlayingKey — kept for switchTo early-out */
  function _isPlayingKey(videoKey) {
    return _isFullyPlayingKey(videoKey);
  }

  /** Same bg already correct on screen — only re-bind ownership */
  function _claimExisting(gen, videoKey, fadeSec) {
    if (!_state) return false;
    _state.gen = gen;
    _state.videoKey = videoKey;
    _state.active = true;
    _state.switching = false;
    if (fadeSec != null) {
      _state.fadeSec = Math.max(0.25, Math.min(1.2, fadeSec));
    }
    var pri = _state.els[_state.primary];
    if (pri && pri.paused && !pri.ended) {
      _safePlay(pri);
    }
    if (_raf == null) _tick();
    var host = document.getElementById(HOST_ID);
    if (host) {
      host.style.display = 'block';
      _syncHostToCanvas(host);
      _bindResize(host);
    }
    return true;
  }

  function _clearTimers() {
    for (var i = 0; i < _timers.length; i++) {
      try { clearTimeout(_timers[i]); } catch (e) { /* ignore */ }
    }
    _timers = [];
  }

  function _later(fn, ms) {
    var id = window.setTimeout(fn, ms);
    _timers.push(id);
    return id;
  }

  function _cancelRelease() {
    if (_releaseTimer != null) {
      try { clearTimeout(_releaseTimer); } catch (e) { /* ignore */ }
      _releaseTimer = null;
    }
  }

  function _scheduleRelease(gen) {
    _cancelRelease();
    // Two frames + tiny delay: next scene create() almost always runs first
    _releaseTimer = window.setTimeout(function () {
      _releaseTimer = null;
      if (_gen === gen) hide();
    }, 48);
  }

  function _makeVideoEl(id) {
    var el = document.createElement('video');
    el.id = id;
    el.muted = true;
    el.defaultMuted = true;
    el.loop = false;
    el.autoplay = false;
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.setAttribute('muted', '');
    el.preload = 'auto';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'width:100%',
      'height:100%',
      'object-fit:cover',
      'pointer-events:none',
      'opacity:0',
      'z-index:0',
      'background:#02140c',
      'transition:none'
    ].join(';');
    return el;
  }

  function _ensureHost() {
    var host = document.getElementById(HOST_ID);
    if (host) return host;

    var parent = document.getElementById('game-container') || document.body;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'width:100%',
      'height:100%',
      'z-index:0',
      'pointer-events:none',
      'display:none',
      'overflow:hidden',
      'background:#02140c'
    ].join(';');

    host.appendChild(_makeVideoEl('sr-bg-video-a'));
    host.appendChild(_makeVideoEl('sr-bg-video-b'));

    if (parent.firstChild) parent.insertBefore(host, parent.firstChild);
    else parent.appendChild(host);
    return host;
  }

  function _syncHostToCanvas(host) {
    try {
      var game = global.SR_PHASER_GAME;
      var canvas = game && game.canvas;
      var parent = document.getElementById('game-container');
      if (!canvas || !parent || !host) return;

      var cRect = canvas.getBoundingClientRect();
      var pRect = parent.getBoundingClientRect();
      host.style.left = Math.round(cRect.left - pRect.left) + 'px';
      host.style.top = Math.round(cRect.top - pRect.top) + 'px';
      host.style.width = Math.max(1, Math.round(cRect.width)) + 'px';
      host.style.height = Math.max(1, Math.round(cRect.height)) + 'px';
    } catch (e) { /* ignore */ }
  }

  function _bindResize(host) {
    _unbindResize();
    _resizeBound = function () { _syncHostToCanvas(host); };
    window.addEventListener('resize', _resizeBound);
    try {
      var game = global.SR_PHASER_GAME;
      if (game && game.scale && typeof game.scale.on === 'function') {
        _scaleHandler = function () { _syncHostToCanvas(host); };
        game.scale.on('resize', _scaleHandler);
      }
    } catch (e) { /* ignore */ }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        _syncHostToCanvas(host);
        requestAnimationFrame(function () { _syncHostToCanvas(host); });
      });
    }
  }

  function _unbindResize() {
    if (_resizeBound) {
      window.removeEventListener('resize', _resizeBound);
      _resizeBound = null;
    }
    try {
      var game = global.SR_PHASER_GAME;
      if (_scaleHandler && game && game.scale && typeof game.scale.off === 'function') {
        game.scale.off('resize', _scaleHandler);
      }
    } catch (e) { /* ignore */ }
    _scaleHandler = null;
  }

  function _stopRaf() {
    if (_raf != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(_raf);
    }
    _raf = null;
  }

  function _safePlay(el) {
    if (!el) return;
    var p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        var resume = function () {
          el.play().catch(function () { /* ignore */ });
          window.removeEventListener('pointerdown', resume);
        };
        window.addEventListener('pointerdown', resume, { once: true });
      });
    }
  }

  function _setLayer(el, opacity, z, withTransition, fadeSec) {
    if (!el) return;
    el.style.transition = withTransition
      ? ('opacity ' + fadeSec + 's ease-in-out')
      : 'none';
    el.style.opacity = String(opacity);
    el.style.zIndex = String(z);
  }

  /**
   * Preload a clip into the spare decoder without changing what's on screen.
   * Called under the travel veil so the next page is ready when it lifts.
   */
  function warmup(videoKey) {
    var url = KEY_URLS[videoKey];
    if (!url) return;
    if (_isPlayingKey(videoKey)) return;
    var host = document.getElementById(HOST_ID);
    var a = document.getElementById('sr-bg-video-a');
    var b = document.getElementById('sr-bg-video-b');
    if (!a || !b) {
      // Host may not exist yet — lightweight off-DOM preload
      try {
        var pre = document.createElement('video');
        pre.muted = true;
        pre.preload = 'auto';
        pre.src = url;
        pre.load();
        pre._srWarm = true;
      } catch (e) { /* ignore */ }
      return;
    }
    // Load into whichever layer is currently not primary (or B if no state)
    var spare = b;
    if (_state && _state.els) {
      spare = _state.els[1 - _state.primary] || b;
    }
    try {
      if (!_urlsEqual(spare.currentSrc || spare.src, url)) {
        spare.muted = true;
        spare.loop = false;
        spare.preload = 'auto';
        spare.src = url;
        spare.load();
      }
    } catch (e2) { /* ignore */ }
    void host;
  }

  function _urlsEqual(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    try {
      return new URL(a, window.location.href).href === new URL(b, window.location.href).href;
    } catch (e) {
      return false;
    }
  }

  function _beginDissolve(gen) {
    if (!_state || _state.gen !== gen || _state.fading || !_state.active) return;
    var pri = _state.els[_state.primary];
    var sec = _state.els[1 - _state.primary];
    if (!pri || !sec) return;

    _state.fading = true;
    var fadeSec = _state.fadeSec;

    try {
      sec.pause();
      sec.currentTime = 0;
    } catch (e0) { /* ignore */ }

    _setLayer(sec, 1, 0, false, fadeSec);
    _setLayer(pri, 1, 1, false, fadeSec);
    _safePlay(sec);

    var headMs = _state.hasLooped ? 24 : 80;
    _later(function () {
      if (!_state || _state.gen !== gen || !_state.active) return;
      void pri.offsetWidth;
      _setLayer(pri, 0, 1, true, fadeSec);

      _later(function () {
        if (!_state || _state.gen !== gen || !_state.active) return;
        try {
          pri.pause();
          pri.currentTime = 0;
        } catch (e1) { /* ignore */ }
        _setLayer(pri, 0, 0, false, fadeSec);
        _setLayer(sec, 1, 1, false, fadeSec);
        _state.primary = 1 - _state.primary;
        _state.hasLooped = true;
        _state.fading = false;
      }, Math.max(200, Math.floor(fadeSec * 1000)) + 16);
    }, headMs);
  }

  function _tick() {
    if (!_state || !_state.active) {
      _raf = null;
      return;
    }
    var gen = _state.gen;

    if (!_state.fading && !_state.switching) {
      var pri = _state.els[_state.primary];
      if (pri) {
        var d = pri.duration || 0;
        var t = pri.currentTime || 0;
        var lead = _state.fadeSec + 0.04;
        if (d > 1.2 && isFinite(d) && t >= d - lead) {
          _beginDissolve(gen);
        }
      }
    }

    _raf = requestAnimationFrame(_tick);
  }

  /**
   * Fresh start or change of clip. Never blanks the host while the previous
   * clip is still on screen — loads the new file on the spare layer first.
   */
  function _installOrSwitch(scene, videoKey, url, fadeSec, gen, switchOpts) {
    switchOpts = switchOpts || {};
    var host = _ensureHost();
    var a = document.getElementById('sr-bg-video-a');
    var b = document.getElementById('sr-bg-video-b');
    if (!a || !b) return false;

    // New switch token — ownership gen can change without killing this switch
    var switchId = ++_switchSeq;

    _clearTimers();
    var hadLive = _state && _state.active && _isHostVisible();

    host.style.display = 'block';
    _syncHostToCanvas(host);
    _bindResize(host);

    fadeSec = Math.max(0.25, Math.min(1.2, fadeSec || 0.55));

    var oldPrimary = hadLive ? _state.els[_state.primary] : null;
    var oldSecondary = hadLive ? _state.els[1 - _state.primary] : null;

    function stillThisSwitch() {
      return _state && _state.active && _state.switchId === switchId &&
        _state.videoKey === videoKey;
    }

    // Brand-new: both layers load + play A
    if (!hadLive || !oldPrimary) {
      _stopRaf();
      _forceLoad(a, url);
      _forceLoad(b, url);
      _state = {
        els: [a, b],
        primary: 0,
        fading: false,
        switching: false,
        hasLooped: false,
        fadeSec: fadeSec,
        url: url,
        videoKey: videoKey,
        gen: gen,
        switchId: switchId,
        active: true
      };
      _setLayer(a, 1, 1, false, fadeSec);
      _setLayer(b, 0, 0, false, fadeSec);
      _safePlay(a);
      _prewarmSecondary(b, gen, fadeSec);
      _bindEnded(a, b, gen);
      if (_raf == null) _tick();
      return true;
    }

    // Switch clips: spare layer loads new file; current primary stays until cover
    var incoming = oldSecondary;
    var outgoing = oldPrimary;
    if (!incoming || !outgoing) {
      incoming = a;
      outgoing = b;
    }

    _state = {
      els: [a, b],
      primary: outgoing === a ? 0 : 1,
      fading: false,
      switching: true,
      hasLooped: false,
      fadeSec: fadeSec,
      url: url,
      videoKey: videoKey,
      gen: gen,
      switchId: switchId,
      active: true
    };

    _setLayer(outgoing, 1, 1, false, fadeSec);
    _setLayer(incoming, 0, 0, false, fadeSec);

    var useCover = !!switchOpts.cover;
    var finishSwitch = function () {
      if (!stillThisSwitch()) return;
      try { outgoing.pause(); } catch (e1) { /* ignore */ }
      _setLayer(outgoing, 0, 0, false, 0);
      _setLayer(incoming, 1, 1, false, 0);
      if (!_urlsEqual(outgoing.currentSrc || outgoing.src, url)) {
        _forceLoad(outgoing, url);
      } else {
        try { outgoing.currentTime = 0; } catch (e2) { /* ignore */ }
      }
      _state.primary = incoming === a ? 0 : 1;
      _state.switching = false;
      _state.hasLooped = false;
      _state.url = url;
      _prewarmSecondary(outgoing, _state.gen, fadeSec);
      _bindEnded(a, b, _state.gen);
      if (_raf == null) _tick();
    };

    var reveal = function () {
      if (!stillThisSwitch()) return;
      try {
        incoming.currentTime = 0;
      } catch (e0) { /* ignore */ }
      _safePlay(incoming);

      if (useCover) {
        // New full opacity on top of old — never black between
        _setLayer(outgoing, 1, 0, false, 0);
        _setLayer(incoming, 1, 1, false, 0);
        _later(function () {
          finishSwitch();
        }, 48);
        return;
      }

      var pageFade = Math.min(0.35, Math.max(0.18, fadeSec * 0.45));
      _setLayer(outgoing, 1, 0, false, pageFade);
      _setLayer(incoming, 0, 1, false, pageFade);
      void incoming.offsetWidth;
      _setLayer(incoming, 1, 1, true, pageFade);

      _later(function () {
        finishSwitch();
      }, Math.floor(pageFade * 1000) + 24);
    };

    var onReady = function () {
      incoming.removeEventListener('loadeddata', onReady);
      incoming.removeEventListener('canplay', onReady);
      reveal();
    };

    var needLoad = !_urlsEqual(incoming.currentSrc || incoming.src, url) &&
      !(KEY_URLS[videoKey] && (incoming.currentSrc || incoming.src || '')
        .indexOf(KEY_URLS[videoKey].split('/').pop()) >= 0);

    if (needLoad) {
      incoming.addEventListener('loadeddata', onReady);
      incoming.addEventListener('canplay', onReady);
      _forceLoad(incoming, url);
      _later(function () {
        if (!stillThisSwitch() || !_state.switching) return;
        if (incoming.readyState >= 2) reveal();
      }, 60);
      _later(function () {
        if (!stillThisSwitch() || !_state.switching) return;
        reveal();
      }, 500);
    } else {
      reveal();
    }

    if (_raf == null) _tick();
    return true;
  }

  function _forceLoad(el, url) {
    try { el.pause(); } catch (e) { /* ignore */ }
    el.loop = false;
    el.muted = true;
    el.src = url;
    el.load();
  }

  function _prewarmSecondary(sec, gen, fadeSec) {
    try {
      _safePlay(sec);
      _later(function () {
        if (!_state || _state.gen !== gen || !_state.active) return;
        try {
          sec.pause();
          sec.currentTime = 0;
        } catch (eW) { /* ignore */ }
        _setLayer(sec, 0, 0, false, fadeSec);
      }, 120);
    } catch (e) { /* ignore */ }
  }

  function _bindEnded(a, b, gen) {
    var onEnded = function (ev) {
      if (!_state || _state.gen !== gen || !_state.active || _state.fading || _state.switching) return;
      if (ev && ev.target === _state.els[_state.primary]) {
        _beginDissolve(gen);
      }
    };
    a.removeEventListener('ended', a._srEnded);
    b.removeEventListener('ended', b._srEnded);
    a._srEnded = onEnded;
    b._srEnded = onEnded;
    a.addEventListener('ended', onEnded);
    b.addEventListener('ended', onEnded);
  }

  function _installPhaserSingle(scene, videoKey, w, h, gen) {
    var fit = function (vid) {
      try {
        if (typeof vid.setDisplaySize === 'function') vid.setDisplaySize(w, h);
        else {
          var vw = vid.videoWidth || vid.width || 1280;
          var vh = vid.videoHeight || vid.height || 720;
          vid.setScale(Math.max(w / vw, h / vh));
        }
      } catch (e2) { /* ignore */ }
    };

    var host = document.getElementById(HOST_ID);
    if (host) host.style.display = 'none';

    var v = scene.add.video(w / 2, h / 2, videoKey);
    v.setDepth(0);
    if (typeof v.setMute === 'function') v.setMute(true);
    fit(v);
    if (typeof v.on === 'function') {
      v.on('play', function () { fit(v); });
      v.on('textureready', function () { fit(v); });
    }
    try {
      if (v.video) {
        v.video.loop = true;
        v.video.muted = true;
        v.video.playsInline = true;
      }
    } catch (eL) { /* ignore */ }
    v.play(true);

    scene._modeVideos = [v];
    scene.events.once('shutdown', function () {
      if (_gen !== gen) return;
      try {
        if (v && v.stop) v.stop();
        if (v && v.destroy) v.destroy();
      } catch (e) { /* ignore */ }
      scene._modeVideos = null;
    });
    return true;
  }

  /** Hard hide — battle, boot, or deferred release with no claimant */
  function hide() {
    _cancelRelease();
    _gen++;
    _clearTimers();
    _stopRaf();
    _unbindResize();
    if (_state) {
      _state.active = false;
      _state.fading = false;
      _state.switching = false;
    }
    var host = document.getElementById(HOST_ID);
    var a = document.getElementById('sr-bg-video-a');
    var b = document.getElementById('sr-bg-video-b');
    try {
      if (a) a.pause();
      if (b) b.pause();
    } catch (e) { /* ignore */ }
    if (host) host.style.display = 'none';
    var legacy = document.getElementById('sr-bg-video');
    if (legacy) {
      try { legacy.pause(); } catch (e2) { /* ignore */ }
      legacy.style.display = 'none';
    }
  }

  /**
   * Start a direct bg crossfade to another mode clip (for page travel).
   * Does not require a Phaser scene; bumps gen so old scene shutdown won't hide mid-fade.
   */
  function switchTo(videoKey, opts) {
    opts = opts || {};
    var url = KEY_URLS[videoKey];
    if (!url) return false;
    _cancelRelease();
    // Already fully on this clip
    if (_isFullyPlayingKey(videoKey)) return true;
    // Already switching to this clip — leave it alone
    if (_state && _state.active && _state.switching && _state.videoKey === videoKey) {
      return true;
    }
    var gen = ++_gen;
    try {
      return _installOrSwitch(null, videoKey, url, opts.fadeSec != null ? opts.fadeSec : 0.55, gen, {
        cover: opts.cover !== false
      });
    } catch (e) {
      console.warn('[ModeVideo] switchTo failed', videoKey, e);
      return false;
    }
  }

  global.SR_MODE_VIDEO = {
    install: install,
    hide: hide,
    warmup: warmup,
    switchTo: switchTo
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SR_MODE_VIDEO;
  }
})(typeof window !== 'undefined' ? window : global);
