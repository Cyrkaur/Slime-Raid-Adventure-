# RSL Fidelity Roadmap — Phaser hybrid (Option 1)

**Goalpost:** Combat arena + champion detail stage that **feel like Raid Shadow Legends class** — not pixel-clone RSL IP, not full-3D hub.

**Product:** `/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects/Slime-Raid-Phaser`  
**Stack:** Phaser 2D hub/HUD + Three.js live 3D showcase surfaces only.

**Last updated:** 2026-07-16  

**Current workstream:** **sprites-first game push** (content + combat readability + plate quality).  
R1–R8 first ships are in. Full GLB heroes are **V2 / opt-in** — do not block the game on mesh art.  
Remaining look gap: better **painted plates** + skill VFX polish, not full character modeling.

---

## Honest gap (where we are vs RSL)

| Layer | RSL (reference class) | Us today | Gap |
|-------|----------------------|----------|-----|
| Architecture | 2D menus + **3D combat only** | Same hybrid ✅ | Matched |
| Arena environment | Dense painted 3D stage | Zone kits + denser props + lane | Incremental density |
| Units in fight | Full 3D models + anim | **Painted combat sprites** on 3D stage + enemy cards | Accept gap vs RSL meshes; close with plate quality + VFX (GLB = V2) |
| Skill VFX | Bold element kits | Per-element projectile shapes + trails + heal orbs | More kit variety |
| Combat HUD | Nameplates + turn strip | Nameplates, HP#, skills, **turn strip** | Close |
| Champion preview | 3D turntable | Live showcase stage + multi-part gel | Close for procedural |
| Art volume | Authored catalog | Procedural + placeholders | **R6 Blender drop-in** |

**Phases 1–10** built the *system*. **R-phases below** close the *look*.

---

## Phase ladder (R1 → R8)

### R1 — Combat HUD (RSL readability)  ← **now**
**Effort:** days · **No art pipeline**

- Nameplates under units: name + rarity accent + HP numbers + turn meter
- Active-turn highlight (pulse ring / plate glow)
- Skill tray: larger buttons, cooldown badges, selected actor strip
- Top bar: zone name, AUTO, retreat — cleaner chrome
- Floating damage already exists — keep, tighten timing

**Exit:** A still screenshot of a fight reads as a raid UI, not a prototype.

### R2 — Champion detail live 3D stage  ← **now**
**Effort:** days · **Code + reuse gel factory**

- Dedicated Three showcase (blit → Phaser), not only portrait bake
- Pedestal / floor disc / rarity light rim
- Auto-orbit + drag yaw (mouse/touch)
- Element-tinted studio lighting + env reflection
- Name/rarity/power caption over stage (keep tabs on the right)

**Exit:** Opening a champion feels like an RSL preview, not a roster popup.

### R3 — Complex grounded combat gels (not levitating drops)
**Effort:** 1–2 weeks · **In progress / first ship 2026-07-16**

User intent: friendly champs must **not** stay as basic water-drop blobs or floating badges. Advance toward **deep multi-part 3D slimes** that **stand on the arena**.

- [x] Multi-part body: main + cheeks + crown lobe + arm nubs  
- [x] **Feet + wet skirt on the floor** (planted; only spirit/wind hover slightly)  
- [x] Element ornament kits (leaves, shards, embers, bolts, rocks, …)  
- [x] Rarity crest (Epic+)  
- [x] Med/high quality prefers volumetric mesh; low may use impostor for perf  
- [x] Idle **squash** bounce while grounded (not levitate bob)  
- [ ] Later: per-element unique silhouette stills / GLB heroes (R6)

**Exit:** Allies read as slimy *creatures* with weight on the ground.

### R4 — Arena density & camera
**Effort:** 1 week

- More zone props (layered billboards / simple meshes) without cluttering lane
- Stronger center corridor material / rune polish
- Subtle camera punch / settle on skill (quality-gated)
- Boss fights: wider framing + scale already partially done

**Exit:** Mid-fight still looks like a place, not empty green plane.

### R5 — Skill VFX kit pass
**Effort:** 1–2 weeks

- Per-element projectile / beam / AOE / heal kits (color + shape language)
- Impact burst + screen flash tier by crit
- Clear telegraph: who is casting (name callout + actor pulse)

**Exit:** You can follow a fight without reading the log.

### R6 — Authored GLB drop-in (art) · pipeline ready
**Effort:** ongoing art · **code path ready**

- [x] Pipeline + `SR_USE_GEL_GLB` hook documented in code  
- [x] Detail showcase multi-part gel (same language as combat)  
- [ ] Replace placeholders with Blender `gel_{el}.glb` / `enemy_{kind}.glb` (art task)

**Exit:** At least one champion and one foe look “shipped art.”

### R7 — Summon + victory theater ✅ first ship
**Effort:** ~1 week

- [x] Summon: light pillar / capsule → staggered 3D-preferring reveals + rarity FX  
- [x] Victory/defeat: confetti/ash, flash/shake, scale-in panel  

**Exit:** Pulls and wins feel premium.

