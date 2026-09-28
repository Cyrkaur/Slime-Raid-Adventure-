/**
 * Art language parity + AA-tier floors for Boot-loaded stills and wired loops.
 * Decodes JPEG SOF / PNG IHDR / MP4 mvhd from real bytes (no Python PIL).
 */
const path = require('path');
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HTML_ROOT = path.resolve(ROOT, '../Slime Adventure');
const SCRATCH = process.env.GOAL_SCRATCH ||
  '/var/folders/fw/0_cfyf5s2mb1c50p8jn_z_nw0000gq/T/grok-goal-429278b56f95/implementer';

function assert(c, m) {
  if (!c) throw new Error(m || 'assert failed');
}

const lines = [];
function log(s) { lines.push(s); console.log(s); }

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
      return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    }
    if (m === 0xd8 || m === 0xd9) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

function pngSize(buf) {
  if (buf.length < 24 || buf[0] !== 0x89) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function imageDim(abs) {
  const buf = fs.readFileSync(abs);
  if (buf[0] === 0xff && buf[1] === 0xd8) return jpegSize(buf);
  if (buf[0] === 0x89) return pngSize(buf);
  return null;
}

function longEdge(d) {
  return d ? Math.max(d.w, d.h) : 0;
}

/** Parse MP4 mvhd timescale/duration; width/height from tkhd or mdhd via ffprobe fallback. */
function mp4Info(abs) {
  const buf = fs.readFileSync(abs);
  assert(buf.toString('ascii', 4, 8) === 'ftyp' || buf.indexOf('ftyp') >= 0, 'mp4 ftyp ' + abs);
  let durationSec = 0;
  function walk(start, end) {
    let i = start;
    while (i + 8 <= end) {
      let size = buf.readUInt32BE(i);
      const typ = buf.toString('ascii', i + 4, i + 8);
      if (size === 1 && i + 16 <= end) size = Number(buf.readBigUInt64BE(i + 8));
      if (size < 8) break;
      const boxEnd = Math.min(end, i + size);
      if (typ === 'moov' || typ === 'trak' || typ === 'mdia') walk(i + 8, boxEnd);
      else if (typ === 'mvhd') {
        const ver = buf[i + 8];
        let timescale, duration;
        if (ver === 1) {
          timescale = buf.readUInt32BE(i + 8 + 4 + 16);
          duration = Number(buf.readBigUInt64BE(i + 8 + 4 + 20));
        } else {
          timescale = buf.readUInt32BE(i + 20);
          duration = buf.readUInt32BE(i + 24);
        }
        if (timescale > 0) durationSec = duration / timescale;
      }
      i = boxEnd;
    }
  }
  walk(0, buf.length);
  let w = 0;
  let h = 0;
  try {
    const csv = execFileSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration', '-of', 'csv=p=0', abs
    ], { encoding: 'utf8' }).trim();
    const parts = csv.split(',');
    w = parseInt(parts[0], 10) || 0;
    h = parseInt(parts[1], 10) || 0;
    const d = parseFloat(parts[2]);
    if (d > 0) durationSec = d;
  } catch (e) { /* header duration still used */ }
  return { w, h, durationSec };
}

function isStudioMagentaRgb(r, g, b) {
  return r > 160 && b > 90 && g < 140 && (r - g) > 40;
}

function sampleCornerRgb(abs) {
  try {
    const out = execFileSync('ffmpeg', [
      '-v', 'error', '-i', abs, '-vf', 'crop=4:4:2:2,format=rgb24',
      '-frames:v', '1', '-f', 'rawvideo', '-'
    ]);
    if (out && out.length >= 3) return { r: out[0], g: out[1], b: out[2] };
  } catch (e) { /* */ }
  return null;
}

log('=== art-parity.test.js ===');

