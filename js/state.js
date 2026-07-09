/* ===== js/state.js — split from Single File/index-3.html ===== */

/*
 * CHANGELOG — Slime Adventure: Raid of the Slimes
 * v4.1 — Campaign slime EXP, default team selection (save/auto-use/manual override)
 * v4.0 OPTIMIZED EDITION (full polish pass)
 * - Performance: tab-aware UI batching, single game loop, combat log cap, toast queue
 * - Balance: smoother early/mid/late curve, 140 energy, true fresh start (1 slime Lv1), tuned summons
 * - Fresh start: no save → Lv1, 80 Gold, DEV shards for testing, exactly 1 RNG starter slime, auto-saved once
 * - DEV: DEV_START_SLIME_SHARDS = 100000 until ship (toggle DEV_MODE false for release)
 * - New Game button clears localStorage and re-bootstraps the same clean state
 * - Fixes: getTrainingExpMultiplier, save versioning, deep-load migration, Records tab layout
 * - QoL: prestige (Slime Transcendence), gain flashes, favorite filter, energy timer
 * - Alchemy/combat/campaign rewards rebalanced for fair long-term progression
 * v3.0 — Raid Campaign (chapters, stars, sweep, energy, hard/nightmare)
 * v2.0 — Summon, artifacts, arena, guild, ascension, combat engine
 * v1.0 — Base alchemy, breeding, dungeons, void tower
 */
const SAVE_VERSION = 4;

/** Dev testing economy — set DEV_MODE = false before shipping. */
const DEV_MODE = true;
const DEV_START_SLIME_SHARDS = DEV_MODE ? 100000 : 90;

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
        slimeShards: DEV_START_SLIME_SHARDS, voidShards: 0, skillBooks: 0,
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
    /** Audio / presentation prefs (persisted) */
    settings: {
        sfx: true,       // combat sound effects
        sfxVolume: 0.7   // 0–1
    },
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
    /** Side-scroll wilds patrol (AFK gains) */
    idleMarch: {
        lastTick: Date.now(),
        totalKills: 0,
        totalGold: 0,
        paused: false
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
    game.settings = { sfx: true, sfxVolume: 0.7, ...(fresh.settings || {}) };
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
    // Dev: start with 2 fuse-compatible slimes (Tank + Mage, same element)
    if (typeof DEV_MODE !== 'undefined' && DEV_MODE && typeof assignDevStarterTeam === 'function') {
        return assignDevStarterTeam();
    }
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
    if (game.resources.slimeShards === undefined) game.resources.slimeShards = DEV_START_SLIME_SHARDS;
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
    if (!game.settings || typeof game.settings !== 'object') {
        game.settings = { sfx: true, sfxVolume: 0.7 };
    }
    if (game.settings.sfx === undefined) game.settings.sfx = true;
    if (game.settings.sfxVolume === undefined) game.settings.sfxVolume = 0.7;
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
    if (typeof ensureSlimeIdentity === 'function') ensureSlimeIdentity(slime);
    // Restore champion visual from roster if missing on load
    if (slime.championId && !slime.visual && typeof getChampionDefById === 'function') {
        const def = getChampionDefById(slime.championId);
        if (def) {
            slime.visual = def.visual ? { ...def.visual } : slime.visual;
            slime.isChampion = true;
            if (def.role) slime.role = def.role;
        }
    }
    if (typeof assignSlimeRole === 'function') assignSlimeRole(slime);
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

