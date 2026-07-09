/* ===== js/systems/combat.js — split from Single File/index-3.html ===== */

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
        runCombat(team, waves[waveIndex], `🗺️ ${dungeonId.replace(/_/g, ' ')} — Wave ${waveIndex + 1}/${waves.length}`, (won, stats) => {
            if (!won) {
                game.battleElixirActive = false;
                if ((game.resources.healingSalve || 0) > 0 && Math.random() < 0.35) {
                    game.resources.healingSalve--;
                    log("Healing Salve softened the defeat!");
                }
                showBattleResultModal({
                    victory: false,
                    title: 'Dungeon Failed',
                    subtitle: dungeonId.replace(/_/g, ' '),
                    lines: [{ icon: '⚔️', label: 'Waves cleared', amount: waveIndex }],
                    combatStats: stats?.combatStats || getLastCombatStats()
                });
                updateUI();
                return;
            }
            waveIndex++;
            if (waveIndex < waves.length) {
                pendingAccumulateStats = true;
                setTimeout(runWave, 800);
            } else {
                onDungeonComplete(dungeonId, stats?.combatStats || getLastCombatStats());
            }
        }, { theme: 'dungeon' });
    };
    runWave();
}

function onDungeonComplete(dungeonId, combatStats) {
    const goldGain = 35 + Math.floor(game.playerLevel * 2.8);
    const essenceGain = 4 + Math.floor(game.playerLevel / 6);
    const shardGain = 5 + Math.floor(Math.random() * 6);
    const playerExp = 12 + Math.floor(game.playerLevel / 3);
    game.resources.gold = (game.resources.gold || 0) + goldGain;
    game.resources.slimeEssence = (game.resources.slimeEssence || 0) + essenceGain;
    game.resources.slimeShards = (game.resources.slimeShards || 0) + shardGain;

    const lines = [
        { icon: '🪙', label: 'Gold', amount: goldGain },
        { icon: '💧', label: 'Slime Essence', amount: essenceGain },
        { icon: '🔮', label: 'Slime Shards', amount: shardGain },
        { icon: '⭐', label: 'Player EXP', amount: playerExp }
    ];
    const tamed = [];

    if (dungeonId === 'abyssal_throne' || dungeonId === 'origin_core') {
        game.resources.divineShards = (game.resources.divineShards || 0) + 1;
        game.lifetimeDivineShards = (game.lifetimeDivineShards || 0) + 1;
        lines.push({ icon: '✨', label: 'Divine Shards', amount: 1 });
    }
    if (Math.random() < 0.3) {
        const art = generateArtifact(Math.random() < 0.2 ? 'epic' : 'rare');
        game.artifacts.push(art);
        lines.push({ icon: '⚔️', label: `${art.rarity || 'Artifact'} Gear`, amount: 1 });
    }
    if (Math.random() < 0.35) {
        const newSlime = generateRandomSlime("Hard");
        game.slimes.push(newSlime);
        game.lifetimeSlimesTamed = (game.lifetimeSlimesTamed || 0) + 1;
        tamed.push(newSlime);
    }
    game.totalDungeonsCleared = (game.totalDungeonsCleared || 0) + 1;
    updateQuestProgress('dungeon', 1);
    gainPlayerExp(playerExp);
    game.battleElixirActive = false;

    showBattleResultModal({
        victory: true,
        title: 'Dungeon Cleared!',
        subtitle: dungeonId.replace(/_/g, ' '),
        lines,
        tamed,
        combatStats: combatStats || getLastCombatStats()
    });
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

    // Raid-style: primary stats (STR/AGI/VIT/…) drive combat → power rating
    if (typeof ensureSlimeStats === 'function') ensureSlimeStats(slime);
    if (typeof deriveCombatFromStats === 'function') {
        const derived = deriveCombatFromStats(slime);
        let power = derived.power;

        power = Math.floor(power * getAscensionMultiplier(slime));

        const artBonus = getArtifactBonuses(slime);
        power = Math.floor(power * artBonus.multiplier);
        power += Math.floor((artBonus.atk + artBonus.hp * 0.3 + artBonus.def * 0.5) * (1 + artBonus.crit * 0.01));

        power = Math.floor(power * applyTraitEffects(slime));
        power = Math.floor(power * getSkillPowerBonus(slime));
        power = Math.floor(power * getGuildBonus());

        // Soft caps (keep endgame readable)
        if (power > 1350) {
            const excess = power - 1350;
            power = 1350 + Math.floor(Math.pow(excess, 0.58) * 7.5);
        }
        if (power > 8500) power = 8500 + Math.floor((power - 8500) * 0.15);

        slime.power = Math.max(12, power);
        // Cache combat-facing fields on the slime for UI + buildCombatUnit
        slime.speed = derived.spd;
        slime.combatAtk = derived.atk;
        slime.combatDef = derived.def;
        slime.combatHp = derived.hp;
        slime.combatCrit = derived.critRate;
        slime.combatCritDmg = derived.critDmg;
        slime.combatAcc = derived.acc;
        slime.combatRes = derived.res;
        return;
    }

    // Fallback if stats module missing
    const rarityMulti = {
        "Common": 1.00, "Uncommon": 1.32, "Rare": 1.68,
        "Epic": 2.15, "Legendary": 2.85, "Mythic": 3.75
    }[slime.rarity] || 1.0;
    let levelPower = slime.level <= 70
        ? 22 + (slime.level * 1.85)
        : 22 + (70 * 1.85) + ((slime.level - 70) * 0.55) + (Math.sqrt(slime.level - 70) * 4.2);
    let power = Math.floor(levelPower * rarityMulti * getAscensionMultiplier(slime));
    const artBonus = getArtifactBonuses(slime);
    power = Math.floor(power * artBonus.multiplier);
    power = Math.floor(power * applyTraitEffects(slime) * getSkillPowerBonus(slime) * getGuildBonus());
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

        runCombat(team, enemies, `👹 ${boss.name} — Phase ${phase}`, (won, stats) => {
            if (!won) {
                log(`Defeated by ${boss.name}... Train and try again!`);
                if ((game.resources.healingSalve || 0) > 0 && Math.random() < 0.4) {
                    game.resources.healingSalve--;
                    log("Healing Salve helped recovery!");
                }
                game.battleElixirActive = false;
                showBattleResultModal({
                    victory: false,
                    title: 'Defeat',
                    subtitle: boss.name,
                    lines: [],
                    combatStats: stats?.combatStats || getLastCombatStats()
                });
                updateUI();
                return;
            }
            if (phase < 2 && boss.basePower > 400) {
                phase++;
                pendingAccumulateStats = true;
                addCombatLog('⚠️ Boss enters Phase 2 — adds appear!', 'debuff');
                setTimeout(runBossPhase, 1000);
                return;
            }
            onBossVictory(boss, bossId, stats?.combatStats || getLastCombatStats());
        }, { theme: 'boss' });
    };
    runBossPhase();
}

function onBossVictory(boss, bossId, combatStats) {
    const gold = Math.floor(80 + boss.basePower / 3);
    const essence = Math.floor(8 + boss.basePower / 60);
    const shards = 10;
    const playerExp = 30 + Math.floor(boss.basePower / 15);
    game.resources.gold = (game.resources.gold || 0) + gold;
    game.resources.shadowEssence = (game.resources.shadowEssence || 0) + essence;
    game.resources.slimeShards = (game.resources.slimeShards || 0) + shards;

    const lines = [
        { icon: '🪙', label: 'Gold', amount: gold },
        { icon: '🌑', label: 'Shadow Essence', amount: essence },
        { icon: '🔮', label: 'Slime Shards', amount: shards },
        { icon: '⭐', label: 'Player EXP', amount: playerExp }
    ];

    if (bossId === 'storm_sovereign' || bossId === 'divine_colossus') {
        game.resources.divineShards = (game.resources.divineShards || 0) + 2;
        game.lifetimeDivineShards = (game.lifetimeDivineShards || 0) + 2;
        lines.push({ icon: '✨', label: 'Divine Shards', amount: 2 });
    }
    if (bossId === 'divine_colossus' && Math.random() < 0.15) {
        game.resources.voidShards = (game.resources.voidShards || 0) + 1;
        lines.push({ icon: '🕳️', label: 'Void Shards', amount: 1 });
    }

    gainPlayerExp(playerExp);
    game.totalBossesDefeated = (game.totalBossesDefeated || 0) + 1;
    updateQuestProgress('boss', 1);
    game.battleElixirActive = false;

    showBattleResultModal({
        victory: true,
        title: 'Boss Defeated!',
        subtitle: boss.name,
        lines,
        combatStats: combatStats || getLastCombatStats()
    });
    updateUI();
}

function closeBossModal() {
    document.getElementById('bossTeamModal').style.display = 'none';
    currentBossId = null;
    selectedSlimeIds = [];
}


// ==================== COMBAT ENGINE (Raid-style stage battles) ====================
// Manual: pick Basic Attack / skills + click targets
// Auto: AI plays for you (toggle anytime)

function setCombatSpeed(speed) {
    game.combatSpeed = speed;
    [1, 2, 3].forEach(n => {
        const btn = document.getElementById(`speed${n}`);
        if (btn) btn.classList.toggle('active', n === speed);
    });
}

function toggleCombatAuto() {
    if (!combatState || combatState.done) return;
    combatState.auto = !combatState.auto;
    updateCombatAutoButton();
    if (combatState.auto && combatState.phase === 'player_input') {
        hideCombatActionBar();
        combatState.phase = 'running';
        setTimeout(() => aiTakeTurn(combatState.currentActor), getCombatDelay() * 0.3);
    } else if (!combatState.auto && combatState.phase === 'running' && combatState.currentActor && !combatState.currentActor.isEnemy) {
        // next ally turn will wait for input
    }
}

function updateCombatAutoButton() {
    const btn = document.getElementById('combatAutoBtn');
    if (!btn || !combatState) return;
    if (combatState.auto) {
        btn.textContent = '⏸ Manual';
        btn.classList.add('auto-on');
    } else {
        btn.textContent = '▶ Auto';
        btn.classList.remove('auto-on');
    }
}

function getCombatDelay() {
    return Math.max(180, 700 / (game.combatSpeed || 1));
}

function buildCombatUnit(slime, isEnemy = false) {
    const art = getArtifactBonuses(slime);
    if (typeof ensureSlimeStats === 'function' && !slime.isFoe && slime.kind !== 'foe') {
        ensureSlimeStats(slime);
    }
    // Prefer Raid-style derived combat stats from primary attributes
    let derived = null;
    if (typeof deriveCombatFromStats === 'function' && !slime.isFoe && slime.kind !== 'foe' && slime.rarity) {
        derived = deriveCombatFromStats(slime);
    }

    let maxHp, atk, def, spd, critChance;
    if (derived) {
        maxHp = Math.floor(derived.hp * (1 + (art.hp || 0) * 0.01));
        atk = Math.floor(derived.atk + (art.atk || 0));
        def = Math.floor(derived.def + (art.def || 0));
        spd = Math.floor(derived.spd + (art.spd || 0));
        critChance = Math.min(0.65, derived.critRate + ((art.crit || 0) * 0.01));
    } else {
        // Foes / fallback: power-based
        maxHp = Math.floor((slime.power || 100) * (1.2 + art.hp * 0.01));
        if ((slime.skills || []).some(s => s.id === 'tank_passive')) maxHp = Math.floor(maxHp * 1.12);
        atk = Math.floor((slime.power || 100) * 0.35 + (art.atk || 0));
        def = Math.floor((slime.power || 100) * 0.08 + (art.def || 0));
        spd = (slime.speed || 100) + (art.spd || 0);
        critChance = 0.12 + ((art.crit || 0) * 0.01) + ((slime.skills || []).some(s => s.id === 'crit_passive') ? 0.1 : 0);
    }

    const skillList = [{ id: 'basic', level: 1 }];
    (slime.skills || []).forEach(s => {
        if (SKILL_DEFS[s.id] && SKILL_DEFS[s.id].type === 'active') skillList.push({ id: s.id, level: s.level || 1 });
    });

    const cds = {};
    skillList.forEach(s => { cds[s.id] = 0; });

    const isChamp = !!(slime.isChampion || slime.championId);
    // Pass full slime so champion accessories/aura render on the field
    const iconHtml = slime.iconHtml
        || (slime.enemyIcon ? `<span class="enemy-creature-icon">${slime.enemyIcon}</span>` : null)
        || ((typeof getSlimeIconHTML === 'function')
            ? getSlimeIconHTML(isEnemy && !slime.isFoe ? slime.element : slime, 'lg', false)
            : '🫧');

    return {
        id: slime.id || ('e' + Math.random().toString(36).slice(2, 9)),
        sourceId: slime.id,
        name: slime.name,
        element: slime.element,
        faction: slime.faction,
        rarity: slime.rarity,
        iconHtml,
        kind: slime.kind || (isEnemy ? 'foe' : 'slime'),
        isFoe: !!(slime.isFoe || slime.isEnemyCreature),
        enemyIcon: slime.enemyIcon || null,
        isChampion: isChamp,
        championId: slime.championId || null,
        role: slime.role || (typeof assignSlimeRole === 'function' ? assignSlimeRole(slime) : null),
        species: slime.species || null,
        visual: slime.visual || null,
        stats: slime.stats ? { ...slime.stats } : null,
        maxHp, hp: maxHp,
        atk, def, spd,
        power: slime.power || (derived ? derived.power : 0),
        level: slime.level || 1,
        critChance,
        critDmg: derived ? derived.critDmg : 1.25,
        skills: skillList,
        skillCds: cds,
        hasLifesteal: (slime.skills || []).some(s => s.id === 'lifesteal'),
        turnMeter: Math.random() * 25,
        buffs: [], // { id, turns, defMul?, spdMul? }
        debuffs: [], // { id, turns, dotPct? }
        isEnemy,
        alive: true,
        // Raid-style post-battle stats
        damageDealt: 0,
        damageTaken: 0,
        healingDone: 0,
        healingReceived: 0
    };
}

/** Snapshot of last finished fight (allies + enemies + totals). Cleared when result modal consumes it. */
let lastCombatStats = null;

function snapshotCombatUnitStats(u) {
    return {
        id: u.id,
        sourceId: u.sourceId || u.id,
        name: u.name,
        element: u.element,
        rarity: u.rarity,
        iconHtml: u.iconHtml || '🫧',
        isEnemy: !!u.isEnemy,
        alive: !!u.alive,
        damageDealt: u.damageDealt || 0,
        damageTaken: u.damageTaken || 0,
        healingDone: u.healingDone || 0,
        healingReceived: u.healingReceived || 0
    };
}

function sumCombatStatField(units, field) {
    return (units || []).reduce((s, u) => s + (u[field] || 0), 0);
}

