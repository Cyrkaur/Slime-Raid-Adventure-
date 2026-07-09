/* ===== js/systems/summon.js — split from Single File/index-3.html ===== */

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

function isSummonModalOpen() {
    const modal = document.getElementById('summonModal');
    if (!modal) return false;
    const d = modal.style.display;
    if (d === 'none') return false;
    if (d === 'flex') return true;
    // class-based open state (preferred)
    return modal.classList.contains('is-open');
}

function showSummonResults(slimes) {
    const modal = document.getElementById('summonModal');
    const container = document.getElementById('summonResults');
    if (!modal || !container) return;
    container.innerHTML = '';

    // Sparkle field for ceremony
    const sparks = document.getElementById('summonSparkles');
    if (sparks) {
        sparks.innerHTML = '';
        for (let i = 0; i < 18; i++) {
            const s = document.createElement('span');
            s.className = 'summon-spark';
            s.style.left = Math.random() * 100 + '%';
            s.style.top = Math.random() * 100 + '%';
            s.style.animationDelay = (Math.random() * 1.2) + 's';
            s.style.animationDuration = (1.2 + Math.random() * 1.5) + 's';
            sparks.appendChild(s);
        }
    }

    const best = slimes.reduce((a, b) =>
        ((RARITY_ORDER[b.rarity] || 0) > (RARITY_ORDER[a.rarity] || 0) ? b : a), slimes[0]);
    modal.classList.toggle('summon-epic-pull', (RARITY_ORDER[best?.rarity] || 0) >= 4);
    modal.classList.toggle('summon-mythic-pull', best?.rarity === 'Mythic');

    slimes.forEach((s, idx) => {
        const card = document.createElement('div');
        const champ = s.isChampion || s.championId;
        const roleLabel = (typeof formatSlimeRole === 'function' && s.role) ? formatSlimeRole(s.role) : '';
        card.className = `summon-reveal rarity-${s.rarity}${champ ? ' summon-champion' : ''}`;
        card.style.animationDelay = `${0.15 + idx * 0.14}s`;
        const sig = (s.skills || []).map(sk => SKILL_DEFS[sk.id]).find(d => d && d.unique);
        card.innerHTML = `
            <div class="summon-card-glow" aria-hidden="true"></div>
            <div class="summon-portrait">${getSlimeIconHTML(s, 'xl')}</div>
            <div class="summon-name">${s.name}</div>
            <div class="summon-rarity" style="color:${getRarityColor(s.rarity)}">${s.rarity}${champ ? ' ★ Champion' : ''}</div>
            <div class="summon-tags">
                <span class="tag-pill tag-element">${s.element}</span>
                ${roleLabel ? `<span class="tag-pill tag-role role-${s.role}">${roleLabel}</span>` : ''}
            </div>
            <div class="summon-sub">${s.faction || ''}${s.species ? ' · ' + s.species : ''}</div>
            ${sig ? `<div class="summon-sig">${sig.icon} ${sig.name}</div>` : ''}`;
        container.appendChild(card);
    });

    // Open: flex shell + class; body scroll locked
    modal.style.display = 'flex';
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');

    // Reset scroll so first cards are visible; footer stays pinned via CSS
    requestAnimationFrame(() => {
        const scroller = modal.querySelector('.summon-results-scroll');
        if (scroller) scroller.scrollTop = 0;
        // Focus Continue so Enter/space also dismiss
        const cont = modal.querySelector('.summon-continue-btn');
        if (cont && typeof cont.focus === 'function') {
            try { cont.focus({ preventScroll: true }); } catch (e) { cont.focus(); }
        }
    });
    if (typeof playCombatSfx === 'function' && (RARITY_ORDER[best?.rarity] || 0) >= 4) {
        try { playCombatSfx('ult'); } catch (e) { /* optional */ }
    }
}

function closeSummonModal() {
    const modal = document.getElementById('summonModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('is-open', 'summon-epic-pull', 'summon-mythic-pull');
    }
    document.body.classList.remove('modal-open');
    const sparks = document.getElementById('summonSparkles');
    if (sparks) sparks.innerHTML = '';
    if (typeof updateUI === 'function') updateUI();
}

// Always expose for inline/legacy handlers
window.closeSummonModal = closeSummonModal;
window.showSummonResults = showSummonResults;

// Capture-phase close: backdrop, ✕, Continue (data-summon-close)
// Uses capture so nothing inside can swallow the click before we handle it
document.addEventListener('click', (e) => {
    if (!isSummonModalOpen()) return;
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-summon-close]')) {
        e.preventDefault();
        e.stopPropagation();
        closeSummonModal();
    }
}, true);

// Escape always closes summon when open
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!isSummonModalOpen()) return;
    e.preventDefault();
    closeSummonModal();
}, true);

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

