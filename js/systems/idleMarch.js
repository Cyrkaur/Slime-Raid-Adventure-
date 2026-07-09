/* ===== Idle Wilds Patrol — side-scroll march for passive gains ===== */

const IDLE_MARCH = {
    running: false,
    raf: null,
    lastTs: 0,
    scrollX: 0,
    /** Pixel width of one seamless scenery tile (must match CSS / prop layout) */
    tileW: 720,
    phase: 'walk', // walk | fight | loot
    phaseT: 0,
    nextFightAt: 2.5,
    foe: null,
    session: { gold: 0, jelly: 0, shards: 0, kills: 0, exp: 0 },
    feed: [],
    saveAccum: 0
};

const IDLE_MARCH_FOES = {
    1: [
        { name: 'Bandit', icon: '🗡️', el: 'Earth' },
        { name: 'Wolf', icon: '🐺', el: 'Wind' },
        { name: 'Thicket Sprite', icon: '🍃', el: 'Plant' },
        { name: 'River Rat', icon: '🐀', el: 'Water' }
    ],
    2: [
        { name: 'Ice Raider', icon: '🪓', el: 'Ice' },
        { name: 'Stone Golem', icon: '🗿', el: 'Earth' },
        { name: 'Cliff Hawk', icon: '🦅', el: 'Wind' },
        { name: 'Frostling', icon: '❄️', el: 'Ice' }
    ],
    3: [
        { name: 'Cult Acolyte', icon: '🕯️', el: 'Shadow' },
        { name: 'Mire Beast', icon: '🐸', el: 'Poison' },
        { name: 'Ruin Wisp', icon: '👻', el: 'Spirit' },
        { name: 'Bog Serpent', icon: '🐍', el: 'Poison' }
    ],
    4: [
        { name: 'Ash Elemental', icon: '🔥', el: 'Fire' },
        { name: 'Magma Crawler', icon: '🪲', el: 'Lava' },
        { name: 'Ice Knight', icon: '🛡️', el: 'Ice' },
        { name: 'Storm Zealot', icon: '⚡', el: 'Storm' }
    ],
    5: [
        { name: 'Void Cultist', icon: '🕳️', el: 'Void' },
        { name: 'Star Construct', icon: '✨', el: 'Light' },
        { name: 'Abyss Hound', icon: '🐶', el: 'Shadow' },
        { name: 'Crystal Shade', icon: '💎', el: 'Crystal' }
    ]
};

function getIdleMarchChapter() {
    const id = (game.campaign && game.campaign.selectedChapter) || 1;
    return (typeof CAMPAIGN_CHAPTERS !== 'undefined' && CAMPAIGN_CHAPTERS.find(c => c.id === id))
        || { id: 1, name: 'Verdant Wilds', icon: '🌲' };
}

function getIdleMarchTeam() {
    let team = [];
    if (typeof getCampaignTeam === 'function') {
        team = getCampaignTeam().filter(s => s && !s.onMission);
    }
    if (!team.length && typeof getTopSlimes === 'function') {
        team = getTopSlimes(4).filter(s => s && !s.onMission);
    }
    return team.slice(0, 4);
}

function getIdleMarchTeamPower() {
    const team = getIdleMarchTeam();
    if (!team.length) return 40;
    return team.reduce((s, x) => s + (x.power || 20), 0);
}

/** Per-minute baseline rates from team power + chapter depth */
function getIdleMarchRates() {
    const ch = getIdleMarchChapter();
    const pwr = getIdleMarchTeamPower();
    const depth = ch.id || 1;
    const scale = Math.sqrt(Math.max(30, pwr)) * (0.85 + depth * 0.12);
    return {
        goldPerMin: 4 + scale * 0.55,
        jellyPerMin: 1.2 + scale * 0.12,
        shardsPerMin: 0.15 + scale * 0.02 + depth * 0.05,
        expPerMin: 3 + scale * 0.25,
        killsPerMin: 4 + depth * 0.8
    };
}

function ensureIdleMarchState() {
    if (!game.idleMarch) {
        game.idleMarch = {
            lastTick: Date.now(),
            totalKills: 0,
            totalGold: 0,
            paused: false
        };
    }
    if (game.idleMarch.lastTick == null) game.idleMarch.lastTick = Date.now();
    return game.idleMarch;
}

