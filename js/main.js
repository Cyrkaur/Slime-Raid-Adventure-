/* ===== js/main.js — split from Single File/index-3.html ===== */

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
    if (typeof startIdleMarch === 'function') startIdleMarch();

    if (hadSave) {
        log('✅ Save loaded — v' + SAVE_VERSION);
    } else {
        log('Welcome to Slime Adventure! A mysterious slime has joined you!', true);
        if (starterSlime) {
            log(`${starterSlime.name} — ${starterSlime.rarity} ${starterSlime.element} slime (${starterSlime.power} PWR)`, true);
        }
    }
}

/** Floating motes behind the game shell — idle-gacha “living” world. */
function initWorldAmbience() {
    const host = document.getElementById('worldMotes');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    const n = 28;
    for (let i = 0; i < n; i++) {
        const m = document.createElement('span');
        m.className = 'world-mote';
        m.style.left = Math.random() * 100 + '%';
        m.style.bottom = (-10 - Math.random() * 30) + '%';
        m.style.width = m.style.height = (2 + Math.random() * 4) + 'px';
        m.style.animationDuration = (10 + Math.random() * 18) + 's';
        m.style.animationDelay = (-Math.random() * 20) + 's';
        m.style.opacity = String(0.25 + Math.random() * 0.55);
        if (Math.random() > 0.7) m.style.background = 'rgba(255,220,120,0.45)';
        else if (Math.random() > 0.5) m.style.background = 'rgba(140,200,255,0.4)';
        host.appendChild(m);
    }
}

/**
 * Rich hover tooltips for [data-tip] / [data-tip-title].
 * Instant feedback for currencies, tabs, inventory, haven cards, etc.
 */
function initGameTooltips() {
    const tip = document.getElementById('gameTooltip');
    const titleEl = document.getElementById('gameTooltipTitle');
    const bodyEl = document.getElementById('gameTooltipBody');
    if (!tip || !titleEl || !bodyEl || tip.dataset.ready) return;
    tip.dataset.ready = '1';

    let active = null;
    let hideTimer = null;

    const hide = () => {
        tip.hidden = true;
        tip.classList.remove('show');
        active = null;
    };

    const place = (e) => {
        const pad = 12;
        const rect = tip.getBoundingClientRect();
        let x = e.clientX + 14;
        let y = e.clientY + 16;
        if (x + rect.width > window.innerWidth - pad) x = e.clientX - rect.width - 10;
        if (y + rect.height > window.innerHeight - pad) y = e.clientY - rect.height - 10;
        if (x < pad) x = pad;
        if (y < pad) y = pad;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
    };

    const showFor = (el, e) => {
        const body = el.getAttribute('data-tip');
        if (!body) return;
        const title = el.getAttribute('data-tip-title') || '';
        titleEl.textContent = title;
        titleEl.style.display = title ? '' : 'none';
        bodyEl.textContent = body;
        tip.hidden = false;
        tip.classList.add('show');
        active = el;
        place(e);
    };

    const findTipHost = (node) => {
        let el = node;
        while (el && el !== document.body) {
            if (el.getAttribute && el.getAttribute('data-tip')) return el;
            el = el.parentElement;
        }
        return null;
    };

    document.addEventListener('pointerover', (e) => {
        const host = findTipHost(e.target);
        if (!host) return;
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (active === host) return;
        showFor(host, e);
    }, true);

    document.addEventListener('pointerout', (e) => {
        const host = findTipHost(e.target);
        if (!host || host !== active) return;
        const to = e.relatedTarget;
        if (to && host.contains(to)) return;
        hideTimer = setTimeout(hide, 40);
    }, true);

    document.addEventListener('pointermove', (e) => {
        if (!active || tip.hidden) return;
        place(e);
    }, { passive: true });

    // Don't hide on modal scroll bubbling — only window-level scroll of the page
    window.addEventListener('scroll', () => { if (active) hide(); }, true);

    // Ensure tip paints above modals (combat / profile)
    tip.style.zIndex = '100000';
}

initWorldAmbience();
initGameTooltips();
initGame();