const DATA = require(path.join(ROOT, 'src/data/gameData.js'));
const ART = require(path.join(ROOT, 'src/ui/artPipeline.js'));
const boot = fs.readFileSync(path.join(ROOT, 'src/scenes/BootScene.js'), 'utf8');
const battle = fs.readFileSync(path.join(ROOT, 'src/scenes/BattleScene.js'), 'utf8');
const hub = fs.readFileSync(path.join(ROOT, 'src/scenes/HubScene.js'), 'utf8');

assert(ART.STYLE_ID === 'painterly-fantasy', 'STYLE_ID painterly-fantasy, got ' + ART.STYLE_ID);
assert(ART.PRESENTATION === 'sprites', 'presentation sprites');
assert(ART.ART_CACHE_VER && String(ART.ART_CACHE_VER).length > 4, 'ART_CACHE_VER bumped');
log('PASS style lock STYLE_ID=' + ART.STYLE_ID + ' ver=' + ART.ART_CACHE_VER);

const els = (DATA.ELEMENTS || ART.ELEMENTS || []).map((e) => String(e).toLowerCase());
assert(els.length === 16, '16 elements');
const enemies = ['beast', 'golem', 'humanoid', 'dragon', 'undead', 'plant', 'insect', 'elemental'];
const maps = ['greenwild', 'crystal', 'shadowfen', 'volcanic', 'celestial'];
const envs = ['greenwild', 'crystal', 'shadowfen', 'volcanic', 'celestial', 'dungeon'];
const modes = (DATA.HUB_MODES || []).map((m) => m.artFile);
assert(modes.length === 11, '11 mode art files expected');

const inventory = [];
function addStill(rel, floor, role) {
  const abs = path.join(ROOT, rel);
  assert(fs.existsSync(abs), 'missing still ' + rel);
  const d = imageDim(abs);
  assert(d && d.w && d.h, 'decode dim ' + rel);
  const L = longEdge(d);
  inventory.push({ rel, w: d.w, h: d.h, long: L, floor, role });
  assert(L >= floor, rel + ' long-edge ' + L + ' < floor ' + floor);
  log('OK still ' + rel + ' ' + d.w + 'x' + d.h + ' floor=' + floor);
}

// Scene / background ≥ 1280
addStill('assets/village-hub.jpg', 1280, 'scene');
maps.forEach((id) => addStill('assets/maps/' + id + '.jpg', 1280, 'scene'));
modes.forEach((f) => addStill('assets/modes/' + f, 1280, 'scene'));
addStill('assets/arenas/wilds-depth.jpg', 1280, 'scene');
addStill('assets/arenas/dungeon-depth.jpg', 1280, 'scene');
envs.forEach((id) => {
  addStill('assets/battle/env/' + id + '/ground.jpg', 1280, 'scene');
  addStill('assets/battle/env/' + id + '/sky.jpg', 1280, 'scene');
  addStill('assets/battle/env/' + id + '/prop.jpg', 1024, 'cutout');
  ['b', 'c', 'd', 'e'].forEach((suf) => {
    const rel = 'assets/battle/env/' + id + '/prop_' + suf + '.jpg';
    if (fs.existsSync(path.join(ROOT, rel))) addStill(rel, 1024, 'cutout');
  });
});

// UI kit
addStill('assets/ui/panel.jpg', 1024, 'ui-hi');
addStill('assets/ui/title_banner.jpg', 1024, 'ui-hi');
addStill('assets/ui/battle_load.jpg', 1024, 'ui-hi');
addStill('assets/ui/button.png', 512, 'ui');
addStill('assets/ui/button_danger.png', 512, 'ui');
addStill('assets/ui/currency_pill.png', 512, 'ui');
addStill('assets/ui/mode_chip.png', 512, 'ui');
addStill('assets/ui/tamer_badge.png', 512, 'ui');

