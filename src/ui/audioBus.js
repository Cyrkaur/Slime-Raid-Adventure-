/* ===== Softened Realms audio bus — procedural SFX + volume prefs =====
 * No asset pack required: Web Audio oscillators/noise for UI + combat.
 * Prefer SR_AUDIO.play(id) from scenes; mute/volume via settings.
 */
(function (global) {
  'use strict';

  var STORAGE_VOL = 'sr_audio_vol';
  var STORAGE_MUTE = 'sr_audio_mute';

  var ctx = null;
  var master = null;
  var sfxGain = null;
  var unlocked = false;
  var volume = 0.7; // 0–1
  var muted = false;

  function loadPrefs() {
    try {
      if (typeof localStorage === 'undefined') return;
      var v = localStorage.getItem(STORAGE_VOL);
      if (v != null && isFinite(Number(v))) volume = Math.max(0, Math.min(1, Number(v)));
      muted = localStorage.getItem(STORAGE_MUTE) === '1';
    } catch (e) { /* ignore */ }
  }

  function savePrefs() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_VOL, String(volume));
      localStorage.setItem(STORAGE_MUTE, muted ? '1' : '0');
    } catch (e2) { /* ignore */ }
  }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      sfxGain = ctx.createGain();
      sfxGain.connect(master);
      master.connect(ctx.destination);
      applyGains();
    } catch (e3) {
      ctx = null;
      return null;
    }
    return ctx;
  }

  function applyGains() {
    if (!master || !sfxGain) return;
    var v = muted ? 0 : volume;
    try {
      master.gain.setTargetAtTime(v * 0.85, ctx.currentTime, 0.02);
      sfxGain.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
    } catch (e4) {
      master.gain.value = v * 0.85;
    }
  }

  /** Unlock on first user gesture (browser autoplay policy). */
  function unlock() {
    loadPrefs();
    var c = ensureCtx();
    if (!c) return false;
    if (c.state === 'suspended') {
      c.resume().then(function () { unlocked = true; }).catch(function () { /* ignore */ });
    } else {
      unlocked = true;
    }
    return true;
  }

  function installUnlockListeners() {
    if (typeof document === 'undefined') return;
    var once = function () {
      unlock();
      document.removeEventListener('pointerdown', once, true);
      document.removeEventListener('keydown', once, true);
      document.removeEventListener('touchstart', once, true);
    };
    document.addEventListener('pointerdown', once, true);
    document.addEventListener('keydown', once, true);
    document.addEventListener('touchstart', once, true);
  }

  function noiseBuffer(dur) {
    var c = ensureCtx();
    if (!c) return null;
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    var i;
    for (i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function envGain(t0, attack, peak, decay, endVal) {
    var c = ensureCtx();
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, endVal != null ? endVal : 0.0001), t0 + attack + decay);
    return g;
  }

  function tone(freq, dur, type, peak, opts) {
    opts = opts || {};
    var c = ensureCtx();
    if (!c || muted || volume <= 0.001) return;
    unlock();
    var t0 = c.currentTime + (opts.delay || 0);
    var osc = c.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + dur);
    }
    var g = envGain(t0, opts.attack != null ? opts.attack : 0.01, peak || 0.12, dur * 0.85);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, peak, opts) {
    opts = opts || {};
    var c = ensureCtx();
    if (!c || muted || volume <= 0.001) return;
    unlock();
    var t0 = c.currentTime + (opts.delay || 0);
    var buf = noiseBuffer(dur);
    if (!buf) return;
    var src = c.createBufferSource();
    src.buffer = buf;
    var filter = c.createBiquadFilter();
    filter.type = opts.filter || 'lowpass';
    filter.frequency.setValueAtTime(opts.freq != null ? opts.freq : 1200, t0);
    var g = envGain(t0, 0.005, peak || 0.1, dur * 0.9);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** Named SFX catalog (procedural). */
  var SFX = {
    ui_click: function () {
      tone(520, 0.06, 'triangle', 0.08);
      tone(780, 0.05, 'sine', 0.05, { delay: 0.02 });
    },
    ui_toast_ok: function () {
      tone(440, 0.08, 'sine', 0.07);
      tone(660, 0.1, 'sine', 0.06, { delay: 0.06 });
    },
    ui_toast_bad: function () {
      tone(220, 0.12, 'sawtooth', 0.05);
      tone(160, 0.14, 'triangle', 0.04, { delay: 0.05 });
    },
    ui_open: function () {
      tone(300, 0.1, 'sine', 0.05, { slideTo: 520 });
    },
    ui_close: function () {
      tone(400, 0.08, 'sine', 0.04, { slideTo: 220 });
    },
    hit: function () {
      noiseBurst(0.07, 0.1, { freq: 900 });
      tone(180, 0.08, 'triangle', 0.07, { slideTo: 90 });
    },
    crit: function () {
      noiseBurst(0.09, 0.12, { freq: 1800 });
      tone(660, 0.1, 'square', 0.06);
      tone(990, 0.12, 'sine', 0.07, { delay: 0.04 });
      tone(1320, 0.1, 'sine', 0.05, { delay: 0.08 });
    },
    heal: function () {
      tone(523, 0.12, 'sine', 0.06);
      tone(659, 0.14, 'sine', 0.05, { delay: 0.07 });
      tone(784, 0.16, 'sine', 0.04, { delay: 0.14 });
    },
    buff: function () {
      tone(350, 0.15, 'triangle', 0.05, { slideTo: 700 });
    },
    cast: function () {
      tone(240, 0.14, 'sine', 0.04, { slideTo: 480 });
      noiseBurst(0.1, 0.04, { freq: 600, delay: 0.02 });
    },
    fire: function () {
      noiseBurst(0.12, 0.09, { freq: 700 });
      tone(140, 0.15, 'sawtooth', 0.04, { slideTo: 80 });
    },
    water: function () {
      noiseBurst(0.14, 0.07, { freq: 1400, filter: 'bandpass' });
      tone(400, 0.12, 'sine', 0.05, { slideTo: 200 });
    },
    lightning: function () {
      noiseBurst(0.05, 0.14, { freq: 4000 });
      tone(1200, 0.06, 'square', 0.06);
      tone(200, 0.08, 'sawtooth', 0.04, { delay: 0.03 });
    },
    earth: function () {
      noiseBurst(0.12, 0.11, { freq: 350 });
      tone(90, 0.16, 'triangle', 0.08);
    },
    win: function () {
      tone(523, 0.12, 'sine', 0.07);
      tone(659, 0.12, 'sine', 0.07, { delay: 0.1 });
      tone(784, 0.14, 'sine', 0.08, { delay: 0.2 });
      tone(1046, 0.22, 'sine', 0.07, { delay: 0.32 });
    },
    lose: function () {
      tone(300, 0.18, 'triangle', 0.06, { slideTo: 120 });
      tone(200, 0.22, 'sine', 0.05, { delay: 0.12, slideTo: 80 });
    },
    summon: function () {
      tone(200, 0.2, 'sine', 0.05, { slideTo: 800 });
      noiseBurst(0.18, 0.06, { freq: 900, delay: 0.05 });
      tone(600, 0.15, 'triangle', 0.05, { delay: 0.15 });
    },
    evolve: function () {
      tone(330, 0.15, 'sine', 0.06);
      tone(440, 0.15, 'sine', 0.06, { delay: 0.1 });
      tone(550, 0.18, 'sine', 0.07, { delay: 0.2 });
      tone(880, 0.25, 'triangle', 0.06, { delay: 0.32 });
    },
    equip: function () {
      tone(480, 0.07, 'triangle', 0.06);
      tone(720, 0.08, 'sine', 0.05, { delay: 0.04 });
    }
  };

  function play(id) {
    if (muted || volume <= 0.001) return false;
    var fn = SFX[id];
    if (typeof fn !== 'function') return false;
    try {
      fn();
      return true;
    } catch (e5) {
      return false;
    }
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (volume > 0.001) muted = false;
    applyGains();
    savePrefs();
  }

  function cycleVolume() {
    // 0 → 0.35 → 0.7 → 1.0 → mute
    if (muted) {
      muted = false;
      volume = 0.35;
    } else if (volume < 0.2) {
      volume = 0.35;
    } else if (volume < 0.55) {
      volume = 0.7;
    } else if (volume < 0.9) {
      volume = 1;
    } else {
      muted = true;
    }
    applyGains();
    savePrefs();
    return getLabel();
  }

  function toggleMute() {
    muted = !muted;
    applyGains();
    savePrefs();
    return getLabel();
  }

  function getLabel() {
    if (muted || volume <= 0.001) return 'Sound · OFF';
    var pct = Math.round(volume * 100);
    return 'Sound · ' + pct + '%';
  }

  function getState() {
    return { volume: volume, muted: muted, label: getLabel(), unlocked: unlocked };
  }

  /**
   * Map combat skill / element → sfx id.
   */
  function playCombat(opts) {
    opts = opts || {};
    if (opts.crit) return play('crit');
    if (opts.kind === 'heal' || opts.heal) return play('heal');
    if (opts.kind === 'buff' || opts.buff) return play('buff');
    var el = String(opts.element || '').toLowerCase();
    var id = String(opts.skillId || '').toLowerCase();
    if (el === 'fire' || el === 'lava' || id.indexOf('blaze') >= 0 || id.indexOf('inferno') >= 0) {
      return play('fire');
    }
    if (el === 'water' || el === 'ice' || id.indexOf('splash') >= 0 || id.indexOf('tidal') >= 0) {
      return play('water');
    }
    if (el === 'lightning' || el === 'storm' || id.indexOf('bolt') >= 0 || id.indexOf('chain') >= 0) {
      return play('lightning');
    }
    if (el === 'earth' || el === 'metal' || id.indexOf('smash') >= 0 || id.indexOf('quake') >= 0) {
      return play('earth');
    }
    if (id.indexOf('cast') >= 0 || opts.cast) return play('cast');
    return play('hit');
  }

  loadPrefs();
  installUnlockListeners();

  var API = {
    unlock: unlock,
    play: play,
    playCombat: playCombat,
    setVolume: setVolume,
    cycleVolume: cycleVolume,
    toggleMute: toggleMute,
    getLabel: getLabel,
    getState: getState,
    SFX_IDS: Object.keys(SFX)
  };

  global.SR_AUDIO = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : global);
