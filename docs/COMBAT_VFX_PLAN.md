# Combat VFX plan — next-level attack spectacle

**Status:** Phase A + B + C implemented (2026-07-22) · Phase D later  
**Date:** 2026-07-17 (plan) / 2026-07-22 (Phase A–C ship)  
**Ship track:** `Slime-Raid-Phaser`  
**Goal:** Basic attacks stay readable and snappy; **abilities** feel rare, elemental, and impressive — not “tinted blobs + splash.”

---

## 1. Where we are today

### What already exists

| Layer | Location | What it does |
|-------|----------|----------------|
| **Skill data** | `gameData.js` `SKILL_DEFS` | ~9 skills: basic, smash, splash, heal, shield, blaze, bolt, poison, inferno |
| **Element map** | `ELEMENT_SKILL` | Each element → one signature skill |
| **Delivery routing** | `BattleScene._deliveryFor` | Maps skill → `projectile \| beam \| melee \| aoe \| cloud \| heal` |
| **2D HUD VFX** | `BattleScene` | Glow textures, trails, rings, float numbers, screen shake |
| **3D world FX** | `battleWorld3d.skillFx` | Cast windup, element-shaped projectile meshes, impact burst, lunge |
| **Quality gate** | `Q.worldFx` / GFX setting | Can disable heavy FX on low |

### Why it still feels “little blobs”

1. **Few true skill identities** — most of the show is *element color + one of 6 delivery templates*.  
2. **Impact is generic** — same sphere + spark burst for almost everything (crit = more of the same).  
3. **Cast telegraph is shared** — same ring + column windup for all non-heals.  
4. **No skill tiers of spectacle** — basic and ultimate-class skills share length/particle count.  
5. **Limited multi-phase timeline** — little “charge → travel → impact → residual.”  
6. **A1/A2/A3 not fully distinct** — combat uses a small skill pool, not a full kit ladder per champ.

### Design north star (product)

| Attack class | Feel | Budget (time / particles / camera) |
|--------------|------|-------------------------------------|
| **Basic (A1 / Gel Strike)** | Clean, fast, always readable | Short (~0.25–0.4s), small FX |
| **Standard ability (A2)** | Clear element language, satisfying hit | Medium (~0.5–0.8s) |
| **Signature / heavy (A3, AOE, high CD)** | Memorable set-piece | Long (~0.9–1.4s), camera punch, residual |

Softened Realms twist: effects should feel **soft gel + element** (viscous orbs, drip, prism, moss) colliding with **hard geometry** (shards, angles, cracks) — not generic fireballs only.

---

## 2. Principles

1. **Readable first** — never hide HP bars or who is casting for style.  
2. **Identity over noise** — 3 signature beats per ability beat 30 random particles.  
3. **Tiered spectacle** — CD and `artCategory` / new `fxTier` drive budget.  
4. **Element language is law** — shape, motion, residual all keyed by element.  
5. **Skill overrides element** — Inferno ≠ Bolt even if both “ranged.”  
6. **Dual layer** — 3D world FX for combat space + light 2D HUD accents (numbers, flash).  
7. **Quality scalable** — low: short paths; high: trails, residual, secondary arcs.  
8. **Data-driven** — add FX defs without rewriting BattleScene for each skill.

---

## 3. Target architecture

### 3.1 Skill FX definition (data)

Extend skill defs (or parallel `SKILL_FX` table):

```js
// Conceptual shape
{
  id: 'inferno',
  fxTier: 'signature',          // basic | ability | signature
  delivery: 'aoe',              // projectile|beam|melee|aoe|cloud|heal|buff
  cast: 'rise_magma_runes',     // cast profile id
  travel: 'fire_meteor_arc',    // travel profile id (null if melee/instant)
  impact: 'ground_eruption',    // impact profile id
  residual: 'ember_ground',     // optional post-hit linger
  camera: { punch: 0.12, shake: 0.008 },
  durationHintMs: 1100
}
```

**Profiles** live in a pure module:

`src/ui/combatVfxCatalog.js` → `SR_COMBAT_VFX`

- No Phaser scene logic in catalog — only recipes.  
- `battleWorld3d` implements **runners** for profile types.  
- `BattleScene` stays the orchestrator: callout → lunge → `skillFx(recipe)` → numbers.

### 3.2 Timeline (every non-basic skill)

```
[Cast windup] → [Travel / hold] → [Impact] → [Residual optional] → [Damage numbers]
     0.1–0.35s      0.15–0.55s      0.15–0.4s      0.2–0.6s
```

Basic: skip or mini-cast (0.05s flash), short travel, light impact.

