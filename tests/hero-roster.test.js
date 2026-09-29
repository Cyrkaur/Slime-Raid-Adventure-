/* Hero roster: data shape, summon wiring, duplicate hook. */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.localStorage = global.localStorage || { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const HR = require(path.join(ROOT, 'src/data/heroRoster.js'));
const D = require(path.join(ROOT, 'src/data/gameData.js'));
const CN = require(path.join(ROOT, 'src/data/championNames.js'));
const S = require(path.join(ROOT, 'src/systems/gameState.js'));
let n = 0;
function assert(c, m) { if (!c) { console.error('FAIL ' + m); process.exit(1); } n++; }

assert(HR.ELEMENT_ORDER.length === 16, '16 elements');
D.ELEMENTS.forEach((el) => assert(HR.HERO_ROSTER[el], 'roster row ' + el));
assert(HR.listNamedHeroes().length === 48, '48 named heroes');
['Epic', 'Legendary', 'Mythic'].forEach((r) => assert(HR.listNamedHeroes(r).length === 16, '16 ' + r));
const ids = new Set();
HR.listNamedHeroes().forEach((h) => {
  assert(!ids.has(h.id), 'unique id ' + h.id); ids.add(h.id);
  assert(h.name && h.epithet && h.bio && h.bio.length > 80, 'text ' + h.id);
  assert(h.signature && h.signature.name && h.signature.stub, 'signature stub ' + h.id);
  assert(h.look && h.look.hook, 'hook ' + h.id);
});
HR.listNamedHeroes('Epic').forEach((h) => assert(h.look.body === 'morph', 'epic morph'));
HR.listNamedHeroes('Legendary').forEach((h) => assert(h.look.body === 'ascended', 'leg ascended'));
HR.listNamedHeroes('Mythic').forEach((h) => assert(h.look.body === 'humanoid', 'myth humanoid'));
D.ELEMENTS.forEach((el) => ['a', 'b', 'c'].forEach((v) => assert(HR.getSpeciesVariant(el, v), 'variant ' + el + v)));
['Common', 'Uncommon', 'Rare'].forEach((r) => assert(HR.getNamedHero('Water', r) === null, 'no named ' + r));
assert(HR.getNamedHero('Water', 'Legendary').name === 'Maris of the Last Rain', 'Maris');
assert(HR.getNamedHero('Void', 'Mythic').name === 'The Exception', 'Exception');

// Lineage names = Phaser set, legends retitled to match
assert(D.ELEMENT_LORE.Fire.title === 'Emberkin' && D.ELEMENT_LORE.Earth.title === 'Stoneward', 'phaser lineage titles');
D.ELEMENTS.forEach((el) => assert(HR.getLineage(el).lineage === D.ELEMENT_LORE[el].title, 'lineage matches ELEMENT_LORE ' + el));
assert(HR.getNamedHero('Fire', 'Legendary').title === 'Legendary Emberkin', 'legend retitled');
const codex = /\b(Emberheart|Stonegut|Zephyrkin|Bloomcore|Sparkcoil|Frostlens|Umbrawisp|Luminjelly|Chromeblob|Venomgloop|Prismheart|Magmacore|Tempestorb|Wispling|Riftgel)/;
HR.listNamedHeroes().forEach((h) => assert(!codex.test(JSON.stringify(h)), 'no codex lineage names ' + h.id));

// Name bank no longer collides with legend names
assert(CN.ELEMENT_NAMES.Fire.indexOf('Ashen') < 0 && CN.ELEMENT_NAMES.Plant.indexOf('Briar') < 0, 'Ashen/Briar dropped');

// createChampion: named for Epic+, generic below, explicit name wins
const e = S.createChampion({ element: 'Water', rarity: 'Epic' });
assert(e.name === 'Ferryman Pell' && e.heroId === 'water_epic_pell' && e.signatureSkill.name === 'Last Crossing', 'epic named');
const rare = S.createChampion({ element: 'Water', rarity: 'Rare' });
assert(rare.heroId === null && rare.name && rare.name !== 'Ferryman Pell', 'rare generic');
const custom = S.createChampion({ element: 'Water', rarity: 'Mythic', name: 'Food1' });
assert(custom.name === 'Food1' && custom.heroId === null, 'explicit name stays generic');
const lore = D.getChampionLoreBlurb(e);
assert(lore.named && lore.epithet === 'Who rowed the flood backward' && lore.championBio.indexOf('Pell') >= 0, 'named lore');
assert(D.resolveFormTier(e) === 'morph', 'epic morph tier');

// Duplicate hook via performSummon (ancient banner = Epic+ only)
const st = S.defaultState();
st.resources.voidShards = 1e6;
const origRandom = Math.random;
Math.random = () => 0.01; // always first element, lowest rarity of the table
let a = S.performSummon(st, 'ancient', 1);
if (!a.ok) { console.error(a); process.exit(1); }
const before = st.roster.length;
const first = a.results[0];
assert(first.heroId, 'ancient pull is named');
a = S.performSummon(st, 'ancient', 1);
Math.random = origRandom;
const dup = a.results[0];
assert(dup.heroId === first.heroId && dup.duplicateOf === first.id, 'duplicate flagged');
assert(st.roster.length === before + 1, 'no-op duplicate stub keeps the copy');
assert(typeof HR.onDuplicateNamedHero === 'function', 'duplicate hook exists');

console.log('PASS hero-roster (' + n + ' checks)');
