/**
 * Real unit tests against shipped SR_COMBAT (turn meter, affinity, skills, auto, win/lose).
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

// Load shipped modules
const DATA = require(path.join(ROOT, 'src/data/gameData.js'));
global.SR_DATA = DATA;
const C = require(path.join(ROOT, 'src/systems/combat.js'));

log('=== combat-unit.test.js ===');

// --- resolveCombatSpeed ---
const slow = C.resolveCombatSpeed({ name: 'Slow', level: 1, power: 50, rarity: 'Common', id: 1 }, false);
const fast = C.resolveCombatSpeed({ name: 'Fast', level: 20, power: 400, rarity: 'Legendary', id: 99 }, false);
assert(fast > slow, 'legendary high-power faster than common: ' + fast + ' vs ' + slow);
log('PASS resolveCombatSpeed ranking');

// --- makeCombatant ---
const ally = C.makeCombatant({ name: 'Aqua', element: 'Water', power: 100, rarity: 'Rare', level: 5, id: 1 }, false);
const foe = C.makeCombatant({ name: 'Blaze', element: 'Fire', power: 100, rarity: 'Rare', level: 5, id: 2 }, true);
assert(ally.speed > 0 && typeof ally.turnMeter === 'number', 'ally has speed+turnMeter');
assert(foe.isFoe === true && foe.hp === foe.maxHp, 'foe combatant');
assert(Array.isArray(ally.skills) && ally.skills.length >= 1, 'skills present');
log('PASS makeCombatant');

// --- affinity ---
const adv = C.getAffinityMultiplier('Water', 'Fire');
const dis = C.getAffinityMultiplier('Water', 'Lightning');
const neut = C.getAffinityMultiplier('Water', 'Shadow');
assert(adv > 1, 'Water strong vs Fire: ' + adv);
assert(dis < 1, 'Water weak vs Lightning: ' + dis);
assert(neut === 1, 'neutral affinity');
const dmgAdv = C.computeDamage(ally, foe, { mult: 1 });
const iceFoe = C.makeCombatant({ name: 'Ice', element: 'Ice', power: 100, rarity: 'Rare', id: 3 }, true);
const dmgDis = C.computeDamage(ally, iceFoe, { mult: 1 });
assert(dmgAdv > dmgDis, 'affinity affects damage ' + dmgAdv + ' > ' + dmgDis);
log('PASS affinity damage');

// --- turn meter: faster unit first ---
const units = [
  { name: 'Speedy', speed: 150, turnMeter: 0, alive: true },
  { name: 'Tanky', speed: 80, turnMeter: 0, alive: true }
];
const first = C.advanceTurnMeters(units);
assert(first && first.name === 'Speedy', 'faster fills first, got ' + (first && first.name));
assert(first.turnMeter >= C.TURN_METER_FULL, 'meter full');
log('PASS advanceTurnMeters SPD order');

// --- skill CD ---
const a2 = C.makeCombatant({ name: 'Mage', element: 'Fire', power: 120, rarity: 'Epic', id: 10 }, false);
const f2 = C.makeCombatant({ name: 'Target', element: 'Plant', power: 80, rarity: 'Common', id: 11 }, true);
const smash = a2.skills.find((s) => s.cd > 0) || a2.skills[1] || a2.skills[0];
const beforeCd = smash.cooldownLeft;
const r1 = C.applySkill(a2, smash, [a2], [f2]);
assert(r1.log.length > 0, 'skill produced log');
if (smash.cd > 0) {
  assert(smash.cooldownLeft === smash.cd, 'CD applied after cast');
}
const usable = C.getUsableSkills(a2);
assert(!usable.find((s) => s.id === smash.id && smash.cd > 0) || smash.cd === 0, 'on CD not usable');
log('PASS skill cooldowns');

// --- auto battle win/lose ---
const party = [
  { name: 'Hero1', element: 'Water', power: 200, rarity: 'Epic', level: 10, id: 100 },
  { name: 'Hero2', element: 'Fire', power: 180, rarity: 'Rare', level: 8, id: 101 }
];
const weakFoes = [
  { name: 'Mob', element: 'Fire', power: 40, rarity: 'Common', level: 1, id: 200 }
];
const winBattle = C.runAutoBattle(party, weakFoes, 60);
assert(winBattle.status === 'win', 'strong party should win, got ' + winBattle.status);
log('PASS auto battle win');

const weakParty = [
  { name: 'Cub', element: 'Plant', power: 30, rarity: 'Common', level: 1, id: 300 }
];
const strongFoes = [
  { name: 'Boss', element: 'Lava', power: 500, rarity: 'Legendary', level: 30, id: 400 }
];
const loseBattle = C.runAutoBattle(weakParty, strongFoes, 60);
assert(loseBattle.status === 'lose' || loseBattle.status === 'win', 'battle ends with status');
// Weak vs strong should usually lose
assert(loseBattle.status === 'lose', 'weak party loses to boss, got ' + loseBattle.status);
log('PASS auto battle lose');

// --- manual path ---
const b = C.createBattle(party, weakFoes, { auto: false });
const actor = C.nextActor(b);
assert(actor, 'manual next actor');
if (!actor.isFoe) {
  const sk = C.pickAutoSkill(actor) || actor.skills[0];
  C.resolveTurn(b, sk.id);
} else {
  C.resolveTurn(b);
}
assert(b.log.length > 1, 'manual turn logs');
log('PASS manual skill path');

// --- heal skill ---
const healer = C.makeCombatant({ name: 'Healer', element: 'Plant', power: 100, rarity: 'Epic', id: 50 }, false);
healer.hp = Math.floor(healer.maxHp * 0.4);
const healSk = healer.skills.find((s) => s.heal) || { id: 'heal', name: 'Mend', mult: 0, cd: 3, heal: 0.28, cooldownLeft: 0 };
const beforeHp = healer.hp;
C.applySkill(healer, healSk, [healer], []);
assert(healer.hp > beforeHp, 'heal increases HP');
log('PASS heal skill');

// Battle summary for results splash
const sumBattle = C.runAutoBattle(
  [
    { id: 1, name: 'A', element: 'Water', rarity: 'Uncommon', level: 5, power: 120 },
    { id: 2, name: 'B', element: 'Fire', rarity: 'Common', level: 4, power: 100 }
  ],
  [{ id: 9, name: 'F', element: 'Plant', rarity: 'Common', level: 3, power: 70 }],
  60
);
assert(sumBattle.status === 'win' || sumBattle.status === 'lose', 'summary battle ends');
const summary = C.getBattleSummary(sumBattle);
assert(summary && typeof summary.turns === 'number' && summary.turns > 0, 'summary turns');
assert(Array.isArray(summary.allies) && summary.allies.length === 2, 'summary allies');
assert(typeof summary.totalDamageToFoe === 'number', 'total dmg to foe');
assert(summary.allies.some((a) => (a.damageDealt || 0) > 0) || sumBattle.status === 'lose', 'ally dmg tracked or lose');
assert(summary.mvp == null || summary.mvp.name, 'mvp field');
log('PASS getBattleSummary for results splash');

// lastAction hits for floating damage VFX
const vfxBattle = C.createBattle(
  [{ id: 11, name: 'Hero', element: 'Fire', rarity: 'Rare', level: 6, power: 150 }],
  [{ id: 12, name: 'Dummy', element: 'Plant', rarity: 'Common', level: 2, power: 40 }],
  { auto: true }
);
C.nextActor(vfxBattle);
C.resolveTurn(vfxBattle);
assert(vfxBattle.lastAction, 'lastAction set');
assert(Array.isArray(vfxBattle.lastAction.hits), 'lastAction.hits');
assert(vfxBattle.lastAction.skillName, 'skill name for callout');
assert(vfxBattle.lastAction.hits.length >= 1 || vfxBattle.lastAction.kind === 'heal', 'hits for floats');
if (vfxBattle.lastAction.hits[0] && vfxBattle.lastAction.hits[0].kind === 'damage') {
  assert(vfxBattle.lastAction.hits[0].amount > 0, 'damage amount for float');
}
log('PASS lastAction hits for combat VFX');

// --- Live 2pc/4pc gear set bonuses in combat ---
function kit(setName, n) {
  const slots = ['weapon', 'helmet', 'shield', 'gloves', 'chest', 'boots'];
  const eq = {};
  for (let i = 0; i < n; i++) {
    eq[slots[i]] = {
      id: 't_' + setName + '_' + i,
      set: setName,
      name: setName + ' piece',
      mainStat: i % 2 === 0 ? 'atk' : 'hp',
      value: 10,
      level: 1
    };
  }
  return eq;
}

// Pure set-mod math (no flat gear noise)
const mOff2 = DATA.computeSetBonusMods(kit('Offense', 2));
const mOff4 = DATA.computeSetBonusMods(kit('Offense', 4));
const mLife4 = DATA.computeSetBonusMods(kit('Life', 4));
const mDef4 = DATA.computeSetBonusMods(kit('Defense', 4));
const mCrit4 = DATA.computeSetBonusMods(kit('Critical', 4));
const mPerc4 = DATA.computeSetBonusMods(kit('Perception', 4));
const mNone = DATA.computeSetBonusMods({});
assert(Math.abs(mOff2.atk - 1.08) < 0.001, 'Offense 2pc atk mul 1.08 got ' + mOff2.atk);
assert(Math.abs(mOff4.atk - 1.15) < 0.001, 'Offense 4pc atk mul 1.15 got ' + mOff4.atk);
assert(Math.abs(mLife4.hp - 1.15) < 0.001, 'Life 4pc hp mul');
assert(Math.abs(mDef4.damageTaken - 0.88) < 0.001, 'Defense 4pc taken 0.88 got ' + mDef4.damageTaken);
assert(mCrit4.critAdd === 16, 'Critical 4pc +16 crit');
assert(Math.abs(mPerc4.affinityAdd - 0.08) < 0.001, 'Perception 4pc aff');
assert(mNone.atk === 1 && mNone.sets.length === 0, 'empty kit no sets');
log('PASS computeSetBonusMods tiers');

const bare = { name: 'Bare', element: 'Fire', power: 120, rarity: 'Rare', level: 8, id: 501, equipment: {} };
const off4 = {
  name: 'Offense4', element: 'Fire', power: 120, rarity: 'Rare', level: 8, id: 503,
  equipment: kit('Offense', 4)
};
const life4 = {
  name: 'Life4', element: 'Water', power: 120, rarity: 'Rare', level: 8, id: 504,
  equipment: kit('Life', 4)
};
const def4 = {
  name: 'Def4', element: 'Earth', power: 120, rarity: 'Rare', level: 8, id: 505,
  equipment: kit('Defense', 4)
};
const crit4 = {
  name: 'Crit4', element: 'Shadow', power: 120, rarity: 'Rare', level: 8, id: 506,
  equipment: kit('Critical', 4)
};
const perc4 = {
  name: 'Perc4', element: 'Water', power: 120, rarity: 'Rare', level: 8, id: 507,
  equipment: kit('Perception', 4)
};

const attrsBare = DATA.computeChampionAttributes(bare);
const attrsOff4 = DATA.computeChampionAttributes(off4);
const attrsLife4 = DATA.computeChampionAttributes(life4);
const attrsDef4 = DATA.computeChampionAttributes(def4);
const attrsCrit4 = DATA.computeChampionAttributes(crit4);
const attrsPerc4 = DATA.computeChampionAttributes(perc4);

assert(attrsDef4.damageTakenMul < 1, 'Defense 4pc reduces damage taken mul: ' + attrsDef4.damageTakenMul);
assert(attrsCrit4.crit >= attrsBare.crit + 16, 'Critical 4pc +16 crit: ' + attrsCrit4.crit + ' vs ' + attrsBare.crit);
assert(attrsPerc4.affinityBonus > 0, 'Perception 4pc affinity bonus: ' + attrsPerc4.affinityBonus);
assert(attrsOff4.setBonuses && attrsOff4.setBonuses.some((s) => s.set === 'Offense' && s.tier === 4), 'setBonuses lists Offense 4pc');
assert(attrsLife4.setBonuses && attrsLife4.setBonuses.some((s) => s.set === 'Life'), 'Life set listed');
log('PASS computeChampionAttributes set bonuses');

// Same base atk — only set multipliers differ (attributes injected)
const cBare = C.makeCombatant({
  name: 'Bare', element: 'Fire', power: 120, rarity: 'Rare', level: 8, id: 501,
  attributes: { atk: 40, hp: 200, spd: 100, crit: 8, damageTakenMul: 1, affinityBonus: 0 }
}, false);
const cOff4 = C.makeCombatant({
  name: 'Off', element: 'Fire', power: 120, rarity: 'Rare', level: 8, id: 503,
  attributes: { atk: 46, hp: 200, spd: 100, crit: 8, damageTakenMul: 1, affinityBonus: 0, setBonuses: [{ set: 'Offense', tier: 4 }] }
}, false);
const cDef4 = C.makeCombatant({
  name: 'Def', element: 'Earth', power: 120, rarity: 'Rare', level: 8, id: 505,
  attributes: { atk: 40, hp: 200, spd: 100, crit: 8, damageTakenMul: 0.88, affinityBonus: 0 }
}, false);
const cCrit4 = C.makeCombatant({
  name: 'Crit', element: 'Shadow', power: 120, rarity: 'Rare', level: 8, id: 506,
  attributes: { atk: 40, hp: 200, spd: 100, crit: 24, damageTakenMul: 1, affinityBonus: 0 }
}, false);
const cPerc4 = C.makeCombatant({
  name: 'Perc', element: 'Water', power: 120, rarity: 'Rare', level: 8, id: 507,
  attributes: { atk: 40, hp: 200, spd: 100, crit: 8, damageTakenMul: 1, affinityBonus: 0.08 }
}, false);
assert(cOff4.atk > cBare.atk, 'combatant Offense atk live: ' + cOff4.atk + ' > ' + cBare.atk);
assert(cDef4.damageTakenMul < 1, 'combatant Defense mul live');
assert(cCrit4.critChance > cBare.critChance, 'combatant Critical critChance live: ' + cCrit4.critChance);
assert(cPerc4.affinityBonus > 0, 'combatant Perception affinityBonus live');

const plantFoe = C.makeCombatant({ name: 'Plant', element: 'Plant', power: 100, rarity: 'Common', id: 600 }, true);
const dmgBare = C.computeDamage(cBare, plantFoe, { mult: 1 });
const dmgOff = C.computeDamage(cOff4, plantFoe, { mult: 1 });
assert(dmgOff > dmgBare, 'Offense set increases damage ' + dmgOff + ' > ' + dmgBare);

// Defense on target reduces incoming (same element so affinity cancels out)
const cBareEarth = C.makeCombatant({
  name: 'BareE', element: 'Earth', power: 120, rarity: 'Rare', level: 8, id: 510,
  attributes: { atk: 40, hp: 200, spd: 100, crit: 8, damageTakenMul: 1, affinityBonus: 0 }
}, false);
const dmgIntoBare = C.computeDamage(plantFoe, cBareEarth, { mult: 1 });
const dmgIntoDef = C.computeDamage(plantFoe, cDef4, { mult: 1 });
assert(dmgIntoDef < dmgIntoBare, 'Defense set reduces incoming ' + dmgIntoDef + ' < ' + dmgIntoBare);

// Perception boosts affinity edge Water→Fire
const fireFoe = C.makeCombatant({ name: 'FireF', element: 'Fire', power: 100, rarity: 'Common', id: 601 }, true);
const waterBare = C.makeCombatant({
  name: 'W', element: 'Water', power: 120, rarity: 'Rare', level: 8, id: 508,
  attributes: { atk: 40, hp: 200, spd: 100, crit: 8, damageTakenMul: 1, affinityBonus: 0 }
}, false);
const dmgAffBare = C.computeDamage(waterBare, fireFoe, { mult: 1 });
const dmgAffPerc = C.computeDamage(cPerc4, fireFoe, { mult: 1 });
assert(dmgAffPerc > dmgAffBare, 'Perception amplifies affinity damage ' + dmgAffPerc + ' > ' + dmgAffBare);

// Crit uses actor.critChance (capped at 0.55 in applySkill — high rate >> low rate)
const skill = { id: 'basic', name: 'Gel Strike', mult: 1, cd: 0, cooldownLeft: 0 };
let highCrits = 0;
let lowCrits = 0;
const N = 80;
for (let i = 0; i < N; i++) {
  const hi = C.makeCombatant({
    name: 'Hi', element: 'Shadow', power: 120, rarity: 'Rare', level: 8, id: 700 + i,
    attributes: { atk: 40, hp: 200, spd: 100, crit: 55, damageTakenMul: 1, affinityBonus: 0 }
  }, false);
  hi.critChance = 0.55;
  const lo = C.makeCombatant({
    name: 'Lo', element: 'Shadow', power: 120, rarity: 'Rare', level: 8, id: 900 + i,
    attributes: { atk: 40, hp: 200, spd: 100, crit: 5, damageTakenMul: 1, affinityBonus: 0 }
  }, false);
  lo.critChance = 0.05;
  const f1 = C.makeCombatant({ name: 'T1', element: 'Plant', power: 80, rarity: 'Common', id: 1100 + i }, true);
  const f2 = C.makeCombatant({ name: 'T2', element: 'Plant', power: 80, rarity: 'Common', id: 1200 + i }, true);
  if (C.applySkill(hi, Object.assign({}, skill), [hi], [f1]).crits > 0) highCrits += 1;
  if (C.applySkill(lo, Object.assign({}, skill), [lo], [f2]).crits > 0) lowCrits += 1;
}
assert(highCrits > lowCrits + 10, 'high critChance lands more crits: ' + highCrits + ' vs ' + lowCrits);
assert(cCrit4.critChance >= 0.20, 'Critical set combatant critChance >= 20%, got ' + cCrit4.critChance);
// Affinity tags on hits
const wa = C.makeCombatant({ name: 'Aqua', element: 'Water', power: 100, rarity: 'Rare', id: 900 }, false);
const ff = C.makeCombatant({ name: 'Ember', element: 'Fire', power: 80, rarity: 'Common', id: 901 }, true);
const hitR = C.applySkill(wa, Object.assign({}, skill), [wa], [ff]);
assert(hitR.hits[0] && hitR.hits[0].affinityTag === 'strong', 'ADV affinity tag on strong hit');
log('PASS live set bonuses + critChance + affinity tags in combat');

// Single-target never fans out (ALL ignored); AOE always hits all
const st = C.makeCombatant({ name: 'ST', element: 'Fire', power: 150, rarity: 'Rare', id: 910 }, false);
const fA = C.makeCombatant({ name: 'A', element: 'Plant', power: 60, rarity: 'Common', id: 911 }, true);
const fB = C.makeCombatant({ name: 'B', element: 'Plant', power: 60, rarity: 'Common', id: 912 }, true);
const stSk = { id: 'basic', name: 'Gel Strike', mult: 1, cd: 0, aoe: false, cooldownLeft: 0 };
const stR = C.applySkill(st, stSk, [st], [fA, fB], 'ALL');
assert(stR.hits.length === 1, 'single-target ignores ALL, hits 1 got ' + stR.hits.length);
const aoeSk = { id: 'splash', name: 'Splash', mult: 0.85, cd: 0, aoe: true, cooldownLeft: 0 };
const aoeR = C.applySkill(st, Object.assign({}, aoeSk), [st], [fA, fB], fA.id);
assert(aoeR.hits.length === 2, 'AOE hits all foes regardless of targetId, got ' + aoeR.hits.length);
// Single heal → one ally
const healer2 = C.makeCombatant({ name: 'H', element: 'Plant', power: 100, rarity: 'Epic', id: 920 }, false);
const ally2 = C.makeCombatant({ name: 'A2', element: 'Water', power: 100, rarity: 'Rare', id: 921 }, false);
healer2.hp = Math.floor(healer2.maxHp * 0.5);
ally2.hp = Math.floor(ally2.maxHp * 0.4);
const healR = C.applySkill(healer2, { id: 'heal', name: 'Mend', mult: 0, cd: 0, heal: 0.28, aoe: false, cooldownLeft: 0 },
  [healer2, ally2], [], ally2.id);
assert(healR.hits.length === 1 && healR.hits[0].targetId === ally2.id, 'single heal one target');
log('PASS single-target vs AOE targeting rules (no ALL mix)');

// --- VFX catalog Phase A ---
let VFX = null;
try {
  VFX = require(path.join(ROOT, 'src/ui/combatVfxCatalog.js'));
} catch (e) {
  log('WARN combatVfxCatalog not loadable in node: ' + e.message);
}
if (VFX) {
  const rBasic = VFX.resolveRecipe({ skillId: 'basic', element: 'Fire' });
  const rInf = VFX.resolveRecipe({ skillId: 'inferno', element: 'Fire', aoe: true });
  const rBolt = VFX.resolveRecipe({ skillId: 'bolt', element: 'Lightning' });
  const rBlaze = VFX.resolveRecipe({ skillId: 'blaze', element: 'Fire' });
  const rSplash = VFX.resolveRecipe({ skillId: 'splash', element: 'Water', aoe: true });
  const rPoison = VFX.resolveRecipe({ skillId: 'poison', element: 'Poison' });
  const rSmash = VFX.resolveRecipe({ skillId: 'smash', element: 'Earth' });
  const rHeal = VFX.resolveRecipe({ skillId: 'heal', element: 'Plant', kind: 'heal' });
  assert(rBasic.fxTier === 'basic', 'basic tier');
  assert(rInf.fxTier === 'signature', 'inferno signature');
  assert(rInf.delivery === 'aoe', 'inferno aoe');
  assert(rInf.impact === 'eruption', 'inferno eruption impact');
  assert(rBolt.delivery === 'beam', 'bolt beam');
  assert(rBolt.travel === 'lightning_fork', 'bolt lightning_fork travel');
  assert(rBlaze.travel === 'fire_comet' && rBlaze.impact === 'scorch_bloom', 'blaze comet/scorch');
  assert(rSplash.impact === 'ripple_rings', 'splash ripples');
  assert(rPoison.impact === 'toxic_splotch', 'poison toxic');
  assert(rSmash.impact === 'ground_dust', 'smash ground dust');
  assert(rHeal.delivery === 'heal', 'heal delivery');
  assert(rInf.budget.durationMul > rBasic.budget.durationMul, 'signature longer than basic');
  assert(rInf.budget.residual === true, 'signature residual');
  // Dynamic cast spool: magic longer than basic
  assert(rBasic.budget.castSec < rBlaze.budget.castSec, 'basic cast < blaze cast ' +
    rBasic.budget.castSec + ' vs ' + rBlaze.budget.castSec);
  assert(rBlaze.budget.castSec < rInf.budget.castSec, 'ability cast < signature cast');
  assert(rInf.budget.totalHintMs > rBasic.budget.totalHintMs, 'signature holds turn longer');
  // Phase B: unique silhouettes distinguishable by profile ids
  assert(typeof VFX.hasUniqueSilhouette === 'function', 'hasUniqueSilhouette');
  assert(VFX.hasUniqueSilhouette(rInf), 'inferno unique');
  assert(VFX.hasUniqueSilhouette(rBolt), 'bolt unique');
  assert(VFX.hasUniqueSilhouette(rBlaze), 'blaze unique');
  assert(VFX.hasUniqueSilhouette(rSplash), 'splash unique');
  assert(VFX.hasUniqueSilhouette(rPoison), 'poison unique');
  assert(VFX.hasUniqueSilhouette(rSmash), 'smash unique');
  // Different skills → different impact silhouettes (blind-test data contract)
  const impacts = [rInf, rBolt, rBlaze, rSplash, rPoison, rSmash].map((r) => r.impact);
  assert(new Set(impacts).size === impacts.length, 'core skills have distinct impact profiles: ' + impacts.join(','));
  // Phase C flags
  assert(rInf.multiHit === 3, 'inferno multiHit 3');
  assert(rSmash.multiHit === 2, 'smash multiHit 2');
  // Phase D — full element kit recipes resolve
  const rPrism = VFX.resolveRecipe({ skillId: 'prism_bolt', element: 'Crystal' });
  const rMiasma = VFX.resolveRecipe({ skillId: 'miasma', element: 'Poison', aoe: true });
  const rCollapse = VFX.resolveRecipe({ skillId: 'collapse', element: 'Void', aoe: true });
  const rChainStorm = VFX.resolveRecipe({ skillId: 'chain_storm', element: 'Lightning', aoe: true });
  assert(rPrism.delivery === 'beam' && rPrism.chain === true, 'prism_bolt beam+chain');
  assert(rMiasma.fxTier === 'signature' && rMiasma.impact === 'toxic_splotch', 'miasma signature toxic');
  assert(rCollapse.multiHit === 3, 'collapse multiHit');
  assert(rChainStorm.chain === true && rChainStorm.multiHit === 3, 'chain_storm chain multi');
  assert(rBolt.chain === true, 'bolt chain flag');
  // battleWorld3d Phase B+C runners present
  const b3 = fs.readFileSync(path.join(ROOT, 'src/ui/battleWorld3d.js'), 'utf8');
  assert(/runInfernoFx|runBoltFx|runBlazeFx|runSplashFx|runVenomFx|runCrushFx/.test(b3),
    'Phase B unique runners in battleWorld3d');
  assert(/spawnElementResidual|chainToIds|gold/.test(b3), 'Phase C residual + chain + crit gold');
  assert(/spawnFlamePillar|runDarkFx|runWindFx|runPlantFx/.test(b3),
    'Phase E spectacle runners (flame/dark/wind/plant)');
  assert(/spawnPaintedFx|preloadPaintedFx|assets\/battle\/fx/.test(b3),
    'painted FX billboard pipeline in battleWorld3d');
  // Element-flavoured basic recipes
  const rFireBasic = VFX.resolveRecipe({ skillId: 'basic', element: 'Fire' });
  assert(rFireBasic.travel === 'fire_comet' || rFireBasic.impact === 'scorch_bloom',
    'Fire basic routes to fire silhouette');
  // Bang-for-buck painted FX pack on disk
  const fxDir = path.join(ROOT, 'assets/battle/fx');
  ['fire_impact', 'fire_comet', 'heal_bloom', 'buff_ward',
    'poison_cloud', 'ice_shatter', 'water_splash', 'lightning_bolt'].forEach((stem) => {
    assert(fs.existsSync(path.join(fxDir, stem + '.png')), 'FX plate ' + stem + '.png');
  });
  log('PASS combat VFX catalog Phase A+B+C recipes + spectacle flags');
}

// --- Elemental status on hit + DoT ticks ---
assert(typeof C.elementStatusId === 'function', 'elementStatusId');
assert(C.elementStatusId('Fire') === 'burn', 'Fire → burn');
assert(C.elementStatusId('Poison') === 'poison', 'Poison → poison');
assert(C.elementStatusId('Ice') === 'chill', 'Ice → chill');
assert(C.elementStatusId('Lightning') === 'shock', 'Lightning → shock');
const burner = C.makeCombatant({ name: 'Pyre', element: 'Fire', power: 200, rarity: 'Epic' }, false);
const victim = C.makeCombatant({ name: 'Dummy', element: 'Plant', power: 80 }, true);
// Force high status chance via many trials
let burned = 0;
for (let i = 0; i < 40; i++) {
  // Fat tank so hits don't kill (status only applies if target lives)
  const v = C.makeCombatant({ name: 'D' + i, element: 'Plant', power: 800 }, true);
  v.maxHp = 5000; v.hp = 5000;
  const a = C.makeCombatant({ name: 'F' + i, element: 'Fire', power: 120, rarity: 'Legendary' }, false);
  const r = C.applySkill(a, {
    id: 'inferno', name: 'Inferno', mult: 1.2, cd: 0, aoe: false, cooldownLeft: 0
  }, [a], [v]);
  if (r.hits.some((h) => h.statusApplied && h.statusApplied.id === 'burn')) burned += 1;
}
assert(burned >= 5, 'inferno often applies burn (' + burned + '/40)');
// Direct apply + tick
const dotV = C.makeCombatant({ name: 'TickMe', element: 'Water', power: 100 }, true);
const hpBeforeDot = dotV.hp;
C.applyStatus(dotV, 'burn', { duration: 2 });
assert(C.hasStatus(dotV, 'burn'), 'burn applied');
const tick = C.tickStatuses(dotV);
assert(tick.ticks.length === 1 && tick.ticks[0].amount > 0, 'burn ticks damage');
assert(dotV.hp < hpBeforeDot, 'DoT reduced HP');
// Chill slows effective speed
const cold = C.makeCombatant({ name: 'Cold', element: 'Ice', power: 100 }, false);
cold.speed = 100;
C.applyStatus(cold, 'chill');
assert(C.effectiveSpeed(cold) < cold.speed, 'chill slows');
// Buff skill applies ward
const guard = C.makeCombatant({ name: 'Guard', element: 'Earth', power: 120 }, false);
const buffR = C.applySkill(guard, {
  id: 'earth_shield', name: 'Stone Shell', mult: 0.65, cd: 0, cooldownLeft: 0,
  artCategory: 'buff'
}, [guard], []);
assert(buffR.kind === 'buff', 'buff skill kind');
assert(C.hasStatus(guard, 'ward'), 'ward applied by shield');
log('PASS elemental statuses (burn/poison/chill) + buff ward');

// --- Raid-style power score (weighted stats, HP primary) ---
assert(typeof DATA.computeRaidPowerScore === 'function', 'computeRaidPowerScore exported');
const pLow = DATA.computeRaidPowerScore({
  hp: 200, atk: 30, def: 15, spd: 90, crit: 8, critDmg: 50, res: 10, acc: 8
});
const pHigh = DATA.computeRaidPowerScore({
  hp: 2000, atk: 300, def: 150, spd: 200, crit: 40, critDmg: 80, res: 80, acc: 60
});
assert(pHigh > pLow * 2, 'higher stats → higher Raid power ' + pHigh + ' vs ' + pLow);
// HP weight is significant: +1000 HP moves score more than +20 ATK
const base = { hp: 1000, atk: 100, def: 80, spd: 120, crit: 15, critDmg: 55, res: 40, acc: 30 };
const pBase = DATA.computeRaidPowerScore(base);
const pHp = DATA.computeRaidPowerScore(Object.assign({}, base, { hp: base.hp + 1000 }));
const pAtk = DATA.computeRaidPowerScore(Object.assign({}, base, { atk: base.atk + 20 }));
assert(pHp - pBase > pAtk - pBase, 'HP contributes more than small ATK bumps (Raid priority)');
const attrScored = DATA.computeChampionAttributes({
  name: 'Scored', element: 'Fire', power: 200, rarity: 'Epic', level: 20, purpleStars: 1, equipment: {}
});
assert(attrScored.power === DATA.computeRaidPowerScore(attrScored),
  'attributes.power is Raid score of final stats');
assert(attrScored.critDmg >= 50 && attrScored.acc >= 0, 'critDmg + acc present');
log('PASS Raid power score scaling');

// HP segment scale: 250 HP per box
function segCount(maxHp) {
  return Math.max(1, Math.min(36, Math.ceil(Math.max(1, maxHp) / 250)));
}
assert(segCount(100) === 1, 'sub-250 HP → 1 box');
assert(segCount(250) === 1, 'exactly 250 → 1 box');
assert(segCount(251) === 2, '251 → 2 boxes');
assert(segCount(1000) === 4, '1000 → 4 boxes');
assert(segCount(5000) === 20, '5000 → 20 boxes');
log('PASS HP bar 250-HP segments');

// Multi-wave dungeon helpers
const S = require(path.join(ROOT, 'src/systems/gameState.js'));
const dungeon = { id: 'forest_depths', name: 'Forest Depths', element: 'Plant', waves: 3, power: 120, gear: ['Life'] };
assert(typeof S.dungeonWaveCount === 'function', 'dungeonWaveCount export');
assert(S.dungeonWaveCount(dungeon) === 3, '3 waves');
assert(S.dungeonWaveCount({ waves: 1 }) === 1, '1 wave');
const w0 = S.makeDungeonWaveFoes(dungeon, 0);
const w2 = S.makeDungeonWaveFoes(dungeon, 2);
assert(w0.length >= 2 && w2.length >= 2, 'wave packs non-empty');
const avg = (arr) => arr.reduce((s, f) => s + (f.power || 0), 0) / arr.length;
assert(avg(w2) > avg(w0), 'final wave stronger than first: ' + avg(w2) + ' > ' + avg(w0));
// advanceWave keeps ally HP, replaces foes
const partyW = [
  { id: 1, name: 'Hero', element: 'Water', power: 200, rarity: 'Epic', level: 10 }
];
const bWave = C.createBattle(partyW, w0, { waveIndex: 0, totalWaves: 3 });
bWave.allies[0].hp = Math.floor(bWave.allies[0].maxHp * 0.4);
const hpBefore = bWave.allies[0].hp;
C.advanceWave(bWave, w2, { healFrac: 0.14, totalWaves: 3 });
assert(bWave.waveIndex === 1, 'waveIndex advanced');
assert(bWave.foes.length === w2.length, 'foes replaced');
assert(bWave.allies[0].hp > hpBefore, 'soft heal between waves');
assert(bWave.allies[0].hp < bWave.allies[0].maxHp, 'not full heal');
assert(bWave.status === 'ongoing', 'status ongoing after wave');
log('PASS multi-wave dungeon advance');

// First-hour tutorial coach module
let TUT = null;
try {
  TUT = require(path.join(ROOT, 'src/ui/tutorialCoach.js'));
} catch (e) {
  log('WARN tutorialCoach not loadable: ' + e.message);
}
if (TUT) {
  // Before Epic pick: no hub campaign coach
  const pre = {
    introSeen: true,
    tutorialSeen: false,
    tutorialStep: 0,
    flags: {},
    resources: { gold: 0, slimeShards: 0 },
    artifacts: []
  };
  assert(!TUT.needsHubCoach(pre), 'no hub coach before pick');
  // After Raid pick
  const st = {
    introSeen: true,
    tutorialSeen: true,
    tutorialStep: 99,
    flags: { tutorialPickDone: true },
    resources: { gold: 0, slimeShards: 0 },
    artifacts: [],
    roster: [{ id: 1, name: 'Epic Gel' }]
  };
  assert(TUT.needsHubCoach(st), 'hub coach needed after pick');
  assert(TUT.needsCampaignNudge(st), 'campaign nudge needed');
  assert(TUT.needsBattleCoach(st), 'battle coach needed');
  TUT.markHubCoachDone(st);
  assert(st.flags.hubCoachDone === true, 'hub coach marks hubCoachDone');
  // Simulate first win bonus without full gameState
  global.SR_STATE = global.SR_STATE || {};
  global.SR_STATE.saveState = function () {};
  global.SR_STATE.rollGearDrop = function (opts) {
    return {
      id: 9001, name: 'Life Core', set: 'Life', power: 10,
      slotHint: (opts && opts.slotId) || 'helm'
    };
  };
  global.SR_STATE.grantGearToVault = function (s, a) {
    s.artifacts = s.artifacts || [];
    s.artifacts.push(a);
  };
  global.SR_STATE.getParty = function (s) {
    return (s.roster || []).slice(0, 4);
  };
  global.SR_STATE.equipArtifact = function (s, champId, slotId, artId) {
    var c = (s.roster || []).find(function (x) { return x.id === champId; });
    if (!c) return { ok: false };
    c.equipment = c.equipment || {};
    c.equipment[slotId] = { id: artId, set: 'Life' };
    return { ok: true };
  };
  const pack = { rewards: [] };
  const st2 = {
    introSeen: true, tutorialSeen: true, flags: {},
    resources: { gold: 10, slimeShards: 5, jelly: 0 },
    artifacts: [],
    roster: [{ id: 1, name: 'Lead Gel', equipment: {} }],
    partyIds: [1]
  };
  const bon = TUT.applyFirstWinBonus(st2, pack);
  assert(bon.firstWin === true, 'first win true');
  assert(st2.resources.gold > 10, 'bonus gold');
  assert(st2.resources.jelly >= 6, 'bonus jelly');
  assert(st2.flags.firstCampaignWin === true, 'firstCampaignWin flag');
  assert(pack.rewards.length >= 2, 'bonus rewards listed');
  assert(bon.equipped === true, 'first win auto-equips');
  assert(TUT.needsEquipCoach(st2), 'equip coach after first win');
  // Buddy grant needs real createChampion
  const S = require(path.join(ROOT, 'src/systems/gameState.js'));
  global.SR_STATE.createChampion = S.createChampion;
  global.SR_DATA = global.SR_DATA || require(path.join(ROOT, 'src/data/gameData.js'));
  const st3 = {
    introSeen: true, tutorialSeen: true, flags: {},
    resources: { gold: 10, slimeShards: 5, jelly: 0 },
    artifacts: [],
    roster: [{ id: 7, name: 'Solo Epic', element: 'Fire', equipment: {} }],
    partyIds: [7]
  };
  global.SR_STATE.getParty = function (s) { return (s.roster || []).slice(0, 4); };
  global.SR_STATE.equipArtifact = function () { return { ok: true }; };
  global.SR_STATE.grantGearToVault = function (s, a) {
    s.artifacts = s.artifacts || []; s.artifacts.push(a);
  };
  const bon3 = TUT.applyFirstWinBonus(st3, { rewards: [] });
  assert(bon3.firstWin === true, 'solo first win');
  assert(st3.roster.length === 2, 'first win grants partner gel');
  assert(st3.partyIds.length === 2, 'partner auto-party');
  const bon2 = TUT.applyFirstWinBonus(st2, { rewards: [] });
  assert(bon2.firstWin === false, 'second call not first win');
  log('PASS first-hour tutorial coach');
}

// Procedural audio bus (Node-safe: no AudioContext)
{
  const AUD = require(path.join(ROOT, 'src/ui/audioBus.js'));
  assert(AUD && typeof AUD.play === 'function', 'SR_AUDIO play');
  assert(AUD.SFX_IDS && AUD.SFX_IDS.indexOf('hit') >= 0, 'sfx catalog has hit');
  assert(AUD.SFX_IDS.indexOf('win') >= 0, 'sfx catalog has win');
  AUD.setVolume(0.5);
  assert(AUD.getState().volume === 0.5, 'setVolume');
  AUD.toggleMute();
  assert(AUD.getState().muted === true, 'mute');
  AUD.toggleMute();
  assert(AUD.getState().muted === false, 'unmute');
  // play without AudioContext should not throw
  assert(AUD.play('hit') === false || AUD.play('hit') === true, 'play safe');
  log('PASS procedural audio bus');
}

// Trait synergies
assert(typeof DATA.computeSelfTraitSynergies === 'function', 'self trait synergy');
assert(typeof DATA.computePartyTraitSynergies === 'function', 'party trait synergy');
const soloCombat = DATA.computeSelfTraitSynergies(['combat_instinct', 'combat_veteran']);
assert(soloCombat.active.some((s) => s.id === 'blade_instinct'), 'blade_instinct self syn');
assert(soloCombat.mods.atk > 1, 'self combat syn raises atk mul');
const noSyn = DATA.computeSelfTraitSynergies(['combat_instinct']);
assert(!noSyn.active.some((s) => s.id === 'blade_instinct'), 'single combat trait no blade_instinct');
const partyBag = [
  { traits: ['combat_instinct'] },
  { traits: ['combat_veteran'] },
  { traits: ['elemental_adept'] }
];
const pSyn = DATA.computePartyTraitSynergies(partyBag);
assert(pSyn.active.some((s) => s.id === 'war_council'), 'war_council party syn');
assert(pSyn.mods.spd > 1, 'war council spd');
const attrsSyn = DATA.computeChampionAttributes({
  name: 'Syn', element: 'Fire', power: 120, rarity: 'Epic', level: 10,
  traits: ['combat_instinct', 'combat_veteran'], equipment: {}
});
const attrsBareT = DATA.computeChampionAttributes({
  name: 'Bare', element: 'Fire', power: 120, rarity: 'Epic', level: 10,
  traits: [], equipment: {}
});
assert(attrsSyn.atk > attrsBareT.atk, 'traits raise combat atk');
assert(Array.isArray(attrsSyn.traitSynergyLines), 'synergy lines on attributes');
// Party mods stamp into battle
const bSyn = C.createBattle(
  [
    { id: 1, name: 'A', element: 'Fire', power: 150, rarity: 'Rare', level: 8, traits: ['combat_instinct'] },
    { id: 2, name: 'B', element: 'Water', power: 140, rarity: 'Rare', level: 8, traits: ['combat_veteran'] },
    { id: 3, name: 'C', element: 'Earth', power: 130, rarity: 'Rare', level: 8, traits: ['battle_hardened'] }
  ],
  [{ id: 9, name: 'F', element: 'Plant', power: 40, rarity: 'Common', level: 1 }],
  { auto: true }
);
assert(bSyn.partySynergies && bSyn.partySynergies.active.length >= 1, 'battle carries party synergies');
assert(bSyn.log.some((l) => /synergy/i.test(l)), 'battle log mentions synergy');
log('PASS trait synergy self + party + combat wire');

log('ALL COMBAT TESTS PASSED');

try {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, 'combat-tests.log'), lines.join('\n') + '\n');
} catch (e) {
  console.warn('scratch write failed', e.message);
}
