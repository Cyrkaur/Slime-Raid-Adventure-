/* ===== js/data/constants.js — split from Single File/index-3.html ===== */

// ==================== CONSTANTS ====================
const elements = ["Water","Fire","Earth","Wind","Plant","Lightning","Ice","Shadow","Light","Metal","Poison","Crystal","Lava","Storm","Spirit","Void"];
/** Legacy single-name lookup (kept for older code paths). Prefer SLIME_SPECIES / champions. */
const names = {
    Water: ["Aqua Slime"], Fire: ["Blaze Slime"], Earth: ["Terra Slime"], Wind: ["Zephyr Slime"],
    Plant: ["Bloom Slime"], Lightning: ["Bolt Slime"], Ice: ["Frost Slime"], Shadow: ["Shade Slime"],
    Light: ["Lumina Slime"], Metal: ["Steel Slime"], Poison: ["Venom Slime"], Crystal: ["Gem Slime"],
    Lava: ["Magma Slime"], Storm: ["Tempest Slime"], Spirit: ["Wisp Slime"], Void: ["Abyss Slime"]
};

/**
 * Raid-style species names for Common / Uncommon / Rare.
 * These are types of slime (many copies), not unique characters.
 */
const SLIME_SPECIES = {
    Water:     { type: 'Aqua Slime',     title: 'Aqua' },
    Fire:      { type: 'Blaze Slime',    title: 'Blaze' },
    Earth:     { type: 'Terra Slime',    title: 'Terra' },
    Wind:      { type: 'Zephyr Slime',   title: 'Zephyr' },
    Plant:     { type: 'Bloom Slime',    title: 'Bloom' },
    Lightning: { type: 'Bolt Slime',     title: 'Bolt' },
    Ice:       { type: 'Frost Slime',    title: 'Frost' },
    Shadow:    { type: 'Shade Slime',    title: 'Shade' },
    Light:     { type: 'Lumina Slime',   title: 'Lumina' },
    Metal:     { type: 'Steel Slime',    title: 'Steel' },
    Poison:    { type: 'Venom Slime',    title: 'Venom' },
    Crystal:   { type: 'Prism Slime',    title: 'Prism' },
    Lava:      { type: 'Magma Slime',    title: 'Magma' },
    Storm:     { type: 'Tempest Slime',  title: 'Tempest' },
    Spirit:    { type: 'Wisp Slime',     title: 'Wisp' },
    Void:      { type: 'Abyss Slime',    title: 'Abyss' }
};

function getSlimeSpeciesName(element, rarity = 'Common') {
    const sp = SLIME_SPECIES[element];
    const base = sp?.type || `${element} Slime`;
    // Rare types still use the species name (Raid fill-rarity feel); badge shows rarity
    if (rarity === 'Uncommon' && sp) return base;
    if (rarity === 'Rare' && sp) return base;
    return base;
}

function isChampionRarity(rarity) {
    return rarity === 'Epic' || rarity === 'Legendary' || rarity === 'Mythic';
}

const TRAINING_MISSIONS = [
    { id: "quick", name: "Quick Session", durationMinutes: 10, expPerSlime: 22, desc: "Short practice" },
    { id: "focused", name: "Focused Training", durationMinutes: 30, expPerSlime: 75, desc: "Good workout" },
    { id: "rigorous", name: "Rigorous Drill", durationMinutes: 90, expPerSlime: 260, desc: "Hard training" },
    { id: "endurance", name: "Endurance Training", durationMinutes: 180, expPerSlime: 580, desc: "Long dedicated session" },
    { id: "master", name: "Master Regimen", durationMinutes: 360, expPerSlime: 1250, desc: "Maximum long-term gains (best for overnight)" }
];

const ELEMENT_CHART = {
    Water: { strong: ["Fire", "Lava"], weak: ["Lightning", "Ice", "Plant"] },
    Fire: { strong: ["Plant", "Ice", "Wind"], weak: ["Water", "Earth", "Lava"] },
    Earth: { strong: ["Lightning", "Fire", "Poison"], weak: ["Wind", "Water", "Plant"] },
    Wind: { strong: ["Plant", "Poison", "Earth"], weak: ["Lightning", "Ice", "Storm"] },
    Plant: { strong: ["Water", "Earth", "Poison"], weak: ["Fire", "Lava", "Wind"] },
    Lightning: { strong: ["Water", "Wind", "Metal"], weak: ["Earth", "Plant", "Storm"] },
    Ice: { strong: ["Water", "Plant", "Wind"], weak: ["Fire", "Lava", "Lightning"] },
    Shadow: { strong: ["Light", "Spirit", "Void"], weak: ["Light", "Crystal", "Storm"] },
    Light: { strong: ["Shadow", "Void", "Poison"], weak: ["Shadow", "Void", "Metal"] },
    Metal: { strong: ["Lightning", "Ice", "Crystal"], weak: ["Fire", "Lava", "Poison"] },
    Poison: { strong: ["Plant", "Water", "Spirit"], weak: ["Earth", "Wind", "Light"] },
    Crystal: { strong: ["Shadow", "Void", "Lightning"], weak: ["Metal", "Fire", "Lava"] },
    Lava: { strong: ["Plant", "Ice", "Metal"], weak: ["Water", "Earth", "Wind"] },
    Storm: { strong: ["Wind", "Lightning", "Water"], weak: ["Earth", "Metal", "Crystal"] },
    Spirit: { strong: ["Shadow", "Poison", "Void"], weak: ["Light", "Crystal", "Metal"] },
    Void: { strong: ["Light", "Shadow", "Spirit"], weak: ["Crystal", "Storm", "Metal"] }
};

const bossData = {
    fire_dragon: { name: "Fire Dragon", element: "Fire", basePower: 180 },
    stone_golem: { name: "Stone Golem", element: "Earth", basePower: 260 },
    ancient_treant: { name: "Ancient Treant", element: "Plant", basePower: 380 },
    shadow_lich: { name: "Shadow Lich", element: "Shadow", basePower: 520 },
    storm_sovereign: { name: "Storm Sovereign", element: "Storm", basePower: 680 },
    divine_colossus: { name: "Divine Colossus", element: "Light", basePower: 920 }
};

// Campaign energy
const MAX_ENERGY = 140;
const ENERGY_REGEN_MS = 135000; // ~2.25 min per energy
const ENERGY_REFILL_DIVINE_COST = 10;
const ENERGY_REFILL_DIVINE_AMOUNT = 75;
const CAMPAIGN_MODE_MULT = { normal: 1, hard: 1.45, nightmare: 2.0 };
const CAMPAIGN_REWARD_MULT = { normal: 1, hard: 1.55, nightmare: 2.2 };
const SWEEP_REWARD_MULT = 0.72;