function idleMarchAddFeed(msg) {
    IDLE_MARCH.feed.unshift(msg);
    if (IDLE_MARCH.feed.length > 5) IDLE_MARCH.feed.pop();
    const el = document.getElementById('idleMarchFeed');
    if (el) {
        el.innerHTML = IDLE_MARCH.feed.map(m => `<div class="im-feed-line">${m}</div>`).join('');
    }
}

function updateIdleMarchHud() {
    const s = IDLE_MARCH.session;
    const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = Math.floor(Number(v) || 0);
    };
    set('idleMarchGold', s.gold);
    set('idleMarchJelly', s.jelly);
    set('idleMarchShards', s.shards);
    set('idleMarchKills', s.kills);
    const ch = getIdleMarchChapter();
    const title = document.getElementById('idleMarchTitle');
    if (title) title.innerHTML = `${ch.icon || '🌲'} <span>Wilds Patrol</span> · ${ch.name}`;
    const rates = getIdleMarchRates();
    const rateEl = document.getElementById('idleMarchRate');
    if (rateEl) {
        rateEl.textContent = `~${Math.round(rates.goldPerMin)}🪙 / min · team ${getIdleMarchTeamPower()} PWR`;
    }
}

function renderIdleMarchParty() {
    const host = document.getElementById('idleMarchParty');
    if (!host) return;
    const team = getIdleMarchTeam();
    if (!team.length) {
        host.innerHTML = '<div class="im-empty-party">Recruit slimes to patrol…</div>';
        return;
    }
    host.innerHTML = team.map((s, i) => {
        const icon = (typeof getSlimeIconHTML === 'function')
            ? getSlimeIconHTML(s, 'sm', false)
            : '🫧';
        return `<div class="im-unit im-ally" style="--i:${i}">
            <div class="im-unit-art">${icon}</div>
            <div class="im-unit-shadow"></div>
        </div>`;
    }).join('');
}

/** One tile of mid-ground props — duplicated so scroll can loop forever. */
function _idleMarchPropSegmentHTML(chapterId, tileW) {
    const id = chapterId || 1;
    const pieces = [];
    const step = 64;
    const count = Math.ceil(tileW / step) + 1;
    for (let i = 0; i < count; i++) {
        const x = (i * step + (i % 3) * 6) % tileW;
        if (id === 1) {
            const h = 40 + (i % 5) * 9;
            pieces.push(`<span class="im-prop im-tree" style="left:${x}px;--h:${h}px"></span>`);
            if (i % 3 === 0) pieces.push(`<span class="im-prop im-bush" style="left:${(x + 30) % tileW}px"></span>`);
        } else if (id === 2) {
            pieces.push(`<span class="im-prop im-peak" style="left:${x}px;--h:${42 + (i % 4) * 12}px"></span>`);
            if (i % 3 === 0) pieces.push(`<span class="im-prop im-pine" style="left:${(x + 22) % tileW}px"></span>`);
        } else if (id === 3) {
            pieces.push(`<span class="im-prop im-ruin" style="left:${x}px;--h:${30 + (i % 3) * 10}px"></span>`);
            if (i % 3 === 1) pieces.push(`<span class="im-prop im-reed" style="left:${(x + 18) % tileW}px"></span>`);
        } else if (id === 4) {
            pieces.push(`<span class="im-prop im-volcano" style="left:${x}px;--h:${36 + (i % 4) * 10}px"></span>`);
            if (i % 2 === 0) pieces.push(`<span class="im-prop im-ember" style="left:${(x + 14) % tileW}px;--d:${(i % 5) * 0.3}s"></span>`);
        } else {
            pieces.push(`<span class="im-prop im-spire" style="left:${x}px;--h:${46 + (i % 5) * 10}px"></span>`);
            if (i % 2 === 0) {
                pieces.push(`<span class="im-prop im-star" style="left:${(x + 12) % tileW}px;top:${8 + (i % 6) * 6}px;--d:${(i % 4) * 0.4}s"></span>`);
            }
        }
    }
    return pieces.join('');
}

/** Build dual prop strips for seamless infinite scroll. */
function buildIdleMarchScenery(chapterId) {
    const props = document.getElementById('idleMarchProps');
    if (!props) return;
    const tileW = IDLE_MARCH.tileW || 720;
    const seg = _idleMarchPropSegmentHTML(chapterId, tileW);
    // Two identical segments side-by-side; scroll offset modulo tileW is seamless
    props.innerHTML = `
        <div class="im-props-track" style="width:${tileW * 2}px">
            <div class="im-props-seg" style="width:${tileW}px">${seg}</div>
            <div class="im-props-seg" style="width:${tileW}px">${seg}</div>
        </div>`;
    props.dataset.tileW = String(tileW);
}

