/* ===== js/systems/alchemy.js — split from Single File/index-3.html ===== */

// ==================== IMPROVED ALCHEMY SYSTEM ====================
function processMaterial(type) {
    if (!canPerformAction()) {
        return;
    }
    const alchemyBonus = 1 + ((game.player.stats.alchemy || 0) * 0.08);
    const refineryBonus = 1 + ((game.workshop.refinery || 0) * 0.15);

    if (type === 'wood_to_scrolls') {
        if ((game.resources.wood || 0) < 45) { log("Need 45 Wood"); return; }
        game.resources.wood -= 45;
        game.resources.trainingScrolls = (game.resources.trainingScrolls || 0) + Math.floor(10 * alchemyBonus);
        log("Created Training Scrolls! Use them in training missions for bonus EXP.");
    } 
    else if (type === 'stone_to_elixir') {
        if ((game.resources.stone || 0) < 30 || (game.resources.jelly || 0) < 15) { log("Need 30 Stone + 15 Jelly"); return; }
        game.resources.stone -= 30; game.resources.jelly -= 15;
        game.resources.battleElixir = (game.resources.battleElixir || 0) + Math.floor(8 * alchemyBonus);
        log("Created Battle Elixir! Activate before tough fights.");
    } 
    else if (type === 'herbs_to_salve') {
        if ((game.resources.herbs || 0) < 25 || (game.resources.jelly || 0) < 10) { log("Need 25 Herbs + 10 Jelly"); return; }
        game.resources.herbs -= 25; game.resources.jelly -= 10;
        game.resources.healingSalve = (game.resources.healingSalve || 0) + Math.floor(9 * alchemyBonus);
        log("Created Healing Salve! Use it to boost your slimes' EXP.");
    } 
    else if (type === 'berries_to_fertility') {
        if ((game.resources.jelly || 0) < 35 || (game.resources.berries || 0) < 20) { log("Need 35 Jelly + 20 Berries"); return; }
        game.resources.jelly -= 35; game.resources.berries -= 20;
        game.resources.fertilityPotion = (game.resources.fertilityPotion || 0) + Math.floor(6 * alchemyBonus);
        log("Created Fertility Potion! Use when breeding for better rarity odds.");
    } 
    else if (type === 'essence_to_mana') {
        if ((game.resources.slimeEssence || 0) < 15 || (game.resources.manaShards || 0) < 12) { log("Need 15 Slime Essence + 12 Mana Shards"); return; }
        game.resources.slimeEssence -= 15; game.resources.manaShards -= 12;
        game.resources.focusElixir = (game.resources.focusElixir || 0) + Math.floor(7 * alchemyBonus);
        log("Created Mana Infused Gel!");
    } 
    else if (type === 'shadow_to_silk') {
        if ((game.resources.shadowEssence || 0) < 20 || (game.resources.crystal || 0) < 10) { log("Need 20 Shadow Essence + 10 Crystal"); return; }
        game.resources.shadowEssence -= 20; game.resources.crystal -= 10;
        game.resources.shadowSilk = (game.resources.shadowSilk || 0) + Math.floor(5 * alchemyBonus);
        log("Created Shadow Silk!");
    } 
    else if (type === 'make_power_serum') {
        if ((game.resources.slimeEssence || 0) < 25 || (game.resources.manaShards || 0) < 15 || (game.resources.shadowEssence || 0) < 10) { log("Need 25 Slime Essence + 15 Mana Shards + 10 Shadow Essence"); return; }
        game.resources.slimeEssence -= 25; game.resources.manaShards -= 15; game.resources.shadowEssence -= 10;
        game.globalPowerBonus = (game.globalPowerBonus || 1) * 1.015;
        log("Created Power Serum! Permanent +1.5% global power.", true);
    } 
    else if (type === 'make_alchemical_catalyst') {
        if ((game.resources.refinedEssence || 0) < 30 || (game.resources.divineShards || 0) < 8 || (game.resources.arcaneDust || 0) < 15) { log("Need 30 Refined Essence + 8 Divine Shards + 15 Arcane Dust"); return; }
        game.resources.refinedEssence -= 30; game.resources.divineShards -= 8; game.resources.arcaneDust -= 15;
        game.resources.alchemicalCatalyst = (game.resources.alchemicalCatalyst || 0) + 1;
        log("Created Alchemical Catalyst! Use in Breakthrough Research for big rewards.");
    } 
    else if (type === 'refine_essence') {
        if ((game.resources.slimeEssence || 0) < 20 || (game.resources.jelly || 0) < 8) { log("Need 20 Slime Essence + 8 Jelly"); return; }
        game.resources.slimeEssence -= 20; game.resources.jelly -= 8;
        const yieldAmount = Math.floor(3 * alchemyBonus * refineryBonus);
        game.resources.refinedEssence = (game.resources.refinedEssence || 0) + yieldAmount;
        log(`Refined ${yieldAmount} Refined Essence! (Refinery bonus applied)`);
    } 
    else if (type === 'make_explorer_tonic') {
        if ((game.resources.herbs || 0) < 20 || (game.resources.jelly || 0) < 15 || (game.resources.wood || 0) < 8) { log("Need 20 Herbs + 15 Jelly + 8 Wood"); return; }
        game.resources.herbs -= 20; game.resources.jelly -= 15; game.resources.wood -= 8;
        game.resources.explorerTonic = (game.resources.explorerTonic || 0) + Math.floor(3 * alchemyBonus);
        game.explorerTonicCharges = (game.explorerTonicCharges || 0) + Math.floor(3 * alchemyBonus);
        log("Created Explorer's Tonic! Use before exploring for better slime & resource drops.");
    }
    updateUI();
}

function transmuteGoldToMana() {
    if ((game.resources.gold || 0) < 100) { log("Need 100 Gold"); return; }
    game.resources.gold -= 100;
    game.resources.manaShards = (game.resources.manaShards || 0) + 8;
    log("Transmuted 100 Gold into 8 Mana Shards");
    updateUI();
}

function transmuteManaToDivine() {
    if ((game.resources.manaShards || 0) < 50) { log("Need 50 Mana Shards"); return; }
    game.resources.manaShards -= 50;
    game.resources.divineShards = (game.resources.divineShards || 0) + 3;
    log("Transmuted 50 Mana Shards into 3 Divine Shards");
    updateUI();
}

function useBattleElixir() {
    if ((game.resources.battleElixir || 0) < 1) { log("No Battle Elixirs"); return; }
    game.resources.battleElixir--;
    game.battleElixirActive = true;
    log("Battle Elixir activated! +25% power for next fight.");
    updateUI();
}

// New: Use Healing Salve to boost all slimes
function useHealingSalve() {
    if ((game.resources.healingSalve || 0) < 1) { log("No Healing Salve!"); return; }
    game.resources.healingSalve--;
    
    let totalExp = 0;
    game.slimes.forEach(slime => {
        const expGain = 20 + Math.floor(Math.random() * 12);
        slime.exp = (slime.exp || 0) + expGain;
        syncSlimeLevelFromExp(slime);
        recalculateSlimePower(slime);
        totalExp += expGain;
    });
    
    log(`Used Healing Salve! All slimes gained a total of ${totalExp} EXP.`);
    updateUI();
}

// New: Activate Explorer's Tonic charges
function useExplorerTonic() {
    if (game.explorerTonicCharges <= 0) {
        log("No Explorer's Tonic charges! Craft some in Alchemy.");
        return;
    }
    // The charges are already consumed during exploration
    log(`Explorer's Tonic ready! You have ${game.explorerTonicCharges} charge(s). Explore now for boosted results.`);
    updateUI();
}

