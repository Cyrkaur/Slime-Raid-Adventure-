/* Full game logic from index-3.html — loaded as single module for reliability */
/*
 * CHANGELOG — Slime Adventure: Raid of the Slimes
 * v4.1 — Campaign slime EXP, default team selection (save/auto-use/manual override)
 * v4.0 OPTIMIZED EDITION (full polish pass)
 * - Performance: tab-aware UI batching, single game loop, combat log cap, toast queue
 * - Balance: smoother early/mid/late curve, 140 energy, true fresh start (1 slime Lv1), tuned summons
 * - Fresh start: no save → Lv1, 80 Gold, 90 Shards (1 summon), exactly 1 RNG starter slime, auto-saved once
 * - New Game button clears localStorage and re-bootstraps the same clean state
 * - Fixes: getTrainingExpMultiplier, save versioning, deep-load migration, Records tab layout
 * - QoL: prestige (Slime Transcendence), gain flashes, favorite filter, energy timer
 * - Alchemy/combat/campaign rewards rebalanced for fair long-term progression
 * v3.0 — Raid Campaign (chapters, stars, sweep, energy, hard/nightmare)
 * v2.0 — Summon, artifacts, arena, guild, ascension, combat engine
 * v1.0 — Base alchemy, breeding, dungeons, void tower
 */
const SAVE_VERSION = 4;

// ==================== GAME STATE ====================
let game = {
    saveVersion: SAVE_VERSION,
    playerLevel: 1,
    playerExp: 0,
    playerExpToNext: 110,
    resources: {
        wood: 0, stone: 0, herbs: 0, berries: 0, jelly: 0, gold: 0,
        slimeEssence: 0, manaShards: 0, shadowEssence: 0, crystal: 0,
        refinedEssence: 0, divineShards: 0, arcaneDust: 0,
        slimeShards: 0, voidShards: 0, skillBooks: 0,
        trainingScrolls: 0, battleElixir: 0, healingSalve: 0,
        fertilityPotion: 0, focusElixir: 0, powerSerum: 0, alchemicalCatalyst: 0,
        explorerTonic: 0, shadowSilk: 0
    },
    slimes: [],
    artifacts: [], // unequipped artifact inventory
    player: {
        statPoints: 0,
        stats: { taming: 0, alchemy: 0, combat: 0, leadership: 0, endurance: 0 }
    },
    workshop: { incubator: 0, trainingHall: 0, refinery: 0 },
    globalPowerBonus: 1.0,
    battleElixirActive: false,
    voidTowerFloor: 1,
    lifetimeDivineShards: 0,
    lifetimeSlimesTamed: 0,
    highestLevel: 1,
    explorerTonicCharges: 0,
    lastSlimePartyTime: 0,
    partyPowerBonusUntil: 0,
    divineConvergenceCount: 0,
    totalDamageDealt: 0,
    totalBossesDefeated: 0,
    totalDungeonsCleared: 0,
    totalFusions: 0,
    totalEvolutions: 0,
    totalSummons: 0,
    // Raid systems
    summon: { pityRegular: 0, pityPremium: 0, pityAncient: 0, bannerId: 'celestial' },
    guild: { level: 1 },
    arena: { rank: 1500, defenseTeam: [], wins: 0, losses: 0 },
    quests: { daily: [], weekly: [], lastDailyReset: 0, lastWeeklyReset: 0, loginStreak: 0, lastLoginClaim: 0 },
    leaderboard: { highestTeamPower: 0, bestVoidFloor: 1, bestArenaRank: 1500 },
    combatSpeed: 1,
    campaign: {
        energy: 140,
        maxEnergy: 140,
        lastEnergyTick: Date.now(),
        mode: 'normal',
        progress: {},
        selectedChapter: 1,
        totalStars: 0,
        defaultTeam: [],
        useDefaultTeam: true
    },
    prestige: { count: 0 }
};

let currentBossId = null;
let selectedSlimeIds = [];
let selectedMissionId = null;
let missionTimerInterval = null;
let detailSlimeId = null;
let combatState = null;
let combatResolve = null;
let arenaDefenseMode = false;
let selectedCampaignStage = null;
let selectedCampaignSlimeIds = [];
let campaignCombatMeta = null;
let activeTabIndex = 0;
let gameLoopInterval = null;
let toastQueue = [];
let toastShowing = false;
let gameInitialized = false;

// Cooldown to stop auto-clickers
let lastActionTime = 0;
const ACTION_COOLDOWN = 450; // ms

function canPerformAction() {
    const now = Date.now();
    if (now - lastActionTime < ACTION_COOLDOWN) {
        return false;
    }
    lastActionTime = now;
    return true;
}

// ==================== DARK MODE + SAVE SYSTEM ====================
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('slimeDarkMode', isDark ? 'true' : 'false');
}