function collectCombatStats() {
    if (!combatState) return null;
    const allies = combatState.allies.map(snapshotCombatUnitStats);
    const enemies = combatState.enemies.map(snapshotCombatUnitStats);
    return {
        allies,
        enemies,
        totals: {
            allyDamageDealt: sumCombatStatField(allies, 'damageDealt'),
            allyDamageTaken: sumCombatStatField(allies, 'damageTaken'),
            allyHealingDone: sumCombatStatField(allies, 'healingDone'),
            allyHealingReceived: sumCombatStatField(allies, 'healingReceived'),
            enemyDamageDealt: sumCombatStatField(enemies, 'damageDealt'),
            enemyDamageTaken: sumCombatStatField(enemies, 'damageTaken'),
            enemyHealingDone: sumCombatStatField(enemies, 'healingDone'),
            enemyHealingReceived: sumCombatStatField(enemies, 'healingReceived')
        }
    };
}

/** Merge multi-wave fights (dungeon / boss phases) by unit sourceId. */
function mergeCombatStats(prev, next) {
    if (!prev) return next;
    if (!next) return prev;
    const mergeList = (a, b) => {
        const map = new Map();
        (a || []).forEach(u => map.set(u.sourceId || u.id || u.name, { ...u }));
        (b || []).forEach(u => {
            const key = u.sourceId || u.id || u.name;
            if (map.has(key)) {
                const p = map.get(key);
                p.damageDealt += u.damageDealt || 0;
                p.damageTaken += u.damageTaken || 0;
                p.healingDone += u.healingDone || 0;
                p.healingReceived += u.healingReceived || 0;
                p.alive = u.alive;
                p.iconHtml = u.iconHtml || p.iconHtml;
            } else {
                map.set(key, { ...u });
            }
        });
        return [...map.values()];
    };
    const allies = mergeList(prev.allies, next.allies);
    const enemies = mergeList(prev.enemies, next.enemies);
    return {
        allies,
        enemies,
        totals: {
            allyDamageDealt: sumCombatStatField(allies, 'damageDealt'),
            allyDamageTaken: sumCombatStatField(allies, 'damageTaken'),
            allyHealingDone: sumCombatStatField(allies, 'healingDone'),
            allyHealingReceived: sumCombatStatField(allies, 'healingReceived'),
            enemyDamageDealt: sumCombatStatField(enemies, 'damageDealt'),
            enemyDamageTaken: sumCombatStatField(enemies, 'damageTaken'),
            enemyHealingDone: sumCombatStatField(enemies, 'healingDone'),
            enemyHealingReceived: sumCombatStatField(enemies, 'healingReceived')
        }
    };
}

function getLastCombatStats() {
    return lastCombatStats;
}

function clearLastCombatStats() {
    lastCombatStats = null;
}

function addCombatLog(msg, cls = '') {
    const logEl = document.getElementById('combatLog');
    if (!logEl) return;
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    logEl.appendChild(line);
    while (logEl.children.length > 40) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
}

function setCombatBanner(text, cls = '') {
    const el = document.getElementById('combatTurnBanner');
    if (!el) return;
    el.textContent = text;
    el.className = 'combat-turn-banner' + (cls ? ' ' + cls : '');
}

function getCombatFxLayer() {
    let layer = document.getElementById('combatFxLayer');
    if (!layer) {
        const arena = document.getElementById('combatArena');
        if (!arena) return null;
        layer = document.createElement('div');
        layer.id = 'combatFxLayer';
        layer.className = 'combat-fx-layer';
        layer.setAttribute('aria-hidden', 'true');
        arena.appendChild(layer);
    }
    return layer;
}

function clearCombatFx() {
    const layer = document.getElementById('combatFxLayer');
    if (layer) layer.innerHTML = '';
    const callout = document.getElementById('combatSkillCallout');
    if (callout) {
        callout.style.display = 'none';
        callout.className = 'combat-skill-callout';
    }
}

/** Unit center relative to combat arena (for floaters that survive re-renders). */
function getUnitArenaPos(unitId) {
    const unitEl = document.getElementById('unit-' + unitId);
    const arena = document.getElementById('combatArena');
    if (!unitEl || !arena) return null;
    // Prefer the fighter sprite body (not the nameplate)
    const fighter = unitEl.querySelector('.combat-fighter') || unitEl.querySelector('.unit-stage') || unitEl;
    const ur = fighter.getBoundingClientRect();
    const ar = arena.getBoundingClientRect();
    return {
        x: ur.left + ur.width / 2 - ar.left,
        y: ur.top + ur.height * 0.4 - ar.top
    };
}

function formatCombatFloatNum(n) {
    n = Math.floor(Math.abs(n) || 0);
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}

/**
 * Raid-style floating combat text on the arena FX layer.
 * kind: dmg | crit | heal | dot | block | miss | skill | status
 */
function spawnDamageNumber(unitId, amount, kind = 'dmg', opts = {}) {
    const delay = opts.delay || 0;
    const run = () => {
        const layer = getCombatFxLayer();
        const pos = getUnitArenaPos(unitId);
        if (!layer || !pos) return;

        const idx = opts.offsetIndex || 0;
        const jitterX = (opts.x != null ? opts.x : ((idx % 5) - 2) * 14 + (Math.random() * 10 - 5));
        const jitterY = (opts.y != null ? opts.y : -8 - (idx % 3) * 6 + (Math.random() * 6 - 3));

        const floater = document.createElement('div');
        let cls = 'combat-floater cf-' + kind;
        if (opts.big) cls += ' cf-big';
        if (kind === 'crit') cls += ' cf-big';
        floater.className = cls;

        let text;
        if (kind === 'heal') text = '+' + formatCombatFloatNum(amount);
        else if (kind === 'miss') text = 'MISS';
        else if (kind === 'block') text = 'BLOCK';
        else if (kind === 'skill' || kind === 'status') text = amount; // amount is string label
        else text = formatCombatFloatNum(amount);

        floater.textContent = text;
        floater.style.left = Math.round(pos.x + jitterX) + 'px';
        floater.style.top = Math.round(pos.y + jitterY) + 'px';
        layer.appendChild(floater);

        // Impact ring on damage
        if (kind === 'dmg' || kind === 'crit' || kind === 'dot') {
            spawnImpactBurst(pos.x, pos.y, kind);
        }
        if (kind === 'heal') {
            spawnImpactBurst(pos.x, pos.y, 'heal');
        }

        // Longer hold so floaters are easy to read mid-fight
        const life = kind === 'crit' ? 2200
            : kind === 'heal' ? 2000
            : kind === 'status' ? 1800
            : kind === 'dot' ? 1700
            : 1900;
        setTimeout(() => floater.remove(), life);
    };
    if (delay > 0) setTimeout(run, delay);
    else run();
}

function spawnImpactBurst(x, y, kind) {
    const layer = getCombatFxLayer();
    if (!layer) return;
    const ring = document.createElement('div');
    ring.className = 'combat-impact combat-impact-' + kind;
    ring.style.left = Math.round(x) + 'px';
    ring.style.top = Math.round(y) + 'px';
    layer.appendChild(ring);
    setTimeout(() => ring.remove(), 500);
}

/** Element / skill palette for Tier-2 colored cast VFX */
const SKILL_VFX_COLORS = {
    Fire: '#ff5722', Lava: '#ff3d00', Water: '#29b6f6', Ice: '#4dd0e1',
    Earth: '#8d6e63', Plant: '#66bb6a', Wind: '#81c784', Lightning: '#ffca28',
    Storm: '#7e57c2', Shadow: '#5c6bc0', Light: '#fff176', Metal: '#90a4ae',
    Poison: '#ab47bc', Crystal: '#b39ddb', Spirit: '#ce93d8', Void: '#78909c',
    heal: '#69f0ae', shield: '#90caf9', haste: '#ffee58', default: '#ffcc80'
};

const SKILL_VFX_STYLE = {
    basic: 'slash',
    splash: 'nova',
    inferno: 'burst',
    shield: 'aura',
    poison: 'nova',
    heal: 'aura',
    haste: 'aura',
    ember_lance: 'beam',
    tidal_crush: 'burst',
    quake_slam: 'nova',
    gale_dance: 'slash',
    bloom_burst: 'nova',
    thunder_judgement: 'beam',
    glacial_prison: 'burst',
    umbral_strike: 'slash',
    radiant_smite: 'nova',
    iron_bulwark: 'aura',
    venom_nova: 'nova',
    prism_beam: 'beam',
    magma_eruption: 'nova',
    storm_crown: 'beam',
    soul_bind: 'beam',
    void_rend: 'slash',
    royal_aegis: 'aura',
    apocalypse_gel: 'nova'
};

function getSkillVfxColor(skillDef, actor, skillId = '') {
    if (!skillDef) return SKILL_VFX_COLORS.default;
    const id = skillId || '';
    if (id === 'heal' || skillDef.teamHealPct || skillDef.healSelfPct || skillDef.healLowestAllyPct) {
        return SKILL_VFX_COLORS.heal;
    }
    if (id === 'shield' || skillDef.teamShield || skillDef.selfShield) return SKILL_VFX_COLORS.shield;
    if (id === 'haste' || skillDef.teamHaste) return SKILL_VFX_COLORS.haste;
    const el = actor?.element;
    return (el && SKILL_VFX_COLORS[el]) || SKILL_VFX_COLORS.default;
}

function getSkillVfxStyle(skillId, skillDef) {
    if (SKILL_VFX_STYLE[skillId]) return SKILL_VFX_STYLE[skillId];
    if (skillDef?.target === 'all_enemies') return 'nova';
    if (skillDef?.target === 'all_allies' || skillDef?.target === 'ally') return 'aura';
    if (skillDef?.unique) return 'beam';
    return 'slash';
}

/** Caster glow + optional projectile / slash toward target. */
function playSkillCastVfx(actor, skillId, targetUnit, skillDef) {
    const layer = getCombatFxLayer();
    if (!layer || !actor) return;
    const color = getSkillVfxColor(skillDef, actor, skillId);
    const style = getSkillVfxStyle(skillId, skillDef);
    const from = getUnitArenaPos(actor.id);
    if (!from) return;

    // Caster ring
    const cast = document.createElement('div');
    cast.className = 'skill-vfx skill-vfx-cast' + (skillDef?.unique ? ' skill-vfx-unique' : '');
    cast.style.left = Math.round(from.x) + 'px';
    cast.style.top = Math.round(from.y) + 'px';
    cast.style.setProperty('--vfx', color);
    layer.appendChild(cast);
    setTimeout(() => cast.remove(), 700);

    // Arena tint punch for unique / heavy skills
    const arena = document.getElementById('combatArena');
    if (arena && (skillDef?.unique || style === 'nova')) {
        arena.style.setProperty('--skill-flash', color);
        arena.classList.add('arena-skill-flash');
        setTimeout(() => arena.classList.remove('arena-skill-flash'), 420);
    }

    if (style === 'aura') {
        spawnSkillAura(actor.id, color, skillDef?.unique);
        return;
    }

    // Beam / slash / burst toward primary target (or AoE center)
    let to = targetUnit ? getUnitArenaPos(targetUnit.id) : null;
    if (!to && style === 'nova') {
        // Aim at middle of opposite side
        const foes = (actor.isEnemy ? combatState?.allies : combatState?.enemies) || [];
        const live = foes.filter(u => u.alive);
        if (live.length) {
            const positions = live.map(u => getUnitArenaPos(u.id)).filter(Boolean);
            if (positions.length) {
                to = {
                    x: positions.reduce((s, p) => s + p.x, 0) / positions.length,
                    y: positions.reduce((s, p) => s + p.y, 0) / positions.length
                };
            }
        }
    }
    if (!to) return;

    if (style === 'beam' || style === 'slash') {
        spawnSkillProjectile(from, to, color, style, skillDef?.unique);
    } else if (style === 'burst') {
        spawnSkillProjectile(from, to, color, 'beam', skillDef?.unique);
    }
}

function spawnSkillProjectile(from, to, color, style, unique) {
    const layer = getCombatFxLayer();
    if (!layer) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.max(8, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    const bolt = document.createElement('div');
    bolt.className = 'skill-vfx skill-vfx-' + style + (unique ? ' skill-vfx-unique' : '');
    bolt.style.left = Math.round(from.x) + 'px';
    bolt.style.top = Math.round(from.y) + 'px';
    bolt.style.width = Math.round(dist) + 'px';
    bolt.style.setProperty('--vfx', color);
    bolt.style.setProperty('--vfx-angle', angle + 'deg');
    bolt.style.transform = `rotate(${angle}deg)`;
    layer.appendChild(bolt);
    setTimeout(() => bolt.remove(), 480);
}

function spawnSkillAura(unitId, color, unique) {
    const layer = getCombatFxLayer();
    const pos = getUnitArenaPos(unitId);
    if (!layer || !pos) return;
    const aura = document.createElement('div');
    aura.className = 'skill-vfx skill-vfx-aura' + (unique ? ' skill-vfx-unique' : '');
    aura.style.left = Math.round(pos.x) + 'px';
    aura.style.top = Math.round(pos.y) + 'px';
    aura.style.setProperty('--vfx', color);
    layer.appendChild(aura);
    setTimeout(() => aura.remove(), 750);
}

/** Colored impact on target(s) at resolve time. */
function playSkillImpactVfx(actor, skillId, targetUnit, skillDef) {
    const color = getSkillVfxColor(skillDef, actor, skillId);
    const style = getSkillVfxStyle(skillId, skillDef);
    const layer = getCombatFxLayer();
    if (!layer) return;

    const burstAt = (unitId, delay = 0, big = false) => {
        setTimeout(() => {
            const pos = getUnitArenaPos(unitId);
            if (!pos) return;
            const el = document.createElement('div');
            el.className = 'skill-vfx skill-vfx-impact' + (big ? ' skill-vfx-impact-big' : '') + (skillDef?.unique ? ' skill-vfx-unique' : '');
            el.style.left = Math.round(pos.x) + 'px';
            el.style.top = Math.round(pos.y) + 'px';
            el.style.setProperty('--vfx', color);
            layer.appendChild(el);
            // spark particles
            for (let i = 0; i < (big ? 8 : 5); i++) {
                const spark = document.createElement('div');
                spark.className = 'skill-vfx skill-vfx-spark';
                const ang = (Math.PI * 2 * i) / (big ? 8 : 5) + Math.random() * 0.4;
                const dist = 18 + Math.random() * 28;
                spark.style.left = Math.round(pos.x) + 'px';
                spark.style.top = Math.round(pos.y) + 'px';
                spark.style.setProperty('--vfx', color);
                spark.style.setProperty('--sx', Math.cos(ang) * dist + 'px');
                spark.style.setProperty('--sy', Math.sin(ang) * dist + 'px');
                layer.appendChild(spark);
                setTimeout(() => spark.remove(), 550);
            }
            setTimeout(() => el.remove(), 600);
        }, delay);
    };

    if (skillDef?.target === 'all_enemies') {
        const foes = (actor.isEnemy ? combatState?.allies : combatState?.enemies) || [];
        foes.filter(u => u.alive).forEach((u, i) => burstAt(u.id, i * 70, true));
        // screen nova
        const arena = document.getElementById('combatArena');
        if (arena) {
            const nova = document.createElement('div');
            nova.className = 'skill-vfx skill-vfx-screen-nova';
            nova.style.setProperty('--vfx', color);
            arena.appendChild(nova);
            setTimeout(() => nova.remove(), 650);
        }
        return;
    }
    if (skillDef?.target === 'all_allies' || style === 'aura') {
        const allies = (actor.isEnemy ? combatState?.enemies : combatState?.allies) || [];
        allies.filter(u => u.alive).forEach((u, i) => {
            setTimeout(() => spawnSkillAura(u.id, color, skillDef?.unique), i * 40);
        });
        return;
    }
    if (targetUnit) burstAt(targetUnit.id, 0, !!skillDef?.unique);
    else if (actor) burstAt(actor.id, 0, false);
}

function flashCombatUnit(unitId, type = 'hit') {
    const el = document.getElementById('unit-' + unitId);
    if (!el) return;
    const cls = type === 'heal' ? 'fx-heal'
        : type === 'crit' ? 'fx-crit-hit'
        : type === 'death' ? 'fx-death'
        : type === 'cast' ? 'fx-cast'
        : 'fx-hit';
    el.classList.remove('fx-heal', 'fx-crit-hit', 'fx-death', 'fx-hit', 'fx-cast');
    // force reflow so re-trigger works
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), type === 'death' ? 700 : 450);
}

