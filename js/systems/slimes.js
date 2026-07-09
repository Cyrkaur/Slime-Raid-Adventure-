/* ===== js/systems/slimes.js — split from Single File/index-3.html ===== */

// ==================== GENERATE RANDOM SLIME ====================
function rollRarityFromTable(table, bonus = 0) {
    let roll = Math.random() - bonus;
    let cumulative = 0;
    const order = ["Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common"];
    for (const r of order) {
        cumulative += table[r] || 0;
        if (roll < cumulative) return r;
    }
    return "Common";
}

/** Generic skills for Common / Uncommon / Rare type-slimes (not unique champions). */
function generateSkillsForSlime(slime) {
    const skillCount = { Common: 1, Uncommon: 1, Rare: 2, Epic: 2, Legendary: 3, Mythic: 3 }[slime.rarity] || 1;
    // Never roll "basic" or unique champion skills for type slimes
    const pool = Object.keys(SKILL_DEFS).filter(k => {
        if (k === 'basic') return false;
        const def = SKILL_DEFS[k];
        return def && !def.unique;
    });
    slime.skills = [];
    const used = new Set();
    for (let i = 0; i < skillCount; i++) {
        let key;
        let attempts = 0;
        do {
            key = pool[Math.floor(Math.random() * pool.length)];
            attempts++;
        } while (used.has(key) && attempts < 20);
        used.add(key);
        slime.skills.push({ id: key, level: 1 });
    }
}

/** Champion kit: signature unique skill first, then fixed kit from roster. */
function generateSkillsForChampion(slime, champ) {
    const skills = [];
    const used = new Set();
    if (champ.sigSkill && SKILL_DEFS[champ.sigSkill]) {
        skills.push({ id: champ.sigSkill, level: 1 });
        used.add(champ.sigSkill);
    }
    (champ.kit || []).forEach(id => {
        if (used.has(id) || !SKILL_DEFS[id]) return;
        used.add(id);
        skills.push({ id, level: 1 });
    });
    // Legendary/Mythic fill remaining slots if kit was short
    const want = { Epic: 3, Legendary: 4, Mythic: 5 }[slime.rarity] || 3;
    const fillers = Object.keys(SKILL_DEFS).filter(k =>
        k !== 'basic' && !used.has(k) && SKILL_DEFS[k] && !SKILL_DEFS[k].unique
    );
    while (skills.length < want && fillers.length) {
        const idx = Math.floor(Math.random() * fillers.length);
        const id = fillers.splice(idx, 1)[0];
        used.add(id);
        skills.push({ id, level: 1 });
    }
    slime.skills = skills;
}

/** Infer combat role from skills — drives body shape in fight art (tank bulk, mage hat, etc.). */
function assignSlimeRole(slime, forceRole = null) {
    if (!slime) return 'striker';
    if (forceRole) {
        slime.role = forceRole;
        return forceRole;
    }
    if (slime.role) return slime.role;
    const ids = (slime.skills || []).map(s => s.id);
    if (ids.includes('tank_passive') || (ids.includes('shield') && !ids.includes('heal'))) slime.role = 'tank';
    else if (ids.includes('heal') || ids.includes('haste')) slime.role = 'support';
    else if (ids.includes('splash') || (ids.includes('poison') && !ids.includes('crit_passive'))) slime.role = 'mage';
    else if (ids.includes('crit_passive') || ids.includes('lifesteal')) slime.role = 'assassin';
    else if (ids.includes('inferno')) slime.role = 'striker';
    else {
        const pool = ['striker', 'tank', 'mage', 'support', 'assassin'];
        slime.role = pool[Math.floor(Math.random() * pool.length)];
    }
    return slime.role;
}