function loadDarkModePreference() {
    if (localStorage.getItem('slimeDarkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
}

function getSavePayload() {
    game.saveVersion = SAVE_VERSION;
    return JSON.parse(JSON.stringify({ ...game, savedAt: Date.now() }));
}

function saveGame(silent = false) {
    try {
        localStorage.setItem('slimeAdventureSave', JSON.stringify(getSavePayload()));
        if (!silent) {
            document.querySelectorAll('button').forEach(b => {
                if (b.innerText.includes('Save') || b.innerText.includes('💾')) {
                    const original = b.innerText;
                    b.innerText = '✅ Saved!';
                    setTimeout(() => { if (b && b.parentNode) b.innerText = original; }, 1400);
                }
            });
            log('✅ Game saved!', false);
        }
        return true;
    } catch (e) {
        if (!silent) log('Save failed — storage may be full.');
        return false;
    }
}

function deepMergeSave(target, source) {
    Object.keys(source).forEach(key => {
        if (key === 'resources' && source.resources) {
            target.resources = { ...target.resources, ...source.resources };
        } else if (key === 'player' && source.player) {
            target.player = { ...target.player, ...source.player };
            target.player.stats = { ...target.player.stats, ...(source.player.stats || {}) };
        } else if (key === 'campaign' && source.campaign) {
            target.campaign = { ...target.campaign, ...source.campaign };
            if (source.campaign.progress) target.campaign.progress = { ...source.campaign.progress };
            if (Array.isArray(source.campaign.defaultTeam)) target.campaign.defaultTeam = source.campaign.defaultTeam.slice();
        } else if (key === 'workshop' && source.workshop) {
            target.workshop = { ...target.workshop, ...source.workshop };
        } else if (key === 'summon' && source.summon) {
            target.summon = { ...target.summon, ...source.summon };
        } else if (key === 'arena' && source.arena) {
            target.arena = { ...target.arena, ...source.arena };
        } else if (key === 'quests' && source.quests) {
            target.quests = { ...target.quests, ...source.quests };
        } else if (key === 'guild' && source.guild) {
            target.guild = { ...target.guild, ...source.guild };
        } else if (key === 'prestige' && source.prestige) {
            target.prestige = { ...target.prestige, ...source.prestige };
        } else if (key === 'slimes' && Array.isArray(source.slimes)) {
            target.slimes = source.slimes.slice();
        } else if (source[key] !== undefined) {
            target[key] = source[key];
        }
    });
}

function isValidSave(data) {
    return data && typeof data === 'object' && Array.isArray(data.slimes) && typeof data.saveVersion === 'number';
}

function applyDefaultStateToGame() {
    const fresh = getDefaultGameState();
    Object.keys(game).forEach(k => delete game[k]);
    Object.assign(game, fresh);
    game.resources = { ...fresh.resources };
    game.player = { statPoints: 0, stats: { ...fresh.player.stats } };
    game.workshop = { ...fresh.workshop };
    game.summon = { ...fresh.summon };
    game.guild = { ...fresh.guild };
    game.arena = { ...fresh.arena, defenseTeam: [] };
    game.quests = { ...fresh.quests, daily: [], weekly: [] };
    game.leaderboard = { ...fresh.leaderboard };
    game.campaign = { ...fresh.campaign, progress: {} };
    game.prestige = { count: 0 };
    game.artifacts = [];
    game.slimes = [];
}

function clearSlimeSelectionState() {
    selectedSlimeIds = [];
    managementSelectedSlimes = [];
    detailSlimeId = null;
    selectedMissionId = null;
    havenCardCache.clear();
    const havenGrid = document.getElementById('havenGrid');
    if (havenGrid) havenGrid.innerHTML = '';
}

function assignSingleStarterSlime() {
    game.slimes.length = 0;
    game.slimes.push(generateStarterSlime());
    game.lifetimeSlimesTamed = 1;
    return game.slimes[0];
}

function wipeAllSlimes() {
    game.slimes.length = 0;
    game.slimes = [];
}

function loadGame() {
    try {
        const saved = localStorage.getItem('slimeAdventureSave');
        if (!saved) return false;
        const loaded = JSON.parse(saved);
        if (!isValidSave(loaded)) {
            localStorage.removeItem('slimeAdventureSave');
            return false;
        }
        applyDefaultStateToGame();
        deepMergeSave(game, loaded);
        return true;
    } catch (e) {
        try { localStorage.removeItem('slimeAdventureSave'); } catch (x) {}
    }
    return false;
}

function migrateGameData() {
    if (game.resources.slimeShards === undefined) game.resources.slimeShards = 90;
    if (game.resources.voidShards === undefined) game.resources.voidShards = 0;
    if (game.resources.skillBooks === undefined) game.resources.skillBooks = 2;
    if (!game.artifacts) game.artifacts = [];
    if (!game.summon) game.summon = { pityRegular: 0, pityPremium: 0, pityAncient: 0, bannerId: 'celestial' };
    if (!game.guild) game.guild = { level: 1 };
    if (!game.arena) game.arena = { rank: 1500, defenseTeam: [], wins: 0, losses: 0 };
    if (!game.quests) game.quests = { daily: [], weekly: [], lastDailyReset: 0, lastWeeklyReset: 0, loginStreak: 0, lastLoginClaim: 0 };
    if (!game.leaderboard) game.leaderboard = { highestTeamPower: 0, bestVoidFloor: 1, bestArenaRank: 1500 };
    if (!game.campaign || typeof game.campaign !== 'object') {
        game.campaign = { energy: MAX_ENERGY, maxEnergy: MAX_ENERGY, lastEnergyTick: Date.now(), mode: 'normal', progress: {}, selectedChapter: 1, totalStars: 0 };
    }
    if (game.campaign.energy === undefined) game.campaign.energy = MAX_ENERGY;
    if (!game.campaign.maxEnergy) game.campaign.maxEnergy = MAX_ENERGY;
    if (!game.campaign.lastEnergyTick) game.campaign.lastEnergyTick = Date.now();
    if (!game.campaign.progress) game.campaign.progress = {};
    if (!game.campaign.mode) game.campaign.mode = 'normal';
    if (!game.campaign.selectedChapter) game.campaign.selectedChapter = 1;
    if (game.campaign.maxEnergy < MAX_ENERGY) game.campaign.maxEnergy = MAX_ENERGY;
    if (!Array.isArray(game.campaign.defaultTeam)) game.campaign.defaultTeam = [];
    if (game.campaign.useDefaultTeam === undefined) game.campaign.useDefaultTeam = true;
    game.campaign.defaultTeam = getValidCampaignSlimeIds(game.campaign.defaultTeam);
    if (!game.prestige) game.prestige = { count: 0 };
    tickCampaignEnergy();

    game.slimes.forEach(slime => migrateSlime(slime));
}

function migrateSlime(slime) {
    if (!slime.faction) slime.faction = ELEMENT_FACTION[slime.element] || FACTIONS[0];
    if (slime.ascension === undefined) slime.ascension = slime.evolved ? 1 : 0;
    if (!slime.skills) generateSkillsForSlime(slime);
    if (!slime.artifacts) slime.artifacts = {};
    if (slime.favorite === undefined) slime.favorite = false;
    if (slime.speed === undefined) slime.speed = 90 + Math.floor(Math.random() * 30);
    if (!slime.traits) generateTraitsForSlime(slime);
    recalculateSlimePower(slime);
}

function exportSave() {
    try {
        const data = JSON.stringify(getSavePayload());
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `slime-raid-save-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        log('📤 Save exported!');
    } catch (e) {
        log('Export failed.');
    }
}

function importSave() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const loaded = JSON.parse(ev.target.result);
                deepMergeSave(game, loaded);
                migrateGameData();
                saveGame();
                updateUI();
                log('📥 Save imported successfully!');
            } catch (err) {
                log('Invalid save file.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Unified game loop (energy, missions, autosave every 30s) — started in initGame
let autosaveTick = 0;
function startGameLoop() {
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    autosaveTick = 0;
    gameLoopInterval = setInterval(() => {
        tickCampaignEnergy();
        updateMissionTimersAndCompletions(true);
        autosaveTick++;
        if (autosaveTick >= 30) {
            saveGame(true);
            autosaveTick = 0;
        }
        if (activeTabIndex === 0) {
            const regenEl = document.getElementById('energyRegenText');
            const c = game.campaign;
            if (regenEl && c) {
                const msLeft = ENERGY_REGEN_MS - (Date.now() - (c.lastEnergyTick || Date.now()));
                if ((c.energy || 0) >= (c.maxEnergy || MAX_ENERGY)) regenEl.textContent = 'Full';
                else regenEl.textContent = `+1 in ${Math.max(0, Math.ceil(msLeft / 1000))}s`;
            }
        }
        updateHavenMissionTimers();
    }, 1000);
}

// ==================== CONSTANTS ====================
const elements = ["Water","Fire","Earth","Wind","Plant","Lightning","Ice","Shadow","Light","Metal","Poison","Crystal","Lava","Storm","Spirit","Void"];
const names = {
    Water: ["Aqua"], Fire: ["Blaze"], Earth: ["Terra"], Wind: ["Zephyr"],
    Plant: ["Bloom"], Lightning: ["Bolt"], Ice: ["Frost"], Shadow: ["Shade"],
    Light: ["Lumina"], Metal: ["Steel"], Poison: ["Venom"], Crystal: ["Gem"],
    Lava: ["Magma"], Storm: ["Tempest"], Spirit: ["Wisp"], Void: ["Abyss"]
};

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
        return {
            id: `ch${chapterId}_s${i + 1}`,
            chapterId,
            num: i + 1,
            label: `${chapterId}-${i + 1}`,
            name,
            energy: energyBase + Math.floor(i / 2) + (isBoss ? 3 : 0),
            power: basePower + i * (10 + chapterId * 3) + (isBoss ? 35 + chapterId * 18 : 0),
            enemies: isBoss ? 1 : Math.min(4, 2 + Math.floor(i / 3)),
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

const CAMPAIGN_CHAPTERS = [
    {
        id: 1, name: 'Verdant Wilds', icon: '🌲',
        story: 'Young slimes stir in the emerald forests. Push through ambushes and earn the trust of wild gel creatures.',
        playerLevel: 1, unlockChapter: null,
        stages: buildCampaignStages(1, [
            'Forest Ambush', 'Mossy Trail', 'Berry Thicket', 'Town Outskirts',
            'Plains Patrol', 'Sapling Grove', 'Wild Bloom', 'River Crossing',
            'Elder Tree', 'Guardian of the Green'
        ], 28, ['Plant', 'Earth', 'Wind', 'Water'], 6, 'Easy')
    },
    {
        id: 2, name: 'Shadowed Peaks', icon: '⛰️',
        story: 'Crystal lakes reflect dangerous peaks. Ancient caves hide slimes hardened by altitude and cold.',
        playerLevel: 5, unlockChapter: 1,
        stages: buildCampaignStages(2, [
            'Mountain Pass', 'Crystal Shore', 'Echoing Cave', 'Frozen Ledge',
            'Thunder Ridge', 'Mist Valley', 'Stone Sentinel', 'Deep Cavern',
            'Summit Trial', 'Peak Tyrant'
        ], 70, ['Ice', 'Earth', 'Lightning', 'Wind'], 7, 'Medium')
    },
    {
        id: 3, name: 'Murk & Ruins', icon: '🏛️',
        story: 'Swamps and forgotten temples breed shadowy slimes. Only balanced teams survive the rot.',
        playerLevel: 12, unlockChapter: 2,
        stages: buildCampaignStages(3, [
            'Swamp Edge', 'Sunken Path', 'Ruin Gate', 'Mystic Clearing',
            'Poison Mire', 'Lost Archive', 'Grove Warden', 'Shadow Pool',
            'Lich Approach', 'Treant Grove Siege'
        ], 130, ['Poison', 'Shadow', 'Plant', 'Earth'], 8, 'Hard')
    },
    {
        id: 4, name: 'Scorched Frontiers', icon: '🌋',
        story: 'Volcanic fury meets eternal ice. Elemental extremes test every champion you have raised.',
        playerLevel: 25, unlockChapter: 3,
        stages: buildCampaignStages(4, [
            'Ash Fields', 'Magma Flow', 'Tundra Gate', 'Blizzard Pass',
            'Ember Core', 'Glacial Rift', 'Storm Front', 'Molten Bridge',
            'Frost Furnace', 'Dual Element Lord'
        ], 220, ['Fire', 'Lava', 'Ice', 'Storm'], 9, 'Extreme')
    },
    {
        id: 5, name: 'Celestial Depths', icon: '✨',
        story: 'Beyond the veil lie abyssal thrones and origin nexuses. Only mythic slimes endure here.',
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
    splash: { name: "Splash Strike", type: "active", icon: "💧", desc: "AoE attack dealing 85% ATK to all enemies", cooldown: 3 },
    inferno: { name: "Inferno Burst", type: "active", icon: "🔥", desc: "Heavy single-target hit at 140% ATK", cooldown: 4 },
    shield: { name: "Gel Shield", type: "active", icon: "🛡️", desc: "Buff ally DEF +25% for 2 turns", cooldown: 4 },
    poison: { name: "Toxic Drip", type: "active", icon: "☠️", desc: "DoT 6% max HP for 2 turns", cooldown: 3 },
    heal: { name: "Regenerate", type: "active", icon: "💚", desc: "Heal lowest ally 18% max HP", cooldown: 4 },
    haste: { name: "Slime Rush", type: "active", icon: "⚡", desc: "Buff team SPD +15% for 2 turns", cooldown: 5 },
    crit_passive: { name: "Sharp Core", type: "passive", icon: "🎯", desc: "+8% crit chance permanently" },
    tank_passive: { name: "Thick Membrane", type: "passive", icon: "🧱", desc: "+12% max HP permanently" },
    lifesteal: { name: "Absorb", type: "passive", icon: "🩸", desc: "Heal 6% of damage dealt" }
};

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

// ==================== SLIME TRAITS SYSTEM ====================
const TRAIT_DEFINITIONS = {
    // Training Traits
    "quick_learner":      { name: "Quick Learner", tier: "Common", desc: "+8% EXP from Quick and Focused training." },
    "training_focused":   { name: "Training Focused", tier: "Uncommon", desc: "+14% EXP from all Training Missions." },
    "endurance_specialist":{ name: "Endurance Specialist", tier: "Rare", desc: "+22% EXP from long training missions." },
    "training_prodigy":   { name: "Training Prodigy", tier: "Epic", desc: "+30% EXP from all Training Missions." },

    // Combat Traits
    "combat_instinct":    { name: "Combat Instinct", tier: "Common", desc: "+6% Power." },
    "elemental_adept":    { name: "Elemental Adept", tier: "Uncommon", desc: "+12% power vs strong element matchups." },
    "combat_veteran":     { name: "Combat Veteran", tier: "Rare", desc: "+18% Power." },
    "battle_hardened":    { name: "Battle Hardened", tier: "Epic", desc: "+25% Power." },

    // Resource Traits
    "jelly_producer":     { name: "Jelly Producer", tier: "Common", desc: "Produces extra Jelly from training and parties." },
    "resourceful":        { name: "Resourceful", tier: "Uncommon", desc: "+12% resources from exploration." },
    "essence_harvester":  { name: "Essence Harvester", tier: "Rare", desc: "+20% Slime Essence from dungeons." },

    // Breeding Traits
    "stable_bloodline":   { name: "Stable Bloodline", tier: "Common", desc: "Slightly better rarity when breeding." },
    "rare_lineage":       { name: "Rare Lineage", tier: "Rare", desc: "+15% better rarity chance when breeding." }
};

function getTraitChanceByRarity(rarity) {
    const chances = {
        "Common":    { chance: 0.25, rarePlus: 0.08 },
        "Uncommon":  { chance: 0.42, rarePlus: 0.18 },
        "Rare":      { chance: 0.65, rarePlus: 0.35 },
        "Epic":      { chance: 0.82, rarePlus: 0.55 },
        "Legendary": { chance: 0.95, rarePlus: 0.75 },
        "Mythic":    { chance: 1.0, rarePlus: 0.90 }
    };
    return chances[rarity] || { chance: 0.3, rarePlus: 0.15 };
}

function generateTraitsForSlime(slime) {
    if (!slime || slime.traits) return; // Already has traits or invalid

    const rarityInfo = getTraitChanceByRarity(slime.rarity);
    slime.traits = [];

    // Roll for first trait
    if (Math.random() < rarityInfo.chance) {
        const tierRoll = Math.random();
        let possibleTiers = ["Common"];

        if (tierRoll < rarityInfo.rarePlus) {
            possibleTiers = ["Rare", "Epic"];
        } else if (tierRoll < rarityInfo.rarePlus * 1.8) {
            possibleTiers = ["Uncommon", "Rare"];
        } else {
            possibleTiers = ["Common", "Uncommon"];
        }

        const availableTraits = Object.keys(TRAIT_DEFINITIONS).filter(key => 
            possibleTiers.includes(TRAIT_DEFINITIONS[key].tier)
        );

        if (availableTraits.length > 0) {
            const traitKey = availableTraits[Math.floor(Math.random() * availableTraits.length)];
            slime.traits.push(traitKey);
        }
    }

    // Small chance for a second trait on higher rarities
    if (slime.rarity === "Epic" || slime.rarity === "Legendary" || slime.rarity === "Mythic") {
        if (Math.random() < 0.35) {
            const secondTierRoll = Math.random();
            let secondTiers = secondTierRoll < 0.4 ? ["Rare", "Epic"] : ["Uncommon", "Rare"];

            const available = Object.keys(TRAIT_DEFINITIONS).filter(key => 
                secondTiers.includes(TRAIT_DEFINITIONS[key].tier) && !slime.traits.includes(key)
            );

            if (available.length > 0) {
                const traitKey = available[Math.floor(Math.random() * available.length)];
                slime.traits.push(traitKey);
            }
        }
    }
}

// Apply trait effects (called in relevant places)
function applyTraitEffects(slime) {
    if (!slime.traits || slime.traits.length === 0) return 1.0;

    let powerMultiplier = 1.0;

    slime.traits.forEach(traitKey => {
        if (traitKey === "combat_instinct") powerMultiplier *= 1.06;
        if (traitKey === "elemental_adept") powerMultiplier *= 1.12; // Simplified
        if (traitKey === "combat_veteran") powerMultiplier *= 1.18;
        if (traitKey === "battle_hardened") powerMultiplier *= 1.25;
    });

    return powerMultiplier;
}

// Hover tooltip for traits on Records page
let currentTraitTooltip = null;
let managementSelectedSlimes = []; // For multi-select in management modal

function showTraitTooltip(element, traitKey) {
    hideTraitTooltip(); // Remove any existing tooltip

    const def = TRAIT_DEFINITIONS[traitKey];
    if (!def) return;

    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
        position: absolute;
        background: #0a2a1a;
        border: 2px solid #77ffaa;
        border-radius: 8px;
        padding: 10px 14px;
        max-width: 260px;
        z-index: 99999;
        font-size: 12px;
        color: #bbffdd;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        pointer-events: none;
    `;

    tooltip.innerHTML = `
        <div style="margin-bottom:4px;">
            <strong style="color:#aaff99;">${def.name}</strong>
            <span style="font-size:9px; margin-left:6px; padding:1px 5px; background:#113322; border-radius:3px;">${def.tier}</span>
        </div>
        <div style="line-height:1.35;">${def.desc}</div>
    `;

    document.body.appendChild(tooltip);
    currentTraitTooltip = tooltip;

    // Position tooltip near the element
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;

    // Adjust if tooltip goes off screen
    if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 10;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function hideTraitTooltip() {
    if (currentTraitTooltip) {
        currentTraitTooltip.remove();
        currentTraitTooltip = null;
    }
}

// ==================== LOG FUNCTION ====================
function log(msg, isGain = false) {
    toastQueue.push({ msg, isGain });
    if (!toastShowing) showNextToast();
}

function showNextToast() {
    if (toastQueue.length === 0) { toastShowing = false; return; }
    toastShowing = true;
    const container = document.getElementById('toast-container');
    if (!container) { toastShowing = false; return; }
    const { msg, isGain } = toastQueue.shift();
    const toast = document.createElement('div');
    toast.className = 'toast' + (isGain ? ' gain' : '');
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.35s ease';
        toast.style.opacity = '0';
        setTimeout(() => { toast.remove(); showNextToast(); }, 350);
    }, isGain ? 1800 : 2400);
}

function getTrainingExpMultiplier(slime) {
    if (!slime?.traits?.length) return 1;
    let mult = 1;
    slime.traits.forEach(t => {
        if (t === 'quick_learner') mult *= 1.08;
        if (t === 'training_focused') mult *= 1.14;
        if (t === 'endurance_specialist') mult *= 1.22;
        if (t === 'training_prodigy') mult *= 1.30;
    });
    return mult;
}

const SLIME_EMOJIS = {
    Water: '💧', Fire: '🔥', Earth: '🪨', Wind: '💨', Plant: '🌿', Lightning: '⚡',
    Ice: '❄️', Shadow: '🌑', Light: '✨', Metal: '⚙️', Poison: '☠️', Crystal: '💎',
    Lava: '🌋', Storm: '🌩️', Spirit: '👻', Void: '🕳️'
};
function getSlimeEmoji(slime) { return SLIME_EMOJIS[slime?.element] || '🫧'; }

const SLIME_ICON_PALETTES = {
    Water:    { body: '#42a5f5', dark: '#1565c0', shine: '#e3f2fd', accent: '#29b6f6' },
    Fire:     { body: '#ff7043', dark: '#bf360c', shine: '#ffccbc', accent: '#ff5722' },
    Earth:    { body: '#8d6e63', dark: '#4e342e', shine: '#d7ccc8', accent: '#6d4c41' },
    Wind:     { body: '#81c784', dark: '#388e3c', shine: '#e8f5e9', accent: '#a5d6a7' },
    Plant:    { body: '#66bb6a', dark: '#2e7d32', shine: '#c8e6c9', accent: '#43a047' },
    Lightning:{ body: '#ffca28', dark: '#f57f17', shine: '#fff9c4', accent: '#ffd54f' },
    Ice:      { body: '#4dd0e1', dark: '#00838f', shine: '#e0f7fa', accent: '#80deea' },
    Shadow:   { body: '#5c6bc0', dark: '#283593', shine: '#9fa8da', accent: '#3949ab' },
    Light:    { body: '#fff176', dark: '#f9a825', shine: '#fffde7', accent: '#ffee58' },
    Metal:    { body: '#90a4ae', dark: '#455a64', shine: '#eceff1', accent: '#78909c' },
    Poison:   { body: '#ab47bc', dark: '#6a1b9a', shine: '#e1bee7', accent: '#8e24aa' },
    Crystal:  { body: '#7e57c2', dark: '#4527a0', shine: '#d1c4e9', accent: '#9575cd' },
    Lava:     { body: '#ff5722', dark: '#bf360c', shine: '#ffab91', accent: '#ff3d00' },
    Storm:    { body: '#5c6bc0', dark: '#1a237e', shine: '#c5cae9', accent: '#3f51b5' },
    Spirit:   { body: '#b39ddb', dark: '#512da8', shine: '#ede7f6', accent: '#9575cd' },
    Void:     { body: '#37474f', dark: '#102027', shine: '#78909c', accent: '#263238' }
};

const SLIME_ICON_ACCENTS = {
    Water: '<path d="M16 5c0 0-3 4-3 6.5a3 3 0 0 0 6 0C19 9 16 5 16 5z" fill="#29b6f6" opacity="0.9"/>',
    Fire: '<path d="M16 4c-1 3-4 4-3 7 1 2 2-1 3-1s2 3 3 1c1-3-2-4-3-7z" fill="#ff3d00"/><path d="M16 7c0 0-1 2 0 3.5" stroke="#ffeb3b" stroke-width="1" fill="none"/>',
    Earth: '<rect x="13" y="3" width="6" height="5" rx="1.5" fill="#5d4037"/><rect x="14" y="4" width="2" height="2" rx="0.5" fill="#8d6e63" opacity="0.6"/>',
    Wind: '<path d="M10 5h8M9 8h10M11 11h6" stroke="#c8e6c9" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    Plant: '<path d="M16 4v5M14 6c2-2 4-1 4 1M18 6c-2-2-4-1-4 1" stroke="#2e7d32" stroke-width="1.5" stroke-linecap="round" fill="none"/><ellipse cx="16" cy="4" rx="3" ry="2" fill="#43a047"/>',
    Lightning: '<path d="M18 4l-3 5h2l-3 6 5-7h-2l3-4z" fill="#fff176" stroke="#f57f17" stroke-width="0.5"/>',
    Ice: '<path d="M16 3l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#e0f7fa" stroke="#00838f" stroke-width="0.6"/>',
    Shadow: '<path d="M8 6a8 8 0 0 1 16 0" fill="none" stroke="#3949ab" stroke-width="2" opacity="0.7"/>',
    Light: '<path d="M16 3l1 3 3 0-2 2 1 3-3-2-3 2 1-3-2-2 3 0z" fill="#fffde7" stroke="#f9a825" stroke-width="0.5"/>',
    Metal: '<circle cx="16" cy="5" r="3" fill="none" stroke="#cfd8dc" stroke-width="1.2"/><circle cx="16" cy="5" r="1" fill="#eceff1"/>',
    Poison: '<circle cx="16" cy="5" r="3" fill="#7b1fa2" opacity="0.5"/><circle cx="15" cy="4" r="0.8" fill="#e1bee7"/><circle cx="17" cy="6" r="0.6" fill="#ce93d8"/>',
    Crystal: '<path d="M16 3l3 5-3 2-3-2z" fill="#d1c4e9" stroke="#4527a0" stroke-width="0.5"/><path d="M16 10l3-2-3 5-3-5z" fill="#b39ddb" stroke="#4527a0" stroke-width="0.5"/>',
    Lava: '<path d="M11 18q2 2 5 0M14 20q2 1 4 0" stroke="#ffeb3b" stroke-width="1" fill="none" opacity="0.8"/>',
    Storm: '<ellipse cx="16" cy="5" rx="5" ry="3" fill="#9fa8da" opacity="0.8"/><path d="M17 7l-2 3h1.5l-2 4 3-4H18l-2-3z" fill="#fff176"/>',
    Spirit: '<ellipse cx="16" cy="5" rx="4" ry="3" fill="#ede7f6" opacity="0.55"/><ellipse cx="14" cy="5" rx="1" ry="1.2" fill="#fff" opacity="0.9"/><ellipse cx="18" cy="5" rx="1" ry="1.2" fill="#fff" opacity="0.9"/>',
    Void: '<circle cx="16" cy="6" r="4" fill="none" stroke="#78909c" stroke-width="1.5" opacity="0.8"/><circle cx="16" cy="6" r="2" fill="#102027" opacity="0.9"/>'
};

function buildSlimeIconSvg(element, size = 32, isEnemy = false) {
    const pal = SLIME_ICON_PALETTES[element] || SLIME_ICON_PALETTES.Water;
    const accent = SLIME_ICON_ACCENTS[element] || '';
    const body = isEnemy ? '#c62828' : pal.body;
    const dark = isEnemy ? '#7f0000' : pal.dark;
    const shine = isEnemy ? '#ffcdd2' : pal.shine;
    const blush = isEnemy ? '#ef9a9a' : pal.accent;
    const eyes = isEnemy
        ? `<path d="M10.5 14.5 L13.5 16 M20.5 14.5 L17.5 16" stroke="#1a1a2e" stroke-width="1.2" stroke-linecap="round" fill="none"/>
           <ellipse cx="12" cy="17" rx="2" ry="2.2" fill="#fff"/><ellipse cx="20" cy="17" rx="2" ry="2.2" fill="#fff"/>
           <ellipse cx="12.5" cy="17.5" rx="0.9" ry="1" fill="#1a1a2e"/><ellipse cx="20.5" cy="17.5" rx="0.9" ry="1" fill="#1a1a2e"/>`
        : `<ellipse cx="12" cy="15" rx="2" ry="2.5" fill="#fff"/><ellipse cx="20" cy="15" rx="2" ry="2.5" fill="#fff"/>
           <ellipse cx="12.5" cy="15.5" rx="1" ry="1.2" fill="#1a1a2e"/><ellipse cx="20.5" cy="15.5" rx="1" ry="1.2" fill="#1a1a2e"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" role="img" aria-label="${element} slime">
        <ellipse cx="16" cy="21" rx="11" ry="9" fill="${dark}" opacity="0.35"/>
        <ellipse cx="16" cy="19" rx="12" ry="10" fill="${body}"/>
        <ellipse cx="16" cy="13" rx="10" ry="9" fill="${body}"/>
        <ellipse cx="12" cy="11" rx="4" ry="3" fill="${shine}" opacity="0.45"/>
        <ellipse cx="9" cy="18" rx="2.2" ry="1" fill="${blush}" opacity="0.35"/>
        <ellipse cx="23" cy="18" rx="2.2" ry="1" fill="${blush}" opacity="0.35"/>
        ${eyes}
        ${isEnemy ? '' : accent}
    </svg>`;
}

function getSlimeIconHTML(slimeOrElement, size = 'md', isEnemy = false) {
    const element = typeof slimeOrElement === 'string' ? slimeOrElement : (slimeOrElement?.element || 'Water');
    const px = { xs: 18, sm: 22, md: 32, lg: 48, xl: 64 }[size] || 32;
    const enemyCls = isEnemy ? ' enemy-slime' : '';
    return `<span class="slime-icon slime-icon-${size}${enemyCls}" title="${element}">${buildSlimeIconSvg(element, px, isEnemy)}</span>`;
}

// ==================== GENERATE RANDOM SLIME ====================
function rollRarityFromTable(table, bonus = 0) {
    let roll = Math.random() - bonus;
    let cumulative = 0;
    const order = ["Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common"];
    for (const r of order) {
        cumulative += table[r] || 0;
        if (roll < cumulative) return r;
    }
    return "Common";
}

function generateSkillsForSlime(slime) {
    const skillCount = { Common: 1, Uncommon: 1, Rare: 2, Epic: 2, Legendary: 3, Mythic: 3 }[slime.rarity] || 1;
    const pool = Object.keys(SKILL_DEFS);
    slime.skills = [];
    const used = new Set();
    for (let i = 0; i < skillCount; i++) {
        let key;
        let attempts = 0;
        do {
            key = pool[Math.floor(Math.random() * pool.length)];
            attempts++;
        } while (used.has(key) && attempts < 20);
        used.add(key);
        slime.skills.push({ id: key, level: 1 });
    }
}

function createSlimeFromRoll(rarity, element = null, faction = null) {
    const el = element || elements[Math.floor(Math.random() * elements.length)];
    const fac = faction || ELEMENT_FACTION[el] || FACTIONS[0];
    const slime = {
        id: Date.now() + Math.floor(Math.random() * 100000),
        name: names[el][0],
        element: el,
        faction: fac,
        level: 1,
        exp: 0,
        power: 0,
        rarity,
        ascension: 0,
        evolved: false,
        onMission: false,
        favorite: false,
        locked: false,
        speed: 90 + Math.floor(Math.random() * 35),
        artifacts: {},
        skills: []
    };
    generateSkillsForSlime(slime);
    generateTraitsForSlime(slime);
    recalculateSlimePower(slime);
    return slime;
}

/** First-play starter: Common (~82%) or Uncommon (~18%), random element, Lv1 / 0 EXP */
function generateStarterSlime() {
    const rarity = Math.random() < 0.82 ? 'Common' : 'Uncommon';
    const element = elements[Math.floor(Math.random() * elements.length)];
    const slime = createSlimeFromRoll(rarity, element);
    slime.level = 1;
    slime.exp = 0;
    recalculateSlimePower(slime);
    return slime;
}

function generateRandomSlime(difficulty = "Easy", useFertility = false, parentA = null, parentB = null) {
    // Breeding genetics path
    if (parentA && parentB) {
        return breedSlimeGenetics(parentA, parentB, useFertility);
    }

    let rarityRoll = Math.random();
    const tamingBonus = (game.player.stats.taming || 0) * 0.03;
    rarityRoll = Math.max(0, rarityRoll - tamingBonus);
    if (useFertility) rarityRoll = Math.max(0, rarityRoll - 0.25);

    let rarity;
    if (difficulty === "Easy") {
        rarity = (rarityRoll < 0.68) ? "Common" : (rarityRoll < 0.90) ? "Uncommon" : "Rare";
    } else if (difficulty === "Medium") {
        rarity = (rarityRoll < 0.42) ? "Common" : (rarityRoll < 0.78) ? "Uncommon" : (rarityRoll < 0.95) ? "Rare" : "Epic";
    } else if (difficulty === "Hard") {
        rarity = (rarityRoll < 0.22) ? "Common" : (rarityRoll < 0.58) ? "Uncommon" : (rarityRoll < 0.86) ? "Rare" : (rarityRoll < 0.96) ? "Epic" : "Legendary";
    } else if (difficulty === "Summon") {
        return null;
    } else {
        rarity = (rarityRoll < 0.10) ? "Common" : (rarityRoll < 0.35) ? "Uncommon" : (rarityRoll < 0.65) ? "Rare" : (rarityRoll < 0.88) ? "Epic" : (rarityRoll < 0.97) ? "Legendary" : "Mythic";
    }

    const slime = createSlimeFromRoll(rarity);
    if (difficulty === "Extreme") slime.power = Math.floor(slime.power * 1.12);
    return slime;
}

function breedSlimeGenetics(parentA, parentB, useFertility) {
    const avgRarity = Math.max(RARITY_ORDER[parentA.rarity] || 1, RARITY_ORDER[parentB.rarity] || 1);
    let childRarityNum = avgRarity;
    if (Math.random() < 0.35 + (useFertility ? 0.2 : 0)) childRarityNum = Math.min(6, childRarityNum + 1);
    if (Math.random() < 0.08) childRarityNum = Math.min(6, childRarityNum + 1); // mutation
    const rarityMap = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];
    const rarity = rarityMap[childRarityNum - 1] || "Common";

    const element = Math.random() < 0.7
        ? (Math.random() < 0.5 ? parentA.element : parentB.element)
        : elements[Math.floor(Math.random() * elements.length)];
    const faction = Math.random() < 0.6
        ? (Math.random() < 0.5 ? parentA.faction : parentB.faction)
        : ELEMENT_FACTION[element];

    const baby = createSlimeFromRoll(rarity, element, faction);
    if (useFertility) baby.power = Math.floor(baby.power * 1.08);
    return baby;
}

// ==================== LEVEL SYSTEM ====================
function gainPlayerExp(amount) {
    const oldLevel = game.playerLevel;
    game.playerExp += amount;
    let leveledUp = false;

    while (game.playerExp >= game.playerExpToNext) {
        game.playerExp -= game.playerExpToNext;
        game.playerLevel++;
        game.playerExpToNext = Math.floor(90 + (game.playerLevel * 95) + Math.pow(game.playerLevel, 1.72) * 14);
        game.player.statPoints += 1;

        MILESTONES.forEach(m => {
            if (oldLevel < m.level && game.playerLevel >= m.level) {
                m.effect();
                log(`🌟 Milestone Unlocked: Level ${m.level} — ${m.name}`);
            }
        });

        if (game.playerLevel > game.highestLevel) game.highestLevel = game.playerLevel;
        leveledUp = true;
        log(`✨ Player Level Up! You are now Level ${game.playerLevel}!`);
    }

    updateSummary();

    if (leveledUp) {
        updateExploreLocks();
        updateDungeonLocks();
        updateBossLocks();
        updateUI();
        updateEndgameUI();
    }
}

function updateSummary() {
    const levelEl = document.getElementById('playerLevel');
    const expEl = document.getElementById('playerExpText');
    const goldEl = document.getElementById('goldDisplay');
    const divineEl = document.getElementById('divineDisplay');

    if (levelEl) levelEl.innerText = game.playerLevel;
    if (expEl) expEl.innerText = `(${game.playerExp}/${game.playerExpToNext})`;
    if (goldEl) goldEl.innerText = game.resources.gold || 0;
    if (divineEl) divineEl.innerText = game.resources.divineShards || 0;
    const shardEl = document.getElementById('slimeShardDisplay');
    const voidEl = document.getElementById('voidShardDisplay');
    const bookEl = document.getElementById('skillBookDisplay');
    if (shardEl) shardEl.innerText = game.resources.slimeShards || 0;
    if (voidEl) voidEl.innerText = game.resources.voidShards || 0;
    if (bookEl) bookEl.innerText = game.resources.skillBooks || 0;
    tickCampaignEnergy();
    const eDisp = document.getElementById('energyDisplay');
    const maxEDisp = document.getElementById('maxEnergyDisplay');
    const c = game.campaign || {};
    if (eDisp) eDisp.textContent = Math.floor(c.energy || 0);
    if (maxEDisp) maxEDisp.textContent = c.maxEnergy || MAX_ENERGY;
}

// ==================== SLIME EXP HELPERS ====================
function getSlimeExpProgress(slime) {
    const exp = slime.exp || 0;
    const expInLevel = exp % SLIME_EXP_PER_LEVEL;
    const expToNext = SLIME_EXP_PER_LEVEL - expInLevel;
    const pct = Math.min(100, (expInLevel / SLIME_EXP_PER_LEVEL) * 100);
    const expBasedLevel = Math.floor(1 + exp / SLIME_EXP_PER_LEVEL);
    const bonusLevels = Math.max(0, (slime.level || 1) - expBasedLevel);
    return { exp, expInLevel, expToNext, pct, expBasedLevel, bonusLevels };
}

function syncSlimeLevelFromExp(slime) {
    const fromExp = Math.floor(1 + (slime.exp || 0) / SLIME_EXP_PER_LEVEL);
    slime.level = Math.max(slime.level || 1, fromExp);
}

function sortHavenSlimes(slimes) {
    return [...slimes].sort((a, b) => {
        if (a.favorite !== b.favorite) return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
        if (a.onMission !== b.onMission) return (a.onMission ? 1 : 0) - (b.onMission ? 1 : 0);
        if (b.power !== a.power) return b.power - a.power;
        return (b.level || 1) - (a.level || 1);
    });
}

function createHavenCard(slime) {
    const card = document.createElement('div');
    card.dataset.slimeId = slime.id;
    card.addEventListener('click', () => openSlimeDetail(slime.id));
    card.innerHTML = `
        <div class="haven-name"><span class="haven-icon"></span><span class="haven-name-text"></span></div>
        <div class="haven-meta"><span class="haven-lvl"></span><span class="haven-pwr"></span></div>
        <div class="haven-rarity"></div>
        <div class="haven-exp-bar"><div class="haven-exp-fill"></div></div>
        <div class="haven-exp-text"><span class="haven-exp-cur"></span><span class="haven-exp-next"></span></div>
        <div class="haven-traits"></div>
        <div class="haven-mission-timer"></div>
    `;
    return card;
}

function updateHavenCardContent(card, slime) {
    const prog = getSlimeExpProgress(slime);
    const rarityColor = getRarityColor(slime.rarity);
    card.className = 'haven-card' + (slime.onMission ? ' on-mission' : '') + (slime.favorite ? ' favorited' : '');
    card.style.borderColor = slime.onMission ? '#888' : rarityColor;

    card.querySelector('.haven-icon').innerHTML = getSlimeIconHTML(slime, 'sm');
    const nameText = card.querySelector('.haven-name-text');
    nameText.textContent = slime.name + (slime.favorite ? ' ⭐' : '');
    const lvlBonus = prog.bonusLevels > 0 ? ` (+${prog.bonusLevels})` : '';
    card.querySelector('.haven-lvl').textContent = `Lv ${slime.level || 1}${lvlBonus}`;
    card.querySelector('.haven-pwr').textContent = `${slime.power} PWR`;
    const rarityEl = card.querySelector('.haven-rarity');
    rarityEl.textContent = `${slime.rarity} • ${slime.element}`;
    rarityEl.style.color = rarityColor;
    card.querySelector('.haven-exp-fill').style.width = prog.pct + '%';
    card.querySelector('.haven-exp-cur').textContent = `${prog.expInLevel} EXP`;
    card.querySelector('.haven-exp-next').textContent = `${prog.expToNext} to Lv${(slime.level || 1) + 1}`;

    const traitsEl = card.querySelector('.haven-traits');
    if (slime.traits?.length) {
        traitsEl.textContent = slime.traits.map(t => TRAIT_DEFINITIONS[t]?.name || t).join(', ');
        traitsEl.style.display = '';
    } else {
        traitsEl.textContent = '';
        traitsEl.style.display = 'none';
    }

    const timerEl = card.querySelector('.haven-mission-timer');
    if (slime.onMission && slime.missionEndTime) {
        const remaining = Math.max(0, Math.ceil((slime.missionEndTime - Date.now()) / 1000));
        timerEl.textContent = `⏳ Training: ${formatRemainingTime(remaining)}`;
        timerEl.style.display = '';
    } else {
        timerEl.textContent = '';
        timerEl.style.display = 'none';
    }
}

function updateHavenMissionTimers() {
    if (!havenCardCache.size) return;
    const now = Date.now();
    game.slimes.forEach(slime => {
        if (!slime.onMission || !slime.missionEndTime) return;
        const card = havenCardCache.get(slime.id);
        if (!card) return;
        const timerEl = card.querySelector('.haven-mission-timer');
        if (!timerEl) return;
        const remaining = Math.max(0, Math.ceil((slime.missionEndTime - now) / 1000));
        timerEl.textContent = `⏳ Training: ${formatRemainingTime(remaining)}`;
    });
}

function renderHaven() {
    const container = document.getElementById('havenGrid');
    const countEl = document.getElementById('havenSlimeCount');
    if (!container) return;

    if (game.slimes.length === 0) {
        container.innerHTML = '<div style="opacity:0.6; padding:8px; flex:1;">No slimes yet. Summon or campaign to recruit!</div>';
        havenCardCache.clear();
        if (countEl) countEl.textContent = '0 slimes';
        return;
    }

    const onMission = game.slimes.filter(s => s.onMission).length;
    if (countEl) {
        countEl.textContent = `${game.slimes.length} slime${game.slimes.length !== 1 ? 's' : ''}${onMission ? ` • ${onMission} training` : ''}`;
    }

    const sorted = sortHavenSlimes(game.slimes);
    const activeIds = new Set(sorted.map(s => String(s.id)));

    for (const [id, el] of havenCardCache) {
        if (!activeIds.has(String(id))) {
            el.remove();
            havenCardCache.delete(id);
        }
    }

    Array.from(container.children).forEach(child => {
        const rawId = child.dataset?.slimeId;
        if (!rawId || !activeIds.has(rawId)) child.remove();
    });

    sorted.forEach((slime, idx) => {
        let card = havenCardCache.get(slime.id);
        if (!card) {
            card = createHavenCard(slime);
            havenCardCache.set(slime.id, card);
        }
        updateHavenCardContent(card, slime);
        const current = container.children[idx];
        if (current !== card) {
            if (idx >= container.children.length) container.appendChild(card);
            else container.insertBefore(card, current);
        }
    });

    while (container.children.length > sorted.length) {
        container.lastChild.remove();
    }
}

// ==================== RENDER FUNCTIONS ====================

function formatRemainingTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}