function shakeCombatArena(intensity = 'med') {
    const arena = document.getElementById('combatArena');
    if (!arena) return;
    arena.classList.remove('arena-shake', 'arena-shake-hard');
    void arena.offsetWidth;
    arena.classList.add(intensity === 'hard' ? 'arena-shake-hard' : 'arena-shake');
    setTimeout(() => arena.classList.remove('arena-shake', 'arena-shake-hard'), 400);
}

// ==================== Level A/C: fighter anim + camera + SFX ====================
const FIGHTER_ANIM_STATES = ['idle', 'cast', 'attack', 'hit', 'heal', 'death'];
let combatAudioCtx = null;

function findCombatUnitById(unitId) {
    if (!combatState || unitId == null) return null;
    return [...combatState.allies, ...combatState.enemies].find(u => u.id === unitId) || null;
}

/** Body pose + multi-frame SVG pose swap (idle / cast / attack / hit / heal / death). */
function setFighterAnim(unitId, state, holdMs = 0) {
    if (!FIGHTER_ANIM_STATES.includes(state)) state = 'idle';
    const unit = findCombatUnitById(unitId);
    if (unit) {
        if (state === 'death' || !unit.alive) unit.animState = 'death';
        else unit.animState = state;
    }
    const el = document.getElementById('unit-' + unitId);
    if (!el) return;
    const fighter = el.querySelector('.combat-fighter');
    const target = fighter || el;
    FIGHTER_ANIM_STATES.forEach(s => {
        target.classList.remove('anim-' + s);
        el.classList.remove('fighter-anim-' + s);
    });
    const apply = unit && !unit.alive && state !== 'death' ? 'death' : state;
    target.classList.add('anim-' + apply);
    el.classList.add('fighter-anim-' + apply);
    el.dataset.anim = apply;
    if (fighter) fighter.dataset.pose = apply;

    // Impact dust when landing an attack / taking a hit
    if (apply === 'attack' || apply === 'hit') {
        spawnFighterDust(unitId, apply);
    }
    if (apply === 'attack') spawnFighterAfterimage(unitId);

    if (holdMs > 0 && apply !== 'death' && apply !== 'idle') {
        const token = (unit && (unit._animToken = (unit._animToken || 0) + 1));
        setTimeout(() => {
            const u = findCombatUnitById(unitId);
            if (!u) return;
            if (token != null && u._animToken !== token) return;
            if (!u.alive) {
                setFighterAnim(unitId, 'death');
                return;
            }
            if (u.animState === apply) setFighterAnim(unitId, 'idle');
        }, holdMs);
    }
}

function spawnFighterDust(unitId, kind = 'hit') {
    const layer = getCombatFxLayer();
    const pos = getUnitArenaPos(unitId);
    if (!layer || !pos) return;
    for (let i = 0; i < (kind === 'attack' ? 6 : 4); i++) {
        const d = document.createElement('div');
        d.className = 'fighter-dust';
        const ang = Math.PI + (Math.random() - 0.5) * 1.4;
        const dist = 12 + Math.random() * 22;
        d.style.left = Math.round(pos.x) + 'px';
        d.style.top = Math.round(pos.y + 36) + 'px';
        d.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
        d.style.setProperty('--dy', Math.sin(ang) * dist * 0.4 + 'px');
        d.style.animationDelay = (i * 0.02) + 's';
        layer.appendChild(d);
        setTimeout(() => d.remove(), 500);
    }
}

function spawnFighterAfterimage(unitId) {
    const unitEl = document.getElementById('unit-' + unitId);
    const fighter = unitEl && unitEl.querySelector('.combat-fighter');
    const stage = unitEl && unitEl.querySelector('.unit-stage');
    if (!fighter || !stage) return;
    const ghost = fighter.cloneNode(true);
    ghost.classList.add('fighter-afterimage');
    ghost.classList.remove('anim-attack', 'anim-cast', 'anim-hit', 'anim-heal', 'anim-death');
    ghost.classList.add('anim-idle');
    stage.appendChild(ghost);
    setTimeout(() => ghost.remove(), 320);
}

/** Level C — cinematic camera on the arena stage. */
function combatCamera(mode = 'rest', ms = 500) {
    const arena = document.getElementById('combatArena');
    const stage = document.getElementById('arenaStage');
    const dim = document.getElementById('arenaCameraDim');
    if (!arena) return;
    ['cam-rest', 'cam-focus', 'cam-punch', 'cam-ult', 'cam-slow'].forEach(c => {
        arena.classList.remove(c);
        if (stage) stage.classList.remove(c);
    });
    const cls = 'cam-' + (mode || 'rest');
    arena.classList.add(cls);
    if (stage) stage.classList.add(cls);
    if (dim) {
        dim.className = 'arena-camera-dim' + (mode === 'ult' || mode === 'focus' ? ' show' : '');
    }
    if (mode !== 'rest' && ms > 0) {
        setTimeout(() => {
            if (!combatState || combatState.done) return;
            combatCamera('rest', 0);
        }, ms);
    }
}

function ensureCombatAudio() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!combatAudioCtx) combatAudioCtx = new AC();
    if (combatAudioCtx.state === 'suspended') {
        combatAudioCtx.resume().catch(() => {});
    }
    return combatAudioCtx;
}

function isCombatSfxEnabled() {
    if (typeof game === 'undefined') return true;
    if (game.sfxEnabled === false) return false; // legacy override
    if (game.settings && game.settings.sfx === false) return false;
    return true;
}

function getCombatSfxVolume() {
    const v = (typeof game !== 'undefined' && game.settings && game.settings.sfxVolume != null)
        ? game.settings.sfxVolume : 0.7;
    return Math.max(0, Math.min(1, v));
}

function toggleCombatSfx() {
    if (typeof game === 'undefined') return;
    if (!game.settings) game.settings = { sfx: true, sfxVolume: 0.7 };
    game.settings.sfx = !game.settings.sfx;
    updateCombatSfxButton();
    if (typeof saveGame === 'function') saveGame();
    if (game.settings.sfx) {
        playCombatSfx('cast'); // preview
        if (typeof log === 'function') log('🔊 Combat SFX on');
    } else if (typeof log === 'function') {
        log('🔇 Combat SFX muted');
    }
}

function updateCombatSfxButton() {
    const btn = document.getElementById('combatSfxBtn');
    if (!btn) return;
    const on = isCombatSfxEnabled();
    btn.textContent = on ? '🔊 SFX' : '🔇 SFX';
    btn.classList.toggle('sfx-off', !on);
    btn.title = on ? 'Mute combat sounds' : 'Enable combat sounds';
}

/** Optional file SFX: assets/sfx/{type}.mp3|ogg|wav — falls back to procedural tones. */
const combatSfxFileCache = {};
const COMBAT_SFX_FILE_TYPES = ['hit', 'crit', 'cast', 'ult', 'heal', 'shield', 'death', 'victory', 'defeat', 'whoosh'];

function tryPlayCombatSfxFile(type) {
    if (!COMBAT_SFX_FILE_TYPES.includes(type)) return false;
    const exts = ['mp3', 'ogg', 'wav'];
    // Lazy-create audio element once per type
    if (!combatSfxFileCache[type]) {
        // Prefer mp3 path; browser will error if missing — we catch and use procedural
        const a = new Audio();
        a.preload = 'auto';
        // Try first existing via sequential load — use mp3 as convention
        a.src = `assets/sfx/${type}.mp3`;
        combatSfxFileCache[type] = { audio: a, failed: false };
        a.addEventListener('error', () => { combatSfxFileCache[type].failed = true; });
    }
    const entry = combatSfxFileCache[type];
    if (!entry || entry.failed) return false;
    try {
        const a = entry.audio.cloneNode();
        a.volume = 0.35 * getCombatSfxVolume();
        const p = a.play();
        if (p && typeof p.then === 'function') {
            p.catch(() => { entry.failed = true; });
        }
        // If already known failed from previous plays
        return !entry.failed;
    } catch (e) {
        entry.failed = true;
        return false;
    }
}

/** Procedural combat SFX (files optional). Toggle via combat UI 🔊 button. */
function playCombatSfx(type) {
    if (!isCombatSfxEnabled()) return;
    // Prefer recorded pack if present under assets/sfx/
    if (tryPlayCombatSfxFile(type)) return;
    try {
        const ctx = ensureCombatAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.value = 0.12 * getCombatSfxVolume();
        master.connect(ctx.destination);

        const beep = (freq, dur, typeOsc = 'square', gain = 0.2, delay = 0) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = typeOsc;
            o.frequency.setValueAtTime(freq, now + delay);
            g.gain.setValueAtTime(0.0001, now + delay);
            g.gain.exponentialRampToValueAtTime(gain, now + delay + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
            o.connect(g);
            g.connect(master);
            o.start(now + delay);
            o.stop(now + delay + dur + 0.02);
        };

        const noiseBurst = (dur, gain = 0.15) => {
            const len = Math.floor(ctx.sampleRate * dur);
            const buf = ctx.createBuffer(1, len, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const g = ctx.createGain();
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = type === 'crit' ? 2400 : 900;
            g.gain.value = gain;
            src.connect(f);
            f.connect(g);
            g.connect(master);
            src.start(now);
        };

        switch (type) {
            case 'cast':
                beep(320, 0.08, 'sine', 0.12);
                beep(480, 0.1, 'sine', 0.1, 0.05);
                break;
            case 'ult':
                beep(220, 0.12, 'sawtooth', 0.1);
                beep(330, 0.12, 'sawtooth', 0.1, 0.06);
                beep(440, 0.18, 'sine', 0.12, 0.12);
                break;
            case 'hit':
                noiseBurst(0.08, 0.18);
                beep(120, 0.06, 'triangle', 0.15);
                break;
            case 'crit':
                noiseBurst(0.1, 0.22);
                beep(520, 0.08, 'square', 0.12);
                beep(780, 0.12, 'square', 0.1, 0.05);
                break;
            case 'heal':
                beep(523, 0.1, 'sine', 0.1);
                beep(659, 0.12, 'sine', 0.09, 0.06);
                beep(784, 0.14, 'sine', 0.08, 0.12);
                break;
            case 'shield':
                beep(300, 0.1, 'triangle', 0.1);
                beep(450, 0.12, 'triangle', 0.08, 0.05);
                break;
            case 'death':
                beep(200, 0.15, 'sawtooth', 0.1);
                beep(120, 0.2, 'sawtooth', 0.08, 0.08);
                beep(70, 0.25, 'triangle', 0.08, 0.16);
                break;
            case 'victory':
                beep(523, 0.1, 'sine', 0.1);
                beep(659, 0.1, 'sine', 0.1, 0.08);
                beep(784, 0.12, 'sine', 0.1, 0.16);
                beep(1046, 0.2, 'sine', 0.12, 0.26);
                break;
            case 'defeat':
                beep(300, 0.15, 'triangle', 0.1);
                beep(220, 0.2, 'triangle', 0.1, 0.1);
                beep(150, 0.28, 'sine', 0.1, 0.2);
                break;
            case 'whoosh':
                noiseBurst(0.12, 0.08);
                break;
            default:
                beep(400, 0.06, 'sine', 0.08);
        }
    } catch (e) { /* audio optional */ }
}

/** Theme set dressing — richer SVG silhouettes + CSS props for depth. */
function buildArenaPropsHTML(themeId) {
    const haze = `<div class="prop prop-ground-haze"></div>`;
    const svgTree = (x, h = 70, w = 36) =>
        `<svg class="prop-svg prop-svg-tree" style="left:${x};height:${h}px;width:${w}px" viewBox="0 0 40 80" preserveAspectRatio="xMidYMax meet">
            <rect x="17" y="48" width="6" height="28" fill="#3e2723"/>
            <ellipse cx="20" cy="42" rx="16" ry="18" fill="#1b5e20"/>
            <ellipse cx="20" cy="28" rx="13" ry="14" fill="#2e7d32"/>
            <ellipse cx="20" cy="16" rx="9" ry="10" fill="#43a047"/>
        </svg>`;
    const svgPeak = (x, h = 70, c1 = '#37474f', c2 = '#eceff1') =>
        `<svg class="prop-svg prop-svg-peak" style="left:${x};height:${h}px;width:${Math.round(h * 1.1)}px" viewBox="0 0 80 70" preserveAspectRatio="xMidYMax meet">
            <path d="M5 70 L40 8 L75 70 Z" fill="${c1}"/>
            <path d="M28 28 L40 8 L52 28 L40 24 Z" fill="${c2}" opacity="0.85"/>
        </svg>`;

    const sets = {
        verdant: `
            ${svgTree('2%', 88, 44)}${svgTree('12%', 70, 34)}${svgTree('78%', 82, 40)}${svgTree('90%', 64, 30)}
            <div class="prop prop-bush" style="left:20%;bottom:36%"></div>
            <div class="prop prop-bush" style="right:22%;bottom:34%"></div>
            <div class="prop prop-fern" style="left:28%"></div>
            <div class="prop prop-fern" style="right:30%"></div>
            ${haze}`,
        peaks: `
            ${svgPeak('0%', 90)}${svgPeak('18%', 110, '#263238', '#cfd8dc')}${svgPeak('55%', 75)}${svgPeak('78%', 95, '#455a64', '#eceff1')}
            <div class="prop prop-snowdrift" style="left:25%"></div>
            <div class="prop prop-snowdrift" style="right:20%"></div>
            ${haze}`,
        murk: `
            <div class="prop prop-ruin left" style="left:4%"></div>
            <div class="prop prop-ruin right" style="right:5%"></div>
            <div class="prop prop-column tall" style="left:18%"></div>
            <div class="prop prop-column" style="left:28%"></div>
            <div class="prop prop-column tall" style="right:20%"></div>
            <div class="prop prop-column" style="right:30%"></div>
            <div class="prop prop-swamp"></div>
            <div class="prop prop-mist"></div>
            ${haze}`,
        scorched: `
            <div class="prop prop-volcano" style="left:8%"></div>
            <div class="prop prop-volcano small" style="right:12%"></div>
            <div class="prop prop-rock" style="left:30%"></div>
            <div class="prop prop-rock big" style="right:28%"></div>
            <div class="prop prop-lava-glow"></div>
            <div class="prop prop-ember" style="left:38%"></div>
            <div class="prop prop-ember" style="left:48%"></div>
            <div class="prop prop-ember" style="right:32%"></div>
            ${haze}`,
        celestial: `
            <div class="prop prop-spire left" style="left:6%"></div>
            <div class="prop prop-spire tall" style="left:16%"></div>
            <div class="prop prop-spire right" style="right:8%"></div>
            <div class="prop prop-spire tall" style="right:18%"></div>
            <div class="prop prop-nebula"></div>
            <div class="prop prop-star bright" style="left:22%;top:10%"></div>
            <div class="prop prop-star" style="left:40%;top:16%"></div>
            <div class="prop prop-star bright" style="right:28%;top:12%"></div>
            <div class="prop prop-star" style="right:15%;top:22%"></div>
            ${haze}`,
        dungeon: `
            <div class="prop prop-arch left" style="left:0"></div>
            <div class="prop prop-arch right" style="right:0"></div>
            <div class="prop prop-brick" style="left:0"></div>
            <div class="prop prop-brick" style="right:0"></div>
            <div class="prop prop-torch" style="left:14%"></div>
            <div class="prop prop-torch" style="right:14%"></div>
            <div class="prop prop-chain" style="left:35%"></div>
            <div class="prop prop-chain" style="right:36%"></div>
            ${haze}`,
        arena: `
            <div class="prop prop-colosseum"></div>
            <div class="prop prop-banner left" style="left:6%"></div>
            <div class="prop prop-banner right" style="right:6%"></div>
            <div class="prop prop-pillar ornate" style="left:16%"></div>
            <div class="prop prop-pillar ornate" style="right:16%"></div>
            <div class="prop prop-crowd-haze"></div>
            ${haze}`,
        void: `
            <div class="prop prop-rift"></div>
            <div class="prop prop-crystal" style="left:12%"></div>
            <div class="prop prop-crystal tall" style="left:22%"></div>
            <div class="prop prop-crystal" style="right:14%"></div>
            <div class="prop prop-crystal tall" style="right:24%"></div>
            <div class="prop prop-void-ring"></div>
            ${haze}`,
        boss: `
            <div class="prop prop-throne"></div>
            <div class="prop prop-flame left" style="left:10%"></div>
            <div class="prop prop-flame right" style="right:10%"></div>
            <div class="prop prop-brazier" style="left:22%"></div>
            <div class="prop prop-brazier" style="right:22%"></div>
            <div class="prop prop-red-haze"></div>
            ${haze}`,
        faction: `
            <div class="prop prop-banner left" style="left:8%"></div>
            <div class="prop prop-banner right" style="right:8%"></div>
            <div class="prop prop-tent" style="left:4%"></div>
            <div class="prop prop-tent" style="right:6%"></div>
            <div class="prop prop-flagpole" style="left:48%"></div>
            ${haze}`,
        default: `${haze}<div class="prop prop-hills"></div>`
    };
    return sets[themeId] || sets.default;
}

/** Big Raid-style skill name banner when a skill is cast. */
function showSkillCallout(actor, skillDef) {
    const el = document.getElementById('combatSkillCallout');
    if (!el || !skillDef) return;
    const isEnemy = actor && actor.isEnemy;
    el.className = 'combat-skill-callout' + (isEnemy ? ' enemy-cast' : ' ally-cast') + (skillDef.unique ? ' unique-cast' : '');
    el.innerHTML = `
        <span class="csc-icon">${skillDef.icon || '⚔️'}</span>
        <span class="csc-body">
            <span class="csc-actor">${actor?.name || ''}</span>
            <span class="csc-name">${skillDef.name || 'Attack'}</span>
        </span>
    `;
    el.style.display = 'flex';
    void el.offsetWidth;
    el.classList.add('show');
    const hideMs = Math.max(900, getCombatDelay() * 1.25);
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => { el.style.display = 'none'; }, 280);
    }, hideMs);
}

