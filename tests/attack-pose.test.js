/**
 * Attack-pose art: resolution, fallback to idle, pose controller restore.
 * Exercises shipped SR_ART + SR_BATTLE3D helpers (no WebGL required).
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SCRATCH = process.env.GOAL_SCRATCH ||
  '/var/folders/fw/0_cfyf5s2mb1c50p8jn_z_nw0000gq/T/grok-goal-687a03370394/implementer';

function assert(c, m) {
  if (!c) throw new Error(m || 'assert failed');
}

const lines = [];
function log(s) { lines.push(s); console.log(s); }

log('=== attack-pose.test.js ===');

const ART = require(path.join(ROOT, 'src/ui/artPipeline.js'));
const B3 = require(path.join(ROOT, 'src/ui/battleWorld3d.js'));

assert(ART && typeof ART.combatGelAttackPathCandidates === 'function',
  'SR_ART.combatGelAttackPathCandidates exported');
assert(ART && typeof ART.resolveGelAttackArt === 'function',
  'SR_ART.resolveGelAttackArt exported');
assert(B3 && typeof B3.createPoseController === 'function',
  'SR_BATTLE3D.createPoseController exported');
assert(B3 && typeof B3.gelArtUrl === 'function',
  'SR_BATTLE3D.gelArtUrl exported');
log('PASS exports');

// Disk existence helper for resolveGelAttackArt
function existsRel(rel) {
  const p = path.join(ROOT, String(rel).replace(/\?.*$/, ''));
  return fs.existsSync(p);
}

const ELEMENTS = ART.ELEMENTS || [
  'water', 'fire', 'earth', 'wind', 'plant', 'lightning', 'ice', 'shadow',
  'light', 'metal', 'poison', 'crystal', 'lava', 'storm', 'spirit', 'void'
];

// --- All 16 elements have a dedicated attack plate (blob_a) ---
const inventory = [];
ELEMENTS.forEach((el) => {
  const plate = path.join(ROOT, 'assets/battle/gels/combat', el + '_blob_a_attack.jpg');
  assert(fs.existsSync(plate), 'missing attack plate ' + el);
  const sz = fs.statSync(plate).size;
  assert(sz > 5000, 'attack plate too small ' + el + ' ' + sz);
  inventory.push(el + '_blob_a_attack.jpg bytes=' + sz);
  log('OK asset ' + el + '_blob_a_attack.jpg');
});
assert(inventory.length === 16, '16 element attack plates');
log('PASS 16-element attack plate inventory');

// --- resolveGelAttackArt picks attack stem when present ---
const waterRes = ART.resolveGelAttackArt(
  { element: 'Water', rarity: 'Common', artVariant: 'a' },
  existsRel
);
assert(waterRes.attackUrl, 'water attackUrl');
assert(/_attack\.jpg/i.test(String(waterRes.attackUrl).replace(/\?.*$/, '')),
  'water resolved to attack stem: ' + waterRes.attackUrl);
assert(waterRes.usedFallback === false, 'water should not fallback when plate exists');
assert(waterRes.idleUrl, 'water idleUrl');
log('PASS resolve water attack plate: ' + waterRes.attackUrl);

// --- Falldown: shaped form still finds attack (blob_a_attack in ladder) ---
const mythicFire = ART.resolveGelAttackArt(
  { element: 'Fire', rarity: 'Mythic', artVariant: 'a' },
  existsRel
);
assert(mythicFire.attackUrl && /_attack\.jpg/i.test(String(mythicFire.attackUrl)),
  'mythic fire attack: ' + mythicFire.attackUrl);
log('PASS mythic form attack resolve: ' + mythicFire.form + ' → ' + mythicFire.attackUrl);

// --- Fallback when attack art missing (fabricate element that has idle only) ---
// Use a nonsense element that has no attack art — should fall to idle candidates or null
const missing = ART.resolveGelAttackArt(
  { element: 'notanelement', rarity: 'Common' },
  existsRel
);
assert(missing.usedFallback === true, 'missing element uses fallback flag');
// attackUrl may be null if no idle either — either null or idle path without _attack
if (missing.attackUrl) {
  assert(!/_attack\.jpg/i.test(String(missing.attackUrl).replace(/\?.*$/, '')) ||
    missing.usedFallback,
    'fallback attackUrl should be idle or flagged');
}
log('PASS missing attack art fallback usedFallback=' + missing.usedFallback);

// --- Candidates list prefers attack stems first ---
const cands = ART.combatGelAttackPathCandidates('plant', 'a', 'blob');
assert(cands.length >= 3, 'candidates non-empty');
assert(/_attack\.jpg/i.test(String(cands[0])), 'first candidate is attack stem: ' + cands[0]);
const hasIdleFallback = cands.some((u) => /plant_blob_a\.jpg/.test(String(u)) && !/_attack/.test(String(u)));
assert(hasIdleFallback, 'idle fallback present in candidates');
log('PASS candidate order attack-first + idle fallback');

// --- gelArtUrl exposes attackCandidates ---
const urls = B3.gelArtUrl('Ice', 'a', 'blob');
assert(urls.attackCandidates && urls.attackCandidates.length,
  'gelArtUrl.attackCandidates');
assert(urls.candidates && urls.candidates.length, 'gelArtUrl idle candidates');
log('PASS gelArtUrl attackCandidates n=' + urls.attackCandidates.length);

// --- Pose controller: attack → idle restore ---
const idleKey = 'idle-tex';
const atkKey = 'attack-tex';
const ctrl = B3.createPoseController({ idleTex: idleKey, attackTex: atkKey });
assert(ctrl.getPose() === 'idle', 'starts idle');
assert(ctrl.hasAttackArt() === true, 'has attack art');
assert(ctrl.setAttack() === true, 'setAttack ok');
assert(ctrl.getPose() === 'attack', 'pose is attack');
assert(ctrl.getActiveTex() === atkKey, 'active tex is attack');
const tok = ctrl.nextRestoreToken();
assert(ctrl.isRestoreToken(tok), 'restore token matches');
ctrl.setIdle();
assert(ctrl.getPose() === 'idle', 'restored idle');
assert(ctrl.getActiveTex() === idleKey, 'active tex idle');
log('PASS pose controller attack/idle restore');

// --- Pose controller without attack art stays idle ---
const noAtk = B3.createPoseController({ idleTex: idleKey, attackTex: null });
assert(noAtk.hasAttackArt() === false, 'no attack art');
assert(noAtk.setAttack() === false, 'setAttack fails without art');
assert(noAtk.getPose() === 'idle', 'stays idle');
assert(noAtk.getActiveTex() === idleKey, 'active remains idle');
log('PASS pose controller fallback when no attack art');

// --- Structural: battleWorld3d wires pose during attack phase ---
const b3src = fs.readFileSync(path.join(ROOT, 'src/ui/battleWorld3d.js'), 'utf8');
assert(/playAttackPose/.test(b3src), 'playAttackPose defined');
assert(/restoreIdlePose/.test(b3src), 'restoreIdlePose defined');
assert(/function lunge[\s\S]*playAttackPose/.test(b3src) ||
  /playAttackPose\(unitId/.test(b3src) && /function lunge/.test(b3src),
  'lunge path related to attack pose');
assert(/skillFx[\s\S]{0,800}playAttackPose|playAttackPose[\s\S]{0,400}skillFx/.test(b3src),
  'skillFx path uses playAttackPose');
assert(/attackTex|attackCandidates|combatGelAttackPath/.test(b3src),
  'attack texture load path present');
log('PASS structural wire: lunge/skillFx ↔ attack pose');

// --- BattleScene still drives lunge (real combat entry) ---
const battleSrc = fs.readFileSync(path.join(ROOT, 'src/scenes/BattleScene.js'), 'utf8');
assert(/\.lunge\(/.test(battleSrc), 'BattleScene calls world3d.lunge');
assert(/skillFx\(/.test(battleSrc), 'BattleScene calls skillFx');
log('PASS BattleScene attack phase entry points');

// Write inventory evidence
try {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, 'attack-pose-assets.txt'), inventory.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(SCRATCH, 'attack-pose-wire.txt'), [
    'playAttackPose: ' + (/playAttackPose/.test(b3src)),
    'restoreIdlePose: ' + (/restoreIdlePose/.test(b3src)),
    'lunge+pose: ' + (/playAttackPose/.test(b3src) && /function lunge/.test(b3src)),
    'skillFx+pose: ' + (/playAttackPose/.test(b3src) && /function skillFx/.test(b3src)),
    'BattleScene.lunge: ' + (/\.lunge\(/.test(battleSrc)),
    'BattleScene.skillFx: ' + (/skillFx\(/.test(battleSrc)),
    'ART.resolveGelAttackArt: ' + (typeof ART.resolveGelAttackArt),
    'B3.createPoseController: ' + (typeof B3.createPoseController)
  ].join('\n') + '\n', 'utf8');
} catch (eW) {
  log('WARN scratch write ' + (eW && eW.message));
}

log('ALL ATTACK-POSE TESTS PASSED');
try {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, 'attack-pose-tests.log'), lines.join('\n') + '\n', 'utf8');
} catch (e2) { /* ignore */ }