function getRarityColor(rarity) {
    return RARITY_COLORS[rarity] || "#aaff99";
}

function getJellyProductionBonus(slime) {
    if (!slime.traits) return 0;
    return slime.traits.includes("jelly_producer") ? 2 : 0;
}

function renderInventory() {
    const container = document.getElementById('inventoryGrid');
    if (!container) return;
    container.innerHTML = '';

    const items = [
        { key: 'wood', label: 'Wood' }, { key: 'jelly', label: 'Jelly' }, { key: 'herbs', label: 'Herbs' },
        { key: 'stone', label: 'Stone' }, { key: 'gold', label: 'Gold' },
        { key: 'slimeShards', label: 'Slime Shards' }, { key: 'voidShards', label: 'Void Shards' },
        { key: 'skillBooks', label: 'Skill Books' }, { key: 'arcaneDust', label: 'Arcane Dust' },
        { key: 'trainingScrolls', label: 'Training Scrolls' }, { key: 'battleElixir', label: 'Battle Elixir' },
        { key: 'healingSalve', label: 'Healing Salve' }, { key: 'fertilityPotion', label: 'Fertility Potion' },
        { key: 'refinedEssence', label: 'Refined Essence' }, { key: 'divineShards', label: 'Divine Shards' },
        { key: 'manaShards', label: 'Mana Shards' }, { key: 'explorerTonic', label: 'Explorer Tonic' }
    ];

    if (game.artifacts?.length > 0) {
        const artDiv = document.createElement('div');
        artDiv.style.cssText = 'background:#1a2244; border:2px solid #aa88ff; border-radius:8px; padding:10px; margin:8px 0;';
        artDiv.innerHTML = `<strong>⚔️ Artifacts (${game.artifacts.length})</strong><br><small>${game.artifacts.slice(0,5).map(a => `${a.icon} ${a.slot}`).join(', ')}${game.artifacts.length > 5 ? '...' : ''}</small>`;
        container.appendChild(artDiv);
    }

    items.forEach(item => {
        const val = game.resources[item.key] || 0;
        if (val > 0) {
            const div = document.createElement('div');
            div.style.cssText = 'background:#113322; border:2px solid #77ffaa; border-radius:8px; padding:8px 10px; margin:4px 0;';
            div.innerHTML = `<strong>${item.label}:</strong> ${val}`;
            container.appendChild(div);
        }
    });
}

function renderPlayer() {
    const container = document.getElementById('playerStats');
    if (!container) return;
    const s = game.player.stats;
    const alchemyBonus = Math.floor((s.alchemy || 0) * 4);
    container.innerHTML = `
        <div class="stat-row"><strong>Stat Points Available:</strong> ${game.player.statPoints}</div>
        <div class="stat-row"><strong>Taming:</strong> ${s.taming} <small>(+${s.taming * 3}% better rarity)</small></div>
        <div class="stat-row"><strong>Alchemy:</strong> ${s.alchemy} <small>(+${alchemyBonus}% better yields)</small></div>
        <div class="stat-row"><strong>Combat:</strong> ${s.combat} <small>(+${s.combat * 2.5}% team power)</small></div>
        <div class="stat-row"><strong>Leadership:</strong> ${s.leadership} <small>(+1 slot every 4 points)</small></div>
        <div class="stat-row"><strong>Endurance:</strong> ${s.endurance} <small>(+${s.endurance * 5}% daily rewards)</small></div>
    `;
}

function renderWorkshop() {
    const container = document.getElementById('workshopUpgrades');
    if (!container) return;
    const refineryLevel = game.workshop.refinery || 0;
    container.innerHTML = `
        <button onclick="upgradeWorkshop('incubator')">Upgrade Incubator (Breeding) - 120 Gold + 8 Refined Essence</button>
        <button onclick="upgradeWorkshop('trainingHall')">Upgrade Training Hall - 150 Gold + 10 Refined Essence</button>
        <button onclick="upgradeWorkshop('refinery')">Upgrade Refinery (Alchemy) - 180 Gold + 12 Refined Essence<br><small>Current: Level ${refineryLevel} (+${refineryLevel * 15}% Refined yield)</small></button>
        <button onclick="upgradeWorkshop('advanced')">Advanced Workshop - 800 Gold + 25 Mana Shards + 8 Divine Shards</button>
    `;
}

function renderRecords() {
    // Combat Stats
    const combatEl = document.getElementById('combatStats');
    if (combatEl) {
        combatEl.innerHTML = `
            <div><strong>Total Damage Dealt:</strong> ${Math.floor(game.totalDamageDealt || 0).toLocaleString()}</div>
            <div><strong>Bosses Defeated:</strong> ${game.totalBossesDefeated || 0}</div>
        `;
    }

    // Progression Stats
    const progEl = document.getElementById('progressionStats');
    if (progEl) {
        const campStars = game.campaign?.totalStars || 0;
        progEl.innerHTML = `
            <div><strong>Highest Level:</strong> ${game.highestLevel || 1}</div>
            <div><strong>Campaign Stars:</strong> ${campStars}</div>
            <div><strong>Dungeons Cleared:</strong> ${game.totalDungeonsCleared || 0}</div>
            <div><strong>Divine Shards Earned:</strong> ${game.lifetimeDivineShards || 0}</div>
        `;
    }

    // Collection Stats
    const collEl = document.getElementById('collectionStats');
    if (collEl) {
        collEl.innerHTML = `
            <div><strong>Slimes Tamed:</strong> ${game.lifetimeSlimesTamed || 0}</div>
            <div><strong>Fusions Performed:</strong> ${game.totalFusions || 0}</div>
            <div><strong>Summons:</strong> ${game.totalSummons || 0}</div>
            <div><strong>Evolutions Performed:</strong> ${game.totalEvolutions || 0}</div>
        `;
    }

    // Other Stats
    const otherEl = document.getElementById('otherStats');
    if (otherEl) {
        const bonusPercent = Math.round(((game.globalPowerBonus || 1) - 1) * 100);
        otherEl.innerHTML = `
            <div><strong>Global Power Bonus:</strong> +${bonusPercent}%</div>
            <div><strong>Transcendences:</strong> ${game.prestige?.count || 0}</div>
            <div><strong>Divine Convergences:</strong> ${game.divineConvergenceCount || 0}</div>
        `;
    }

    // Trait Collection Stats (clean details with specific traits)
    const traitEl = document.getElementById('traitStats');
    if (traitEl) {
        let totalTraits = 0;
        let tierCount = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0 };
        let uniqueTraits = new Set();

        if (game.slimes && game.slimes.length > 0) {
            game.slimes.forEach(slime => {
                if (slime.traits && slime.traits.length > 0) {
                    totalTraits += slime.traits.length;
                    slime.traits.forEach(traitKey => {
                        uniqueTraits.add(traitKey);
                        const def = TRAIT_DEFINITIONS[traitKey];
                        if (def && tierCount[def.tier] !== undefined) {
                            tierCount[def.tier]++;
                        }
                    });
                }
            });
        }

        let html = `
            <div style="margin-bottom:8px;">
                <strong>Total Traits:</strong> ${totalTraits} &nbsp;&nbsp; 
                <strong>Unique:</strong> ${uniqueTraits.size}
            </div>

            <div style="margin-bottom:10px; font-size:11px;">
                <strong>By Tier:</strong><br>
                <span style="color:#9ca3af;">Common:</span> <strong>${tierCount.Common}</strong> &nbsp;
                <span style="color:#4ade80;">Uncommon:</span> <strong>${tierCount.Uncommon}</strong> &nbsp;
                <span style="color:#60a5fa;">Rare:</span> <strong>${tierCount.Rare}</strong> &nbsp;
                <span style="color:#c084fc;">Epic:</span> <strong>${tierCount.Epic}</strong>
            </div>
        `;

        if (uniqueTraits.size > 0) {
            html += `<div style="margin-top:6px;"><strong>Your Traits:</strong></div>`;
            html += `<div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:6px; max-height:80px; overflow-y:auto;">`;

            uniqueTraits.forEach(traitKey => {
                const def = TRAIT_DEFINITIONS[traitKey];
                if (def) {
                    const tierColor = def.tier === "Epic" ? "#c084fc" : 
                                     def.tier === "Rare" ? "#60a5fa" : 
                                     def.tier === "Uncommon" ? "#4ade80" : "#9ca3af";
                    
                    html += `<span onmouseenter="showTraitTooltip(this, '${traitKey}')" onmouseleave="hideTraitTooltip()"
                        style="background:#113322; border:1px solid ${tierColor}; border-radius:6px; padding:3px 8px; font-size:10px; color:${tierColor}; cursor:help;">
                        ${def.name}
                    </span>`;
                }
            });

            html += `</div>`;
        } else {
            html += `<div style="margin-top:8px; opacity:0.7; font-size:11px;">No traits yet. Higher rarity slimes are more likely to have traits.</div>`;
        }

        traitEl.innerHTML = html;
    }
}

// ==================== SPEND STAT POINT ====================
function spendStatPoint(stat) {
    if (game.player.statPoints <= 0) {
        log("No stat points left!");
        return;
    }
    game.player.stats[stat] = (game.player.stats[stat] || 0) + 1;
    game.player.statPoints--;
    log(`+1 ${stat.charAt(0).toUpperCase() + stat.slice(1)}`);
    updateUI();
}

// ==================== CAMPAIGN MODE ====================
function getCampaignProgressKey(stageId, mode) {
    return `${stageId}_${mode || game.campaign.mode}`;
}

function getStageProgress(stageId, mode) {
    const key = getCampaignProgressKey(stageId, mode);
    return game.campaign.progress[key] || { stars: 0, clears: 0, firstClear: false };
}

function isChapterBossBeaten(chapterId, mode = 'normal') {
    const ch = CAMPAIGN_CHAPTERS.find(c => c.id === chapterId);
    if (!ch) return false;
    const boss = ch.stages[ch.stages.length - 1];
    return getStageProgress(boss.id, mode).stars >= 1;
}

function isChapterUnlocked(chapter) {
    if (game.playerLevel < chapter.playerLevel) return false;
    if (!chapter.unlockChapter) return true;
    return isChapterBossBeaten(chapter.unlockChapter, 'normal');
}

function isCampaignModeUnlocked(mode) {
    if (mode === 'normal') return true;
    if (mode === 'hard') return CAMPAIGN_CHAPTERS.some(ch => isChapterBossBeaten(ch.id, 'normal'));
    if (mode === 'nightmare') return CAMPAIGN_CHAPTERS.some(ch => isChapterBossBeaten(ch.id, 'hard'));
    return false;
}

function isStageUnlocked(stage, chapter) {
    if (!isChapterUnlocked(chapter)) return false;
    const mode = game.campaign.mode;
    if (mode === 'hard' && chapter.unlockChapter && !isChapterBossBeaten(chapter.unlockChapter, 'normal')) return false;
    if (mode === 'nightmare' && chapter.unlockChapter && !isChapterBossBeaten(chapter.unlockChapter, 'hard')) return false;
    if (stage.num === 1) return true;
    const prev = chapter.stages[stage.num - 2];
    return getStageProgress(prev.id, mode).stars >= 1;
}

function getCurrentCampaignStage() {
    const mode = game.campaign.mode;
    for (const ch of CAMPAIGN_CHAPTERS) {
        if (!isChapterUnlocked(ch)) continue;
        for (const st of ch.stages) {
            if (isStageUnlocked(st, ch) && getStageProgress(st.id, mode).stars < 3) return st;
        }
    }
    return null;
}

function tickCampaignEnergy() {
    if (!game.campaign) return;
    const now = Date.now();
    const elapsed = now - (game.campaign.lastEnergyTick || now);
    const gained = Math.floor(elapsed / ENERGY_REGEN_MS);
    if (gained > 0) {
        game.campaign.energy = Math.min(game.campaign.maxEnergy, (game.campaign.energy || 0) + gained);
        game.campaign.lastEnergyTick = now - (elapsed % ENERGY_REGEN_MS);
    }
}

function spendCampaignEnergy(amount) {
    tickCampaignEnergy();
    if ((game.campaign.energy || 0) < amount) {
        log(`Need ${amount} energy (have ${game.campaign.energy || 0}). Wait or refill!`);
        return false;
    }
    game.campaign.energy -= amount;
    return true;
}

function refillEnergy(type) {
    tickCampaignEnergy();
    if (type === 'divine') {
        if ((game.resources.divineShards || 0) < ENERGY_REFILL_DIVINE_COST) {
            log(`Need ${ENERGY_REFILL_DIVINE_COST} Divine Shards`);
            return;
        }
        game.resources.divineShards -= ENERGY_REFILL_DIVINE_COST;
        game.campaign.energy = Math.min(game.campaign.maxEnergy, (game.campaign.energy || 0) + ENERGY_REFILL_DIVINE_AMOUNT);
        log(`+${ENERGY_REFILL_DIVINE_AMOUNT} Energy!`, true);
    } else if (type === 'tonic') {
        if ((game.explorerTonicCharges || 0) < 1) {
            log('Need Explorer Tonic charge (craft in Alchemy)');
            return;
        }
        game.explorerTonicCharges--;
        game.campaign.energy = Math.min(game.campaign.maxEnergy, (game.campaign.energy || 0) + 30);
        log('+30 Energy from Explorer Tonic!');
    }
    updateUI();
}

function setCampaignMode(mode) {
    if (!isCampaignModeUnlocked(mode)) {
        log(mode === 'hard' ? 'Beat a chapter boss on Normal to unlock Hard!' : '3-star all Hard stages in a chapter to unlock Nightmare!');
        return;
    }
    game.campaign.mode = mode;
    ['normal', 'hard', 'nightmare'].forEach(m => {
        const btn = document.getElementById(`mode${m.charAt(0).toUpperCase() + m.slice(1)}`);
        if (btn) {
            btn.classList.toggle('active', m === mode);
            btn.classList.toggle('locked-mode', !isCampaignModeUnlocked(m));
        }
    });
    renderCampaign();
}

function getCampaignStarDisplay(stars) {
    return [1, 2, 3].map(s => (stars >= s ? '★' : '☆')).join('');
}

function renderCampaign() {
    tickCampaignEnergy();
    const c = game.campaign;
    const mode = c.mode || 'normal';

    const ePct = ((c.energy || 0) / (c.maxEnergy || MAX_ENERGY)) * 100;
    const eFill = document.getElementById('energyFill');
    const eText = document.getElementById('energyText');
    const regenEl = document.getElementById('energyRegenText');
    if (eFill) eFill.style.width = `${ePct}%`;
    if (eText) eText.textContent = `${Math.floor(c.energy || 0)}/${c.maxEnergy || MAX_ENERGY}`;
    if (regenEl) {
        const msLeft = ENERGY_REGEN_MS - (Date.now() - (c.lastEnergyTick || Date.now()));
        if ((c.energy || 0) >= (c.maxEnergy || MAX_ENERGY)) regenEl.textContent = 'Full';
        else regenEl.textContent = `+1 in ${Math.max(0, Math.ceil(msLeft / 1000))}s`;
    }

    ['normal', 'hard', 'nightmare'].forEach(m => {
        const btn = document.getElementById(`mode${m.charAt(0).toUpperCase() + m.slice(1)}`);
        if (btn) {
            btn.classList.toggle('active', m === mode);
            btn.classList.toggle('locked-mode', !isCampaignModeUnlocked(m));
            btn.disabled = !isCampaignModeUnlocked(m);
        }
    });

    let totalStars = 0, maxStars = 0;
    CAMPAIGN_CHAPTERS.forEach(ch => {
        ch.stages.forEach(st => {
            maxStars += 3;
            totalStars += getStageProgress(st.id, mode).stars;
        });
    });
    c.totalStars = totalStars;
    const overallPct = maxStars ? Math.floor((totalStars / maxStars) * 100) : 0;
    const oBar = document.getElementById('campaignOverallBar');
    const oText = document.getElementById('campaignOverallText');
    if (oBar) oBar.style.width = `${overallPct}%`;
    if (oText) oText.textContent = `${overallPct}% • ${totalStars}/${maxStars} ★`;

    const scroll = document.getElementById('chapterScroll');
    if (scroll) {
        scroll.innerHTML = '';
        CAMPAIGN_CHAPTERS.forEach(ch => {
            const unlocked = isChapterUnlocked(ch);
            let chStars = 0, chMax = ch.stages.length * 3;
            ch.stages.forEach(st => { chStars += getStageProgress(st.id, mode).stars; });
            const chPct = chMax ? Math.floor((chStars / chMax) * 100) : 0;
            const card = document.createElement('div');
            card.className = 'chapter-card' + (unlocked ? '' : ' locked') + (c.selectedChapter === ch.id ? ' active-chapter' : '');
            card.onclick = () => { if (unlocked) { c.selectedChapter = ch.id; renderCampaign(); } };
            card.innerHTML = `
                <div class="ch-icon">${ch.icon}</div>
                <div class="ch-title">Ch.${ch.id} ${ch.name}</div>
                <div class="ch-story">${unlocked ? ch.story : `🔒 Lv ${ch.playerLevel}+ & Ch.${ch.unlockChapter || 0} boss`}</div>
                <div class="ch-progress">${chStars}/${chMax} ★ (${chPct}%)</div>
                <div class="ch-bar"><div class="ch-bar-fill" style="width:${chPct}%"></div></div>
            `;
            scroll.appendChild(card);
        });
    }

    const selCh = CAMPAIGN_CHAPTERS.find(ch => ch.id === c.selectedChapter) || CAMPAIGN_CHAPTERS[0];
    const titleEl = document.getElementById('selectedChapterTitle');
    if (titleEl) titleEl.textContent = `${selCh.icon} Chapter ${selCh.id}: ${selCh.name}`;

    const grid = document.getElementById('stageGrid');
    const currentSt = getCurrentCampaignStage();
    if (grid) {
        grid.innerHTML = '';
        selCh.stages.forEach(st => {
            const prog = getStageProgress(st.id, mode);
            const unlocked = isStageUnlocked(st, selCh);
            const isCurrent = currentSt && currentSt.id === st.id;
            const card = document.createElement('div');
            card.className = 'stage-card' + (st.isBoss ? ' boss-stage' : '') + (unlocked ? '' : ' locked') + (prog.stars >= 1 ? ' cleared' : '') + (isCurrent ? ' available' : '');
            card.onclick = () => { if (unlocked) openCampaignStageModal(st, selCh); };
            card.innerHTML = `
                <div class="stage-num">${st.label}${st.isBoss ? ' 👹' : ''}</div>
                <div class="stage-name">${st.name}</div>
                <div class="stage-meta">⚡${st.energy} • ${st.power} PWR • ${st.element}</div>
                <div class="stage-stars">${getCampaignStarDisplay(prog.stars)}</div>
            `;
            grid.appendChild(card);
        });
    }

    updateCampaignDefaultTeamDisplay();
}

// ==================== CAMPAIGN TEAM & SLIME EXP ====================
function getValidCampaignSlimeIds(ids) {
    return (ids || []).filter(id => game.slimes.some(s => s.id === id && !s.onMission)).slice(0, 4);
}

function applyCampaignDefaultTeamSelection() {
    selectedCampaignSlimeIds = getValidCampaignSlimeIds(game.campaign.defaultTeam);
}

function initCampaignTeamSelection() {
    if (game.campaign.useDefaultTeam && game.campaign.defaultTeam?.length) {
        applyCampaignDefaultTeamSelection();
    } else if (selectedCampaignSlimeIds.length === 0) {
        selectedCampaignSlimeIds = getTopSlimes(4).filter(s => !s.onMission).map(s => s.id);
    } else {
        selectedCampaignSlimeIds = getValidCampaignSlimeIds(selectedCampaignSlimeIds);
    }
}

function getCampaignTeam() {
    let ids = getValidCampaignSlimeIds(selectedCampaignSlimeIds);
    if (ids.length === 0 && game.campaign.useDefaultTeam) {
        ids = getValidCampaignSlimeIds(game.campaign.defaultTeam);
    }
    if (ids.length === 0) {
        return getTopSlimes(4).filter(s => !s.onMission);
    }
    return ids.map(id => game.slimes.find(s => s.id === id)).filter(Boolean);
}

