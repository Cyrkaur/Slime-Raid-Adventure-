/* Shared Phaser UI chrome — painterly fantasy plates + gold/jade tokens */
(function (global) {
  'use strict';

  var ELEMENT_TINT = {
    Water: 0x4fc3f7, Fire: 0xff7043, Earth: 0xa1887f, Wind: 0x80deea,
    Plant: 0x66bb6a, Lightning: 0xffee58, Ice: 0xb3e5fc, Shadow: 0x7e57c2,
    Light: 0xfff59d, Metal: 0xb0bec5, Poison: 0xab47bc, Crystal: 0xce93d8,
    Lava: 0xff5722, Storm: 0x90caf9, Spirit: 0xe1bee7, Void: 0x5c6bc0
  };

  var RARITY_HEX = {
    Common: '#9ca3af', Uncommon: '#22c55e', Rare: '#3b82f6',
    Epic: '#a855f7', Legendary: '#f59e0b', Mythic: '#ef4444'
  };
  var RARITY_NUM = {
    Common: 0x9ca3af, Uncommon: 0x22c55e, Rare: 0x3b82f6,
    Epic: 0xa855f7, Legendary: 0xf59e0b, Mythic: 0xef4444
  };

  /** Raid-like palette tokens (fallback when painted UI art missing) */
  var THEME = {
    gold: 0xc9a44a,
    goldLite: 0xffe08a,
    goldDim: 0x8a7030,
    jade: 0x1a4430,
    jadeLite: 0x2a6644,
    jadeDeep: 0x0a1e14,
    panel: 0x0a1410,
    panelLite: 0x122018,
    panelEdge: 0x2a4034,
    ink: 0x02140c,
    danger: 0x6a2218,
    dangerLite: 0x8a3020,
    text: '#f0ffe8',
    textMuted: '#9ab8a8',
    textGold: '#ffe8a0',
    fontTitle: 'Cinzel, Georgia, "Times New Roman", serif',
    fontBody: 'Inter, system-ui, "Segoe UI", sans-serif'
  };

  /**
   * Painterly fantasy UI kit — matches ART_STYLE.md.
   * Transparent PNG buttons/chips (pop, no stretched bars). Panel JPG for frames.
   */
  var UI_TEX = {
    panel: 'ui_panel',
    button: 'ui_button',
    buttonDanger: 'ui_button_danger',
    title: 'ui_title_banner',
    pill: 'ui_currency_pill',
    chip: 'ui_mode_chip',
    tamerBadge: 'ui_tamer_badge'
  };

  function hasTex(scene, key) {
    return !!(scene && scene.textures && key && scene.textures.exists(key));
  }

  function texSourceSize(scene, key) {
    try {
      var tex = scene.textures.get(key);
      if (!tex) return null;
      var src = tex.getSourceImage ? tex.getSourceImage() : (tex.source && tex.source[0] && tex.source[0].image);
      if (src && (src.width || src.naturalWidth)) {
        return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height };
      }
      if (tex.source && tex.source[0]) {
        return { w: tex.source[0].width, h: tex.source[0].height };
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /**
   * Painted UI element.
   * mode:
   *   'nineslice' — frame panels only (square ornate borders)
   *   'fit' (default for buttons) — preserve aspect inside maxW×maxH (no stretch)
   *   'fillH' — match height, width from aspect (clamped to maxW)
   *   'stretch' — last resort full box stretch
   */
  function addUiPlate(scene, key, x, y, w, h, depth, opts) {
    opts = opts || {};
    if (!hasTex(scene, key)) return null;
    depth = depth != null ? depth : 20;
    var alpha = opts.alpha != null ? opts.alpha : 1;
    var mode = opts.mode || 'fit';
    var plate = null;
    var dw = w;
    var dh = h;
    var src = texSourceSize(scene, key);
    var ar = src && src.h ? (src.w / src.h) : (w / Math.max(1, h));

    if (mode === 'nineslice') {
      var left = opts.left != null ? opts.left : 96;
      var right = opts.right != null ? opts.right : 96;
      var top = opts.top != null ? opts.top : 96;
      var bottom = opts.bottom != null ? opts.bottom : 96;
      try {
        if (typeof scene.add.nineslice === 'function') {
          var maxL = Math.max(8, Math.floor(w / 2) - 4);
          var maxT = Math.max(8, Math.floor(h / 2) - 4);
          left = Math.min(left, maxL);
          right = Math.min(right, maxL);
          top = Math.min(top, maxT);
          bottom = Math.min(bottom, maxT);
          plate = scene.add.nineslice(x, y, key, undefined, w, h, left, right, top, bottom);
        }
      } catch (eNs) {
        plate = null;
      }
    }

    if (!plate) {
      if (mode === 'fillH' || mode === 'fit') {
        // Height drives scale; width from art aspect — never squash into a bar
        dh = h;
        dw = Math.round(dh * ar);
        if (mode === 'fit' && dw > w) {
          dw = w;
          dh = Math.round(dw / ar);
        }
        if (mode === 'fillH' && dw > w * 1.35) {
          // Allow slightly wider than request for wide CTAs, else clamp
          dw = Math.round(w * 1.15);
          dh = Math.round(dw / ar);
          if (dh > h) {
            dh = h;
            dw = Math.round(dh * ar);
          }
        }
        // Ensure enough width for labels when caller asked for a minimum
        if (opts.minW && dw < opts.minW) {
          dw = Math.min(opts.minW, Math.round(h * ar * 1.4));
          // Prefer nineslice widen for capsules: scale height to h, stretch width gently
          dh = h;
        }
      } else if (mode === 'stretch') {
        dw = w;
        dh = h;
      }
      plate = scene.add.image(x, y, key);
      if (plate.setDisplaySize) plate.setDisplaySize(dw, dh);
    }
    plate.setDepth(depth);
    if (plate.setAlpha) plate.setAlpha(alpha);
    if (opts.tint != null && plate.setTint) plate.setTint(opts.tint);
    plate._srUiPlate = true;
    plate._srUiKey = key;
    plate._srUiW = dw;
    plate._srUiH = dh;
    return plate;
  }

  function rarityHex(rarity) {
    if (rarity === 'Mythic') return RARITY_HEX.Mythic;
    if (global.SR_DATA && typeof global.SR_DATA.getRarityColor === 'function') {
      return global.SR_DATA.getRarityColor(rarity) || RARITY_HEX.Common;
    }
    return RARITY_HEX[rarity] || RARITY_HEX.Common;
  }

  function rarityColor(rarity) {
    if (rarity === 'Mythic') return RARITY_NUM.Mythic;
    return RARITY_NUM[rarity] || RARITY_NUM.Common;
  }

  function textResolution() {
    if (global.SR_GAME_SIZE && global.SR_GAME_SIZE.dpr) return global.SR_GAME_SIZE.dpr;
    return Math.min(Math.max((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1), 2);
  }

  function addText(scene, x, y, content, style) {
    style = style || {};
    if (!style.fontFamily) style.fontFamily = THEME.fontBody;
    var t = scene.add.text(x, y, content, style);
    if (typeof t.setResolution === 'function') t.setResolution(textResolution());
    t.setPosition(Math.round(x), Math.round(y));
    return t;
  }

  function installCrispText(scene) {
    if (!scene || !scene.add || scene.add._srCrispText) return;
    var original = scene.add.text.bind(scene.add);
    scene.add.text = function (x, y, content, style) {
      style = style || {};
      if (!style.fontFamily) style.fontFamily = THEME.fontBody;
      var t = original(x, y, content, style);
      if (t && typeof t.setResolution === 'function') t.setResolution(textResolution());
      if (t && t.x != null) {
        t.x = Math.round(t.x);
        t.y = Math.round(t.y);
      }
      return t;
    };
    scene.add._srCrispText = true;
  }

  /**
   * Soft hover pulse — tiny scale only; kill prior tweens so it always retracts.
   * opts.paintFill:false — scale only (use for invisible hit rects; never paint green).
   * opts.scaleTarget — container so art+label scale together.
   * opts.tintTarget — painted plate to tint (not the hit box).
   */
  function wireHover(bg, opts) {
    opts = opts || {};
    if (!bg || typeof bg.on !== 'function') return;
    var fill = opts.fill != null ? opts.fill : 0x1a4430;
    var fillH = opts.fillHover != null ? opts.fillHover : 0x2a6644;
    var stroke = opts.stroke != null ? opts.stroke : THEME.gold;
    var strokeH = opts.strokeHover != null ? opts.strokeHover : THEME.goldLite;
    var alpha = opts.alpha != null ? opts.alpha : 0.94;
    var hoverScale = opts.hoverScale != null ? opts.hoverScale : 1.03;
    var idleScale = opts.idleScale != null ? opts.idleScale : 1;
    var scaleTarget = opts.scaleTarget || bg;
    var tintTarget = opts.tintTarget || null;
    var paintFill = opts.paintFill !== false;
    var isPainted = !!(bg._srUiPlate || (bg.texture && !bg.setFillStyle));
    function tweenScale(s) {
      if (sceneTweens(scaleTarget)) {
        scaleTarget.scene.tweens.killTweensOf(scaleTarget);
        scaleTarget.scene.tweens.add({
          targets: scaleTarget,
          scaleX: s,
          scaleY: s,
          duration: 110,
          ease: 'Sine.easeOut'
        });
      } else if (scaleTarget.setScale) {
        scaleTarget.setScale(s);
      }
    }
    bg.on('pointerover', function () {
      if (tintTarget && tintTarget.setTint) {
        tintTarget.setTint(opts.tintHover != null ? opts.tintHover : 0xffffee);
      } else if (isPainted) {
        if (bg.setTint) bg.setTint(opts.tintHover != null ? opts.tintHover : 0xffffee);
        if (bg.setAlpha) bg.setAlpha(1);
      } else if (paintFill) {
        if (bg.setFillStyle) bg.setFillStyle(fillH, 1);
        if (bg.setStrokeStyle) bg.setStrokeStyle(opts.strokeWidth || 2, strokeH);
      }
      tweenScale(hoverScale);
    });
    bg.on('pointerout', function () {
      if (tintTarget) {
        if (tintTarget.clearTint) tintTarget.clearTint();
        else if (tintTarget.setTint) tintTarget.setTint(0xffffff);
      } else if (isPainted) {
        if (bg.clearTint) bg.clearTint();
        else if (bg.setTint) bg.setTint(0xffffff);
        if (bg.setAlpha) bg.setAlpha(alpha);
      } else if (paintFill) {
        if (bg.setFillStyle) bg.setFillStyle(fill, alpha);
        if (bg.setStrokeStyle) bg.setStrokeStyle(opts.strokeWidth || 2, stroke);
      }
      tweenScale(idleScale);
    });
  }

  function sceneTweens(obj) {
    return obj && obj.scene && obj.scene.tweens;
  }

  /**
   * Multi-layer panel — painterly frame when ui_panel loaded, else gold/rect fallback.
   * Returns container with _body (interactive target when needed).
   */
  function addPanel(scene, x, y, w, h, opts) {
    opts = opts || {};
    var depth = opts.depth != null ? opts.depth : 20;
    var fill = opts.fill != null ? opts.fill : THEME.panel;
    var alpha = opts.alpha != null ? opts.alpha : 0.88;
    var gold = opts.gold != null ? opts.gold : THEME.gold;
    var container = scene.add.container(x, y).setDepth(depth);

    var plate = addUiPlate(scene, UI_TEX.panel, 0, 0, w + 10, h + 10, 0, {
      alpha: Math.min(1, alpha + 0.08),
      mode: 'nineslice',
      left: 96, right: 96, top: 96, bottom: 96
    });
    if (plate) {
      // Soft ink underlay for contrast over bright mode art
      var under = scene.add.rectangle(0, 0, Math.max(8, w - 24), Math.max(8, h - 24), fill, alpha * 0.55);
      container.add([under, plate]);
      container._body = plate;
      container._outer = plate;
      container._painted = true;
      return container;
    }

    var outer = scene.add.rectangle(0, 0, w + 6, h + 6, gold, 0.35);
    var mid = scene.add.rectangle(0, 0, w + 2, h + 2, THEME.ink, 0.95)
      .setStrokeStyle(2, gold, 0.95);
    var body = scene.add.rectangle(0, 0, w, h, fill, alpha)
      .setStrokeStyle(1, THEME.panelEdge, 0.9);
    var sheen = scene.add.rectangle(0, -h / 2 + 3, w - 8, 4, THEME.goldLite, 0.18);
    container.add([outer, mid, body, sheen]);
    container._body = body;
    container._outer = outer;
    return container;
  }

  /** Thin gold underline accent under titles */
  function addGoldRule(scene, x, y, w, depth) {
    depth = depth == null ? 50 : depth;
    var g = scene.add.graphics().setDepth(depth);
    g.fillStyle(THEME.goldDim, 0.9);
    g.fillRect(x - w / 2, y, w, 2);
    g.fillStyle(THEME.goldLite, 0.55);
    g.fillRect(x - w * 0.2, y, w * 0.4, 2);
    return g;
  }

  /**
   * Full-brightness mode background (no dark wash / vignette).
   * Mode art is shown at full opacity and vibrancy; UI chrome sits on top.
   * Optional 4th arg `alpha` is legacy (dark-wash strength) and is ignored.
   */
  function paintModeBg(scene, artKey, tint, alpha) {
    var w = scene.cameras.main.width;
    var h = scene.cameras.main.height;
    scene.cameras.main.setBackgroundColor(tint || '#0a1a14');

    if (artKey && scene.textures.exists(artKey)) {
      scene.add.image(w / 2, h / 2, artKey).setDisplaySize(w, h).setAlpha(1).setDepth(0);
    } else if (scene.textures.exists('hub_bg')) {
      scene.add.image(w / 2, h / 2, 'hub_bg').setDisplaySize(w, h).setAlpha(1).setDepth(0);
    }
    // Intentionally no full-screen dim overlay or cinematic vignette —
    // panels / titles provide their own contrast over the bright art.
    void alpha;
  }

  /**
   * Return / back control — same danger capsule as Village.
   * Usage:
   *   addBackButton(scene)                         → ← Village → HubScene
   *   addBackButton(scene, 70, 40, { label, scene, onClick, data })
   *   addBackButton(scene, { label: '← Chapters', onClick: fn })
   */
  function addBackButton(scene, x, y, opts) {
    installCrispText(scene);
    if (x && typeof x === 'object' && y == null) {
      opts = x;
      x = opts.x;
      y = opts.y;
    }
    opts = opts || {};
    x = x == null ? 70 : x;
    y = y == null ? 40 : y;
    var label = opts.label != null ? opts.label : '←  Village';
    var targetScene = opts.scene || opts.targetScene || 'HubScene';
    var sceneData = opts.data;
    var onClick = opts.onClick;
    if (!onClick) {
      onClick = function () {
        if (global.SR_TRANSIT && global.SR_TRANSIT.go) {
          global.SR_TRANSIT.go(scene, targetScene, sceneData);
        } else if (sceneData != null) {
          scene.scene.start(targetScene, sceneData);
        } else {
          scene.scene.start(targetScene);
        }
      };
    }
    var h = opts.h || 44;
    var w = opts.w || Math.max(128, 52 + String(label).length * 7.5);
    var depth = opts.depth != null ? opts.depth : 120;

    var root = scene.add.container(x, y).setDepth(depth);
    var bg = addUiPlate(scene, UI_TEX.buttonDanger, 0, 0, w, h, 0, {
      alpha: 1, mode: 'fillH', minW: w
    });
    if (bg) {
      if (typeof bg.setDepth === 'function') bg.setDepth(0);
      root.add(bg);
    } else {
      bg = scene.add.rectangle(0, 0, w, h, THEME.danger, 0.92)
        .setStrokeStyle(2, THEME.gold);
      root.add(bg);
    }
    var fontPx = Math.min(15, Math.max(12, Math.floor(h * 0.34)));
    var txt = addText(scene, 0, 1, label, {
      fontFamily: THEME.fontBody, fontSize: fontPx + 'px', color: '#ffe8c8', fontStyle: 'bold',
      stroke: '#200808', strokeThickness: 3
    }).setOrigin(0.5);
    if (typeof txt.setDepth === 'function') txt.setDepth(1);
    root.add(txt);

    var plateW = (bg && bg._srUiW) ? bg._srUiW : w;
    var hit = scene.add.rectangle(0, 0, Math.max(w, plateW) + 8, h + 8, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    root.add(hit);

    // Scale only on hit — never paint the hit rect (that was the green box bug)
    wireHover(hit, {
      paintFill: false,
      hoverScale: 1.03,
      idleScale: 1,
      scaleTarget: root,
      tintTarget: bg._srUiPlate ? bg : null,
      tintHover: 0xffd0c0
    });
    hit.on('pointerdown', onClick);
    return { bg: bg, text: txt, root: root, hit: hit };
  }

  /**
   * Mode page title — same language as village "RAID OF THE GEL" center text:
   * stroked serif title + gold subtitle, no banner/plate art box behind it.
   */
  function addTitle(scene, title, subtitle) {
    installCrispText(scene);
    var w = scene.cameras.main.width;

    var t = addText(scene, w / 2, subtitle ? 30 : 40, title, {
      fontFamily: THEME.fontTitle,
      fontSize: '26px',
      color: THEME.text,
      stroke: '#0a2a1a',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(50);

    var sub = null;
    if (subtitle) {
      sub = addText(scene, w / 2, 54, subtitle, {
        fontFamily: THEME.fontBody,
        fontSize: '13px',
        color: THEME.textGold,
        fontStyle: 'bold',
        stroke: '#0a2a1a',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(50);
    }
    return { plate: null, title: t, subtitle: sub };
  }

  /**
   * Currency pills — right-aligned at the same Y as back buttons (default y=40)
   * so they never collide with ← Village on the left.
   *
   * addCurrencyStrip(scene, state)
   * addCurrencyStrip(scene, state, 40)
   * addCurrencyStrip(scene, state, { y: 40, margin: 24 })
   */
  function addCurrencyStrip(scene, state, yOrOpts) {
    installCrispText(scene);
    var opts = {};
    var y = 40;
    if (yOrOpts && typeof yOrOpts === 'object') {
      opts = yOrOpts;
      y = opts.y != null ? opts.y : 40;
    } else if (yOrOpts != null) {
      y = yOrOpts;
    }
    var margin = opts.margin != null ? opts.margin : 24;
    var depth = opts.depth != null ? opts.depth : 100;
    var camW = scene.cameras.main.width;
    var r = (state && state.resources) || {};
    var items = [
      { icon: '🪙', val: Math.floor(r.gold || 0), color: '#ffe08a' },
      { icon: '💎', val: Math.floor(r.slimeShards || 0), color: '#a8e0ff' },
      { icon: '✨', val: Math.floor(r.divineShards || 0), color: '#ffe8a0' },
      { icon: '🖤', val: Math.floor(r.voidShards || 0), color: '#d0b0ff' }
    ];
    var pillH = 48;
    var gap = 10;
    // Build sizes first so we can right-align as a group
    var sizes = [];
    var totalW = 0;
    items.forEach(function (it, idx) {
      var needW = Math.max(112, 44 + String(it.val).length * 14 + 40);
      var usedW = needW;
      var usedH = pillH;
      var body = addUiPlate(scene, UI_TEX.pill, 0, 0, needW, pillH, 0, {
        alpha: 1, mode: 'fillH', minW: needW
      });
      if (body && body._srUiW) {
        usedW = Math.round(body._srUiW * 1.08);
        usedH = Math.round((body._srUiH || pillH) * 1.08);
        if (body.setDisplaySize) body.setDisplaySize(usedW, usedH);
        body._srUiW = usedW;
        body._srUiH = usedH;
      }
      sizes.push({ it: it, body: body, needW: needW, usedW: usedW, usedH: usedH });
      totalW += usedW + (idx > 0 ? gap : 0);
    });
    var x = camW - margin - totalW;
    var group = [];
    sizes.forEach(function (s) {
      var label = s.it.icon + '  ' + s.it.val;
      var cx = x + s.usedW / 2;
      var root = scene.add.container(cx, y).setDepth(depth);
      var body = s.body;
      if (body) {
        body.setPosition(0, 0);
        if (typeof body.setDepth === 'function') body.setDepth(0);
        root.add(body);
      } else {
        body = scene.add.rectangle(0, 0, s.needW, pillH, THEME.panel, 0.92)
          .setStrokeStyle(2, THEME.gold, 0.9);
        root.add(body);
      }
      var fontPx = Math.max(13, Math.min(17, Math.round(s.usedH * 0.34)));
      var txt = addText(scene, 0, Math.round(s.usedH * 0.06), label, {
        fontFamily: THEME.fontBody,
        fontSize: fontPx + 'px',
        color: s.it.color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5);
      if (typeof txt.setDepth === 'function') txt.setDepth(1);
      root.add(txt);
      group.push(root, body, txt);
      x += s.usedW + gap;
    });
    return group;
  }

  /**
   * CTA button (GFX / Restart / CTAs) — art+label container; tiny hover expand then retract.
   */
  function addButton(scene, x, y, w, h, label, color, onClick, depth) {
    installCrispText(scene);
    depth = depth == null ? 40 : depth;
    var fill = color != null ? color : THEME.jade;
    var stroke = THEME.gold;
    var isDanger = (fill === 0x4a1810 || fill === THEME.danger || fill === 0x6a2218 || fill === 0x443322);
    if (isDanger) stroke = 0xff8866;
    if (fill === 0x2a1848 || fill === 0x3a2040) stroke = 0xb39ddb;

    var texKey = isDanger ? UI_TEX.buttonDanger : UI_TEX.button;
    var root = scene.add.container(x, y).setDepth(depth);
    var shadow = scene.add.ellipse(0, h * 0.28, w * 0.92, h * 0.45, 0x000000, 0.28);
    root.add(shadow);

    var bg = addUiPlate(scene, texKey, 0, 0, w, h + 4, 0, {
      alpha: 1, mode: 'fillH', minW: w
    });
    var glow = null;
    var painted = !!bg;
    if (bg) {
      if (typeof bg.setDepth === 'function') bg.setDepth(0);
      root.add(bg);
    } else {
      glow = scene.add.rectangle(0, 0, w + 4, h + 4, stroke, 0.18);
      root.add(glow);
      bg = scene.add.rectangle(0, 0, w, h, fill, 0.96)
        .setStrokeStyle(2, stroke);
      root.add(bg);
    }

    var plateW = (bg && bg._srUiW) ? bg._srUiW : w;
    var txt = addText(scene, 0, 1, label, {
      fontFamily: THEME.fontBody,
      fontSize: Math.min(16, Math.max(13, Math.floor(h * 0.34))) + 'px',
      color: THEME.text, fontStyle: 'bold', align: 'center',
      wordWrap: { width: Math.max(48, plateW - 20) },
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);
    if (typeof txt.setDepth === 'function') txt.setDepth(2);
    root.add(txt);

    var hit = scene.add.rectangle(0, 0, Math.max(w, plateW) + 8, h + 8, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    root.add(hit);

    var fillHover = fill;
    try {
      if (typeof Phaser !== 'undefined' && Phaser.Display && Phaser.Display.Color) {
        fillHover = Phaser.Display.Color.IntegerToColor(fill).brighten(22).color;
      }
    } catch (e) { fillHover = fill; }

    // Scale + tint plate only — never fill the hit rect (green rectangle bug)
    wireHover(hit, {
      paintFill: false,
      hoverScale: 1.03,
      idleScale: 1,
      scaleTarget: root,
      tintTarget: painted ? bg : null,
      tintHover: isDanger ? 0xffe0d0 : 0xffffee
    });
    if (!painted) {
      hit.on('pointerover', function () {
        if (bg.setFillStyle) bg.setFillStyle(fillHover, 1);
        if (bg.setStrokeStyle) bg.setStrokeStyle(2, THEME.goldLite);
      });
      hit.on('pointerout', function () {
        if (bg.setFillStyle) bg.setFillStyle(fill, 0.96);
        if (bg.setStrokeStyle) bg.setStrokeStyle(2, stroke);
      });
    }
    if (onClick) hit.on('pointerdown', onClick);
    return { bg: bg, text: txt, glow: glow, shadow: shadow, root: root, hit: hit };
  }

  /**
   * Compact ⚙ settings gear + popup (GFX quality + Restart).
   * addSettingsMenu(scene, x, y, { depth, onRestart })
   */
  function addSettingsMenu(scene, x, y, opts) {
    installCrispText(scene);
    opts = opts || {};
    var depth = opts.depth != null ? opts.depth : 120;
    var qOrder = ['low', 'med', 'high'];
    var qCur = 'high';
    try {
      var stored = (typeof localStorage !== 'undefined' && localStorage.getItem('sr_battle_quality')) || '';
      if (qOrder.indexOf(String(stored).toLowerCase()) >= 0) qCur = String(stored).toLowerCase();
    } catch (eQ) { /* ignore */ }

    var open = false;
    var gearSize = opts.gearSize || 44;
    var panelW = 200;
    var rowH = 40;
    var panelH = 16 + rowH * 4 + 12;

    var gearRoot = scene.add.container(x, y).setDepth(depth);
    var gearBg = addUiPlate(scene, UI_TEX.button, 0, 0, gearSize + 8, gearSize + 4, 0, {
      alpha: 1, mode: 'fillH', minW: gearSize + 8
    });
    if (gearBg) {
      if (typeof gearBg.setDepth === 'function') gearBg.setDepth(0);
      gearRoot.add(gearBg);
    } else {
      gearBg = scene.add.circle(0, 0, gearSize * 0.48, THEME.panel, 0.94)
        .setStrokeStyle(2, THEME.gold, 0.9);
      gearRoot.add(gearBg);
    }
    var gearIcon = addText(scene, 0, 1, '⚙', {
      fontFamily: THEME.fontBody,
      fontSize: '22px',
      color: THEME.textGold,
      stroke: '#041208',
      strokeThickness: 3
    }).setOrigin(0.5);
    gearRoot.add(gearIcon);
    var gearHit = scene.add.circle(0, 0, gearSize * 0.55, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    gearRoot.add(gearHit);
    wireHover(gearHit, {
      paintFill: false,
      hoverScale: 1.06,
      idleScale: 1,
      scaleTarget: gearRoot,
      tintTarget: gearBg && gearBg._srUiPlate ? gearBg : null,
      tintHover: 0xffffee
    });

    // Popup panel (hidden until open) — anchored below-right of gear
    var panelRoot = scene.add.container(x, y + gearSize * 0.5 + 10 + panelH / 2)
      .setDepth(depth + 2)
      .setVisible(false)
      .setAlpha(0);

    var panelBg = scene.add.rectangle(0, 0, panelW, panelH, 0x0a1612, 0.96)
      .setStrokeStyle(2, THEME.gold, 0.9);
    panelRoot.add(panelBg);
    // Soft top gold line
    var goldLine = scene.add.rectangle(0, -panelH / 2 + 3, panelW - 16, 2, THEME.gold, 0.35);
    panelRoot.add(goldLine);

    function makeRow(ry, label, fill, onClick) {
      var row = scene.add.container(0, ry);
      var rb = scene.add.rectangle(0, 0, panelW - 16, rowH - 4, fill, 0.92)
        .setStrokeStyle(1, THEME.goldDim, 0.55)
        .setInteractive({ useHandCursor: true });
      var rt = addText(scene, 0, 0, label, {
        fontFamily: THEME.fontBody,
        fontSize: '14px',
        color: THEME.text,
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 2
      }).setOrigin(0.5);
      row.add([rb, rt]);
      rb.on('pointerover', function () {
        if (rb.setFillStyle) {
          try {
            rb.setFillStyle(
              (typeof Phaser !== 'undefined' && Phaser.Display)
                ? Phaser.Display.Color.IntegerToColor(fill).brighten(18).color
                : fill,
              1
            );
          } catch (e) { /* ignore */ }
        }
        row.setScale(1.03);
      });
      rb.on('pointerout', function () {
        if (rb.setFillStyle) rb.setFillStyle(fill, 0.92);
        row.setScale(1);
      });
      rb.on('pointerdown', function (pointer, lx, ly, event) {
        if (event && event.stopPropagation) event.stopPropagation();
        if (onClick) onClick();
      });
      panelRoot.add(row);
      return { row: row, bg: rb, text: rt };
    }

    // Four rows: GFX, Sound, Fullscreen, Restart (y centered around 0)
    var y0 = -rowH * 1.5 + 4;
    var gfxRow = makeRow(y0, 'GFX · ' + qCur.toUpperCase(), 0x1a1820, function () {
      var i = qOrder.indexOf(qCur);
      qCur = qOrder[(i + 1) % qOrder.length];
      try { localStorage.setItem('sr_battle_quality', qCur); } catch (e2) { /* ignore */ }
      if (gfxRow.text) gfxRow.text.setText('GFX · ' + qCur.toUpperCase());
      if (global.SR_AUDIO && global.SR_AUDIO.play) global.SR_AUDIO.play('ui_click');
      if (global.SR_UI && global.SR_UI.toast) {
        global.SR_UI.toast(scene, 'Battle quality: ' + qCur.toUpperCase(), true);
      }
    });

    var sndLabel = (global.SR_AUDIO && global.SR_AUDIO.getLabel)
      ? global.SR_AUDIO.getLabel()
      : 'Sound · 70%';
    var sndRow = makeRow(y0 + rowH, sndLabel, 0x1a2018, function () {
      if (global.SR_AUDIO && global.SR_AUDIO.cycleVolume) {
        var lab = global.SR_AUDIO.cycleVolume();
        if (sndRow.text) sndRow.text.setText(lab);
        if (global.SR_AUDIO.unlock) global.SR_AUDIO.unlock();
        if (global.SR_AUDIO.play) global.SR_AUDIO.play('ui_click');
        if (global.SR_UI && global.SR_UI.toast) {
          global.SR_UI.toast(scene, lab, true);
        }
      } else if (global.SR_UI && global.SR_UI.toast) {
        global.SR_UI.toast(scene, 'Audio bus not loaded', false);
      }
    });

    makeRow(y0 + rowH * 2, '⛶  Fullscreen', 0x141a20, function () {
      if (global.SR_AUDIO && global.SR_AUDIO.play) global.SR_AUDIO.play('ui_click');
      if (typeof global.SR_toggleFullscreen === 'function') {
        global.SR_toggleFullscreen();
      } else if (scene.scale) {
        try {
          if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
          else scene.scale.startFullscreen();
        } catch (eFs) { /* ignore */ }
      }
      if (global.SR_UI && global.SR_UI.toast) {
        global.SR_UI.toast(scene, 'Toggled fullscreen (Esc to exit)', true);
      }
    });

    makeRow(y0 + rowH * 3, '↺  Restart', 0x4a1810, function () {
      if (global.SR_AUDIO && global.SR_AUDIO.play) global.SR_AUDIO.play('ui_click');
      close();
      if (opts.onRestart) {
        opts.onRestart();
      } else if (global.SR_STATE && global.SR_STATE.resetGame) {
        var fresh = global.SR_STATE.resetGame();
        global.SR_GAME_STATE = fresh;
        scene.scene.start('IntroScene', { force: true });
      }
    });

    // Full-screen dim hit to close when clicking outside
    var blocker = scene.add.rectangle(
      scene.cameras.main.width / 2,
      scene.cameras.main.height / 2,
      scene.cameras.main.width,
      scene.cameras.main.height,
      0x000000,
      0.001
    ).setDepth(depth + 1).setInteractive().setVisible(false);

    function openMenu() {
      open = true;
      panelRoot.setVisible(true);
      blocker.setVisible(true);
      if (scene.tweens) {
        scene.tweens.killTweensOf(panelRoot);
        panelRoot.setAlpha(0).setScale(0.92);
        scene.tweens.add({
          targets: panelRoot,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 120,
          ease: 'Sine.easeOut'
        });
      } else {
        panelRoot.setAlpha(1).setScale(1);
      }
    }

    function close() {
      open = false;
      blocker.setVisible(false);
      if (scene.tweens) {
        scene.tweens.killTweensOf(panelRoot);
        scene.tweens.add({
          targets: panelRoot,
          alpha: 0,
          scaleX: 0.94,
          scaleY: 0.94,
          duration: 90,
          ease: 'Sine.easeIn',
          onComplete: function () {
            if (!open) panelRoot.setVisible(false);
          }
        });
      } else {
        panelRoot.setVisible(false).setAlpha(0);
      }
    }

    function toggle() {
      if (open) close();
      else openMenu();
    }

    gearHit.on('pointerdown', function (pointer, lx, ly, event) {
      if (event && event.stopPropagation) event.stopPropagation();
      toggle();
    });
    blocker.on('pointerdown', function () {
      close();
    });

    return {
      gear: gearRoot,
      panel: panelRoot,
      open: openMenu,
      close: close,
      toggle: toggle,
      isOpen: function () { return open; }
    };
  }

  /**
   * Hub tamer badge — vertical painted card with stats centered in the face.
   * opts: { depth, w, h }
   */
  function addTamerBadge(scene, x, y, state, opts) {
    installCrispText(scene);
    opts = opts || {};
    var depth = opts.depth != null ? opts.depth : 14;
    var cardW = opts.w || 220;
    var cardH = opts.h || 300;
    var root = scene.add.container(x, y).setDepth(depth);

    var plate = addUiPlate(scene, UI_TEX.tamerBadge, 0, 0, cardW, cardH, 0, {
      alpha: 1, mode: 'fit'
    });
    var pw = cardW;
    var ph = cardH;
    if (plate) {
      pw = plate._srUiW || cardW;
      ph = plate._srUiH || cardH;
      if (typeof plate.setDepth === 'function') plate.setDepth(0);
      root.add(plate);
    } else {
      // Clean fallback (no stretched square frame)
      var body = scene.add.rectangle(0, 0, cardW, cardH, THEME.panel, 0.92)
        .setStrokeStyle(3, THEME.gold, 0.95);
      var inset = scene.add.rectangle(0, 8, cardW * 0.72, cardH * 0.52, THEME.panelLite, 0.35)
        .setStrokeStyle(1, THEME.goldDim, 0.5);
      root.add([body, inset]);
      pw = cardW;
      ph = cardH;
    }

    var tamerLv = (state && state.player && state.player.level) || 1;
    var playerName = (global.SR_STATE && global.SR_STATE.playerDisplayName)
      ? global.SR_STATE.playerDisplayName(state)
      : ((state && state.player && state.player.name) || 'Keeper');
    playerName = String(playerName || 'Keeper').trim() || 'Keeper';
    var pp = (global.SR_STATE && global.SR_STATE.partyPower)
      ? global.SR_STATE.partyPower(state)
      : 0;
    var wins = (state && state.stats && state.stats.wins) || 0;
    var losses = (state && state.stats && state.stats.losses) || 0;
    var summons = (state && state.stats && state.stats.summons) || 0;

    // Layout inside badge face (upper header = player name, not generic "TAMER")
    var nameLen = playerName.length;
    var namePx = nameLen > 14 ? '12px' : (nameLen > 10 ? '13px' : '15px');
    var title = addText(scene, 0, -ph * 0.32, playerName, {
      fontFamily: THEME.fontTitle,
      fontSize: namePx,
      color: THEME.textGold,
      fontStyle: 'bold',
      stroke: '#041208',
      strokeThickness: 3
    }).setOrigin(0.5);
    var level = addText(scene, 0, -ph * 0.18, 'Level ' + tamerLv, {
      fontFamily: THEME.fontBody,
      fontSize: '26px',
      color: THEME.text,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    var stats = addText(scene, 0, ph * 0.06,
      'Party Power\n' + pp +
      '\n\nRecord\nW ' + wins + '  ·  L ' + losses +
      '\n\nSummons  ' + summons,
      {
        fontFamily: THEME.fontBody,
        fontSize: '14px',
        color: '#c8e8d4',
        align: 'center',
        lineSpacing: 2,
        stroke: '#000000',
        strokeThickness: 2
      }
    ).setOrigin(0.5, 0);
    // Nudge stats into the recessed window of the badge art
    stats.y = -ph * 0.02;
    root.add([title, level, stats]);
    return { root: root, plate: plate, title: title, level: level, stats: stats };
  }

  /** Map common scene keys → back-button labels */
  function backLabelForScene(sceneKey) {
    var map = {
      HubScene: '←  Village',
      RosterScene: '←  Champions',
      CampaignScene: '←  Campaign',
      DungeonScene: '←  Dungeons',
      SummonScene: '←  Summon',
      VaultScene: '←  Vault',
      GreatHallScene: '←  Great Hall',
      AlchemyScene: '←  Alchemy',
      WorkshopScene: '←  Workshop',
      MarketScene: '←  Market',
      EternityScene: '←  Eternity',
      ChronicleScene: '←  Chronicle'
    };
    return map[sceneKey] || '←  Back';
  }

  function toast(scene, msg, ok) {
    installCrispText(scene);
    if (global.SR_AUDIO && global.SR_AUDIO.play) {
      global.SR_AUDIO.play(ok === false ? 'ui_toast_bad' : 'ui_toast_ok');
    }
    var w = scene.cameras.main.width;
    var h = scene.cameras.main.height;
    var panel = addPanel(scene, w / 2, h - 56, Math.min(520, w - 80), 48, {
      depth: 400, fill: ok === false ? 0x2a1010 : THEME.panel, alpha: 0.95
    });
    var t = addText(scene, w / 2, h - 56, msg, {
      fontFamily: THEME.fontBody, fontSize: '15px',
      color: ok === false ? '#ff9999' : '#aaffcc',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(401);
    scene.time.delayedCall(2400, function () {
      try { panel.destroy(); t.destroy(); } catch (e) { /* ignore */ }
    });
    return t;
  }

  /** Element + rarity size — mirrors battleWorld3d GEL_PROFILES (UI portraits) */
  var GEL_UI_SIZE = {
    water: 0.95, fire: 1.02, earth: 1.22, wind: 0.72, plant: 1.08,
    lightning: 0.78, ice: 1.0, shadow: 0.92, light: 0.98, metal: 1.15,
    poison: 0.88, crystal: 1.04, lava: 1.28, storm: 1.1, spirit: 0.74, void: 1.12
  };
  var RARITY_UI_SIZE = {
    Common: 0.92, Uncommon: 0.97, Rare: 1.04, Epic: 1.1, Legendary: 1.2, Mythic: 1.3
  };

  function gelPortraitScale(element, rarity) {
    var el = GEL_UI_SIZE[String(element || 'water').toLowerCase()] || 1;
    var r = RARITY_UI_SIZE[rarity || 'Common'] || 1;
    return el * r;
  }

  function resolveSlimeKey(scene, element, mode, artVariant, artForm, opts) {
    opts = opts || {};
    var low = String(element || 'Water').toLowerCase();
    mode = mode || 'badge';
    var v = 'a';
    if (global.SR_ART && global.SR_ART.variantKey) v = global.SR_ART.variantKey(artVariant);
    else if (artVariant) v = String(artVariant).toLowerCase();
    var form = artForm || 'blob';
    var evo = 0;
    if (opts.champ && global.SR_ART && global.SR_ART.gelEvoLevel) {
      evo = global.SR_ART.gelEvoLevel(opts.champ);
    } else if (opts.evoLevel != null) evo = Math.floor(Number(opts.evoLevel) || 0);

    // Prefer form + pose (shaped/morph/blob) then legacy
    var candidates = (global.SR_ART && global.SR_ART.phaserGelKeyCandidates)
      ? global.SR_ART.phaserGelKeyCandidates(low, v, form)
      : [
          v === 'a' ? ('slime_' + low) : ('slime_' + low + '_' + v),
          'slime_' + low,
          'slime_legacy_' + low
        ];
    // Evolution plates first when champion has purple stars
    if (evo >= 1) {
      var evoKeys = [];
      var e;
      for (e = evo; e >= 1; e--) {
        evoKeys.push('slime_' + low + '_evo' + e);
      }
      candidates = evoKeys.concat(candidates);
    }

    // Hub / roster / champion-detail: prefer gentle UI cutouts so translucent gel
    // body is not eaten by combat-aggressive magenta key. Combat keeps slime_* only.
    var preferUi = mode !== 'combat' && mode !== '3d' && opts.combat !== true;
    if (preferUi) {
      var uiFirst = [];
      var ci;
      var toUi = (global.SR_ART && global.SR_ART.uiGelDestKey)
        ? global.SR_ART.uiGelDestKey
        : function (k) {
            if (!k || k.indexOf('slime_') !== 0) return null;
            if (k.indexOf('slime_ui_') === 0 || k.indexOf('slime_legacy_') === 0) return null;
            return 'slime_ui_' + k.slice('slime_'.length);
          };
      for (ci = 0; ci < candidates.length; ci++) {
        var uk = toUi(candidates[ci]);
        if (uk) uiFirst.push(uk);
      }
      candidates = uiFirst.concat(candidates);
    }

    var i;
    for (i = 0; i < candidates.length; i++) {
      if (scene.textures.exists(candidates[i])) {
        var isUi = candidates[i].indexOf('slime_ui_') === 0;
        return {
          key: candidates[i],
          is3d: false,
          combat: !isUi,
          uiSafe: isUi,
          variant: v,
          form: form,
          evo: evo
        };
      }
    }
    if (mode === '3d') {
      var k3 = 'slime3d_' + low;
      if (scene.textures.exists(k3)) return { key: k3, is3d: true, combat: false };
    }
    return null;
  }

  /** White circle texture for BitmapMask (works inside nested containers). */
  function ensurePortraitCircleMaskTex(scene) {
    if (!scene || !scene.textures || scene.textures.exists('sr_portrait_circle_mask')) return;
    try {
      var g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(64, 64, 64);
      g.generateTexture('sr_portrait_circle_mask', 128, 128);
      g.destroy();
    } catch (e) { /* ignore */ }
  }

  function addSlimePortrait(scene, x, y, size, element, depth, opts) {
    opts = opts || {};
    depth = depth == null ? 20 : depth;
    size = size || 72;
    var el = String(element || 'Water');
    // Vary portrait footprint by element family + rarity (lava big, wind/spirit small)
    var scaleMul = opts.fixedSize ? 1 : gelPortraitScale(el, opts.rarity);
    size = size * scaleMul;
    var mode = opts.mode || 'badge';
    // Unit may pass artVariant / artForm or full champ object
    var artV = opts.artVariant;
    var artF = opts.artForm;
    if (opts.champ) {
      if (artV == null) {
        artV = opts.champ.artVariant ||
          (global.SR_ART && global.SR_ART.artVariantForUnit
            ? global.SR_ART.artVariantForUnit(opts.champ)
            : 'a');
      }
      if (artF == null) {
        artF = (global.SR_ART && global.SR_ART.gelFormForUnit)
          ? global.SR_ART.gelFormForUnit(opts.champ)
          : 'blob';
      }
    }
    var resolved = resolveSlimeKey(scene, el, mode, artV, artF, opts);
    var is3d = !!(resolved && resolved.is3d);
    // Slight portrait scale for evolved champs (matches combat evo size nudge)
    if (!opts.fixedSize && opts.champ && global.SR_ART && global.SR_ART.gelEvoLevel) {
      var evoLv = global.SR_ART.gelEvoLevel(opts.champ);
      if (evoLv > 0) size = size * (1 + Math.min(0.2, evoLv * 0.06));
    }
    var isCombat = !!(resolved && resolved.combat);
    // Combat full-body sprites: no circular crop (would cut feet). Optional ring for rarity.
    var showRing = opts.ring != null ? !!opts.ring : (!is3d && !isCombat);
    var ringColor = rarityColor(opts.rarity || 'Common');
    var container = scene.add.container(x, y).setDepth(depth);

    // Soft ground shadow under portrait (scales with gel size)
    var shadow = scene.add.ellipse(0, size * 0.42, size * 0.72, size * 0.18, 0x000000, 0.35);
    container.add(shadow);

    if (showRing) {
      // Outer gold tick + rarity ring; soft fill only (portrait sits on top)
      var goldRing = scene.add.circle(0, 0, size * 0.54, 0x000000, 0.01)
        .setStrokeStyle(Math.max(2, size * 0.04), THEME.gold, 0.85);
      var ringFill = (THEME.panel != null) ? THEME.panel : 0x0a0e12;
      // Low fill alpha so a failed mask never leaves a solid black hole
      var ring = scene.add.circle(0, 0, size * 0.5, ringFill, 0.35)
        .setStrokeStyle(Math.max(2, size * 0.06), ringColor);
      container.add([goldRing, ring]);
    } else if (isCombat && opts.ring !== false) {
      // Subtle rarity foot-ring under combat figure (not a face plate circle)
      var footRing = scene.add.ellipse(0, size * 0.4, size * 0.55, size * 0.14, 0x000000, 0.01)
        .setStrokeStyle(Math.max(2, size * 0.035), ringColor, 0.75);
      container.add(footRing);
    }

    if (resolved) {
      // Combat sprites = full-body tall; legacy 3d/plate = square-ish
      var dispW = size * (isCombat ? 0.95 : (is3d ? 1.08 : 0.95));
      var dispH = size * (isCombat ? 1.12 : (is3d ? 1.08 : 0.95));
      var img = scene.add.image(0, isCombat ? -size * 0.06 : 0, resolved.key)
        .setDisplaySize(dispW, dispH);
      // Circular crop for badge plates.
      // GeometryMask is world-space and breaks when portrait is nested at local (0,0)
      // inside a container (hub party) — image vanishes, only black ring fill remains.
      // BitmapMask from a co-located white circle tracks the container correctly.
      if (!is3d && !isCombat && opts.circleMask !== false) {
        var maskR = Math.max(dispW, dispH) * 0.5 + 1;
        ensurePortraitCircleMaskTex(scene);
        var maskImg = scene.add.image(0, 0, 'sr_portrait_circle_mask')
          .setDisplaySize(maskR * 2, maskR * 2)
          .setVisible(false);
        container.add(maskImg);
        try {
          var bMask = maskImg.createBitmapMask();
          img.setMask(bMask);
          img._maskImg = maskImg;
          img._bitmapMask = bMask;
        } catch (eMask) {
          // Fallback: world-space geometry (works when x,y are true world coords)
          try {
            var maskGfx = scene.make.graphics({ x: 0, y: 0, add: false });
            maskGfx.fillStyle(0xffffff);
            maskGfx.fillCircle(x, y, maskR);
            img.setMask(maskGfx.createGeometryMask());
            img._maskGfx = maskGfx;
          } catch (eG) { /* show unmasked */ }
        }
      } else if (scene.tweens && (is3d || isCombat || opts.bob)) {
        scene.tweens.add({
          targets: img, y: (isCombat ? -size * 0.06 : 0) - size * 0.025,
          duration: 1400 + Math.random() * 400,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      }
      container.add(img);
      container._portrait = img;
      container._is3d = is3d;
      container._isCombat = isCombat;
    } else {
      var tint = ELEMENT_TINT[el] || 0x66bb6a;
      var body = scene.add.circle(0, 2, size * 0.38, tint, 0.95)
        .setStrokeStyle(2, 0xffffff, 0.35);
      var hi = scene.add.circle(-size * 0.12, -size * 0.12, size * 0.12, 0xffffff, 0.45);
      var eyeL = scene.add.circle(-size * 0.1, -size * 0.02, size * 0.07, 0x112211);
      var eyeR = scene.add.circle(size * 0.1, -size * 0.02, size * 0.07, 0x112211);
      container.add([body, hi, eyeL, eyeR]);
      container._portrait = body;
    }

    // Stars only on badge / UI portraits — never on combat full-body sprites.
    // Explicit showStars:false (e.g. champion detail stage) skips; detail has its own star row.
    var wantStars = !!opts.champ && opts.showStars !== false && !isCombat &&
      (opts.showStars === true || mode === 'badge');
    if (wantStars) {
      var DATA = global.SR_DATA || {};
      var baseStars = 0;
      var purpleStars = 0;
      if (DATA.getBaseStars) baseStars = DATA.getBaseStars(opts.champ);
      else if (opts.champ.baseStars != null) baseStars = opts.champ.baseStars;
      else {
        var rarMap = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5, Mythic: 6 };
        baseStars = rarMap[opts.champ.rarity] != null ? rarMap[opts.champ.rarity] : 1;
      }
      if (DATA.getPurpleStars) purpleStars = DATA.getPurpleStars(opts.champ);
      else {
        purpleStars = opts.champ.purpleStars != null
          ? opts.champ.purpleStars
          : (opts.champ.evolutionLevel || 0);
      }
      purpleStars = Math.max(0, Math.min(baseStars, Math.floor(purpleStars || 0)));
      var starSize = Math.max(9, Math.min(16, size * 0.16));
      var starY = size * 0.48;
      if (baseStars <= 0) {
        var myth = scene.add.text(0, starY, '✦', {
          fontFamily: 'system-ui', fontSize: starSize + 'px', color: '#f472b6',
          stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        container.add(myth);
      } else {
        var gap = starSize * 0.92;
        var totalW = Math.max(0, (baseStars - 1) * gap);
        for (var si = 0; si < baseStars; si++) {
          var isPur = si < purpleStars;
          var st = scene.add.text(-totalW / 2 + si * gap, starY, '★', {
            fontFamily: 'system-ui',
            fontSize: starSize + 'px',
            color: isPur ? '#c084fc' : '#f5d76e',
            stroke: '#1a0a18',
            strokeThickness: 3
          }).setOrigin(0.5);
          container.add(st);
        }
      }
    }
    return container;
  }

  /**
   * Hub / mode dock chip — card + label share one container (scale together).
   * Idle slightly smaller; hover expands; leave retracts. Text stays centered in art.
   */
  function addHubNavChip(scene, x, y, w, h, label, icon, onClick) {
    installCrispText(scene);
    var depth = 40;
    var idleFill = THEME.jadeDeep;
    var hoverFill = THEME.jadeLite;
    var idleStroke = THEME.gold;
    var hoverStroke = THEME.goldLite;
    // Full size at rest; tiny hover pop
    var idleScale = 1;
    var hoverScale = 1.03;

    var root = scene.add.container(x, y).setDepth(depth);
    root.setScale(idleScale);

    var shadow = scene.add.ellipse(0, h * 0.34, w * 0.88, h * 0.38, 0x000000, 0.32);
    root.add(shadow);

    var frame = addUiPlate(scene, UI_TEX.chip, 0, 0, w, h, 0, {
      alpha: 1, mode: 'fit'
    });
    var painted = !!frame;
    if (frame) {
      if (typeof frame.setDepth === 'function') frame.setDepth(0);
      root.add(frame);
    } else {
      frame = scene.add.rectangle(0, 0, w, h, idleFill, 0.94)
        .setStrokeStyle(2, idleStroke);
      root.add(frame);
    }

    var fw = (frame._srUiW != null) ? frame._srUiW : w;
    var fh = (frame._srUiH != null) ? frame._srUiH : h;
    // ~10% smaller type, centered in the gold window of the chip art
    var fontPx = Math.max(8, Math.min(11, Math.floor(Math.min(fw, fh) * 0.094)));
    var lineH = Math.max(1, Math.floor(fontPx * 0.1));
    var labelText = icon
      ? icon + '\n' + label
      : label;
    var text = addText(scene, 0, 0, labelText, {
      fontFamily: THEME.fontBody,
      fontSize: fontPx + 'px',
      color: THEME.text,
      fontStyle: 'bold',
      align: 'center',
      lineSpacing: lineH,
      stroke: '#06140c',
      strokeThickness: 2,
      wordWrap: { width: Math.max(32, Math.floor(fw * 0.48)) }
    }).setOrigin(0.5);
    if (typeof text.setDepth === 'function') text.setDepth(2);
    root.add(text);

    // Full-size hit rect (stable under scale) so hover out always fires
    var hit = scene.add.rectangle(0, 0, w + 8, h + 8, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    root.add(hit);

    function tweenRoot(scale) {
      if (scene.tweens) {
        scene.tweens.killTweensOf(root);
        scene.tweens.add({
          targets: root,
          scaleX: scale,
          scaleY: scale,
          duration: 130,
          ease: 'Sine.easeOut'
        });
      } else {
        root.setScale(scale);
      }
    }

    hit.on('pointerover', function () {
      if (painted && frame.setTint) frame.setTint(0xffffee);
      else if (!painted && frame.setFillStyle) {
        frame.setFillStyle(hoverFill, 1);
        if (frame.setStrokeStyle) frame.setStrokeStyle(2, hoverStroke);
      }
      text.setColor('#ffffff');
      tweenRoot(hoverScale);
    });
    hit.on('pointerout', function () {
      if (painted && frame.clearTint) frame.clearTint();
      else if (!painted && frame.setFillStyle) {
        frame.setFillStyle(idleFill, 0.94);
        if (frame.setStrokeStyle) frame.setStrokeStyle(2, idleStroke);
      }
      text.setColor(THEME.text);
      tweenRoot(idleScale);
    });
    if (onClick) {
      hit.on('pointerdown', function () {
        // Brief press squash then fire
        if (scene.tweens) {
          scene.tweens.killTweensOf(root);
          scene.tweens.add({
            targets: root, scaleX: idleScale * 0.96, scaleY: idleScale * 0.96,
            duration: 60, yoyo: true, onComplete: onClick
          });
        } else onClick();
      });
    }
    return { frame: frame, text: text, root: root, hit: hit };
  }

  function addModePortal(scene, x, y, w, h, mode, onClick) {
    return addHubNavChip(scene, x, y, w, h, mode.label || 'Mode', '', onClick);
  }

  /**
   * Section header for mode pages (Materials, Artifacts, etc.)
   */
  function addSectionHeader(scene, x, y, label, depth) {
    installCrispText(scene);
    depth = depth == null ? 50 : depth;
    var t = addText(scene, x, y, label, {
      fontFamily: THEME.fontTitle, fontSize: '18px', color: THEME.textGold,
      stroke: '#000', strokeThickness: 3
    }).setDepth(depth);
    addGoldRule(scene, x + 80, y + 14, 120, depth);
    return t;
  }

  /**
   * Inventory / list card — painterly panel when available.
   */
  function addCard(scene, x, y, w, h, opts) {
    opts = opts || {};
    var depth = opts.depth != null ? opts.depth : 40;
    var fill = opts.fill != null ? opts.fill : THEME.panelLite;
    var stroke = opts.stroke != null ? opts.stroke : THEME.gold;
    var alpha = opts.alpha != null ? opts.alpha : 0.92;
    var g = null;
    var bg = addUiPlate(scene, UI_TEX.panel, x, y, w, h, depth, {
      alpha: alpha, mode: 'nineslice', left: 80, right: 80, top: 80, bottom: 80
    });
    if (!bg) {
      bg = scene.add.rectangle(x, y, w, h, fill, alpha)
        .setStrokeStyle(2, stroke)
        .setDepth(depth);
      g = scene.add.graphics().setDepth(depth + 1);
      g.lineStyle(2, THEME.goldLite, 0.7);
      var hw = w / 2;
      var hh = h / 2;
      var c = 10;
      g.beginPath(); g.moveTo(x - hw, y - hh + c); g.lineTo(x - hw, y - hh); g.lineTo(x - hw + c, y - hh); g.strokePath();
      g.beginPath(); g.moveTo(x + hw - c, y - hh); g.lineTo(x + hw, y - hh); g.lineTo(x + hw, y - hh + c); g.strokePath();
      g.beginPath(); g.moveTo(x - hw, y + hh - c); g.lineTo(x - hw, y + hh); g.lineTo(x - hw + c, y + hh); g.strokePath();
      g.beginPath(); g.moveTo(x + hw - c, y + hh); g.lineTo(x + hw, y + hh); g.lineTo(x + hw, y + hh - c); g.strokePath();
    }

    if (opts.interactive) {
      bg.setInteractive({ useHandCursor: true });
      wireHover(bg, {
        fill: fill, fillHover: opts.fillHover || THEME.jade,
        stroke: stroke, strokeHover: THEME.goldLite, alpha: alpha
      });
    }
    return { bg: bg, corners: g };
  }

  function goScene(scene, key, data, opts) {
    if (global.SR_TRANSIT && global.SR_TRANSIT.go) {
      global.SR_TRANSIT.go(scene, key, data, opts);
      return;
    }
    if (data != null) scene.scene.start(key, data);
    else scene.scene.start(key);
  }

  /**
   * Polished ink panel (village-bar language, not green jade).
   * addInkPanel(scene, x, y, w, h, { depth, fill, stroke, alpha, interactive, onClick })
   */
  function addInkPanel(scene, x, y, w, h, opts) {
    opts = opts || {};
    installCrispText(scene);
    var depth = opts.depth != null ? opts.depth : 40;
    var fill = opts.fill != null ? opts.fill : 0x0a0e12;
    var stroke = opts.stroke != null ? opts.stroke : THEME.gold;
    var alpha = opts.alpha != null ? opts.alpha : 0.94;
    var root = scene.add.container(x, y).setDepth(depth);
    var shadow = scene.add.ellipse(0, h * 0.42, w * 0.92, h * 0.28, 0x000000, 0.28);
    root.add(shadow);
    var plate = addUiPlate(scene, UI_TEX.panel, 0, 0, w, h, 0, {
      alpha: alpha, mode: 'nineslice', left: 64, right: 64, top: 64, bottom: 64
    });
    var bg;
    if (plate) {
      root.add(plate);
      bg = plate;
    } else {
      bg = scene.add.rectangle(0, 0, w, h, fill, alpha)
        .setStrokeStyle(2, stroke, 0.9);
      root.add(bg);
      // Gold corner ticks
      var g = scene.add.graphics();
      g.lineStyle(2, THEME.goldLite, 0.65);
      var hw = w / 2;
      var hh = h / 2;
      var c = 12;
      g.beginPath(); g.moveTo(-hw, -hh + c); g.lineTo(-hw, -hh); g.lineTo(-hw + c, -hh); g.strokePath();
      g.beginPath(); g.moveTo(hw - c, -hh); g.lineTo(hw, -hh); g.lineTo(hw, -hh + c); g.strokePath();
      g.beginPath(); g.moveTo(-hw, hh - c); g.lineTo(-hw, hh); g.lineTo(-hw + c, hh); g.strokePath();
      g.beginPath(); g.moveTo(hw - c, hh); g.lineTo(hw, hh); g.lineTo(hw, hh - c); g.strokePath();
      root.add(g);
    }
    var hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001);
    root.add(hit);
    if (opts.interactive || opts.onClick) {
      hit.setInteractive({ useHandCursor: true });
      wireHover(hit, {
        paintFill: false,
        hoverScale: 1.03,
        idleScale: 1,
        scaleTarget: root,
        tintTarget: plate && plate._srUiPlate ? plate : null,
        tintHover: 0xffffee
      });
      if (!plate) {
        hit.on('pointerover', function () {
          if (bg.setStrokeStyle) bg.setStrokeStyle(2, THEME.goldLite, 1);
          root.setScale(1.03);
        });
        hit.on('pointerout', function () {
          if (bg.setStrokeStyle) bg.setStrokeStyle(2, stroke, 0.9);
          root.setScale(1);
        });
      }
      if (opts.onClick) hit.on('pointerdown', opts.onClick);
    }
    return { root: root, bg: bg, hit: hit, w: w, h: h };
  }

  /**
   * List / mode row — ink bar with title + subtitle + optional right label.
   * addListRow(scene, x, y, w, h, { title, sub, right, locked, stroke, fill, onClick, depth })
   */
  function addListRow(scene, x, y, w, h, opts) {
    opts = opts || {};
    installCrispText(scene);
    var depth = opts.depth != null ? opts.depth : 40;
    var locked = !!opts.locked;
    var fill = opts.fill != null ? opts.fill : (locked ? 0x12151a : 0x0c1016);
    var stroke = opts.stroke != null ? opts.stroke : (locked ? 0x3a4048 : THEME.gold);
    var root = scene.add.container(x, y).setDepth(depth);
    var shadow = scene.add.ellipse(0, h * 0.38, w * 0.94, h * 0.4, 0x000000, 0.22);
    root.add(shadow);
    var bg = scene.add.rectangle(0, 0, w, h, fill, locked ? 0.55 : 0.94)
      .setStrokeStyle(2, stroke, locked ? 0.45 : 0.88);
    root.add(bg);
    // Left gold accent strip
    if (!locked) {
      root.add(scene.add.rectangle(-w / 2 + 3, 0, 4, h - 10, THEME.gold, 0.75));
    }
    var title = addText(scene, -w / 2 + 18, opts.sub ? -10 : 0, opts.title || '', {
      fontFamily: THEME.fontBody,
      fontSize: Math.min(16, Math.max(13, Math.floor(h * 0.32))) + 'px',
      color: locked ? '#666' : THEME.text,
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0, 0.5);
    root.add(title);
    var sub = null;
    if (opts.sub) {
      sub = addText(scene, -w / 2 + 18, 12, opts.sub, {
        fontFamily: THEME.fontBody,
        fontSize: '11px',
        color: locked ? '#444' : '#9aab9a',
        stroke: '#000',
        strokeThickness: 2
      }).setOrigin(0, 0.5);
      root.add(sub);
    }
    var right = null;
    if (opts.right) {
      right = addText(scene, w / 2 - 14, 0, opts.right, {
        fontFamily: THEME.fontBody,
        fontSize: '12px',
        color: locked ? '#555' : THEME.textGold,
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 2
      }).setOrigin(1, 0.5);
      root.add(right);
    }
    var hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001);
    root.add(hit);
    if (!locked && (opts.onClick || opts.interactive !== false)) {
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerover', function () {
        bg.setStrokeStyle(2, THEME.goldLite, 1);
        bg.setFillStyle(0x141a22, 1);
        root.setScale(1.02);
      });
      hit.on('pointerout', function () {
        bg.setStrokeStyle(2, stroke, 0.88);
        bg.setFillStyle(fill, 0.94);
        root.setScale(1);
      });
      if (opts.onClick) hit.on('pointerdown', opts.onClick);
    }
    return {
      root: root, bg: bg, hit: hit, title: title, sub: sub, right: right,
      setLocked: function (v) {
        locked = !!v;
        bg.setFillStyle(locked ? 0x12151a : fill, locked ? 0.55 : 0.94);
        bg.setStrokeStyle(2, locked ? 0x3a4048 : stroke, locked ? 0.45 : 0.88);
      }
    };
  }

  /**
   * Campaign map pin — polished node with ring, icon, optional label under.
   * addMapPin(scene, x, y, { r, fill, stroke, icon, label, locked, current, boss, onClick, depth })
   */
  function addMapPin(scene, x, y, opts) {
    opts = opts || {};
    installCrispText(scene);
    var depth = opts.depth != null ? opts.depth : 12;
    var r = opts.r || (opts.boss ? 34 : 26);
    var locked = !!opts.locked;
    var fill = opts.fill != null ? opts.fill
      : (locked ? 0x1a1c20 : (opts.boss ? 0x4a2818 : (opts.cleared ? 0x1a2430 : 0x162028)));
    var stroke = opts.stroke != null ? opts.stroke
      : (locked ? 0x3a4048 : (opts.boss ? 0xe8a060 : THEME.gold));
    var root = scene.add.container(x, y).setDepth(depth);

    // Soft ground shadow under pin
    root.add(scene.add.ellipse(2, r * 0.55, r * 1.5, r * 0.55, 0x000000, 0.35));

    if (opts.current && !locked) {
      root.add(scene.add.circle(0, 0, r + 14, stroke, 0.2));
      // Outer pulse ring
      var pulse = scene.add.circle(0, 0, r + 10, 0x000000, 0)
        .setStrokeStyle(2, stroke, 0.55);
      root.add(pulse);
      if (scene.tweens) {
        scene.tweens.add({
          targets: pulse, scaleX: 1.2, scaleY: 1.2, alpha: 0.15,
          duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      }
    }

    var disc = scene.add.circle(0, 0, r, fill, locked ? 0.55 : 0.96)
      .setStrokeStyle(3, stroke, locked ? 0.5 : 0.95);
    root.add(disc);
    // Inner gold rim
    if (!locked) {
      root.add(scene.add.circle(0, 0, r - 5, 0x000000, 0)
        .setStrokeStyle(1, THEME.goldLite, 0.35));
    }

    var icon = addText(scene, 0, opts.boss ? -1 : 0, opts.icon != null ? String(opts.icon) : '•', {
      fontFamily: THEME.fontBody,
      fontSize: (opts.boss ? 20 : 15) + 'px',
      color: locked ? '#555' : '#f0ffe8',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5);
    root.add(icon);

    var label = null;
    if (opts.label) {
      label = addText(scene, 0, r + 12, opts.label, {
        fontFamily: THEME.fontBody,
        fontSize: '11px',
        color: locked ? '#555' : '#d0e8d8',
        align: 'center',
        wordWrap: { width: Math.max(90, r * 4) },
        stroke: '#000',
        strokeThickness: 3
      }).setOrigin(0.5, 0);
      root.add(label);
    }

    var hit = scene.add.circle(0, 0, r + 6, 0xffffff, 0.001);
    root.add(hit);
    if (!locked && opts.onClick) {
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerover', function () { root.setScale(1.1); });
      hit.on('pointerout', function () { root.setScale(1); });
      hit.on('pointerdown', opts.onClick);
    }

    return {
      root: root, disc: disc, icon: icon, label: label, hit: hit, r: r,
      setSelected: function (on) {
        disc.setStrokeStyle(on ? 4 : 3, on ? THEME.goldLite : stroke, 1);
        root.setScale(on ? 1.08 : 1);
      }
    };
  }

  /**
   * Clean campaign-style detail sheet (flat ink, no ornate panel art).
   * Intentionally simple — map behind stays the star, not a busy frame.
   * addDetailSheet(scene, x, y, w, h, { depth, stroke })
   * .setContent({ title, body, cta, ctaEnabled, ctaDanger, onCta })
   */
  function addDetailSheet(scene, x, y, w, h, opts) {
    opts = opts || {};
    installCrispText(scene);
    var depth = opts.depth != null ? opts.depth : 60;
    var stroke = opts.stroke != null ? opts.stroke : THEME.gold;
    var root = scene.add.container(x, y).setDepth(depth);

    // Soft drop only — no nineslice / corner ticks / painted plate
    root.add(scene.add.ellipse(4, h * 0.42, w * 0.9, h * 0.22, 0x000000, 0.35));
    var bg = scene.add.rectangle(0, 0, w, h, 0x0a0e12, 0.92)
      .setStrokeStyle(1.5, stroke, 0.75);
    root.add(bg);
    // Single thin hairline under title area
    root.add(scene.add.rectangle(0, -h / 2 + 52, w - 48, 1, stroke, 0.35));

    var title = addText(scene, 0, -h / 2 + 28, '', {
      fontFamily: THEME.fontTitle,
      fontSize: '17px',
      color: THEME.text,
      align: 'center',
      wordWrap: { width: w - 48 },
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    root.add(title);

    var body = addText(scene, 0, 2, '', {
      fontFamily: THEME.fontBody,
      fontSize: '13px',
      color: '#a8b8a8',
      align: 'center',
      wordWrap: { width: w - 52 },
      lineSpacing: 5,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    root.add(body);

    var ctaY = h / 2 - 34;
    var ctaW = Math.min(200, w - 56);
    var ctaBg = scene.add.rectangle(0, ctaY, ctaW, 40, 0x12161c, 1)
      .setStrokeStyle(1.5, stroke, 0.85);
    var ctaTxt = addText(scene, 0, ctaY, 'Battle', {
      fontFamily: THEME.fontBody,
      fontSize: '15px',
      color: THEME.text,
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5);
    root.add([ctaBg, ctaTxt]);
    var ctaHit = scene.add.rectangle(0, ctaY, ctaW, 40, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    root.add(ctaHit);
    var ctaHandler = null;
    var ctaStroke = stroke;
    ctaHit.on('pointerover', function () {
      if (ctaHit.input && ctaHit.input.enabled) {
        ctaBg.setStrokeStyle(2, THEME.goldLite, 1);
        ctaBg.setFillStyle(0x1a2030, 1);
      }
    });
    ctaHit.on('pointerout', function () {
      ctaBg.setStrokeStyle(1.5, ctaStroke, 0.85);
      ctaBg.setFillStyle(0x12161c, 1);
    });
    ctaHit.on('pointerdown', function () {
      if (ctaHandler) ctaHandler();
    });

    function setContent(cfg) {
      cfg = cfg || {};
      title.setText(cfg.title || '');
      body.setText(cfg.body || '');
      ctaTxt.setText(cfg.cta || 'Battle');
      ctaHandler = cfg.onCta || null;
      var en = cfg.ctaEnabled !== false;
      if (en) {
        ctaStroke = cfg.ctaDanger ? 0xd4a060 : stroke;
        ctaBg.setFillStyle(0x12161c, 1);
        ctaBg.setStrokeStyle(1.5, ctaStroke, 0.9);
        ctaTxt.setColor('#f0ffe8');
        ctaHit.setInteractive({ useHandCursor: true });
      } else {
        ctaStroke = 0x444444;
        ctaBg.setFillStyle(0x141414, 1);
        ctaBg.setStrokeStyle(1.5, 0x444444, 0.5);
        ctaTxt.setColor('#666666');
        ctaHit.disableInteractive();
      }
    }

    return {
      root: root,
      bg: bg,
      title: title,
      body: body,
      setContent: setContent,
      ctaBg: ctaBg,
      ctaTxt: ctaTxt
    };
  }

  global.SR_UI = {
    THEME: THEME,
    UI_TEX: UI_TEX,
    ELEMENT_TINT: ELEMENT_TINT,
    RARITY_HEX: RARITY_HEX,
    RARITY_NUM: RARITY_NUM,
    rarityHex: rarityHex,
    rarityColor: rarityColor,
    textResolution: textResolution,
    addText: addText,
    installCrispText: installCrispText,
    paintModeBg: paintModeBg,
    addBackButton: addBackButton,
    goScene: goScene,
    addTamerBadge: addTamerBadge,
    backLabelForScene: backLabelForScene,
    addTitle: addTitle,
    addCurrencyStrip: addCurrencyStrip,
    addButton: addButton,
    addSettingsMenu: addSettingsMenu,
    toast: toast,
    gelPortraitScale: gelPortraitScale,
    addSlimePortrait: addSlimePortrait,
    addHubNavChip: addHubNavChip,
    addModePortal: addModePortal,
    addPanel: addPanel,
    addCard: addCard,
    addUiPlate: addUiPlate,
    addGoldRule: addGoldRule,
    addSectionHeader: addSectionHeader,
    addInkPanel: addInkPanel,
    addListRow: addListRow,
    addMapPin: addMapPin,
    addDetailSheet: addDetailSheet,
    wireHover: wireHover,
    hasTex: hasTex
  };
})(typeof window !== 'undefined' ? window : global);
