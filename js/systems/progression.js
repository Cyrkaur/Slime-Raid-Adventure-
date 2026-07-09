/* ===== js/systems/progression.js — split from Single File/index-3.html ===== */

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
    const whole = (n) => Math.floor(Number(n) || 0);
    const levelEl = document.getElementById('playerLevel');
    const expEl = document.getElementById('playerExpText');
    const goldEl = document.getElementById('goldDisplay');
    const divineEl = document.getElementById('divineDisplay');

    if (levelEl) levelEl.innerText = game.playerLevel;
    if (expEl) expEl.innerText = `(${whole(game.playerExp)}/${whole(game.playerExpToNext)})`;
    if (goldEl) goldEl.innerText = whole(game.resources.gold);
    if (divineEl) divineEl.innerText = whole(game.resources.divineShards);
    const shardEl = document.getElementById('slimeShardDisplay');
    const voidEl = document.getElementById('voidShardDisplay');
    const bookEl = document.getElementById('skillBookDisplay');
    if (shardEl) shardEl.innerText = whole(game.resources.slimeShards);
    if (voidEl) voidEl.innerText = whole(game.resources.voidShards);
    if (bookEl) bookEl.innerText = whole(game.resources.skillBooks);
    tickCampaignEnergy();
    const eDisp = document.getElementById('energyDisplay');
    const maxEDisp = document.getElementById('maxEnergyDisplay');
    const c = game.campaign || {};
    if (eDisp) eDisp.textContent = whole(c.energy);
    if (maxEDisp) maxEDisp.textContent = whole(c.maxEnergy || MAX_ENERGY);
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

    runCombat(team, enemies, `🕳️ Void Tower — Floor ${floor}`, (won, stats) => {
        if (won) {
            const divineGain = 2 + Math.floor(floor / 5);
            const voidGain = floor % 5 === 0 ? 2 : 0;
            game.resources.divineShards = (game.resources.divineShards || 0) + divineGain;
            game.resources.voidShards = (game.resources.voidShards || 0) + voidGain;
            game.lifetimeDivineShards = (game.lifetimeDivineShards || 0) + divineGain;
            game.voidTowerFloor++;
            if (game.voidTowerFloor > (game.leaderboard.bestVoidFloor || 0)) game.leaderboard.bestVoidFloor = game.voidTowerFloor;
            gainPlayerExp(48 + floor * 7);
            const lines = [
                { icon: '✨', label: 'Divine Shards', amount: divineGain }
            ];
            if (voidGain) lines.push({ icon: '🕳️', label: 'Void Shards', amount: voidGain });
            showBattleResultModal({
                victory: true,
                title: 'Void Floor Cleared!',
                subtitle: `Floor ${floor}`,
                lines,
                combatStats: stats?.combatStats || (typeof getLastCombatStats === 'function' ? getLastCombatStats() : null)
            });
        } else {
            showBattleResultModal({
                victory: false,
                title: 'Void Tower Failed',
                subtitle: `Floor ${floor}`,
                lines: [],
                combatStats: stats?.combatStats || (typeof getLastCombatStats === 'function' ? getLastCombatStats() : null)
            });
        }
        game.battleElixirActive = false;
        updateUI();
        updateEndgameUI();
    }, { theme: 'void' });
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