/** Soft-update HP / turn bars without destroying unit DOM (keeps CSS animations alive). */
function updateCombatBarsSoft() {
    if (!combatState) return;
    const all = [...combatState.allies, ...combatState.enemies];
    all.forEach(u => {
        const el = document.getElementById('unit-' + u.id);
        if (!el) return;
        const hpNow = Math.max(0, Math.ceil(u.hp));
        const hpMax = Math.max(1, Math.ceil(u.maxHp));
        const hpPct = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
        const tmPct = Math.max(0, Math.min(100, (u.turnMeter / 100) * 100));
        const hpLabel = el.querySelector('.bar-label-hp');
        const hpFill = el.querySelector('.hp-fill');
        const tmLabel = el.querySelector('.bar-label-tm');
        const tmFill = el.querySelector('.tm-fill');
        const status = el.querySelector('.unit-status');
        if (hpLabel) hpLabel.textContent = `HP ${hpNow}/${hpMax}`;
        if (hpFill) {
            const prev = parseFloat(hpFill.style.width) || hpPct;
            if (hpPct < prev - 0.5) {
                hpFill.classList.add('hp-drain');
                setTimeout(() => hpFill.classList.remove('hp-drain'), 350);
            } else if (hpPct > prev + 0.5) {
                hpFill.classList.add('hp-gain');
                setTimeout(() => hpFill.classList.remove('hp-gain'), 350);
            }
            hpFill.style.width = hpPct + '%';
        }
        if (tmLabel) tmLabel.textContent = `Turn ${Math.floor(Math.min(100, u.turnMeter))}%`;
        if (tmFill) tmFill.style.width = tmPct + '%';
        if (status) {
            const buffIcons = (u.buffs || []).map(b => b.icon || '✨').join('') +
                (u.debuffs || []).map(d => d.icon || '☠️').join('');
            status.innerHTML = buffIcons || '&nbsp;';
        }
        if (!u.alive) el.classList.add('dead');
    });
}

function getFactionSynergyMultiplier(team) {
    const counts = {};
    team.forEach(s => {
        const f = s.faction || (typeof ELEMENT_FACTION !== 'undefined' ? ELEMENT_FACTION[s.element] : null);
        if (f) counts[f] = (counts[f] || 0) + 1;
    });
    let best = 1;
    Object.values(counts).forEach(c => {
        if (c >= 4) best = Math.max(best, (FACTION_SYNERGY && FACTION_SYNERGY[4]) || 1.18);
        else if (c >= 3) best = Math.max(best, (FACTION_SYNERGY && FACTION_SYNERGY[3]) || 1.12);
        else if (c >= 2) best = Math.max(best, (FACTION_SYNERGY && FACTION_SYNERGY[2]) || 1.05);
    });
    return best;
}

function tickUnitBuffs(unit) {
    unit.buffs = (unit.buffs || []).map(b => ({ ...b, turns: b.turns - 1 })).filter(b => b.turns > 0);
    unit.debuffs = (unit.debuffs || []).map(d => ({ ...d, turns: d.turns - 1 })).filter(d => d.turns > 0);
    // tick DoTs at start of turn
    let dotTotal = 0;
    (unit.debuffs || []).forEach(d => {
        if (d.dotPct && unit.alive) {
            const dmg = Math.max(1, Math.floor(unit.maxHp * d.dotPct));
            unit.hp = Math.max(0, unit.hp - dmg);
            unit.damageTaken = (unit.damageTaken || 0) + dmg;
            dotTotal += dmg;
            if (unit.hp <= 0) unit.alive = false;
        }
    });
    if (dotTotal > 0) {
        addCombatLog(`${unit.name} suffers ${dotTotal} poison damage`, 'debuff');
        spawnDamageNumber(unit.id, dotTotal, 'dot', { big: false });
        flashCombatUnit(unit.id, 'hit');
        updateCombatBarsSoft();
    }
    // reduce skill CDs
    Object.keys(unit.skillCds || {}).forEach(k => {
        if (unit.skillCds[k] > 0) unit.skillCds[k]--;
    });
}

function getEffectiveDef(unit) {
    let def = unit.def;
    (unit.buffs || []).forEach(b => { if (b.defMul) def = Math.floor(def * b.defMul); });
    return def;
}

function getEffectiveSpd(unit) {
    let spd = unit.spd;
    (unit.buffs || []).forEach(b => { if (b.spdMul) spd = Math.floor(spd * b.spdMul); });
    return spd;
}

function renderCombatUnits() {
    const alliesEl = document.getElementById('combatAllies');
    const enemiesEl = document.getElementById('combatEnemies');
    if (!alliesEl || !enemiesEl || !combatState) return;

    const selectedTargetId = combatState.selectedTargetId;
    const currentId = combatState.currentActor && combatState.currentActor.id;
    const targeting = combatState.phase === 'player_input' && combatState.pendingSkill;
    const actor = combatState.currentActor;
    const pending = combatState.pendingSkill;
    const skillDef = pending && pending !== 'arena_fuse' ? SKILL_DEFS[pending] : null;
    const skillTgt = skillDef ? (skillDef.target || 'enemy') : null;

    // Raise the correct lane so targets are clickable (ally box no longer blocks enemies)
    const floor = document.querySelector('.battlefield-floor');
    if (floor) {
        floor.classList.remove('targeting-enemies', 'targeting-allies');
        if (targeting) {
            if (pending === 'arena_fuse' || skillTgt === 'ally' || skillTgt === 'all_allies') {
                floor.classList.add('targeting-allies');
            } else if (skillTgt === 'enemy' || skillTgt === 'all_enemies') {
                floor.classList.add('targeting-enemies');
            }
        }
    }

    const renderSide = (units, el, isEnemySide) => {
        el.innerHTML = '';
        units.forEach(u => {
            const div = document.createElement('div');
            let cls = 'combat-unit' + (isEnemySide ? ' enemy-unit' : ' ally-unit');
            const anim = (!u.alive ? 'death' : (u.animState || 'idle'));
            if (!u.alive) cls += ' dead';
            if (combatState.animTarget === u.id) cls += ' hit';
            if (combatState.animAttacker === u.id) cls += ' attacking';
            if (currentId === u.id) cls += ' active-turn';
            if (selectedTargetId === u.id) cls += ' selected-target';
            if (u.isChampion) cls += ' unit-champion';
            if (u.arenaFused) cls += ' unit-fusion';
            if (u.kind && u.kind !== 'slime') cls += ' unit-foe unit-kind-' + u.kind;
            if (u.rarity) cls += ' rarity-frame-' + u.rarity;
            cls += ' fighter-anim-' + anim;

            let isTargetable = false;
            let fuseHint = '';
            if (targeting && u.alive) {
                if (pending === 'arena_fuse') {
                    if (actor && !isEnemySide && canArenaFusePair(actor, u)) {
                        isTargetable = true;
                        cls += ' targetable fuse-target';
                        fuseHint = getArenaFusionReason(actor, u);
                    }
                } else if (skillTgt) {
                    if (
                        (skillTgt === 'enemy' && isEnemySide) ||
                        (skillTgt === 'ally' && !isEnemySide) ||
                        (skillTgt === 'all_enemies' && isEnemySide) ||
                        (skillTgt === 'all_allies' && !isEnemySide)
                    ) {
                        isTargetable = true;
                        cls += ' targetable';
                    }
                }
            }
            // Soft badge: on your turn, mark allies you could fuse with (before pressing Fuse)
            if (!targeting && actor && !actor.isEnemy && isArenaFusionEnabled()
                && combatState.phase === 'player_input' && !isEnemySide && u.alive
                && canArenaFusePair(actor, u) && !actor.arenaFused) {
                cls += ' fuse-compatible';
                fuseHint = getArenaFusionReason(actor, u);
            }

            div.className = cls;
            div.id = 'unit-' + u.id;
            div.dataset.unitId = u.id;
            if (u.element) div.style.setProperty('--elem-glow', (SKILL_VFX_COLORS && SKILL_VFX_COLORS[u.element]) || '#77ffaa');

            const hpNow = Math.max(0, Math.ceil(u.hp));
            const hpMax = Math.max(1, Math.ceil(u.maxHp));
            const hpPct = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
            const tmPct = Math.max(0, Math.min(100, (u.turnMeter / 100) * 100));
            const buffIcons = (u.buffs || []).map(b => b.icon || '✨').join('') +
                (u.debuffs || []).map(d => d.icon || '☠️').join('');
            const rarityColor = (typeof getRarityColor === 'function' && u.rarity) ? getRarityColor(u.rarity) : '#aaff99';
            let fighterHtml = (typeof getCombatFighterHTML === 'function')
                ? getCombatFighterHTML(u)
                : `<div class="unit-icon-wrap">${u.iconHtml || '🫧'}</div>`;
            fighterHtml = fighterHtml.replace(
                'class="combat-fighter',
                `class="combat-fighter anim-${anim}`
            );
            const kindLabel = (u.kind && u.kind !== 'slime') ? u.kind : (u.isChampion ? 'champion' : 'slime');
            const roleLabel = (!u.isEnemy && u.role) ? u.role : '';
            const fuseBadge = fuseHint
                ? `<div class="unit-fuse-badge" title="Can fuse (${fuseHint})">🧬 ${fuseHint}</div>`
                : '';
            const clickHint = isTargetable
                ? `<div class="unit-click-hint">${pending === 'arena_fuse' ? 'Tap to fuse' : 'Tap to target'}</div>`
                : '';

            div.innerHTML = `
                <div class="unit-stage">
                    <div class="unit-floor-shadow" aria-hidden="true"></div>
                    ${fighterHtml}
                </div>
                <div class="unit-nameplate">
                    <div class="unit-name">${u.name}</div>
                    <div class="unit-elem">
                        <span style="color:${rarityColor}">${u.rarity || kindLabel}</span>
                        ${u.element ? ' · ' + u.element : ''}
                        ${roleLabel ? ` · <span class="unit-role-tag">${roleLabel}</span>` : ''}
                        ${u.level ? ' · Lv' + u.level : ''}
                    </div>
                    ${fuseBadge}
                    ${clickHint}
                    <div class="unit-stats-line">
                        <span title="Attack">⚔ ${u.atk}</span>
                        <span title="Defense">🛡 ${u.def}</span>
                        <span title="Speed">💨 ${Math.floor(getEffectiveSpd(u))}</span>
                    </div>
                    <div class="bar-label bar-label-hp">HP ${hpNow}/${hpMax}</div>
                    <div class="hp-bar" title="HP ${hpNow} / ${hpMax}">
                        <div class="hp-fill ${u.isEnemy ? 'enemy' : ''}" style="width:${hpPct}%"></div>
                    </div>
                    <div class="bar-label bar-label-tm">Turn ${Math.floor(Math.min(100, u.turnMeter))}%</div>
                    <div class="tm-bar" title="Turn meter ${Math.floor(u.turnMeter)}%">
                        <div class="tm-fill" style="width:${tmPct}%"></div>
                    </div>
                    <div class="unit-status">${buffIcons || '&nbsp;'}</div>
                </div>
            `;

            // Always bind click when targetable; also allow clicks on any living unit during player input
            // so a missed "targetable" class still routes through handler
            if (u.alive && combatState.phase === 'player_input') {
                div.style.cursor = isTargetable ? 'pointer' : 'default';
                div.onclick = (ev) => {
                    ev.stopPropagation();
                    onCombatUnitClick(u);
                };
            }
            el.appendChild(div);
        });
    };

    renderSide(combatState.enemies, enemiesEl, true);
    renderSide(combatState.allies, alliesEl, false);
    // Keep fuse UI in sync whenever the field redraws
    if (typeof updateCombatFuseDock === 'function' && combatState && isArenaFusionEnabled()) {
        updateCombatFuseDock(combatState.currentActor);
    }
}

