/**
 * Commercial gacha core loop — drives shipped SR_STATE / SR_COMBAT
 * (performSummon, buyItem, evolveChampion, equipArtifact, createBattle).
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SCRATCH = process.env.GOAL_SCRATCH ||
  '/var/folders/fw/0_cfyf5s2mb1c50p8jn_z_nw0000gq/T/grok-goal-246b46bd18e6/implementer';

function assert(c, m) {
  if (!c) throw new Error(m || 'assert failed');
}

const econ = [];
const loop = [];
function logE(s) { econ.push(s); console.log(s); }
function logL(s) { loop.push(s); console.log(s); }

const DATA = require(path.join(ROOT, 'src/data/gameData.js'));
global.SR_DATA = DATA;
const S = require(path.join(ROOT, 'src/systems/gameState.js'));
const C = require(path.join(ROOT, 'src/systems/combat.js'));

const mem = {};
global.localStorage = {
  getItem: (k) => (mem[k] != null ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }
};

logE('=== gacha-economy ===');

const banners = ['regular', 'premium', 'ancient'];
assert(DATA.SUMMON_RATES, 'SUMMON_RATES published');
assert(DATA.SUMMON_COSTS, 'SUMMON_COSTS published');
assert(DATA.SUMMON_PITY, 'SUMMON_PITY published');
banners.forEach((type) => {
  const rates = DATA.SUMMON_RATES[type];
  const keys = rates && Object.keys(rates);
  assert(keys && keys.length >= 2, 'rates for ' + type);
  const sum = keys.reduce((s, k) => s + Number(rates[k] || 0), 0);
  assert(sum > 0.99 && sum < 1.01, type + ' rates sum ~1, got ' + sum);
  const cost = DATA.SUMMON_COSTS[type];
  assert(cost && cost.currency && cost.one > 0, type + ' cost');
  const pity = DATA.SUMMON_PITY[type];
  assert(pity && pity.bound >= 2 && pity.rarity, type + ' pity');
  logE('PASS banner ' + type + ' rates=' + keys.join(',') +
    ' cost=' + cost.one + ' ' + cost.currency +
    ' pity=' + pity.bound + '→' + pity.rarity);
});

const state = S.defaultState();
assert(state.roster.length === 0, 'fresh roster empty');

// Broke pull
const costReg = DATA.SUMMON_COSTS.regular;
state.resources[costReg.currency] = 0;
const roster0 = state.roster.length;
const brokePull = S.performSummon(state, 'regular', 1);
assert(!brokePull.ok, 'broke summon not-ok');
assert((brokePull.results || []).length === 0, 'broke summon no results');
assert(state.roster.length === roster0, 'broke summon roster unchanged');
assert((state.resources[costReg.currency] || 0) === 0, 'broke summon no debit');
logE('PASS insufficient currency returns not-ok');

// Paid 1-pull
state.resources[costReg.currency] = costReg.one;
const beforeShards = state.resources[costReg.currency];
const beforeRoster = state.roster.length;
const pull = S.performSummon(state, 'regular', 1);
assert(pull.ok, '1-pull ok: ' + (pull.error || ''));
assert(pull.results && pull.results.length === 1, '1 result');
assert(state.roster.length === beforeRoster + 1, 'roster grew');
assert(state.resources[costReg.currency] === beforeShards - costReg.one, 'deducted one-pull cost');
assert(pull.results[0].id != null && pull.results[0].rarity && pull.results[0].element, 'champion identity');
logE('PASS 1-pull deducts ' + costReg.one + ' ' + costReg.currency + ' and grows roster');

// Hard pity: counter at bound-1 → next pull is the published floor rarity
function assertPity(type) {
  const spec = DATA.SUMMON_PITY[type];
  const cost = DATA.SUMMON_COSTS[type];
  const st = S.defaultState();
  st.resources[cost.currency] = cost.one;
  st.summon = st.summon || {};
  st.summon[spec.counter] = spec.bound - 1;
  const res = S.performSummon(st, type, 1);
  assert(res.ok && res.results[0], type + ' pity pull ok');
  const got = res.results[0].rarity;
  const order = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  assert(order.indexOf(got) >= order.indexOf(spec.rarity),
    type + ' pity rarity ' + got + ' < ' + spec.rarity);
  assert((st.summon[spec.counter] || 0) === 0, type + ' pity reset after hit');
  logE('PASS pity ' + type + ' at ' + (spec.bound - 1) + ' yielded ' + got);
}
banners.forEach(assertPity);

// Shop SKUs for pull currency
function findSku(grantKey) {
  return (DATA.MARKET_ITEMS || []).find((i) => i.grant && i.grant[grantKey] > 0);
}
const slimeSku = findSku('slimeShards');
const divineSku = findSku('divineShards');
assert(slimeSku, 'shop SKU grants slimeShards');
assert(divineSku, 'shop SKU grants divineShards');
logE('PASS shop SKUs slime=' + slimeSku.id + ' divine=' + divineSku.id);

function assertBuy(sku) {
  const st = S.defaultState();
  const grantKey = Object.keys(sku.grant)[0];
  const grantAmt = sku.grant[grantKey];
  st.resources[sku.currency] = sku.cost;
  const beforeGrant = st.resources[grantKey] || 0;
  const okBuy = S.buyItem(st, sku.id);
  assert(okBuy.ok, sku.id + ' buy ok');
  assert(st.resources[sku.currency] === 0, sku.id + ' deducted cost');
  assert(st.resources[grantKey] === beforeGrant + grantAmt, sku.id + ' granted pack');
  const after = st.resources[grantKey];
  const broke = S.buyItem(st, sku.id);
  assert(!broke.ok, sku.id + ' broke buy not-ok');
  assert(st.resources[grantKey] === after, sku.id + ' broke buy grants nothing');
  logE('PASS buyItem ' + sku.id + ' grants ' + grantAmt + ' ' + grantKey + '; broke buy fails');
}
assertBuy(slimeSku);
assertBuy(divineSku);

// Live boot must not top wallets — BootScene.create → applyBootEconomy
const bootSrc = fs.readFileSync(path.join(ROOT, 'src/scenes/BootScene.js'), 'utf8');
assert(/applyBootEconomy/.test(bootSrc), 'BootScene.create calls applyBootEconomy');
assert(!/devOn\s*=\s*true/.test(bootSrc), 'BootScene must not default the QA bank on');
Object.keys(mem).forEach((k) => { delete mem[k]; });
assert(S.shouldGrantDevShards() === false, 'no sr_dev_shards flag → grant off');
const liveLoad = S.loadState();
const bootGrant = S.applyBootEconomy(liveLoad);
assert(bootGrant && bootGrant.skipped, 'fresh boot skips QA bank');
const starters = S.defaultState().resources;
['slimeShards', 'divineShards', 'voidShards', 'gold'].forEach((k) => {
  assert(liveLoad.resources[k] === starters[k],
    'fresh load ' + k + ' stayed starter ' + starters[k] + ', got ' + liveLoad.resources[k]);
});
logE('PASS fresh live-style load keeps starter wallets (no 20k top-up)');

mem.sr_dev_shards = '1';
assert(S.shouldGrantDevShards() === true, 'sr_dev_shards=1 enables QA bank');
const qaState = S.defaultState();
const qaGrant = S.applyBootEconomy(qaState);
assert(qaGrant && qaGrant.ok, 'opt-in QA grant runs');
assert(qaState.resources.slimeShards >= qaGrant.amount, 'opt-in tops slime shards');
delete mem.sr_dev_shards;
logE('PASS sr_dev_shards=1 still grants QA bank');

logE('ALL GACHA ECONOMY ASSERTS PASSED');

logL('=== gacha-loop ===');

const loopState = S.defaultState();
const cands = S.ensureTutorialCandidates(loopState);
assert(cands.length >= 1, 'tutorial candidates');
const picked = S.finalizeTutorialPick(loopState, cands[0].id);
assert(picked.ok && loopState.roster.length === 1, 'tutorial champion on roster');
loopState.resources[costReg.currency] = costReg.one;
const extra = S.performSummon(loopState, 'regular', 1);
assert(extra.ok, 'summon onto tutorial save');
const summoned = extra.results[0];
loopState.partyIds = [loopState.roster[0].id, summoned.id];
const party = S.getParty(loopState);
assert(party.some((c) => c.id === summoned.id), 'summoned champion in party');
assert(party.some((c) => c.id === loopState.roster[0].id), 'tutorial champion in party');
logL('PASS party includes tutorial + summoned');

const stages = DATA.CAMPAIGN_STAGES || [];
assert(stages.length >= 1, 'campaign stages');
const foes = S.makeStageFoes(stages[0]);
assert(foes.length >= 1 && foes[0].power > 0, 'stage foes');
const battle = C.createBattle(party, foes, {});
assert(battle && battle.allies && battle.allies.length >= 1, 'battle allies');
assert(battle.foes && battle.foes.length >= 1, 'battle foes');
assert(battle.status === 'ongoing', 'battle ongoing');
logL('PASS createBattle party vs stage foes allies=' + battle.allies.length +
  ' foes=' + battle.foes.length);

const grow = party[0];
const startLv = grow.level;
S.grantChampionExp(grow, 5000);
assert(grow.level > startLv, 'level grew from EXP');
grow.level = 50;
while (loopState.roster.filter((c) => c.rarity === grow.rarity && c.id !== grow.id && !c.locked).length < 1) {
  loopState.roster.push(S.createChampion({
    element: 'Earth', rarity: grow.rarity, level: 1, name: 'Food' + loopState.roster.length
  }));
}
const food = loopState.roster.find((c) => c.id !== grow.id && c.rarity === grow.rarity && !c.locked);
const evo = S.evolveChampion(loopState, grow.id, [food.id]);
assert(evo.ok, 'evolve ok: ' + (evo.error || ''));
assert((grow.purpleStars || 0) >= 1, 'purple star after evolve');

const art = S.createArtifact({ set: 'Offense', slotId: 'weapon', power: 12, rarity: 'Rare' });
S.grantGearToVault(loopState, art);
const eq = S.equipArtifact(loopState, grow.id, 'weapon', art.id);
assert(eq.ok, 'equip ok: ' + (eq.error || ''));
assert(grow.equipment && grow.equipment.weapon && grow.equipment.weapon.id === art.id, 'weapon equipped');
S.saveState(loopState);
const loaded = S.loadState();
const again = (loaded.roster || []).find((c) => c.id === grow.id);
assert(again, 'champion persisted');
assert((again.purpleStars || 0) >= 1, 'evolve persisted');
assert(again.equipment && again.equipment.weapon && again.equipment.weapon.id === art.id, 'equip persisted');
assert((loaded.partyIds || []).indexOf(summoned.id) >= 0, 'party persisted');
logL('PASS growth persist level/evolve/equip after save/load');

logL('ALL GACHA LOOP ASSERTS PASSED');

fs.mkdirSync(SCRATCH, { recursive: true });
fs.writeFileSync(path.join(SCRATCH, 'gacha-economy.log'), econ.join('\n') + '\n');
fs.writeFileSync(path.join(SCRATCH, 'gacha-loop.log'), loop.join('\n') + '\n');