### 3.3 Layers of each hit

| Layer | Purpose |
|-------|---------|
| **Silhouette** | Large readable shape (bolt, wave, fist arc) |
| **Core** | Bright element core / gel mass |
| **Trail / secondary** | Motion history (sparks, drips, shards) |
| **Impact mark** | Ground ring / crack / puddle unique to element |
| **Screen accent** | Shake, brief vignette, skill name (already partly there) |

---

## 4. Delivery vocabulary (expand)

Keep current six; **specialize by element + skill**, don’t only recolor.

| Delivery | Basic version | Ability version | Signature version |
|----------|---------------|-----------------|-------------------|
| **projectile** | Soft gel orb | Element-shaped bolt + trail | Multi-segment / arcing / split |
| **beam** | Thin line | Thick lightning chain with forks | Multi-target chain or sky lance |
| **melee** | Short lunge slash | Heavy crush shockwave cone | Ground rupture + debris |
| **aoe** | Expanding ring | Element field (pool / flame / storm) | Full arena pulse + residual |
| **cloud** | Puff | Creeping mist / venom fog | Smothering void veil |
| **heal** | Green sparkles | Rising gel orbs + soft rain | Mend bloom + shield lattice |
| **buff** *(new)* | Pulse self | Gel armor shell | Party-wide soft aura |

Add later if needed: **zone**, **pull**, **multi-hit barrage**.

---

## 5. Element visual language (must-read for artists/impl)

| Element | Motion | Impact mark | Residual |
|---------|--------|-------------|----------|
| Water | Fluid arc, droplets | Wet ring, splash crown | Puddle shimmer |
| Fire / Lava | Rising heat, embers | Scorch bloom | Embers on ground |
| Earth / Metal | Heavy, slow, chunks | Cracks, dust | Rubble bits |
| Wind | Fast streak, swirl | Gust lines | Leaves/dust drift |
| Plant | Vine whip, spores | Moss burst | Floating spores |
| Lightning / Storm | Instant forks, zig-zag | Flash white core | Crackling afterimage |
| Ice / Crystal | Sharp shards, prism | Shatter star | Glitter frost |
| Shadow / Void | Slow suck, inverted | Dark bloom | Smoke tendrils |
| Light / Spirit | Soft rays, halo | Flash + soft ring | Lingering glow |
| Poison | Drip, bubbles | Toxic splotch | Rising fumes |

**Softened Realms rule:** gels *splatter / stretch / re-form*; hard foes *chip / crack / spark* (impact style can branch on `solidEnemy`).

---

## 6. Per-skill spectacle targets (phase 1 kit)

Using current `SKILL_DEFS` as the first full pass:

| Skill | Tier | Target fantasy |
|-------|------|----------------|
| **Gel Strike** (basic) | basic | Stretch gel arm / soft fist, quick splat impact |
| **Crush** | ability | Heavy overhead, shock ring, ground dust |
| **Splash** | ability | Arcing water blob → AOE ripple rings on all hits |
| **Blaze** | ability | Fire comet + ember trail → burst |
| **Bolt** | ability | Lightning fork beam, brief full-bright hit |
| **Venom** | ability | Poison glob → cloud cling on target |
| **Mend** | ability | Rising soft orbs, green rain on allies |
| **Gel Shield** | ability | Gel shell bloom + hexagonal soft lattice |
| **Inferno** | signature | Magma rise cast → multi-eruption AOE + lingering embers |

**Phase 2 kit expansion (after runners work):**

- Per-element **A2/A3** names (16 signatures) reusing delivery runners.  
- Champ rarity/evo scales FX intensity slightly (not new systems).

---

## 7. Implementation phases

### Phase A — Foundation (1–2 sessions) — **SHIPPED 2026-07-22**

**Deliverable:** data-driven FX pipeline, no new art assets required.

1. ✅ Add `src/ui/combatVfxCatalog.js` with `fxTier`, `delivery`, profile ids for core + element kits.  
2. ✅ Refactor `battleWorld3d.skillFx` to load recipes from catalog (`resolveRecipe`).  
3. Partial: residual ground ring via tier budget; full split runners (`runCast`/`runTravel`/…) still Phase B.  
4. ✅ Wire `BattleScene._playActionVfx` to pass `skillId` + recipe / `fxTier`.  
5. ✅ Quality hooks: low `Q.worldFx` skips FX; residual gated by tier + quality.

**Exit criteria:** changing a recipe in data changes combat look without editing BattleScene. **Met** for tier duration / residual / delivery.

### Phase B — Signature polish for current 9 skills — **SHIPPED 2026-07-22**

