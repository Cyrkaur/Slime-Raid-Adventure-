/* ===== js/ui.js — split from Single File/index-3.html ===== */

// ==================== LOG FUNCTION ====================
// Minor tips stay as bottom toasts; battle rewards use showBattleResultModal (center).
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

/**
 * Raid-style centered battle/result popup.
 * options: {
 *   victory, title, subtitle, stars, firstClear,
 *   lines: [{ icon, label, amount }],
 *   tamed: [slime objects],
 *   combatStats: { allies, enemies, totals }  // Raid post-battle bars
 *   onClose: fn
 * }
 */
function formatCombatStatNum(n) {
    n = Math.floor(n || 0);
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}

function renderBattleStatBars(unit, maxes) {
    const rows = [
        { key: 'damageDealt', label: 'DMG', cls: 'stat-dmg' },
        { key: 'damageTaken', label: 'TAKEN', cls: 'stat-taken' },
        { key: 'healingDone', label: 'HEAL', cls: 'stat-heal' },
        { key: 'healingReceived', label: 'HEAL R', cls: 'stat-healr' }
    ];
    return rows.map(r => {
        const val = unit[r.key] || 0;
        const max = maxes[r.key] || 1;
        const pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
        return `
            <div class="br-stat-row">
                <span class="br-stat-label ${r.cls}">${r.label}</span>
                <div class="br-stat-track">
                    <div class="br-stat-fill ${r.cls}" style="width:${pct}%"></div>
                </div>
                <span class="br-stat-val">${formatCombatStatNum(val)}</span>
            </div>
        `;
    }).join('');
}

function renderBattleStatsPanel(combatStats) {
    if (!combatStats || (!combatStats.allies?.length && !combatStats.enemies?.length)) {
        return '';
    }
    const all = [...(combatStats.allies || []), ...(combatStats.enemies || [])];
    const maxes = {
        damageDealt: Math.max(1, ...all.map(u => u.damageDealt || 0)),
        damageTaken: Math.max(1, ...all.map(u => u.damageTaken || 0)),
        healingDone: Math.max(1, ...all.map(u => u.healingDone || 0)),
        healingReceived: Math.max(1, ...all.map(u => u.healingReceived || 0))
    };

    const renderSide = (units, sideLabel, sideCls, totals) => {
        const sorted = [...(units || [])].sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));
        const unitHtml = sorted.map(u => {
            const deadCls = u.alive === false ? ' br-stat-unit-dead' : '';
            return `
                <div class="br-stat-unit${deadCls}">
                    <div class="br-stat-unit-head">
                        <div class="br-stat-unit-icon">${u.iconHtml || '🫧'}</div>
                        <div class="br-stat-unit-meta">
                            <div class="br-stat-unit-name">${u.name || 'Slime'}</div>
                            <div class="br-stat-unit-el">${u.element || ''}${u.alive === false ? ' · KO' : ''}</div>
                        </div>
                    </div>
                    <div class="br-stat-bars">
                        ${renderBattleStatBars(u, maxes)}
                    </div>
                </div>
            `;
        }).join('') || '<div class="br-stat-empty">—</div>';

        const tot = totals || {};
        return `
            <div class="br-stat-side ${sideCls}">
                <div class="br-stat-side-title">${sideLabel}</div>
                <div class="br-stat-team-totals">
                    <span title="Damage Dealt"><b class="stat-dmg">${formatCombatStatNum(tot.dmg)}</b> DMG</span>
                    <span title="Damage Taken"><b class="stat-taken">${formatCombatStatNum(tot.taken)}</b> TAKEN</span>
                    <span title="Healing Done"><b class="stat-heal">${formatCombatStatNum(tot.heal)}</b> HEAL</span>
                </div>
                <div class="br-stat-units">${unitHtml}</div>
            </div>
        `;
    };

    const t = combatStats.totals || {};
    return `
        <div class="br-stats">
            <div class="br-stats-header">📊 Battle Statistics</div>
            <div class="br-stats-legend">
                <span class="stat-dmg">■ Damage</span>
                <span class="stat-taken">■ Taken</span>
                <span class="stat-heal">■ Healing</span>
                <span class="stat-healr">■ Heal Rcvd</span>
            </div>
            <div class="br-stats-grid">
                ${renderSide(combatStats.allies, 'Your Team', 'ally-side', {
                    dmg: t.allyDamageDealt,
                    taken: t.allyDamageTaken,
                    heal: t.allyHealingDone
                })}
                ${renderSide(combatStats.enemies, 'Enemy Team', 'enemy-side', {
                    dmg: t.enemyDamageDealt,
                    taken: t.enemyDamageTaken,
                    heal: t.enemyHealingDone
                })}
            </div>
        </div>
    `;
}