### R8 — Juice, polish, ship bar ✅ first ship
**Effort:** ~1 week

- [x] Quality preset UI on hub: **GFX · LOW/MED/HIGH** (cycles `localStorage.sr_battle_quality`)  
- [x] Tests cover structural R7/R8 markers  
- [ ] Broader content QA / host production build (ops)

**Exit:** Shippable web build at “mobile gacha raid” presentation class.

---

## Priority order (efficiency)

1. **R1 + R2 first** — pure code, biggest “feels like a real game” jump  
2. **R3 + R5** — fight readability  
3. **R4** — environment  
4. **R6** — art (parallel if someone models)  
5. **R7 + R8** — ship  

Do **not** open Godot until Phaser R8 ship bar.

---

## Success metrics (not infinite polish)

| Metric | Pass |
|--------|------|
| Hybrid | Hub 2D; only combat + detail are 3D |
| Fight screenshot | Units distinct, lane readable, HUD clear |
| Detail screenshot | Gel turns, lit stage, rarity readable |
| Quality | High ≠ Low (shadows/bloom/FX) |
| Tests | `npm test` green |

---

## Checklist

- [x] R1 Combat HUD — nameplates + HP numbers + turn ring + skill tray (2026-07-16)  
- [x] R2 Champion live stage — `championShowcase3d.js` pedestal + orbit (2026-07-16)  
- [x] R3 Complex grounded combat gels (multi-part, feet on floor) (2026-07-16)  
- [x] R4 Arena density — denser prop rings (2026-07-16)  
- [x] R5 Skill VFX — clearer AOE + projectile core/trails (2026-07-16 first pass)  
- [x] R6 Showcase gels multi-part + GLB hook docs (pipeline ready; art drop-in anytime)  
- [x] R7 Summon capsule + 3D reveal / victory confetti panel (2026-07-16)  
- [x] R8 Hub GFX quality toggle (low/med/high) (2026-07-16)  
- [x] Continue: distinct gel silhouettes + grounded attack lean + foe foot rings + victory lineup (2026-07-16)  
- [x] R5v2: per-element projectiles + heal orbs + camera punch on crit/AOE  
- [x] R3v2: secondary part idle (cheeks/arms) + turn-order strip  
- [x] R5v3: impact shards by element + R6 multi-part GLB regen (`npm run models:placeholder`)  
- [x] Docs: `BLENDER_GLB_GUIDE.md` (what AI can/can’t do for models)  
- [x] Blender 5.2 batch: `npm run models:blender` — multi-part gels + enemies (2026-07-16)  
- [x] ~~High GFX prefers Blender GLB~~ **superseded 2026-07-28:** sprites ship default; GLB opt-in only  
- [x] Product lock: `SR_ART.PRESENTATION = 'sprites'` (full 3D models deferred)
- [x] Blender **v2** silhouettes: pupils, coat sheen, per-element ornaments, grounded enemy feet (2026-07-16)  
- [x] R5+: cast windup column + active-turn ground rings  
- [x] R3+: procedural gel sheen + Legendary aura disc  
- [x] GLB load path fixed (fetch+parse); enemy impostors preferred over blob GLBs  
- [x] **Painted art on gels** — `dressGelWithArt` (skin map + face card from `assets/battle/gels`)  

### Active phase now
**R1+/R4+/R5+ raid-readability pass (2026-07-14 Windows)** — highest-impact ship bar:
- [x] Live 3D **nameplates** (name · rarity · element · HP numbers)
- [x] **Turn-order strip** + zone title chrome
- [x] Skill **dock plate** + skill name labels
- [x] **Denser arena** props (forest + crystal/spire/obelisk scatter)
- [x] **Tree-shaped ground shadows** — billboard alpha silhouette cast (not discs)
- [x] **Hit telegraph** — dual impact rings + element flash shell
- [x] **Cast windup R5++** — dual rings + charge orb + motes + caster light
- [x] **Champion showcase R2++** — dual pedestal rings, gradient backdrop, motes, camera dolly

- [x] **Champion detail live stage R2+++** — wire `SR_CHAMP_SHOW` with painted gel impostor (gentle `slime_ui_*`), pedestal + drag yaw (2026-07-28)
- [x] Dual chroma: combat aggressive `slime_*` + UI gentle `slime_ui_*` for detail/hub

Next (sprites-first game push): content/progression depth, combat status chrome, skill kit readability, better plates when art time exists. GLB heroes only as optional V2.

### RSL readability pack (2026-07-22+)
- [x] Painted skill FX billboards (`assets/battle/fx/*`) + elemental statuses  
- [x] Tree shadows from trunk base along key light  
- [x] Skill **callout plate** (art + name + actor) on every ability  
- [x] **Status pills** under nameplates (colored discs + duration)  
- [x] **Turn strip** tray, order #, foe portraits, chill-aware speed  
- [x] **Active nameplate** gold pulse  
- [x] Larger skill dock circles  
- [x] 3rd party gel after 2 campaign clears  

*Update this file as phases complete.*
