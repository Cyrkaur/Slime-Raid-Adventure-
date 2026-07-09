/* ===== js/systems/social.js — split from Single File/index-3.html ===== */

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
    runCombat(team, enemies, `⚔️ Arena (Rank ${game.arena.rank})`, (won, stats) => {
        if (won) {
            game.arena.wins = (game.arena.wins || 0) + 1;
            game.arena.rank = Math.min(3000, game.arena.rank + 15 + Math.floor(Math.random() * 10));
            game.resources.slimeShards = (game.resources.slimeShards || 0) + 8;
            gainPlayerExp(15);
            showBattleResultModal({
                victory: true,
                title: 'Arena Victory!',
                subtitle: `Rank ${game.arena.rank}`,
                lines: [
                    { icon: '🔮', label: 'Slime Shards', amount: 8 },
                    { icon: '📈', label: 'Rank', amount: game.arena.rank }
                ],
                combatStats: stats?.combatStats || (typeof getLastCombatStats === 'function' ? getLastCombatStats() : null)
            });
        } else {
            game.arena.losses = (game.arena.losses || 0) + 1;
            game.arena.rank = Math.max(100, game.arena.rank - 8);
            showBattleResultModal({
                victory: false,
                title: 'Arena Defeat',
                subtitle: 'Train harder and climb again!',
                lines: [{ icon: '📉', label: 'Rank', amount: game.arena.rank }],
                combatStats: stats?.combatStats || (typeof getLastCombatStats === 'function' ? getLastCombatStats() : null)
            });
        }
        if (game.arena.rank > (game.leaderboard.bestArenaRank || 0)) game.leaderboard.bestArenaRank = game.arena.rank;
        updateQuestProgress('arena', 1);
        updateUI();
    }, { theme: 'arena', allowArenaFusion: true });
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
    runCombat(team, enemies, `🏴 ${faction} Faction War`, (won, stats) => {
        if (won) {
            game.resources.slimeShards = (game.resources.slimeShards || 0) + 20;
            game.resources.gold = (game.resources.gold || 0) + 100;
            gainPlayerExp(25);
            showBattleResultModal({
                victory: true,
                title: 'Faction War Won!',
                subtitle: `${faction} victory`,
                lines: [
                    { icon: '🔮', label: 'Slime Shards', amount: 20 },
                    { icon: '🪙', label: 'Gold', amount: 100 }
                ],
                combatStats: stats?.combatStats || (typeof getLastCombatStats === 'function' ? getLastCombatStats() : null)
            });
        } else {
            showBattleResultModal({
                victory: false,
                title: 'Faction War Failed',
                subtitle: faction,
                lines: [],
                combatStats: stats?.combatStats || (typeof getLastCombatStats === 'function' ? getLastCombatStats() : null)
            });
        }
        updateUI();
    }, { theme: 'faction' });
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
    const startShards = (typeof DEV_START_SLIME_SHARDS === 'number') ? DEV_START_SLIME_SHARDS : 90;
    return {
        saveVersion: SAVE_VERSION,
        playerLevel: 1,
        playerExp: 0,
        playerExpToNext: 110,
        resources: {
            wood: 0, stone: 0, herbs: 0, berries: 0, jelly: 0, gold: 80,
            slimeEssence: 0, manaShards: 0, shadowEssence: 0, crystal: 0,
            refinedEssence: 0, divineShards: 0, arcaneDust: 0,
            slimeShards: startShards, voidShards: 0, skillBooks: 0,
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
    game.resources.slimeShards = (typeof DEV_START_SLIME_SHARDS === 'number') ? DEV_START_SLIME_SHARDS : 90;
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
    game.resources.slimeShards = (typeof DEV_START_SLIME_SHARDS === 'number') ? DEV_START_SLIME_SHARDS : 90;
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
    if (typeof DEV_MODE !== 'undefined' && DEV_MODE && game.slimes.length >= 2) {
        log(`DEV: ${game.slimes.length} starters ready — same element so they can 🧬 Fuse in Arena.`, true);
    }
}