function createTypeSlime(rarity, element, faction) {
    const el = element || elements[Math.floor(Math.random() * elements.length)];
    const fac = faction || ELEMENT_FACTION[el] || FACTIONS[0];
    const speciesName = (typeof getSlimeSpeciesName === 'function')
        ? getSlimeSpeciesName(el, rarity)
        : ((names[el] && names[el][0]) || `${el} Slime`);

    const slime = {
        id: Date.now() + Math.floor(Math.random() * 100000),
        name: speciesName,
        species: speciesName,
        element: el,
        faction: fac,
        level: 1,
        exp: 0,
        power: 0,
        rarity,
        isChampion: false,
        championId: null,
        role: null,
        visual: null,
        ascension: 0,
        evolved: false,
        onMission: false,
        favorite: false,
        locked: false,
        speed: 90 + Math.floor(Math.random() * 35),
        artifacts: {},
        skills: []
    };
    generateSkillsForSlime(slime);
    assignSlimeRole(slime);
    ensureSlimeStats(slime, true);
    generateTraitsForSlime(slime);
    recalculateSlimePower(slime);
    return slime;
}

function createChampionSlime(rarity, preferredElement = null, faction = null) {
    const champ = (typeof pickChampionDef === 'function')
        ? pickChampionDef(rarity, preferredElement)
        : null;

    if (!champ) {
        // Fallback if roster missing for that rarity/element
        return createTypeSlime(rarity, preferredElement, faction);
    }

    const el = champ.element;
    const fac = faction || ELEMENT_FACTION[el] || FACTIONS[0];
    const species = (typeof getSlimeSpeciesName === 'function')
        ? getSlimeSpeciesName(el, rarity)
        : `${el} Slime`;

    const slime = {
        id: Date.now() + Math.floor(Math.random() * 100000),
        name: champ.name,
        species,
        element: el,
        faction: fac,
        level: 1,
        exp: 0,
        power: 0,
        rarity: champ.rarity || rarity,
        isChampion: true,
        championId: champ.id,
        role: champ.role || null,
        visual: champ.visual ? { ...champ.visual } : null,
        ascension: 0,
        evolved: false,
        onMission: false,
        favorite: false,
        locked: false,
        // Champions tend slightly faster / more defined kits
        speed: 100 + Math.floor(Math.random() * 40) + (champ.role === 'assassin' ? 12 : 0),
        artifacts: {},
        skills: []
    };
    generateSkillsForChampion(slime, champ);
    if (!slime.role) assignSlimeRole(slime, champ.role || null);
    ensureSlimeStats(slime, true);
    generateTraitsForSlime(slime);
    recalculateSlimePower(slime);
    return slime;
}

/**
 * Create a slime from rarity roll.
 * Common / Uncommon / Rare → type-of-slime (species name).
 * Epic / Legendary / Mythic → unique champion (name, skill, look).
 */
function createSlimeFromRoll(rarity, element = null, faction = null) {
    if (typeof isChampionRarity === 'function' ? isChampionRarity(rarity) : (rarity === 'Epic' || rarity === 'Legendary' || rarity === 'Mythic')) {
        return createChampionSlime(rarity, element, faction);
    }
    return createTypeSlime(rarity, element, faction);
}

/** First-play starter: Common (~82%) or Uncommon (~18%), random element, Lv1 / 0 EXP */
function generateStarterSlime() {
    const rarity = Math.random() < 0.82 ? 'Common' : 'Uncommon';
    const element = elements[Math.floor(Math.random() * elements.length)];
    const slime = createSlimeFromRoll(rarity, element);
    slime.level = 1;
    slime.exp = 0;
    assignSlimeRole(slime);
    recalculateSlimePower(slime);
    return slime;
}

/**
 * DEV: two fuse-compatible starters (same Fire Common, Tank + Mage)
 * so Arena 🧬 Fuse can be tested immediately.
 */
function assignDevStarterTeam() {
    game.slimes.length = 0;
    const el = 'Fire';
    const rarity = 'Common';
    const baseName = (typeof getSlimeSpeciesName === 'function')
        ? getSlimeSpeciesName(el, rarity)
        : 'Blaze Slime';

    const tank = createTypeSlime(rarity, el);
    tank.id = Date.now() + 101;
    tank.skills = [
        { id: 'shield', level: 1 },
        { id: 'tank_passive', level: 1 }
    ];
    assignSlimeRole(tank, 'tank');
    tank.name = baseName; // role lives on card/profile badge, not the name
    tank.species = baseName;
    tank.level = 1;
    tank.exp = 0;
    ensureSlimeStats(tank, true);
    recalculateSlimePower(tank);

    const mage = createTypeSlime(rarity, el);
    mage.id = Date.now() + 202;
    mage.skills = [
        { id: 'splash', level: 1 },
        { id: 'inferno', level: 1 }
    ];
    assignSlimeRole(mage, 'mage');
    mage.name = baseName;
    mage.species = baseName;
    mage.level = 1;
    mage.exp = 0;
    ensureSlimeStats(mage, true);
    recalculateSlimePower(mage);

    game.slimes.push(tank, mage);
    game.lifetimeSlimesTamed = 2;
    return tank;
}

