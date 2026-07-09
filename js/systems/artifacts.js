/* ===== js/systems/artifacts.js — split from Single File/index-3.html ===== */

// ==================== ARTIFACT SYSTEM ====================
function generateArtifact(rarityTier) {
    const setIds = Object.keys(ARTIFACT_SETS);
    const setId = setIds[Math.floor(Math.random() * setIds.length)];
    const set = ARTIFACT_SETS[setId];
    const slot = ARTIFACT_SLOTS[Math.floor(Math.random() * ARTIFACT_SLOTS.length)];
    const mult = { uncommon: 1, rare: 1.8, epic: 3.2 }[rarityTier] || 1;
    const art = {
        id: Date.now() + Math.floor(Math.random() * 99999),
        name: `${set.name} ${slot}`,
        setId, slot, icon: set.icon, enhance: 0,
        atk: Math.floor((3 + Math.random() * 8) * mult),
        hp: Math.floor((10 + Math.random() * 20) * mult),
        def: Math.floor((2 + Math.random() * 6) * mult),
        crit: Math.floor(Math.random() * 5 * mult),
        spd: Math.floor(Math.random() * 4 * mult),
        rarity: rarityTier
    };
    return art;
}

function craftArtifact(tier) {
    if (!canPerformAction()) return;
    if (tier === 'uncommon') {
        if ((game.resources.stone || 0) < 20 || (game.resources.jelly || 0) < 15 || (game.resources.slimeEssence || 0) < 5) { log('Missing materials'); return; }
        game.resources.stone -= 20; game.resources.jelly -= 15; game.resources.slimeEssence -= 5;
    } else if (tier === 'rare') {
        if ((game.resources.refinedEssence || 0) < 15 || (game.resources.crystal || 0) < 10 || (game.resources.manaShards || 0) < 8) { log('Missing materials'); return; }
        game.resources.refinedEssence -= 15; game.resources.crystal -= 10; game.resources.manaShards -= 8;
    } else {
        if ((game.resources.refinedEssence || 0) < 25 || (game.resources.divineShards || 0) < 5 || (game.resources.arcaneDust || 0) < 20) { log('Missing materials'); return; }
        game.resources.refinedEssence -= 25; game.resources.divineShards -= 5; game.resources.arcaneDust -= 20;
    }
    const art = generateArtifact(tier);
    game.artifacts.push(art);
    log(`Forged ${art.name}! (${art.icon})`);
    updateUI();
}

function equipArtifact(slimeId, artifactId) {
    const slime = game.slimes.find(s => s.id === slimeId);
    const artIdx = game.artifacts.findIndex(a => a.id === artifactId);
    if (!slime || artIdx < 0) return;
    const art = game.artifacts[artIdx];
    if (slime.artifacts[art.slot]) game.artifacts.push(slime.artifacts[art.slot]);
    slime.artifacts[art.slot] = art;
    game.artifacts.splice(artIdx, 1);
    recalculateSlimePower(slime);
    openSlimeDetail(slimeId);
    updateUI();
}

function enhanceRandomArtifact() {
    if ((game.resources.gold || 0) < 50) { log('Need 50 Gold'); return; }
    const allArts = [...game.artifacts];
    game.slimes.forEach(s => Object.values(s.artifacts || {}).forEach(a => { if (a) allArts.push(a); }));
    if (allArts.length === 0) { log('No artifacts to enhance'); return; }
    const art = allArts[Math.floor(Math.random() * allArts.length)];
    game.resources.gold -= 50;
    art.enhance = (art.enhance || 0) + 1;
    art.atk = Math.floor(art.atk * 1.08);
    art.hp = Math.floor(art.hp * 1.08);
    art.def = Math.floor(art.def * 1.08);
    game.slimes.forEach(s => recalculateSlimePower(s));
    log(`Enhanced ${art.name} to +${art.enhance}!`);
    updateUI();
}

function reforgeRandomArtifact() {
    if ((game.resources.refinedEssence || 0) < 5 || (game.resources.divineShards || 0) < 2) { log('Need 5 Refined + 2 Divine'); return; }
    if (game.artifacts.length === 0) { log('Need unequipped artifact'); return; }
    game.resources.refinedEssence -= 5; game.resources.divineShards -= 2;
    const art = game.artifacts[Math.floor(Math.random() * game.artifacts.length)];
    const stats = ['atk', 'hp', 'def', 'crit', 'spd'];
    const stat = stats[Math.floor(Math.random() * stats.length)];
    art[stat] = Math.floor(art[stat] * (0.8 + Math.random() * 0.6));
    log(`Reforged ${art.name} ${stat.toUpperCase()}!`);
    updateUI();
}

function transmuteManaToShards() {
    if ((game.resources.manaShards || 0) < 50) { log('Need 50 Mana Shards'); return; }
    game.resources.manaShards -= 50;
    game.resources.slimeShards = (game.resources.slimeShards || 0) + 30;
    log('Transmuted 50 Mana into 30 Slime Shards');
    updateUI();
}

function transmuteDivineToVoid() {
    if ((game.resources.divineShards || 0) < 10 || (game.resources.arcaneDust || 0) < 30) { log('Need 10 Divine + 30 Arcane'); return; }
    game.resources.divineShards -= 10; game.resources.arcaneDust -= 30;
    game.resources.voidShards = (game.resources.voidShards || 0) + 5;
    log('Created 5 Void Shards');
    updateUI();
}