// ==================== ARENA COMBAT FUSION ====================
function isArenaFusionEnabled() {
    if (!combatState) return false;
    if (combatState.allowArenaFusion) return true;
    if (combatState.theme === 'arena') return true;
    const t = String(combatState.battleTitle || '').toLowerCase();
    if (t.includes('arena')) return true;
    // DEV: fusion available in any fight so the button is testable immediately
    if (typeof DEV_MODE !== 'undefined' && DEV_MODE) return true;
    return false;
}

/** Ensure fuse dock + top-bar button exist (survives stale HTML cache). */
function ensureArenaFuseDom() {
    const modal = document.querySelector('#combatModal .combat-modal-content')
        || document.getElementById('combatModal');
    let dock = document.getElementById('combatFuseDock');
    if (!dock && modal) {
        dock = document.createElement('div');
        dock.id = 'combatFuseDock';
        dock.className = 'combat-fuse-dock';
        dock.setAttribute('aria-live', 'polite');
        dock.innerHTML = `
            <button type="button" id="combatFuseDockBtn" class="combat-fuse-dock-btn" disabled>
                <span class="fuse-dock-icon">🧬</span>
                <span class="fuse-dock-label">FUSE</span>
                <span class="fuse-dock-meta" id="combatFuseDockMeta">—</span>
            </button>
            <div id="combatFuseDockHint" class="combat-fuse-dock-hint">Arena Fusion</div>`;
        const arena = document.getElementById('combatArena');
        if (arena && arena.parentNode) arena.parentNode.insertBefore(dock, arena);
        else modal.appendChild(dock);
    }
    let topBtn = document.getElementById('combatTopFuseBtn');
    if (!topBtn) {
        const controls = document.querySelector('#combatModal .speed-controls');
        if (controls) {
            topBtn = document.createElement('button');
            topBtn.type = 'button';
            topBtn.id = 'combatTopFuseBtn';
            topBtn.className = 'combat-top-fuse-btn';
            topBtn.textContent = '🧬 FUSE';
            topBtn.onclick = onCombatTopFuseClick;
            controls.insertBefore(topBtn, controls.firstChild);
        }
    }
    return { dock, topBtn: document.getElementById('combatTopFuseBtn') };
}

function onCombatTopFuseClick() {
    if (!combatState || combatState.phase !== 'player_input') {
        log('Wait for your slime\'s turn, then press 🧬 FUSE.');
        return;
    }
    const actor = combatState.currentActor;
    if (!actor || actor.isEnemy) {
        log('Only your slimes can fuse.');
        return;
    }
    const blocked = getArenaFuseBlockedReason(actor);
    if (blocked) {
        log(blocked);
        return;
    }
    selectCombatSkill('arena_fuse');
}

/** Compatible if same rarity OR same element; both living ally slimes, not already fusion forms. */
function canArenaFusePair(a, b) {
    if (!a || !b || a.id === b.id) return false;
    if (a.isEnemy || b.isEnemy || a.isFoe || b.isFoe) return false;
    if (!a.alive || !b.alive) return false;
    if (a.arenaFused || b.arenaFused) return false;
    if (a.kind && a.kind !== 'slime') return false;
    if (b.kind && b.kind !== 'slime') return false;
    return a.rarity === b.rarity || a.element === b.element;
}

function getArenaFusePartners(actor) {
    if (!combatState || !actor || actor.isEnemy) return [];
    return combatState.allies.filter(u => canArenaFusePair(actor, u));
}

function getArenaFuseBlockedReason(actor) {
    if (!isArenaFusionEnabled()) return 'Fusion only works in Arena battles.';
    if (!actor || actor.isEnemy) return 'Only your slimes can fuse.';
    if (actor.arenaFused) return 'This slime is already a Fusion Form.';
    const living = (combatState.allies || []).filter(u => u.alive && u.id !== actor.id);
    if (living.length === 0) return 'Need another living ally on your team (bring 2+ slimes).';
    const partners = getArenaFusePartners(actor);
    if (partners.length === 0) {
        const others = living.map(u => `${u.name} (${u.rarity} ${u.element})`).join(', ');
        return `No match for ${actor.name} (${actor.rarity} ${actor.element}). Allies: ${others}. Need same rarity OR same element.`;
    }
    return '';
}

function getArenaFusionReason(a, b) {
    if (a.element === b.element && a.rarity === b.rarity) return 'element + rarity bond';
    if (a.element === b.element) return 'same element';
    if (a.rarity === b.rarity) return 'same rarity';
    return 'compatible';
}

function getFusionAuraColor(elA, elB) {
    const c = (typeof SKILL_VFX_COLORS !== 'undefined' && SKILL_VFX_COLORS) || {};
    return c[elA] || c[elB] || '#ffdd77';
}

/**
 * Mid-fight arena fusion: absorb partner into a cooler Fusion Form.
 * Permanent roster update (like management fuse) when both have sourceId.
 */
function performArenaFusion(primary, partner) {
    if (!combatState || !canArenaFusePair(primary, partner)) {
        log('Those slimes cannot fuse.');
        return false;
    }

    combatState.phase = 'animating';
    hideCombatActionBar();

    // Visual drama
    combatState.animAttacker = primary.id;
    combatState.animTarget = partner.id;
    setFighterAnim(primary.id, 'cast', 600);
    setFighterAnim(partner.id, 'heal', 600);
    combatCamera('ult', 900);
    playCombatSfx('ult');
    showSkillCallout(primary, {
        icon: '🧬',
        name: 'SLIME FUSION!',
        unique: true
    });
    addCombatLog(`🧬 ${primary.name} fuses with ${partner.name}! (${getArenaFusionReason(primary, partner)})`, 'buff');

    // FX burst on both
    spawnDamageNumber(primary.id, 'FUSE', 'status', { delay: 40 });
    spawnDamageNumber(partner.id, 'ABSORB', 'status', { delay: 80 });
    if (typeof playSkillCastVfx === 'function') {
        playSkillCastVfx(primary, 'heal', partner, { unique: true, target: 'ally', icon: '🧬', name: 'Fusion' });
    }

    setTimeout(() => {
        if (!combatState || combatState.done) return;

        const hpRatio = primary.maxHp > 0 ? primary.hp / primary.maxHp : 1;
        const partnerHp = Math.max(0, partner.hp);
        // Combat power stays a modest fusion bond bonus (visual bulk is separate)
        const sameEl = primary.element === partner.element;
        const sameRar = primary.rarity === partner.rarity;
        const powerBoost = 1.28 + (sameEl ? 0.12 : 0) + (sameRar ? 0.08 : 0);

        const fusionName = (typeof generateFusionName === 'function')
            ? generateFusionName(primary, partner)
            : (sameEl
                ? `${String(primary.name).replace(/\s*Ω.*$/i, '').trim()} Helix`
                : `${primary.element}/${partner.element} Dyad`);

        primary.name = fusionName.length > 26 ? fusionName.slice(0, 24) + '…' : fusionName;
        primary.arenaFused = true;
        primary.isChampion = true;
        // Visual-only bulk flag; combat gets modest bond boost
        primary.fusionMass = true;
        primary.fusionPartnerElement = partner.element;
        primary.fusionPartnerRole = partner.role || null;
        primary.power = Math.floor((primary.power || 100) * powerBoost + (partner.power || 0) * 0.35);
        primary.maxHp = Math.floor(primary.maxHp * powerBoost + partner.maxHp * 0.25);
        primary.hp = Math.min(primary.maxHp, Math.floor(primary.maxHp * hpRatio) + Math.floor(partnerHp * 0.3));
        primary.atk = Math.floor(primary.atk * powerBoost + partner.atk * 0.25);
        primary.def = Math.floor(primary.def * powerBoost + partner.def * 0.2);
        primary.spd = Math.floor((primary.spd + partner.spd) / 2 + 8);
        primary.critChance = Math.min(0.45, (primary.critChance || 0.12) + 0.06);
        primary.level = Math.max(primary.level || 1, partner.level || 1) + 2;
        primary.hasLifesteal = primary.hasLifesteal || partner.hasLifesteal;
        const auraA = getFusionAuraColor(primary.element, partner.element);
        const palB = (typeof SLIME_ICON_PALETTES !== 'undefined' && SLIME_ICON_PALETTES[partner.element])
            ? SLIME_ICON_PALETTES[partner.element]
            : null;
        primary.visual = {
            accessory: sameEl ? 'crown' : 'wing',
            aura: auraA,
            aura2: palB ? palB.accent : '#fff59d',
            partnerElement: partner.element,
            partnerBody: palB ? palB.body : null,
            partnerDark: palB ? palB.dark : null,
            glow: true,
            fusion: true,
            fusionMass: true,
            eyes: 'fierce',
            mythic: true
        };
        // Inherit a unique skill if partner had one
        const partnerSig = (partner.skills || []).find(s => SKILL_DEFS[s.id]?.unique);
        if (partnerSig && !(primary.skills || []).some(s => s.id === partnerSig.id)) {
            primary.skills = primary.skills || [];
            primary.skills.push({ id: partnerSig.id, level: partnerSig.level || 1 });
            primary.skillCds[partnerSig.id] = 0;
        }
        // Bonus active if missing splash for cool aoe form
        if (!(primary.skills || []).some(s => s.id === 'splash') && Math.random() < 0.55) {
            primary.skills.push({ id: 'splash', level: 1 });
            primary.skillCds.splash = 0;
        }

        // Partner absorbed
        partner.alive = false;
        partner.hp = 0;
        partner.animState = 'death';
        setFighterAnim(partner.id, 'death');
        flashCombatUnit(partner.id, 'death');
        spawnDamageNumber(primary.id, 'FUSION!', 'status', { delay: 20, big: true });
        setFighterAnim(primary.id, 'heal', 500);
        playCombatSfx('heal');
        combatCamera('punch', 400);

        // Permanent roster: fuse like management (remove partner, upgrade source)
        applyPermanentArenaFusion(primary, partner, powerBoost);

        combatState.animAttacker = null;
        combatState.animTarget = null;
        combatState.turn = (combatState.turn || 0) + 1;
        combatState.fusionCount = (combatState.fusionCount || 0) + 1;

        setTimeout(() => {
            if (!combatState || combatState.done) return;
            renderCombatUnits();
            setFighterAnim(primary.id, 'idle');
            // Fusion spends the turn
            combatState.phase = 'running';
            combatState.currentActor = null;
            combatState.pendingSkill = null;
            combatState.pendingFusion = false;
            setTimeout(combatLoop, getCombatDelay() * 0.5);
        }, Math.max(420, getCombatDelay() * 0.7));
    }, Math.max(480, getCombatDelay() * 0.75));

    return true;
}

function applyPermanentArenaFusion(primaryUnit, partnerUnit, powerBoost) {
    if (typeof game === 'undefined' || !game.slimes) return;
    const base = game.slimes.find(s => s.id === primaryUnit.sourceId);
    const sac = game.slimes.find(s => s.id === partnerUnit.sourceId);
    if (!base || !sac || base.id === sac.id) return;

    let synergy = powerBoost || 1.3;
    base.level = Math.max(base.level || 1, sac.level || 1) + 2;
    base.exp = 0;
    base.ascension = Math.max(base.ascension || 0, sac.ascension || 0);
    base.arenaFusionForm = true;
    base.fusionMass = true; // visual bulk only (art flag)
    base.visual = primaryUnit.visual ? { ...primaryUnit.visual } : base.visual;
    base.isChampion = base.isChampion || primaryUnit.isChampion;
    if (primaryUnit.championId) base.championId = primaryUnit.championId;
    base.name = primaryUnit.name;
    // Keep base element; store secondary for dual-body art
    base.fusionPartnerElement = sac.element;
    base.fusionPartnerRole = sac.role || null;
    if (typeof mergeFusionStats === 'function') mergeFusionStats(base, sac);
    if (typeof recalculateSlimePower === 'function') recalculateSlimePower(base);
    base.power = Math.floor((base.power || 1) * Math.min(synergy, 1.55));

    // Rarity bump chance on strong bonds
    if ((base.element === sac.element || base.rarity === sac.rarity) && Math.random() < 0.3) {
        const order = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
        const idx = order.indexOf(base.rarity);
        if (idx >= 0 && idx < order.length - 1) {
            base.rarity = order[idx + 1];
            primaryUnit.rarity = base.rarity;
            if (typeof recalculateSlimePower === 'function') recalculateSlimePower(base);
            base.power = Math.floor((base.power || 1) * 1.08);
            addCombatLog(`✨ Fusion evolves rarity → ${base.rarity}!`, 'buff');
        }
    }

    // Merge a skill
    const sacSkills = sac.skills || [];
    sacSkills.forEach(sk => {
        if (!(base.skills || []).some(x => x.id === sk.id)) {
            base.skills = base.skills || [];
            if (base.skills.length < 5) base.skills.push({ id: sk.id, level: sk.level || 1 });
        }
    });

    const sacIdx = game.slimes.findIndex(s => s.id === sac.id);
    if (sacIdx >= 0) game.slimes.splice(sacIdx, 1);
    game.totalFusions = (game.totalFusions || 0) + 1;
    if (typeof updateQuestProgress === 'function') updateQuestProgress('fuse', 1);
    if (typeof saveGame === 'function') saveGame();
}

function onCombatUnitClick(unit) {
    if (!combatState || combatState.phase !== 'player_input' || !combatState.pendingSkill) return;

    // Arena fusion: pick a compatible ally partner
    if (combatState.pendingSkill === 'arena_fuse') {
        const actor = combatState.currentActor;
        if (!actor || unit.isEnemy || unit.id === actor.id) {
            log('Pick a compatible ally to fuse with.');
            return;
        }
        if (!canArenaFusePair(actor, unit)) {
            log('Not compatible — need same rarity or same element.');
            return;
        }
        combatState.selectedTargetId = unit.id;
        performArenaFusion(actor, unit);
        return;
    }

    const skill = SKILL_DEFS[combatState.pendingSkill];
    if (!skill) return;

    const tgt = skill.target || 'enemy';
    if (tgt === 'enemy' && unit.isEnemy) {
        combatState.selectedTargetId = unit.id;
        executePlayerAction(combatState.pendingSkill, unit);
    } else if (tgt === 'ally' && !unit.isEnemy) {
        combatState.selectedTargetId = unit.id;
        executePlayerAction(combatState.pendingSkill, unit);
    } else if (tgt === 'all_enemies' && unit.isEnemy) {
        executePlayerAction(combatState.pendingSkill, unit);
    } else if (tgt === 'all_allies' && !unit.isEnemy) {
        executePlayerAction(combatState.pendingSkill, unit);
    }
}