function showBattleResultModal(options = {}) {
    const {
        victory = true,
        title = victory ? 'Victory!' : 'Defeat',
        subtitle = '',
        stars = 0,
        firstClear = false,
        lines = [],
        tamed = [],
        onClose = null
    } = options;

    // Only show bars when this result came from a real fight (callers pass combatStats).
    // Do not auto-read lastCombatStats — sweeps / non-combat rewards must stay clean.
    const combatStats = options.combatStats || null;

    // Close combat stage UI first so rewards take the spotlight
    if (typeof closeCombatModal === 'function') {
        try { closeCombatModal(); } catch (e) {}
    }

    let modal = document.getElementById('battleResultModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'battleResultModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content battle-result-modal">
                <div class="br-glow"></div>
                <div id="brTitle" class="br-title"></div>
                <div id="brStars" class="br-stars"></div>
                <div id="brSubtitle" class="br-subtitle"></div>
                <div id="brBadge" class="br-badge" style="display:none;"></div>
                <div id="brRewards" class="br-rewards"></div>
                <div id="brTamed" class="br-tamed"></div>
                <div id="brStats" class="br-stats-wrap"></div>
                <button id="brContinueBtn" class="br-continue-btn" type="button">Continue</button>
            </div>
        `;
        document.body.appendChild(modal);
    } else if (!document.getElementById('brStats')) {
        const btn = document.getElementById('brContinueBtn');
        const statsWrap = document.createElement('div');
        statsWrap.id = 'brStats';
        statsWrap.className = 'br-stats-wrap';
        if (btn && btn.parentNode) btn.parentNode.insertBefore(statsWrap, btn);
        else modal.querySelector('.modal-content')?.appendChild(statsWrap);
    }

    const titleEl = document.getElementById('brTitle');
    const starsEl = document.getElementById('brStars');
    const subEl = document.getElementById('brSubtitle');
    const badgeEl = document.getElementById('brBadge');
    const rewardsEl = document.getElementById('brRewards');
    const tamedEl = document.getElementById('brTamed');
    const statsEl = document.getElementById('brStats');
    const btn = document.getElementById('brContinueBtn');
    const content = modal.querySelector('.battle-result-modal') || modal.querySelector('.modal-content');

    titleEl.textContent = title;
    titleEl.className = 'br-title ' + (victory ? 'br-win' : 'br-lose');
    subEl.textContent = subtitle || '';

    if (content) {
        content.classList.toggle('br-has-stats', !!(combatStats && (combatStats.allies?.length || combatStats.enemies?.length)));
    }

    if (victory && stars > 0) {
        starsEl.innerHTML = [1, 2, 3].map(i =>
            `<span class="br-star ${i <= stars ? 'lit' : ''}">★</span>`
        ).join('');
        starsEl.style.display = 'flex';
    } else {
        starsEl.innerHTML = '';
        starsEl.style.display = 'none';
    }

    if (firstClear && victory) {
        badgeEl.style.display = 'inline-block';
        badgeEl.textContent = '✨ FIRST CLEAR BONUS';
    } else {
        badgeEl.style.display = 'none';
    }

    rewardsEl.innerHTML = '';
    if (lines.length === 0 && victory && !combatStats) {
        rewardsEl.innerHTML = '<div class="br-empty">No extra loot this time.</div>';
    } else {
        lines.forEach((line, idx) => {
            const card = document.createElement('div');
            card.className = 'br-reward-card';
            card.style.animationDelay = `${idx * 0.06}s`;
            const amt = line.amount != null ? line.amount : '';
            card.innerHTML = `
                <div class="br-reward-icon">${line.icon || '🎁'}</div>
                <div class="br-reward-label">${line.label || ''}</div>
                <div class="br-reward-amt">${amt !== '' ? (typeof amt === 'number' && amt > 0 ? '+' + amt : amt) : ''}</div>
            `;
            rewardsEl.appendChild(card);
        });
    }

    tamedEl.innerHTML = '';
    if (tamed && tamed.length) {
        const header = document.createElement('div');
        header.className = 'br-tamed-header';
        header.textContent = '🐾 Slimes Tamed!';
        tamedEl.appendChild(header);
        const row = document.createElement('div');
        row.className = 'br-tamed-row';
        tamed.forEach(slime => {
            const card = document.createElement('div');
            card.className = 'br-tamed-card';
            const icon = (typeof getSlimeIconHTML === 'function')
                ? getSlimeIconHTML(slime, 'lg', false)
                : '🫧';
            const col = (typeof getRarityColor === 'function') ? getRarityColor(slime.rarity) : '#aaff99';
            card.innerHTML = `
                <div class="br-tamed-icon">${icon}</div>
                <div class="br-tamed-name">${slime.name}</div>
                <div class="br-tamed-meta" style="color:${col}">${slime.rarity} ${slime.element}</div>
                <div class="br-tamed-pwr">${slime.power || 0} PWR</div>
            `;
            row.appendChild(card);
        });
        tamedEl.appendChild(row);
    }

    if (statsEl) {
        statsEl.innerHTML = renderBattleStatsPanel(combatStats);
    }
    // Consume so sweep / next non-combat popup doesn't reuse stale bars
    if (typeof clearLastCombatStats === 'function') clearLastCombatStats();

    btn.onclick = () => {
        modal.style.display = 'none';
        if (typeof onClose === 'function') onClose();
        if (typeof updateUI === 'function') updateUI();
    };

    modal.style.display = 'flex';
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

/** Soft Tensura / anime-slime palettes — bright body, gentle dark, glossy shine */
const SLIME_ICON_PALETTES = {
    Water:    { body: '#5eb8f6', dark: '#1e88e5', shine: '#e3f7ff', accent: '#81d4fa', blush: '#ffab91' },
    Fire:     { body: '#ff8a65', dark: '#e64a19', shine: '#ffe0d6', accent: '#ffab91', blush: '#ff8a80' },
    Earth:    { body: '#a1887f', dark: '#6d4c41', shine: '#efebe9', accent: '#bcaaa4', blush: '#ef9a9a' },
    Wind:     { body: '#9ccc65', dark: '#7cb342', shine: '#f1f8e9', accent: '#c5e1a5', blush: '#ffab91' },
    Plant:    { body: '#81c784', dark: '#43a047', shine: '#e8f5e9', accent: '#a5d6a7', blush: '#ffab91' },
    Lightning:{ body: '#ffd54f', dark: '#ffb300', shine: '#fffde7', accent: '#ffecb3', blush: '#ffab91' },
    Ice:      { body: '#80deea', dark: '#26c6da', shine: '#e0f7fa', accent: '#b2ebf2', blush: '#f8bbd0' },
    Shadow:   { body: '#7986cb', dark: '#5c6bc0', shine: '#e8eaf6', accent: '#9fa8da', blush: '#ce93d8' },
    Light:    { body: '#fff59d', dark: '#fbc02d', shine: '#fffde7', accent: '#fff9c4', blush: '#ffccbc' },
    Metal:    { body: '#b0bec5', dark: '#78909c', shine: '#eceff1', accent: '#cfd8dc', blush: '#b0bec5' },
    Poison:   { body: '#ce93d8', dark: '#ab47bc', shine: '#f3e5f5', accent: '#e1bee7', blush: '#f48fb1' },
    Crystal:  { body: '#b39ddb', dark: '#7e57c2', shine: '#ede7f6', accent: '#d1c4e9', blush: '#f8bbd0' },
    Lava:     { body: '#ff7043', dark: '#e64a19', shine: '#ffccbc', accent: '#ff8a65', blush: '#ff8a80' },
    Storm:    { body: '#90a4ae', dark: '#546e7a', shine: '#eceff1', accent: '#b0bec5', blush: '#90caf9' },
    Spirit:   { body: '#ce93d8', dark: '#9575cd', shine: '#f3e5f5', accent: '#e1bee7', blush: '#f8bbd0' },
    Void:     { body: '#78909c', dark: '#455a64', shine: '#cfd8dc', accent: '#90a4ae', blush: '#b39ddb' }
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

function getChampionAccessorySvg(accessory, aura) {
    const c = aura || '#ffdd77';
    switch (accessory) {
        case 'crown':
            return `<path d="M8 10 l3-5 3 3 3-4 3 4 3-3 3 5 -18 0z" fill="${c}" stroke="#5d4037" stroke-width="0.5"/>
                    <circle cx="11" cy="7" r="1" fill="#fff59d"/><circle cx="16" cy="5" r="1.1" fill="#fff"/><circle cx="21" cy="7" r="1" fill="#fff59d"/>`;
        case 'tiara':
            return `<path d="M9 11 Q16 4 23 11" fill="none" stroke="${c}" stroke-width="1.4"/>
                    <circle cx="16" cy="6" r="1.3" fill="#fffde7"/>`;
        case 'helm':
            return `<path d="M9 12 Q16 5 23 12 L22 15 H10 Z" fill="${c}" opacity="0.9" stroke="#37474f" stroke-width="0.5"/>
                    <rect x="13" y="11" width="6" height="2" fill="#263238" opacity="0.5"/>`;
        case 'hood':
            return `<path d="M8 14 Q16 4 24 14 L22 12 Q16 7 10 12 Z" fill="${c}" opacity="0.75"/>`;
        case 'halo':
            return `<ellipse cx="16" cy="6" rx="7" ry="2.2" fill="none" stroke="${c}" stroke-width="1.3" opacity="0.95"/>
                    <ellipse cx="16" cy="6" rx="4" ry="1.1" fill="${c}" opacity="0.25"/>`;
        case 'wreath':
            return `<path d="M10 10 Q16 5 22 10" fill="none" stroke="${c}" stroke-width="1.6"/>
                    <circle cx="12" cy="9" r="1.2" fill="#81c784"/><circle cx="16" cy="7" r="1.2" fill="#a5d6a7"/><circle cx="20" cy="9" r="1.2" fill="#66bb6a"/>`;
        case 'wing':
            return `<path d="M6 14 Q4 8 10 10 Q8 14 6 14" fill="${c}" opacity="0.7"/>
                    <path d="M26 14 Q28 8 22 10 Q24 14 26 14" fill="${c}" opacity="0.7"/>`;
        default:
            return '';
    }
}

function buildSlimeIconSvg(element, size = 32, isEnemy = false, visual = null, seed = null) {
    const pal = SLIME_ICON_PALETTES[element] || SLIME_ICON_PALETTES.Water;
    const accent = SLIME_ICON_ACCENTS[element] || '';
    const body = isEnemy ? '#ef5350' : pal.body;
    const dark = isEnemy ? '#c62828' : pal.dark;
    const shine = isEnemy ? '#ffcdd2' : pal.shine;
    const blush = isEnemy ? '#ef9a9a' : (pal.blush || '#ffab91');
    const fierce = visual && visual.eyes === 'fierce';
    // Tensura-style: soft round blob + big cute eyes (element is color + small hat accent)
    const eyes = isEnemy
        ? `<ellipse cx="12" cy="15.5" rx="3.2" ry="3.6" fill="#fff"/><ellipse cx="20" cy="15.5" rx="3.2" ry="3.6" fill="#fff"/>
           <ellipse cx="12.6" cy="16" rx="1.5" ry="1.8" fill="#1a1a2e"/><ellipse cx="20.6" cy="16" rx="1.5" ry="1.8" fill="#1a1a2e"/>
           <path d="M9.5 12.5 Q12 11.5 14 12.5 M18 12.5 Q20 11.5 22.5 12.5" stroke="#1a1a2e" stroke-width="0.9" fill="none" stroke-linecap="round"/>`
        : fierce
            ? `<ellipse cx="12" cy="15" rx="3.4" ry="3.8" fill="#fff"/><ellipse cx="20" cy="15" rx="3.4" ry="3.8" fill="#fff"/>
               <ellipse cx="13" cy="15.6" rx="1.6" ry="2" fill="#1a237e"/><ellipse cx="21" cy="15.6" rx="1.6" ry="2" fill="#1a237e"/>
               <ellipse cx="13.5" cy="14.8" rx="0.55" ry="0.55" fill="#fff"/><ellipse cx="21.5" cy="14.8" rx="0.55" ry="0.55" fill="#fff"/>
               <path d="M9 12.2 Q12 11 14.5 12.2 M17.5 12.2 Q20 11 23 12.2" stroke="#1a1a2e" stroke-width="1" fill="none" stroke-linecap="round"/>`
            : `<ellipse cx="12" cy="15" rx="3.5" ry="4" fill="#fff"/><ellipse cx="20" cy="15" rx="3.5" ry="4" fill="#fff"/>
               <ellipse cx="12.8" cy="15.6" rx="1.7" ry="2.1" fill="#1a237e"/><ellipse cx="20.8" cy="15.6" rx="1.7" ry="2.1" fill="#1a237e"/>
               <ellipse cx="13.4" cy="14.7" rx="0.65" ry="0.65" fill="#fff"/><ellipse cx="21.4" cy="14.7" rx="0.65" ry="0.65" fill="#fff"/>
               <ellipse cx="12.2" cy="16.5" rx="0.35" ry="0.35" fill="#fff" opacity="0.7"/><ellipse cx="20.2" cy="16.5" rx="0.35" ry="0.35" fill="#fff" opacity="0.7"/>`;

    let flair = '';
    if (visual && !isEnemy) {
        if (visual.glow || visual.mythic) {
            const aura = visual.aura || '#ffdd77';
            flair += `<ellipse cx="16" cy="18" rx="14" ry="12" fill="none" stroke="${aura}" stroke-width="1.2" opacity="0.5"/>`;
            if (visual.mythic) {
                flair += `<ellipse cx="16" cy="18" rx="15.5" ry="13.5" fill="none" stroke="#fff59d" stroke-width="0.6" opacity="0.4"/>`;
            }
        }
        if (visual.accessory) flair += getChampionAccessorySvg(visual.accessory, visual.aura || pal.accent);
    }

    // Cute round anime blob (Rimuru-like) — soft outline via dual ellipse
    const bodySvg = `
        <ellipse cx="16" cy="23" rx="11" ry="5.5" fill="${dark}" opacity="0.28"/>
        <ellipse cx="16" cy="18.5" rx="12.2" ry="10.5" fill="${body}"/>
        <ellipse cx="16" cy="17.5" rx="11.5" ry="9.8" fill="${body}"/>
        <ellipse cx="16" cy="18.5" rx="12.2" ry="10.5" fill="none" stroke="${dark}" stroke-width="0.7" opacity="0.35"/>
        <ellipse cx="12" cy="12.5" rx="5" ry="3.5" fill="${shine}" opacity="0.55"/>
        <ellipse cx="11" cy="11.8" rx="2" ry="1.3" fill="#fff" opacity="0.45"/>`;

    const label = visual?.mythic ? `Mythic ${element} champion` : `${element} slime`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" role="img" aria-label="${label}">
        ${bodySvg}
        <ellipse cx="9.5" cy="19" rx="2.4" ry="1.3" fill="${blush}" opacity="0.45"/>
        <ellipse cx="22.5" cy="19" rx="2.4" ry="1.3" fill="${blush}" opacity="0.45"/>
        ${eyes}
        ${isEnemy ? '' : accent}
        ${flair}
    </svg>`;
}

function getSlimeIconHTML(slimeOrElement, size = 'md', isEnemy = false) {
    const isObj = slimeOrElement && typeof slimeOrElement === 'object';
    const element = typeof slimeOrElement === 'string' ? slimeOrElement : (slimeOrElement?.element || 'Water');
    let visual = isObj ? (slimeOrElement.visual || null) : null;
    // Restore visual from champion roster if save only has championId
    if (isObj && !visual && slimeOrElement.championId && typeof getChampionDefById === 'function') {
        const def = getChampionDefById(slimeOrElement.championId);
        if (def?.visual) visual = def.visual;
    }
    const px = { xs: 18, sm: 22, md: 32, lg: 48, xl: 64 }[size] || 32;
    const enemyCls = isEnemy ? ' enemy-slime' : '';
    const champCls = (isObj && (slimeOrElement.isChampion || visual)) ? ' champion-slime' : '';
    const title = isObj && slimeOrElement.name
        ? `${slimeOrElement.name}${slimeOrElement.species ? ' · ' + slimeOrElement.species : ''}`
        : element;
    const seed = isObj ? (slimeOrElement.id || slimeOrElement.name) : element;
    return `<span class="slime-icon slime-icon-${size}${enemyCls}${champCls}" title="${title}">${buildSlimeIconSvg(element, px, isEnemy, visual, seed)}</span>`;
}

/**
 * Full-body combat arena fighters with multi-frame poses
 * (idle / cast / attack / hit / heal / death) — next fidelity step past CSS-only squash.
 */
function getCombatFighterHTML(unit) {
    if (!unit) return '';
    const isFoe = unit.isEnemy || unit.isFoe || (unit.kind && unit.kind !== 'slime');
    if (isFoe && unit.kind !== 'slime') {
        return buildFoeFighterHTML(unit);
    }
    return buildSlimeFighterHTML(unit);
}

function _slimePosePalette(unit) {
    const element = unit.element || 'Water';
    const pal = SLIME_ICON_PALETTES[element] || SLIME_ICON_PALETTES.Water;
    let visual = unit.visual || null;
    if (!visual && unit.championId && typeof getChampionDefById === 'function') {
        visual = getChampionDefById(unit.championId)?.visual || null;
    }
    let role = unit.role || null;
    if (!role && typeof assignSlimeRole === 'function') {
        role = assignSlimeRole(unit);
    }
    role = role || 'striker';
    const morph = _elementMorph(element);
    const variant = _slimeVariantSeed(unit, 4);
    return {
        element,
        visual,
        role,
        morph,
        variant,
        isChamp: !!(unit.isChampion || unit.championId || visual),
        body: pal.body,
        dark: pal.dark,
        shine: pal.shine,
        accent: pal.accent,
        blush: pal.blush || pal.accent,
        // Only assassins default fierce; strikers stay cute unless visual says so
        fierce: (visual && visual.eyes === 'fierce') || role === 'assassin'
    };
}

/** Role-based body proportions + gear (tank bulk, mage hat, etc.). */
function _roleBodyMods(role) {
    switch (role) {
        case 'tank':
            return { bx: 31, by: 26, topRy: 23, oy: 2, gear: 'armor', scale: 1.12 };
        case 'mage':
            return { bx: 21, by: 19, topRy: 17, oy: -2, gear: 'hat', scale: 0.95 };
        case 'assassin':
            return { bx: 20, by: 17, topRy: 15, oy: 0, gear: 'blade', scale: 0.9 };
        case 'support':
            return { bx: 24, by: 21, topRy: 19, oy: -1, gear: 'orb', scale: 1 };
        case 'striker':
            return { bx: 26, by: 21, topRy: 19, oy: 0, gear: 'spikes', scale: 1 };
        case 'brute':
            return { bx: 29, by: 24, topRy: 21, oy: 1, gear: 'fists', scale: 1.12 };
        default:
            return { bx: 26, by: 22, topRy: 20, oy: 0, gear: null, scale: 1 };
    }
}

/**
 * Element body morph — not every slime is the same blob.
 * goop: 0 rigid → 1 soft blob → 2 drippy → 3 puddle/wispy
 * limb: how "arms" form when posing (goop | flame | mud | crystal | spike | wispy | rigid | soft)
 */
function _elementMorph(element) {
    const table = {
        Water:    { shape: 'goopy',   goop: 3, base: 1.1,  top: 0.85, drip: true,  lobes: 3, limb: 'goop' },
        Fire:     { shape: 'flame',   goop: 2, base: 0.9,  top: 1.18, drip: false, lobes: 0, peak: true, limb: 'flame' },
        Earth:    { shape: 'mud',     goop: 1, base: 1.22, top: 0.72, drip: true,  lobes: 2, limb: 'mud' },
        Wind:     { shape: 'wispy',   goop: 2, base: 0.95, top: 1.05, drip: true,  lobes: 1, limb: 'wispy' },
        Plant:    { shape: 'sprout',  goop: 1, base: 1.0,  top: 1.1,  drip: false, lobes: 2, limb: 'vine' },
        Lightning:{ shape: 'jagged',  goop: 1, base: 0.92, top: 1.12, drip: false, lobes: 0, spikes: true, limb: 'spike' },
        Ice:      { shape: 'crystal', goop: 0, base: 1.0,  top: 1.05, drip: false, lobes: 0, facets: true, limb: 'crystal' },
        Shadow:   { shape: 'wispy',   goop: 3, base: 1.05, top: 0.88, drip: true,  lobes: 3, limb: 'wispy' },
        Light:    { shape: 'orb',     goop: 1, base: 0.95, top: 1.0,  drip: false, lobes: 0, limb: 'soft' },
        Metal:    { shape: 'rigid',   goop: 0, base: 1.05, top: 0.92, drip: false, lobes: 0, facets: true, limb: 'rigid' },
        Poison:   { shape: 'goopy',   goop: 3, base: 1.12, top: 0.88, drip: true,  lobes: 3, bubbles: true, limb: 'goop' },
        Crystal:  { shape: 'crystal', goop: 0, base: 0.95, top: 1.15, drip: false, lobes: 0, facets: true, limb: 'crystal' },
        Lava:     { shape: 'flame',   goop: 2, base: 1.08, top: 0.98, drip: true,  lobes: 2, peak: true, limb: 'flame' },
        Storm:    { shape: 'wispy',   goop: 2, base: 1.0,  top: 1.08, drip: false, lobes: 2, limb: 'wispy' },
        Spirit:   { shape: 'orb',     goop: 2, base: 0.9,  top: 1.05, drip: true,  lobes: 1, limb: 'wispy' },
        Void:     { shape: 'wispy',   goop: 3, base: 1.02, top: 0.95, drip: true,  lobes: 2, limb: 'wispy' }
    };
    return table[element] || { shape: 'blob', goop: 1, base: 1, top: 1, drip: false, lobes: 0, limb: 'soft' };
}

/** Stable 0..n-1 seed from unit id / name so variants stay consistent. */
function _slimeVariantSeed(unitOrId, mod = 4) {
    const s = String(unitOrId?.id ?? unitOrId?.name ?? unitOrId ?? 'x');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h) % Math.max(1, mod);
}