const CAMPAIGN_DUNGEON_UNLOCKS = {
    forest_depths: 1, crystal_caverns: 2, shadow_abyss: 3, ancient_temple: 3,
    molten_core: 4, glacial_spire: 4, thunder_sanctum: 5, abyssal_throne: 5, origin_core: 5
};
const CAMPAIGN_BOSS_UNLOCKS = {
    fire_dragon: 1, stone_golem: 2, ancient_treant: 3, shadow_lich: 3,
    storm_sovereign: 4, divine_colossus: 5
};

function getElementCounter(element) {
    const chart = ELEMENT_CHART[element];
    return (chart && chart.strong[0]) ? chart.strong[0] : 'Fire';
}

function buildCampaignStages(chapterId, names, basePower, elemPool, energyBase, diffLabel) {
    return names.map((name, i) => {
        const isBoss = i === names.length - 1;
        const elem = elemPool[i % elemPool.length];
        // Soft intro: first fights are 1v1 so a single starter slime can clear them
        let enemyCount;
        if (isBoss) {
            enemyCount = 1;
        } else if (chapterId === 1 && i === 0) {
            enemyCount = 1; // Forest Ambush — tutorial 1v1
        } else if (chapterId === 1 && i < 3) {
            enemyCount = 1; // early chapter 1 stays solo enemies
        } else {
            enemyCount = Math.min(4, 2 + Math.floor(i / 3));
        }
        return {
            id: `ch${chapterId}_s${i + 1}`,
            chapterId,
            num: i + 1,
            label: `${chapterId}-${i + 1}`,
            name,
            energy: energyBase + Math.floor(i / 2) + (isBoss ? 3 : 0),
            power: basePower + i * (10 + chapterId * 3) + (isBoss ? 35 + chapterId * 18 : 0),
            enemies: enemyCount,
            isBoss,
            element: elem,
            forcedElement: (!isBoss && i % 4 === 3) ? elem : null,
            modifier: isBoss ? null : (i === 5 ? `All enemies are ${elemPool[0]} type` : null),
            recElement: getElementCounter(elem),
            turnLimit: 16 + Math.floor(i / 2) + chapterId * 2 + (isBoss ? 4 : 0),
            slimeChance: 0.1 + chapterId * 0.035 + (isBoss ? 0.2 : 0),
            exploreDiff: diffLabel,
            gold: 6 + i * 2 + chapterId * 4 + (isBoss ? 25 : 0),
            shards: 1 + Math.floor(i / 2) + Math.floor(chapterId / 2),
            exp: 4 + i + chapterId * 2 + (isBoss ? 12 : 0)
        };
    });
}

/**
 * Regional campaign foes — wildlife, people, spirits of each map (not only wild slimes).
 * Your team is slimes; the world fights back with what lives there.
 * role: brute | striker | assassin | tank | support | mage
 * kind: human | beast | spirit | construct | undead | elemental
 */
const FOE_ROLE_SKILLS = {
    brute:    ['basic', 'tank_passive'],
    striker:  ['basic', 'inferno'],
    assassin: ['basic', 'poison', 'crit_passive'],
    tank:     ['basic', 'shield', 'tank_passive'],
    support:  ['basic', 'heal', 'shield'],
    mage:     ['basic', 'splash', 'poison'],
    boss:     ['basic', 'inferno', 'shield', 'tank_passive']
};