function setIdleMarchTheme() {
    const root = document.getElementById('idleMarch');
    if (!root) return;
    const ch = getIdleMarchChapter();
    const cid = ch.id || 1;
    if (IDLE_MARCH._sceneryChapter !== cid) {
        IDLE_MARCH._sceneryChapter = cid;
        buildIdleMarchScenery(cid);
    }
    root.className = 'idle-march ch-theme-' + cid
        + (IDLE_MARCH.phase === 'fight' ? ' is-fighting' : '')
        + (IDLE_MARCH.phase === 'walk' ? ' is-walking' : '');
}

function spawnIdleMarchFoe() {
    const ch = getIdleMarchChapter();
    const pool = IDLE_MARCH_FOES[ch.id] || IDLE_MARCH_FOES[1];
    const t = pool[Math.floor(Math.random() * pool.length)];
    IDLE_MARCH.foe = { ...t, hp: 1 };
    const host = document.getElementById('idleMarchFoe');
    if (!host) return;
    host.innerHTML = `
        <div class="im-unit im-enemy entering">
            <div class="im-unit-art im-foe-emoji">${t.icon}</div>
            <div class="im-foe-name">${t.name}</div>
            <div class="im-unit-shadow"></div>
        </div>`;
    requestAnimationFrame(() => {
        const el = host.querySelector('.im-enemy');
        if (el) el.classList.remove('entering');
    });
}

function clearIdleMarchFoe() {
    const host = document.getElementById('idleMarchFoe');
    if (host) host.innerHTML = '';
    IDLE_MARCH.foe = null;
}