/** Sync top-bar 🧬 FUSE + dock above the stage (always hard to miss). */
function updateCombatFuseDock(actor) {
    ensureArenaFuseDom();
    const dock = document.getElementById('combatFuseDock');
    const btn = document.getElementById('combatFuseDockBtn');
    const meta = document.getElementById('combatFuseDockMeta');
    const hint = document.getElementById('combatFuseDockHint');
    const topBtn = document.getElementById('combatTopFuseBtn');

    const enabled = !!(combatState && isArenaFusionEnabled());
    if (!enabled) {
        if (dock) {
            dock.hidden = true;
            dock.style.display = 'none';
            dock.classList.remove('is-visible', 'fuse-ready', 'fuse-picking');
        }
        if (topBtn) {
            topBtn.style.display = 'none';
            topBtn.disabled = true;
            topBtn.classList.remove('fuse-ready', 'selected');
        }
        return;
    }

    if (dock) {
        dock.hidden = false;
        dock.style.display = 'flex';
        dock.classList.add('is-visible');
    }
    if (topBtn) {
        topBtn.style.display = 'inline-flex';
        topBtn.style.visibility = 'visible';
    }

    const a = actor || (combatState && combatState.currentActor);
    const yourTurn = !!(combatState && combatState.phase === 'player_input' && a && !a.isEnemy);

    const applyDisabled = (disabled, picking, canFuse, blocked, partners) => {
        if (btn) {
            btn.disabled = disabled;
            btn.classList.toggle('selected', picking);
            btn.onclick = () => {
                if (disabled) {
                    log(blocked || 'Wait for your turn / need a fuse partner.');
                    return;
                }
                selectCombatSkill('arena_fuse');
            };
            btn.title = canFuse
                ? `Fuse with: ${(partners || []).map(p => p.name).join(', ')}`
                : (blocked || 'Fusion locked');
        }
        if (topBtn) {
            topBtn.disabled = disabled;
            topBtn.classList.toggle('selected', picking);
            topBtn.classList.toggle('fuse-ready', canFuse && !picking);
            topBtn.textContent = picking ? '🧬 CLICK ALLY' : (canFuse ? '🧬 FUSE' : '🧬 FUSE');
            topBtn.title = canFuse
                ? `Fuse with: ${(partners || []).map(p => p.name).join(', ')}`
                : (blocked || 'Fusion locked — need same element or rarity ally');
        }
        if (dock) {
            dock.classList.toggle('fuse-ready', canFuse && !picking);
            dock.classList.toggle('fuse-picking', picking);
        }
    };

    if (!yourTurn) {
        applyDisabled(true, false, false, 'Wait for your slime\'s turn', []);
        if (meta) meta.textContent = 'wait turn';
        if (hint) {
            hint.textContent = '🧬 FUSE is ON — when it\'s YOUR turn, this bar + the top-right 🧬 FUSE button light up. Need 2 allies same element or rarity.';
        }
        return;
    }

    const partners = (!a.arenaFused) ? getArenaFusePartners(a) : [];
    const blocked = getArenaFuseBlockedReason(a);
    const canFuse = partners.length > 0 && !blocked;
    const picking = combatState.pendingSkill === 'arena_fuse' && canFuse;

    applyDisabled(!canFuse, picking, canFuse, blocked, partners);

    if (meta) {
        meta.textContent = canFuse
            ? (picking ? 'click ally' : partners.length + ' ready')
            : 'locked';
    }
    if (hint) {
        if (picking) {
            hint.innerHTML = `<strong>Step 2:</strong> click glowing ally — ${partners.map(p => p.name).join(' or ')}`;
        } else if (canFuse) {
            hint.innerHTML = `<strong>${a.name}</strong> can fuse with ${partners.map(p =>
                `<b>${p.name}</b> (${getArenaFusionReason(a, p)})`
            ).join(' or ')}. Partner is absorbed permanently.`;
        } else {
            hint.textContent = blocked || 'Need another living ally (same element or rarity).';
        }
    }
}