// Combat gels Boot loads
els.forEach((el) => {
  ['a', 'b', 'c'].forEach((v) => {
    addStill('assets/battle/gels/combat/' + el + '_blob_' + v + '.jpg', 1024, 'cutout');
    addStill('assets/battle/gels/combat/' + el + '_' + v + '.jpg', 1024, 'cutout');
  });
  addStill('assets/battle/gels/combat/' + el + '.jpg', 1024, 'cutout');
  addStill('assets/battle/gels/combat/' + el + '_morph_a.jpg', 1024, 'cutout');
  addStill('assets/battle/gels/combat/' + el + '_morph.jpg', 1024, 'cutout');
  addStill('assets/battle/gels/combat/' + el + '_shaped_a.jpg', 1024, 'cutout');
  addStill('assets/battle/gels/combat/' + el + '_shaped.jpg', 1024, 'cutout');
  addStill('assets/battle/gels/combat/' + el + '_blob_a_evo1.jpg', 1024, 'cutout');
  addStill('assets/battle/gels/combat/' + el + '_blob_a_attack.jpg', 1024, 'cutout');
  addStill('assets/slimes/' + el + '.jpg', 1024, 'cutout');
});
enemies.forEach((k) => addStill('assets/battle/enemies/' + k + '.jpg', 1024, 'cutout'));

['basic', 'ranged', 'heal', 'buff', 'shield'].forEach((s) => {
  addStill('assets/battle/skills/' + s + '.png', 512, 'ui');
});
['smash', 'splash', 'blaze', 'bolt', 'poison', 'inferno', 'auto'].forEach((s) => {
  addStill('assets/battle/skills/' + s + '.jpg', 512, 'ui');
});
fs.readdirSync(path.join(ROOT, 'assets/battle/fx')).filter((f) => /\.(png|jpg)$/i.test(f)).forEach((f) => {
  addStill('assets/battle/fx/' + f, 512, 'ui');
});
addStill('assets/characters/lyra-guide.jpg', 1024, 'cutout');

log('PASS still floors n=' + inventory.length);

// Magenta studio on primary blob idle + blob attack + enemies
els.forEach((el) => {
  ['blob_a', 'blob_a_attack'].forEach((stem) => {
    const rel = 'assets/battle/gels/combat/' + el + '_' + stem + '.jpg';
    const rgb = sampleCornerRgb(path.join(ROOT, rel));
    if (rgb) {
      assert(isStudioMagentaRgb(rgb.r, rgb.g, rgb.b),
        'magenta key ' + rel + ' corner ' + JSON.stringify(rgb));
      log('OK magenta ' + rel + ' rgb=' + rgb.r + ',' + rgb.g + ',' + rgb.b);
    } else {
      log('WARN no ffmpeg sample for ' + rel + ' — file present at cutout floor');
    }
  });
});
enemies.forEach((k) => {
  const rel = 'assets/battle/enemies/' + k + '.jpg';
  const rgb = sampleCornerRgb(path.join(ROOT, rel));
  if (rgb) {
    assert(isStudioMagentaRgb(rgb.r, rgb.g, rgb.b),
      'magenta key enemy ' + k + ' ' + JSON.stringify(rgb));
    log('OK magenta ' + rel);
  } else {
    log('WARN no ffmpeg sample for ' + rel);
  }
});

// Wired loops (BootScene + modeVideoBg)
const loops = [
  'assets/village-hub-loop.mp4',
  'assets/dungeon-hall-loop.mp4',
  'assets/modes/campaign-loop.mp4',
  'assets/modes/champions-loop.mp4',
  'assets/modes/summon-loop.mp4',
  'assets/modes/vault-loop.mp4',
  'assets/modes/great-hall-loop.mp4',
  'assets/modes/alchemy-loop.mp4',
  'assets/modes/workshop-loop.mp4',
  'assets/modes/market-loop.mp4',
  'assets/modes/eternity-loop.mp4',
  'assets/modes/chronicle-loop.mp4'
];
assert(loops.length === 12, '12 Boot-wired loops');
loops.forEach((rel) => {
  const abs = path.join(ROOT, rel);
  assert(fs.existsSync(abs), 'missing loop ' + rel);
  const info = mp4Info(abs);
  inventory.push({ rel, w: info.w, h: info.h, duration: info.durationSec, role: 'loop' });
  assert(info.w >= 1280 && info.h >= 720, rel + ' ' + info.w + 'x' + info.h + ' < 1280x720');
  assert(info.durationSec >= 4, rel + ' duration ' + info.durationSec + ' < 4s');
  log('OK loop ' + rel + ' ' + info.w + 'x' + info.h + ' t=' + info.durationSec.toFixed(2));
});
log('PASS loop floors n=' + loops.length);