const REGION_FOE_POOLS = {
    1: [ // Verdant Wilds — forests, trails, river towns
        { name: 'Forest Bandit', icon: '🗡️', element: 'Earth', role: 'striker', kind: 'human' },
        { name: 'Wild Boar', icon: '🐗', element: 'Earth', role: 'brute', kind: 'beast' },
        { name: 'Briar Wolf', icon: '🐺', element: 'Wind', role: 'assassin', kind: 'beast' },
        { name: 'Village Militia', icon: '🪓', element: 'Metal', role: 'tank', kind: 'human' },
        { name: 'River Thief', icon: '🪝', element: 'Water', role: 'striker', kind: 'human' },
        { name: 'Web Weaver', icon: '🕷️', element: 'Poison', role: 'assassin', kind: 'beast' },
        { name: 'Forest Archer', icon: '🏹', element: 'Wind', role: 'striker', kind: 'human' },
        { name: 'Mosshide Bear', icon: '🐻', element: 'Plant', role: 'tank', kind: 'beast' },
        { name: 'Highwayman', icon: '🤠', element: 'Shadow', role: 'assassin', kind: 'human' },
        { name: 'Spriggan', icon: '🌿', element: 'Plant', role: 'mage', kind: 'spirit' },
        { name: 'Trail Scout', icon: '🧭', element: 'Earth', role: 'support', kind: 'human' },
        { name: 'Grove Poacher', icon: '🏹', element: 'Plant', role: 'striker', kind: 'human' },
        { name: 'Thicket Bandit', icon: '🗡️', element: 'Plant', role: 'assassin', kind: 'human' },
        { name: 'Dire Stag', icon: '🦌', element: 'Plant', role: 'brute', kind: 'beast' }
    ],
    2: [ // Shadowed Peaks — mountains, ice, caves
        { name: 'Mountain Raider', icon: '⛏️', element: 'Earth', role: 'brute', kind: 'human' },
        { name: 'Ice Wolf', icon: '🦊', element: 'Ice', role: 'assassin', kind: 'beast' },
        { name: 'Cave Bat', icon: '🦇', element: 'Shadow', role: 'striker', kind: 'beast' },
        { name: 'Crystal Golem', icon: '🗿', element: 'Crystal', role: 'tank', kind: 'construct' },
        { name: 'Storm Eagle', icon: '🦅', element: 'Lightning', role: 'striker', kind: 'beast' },
        { name: 'Frost Ranger', icon: '🎿', element: 'Ice', role: 'striker', kind: 'human' },
        { name: 'Yeti Scout', icon: '🦍', element: 'Ice', role: 'brute', kind: 'beast' },
        { name: 'Peak Cultist', icon: '🕯️', element: 'Storm', role: 'mage', kind: 'human' },
        { name: 'Stone Sentinel', icon: '🪨', element: 'Earth', role: 'tank', kind: 'construct' },
        { name: 'Cliff Assassin', icon: '🗡️', element: 'Wind', role: 'assassin', kind: 'human' },
        { name: 'Thunder Goat', icon: '🐐', element: 'Lightning', role: 'brute', kind: 'beast' },
        { name: 'Mist Shaman', icon: '🔮', element: 'Wind', role: 'support', kind: 'human' }
    ],
    3: [ // Murk & Ruins — swamp, temples, undead
        { name: 'Swamp Lizard', icon: '🦎', element: 'Poison', role: 'assassin', kind: 'beast' },
        { name: 'Bog Cultist', icon: '🧙', element: 'Shadow', role: 'mage', kind: 'human' },
        { name: 'Ruin Guard', icon: '⚔️', element: 'Metal', role: 'tank', kind: 'construct' },
        { name: 'Plague Rat', icon: '🐀', element: 'Poison', role: 'striker', kind: 'beast' },
        { name: 'Bog Witch', icon: '🧹', element: 'Poison', role: 'mage', kind: 'human' },
        { name: 'Skeleton Warrior', icon: '💀', element: 'Shadow', role: 'striker', kind: 'undead' },
        { name: 'Temple Raider', icon: '🏺', element: 'Earth', role: 'brute', kind: 'human' },
        { name: 'Shadow Assassin', icon: '🥷', element: 'Shadow', role: 'assassin', kind: 'human' },
        { name: 'Mire Croc', icon: '🐊', element: 'Water', role: 'tank', kind: 'beast' },
        { name: 'Archivist Wraith', icon: '👻', element: 'Spirit', role: 'mage', kind: 'undead' },
        { name: 'Poison Mire Toad', icon: '🐸', element: 'Poison', role: 'support', kind: 'beast' },
        { name: 'Cursed Knight', icon: '🛡️', element: 'Metal', role: 'tank', kind: 'undead' }
    ],
    4: [ // Scorched Frontiers — volcano + tundra extremes
        { name: 'Ash Raider', icon: '🔥', element: 'Fire', role: 'striker', kind: 'human' },
        { name: 'Magma Elemental', icon: '🌋', element: 'Lava', role: 'mage', kind: 'elemental' },
        { name: 'Frost Knight', icon: '🧊', element: 'Ice', role: 'tank', kind: 'human' },
        { name: 'Ember Hound', icon: '🐕', element: 'Fire', role: 'assassin', kind: 'beast' },
        { name: 'Blizzard Mage', icon: '❄️', element: 'Ice', role: 'mage', kind: 'human' },
        { name: 'Lava Salamander', icon: '🦎', element: 'Lava', role: 'brute', kind: 'beast' },
        { name: 'Storm Front Scout', icon: '⛈️', element: 'Storm', role: 'striker', kind: 'human' },
        { name: 'Glacial Titanling', icon: '🏔️', element: 'Ice', role: 'tank', kind: 'elemental' },
        { name: 'Fire Cult Zealot', icon: '🕯️', element: 'Fire', role: 'brute', kind: 'human' },
        { name: 'Molten Construct', icon: '⚙️', element: 'Lava', role: 'tank', kind: 'construct' },
        { name: 'Ice Drake Whelp', icon: '🐉', element: 'Ice', role: 'striker', kind: 'beast' },
        { name: 'Ashen Priest', icon: '📿', element: 'Fire', role: 'support', kind: 'human' }
    ],
    5: [ // Celestial Depths — void, divine, cosmic threats
        { name: 'Void Cultist', icon: '🌑', element: 'Void', role: 'mage', kind: 'human' },
        { name: 'Starlight Warden', icon: '✨', element: 'Light', role: 'tank', kind: 'spirit' },
        { name: 'Abyss Horror', icon: '🦑', element: 'Void', role: 'brute', kind: 'beast' },
        { name: 'Divine Construct', icon: '🤖', element: 'Light', role: 'tank', kind: 'construct' },
        { name: 'Cosmic Serpent', icon: '🐍', element: 'Spirit', role: 'assassin', kind: 'beast' },
        { name: 'Nexus Inquisitor', icon: '⚖️', element: 'Crystal', role: 'striker', kind: 'human' },
        { name: 'Shadow of Origin', icon: '👤', element: 'Shadow', role: 'assassin', kind: 'spirit' },
        { name: 'Celestial Archer', icon: '🏹', element: 'Light', role: 'striker', kind: 'spirit' },
        { name: 'Voidspawn', icon: '👾', element: 'Void', role: 'brute', kind: 'beast' },
        { name: 'Spire Guardian', icon: '🗼', element: 'Crystal', role: 'tank', kind: 'construct' },
        { name: 'Astral Mage', icon: '🌟', element: 'Spirit', role: 'mage', kind: 'human' },
        { name: 'Remnant Herald', icon: '👑', element: 'Void', role: 'boss', kind: 'spirit' }
    ]
};

/** Named chapter bosses (stage bosses) — still regional beings, not slime twins */
const REGION_BOSS_FOES = {
    1: { name: 'Guardian of the Green', icon: '🌳', element: 'Plant', role: 'boss', kind: 'spirit' },
    2: { name: 'Peak Tyrant', icon: '🏔️', element: 'Ice', role: 'boss', kind: 'beast' },
    3: { name: 'Treant Grove Siege', icon: '🌲', element: 'Plant', role: 'boss', kind: 'spirit' },
    4: { name: 'Dual Element Lord', icon: '☯️', element: 'Lava', role: 'boss', kind: 'elemental' },
    5: { name: 'Slime God Remnant', icon: '👑', element: 'Void', role: 'boss', kind: 'spirit' }
};

/** Arena / dungeon / tower — mixed world threats when not on a campaign map */
const WORLD_FOE_POOL = [
    { name: 'Mercenary', icon: '⚔️', element: 'Metal', role: 'striker', kind: 'human' },
    { name: 'Dire Wolf', icon: '🐺', element: 'Wind', role: 'assassin', kind: 'beast' },
    { name: 'Rogue Mage', icon: '🔮', element: 'Lightning', role: 'mage', kind: 'human' },
    { name: 'Stone Golem', icon: '🗿', element: 'Earth', role: 'tank', kind: 'construct' },
    { name: 'Pirate Cutthroat', icon: '🏴‍☠️', element: 'Water', role: 'striker', kind: 'human' },
    { name: 'Desert Scorpion', icon: '🦂', element: 'Poison', role: 'assassin', kind: 'beast' },
    { name: 'Flame Imp', icon: '😈', element: 'Fire', role: 'mage', kind: 'spirit' },
    { name: 'Ice Knight', icon: '🛡️', element: 'Ice', role: 'tank', kind: 'human' },
    { name: 'Shadow Stalker', icon: '🥷', element: 'Shadow', role: 'assassin', kind: 'human' },
    { name: 'Thunder Hawk', icon: '🦅', element: 'Lightning', role: 'striker', kind: 'beast' },
    { name: 'Crystal Warden', icon: '💎', element: 'Crystal', role: 'support', kind: 'construct' },
    { name: 'Void Touched', icon: '🕳️', element: 'Void', role: 'brute', kind: 'human' },
    { name: 'Grove Druid', icon: '🍃', element: 'Plant', role: 'support', kind: 'human' },
    { name: 'Lava Beetle', icon: '🪲', element: 'Lava', role: 'brute', kind: 'beast' },
    { name: 'Storm Zealot', icon: '⚡', element: 'Storm', role: 'mage', kind: 'human' },
    { name: 'Spirit Wisp', icon: '👻', element: 'Spirit', role: 'mage', kind: 'spirit' }
];

