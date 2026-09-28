/**
 * Evolution art (evo1): assets, resolve by purpleStars, size nudge, fallback.
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

function assert(c, m) {
  if (!c) throw new Error(m || 'assert failed');
}

const lines = [];
function log(s) { lines.push(s); console.log(s); }

log('=== evo-art.test.js ===');

const ART = require(path.join(ROOT, 'src/ui/artPipeline.js'));
const WS = require(path.join(ROOT, 'src/data/worldSize.js'));

assert(typeof ART.gelEvoLevel === 'function', 'gelEvoLevel');
assert(typeof ART.combatGelEvoPath === 'function', 'combatGelEvoPath');
assert(typeof ART.resolveGelIdleArt === 'function', 'resolveGelIdleArt');
log('PASS exports');

const ELEMENTS = ART.ELEMENTS || [
  'water', 'fire', 'earth', 'wind', 'plant', 'lightning', 'ice', 'shadow',
  'light', 'metal', 'poison', 'crystal', 'lava', 'storm', 'spirit', 'void'
];

function existsRel(rel) {
  return fs.existsSync(path.join(ROOT, String(rel).replace(/\?.*$/, '')));
}

// All 16 evo1 plates
ELEMENTS.forEach((el) => {
  const p = path.join(ROOT, 'assets/battle/gels/combat', el + '_blob_a_evo1.jpg');
  assert(fs.existsSync(p), 'missing evo1 ' + el);
  assert(fs.statSync(p).size > 5000, 'tiny evo1 ' + el);
  log('OK evo1 asset ' + el);
});
log('PASS 16 evo1 plates');

// gelEvoLevel from purpleStars / evolutionLevel
assert(ART.gelEvoLevel({ purpleStars: 1 }) === 1, 'purpleStars 1');
assert(ART.gelEvoLevel({ evolutionLevel: 2 }) === 2, 'evolutionLevel 2');
assert(ART.gelEvoLevel({ purpleStars: 0 }) === 0, 'base 0');
assert(ART.gelEvoLevel({}) === 0, 'empty 0');
log('PASS gelEvoLevel');

// Unevolved → base idle (not evo stem as first hit when existsFn prefers real files)
const baseWater = ART.resolveGelIdleArt(
  { element: 'Water', rarity: 'Common', purpleStars: 0 },
  existsRel
);
assert(baseWater.url, 'base water url');
assert(!/_evo\d+/i.test(String(baseWater.url).replace(/\?.*$/, '')) || !baseWater.usedEvoArt,
  'base should not use evo art: ' + baseWater.url);
assert(baseWater.usedEvoArt === false, 'usedEvoArt false for base');
log('PASS base idle resolve ' + baseWater.url);

// Evolved → evo1 plate
const evoWater = ART.resolveGelIdleArt(
  { element: 'Water', rarity: 'Common', purpleStars: 1 },
  existsRel
);
assert(evoWater.url, 'evo water url');
assert(/_evo1/i.test(String(evoWater.url).replace(/\?.*$/, '')),
  'evo water should pick evo1: ' + evoWater.url);
assert(evoWater.usedEvoArt === true, 'usedEvoArt true');
assert(evoWater.evoLevel === 1, 'evoLevel 1');
log('PASS evo1 idle resolve ' + evoWater.url);

// Candidates for evo unit list evo stems first
const cands = ART.combatGelPathCandidates('fire', 'a', 'blob', 1);
assert(/_evo1\.jpg/i.test(String(cands[0])), 'first cand evo1: ' + cands[0]);
const hasBase = cands.some((u) => /fire_blob_a\.jpg/.test(String(u)) && !/_evo/.test(String(u)));
assert(hasBase, 'base idle still in ladder');
log('PASS candidate order evo-first');

// Size: evo1 slightly taller than base same rarity
if (WS && typeof WS.resolveGelSize === 'function') {
  const a = WS.resolveGelSize({ element: 'Water', rarity: 'Common', purpleStars: 0 });
  const b = WS.resolveGelSize({ element: 'Water', rarity: 'Common', purpleStars: 1 });
  assert(b.height > a.height, 'evo1 taller ' + b.height + ' > ' + a.height);
  assert(b.height < a.height * 1.2, 'evo1 not huge jump ' + b.height);
  log('PASS size nudge base=' + a.height.toFixed(3) + ' evo1=' + b.height.toFixed(3));
} else {
  log('SKIP size (no resolveGelSize export)');
}

// Docs mention future per-champ attack + evo roadmap
const docs = fs.readFileSync(path.join(ROOT, 'docs/ART_PIPELINE.md'), 'utf8');
assert(/every individual slime|per individual slime/i.test(docs), 'docs future per-champ attack');
assert(/evo1|Evolution art/i.test(docs), 'docs evo art');
assert(/coming weeks|Future/i.test(docs), 'docs future roadmap');
log('PASS docs roadmap');

// Boot loads evo1 raw keys
const boot = fs.readFileSync(path.join(ROOT, 'src/scenes/BootScene.js'), 'utf8');
assert(/_evo1/.test(boot), 'Boot loads evo1');
log('PASS Boot evo1 load');

log('ALL EVO-ART TESTS PASSED');
