// Builds src/data/heroRoster.js from HERO_ROSTER.md + Slime Adventure lore.js
const fs = require('fs'), vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
// usage: node tools/gen-hero-roster.js <path to Slime Adventure js/data/lore.js> [out]
const md = fs.readFileSync(process.env.HERO_ROSTER_MD || path.join(ROOT, 'docs/HERO_ROSTER.md'), 'utf8');
const loreSrc = fs.readFileSync(process.argv[2], 'utf8');
const ctx = { window: {}, console: { log() {} }, document: {} };
vm.createContext(ctx);
vm.runInContext(loreSrc.replace(/^const /gm, 'var '), ctx);
const W = ctx.window;
const ELS = ['Water','Fire','Earth','Wind','Plant','Lightning','Ice','Shadow','Light','Metal','Poison','Crystal','Lava','Storm','Spirit','Void'];
const clean = s => s.replace(/\*\*/g,'').replace(/^\*|\*$/g,'').trim();
const slug = s => s.toLowerCase().replace(/^the /,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const sec = (a, b) => md.slice(md.indexOf(a), b ? md.indexOf(b) : undefined);
function tableRows(text) {
  return text.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('|---'))
    .slice(1).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
}
function sig(s) { // *Name*: text  -> stub (slot + numbers come in the combat pass)
  const m = s.match(/^\*([^*]+)\*:\s*(.*)$/);
  const name = m ? m[1].trim() : s, t = m ? m[2].trim().replace(/\.$/, '') : '';
  return { name, text: t.charAt(0).toUpperCase() + t.slice(1) + (t ? '.' : ''), slot: null, stub: true };
}
// species
const species = {};
tableRows(sec('## 2. Species', '## 3.')).forEach(r => {
  const m = r[0].match(/^(\w+) \(([^)]+)\)/); if (!m) return;
  species[m[1]] = { lineage: m[2], variants: { a: r[1], b: r[2], c: r[3] } };
});
// epics
const epics = {};
sec('## 3. NEW Epic', '## 4.').split('\n### ').slice(1).forEach(block => {
  const lines = block.split('\n');
  const [el, name] = lines[0].split(':').map(s => s.trim());
  const get = k => { const l = lines.find(x => x.startsWith('**' + k + ':**')); return l ? l.slice(k.length + 5).trim() : ''; };
  const vis = k => { const l = lines.find(x => x.startsWith('- **' + k + ':**')); return l ? l.slice(k.length + 7).trim() : ''; };
  epics[el] = {
    id: slug(el) + '_epic_' + slug(name.split(' ').slice(-1)[0] === 'Lost-and-Found' ? 'lost_and_found' : name.split(' ').pop()),
    name, epithet: clean(lines[1]).replace(/^"|"$/g, ''),
    bio: get('Bio'), role: get('Role').replace(/\.$/, ''), signature: sig(get('Signature skill')),
    look: { body: 'morph', hook: vis('Hook'), ornaments: vis('Ornaments'), gel: vis('Gel twist'), eyes: vis('Eyes'), idle: vis('Idle') }
  };
});
function legendTable(a, b, tier, body, src) {
  const out = {};
  tableRows(sec(a, b)).forEach(r => {
    const el = r[0]; const L = src[el];
    if (!L) throw new Error('lore missing ' + tier + ' ' + el);
    if (L.name !== r[1]) console.error('NAME MISMATCH', el, L.name, '|', r[1]);
    out[el] = {
      id: slug(el) + '_' + tier + '_' + slug(L.name).split('_').filter(w => !['of','the','that','had','a'].includes(w)).slice(0, 2).join('_'),
      name: L.name, title: L.title, epithet: L.epithet, bio: L.bio,
      role: null, signature: sig(r[7]),
      look: { body, hook: r[3], ornaments: r[4], eyes: r[5], idle: r[6] }
    };
  });
  return out;
}
const legs = legendTable('## 4. Legendary', '## 5.', 'leg', 'ascended', W.LEGENDARY_LEGENDS);
const myths = legendTable('## 5. Mythic', '## 6.', 'myth', 'humanoid', W.MYTHIC_LEGENDS);
const roster = {};
ELS.forEach(el => {
  const lore = W.ELEMENT_LORE[el];
  if (!species[el] || !epics[el] || !legs[el] || !myths[el]) throw new Error('missing ' + el);
  if (species[el].lineage !== lore.title) console.error('LINEAGE MISMATCH', el, species[el].lineage, lore.title);
  // epic role: element role from codex lore unless the doc gives one
  roster[el] = { species: species[el], epic: epics[el], legendary: legs[el], mythic: myths[el] };
});
// Codex lineage names + blurbs (so the Phaser ELEMENT_LORE can switch)
const lineages = {};
ELS.forEach(el => { const l = W.ELEMENT_LORE[el]; lineages[el] = { title: l.title, role: l.role, blurb: l.blurb, personality: l.personality, extended: l.extended }; });
const ids = new Set();
ELS.forEach(el => ['epic','legendary','mythic'].forEach(t => { const id = roster[el][t].id; if (ids.has(id)) throw new Error('dup id ' + id); ids.add(id); }));
const J = o => JSON.stringify(o, null, 2).replace(/\n/g, '\n  ');
const out = `/* ===== Hero roster: species lineages + named Epic / Legendary / Mythic heroes =====
 * GENERATED from docs/HERO_ROSTER.md and Slime Adventure js/data/lore.js
 * (LEGENDARY_LEGENDS / MYTHIC_LEGENDS / ELEMENT_LORE copied verbatim).
 * Regenerate with tools/gen-hero-roster.js rather than hand-editing the data blocks.
 *
 * Common / Uncommon / Rare  = species: lineage + variant a/b/c + generated name.
 * Epic / Legendary / Mythic = one named hero per element (see getNamedHero).
 *
 * Founder decisions still open. Defaults live in HERO_ROSTER_CONFIG so they are
 * one-line changes:
 *   - lineageNames: 'codex' (Emberheart, Stonegut, Zephyrkin...) or 'phaser'
 *     (the older Phaser titles: Emberkin, Stoneward, Zephyr...).
 *   - duplicate named pulls: onDuplicateNamedHero() is the only hook.
 *     Placeholder policy converts the duplicate to shards; the shard values are
 *     untuned placeholders (0) until the founder sets them.
 */
(function (global) {
  'use strict';

  var HERO_ROSTER_CONFIG = {
    lineageNames: 'codex',
    namedRarities: ['Epic', 'Legendary', 'Mythic'],
    duplicatePolicy: 'shards',
    /** Placeholder, NOT tuned. Founder to set real values. */
    duplicateShardValue: { Epic: 0, Legendary: 0, Mythic: 0 },
    duplicateShardCurrency: 'slimeShards'
  };

  var ELEMENT_ORDER = ${JSON.stringify(ELS)};

  /** Codex lineage titles and blurbs (Slime Adventure ELEMENT_LORE). */
  var CODEX_LINEAGES = ${J(lineages)};

  var HERO_ROSTER = ${J(roster)};

  var RARITY_KEY = { Epic: 'epic', Legendary: 'legendary', Mythic: 'mythic' };
  var BY_ID = {};
  ELEMENT_ORDER.forEach(function (el) {
    ['epic', 'legendary', 'mythic'].forEach(function (k) {
      var h = HERO_ROSTER[el][k];
      h.element = el;
      h.rarity = k.charAt(0).toUpperCase() + k.slice(1);
      BY_ID[h.id] = h;
    });
  });

  function normEl(element) {
    var s = String(element || '');
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  /** Named hero for element × rarity, or null for Common/Uncommon/Rare. */
  function getNamedHero(element, rarity) {
    if (HERO_ROSTER_CONFIG.namedRarities.indexOf(rarity) < 0) return null;
    var row = HERO_ROSTER[normEl(element)];
    return row ? row[RARITY_KEY[rarity]] || null : null;
  }

  function getHeroById(id) { return (id && BY_ID[id]) || null; }

  function getLineage(element) {
    var row = HERO_ROSTER[normEl(element)];
    return row ? row.species : null;
  }

  /** Species variant look for a/b/c (null for unknown). */
  function getSpeciesVariant(element, variant) {
    var sp = getLineage(element);
    return sp ? sp.variants[String(variant || 'a').toLowerCase()] || null : null;
  }

  /** All named heroes (48), optionally filtered by rarity. */
  function listNamedHeroes(rarity) {
    return Object.keys(BY_ID).map(function (k) { return BY_ID[k]; })
      .filter(function (h) { return !rarity || h.rarity === rarity; });
  }

  /** Does this roster already own the named hero? */
  function findOwnedNamedHero(roster, heroId) {
    if (!heroId || !Array.isArray(roster)) return null;
    for (var i = 0; i < roster.length; i++) if (roster[i] && roster[i].heroId === heroId) return roster[i];
    return null;
  }

  /**
   * The one hook for duplicate named pulls. Called by performSummon when a pull
   * resolves to a named hero the player already owns.
   * Returns { keep: boolean, converted: {currency, amount} | null }.
   * Placeholder policy 'shards': do not add the copy; grant duplicateShardValue
   * (untuned, 0 by default) and count the dupe on the owned unit.
   */
  function onDuplicateNamedHero(state, pulled, owned) {
    var cfg = HERO_ROSTER_CONFIG;
    if (cfg.duplicatePolicy === 'keep') return { keep: true, converted: null };
    var amount = (cfg.duplicateShardValue && cfg.duplicateShardValue[pulled.rarity]) || 0;
    var cur = cfg.duplicateShardCurrency;
    if (state && state.resources && amount) state.resources[cur] = (state.resources[cur] || 0) + amount;
    if (owned) owned.namedDupes = (owned.namedDupes || 0) + 1;
    return { keep: false, converted: { currency: cur, amount: amount } };
  }

  var API = {
    HERO_ROSTER_CONFIG: HERO_ROSTER_CONFIG,
    HERO_ROSTER: HERO_ROSTER,
    CODEX_LINEAGES: CODEX_LINEAGES,
    ELEMENT_ORDER: ELEMENT_ORDER,
    getNamedHero: getNamedHero,
    getHeroById: getHeroById,
    getLineage: getLineage,
    getSpeciesVariant: getSpeciesVariant,
    listNamedHeroes: listNamedHeroes,
    findOwnedNamedHero: findOwnedNamedHero,
    onDuplicateNamedHero: onDuplicateNamedHero
  };

  global.SR_HERO_ROSTER = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : global);
`;
fs.writeFileSync(process.argv[3] || path.join(ROOT, 'src/data/heroRoster.js'), out);
console.log('ok', Object.keys(roster).length, 'elements', ids.size, 'named');