const CAMPAIGN_CHAPTERS = [
    {
        id: 1, name: 'Verdant Wilds', icon: '🌲',
        story: 'Bandits haunt the trails, wolves hunt the thickets, and river towns hire any slime bold enough to keep the roads clear.',
        playerLevel: 1, unlockChapter: null,
        stages: buildCampaignStages(1, [
            'Forest Ambush', 'Mossy Trail', 'Berry Thicket', 'Town Outskirts',
            'Plains Patrol', 'Sapling Grove', 'Wild Bloom', 'River Crossing',
            'Elder Tree', 'Guardian of the Green'
        ], 28, ['Plant', 'Earth', 'Wind', 'Water'], 6, 'Easy')
    },
    {
        id: 2, name: 'Shadowed Peaks', icon: '⛰️',
        story: 'Icy cliffs and crystal caves. Raiders, golems, and mountain beasts guard the passes to the summit.',
        playerLevel: 5, unlockChapter: 1,
        stages: buildCampaignStages(2, [
            'Mountain Pass', 'Crystal Shore', 'Echoing Cave', 'Frozen Ledge',
            'Thunder Ridge', 'Mist Valley', 'Stone Sentinel', 'Deep Cavern',
            'Summit Trial', 'Peak Tyrant'
        ], 70, ['Ice', 'Earth', 'Lightning', 'Wind'], 7, 'Medium')
    },
    {
        id: 3, name: 'Murk & Ruins', icon: '🏛️',
        story: 'Swamps and forgotten temples: cultists, undead, and mire beasts stalk the rot. Bring a balanced team.',
        playerLevel: 12, unlockChapter: 2,
        stages: buildCampaignStages(3, [
            'Swamp Edge', 'Sunken Path', 'Ruin Gate', 'Mystic Clearing',
            'Poison Mire', 'Lost Archive', 'Grove Warden', 'Shadow Pool',
            'Lich Approach', 'Treant Grove Siege'
        ], 130, ['Poison', 'Shadow', 'Plant', 'Earth'], 8, 'Hard')
    },
    {
        id: 4, name: 'Scorched Frontiers', icon: '🌋',
        story: 'Volcanic ash and eternal ice. Elementals, knights, and cult zealots test every champion you raise.',
        playerLevel: 25, unlockChapter: 3,
        stages: buildCampaignStages(4, [
            'Ash Fields', 'Magma Flow', 'Tundra Gate', 'Blizzard Pass',
            'Ember Core', 'Glacial Rift', 'Storm Front', 'Molten Bridge',
            'Frost Furnace', 'Dual Element Lord'
        ], 220, ['Fire', 'Lava', 'Ice', 'Storm'], 9, 'Extreme')
    },
    {
        id: 5, name: 'Celestial Depths', icon: '✨',
        story: 'Beyond the veil: void cults, divine constructs, and cosmic horrors. Only mythic teams endure here.',
        playerLevel: 40, unlockChapter: 4,
        stages: buildCampaignStages(5, [
            'Abyss Mouth', 'Void Threshold', 'Spire Base', 'Starlit Path',
            'Eternal Bloom', 'Nexus Gate', 'Cosmic Rift', 'Divine Trial',
            'Origin Echo', 'Celestial Siege', 'Void Cataclysm', 'Slime God Remnant'
        ], 350, ['Void', 'Light', 'Shadow', 'Spirit', 'Crystal'], 10, 'Extreme')
    }
];

const DUNGEON_REQUIREMENTS = {
    forest_depths: 3, crystal_caverns: 8, shadow_abyss: 18, ancient_temple: 30,
    molten_core: 42, glacial_spire: 48, thunder_sanctum: 55, abyssal_throne: 68, origin_core: 82
};

const BOSS_REQUIREMENTS = {
    fire_dragon: 15, stone_golem: 28, ancient_treant: 45,
    shadow_lich: 62, storm_sovereign: 78, divine_colossus: 92
};

const MILESTONES = [
    { level: 30, name: "+5% Global Power", effect: () => { game.globalPowerBonus = (game.globalPowerBonus || 1) * 1.05; } },
    { level: 50, name: "+2 extra Stat Points per level-up", effect: () => {} },
    { level: 75, name: "+10% better rarity from exploration", effect: () => {} },
    { level: 100, name: "Eternal Alchemy Recipes Unlocked", effect: () => { log("New powerful Alchemy recipes available!"); } },
    { level: 150, name: "+15% more Divine Shards from bosses", effect: () => {} }
];

const VOID_TOWER_MIN_LEVEL = 90;

const RARITY_ORDER = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5, Mythic: 6 };
const RARITY_COLORS = { Common: "#9ca3af", Uncommon: "#22c55e", Rare: "#3b82f6", Epic: "#a855f7", Legendary: "#f59e0b", Mythic: "#ff4466" };
const SLIME_EXP_PER_LEVEL = 95;
let havenCardCache = new Map();

/**
 * Raid-style primary attributes (grow with level; drive combat HP/ATK/DEF/SPD/crit).
 * STR → ATK · AGI → SPD / crit · VIT → HP · MAG → skill-leaning ATK · RES → DEF · ACC → accuracy/crit floor
 */
const SLIME_STAT_KEYS = ['STR', 'AGI', 'VIT', 'MAG', 'RES', 'ACC'];
const SLIME_STAT_META = {
    STR: { name: 'Strength',  short: 'STR', color: '#ff8a65', desc: 'Physical force — raises ATK' },
    AGI: { name: 'Agility',   short: 'AGI', color: '#81c784', desc: 'Speed & finesse — raises SPD and crit' },
    VIT: { name: 'Vitality',  short: 'VIT', color: '#ef5350', desc: 'Gel mass & stamina — raises HP' },
    MAG: { name: 'Magic',     short: 'MAG', color: '#ba68c8', desc: 'Elemental force — raises skill ATK' },
    RES: { name: 'Resolve',   short: 'RES', color: '#64b5f6', desc: 'Hardened membrane — raises DEF' },
    ACC: { name: 'Focus',     short: 'ACC', color: '#ffd54f', desc: 'Aim & pressure — crit chance & accuracy' }
};

/** Base total primary points by rarity (split across 6 stats). */
const RARITY_STAT_POOL = {
    Common: 72, Uncommon: 84, Rare: 98, Epic: 118, Legendary: 142, Mythic: 168
};