function showCombatActionBar(actor) {
    const bar = document.getElementById('combatActionBar');
    const info = document.getElementById('combatActorInfo');
    const skillsEl = document.getElementById('combatSkillButtons');
    const hint = document.getElementById('combatTargetHint');
    if (!bar || !skillsEl) return;

    bar.style.display = 'block';
    if (info) {
        info.innerHTML = `${actor.iconHtml || ''} <strong>${actor.name}</strong>'s turn — pick a skill`;
    }
    if (hint) {
        hint.textContent = combatState.pendingSkill === 'arena_fuse'
            ? '🧬 Fusion: click a glowing ally (same rarity or element)'
            : combatState.pendingSkill
                ? `Selected: ${SKILL_DEFS[combatState.pendingSkill]?.name || ''} — click a target`
                : 'Choose Basic Attack or a skill, then click a target';
    }

    skillsEl.innerHTML = '';
    (actor.skills || [{ id: 'basic', level: 1 }]).forEach(s => {
        const def = SKILL_DEFS[s.id] || SKILL_DEFS.basic;
        if (def.type === 'passive') return;
        const cd = actor.skillCds[s.id] || 0;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'combat-skill-btn' + (combatState.pendingSkill === s.id ? ' selected' : '');
        btn.disabled = cd > 0;
        btn.innerHTML = `
            <span class="skill-icon">${def.icon}</span>
            <span class="skill-name">${def.name}</span>
            <span class="skill-meta">${cd > 0 ? 'CD ' + cd : (def.cooldown ? 'CD ' + def.cooldown : 'Ready')}</span>
        `;
        const cdNote = def.cooldown ? ` (CD ${def.cooldown})` : '';
        btn.title = (def.desc || def.name || '') + cdNote;
        btn.setAttribute('aria-label', `${def.name}: ${def.desc || ''}${cdNote}`);
        btn.onclick = () => selectCombatSkill(s.id);
        skillsEl.appendChild(btn);
    });

    // Arena fusion tips under skill bar (FUSE lives on top bar + dock only — no skill chip)
    let fuseInfo = document.getElementById('combatFuseInfo');
    if (!fuseInfo) {
        fuseInfo = document.createElement('div');
        fuseInfo.id = 'combatFuseInfo';
        fuseInfo.className = 'combat-fuse-info';
        bar.appendChild(fuseInfo);
    }

    if (isArenaFusionEnabled() && !actor.isEnemy) {
        const partners = (!actor.arenaFused) ? getArenaFusePartners(actor) : [];
        const blocked = getArenaFuseBlockedReason(actor);
        const canFuse = partners.length > 0 && !blocked;

        fuseInfo.style.display = 'block';
        if (combatState.pendingSkill === 'arena_fuse' && canFuse) {
            fuseInfo.innerHTML = `<strong>🧬 Step 2 — click a purple ally:</strong> ${partners.map(p =>
                `<span class="fuse-chip">${p.name} <em>${p.rarity} · ${p.element}</em></span>`
            ).join('')}`;
        } else if (canFuse) {
            fuseInfo.innerHTML = `<strong>🧬 Fusion ready!</strong> Use the purple <b>🧬 FUSE</b> button (top bar or dock above the stage), then click:
                ${partners.map(p =>
                    `<span class="fuse-chip">${p.name} <em>${getArenaFusionReason(actor, p)}</em></span>`
                ).join('')}`;
        } else {
            fuseInfo.innerHTML = `<strong>🧬 Fusion locked.</strong> ${blocked}
                <br><small>Tip: put 2 slimes of the same element (e.g. two Fire) or same rarity (e.g. two Rare) in your top team.</small>`;
        }
    } else if (fuseInfo) {
        fuseInfo.style.display = 'none';
    }

    updateCombatFuseDock(actor);

    // Ensure sticky action bar is on-screen if user scrolled deep into the stage
    try {
        bar.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (e) { /* ignore */ }
}

function hideCombatActionBar() {
    const bar = document.getElementById('combatActionBar');
    if (bar) bar.style.display = 'none';
    const fuseInfo = document.getElementById('combatFuseInfo');
    if (fuseInfo) fuseInfo.style.display = 'none';
    if (combatState) {
        combatState.pendingSkill = null;
        combatState.selectedTargetId = null;
        combatState.pendingFusion = false;
        // Keep dock visible during arena fight, just reset to wait state
        if (isArenaFusionEnabled()) updateCombatFuseDock(null);
        else {
            const dock = document.getElementById('combatFuseDock');
            if (dock) dock.style.display = 'none';
        }
    } else {
        const dock = document.getElementById('combatFuseDock');
        if (dock) dock.style.display = 'none';
    }
    const floor = document.querySelector('.battlefield-floor');
    if (floor) floor.classList.remove('targeting-enemies', 'targeting-allies');
}

function selectCombatSkill(skillId) {
    if (!combatState || combatState.phase !== 'player_input') return;
    const actor = combatState.currentActor;
    if (!actor || actor.isEnemy) return;

    if (skillId === 'arena_fuse') {
        const blocked = getArenaFuseBlockedReason(actor);
        if (blocked) {
            log(blocked);
            return;
        }
        const partners = getArenaFusePartners(actor);
        combatState.pendingSkill = 'arena_fuse';
        combatState.pendingFusion = true;
        const hint = document.getElementById('combatTargetHint');
        if (hint) {
            hint.textContent = `🧬 Fusion: click ${partners.map(p => p.name).join(' or ')}`;
        }
        log(`🧬 Fusion ready — click: ${partners.map(p => p.name).join(' or ')}`);
        showCombatActionBar(actor);
        renderCombatUnits();
        return;
    }

    if ((actor.skillCds[skillId] || 0) > 0) {
        log('Skill on cooldown');
        return;
    }
    combatState.pendingSkill = skillId;
    combatState.pendingFusion = false;
    const def = SKILL_DEFS[skillId] || SKILL_DEFS.basic;
    const hint = document.getElementById('combatTargetHint');
    if (hint) {
        if (def.target === 'all_enemies' || def.target === 'all_allies') {
            hint.textContent = `${def.name}: click any valid unit to confirm`;
        } else if (def.target === 'ally') {
            hint.textContent = `${def.name}: click an ally`;
        } else {
            hint.textContent = `${def.name}: click an enemy`;
        }
    }
    // Auto-cast if no single target needed? still need click for confirmation
    // For single enemy skills with only one target, auto-select
    const enemies = combatState.enemies.filter(u => u.alive);
    const allies = combatState.allies.filter(u => u.alive);
    if (def.target === 'enemy' && enemies.length === 1) {
        executePlayerAction(skillId, enemies[0]);
        return;
    }
    if (def.target === 'ally' && allies.length === 1) {
        executePlayerAction(skillId, allies[0]);
        return;
    }
    showCombatActionBar(actor);
    renderCombatUnits();
}

function executePlayerAction(skillId, targetUnit) {
    if (!combatState || combatState.phase !== 'player_input') return;
    const actor = combatState.currentActor;
    if (!actor || !actor.alive) return;
    hideCombatActionBar();
    combatState.phase = 'animating';
    performCombatAction(actor, skillId, targetUnit);
}

function aiPickSkill(actor) {
    const ready = (actor.skills || []).filter(s => {
        const def = SKILL_DEFS[s.id];
        return def && def.type === 'active' && s.id !== 'basic' && (actor.skillCds[s.id] || 0) <= 0;
    });
    // Prefer heal if ally low
    if (!actor.isEnemy) {
        const hurt = combatState.allies.filter(u => u.alive && u.hp / u.maxHp < 0.45);
        const healSkill = ready.find(s => s.id === 'heal');
        if (hurt.length && healSkill && Math.random() < 0.7) return healSkill.id;
    }
    if (ready.length && Math.random() < 0.45) {
        return ready[Math.floor(Math.random() * ready.length)].id;
    }
    return 'basic';
}

function aiPickTarget(actor, skillId) {
    const def = SKILL_DEFS[skillId] || SKILL_DEFS.basic;
    if (def.target === 'ally' || def.target === 'all_allies') {
        const allies = (actor.isEnemy ? combatState.enemies : combatState.allies).filter(u => u.alive);
        if (skillId === 'heal') allies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
        return allies[0] || null;
    }
    const foes = (actor.isEnemy ? combatState.allies : combatState.enemies).filter(u => u.alive);
    if (!foes.length) return null;
    // Prefer low HP for finishers
    foes.sort((a, b) => a.hp - b.hp);
    if (Math.random() < 0.55) return foes[0];
    return foes[Math.floor(Math.random() * foes.length)];
}

function aiTakeTurn(actor) {
    if (!combatState || combatState.done || !actor || !actor.alive) {
        setTimeout(combatLoop, getCombatDelay() * 0.4);
        return;
    }
    const skillId = aiPickSkill(actor);
    const target = aiPickTarget(actor, skillId);
    if (!target && (SKILL_DEFS[skillId]?.target === 'enemy' || SKILL_DEFS[skillId]?.target === 'ally')) {
        setTimeout(combatLoop, getCombatDelay() * 0.3);
        return;
    }
    combatState.phase = 'animating';
    performCombatAction(actor, skillId, target);
}

function performCombatAction(actor, skillId, targetUnit) {
    if (!combatState || combatState.done) return;
    const def = SKILL_DEFS[skillId] || SKILL_DEFS.basic;
    const delay = getCombatDelay();
    const isSupport = def.target === 'ally' || def.target === 'all_allies' || skillId === 'heal' || skillId === 'shield' || skillId === 'haste';
    const isUlt = !!def.unique || def.target === 'all_enemies';

    // set CD
    if (def.cooldown > 0) actor.skillCds[skillId] = def.cooldown;

    combatState.animAttacker = actor.id;
    if (targetUnit) combatState.animTarget = targetUnit.id;
    combatState.phase = 'animating';
    actor.animState = 'cast';
    renderCombatUnits();

    // Level A: cast pose · Level C: camera + sfx · Tier 2: colored VFX
    setFighterAnim(actor.id, 'cast', Math.max(400, delay * 0.7));
    flashCombatUnit(actor.id, 'cast');
    showSkillCallout(actor, def);
    combatCamera(isUlt ? 'ult' : 'focus', Math.max(480, delay * 0.85));
    playCombatSfx(isUlt ? 'ult' : 'cast');
    playCombatSfx('whoosh');
    requestAnimationFrame(() => playSkillCastVfx(actor, skillId, targetUnit, def));
    addCombatLog(`${actor.name} uses ${def.icon} ${def.name}!`, 'skill-hit');

    // Wind-up → attack pose → impact + resolve → settle
    setTimeout(() => {
        if (!combatState || combatState.done) return;

        if (isSupport) {
            setFighterAnim(actor.id, 'heal', Math.max(350, delay * 0.5));
            playCombatSfx(skillId === 'shield' || def.teamShield ? 'shield' : 'heal');
        } else {
            setFighterAnim(actor.id, 'attack', Math.max(380, delay * 0.55));
            playCombatSfx('whoosh');
        }

        // Mark targets as hit before resolve so flash reads
        const markHit = (u) => {
            if (!u || !u.alive) return;
            combatState.animTarget = u.id;
            setFighterAnim(u.id, isSupport ? 'heal' : 'hit', Math.max(400, delay * 0.6));
            flashCombatUnit(u.id, isSupport ? 'heal' : 'hit');
        };
        if (def.target === 'all_enemies') {
            (actor.isEnemy ? combatState.allies : combatState.enemies).filter(u => u.alive).forEach(markHit);
        } else if (def.target === 'all_allies') {
            (actor.isEnemy ? combatState.enemies : combatState.allies).filter(u => u.alive).forEach(markHit);
        } else if (targetUnit) {
            markHit(targetUnit);
        }

        setTimeout(() => {
            if (!combatState || combatState.done) return;
            playSkillImpactVfx(actor, skillId, targetUnit, def);
            const beforeAlive = new Set(
                [...combatState.allies, ...combatState.enemies].filter(u => u.alive).map(u => u.id)
            );
            resolveSkillEffect(actor, skillId, targetUnit);
            updateCombatBarsSoft();
            combatState.turn++;

            // Death poses + crit camera
            [...combatState.allies, ...combatState.enemies].forEach(u => {
                if (beforeAlive.has(u.id) && !u.alive) {
                    setFighterAnim(u.id, 'death');
                    playCombatSfx('death');
                    combatCamera('punch', 380);
                }
            });

            setTimeout(() => {
                if (!combatState || combatState.done) return;
                combatState.animAttacker = null;
                combatState.animTarget = null;
                if (actor.alive && actor.animState !== 'death') actor.animState = 'idle';
                renderCombatUnits();
                // re-apply death poses after full re-render
                [...combatState.allies, ...combatState.enemies].forEach(u => {
                    if (!u.alive) setFighterAnim(u.id, 'death');
                    else if (u.animState && u.animState !== 'idle') setFighterAnim(u.id, u.animState);
                });

                if (combatState.allies.every(u => !u.alive)) { endCombat(false); return; }
                if (combatState.enemies.every(u => !u.alive)) { endCombat(true); return; }

                combatState.phase = 'running';
                combatState.currentActor = null;
                combatState.pendingSkill = null;
                combatCamera('rest', 0);
                setTimeout(combatLoop, delay * 0.4);
            }, Math.max(320, delay * 0.6));
        }, Math.max(100, delay * 0.22));
    }, Math.max(240, delay * 0.48));
}

function resolveSkillEffect(actor, skillId, targetUnit) {
    const def = SKILL_DEFS[skillId] || SKILL_DEFS.basic;
    const mult = def.mult != null ? def.mult : 1;
    const allySide = () => (actor.isEnemy ? combatState.enemies : combatState.allies).filter(u => u.alive);
    const foeSide = () => (actor.isEnemy ? combatState.allies : combatState.enemies).filter(u => u.alive);

    let hitIndex = 0;

    const applyHeal = (t, amount, opts = {}) => {
        if (!t || !t.alive || amount <= 0) return 0;
        const before = t.hp;
        t.hp = Math.min(t.maxHp, t.hp + amount);
        const actual = Math.max(0, t.hp - before);
        if (actual > 0) {
            actor.healingDone = (actor.healingDone || 0) + actual;
            t.healingReceived = (t.healingReceived || 0) + actual;
            const i = hitIndex++;
            spawnDamageNumber(t.id, actual, 'heal', {
                delay: opts.delay != null ? opts.delay : i * 55,
                offsetIndex: i,
                big: actual >= t.maxHp * 0.15
            });
            flashCombatUnit(t.id, 'heal');
            setFighterAnim(t.id, 'heal', 450);
            if (i === 0) playCombatSfx('heal');
        }
        return actual;
    };

    const applyDmg = (t, amount, opts = {}) => {
        if (!t || !t.alive) return 0;
        const reduced = Math.max(1, amount - Math.floor(getEffectiveDef(t) * 0.3));
        const wasAlive = t.alive;
        t.hp -= reduced;
        const killed = t.hp <= 0;
        if (killed) { t.hp = 0; t.alive = false; addCombatLog(`${t.name} is defeated!`, 'debuff'); }
        actor.damageDealt = (actor.damageDealt || 0) + reduced;
        t.damageTaken = (t.damageTaken || 0) + reduced;
        game.totalDamageDealt = (game.totalDamageDealt || 0) + reduced;

        const isCrit = !!opts.crit;
        const i = hitIndex++;
        spawnDamageNumber(t.id, reduced, isCrit ? 'crit' : 'dmg', {
            delay: opts.delay != null ? opts.delay : i * 70,
            offsetIndex: i,
            big: isCrit || reduced >= (t.maxHp * 0.25)
        });
        flashCombatUnit(t.id, isCrit ? 'crit' : 'hit');
        playCombatSfx(isCrit ? 'crit' : 'hit');
        if (isCrit) combatCamera('punch', 320);
        if (isCrit || reduced >= t.maxHp * 0.3) shakeCombatArena(isCrit ? 'hard' : 'med');
        if (killed && wasAlive) {
            setTimeout(() => {
                flashCombatUnit(t.id, 'death');
                setFighterAnim(t.id, 'death');
            }, 80);
            spawnDamageNumber(t.id, 'DEFEATED', 'status', { delay: 120 + i * 40, offsetIndex: i + 2 });
        }

        if (actor.hasLifesteal) {
            const heal = Math.max(1, Math.floor(reduced * 0.08));
            applyHeal(actor, heal, { delay: 90 + i * 40 });
        }
        return reduced;
    };

    const applyPostDamageExtras = (hitTargets) => {
        if (def.healSelfPct) {
            const h = applyHeal(actor, Math.floor(actor.maxHp * def.healSelfPct));
            if (h) addCombatLog(`${actor.name} recovers ${h}`, 'buff');
        }
        if (def.selfShield) {
            actor.buffs.push({ id: 'shield', turns: 2, defMul: 1.25, icon: '🛡️' });
            addCombatLog(`${actor.name} gains a shield!`, 'buff');
            spawnDamageNumber(actor.id, 'SHIELD', 'status', { delay: 60 });
            flashCombatUnit(actor.id, 'heal');
        }
        if (def.teamHaste) {
            allySide().forEach(t => {
                t.buffs.push({ id: 'haste', turns: 2, spdMul: 1.15, icon: '⚡' });
                spawnDamageNumber(t.id, 'HASTE', 'status', { delay: 40 });
            });
            addCombatLog(`Team gains haste!`, 'buff');
        }
        if (def.teamShield) {
            allySide().forEach(t => {
                t.buffs.push({ id: 'shield', turns: 2, defMul: 1.25, icon: '🛡️' });
                spawnDamageNumber(t.id, 'SHIELD', 'status', { delay: 50 });
                flashCombatUnit(t.id, 'heal');
            });
            addCombatLog(`Team gains shields!`, 'buff');
        }
        if (def.teamHealPct) {
            allySide().forEach(t => {
                const h = applyHeal(t, Math.floor(t.maxHp * def.teamHealPct));
                if (h) addCombatLog(`${t.name} heals ${h}`, 'buff');
            });
        }
        if (def.healLowestAllyPct) {
            const allies = allySide().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
            if (allies[0]) {
                const h = applyHeal(allies[0], Math.floor(allies[0].maxHp * def.healLowestAllyPct));
                if (h) addCombatLog(`${allies[0].name} heals ${h}`, 'buff');
            }
        }
        if (def.applyPoison) {
            (hitTargets || []).forEach(t => {
                if (t && t.alive) {
                    t.debuffs.push({ id: 'poison', turns: 2, dotPct: 0.06, icon: '☠️' });
                    addCombatLog(`${t.name} is poisoned!`, 'debuff');
                }
            });
        }
    };

    // Team-only support skills (no damage)
    if (def.target === 'all_allies' || skillId === 'haste' || skillId === 'iron_bulwark' || skillId === 'royal_aegis') {
        if (skillId === 'haste' || def.teamHaste) {
            allySide().forEach(t => t.buffs.push({ id: 'haste', turns: 2, spdMul: 1.15, icon: '⚡' }));
            if (skillId === 'haste') addCombatLog(`Team gains Slime Rush!`, 'buff');
        }
        if (def.teamShield || skillId === 'iron_bulwark') {
            allySide().forEach(t => t.buffs.push({ id: 'shield', turns: 2, defMul: 1.25, icon: '🛡️' }));
            addCombatLog(`Team gains Iron Bulwark!`, 'buff');
        }
        if (def.teamHealPct) {
            allySide().forEach(t => {
                const h = applyHeal(t, Math.floor(t.maxHp * def.teamHealPct));
                if (h) addCombatLog(`${t.name} heals ${h}`, 'buff');
            });
        }
        // Avoid double-applying if we already handled above for unique team skills
        if (skillId === 'haste' || def.target === 'all_allies') return;
    }

    if (def.target === 'all_enemies') {
        const foes = foeSide();
        const hit = [];
        foes.forEach((t, i) => {
            let dmg = Math.max(1, Math.floor(actor.atk * mult * (0.9 + Math.random() * 0.2)));
            dmg = Math.floor(dmg * getAdvantageMultiplier(actor.element, t.element));
            const isCrit = Math.random() < (actor.critChance || 0.12);
            if (isCrit) dmg = Math.floor(dmg * (actor.critDmg || 1.25));
            const d = applyDmg(t, dmg, { crit: isCrit, delay: i * 90 });
            hit.push(t);
            addCombatLog(`${t.name} takes ${d}${isCrit ? ' CRIT' : ''}`, isCrit ? 'crit' : '');
        });
        if (foes.length >= 2) shakeCombatArena('med');
        applyPostDamageExtras(hit);
        return;
    }

    if (skillId === 'heal') {
        const allies = allySide();
        const t = targetUnit && targetUnit.alive ? targetUnit : allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (t) {
            const heal = Math.floor(t.maxHp * 0.22);
            const actual = applyHeal(t, heal);
            addCombatLog(`${t.name} heals ${actual}`, 'buff');
        }
        return;
    }

    if (skillId === 'shield') {
        const allies = allySide();
        const t = targetUnit && targetUnit.alive ? targetUnit : allies[0];
        if (t) {
            t.buffs.push({ id: 'shield', turns: 2, defMul: 1.25, icon: '🛡️' });
            addCombatLog(`${t.name} gains Gel Shield!`, 'buff');
            spawnDamageNumber(t.id, 'SHIELD', 'status');
            flashCombatUnit(t.id, 'heal');
        }
        return;
    }

    // Single-target damage (basic, inferno, poison, unique sigs, etc.)
    const foes = foeSide();
    const t = targetUnit && targetUnit.alive ? targetUnit : foes[0];
    if (!t) {
        // Pure support unique with mult 0 already handled; exit safely
        applyPostDamageExtras([]);
        return;
    }

    let dmg = Math.max(1, Math.floor(actor.atk * mult * (0.88 + Math.random() * 0.24)));
    const elemMult = getAdvantageMultiplier(actor.element, t.element);
    dmg = Math.floor(dmg * elemMult);
    const isCrit = Math.random() < (actor.critChance || 0.12);
    if (isCrit) dmg = Math.floor(dmg * (actor.critDmg || 1.25));

    combatState.animTarget = t.id;
    const d = applyDmg(t, dmg, { crit: isCrit });
    const elemNote = elemMult > 1 ? ' (strong!)' : elemMult < 1 ? ' (resisted)' : '';
    addCombatLog(`${actor.name} → ${t.name}: ${d} dmg${elemNote}${isCrit ? ' CRIT!' : ''}`, isCrit ? 'crit' : '');
    if (isCrit) {
        spawnDamageNumber(t.id, 'CRIT!', 'status', { delay: 40, offsetIndex: 3, y: -28 });
    }
    if (elemMult > 1) {
        spawnDamageNumber(t.id, 'WEAK', 'status', { delay: 70, offsetIndex: 4, y: -18 });
    } else if (elemMult < 1) {
        spawnDamageNumber(t.id, 'RESIST', 'status', { delay: 70, offsetIndex: 4, y: -18 });
    }

    if (skillId === 'poison' && t.alive) {
        t.debuffs.push({ id: 'poison', turns: 2, dotPct: 0.06, icon: '☠️' });
        addCombatLog(`${t.name} is poisoned!`, 'debuff');
        spawnDamageNumber(t.id, 'POISON', 'status', { delay: 140, offsetIndex: 5 });
    }

    applyPostDamageExtras([t]);
}

/** When true, next fight's end stats merge into lastCombatStats (multi-wave dungeon/boss). */
let pendingAccumulateStats = false;

/** Graphics Tier 1 — scenic arena themes (CSS layers). */
const COMBAT_ARENA_THEMES = {
    verdant:   { label: '🌲 Verdant Wilds',    field: 'VERDANT WILDS' },
    peaks:     { label: '⛰️ Shadowed Peaks',   field: 'SHADOWED PEAKS' },
    murk:      { label: '🏛️ Murk & Ruins',     field: 'MURK & RUINS' },
    scorched:  { label: '🌋 Scorched Frontiers', field: 'SCORCHED FRONT' },
    celestial: { label: '✨ Celestial Depths', field: 'CELESTIAL DEPTHS' },
    dungeon:   { label: '🗺️ Dungeon',         field: 'DUNGEON DEPTHS' },
    arena:     { label: '⚔️ Arena',            field: 'ARENA FLOOR' },
    void:      { label: '🕳️ Void Tower',       field: 'VOID SPIRE' },
    boss:      { label: '👹 Boss Lair',        field: 'BOSS LAIR' },
    faction:   { label: '🏴 Faction War',      field: 'WAR CAMP' },
    default:   { label: 'Battle',              field: 'BATTLEFIELD' }
};

function resolveCombatThemeId(options = {}, title = '') {
    if (options.theme && COMBAT_ARENA_THEMES[options.theme]) return options.theme;
    if (options.chapterId) {
        const map = { 1: 'verdant', 2: 'peaks', 3: 'murk', 4: 'scorched', 5: 'celestial' };
        if (map[options.chapterId]) return map[options.chapterId];
    }
    const t = String(title || '').toLowerCase();
    if (t.includes('void')) return 'void';
    if (t.includes('arena')) return 'arena';
    if (t.includes('faction')) return 'faction';
    if (t.includes('boss') || t.includes('👹')) return 'boss';
    if (t.includes('wave') || t.includes('dungeon')) return 'dungeon';
    if (t.includes('verdant') || t.includes('forest') || t.includes('1-')) return 'verdant';
    if (t.includes('peak') || t.includes('2-')) return 'peaks';
    if (t.includes('murk') || t.includes('ruin') || t.includes('3-')) return 'murk';
    if (t.includes('scorch') || t.includes('ash') || t.includes('4-')) return 'scorched';
    if (t.includes('celestial') || t.includes('abyss') || t.includes('5-')) return 'celestial';
    return 'default';
}

function setCombatArenaTheme(themeId) {
    const arena = document.getElementById('combatArena');
    const theme = COMBAT_ARENA_THEMES[themeId] ? themeId : 'default';
    if (arena) {
        arena.setAttribute('data-theme', theme);
        arena.classList.remove('arena-intro', 'cam-focus', 'cam-punch', 'cam-ult', 'cam-slow');
        void arena.offsetWidth;
        arena.classList.add('arena-intro', 'cam-rest');
        setTimeout(() => arena.classList.remove('arena-intro'), 700);
    }
    const field = document.getElementById('combatFieldLabel');
    if (field) {
        const meta = COMBAT_ARENA_THEMES[theme] || COMBAT_ARENA_THEMES.default;
        field.textContent = `⚡ ${meta.field} ⚡`;
    }
    const props = document.getElementById('arenaProps');
    if (props) props.innerHTML = buildArenaPropsHTML(theme);
    spawnArenaAmbience(theme);
    // Warm audio context on fight start (needs user gesture; combat click usually qualifies)
    try { ensureCombatAudio(); } catch (e) {}
    updateCombatSfxButton();
    return theme;
}

/** Ambient motes + drifting clouds for the scenic stage. */
function spawnArenaAmbience(themeId) {
    const host = document.getElementById('arenaParticles');
    if (host) {
        host.innerHTML = '';
        const count = themeId === 'void' || themeId === 'celestial' ? 18
            : themeId === 'scorched' ? 14
            : themeId === 'verdant' ? 12 : 11;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('span');
            p.className = 'arena-mote' + (themeId === 'scorched' ? ' mote-ember' : '')
                + (themeId === 'peaks' ? ' mote-snow' : '')
                + (themeId === 'void' || themeId === 'celestial' ? ' mote-star' : '');
            p.style.left = (3 + Math.random() * 94) + '%';
            p.style.top = (6 + Math.random() * 55) + '%';
            p.style.animationDelay = (Math.random() * 5).toFixed(2) + 's';
            p.style.animationDuration = (4.5 + Math.random() * 7).toFixed(2) + 's';
            host.appendChild(p);
        }
    }
    const clouds = document.getElementById('arenaClouds');
    if (clouds) {
        clouds.innerHTML = '';
        const showClouds = !['dungeon', 'void', 'boss'].includes(themeId);
        if (showClouds) {
            for (let i = 0; i < 4; i++) {
                const c = document.createElement('div');
                c.className = 'arena-cloud c' + (i + 1);
                c.style.top = (6 + i * 7 + Math.random() * 4) + '%';
                c.style.animationDuration = (28 + i * 8 + Math.random() * 10) + 's';
                c.style.animationDelay = (-i * 7) + 's';
                c.style.opacity = (0.25 + Math.random() * 0.25).toFixed(2);
                clouds.appendChild(c);
            }
        }
    }
}