function getCampaignTeamPower() {
    return getCampaignTeam().reduce((s, x) => s + x.power, 0);
}

function formatCampaignDefaultTeamHtml() {
    const saved = getValidCampaignSlimeIds(game.campaign.defaultTeam);
    if (!saved.length) {
        return '<span style="opacity:0.75;">No default team saved. Open a stage to pick slimes and press <strong>Save as Default Team</strong>.</span>';
    }
    const names = saved.map(id => {
        const s = game.slimes.find(x => x.id === id);
        return s ? `${getSlimeIconHTML(s, 'xs')} ${s.name} (Lv${s.level})` : '';
    }).filter(Boolean).join(' • ');
    const modeLabel = game.campaign.useDefaultTeam ? '<span style="color:#77ffaa;">Auto-use ON</span>' : '<span style="color:#ffaa66;">Manual pick</span>';
    return `<strong style="color:#ffdd77;">Default Team</strong> (${modeLabel}): ${names}`;
}

function updateCampaignDefaultTeamDisplay() {
    const el = document.getElementById('campaignDefaultTeamDisplay');
    if (el) el.innerHTML = formatCampaignDefaultTeamHtml();
    const bar = document.getElementById('campaignDefaultTeamBar');
    if (bar) bar.innerHTML = formatCampaignDefaultTeamHtml();
}

function updateCampaignTeamSummary(stage) {
    const summary = document.getElementById('campaignTeamSummary');
    const count = document.getElementById('campaignSelectionCount');
    const team = getCampaignTeam();
    const teamPwr = team.reduce((s, x) => s + x.power, 0);
    const expPreview = stage ? calcCampaignSlimeExpPerSlime(stage, 3, false) : 0;
    if (summary) {
        if (team.length === 0) {
            summary.innerHTML = '<span style="color:#ffaa66;">Select at least 1 slime to fight.</span>';
        } else {
            const elem = stage?.element || stage?.recElement || '';
            summary.innerHTML = team.map(s => {
                const adv = elem ? getAdvantageMultiplier(s.element, elem) : 1;
                let badge = adv > 1 ? ' <span class="effect-badge effect-strong">Strong</span>' :
                    adv < 1 ? ' <span class="effect-badge effect-weak">Weak</span>' : '';
                return `${s.name} (${s.power} PWR)${badge}`;
            }).join(' • ') + `<br><small>Team Power: <strong>${teamPwr}</strong> • ~${expPreview} EXP/slime on 3★ clear</small>`;
        }
    }
    if (count) count.textContent = `${team.length} / 4 selected`;
}

function renderCampaignTeamPicker(stage) {
    const list = document.getElementById('campaignSlimeSelectionList');
    const useDefaultBtn = document.getElementById('campaignUseDefaultBtn');
    if (!list) return;

    if (useDefaultBtn) {
        useDefaultBtn.textContent = game.campaign.useDefaultTeam ? '✋ Select Manually' : '⚡ Use Default Team';
        useDefaultBtn.style.background = game.campaign.useDefaultTeam ? '#1a4422' : '#1a3355';
    }

    updateCampaignDefaultTeamDisplay();
    list.innerHTML = '';

    const available = game.slimes.filter(s => !s.onMission);
    if (available.length === 0) {
        list.innerHTML = '<p style="color:#ffaa66; font-size:11px;">No slimes available (all on training missions).</p>';
        updateCampaignTeamSummary(stage);
        return;
    }

    const stageElem = stage?.element || stage?.recElement || '';
    const manualMode = !game.campaign.useDefaultTeam;

    game.slimes.forEach((slime, index) => {
        if (slime.onMission) return;
        const div = document.createElement('div');
        const selected = selectedCampaignSlimeIds.includes(slime.id);
        div.className = 'slime-select-item campaign-slime-select-item' + (selected ? ' selected' : '') + (manualMode ? '' : ' disabled-pick');

        const adv = stageElem ? getAdvantageMultiplier(slime.element, stageElem) : 1;
        let badge = '';
        if (adv > 1) badge = `<span class="effect-badge effect-strong">+${Math.round((adv - 1) * 100)}%</span>`;
        else if (adv < 1) badge = `<span class="effect-badge effect-weak">-${Math.round((1 - adv) * 100)}%</span>`;
        else badge = `<span class="effect-badge effect-neutral">Neutral</span>`;

        div.innerHTML = `
            ${getSlimeIconHTML(slime, 'md')}
            <div style="flex:1;">
                <strong>${slime.name}</strong> (Lv ${slime.level} ${slime.element} ${slime.rarity})<br>
                <small>${slime.power} PWR</small> ${badge}
            </div>
        `;
        if (manualMode) div.onclick = () => toggleCampaignSlimeSelection(index, div);
        list.appendChild(div);
    });

    updateCampaignTeamSummary(stage);
}

function toggleCampaignSlimeSelection(index, element) {
    if (game.campaign.useDefaultTeam) return;
    const slime = game.slimes[index];
    if (!slime || slime.onMission) return;
    const id = slime.id;
    const pos = selectedCampaignSlimeIds.indexOf(id);
    if (pos > -1) {
        selectedCampaignSlimeIds.splice(pos, 1);
        element.classList.remove('selected');
    } else {
        if (selectedCampaignSlimeIds.length >= 4) { log('Max 4 slimes for campaign'); return; }
        selectedCampaignSlimeIds.push(id);
        element.classList.add('selected');
    }
    updateCampaignTeamSummary(selectedCampaignStage);
    const count = document.getElementById('campaignSelectionCount');
    if (count) count.textContent = `${selectedCampaignSlimeIds.length} / 4 selected`;
}

function toggleCampaignUseDefault() {
    game.campaign.useDefaultTeam = !game.campaign.useDefaultTeam;
    if (game.campaign.useDefaultTeam) {
        applyCampaignDefaultTeamSelection();
        if (!selectedCampaignSlimeIds.length) {
            selectedCampaignSlimeIds = getTopSlimes(4).filter(s => !s.onMission).map(s => s.id);
        }
        log('Using default campaign team.', true);
    } else {
        log('Manual team selection enabled.');
    }
    renderCampaignTeamPicker(selectedCampaignStage);
    updateCampaignDefaultTeamDisplay();
}

function saveCampaignDefaultTeam() {
    const ids = getValidCampaignSlimeIds(selectedCampaignSlimeIds);
    const fallback = getCampaignTeam().map(s => s.id);
    const finalIds = ids.length ? ids : fallback;
    if (!finalIds.length) { log('Select at least 1 slime for your default team'); return; }
    game.campaign.defaultTeam = finalIds.slice(0, 4);
    game.campaign.useDefaultTeam = true;
    selectedCampaignSlimeIds = [...game.campaign.defaultTeam];
    log(`💾 Default team saved! (${finalIds.length} slime${finalIds.length !== 1 ? 's' : ''})`, true);
    updateCampaignDefaultTeamDisplay();
    renderCampaignTeamPicker(selectedCampaignStage);
    renderCampaign();
}

function calcCampaignSlimeExpPerSlime(stage, stars = 1, isSweep = false) {
    const mode = game.campaign.mode;
    const modeMult = CAMPAIGN_REWARD_MULT[mode] || 1;
    let base = 6 + Math.floor(stage.power * 0.05) + stage.chapterId * 2;
    if (stage.isBoss) base = Math.floor(base * 1.45);
    base = Math.floor(base * modeMult);
    const starBonus = 1 + Math.max(0, stars - 1) * 0.12;
    const sweepMult = isSweep ? 0.55 : 1;
    return Math.max(5, Math.floor(base * starBonus * sweepMult));
}

function grantCampaignSlimeExp(team, stage, stars, isSweep = false) {
    if (!team?.length || !stage) return [];
    const perSlime = calcCampaignSlimeExpPerSlime(stage, stars, isSweep);
    const results = [];
    team.forEach(slime => {
        const live = game.slimes.find(s => s.id === slime.id);
        if (!live) return;
        live.exp = (live.exp || 0) + perSlime;
        syncSlimeLevelFromExp(live);
        recalculateSlimePower(live);
        results.push({ name: live.name, exp: perSlime, level: live.level });
    });
    if (results.length) {
        const detail = results.map(r => `${r.name} +${r.exp} EXP`).join(', ');
        log(`✨ Slime EXP earned: ${detail}`, true);
    }
    return results;
}

function openCampaignStageModal(stage, chapter) {
    selectedCampaignStage = stage;
    const mode = game.campaign.mode;
    const prog = getStageProgress(stage.id, mode);
    const mult = CAMPAIGN_MODE_MULT[mode] || 1;
    initCampaignTeamSelection();
    const teamPwr = getCampaignTeamPower();
    const exp1 = calcCampaignSlimeExpPerSlime(stage, 1, false);
    const exp3 = calcCampaignSlimeExpPerSlime(stage, 3, false);

    document.getElementById('campaignStageTitle').textContent = `${stage.label} ${stage.name}`;
    let modText = stage.modifier ? `<p style="color:#ff8866;">⚠️ ${stage.modifier}</p>` : '';
    if (stage.isBoss) modText += `<p style="color:#ffdd77;">👹 Chapter Boss — bonus first-clear rewards!</p>`;

    document.getElementById('campaignStageBody').innerHTML = `
        <p><strong>${chapter.name}</strong> • Mode: <span style="color:#aaff99;">${mode.toUpperCase()}</span></p>
        ${modText}
        <p>⚡ Energy: <strong>${stage.energy}</strong> • Enemies: ${stage.enemies} • Power: ~${Math.floor(stage.power * mult)}</p>
        <p>Recommend: <strong style="color:#77ffaa;">${stage.recElement}</strong> element • Team Power: <strong>${teamPwr}</strong></p>
        <p>Stars: ${getCampaignStarDisplay(prog.stars)} — 2★ under ${stage.turnLimit} turns, 3★ no allies defeated</p>
        <p style="font-size:10px; opacity:0.8;">Rewards: ~${stage.gold}g, ${stage.shards} shards, ${stage.exp} Player XP${prog.firstClear ? '' : ' + FIRST CLEAR BONUS'}</p>
        <p style="font-size:10px; color:#aaffcc;">🐾 Participating slimes earn <strong>${exp1}–${exp3} EXP</strong> each (scales with stars & difficulty)</p>
    `;

    renderCampaignTeamPicker(stage);

    const sweepBtn = document.getElementById('campaignSweepBtn');
    if (sweepBtn) sweepBtn.style.display = prog.stars >= 3 ? 'block' : 'none';

    document.getElementById('campaignStageModal').style.display = 'flex';
}

function closeCampaignStageModal() {
    document.getElementById('campaignStageModal').style.display = 'none';
    selectedCampaignStage = null;
}

function generateCampaignEnemies(stage) {
    const mode = game.campaign.mode;
    const mult = CAMPAIGN_MODE_MULT[mode] || 1;
    const power = Math.floor(stage.power * mult);
    const elem = stage.forcedElement || stage.element;
    const count = stage.enemies;
    const enemies = [];
    for (let i = 0; i < count; i++) {
        const e = createSlimeFromRoll(
            stage.isBoss ? (mode === 'nightmare' ? 'Legendary' : 'Epic') : (power > 200 ? 'Rare' : 'Uncommon'),
            elem
        );
        e.name = stage.isBoss ? stage.name : `Foe ${i + 1}`;
        e.level = Math.max(1, Math.floor(power / 40));
        e.power = Math.floor(power / count * (0.85 + Math.random() * 0.3));
        recalculateSlimePower(e);
        e.power = Math.floor(power / count * (0.9 + Math.random() * 0.2));
        enemies.push(e);
    }
    return enemies;
}

function grantCampaignRewards(stage, stars, isSweep = false) {
    const mode = game.campaign.mode;
    const rMult = (CAMPAIGN_REWARD_MULT[mode] || 1) * (isSweep ? SWEEP_REWARD_MULT : 1);
    const prog = getStageProgress(stage.id, mode);
    const firstClear = !prog.firstClear;

    let gold = Math.floor(stage.gold * rMult * (1 + stars * 0.08));
    let shards = Math.floor(stage.shards * rMult);
    let exp = Math.floor(stage.exp * rMult);

    if (firstClear && !isSweep) {
        gold = Math.floor(gold * 1.8);
        shards += 3 + stage.chapterId;
        if (stage.isBoss) {
            shards += 8;
            game.resources.divineShards = (game.resources.divineShards || 0) + 1 + Math.floor(stage.chapterId / 2);
            log(`🎉 Chapter ${stage.chapterId} boss beaten! Dungeon tier unlocked.`);
            if (stage.chapterId >= 3) log('✨ Advanced Alchemy recipes now available!');
        }
    }
    if (stars === 3 && !isSweep) shards += 2;

    game.resources.gold = (game.resources.gold || 0) + gold;
    game.resources.slimeShards = (game.resources.slimeShards || 0) + shards;
    gainPlayerExp(exp);

    const resChance = stage.exploreDiff === 'Easy' ? 0.6 : stage.exploreDiff === 'Medium' ? 0.72 : 0.82;
    const drops = [];
    if (Math.random() < resChance) { game.resources.wood = (game.resources.wood || 0) + 2; drops.push('Wood'); }
    if (Math.random() < resChance * 0.8) { game.resources.jelly = (game.resources.jelly || 0) + 1; drops.push('Jelly'); }
    if (Math.random() < resChance * 0.5) { game.resources.herbs = (game.resources.herbs || 0) + 1; drops.push('Herbs'); }
    if (stage.exploreDiff === 'Hard' || stage.exploreDiff === 'Extreme') {
        if (Math.random() < 0.4) { game.resources.crystal = (game.resources.crystal || 0) + 1; drops.push('Crystal'); }
        if (Math.random() < 0.25) { game.resources.arcaneDust = (game.resources.arcaneDust || 0) + 1; drops.push('Arcane'); }
    }
    if (Math.random() < stage.slimeChance && !isSweep) {
        const slime = generateRandomSlime(stage.exploreDiff);
        game.slimes.push(slime);
        game.lifetimeSlimesTamed = (game.lifetimeSlimesTamed || 0) + 1;
        drops.push(`${slime.rarity} Slime!`);
    }
    if (Math.random() < 0.08 * stage.chapterId && !isSweep) {
        game.artifacts.push(generateArtifact(stage.chapterId >= 4 ? 'rare' : 'uncommon'));
        drops.push('Artifact');
    }

    return { gold, shards, exp, drops, firstClear };
}

function saveCampaignStageResult(stage, stars, turns, alliesLost) {
    const mode = game.campaign.mode;
    const key = getCampaignProgressKey(stage.id, mode);
    const prev = getStageProgress(stage.id, mode);
    const newStars = Math.max(prev.stars, stars);
    game.campaign.progress[key] = {
        stars: newStars,
        clears: (prev.clears || 0) + 1,
        firstClear: prev.firstClear || stars >= 1,
        bestTurns: prev.bestTurns ? Math.min(prev.bestTurns, turns) : turns,
        flawless: prev.flawless || alliesLost === 0
    };
}

function enterCampaignStage() {
    if (!selectedCampaignStage || !canPerformAction()) return;
    const stage = selectedCampaignStage;
    if (!spendCampaignEnergy(stage.energy)) return;

    const team = getCampaignTeam();
    if (team.length === 0) { log('Need slimes!'); game.campaign.energy += stage.energy; return; }

    const teamSnapshot = team.map(s => ({ id: s.id, name: s.name }));
    closeCampaignStageModal();
    const enemies = generateCampaignEnemies(stage);
    campaignCombatMeta = { stage, turnLimit: stage.turnLimit, alliesLost: 0, teamIds: team.map(s => s.id) };

    runCombat(team, enemies, `🗺️ ${stage.label} ${stage.name}`, (won, stats) => {
        if (!won) {
            log(`Failed ${stage.name}. Level up and try again!`);
            game.battleElixirActive = false;
            updateUI();
            return;
        }
        const turns = stats?.turns || 99;
        const alliesLost = stats?.alliesDefeated || 0;
        let stars = 1;
        if (turns <= stage.turnLimit) stars = 2;
        if (alliesLost === 0) stars = 3;

        const participants = teamSnapshot.map(t => game.slimes.find(s => s.id === t.id)).filter(Boolean);
        saveCampaignStageResult(stage, stars, turns, alliesLost);
        const rewards = grantCampaignRewards(stage, stars, false);
        grantCampaignSlimeExp(participants, stage, stars, false);
        updateQuestProgress('explore', 1);
        log(`${stage.label} cleared! ${getCampaignStarDisplay(stars)} +${rewards.gold}g, ${rewards.shards} shards${rewards.drops.length ? ' • ' + rewards.drops.join(', ') : ''}`, true);
        game.battleElixirActive = false;
        renderCampaign();
        updateDungeonLocks();
        updateBossLocks();
        updateUI();
    });
}

function sweepCampaignStage() {
    if (!selectedCampaignStage) return;
    const stage = selectedCampaignStage;
    const prog = getStageProgress(stage.id, game.campaign.mode);
    if (prog.stars < 3) { log('Need 3 stars to sweep'); return; }
    if (!spendCampaignEnergy(stage.energy)) return;

    const team = getCampaignTeam();
    const participants = team.map(s => ({ id: s.id, name: s.name }));
    closeCampaignStageModal();
    saveCampaignStageResult(stage, 3, prog.bestTurns || 99, 0);
    const rewards = grantCampaignRewards(stage, 3, true);
    const liveTeam = participants.map(t => game.slimes.find(s => s.id === t.id)).filter(Boolean);
    grantCampaignSlimeExp(liveTeam, stage, 3, true);
    updateQuestProgress('explore', 1);
    log(`🌀 Swept ${stage.label}! +${rewards.gold}g, ${rewards.shards} shards`, true);
    renderCampaign();
    updateUI();
}

function updateExploreLocks() { renderCampaign(); }

function updateDungeonLocks() {
    Object.keys(DUNGEON_REQUIREMENTS).forEach(id => {
        const card = document.getElementById(`card-${id}`);
        const lockText = document.getElementById(`lock-${id}`);
        if (!card || !lockText) return;
        const btn = card.querySelector('button');
        const req = DUNGEON_REQUIREMENTS[id];
        const chUnlock = CAMPAIGN_DUNGEON_UNLOCKS[id];
        const campaignOk = chUnlock ? isChapterBossBeaten(chUnlock, 'normal') : true;
        const levelOk = game.playerLevel >= req;
        if (levelOk && campaignOk) {
            card.classList.remove('locked');
            if (btn) btn.disabled = false;
            lockText.style.display = 'none';
        } else {
            card.classList.add('locked');
            if (btn) btn.disabled = true;
            lockText.style.display = 'block';
            if (!campaignOk) lockText.innerText = `🔒 Beat Chapter ${chUnlock} Boss`;
            else lockText.innerText = `🔒 Requires Player Level ${req}`;
        }
    });
}

function updateBossLocks() {
    Object.keys(BOSS_REQUIREMENTS).forEach(id => {
        const card = document.getElementById(`card-${id}`);
        const lockText = document.getElementById(`lock-${id}`);
        if (!card || !lockText) return;
        const btn = card.querySelector('button');
        const req = BOSS_REQUIREMENTS[id];
        const chUnlock = CAMPAIGN_BOSS_UNLOCKS[id];
        const campaignOk = chUnlock ? isChapterBossBeaten(chUnlock, 'normal') : true;
        const levelOk = game.playerLevel >= req;
        if (levelOk && campaignOk) {
            card.classList.remove('locked');
            if (btn) btn.disabled = false;
            lockText.style.display = 'none';
        } else {
            card.classList.add('locked');
            if (btn) btn.disabled = true;
            lockText.style.display = 'block';
            if (!campaignOk) lockText.innerText = `🔒 Beat Chapter ${chUnlock} Boss in Campaign`;
            else lockText.innerText = `🔒 Requires Player Level ${req}`;
        }
    });
}

// ==================== DUNGEON & BOSS ====================
function runDungeon(dungeonId) {
    const req = DUNGEON_REQUIREMENTS[dungeonId];
    if (game.playerLevel < req) { log(`Requires Player Level ${req}`); return; }

    const team = getTopSlimes(4);
    if (team.length === 0) { log('Need slimes for dungeon'); return; }

    const power = team.reduce((s, x) => s + x.power, 0);
    const enemyPower = 60 + req * 25 + game.playerLevel * 3;
    const waves = [
        generateEnemyTeam(enemyPower * 0.6, 2),
        generateEnemyTeam(enemyPower, 3)
    ];

    let waveIndex = 0;
    const runWave = () => {
        runCombat(team, waves[waveIndex], `🗺️ ${dungeonId.replace(/_/g, ' ')} — Wave ${waveIndex + 1}/${waves.length}`, (won) => {
            if (!won) {
                game.battleElixirActive = false;
                if ((game.resources.healingSalve || 0) > 0 && Math.random() < 0.35) {
                    game.resources.healingSalve--;
                    log("Healing Salve softened the defeat!");
                }
                updateUI();
                return;
            }
            waveIndex++;
            if (waveIndex < waves.length) {
                setTimeout(runWave, 800);
            } else {
                onDungeonComplete(dungeonId);
            }
        });
    };
    runWave();
}

function onDungeonComplete(dungeonId) {
    const goldGain = 35 + Math.floor(game.playerLevel * 2.8);
    const essenceGain = 4 + Math.floor(game.playerLevel / 6);
    game.resources.gold = (game.resources.gold || 0) + goldGain;
    game.resources.slimeEssence = (game.resources.slimeEssence || 0) + essenceGain;
    game.resources.slimeShards = (game.resources.slimeShards || 0) + 5 + Math.floor(Math.random() * 6);

    if (dungeonId === 'abyssal_throne' || dungeonId === 'origin_core') {
        game.resources.divineShards = (game.resources.divineShards || 0) + 1;
        game.lifetimeDivineShards = (game.lifetimeDivineShards || 0) + 1;
    }
    if (Math.random() < 0.3) {
        game.artifacts.push(generateArtifact(Math.random() < 0.2 ? 'epic' : 'rare'));
        log('Found artifact loot!');
    }
    if (Math.random() < 0.35) {
        const newSlime = generateRandomSlime("Hard");
        game.slimes.push(newSlime);
        game.lifetimeSlimesTamed = (game.lifetimeSlimesTamed || 0) + 1;
        log(`Dungeon cleared! +${goldGain} Gold, ${essenceGain} Essence, tamed ${newSlime.rarity} slime!`);
    } else {
        log(`Dungeon cleared! +${goldGain} Gold, ${essenceGain} Essence`);
    }
    game.totalDungeonsCleared = (game.totalDungeonsCleared || 0) + 1;
    updateQuestProgress('dungeon', 1);
    gainPlayerExp(12 + Math.floor(game.playerLevel / 3));
    game.battleElixirActive = false;
    updateUI();
}

