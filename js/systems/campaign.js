/* ===== js/systems/campaign.js — split from Single File/index-3.html ===== */

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
            card.className = 'chapter-card ch-theme-' + ch.id
                + (unlocked ? '' : ' locked')
                + (c.selectedChapter === ch.id ? ' active-chapter' : '');
            card.onclick = () => { if (unlocked) { c.selectedChapter = ch.id; renderCampaign(); } };
            card.innerHTML = `
                <div class="ch-art" aria-hidden="true">
                    <div class="ch-art-sky"></div>
                    <div class="ch-art-mid"></div>
                    <div class="ch-art-fog"></div>
                    <div class="ch-icon">${ch.icon}</div>
                </div>
                <div class="ch-body">
                    <div class="ch-kicker">Chapter ${ch.id}</div>
                    <div class="ch-title">${ch.name}</div>
                    <div class="ch-story">${unlocked ? ch.story : `🔒 Lv ${ch.playerLevel}+ & Ch.${ch.unlockChapter || 0} boss`}</div>
                    <div class="ch-progress"><span>${chStars}/${chMax} ★</span><span>${chPct}%</span></div>
                    <div class="ch-bar"><div class="ch-bar-fill" style="width:${chPct}%"></div></div>
                </div>
            `;
            scroll.appendChild(card);
        });
    }

    const selCh = CAMPAIGN_CHAPTERS.find(ch => ch.id === c.selectedChapter) || CAMPAIGN_CHAPTERS[0];
    const titleEl = document.getElementById('selectedChapterTitle');
    if (titleEl) {
        titleEl.innerHTML = `<span class="sel-ch-ico">${selCh.icon}</span> Chapter ${selCh.id}: ${selCh.name}`;
    }
    const vista = document.getElementById('campaignVista');
    if (vista) {
        vista.className = 'campaign-vista ch-theme-' + selCh.id;
        vista.innerHTML = `
            <div class="vista-sky"></div>
            <div class="vista-mid"></div>
            <div class="vista-fog"></div>
            <div class="vista-content">
                <div class="vista-icon">${selCh.icon}</div>
                <div>
                    <div class="vista-kicker">Now exploring</div>
                    <div class="vista-title">${selCh.name}</div>
                    <div class="vista-story">${selCh.story || ''}</div>
                </div>
            </div>
        `;
    }

    const grid = document.getElementById('stageGrid');
    const currentSt = getCurrentCampaignStage();
    if (grid) {
        grid.innerHTML = '';
        selCh.stages.forEach((st, idx) => {
            const prog = getStageProgress(st.id, mode);
            const unlocked = isStageUnlocked(st, selCh);
            const isCurrent = currentSt && currentSt.id === st.id;
            const card = document.createElement('div');
            const el = st.element || 'Nature';
            card.className = 'stage-card'
                + (st.isBoss ? ' boss-stage' : '')
                + (unlocked ? '' : ' locked')
                + (prog.stars >= 1 ? ' cleared' : '')
                + (isCurrent ? ' available' : '')
                + ' el-' + String(el).toLowerCase().replace(/[^a-z]/g, '');
            card.style.animationDelay = (idx * 0.03) + 's';
            card.onclick = () => { if (unlocked) openCampaignStageModal(st, selCh); };
            card.innerHTML = `
                <div class="stage-sheen" aria-hidden="true"></div>
                <div class="stage-num">${st.label}${st.isBoss ? ' <span class="boss-badge">BOSS</span>' : ''}</div>
                <div class="stage-name">${st.name}</div>
                <div class="stage-meta">
                    <span class="stage-chip">⚡${st.energy}</span>
                    <span class="stage-chip">💪${st.power}</span>
                    <span class="stage-chip stage-el">${el}</span>
                </div>
                <div class="stage-stars">${getCampaignStarDisplay(prog.stars)}</div>
            `;
            grid.appendChild(card);
        });
    }

    updateCampaignDefaultTeamDisplay();

    // Side-scroll idle patrol follows selected chapter theme + team
    if (typeof syncIdleMarchFromCampaign === 'function') syncIdleMarchFromCampaign();
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
    // Battle result modal shows EXP — no bottom toast spam
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
    const usedNames = {};
    const pool = (typeof REGION_FOE_POOLS !== 'undefined' && REGION_FOE_POOLS[stage.chapterId])
        || (typeof WORLD_FOE_POOL !== 'undefined' && WORLD_FOE_POOL)
        || [];

    for (let i = 0; i < count; i++) {
        const isMainBoss = stage.isBoss && i === count - 1;
        const rarity = stage.isBoss
            ? (mode === 'nightmare' ? 'Legendary' : mode === 'hard' ? 'Epic' : 'Rare')
            : (power > 350 ? 'Epic' : power > 180 ? 'Rare' : power > 90 ? 'Uncommon' : 'Common');
        const share = Math.floor(power / count * (0.9 + Math.random() * 0.2));
        const level = Math.max(1, Math.floor(power / 40));

        let tmpl;
        if (isMainBoss && typeof REGION_BOSS_FOES !== 'undefined' && REGION_BOSS_FOES[stage.chapterId]) {
            tmpl = { ...REGION_BOSS_FOES[stage.chapterId] };
            // Keep stage title as the boss name (e.g. Guardian of the Green)
            tmpl.name = stage.name || tmpl.name;
            if (elem) tmpl.element = elem;
        } else {
            tmpl = (typeof pickFoeTemplate === 'function')
                ? pickFoeTemplate(pool, elem)
                : (pool[i % pool.length] || { name: 'Hostile', icon: '⚔️', element: elem || 'Earth', role: 'striker', kind: 'human' });
        }

        const e = (typeof createFoeEnemy === 'function')
            ? createFoeEnemy(tmpl, share, {
                rarity,
                level,
                name: isMainBoss ? (stage.name || tmpl.name) : undefined,
                element: isMainBoss ? (elem || tmpl.element) : (tmpl.element || elem)
            })
            : (() => {
                // Fallback if combat.js not loaded yet
                const s = createSlimeFromRoll(rarity, tmpl.element || elem);
                s.name = tmpl.name;
                s.iconHtml = `<span class="enemy-creature-icon">${tmpl.icon || '⚔️'}</span>`;
                s.isFoe = true;
                return s;
            })();

        usedNames[e.name] = (usedNames[e.name] || 0) + 1;
        if (!isMainBoss && usedNames[e.name] > 1) {
            e.name = `${e.name} ${usedNames[e.name]}`;
        }

        // Tutorial stages: softer so starter 1v1 is winnable
        if (stage.chapterId === 1 && stage.num <= 3) {
            e.power = Math.max(10, Math.floor(e.power * (stage.num === 1 ? 0.72 : 0.85)));
            e.level = 1;
        }
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
    let divine = 0;

    if (firstClear && !isSweep) {
        gold = Math.floor(gold * 1.8);
        shards += 3 + stage.chapterId;
        if (stage.isBoss) {
            shards += 8;
            divine = 1 + Math.floor(stage.chapterId / 2);
            game.resources.divineShards = (game.resources.divineShards || 0) + divine;
        }
    }
    if (stars === 3 && !isSweep) shards += 2;

    game.resources.gold = (game.resources.gold || 0) + gold;
    game.resources.slimeShards = (game.resources.slimeShards || 0) + shards;
    gainPlayerExp(exp);

    const resChance = stage.exploreDiff === 'Easy' ? 0.6 : stage.exploreDiff === 'Medium' ? 0.72 : 0.82;
    const drops = []; // { icon, label, amount? }
    if (Math.random() < resChance) {
        const n = 2 + Math.floor(Math.random() * 2);
        game.resources.wood = (game.resources.wood || 0) + n;
        drops.push({ icon: '🪵', label: 'Wood', amount: n });
    }
    if (Math.random() < resChance * 0.8) {
        game.resources.jelly = (game.resources.jelly || 0) + 1;
        drops.push({ icon: '🫐', label: 'Jelly', amount: 1 });
    }
    if (Math.random() < resChance * 0.5) {
        game.resources.herbs = (game.resources.herbs || 0) + 1;
        drops.push({ icon: '🌿', label: 'Herbs', amount: 1 });
    }
    if (stage.exploreDiff === 'Hard' || stage.exploreDiff === 'Extreme') {
        if (Math.random() < 0.4) {
            game.resources.crystal = (game.resources.crystal || 0) + 1;
            drops.push({ icon: '💎', label: 'Crystal', amount: 1 });
        }
        if (Math.random() < 0.25) {
            game.resources.arcaneDust = (game.resources.arcaneDust || 0) + 1;
            drops.push({ icon: '✨', label: 'Arcane Dust', amount: 1 });
        }
    }
    const tamed = [];
    if (Math.random() < stage.slimeChance && !isSweep) {
        const slime = generateRandomSlime(stage.exploreDiff);
        game.slimes.push(slime);
        game.lifetimeSlimesTamed = (game.lifetimeSlimesTamed || 0) + 1;
        tamed.push(slime);
    }
    if (Math.random() < 0.08 * stage.chapterId && !isSweep) {
        const art = generateArtifact(stage.chapterId >= 4 ? 'rare' : 'uncommon');
        game.artifacts.push(art);
        drops.push({ icon: '⚔️', label: `${art.rarity || 'Artifact'} Gear`, amount: 1 });
    }

    return { gold, shards, exp, divine, drops, tamed, firstClear, stars, isSweep };
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
            game.battleElixirActive = false;
            showBattleResultModal({
                victory: false,
                title: 'Defeat',
                subtitle: `${stage.label} ${stage.name} — your team fell. Train up and try again!`,
                stars: 0,
                lines: [
                    { icon: '⚔️', label: 'Turns fought', amount: stats?.turns || 0 }
                ],
                combatStats: stats?.combatStats || (typeof getLastCombatStats === 'function' ? getLastCombatStats() : null)
            });
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
        const slimeExpRows = grantCampaignSlimeExp(participants, stage, stars, false) || [];
        updateQuestProgress('explore', 1);
        game.battleElixirActive = false;

        const lines = [
            { icon: '🪙', label: 'Gold', amount: rewards.gold },
            { icon: '🔮', label: 'Slime Shards', amount: rewards.shards },
            { icon: '⭐', label: 'Player EXP', amount: rewards.exp }
        ];
        if (rewards.divine) lines.push({ icon: '✨', label: 'Divine Shards', amount: rewards.divine });
        slimeExpRows.forEach(r => {
            lines.push({ icon: '🧪', label: `${r.name} EXP`, amount: r.exp });
        });
        (rewards.drops || []).forEach(d => {
            if (typeof d === 'string') lines.push({ icon: '📦', label: d, amount: 1 });
            else lines.push(d);
        });

        showBattleResultModal({
            victory: true,
            title: 'Victory!',
            subtitle: `${stage.label} ${stage.name}`,
            stars,
            firstClear: rewards.firstClear,
            lines,
            tamed: rewards.tamed || [],
            combatStats: stats?.combatStats || (typeof getLastCombatStats === 'function' ? getLastCombatStats() : null)
        });

        renderCampaign();
        updateDungeonLocks();
        updateBossLocks();
        updateUI();
    }, { chapterId: stage.chapterId });
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
    const slimeExpRows = grantCampaignSlimeExp(liveTeam, stage, 3, true) || [];
    updateQuestProgress('explore', 1);

    const lines = [
        { icon: '🪙', label: 'Gold', amount: rewards.gold },
        { icon: '🔮', label: 'Slime Shards', amount: rewards.shards },
        { icon: '⭐', label: 'Player EXP', amount: rewards.exp }
    ];
    slimeExpRows.forEach(r => lines.push({ icon: '🧪', label: `${r.name} EXP`, amount: r.exp }));
    (rewards.drops || []).forEach(d => {
        if (typeof d === 'string') lines.push({ icon: '📦', label: d, amount: 1 });
        else lines.push(d);
    });

    showBattleResultModal({
        victory: true,
        title: 'Stage Swept!',
        subtitle: `🌀 ${stage.label} ${stage.name}`,
        stars: 3,
        lines,
        tamed: rewards.tamed || []
    });

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