/** Role bias weights (relative; normalized when generating). */
const ROLE_STAT_BIAS = {
    tank:     { STR: 0.9, AGI: 0.55, VIT: 1.55, MAG: 0.6,  RES: 1.5,  ACC: 0.7 },
    brute:    { STR: 1.5, AGI: 0.7,  VIT: 1.25, MAG: 0.55, RES: 1.0,  ACC: 0.75 },
    striker:  { STR: 1.4, AGI: 1.05, VIT: 0.95, MAG: 0.85, RES: 0.8,  ACC: 1.0 },
    mage:     { STR: 0.55, AGI: 0.9,  VIT: 0.85, MAG: 1.55, RES: 0.75, ACC: 1.15 },
    support:  { STR: 0.6,  AGI: 0.95, VIT: 1.1,  MAG: 1.2,  RES: 1.05, ACC: 1.05 },
    assassin: { STR: 1.15, AGI: 1.55, VIT: 0.7,  MAG: 0.8,  RES: 0.65, ACC: 1.35 }
};

/** Element flavor tilt (small). */
const ELEMENT_STAT_BIAS = {
    Fire:      { STR: 1.08, MAG: 1.06 },
    Water:     { VIT: 1.06, MAG: 1.05 },
    Earth:     { VIT: 1.1,  RES: 1.12 },
    Wind:      { AGI: 1.12, ACC: 1.05 },
    Plant:     { VIT: 1.05, MAG: 1.05, RES: 1.04 },
    Lightning: { AGI: 1.1,  MAG: 1.08, ACC: 1.08 },
    Ice:       { RES: 1.1,  MAG: 1.05 },
    Shadow:    { AGI: 1.08, ACC: 1.1, MAG: 1.05 },
    Light:     { MAG: 1.1,  RES: 1.05 },
    Metal:     { RES: 1.15, STR: 1.05 },
    Poison:    { MAG: 1.08, ACC: 1.08 },
    Crystal:   { MAG: 1.12, RES: 1.06 },
    Lava:      { STR: 1.1,  VIT: 1.06 },
    Storm:     { AGI: 1.08, MAG: 1.08 },
    Spirit:    { MAG: 1.12, VIT: 1.04 },
    Void:      { MAG: 1.1,  ACC: 1.08, STR: 1.04 }
};

/** Cool fusion epithets / compounds for arena fuse names. */
const FUSION_EPITHETS = [
    'Helix', 'Dyad', 'Amalgam', 'Confluence', 'Prime Gel', 'Chimera',
    'Corebind', 'Twinheart', 'Ω-Form', 'Meridian', 'Cascade', 'Nexus'
];
const FUSION_ELEMENT_BLEND = {
    'Fire+Water': 'Steamcoil', 'Water+Fire': 'Steamcoil',
    'Fire+Earth': 'Magmaroot', 'Earth+Fire': 'Magmaroot',
    'Fire+Ice': 'Obsidian', 'Ice+Fire': 'Obsidian',
    'Fire+Plant': 'Ashbloom', 'Plant+Fire': 'Ashbloom',
    'Fire+Wind': 'Embergale', 'Wind+Fire': 'Embergale',
    'Water+Earth': 'Claytide', 'Earth+Water': 'Claytide',
    'Water+Ice': 'Glacier', 'Ice+Water': 'Glacier',
    'Water+Plant': 'Mirebloom', 'Plant+Water': 'Mirebloom',
    'Water+Lightning': 'Stormsurge', 'Lightning+Water': 'Stormsurge',
    'Earth+Metal': 'Ironclod', 'Metal+Earth': 'Ironclod',
    'Earth+Plant': 'Rootmass', 'Plant+Earth': 'Rootmass',
    'Wind+Lightning': 'Thunderkin', 'Lightning+Wind': 'Thunderkin',
    'Shadow+Light': 'Twilight', 'Light+Shadow': 'Twilight',
    'Shadow+Void': 'Nullshade', 'Void+Shadow': 'Nullshade',
    'Light+Crystal': 'Prismara', 'Crystal+Light': 'Prismara',
    'Poison+Plant': 'Venombloom', 'Plant+Poison': 'Venombloom',
    'Lava+Ice': 'Pyroclast', 'Ice+Lava': 'Pyroclast',
    'Spirit+Void': 'Echowisp', 'Void+Spirit': 'Echowisp',
    'Metal+Lightning': 'Voltgird', 'Lightning+Metal': 'Voltgird',
    'Storm+Water': 'Maelstrom', 'Water+Storm': 'Maelstrom'
};

const FACTIONS = ["Forest", "Abyss", "Celestial", "Arcane", "Inferno", "Tidal"];
const ELEMENT_FACTION = {
    Water: "Tidal", Fire: "Inferno", Earth: "Forest", Wind: "Forest", Plant: "Forest",
    Lightning: "Arcane", Ice: "Tidal", Shadow: "Abyss", Light: "Celestial", Metal: "Arcane",
    Poison: "Abyss", Crystal: "Celestial", Lava: "Inferno", Storm: "Arcane", Spirit: "Celestial", Void: "Abyss"
};

const FACTION_SYNERGY = { 2: 1.05, 3: 1.12, 4: 1.18 };

const ARTIFACT_SLOTS = ["weapon", "helm", "chest", "boots", "ring", "amulet"];
const ARTIFACT_SETS = {
    jelly: { name: "Jelly Set", icon: "🍮", bonus2: "HP +12%", bonus4: "Heal 8% per turn", stat: "hp" },
    void: { name: "Void Set", icon: "🕳️", bonus2: "Crit +10%", bonus4: "Ignore 15% DEF", stat: "crit" },
    crystal: { name: "Crystal Set", icon: "💎", bonus2: "DEF +14%", bonus4: "Shield allies 10%", stat: "def" },
    storm: { name: "Storm Set", icon: "⚡", bonus2: "SPD +8%", bonus4: "Extra turn 12%", stat: "spd" },
    bloom: { name: "Bloom Set", icon: "🌸", bonus2: "ATK +10%", bonus4: "AoE +20%", stat: "atk" }
};