function prepareForBossFight(bossId) {
    if (game.playerLevel < BOSS_REQUIREMENTS[bossId]) {
        log(`Requires Player Level ${BOSS_REQUIREMENTS[bossId]}`); return;
    }
    currentBossId = bossId;
    selectedSlimeIds = [];
    const modal = document.getElementById('bossTeamModal');
    const title = document.getElementById('modalBossTitle');
    const info = document.getElementById('modalBossInfo');
    const list = document.getElementById('slimeSelectionList');

    const boss = bossData[bossId];
    title.innerText = `Prepare for ${boss.name}`;
    info.innerHTML = `<strong>Element:</strong> ${boss.element} • Base Power: ${boss.basePower}`;

    list.innerHTML = '';
    if (game.slimes.length === 0) {
        list.innerHTML = '<p style="color:#ffaa66;">You have no slimes! Explore first.</p>';
        return;
    }

    game.slimes.forEach((slime, index) => {
        const div = document.createElement('div');
        div.className = 'slime-select-item';
        const adv = getAdvantageMultiplier(slime.element, boss.element);
        let badge = '';
        if (adv > 1) badge = `<span class="effect-badge effect-strong">+${Math.round((adv-1)*100)}%</span>`;
        else if (adv < 1) badge = `<span class="effect-badge effect-weak">-${Math.round((1-adv)*100)}%</span>`;
        else badge = `<span class="effect-badge effect-neutral">Neutral</span>`;

        div.innerHTML = `
            ${getSlimeIconHTML(slime, 'md')}
            <div style="flex:1;">
                <strong>${slime.name}</strong> (Lv ${slime.level} ${slime.element} ${slime.rarity})<br>
                <small>${slime.power} PWR</small> ${badge}
            </div>
        `;
        div.onclick = () => toggleSlimeSelection(index, div);
        list.appendChild(div);
    });

    modal.style.display = 'flex';
    updateTeamSummary();
}

function getAdvantageMultiplier(slimeElement, bossElement) {
    const chart = ELEMENT_CHART[slimeElement];
    if (!chart) return 1.0;
    if (chart.strong.includes(bossElement)) return 1.55;
    if (chart.weak.includes(bossElement)) return 0.55;
    return 1.0;
}

// Temporary buff from Slime Party
function getPartyPowerMultiplier() {
    if (game.partyPowerBonusUntil && Date.now() < game.partyPowerBonusUntil) {
        return 1.10;
    }
    return 1.0;
}

// ==================== FAIR SLIME POWER SYSTEM ====================
function getArtifactBonuses(slime) {
    let atk = 0, hp = 0, def = 0, crit = 0, spd = 0;
    const setCounts = {};
    if (!slime.artifacts) return { atk, hp, def, crit, spd, setCounts, multiplier: 1 };

    Object.values(slime.artifacts).forEach(art => {
        if (!art) return;
        atk += art.atk || 0;
        hp += art.hp || 0;
        def += art.def || 0;
        crit += art.crit || 0;
        spd += art.spd || 0;
        setCounts[art.setId] = (setCounts[art.setId] || 0) + 1;
    });

    let multiplier = 1;
    Object.entries(setCounts).forEach(([setId, count]) => {
        const set = ARTIFACT_SETS[setId];
        if (!set) return;
        if (count >= 2) multiplier *= 1.08;
        if (count >= 4) multiplier *= 1.12;
    });

    return { atk, hp, def, crit, spd, setCounts, multiplier };
}

function getSkillPowerBonus(slime) {
    if (!slime.skills) return 1;
    let bonus = 1;
    slime.skills.forEach(s => {
        bonus += (s.level || 1) * 0.02;
        if (s.id === 'crit_passive') bonus += 0.06;
        if (s.id === 'tank_passive') bonus += 0.04;
    });
    return bonus;
}

function getAscensionMultiplier(slime) {
    const stages = slime.ascension || (slime.evolved ? 1 : 0);
    return 1 + stages * 0.22;
}

function getGuildBonus() {
    return 1 + ((game.guild?.level || 1) - 1) * 0.02;
}

function recalculateSlimePower(slime) {
    if (!slime || !slime.rarity) return;

    const rarityMulti = {
        "Common": 1.00, "Uncommon": 1.32, "Rare": 1.68,
        "Epic": 2.15, "Legendary": 2.85, "Mythic": 3.75
    }[slime.rarity] || 1.0;

    let levelPower;
    if (slime.level <= 70) {
        levelPower = 22 + (slime.level * 1.85);
    } else {
        const excess = slime.level - 70;
        levelPower = 22 + (70 * 1.85) + (excess * 0.55) + (Math.sqrt(excess) * 4.2);
    }

    let power = Math.floor(levelPower * rarityMulti);
    power = Math.floor(power * getAscensionMultiplier(slime));

    const artBonus = getArtifactBonuses(slime);
    power = Math.floor(power * artBonus.multiplier);
    power += Math.floor((artBonus.atk + artBonus.hp * 0.3 + artBonus.def * 0.5) * (1 + artBonus.crit * 0.01));

    if (power > 1350) {
        const excess = power - 1350;
        power = 1350 + Math.floor(Math.pow(excess, 0.58) * 7.5);
    }
    if (power > 8500) power = 8500 + Math.floor((power - 8500) * 0.15);

    power = Math.floor(power * applyTraitEffects(slime));
    power = Math.floor(power * getSkillPowerBonus(slime));
    power = Math.floor(power * getGuildBonus());

    slime.power = Math.max(12, power);
}

function toggleSlimeSelection(index, element) {
    const id = game.slimes[index].id;
    const pos = selectedSlimeIds.indexOf(id);
    if (pos > -1) {
        selectedSlimeIds.splice(pos, 1);
        element.classList.remove('selected');
    } else {
        if (selectedSlimeIds.length >= 4) { log("Max 4 slimes allowed"); return; }
        selectedSlimeIds.push(id);
        element.classList.add('selected');
    }
    updateTeamSummary();
}

function updateTeamSummary() {
    const summary = document.getElementById('summaryText');
    const count = document.getElementById('selectionCount');
    if (!summary || !count || !currentBossId) return;

    if (selectedSlimeIds.length === 0) {
        summary.innerHTML = 'Select up to 4 slimes to fight.';
        count.innerText = '0 / 4 selected';
        return;
    }

    const boss = bossData[currentBossId];
    let totalPower = 0;
    let avgMultiplier = 0;

    selectedSlimeIds.forEach(id => {
        const slime = game.slimes.find(s => s.id === id);
        if (slime) {
            const mult = getAdvantageMultiplier(slime.element, boss.element);
            totalPower += slime.power * mult;
            avgMultiplier += mult;
        }
    });

    avgMultiplier = avgMultiplier / selectedSlimeIds.length;
    const combatBonus = 1 + ((game.player.stats.combat || 0) * 0.04);
    const elixirBonus = game.battleElixirActive ? 1.25 : 1.0;
    const finalPower = Math.floor(totalPower * combatBonus * elixirBonus * game.globalPowerBonus);

    let extraInfo = '';
    if (game.partyPowerBonusUntil && Date.now() < game.partyPowerBonusUntil) {
        extraInfo += `<br><span style="color:#aaff99;">✨ Slime Party buff active!</span>`;
    }
    if (game.battleElixirActive) {
        extraInfo += `<br><span style="color:#ffdd77;">🧪 Battle Elixir active (+25%)</span>`;
    }

    summary.innerHTML = `
        Team Power: <strong>${finalPower}</strong> vs Boss ${boss.basePower}<br>
        Avg Element Multiplier: <strong>${avgMultiplier.toFixed(2)}x</strong><br>
        Combat Bonus: +${(game.player.stats.combat || 0) * 4}%
        ${extraInfo}
        <br><small style="opacity:0.7;">Small variance will apply in actual fight.</small>
    `;
    count.innerText = `${selectedSlimeIds.length} / 4 selected`;
}

function startBossFight() {
    if (!currentBossId || selectedSlimeIds.length === 0) { log("Select at least 1 slime"); return; }

    const bossId = currentBossId;
    const boss = bossData[bossId];
    const team = selectedSlimeIds.map(id => game.slimes.find(s => s.id === id)).filter(Boolean);
    closeBossModal();

    const bossSlime = createSlimeFromRoll('Legendary', boss.element);
    bossSlime.name = boss.name;
    bossSlime.level = Math.floor(boss.basePower / 40);
    bossSlime.power = boss.basePower;
    recalculateSlimePower(bossSlime);
    bossSlime.power = boss.basePower;

    let phase = 1;
    const runBossPhase = () => {
        const enemies = phase === 1
            ? [bossSlime]
            : [...generateEnemyTeam(boss.basePower * 0.4, 2), { ...bossSlime, name: `${boss.name} (Enraged)`, power: Math.floor(boss.basePower * 1.15) }];

        if (phase > 1) {
            enemies.forEach(e => { if (e.power) recalculateSlimePower(e); });
        }

        runCombat(team, enemies, `👹 ${boss.name} — Phase ${phase}`, (won) => {
            if (!won) {
                log(`Defeated by ${boss.name}... Train and try again!`);
                if ((game.resources.healingSalve || 0) > 0 && Math.random() < 0.4) {
                    game.resources.healingSalve--;
                    log("Healing Salve helped recovery!");
                }
                game.battleElixirActive = false;
                updateUI();
                return;
            }
            if (phase < 2 && boss.basePower > 400) {
                phase++;
                addCombatLog('⚠️ Boss enters Phase 2 — adds appear!', 'debuff');
                setTimeout(runBossPhase, 1000);
                return;
            }
            onBossVictory(boss, bossId);
        });
    };
    runBossPhase();
}

function onBossVictory(boss, bossId) {
    const gold = Math.floor(80 + boss.basePower / 3);
    const essence = Math.floor(8 + boss.basePower / 60);
    game.resources.gold = (game.resources.gold || 0) + gold;
    game.resources.shadowEssence = (game.resources.shadowEssence || 0) + essence;
    game.resources.slimeShards = (game.resources.slimeShards || 0) + 10;

    if (bossId === 'storm_sovereign' || bossId === 'divine_colossus') {
        game.resources.divineShards = (game.resources.divineShards || 0) + 2;
        game.lifetimeDivineShards = (game.lifetimeDivineShards || 0) + 2;
    }
    if (bossId === 'divine_colossus' && Math.random() < 0.15) {
        game.resources.voidShards = (game.resources.voidShards || 0) + 1;
    }

    gainPlayerExp(30 + Math.floor(boss.basePower / 15));
    game.totalBossesDefeated = (game.totalBossesDefeated || 0) + 1;
    updateQuestProgress('boss', 1);
    log(`Victory over ${boss.name}! Epic loot secured.`);
    game.battleElixirActive = false;
    updateUI();
}

function closeBossModal() {
    document.getElementById('bossTeamModal').style.display = 'none';
    currentBossId = null;
    selectedSlimeIds = [];
}

// ==================== IMPROVED ALCHEMY SYSTEM ====================
function processMaterial(type) {
    if (!canPerformAction()) {
        return;
    }
    const alchemyBonus = 1 + ((game.player.stats.alchemy || 0) * 0.08);
    const refineryBonus = 1 + ((game.workshop.refinery || 0) * 0.15);

    if (type === 'wood_to_scrolls') {
        if ((game.resources.wood || 0) < 45) { log("Need 45 Wood"); return; }
        game.resources.wood -= 45;
        game.resources.trainingScrolls = (game.resources.trainingScrolls || 0) + Math.floor(10 * alchemyBonus);
        log("Created Training Scrolls! Use them in training missions for bonus EXP.");
    } 
    else if (type === 'stone_to_elixir') {
        if ((game.resources.stone || 0) < 30 || (game.resources.jelly || 0) < 15) { log("Need 30 Stone + 15 Jelly"); return; }
        game.resources.stone -= 30; game.resources.jelly -= 15;
        game.resources.battleElixir = (game.resources.battleElixir || 0) + Math.floor(8 * alchemyBonus);
        log("Created Battle Elixir! Activate before tough fights.");
    } 
    else if (type === 'herbs_to_salve') {
        if ((game.resources.herbs || 0) < 25 || (game.resources.jelly || 0) < 10) { log("Need 25 Herbs + 10 Jelly"); return; }
        game.resources.herbs -= 25; game.resources.jelly -= 10;
        game.resources.healingSalve = (game.resources.healingSalve || 0) + Math.floor(9 * alchemyBonus);
        log("Created Healing Salve! Use it to boost your slimes' EXP.");
    } 
    else if (type === 'berries_to_fertility') {
        if ((game.resources.jelly || 0) < 35 || (game.resources.berries || 0) < 20) { log("Need 35 Jelly + 20 Berries"); return; }
        game.resources.jelly -= 35; game.resources.berries -= 20;
        game.resources.fertilityPotion = (game.resources.fertilityPotion || 0) + Math.floor(6 * alchemyBonus);
        log("Created Fertility Potion! Use when breeding for better rarity odds.");
    } 
    else if (type === 'essence_to_mana') {
        if ((game.resources.slimeEssence || 0) < 15 || (game.resources.manaShards || 0) < 12) { log("Need 15 Slime Essence + 12 Mana Shards"); return; }
        game.resources.slimeEssence -= 15; game.resources.manaShards -= 12;
        game.resources.focusElixir = (game.resources.focusElixir || 0) + Math.floor(7 * alchemyBonus);
        log("Created Mana Infused Gel!");
    } 
    else if (type === 'shadow_to_silk') {
        if ((game.resources.shadowEssence || 0) < 20 || (game.resources.crystal || 0) < 10) { log("Need 20 Shadow Essence + 10 Crystal"); return; }
        game.resources.shadowEssence -= 20; game.resources.crystal -= 10;
        game.resources.shadowSilk = (game.resources.shadowSilk || 0) + Math.floor(5 * alchemyBonus);
        log("Created Shadow Silk!");
    } 
    else if (type === 'make_power_serum') {
        if ((game.resources.slimeEssence || 0) < 25 || (game.resources.manaShards || 0) < 15 || (game.resources.shadowEssence || 0) < 10) { log("Need 25 Slime Essence + 15 Mana Shards + 10 Shadow Essence"); return; }
        game.resources.slimeEssence -= 25; game.resources.manaShards -= 15; game.resources.shadowEssence -= 10;
        game.globalPowerBonus = (game.globalPowerBonus || 1) * 1.015;
        log("Created Power Serum! Permanent +1.5% global power.", true);
    } 
    else if (type === 'make_alchemical_catalyst') {
        if ((game.resources.refinedEssence || 0) < 30 || (game.resources.divineShards || 0) < 8 || (game.resources.arcaneDust || 0) < 15) { log("Need 30 Refined Essence + 8 Divine Shards + 15 Arcane Dust"); return; }
        game.resources.refinedEssence -= 30; game.resources.divineShards -= 8; game.resources.arcaneDust -= 15;
        game.resources.alchemicalCatalyst = (game.resources.alchemicalCatalyst || 0) + 1;
        log("Created Alchemical Catalyst! Use in Breakthrough Research for big rewards.");
    } 
    else if (type === 'refine_essence') {
        if ((game.resources.slimeEssence || 0) < 20 || (game.resources.jelly || 0) < 8) { log("Need 20 Slime Essence + 8 Jelly"); return; }
        game.resources.slimeEssence -= 20; game.resources.jelly -= 8;
        const yieldAmount = Math.floor(3 * alchemyBonus * refineryBonus);
        game.resources.refinedEssence = (game.resources.refinedEssence || 0) + yieldAmount;
        log(`Refined ${yieldAmount} Refined Essence! (Refinery bonus applied)`);
    } 
    else if (type === 'make_explorer_tonic') {
        if ((game.resources.herbs || 0) < 20 || (game.resources.jelly || 0) < 15 || (game.resources.wood || 0) < 8) { log("Need 20 Herbs + 15 Jelly + 8 Wood"); return; }
        game.resources.herbs -= 20; game.resources.jelly -= 15; game.resources.wood -= 8;
        game.resources.explorerTonic = (game.resources.explorerTonic || 0) + Math.floor(3 * alchemyBonus);
        game.explorerTonicCharges = (game.explorerTonicCharges || 0) + Math.floor(3 * alchemyBonus);
        log("Created Explorer's Tonic! Use before exploring for better slime & resource drops.");
    }
    updateUI();
}

function transmuteGoldToMana() {
    if ((game.resources.gold || 0) < 100) { log("Need 100 Gold"); return; }
    game.resources.gold -= 100;
    game.resources.manaShards = (game.resources.manaShards || 0) + 8;
    log("Transmuted 100 Gold into 8 Mana Shards");
    updateUI();
}

function transmuteManaToDivine() {
    if ((game.resources.manaShards || 0) < 50) { log("Need 50 Mana Shards"); return; }
    game.resources.manaShards -= 50;
    game.resources.divineShards = (game.resources.divineShards || 0) + 3;
    log("Transmuted 50 Mana Shards into 3 Divine Shards");
    updateUI();
}

function useBattleElixir() {
    if ((game.resources.battleElixir || 0) < 1) { log("No Battle Elixirs"); return; }
    game.resources.battleElixir--;
    game.battleElixirActive = true;
    log("Battle Elixir activated! +25% power for next fight.");
    updateUI();
}

// New: Use Healing Salve to boost all slimes
function useHealingSalve() {
    if ((game.resources.healingSalve || 0) < 1) { log("No Healing Salve!"); return; }
    game.resources.healingSalve--;
    
    let totalExp = 0;
    game.slimes.forEach(slime => {
        const expGain = 20 + Math.floor(Math.random() * 12);
        slime.exp = (slime.exp || 0) + expGain;
        syncSlimeLevelFromExp(slime);
        recalculateSlimePower(slime);
        totalExp += expGain;
    });
    
    log(`Used Healing Salve! All slimes gained a total of ${totalExp} EXP.`);
    updateUI();
}

// New: Activate Explorer's Tonic charges
function useExplorerTonic() {
    if (game.explorerTonicCharges <= 0) {
        log("No Explorer's Tonic charges! Craft some in Alchemy.");
        return;
    }
    // The charges are already consumed during exploration
    log(`Explorer's Tonic ready! You have ${game.explorerTonicCharges} charge(s). Explore now for boosted results.`);
    updateUI();
}

// ==================== MANAGEMENT ====================
function slimeParty() {
    if (game.slimes.length === 0) { log("No slimes to party with!"); return; }

    const now = Date.now();
    const cooldownMs = 60 * 60 * 1000; // 60 minutes - pretty big cooldown
    const timeSinceLast = now - (game.lastSlimePartyTime || 0);

    if (timeSinceLast < cooldownMs) {
        const remainingMs = cooldownMs - timeSinceLast;
        const remainingMin = Math.ceil(remainingMs / 60000);
        log(`Slime Party is on cooldown. Ready again in ~${remainingMin} minute(s).`);
        return;
    }

    // Apply effects
    game.slimes.forEach(s => {
        s.exp = (s.exp || 0) + 14;
        syncSlimeLevelFromExp(s);
        recalculateSlimePower(s);
    });
    gainPlayerExp(6);

    // Bonus jelly from happy slimes playing (base + Jelly Producer trait)
    let jellyBonus = 3 + Math.floor(Math.random() * 4);
    game.slimes.forEach(slime => {
        jellyBonus += getJellyProductionBonus(slime);
    });
    game.resources.jelly = (game.resources.jelly || 0) + jellyBonus;

    // Temporary party buff: +10% team power for 90 minutes (great before dungeons/bosses)
    game.partyPowerBonusUntil = now + (90 * 60 * 1000);

    game.lastSlimePartyTime = now;

    log(`🎉 Slime Party! All slimes gained EXP + made ${jellyBonus} Jelly. Your slimes are energized! (+10% power for 90 min)`);
    updateUI();
    updateSlimePartyButton();
}

function evolveSlime() { ascendSlime(); }

function fuseSlimes() {
    const unlocked = game.slimes.filter(s => !s.locked && !s.onMission);
    if (unlocked.length < 2) { log("Need 2 unlocked slimes to fuse."); return; }

    let s1 = null, s2 = null;
    for (let i = 0; i < unlocked.length; i++) {
        for (let j = i + 1; j < unlocked.length; j++) {
            if (unlocked[i].rarity === unlocked[j].rarity) {
                s1 = unlocked[i]; s2 = unlocked[j]; break;
            }
        }
        if (s1) break;
    }
    if (!s1 || !s2) { log("Fuse requires same rarity slimes."); return; }

    const baseSlime = s1.power >= s2.power ? s1 : s2;
    const sacrificeSlime = s1.power >= s2.power ? s2 : s1;

    let synergyBonus = 1;
    if (baseSlime.element === sacrificeSlime.element) synergyBonus += 0.15;
    if (baseSlime.faction === sacrificeSlime.faction) synergyBonus += 0.10;

    const fused = {
        ...baseSlime,
        level: Math.max(baseSlime.level, sacrificeSlime.level) + Math.floor(3 * synergyBonus),
        exp: 0, locked: false,
        ascension: Math.max(baseSlime.ascension || 0, sacrificeSlime.ascension || 0),
        evolved: (baseSlime.ascension || 0) > 0 || (sacrificeSlime.ascension || 0) > 0
    };

    if (synergyBonus >= 1.2 && Math.random() < 0.25) {
        const nextRarity = ["Common","Uncommon","Rare","Epic","Legendary","Mythic"];
        const idx = nextRarity.indexOf(fused.rarity);
        if (idx < nextRarity.length - 1) {
            fused.rarity = nextRarity[idx + 1];
            log(`🔥 Fusion synergy triggered rarity up! Now ${fused.rarity}!`);
        }
    }

    recalculateSlimePower(fused);
    fused.power = Math.floor(fused.power * synergyBonus);

    const toRemove = [game.slimes.findIndex(s => s.id === baseSlime.id), game.slimes.findIndex(s => s.id === sacrificeSlime.id)].sort((a,b) => b-a);
    toRemove.forEach(i => game.slimes.splice(i, 1));
    game.slimes.push(fused);
    game.totalFusions = (game.totalFusions || 0) + 1;
    updateQuestProgress('fuse', 1);
    log(`Fused into ${fused.name}! Synergy: +${Math.round((synergyBonus-1)*100)}%`);
    updateUI();
}