function idleMarchFloat(text, cls = 'loot') {
    const fx = document.getElementById('idleMarchFx');
    if (!fx) return;
    const el = document.createElement('div');
    el.className = 'im-float im-float-' + cls;
    el.textContent = text;
    el.style.left = (48 + Math.random() * 30) + '%';
    el.style.bottom = (36 + Math.random() * 20) + '%';
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

function idleMarchHitFx() {
    const stage = document.querySelector('#idleMarch .idle-march-stage');
    if (stage) {
        stage.classList.add('im-shake');
        setTimeout(() => stage.classList.remove('im-shake'), 280);
    }
    const foe = document.querySelector('#idleMarchFoe .im-enemy');
    if (foe) {
        foe.classList.add('im-hit');
        setTimeout(() => foe.classList.remove('im-hit'), 220);
    }
    const allies = document.querySelectorAll('#idleMarchParty .im-ally');
    allies.forEach((a, i) => {
        setTimeout(() => {
            a.classList.add('im-strike');
            setTimeout(() => a.classList.remove('im-strike'), 280);
        }, i * 40);
    });
}

function resolveIdleMarchKill() {
    const rates = getIdleMarchRates();
    // Per-kill share of ~per-minute rates at ~killsPerMin
    const kpm = Math.max(2, rates.killsPerMin);
    const gold = rates.goldPerMin / kpm * (0.75 + Math.random() * 0.5);
    const jelly = rates.jellyPerMin / kpm * (0.7 + Math.random() * 0.6);
    const shards = rates.shardsPerMin / kpm * (0.5 + Math.random() * 1);
    const exp = rates.expPerMin / kpm * (0.8 + Math.random() * 0.4);

    IDLE_MARCH.session.gold += gold;
    IDLE_MARCH.session.jelly += jelly;
    IDLE_MARCH.session.shards += shards;
    IDLE_MARCH.session.exp += exp;
    IDLE_MARCH.session.kills += 1;

    const st = ensureIdleMarchState();
    st.totalKills = (st.totalKills || 0) + 1;
    st.totalGold = (st.totalGold || 0) + gold;

    // Apply to game immediately (true idle) — bank as integers
    const goldGrant = Math.max(1, Math.round(gold));
    const jellyGrant = Math.max(0, Math.round(jelly));
    game.resources.gold = (game.resources.gold || 0) + goldGrant;
    if (jellyGrant > 0) game.resources.jelly = (game.resources.jelly || 0) + jellyGrant;
    let shardGain = 0;
    if (shards >= 0.2) {
        shardGain = Math.max(0, Math.floor(shards) + (Math.random() < (shards % 1) ? 1 : 0));
        if (shardGain > 0) {
            game.resources.slimeShards = (game.resources.slimeShards || 0) + shardGain;
            idleMarchFloat(`+${shardGain} 💎`, 'shard');
        }
    }
    idleMarchFloat(`+${goldGrant} 🪙`, 'gold');
    if (jellyGrant > 0) idleMarchFloat(`+${jellyGrant} 🍮`, 'jelly');

    // Tiny team EXP + occasional player exp
    const team = getIdleMarchTeam();
    const expEach = Math.max(1, Math.floor(exp / Math.max(1, team.length)));
    team.forEach(s => {
        s.exp = (s.exp || 0) + expEach;
    });
    IDLE_MARCH._playerExpBank = (IDLE_MARCH._playerExpBank || 0) + exp * 0.35;
    if (typeof gainPlayerExp === 'function' && IDLE_MARCH._playerExpBank >= 3) {
        const give = Math.floor(IDLE_MARCH._playerExpBank);
        IDLE_MARCH._playerExpBank -= give;
        gainPlayerExp(give);
    }

    const foeName = IDLE_MARCH.foe?.name || 'foe';
    idleMarchAddFeed(`⚔️ Defeated <b>${foeName}</b> · +${goldGrant}🪙`);
    updateIdleMarchHud();

    // Soft UI refresh (throttled)
    const now = Date.now();
    if (!IDLE_MARCH._uiAt || now - IDLE_MARCH._uiAt > 2500) {
        IDLE_MARCH._uiAt = now;
        if (typeof updateUI === 'function') updateUI();
    } else if (typeof scheduleUIUpdate === 'function') {
        // currency numbers only
        const g = document.getElementById('goldDisplay');
        if (g) g.textContent = Math.floor(game.resources.gold || 0);
        const j = document.getElementById('slimeShardDisplay');
        if (j) j.textContent = Math.floor(game.resources.slimeShards || 0);
    }
}

function applyIdleMarchOffline() {
    const st = ensureIdleMarchState();
    const now = Date.now();
    const elapsed = Math.max(0, now - (st.lastTick || now));
    st.lastTick = now;
    // Cap 6 hours offline
    const mins = Math.min(360, elapsed / 60000);
    if (mins < 0.5) return;
    const rates = getIdleMarchRates();
    const mult = mins * 0.65; // offline slightly less efficient
    const gold = rates.goldPerMin * mult;
    const jelly = rates.jellyPerMin * mult;
    const shards = Math.floor(rates.shardsPerMin * mult);
    const exp = rates.expPerMin * mult;
    const kills = Math.floor(rates.killsPerMin * mult);

    game.resources.gold = Math.floor((game.resources.gold || 0) + gold);
    game.resources.jelly = Math.floor((game.resources.jelly || 0) + jelly);
    if (shards > 0) game.resources.slimeShards = Math.floor((game.resources.slimeShards || 0) + shards);
    IDLE_MARCH.session.gold += gold;
    IDLE_MARCH.session.jelly += jelly;
    IDLE_MARCH.session.shards += shards;
    IDLE_MARCH.session.kills += kills;
    st.totalKills = (st.totalKills || 0) + kills;
    st.totalGold = (st.totalGold || 0) + gold;

    const team = getIdleMarchTeam();
    const expEach = Math.max(1, Math.floor(exp / Math.max(1, team.length)));
    team.forEach(s => { s.exp = (s.exp || 0) + expEach; });
    if (typeof gainPlayerExp === 'function') gainPlayerExp(Math.max(1, Math.floor(exp * 0.3)));

    if (mins >= 2) {
        log(`🌲 Wilds Patrol while away (~${Math.floor(mins)}m): +${Math.floor(gold)}🪙 · +${Math.floor(jelly)}🍮 · ${kills} kills`, true);
    }
}

function idleMarchLoop(ts) {
    if (!IDLE_MARCH.running) return;
    if (!IDLE_MARCH.lastTs) IDLE_MARCH.lastTs = ts;
    const dt = Math.min(0.05, (ts - IDLE_MARCH.lastTs) / 1000);
    IDLE_MARCH.lastTs = ts;

    const st = ensureIdleMarchState();
    if (st.paused) {
        IDLE_MARCH.raf = requestAnimationFrame(idleMarchLoop);
        return;
    }

    // Seamless infinite scroll — keep offset in [0, tileW)
    const speed = IDLE_MARCH.phase === 'fight' ? 8 : 48;
    const tileW = IDLE_MARCH.tileW || 720;
    IDLE_MARCH.scrollX = (IDLE_MARCH.scrollX + speed * dt) % tileW;
    const stage = document.querySelector('#idleMarch .idle-march-stage');
    if (stage) {
        // Unitless px string for calc() in CSS: --im-scroll: 123.4px
        stage.style.setProperty('--im-scroll', IDLE_MARCH.scrollX.toFixed(2) + 'px');
        stage.style.setProperty('--im-tile', tileW + 'px');
    }

    IDLE_MARCH.phaseT += dt;

    if (IDLE_MARCH.phase === 'walk') {
        if (IDLE_MARCH.phaseT >= IDLE_MARCH.nextFightAt) {
            IDLE_MARCH.phase = 'fight';
            IDLE_MARCH.phaseT = 0;
            spawnIdleMarchFoe();
            setIdleMarchTheme();
            idleMarchAddFeed(`👀 Encounter!`);
        }
    } else if (IDLE_MARCH.phase === 'fight') {
        // Hit flashes at 0.25 and 0.55
        if (IDLE_MARCH.phaseT > 0.25 && IDLE_MARCH.phaseT < 0.28) idleMarchHitFx();
        if (IDLE_MARCH.phaseT > 0.55 && IDLE_MARCH.phaseT < 0.58) idleMarchHitFx();
        if (IDLE_MARCH.phaseT >= 1.15) {
            const foe = document.querySelector('#idleMarchFoe .im-enemy');
            if (foe) foe.classList.add('im-die');
            IDLE_MARCH.phase = 'loot';
            IDLE_MARCH.phaseT = 0;
            resolveIdleMarchKill();
            setIdleMarchTheme();
        }
    } else if (IDLE_MARCH.phase === 'loot') {
        if (IDLE_MARCH.phaseT >= 0.55) {
            clearIdleMarchFoe();
            IDLE_MARCH.phase = 'walk';
            IDLE_MARCH.phaseT = 0;
            IDLE_MARCH.nextFightAt = 2.2 + Math.random() * 2.8;
            setIdleMarchTheme();
        }
    }

    // Persist tick + occasional save
    st.lastTick = Date.now();
    IDLE_MARCH.saveAccum += dt;
    if (IDLE_MARCH.saveAccum > 45) {
        IDLE_MARCH.saveAccum = 0;
        if (typeof saveGame === 'function') saveGame(true);
    }

    IDLE_MARCH.raf = requestAnimationFrame(idleMarchLoop);
}

function syncIdleMarchFromCampaign() {
    setIdleMarchTheme();
    renderIdleMarchParty();
    updateIdleMarchHud();
}

function startIdleMarch() {
    const root = document.getElementById('idleMarch');
    if (!root) return;
    ensureIdleMarchState();
    if (!IDLE_MARCH.running) {
        applyIdleMarchOffline();
        IDLE_MARCH.running = true;
        IDLE_MARCH.lastTs = 0;
        IDLE_MARCH.phase = 'walk';
        IDLE_MARCH.phaseT = 0;
        IDLE_MARCH.nextFightAt = 1.5 + Math.random();
        clearIdleMarchFoe();
        syncIdleMarchFromCampaign();
        idleMarchAddFeed(`🌲 Patrol begins in the wilds…`);
        IDLE_MARCH.raf = requestAnimationFrame(idleMarchLoop);
    } else {
        syncIdleMarchFromCampaign();
    }
}

function stopIdleMarch() {
    IDLE_MARCH.running = false;
    if (IDLE_MARCH.raf) cancelAnimationFrame(IDLE_MARCH.raf);
    IDLE_MARCH.raf = null;
}

function toggleIdleMarchPause() {
    const st = ensureIdleMarchState();
    st.paused = !st.paused;
    const btn = document.getElementById('idleMarchPauseBtn');
    if (btn) btn.textContent = st.paused ? '▶ Resume' : '⏸ Pause';
    const root = document.getElementById('idleMarch');
    if (root) root.classList.toggle('is-paused', !!st.paused);
    log(st.paused ? 'Wilds Patrol paused.' : 'Wilds Patrol resumed.');
}