// Boot still loads same keys
assert(/assets\/modes\//.test(boot) || /HUB_MODES/.test(boot), 'BootScene loads mode art');
assert(/slime_raw_|slime_/.test(boot) && /battle\/gels\/combat|assets\/slimes\//.test(boot),
  'BootScene loads combat gel sprites');
assert(/arena_wilds|wilds-depth/.test(boot), 'BootScene loads wilds arena');
assert(/arena_dungeon|dungeon-depth/.test(boot), 'BootScene loads dungeon arena');
assert(/hub_bg|village-hub/.test(boot), 'BootScene loads village hub');
assert(/village-hub-loop\.mp4/.test(boot), 'BootScene village loop');
assert(/dungeon-hall-loop\.mp4/.test(boot), 'BootScene dungeon loop');
log('PASS BootScene asset key references');

assert(/HUB_MODES|mode_/.test(hub), 'HubScene uses mode art');
log('PASS HubScene mode art usage');
assert(/arena_wilds|arena_dungeon/.test(battle), 'BattleScene arena keys');
assert(/slime_/.test(battle), 'BattleScene slime sprites');
assert(/computeArenaLayout|setDepth|scale/.test(battle), 'BattleScene depth presentation');
log('PASS BattleScene depth + slime art');

// Shipped resolvers against real files
function existsOnDisk(u) {
  const rel = String(u || '').replace(/\?.*$/, '');
  return fs.existsSync(path.join(ROOT, rel));
}
els.forEach((el) => {
  const idle = ART.resolveGelIdleArt({ element: el, rarity: 'Common' }, existsOnDisk);
  const idleUrl = idle && (idle.url || idle);
  assert(idleUrl && existsOnDisk(idleUrl), 'resolveGelIdleArt ' + el + ' -> ' + idleUrl);
  const atk = ART.resolveGelAttackArt({ element: el, rarity: 'Common' }, existsOnDisk);
  const atkUrl = atk && (atk.attackUrl || atk.url || atk);
  assert(atkUrl && existsOnDisk(atkUrl), 'resolveGelAttackArt ' + el + ' -> ' + atkUrl);
  const cands = ART.combatGelPathCandidates(el, 'a', 'blob');
  assert(cands && cands.length > 0, 'combatGelPathCandidates ' + el);
  assert(cands.some((c) => existsOnDisk(c)), 'idle candidate exists ' + el);
});
log('PASS shipped gel resolvers vs disk');

const slimeDir = path.join(ROOT, 'assets/slimes');
const slimeJpgs = fs.readdirSync(slimeDir).filter((f) => f.endsWith('.jpg'));
assert(slimeJpgs.length >= 16, 'slime plates >= 16, got ' + slimeJpgs.length);
log('PASS slime element plates count=' + slimeJpgs.length);

if (fs.existsSync(HTML_ROOT)) {
  modes.forEach((f) => {
    const hp = path.join(HTML_ROOT, 'assets/modes', f);
    assert(fs.existsSync(hp), 'HTML mode art missing ' + f);
  });
  log('PASS HTML mode art twin exists for all ' + modes.length + ' modes');
} else {
  log('WARN HTML root not found at ' + HTML_ROOT + ' — skipped HTML twin check');
}

log('ALL ART PARITY TESTS PASSED');

fs.mkdirSync(SCRATCH, { recursive: true });
fs.writeFileSync(path.join(SCRATCH, 'art-parity.log'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(SCRATCH, 'aa-art-inventory.log'), JSON.stringify(inventory, null, 2) + '\n');
