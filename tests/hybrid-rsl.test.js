/**
 * Option 1 hybrid RSL bar — unit tests against shipped pure helpers.
 * Drives real SR_BATTLE3D / SR_SLIME3D exports (no reimplementation).
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

function assert(c, m) {
  if (!c) throw new Error(m || 'assert failed');
}

console.log('=== hybrid-rsl.test.js ===');

// —— Load shipped battleWorld3d (pure helpers, no WebGL needed) ——
const B3 = require(path.join(ROOT, 'src/ui/battleWorld3d.js'));
assert(B3 && B3.computeLaneSlot, 'computeLaneSlot exported');
assert(B3.resolveBattleQuality, 'resolveBattleQuality exported');
assert(B3.deathPathForFlags, 'deathPathForFlags exported');
assert(B3.unitIsSolidEnemy, 'unitIsSolidEnemy exported');

// Lane: allies and foes on opposite sides of BL→TR path
const a0 = B3.computeLaneSlot('ally', 0, 4);
const a3 = B3.computeLaneSlot('ally', 3, 4);
const f0 = B3.computeLaneSlot('foe', 0, 3);
const f2 = B3.computeLaneSlot('foe', 2, 3);
assert(a0.sideSign === -1 && f0.sideSign === 1, 'allies left / foes right of lane');
assert(a0.t < a3.t, 'ally index increases along lane t (BL→TR)');
assert(f0.t < f2.t, 'foe index increases along lane t');
// Parallel lines: same-ish t band, different side signs
assert(Math.abs(a0.sideSign - f0.sideSign) === 2, 'opposite sides');
// Face opposite directions across path
assert(Math.abs(a0.faceY - f0.faceY) > 0.5, 'face across lane (yaw differs)');
console.log('PASS lane formation BL→TR parallel lines', {
  a0: { t: a0.t.toFixed(2), x: a0.x.toFixed(2), z: a0.z.toFixed(2) },
  f0: { t: f0.t.toFixed(2), x: f0.x.toFixed(2), z: f0.z.toFixed(2) }
});

// Death paths: solid enemies ≠ gel melt
assert(B3.unitIsSolidEnemy({ isEnemy: true, enemyKind: 'golem' }) === true, 'golem is solid');
assert(B3.unitIsSolidEnemy({ isEnemy: true, enemyKind: 'slime' }) === false, 'slime kind not solid');
assert(B3.unitIsSolidEnemy({ element: 'Fire', isFoe: false }) === false, 'ally gel not solid');
assert(B3.deathPathForFlags({ solidEnemy: true }) === 'solid', 'solid death path');
assert(B3.deathPathForFlags({ gelImpostor: true }) === 'gelMelt', 'gel plate melt path');
assert(B3.deathPathForFlags({ isImpostor: true, solidEnemy: false }) === 'gelMelt', 'impostor gel melt');
assert(B3.deathPathForFlags({}) === 'melt', 'mesh melt default');
assert(
  B3.deathPathForFlags({ solidEnemy: true }) !== B3.deathPathForFlags({ gelImpostor: true }),
  'solid vs gel death are different functions/outcomes'
);
console.log('PASS death path branching solid vs melt');

// Quality tiers: low vs high differ on richer options
const qLow = B3.resolveBattleQuality({ quality: 'low', width: 1920, dpr: 2 });
const qHigh = B3.resolveBattleQuality({ quality: 'high', width: 1920, dpr: 2 });
const qStored = B3.resolveBattleQuality({
  getStoredQuality: () => 'med',
  width: 800,
  dpr: 1
});
assert(qLow.id === 'low' && qHigh.id === 'high', 'explicit quality ids');
assert(qLow.shadows === false && qHigh.shadows === true, 'high enables shadows');
assert(qLow.bloom === false && qHigh.bloom === true, 'high enables bloom');
assert(qHigh.exposure > qLow.exposure, 'high has higher exposure');
assert(qHigh.motes > qLow.motes, 'high denser motes/FX budget');
assert(qStored.id === 'med', 'stored quality via getter');
console.log('PASS quality low vs high differ', { low: qLow, high: qHigh.exposure });

// Structural: live battle prefers SR_BATTLE3D when available
const battleSrc = fs.readFileSync(path.join(ROOT, 'src/scenes/BattleScene.js'), 'utf8');
assert(/SR_BATTLE3D\.create/.test(battleSrc), 'BattleScene creates live 3D world');
assert(/useBlit|battle_world_3d|registerTexture|mount/.test(battleSrc), 'blit/texture path wired');
assert(/live3d/.test(battleSrc), 'live3d flag');

const detailSrc = fs.readFileSync(path.join(ROOT, 'src/scenes/ChampionDetailScene.js'), 'utf8');
assert(/addSlimePortrait|Combat form|Champion Stage/.test(detailSrc), 'champion detail uses combat sprite stage');
assert(fs.existsSync(path.join(ROOT, 'src/ui/artPipeline.js')), 'artPipeline.js present');
const artPipe = fs.readFileSync(path.join(ROOT, 'src/ui/artPipeline.js'), 'utf8');
assert(/registerPhaserCombatGels|combatGelPath|magentaChromaToCanvas|artVariantForUnit/.test(artPipe),
  'combat sprite register + variant API');
// Per-champion pose variants on disk
assert(fs.existsSync(path.join(ROOT, 'assets/battle/gels/combat/water_a.jpg')), 'water_a');
assert(fs.existsSync(path.join(ROOT, 'assets/battle/gels/combat/water_b.jpg')), 'water_b');
assert(fs.existsSync(path.join(ROOT, 'assets/battle/gels/combat/fire_c.jpg')), 'fire_c');
const gs = fs.readFileSync(path.join(ROOT, 'src/systems/gameState.js'), 'utf8');
assert(/artVariant/.test(gs), 'champions store artVariant');
// Arena env plates + enemies exist
['greenwild','crystal','shadowfen','volcanic','celestial','dungeon'].forEach(function (z) {
  assert(fs.existsSync(path.join(ROOT, 'assets/battle/env/' + z + '/ground.jpg')), z + ' ground');
  assert(fs.existsSync(path.join(ROOT, 'assets/battle/env/' + z + '/sky.jpg')), z + ' sky');
  assert(fs.existsSync(path.join(ROOT, 'assets/battle/env/' + z + '/prop.jpg')), z + ' prop');
});
['beast','golem','humanoid','dragon','undead','plant','insect','elemental'].forEach(function (k) {
  assert(fs.existsSync(path.join(ROOT, 'assets/battle/enemies/' + k + '.jpg')), 'enemy ' + k);
});
// Optional 3D showcase kept on disk for later; product path is sprites
assert(fs.existsSync(path.join(ROOT, 'src/ui/championShowcase3d.js')), 'championShowcase3d.js present (optional)');
const battleHud = fs.readFileSync(path.join(ROOT, 'src/scenes/BattleScene.js'), 'utf8');
assert(/hpText|turnRing|plateW|skill tray|CD /.test(battleHud) || /hpText|turnRing|plate/.test(battleHud),
  'R1 combat HUD nameplates/turn/skills');

const b3src = fs.readFileSync(path.join(ROOT, 'src/ui/battleWorld3d.js'), 'utf8');
assert(/useBlit:\s*true|blitToPhaserCanvas/.test(b3src), 'blit presentation');
assert(/meltDeath|solidDeath/.test(b3src), 'both death implementations');
assert(/createComplexGroundedGel|grounded:\s*!hovers|footL/.test(b3src), 'R3 complex grounded gels');
assert(/wet skirt|skirt|footL/.test(b3src), 'R3 feet/skirt on floor');

// R7–R8 structural
const summonSrc = fs.readFileSync(path.join(ROOT, 'src/scenes/SummonScene.js'), 'utf8');
assert(/_playCirclePulse|Rising light pillar|mode:\s*['"]3d['"]/.test(summonSrc), 'R7 summon theater');
const hubSrc = fs.readFileSync(path.join(ROOT, 'src/scenes/HubScene.js'), 'utf8');
const chromeSrc = fs.readFileSync(path.join(ROOT, 'src/ui/sceneChrome.js'), 'utf8');
assert(
  /sr_battle_quality|GFX ·/.test(hubSrc) || /sr_battle_quality|GFX ·/.test(chromeSrc),
  'R8 quality toggle on hub'
);
const battleEnd = fs.readFileSync(path.join(ROOT, 'src/scenes/BattleScene.js'), 'utf8');
assert(/VICTORY|confetti|Back\.easeOut/.test(battleEnd), 'R7 victory splash polish');
assert(/turnStrip|_refreshTurnStrip|cameraPunch/.test(battleEnd), 'turn strip + camera punch wiring');
assert(/makeSkillProjectileMesh/.test(b3src), 'per-element skill projectiles');
assert(/castWindup|skillFxDeliver/.test(b3src), 'R5+ cast windup telegraph');
assert(/turnRing/.test(b3src), 'R5+ active-turn ground ring');
assert(/createComplexGroundedGel|rarityAura|sheen/.test(b3src), 'R3+ sheen / rarity aura');
assert(/dressGelWithArt|combatSprite|gels\/combat/.test(b3src), 'combat full-body gel art dress');
assert(/Hide ALL mesh body|gelImpostor\s*=\s*true|forceGlbOnly/.test(b3src),
  'combat sprite does not stack GLB blobs');
assert(fs.existsSync(path.join(ROOT, 'assets/battle/gels/combat/fire.jpg')), 'combat gel art pack fire');
assert(fs.existsSync(path.join(ROOT, 'assets/battle/gels/combat/water.jpg')), 'combat gel art pack water');
assert(fs.existsSync(path.join(ROOT, 'assets/battle/enemies/beast.jpg')), 'enemy impostor art pack');
assert(fs.existsSync(path.join(ROOT, 'docs/ART_PIPELINE.md')), 'art pipeline docs');
// Full 16-element combat pack
['fire','water','earth','plant','lightning','ice','shadow','wind',
 'light','metal','poison','crystal','lava','storm','spirit','void'].forEach(function (el) {
  assert(fs.existsSync(path.join(ROOT, 'assets/battle/gels/combat/' + el + '.jpg')),
    'combat gel ' + el);
});
// Blender multi-part gel pack present for HIGH GFX
assert(fs.existsSync(path.join(ROOT, 'assets/models/gel/gel_fire.glb')), 'gel_fire.glb Blender pack');
assert(fs.existsSync(path.join(ROOT, 'assets/models/enemy/enemy_dragon.glb')), 'enemy_dragon.glb pack');
assert(fs.existsSync(path.join(ROOT, 'scripts/blender_export_all_gels.py')), 'blender export script');

// Slime3D spin API (real module)
const S3 = require(path.join(ROOT, 'src/ui/slime3d.js'));
assert(S3.addSpinYaw && S3.setSpinYaw && S3.clearSpinYaw && S3.getSpinYaw, 'spin API complete');
S3.clearSpinYaw(null);
S3.setSpinYaw('Fire', 0.5);
assert(Math.abs(S3.getSpinYaw('Fire') - 0.5) < 1e-9, 'setSpinYaw stores yaw');
const after = S3.addSpinYaw('Fire', 0.25);
assert(Math.abs(after - 0.75) < 1e-9, 'addSpinYaw accumulates');
S3.clearSpinYaw('Fire');
assert(S3.getSpinYaw('Fire') == null, 'clearSpinYaw clears');
console.log('PASS slime3d spin yaw API');

console.log('ALL HYBRID RSL TESTS PASSED');
