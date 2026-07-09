/* ===== js/data/traits.js — split from Single File/index-3.html ===== */

// ==================== SLIME TRAITS SYSTEM ====================
const TRAIT_DEFINITIONS = {
    // Training Traits
    "quick_learner":      { name: "Quick Learner", tier: "Common", desc: "+8% EXP from Quick and Focused training." },
    "training_focused":   { name: "Training Focused", tier: "Uncommon", desc: "+14% EXP from all Training Missions." },
    "endurance_specialist":{ name: "Endurance Specialist", tier: "Rare", desc: "+22% EXP from long training missions." },
    "training_prodigy":   { name: "Training Prodigy", tier: "Epic", desc: "+30% EXP from all Training Missions." },

    // Combat Traits
    "combat_instinct":    { name: "Combat Instinct", tier: "Common", desc: "+6% Power." },
    "elemental_adept":    { name: "Elemental Adept", tier: "Uncommon", desc: "+12% power vs strong element matchups." },
    "combat_veteran":     { name: "Combat Veteran", tier: "Rare", desc: "+18% Power." },
    "battle_hardened":    { name: "Battle Hardened", tier: "Epic", desc: "+25% Power." },

    // Resource Traits
    "jelly_producer":     { name: "Jelly Producer", tier: "Common", desc: "Produces extra Jelly from training and parties." },
    "resourceful":        { name: "Resourceful", tier: "Uncommon", desc: "+12% resources from exploration." },
    "essence_harvester":  { name: "Essence Harvester", tier: "Rare", desc: "+20% Slime Essence from dungeons." },

    // Breeding Traits
    "stable_bloodline":   { name: "Stable Bloodline", tier: "Common", desc: "Slightly better rarity when breeding." },
    "rare_lineage":       { name: "Rare Lineage", tier: "Rare", desc: "+15% better rarity chance when breeding." }
};

function getTraitChanceByRarity(rarity) {
    const chances = {
        "Common":    { chance: 0.25, rarePlus: 0.08 },
        "Uncommon":  { chance: 0.42, rarePlus: 0.18 },
        "Rare":      { chance: 0.65, rarePlus: 0.35 },
        "Epic":      { chance: 0.82, rarePlus: 0.55 },
        "Legendary": { chance: 0.95, rarePlus: 0.75 },
        "Mythic":    { chance: 1.0, rarePlus: 0.90 }
    };
    return chances[rarity] || { chance: 0.3, rarePlus: 0.15 };
}

function generateTraitsForSlime(slime) {
    if (!slime || slime.traits) return; // Already has traits or invalid

    const rarityInfo = getTraitChanceByRarity(slime.rarity);
    slime.traits = [];

    // Roll for first trait
    if (Math.random() < rarityInfo.chance) {
        const tierRoll = Math.random();
        let possibleTiers = ["Common"];

        if (tierRoll < rarityInfo.rarePlus) {
            possibleTiers = ["Rare", "Epic"];
        } else if (tierRoll < rarityInfo.rarePlus * 1.8) {
            possibleTiers = ["Uncommon", "Rare"];
        } else {
            possibleTiers = ["Common", "Uncommon"];
        }

        const availableTraits = Object.keys(TRAIT_DEFINITIONS).filter(key => 
            possibleTiers.includes(TRAIT_DEFINITIONS[key].tier)
        );

        if (availableTraits.length > 0) {
            const traitKey = availableTraits[Math.floor(Math.random() * availableTraits.length)];
            slime.traits.push(traitKey);
        }
    }

    // Small chance for a second trait on higher rarities
    if (slime.rarity === "Epic" || slime.rarity === "Legendary" || slime.rarity === "Mythic") {
        if (Math.random() < 0.35) {
            const secondTierRoll = Math.random();
            let secondTiers = secondTierRoll < 0.4 ? ["Rare", "Epic"] : ["Uncommon", "Rare"];

            const available = Object.keys(TRAIT_DEFINITIONS).filter(key => 
                secondTiers.includes(TRAIT_DEFINITIONS[key].tier) && !slime.traits.includes(key)
            );

            if (available.length > 0) {
                const traitKey = available[Math.floor(Math.random() * available.length)];
                slime.traits.push(traitKey);
            }
        }
    }
}

// Apply trait effects (called in relevant places)
function applyTraitEffects(slime) {
    if (!slime.traits || slime.traits.length === 0) return 1.0;

    let powerMultiplier = 1.0;

    slime.traits.forEach(traitKey => {
        if (traitKey === "combat_instinct") powerMultiplier *= 1.06;
        if (traitKey === "elemental_adept") powerMultiplier *= 1.12; // Simplified
        if (traitKey === "combat_veteran") powerMultiplier *= 1.18;
        if (traitKey === "battle_hardened") powerMultiplier *= 1.25;
    });

    return powerMultiplier;
}

// Hover tooltip for traits on Records page
let currentTraitTooltip = null;
let managementSelectedSlimes = []; // For multi-select in management modal

function showTraitTooltip(element, traitKey) {
    hideTraitTooltip(); // Remove any existing tooltip

    const def = TRAIT_DEFINITIONS[traitKey];
    if (!def) return;

    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
        position: absolute;
        background: #0a2a1a;
        border: 2px solid #77ffaa;
        border-radius: 8px;
        padding: 10px 14px;
        max-width: 260px;
        z-index: 99999;
        font-size: 12px;
        color: #bbffdd;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        pointer-events: none;
    `;

    tooltip.innerHTML = `
        <div style="margin-bottom:4px;">
            <strong style="color:#aaff99;">${def.name}</strong>
            <span style="font-size:9px; margin-left:6px; padding:1px 5px; background:#113322; border-radius:3px;">${def.tier}</span>
        </div>
        <div style="line-height:1.35;">${def.desc}</div>
    `;

    document.body.appendChild(tooltip);
    currentTraitTooltip = tooltip;

    // Position tooltip near the element
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;

    // Adjust if tooltip goes off screen
    if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 10;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function hideTraitTooltip() {
    if (currentTraitTooltip) {
        currentTraitTooltip.remove();
        currentTraitTooltip = null;
    }
}