function openLockModal() {
    const modal = document.getElementById('lockModal');
    const list = document.getElementById('lockSlimeList');
    list.innerHTML = '';

    if (game.slimes.length === 0) {
        list.innerHTML = '<p style="color:#ffaa66;">You have no slimes yet.</p>';
        modal.style.display = 'flex';
        return;
    }

    game.slimes.forEach((slime, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'background:#113322; border:2px solid #77ffaa; border-radius:8px; padding:10px; margin:6px 0; display:flex; justify-content:space-between; align-items:center;';

        div.innerHTML = `
            ${getSlimeIconHTML(slime, 'md')}
            <div style="flex:1;">
                <strong>${slime.name}</strong> (Lv ${slime.level} ${slime.element} ${slime.rarity})<br>
                <small>${slime.power} PWR • ${slime.exp || 0} EXP</small>
            </div>
            <div>
                <button onclick="toggleLock(${index}); openLockModal();" style="min-height:40px; width:auto; padding:8px 16px;">
                    ${slime.locked ? '🔓 Unlock' : '🔒 Lock'}
                </button>
            </div>
        `;
        list.appendChild(div);
    });

    modal.style.display = 'flex';
}

function closeLockModal() {
    document.getElementById('lockModal').style.display = 'none';
    updateUI();
}

// ==================== IMPROVED SLIME MANAGEMENT MODAL ====================
function openSlimeManagementModal() {
    const modal = document.getElementById('slimeManagementModal');
    const listContainer = document.getElementById('slimeManagementList');
    const elementFilter = document.getElementById('slimeFilterElement');

    // Populate element filter options
    elementFilter.innerHTML = '<option value="">All Elements</option>';
    const elementsList = [...new Set(game.slimes.map(s => s.element))];
    elementsList.sort().forEach(el => {
        const opt = document.createElement('option');
        opt.value = el;
        opt.textContent = el;
        elementFilter.appendChild(opt);
    });

    modal.style.display = 'flex';
    filterSlimeList(); // Initial render
}

function closeSlimeManagementModal() {
    document.getElementById('slimeManagementModal').style.display = 'none';
    updateUI();
}

function filterSlimeList() {
    const search = (document.getElementById('slimeSearch')?.value || '').toLowerCase();
    const sortMode = document.getElementById('slimeSort')?.value || 'power-desc';
    const rarityFilter = document.getElementById('slimeFilterRarity')?.value || '';
    const elementFilter = document.getElementById('slimeFilterElement')?.value || '';
    const hasTraitOnly = document.getElementById('filterHasTrait')?.checked || false;
    const favOnly = document.getElementById('filterFavorite')?.checked || false;

    let filtered = game.slimes.filter(slime => {
        const matchesSearch = !search || 
            slime.name.toLowerCase().includes(search) || 
            slime.element.toLowerCase().includes(search) ||
            (slime.faction && slime.faction.toLowerCase().includes(search));
        const matchesRarity = !rarityFilter || slime.rarity === rarityFilter;
        const matchesElement = !elementFilter || slime.element === elementFilter;
        const matchesTrait = !hasTraitOnly || (slime.traits && slime.traits.length > 0);
        const matchesFav = !favOnly || slime.favorite;
        
        return matchesSearch && matchesRarity && matchesElement && matchesTrait && matchesFav;
    });

    // Sorting
    filtered.sort((a, b) => {
        if (sortMode === 'power-desc') return b.power - a.power;
        if (sortMode === 'power-asc') return a.power - b.power;
        if (sortMode === 'level-desc') return b.level - a.level;
        if (sortMode === 'rarity-desc') {
            return (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0);
        }
        if (sortMode === 'name-asc') return a.name.localeCompare(b.name);
        return 0;
    });

    // Render list
    const container = document.getElementById('slimeManagementList');
    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.6;">No slimes match your filters.</div>';
        return;
    }

    filtered.forEach((slime) => {
        const div = document.createElement('div');
        div.className = `slime-card rarity-${slime.rarity}`;
        div.style.cssText = 'padding:10px 12px; margin:6px 0; display:flex; justify-content:space-between; align-items:center;';
        if (slime.favorite) div.innerHTML += '';

        const selected = managementSelectedSlimes.includes(slime.id);
        let traitsHTML = '';
        if (slime.traits?.length) {
            traitsHTML = `<div style="font-size:9px; color:#aaffcc; margin-top:2px;">${slime.traits.map(t => TRAIT_DEFINITIONS[t]?.name || t).join(', ')}</div>`;
        }

        div.innerHTML = `
            <label style="display:flex; align-items:center; gap:8px; flex:1; cursor:pointer;" onclick="openSlimeDetail(${slime.id})">
                <input type="checkbox" ${selected ? 'checked' : ''} onclick="event.stopPropagation(); toggleManagementSelect(${slime.id}, this.checked)" style="width:auto;">
                ${getSlimeIconHTML(slime, 'md')}
                <div>
                    ${slime.favorite ? '⭐ ' : ''}<strong>${slime.name}</strong>
                    <span style="font-size:10px; color:${getRarityColor(slime.rarity)};"> ${slime.rarity}</span>
                    <span class="asc-badge">★${slime.ascension || 0}</span><br>
                    <span style="font-size:11px;">Lv${slime.level} ${slime.element} • ${slime.faction} • ${slime.power} PWR</span>
                    ${traitsHTML}
                </div>
            </label>
            <button onclick="event.stopPropagation(); toggleLockFromManagement(${game.slimes.indexOf(slime)}); filterSlimeList();" 
                style="min-height:34px; width:auto; padding:4px 10px; font-size:11px;">
                ${slime.locked ? '🔓' : '🔒'}
            </button>
        `;
        container.appendChild(div);
    });
}

function toggleManagementSelect(id, checked) {
    if (checked && !managementSelectedSlimes.includes(id)) managementSelectedSlimes.push(id);
    else if (!checked) managementSelectedSlimes = managementSelectedSlimes.filter(x => x !== id);
}

function toggleLockFromManagement(originalIndex) {
    if (game.slimes[originalIndex]) {
        game.slimes[originalIndex].locked = !game.slimes[originalIndex].locked;
    }
}

function bulkLockSelected() {
    let count = 0;
    game.slimes.forEach(slime => {
        if (managementSelectedSlimes.includes(slime.id)) {
            slime.locked = true;
            count++;
        }
    });
    if (count > 0) {
        log(`Locked ${count} slime(s).`);
        filterSlimeList();
    }
}

function bulkUnlockSelected() {
    let count = 0;
    game.slimes.forEach(slime => {
        if (managementSelectedSlimes.includes(slime.id)) {
            slime.locked = false;
            count++;
        }
    });
    if (count > 0) {
        log(`Unlocked ${count} slime(s).`);
        filterSlimeList();
    }
}

function toggleLock(index) {
    if (game.slimes[index]) {
        game.slimes[index].locked = !game.slimes[index].locked;
        const status = game.slimes[index].locked ? 'locked' : 'unlocked';
        log(`${game.slimes[index].name} is now ${status}.`);
    }
}

// Improved breeding with optional fertility potion
function startBreeding(useFertility = false) {
    if (game.slimes.length < 2) { log("Need at least 2 slimes to breed."); return; }

    if (useFertility) {
        if ((game.resources.fertilityPotion || 0) < 1) { log("No Fertility Potion!"); return; }
        game.resources.fertilityPotion--;
    }

    const parents = [...game.slimes].sort((a, b) => b.power - a.power).slice(0, 2);
    const baby = generateRandomSlime("Medium", useFertility, parents[0], parents[1]);
    baby.level = 1;
    game.slimes.push(baby);
    game.lifetimeSlimesTamed = (game.lifetimeSlimesTamed || 0) + 1;

    let msg = `🧬 Bred ${baby.rarity} ${baby.element} (${baby.faction}) from ${parents[0].name} + ${parents[1].name}!`;
    if (useFertility) msg += " Fertility boost active!";
    log(msg);
    updateUI();
}

// ==================== TRAINING MISSION SYSTEM (with Training Scroll support) ====================
function openTrainingModal() {
    const modal = document.getElementById('trainingModal');
    const missionList = document.getElementById('missionList');
    const slimeSection = document.getElementById('slimeSelectionForTraining');

    missionList.innerHTML = '';
    slimeSection.style.display = 'none';
    selectedMissionId = null;

    TRAINING_MISSIONS.forEach(mission => {
        const div = document.createElement('div');
        div.className = 'mission-card';
        div.innerHTML = `
            <strong>${mission.name}</strong> <small style="color:#ffdd88;">(${mission.durationMinutes} min)</small><br>
            <span style="font-size:12px;">${mission.desc}</span><br>
            <span style="color:#aaff99; font-size:12px;">+${mission.expPerSlime} EXP per slime</span>
        `;
        div.onclick = () => selectMissionForTraining(mission.id, div);
        missionList.appendChild(div);
    });

    modal.style.display = 'flex';
}

function selectMissionForTraining(missionId, element) {
    document.querySelectorAll('#missionList .mission-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedMissionId = missionId;

    const slimeSection = document.getElementById('slimeSelectionForTraining');
    const list = document.getElementById('trainingSlimeList');
    list.innerHTML = '';

    const available = game.slimes.filter(s => !s.onMission);
    if (available.length === 0) {
        list.innerHTML = '<p style="color:#ffaa66;">All your slimes are currently on missions.</p>';
        slimeSection.style.display = 'block';
        return;
    }

    available.forEach(slime => {
        const div = document.createElement('div');
        div.className = 'slime-select-item';
        div.innerHTML = `
            <input type="checkbox" id="train-${slime.id}">
            ${getSlimeIconHTML(slime, 'md')}
            <label for="train-${slime.id}" style="flex:1; cursor:pointer;">
                <strong>${slime.name}</strong> (Lv ${slime.level} ${slime.element} ${slime.rarity})<br>
                <small>${slime.power} PWR</small>
            </label>
        `;
        list.appendChild(div);
    });

    slimeSection.style.display = 'block';
}

function confirmSendOnMission() {
    if (!selectedMissionId) { log("Please select a mission first"); return; }

    const mission = TRAINING_MISSIONS.find(m => m.id === selectedMissionId);
    const checkboxes = document.querySelectorAll('#trainingSlimeList input[type="checkbox"]:checked');
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.id.split('-')[1]));

    if (selectedIds.length === 0) { log("Select at least one slime"); return; }

    const maxSlots = 2 + Math.floor((game.player.stats.leadership || 0) / 4);
    if (selectedIds.length > maxSlots) { log(`You can only send ${maxSlots} slimes (Leadership bonus included)`); return; }

    // Check for Training Scroll usage
    const useScroll = document.getElementById('useTrainingScrollCheck') && document.getElementById('useTrainingScrollCheck').checked;
    let expMultiplier = 1.0;
    
    if (useScroll) {
        if ((game.resources.trainingScrolls || 0) < 1) {
            log("No Training Scrolls left! Sending without bonus.");
        } else {
            game.resources.trainingScrolls--;
            expMultiplier = 1.5;
            log("Training Scroll used! +50% EXP for this mission.");
        }
    }

    const now = Date.now();
    const endTime = now + (mission.durationMinutes * 60 * 1000);
    const finalExp = Math.floor(mission.expPerSlime * expMultiplier);

    let sent = 0;
    game.slimes.forEach(slime => {
        if (selectedIds.includes(slime.id) && !slime.onMission) {
            slime.onMission = true;
            slime.missionEndTime = endTime;
            slime.currentMissionId = mission.id;
            slime.currentMissionExp = finalExp;
            sent++;
        }
    });

    log(`Sent ${sent} slime(s) on ${mission.name} for ${mission.durationMinutes} minutes.`);
    closeTrainingModal();
    updateUI();
}

function closeTrainingModal() {
    document.getElementById('trainingModal').style.display = 'none';
    selectedMissionId = null;
}

// ==================== MISSION TIMER SYSTEM ====================
function startMissionTimerSystem() {
    startGameLoop();
}

function updateMissionTimersAndCompletions(fromLoop = false) {
    let changed = false;
    const now = Date.now();

    game.slimes.forEach(slime => {
        if (slime.onMission && slime.missionEndTime && now >= slime.missionEndTime) {
            let expGain = slime.currentMissionExp || 100;

            // Apply Training trait multipliers
            const trainingMult = getTrainingExpMultiplier(slime);
            expGain = Math.floor(expGain * trainingMult);

            // Jelly Producer bonus
            const jellyBonus = getJellyProductionBonus(slime);
            if (jellyBonus > 0) {
                game.resources.jelly = (game.resources.jelly || 0) + jellyBonus;
            }

            slime.exp = (slime.exp || 0) + expGain;
            syncSlimeLevelFromExp(slime);
            recalculateSlimePower(slime);
            slime.onMission = false;
            slime.missionEndTime = null;
            slime.currentMissionId = null;
            slime.currentMissionExp = null;

            let msg = `${slime.name} returned from training! +${expGain} EXP`;
            if (jellyBonus > 0) msg += ` (+${jellyBonus} Jelly)`;
            log(msg);
            updateQuestProgress('train', 1);
            changed = true;
        }
    });

    if (changed) updateUI();
    else if (!fromLoop && activeTabIndex === 0) renderCampaign();
    else if (!fromLoop) renderHaven();
    if (!fromLoop) updateSlimePartyButton();
}

// ==================== WORKSHOP ====================
function upgradeWorkshop(type) {
    if (type === 'advanced') {
        if ((game.resources.gold || 0) < 800 || (game.resources.manaShards || 0) < 25 || (game.resources.divineShards || 0) < 8) {
            log("Need 800 Gold + 25 Mana Shards + 8 Divine Shards");
            return;
        }
        game.resources.gold -= 800;
        game.resources.manaShards -= 25;
        game.resources.divineShards -= 8;
        game.globalPowerBonus = (game.globalPowerBonus || 1) * 1.08;
        log("Advanced Workshop upgraded! Permanent +8% global power.");
        updateUI();
        return;
    }

    const costGold = type === 'incubator' ? 120 : type === 'trainingHall' ? 150 : 180;
    const costEssence = type === 'incubator' ? 8 : type === 'trainingHall' ? 10 : 12;

    if ((game.resources.gold || 0) < costGold || (game.resources.refinedEssence || 0) < costEssence) {
        log(`Need ${costGold} Gold and ${costEssence} Refined Essence`);
        return;
    }
    game.resources.gold -= costGold;
    game.resources.refinedEssence -= costEssence;

    if (type === 'incubator') game.workshop.incubator = (game.workshop.incubator || 0) + 1;
    else if (type === 'trainingHall') game.workshop.trainingHall = (game.workshop.trainingHall || 0) + 1;
    else if (type === 'refinery') game.workshop.refinery = (game.workshop.refinery || 0) + 1;

    log(`${type} upgraded!`);
    updateUI();
}

// ==================== SHOP ====================
function buyItem(item) {
    if (!canPerformAction()) {
        return;
    }
    if (item === 'jellyPack') {
        if ((game.resources.gold || 0) < 50) { log("Not enough Gold"); return; }
        game.resources.gold -= 50;
        game.resources.jelly = (game.resources.jelly || 0) + 25;
        log("Bought Jelly Pack!");
    } else if (item === 'manaPack') {
        if ((game.resources.gold || 0) < 120) { log("Not enough Gold"); return; }
        game.resources.gold -= 120;
        game.resources.manaShards = (game.resources.manaShards || 0) + 15;
        log("Bought Mana Pack!");
    } else if (item === 'woodPack') {
        if ((game.resources.gold || 0) < 40) { log("Not enough Gold"); return; }
        game.resources.gold -= 40;
        game.resources.wood = (game.resources.wood || 0) + 30;
        log("Bought Wood Pack!");
    } else if (item === 'herbPack') {
        if ((game.resources.gold || 0) < 35) { log("Not enough Gold"); return; }
        game.resources.gold -= 35;
        game.resources.herbs = (game.resources.herbs || 0) + 25;
        log("Bought Herb Pack!");
    } else if (item === 'shardPack') {
        if ((game.resources.gold || 0) < 200) { log("Not enough Gold"); return; }
        game.resources.gold -= 200;
        game.resources.slimeShards = (game.resources.slimeShards || 0) + 50;
        log("Bought 50 Slime Shards!");
    } else if (item === 'skillBookPack') {
        if ((game.resources.gold || 0) < 150 || (game.resources.manaShards || 0) < 10) { log("Need 150 Gold + 10 Mana"); return; }
        game.resources.gold -= 150; game.resources.manaShards -= 10;
        game.resources.skillBooks = (game.resources.skillBooks || 0) + 3;
        log("Bought 3 Skill Books!");
    }
    updateUI();
}

// ==================== IMPROVED RESEARCH SYSTEM ====================
function slimeResearch() {
    if ((game.resources.jelly || 0) < 20 || (game.resources.herbs || 0) < 15 || (game.resources.slimeEssence || 0) < 5) {
        log("Need 20 Jelly + 15 Herbs + 5 Slime Essence for research.");
        return;
    }
    
    game.resources.jelly -= 20;
    game.resources.herbs -= 15;
    game.resources.slimeEssence -= 5;

    // Small permanent gain
    const stats = ['taming', 'alchemy', 'combat', 'leadership', 'endurance'];
    const randomStat = stats[Math.floor(Math.random() * stats.length)];
    game.player.stats[randomStat] = (game.player.stats[randomStat] || 0) + 1;
    
    // Bonus stat point
    game.player.statPoints = (game.player.statPoints || 0) + 1;

    log(`Research complete! +1 ${randomStat} and +1 Stat Point. Your slimes feel smarter already.`);
    updateUI();
}

function breakthroughResearch() {
    const hasCatalyst = (game.resources.alchemicalCatalyst || 0) > 0;
    const costJelly = hasCatalyst ? 40 : 60;
    const costEssence = hasCatalyst ? 15 : 25;
    const costDivine = hasCatalyst ? 2 : 4;

    if ((game.resources.jelly || 0) < costJelly || 
        (game.resources.slimeEssence || 0) < costEssence || 
        (game.resources.divineShards || 0) < costDivine) {
        log(`Need ${costJelly} Jelly + ${costEssence} Slime Essence + ${costDivine} Divine Shards.`);
        return;
    }

    game.resources.jelly -= costJelly;
    game.resources.slimeEssence -= costEssence;
    game.resources.divineShards -= costDivine;

    if (hasCatalyst) {
        game.resources.alchemicalCatalyst--;
    }

    // Big reward
    const roll = Math.random();
    if (roll < 0.4) {
        game.globalPowerBonus = (game.globalPowerBonus || 1) * 1.06;
        log("Breakthrough! Permanent +6% Global Power Bonus!");
    } else if (roll < 0.7) {
        game.player.statPoints = (game.player.statPoints || 0) + 5;
        log("Breakthrough! +5 Stat Points!");
    } else {
        // Big stat boost to random stats
        const stats = ['taming', 'alchemy', 'combat', 'leadership', 'endurance'];
        for (let i = 0; i < 2; i++) {
            const stat = stats[Math.floor(Math.random() * stats.length)];
            game.player.stats[stat] = (game.player.stats[stat] || 0) + 2;
        }
        log("Breakthrough! +2 to two random stats!");
    }
    
    updateUI();
    updateEndgameUI();
}

// ==================== ENDGAME ====================
function updateEndgameUI() {
    const milestoneList = document.getElementById('milestoneList');
    if (milestoneList) {
        let html = '';
        MILESTONES.forEach(m => {
            const unlocked = game.playerLevel >= m.level;
            html += `<div style="margin:4px 0; color:${unlocked ? '#aaff99' : '#888'};">${unlocked ? '✅' : '🔒'} Level ${m.level}: ${m.name}</div>`;
        });
        milestoneList.innerHTML = html;
    }

    const lifetimeStats = document.getElementById('lifetimeStats');
    if (lifetimeStats) {
        lifetimeStats.innerHTML = `
            Highest Player Level: <strong>${game.highestLevel}</strong><br>
            Total Divine Shards Earned: <strong>${game.lifetimeDivineShards}</strong><br>
            Total Slimes Tamed: <strong>${game.lifetimeSlimesTamed}</strong><br>
            Current Global Power Bonus: <strong>${(game.globalPowerBonus * 100).toFixed(0)}%</strong>
        `;
    }

    const voidFloor = document.getElementById('voidFloor');
    if (voidFloor) voidFloor.innerText = game.voidTowerFloor;

    const voidBtn = document.getElementById('voidTowerBtn');
    if (voidBtn) {
        if (game.playerLevel >= VOID_TOWER_MIN_LEVEL) {
            voidBtn.disabled = false;
            voidBtn.style.opacity = "1";
        } else {
            voidBtn.disabled = true;
            voidBtn.style.opacity = "0.5";
        }
    }
}

function runVoidTower() {
    if (game.playerLevel < VOID_TOWER_MIN_LEVEL) {
        log(`Void Tower requires Player Level ${VOID_TOWER_MIN_LEVEL}.`);
        return;
    }
    const team = getTopSlimes(4);
    if (team.length === 0) { log('Need slimes for Void Tower'); return; }

    const floor = game.voidTowerFloor;
    const enemyPower = 420 + floor * 235;
    const enemies = generateEnemyTeam(enemyPower, 3 + Math.floor(floor / 10));

    runCombat(team, enemies, `🕳️ Void Tower — Floor ${floor}`, (won) => {
        if (won) {
            const divineGain = 2 + Math.floor(floor / 5);
            const voidGain = floor % 5 === 0 ? 2 : 0;
            game.resources.divineShards = (game.resources.divineShards || 0) + divineGain;
            game.resources.voidShards = (game.resources.voidShards || 0) + voidGain;
            game.lifetimeDivineShards = (game.lifetimeDivineShards || 0) + divineGain;
            game.voidTowerFloor++;
            if (game.voidTowerFloor > (game.leaderboard.bestVoidFloor || 0)) game.leaderboard.bestVoidFloor = game.voidTowerFloor;
            log(`Cleared Floor ${floor}! +${divineGain} Divine${voidGain ? `, +${voidGain} Void` : ''}`);
            gainPlayerExp(48 + floor * 7);
        } else {
            log(`Failed Void Tower Floor ${floor}.`);
        }
        game.battleElixirActive = false;
        updateUI();
        updateEndgameUI();
    });
}

function divineConvergence() {
    const count = game.divineConvergenceCount || 0;
    const baseCost = 30;
    const cost = baseCost + (count * 18); // Scaling cost: 30, 48, 66, 84...

    if ((game.resources.divineShards || 0) < cost) {
        log(`Need ${cost} Divine Shards for Divine Convergence (you have ${game.resources.divineShards || 0}).`);
        return;
    }

    game.resources.divineShards -= cost;
    game.globalPowerBonus = (game.globalPowerBonus || 1) * 1.065; // Slightly lower per-use bonus
    game.divineConvergenceCount = count + 1;

    const bonusPercent = Math.round((game.globalPowerBonus - 1) * 100);
    log(`Divine Convergence complete! Permanent +6.5% global power (Total: +${bonusPercent}%). Cost was ${cost} shards.`);
    updateUI();
    updateEndgameUI();
}

