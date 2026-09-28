/**
 * Arena depth/perspective layout — real computeArenaLayout from combat.js
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SCRATCH = process.env.GOAL_SCRATCH ||
  '/var/folders/fw/0_cfyf5s2mb1c50p8jn_z_nw0000gq/T/grok-goal-8eaaebc09efb/implementer';

function assert(c, m) {
  if (!c) throw new Error(m || 'assert failed');
}

const lines = [];
function log(s) { lines.push(s); console.log(s); }

const DATA = require(path.join(ROOT, 'src/data/gameData.js'));
global.SR_DATA = DATA;
const C = require(path.join(ROOT, 'src/systems/combat.js'));

log('=== arena-depth.test.js ===');

const layout = C.computeArenaLayout(4, 3, 960, 540);
assert(layout.allies.length === 4, '4 ally slots');
assert(layout.foes.length === 3, '3 foe slots');

// Allies nearer (higher y) than foes (Raid camera: party front-left, enemies back-right)
const avgAllyY = layout.allies.reduce((s, p) => s + p.y, 0) / layout.allies.length;
const avgFoeY = layout.foes.reduce((s, p) => s + p.y, 0) / layout.foes.length;
assert(avgAllyY > avgFoeY, 'allies nearer (higher y) than foes: ' + avgAllyY + ' > ' + avgFoeY);

// Allies larger scale (near), foes smaller (far)
const avgAllyS = layout.allies.reduce((s, p) => s + p.scale, 0) / layout.allies.length;
const avgFoeS = layout.foes.reduce((s, p) => s + p.scale, 0) / layout.foes.length;
assert(avgAllyS > avgFoeS, 'allies larger scale: ' + avgAllyS + ' > ' + avgFoeS);

// Depth ordering: allies higher depth (drawn on top / in front)
const maxFoeD = Math.max.apply(null, layout.foes.map((p) => p.depth));
const minAllyD = Math.min.apply(null, layout.allies.map((p) => p.depth));
assert(minAllyD > maxFoeD, 'ally depth > foe depth (near vs far)');

// Foes generally more to the right
const avgAllyX = layout.allies.reduce((s, p) => s + p.x, 0) / layout.allies.length;
const avgFoeX = layout.foes.reduce((s, p) => s + p.x, 0) / layout.foes.length;
assert(avgFoeX > avgAllyX, 'foes further right (Raid side camera)');

assert(layout.vanishingY < layout.floorY, 'vanishing point above floor');

// BattleScene places with depth
const battleSrc = fs.readFileSync(path.join(ROOT, 'src/scenes/BattleScene.js'), 'utf8');
assert(/computeArenaLayout/.test(battleSrc), 'BattleScene uses layout');
assert(/setDepth|depth:/.test(battleSrc), 'BattleScene sets depth');
assert(/near|scale/.test(battleSrc), 'scale/near used for perspective');

log('PASS depth layout allies near / foes far');
log('avgAllyY=' + avgAllyY.toFixed(1) + ' avgFoeY=' + avgFoeY.toFixed(1));
log('avgAllyS=' + avgAllyS.toFixed(2) + ' avgFoeS=' + avgFoeS.toFixed(2));
log('ALL ARENA DEPTH TESTS PASSED');

fs.mkdirSync(SCRATCH, { recursive: true });
fs.writeFileSync(path.join(SCRATCH, 'arena-depth.log'), lines.join('\n') + '\n');