1. ✅ Unique **cast** profiles via `castWindup(..., castProfile)` (magma / spark / water / heavy).  
2. ✅ Unique **travel** runners: fire_comet, lightning_fork, venom_glob, ice_shard.  
3. ✅ Unique **impact** runners: eruption, scorch_bloom, ripple_rings, flash_core, toxic_splotch, ground_dust, shatter_star, lattice, green_rain.  
4. ✅ Inferno multi-eruption AOE set-piece + ember residual.  
5. ✅ Basic stays short (generic melee, no residual).

**Exit criteria:** blind test can tell Fire Blaze vs Water Splash vs Lightning Bolt from silhouette alone. **Met** via distinct runners + profile ids.

### Phase C — Spectacle systems — **SHIPPED 2026-07-22**

1. ✅ **Multi-hit timeline** — Inferno 3 ticks, Crush/Quake 2 shocks; HUD aftershock floats.  
2. ✅ **Chain bolt** — secondary lightning jumps to other living foes (`chainToIds`).  
3. ✅ **Crit FX fork** — gold core + star shards + camera punch + HUD flash.  
4. ✅ **Kill punctuation** — element residual on melt/solid death.  
5. ✅ **2D overlay accents** — crit screen flash.

### Phase D — Kit expansion — **PARTIAL 2026-07-22**

1. ✅ Full VFX recipes for all element kit skills (Metal/Poison/Crystal/Lava/Storm/Spirit/Void/Ice/Shadow/Light ultimates) reusing Phase B runners + multi-hit/chain flags.  
2. Optional painted sprite sheets / flipbooks for top signatures (art pipeline) — later.  
3. Sound hooks per profile id (when audio lands).

---

## 8. Technical constraints

| Constraint | Approach |
|------------|----------|
| Perf on low GFX | Particle caps, skip residual, shorter anims |
| Live 3D + transparent canvas | Prefer world FX; keep HUD numbers in Phaser |
| No asset pack yet | Procedural meshes + additive materials first |
| Readable combat | Cap full-screen flash; keep skill callout short |
| Cache | Version catalog with `?v=` if loaded as script |

**Avoid:**

- Full-screen particle storms every basic attack  
- Unique one-off code per skill with no shared runners  
- Blocking the combat turn for 2s+ on every ability  

---

## 9. Suggested file layout

```
src/ui/combatVfxCatalog.js   # recipes + element language tables
src/ui/battleWorld3d.js      # runners (cast/travel/impact/residual)
src/scenes/BattleScene.js    # orchestration only
src/data/gameData.js         # skill defs link fxId / fxTier
docs/COMBAT_VFX_PLAN.md      # this document
```

Optional later:

```
assets/battle/vfx/           # flipbooks / decals if art is commissioned
```

---

## 10. Acceptance tests (play + auto)

### Play smoke

1. Basic attack feels snappy; no long windup.  
2. Blaze / Bolt / Splash / Inferno clearly different.  
3. Mend/shield never look like damage.  
4. Crit is obvious without being illegible.  
5. Low GFX still shows *who hit whom*.  
6. AOE hits all targets with readable multi-bursts.

### Automated (light)

- Catalog exports a recipe for every `SKILL_DEFS` id.  
- Every recipe has valid `delivery` + tier.  
- Unit test: `_deliveryFor` / catalog resolve never returns empty for known skills.

---

## 11. Priority order (when you say “build it”)

1. **Catalog + runner refactor** (Phase A)  
2. **Inferno + Bolt + Blaze + Splash** as showcase set (Phase B subset)  
3. **Mend + Shield** support language  
4. **Crush + basic gel strike** contrast pass  
5. **Crit / kill / residual** (Phase C)  
6. Full 16-element signature kit (Phase D)

---

## 12. Open decisions (product)

| Question | Recommendation |
|----------|----------------|
| How long can signature FX block the turn? | Cap ~1.2s; parallelize residual after numbers |
| Same FX for enemy skills? | Yes, slightly shorter/dimmer for foes |
| Skill icons upgrade with FX? | Later — VFX first, art plates second |
| 2D-only fallback if 3D off? | Keep BattleScene fallback paths upgraded in parallel for top skills only |

---

## 13. Success definition

Players (and you) should feel:

- “That was just a **basic** gel hit.”  
- “That **Blaze** was a real ability.”  
- “**Inferno** felt like a raid skill.”  

Without combat becoming a slideshow or a particle soup.

When ready to implement, start with **Phase A** and the Inferno/Bolt/Blaze/Splash showcase — highest visual ROI.