function generateRandomSlime(difficulty = "Easy", useFertility = false, parentA = null, parentB = null) {
    // Breeding genetics path
    if (parentA && parentB) {
        return breedSlimeGenetics(parentA, parentB, useFertility);
    }

    let rarityRoll = Math.random();
    const tamingBonus = (game.player.stats.taming || 0) * 0.03;
    rarityRoll = Math.max(0, rarityRoll - tamingBonus);
    if (useFertility) rarityRoll = Math.max(0, rarityRoll - 0.25);

    let rarity;
    if (difficulty === "Easy") {
        rarity = (rarityRoll < 0.68) ? "Common" : (rarityRoll < 0.90) ? "Uncommon" : "Rare";
    } else if (difficulty === "Medium") {
        rarity = (rarityRoll < 0.42) ? "Common" : (rarityRoll < 0.78) ? "Uncommon" : (rarityRoll < 0.95) ? "Rare" : "Epic";
    } else if (difficulty === "Hard") {
        rarity = (rarityRoll < 0.22) ? "Common" : (rarityRoll < 0.58) ? "Uncommon" : (rarityRoll < 0.86) ? "Rare" : (rarityRoll < 0.96) ? "Epic" : "Legendary";
    } else if (difficulty === "Summon") {
        return null;
    } else {
        rarity = (rarityRoll < 0.10) ? "Common" : (rarityRoll < 0.35) ? "Uncommon" : (rarityRoll < 0.65) ? "Rare" : (rarityRoll < 0.88) ? "Epic" : (rarityRoll < 0.97) ? "Legendary" : "Mythic";
    }

    const slime = createSlimeFromRoll(rarity);
    if (difficulty === "Extreme") slime.power = Math.floor(slime.power * 1.12);
    return slime;
}

function breedSlimeGenetics(parentA, parentB, useFertility) {
    const avgRarity = Math.max(RARITY_ORDER[parentA.rarity] || 1, RARITY_ORDER[parentB.rarity] || 1);
    let childRarityNum = avgRarity;
    if (Math.random() < 0.35 + (useFertility ? 0.2 : 0)) childRarityNum = Math.min(6, childRarityNum + 1);
    if (Math.random() < 0.08) childRarityNum = Math.min(6, childRarityNum + 1); // mutation
    const rarityMap = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];
    const rarity = rarityMap[childRarityNum - 1] || "Common";

    const element = Math.random() < 0.7
        ? (Math.random() < 0.5 ? parentA.element : parentB.element)
        : elements[Math.floor(Math.random() * elements.length)];
    const faction = Math.random() < 0.6
        ? (Math.random() < 0.5 ? parentA.faction : parentB.faction)
        : ELEMENT_FACTION[element];

    const baby = createSlimeFromRoll(rarity, element, faction);
    if (useFertility) baby.power = Math.floor(baby.power * 1.08);
    return baby;
}

/** Pretty role label for cards / profile (Tank, Mage…). */
function formatSlimeRole(role) {
    if (!role) return '';
    const map = {
        tank: 'Tank', mage: 'Mage', assassin: 'Assassin',
        support: 'Support', striker: 'Striker', brute: 'Brute'
    };
    return map[role] || (role.charAt(0).toUpperCase() + role.slice(1));
}

// ==================== RAID-STYLE PRIMARY STATS ====================