const SKILL_DEFS = {
    // Always available
    basic: { name: "Basic Attack", type: "active", icon: "👊", desc: "Hit one enemy for 100% ATK", cooldown: 0, target: "enemy", mult: 1.0 },
    // Actives (rolled on common/rare type slimes)
    splash: { name: "Splash Strike", type: "active", icon: "💧", desc: "Hit ALL enemies for 80% ATK", cooldown: 3, target: "all_enemies", mult: 0.8 },
    inferno: { name: "Inferno Burst", type: "active", icon: "🔥", desc: "Heavy hit on one enemy for 155% ATK", cooldown: 3, target: "enemy", mult: 1.55 },
    shield: { name: "Gel Shield", type: "active", icon: "🛡️", desc: "Shield an ally (+25% DEF, 2 turns)", cooldown: 3, target: "ally", mult: 0 },
    poison: { name: "Toxic Drip", type: "active", icon: "☠️", desc: "Hit one enemy + DoT (6% max HP × 2)", cooldown: 3, target: "enemy", mult: 0.9 },
    heal: { name: "Regenerate", type: "active", icon: "💚", desc: "Heal an ally for 22% max HP", cooldown: 3, target: "ally", mult: 0 },
    haste: { name: "Slime Rush", type: "active", icon: "⚡", desc: "Team SPD +15% for 2 turns", cooldown: 4, target: "all_allies", mult: 0 },
    // Passives
    crit_passive: { name: "Sharp Core", type: "passive", icon: "🎯", desc: "+10% crit chance" },
    tank_passive: { name: "Thick Membrane", type: "passive", icon: "🧱", desc: "+12% max HP" },
    lifesteal: { name: "Absorb", type: "passive", icon: "🩸", desc: "Heal 8% of damage dealt" },

    // ===== Unique champion signature skills (Epic+) — Raid-style =====
    ember_lance:   { name: "Ember Lance", type: "active", icon: "🔥", desc: "Pierce one foe for 175% ATK; self heal 8%", cooldown: 3, target: "enemy", mult: 1.75, healSelfPct: 0.08, unique: true },
    tidal_crush:   { name: "Tidal Crush", type: "active", icon: "🌊", desc: "Crush one foe for 170% ATK", cooldown: 3, target: "enemy", mult: 1.7, unique: true },
    quake_slam:    { name: "Quake Slam", type: "active", icon: "🪨", desc: "Hit ALL for 95% ATK and self-shield", cooldown: 4, target: "all_enemies", mult: 0.95, selfShield: true, unique: true },
    gale_dance:    { name: "Gale Dance", type: "active", icon: "🌪️", desc: "Hit one for 150% ATK; team haste", cooldown: 4, target: "enemy", mult: 1.5, teamHaste: true, unique: true },
    bloom_burst:   { name: "Bloom Burst", type: "active", icon: "🌸", desc: "Hit ALL for 85% ATK; heal lowest ally 18%", cooldown: 4, target: "all_enemies", mult: 0.85, healLowestAllyPct: 0.18, unique: true },
    thunder_judgement: { name: "Thunder Judgement", type: "active", icon: "⚡", desc: "Heavy single hit 190% ATK", cooldown: 4, target: "enemy", mult: 1.9, unique: true },
    glacial_prison: { name: "Glacial Prison", type: "active", icon: "🧊", desc: "Hit for 140% ATK; +DEF on self 2 turns", cooldown: 3, target: "enemy", mult: 1.4, selfShield: true, unique: true },
    umbral_strike: { name: "Umbral Strike", type: "active", icon: "🌑", desc: "Hit for 160% ATK + poison", cooldown: 3, target: "enemy", mult: 1.6, applyPoison: true, unique: true },
    radiant_smite: { name: "Radiant Smite", type: "active", icon: "✨", desc: "Hit ALL for 90% ATK", cooldown: 3, target: "all_enemies", mult: 0.9, unique: true },
    iron_bulwark:  { name: "Iron Bulwark", type: "active", icon: "🛡️", desc: "Shield all allies 2 turns", cooldown: 4, target: "all_allies", mult: 0, teamShield: true, unique: true },
    venom_nova:    { name: "Venom Nova", type: "active", icon: "☠️", desc: "Hit ALL for 75% ATK + poison each", cooldown: 4, target: "all_enemies", mult: 0.75, applyPoison: true, unique: true },
    prism_beam:    { name: "Prism Beam", type: "active", icon: "💎", desc: "Hit one for 185% ATK", cooldown: 3, target: "enemy", mult: 1.85, unique: true },
    magma_eruption:{ name: "Magma Eruption", type: "active", icon: "🌋", desc: "Hit ALL for 100% ATK", cooldown: 4, target: "all_enemies", mult: 1.0, unique: true },
    storm_crown:   { name: "Storm Crown", type: "active", icon: "⛈️", desc: "Hit one 165% ATK; team haste", cooldown: 4, target: "enemy", mult: 1.65, teamHaste: true, unique: true },
    soul_bind:     { name: "Soul Bind", type: "active", icon: "👻", desc: "Hit 145% ATK; heal self 12%", cooldown: 3, target: "enemy", mult: 1.45, healSelfPct: 0.12, unique: true },
    void_rend:     { name: "Void Rend", type: "active", icon: "🕳️", desc: "Hit one for 200% ATK", cooldown: 4, target: "enemy", mult: 2.0, unique: true },
    royal_aegis:   { name: "Royal Aegis", type: "active", icon: "👑", desc: "Mass heal 20% + team shield", cooldown: 5, target: "all_allies", mult: 0, teamHealPct: 0.2, teamShield: true, unique: true },
    apocalypse_gel:{ name: "Apocalypse Gel", type: "active", icon: "💥", desc: "Hit ALL for 120% ATK", cooldown: 5, target: "all_enemies", mult: 1.2, unique: true }
};

/**
 * Unique champions (Epic / Legendary / Mythic) — Raid-style named characters.
 * Each has a fixed element, signature skill, and visual flair.
 */
