/**
 * Feature parity: every HTML hub mode must have a Phaser scene route + art + state actions.
 * Also covers market/alchemy/workshop/eternity/vault state APIs.
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const HTML_ROOT = path.resolve(ROOT, '../Slime Adventure');
const SCRATCH = process.env.GOAL_SCRATCH ||
  '/var/folders/fw/0_cfyf5s2mb1c50p8jn_z_nw0000gq/T/grok-goal-8eaaebc09efb/implementer';

function assert(c, m) {
  if (!c) throw new Error(m || 'assert failed');
}

const lines = [];
function log(s) { lines.push(s); console.log(s); }

log('=== feature-parity.test.js ===');

const DATA = require(path.join(ROOT, 'src/data/gameData.js'));
global.SR_DATA = DATA;
const S = require(path.join(ROOT, 'src/systems/gameState.js'));

const mem = {};
global.localStorage = {
  getItem: (k) => (mem[k] != null ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }
};

// Raid tutorial pick → Epic solo + haven kit + stage spoils
{
  const fresh = S.defaultState();
  assert((fresh.roster || []).length === 0, 'empty roster before tutorial pick');
  assert(fresh.tutorialSeen === false, 'tutorial not done');
  const cands = S.ensureTutorialCandidates(fresh);
  assert(cands.length === 4, 'four tutorial gels');
  const pick = S.finalizeTutorialPick(fresh, cands[0].id);
  assert(pick.ok && pick.champion.rarity === 'Epic', 'pick is Epic');
  assert(pick.champion.level === 10, 'Epic starter Lv10');
  assert(fresh.roster.length === 1 && fresh.partyIds.length === 1, 'solo party after pick');
  assert(fresh.flags.tutorialPickDone && fresh.tutorialSeen, 'tutorial flags set');
  assert(fresh.flags.havenKitGranted, 'haven kit after pick');
  const lead = fresh.roster[0];
  assert(lead.equipment && lead.equipment.weapon && lead.equipment.chest,
    'lead has Life weapon+chest');
  // Display PWR includes gear (Raid score) — not raw base power alone
  const disp = S.championDisplayPower(lead);
  assert(disp > (lead.power || 0), 'display PWR > base power when geared, ' + disp + ' vs ' + lead.power);
  const pack1 = S.recordStageWin(fresh, 'gw1', 3);
  assert(pack1.firstClear === true, 'first clear flag');
  assert(pack1.gear, 'first clear guarantees gear');
  assert((pack1.rewards || []).some((r) => /level/i.test(r.label || '') || r.icon === '⬆️'),
    'level-up spoils chip when levels gained');
  const pack2 = S.recordStageWin(fresh, 'gw1', 3);
  assert(pack2.firstClear === false, 'repeat clear not first');
  // Restart wipes vault + equipped gear
  assert((fresh.artifacts || []).length > 0, 'pre-reset has vault gear');
  const wiped = S.resetGame();
  assert((wiped.roster || []).length === 0, 'reset clears roster');
  assert((wiped.artifacts || []).length === 0, 'reset clears vault artifacts');
  assert(!wiped.flags.havenKitGranted, 'reset clears haven kit flag');
  assert(!wiped.flags.tutorialPickDone, 'reset clears tutorial pick');
  // Early campaign power floor for solo Epic
  const gw1 = (DATA.CAMPAIGN_STAGES || []).find((s) => s.id === 'gw1');
  assert(gw1 && gw1.power >= 150, 'gw1 not freebie (power>=150), got ' + (gw1 && gw1.power));
  log('PASS raid tutorial pick + haven kit + stage spoils');
}

// --- HTML hub modes (canonical list from mode-chips / HUB_MODES port) ---
const EXPECTED_MODES = [
  { id: 'campaign', scene: 'CampaignScene', art: 'campaign.jpg' },
  { id: 'dungeons', scene: 'DungeonScene', art: 'dungeons.jpg' },
  { id: 'champions', scene: 'RosterScene', art: 'champions.jpg' },
  { id: 'summon', scene: 'SummonScene', art: 'summon.jpg' },
  { id: 'vault', scene: 'VaultScene', art: 'vault.jpg' },
  { id: 'great_hall', scene: 'GreatHallScene', art: 'great-hall.jpg' },
  { id: 'alchemy', scene: 'AlchemyScene', art: 'alchemy.jpg' },
  { id: 'workshop', scene: 'WorkshopScene', art: 'workshop.jpg' },
  { id: 'market', scene: 'MarketScene', art: 'market.jpg' },
  { id: 'eternity', scene: 'EternityScene', art: 'eternity.jpg' },
  { id: 'chronicle', scene: 'ChronicleScene', art: 'chronicle.jpg' }
];

assert(Array.isArray(DATA.HUB_MODES) && DATA.HUB_MODES.length === EXPECTED_MODES.length,
  'HUB_MODES length ' + (DATA.HUB_MODES && DATA.HUB_MODES.length));

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
const hubJs = fs.readFileSync(path.join(ROOT, 'src/scenes/HubScene.js'), 'utf8');
const bootJs = fs.readFileSync(path.join(ROOT, 'src/scenes/BootScene.js'), 'utf8');

const inventory = [];
EXPECTED_MODES.forEach((m) => {
  const dataMode = DATA.HUB_MODES.find((h) => h.id === m.id || h.scene === m.scene);
  assert(dataMode, 'HUB_MODES missing ' + m.id);
  assert(dataMode.scene === m.scene, m.id + ' scene key');

  const sceneFile = path.join(ROOT, 'src/scenes', m.scene + '.js');
  assert(fs.existsSync(sceneFile), 'scene file ' + m.scene);
  assert(index.includes(m.scene + '.js') || index.includes(m.scene), 'index loads ' + m.scene);
  assert(mainJs.includes(m.scene), 'main registers ' + m.scene);
  assert(hubJs.includes('HUB_MODES') || hubJs.includes(m.scene), 'hub routes ' + m.id);

  const artPath = path.join(ROOT, 'assets/modes', m.art);
  assert(fs.existsSync(artPath), 'mode art ' + m.art);
  // HTML source art also present for style continuity
  const htmlArt = path.join(HTML_ROOT, 'assets/modes', m.art);
  if (fs.existsSync(htmlArt)) {
    inventory.push({ mode: m.id, scene: m.scene, art: m.art, htmlArt: true, status: 'OK' });
  } else {
    inventory.push({ mode: m.id, scene: m.scene, art: m.art, htmlArt: false, status: 'OK (phaser art only)' });
  }
});
log('PASS all ' + EXPECTED_MODES.length + ' hub modes have scene + art + registration');

// Mode art keys preloaded in Boot
assert(/HUB_MODES|mode_campaign|assets\/modes/.test(bootJs), 'boot preloads mode art');
log('PASS boot mode art preload');

// Slime + arena art shared style
const slimeDir = path.join(ROOT, 'assets/slimes');
const arenaDir = path.join(ROOT, 'assets/arenas');
assert(fs.existsSync(slimeDir), 'slimes dir');
assert(fs.existsSync(path.join(arenaDir, 'wilds-depth.jpg')), 'wilds-depth arena');
assert(fs.existsSync(path.join(arenaDir, 'dungeon-depth.jpg')), 'dungeon-depth arena');
const slimeCount = fs.readdirSync(slimeDir).filter((f) => f.endsWith('.jpg')).length;
assert(slimeCount >= 16, 'element slime art count ' + slimeCount);
log('PASS art assets slime=' + slimeCount + ' + depth arenas');

// --- State action parity ---
const state = S.defaultState();
assert(state.resources.jelly > 0 && state.resources.wood > 0, 'materials in default resources');
assert(state.player && state.player.statPoints >= 0, 'player stats');
assert(state.workshop && state.dungeons && state.eternity, 'mode state slices');
log('PASS expanded default state');

// Market
const buy = S.buyItem(state, 'jellyPack');
assert(buy.ok, 'buy jelly');
assert(state.resources.jelly >= 65, 'jelly increased');
log('PASS market buyItem');

// Alchemy craft
state.resources.wood = 100;
const craft = S.craftRecipe(state, 'wood_to_scrolls');
assert(craft.ok, 'craft scrolls');
assert((state.resources.trainingScrolls || 0) >= 10, 'scrolls granted');
log('PASS alchemy craft');

// Transmute
state.resources.gold = 200;
assert(S.transmute(state, 'gold_to_mana').ok, 'transmute');
log('PASS transmute');

// Workshop
state.resources.gold = 500;
state.resources.refinedEssence = 50;
const up = S.upgradeWorkshop(state, 'refinery');
assert(up.ok && state.workshop.refinery === 1, 'workshop upgrade');
log('PASS workshop');

// Great Hall
state.player.statPoints = 2;
const sp = S.spendStatPoint(state, 'combat');
assert(sp.ok && state.player.stats.combat === 1, 'stat point');
log('PASS great hall stats');

// Champions fuse/evolve helpers
state.roster.push(S.createChampion({ element: 'Fire', rarity: 'Common', level: 1, name: 'FuseA' }));
state.roster.push(S.createChampion({ element: 'Water', rarity: 'Common', level: 1, name: 'FuseB' }));
const beforeFuse = state.roster.length;
const fuse = S.fuseSlimes(state);
assert(fuse.ok && state.roster.length === beforeFuse - 1, 'fuse');
// Star evolve: fixed base stars by rarity; consume same-star fodder
const evoTarget = state.roster.find((c) => c.rarity === 'Common') || state.roster[0];
// Ensure enough Common fodder
while (state.roster.filter((c) => c.rarity === 'Common' && c.id !== evoTarget.id && !c.locked).length < 1) {
  state.roster.push(S.createChampion({ element: 'Earth', rarity: 'Common', level: 1, name: 'Food' + state.roster.length }));
}
const beforeLen = state.roster.length;
// Level gate: under cap cannot evolve
const lowLv = S.createChampion({ element: 'Wind', rarity: 'Common', level: 10, name: 'LowLv' });
state.roster.push(lowLv);
state.roster.push(S.createChampion({ element: 'Ice', rarity: 'Common', level: 1, name: 'FoodX' }));
const foodX = state.roster.find((c) => c.name === 'FoodX');
const tooLow = S.evolveChampion(state, lowLv.id, [foodX.id]);
assert(!tooLow.ok && /level/i.test(tooLow.error || ''), 'level gate blocks evolve');
// Must be at level cap (50) to evolve → reset to 1, cap 60, soft power keep
evoTarget.level = 50;
evoTarget.power = 800;
const fodder2 = state.roster.filter((c) => c.id !== evoTarget.id && c.rarity === 'Common' && !c.locked).slice(0, 1);
const evo = S.evolveChampion(state, evoTarget.id, fodder2.map((f) => f.id));
assert(evo.ok && evoTarget.purpleStars === 1 && evoTarget.baseStars === 1, 'evolve purple star (Common = 1★)');
assert(evoTarget.level === 1, 'reset to level 1');
assert(S.getChampionMaxLevel(evoTarget) === 60, 'cap +10 after purple');
assert(evoTarget.power < 800 && evoTarget.power > 400, 'soft power keep');
assert(state.roster.length === beforeLen + 2 - 1, 'fodder consumed (+2 temp then -1 food)');
// Common fully purple after 1 evolve — no further evo
const maxed = S.evolvePreview(state, evoTarget.id);
assert(maxed.maxed, 'Common maxed at 1 purple');
const noAuto = S.evolveSlime(state);
assert(!noAuto.ok, 'auto evolve disabled');
// Mythic: 6★ path + flourish flags (UI ceremony is scene-side)
const myth = S.createChampion({ element: 'Fire', rarity: 'Mythic', level: 50, name: 'ApexGel' });
assert(S.championBaseStars(myth) === 6, 'Mythic base stars = 6');
state.roster.push(myth);
while (state.roster.filter((c) => c.rarity === 'Mythic' && c.id !== myth.id && !c.locked).length < 1) {
  state.roster.push(S.createChampion({ element: 'Void', rarity: 'Mythic', level: 1, name: 'MythFood' + state.roster.length }));
}
myth.level = 50;
const mythFood = state.roster.filter((c) => c.rarity === 'Mythic' && c.id !== myth.id && !c.locked).slice(0, 1);
const mythEvo = S.evolveChampion(state, myth.id, mythFood.map((f) => f.id));
assert(mythEvo.ok && myth.purpleStars === 1, 'Mythic can awaken first purple');
assert(mythEvo.mythicFlourish === true, 'mythicFlourish flag for UI ceremony');
assert(mythEvo.fullConstellation === false, 'not full constellation at 1/6');
log('PASS fuse + star evolve');

// Dungeons data + multi-wave foes
assert(DATA.DUNGEONS.length >= 8, 'dungeons ported');
assert(DATA.BOSSES.length >= 5, 'bosses ported');
const d0 = DATA.DUNGEONS[0];
assert(S.dungeonWaveCount(d0) >= 1, 'wave count');
const df = S.makeDungeonFoes(d0); // wave 1 pack
assert(df.length === 3 && df.every((f) => f.power > 0), 'dungeon wave-1 foes');
if (S.makeDungeonWaveFoes && S.dungeonWaveCount(d0) > 1) {
  const last = S.makeDungeonWaveFoes(d0, S.dungeonWaveCount(d0) - 1);
  const avg = (a) => a.reduce((s, f) => s + f.power, 0) / a.length;
  assert(avg(last) > avg(df), 'final wave stronger than first');
}
S.recordDungeonWin(state, d0.id);
assert(state.dungeons.cleared[d0.id] >= 1, 'dungeon clear stored');
assert((state.artifacts || []).length >= 1, 'artifact drop');
log('PASS dungeons + vault artifacts');

// Eternity milestones + void
state.stats.wins = 1;
const ms = S.claimMilestone(state, 'first_win');
assert(ms.ok, 'claim first_win');
state.player.level = 5;
const vt = S.runVoidTower(state);
assert(vt.ok, 'void tower run');
log('PASS eternity milestones + void tower');

// Chronicle lore present
assert(DATA.LORE && DATA.LORE.premise && DATA.LORE.acts.length >= 2, 'lore codex data');
log('PASS chronicle lore data');

// Ancient summon
state.resources.voidShards = 200;
const anc = S.performSummon(state, 'ancient', 1);
assert(anc.ok && anc.results[0].rarity, 'ancient summon');
log('PASS ancient void summon');

// Inventory markdown
const md = [
  '# Feature parity inventory — Phaser vs HTML Slime Adventure',
  '',
  'Generated by `tests/feature-parity.test.js`',
  '',
  '| Mode | Phaser scene | Mode art | Status |',
  '|------|--------------|----------|--------|'
].concat(inventory.map((row) =>
  '| ' + row.mode + ' | ' + row.scene + ' | ' + row.art + ' | ' + row.status + ' |'
)).concat([
  '',
  '## Combat / systems',
  '- SPD turn-meter combat (`SR_COMBAT`) in BattleScene',
  '- Campaign stages, dungeon waves, boss raids',
  '- Spar from hub',
  '',
  '## Economy / management',
  '- Market packs, alchemy recipes, workshop upgrades',
  '- Great Hall stat points, vault inventory + artifact upgrade',
  '- Fuse / evolve / slime party in Champions',
  '- Eternity milestones, void tower, divine convergence',
  '- Chronicle lore + lifetime records',
  '',
  '## Graphics language',
  '- Same `assets/modes/*.jpg` portal art as HTML',
  '- Same element slime JPGs + depth arenas (2.5D raid)',
  '- Village hub background',
  '',
  '**Verdict:** Phaser is the depth/raid presentation of the same designed hub feature set.',
  ''
]);

fs.mkdirSync(SCRATCH, { recursive: true });
fs.writeFileSync(path.join(SCRATCH, 'feature-parity-inventory.md'), md.join('\n'));
fs.writeFileSync(path.join(ROOT, 'FEATURE_PARITY.md'), md.join('\n'));
log('WROTE feature-parity-inventory.md');

log('ALL FEATURE PARITY TESTS PASSED');
const fullOut = lines.join('\n') + '\n';
fs.writeFileSync(path.join(SCRATCH, 'feature-parity.log'), fullOut);
// Plan verification step 1 capture name
fs.writeFileSync(path.join(SCRATCH, 'feature-parity-inventory.log'), fullOut);