function _statHash(slime, salt = 0) {
    const s = String(slime?.id ?? slime?.name ?? 'x') + '|' + salt + '|' + (slime?.championId || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

/**
 * Generate base primary stats (STR/AGI/VIT/MAG/RES/ACC) from rarity, role, element.
 * Champions get a small fixed tilt + higher pool; type slimes roll with more variance.
 */
function generateSlimeBaseStats(slime) {
    const keys = (typeof SLIME_STAT_KEYS !== 'undefined' && SLIME_STAT_KEYS)
        ? SLIME_STAT_KEYS
        : ['STR', 'AGI', 'VIT', 'MAG', 'RES', 'ACC'];
    const rarity = slime.rarity || 'Common';
    const role = slime.role || 'striker';
    const pool = (typeof RARITY_STAT_POOL !== 'undefined' && RARITY_STAT_POOL[rarity])
        ? RARITY_STAT_POOL[rarity]
        : 80;
    const roleBias = (typeof ROLE_STAT_BIAS !== 'undefined' && ROLE_STAT_BIAS[role])
        ? ROLE_STAT_BIAS[role]
        : { STR: 1, AGI: 1, VIT: 1, MAG: 1, RES: 1, ACC: 1 };
    const elBias = (typeof ELEMENT_STAT_BIAS !== 'undefined' && ELEMENT_STAT_BIAS[slime.element])
        ? ELEMENT_STAT_BIAS[slime.element]
        : {};

    // Optional champion roster overrides (partial)
    let champTilt = {};
    if (slime.championId && typeof getChampionDefById === 'function') {
        const def = getChampionDefById(slime.championId);
        if (def && def.statTilt) champTilt = def.statTilt;
    }

    const weights = {};
    let wSum = 0;
    keys.forEach((k, i) => {
        const jitter = 0.88 + ((_statHash(slime, i + 1) % 25) / 100); // 0.88–1.12
        let w = (roleBias[k] || 1) * (elBias[k] || 1) * (champTilt[k] || 1) * jitter;
        // Champions slightly more polarized toward role peaks
        if (slime.isChampion || slime.championId) w = Math.pow(w, 1.12);
        weights[k] = Math.max(0.35, w);
        wSum += weights[k];
    });

    const stats = {};
    let assigned = 0;
    keys.forEach((k, idx) => {
        if (idx === keys.length - 1) {
            stats[k] = Math.max(6, pool - assigned);
        } else {
            const v = Math.max(6, Math.round(pool * (weights[k] / wSum)));
            stats[k] = v;
            assigned += v;
        }
    });
    // Fix rounding drift
    const total = keys.reduce((s, k) => s + stats[k], 0);
    if (total !== pool) stats.VIT = Math.max(6, (stats.VIT || 10) + (pool - total));

    return stats;
}

/** Ensure slime.stats exists (migrate old saves). Does not re-roll if present. */
function ensureSlimeStats(slime, force = false) {
    if (!slime) return null;
    if (!slime.role && typeof assignSlimeRole === 'function') assignSlimeRole(slime);
    const keys = (typeof SLIME_STAT_KEYS !== 'undefined' && SLIME_STAT_KEYS)
        ? SLIME_STAT_KEYS
        : ['STR', 'AGI', 'VIT', 'MAG', 'RES', 'ACC'];
    if (!force && slime.stats && keys.every(k => typeof slime.stats[k] === 'number')) {
        return slime.stats;
    }
    slime.stats = generateSlimeBaseStats(slime);
    return slime.stats;
}

/**
 * Effective primary stats at current level (+ small ascension).
 * ~+2.2% per level past 1, capped growth for high levels.
 */
function getEffectiveSlimeStats(slime) {
    ensureSlimeStats(slime);
    const base = slime.stats || {};
    const lv = Math.max(1, slime.level || 1);
    const asc = slime.ascension || 0;
    // Raid-like: stats grow with level
    let mult = 1 + (lv - 1) * 0.024;
    if (lv > 60) mult = 1 + 59 * 0.024 + (lv - 60) * 0.012;
    mult *= 1 + asc * 0.04;
    if (slime.arenaFusionForm || slime.fusionMass) mult *= 1.06;

    const out = {};
    (SLIME_STAT_KEYS || Object.keys(base)).forEach(k => {
        out[k] = Math.max(1, Math.floor((base[k] || 10) * mult));
    });
    return out;
}

/**
 * Derive combat attributes from primary stats (Raid mapping).
 * Returns { hp, atk, def, spd, critRate, critDmg, acc, res, power }
 */
function deriveCombatFromStats(slime) {
    const s = getEffectiveSlimeStats(slime);
    const rarityMulti = {
        Common: 1.0, Uncommon: 1.12, Rare: 1.28,
        Epic: 1.48, Legendary: 1.72, Mythic: 2.0
    }[slime.rarity] || 1;
    const role = slime.role || 'striker';

    // Core combat: mix STR/MAG for ATK based on role
    const physWeight = { tank: 0.75, brute: 0.9, striker: 0.7, mage: 0.25, support: 0.35, assassin: 0.55 }[role] ?? 0.6;
    const atkCore = s.STR * physWeight + s.MAG * (1 - physWeight);

    let hp = Math.floor((80 + s.VIT * 9.5 + s.RES * 2.2) * rarityMulti);
    let atk = Math.floor((12 + atkCore * 1.85 + s.ACC * 0.25) * rarityMulti);
    let def = Math.floor((8 + s.RES * 1.65 + s.VIT * 0.45) * rarityMulti);
    let spd = Math.floor(72 + s.AGI * 1.15 + s.ACC * 0.2);
    let critRate = Math.min(0.45, 0.06 + s.AGI * 0.0012 + s.ACC * 0.0015);
    // Crit damage: entry commons ~120–128%; grows slowly with stats/rarity/level (not 150%+ at Lv1)
    // Effective STR/MAG at Lv1 Common are small; use diminishing contribution
    const rarityCrit = {
        Common: 0, Uncommon: 0.02, Rare: 0.04, Epic: 0.07, Legendary: 0.1, Mythic: 0.14
    }[slime.rarity] || 0;
    const lv = Math.max(1, slime.level || 1);
    const levelCrit = Math.min(0.12, (lv - 1) * 0.0015); // +0.15% C.DMG per level, cap +12%
    let critDmg = 1.20
        + Math.sqrt(Math.max(0, s.STR - 8)) * 0.012
        + Math.sqrt(Math.max(0, s.MAG - 8)) * 0.01
        + rarityCrit
        + levelCrit;
    critDmg = Math.min(2.15, critDmg); // hard cap ~215% even for mythics
    let acc = Math.floor(40 + s.ACC * 1.4 + s.MAG * 0.3);
    let res = Math.floor(30 + s.RES * 1.3 + s.VIT * 0.25);

    // Role combat shapers (same spirit as Raid sets)
    if (role === 'tank') { hp = Math.floor(hp * 1.14); def = Math.floor(def * 1.12); spd = Math.floor(spd * 0.92); }
    if (role === 'brute') { hp = Math.floor(hp * 1.08); atk = Math.floor(atk * 1.1); }
    if (role === 'assassin') {
        spd = Math.floor(spd * 1.1);
        critRate = Math.min(0.52, critRate + 0.05);
        critDmg += 0.04; // assassins slightly higher C.DMG, not mages' old +8%
        hp = Math.floor(hp * 0.92);
    }
    if (role === 'mage') { atk = Math.floor(atk * 1.08); critDmg += 0.03; }
    if (role === 'support') { hp = Math.floor(hp * 1.05); res = Math.floor(res * 1.08); }
    if (role === 'striker') { critDmg += 0.02; }

    // Passives
    if ((slime.skills || []).some(x => x.id === 'tank_passive')) hp = Math.floor(hp * 1.12);
    if ((slime.skills || []).some(x => x.id === 'crit_passive')) critRate = Math.min(0.6, critRate + 0.1);

    // Display power ~ Raid-ish composite
    let power = Math.floor(
        hp * 0.12 + atk * 2.1 + def * 1.6 + spd * 0.9
        + critRate * 180 + (critDmg - 1.4) * 40 + acc * 0.15 + res * 0.12
    );

    return { hp, atk, def, spd, critRate, critDmg, acc, res, power, primary: s };
}

/**
 * Cool fusion display name — not just "Name Ω".
 * Portmanteaus, element blends, epithets.
 */
function generateFusionName(primary, partner) {
    const clean = (n) => String(n || '')
        .replace(/\s*Ω-?Form\s*$/i, '')
        .replace(/\s*Ω\s*$/i, '')
        .replace(/\s*Fusion\s*$/i, '')
        .replace(/\s*\((Tank|Mage|Assassin|Support|Striker|Brute)\)\s*$/i, '')
        .trim();
    const aName = clean(primary.name);
    const bName = clean(partner.name);
    const elA = primary.element || 'Gel';
    const elB = partner.element || 'Gel';
    const sameEl = elA === elB;
    const epithets = (typeof FUSION_EPITHETS !== 'undefined' && FUSION_EPITHETS.length)
        ? FUSION_EPITHETS
        : ['Helix', 'Dyad', 'Amalgam', 'Prime'];
    const epi = epithets[_statHash(primary, (partner.id || 3) % 97) % epithets.length];

    // Named champions: "Pyra–Maris Dyad" / short portmanteau
    const aChamp = !!(primary.isChampion || primary.championId);
    const bChamp = !!(partner.isChampion || partner.championId);
    if (aChamp || bChamp) {
        const first = (n) => (n.split(/\s+/)[0] || n).slice(0, 10);
        const fa = first(aName);
        const fb = first(bName);
        if (fa.toLowerCase() !== fb.toLowerCase()) {
            const style = _statHash(primary, 11) % 3;
            if (style === 0) return `${fa}–${fb} ${epi}`.slice(0, 26);
            if (style === 1) {
                // Portmanteau: first half + second half
                const p = (fa.slice(0, Math.ceil(fa.length * 0.55)) + fb.slice(Math.floor(fb.length * 0.4))).replace(/[^a-zA-Z\-]/g, '');
                return (p.charAt(0).toUpperCase() + p.slice(1) + ' ' + epi).slice(0, 26);
            }
            return `${fa} ${epi}`.slice(0, 26);
        }
    }

    if (sameEl) {
        const sp = (typeof getSlimeSpeciesName === 'function')
            ? getSlimeSpeciesName(elA, primary.rarity)
            : `${elA} Slime`;
        const short = (sp.replace(/\s*Slime\s*/i, '').trim() || elA);
        const sameNames = [
            `${short} ${epi}`,
            `Twin${short}`,
            `${short} Corebind`,
            `${elA} ${epi}`,
            `Greater ${short}`
        ];
        return sameNames[_statHash(primary, partner.id || 5) % sameNames.length].slice(0, 26);
    }

    // Mixed elements — blend dictionary or compound
    const key1 = `${elA}+${elB}`;
    const key2 = `${elB}+${elA}`;
    const blendTable = (typeof FUSION_ELEMENT_BLEND !== 'undefined') ? FUSION_ELEMENT_BLEND : {};
    if (blendTable[key1] || blendTable[key2]) {
        return `${blendTable[key1] || blendTable[key2]} ${epi}`.slice(0, 26);
    }
    const compounds = [
        `${elA.slice(0, 4)}${elB.slice(0, 4)} ${epi}`,
        `${elA}/${elB} ${epi}`,
        `${elA}${elB.slice(0, 3)} Dyad`,
        `Chimeric ${elA}`
    ];
    return compounds[_statHash(primary, 17) % compounds.length].slice(0, 26);
}

/** Merge primary stats when fusing (visual fuse keeps combat bond modest). */
function mergeFusionStats(primarySlime, partnerSlime) {
    ensureSlimeStats(primarySlime);
    ensureSlimeStats(partnerSlime);
    const keys = SLIME_STAT_KEYS || Object.keys(primarySlime.stats);
    const merged = {};
    keys.forEach(k => {
        const a = primarySlime.stats[k] || 10;
        const b = partnerSlime.stats[k] || 10;
        // Keep primary identity, absorb part of partner
        merged[k] = Math.floor(a * 0.78 + b * 0.42);
    });
    primarySlime.stats = merged;
    return merged;
}

/**
 * Normalize older saves to Raid-style naming when missing species/champion flags.
 * Strips role suffixes like "(Tank)" from names — role is shown as a badge instead.
 */
function ensureSlimeIdentity(slime) {
    if (!slime) return;
    if (!slime.species) {
        slime.species = (typeof getSlimeSpeciesName === 'function')
            ? getSlimeSpeciesName(slime.element, slime.rarity)
            : `${slime.element || 'Mystery'} Slime`;
    }
    if (slime.isChampion == null && slime.championId) slime.isChampion = true;
    if (slime.isChampion == null) {
        slime.isChampion = !!(typeof isChampionRarity === 'function' && isChampionRarity(slime.rarity) && slime.championId);
    }
    // Strip "(Tank)" / "(Mage)" etc from display names
    if (slime.name && /\s*\((Tank|Mage|Assassin|Support|Striker|Brute)\)\s*$/i.test(slime.name)) {
        const m = slime.name.match(/^(.*?)\s*\((Tank|Mage|Assassin|Support|Striker|Brute)\)\s*$/i);
        if (m) {
            slime.name = m[1].trim() || slime.species;
            if (!slime.role) slime.role = m[2].toLowerCase();
        }
    }
    // Type slimes with old short names like "Aqua" → species name
    if (!slime.isChampion && !slime.championId) {
        const shortLegacy = ['Aqua', 'Blaze', 'Terra', 'Zephyr', 'Bloom', 'Bolt', 'Frost', 'Shade',
            'Lumina', 'Steel', 'Venom', 'Gem', 'Magma', 'Tempest', 'Wisp', 'Abyss'];
        if (!slime.name || shortLegacy.includes(slime.name) || slime.name === slime.element) {
            slime.name = slime.species;
        }
    }
    if (!slime.role && typeof assignSlimeRole === 'function') assignSlimeRole(slime);
    ensureSlimeStats(slime);
}

/**
 * Flavor text for profile / cards.
 * Epic+ champions use unique lore; Common–Rare use generic species blurbs.
 */
function getSlimeDescription(slime) {
    if (!slime) return '';
    if (slime.championId && typeof getChampionDefById === 'function') {
        const def = getChampionDefById(slime.championId);
        if (def && def.lore) return def.lore;
    }
    if (slime.lore) return slime.lore;
    return getGenericSlimeLore(slime.element, slime.rarity, slime.role);
}

function getGenericSlimeLore(element, rarity, role) {
    const el = element || 'Mystery';
    const r = rarity || 'Common';
    const roleBit = {
        tank: 'Its thick gel shrugs off hits that would scatter lesser blobs.',
        mage: 'It concentrates elemental energy into wide, messy blasts.',
        assassin: 'It strikes from the edge of the field, then melts away.',
        support: 'It keeps the party sticky and standing when fights turn ugly.',
        striker: 'A front-line brawler that favors hard, simple hits.',
        brute: 'Raw mass and fury — subtlety is not in its recipe.'
    }[role] || 'It rolls into battle with whatever goop it was born with.';

    const rarityBit = {
        Common: 'A familiar sight on every trail — reliable, if unremarkable.',
        Uncommon: 'A bit sharper than the usual puddle; trainers notice the difference.',
        Rare: 'Harder to find and meaner in a fight than its common cousins.',
        Epic: 'A rare champion form with a name of its own.',
        Legendary: 'A legend whispered in slime dens and guild halls.',
        Mythic: 'A once-in-a-lifetime apex of gel and will.'
    }[r] || 'A slime of the wilds.';

    const elBit = {
        Fire: 'Warm to the touch and quick to ignite.',
        Water: 'Always half-liquid, dripping and reforming mid-step.',
        Earth: 'Dense, pebble-flecked gel that hits like a stone.',
        Wind: 'Light and restless, forever pulling toward the sky.',
        Plant: 'Leafy buds and pollen cling to its membrane.',
        Lightning: 'Sparks crawl across its surface when it is excited.',
        Ice: 'Frosted and angular, cold enough to mist the air.',
        Shadow: 'Edges blur into dusk; hard to pin down.',
        Light: 'A soft glow lives inside its core.',
        Metal: 'Rigid plates of hardened gel ring when struck.',
        Poison: 'A sickly sheen warns prey to keep their distance.',
        Crystal: 'Faceted surfaces scatter color like a living gem.',
        Lava: 'Slow rivers of molten gel churn under a cooling crust.',
        Storm: 'Clouds of static hang around it like a personal squall.',
        Spirit: 'Half here, half elsewhere — eyes like pale lanterns.',
        Void: 'Where its body should cast a shadow, there is only absence.'
    }[el] || `Attuned to the ${el} element.`;

    return `${rarityBit} ${elBit} ${roleBit}`;
}