const SLIME_CHAMPIONS = [
    // —— Epic ——
    { id: 'pyra', name: 'Pyra Emberheart', rarity: 'Epic', element: 'Fire', role: 'striker', sigSkill: 'ember_lance', kit: ['inferno', 'crit_passive'], visual: { accessory: 'crown', aura: '#ff6d00', eyes: 'fierce' },
      statTilt: { STR: 1.15, MAG: 1.1, AGI: 1.05 },
      lore: 'Forged in a collapsed forge-town, Pyra wears a crown of cooling slag. Every duel is a vow: no cold blade will ever snuff her heart-fire again.' },
    { id: 'maris', name: 'Maris Tideborn', rarity: 'Epic', element: 'Water', role: 'support', sigSkill: 'tidal_crush', kit: ['heal', 'splash'], visual: { accessory: 'tiara', aura: '#29b6f6', eyes: 'calm' },
      statTilt: { MAG: 1.12, VIT: 1.1, RES: 1.08 },
      lore: 'Washed ashore during a king-tide that swallowed a harbor. Maris still carries the harbor\'s lullaby in her gel — and uses it to keep allies afloat.' },
    { id: 'boulder', name: 'Boulderfist', rarity: 'Epic', element: 'Earth', role: 'tank', sigSkill: 'quake_slam', kit: ['shield', 'tank_passive'], visual: { accessory: 'helm', aura: '#8d6e63', eyes: 'fierce' },
      statTilt: { VIT: 1.2, RES: 1.18, STR: 1.05 },
      lore: 'Once a living landslide that blocked a mountain pass for a decade. Adventurers carved a helm into his brow; he never took it off.' },
    { id: 'zephira', name: 'Zephira Skydancer', rarity: 'Epic', element: 'Wind', role: 'assassin', sigSkill: 'gale_dance', kit: ['haste', 'crit_passive'], visual: { accessory: 'wing', aura: '#81c784', eyes: 'fierce' },
      statTilt: { AGI: 1.22, ACC: 1.12, STR: 1.05 },
      lore: 'A courier-slime who outran storms for the sky-guilds. Zephira dances on updrafts and vanishes before the thunder can answer.' },
    { id: 'sylva', name: 'Sylva Bloomguard', rarity: 'Epic', element: 'Plant', role: 'support', sigSkill: 'bloom_burst', kit: ['heal', 'poison'], visual: { accessory: 'wreath', aura: '#66bb6a', eyes: 'calm' },
      lore: 'Rooted in a shrine-grove until the grove itself asked her to walk. Flowers open when she heals — and wilt when she strikes.' },
    { id: 'volt', name: 'Volt Judge', rarity: 'Epic', element: 'Lightning', role: 'striker', sigSkill: 'thunder_judgement', kit: ['inferno', 'crit_passive'], visual: { accessory: 'crown', aura: '#ffca28', eyes: 'fierce' },
      lore: 'Born from a single bolt that struck a guilty king\'s statue. Volt judges with light and leaves only scorched silhouettes behind.' },
    { id: 'glacia', name: 'Glacia Frostveil', rarity: 'Epic', element: 'Ice', role: 'tank', sigSkill: 'glacial_prison', kit: ['shield', 'tank_passive'], visual: { accessory: 'tiara', aura: '#4dd0e1', eyes: 'calm' },
      lore: 'A glacier-spirit who chose a smaller form to walk among travelers. Glacia freezes threats mid-step, polite as winter and twice as final.' },
    { id: 'nyx', name: 'Nyx Umbral', rarity: 'Epic', element: 'Shadow', role: 'assassin', sigSkill: 'umbral_strike', kit: ['poison', 'lifesteal'], visual: { accessory: 'hood', aura: '#5c6bc0', eyes: 'fierce' },
      lore: 'No one saw Nyx form — only the empty hood left after a lantern failed. She drinks light and leaves the room colder for it.' },
    { id: 'solara', name: 'Solara Radiant', rarity: 'Epic', element: 'Light', role: 'mage', sigSkill: 'radiant_smite', kit: ['heal', 'splash'], visual: { accessory: 'halo', aura: '#fff176', eyes: 'calm' },
      lore: 'Hatched from a sun-shard that fell during a false eclipse. Solara\'s halo never dims, even in the deepest dungeons.' },
    { id: 'ferros', name: 'Ferros Ironwall', rarity: 'Epic', element: 'Metal', role: 'tank', sigSkill: 'iron_bulwark', kit: ['shield', 'tank_passive'], visual: { accessory: 'helm', aura: '#90a4ae', eyes: 'fierce' },
      lore: 'Tempered in a siege foundry until his membrane rang like a shield. Ferros stands where gates used to stand.' },
    { id: 'vexa', name: 'Vexa Nightbloom', rarity: 'Epic', element: 'Poison', role: 'mage', sigSkill: 'venom_nova', kit: ['poison', 'crit_passive'], visual: { accessory: 'hood', aura: '#ab47bc', eyes: 'fierce' },
      lore: 'Cultivated in a forbidden apothecary garden. Vexa\'s blooms are beautiful — and every petal is a warning.' },
    { id: 'prismara', name: 'Prismara', rarity: 'Epic', element: 'Crystal', role: 'mage', sigSkill: 'prism_beam', kit: ['splash', 'crit_passive'], visual: { accessory: 'crown', aura: '#7e57c2', eyes: 'calm' },
      lore: 'Cut from a living geode that sang under moonlight. Prismara splits one ray into many and never misses the same way twice.' },
    { id: 'cinderok', name: 'Cinderok', rarity: 'Epic', element: 'Lava', role: 'brute', sigSkill: 'magma_eruption', kit: ['inferno', 'tank_passive'], visual: { accessory: 'helm', aura: '#ff5722', eyes: 'fierce' },
      lore: 'A crater-child who learned to walk by melting the ground. Cinderok laughs like a rockslide and hits harder.' },
    { id: 'tempesta', name: 'Tempesta', rarity: 'Epic', element: 'Storm', role: 'striker', sigSkill: 'storm_crown', kit: ['haste', 'splash'], visual: { accessory: 'crown', aura: '#5c6bc0', eyes: 'fierce' },
      lore: 'Crowned by lightning during a sea war. Tempesta is the calm eye that chooses when the sky breaks.' },
    { id: 'lira', name: 'Lira Soulwisp', rarity: 'Epic', element: 'Spirit', role: 'support', sigSkill: 'soul_bind', kit: ['heal', 'lifesteal'], visual: { accessory: 'halo', aura: '#b39ddb', eyes: 'calm' },
      lore: 'A memorial-wisp who refused to fade with her village. Lira binds pain into light and gives it back as hope.' },
    { id: 'abaddon', name: 'Abaddon Rift', rarity: 'Epic', element: 'Void', role: 'assassin', sigSkill: 'void_rend', kit: ['poison', 'crit_passive'], visual: { accessory: 'hood', aura: '#37474f', eyes: 'fierce' },
      lore: 'Stepped out of a tear in a star-map no scholar could close. Abaddon erases what he touches — carefully, on purpose.' },
    // —— Legendary ——
    { id: 'ignara', name: 'Ignara the Eternal Flame', rarity: 'Legendary', element: 'Fire', role: 'mage', sigSkill: 'ember_lance', kit: ['inferno', 'splash', 'crit_passive'], visual: { accessory: 'crown', aura: '#ff3d00', eyes: 'fierce', glow: true },
      lore: 'The first hearth of the old kingdoms still burns inside Ignara. Empires fell; her flame renegotiated the terms of night.' },
    { id: 'ocearon', name: 'Ocearon Deepking', rarity: 'Legendary', element: 'Water', role: 'tank', sigSkill: 'tidal_crush', kit: ['heal', 'shield', 'tank_passive'], visual: { accessory: 'crown', aura: '#0277bd', eyes: 'fierce', glow: true },
      lore: 'Sovereign of the lightless trenches, Ocearon rises only when the surface forgets its debt to the deep.' },
    { id: 'terraxis', name: 'Terraxis Worldroot', rarity: 'Legendary', element: 'Earth', role: 'tank', sigSkill: 'quake_slam', kit: ['shield', 'heal', 'tank_passive'], visual: { accessory: 'helm', aura: '#5d4037', eyes: 'fierce', glow: true },
      lore: 'Said to be a root of the world-tree that learned to walk. Terraxis holds the line so continents can finish their sentences.' },
    { id: 'aetherion', name: 'Aetherion Gale', rarity: 'Legendary', element: 'Wind', role: 'assassin', sigSkill: 'gale_dance', kit: ['haste', 'splash', 'crit_passive'], visual: { accessory: 'wing', aura: '#43a047', eyes: 'fierce', glow: true },
      lore: 'Aetherion is the wind between arrows — the cut of air that arrives before the blade. Guilds pray for his favor; foes never see it granted.' },
    { id: 'verdantia', name: 'Verdantia Evergreen', rarity: 'Legendary', element: 'Plant', role: 'support', sigSkill: 'bloom_burst', kit: ['heal', 'shield', 'poison'], visual: { accessory: 'wreath', aura: '#2e7d32', eyes: 'calm', glow: true },
      lore: 'Where Verdantia rests, forests reclaim stone in a season. She is spring with a spine — gentle until the soil itself answers.' },
    { id: 'thundrax', name: 'Thundrax Skybreaker', rarity: 'Legendary', element: 'Lightning', role: 'striker', sigSkill: 'thunder_judgement', kit: ['inferno', 'haste', 'crit_passive'], visual: { accessory: 'crown', aura: '#f9a825', eyes: 'fierce', glow: true },
      lore: 'Thundrax cracked the sky-bridge of the storm titans and wore the fracture as a crown. Judgment is instant; mercy is rumor.' },
    { id: 'cryovex', name: 'Cryovex Winterlord', rarity: 'Legendary', element: 'Ice', role: 'mage', sigSkill: 'glacial_prison', kit: ['splash', 'shield', 'tank_passive'], visual: { accessory: 'tiara', aura: '#00acc1', eyes: 'fierce', glow: true },
      lore: 'Cryovex ruled a century of unbroken winter and never apologized. His prisons are beautiful, silent, and permanent enough.' },
    { id: 'nocturne', name: 'Nocturne Voidshade', rarity: 'Legendary', element: 'Shadow', role: 'assassin', sigSkill: 'umbral_strike', kit: ['poison', 'lifesteal', 'crit_passive'], visual: { accessory: 'hood', aura: '#1a237e', eyes: 'fierce', glow: true },
      lore: 'Nocturne is the silence after the last candle. He does not hunt glory — only the unfinished business of the dark.' },
    { id: 'luminara', name: 'Luminara Dawn', rarity: 'Legendary', element: 'Light', role: 'support', sigSkill: 'radiant_smite', kit: ['heal', 'shield', 'haste'], visual: { accessory: 'halo', aura: '#ffeb3b', eyes: 'calm', glow: true },
      lore: 'Luminara is the first color after a long night. Armies have followed her halo across ruined maps and found morning waiting.' },
    { id: 'voidarch', name: 'Voidarch the Unmade', rarity: 'Legendary', element: 'Void', role: 'mage', sigSkill: 'void_rend', kit: ['splash', 'poison', 'lifesteal'], visual: { accessory: 'crown', aura: '#102027', eyes: 'fierce', glow: true },
      lore: 'Voidarch was unwritten from three histories and rewrote himself on the fourth. What he unmakes stays gone.' },
    // —— Mythic ——
    { id: 'regalia', name: 'Regalia Prime', rarity: 'Mythic', element: 'Crystal', role: 'support', sigSkill: 'royal_aegis', kit: ['heal', 'shield', 'haste', 'tank_passive'], visual: { accessory: 'crown', aura: '#e040fb', eyes: 'calm', glow: true, mythic: true },
      statTilt: { VIT: 1.15, RES: 1.18, MAG: 1.15, ACC: 1.08 },
      lore: 'The first throne-slime, Regalia Prime is said to have sealed the Crystal Concord with a single, perfect shield. Crowns still bow when she enters a field.' },
    { id: 'apocalyp', name: 'Apocalyp the Last Gel', rarity: 'Mythic', element: 'Void', role: 'striker', sigSkill: 'apocalypse_gel', kit: ['inferno', 'splash', 'crit_passive', 'lifesteal'], visual: { accessory: 'crown', aura: '#ff1744', eyes: 'fierce', glow: true, mythic: true },
      statTilt: { STR: 1.18, MAG: 1.15, ACC: 1.12, AGI: 1.08 },
      lore: 'Prophecy called him the last gel that would end all gels. Apocalyp only smirks — endings, he claims, are just aggressive fusions.' },
    { id: 'solstice', name: 'Solstice Eternal', rarity: 'Mythic', element: 'Light', role: 'mage', sigSkill: 'radiant_smite', kit: ['heal', 'splash', 'haste', 'crit_passive'], visual: { accessory: 'halo', aura: '#fff59d', eyes: 'calm', glow: true, mythic: true },
      statTilt: { MAG: 1.22, ACC: 1.12, VIT: 1.08 },
      lore: 'Solstice Eternal is the day that refused to set. In her light, shadows bargain and wounds remember how to close.' },
    { id: 'inferno_prime', name: 'Inferno Prime', rarity: 'Mythic', element: 'Lava', role: 'brute', sigSkill: 'magma_eruption', kit: ['inferno', 'splash', 'tank_passive', 'lifesteal'], visual: { accessory: 'helm', aura: '#ff6f00', eyes: 'fierce', glow: true, mythic: true },
      statTilt: { STR: 1.2, VIT: 1.15, RES: 1.08 },
      lore: 'Inferno Prime is the planet\'s first fever — a mythic boil of lava-gel that taught volcanoes how to shout.' }
];

