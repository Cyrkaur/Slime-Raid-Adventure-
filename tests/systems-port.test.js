/**
 * Hub / roster / campaign / summon port — real SR_STATE functions.
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
const S = require(path.join(ROOT, 'src/systems/gameState.js'));

// Memory localStorage stub
const mem = {};
global.localStorage = {
  getItem: (k) => (mem[k] != null ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }
};

log('=== systems-port.test.js ===');

// Structural: scenes + index
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert(/phaser/i.test(index), 'index loads Phaser');
assert(/HubScene|BootScene|BattleScene/.test(index), 'scenes wired in HTML');
[
  'BootScene.js', 'HubScene.js', 'BattleScene.js', 'TutorialPickScene.js', 'RosterScene.js', 'CampaignScene.js', 'SummonScene.js',
  'DungeonScene.js', 'VaultScene.js', 'GreatHallScene.js', 'AlchemyScene.js', 'WorkshopScene.js',
  'MarketScene.js', 'EternityScene.js', 'ChronicleScene.js', 'ChampionDetailScene.js', 'IntroScene.js'
]
  .forEach((f) => {
    assert(fs.existsSync(path.join(ROOT, 'src/scenes', f)), 'scene file ' + f);
  });
log('PASS Phaser entry + full hub scenes exist');

// Default state: empty until Raid tutorial pick; candidates exist
const state = S.defaultState();
assert(Array.isArray(state.roster) && state.roster.length === 0, 'empty roster pre-tutorial');
const cands = S.ensureTutorialCandidates(state);
assert(cands.length === 4, 'tutorial candidates');
cands.forEach((c) => {
  assert(c.id != null, 'id');
  assert(c.element, 'element');
  assert(c.rarity, 'rarity');
  assert(typeof c.power === 'number' && c.power > 0, 'power');
});
const pick = S.finalizeTutorialPick(state, cands[0].id);
assert(pick.ok && state.roster.length === 1 && state.roster[0].rarity === 'Epic', 'epic pick');
log('PASS roster identity fields');

const party = S.getParty(state);
assert(party.length >= 1 && party.length <= 4, 'party size');
assert(party[0].element && party[0].rarity, 'party champion fields');
log('PASS getParty');

// Summon
state.resources.slimeShards = 1000;
const before = state.roster.length;
const pull = S.performSummon(state, 'regular', 1);
assert(pull.ok, 'summon ok');
assert(pull.results.length === 1, 'one result');
assert(state.roster.length === before + 1, 'roster grew');
assert(pull.results[0].element && pull.results[0].rarity && pull.results[0].id != null, 'summon identity');
log('PASS summon acquisition');

// createChampion honors explicit power (shipped path for stage foes)
const forced = S.createChampion({ element: 'Fire', rarity: 'Common', level: 1, power: 999 });
assert(forced.power === 999, 'createChampion uses opts.power, got ' + forced.power);
log('PASS createChampion opts.power');

// Campaign unlock + foes (makeStageFoes must pass power through)
const stages = DATA.CAMPAIGN_STAGES;
assert(stages.length >= 2, 'campaign stages ported');
assert(S.stageUnlocked(state, stages[0]), 'first stage unlocked');
const foes = S.makeStageFoes(stages[0]);
assert(foes.length >= 1 && foes[0].power > 0, 'stage foes');
const bossStage = stages.find((s) => s.boss) || stages[stages.length - 1];
const bossFoes = S.makeStageFoes(bossStage);
const bossChamp = bossFoes[bossFoes.length - 1];
assert(bossChamp.power === bossStage.power || bossChamp.power === Math.floor(bossStage.power),
  'boss foe power tracks stage.power: ' + bossChamp.power + ' vs ' + bossStage.power);
// High-power stage must produce high-power foe (not level-only roll ~40-50)
const high = S.makeStageFoes({ id: 'hi', name: 'High', power: 999, element: 'Lava', boss: true });
assert(high.some((f) => f.power === 999), 'makeStageFoes high-power stage honors 999, got ' + JSON.stringify(high.map((f) => f.power)));
log('PASS campaign stages + foes power');

// Save roundtrip
S.saveState(state);
const loaded = S.loadState();
assert(loaded.roster.length === state.roster.length, 'save load roster');
assert(loaded.resources.slimeShards === state.resources.slimeShards, 'save shards');
log('PASS save/load');

// Record win path
S.recordStageWin(state, stages[0].id, 2);
assert(state.campaign.progress[stages[0].id].stars === 2, 'stars stored');
assert(S.stageUnlocked(state, stages[1]), 'second stage unlocks after clear');
log('PASS campaign progression');

// Hub HTML / scene source markers
const hub = fs.readFileSync(path.join(ROOT, 'src/scenes/HubScene.js'), 'utf8');
assert(/HUB_MODES|CampaignScene|RosterScene|SummonScene|BattleScene/.test(hub), 'hub routes to modes');
assert(DATA.HUB_MODES && DATA.HUB_MODES.length === 11, '11 hub modes in data');
const battle = fs.readFileSync(path.join(ROOT, 'src/scenes/BattleScene.js'), 'utf8');
assert(/SR_COMBAT|createBattle|computeArenaLayout/.test(battle), 'battle uses combat system');
assert(/recordDungeonWin|recordBossWin/.test(battle), 'battle records dungeon/boss wins');
log('PASS hub/battle integration markers');

log('ALL SYSTEMS PORT TESTS PASSED');

fs.mkdirSync(SCRATCH, { recursive: true });
fs.writeFileSync(path.join(SCRATCH, 'systems-port.log'), lines.join('\n') + '\n');