/**
 * Tensura-style cartoon body: soft round gel blob first.
 * Element morphs add gentle silhouette hints (not harsh facets/spikes).
 */
function _slimeBodySilhouette(p, bx, by, topRy, oy, morph, variant) {
    const cy = 50 + oy;
    const body = p.body;
    const dark = p.dark;
    const shine = p.shine;
    const accent = p.accent;
    const blush = p.blush || accent;
    const g = morph.goop || 1;
    // Slightly squishy round — main anime blob
    const rx = Math.max(18, bx + 2);
    const ry = Math.max(16, by + 1);
    let svg = '';

    // Soft ground shadow
    svg += `<ellipse cx="32" cy="${64 + oy}" rx="${rx * 0.85}" ry="6" fill="${dark}" opacity="0.28"/>`;

    // Outer outline glow (cartoon stroke feel)
    svg += `<ellipse cx="32" cy="${cy}" rx="${rx + 1.2}" ry="${ry + 1.2}" fill="${dark}" opacity="0.22"/>`;

    // Core body — single soft mass (Rimuru base)
    if (morph.shape === 'flame' || morph.peak) {
        // Still mostly round, slight top peak
        svg += `<path d="
            M ${32 - rx} ${cy + 2}
            Q ${32 - rx - 2} ${cy - ry * 0.3} ${32 - rx * 0.4} ${cy - ry * 0.75}
            Q ${32 - 4} ${cy - ry - 10 - variant} 32 ${cy - ry - 12 - variant}
            Q ${32 + 6} ${cy - ry - 8} ${32 + rx * 0.4} ${cy - ry * 0.7}
            Q ${32 + rx + 2} ${cy - ry * 0.25} ${32 + rx} ${cy + 2}
            Q ${32 + rx * 0.6} ${cy + ry} 32 ${cy + ry + 1}
            Q ${32 - rx * 0.6} ${cy + ry} ${32 - rx} ${cy + 2}
            Z" fill="${body}"/>
            <path d="M32 ${cy - ry - 8} Q28 ${cy - 4} 30 ${cy + 6} Q32 ${cy + 2} 34 ${cy + 6} Q36 ${cy - 4} 32 ${cy - ry - 8}Z"
                fill="${accent}" opacity="0.28"/>`;
    } else if (morph.shape === 'mud') {
        // Soft wider puddle, still cute
        svg += `<ellipse cx="32" cy="${cy + 4}" rx="${rx * 1.12}" ry="${ry * 0.85}" fill="${body}"/>
            <ellipse cx="32" cy="${cy - 4}" rx="${rx * 0.92}" ry="${ry * 0.75}" fill="${body}"/>
            <ellipse cx="18" cy="${cy + 6}" rx="8" ry="7" fill="${body}" opacity="0.9"/>
            <ellipse cx="46" cy="${cy + 6}" rx="8" ry="7" fill="${body}" opacity="0.9"/>`;
    } else if (g >= 2 || morph.shape === 'goopy' || morph.shape === 'wispy') {
        svg += `<ellipse cx="32" cy="${cy}" rx="${rx + 1}" ry="${ry}" fill="${body}"/>
            <ellipse cx="14" cy="${cy + 6}" rx="${6 + g}" ry="${7 + g}" fill="${body}" opacity="0.92"/>
            <ellipse cx="50" cy="${cy + 5}" rx="${5 + g}" ry="${6 + g}" fill="${body}" opacity="0.9"/>`;
        if (morph.drip) {
            svg += `<path d="M18 ${cy + ry * 0.55} Q16 ${cy + ry + 8} 20 ${cy + ry + 10} Q22 ${cy + ry + 2} 20 ${cy + ry * 0.5}" fill="${body}"/>
                <path d="M44 ${cy + ry * 0.5} Q46 ${cy + ry + 7} 42 ${cy + ry + 9} Q40 ${cy + ry + 1} 44 ${cy + ry * 0.45}" fill="${body}"/>`;
        }
    } else if (morph.shape === 'sprout') {
        svg += `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="${ry}" fill="${body}"/>
            <ellipse cx="14" cy="${cy - 2}" rx="7" ry="9" fill="${body}" opacity="0.9" transform="rotate(-18 14 ${cy - 2})"/>
            <ellipse cx="50" cy="${cy - 3}" rx="6" ry="8" fill="${body}" opacity="0.88" transform="rotate(20 50 ${cy - 3})"/>`;
    } else {
        // Default soft anime blob
        svg += `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="${ry}" fill="${body}"/>`;
    }

    // Soft outline stroke on main mass
    svg += `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${dark}" stroke-width="1.1" opacity="0.28"/>`;

    // Glossy highlight (big cartoon shine)
    svg += `<ellipse cx="24" cy="${cy - ry * 0.35}" rx="${p.role === 'tank' ? 10 : 8}" ry="${p.role === 'tank' ? 6 : 5}" fill="${shine}" opacity="0.55"/>
        <ellipse cx="22" cy="${cy - ry * 0.4}" rx="3.5" ry="2.2" fill="#fff" opacity="0.5"/>`;

    // Cute blush cheeks
    svg += `<ellipse cx="18" cy="${cy + 4}" rx="5" ry="2.8" fill="${blush}" opacity="0.4"/>
        <ellipse cx="46" cy="${cy + 4}" rx="5" ry="2.8" fill="${blush}" opacity="0.4"/>`;

    // Optional tiny smile
    if (!p.fierce) {
        svg += `<path d="M28 ${cy + 10} Q32 ${cy + 13} 36 ${cy + 10}" stroke="${dark}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.35"/>`;
    }

    return svg;
}

function _roleGearSvg(role, p, oy = 0) {
    const a = p.accent;
    const d = p.dark;
    switch (role) {
        case 'tank':
            return `<path d="M14 ${44 + oy} Q32 ${36 + oy} 50 ${44 + oy} L48 ${54 + oy} Q32 ${48 + oy} 16 ${54 + oy} Z" fill="${d}" opacity="0.55" stroke="${a}" stroke-width="1"/>
                    <rect x="22" y="${46 + oy}" width="20" height="8" rx="2" fill="${a}" opacity="0.35"/>`;
        case 'mage':
            return `<path d="M32 ${6 + oy} L44 ${28 + oy} L20 ${28 + oy} Z" fill="${d}" stroke="${a}" stroke-width="1"/>
                    <circle cx="32" cy="${8 + oy}" r="3" fill="${a}"/>
                    <ellipse cx="48" cy="${42 + oy}" rx="5" ry="7" fill="none" stroke="${a}" stroke-width="1.5" opacity="0.8"/>
                    <circle cx="48" cy="${42 + oy}" r="2" fill="${a}" opacity="0.7"/>`;
        case 'assassin':
            return `<path d="M48 ${34 + oy} L58 ${22 + oy} L56 ${34 + oy} Z" fill="${a}" stroke="${d}" stroke-width="0.6"/>
                    <path d="M12 ${38 + oy} Q20 ${32 + oy} 28 ${38 + oy}" fill="none" stroke="${d}" stroke-width="2" opacity="0.5"/>`;
        case 'support':
            return `<circle cx="18" cy="${28 + oy}" r="5" fill="none" stroke="#69f0ae" stroke-width="1.5" opacity="0.85"/>
                    <circle cx="18" cy="${28 + oy}" r="2" fill="#b9f6ca" opacity="0.8"/>
                    <path d="M16 ${28 + oy} h4 M18 ${26 + oy} v4" stroke="#fff" stroke-width="1"/>`;
        case 'striker':
            return `<path d="M18 ${30 + oy} L22 ${22 + oy} L26 ${30 + oy}" fill="${a}" opacity="0.7"/>
                    <path d="M38 ${30 + oy} L42 ${20 + oy} L46 ${30 + oy}" fill="${a}" opacity="0.7"/>
                    <path d="M28 ${18 + oy} L32 ${10 + oy} L36 ${18 + oy}" fill="${a}" opacity="0.65"/>`;
        case 'brute':
            return `<ellipse cx="14" cy="${50 + oy}" rx="6" ry="5" fill="${d}" opacity="0.7"/>
                    <ellipse cx="50" cy="${50 + oy}" rx="6" ry="5" fill="${d}" opacity="0.7"/>`;
        default:
            return '';
    }
}

