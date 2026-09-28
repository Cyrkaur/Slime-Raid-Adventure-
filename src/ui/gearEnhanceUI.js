/* Raid-style gear: vault picker + enhance struggle bar (shared by Champion detail + Vault) */
(function (global) {
  'use strict';

  var DEPTH = 420;

  function _destroyModal(scene) {
    if (scene._gearModal) {
      try { scene._gearModal.destroy(true); } catch (e) { /* ignore */ }
      scene._gearModal = null;
    }
    scene._gearEnhanceBusy = false;
  }

  function openModalShell(scene, title, opts) {
    opts = opts || {};
    _destroyModal(scene);
    var w = scene.cameras.main.width;
    var h = scene.cameras.main.height;
    var root = scene.add.container(0, 0).setDepth(DEPTH);
    var dim = scene.add.rectangle(w / 2, h / 2, w + 8, h + 8, 0x000000, 0.72)
      .setInteractive();
    dim.on('pointerdown', function () {
      if (!scene._gearEnhanceBusy && opts.onClose !== false) {
        _destroyModal(scene);
        if (typeof opts.onDismiss === 'function') opts.onDismiss();
      }
    });
    var pw = Math.min(opts.pw || 560, w - 60);
    var ph = Math.min(opts.ph || 560, h - 80);
    var cx = w / 2;
    var cy = h / 2;
    var stroke = opts.stroke != null ? opts.stroke : 0xc9a44a;
    // Ink/charcoal plate (village language — not green jade)
    var panel = scene.add.rectangle(cx, cy, pw, ph, 0x0a0e12, 0.98)
      .setStrokeStyle(2.5, stroke, 0.95);
    var rim = scene.add.rectangle(cx, cy, pw - 12, ph - 12, 0x000000, 0)
      .setStrokeStyle(1.2, 0xe8d5a0, 0.28);
    // Gold corner ticks
    var g = scene.add.graphics();
    g.lineStyle(2, 0xc9a44a, 0.75);
    var hw = pw / 2 - 6;
    var hh = ph / 2 - 6;
    var c = 14;
    function tick(ox, oy, sx, sy) {
      g.beginPath();
      g.moveTo(cx + ox, cy + oy + sy * c);
      g.lineTo(cx + ox, cy + oy);
      g.lineTo(cx + ox + sx * c, cy + oy);
      g.strokePath();
    }
    tick(-hw, -hh, 1, 1);
    tick(hw, -hh, -1, 1);
    tick(-hw, hh, 1, -1);
    tick(hw, hh, -1, -1);
    // Soft drop shadow ellipse
    var shadow = scene.add.ellipse(cx, cy + ph * 0.46, pw * 0.9, 28, 0x000000, 0.35);
    var titleT = scene.add.text(cx, cy - ph / 2 + 30, title, {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#ffe8a0', fontStyle: 'bold',
      stroke: '#041208', strokeThickness: 4
    }).setOrigin(0.5);
    var closeX = scene.add.text(cx + pw / 2 - 22, cy - ph / 2 + 22, '✕', {
      fontFamily: 'system-ui', fontSize: '18px', color: '#a09070'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeX.on('pointerover', function () { closeX.setColor('#ffe8a0'); });
    closeX.on('pointerout', function () { closeX.setColor('#a09070'); });
    closeX.on('pointerdown', function () {
      if (!scene._gearEnhanceBusy) {
        _destroyModal(scene);
        if (typeof opts.onDismiss === 'function') opts.onDismiss();
      }
    });
    root.add([dim, shadow, panel, rim, g, titleT, closeX]);
    scene._gearModal = root;
    return {
      root: root,
      pw: pw,
      ph: ph,
      cx: cx,
      cy: cy,
      top: cy - ph / 2,
      add: function (go) {
        if (Array.isArray(go)) root.add(go);
        else root.add(go);
        return go;
      }
    };
  }

  function setColorHex(DATA, setName) {
    var sets = (DATA && DATA.ARTIFACT_SETS) || {};
    var def = sets[setName] || {};
    var hex = def.color || '#668877';
    try {
      return Phaser.Display.Color.HexStringToColor(hex).color || 0x668877;
    } catch (e) {
      return 0x668877;
    }
  }

  function freeArtifacts(state, slotId) {
    var list = (state.artifacts || []).filter(function (a) { return !a.equippedTo; });
    if (!slotId) return list;
    return list.slice().sort(function (a, b) {
      var am = a.slotHint === slotId ? 0 : 1;
      var bm = b.slotHint === slotId ? 0 : 1;
      if (am !== bm) return am - bm;
      return (b.power || b.value || 0) - (a.power || a.value || 0);
    });
  }

  /**
   * Raid-style vault picker — equip only from gear you own (no craft).
   * Gear drops from campaign (random sets) and dungeons (dungeon set pools).
   */
  function openArtifactPicker(scene, opts) {
    opts = opts || {};
    var state = opts.state;
    var slot = opts.slot || { id: null, name: 'Relic', icon: '◆' };
    var champ = opts.champ;
    var UI = opts.UI || global.SR_UI;
    var DATA = opts.DATA || global.SR_DATA || {};
    var free = freeArtifacts(state, slot.id);
    var shell = openModalShell(scene, (slot.icon || '◆') + '  Select ' + (slot.name || 'piece'), {
      ph: free.length ? 520 : 360,
      pw: 560
    });
    var root = shell.root;
    var cx = shell.cx;
    var cy = shell.cy;
    var pw = shell.pw;

    var hint = scene.add.text(cx, shell.top + 58,
      free.length
        ? 'Your vault only · ★ = best fit for this slot · no crafting'
        : 'No free vault gear', {
        fontFamily: 'system-ui', fontSize: '13px', color: '#88aa99', align: 'center',
        wordWrap: { width: pw - 48 }
      }).setOrigin(0.5);
    root.add(hint);

    function equipRow(art) {
      if (!champ || !global.SR_STATE || !global.SR_STATE.equipArtifact) {
        if (UI && UI.toast) UI.toast(scene, 'Cannot equip', false);
        return;
      }
      var res = global.SR_STATE.equipArtifact(state, champ.id, slot.id, art.id);
      if (res.ok && global.SR_AUDIO && global.SR_AUDIO.play) global.SR_AUDIO.play('equip');
      if (UI && UI.toast) {
        UI.toast(scene, res.ok ? 'Equipped ' + (art.name || 'relic') : (res.error || 'Failed'), res.ok);
      }
      _destroyModal(scene);
      if (res.ok && typeof opts.onEquipped === 'function') opts.onEquipped(art, res);
    }

    if (!free.length) {
      var empty = scene.add.text(cx, cy + 10,
        'Clear campaign stages (random set drops)\n' +
        'or dungeons (that dungeon\'s set types).\n\n' +
        'Unequip gear elsewhere to free vault pieces.', {
          fontFamily: 'system-ui', fontSize: '14px', color: '#a8ccbb', align: 'center', lineSpacing: 4
        }).setOrigin(0.5);
      root.add(empty);
      return;
    }

    var listTop = shell.top + 88;
    var rowH = 56;
    var maxShow = Math.min(free.length, 7);

    free.slice(0, maxShow).forEach(function (art, i) {
      var ry = listTop + i * rowH;
      var sc = setColorHex(DATA, art.set || art.setName);
      var row = scene.add.rectangle(cx, ry, pw - 48, rowH - 8, 0x122018, 0.98)
        .setStrokeStyle(2, sc, 0.85)
        .setInteractive({ useHandCursor: true });
      var fit = art.slotHint === slot.id ? '  ★ fit' : '';
      var left = scene.add.text(cx - pw / 2 + 40, ry - 10,
        (art.name || 'Relic') + fit, {
          fontFamily: 'system-ui', fontSize: '14px', color: '#f0ffe8', fontStyle: 'bold'
        }).setOrigin(0, 0.5);
      var sub = scene.add.text(cx - pw / 2 + 40, ry + 12,
        (art.set || 'Set') + '  ·  +' + (art.level || 1) +
        '  ·  ' + (art.mainStat || 'pwr') + ' +' + (art.power || art.value || 0) +
        (art.rarity ? '  ·  ' + art.rarity : ''), {
          fontFamily: 'system-ui', fontSize: '12px', color: '#a8c8b8'
        }).setOrigin(0, 0.5);
      var go = scene.add.text(cx + pw / 2 - 40, ry, 'Equip ›', {
        fontFamily: 'system-ui', fontSize: '13px', color: '#c9e8a0', fontStyle: 'bold'
      }).setOrigin(1, 0.5);
      root.add([row, left, sub, go]);
      row.on('pointerover', function () { row.setFillStyle(0x1a3830, 1); });
      row.on('pointerout', function () { row.setFillStyle(0x122018, 0.98); });
      row.on('pointerdown', function () { equipRow(art); });
    });

    if (free.length > maxShow) {
      var more = scene.add.text(cx, listTop + maxShow * rowH + 8,
        '+' + (free.length - maxShow) + ' more in Vault', {
          fontFamily: 'system-ui', fontSize: '12px', color: '#779988'
        }).setOrigin(0.5);
      root.add(more);
    }
  }

  /**
   * Equipped piece menu: Enhance / Replace / Unequip
   */
  function openEquippedMenu(scene, opts) {
    opts = opts || {};
    var state = opts.state;
    var champ = opts.champ;
    var slot = opts.slot;
    var piece = opts.piece;
    var UI = opts.UI || global.SR_UI;
    var DATA = opts.DATA || global.SR_DATA || {};
    var shell = openModalShell(scene, (slot.icon || '') + '  ' + (piece.name || slot.name), {
      ph: 480,
      pw: 480
    });
    var root = shell.root;
    var cx = shell.cx;
    var cy = shell.cy;
    var ph = shell.ph;

    var preview = global.SR_STATE.enhanceArtifactPreview
      ? global.SR_STATE.enhanceArtifactPreview(state, piece.id)
      : null;
    var chancePct = preview && preview.ok ? Math.round(preview.chance * 100) : 100;
    var costG = preview && preview.ok ? preview.costGold : 50;
    var costE = preview && preview.ok ? preview.costEssence : 0;
    var lvl = piece.level || 1;
    var sc = setColorHex(DATA, piece.set || piece.setName);

    var accent = scene.add.rectangle(cx, shell.top + 78, shell.pw - 60, 4, sc, 0.9);
    root.add(accent);

    var info = scene.add.text(cx, cy - ph / 2 + 100,
      (piece.setName || piece.set || 'Set') + '  ·  ' + (piece.mainStat || 'stat') +
      ' +' + (piece.value || piece.power || 0) +
      '\nLevel  +' + lvl + (preview && preview.maxed ? '  (MAX)' : '  →  +' + (lvl + 1)) +
      '\n\nEnhance success   ' + chancePct + '%' +
      '\nCost   ' + costG + ' Gold' + (costE ? '  +  ' + costE + ' Essence' : ''), {
        fontFamily: 'system-ui', fontSize: '15px', color: '#c8e0d0', align: 'center', lineSpacing: 5
      }).setOrigin(0.5);
    root.add(info);

    function mkBtn(by, label, color, onClick) {
      if (UI && UI.addButton) {
        // addButton attaches to scene; track for modal destroy via depth only
        var btn = UI.addButton(scene, cx, by, 260, 44, label, color, onClick, DEPTH + 2);
        if (btn && btn.root) root.add(btn.root);
        else if (btn) root.add(btn);
        return btn;
      }
      var b = scene.add.rectangle(cx, by, 240, 44, color, 1)
        .setStrokeStyle(2, 0xc9a44a, 0.75)
        .setInteractive({ useHandCursor: true });
      var t = scene.add.text(cx, by, label, {
        fontFamily: 'system-ui', fontSize: '15px', color: '#f0ffe8', fontStyle: 'bold'
      }).setOrigin(0.5);
      root.add([b, t]);
      b.on('pointerdown', onClick);
      return b;
    }

    var y0 = cy + 28;
    if (!(preview && preview.maxed)) {
      mkBtn(y0, '⬆  Enhance  (' + chancePct + '%)', 0x1a2820, function () {
        runEnhanceFlow(scene, {
          state: state,
          artifactId: piece.id,
          UI: UI,
          onDone: opts.onDone
        });
      });
      y0 += 54;
    }
    mkBtn(y0, '⇄  Replace', 0x1a1e24, function () {
      // Open picker; equip will overwrite slot (equipArtifact handles swap)
      openArtifactPicker(scene, {
        champ: champ,
        state: state,
        slot: slot,
        UI: UI,
        DATA: DATA,
        onEquipped: opts.onDone
      });
    });
    y0 += 54;
    mkBtn(y0, '✖  Unequip', 0x4a1810, function () {
      var res = global.SR_STATE.unequipArtifact(state, champ.id, slot.id);
      if (UI && UI.toast) UI.toast(scene, res.ok ? 'Unequipped' : res.error, res.ok);
      _destroyModal(scene);
      if (res.ok && typeof opts.onDone === 'function') opts.onDone();
    });
  }

  /**
   * Raid enhance bar:
   *  1) smooth fill to ~78%
   *  2) struggle zone (slow crawl + jitter) toward success/fail peak
   *  3) success → snap to 100% green; fail → red drop
   */
  function runEnhanceFlow(scene, opts) {
    opts = opts || {};
    if (scene._gearEnhanceBusy) return;
    var state = opts.state;
    var artifactId = opts.artifactId;
    var UI = opts.UI || global.SR_UI;

    if (!global.SR_STATE || !global.SR_STATE.enhanceArtifactPreview) {
      if (UI && UI.toast) UI.toast(scene, 'Enhance not available', false);
      return;
    }

    var preview = global.SR_STATE.enhanceArtifactPreview(state, artifactId);
    if (!preview || !preview.ok) {
      if (UI && UI.toast) UI.toast(scene, (preview && preview.error) || 'Cannot enhance', false);
      return;
    }
    if (!preview.canAfford) {
      if (UI && UI.toast) {
        UI.toast(scene, 'Need ' + preview.costGold + ' Gold' +
          (preview.costEssence ? ' + ' + preview.costEssence + ' Essence' : ''), false);
      }
      return;
    }

    // Resolve outcome first so the bar matches reality (Raid feel)
    var res = global.SR_STATE.enhanceArtifact(state, artifactId);
    if (!res.ok) {
      if (UI && UI.toast) UI.toast(scene, res.error || 'Enhance failed', false);
      return;
    }

    scene._gearEnhanceBusy = true;
    var shell = openModalShell(scene, 'Enhancing…', { ph: 320, pw: 520, onClose: false });
    var root = shell.root;
    var cx = shell.cx;
    var cy = shell.cy;
    var pw = shell.pw;

    var artName = (res.artifact && res.artifact.name) || 'Relic';
    var nameT = scene.add.text(cx, cy - 88, artName + '  +' + res.levelBefore, {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#ffe8a0', fontStyle: 'bold'
    }).setOrigin(0.5);
    var chanceT = scene.add.text(cx, cy - 58,
      'Success chance  ' + Math.round((res.chance || 0) * 100) + '%', {
        fontFamily: 'system-ui', fontSize: '15px', color: '#ffeeaa', fontStyle: 'bold'
      }).setOrigin(0.5);

    var barW = Math.min(400, pw - 80);
    var barH = 28;
    var track = scene.add.rectangle(cx, cy, barW, barH, 0x121c18, 1)
      .setStrokeStyle(2, 0xc9a44a, 0.95);
    // Soft glow under bar
    var glow = scene.add.rectangle(cx, cy, barW + 8, barH + 10, 0xc9a44a, 0.12);
    var fill = scene.add.rectangle(cx - barW / 2 + 3, cy, 4, barH - 8, 0x55cc77, 1)
      .setOrigin(0, 0.5);
    var pctT = scene.add.text(cx, cy, '0%', {
      fontFamily: 'system-ui', fontSize: '13px', color: '#041208', fontStyle: 'bold'
    }).setOrigin(0.5);
    var status = scene.add.text(cx, cy + 48, 'Channeling soft forge…', {
      fontFamily: 'system-ui', fontSize: '15px', color: '#c8e0d0'
    }).setOrigin(0.5);
    root.add([nameT, chanceT, glow, track, fill, pctT, status]);

    function setBar(p) {
      p = Math.max(0, Math.min(1, p));
      fill.width = Math.max(4, (barW - 6) * p);
      pctT.setText(Math.round(p * 100) + '%');
      // Keep label readable: dark over bright fill, light when low
      pctT.setColor(p > 0.35 ? '#041208' : '#e8ffd4');
    }

    // Raid: always climb to struggle zone (~78–82%), then fight toward end
    var struggleStart = 0.78 + Math.random() * 0.04;
    var failPeak = res.success
      ? 1
      : Math.max(struggleStart + 0.02, Math.min(0.96, res.failAt || (0.80 + Math.random() * 0.14)));
    var peak = res.success ? 1 : failPeak;

    // Phase 1 — smooth approach to struggle zone
    scene.tweens.add({
      targets: { p: 0 },
      p: struggleStart,
      duration: 900 + Math.random() * 200,
      ease: 'Sine.easeOut',
      onUpdate: function (tw, obj) { setBar(obj.p); },
      onComplete: function () {
        status.setText(res.success ? 'Holding… almost there!' : 'Resistance… straining…');
        fill.setFillStyle(0xd4b84a, 1); // gold struggle color

        // Phase 2 — struggle: slow crawl with jitter toward peak
        var crawlDur = res.success
          ? 700 + Math.random() * 500
          : 900 + Math.random() * 600;
        var twObj = { p: struggleStart };
        var struggleTw = scene.tweens.add({
          targets: twObj,
          p: peak,
          duration: crawlDur,
          ease: 'Sine.easeInOut',
          onUpdate: function () {
            var j = (Math.random() - 0.5) * 0.028;
            // Occasional “stall” feel
            if (Math.random() < 0.08) j -= 0.02;
            setBar(Math.max(0, Math.min(1, twObj.p + j)));
          },
          onComplete: function () {
            setBar(peak);
            if (res.success) {
              fill.setFillStyle(0x55ff99, 1);
              status.setText('SUCCESS  ·  +' + res.levelAfter);
              status.setColor('#aaffcc');
              nameT.setText(artName + '  +' + res.levelAfter);
              // Victory pulse
              scene.tweens.add({
                targets: fill,
                scaleY: 1.45,
                yoyo: true,
                duration: 100,
                repeat: 3
              });
              scene.tweens.add({
                targets: glow,
                alpha: 0.45,
                yoyo: true,
                duration: 140,
                repeat: 2
              });
              if (UI && UI.toast) UI.toast(scene, 'Enhanced to +' + res.levelAfter + '!', true);
            } else {
              fill.setFillStyle(0xcc4444, 1);
              status.setText('FAILED  ·  still +' + res.levelBefore);
              status.setColor('#ffaaaa');
              // Bar drops back after the almost-made-it moment
              scene.tweens.add({
                targets: { p: peak },
                p: Math.max(0.22, peak * 0.42),
                duration: 320,
                ease: 'Back.easeIn',
                onUpdate: function (tw, obj) { setBar(obj.p); }
              });
              if (UI && UI.toast) UI.toast(scene, 'Enhance failed — materials spent', false);
            }
            scene.time.delayedCall(1100, function () {
              scene._gearEnhanceBusy = false;
              _destroyModal(scene);
              if (typeof opts.onDone === 'function') opts.onDone(res);
            });
          }
        });
        // Store for safety if scene shuts down
        scene._gearStruggleTween = struggleTw;
      }
    });
  }

  /** Vault-only: pick artifact → enhance (no equip). */
  function openVaultEnhance(scene, opts) {
    opts = opts || {};
    var state = opts.state;
    var art = opts.artifact;
    var UI = opts.UI || global.SR_UI;
    if (!art) return;

    var preview = global.SR_STATE.enhanceArtifactPreview
      ? global.SR_STATE.enhanceArtifactPreview(state, art.id)
      : null;
    var shell = openModalShell(scene, art.name || 'Relic', { ph: 360, pw: 460 });
    var root = shell.root;
    var cx = shell.cx;
    var cy = shell.cy;

    var chancePct = preview && preview.ok ? Math.round(preview.chance * 100) : 0;
    var costG = preview && preview.ok ? preview.costGold : 0;
    var costE = preview && preview.ok ? preview.costEssence : 0;
    var lvl = art.level || 1;

    var info = scene.add.text(cx, cy - 70,
      (art.set || 'Set') + '  ·  power +' + (art.power || 0) +
      '\nLevel +' + lvl + (preview && preview.maxed ? '  (MAX)' : '  →  +' + (lvl + 1)) +
      (art.equippedTo ? '\nEquipped on champion' : '\nIn vault') +
      '\n\nSuccess  ' + chancePct + '%   ·   ' + costG + 'g' +
      (costE ? ' + ' + costE + ' essence' : ''), {
        fontFamily: 'system-ui', fontSize: '14px', color: '#c8e0d0', align: 'center', lineSpacing: 4
      }).setOrigin(0.5);
    root.add(info);

    if (preview && preview.maxed) {
      var maxT = scene.add.text(cx, cy + 50, 'Already +16 (max)', {
        fontFamily: 'system-ui', fontSize: '15px', color: '#ffcc88'
      }).setOrigin(0.5);
      root.add(maxT);
      return;
    }

    var b = scene.add.rectangle(cx, cy + 55, 220, 46, 0x1a5530, 1)
      .setStrokeStyle(2, 0xc9a44a, 0.8)
      .setInteractive({ useHandCursor: true });
    var t = scene.add.text(cx, cy + 55, '⬆  Enhance  (' + chancePct + '%)', {
      fontFamily: 'system-ui', fontSize: '15px', color: '#f0ffe8', fontStyle: 'bold'
    }).setOrigin(0.5);
    root.add([b, t]);
    b.on('pointerdown', function () {
      runEnhanceFlow(scene, {
        state: state,
        artifactId: art.id,
        UI: UI,
        onDone: opts.onDone
      });
    });
  }

  global.SR_GEAR_UI = {
    openModalShell: openModalShell,
    closeModal: _destroyModal,
    openArtifactPicker: openArtifactPicker,
    openEquippedMenu: openEquippedMenu,
    runEnhanceFlow: runEnhanceFlow,
    openVaultEnhance: openVaultEnhance,
    freeArtifacts: freeArtifacts
  };
})(typeof window !== 'undefined' ? window : global);