function getChampionsByRarity(rarity) {
    return (SLIME_CHAMPIONS || []).filter(c => c.rarity === rarity);
}

function pickChampionDef(rarity, preferredElement = null) {
    let pool = getChampionsByRarity(rarity);
    if (!pool.length) return null;
    if (preferredElement) {
        const match = pool.filter(c => c.element === preferredElement);
        if (match.length) pool = match;
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

function getChampionDefById(id) {
    return (SLIME_CHAMPIONS || []).find(c => c.id === id) || null;
}

const SUMMON_RATES = {
    regular: { Common: 0.55, Uncommon: 0.28, Rare: 0.12, Epic: 0.045, Legendary: 0.005, Mythic: 0 },
    premium: { Common: 0, Uncommon: 0.15, Rare: 0.45, Epic: 0.28, Legendary: 0.10, Mythic: 0.02 },
    ancient: { Common: 0, Uncommon: 0, Rare: 0.20, Epic: 0.45, Legendary: 0.28, Mythic: 0.07 }
};

const PITY_THRESHOLDS = { regular: 50, premium: 30, ancient: 20 };
const BANNERS = {
    celestial: { name: "Celestial Awakening", factions: ["Celestial"], elements: ["Light", "Spirit", "Crystal"], epicBonus: 0.5 },
    abyss: { name: "Abyss Rising", factions: ["Abyss"], elements: ["Shadow", "Void", "Poison"], epicBonus: 0.5 },
    forest: { name: "Forest Guardians", factions: ["Forest"], elements: ["Plant", "Earth", "Wind"], epicBonus: 0.4 }
};

const ASCENSION_COSTS = [
    { level: 20, gold: 200, essence: 15 },
    { level: 40, gold: 500, essence: 40, divine: 2 },
    { level: 60, gold: 1200, essence: 80, divine: 5 },
    { level: 80, gold: 2500, essence: 150, divine: 12, void: 3 }
];