/** Big soft anime eyes (Tensura / Rimuru vibe) */
function _slimeEyes(p, ox = 0, oy = 0, mode = 'normal') {
    const lx = 25 + ox, rx = 39 + ox, y = 37 + oy;
    if (mode === 'hit') {
        return `<path d="M${lx - 3.5} ${y - 1} L${lx + 3.5} ${y + 2} M${lx + 3.5} ${y - 1} L${lx - 3.5} ${y + 2}" stroke="#1a1a2e" stroke-width="1.7" stroke-linecap="round"/>
                <path d="M${rx - 3.5} ${y - 1} L${rx + 3.5} ${y + 2} M${rx + 3.5} ${y - 1} L${rx - 3.5} ${y + 2}" stroke="#1a1a2e" stroke-width="1.7" stroke-linecap="round"/>`;
    }
    if (mode === 'closed') {
        return `<path d="M${lx - 5} ${y} Q${lx} ${y + 3.5} ${lx + 5} ${y}" stroke="#1a1a2e" stroke-width="1.7" fill="none" stroke-linecap="round"/>
                <path d="M${rx - 5} ${y} Q${rx} ${y + 3.5} ${rx + 5} ${y}" stroke="#1a1a2e" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
    }
    // Large white ovals + deep iris + dual sparkle highlights
    const iris = (p.fierce || mode === 'fierce') ? '#1a237e' : '#1565c0';
    const brow = (p.fierce || mode === 'fierce')
        ? `<path d="M${lx - 6} ${y - 7} Q${lx} ${y - 9} ${lx + 5} ${y - 6}" stroke="#1a1a2e" stroke-width="1.5" fill="none" stroke-linecap="round"/>
           <path d="M${rx - 5} ${y - 6} Q${rx} ${y - 9} ${rx + 6} ${y - 7}" stroke="#1a1a2e" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
        : '';
    return `${brow}
        <ellipse cx="${lx}" cy="${y}" rx="5.4" ry="6.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.55" opacity="0.95"/>
        <ellipse cx="${rx}" cy="${y}" rx="5.4" ry="6.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.55" opacity="0.95"/>
        <ellipse cx="${lx + 0.8}" cy="${y + 0.8}" rx="2.8" ry="3.4" fill="${iris}"/>
        <ellipse cx="${rx + 0.8}" cy="${y + 0.8}" rx="2.8" ry="3.4" fill="${iris}"/>
        <ellipse cx="${lx + 0.8}" cy="${y + 1.2}" rx="1.5" ry="1.9" fill="#0d1b3a"/>
        <ellipse cx="${rx + 0.8}" cy="${y + 1.2}" rx="1.5" ry="1.9" fill="#0d1b3a"/>
        <ellipse cx="${lx + 1.6}" cy="${y - 0.6}" rx="1.1" ry="1.1" fill="#fff"/>
        <ellipse cx="${rx + 1.6}" cy="${y - 0.6}" rx="1.1" ry="1.1" fill="#fff"/>
        <ellipse cx="${lx - 0.4}" cy="${y + 2}" rx="0.55" ry="0.55" fill="#fff" opacity="0.85"/>
        <ellipse cx="${rx - 0.4}" cy="${y + 2}" rx="0.55" ry="0.55" fill="#fff" opacity="0.85"/>`;
}

function _slimeElemBits(element, oy = 0) {
    const y = (n) => n + oy;
    const bits = {
        Fire: `<path d="M32 ${y(8)}c-2 6-8 8-6 14 2 4 4-2 6-2s4 6 6 2c2-6-4-8-6-14z" fill="#ff3d00"/>`,
        Water: `<path d="M32 ${y(10)}c0 0-5 7-5 11a5 5 0 0 0 10 0c0-4-5-11-5-11z" fill="#29b6f6" opacity="0.95"/>`,
        Plant: `<ellipse cx="32" cy="${y(12)}" rx="5" ry="3" fill="#43a047"/>`,
        Lightning: `<path d="M36 ${y(10)}l-6 10h4l-5 12 9-12h-4l6-10z" fill="#fff176" stroke="#f57f17" stroke-width="0.6"/>`,
        Ice: `<path d="M32 ${y(10)}l3 7 7 2-5 5 2 7-7-4-7 4 2-7-5-5 7-2z" fill="#e0f7fa" stroke="#00838f" stroke-width="0.8"/>`,
        Light: `<path d="M32 ${y(8)}l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" fill="#fffde7" stroke="#f9a825"/>`,
        Shadow: `<path d="M18 ${y(18)}a14 14 0 0 1 28 0" fill="none" stroke="#3949ab" stroke-width="3" opacity="0.7"/>`,
        Poison: `<circle cx="32" cy="${y(16)}" r="6" fill="#7b1fa2" opacity="0.55"/>`,
        Crystal: `<path d="M32 ${y(8)}l6 10-6 4-6-4z" fill="#d1c4e9"/>`,
        Lava: `<path d="M22 ${y(52)}q4 4 10 0" stroke="#ffeb3b" stroke-width="1.5" fill="none"/>`,
        Storm: `<ellipse cx="32" cy="${y(14)}" rx="10" ry="5" fill="#9fa8da" opacity="0.85"/>`,
        Metal: `<circle cx="32" cy="${y(14)}" r="5" fill="none" stroke="#cfd8dc" stroke-width="2"/>`,
        Spirit: `<ellipse cx="32" cy="${y(14)}" rx="8" ry="5" fill="#ede7f6" opacity="0.5"/>`,
        Void: `<circle cx="32" cy="${y(16)}" r="7" fill="none" stroke="#78909c" stroke-width="2"/>`,
        Earth: `<rect x="26" y="${y(10)}" width="12" height="8" rx="2" fill="#5d4037"/>`,
        Wind: `<path d="M20 ${y(14)}h20M18 ${y(20)}h24" stroke="#c8e6c9" stroke-width="2" stroke-linecap="round"/>`
    };
    return bits[element] || '';
}

function _slimeFlair(p, oy = 0) {
    const visual = p.visual;
    if (!visual) return p.isChamp
        ? `<circle cx="50" cy="${28 + oy}" r="5" fill="#ffdd77" stroke="#5d4037" stroke-width="0.8"/><text x="50" y="${31 + oy}" text-anchor="middle" font-size="7" fill="#5d4037" font-weight="bold">★</text>`
        : '';
    let flair = '';
    const aura = visual.aura || '#ffdd77';
    const aura2 = visual.aura2 || '#fff59d';
    // Arena fusion form — massive dual aura, Ω mark, dual-element sparkles
    if (visual.fusion) {
        flair += `<ellipse cx="32" cy="${50 + oy}" rx="36" ry="30" fill="none" stroke="${aura}" stroke-width="3" opacity="0.5"/>
                  <ellipse cx="32" cy="${50 + oy}" rx="40" ry="34" fill="none" stroke="${aura2}" stroke-width="1.5" opacity="0.45" stroke-dasharray="5 3"/>
                  <ellipse cx="32" cy="${50 + oy}" rx="44" ry="38" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.2"/>
                  <circle cx="10" cy="${28 + oy}" r="3" fill="${aura}" opacity="0.85"/>
                  <circle cx="54" cy="${24 + oy}" r="2.5" fill="${aura2}" opacity="0.9"/>
                  <circle cx="16" cy="${60 + oy}" r="2.5" fill="${aura}" opacity="0.75"/>
                  <circle cx="48" cy="${62 + oy}" r="2" fill="${aura2}" opacity="0.8"/>
                  <circle cx="32" cy="${16 + oy}" r="3" fill="#fff59d" opacity="0.7"/>
                  <path d="M28 ${8 + oy} L32 ${2 + oy} L36 ${8 + oy} L32 ${6 + oy} Z" fill="${aura}" opacity="0.9"/>
                  <text x="32" y="${14 + oy}" text-anchor="middle" font-size="11" fill="#ffdd77" font-weight="bold" stroke="#5d4037" stroke-width="0.4">Ω</text>`;
    }
    if (visual.glow || visual.mythic || visual.fusion) {
        flair += `<ellipse cx="32" cy="${48 + oy}" rx="${visual.fusion ? 32 : 28}" ry="${visual.fusion ? 28 : 24}" fill="none" stroke="${aura}" stroke-width="2" opacity="0.45"/>`;
    }
    if (visual.accessory === 'crown') {
        flair += `<path d="M18 ${20 + oy} l5-8 5 5 5-7 5 5 5-5 5 10 -30 0z" fill="${aura}" stroke="#5d4037"/>`;
    } else if (visual.accessory === 'halo') {
        flair += `<ellipse cx="32" cy="${12 + oy}" rx="14" ry="4" fill="none" stroke="${aura}" stroke-width="2.2"/>`;
    } else if (visual.accessory === 'helm') {
        flair += `<path d="M18 ${24 + oy} Q32 ${10 + oy} 46 ${24 + oy} L44 ${30 + oy} H20 Z" fill="${aura}" stroke="#37474f"/>`;
    } else if (visual.accessory === 'hood') {
        flair += `<path d="M16 ${28 + oy} Q32 ${8 + oy} 48 ${28 + oy} L44 ${24 + oy} Q32 ${14 + oy} 20 ${24 + oy} Z" fill="${p.dark}" opacity="0.85"/>`;
    } else if (visual.accessory === 'wing') {
        flair += `<path d="M10 ${40 + oy} Q4 ${24 + oy} 18 ${28 + oy} Q14 ${40 + oy} 10 ${40 + oy}" fill="${aura}" opacity="0.75"/>
                  <path d="M54 ${40 + oy} Q60 ${24 + oy} 46 ${28 + oy} Q50 ${40 + oy} 54 ${40 + oy}" fill="${aura}" opacity="0.75"/>`;
    } else if (visual.accessory === 'wreath') {
        flair += `<path d="M18 ${22 + oy} Q32 ${10 + oy} 46 ${22 + oy}" fill="none" stroke="${aura}" stroke-width="2.5"/>`;
    } else if (visual.accessory === 'tiara') {
        flair += `<path d="M20 ${22 + oy} Q32 ${10 + oy} 44 ${22 + oy}" fill="none" stroke="${aura}" stroke-width="2.2"/>`;
    }
    if (p.isChamp) {
        flair += `<circle cx="50" cy="${28 + oy}" r="5" fill="#ffdd77" stroke="#5d4037" stroke-width="0.8"/><text x="50" y="${31 + oy}" text-anchor="middle" font-size="7" fill="#5d4037" font-weight="bold">★</text>`;
    }
    return flair;
}

/**
 * Visual bulk only — fused form looks like two gels melted together
 * (wide base, partner-colored lobes, drips). Does not affect combat stats.
 */
function _fusionMassExtras(p, bx, by, oy) {
    if (!p.visual?.fusion) return '';
    const body2 = p.visual.partnerBody || p.accent;
    const dark2 = p.visual.partnerDark || p.dark;
    const pe = p.visual.partnerElement || p.element;
    const sameEl = pe === p.element;
    // Swirled dual mass: partner gel coils through primary, fluid merge (not two glued circles)
    return `
        <ellipse cx="32" cy="${68 + oy}" rx="${bx * 1.2}" ry="${Math.max(11, by * 0.45)}" fill="${p.dark}" opacity="0.42"/>
        <path d="M8 ${50 + oy} Q4 ${40 + oy} 14 ${36 + oy} Q20 ${42 + oy} 16 ${54 + oy} Q10 ${62 + oy} 8 ${50 + oy}" fill="${body2}" opacity="${sameEl ? 0.5 : 0.9}"/>
        <path d="M56 ${48 + oy} Q62 ${38 + oy} 50 ${34 + oy} Q44 ${42 + oy} 48 ${56 + oy} Q54 ${64 + oy} 56 ${48 + oy}" fill="${body2}" opacity="${sameEl ? 0.48 : 0.88}"/>
        <path d="M12 ${56 + oy} Q6 ${68 + oy} 16 ${78 + oy} Q22 ${70 + oy} 18 ${58 + oy}" fill="${body2}" opacity="0.85"/>
        <path d="M52 ${56 + oy} Q58 ${70 + oy} 46 ${78 + oy} Q42 ${68 + oy} 48 ${56 + oy}" fill="${body2}" opacity="0.82"/>
        <path d="M20 ${44 + oy} Q32 ${58 + oy} 44 ${44 + oy} Q40 ${62 + oy} 32 ${66 + oy} Q24 ${62 + oy} 20 ${44 + oy}" fill="${body2}" opacity="${sameEl ? 0.35 : 0.55}"/>
        <ellipse cx="32" cy="${60 + oy}" rx="${bx * 1.08}" ry="${Math.max(12, by * 0.52)}" fill="${p.body}" opacity="0.92"/>
        <path d="M26 ${64 + oy} Q24 ${80 + oy} 32 ${84 + oy} Q38 ${78 + oy} 36 ${64 + oy}" fill="${p.body}" opacity="0.95"/>
        <path d="M18 ${60 + oy} Q14 ${74 + oy} 22 ${76 + oy}" fill="${body2}" opacity="0.75"/>
        <path d="M46 ${60 + oy} Q50 ${74 + oy} 42 ${76 + oy}" fill="${body2}" opacity="0.7"/>
        <circle cx="14" cy="${70 + oy}" r="3" fill="${body2}" opacity="0.7"/>
        <circle cx="50" cy="${72 + oy}" r="2.5" fill="${body2}" opacity="0.65"/>
        <ellipse cx="22" cy="${48 + oy}" rx="5" ry="4" fill="${dark2}" opacity="0.2"/>
        <ellipse cx="42" cy="${46 + oy}" rx="5" ry="4" fill="${dark2}" opacity="0.18"/>
        ${_slimeElemBits(pe, oy + 10)}
    `;
}

/**
 * Pose limbs with fluid dynamics — no stick arms.
 * goop tendrils, mud fists, flame licks, crystal shards, vines, etc.
 * @param {'idle'|'attack'|'cast'|'hit'|'heal'|'death'} pose
 */
function _slimeFluidLimbs(p, pose, oy = 0) {
    const morph = p.morph || _elementMorph(p.element);
    const limb = morph.limb || 'soft';
    const b = p.body;
    const a = p.accent;
    const d = p.dark;
    const a2 = (p.visual && p.visual.aura2) || a;
    const b2 = (p.visual && p.visual.partnerBody) || a;
    const fuse = !!(p.visual && p.visual.fusion);
    let out = '';

    // Shared goopy arm path: thick filled tendril (shoulder → tip with blob hand)
    const goopArm = (sx, sy, mx, my, ex, ey, col, w = 1) => `
        <path d="M${sx} ${sy + oy}
            Q${mx} ${my + oy} ${ex} ${ey + oy}
            Q${ex + 3 * w} ${ey + 4 + oy} ${ex - 2 * w} ${ey + 6 + oy}
            Q${mx + 2} ${my + 6 + oy} ${sx + 2} ${sy + 4 + oy} Z"
            fill="${col}" opacity="0.95"/>
        <ellipse cx="${ex}" cy="${ey + oy}" rx="${5 * w}" ry="${4.5 * w}" fill="${col}"/>
        <circle cx="${ex + (w > 0 ? 2 : -2)}" cy="${ey + 3 + oy}" r="${2 * Math.abs(w)}" fill="${col}" opacity="0.85"/>`;

    if (pose === 'idle') {
        // Resting pseudo-limbs: soft side bulges / drips that read as arms at rest
        if (limb === 'goop' || limb === 'wispy' || fuse) {
            out += goopArm(14, 48, 6, 54, 4, 58, b, 0.9);
            out += goopArm(50, 48, 58, 54, 60, 58, fuse ? b2 : b, 0.9);
            if (morph.drip || fuse) {
                out += `<path d="M16 ${62 + oy} Q14 ${70 + oy} 18 ${72 + oy} Q20 ${66 + oy} 18 ${62 + oy}" fill="${b}" opacity="0.8"/>
                    <path d="M48 ${62 + oy} Q50 ${70 + oy} 46 ${72 + oy} Q44 ${66 + oy} 46 ${62 + oy}" fill="${fuse ? b2 : b}" opacity="0.75"/>`;
            }
        } else if (limb === 'mud') {
            out += `<ellipse cx="12" cy="${54 + oy}" rx="8" ry="7" fill="${b}" opacity="0.9"/>
                <ellipse cx="52" cy="${54 + oy}" rx="8" ry="7" fill="${b}" opacity="0.9"/>
                <ellipse cx="10" cy="${58 + oy}" rx="5" ry="4" fill="${d}" opacity="0.35"/>
                <ellipse cx="54" cy="${58 + oy}" rx="5" ry="4" fill="${d}" opacity="0.35"/>`;
        } else if (limb === 'flame') {
            out += `<path d="M12 ${50 + oy} Q6 ${42 + oy} 10 ${34 + oy} Q14 ${42 + oy} 14 ${50 + oy}" fill="${a}" opacity="0.7"/>
                <path d="M52 ${50 + oy} Q58 ${40 + oy} 54 ${32 + oy} Q50 ${42 + oy} 50 ${50 + oy}" fill="${a}" opacity="0.65"/>`;
        } else if (limb === 'vine') {
            out += `<path d="M14 ${48 + oy} Q8 ${52 + oy} 10 ${60 + oy}" fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M50 ${48 + oy} Q56 ${52 + oy} 54 ${60 + oy}" fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/>
                <ellipse cx="10" cy="${60 + oy}" rx="4" ry="2.5" fill="${a}" opacity="0.7"/>
                <ellipse cx="54" cy="${60 + oy}" rx="4" ry="2.5" fill="${a}" opacity="0.7"/>`;
        }
        return out;
    }

    if (pose === 'attack') {
        // Forward lunge limbs — filled gel, not strokes
        if (limb === 'goop' || fuse) {
            out += goopArm(16, 42, 2, 28, -2, 18, b, 1.15);
            out += goopArm(48, 42, 62, 28, 66, 16, fuse ? b2 : b, 1.15);
            // Splash droplets mid-swing
            out += `<circle cx="0" cy="${14 + oy}" r="2.5" fill="${b}" opacity="0.7"/>
                <circle cx="64" cy="${12 + oy}" r="2" fill="${fuse ? b2 : b}" opacity="0.7"/>
                <circle cx="8" cy="${22 + oy}" r="1.5" fill="${a}" opacity="0.6"/>
                <path d="M28 ${20 + oy} Q32 ${8 + oy} 36 ${20 + oy} Q32 ${16 + oy} 28 ${20 + oy}" fill="${a}" opacity="0.75"/>`;
        } else if (limb === 'mud') {
            out += `<ellipse cx="8" cy="${36 + oy}" rx="10" ry="9" fill="${b}"/>
                <ellipse cx="56" cy="${34 + oy}" rx="10" ry="9" fill="${b}"/>
                <ellipse cx="4" cy="${30 + oy}" rx="6" ry="5" fill="${d}" opacity="0.4"/>
                <ellipse cx="60" cy="${28 + oy}" rx="6" ry="5" fill="${d}" opacity="0.4"/>
                <path d="M14 ${44 + oy} Q10 ${40 + oy} 8 ${36 + oy}" fill="${b}"/>
                <path d="M50 ${44 + oy} Q54 ${38 + oy} 56 ${34 + oy}" fill="${b}"/>`;
        } else if (limb === 'flame') {
            out += `<path d="M14 ${46 + oy} Q4 ${30 + oy} 8 ${14 + oy} Q16 ${24 + oy} 18 ${42 + oy}" fill="${a}" opacity="0.9"/>
                <path d="M50 ${46 + oy} Q60 ${28 + oy} 56 ${12 + oy} Q48 ${24 + oy} 46 ${42 + oy}" fill="${a2}" opacity="0.85"/>
                <path d="M10 ${20 + oy} Q8 ${10 + oy} 14 ${16 + oy}" fill="${a}" opacity="0.7"/>
                <path d="M54 ${18 + oy} Q56 ${8 + oy} 50 ${14 + oy}" fill="${a2}" opacity="0.7"/>`;
        } else if (limb === 'crystal' || limb === 'spike') {
            out += `<path d="M18 ${44 + oy} L6 ${22 + oy} L16 ${40 + oy} Z" fill="${a}" opacity="0.9"/>
                <path d="M46 ${44 + oy} L58 ${20 + oy} L48 ${40 + oy} Z" fill="${a2}" opacity="0.9"/>
                <path d="M12 ${30 + oy} L4 ${16 + oy} L14 ${28 + oy} Z" fill="${a}" opacity="0.6"/>
                <path d="M52 ${30 + oy} L60 ${14 + oy} L50 ${28 + oy} Z" fill="${a2}" opacity="0.6"/>`;
        } else if (limb === 'vine') {
            out += `<path d="M16 ${46 + oy} Q4 ${34 + oy} 2 ${18 + oy} Q10 ${28 + oy} 18 ${42 + oy}" fill="${b}" opacity="0.85"/>
                <path d="M48 ${46 + oy} Q60 ${32 + oy} 62 ${16 + oy} Q54 ${28 + oy} 46 ${42 + oy}" fill="${b}" opacity="0.85"/>
                <ellipse cx="2" cy="${18 + oy}" rx="5" ry="3" fill="${a}" opacity="0.8"/>
                <ellipse cx="62" cy="${16 + oy}" rx="5" ry="3" fill="${a}" opacity="0.8"/>`;
        } else if (limb === 'wispy') {
            out += `<path d="M16 ${46 + oy} Q4 ${32 + oy} 0 ${20 + oy}" fill="none" stroke="${b}" stroke-width="6" stroke-linecap="round" opacity="0.75"/>
                <path d="M48 ${46 + oy} Q60 ${30 + oy} 64 ${18 + oy}" fill="none" stroke="${fuse ? b2 : b}" stroke-width="6" stroke-linecap="round" opacity="0.75"/>
                <circle cx="0" cy="${20 + oy}" r="4" fill="${b}" opacity="0.6"/>
                <circle cx="64" cy="${18 + oy}" r="4" fill="${fuse ? b2 : b}" opacity="0.6"/>`;
        } else if (limb === 'rigid') {
            out += `<path d="M18 ${46 + oy} L8 ${24 + oy} L12 ${46 + oy} Z" fill="${d}" opacity="0.85"/>
                <path d="M46 ${46 + oy} L56 ${24 + oy} L52 ${46 + oy} Z" fill="${d}" opacity="0.85"/>
                <rect x="5" y="${20 + oy}" width="8" height="6" rx="1" fill="${a}" opacity="0.7"/>
                <rect x="51" y="${20 + oy}" width="8" height="6" rx="1" fill="${a}" opacity="0.7"/>`;
        } else {
            // soft default: rounded gel mitts
            out += goopArm(16, 44, 6, 32, 2, 22, b, 1);
            out += goopArm(48, 44, 58, 32, 62, 22, b, 1);
        }
        return out;
    }

    if (pose === 'cast') {
        // Gather energy — limbs curve upward, mass squashes
        if (limb === 'goop' || fuse) {
            out += goopArm(18, 50, 8, 36, 10, 22, b, 1);
            out += goopArm(46, 50, 56, 36, 54, 22, fuse ? b2 : b, 1);
            out += `<ellipse cx="32" cy="${16 + oy}" rx="${fuse ? 16 : 12}" ry="5" fill="none" stroke="${a}" stroke-width="2" opacity="0.7"/>
                <circle cx="20" cy="${24 + oy}" r="3" fill="${a}" opacity="0.65"/>
                <circle cx="44" cy="${24 + oy}" r="3" fill="${a2}" opacity="0.65"/>
                <path d="M24 ${28 + oy} Q32 ${12 + oy} 40 ${28 + oy}" fill="none" stroke="${a}" stroke-width="1.5" opacity="0.5"/>`;
        } else if (limb === 'mud') {
            out += `<ellipse cx="14" cy="${42 + oy}" rx="9" ry="8" fill="${b}"/>
                <ellipse cx="50" cy="${42 + oy}" rx="9" ry="8" fill="${b}"/>
                <ellipse cx="32" cy="${22 + oy}" rx="10" ry="4" fill="${a}" opacity="0.35"/>`;
        } else if (limb === 'flame') {
            out += `<path d="M16 ${50 + oy} Q10 ${30 + oy} 18 ${16 + oy} Q22 ${30 + oy} 20 ${48 + oy}" fill="${a}" opacity="0.85"/>
                <path d="M48 ${50 + oy} Q54 ${28 + oy} 46 ${14 + oy} Q42 ${30 + oy} 44 ${48 + oy}" fill="${a2}" opacity="0.85"/>`;
        } else if (limb === 'crystal' || limb === 'spike') {
            out += `<path d="M20 ${48 + oy} L14 ${20 + oy} L24 ${44 + oy} Z" fill="${a}" opacity="0.85"/>
                <path d="M44 ${48 + oy} L50 ${20 + oy} L40 ${44 + oy} Z" fill="${a2}" opacity="0.85"/>
                <path d="M28 ${18 + oy} L32 ${8 + oy} L36 ${18 + oy} Z" fill="${a}" opacity="0.7"/>`;
        } else if (limb === 'vine') {
            out += `<path d="M18 ${50 + oy} Q10 ${36 + oy} 14 ${20 + oy} Q20 ${32 + oy} 22 ${48 + oy}" fill="${b}" opacity="0.8"/>
                <path d="M46 ${50 + oy} Q54 ${36 + oy} 50 ${20 + oy} Q44 ${32 + oy} 42 ${48 + oy}" fill="${b}" opacity="0.8"/>
                <ellipse cx="14" cy="${20 + oy}" rx="4" ry="3" fill="${a}"/>
                <ellipse cx="50" cy="${20 + oy}" rx="4" ry="3" fill="${a}"/>`;
        } else {
            out += goopArm(18, 50, 10, 38, 12, 26, b, 0.95);
            out += goopArm(46, 50, 54, 38, 52, 26, b, 0.95);
            out += `<ellipse cx="32" cy="${18 + oy}" rx="12" ry="5" fill="none" stroke="${a}" stroke-width="2" opacity="0.65"/>`;
        }
        return out;
    }

    if (pose === 'hit') {
        // Impact splash / jiggle
        if (limb === 'goop' || morph.goop >= 2 || fuse) {
            out += `<path d="M8 ${36 + oy} Q2 ${34 + oy} 4 ${42 + oy} Q10 ${40 + oy} 12 ${38 + oy}" fill="${b}" opacity="0.85"/>
                <path d="M56 ${36 + oy} Q62 ${34 + oy} 60 ${42 + oy} Q54 ${40 + oy} 52 ${38 + oy}" fill="${fuse ? b2 : b}" opacity="0.85"/>
                <circle cx="6" cy="${30 + oy}" r="2.5" fill="${b}" opacity="0.7"/>
                <circle cx="58" cy="${28 + oy}" r="2.5" fill="${fuse ? b2 : b}" opacity="0.7"/>
                <path d="M4 ${44 + oy} L12 ${48 + oy} M52 ${48 + oy} L60 ${44 + oy}" stroke="#ff6666" stroke-width="1.5" opacity="0.5"/>`;
        } else if (limb === 'mud') {
            out += `<ellipse cx="10" cy="${48 + oy}" rx="7" ry="6" fill="${b}" opacity="0.9"/>
                <ellipse cx="54" cy="${48 + oy}" rx="7" ry="6" fill="${b}" opacity="0.9"/>`;
        } else if (limb === 'crystal' || limb === 'rigid' || limb === 'spike') {
            out += `<path d="M10 ${40 + oy} L6 ${34 + oy} M54 ${40 + oy} L58 ${34 + oy}" stroke="#ff6666" stroke-width="2" opacity="0.7"/>
                <path d="M12 ${50 + oy} L8 ${54 + oy} M52 ${50 + oy} L56 ${54 + oy}" stroke="#ff6666" stroke-width="1.5" opacity="0.5"/>`;
        } else {
            out += `<path d="M8 ${38 + oy} Q4 ${42 + oy} 10 ${46 + oy}" fill="${b}" opacity="0.7"/>
                <path d="M56 ${38 + oy} Q60 ${42 + oy} 54 ${46 + oy}" fill="${b}" opacity="0.7"/>`;
        }
        return out;
    }

    if (pose === 'heal') {
        if (limb === 'goop' || fuse) {
            out += goopArm(18, 46, 10, 30, 14, 18, b, 0.9);
            out += goopArm(46, 46, 54, 30, 50, 18, fuse ? b2 : b, 0.9);
        } else if (limb === 'mud') {
            out += `<ellipse cx="14" cy="${40 + oy}" rx="7" ry="6" fill="${b}"/>
                <ellipse cx="50" cy="${40 + oy}" rx="7" ry="6" fill="${b}"/>`;
        } else if (limb === 'vine' || limb === 'soft') {
            out += `<path d="M16 ${48 + oy} Q10 ${32 + oy} 16 ${20 + oy}" fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
                <path d="M48 ${48 + oy} Q54 ${32 + oy} 48 ${20 + oy}" fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`;
        } else if (limb === 'flame') {
            out += `<path d="M16 ${48 + oy} Q12 ${30 + oy} 18 ${18 + oy} Q20 ${32 + oy} 18 ${46 + oy}" fill="${a}" opacity="0.7"/>
                <path d="M48 ${48 + oy} Q52 ${30 + oy} 46 ${18 + oy} Q44 ${32 + oy} 46 ${46 + oy}" fill="${a}" opacity="0.7"/>`;
        }
        out += `<circle cx="18" cy="${20 + oy}" r="3" fill="#69f0ae" opacity="0.85"/>
            <circle cx="46" cy="${18 + oy}" r="2.5" fill="#b9f6ca" opacity="0.8"/>
            <circle cx="32" cy="${12 + oy}" r="3.5" fill="#c8f7dc" opacity="0.75"/>
            <path d="M32 8 v8 M28 12 h8" stroke="#fff" stroke-width="1.4" transform="translate(0 ${oy})"/>`;
        return out;
    }

    if (pose === 'death') {
        // Collapsed puddle / crumbled pile
        if (limb === 'mud') {
            out += `<ellipse cx="28" cy="${68 + oy}" rx="18" ry="8" fill="${b}" opacity="0.9"/>
                <ellipse cx="42" cy="${70 + oy}" rx="14" ry="6" fill="${b}" opacity="0.85"/>
                <ellipse cx="34" cy="${66 + oy}" rx="8" ry="5" fill="${d}" opacity="0.3"/>`;
        } else if (limb === 'goop' || morph.goop >= 2 || fuse) {
            out += `<path d="M10 ${64 + oy} Q20 ${72 + oy} 32 ${74 + oy} Q48 ${72 + oy} 56 ${64 + oy} Q50 ${70 + oy} 32 ${72 + oy} Q16 ${70 + oy} 10 ${64 + oy}" fill="${b}" opacity="0.9"/>
                <circle cx="16" cy="${70 + oy}" r="3" fill="${b}" opacity="0.7"/>
                <circle cx="48" cy="${72 + oy}" r="2.5" fill="${fuse ? b2 : b}" opacity="0.7"/>`;
        } else if (limb === 'crystal' || limb === 'rigid') {
            out += `<path d="M18 ${60 + oy} L28 ${72 + oy} L22 ${68 + oy} Z" fill="${a}" opacity="0.5"/>
                <path d="M46 ${62 + oy} L52 ${72 + oy} L40 ${70 + oy} Z" fill="${a}" opacity="0.45"/>`;
        }
        return out;
    }

    return out;
}

/** One slime body drawing at a vertical offset / stretch for a given pose. */
function _slimeBodyCore(p, opts = {}) {
    const mods = _roleBodyMods(p.role);
    const morph = p.morph || _elementMorph(p.element);
    const variant = p.variant != null ? p.variant : 0;
    const isFusion = !!(p.visual && p.visual.fusion);
    const pose = opts.pose || 'idle';
    // Visual mass only: ~two-slime volume in the drawing
    const mass = isFusion ? 1.55 : 1;
    const oy = (opts.oy != null ? opts.oy : 0) + (mods.oy || 0) + (isFusion ? 1 : 0);
    let bx = opts.bx != null ? opts.bx : mods.bx * (morph.base || 1) * mass;
    let by = opts.by != null ? opts.by : mods.by * (morph.base || 1) * mass;
    let topRy = opts.topRy != null ? opts.topRy : mods.topRy * (morph.top || 1) * (isFusion ? 1.25 : 1);
    bx += (variant % 3) - 1;
    by += ((variant + 1) % 3) - 1;
    topRy += (variant % 2) * 0.5;
    if (isFusion) {
        bx = Math.min(42, bx + 6);
        by = Math.min(38, by + 6);
        topRy = Math.min(30, topRy + 4);
    }
    // Pose-driven squash / stretch (fluid dynamics)
    if (pose === 'cast') {
        bx *= 1.08; by *= 0.88; topRy *= 0.9; // flatten, gather
    } else if (pose === 'attack') {
        bx *= 0.92; by *= 1.12; topRy *= 1.08; // stretch forward
    } else if (pose === 'hit') {
        bx *= 1.14; by *= 0.82; // impact splat
    } else if (pose === 'heal') {
        by *= 1.06; topRy *= 1.05;
    }
    const eyeMode = opts.eyeMode || (p.fierce ? 'fierce' : 'normal');
    const eyeOy = oy + (morph.peak ? -4 : morph.goop >= 3 || morph.shape === 'mud' ? 4 : 0) + (isFusion ? -3 : 0)
        + (pose === 'hit' ? 2 : pose === 'attack' ? -4 : 0);
    const gear = opts.skipGear ? '' : _roleGearSvg(p.role, p, oy - (isFusion ? 2 : 0));
    const limbs = opts.skipLimbs ? '' : _slimeFluidLimbs(p, pose, oy);
    return `
        ${_slimeFlair(p, oy)}
        ${gear}
        ${_slimeBodySilhouette(p, bx, by, topRy, oy, morph, variant)}
        ${_fusionMassExtras(p, bx, by, oy)}
        ${limbs}
        ${_slimeEyes(p, 0, eyeOy, eyeMode)}
        ${_slimeElemBits(p.element, oy)}
        ${opts.extra || ''}
    `;
}

function buildSlimeFighterHTML(unit) {
    const p = _slimePosePalette(unit);
    // Arena fusion form always gets fusion visual flair + dual element mass
    if (unit.arenaFused || unit.visual?.fusion || unit.fusionMass) {
        const pe = unit.fusionPartnerElement || unit.visual?.partnerElement;
        const palB = pe && SLIME_ICON_PALETTES[pe] ? SLIME_ICON_PALETTES[pe] : null;
        p.visual = {
            ...(p.visual || {}),
            fusion: true,
            fusionMass: true,
            glow: true,
            mythic: true,
            eyes: 'fierce',
            accessory: (p.visual && p.visual.accessory) || (pe && pe !== p.element ? 'wing' : 'crown'),
            aura: (p.visual && p.visual.aura) || '#c084fc',
            aura2: (p.visual && p.visual.aura2) || (palB ? palB.accent : '#fff59d'),
            partnerElement: pe || p.element,
            partnerBody: (p.visual && p.visual.partnerBody) || (palB ? palB.body : p.accent),
            partnerDark: (p.visual && p.visual.partnerDark) || (palB ? palB.dark : p.dark)
        };
        p.isChamp = true;
        p.fierce = true;
    }
    const name = unit.name || p.element;
    const isFusion = !!(p.visual && p.visual.fusion);

    const mods = _roleBodyMods(p.role);
    const morph = p.morph || _elementMorph(p.element);
    const mass = isFusion ? 1.55 : 1;
    const mbx = mods.bx * (morph.base || 1) * mass + (isFusion ? 6 : 0);
    const mby = mods.by * (morph.base || 1) * mass + (isFusion ? 6 : 0);
    const mtop = mods.topRy * (morph.top || 1) * (isFusion ? 1.25 : 1);
    // Multi-frame poses: fluid limbs + squash/stretch per action
    const poses = {
        idle: _slimeBodyCore(p, { pose: 'idle', eyeMode: p.fierce ? 'fierce' : 'normal' }),
        cast: _slimeBodyCore(p, {
            pose: 'cast',
            oy: 4, bx: Math.max(16, mbx - 1), by: Math.max(12, mby - 3), topRy: Math.max(11, mtop - 2),
            eyeMode: 'fierce'
        }),
        attack: _slimeBodyCore(p, {
            pose: 'attack',
            oy: -5, bx: Math.max(16, mbx - 3), by: Math.max(18, mby + 3), topRy: Math.max(14, mtop),
            eyeMode: 'fierce'
        }),
        hit: _slimeBodyCore(p, {
            pose: 'hit',
            oy: 5, bx: mbx + 4, by: Math.max(11, mby - 6), topRy: Math.max(10, mtop - 5),
            eyeMode: 'hit'
        }),
        heal: _slimeBodyCore(p, {
            pose: 'heal',
            oy: -3, bx: mbx + 1, by: mby + 1, topRy: mtop + 1,
            eyeMode: 'normal'
        }),
        death: `
            ${_slimeBodySilhouette(p, mbx + 6, Math.max(10, mby - 4), mtop - 2, 12, morph, p.variant || 0)}
            ${_slimeFluidLimbs(p, 'death', 12)}
            <g transform="rotate(-12 34 64)">
                ${_slimeEyes(p, 4, 18, 'closed')}
            </g>
        `
    };

    const poseGroups = Object.entries(poses).map(([pose, content]) =>
        `<g class="pose pose-${pose}">${content}</g>`
    ).join('');

    // Tank/brute bulk; assassin small; fusion draws ~2× gel volume (visual only)
    let scale = (mods.scale || 1) * (morph.goop >= 3 ? 1.04 : morph.peak ? 1.06 : morph.shape === 'mud' ? 1.08 : 1);
    if (isFusion) scale *= 1.55;
    const goopCls = morph.goop >= 2 ? ' fluid-goop' : morph.shape === 'mud' ? ' fluid-mud' : morph.goop === 0 ? ' fluid-rigid' : ' fluid-soft';
    const svg = `<svg class="fighter-svg slime-fighter-svg multi-pose role-${p.role || 'striker'} morph-${morph.shape || 'blob'}${isFusion ? ' fusion-form' : ''}${goopCls}" viewBox="${isFusion ? '-10 -4 84 102' : '-4 0 72 90'}" width="${Math.round(96 * scale)}" height="${Math.round(132 * scale)}" role="img" aria-label="${name}">
        <ellipse class="fighter-ground-shadow" cx="32" cy="${isFusion ? 92 : 84}" rx="${(isFusion ? 34 : 22) + Math.max(0, mbx - 26)}" ry="${isFusion ? 9 : 5}" fill="#000" opacity="0.42"/>
        ${poseGroups}
    </svg>`;

    return `<div class="combat-fighter slime-fighter multi-pose-fighter role-${p.role || 'striker'} morph-${morph.shape || 'blob'}${goopCls}${p.isChamp ? ' fighter-champion' : ''}${isFusion ? ' fighter-fusion' : ''} anim-idle" data-element="${p.element}" data-role="${p.role || 'striker'}" data-morph="${morph.shape || 'blob'}" data-limb="${morph.limb || 'soft'}" data-pose="idle">
        ${svg}
    </div>`;
}

function _foeFigure(kind, body, dark, accent, pose = 'idle') {
    // Pose offsets for limbs / lean
    const attack = pose === 'attack';
    const cast = pose === 'cast';
    const hit = pose === 'hit';
    const death = pose === 'death';
    const heal = pose === 'heal';

    if (kind === 'beast') {
        if (death) {
            return `<ellipse cx="36" cy="70" rx="24" ry="10" fill="${body}" transform="rotate(20 36 70)"/>
                <ellipse cx="52" cy="64" rx="10" ry="8" fill="${body}"/>
                <circle cx="56" cy="62" r="2.5" fill="${dark}"/>
                <path d="M14 68 L10 78 M28 72 L24 80" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>`;
        }
        if (attack) {
            return `<ellipse cx="30" cy="54" rx="20" ry="11" fill="${body}"/>
                <ellipse cx="50" cy="40" rx="13" ry="11" fill="${body}"/>
                <circle cx="56" cy="36" r="3" fill="${dark}"/><circle cx="58" cy="35" r="1.2" fill="#fff"/>
                <path d="M12 52 L8 70 M20 56 L16 74 M38 56 L42 74 M48 50 L58 64" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>
                <path d="M60 38 L68 28" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                <path d="M58 30 l8-4 2 6z" fill="${accent}"/>`;
        }
        if (hit) {
            return `<ellipse cx="36" cy="58" rx="22" ry="11" fill="${body}" transform="rotate(8 36 58)"/>
                <ellipse cx="50" cy="50" rx="11" ry="9" fill="${body}"/>
                <path d="M48 48 L54 46 M50 52 L56 54" stroke="#1a1a2e" stroke-width="1.5"/>
                <path d="M12 56 L16 76 M24 60 L22 78 M42 60 L46 78 M52 56 L58 72" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>
                <path d="M8 40 L14 46 M54 34 L60 40" stroke="#ff6666" stroke-width="2"/>`;
        }
        return `<ellipse cx="32" cy="58" rx="22" ry="12" fill="${body}"/>
            <ellipse cx="48" cy="48" rx="12" ry="10" fill="${body}"/>
            <circle cx="54" cy="44" r="3" fill="${dark}"/><circle cx="56" cy="43" r="1.2" fill="#fff"/>
            <path d="M10 58 L14 78 M22 62 L20 80 M40 62 L42 80 M50 58 L54 76" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>
            <path d="M58 48 Q64 40 60 36" stroke="${dark}" stroke-width="2" fill="none"/>
            <ellipse cx="18" cy="50" rx="4" ry="6" fill="${accent}" opacity="0.7"/>
            ${cast ? `<ellipse cx="32" cy="36" rx="16" ry="6" fill="none" stroke="${accent}" stroke-width="2" opacity="0.6"/>` : ''}
            ${heal ? `<circle cx="24" cy="36" r="3" fill="#69f0ae" opacity="0.7"/>` : ''}`;
    }

    if (kind === 'construct') {
        if (death) {
            return `<rect x="16" y="50" width="32" height="20" rx="3" fill="${body}" transform="rotate(25 32 60)"/>
                <rect x="20" y="38" width="16" height="12" rx="2" fill="${dark}" transform="rotate(25 28 44)"/>
                <circle cx="40" cy="42" r="2" fill="#666"/>`;
        }
        if (attack) {
            return `<rect x="18" y="26" width="28" height="36" rx="4" fill="${body}" stroke="${dark}" stroke-width="1.5"/>
                <rect x="22" y="12" width="20" height="16" rx="3" fill="${dark}"/>
                <rect x="26" y="16" width="12" height="6" rx="1" fill="${accent}"/>
                <rect x="8" y="30" width="12" height="8" rx="2" fill="${body}" transform="rotate(-35 14 34)"/>
                <rect x="44" y="28" width="18" height="8" rx="2" fill="${body}" transform="rotate(25 53 32)"/>
                <rect x="20" y="64" width="10" height="14" rx="2" fill="${dark}"/>
                <rect x="34" y="64" width="10" height="14" rx="2" fill="${dark}"/>
                <circle cx="28" cy="20" r="2" fill="#ffee88"/><circle cx="36" cy="20" r="2" fill="#ffee88"/>`;
        }
        return `<rect x="18" y="28" width="28" height="36" rx="4" fill="${body}" stroke="${dark}" stroke-width="1.5"/>
            <rect x="22" y="14" width="20" height="16" rx="3" fill="${dark}"/>
            <rect x="26" y="18" width="12" height="6" rx="1" fill="${accent}" opacity="0.8"/>
            <rect x="12" y="${hit ? 38 : 34}" width="8" height="22" rx="2" fill="${body}"/>
            <rect x="44" y="${hit ? 38 : 34}" width="8" height="22" rx="2" fill="${body}"/>
            <rect x="20" y="64" width="10" height="14" rx="2" fill="${dark}"/>
            <rect x="34" y="64" width="10" height="14" rx="2" fill="${dark}"/>
            <circle cx="28" cy="22" r="2" fill="${hit ? '#ff6666' : '#ffee88'}"/><circle cx="36" cy="22" r="2" fill="${hit ? '#ff6666' : '#ffee88'}"/>
            ${cast ? `<rect x="14" y="20" width="36" height="4" rx="1" fill="${accent}" opacity="0.5"/>` : ''}`;
    }

    if (kind === 'undead') {
        if (death) {
            return `<ellipse cx="40" cy="68" rx="10" ry="8" fill="#e8e0d0" transform="rotate(40 40 68)"/>
                <path d="M30 60 L50 72" stroke="#d0c8b8" stroke-width="5"/>
                <path d="M48 50 L58 40" stroke="${accent}" stroke-width="2"/>`;
        }
        if (attack) {
            return `<ellipse cx="32" cy="18" rx="10" ry="11" fill="#e8e0d0" stroke="${dark}"/>
                <path d="M32 28 V50" stroke="#d0c8b8" stroke-width="6" stroke-linecap="round"/>
                <path d="M32 36 L14 28 M32 36 L54 24" stroke="#d0c8b8" stroke-width="4" stroke-linecap="round"/>
                <path d="M32 50 L24 74 M32 50 L40 74" stroke="#d0c8b8" stroke-width="4" stroke-linecap="round"/>
                <path d="M54 24 L64 10" stroke="${accent}" stroke-width="2.5"/>
                <path d="M62 8 l6 2 -2 6z" fill="${accent}"/>
                <rect x="28" y="12" width="3" height="4" fill="${dark}"/><rect x="33" y="12" width="3" height="4" fill="${dark}"/>`;
        }
        return `<ellipse cx="32" cy="20" rx="10" ry="11" fill="#e8e0d0" stroke="${dark}" stroke-width="1"/>
            <rect x="28" y="14" width="3" height="4" fill="${dark}" opacity="0.5"/><rect x="33" y="14" width="3" height="4" fill="${dark}" opacity="0.5"/>
            <path d="M26 24 H38" stroke="${dark}" stroke-width="1.2"/>
            <path d="M32 30 V58" stroke="#d0c8b8" stroke-width="6" stroke-linecap="round"/>
            <path d="M32 38 L${hit ? 22 : 18} ${hit ? 54 : 50} M32 38 L${hit ? 48 : 46} ${hit ? 54 : 50}" stroke="#d0c8b8" stroke-width="4" stroke-linecap="round"/>
            <path d="M32 58 L24 76 M32 58 L40 76" stroke="#d0c8b8" stroke-width="4" stroke-linecap="round"/>
            <path d="M46 48 L54 ${cast ? 28 : 36}" stroke="${accent}" stroke-width="2.5"/>
            <path d="M52 ${cast ? 26 : 34} l6 2 -2 6z" fill="${accent}"/>`;
    }

    if (kind === 'spirit' || kind === 'elemental') {
        if (death) {
            return `<ellipse cx="32" cy="60" rx="18" ry="8" fill="${body}" opacity="0.35"/>
                <path d="M20 50 Q32 70 44 50" fill="${body}" opacity="0.3"/>`;
        }
        const ry = attack ? 32 : hit ? 22 : 28;
        return `<ellipse cx="32" cy="${attack ? 34 : 40}" rx="16" ry="${ry}" fill="${body}" opacity="0.75"/>
            <ellipse cx="32" cy="${attack ? 30 : 36}" rx="12" ry="16" fill="${accent}" opacity="0.35"/>
            <ellipse cx="26" cy="${attack ? 28 : 34}" rx="3" ry="4" fill="#fff" opacity="0.9"/>
            <ellipse cx="38" cy="${attack ? 28 : 34}" rx="3" ry="4" fill="#fff" opacity="0.9"/>
            <ellipse cx="27" cy="${attack ? 29 : 35}" rx="1.2" ry="1.6" fill="${hit ? '#c62828' : dark}"/>
            <ellipse cx="39" cy="${attack ? 29 : 35}" rx="1.2" ry="1.6" fill="${hit ? '#c62828' : dark}"/>
            <path d="M20 58 Q32 72 44 58" fill="${body}" opacity="0.5"/>
            ${cast || heal ? `<ellipse cx="32" cy="18" rx="14" ry="5" fill="none" stroke="${heal ? '#69f0ae' : accent}" stroke-width="2" opacity="0.8"/>` : ''}
            ${attack ? `<path d="M32 8 L36 18 L32 14 L28 18 Z" fill="${accent}"/>` : ''}`;
    }

    // human / default
    if (death) {
        return `<ellipse cx="40" cy="66" rx="9" ry="9" fill="#e0b090" transform="rotate(50 40 66)"/>
            <path d="M28 58 L48 70 L44 78 L24 66 Z" fill="${body}" transform="rotate(30 36 68)"/>
            <path d="M50 48 L58 40" stroke="${accent}" stroke-width="2"/>`;
    }
    if (attack) {
        return `<ellipse cx="32" cy="14" rx="9" ry="10" fill="#e0b090" stroke="${dark}" stroke-width="0.8"/>
            <path d="M22 12 Q32 6 42 12" fill="${dark}" opacity="0.85"/>
            <path d="M24 26 L40 26 L38 50 L26 50 Z" fill="${body}" stroke="${dark}" stroke-width="1"/>
            <path d="M26 26 L12 18 L14 24 L28 30" fill="${body}"/>
            <path d="M38 26 L56 14 L52 20 L36 30" fill="${body}"/>
            <path d="M28 50 L26 74 L30 74 L32 50" fill="${dark}"/>
            <path d="M36 50 L34 74 L38 74 L38 50" fill="${dark}"/>
            <path d="M54 16 L64 4" stroke="${accent}" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M62 2 l7 2 -2 6z" fill="${accent}"/>
            <rect x="24" y="28" width="16" height="6" rx="1" fill="${dark}" opacity="0.4"/>`;
    }
    return `<ellipse cx="32" cy="16" rx="9" ry="10" fill="#e0b090" stroke="${dark}" stroke-width="0.8"/>
        <path d="M22 14 Q32 8 42 14" fill="${dark}" opacity="0.85"/>
        <path d="M24 28 L40 28 L38 52 L26 52 Z" fill="${body}" stroke="${dark}" stroke-width="1"/>
        <path d="M26 28 L${hit ? 24 : 20} ${hit ? 48 : 44} L24 46 L28 32" fill="${body}"/>
        <path d="M38 28 L${hit ? 44 : 48} ${hit ? 44 : 40} L44 44 L36 32" fill="${body}"/>
        <path d="M28 52 L26 74 L30 74 L32 52" fill="${dark}"/>
        <path d="M36 52 L34 74 L38 74 L38 52" fill="${dark}"/>
        <path d="M48 38 L56 ${cast ? 18 : 22}" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M54 ${cast ? 14 : 18} l6 3 -2 6z" fill="${accent}"/>
        <rect x="24" y="30" width="16" height="6" rx="1" fill="${dark}" opacity="0.4"/>
        ${hit ? `<path d="M10 28 L16 34 M48 20 L54 26" stroke="#ff6666" stroke-width="2"/>` : ''}
        ${heal ? `<circle cx="20" cy="22" r="3" fill="#69f0ae" opacity="0.75"/>` : ''}`;
}

function buildFoeFighterHTML(unit) {
    const kind = unit.kind || 'human';
    const element = unit.element || 'Earth';
    const pal = SLIME_ICON_PALETTES[element] || SLIME_ICON_PALETTES.Earth;
    const body = pal.body;
    const dark = pal.dark;
    const accent = pal.accent;
    const icon = unit.enemyIcon || '⚔️';
    const name = unit.name || 'Foe';

    const poseList = ['idle', 'cast', 'attack', 'hit', 'heal', 'death'];
    const poseGroups = poseList.map(pose =>
        `<g class="pose pose-${pose}">${_foeFigure(kind, body, dark, accent, pose)}</g>`
    ).join('');

    const svg = `<svg class="fighter-svg foe-fighter-svg multi-pose kind-${kind}" viewBox="0 0 64 88" width="96" height="132" role="img" aria-label="${name}">
        <ellipse class="fighter-ground-shadow" cx="32" cy="82" rx="20" ry="5" fill="#000" opacity="0.4"/>
        ${poseGroups}
        <g class="foe-emoji-badge" transform="translate(44,8)">
            <circle r="9" fill="rgba(0,0,0,0.45)" stroke="${accent}" stroke-width="1"/>
            <text y="4" text-anchor="middle" font-size="10">${icon}</text>
        </g>
    </svg>`;

    return `<div class="combat-fighter foe-fighter multi-pose-fighter kind-${kind} anim-idle" data-element="${element}" data-kind="${kind}" data-pose="idle">
        ${svg}
    </div>`;
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
        <div class="haven-tags"></div>
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
    card.className = 'haven-card'
        + (slime.onMission ? ' on-mission' : '')
        + (slime.favorite ? ' favorited' : '')
        + (slime.rarity ? ' rarity-' + slime.rarity : '')
        + (slime.isChampion || slime.championId ? ' is-champion' : '');
    if (!slime.onMission) card.style.borderColor = rarityColor;
    else card.style.borderColor = '#888';

    if (typeof ensureSlimeIdentity === 'function') ensureSlimeIdentity(slime);
    card.querySelector('.haven-icon').innerHTML = getSlimeIconHTML(slime, 'sm');
    const nameText = card.querySelector('.haven-name-text');
    nameText.textContent = slime.name + (slime.favorite ? ' ⭐' : '');
    const lvlBonus = prog.bonusLevels > 0 ? ` (+${prog.bonusLevels})` : '';
    card.querySelector('.haven-lvl').textContent = `Lv ${slime.level || 1}${lvlBonus}`;
    card.querySelector('.haven-pwr').textContent = `${slime.power} PWR`;
    card.removeAttribute('data-tip');
    card.removeAttribute('data-tip-title');
    const rarityEl = card.querySelector('.haven-rarity');
    const champTag = slime.isChampion || slime.championId ? ' ★' : '';
    rarityEl.textContent = `${slime.rarity}${champTag}`;
    rarityEl.style.color = rarityColor;

    // Element + Role as sibling tags (role never in the name)
    const tagsEl = card.querySelector('.haven-tags');
    if (tagsEl) {
        const roleLabel = (typeof formatSlimeRole === 'function')
            ? formatSlimeRole(slime.role)
            : (slime.role || '');
        tagsEl.innerHTML = `
            <span class="tag-pill tag-element">${slime.element || '?'}</span>
            ${roleLabel ? `<span class="tag-pill tag-role role-${slime.role}">${roleLabel}</span>` : ''}
            ${slime.isChampion || slime.championId ? '<span class="tag-pill tag-champ">Champion</span>' : ''}
        `;
    }

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

/** Item catalog for inventory tiles + hover tips */
const INVENTORY_ITEM_DEFS = {
    gold: { label: 'Gold', icon: '🪙', tip: 'Soft currency for upgrades, crafts, and the shop.' },
    slimeShards: { label: 'Slime Shards', icon: '💎', tip: 'Regular summon currency. Farm from stages, arena, and quests.' },
    divineShards: { label: 'Divine Shards', icon: '✨', tip: 'Premium summons, energy refills, and high-end costs.' },
    voidShards: { label: 'Void Shards', icon: '🕳️', tip: 'Ancient Void summons and late-game systems.' },
    skillBooks: { label: 'Skill Books', icon: '📜', tip: 'Upgrade slime skills from Manage → Upgrade Skill.' },
    wood: { label: 'Wood', icon: '🪵', tip: 'Basic material. Alchemy: Training Scrolls.' },
    jelly: { label: 'Jelly', icon: '🍮', tip: 'Core slime material for potions and crafts.' },
    herbs: { label: 'Herbs', icon: '🌿', tip: 'Alchemy ingredient for Healing Salve and more.' },
    stone: { label: 'Stone', icon: '🪨', tip: 'Alchemy ingredient for Battle Elixir.' },
    arcaneDust: { label: 'Arcane Dust', icon: '✨', tip: 'Rare dust used in advanced alchemy and research.' },
    trainingScrolls: { label: 'Training Scrolls', icon: '📜', tip: 'Boost training missions and AFK growth.' },
    battleElixir: { label: 'Battle Elixir', icon: '🧪', tip: 'Combat consumable — power for tough fights.' },
    healingSalve: { label: 'Healing Salve', icon: '💚', tip: 'Recovery item for long campaigns.' },
    fertilityPotion: { label: 'Fertility Potion', icon: '💖', tip: 'Improves breeding outcomes when used.' },
    refinedEssence: { label: 'Refined Essence', icon: '🔷', tip: 'Workshop upgrades and artifact reforge fuel.' },
    manaShards: { label: 'Mana Shards', icon: '💠', tip: 'Advanced workshop and magical crafts.' },
    explorerTonic: { label: 'Explorer Tonic', icon: '🧪', tip: 'Charges for +30 energy or better exploration yields.' },
    shadowSilk: { label: 'Shadow Silk', icon: '🕸️', tip: 'Rare material from dark regions and endgame.' }
};

function renderInventory() {
    const container = document.getElementById('inventoryGrid');
    if (!container) return;
    container.innerHTML = '';

    const items = Object.keys(INVENTORY_ITEM_DEFS).map(key => ({
        key,
        ...INVENTORY_ITEM_DEFS[key]
    }));

    if (game.artifacts?.length > 0) {
        const artDiv = document.createElement('div');
        artDiv.className = 'inv-tile inv-artifacts';
        artDiv.setAttribute('data-tip-title', '⚔️ Artifacts');
        artDiv.setAttribute('data-tip', 'Gear pieces you can equip on slimes. Open a slime profile to equip. Count: ' + game.artifacts.length);
        artDiv.innerHTML = `<span class="inv-ico">⚔️</span><span class="inv-name">Artifacts</span><span class="inv-amt">${game.artifacts.length}</span>
            <span class="inv-sub">${game.artifacts.slice(0, 4).map(a => `${a.icon || ''} ${a.slot}`).join(' · ')}${game.artifacts.length > 4 ? '…' : ''}</span>`;
        container.appendChild(artDiv);
    }

    let shown = 0;
    items.forEach(item => {
        const val = game.resources[item.key] || 0;
        if (val <= 0) return;
        shown++;
        const div = document.createElement('div');
        div.className = 'inv-tile';
        div.setAttribute('data-tip-title', `${item.icon} ${item.label}`);
        div.setAttribute('data-tip', item.tip + ` You have ${val}.`);
        div.innerHTML = `<span class="inv-ico">${item.icon}</span><span class="inv-name">${item.label}</span><span class="inv-amt">${val}</span>`;
        container.appendChild(div);
    });

    if (shown === 0 && !(game.artifacts?.length)) {
        container.innerHTML = '<div class="inv-empty">Inventory is empty. Clear stages and craft in Alchemy to fill this bag.</div>';
    }
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


// ==================== SLIME DETAIL MODAL ====================
function _escAttr(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function openSlimeDetail(slimeId) {
    detailSlimeId = slimeId;
    const slime = game.slimes.find(s => s.id === slimeId);
    if (!slime) return;
    migrateSlime(slime);
    if (typeof ensureSlimeIdentity === 'function') ensureSlimeIdentity(slime);

    const isChamp = !!(slime.isChampion || slime.championId);
    const champStar = isChamp ? ' <span style="color:#ffdd77;">★ Champion</span>' : '';
    document.getElementById('detailSlimeName').innerHTML = `${_escAttr(slime.name)}${champStar} <span class="asc-badge">★${slime.ascension || 0}</span>`;
    const artBonus = getArtifactBonuses(slime);
    const roleLabel = (typeof formatSlimeRole === 'function')
        ? formatSlimeRole(slime.role)
        : (slime.role || '');
    const lore = (typeof getSlimeDescription === 'function')
        ? getSlimeDescription(slime)
        : '';

    // Skills: visible desc + rich data-tip hover (custom tooltip system, not native title)
    let skillsHTML = (slime.skills || []).map(s => {
        const def = SKILL_DEFS[s.id] || { name: s.id, desc: 'No description.', icon: '❓', type: 'active', cooldown: 0 };
        const uniq = def.unique ? ' unique-skill' : '';
        const typeLabel = def.type === 'passive' ? 'Passive' : (def.cooldown ? `Active · CD ${def.cooldown}` : 'Active · Ready');
        const tipBody = `${def.desc || 'No description available.'}${def.unique ? ' ★ Signature skill.' : ''}`;
        const tipTitle = `${def.icon || ''} ${def.name} · Lv${s.level || 1}`.trim();
        return `<div class="skill-row ${def.type === 'passive' ? 'passive' : ''}${uniq}"
            data-tip-title="${_escAttr(tipTitle)}"
            data-tip="${_escAttr(tipBody + ' (' + typeLabel + ')')}">
            <div class="skill-row-head">
                <span class="skill-pill ${def.type === 'passive' ? 'passive' : ''}${uniq}">${def.icon} ${def.name}${def.unique ? ' ★' : ''} Lv${s.level || 1}</span>
                <span class="skill-row-meta">${typeLabel}</span>
            </div>
            <div class="skill-row-desc">${_escAttr(def.desc || 'No description available.')}</div>
        </div>`;
    }).join('');

    let artifactsHTML = ARTIFACT_SLOTS.map(slot => {
        const art = slime.artifacts?.[slot];
        if (art) {
            return `<div class="artifact-slot filled"
                data-tip-title="${_escAttr(art.icon || '⚔️')} ${_escAttr(art.name || slot)}"
                data-tip="${_escAttr((art.set ? art.set + ' set · ' : '') + 'Slot: ' + slot)}">
                <span class="slot-icon">${art.icon}</span>${slot}</div>`;
        }
        return `<div class="artifact-slot" data-tip-title="Empty ${slot}" data-tip="No artifact equipped in this slot.">
            <span class="slot-icon">➕</span>${slot}</div>`;
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
            <div class="slime-card rarity-${slime.rarity}" style="display:inline-block; min-width:200px;">
                ${getSlimeIconHTML(slime, 'xl')}
                <div style="color:${getRarityColor(slime.rarity)}; font-weight:bold; margin-top:4px;">
                    ${slime.rarity}${isChamp ? ' Champion' : ''}
                </div>
                <div class="detail-tag-row">
                    <span class="tag-pill tag-element">${_escAttr(slime.element || '?')}</span>
                    ${roleLabel ? `<span class="tag-pill tag-role role-${_escAttr(slime.role)}">${_escAttr(roleLabel)}</span>` : ''}
                    <span class="tag-pill tag-faction">${_escAttr(slime.faction || '')}</span>
                </div>
                ${slime.species && isChamp ? `<div style="font-size:10px;opacity:0.8;margin-top:4px;">Species type: ${_escAttr(slime.species)}</div>` : ''}
            </div>
        </div>
        ${lore ? `<div class="slime-lore">${_escAttr(lore)}</div>` : ''}
        <div class="detail-stat-grid">
            <div class="detail-stat">⚡ Power: <strong>${slime.power}</strong></div>
            <div class="detail-stat">📊 Level: <strong>${slime.level}</strong></div>
            <div class="detail-stat">✨ EXP: <strong>${expProg.exp}</strong> <small>(${expProg.expInLevel}/${SLIME_EXP_PER_LEVEL})</small></div>
            <div class="detail-stat">🏃 SPD: <strong>${slime.speed || slime.combatSpd || '—'}</strong></div>
            <div class="detail-stat">⬆️ Ascension: <strong>${slime.ascension || 0}/4</strong></div>
            ${roleLabel ? `<div class="detail-stat">🎭 Role: <strong>${_escAttr(roleLabel)}</strong></div>` : ''}
        </div>
        ${typeof getEffectiveSlimeStats === 'function' ? (() => {
            if (typeof ensureSlimeStats === 'function') ensureSlimeStats(slime);
            const eff = getEffectiveSlimeStats(slime);
            const base = slime.stats || {};
            const derived = (typeof deriveCombatFromStats === 'function') ? deriveCombatFromStats(slime) : null;
            const keys = (typeof SLIME_STAT_KEYS !== 'undefined' ? SLIME_STAT_KEYS : Object.keys(eff));
            const bars = keys.map(k => {
                const meta = (typeof SLIME_STAT_META !== 'undefined' && SLIME_STAT_META[k]) ? SLIME_STAT_META[k] : { name: k, short: k, color: '#77ffaa', desc: '' };
                const val = eff[k] || 0;
                const baseV = base[k] || val;
                const pct = Math.min(100, Math.round((val / 220) * 100));
                return `<div class="primary-stat-row"
                    data-tip-title="${_escAttr(meta.name || k)}"
                    data-tip="${_escAttr(meta.desc || '')} Base ${baseV} → effective ${val} at current level.">
                    <span class="primary-stat-key" style="color:${meta.color}">${meta.short}</span>
                    <div class="primary-stat-bar"><div class="primary-stat-fill" style="width:${pct}%;background:${meta.color}"></div></div>
                    <span class="primary-stat-val">${val}<small class="primary-stat-base">(${baseV})</small></span>
                </div>`;
            }).join('');
            const combatLine = derived
                ? `<div class="combat-derived-line">
                    <span data-tip-title="Hit Points" data-tip="Max HP in combat from VIT / RES / rarity.">❤️ ${derived.hp}</span>
                    <span data-tip-title="Attack" data-tip="Damage power from STR / MAG and role.">⚔️ ${derived.atk}</span>
                    <span data-tip-title="Defense" data-tip="Damage reduction from RES / VIT.">🛡️ ${derived.def}</span>
                    <span data-tip-title="Speed" data-tip="Turn meter speed from AGI.">💨 ${derived.spd}</span>
                    <span data-tip-title="Crit Rate" data-tip="Chance to land a critical hit.">🎯 ${Math.round(derived.critRate * 100)}%</span>
                    <span data-tip-title="Crit Damage" data-tip="Damage multiplier when you crit.">💥 ${Math.round(derived.critDmg * 100)}%</span>
                   </div>`
                : '';
            return `<h4>Primary Stats <small style="opacity:0.7;font-weight:normal;">(Raid-style · level scales)</small></h4>
                <div class="primary-stat-list">${bars}</div>
                ${combatLine}
                <div style="font-size:9px;opacity:0.65;margin:4px 0 8px;">Base in ( ) · bars show effective at current level</div>`;
        })() : ''}
        <div class="haven-exp-bar" style="margin:8px 0;"><div class="haven-exp-fill" style="width:${expProg.pct}%;"></div></div>
        <h4>Skills <small style="opacity:0.7;font-weight:normal;">(hover or read description)</small></h4>
        <div class="skill-list">${skillsHTML || 'None'}</div>
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