/**
 * @param {object[]} allies
 * @param {object[]} enemies
 * @param {string} title
 * @param {function} onComplete
 * @param {object} [options] — { theme, chapterId }
 */
function runCombat(allies, enemies, title, onComplete, options = {}) {
    // Clear any stuck timers conceptually
    const accumulate = pendingAccumulateStats;
    pendingAccumulateStats = false;
    const themeHint = resolveCombatThemeId(options, title);
    combatState = {
        allies: allies.map(s => buildCombatUnit(s, false)),
        enemies: enemies.map(s => buildCombatUnit(s, true)),
        turn: 0,
        animAttacker: null,
        animTarget: null,
        done: false,
        auto: false, // default MANUAL for Raid feel
        phase: 'running',
        currentActor: null,
        pendingSkill: null,
        selectedTargetId: null,
        accumulateStats: accumulate,
        theme: null,
        allowArenaFusion: !!options.allowArenaFusion
            || themeHint === 'arena'
            || (typeof DEV_MODE !== 'undefined' && DEV_MODE),
        battleTitle: title || '',
        fusionCount: 0,
        pendingFusion: false
    };
    combatState.allies.forEach(u => { u.animState = 'idle'; });
    combatState.enemies.forEach(u => { u.animState = 'idle'; });

    const synergy = getFactionSynergyMultiplier(allies);
    combatState.allies.forEach(u => { u.atk = Math.floor(u.atk * synergy); });

    const theme = setCombatArenaTheme(resolveCombatThemeId(options, title));
    combatState.theme = theme;
    if (theme === 'arena') combatState.allowArenaFusion = true;

    document.getElementById('combatTitle').textContent = title || '⚔️ Stage Battle';
    const logEl = document.getElementById('combatLog');
    if (logEl) logEl.innerHTML = '';
    clearCombatFx();
    document.getElementById('combatCloseBtn').style.display = 'none';
    document.getElementById('combatModal').style.display = 'flex';
    hideCombatActionBar();
    updateCombatAutoButton();
    updateCombatSfxButton();
    const themeMeta = COMBAT_ARENA_THEMES[theme] || COMBAT_ARENA_THEMES.default;
    setCombatBanner(`${themeMeta.label} — Battle start!`);
    setCombatSpeed(game.combatSpeed || 1);

    addCombatLog(`⚔️ Entered ${themeMeta.label}!`, 'buff');
    if (synergy > 1) addCombatLog(`Faction synergy: +${Math.round((synergy - 1) * 100)}% ATK`, 'buff');
    addCombatLog(`Watch the stage — damage & heals float over fighters.`, 'buff');
    if (isArenaFusionEnabled()) {
        const living = combatState.allies.filter(u => u.alive);
        addCombatLog(`🧬 Arena Fusion ON — purple FUSE bar sits ABOVE the stage!`, 'buff');
        setCombatBanner(`🧬 Arena Fusion ready — watch for the purple FUSE bar above the stage`);
        if (living.length < 2) {
            addCombatLog(`🧬 Need 2+ slimes on your team to fuse (you have ${living.length}).`, 'debuff');
        } else {
            // Pre-scan any compatible pairs so the tip is concrete
            let pairTip = '';
            for (let i = 0; i < living.length && !pairTip; i++) {
                for (let j = i + 1; j < living.length; j++) {
                    if (canArenaFusePair(living[i], living[j])) {
                        pairTip = `${living[i].name} ↔ ${living[j].name} (${getArenaFusionReason(living[i], living[j])})`;
                    }
                }
            }
            if (pairTip) addCombatLog(`🧬 Ready pair: ${pairTip}`, 'buff');
            else addCombatLog(`🧬 No pair yet — team needs same element or same rarity.`, 'debuff');
        }
        updateCombatFuseDock(null);
    } else {
        const dock = document.getElementById('combatFuseDock');
        if (dock) dock.style.display = 'none';
    }

    // Force Manual mode in Arena so players can use Fuse
    if (isArenaFusionEnabled()) {
        combatState.auto = false;
        updateCombatAutoButton();
    }

    combatResolve = onComplete;
    renderCombatUnits();
    setTimeout(combatLoop, 500);
}

function combatLoop() {
    if (!combatState || combatState.done) return;
    if (combatState.phase === 'player_input' || combatState.phase === 'animating') return;

    if (combatState.allies.every(u => !u.alive)) { endCombat(false); return; }
    if (combatState.enemies.every(u => !u.alive)) { endCombat(true); return; }

    // Advance turn meters
    const living = [...combatState.allies, ...combatState.enemies].filter(u => u.alive);
    living.forEach(u => { u.turnMeter += getEffectiveSpd(u) * 0.18; });
    living.sort((a, b) => b.turnMeter - a.turnMeter);

    // Need someone at 100+ meter, else keep filling
    let actor = living.find(u => u.turnMeter >= 100);
    if (!actor) {
        // scale so someone reaches soon
        const top = living[0];
        if (top) {
            const need = 100 - top.turnMeter;
            living.forEach(u => { u.turnMeter += need; });
            actor = living[0];
        }
    }
    if (!actor) { setTimeout(combatLoop, getCombatDelay()); return; }

    actor.turnMeter = Math.max(0, actor.turnMeter - 100);
    tickUnitBuffs(actor);
    if (!actor.alive) {
        renderCombatUnits();
        setTimeout(combatLoop, getCombatDelay() * 0.4);
        return;
    }

    combatState.currentActor = actor;
    combatState.pendingSkill = null;
    combatState.selectedTargetId = null;
    renderCombatUnits();
    setCombatBanner(actor.isEnemy ? `Enemy: ${actor.name}` : `Your turn: ${actor.name}`, actor.isEnemy ? 'enemy-turn' : 'ally-turn');

    if (actor.isEnemy || combatState.auto) {
        combatState.phase = 'running';
        hideCombatActionBar();
        if (isArenaFusionEnabled()) updateCombatFuseDock(null);
        setTimeout(() => aiTakeTurn(actor), getCombatDelay() * 0.45);
    } else {
        combatState.phase = 'player_input';
        combatState.pendingSkill = 'basic';
        showCombatActionBar(actor);
        renderCombatUnits();
    }
}

function endCombat(victory) {
    if (!combatState) return;
    combatState.done = true;
    combatState.phase = 'done';
    hideCombatActionBar();
    setCombatBanner(victory ? '🎉 VICTORY!' : '💀 DEFEAT', victory ? 'victory' : 'defeat');
    addCombatLog(victory ? '🎉 VICTORY!' : '💀 Defeat...', victory ? 'buff' : 'debuff');
    const closeBtn = document.getElementById('combatCloseBtn');
    if (closeBtn) closeBtn.style.display = 'none'; // rewards modal handles continue
    playCombatSfx(victory ? 'victory' : 'defeat');
    combatCamera(victory ? 'focus' : 'punch', 900);
    renderCombatUnits();
    [...combatState.allies, ...combatState.enemies].forEach(u => {
        if (!u.alive) setFighterAnim(u.id, 'death');
    });

    const combatStats = collectCombatStats();
    // Multi-wave: accumulate when caller set flag before next wave
    if (combatState.accumulateStats && lastCombatStats) {
        lastCombatStats = mergeCombatStats(lastCombatStats, combatStats);
    } else {
        lastCombatStats = combatStats;
    }

    const stats = {
        turns: combatState.turn,
        alliesDefeated: combatState.allies.filter(u => !u.alive).length,
        alliesAlive: combatState.allies.filter(u => u.alive).length,
        title: document.getElementById('combatTitle')?.textContent || 'Battle',
        combatStats: lastCombatStats
    };
    if (combatResolve) {
        const cb = combatResolve;
        combatResolve = null;
        setTimeout(() => cb(victory, stats), 80);
    } else if (!victory) {
        // No callback — still show a simple result
        setTimeout(() => {
            showBattleResultModal({
                victory: false,
                title: 'Defeat',
                subtitle: 'Your team was overwhelmed. Level up and try again!',
                lines: [],
                combatStats: lastCombatStats
            });
        }, 200);
    }
}

function closeCombatModal() {
    const modal = document.getElementById('combatModal');
    if (modal) modal.style.display = 'none';
    const dock = document.getElementById('combatFuseDock');
    if (dock) {
        dock.style.display = 'none';
        dock.hidden = true;
        dock.classList.remove('is-visible');
    }
    const topBtn = document.getElementById('combatTopFuseBtn');
    if (topBtn) topBtn.style.display = 'none';
    hideCombatActionBar();
    combatState = null;
}

/**
 * Build a regional / world foe (human, beast, spirit…) for combat.
 * Not a collectible slime — your team is still made of slimes.
 */
function createFoeEnemy(template, power, opts = {}) {
    const def = template || {};
    const role = def.role || 'striker';
    const skillIds = (FOE_ROLE_SKILLS && FOE_ROLE_SKILLS[role]) || FOE_ROLE_SKILLS?.striker || ['basic'];
    const el = opts.element || def.element || 'Earth';
    // Guard against typos in foe data (must be a real combat element)
    const element = (typeof elements !== 'undefined' && elements.includes(el))
        ? el
        : (elements?.[0] || 'Earth');
    const rarity = opts.rarity || 'Common';
    const level = opts.level != null ? opts.level : Math.max(1, Math.floor(8 + power / 55));
    const icon = def.icon || '⚔️';
    const foe = {
        id: 'foe_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
        name: opts.name || def.name || 'Hostile',
        element,
        faction: (typeof ELEMENT_FACTION !== 'undefined' && ELEMENT_FACTION[element]) || 'Forest',
        rarity,
        level,
        exp: 0,
        power: Math.max(8, Math.floor(power)),
        isFoe: true,
        isEnemyCreature: true,
        kind: def.kind || 'beast',
        role,
        enemyIcon: icon,
        iconHtml: `<span class="enemy-creature-icon" title="${def.kind || 'foe'}">${icon}</span>`,
        speed: def.speed || (90 + Math.floor(Math.random() * 40) + (role === 'assassin' ? 15 : 0) - (role === 'tank' ? 10 : 0)),
        artifacts: {},
        skills: skillIds.filter(id => id !== 'basic').map(id => ({ id, level: 1 })),
        ascension: 0,
        evolved: false
    };
    return foe;
}

function pickFoeTemplate(pool, preferredElement = null) {
    const list = pool && pool.length ? pool : (WORLD_FOE_POOL || []);
    if (!list.length) {
        return { name: 'Hostile', icon: '⚔️', element: preferredElement || 'Earth', role: 'striker', kind: 'human' };
    }
    if (preferredElement) {
        const match = list.filter(f => f.element === preferredElement);
        if (match.length) return match[Math.floor(Math.random() * match.length)];
        // Related elements from chart
        const related = [];
        if (typeof ELEMENT_CHART !== 'undefined' && ELEMENT_CHART[preferredElement]) {
            const ch = ELEMENT_CHART[preferredElement];
            [...(ch.strong || []), ...(ch.weak || [])].forEach(el => {
                list.filter(f => f.element === el).forEach(f => related.push(f));
            });
        }
        if (related.length) return related[Math.floor(Math.random() * related.length)];
    }
    return list[Math.floor(Math.random() * list.length)];
}

/** World foes for arena / dungeon / tower — regional creatures & people, not wild slimes. */
function generateEnemyTeam(power, count, element = null) {
    const enemies = [];
    const usedNames = {};
    const pool = WORLD_FOE_POOL || [];
    for (let i = 0; i < count; i++) {
        const rarity = power > 900 ? 'Legendary' : power > 550 ? 'Epic' : power > 280 ? 'Rare' : power > 140 ? 'Uncommon' : 'Common';
        const tmpl = pickFoeTemplate(pool, element);
        const share = Math.floor(power / count * (0.85 + Math.random() * 0.3));
        const e = createFoeEnemy(tmpl, share, {
            rarity,
            level: Math.max(1, Math.floor(8 + power / 55)),
            element: element || tmpl.element
        });
        usedNames[e.name] = (usedNames[e.name] || 0) + 1;
        if (usedNames[e.name] > 1) e.name = `${e.name} ${usedNames[e.name]}`;
        enemies.push(e);
    }
    return enemies;
}

