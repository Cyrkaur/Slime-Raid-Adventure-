/* ===== js/systems/management.js — split from Single File/index-3.html ===== */

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

    filtered.forEach((slime, idx) => {
        const div = document.createElement('div');
        const roleLabel = (typeof formatSlimeRole === 'function' && slime.role)
            ? formatSlimeRole(slime.role)
            : (slime.role || '');
        const champ = !!(slime.isChampion || slime.championId);
        div.className = `mgmt-row rarity-${slime.rarity}`
            + (champ ? ' is-champ' : '')
            + (slime.favorite ? ' is-fav' : '')
            + (slime.locked ? ' is-locked' : '');
        div.style.animationDelay = (Math.min(idx, 20) * 0.03) + 's';

        const selected = managementSelectedSlimes.includes(slime.id);
        let traitsHTML = '';
        if (slime.traits?.length) {
            traitsHTML = `<div class="mgmt-traits">${slime.traits.map(t => TRAIT_DEFINITIONS[t]?.name || t).join(' · ')}</div>`;
        }

        div.innerHTML = `
            <div class="mgmt-row-sheen" aria-hidden="true"></div>
            <label class="mgmt-main" onclick="openSlimeDetail(${slime.id})">
                <input type="checkbox" ${selected ? 'checked' : ''} onclick="event.stopPropagation(); toggleManagementSelect(${slime.id}, this.checked)">
                <div class="mgmt-portrait">${getSlimeIconHTML(slime, 'md')}</div>
                <div class="mgmt-info">
                    <div class="mgmt-name">
                        ${slime.favorite ? '<span class="mgmt-star">⭐</span>' : ''}
                        <strong>${slime.name}</strong>
                        ${champ ? '<span class="mgmt-champ-tag">★</span>' : ''}
                        <span class="asc-badge">★${slime.ascension || 0}</span>
                    </div>
                    <div class="mgmt-meta">
                        <span class="tag-pill tag-element">${slime.element || '?'}</span>
                        ${roleLabel ? `<span class="tag-pill tag-role role-${slime.role}">${roleLabel}</span>` : ''}
                        <span class="mgmt-rarity" style="color:${getRarityColor(slime.rarity)}">${slime.rarity}</span>
                        <span class="mgmt-lv">Lv${slime.level}</span>
                        <span class="mgmt-pwr">${slime.power} PWR</span>
                    </div>
                    ${traitsHTML}
                </div>
            </label>
            <button class="mgmt-lock-btn" onclick="event.stopPropagation(); toggleLockFromManagement(${game.slimes.indexOf(slime)}); filterSlimeList();">
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