// ==================== HELPERS ====================
function toggleSection(id) {
    const content = document.getElementById(id + 'Content');
    if (!content) return;
    const header = content.previousElementSibling;

    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        if (header) header.classList.remove('collapsed');
    } else {
        content.classList.add('collapsed');
        if (header) header.classList.add('collapsed');
    }
}

function switchTab(tabIndex) {
    activeTabIndex = tabIndex;
    document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab' + tabIndex).classList.add('active');
    document.querySelectorAll('.tab')[tabIndex].classList.add('active');
    updateUI();

    if (tabIndex === 0) renderCampaign();
    if (tabIndex === 2) renderSummonUI();
    if (tabIndex === 9) { renderEndgameExtras(); renderPrestigeUI(); }

    // Force render trait details when opening Records tab
    if (tabIndex === 10) {
        setTimeout(() => {
            const traitEl = document.getElementById('traitStats');
            if (traitEl && typeof renderRecords === 'function') {
                // Re-render just the trait section if needed
                renderRecords();
            }
        }, 50);
    }
}

// Update alchemy bonus display
function updateAlchemyBonus() {
    const el = document.getElementById('alchemyBonus');
    if (el) {
        const bonus = Math.floor((game.player.stats.alchemy || 0) * 4);
        el.innerText = bonus;
    }
}

function updateSlimePartyButton() {
    const btn = document.getElementById('slimePartyBtn');
    const status = document.getElementById('slimePartyStatus');
    if (!btn || !status) return;

    const now = Date.now();
    const cooldownMs = 60 * 60 * 1000;
    const timeSinceLast = now - (game.lastSlimePartyTime || 0);

    if (timeSinceLast < cooldownMs) {
        const remainingMs = cooldownMs - timeSinceLast;
        const min = Math.floor(remainingMs / 60000);
        const sec = Math.floor((remainingMs % 60000) / 1000);
        btn.disabled = true;
        btn.style.opacity = "0.6";
        status.innerText = `⏳ Cooldown: ${min}m ${sec}s`;
        status.style.color = "#ffaa66";
    } else {
        btn.disabled = false;
        btn.style.opacity = "1";
        if (game.partyPowerBonusUntil && now < game.partyPowerBonusUntil) {
            const remainingMin = Math.ceil((game.partyPowerBonusUntil - now) / 60000);
            status.innerText = `✨ Party buff active! +10% power (${remainingMin}m left)`;
            status.style.color = "#aaff99";
        } else {
            status.innerText = "";
        }
    }
}

// ==================== UPDATE UI (FULL RAF BATCHING) ====================
function updateUI() {
    scheduleUIUpdate();
}

const DOM = {};
let uiUpdateScheduled = false;
let uiDirty = false;

function scheduleUIUpdate() {
    uiDirty = true;
    if (!uiUpdateScheduled) {
        uiUpdateScheduled = true;
        requestAnimationFrame(flushUIUpdates);
    }
}

function flushUIUpdates() {
    uiUpdateScheduled = false;
    if (!uiDirty) return;
    uiDirty = false;
    updateSummary();
    renderHaven();
    if (activeTabIndex === 4) renderInventory();
    if (activeTabIndex === 5) renderPlayer();
    if (activeTabIndex === 7) renderWorkshop();
    if (activeTabIndex === 9) { updateEndgameUI(); renderEndgameExtras(); renderPrestigeUI(); }
    if (activeTabIndex === 10) renderRecords();
    if (activeTabIndex === 0) renderCampaign();
    if (activeTabIndex === 2) renderSummonUI();
    if (activeTabIndex === 6) updateAlchemyBonus();
    const tonicEl = document.getElementById('tonicCount');
    if (tonicEl) tonicEl.innerText = `${game.explorerTonicCharges || 0} charges`;
    updateSlimePartyButton();
}

// ==================== SUMMON SYSTEM ====================
function performSummon(type, count = 1) {
    if (!canPerformAction()) return;
    const costs = { regular: { key: 'slimeShards', single: 90, multi: 800 }, premium: { key: 'divineShards', single: 280, multi: 2500 }, ancient: { key: 'voidShards', single: 140, multi: 1260 } };
    const costInfo = costs[type];
    if (!costInfo) return;
    const cost = count === 10 ? costInfo.multi : costInfo.single * count;
    if ((game.resources[costInfo.key] || 0) < cost) {
        log(`Not enough ${costInfo.key === 'slimeShards' ? 'Slime Shards' : costInfo.key === 'voidShards' ? 'Void Shards' : 'Divine Shards'}!`);
        return;
    }
    game.resources[costInfo.key] -= cost;

    const results = [];
    for (let i = 0; i < count; i++) {
        const slime = rollSummon(type);
        game.slimes.push(slime);
        results.push(slime);
        game.lifetimeSlimesTamed = (game.lifetimeSlimesTamed || 0) + 1;
    }
    game.totalSummons = (game.totalSummons || 0) + count;
    updateQuestProgress('summon', count);
    showSummonResults(results);
    updateUI();
    renderSummonUI();
}

function rollSummon(type) {
    game.summon = game.summon || { pityRegular: 0, pityPremium: 0, pityAncient: 0, bannerId: 'celestial' };
    const pityKey = type === 'regular' ? 'pityRegular' : type === 'premium' ? 'pityPremium' : 'pityAncient';
    game.summon[pityKey] = (game.summon[pityKey] || 0) + 1;

    const threshold = PITY_THRESHOLDS[type];
    let rarity;
    if (game.summon[pityKey] >= threshold) {
        if (type === 'regular') rarity = Math.random() < 0.15 ? 'Legendary' : 'Epic';
        else if (type === 'premium') rarity = 'Legendary';
        else rarity = Math.random() < 0.25 ? 'Mythic' : 'Legendary';
        game.summon[pityKey] = 0;
    } else {
        const banner = BANNERS[game.summon.bannerId] || BANNERS.celestial;
        const bonus = (game.player.stats.taming || 0) * 0.02 + (banner.epicBonus || 0) * 0.02;
        rarity = rollRarityFromTable(SUMMON_RATES[type], bonus);
        if ((RARITY_ORDER[rarity] || 0) >= 4) game.summon[pityKey] = 0;
    }

    const banner = BANNERS[game.summon.bannerId] || BANNERS.celestial;
    let element, faction;
    if (Math.random() < 0.35 && banner.elements?.length) {
        element = banner.elements[Math.floor(Math.random() * banner.elements.length)];
        faction = banner.factions[0];
    } else {
        element = elements[Math.floor(Math.random() * elements.length)];
        faction = ELEMENT_FACTION[element];
    }
    return createSlimeFromRoll(rarity, element, faction);
}

function showSummonResults(slimes) {
    const modal = document.getElementById('summonModal');
    const container = document.getElementById('summonResults');
    container.innerHTML = '';
    slimes.forEach(s => {
        const card = document.createElement('div');
        card.className = `slime-card rarity-${s.rarity} summon-reveal`;
        card.innerHTML = `${getSlimeIconHTML(s, 'lg')}<strong>${s.name}</strong><br><span style="color:${getRarityColor(s.rarity)}">${s.rarity}</span><br><small>${s.element} • ${s.faction}</small>`;
        container.appendChild(card);
    });
    modal.style.display = 'flex';
}

function closeSummonModal() {
    document.getElementById('summonModal').style.display = 'none';
}

function renderSummonUI() {
    const banner = BANNERS[game.summon?.bannerId] || BANNERS.celestial;
    const bn = document.getElementById('bannerName');
    const bi = document.getElementById('bannerInfo');
    if (bn) bn.textContent = banner.name;
    if (bi) bi.textContent = `Rate-up: ${banner.elements?.join(', ')} • ${banner.factions?.join(', ')} faction`;

    const pityMap = { regular: 'Regular', premium: 'Premium', ancient: 'Ancient' };
    Object.entries(pityMap).forEach(([type, key]) => {
        const val = game.summon?.[`pity${key}`] || 0;
        const thresh = PITY_THRESHOLDS[type];
        const fill = document.getElementById(`pity${key}Fill`);
        const text = document.getElementById(`pity${key}Text`);
        if (fill) fill.style.width = `${Math.min(100, (val / thresh) * 100)}%`;
        if (text) text.textContent = val;
    });
}

// ==================== ARTIFACT SYSTEM ====================
function generateArtifact(rarityTier) {
    const setIds = Object.keys(ARTIFACT_SETS);
    const setId = setIds[Math.floor(Math.random() * setIds.length)];
    const set = ARTIFACT_SETS[setId];
    const slot = ARTIFACT_SLOTS[Math.floor(Math.random() * ARTIFACT_SLOTS.length)];
    const mult = { uncommon: 1, rare: 1.8, epic: 3.2 }[rarityTier] || 1;
    const art = {
        id: Date.now() + Math.floor(Math.random() * 99999),
        name: `${set.name} ${slot}`,
        setId, slot, icon: set.icon, enhance: 0,
        atk: Math.floor((3 + Math.random() * 8) * mult),
        hp: Math.floor((10 + Math.random() * 20) * mult),
        def: Math.floor((2 + Math.random() * 6) * mult),
        crit: Math.floor(Math.random() * 5 * mult),
        spd: Math.floor(Math.random() * 4 * mult),
        rarity: rarityTier
    };
    return art;
}

function craftArtifact(tier) {
    if (!canPerformAction()) return;
    if (tier === 'uncommon') {
        if ((game.resources.stone || 0) < 20 || (game.resources.jelly || 0) < 15 || (game.resources.slimeEssence || 0) < 5) { log('Missing materials'); return; }
        game.resources.stone -= 20; game.resources.jelly -= 15; game.resources.slimeEssence -= 5;
    } else if (tier === 'rare') {
        if ((game.resources.refinedEssence || 0) < 15 || (game.resources.crystal || 0) < 10 || (game.resources.manaShards || 0) < 8) { log('Missing materials'); return; }
        game.resources.refinedEssence -= 15; game.resources.crystal -= 10; game.resources.manaShards -= 8;
    } else {
        if ((game.resources.refinedEssence || 0) < 25 || (game.resources.divineShards || 0) < 5 || (game.resources.arcaneDust || 0) < 20) { log('Missing materials'); return; }
        game.resources.refinedEssence -= 25; game.resources.divineShards -= 5; game.resources.arcaneDust -= 20;
    }
    const art = generateArtifact(tier);
    game.artifacts.push(art);
    log(`Forged ${art.name}! (${art.icon})`);
    updateUI();
}

function equipArtifact(slimeId, artifactId) {
    const slime = game.slimes.find(s => s.id === slimeId);
    const artIdx = game.artifacts.findIndex(a => a.id === artifactId);
    if (!slime || artIdx < 0) return;
    const art = game.artifacts[artIdx];
    if (slime.artifacts[art.slot]) game.artifacts.push(slime.artifacts[art.slot]);
    slime.artifacts[art.slot] = art;
    game.artifacts.splice(artIdx, 1);
    recalculateSlimePower(slime);
    openSlimeDetail(slimeId);
    updateUI();
}

function enhanceRandomArtifact() {
    if ((game.resources.gold || 0) < 50) { log('Need 50 Gold'); return; }
    const allArts = [...game.artifacts];
    game.slimes.forEach(s => Object.values(s.artifacts || {}).forEach(a => { if (a) allArts.push(a); }));
    if (allArts.length === 0) { log('No artifacts to enhance'); return; }
    const art = allArts[Math.floor(Math.random() * allArts.length)];
    game.resources.gold -= 50;
    art.enhance = (art.enhance || 0) + 1;
    art.atk = Math.floor(art.atk * 1.08);
    art.hp = Math.floor(art.hp * 1.08);
    art.def = Math.floor(art.def * 1.08);
    game.slimes.forEach(s => recalculateSlimePower(s));
    log(`Enhanced ${art.name} to +${art.enhance}!`);
    updateUI();
}

function reforgeRandomArtifact() {
    if ((game.resources.refinedEssence || 0) < 5 || (game.resources.divineShards || 0) < 2) { log('Need 5 Refined + 2 Divine'); return; }
    if (game.artifacts.length === 0) { log('Need unequipped artifact'); return; }
    game.resources.refinedEssence -= 5; game.resources.divineShards -= 2;
    const art = game.artifacts[Math.floor(Math.random() * game.artifacts.length)];
    const stats = ['atk', 'hp', 'def', 'crit', 'spd'];
    const stat = stats[Math.floor(Math.random() * stats.length)];
    art[stat] = Math.floor(art[stat] * (0.8 + Math.random() * 0.6));
    log(`Reforged ${art.name} ${stat.toUpperCase()}!`);
    updateUI();
}

function transmuteManaToShards() {
    if ((game.resources.manaShards || 0) < 50) { log('Need 50 Mana Shards'); return; }
    game.resources.manaShards -= 50;
    game.resources.slimeShards = (game.resources.slimeShards || 0) + 30;
    log('Transmuted 50 Mana into 30 Slime Shards');
    updateUI();
}

function transmuteDivineToVoid() {
    if ((game.resources.divineShards || 0) < 10 || (game.resources.arcaneDust || 0) < 30) { log('Need 10 Divine + 30 Arcane'); return; }
    game.resources.divineShards -= 10; game.resources.arcaneDust -= 30;
    game.resources.voidShards = (game.resources.voidShards || 0) + 5;
    log('Created 5 Void Shards');
    updateUI();
}

// ==================== ASCENSION & SKILLS ====================
function ascendSlime() {
    const candidates = game.slimes.filter(s => !s.locked && (s.ascension || 0) < 4);
    if (candidates.length === 0) { log('No slimes ready to ascend'); return; }
    const slime = candidates.sort((a, b) => b.power - a.power)[0];
    const stage = slime.ascension || 0;
    const cost = ASCENSION_COSTS[stage];
    if (!cost) { log('Max ascension reached'); return; }
    if (slime.level < cost.level) { log(`Need level ${cost.level}`); return; }
    if ((game.resources.gold || 0) < cost.gold || (game.resources.slimeEssence || 0) < cost.essence) { log('Not enough resources'); return; }
    if (cost.divine && (game.resources.divineShards || 0) < cost.divine) { log('Need more Divine Shards'); return; }
    if (cost.void && (game.resources.voidShards || 0) < cost.void) { log('Need Void Shards'); return; }

    game.resources.gold -= cost.gold;
    game.resources.slimeEssence -= cost.essence;
    if (cost.divine) game.resources.divineShards -= cost.divine;
    if (cost.void) game.resources.voidShards -= cost.void;

    slime.ascension = stage + 1;
    slime.evolved = slime.ascension > 0;
    slime.level += 3;
    recalculateSlimePower(slime);
    game.totalEvolutions = (game.totalEvolutions || 0) + 1;
    log(`⬆️ ${slime.name} ascended to Stage ${slime.ascension}! Massive power spike!`);
    updateUI();
}

function upgradeSlimeSkill() {
    if ((game.resources.skillBooks || 0) < 1) { log('Need Skill Books'); return; }
    const slime = game.slimes.filter(s => s.skills?.length).sort((a, b) => b.power - a.power)[0];
    if (!slime) { log('No slimes with skills'); return; }
    const skill = slime.skills[Math.floor(Math.random() * slime.skills.length)];
    if (skill.level >= 5) { log('Skill maxed'); return; }
    game.resources.skillBooks--;
    skill.level = (skill.level || 1) + 1;
    recalculateSlimePower(slime);
    log(`📜 Upgraded ${SKILL_DEFS[skill.id]?.name || skill.id} to Lv ${skill.level}!`);
    updateUI();
}

// ==================== COMBAT ENGINE ====================
function setCombatSpeed(speed) {
    game.combatSpeed = speed;
    [1, 2, 3].forEach(n => {
        const btn = document.getElementById(`speed${n}`);
        if (btn) btn.classList.toggle('active', n === speed);
    });
}

function buildCombatUnit(slime, isEnemy = false) {
    const art = getArtifactBonuses(slime);
    const maxHp = Math.floor(slime.power * (1.2 + art.hp * 0.01));
    return {
        id: slime.id || Math.random(),
        name: slime.name,
        element: slime.element,
        iconHtml: getSlimeIconHTML(slime.element, 'md', isEnemy),
        maxHp, hp: maxHp,
        atk: Math.floor(slime.power * 0.35 + art.atk),
        def: Math.floor(slime.power * 0.08 + art.def),
        spd: (slime.speed || 100) + art.spd,
        skills: slime.skills || [],
        turnMeter: Math.random() * 30,
        buffs: [], debuffs: [],
        isEnemy, alive: true
    };
}

function addCombatLog(msg, cls = '') {
    const logEl = document.getElementById('combatLog');
    if (!logEl) return;
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    logEl.appendChild(line);
    while (logEl.children.length > 48) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
}

function renderCombatUnits() {
    const alliesEl = document.getElementById('combatAllies');
    const enemiesEl = document.getElementById('combatEnemies');
    if (!alliesEl || !enemiesEl || !combatState) return;

    const renderSide = (units, el) => {
        el.innerHTML = '';
        units.forEach((u, i) => {
            const div = document.createElement('div');
            div.className = 'combat-unit' + (u.alive ? '' : '') + (combatState.animTarget === u.id ? ' hit' : '') + (combatState.animAttacker === u.id ? ' attacking' : '');
            div.id = `unit-${u.id}`;
            const hpPct = Math.max(0, (u.hp / u.maxHp) * 100);
            div.innerHTML = `${u.iconHtml || getSlimeIconHTML(u.element, 'md', u.isEnemy)}<div style="font-size:9px;">${u.name}</div><div class="hp-bar"><div class="hp-fill ${u.isEnemy ? 'enemy' : ''}" style="width:${hpPct}%"></div></div>`;
            el.appendChild(div);
        });
    };
    renderSide(combatState.allies, alliesEl);
    renderSide(combatState.enemies, enemiesEl);
}

function getFactionSynergyMultiplier(team) {
    const counts = {};
    team.forEach(s => { counts[s.faction] = (counts[s.faction] || 0) + 1; });
    let best = 1;
    Object.values(counts).forEach(c => {
        if (c >= 4) best = Math.max(best, FACTION_SYNERGY[4]);
        else if (c >= 3) best = Math.max(best, FACTION_SYNERGY[3]);
        else if (c >= 2) best = Math.max(best, FACTION_SYNERGY[2]);
    });
    return best;
}

function runCombat(allies, enemies, title, onComplete) {
    combatState = {
        allies: allies.map(s => buildCombatUnit(s, false)),
        enemies: enemies.map(s => buildCombatUnit(s, true)),
        turn: 0, animAttacker: null, animTarget: null, done: false
    };

    const synergy = getFactionSynergyMultiplier(allies);
    combatState.allies.forEach(u => { u.atk = Math.floor(u.atk * synergy); });

    document.getElementById('combatTitle').textContent = title;
    document.getElementById('combatLog').innerHTML = '';
    document.getElementById('combatCloseBtn').style.display = 'none';
    document.getElementById('combatModal').style.display = 'flex';
    addCombatLog(`Battle begins! Faction synergy: ${Math.round((synergy - 1) * 100)}%`, 'buff');

    combatResolve = onComplete;
    combatLoop();
}

function combatLoop() {
    if (!combatState || combatState.done) return;
    const delay = Math.max(200, 600 / (game.combatSpeed || 1));

    const allUnits = [...combatState.allies, ...combatState.enemies].filter(u => u.alive);
    if (combatState.allies.every(u => !u.alive)) { endCombat(false); return; }
    if (combatState.enemies.every(u => !u.alive)) { endCombat(true); return; }

    allUnits.forEach(u => u.turnMeter += u.spd * 0.15);
    allUnits.sort((a, b) => b.turnMeter - a.turnMeter);
    const actor = allUnits[0];
    actor.turnMeter = 0;

    const targets = actor.isEnemy
        ? combatState.allies.filter(u => u.alive)
        : combatState.enemies.filter(u => u.alive);
    if (targets.length === 0) { endCombat(!actor.isEnemy); return; }

    const target = targets[Math.floor(Math.random() * targets.length)];
    let dmg = Math.max(1, Math.floor(actor.atk * (0.85 + Math.random() * 0.3)));

    const atkSlime = { element: actor.element };
    const defSlime = { element: target.element };
    const elemMult = getAdvantageMultiplier(atkSlime.element, defSlime.element);
    dmg = Math.floor(dmg * elemMult);

    const isCrit = Math.random() < 0.12;
    if (isCrit) dmg = Math.floor(dmg * 1.6);

    // Skill usage
    const activeSkill = actor.skills?.find(s => SKILL_DEFS[s.id]?.type === 'active');
    let aoe = false;
    if (activeSkill && Math.random() < 0.35) {
        const def = SKILL_DEFS[activeSkill.id];
        addCombatLog(`${actor.name} uses ${def.icon} ${def.name}!`, 'skill-hit');
        if (['splash', 'inferno', 'poison'].includes(activeSkill.id)) {
            if (activeSkill.id === 'splash') { dmg = Math.floor(dmg * 0.85); aoe = true; }
            if (activeSkill.id === 'inferno') dmg = Math.floor(dmg * 1.4);
        }
        if (activeSkill.id === 'heal' && !actor.isEnemy) {
            const ally = combatState.allies.filter(u => u.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (ally) { ally.hp = Math.min(ally.maxHp, ally.hp + Math.floor(ally.maxHp * 0.18)); addCombatLog(`${ally.name} healed!`, 'buff'); }
        }
    }

    combatState.animAttacker = actor.id;
    combatState.animTarget = target.id;
    renderCombatUnits();

    const applyDmg = (t, amount) => {
        const reduced = Math.max(1, amount - Math.floor(t.def * 0.3));
        t.hp -= reduced;
        if (t.hp <= 0) { t.hp = 0; t.alive = false; }
        game.totalDamageDealt = (game.totalDamageDealt || 0) + reduced;
        return reduced;
    };

    setTimeout(() => {
        if (aoe) {
            targets.forEach(t => {
                const d = applyDmg(t, Math.floor(dmg * 0.7));
                addCombatLog(`${t.name} takes ${d} AoE damage`, isCrit ? 'crit' : '');
            });
        } else {
            const d = applyDmg(target, dmg);
            const elemNote = elemMult > 1 ? ' (strong!)' : elemMult < 1 ? ' (weak...)' : '';
            addCombatLog(`${actor.name} → ${target.name}: ${d} dmg${elemNote}`, isCrit ? 'crit' : '');
        }
        combatState.animAttacker = null;
        combatState.animTarget = null;
        renderCombatUnits();
        combatState.turn++;
        setTimeout(combatLoop, delay);
    }, delay * 0.6);
}

function endCombat(victory) {
    combatState.done = true;
    addCombatLog(victory ? '🎉 VICTORY!' : '💀 Defeat...', victory ? 'buff' : 'debuff');
    document.getElementById('combatCloseBtn').style.display = 'block';
    const stats = combatState ? {
        turns: combatState.turn,
        alliesDefeated: combatState.allies.filter(u => !u.alive).length,
        alliesAlive: combatState.allies.filter(u => u.alive).length
    } : null;
    if (combatResolve) {
        const cb = combatResolve;
        combatResolve = null;
        cb(victory, stats);
    }
}

function closeCombatModal() {
    document.getElementById('combatModal').style.display = 'none';
    combatState = null;
}

function generateEnemyTeam(power, count, element = null) {
    const enemies = [];
    for (let i = 0; i < count; i++) {
        const el = element || elements[Math.floor(Math.random() * elements.length)];
        const e = createSlimeFromRoll(
            power > 800 ? 'Legendary' : power > 400 ? 'Epic' : 'Rare',
            el
        );
        e.level = Math.floor(10 + power / 50);
        e.name = `Foe ${i + 1}`;
        recalculateSlimePower(e);
        e.power = Math.floor(power / count * (0.8 + Math.random() * 0.4));
        enemies.push(e);
    }
    return enemies;
}

// ==================== ARENA & GUILD ====================
function getTopSlimes(count = 4) {
    return [...game.slimes].sort((a, b) => b.power - a.power).slice(0, count);
}

function setArenaDefense() {
    arenaDefenseMode = true;
    const top = getTopSlimes(4);
    game.arena.defenseTeam = top.map(s => s.id);
    log(`Defense team set: ${top.map(s => s.name).join(', ')}`);
    arenaDefenseMode = false;
    updateUI();
}

function runArenaBattle() {
    const team = getTopSlimes(4);
    if (team.length === 0) { log('Need slimes for arena'); return; }
    const enemyPower = 80 + game.arena.rank * 0.8 + Math.random() * 100;
    const enemies = generateEnemyTeam(enemyPower, 3 + Math.floor(Math.random() * 2));
    runCombat(team, enemies, `⚔️ Arena (Rank ${game.arena.rank})`, (won) => {
        if (won) {
            game.arena.wins = (game.arena.wins || 0) + 1;
            game.arena.rank = Math.min(3000, game.arena.rank + 15 + Math.floor(Math.random() * 10));
            game.resources.slimeShards = (game.resources.slimeShards || 0) + 8;
            gainPlayerExp(15);
            log('Arena victory! Rank increased.');
        } else {
            game.arena.losses = (game.arena.losses || 0) + 1;
            game.arena.rank = Math.max(100, game.arena.rank - 8);
            log('Arena defeat. Train harder!');
        }
        if (game.arena.rank > (game.leaderboard.bestArenaRank || 0)) game.leaderboard.bestArenaRank = game.arena.rank;
        updateQuestProgress('arena', 1);
        updateUI();
    });
}

function upgradeGuild() {
    const cost = 500 + (game.guild.level * 350);
    if ((game.resources.gold || 0) < cost) { log(`Need ${cost} Gold`); return; }
    game.resources.gold -= cost;
    game.guild.level++;
    game.slimes.forEach(s => recalculateSlimePower(s));
    log(`Guild upgraded to Lv ${game.guild.level}! All slimes stronger.`);
    updateUI();
}

function runFactionWar(faction) {
    if (game.playerLevel < 40) { log('Requires Lv 40'); return; }
    const team = game.slimes.filter(s => s.faction === faction).sort((a, b) => b.power - a.power).slice(0, 4);
    if (team.length < 3) { log(`Need 3+ ${faction} slimes`); return; }
    const enemies = generateEnemyTeam(team.reduce((s, x) => s + x.power, 0) / team.length * 1.1, 4);
    runCombat(team, enemies, `🏴 ${faction} Faction War`, (won) => {
        if (won) {
            game.resources.slimeShards = (game.resources.slimeShards || 0) + 20;
            game.resources.gold = (game.resources.gold || 0) + 100;
            gainPlayerExp(25);
            log(`${faction} Faction War won!`);
        } else log('Faction War failed.');
        updateUI();
    });
}

// ==================== QUESTS & LOGIN ====================
function ensureQuests() {
    const now = Date.now();
    const dayMs = 86400000;
    if (!game.quests.lastDailyReset || now - game.quests.lastDailyReset > dayMs) {
        game.quests.daily = [
            { id: 'explore3', desc: 'Clear 3 campaign stages', target: 3, progress: 0, reward: { slimeShards: 25, gold: 50 }, done: false },
            { id: 'summon1', desc: 'Summon 1 slime', target: 1, progress: 0, reward: { slimeShards: 15 }, done: false },
            { id: 'dungeon1', desc: 'Clear 1 dungeon', target: 1, progress: 0, reward: { gold: 80, skillBooks: 1 }, done: false },
            { id: 'train1', desc: 'Complete 1 training mission', target: 1, progress: 0, reward: { slimeShards: 20 }, done: false }
        ];
        game.quests.lastDailyReset = now;
    }
    if (!game.quests.lastWeeklyReset || now - game.quests.lastWeeklyReset > dayMs * 7) {
        game.quests.weekly = [
            { id: 'boss1', desc: 'Defeat 1 boss', target: 1, progress: 0, reward: { divineShards: 5, voidShards: 2 }, done: false },
            { id: 'fuse3', desc: 'Fuse 3 times', target: 3, progress: 0, reward: { slimeShards: 100 }, done: false },
            { id: 'summon10', desc: 'Summon 10 slimes', target: 10, progress: 0, reward: { divineShards: 10 }, done: false }
        ];
        game.quests.lastWeeklyReset = now;
    }
}

function updateQuestProgress(type, amount = 1) {
    ensureQuests();
    const all = [...(game.quests.daily || []), ...(game.quests.weekly || [])];
    all.forEach(q => {
        if (q.done) return;
        if ((type === 'explore' && q.id.startsWith('explore')) ||
            (type === 'summon' && q.id.startsWith('summon')) ||
            (type === 'dungeon' && q.id.startsWith('dungeon')) ||
            (type === 'train' && q.id.startsWith('train')) ||
            (type === 'boss' && q.id.startsWith('boss')) ||
            (type === 'fuse' && q.id.startsWith('fuse')) ||
            (type === 'arena' && q.id.startsWith('arena'))) {
            q.progress = (q.progress || 0) + amount;
            if (q.progress >= q.target) completeQuest(q);
        }
    });
}

function completeQuest(q) {
    q.done = true;
    Object.entries(q.reward || {}).forEach(([k, v]) => {
        if (k === 'gold' || game.resources[k] !== undefined) game.resources[k] = (game.resources[k] || 0) + v;
        else game.resources[k] = (game.resources[k] || 0) + v;
    });
    log(`✅ Quest complete: ${q.desc}!`);
}

function claimLoginReward() {
    const now = Date.now();
    const dayMs = 86400000;
    if (game.quests.lastLoginClaim && now - game.quests.lastLoginClaim < dayMs) {
        log('Already claimed today!');
        return;
    }
    if (game.quests.lastLoginClaim && now - game.quests.lastLoginClaim < dayMs * 2) {
        game.quests.loginStreak = (game.quests.loginStreak || 0) + 1;
    } else game.quests.loginStreak = 1;
    game.quests.lastLoginClaim = now;

    const streak = game.quests.loginStreak;
    game.resources.slimeShards = (game.resources.slimeShards || 0) + 20 + streak * 6;
    game.resources.gold = (game.resources.gold || 0) + 40 + streak * 12;
    game.campaign.energy = Math.min(game.campaign.maxEnergy, (game.campaign.energy || 0) + 15);
    if (streak % 7 === 0) game.resources.divineShards = (game.resources.divineShards || 0) + 4;
    log(`🎁 Day ${streak} login reward!`, true);
    updateUI();
}

function renderQuests() {
    const dailyEl = document.getElementById('dailyQuestList');
    const weeklyEl = document.getElementById('weeklyQuestList');
    if (!dailyEl) return;
    ensureQuests();
    const render = (quests, el) => {
        el.innerHTML = '';
        (quests || []).forEach(q => {
            const div = document.createElement('div');
            div.className = 'quest-row' + (q.done ? ' done' : '');
            div.innerHTML = `<span>${q.desc} (${q.progress || 0}/${q.target})</span><span>${q.done ? '✅' : '🎁'}</span>`;
            el.appendChild(div);
        });
    };
    render(game.quests.daily, dailyEl);
    render(game.quests.weekly, weeklyEl);
    const ls = document.getElementById('loginStreakDisplay');
    if (ls) ls.textContent = game.quests.loginStreak || 0;
}

// ==================== SLIME DETAIL MODAL ====================
function openSlimeDetail(slimeId) {
    detailSlimeId = slimeId;
    const slime = game.slimes.find(s => s.id === slimeId);
    if (!slime) return;
    migrateSlime(slime);

    document.getElementById('detailSlimeName').innerHTML = `${slime.name} <span class="asc-badge">★${slime.ascension || 0}</span>`;
    const artBonus = getArtifactBonuses(slime);

    let skillsHTML = (slime.skills || []).map(s => {
        const def = SKILL_DEFS[s.id] || { name: s.id, desc: '', icon: '❓', type: 'active' };
        return `<span class="skill-pill ${def.type === 'passive' ? 'passive' : ''}" title="${def.desc}">${def.icon} ${def.name} Lv${s.level || 1}</span>`;
    }).join('');

    let artifactsHTML = ARTIFACT_SLOTS.map(slot => {
        const art = slime.artifacts?.[slot];
        if (art) return `<div class="artifact-slot filled" title="${art.name}"><span class="slot-icon">${art.icon}</span>${slot}</div>`;
        return `<div class="artifact-slot"><span class="slot-icon">➕</span>${slot}</div>`;
    }).join('');

    let unequippedHTML = '';
    if (game.artifacts.length > 0) {
        unequippedHTML = '<h4 style="margin:10px 0 4px;">Equip from inventory:</h4><div>';
        game.artifacts.slice(0, 8).forEach(a => {
            unequippedHTML += `<button onclick="equipArtifact(${slimeId}, ${a.id})" style="width:auto; min-height:32px; padding:4px 8px; font-size:10px; margin:2px;">${a.icon} ${a.slot}</button>`;
        });
        unequippedHTML += '</div>';
    }

    const expProg = getSlimeExpProgress(slime);
    document.getElementById('detailSlimeBody').innerHTML = `
        <div style="text-align:center; margin-bottom:10px;">
            <div class="slime-card rarity-${slime.rarity}" style="display:inline-block; min-width:180px;">
                ${getSlimeIconHTML(slime, 'xl')}
                <div style="color:${getRarityColor(slime.rarity)}; font-weight:bold;">${slime.rarity}</div>
                <div>${slime.element} • ${slime.faction}</div>
            </div>
        </div>
        <div class="detail-stat-grid">
            <div class="detail-stat">⚡ Power: <strong>${slime.power}</strong></div>
            <div class="detail-stat">📊 Level: <strong>${slime.level}</strong></div>
            <div class="detail-stat">✨ EXP: <strong>${expProg.exp}</strong> <small>(${expProg.expInLevel}/${SLIME_EXP_PER_LEVEL})</small></div>
            <div class="detail-stat">🏃 Speed: <strong>${slime.speed}</strong></div>
            <div class="detail-stat">⬆️ Ascension: <strong>${slime.ascension || 0}/4</strong></div>
        </div>
        <div class="haven-exp-bar" style="margin:8px 0;"><div class="haven-exp-fill" style="width:${expProg.pct}%;"></div></div>
        <h4>Skills</h4><div>${skillsHTML || 'None'}</div>
        <h4>Artifacts (Sets: ${Object.entries(artBonus.setCounts).map(([k,v]) => `${ARTIFACT_SETS[k]?.name} x${v}`).join(', ') || 'none'})</h4>
        <div>${artifactsHTML}</div>${unequippedHTML}
        <h4>Traits</h4><div style="font-size:11px;">${(slime.traits || []).map(t => TRAIT_DEFINITIONS[t]?.name || t).join(', ') || 'None'}</div>
    `;

    document.getElementById('detailFavBtn').textContent = slime.favorite ? '💛 Favorited' : '⭐ Favorite';
    document.getElementById('detailLockBtn').textContent = slime.locked ? '🔓 Unlock' : '🔒 Lock';
    document.getElementById('slimeDetailModal').style.display = 'flex';
}

function closeSlimeDetailModal() {
    document.getElementById('slimeDetailModal').style.display = 'none';
    detailSlimeId = null;
}

function toggleFavoriteDetail() {
    const slime = game.slimes.find(s => s.id === detailSlimeId);
    if (slime) { slime.favorite = !slime.favorite; openSlimeDetail(detailSlimeId); updateUI(); }
}

function toggleLockDetail() {
    const slime = game.slimes.find(s => s.id === detailSlimeId);
    if (slime) { slime.locked = !slime.locked; openSlimeDetail(detailSlimeId); updateUI(); }
}

function renderLeaderboard() {
    const el = document.getElementById('leaderboardList');
    if (!el) return;
    const topPower = Math.max(...game.slimes.map(s => s.power), 0);
    const teamPower = getTopSlimes(4).reduce((s, x) => s + x.power, 0);
    if (teamPower > (game.leaderboard.highestTeamPower || 0)) game.leaderboard.highestTeamPower = teamPower;
    if (game.voidTowerFloor > (game.leaderboard.bestVoidFloor || 0)) game.leaderboard.bestVoidFloor = game.voidTowerFloor;

    const fakeRivals = [
        { name: 'SlimeKing42', score: topPower + 200 },
        { name: 'GelatinousGuru', score: topPower + 50 },
        { name: 'You', score: topPower, highlight: true },
        { name: 'BlobMaster', score: Math.max(50, topPower - 80) },
        { name: 'OozeLord', score: Math.max(30, topPower - 200) }
    ].sort((a, b) => b.score - a.score);

    el.innerHTML = `
        <div class="leaderboard-row"><span>Best Team Power</span><strong>${game.leaderboard.highestTeamPower || teamPower}</strong></div>
        <div class="leaderboard-row"><span>Void Tower Record</span><strong>Floor ${game.leaderboard.bestVoidFloor || 1}</strong></div>
        <div class="leaderboard-row"><span>Arena Peak Rank</span><strong>${game.leaderboard.bestArenaRank || game.arena.rank}</strong></div>
        <div style="margin-top:8px; color:#ffdd99;">Top Slime Power</div>
        ${fakeRivals.map(r => `<div class="leaderboard-row" style="${r.highlight ? 'color:#aaff99;' : ''}"><span>${r.name}</span><span>${r.score} PWR</span></div>`).join('')}
    `;
}

function renderEndgameExtras() {
    renderQuests();
    renderLeaderboard();
    renderSummonUI();
    const ar = document.getElementById('arenaRank');
    const aw = document.getElementById('arenaWins');
    const al = document.getElementById('arenaLosses');
    if (ar) ar.textContent = game.arena?.rank || 1500;
    if (aw) aw.textContent = game.arena?.wins || 0;
    if (al) al.textContent = game.arena?.losses || 0;
    const gl = document.getElementById('guildLevel');
    const gb = document.getElementById('guildBonusText');
    const gc = document.getElementById('guildUpgradeCost');
    if (gl) gl.textContent = game.guild?.level || 1;
    if (gb) gb.textContent = `+${((game.guild?.level || 1) - 1) * 2 + 2}% all slime power`;
    if (gc) gc.textContent = 500 + ((game.guild?.level || 1) * 350);
    const fw = document.getElementById('factionWarButtons');
    if (fw && fw.children.length === 0) {
        FACTIONS.forEach(f => {
            const btn = document.createElement('button');
            btn.textContent = `⚔️ ${f} War`;
            btn.onclick = () => runFactionWar(f);
            btn.style.marginBottom = '6px';
            fw.appendChild(btn);
        });
    }
    const ap = document.getElementById('artifactInventoryPreview');
    if (ap) ap.textContent = `Unequipped artifacts: ${game.artifacts?.length || 0}`;
}

// ==================== PRESTIGE ====================
function renderPrestigeUI() {
    const pc = document.getElementById('prestigeCount');
    const pb = document.getElementById('prestigeBonus');
    if (pc) pc.textContent = game.prestige?.count || 0;
    if (pb) pb.textContent = `+${Math.round(((game.globalPowerBonus || 1) - 1) * 100)}%`;
}

function performSlimeTranscendence() {
    const stars = game.campaign?.totalStars || 0;
    if (stars < 30 && game.playerLevel < 50) {
        log('Need 30 campaign stars OR Player Level 50.');
        return;
    }
    if (!confirm('Slime Transcendence resets Campaign map progress (keeps slimes, gear, levels). Gain permanent +8% global power and bonus shards. Continue?')) return;

    game.prestige.count = (game.prestige?.count || 0) + 1;
    game.globalPowerBonus = (game.globalPowerBonus || 1) * 1.08;
    game.campaign.progress = {};
    game.campaign.selectedChapter = 1;
    game.campaign.mode = 'normal';
    game.campaign.energy = game.campaign.maxEnergy || MAX_ENERGY;
    game.resources.slimeShards = (game.resources.slimeShards || 0) + 60 + game.prestige.count * 25;
    game.slimes.forEach(s => recalculateSlimePower(s));
    log(`✨ Transcendence #${game.prestige.count}! Campaign reset. Permanent power up!`, true);
    renderCampaign();
    renderPrestigeUI();
    updateUI();
}

/** Returns a completely clean game state — starter slime added separately */
function getDefaultGameState() {
    return {
        saveVersion: SAVE_VERSION,
        playerLevel: 1,
        playerExp: 0,
        playerExpToNext: 110,
        resources: {
            wood: 0, stone: 0, herbs: 0, berries: 0, jelly: 0, gold: 80,
            slimeEssence: 0, manaShards: 0, shadowEssence: 0, crystal: 0,
            refinedEssence: 0, divineShards: 0, arcaneDust: 0,
            slimeShards: 90, voidShards: 0, skillBooks: 0,
            trainingScrolls: 0, battleElixir: 0, healingSalve: 0,
            fertilityPotion: 0, focusElixir: 0, powerSerum: 0, alchemicalCatalyst: 0,
            explorerTonic: 0, shadowSilk: 0
        },
        slimes: [],
        artifacts: [],
        player: { statPoints: 0, stats: { taming: 0, alchemy: 0, combat: 0, leadership: 0, endurance: 0 } },
        workshop: { incubator: 0, trainingHall: 0, refinery: 0 },
        globalPowerBonus: 1.0,
        battleElixirActive: false,
        voidTowerFloor: 1,
        lifetimeDivineShards: 0,
        lifetimeSlimesTamed: 0,
        highestLevel: 1,
        explorerTonicCharges: 0,
        lastSlimePartyTime: 0,
        partyPowerBonusUntil: 0,
        divineConvergenceCount: 0,
        totalDamageDealt: 0,
        totalBossesDefeated: 0,
        totalDungeonsCleared: 0,
        totalFusions: 0,
        totalEvolutions: 0,
        totalSummons: 0,
        summon: { pityRegular: 0, pityPremium: 0, pityAncient: 0, bannerId: 'celestial' },
        guild: { level: 1 },
        arena: { rank: 1500, defenseTeam: [], wins: 0, losses: 0 },
        quests: { daily: [], weekly: [], lastDailyReset: 0, lastWeeklyReset: 0, loginStreak: 0, lastLoginClaim: 0 },
        leaderboard: { highestTeamPower: 0, bestVoidFloor: 1, bestArenaRank: 1500 },
        combatSpeed: 1,
        campaign: {
            energy: MAX_ENERGY,
            maxEnergy: MAX_ENERGY,
            lastEnergyTick: Date.now(),
            mode: 'normal',
            progress: {},
            selectedChapter: 1,
            totalStars: 0,
            defaultTeam: [],
            useDefaultTeam: true
        },
        prestige: { count: 0 }
    };
}

function bootstrapNewGame() {
    clearSlimeSelectionState();
    applyDefaultStateToGame();

    game.starterGranted = true;
    game.playerLevel = 1;
    game.playerExp = 0;
    game.playerExpToNext = 110;
    game.highestLevel = 1;
    game.resources.gold = 80;
    game.resources.slimeShards = 90;
    game.campaign.energy = MAX_ENERGY;
    game.campaign.maxEnergy = MAX_ENERGY;
    game.campaign.lastEnergyTick = Date.now();

    return assignSingleStarterSlime();
}

function startFreshGame() {
    if (!confirm('Start a brand-new game?\n\nAll progress, slimes, and saves will be erased. This cannot be undone.')) return;
    try { localStorage.removeItem('slimeAdventureSave'); } catch (e) {}
    clearSlimeSelectionState();
    applyDefaultStateToGame();
    wipeAllSlimes();
    migrateGameData();
    ensureQuests();
    const starter = assignSingleStarterSlime();
    game.starterGranted = true;
    game.playerLevel = 1;
    game.playerExp = 0;
    game.playerExpToNext = 110;
    game.highestLevel = 1;
    game.resources.gold = 80;
    game.resources.slimeShards = 90;
    game.campaign.energy = MAX_ENERGY;
    game.campaign.maxEnergy = MAX_ENERGY;
    game.campaign.lastEnergyTick = Date.now();
    activeTabIndex = 0;
    saveGame(true);
    updateUI();
    updateDungeonLocks();
    updateBossLocks();
    updateEndgameUI();
    renderCampaign();
    log('Welcome to Slime Adventure! A mysterious slime has joined you!', true);
    if (starter) log(`${starter.name} — ${starter.rarity} ${starter.element} slime (${starter.power} PWR)`, true);
}

// ==================== INIT ====================
function initGame() {
    if (gameInitialized) return;
    gameInitialized = true;

    const hadSave = loadGame();

    let starterSlime = null;
    if (!hadSave) {
        starterSlime = bootstrapNewGame();
        migrateGameData();
        ensureQuests();
        saveGame(true);
    } else {
        migrateGameData();
        ensureQuests();
    }

    if (!game.highestLevel) game.highestLevel = game.playerLevel || 1;

    activeTabIndex = 0;
    updateUI();
    updateDungeonLocks();
    updateBossLocks();
    updateEndgameUI();
    startMissionTimerSystem();
    loadDarkModePreference();

    if (hadSave) {
        log('✅ Save loaded — v' + SAVE_VERSION);
    } else {
        log('Welcome to Slime Adventure! A mysterious slime has joined you!', true);
        if (starterSlime) {
            log(`${starterSlime.name} — ${starterSlime.rarity} ${starterSlime.element} slime (${starterSlime.power} PWR)`, true);
        }
    }
}

initGame();
