# Arena Graphics — Vision & Progress

**Project:** Raid of the Gel / Slime-Raid-Phaser  
**Stack:** Phaser 3 (2D shell + HUD) + Three.js live combat (`src/ui/battleWorld3d.js`)  
**Last updated:** 2026-07-16 (Mac workspace day)

**Art style lock (2026-07-16):** all non–full-3D art = **painterly fantasy**  
→ [`ART_STYLE.md`](ART_STYLE.md) · [`ART_PIPELINE.md`](ART_PIPELINE.md) · `SR_ART.STYLE_ID`

Companion long-form plan (beauty ladder + Godot ceiling): [`../GRAPHICS_3D_PLAN.md`](../GRAPHICS_3D_PLAN.md)  
**RSL look goalpost (phases R1–R8):** [`RSL_FIDELITY_ROADMAP.md`](RSL_FIDELITY_ROADMAP.md)  
Portability / disk notes: [`../WHERE_WE_SAVE.md`](../WHERE_WE_SAVE.md)

---

## Workspace paths (same Maximus volume)

| Machine | Phaser (edit this) | Godot companion |
|---------|--------------------|-----------------|
| **Mac (today)** | `/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects/Slime-Raid-Phaser` | `…/projects/Raid-of-the-Gel-Godot` |
| Windows | `G:\Maximus Prime\Workspace-Grok_Build\projects\Slime-Raid-Phaser` | `…\projects\Raid-of-the-Gel-Godot` |

Runtime uses **relative** assets only (`assets/…`, `src/…`). Do not hardcode drive letters in code.

### How to run (Mac)

```bash
cd "/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects/Slime-Raid-Phaser"
python3 -m http.server 8090 --bind 127.0.0.1
# open http://127.0.0.1:8090/index.html  — hard-refresh after script changes
```

Or: `npm start` from the same folder.

---

## Status at a glance

| Phase | Name | Status |
|-------|------|--------|
| 1 | Painted env kits (sky/ground/props) | ✅ |
| 2 | Full-bright UI / combat vibrancy | ✅ |
| 3 | Enemy impostors + solid death | ✅ |
| 3b | Gel variety (size / element identity) | ✅ |
| 4 | Combat FX, quality tiers, boss scale | ✅ |
| 5 | GLB pipeline (drop-in models) | ✅ infra |
| 6 | Portrait env map + combat bloom | ✅ |
| 7 | Combat allies (circular badge billboards) | ✅ |
| **8** | **Champion stage theater (drag spin)** | ✅ |
| **9** | **Summon reveal theater** | ✅ |
| **10** | **GLB packs (procedural hero silhouettes)** | ✅ |

**Where we are (product truth) — locked 2026-07-15; RSL HUD pass 2026-07-14:**

| Track | Role | Status |
|-------|------|--------|
| **Phaser + Three** | **Product to ship** (RSL hybrid) | Phases **1–10** + hub videos + **nameplates / turn strip / denser arenas** |
| **Godot** (`Raid-of-the-Gel-Godot`) | **Deferred** after ship | Phase 0–1 skeleton only. No beauty budget until Phaser ships. |

### Fidelity bar (do not lower)

| Surface | Target |
|---------|--------|
| **Combat arena** | Raid Shadow Legends **combat** class — stage, lighting, units, VFX readability |
| **Champion detail stage** | RSL **champion preview** class — premium light, material read, orbit/spin |
| Hub / lists / modes | Strong 2D UI (not full 3D) |

---

## Combat presentation (locked rules)

RSL-style hybrid — **3D only in arena + champion showcase**. Hub / lists stay Phaser 2D.

| Rule | Implementation |
|------|----------------|
| 3D → screen | Three.js renders offscreen → **blit to 2D canvas** → Phaser texture (`useBlit`) — Safari-safe (DOM underlay was invisible under opaque Phaser) |
| Camera | Elevated diagonal: sit near **bottom-left**, look toward **top-right** of the field |
| Formation | **Diagonal lane** BL→TR; allies = parallel line on one side; foes = facing line on the other (`LANE` in `battleWorld3d.js`) |
| Allies look | Soft gels / circular badge billboards / procedural fallback |
| Foes look | Hard-realm painted impostors by `enemyKind` (or GLB if forced) |
| Ally death | **Melt** — structure collapse → droplets → puddle |
| Foe death | **Solid collapse** — not gel melt |
| HUD | Phaser: names, HP/TM bars, skills, AUTO, floats projected from 3D |
| Quality | `localStorage.sr_battle_quality = 'low'\|'med'\|'high'` |
| Champion detail | Same **RSL preview** fidelity bar (`ChampionDetailScene` + `slime3d` / live stage) |

**Primary combat file:** `src/ui/battleWorld3d.js`  
**HUD / battle wiring:** `src/scenes/BattleScene.js`  
**Detail stage:** `src/scenes/ChampionDetailScene.js`

---

## Godot track (deferred — after Phaser ships)

Path: `…/Workspace-Grok_Build/projects/Raid-of-the-Gel-Godot`  
Later plan: `Raid-of-the-Gel-Godot/docs/GODOT_MAX_PATH.md`

| Item | Status |
|------|--------|
| Scaffold + skeleton loop | ✅ Phase 0–1 |
| **Active development** | **Frozen** until Phaser is shippable |
| Future shape | Same RSL hybrid + same fidelity bar (arena + detail stage) |

**Decision:** Option **1 — Phaser hybrid first**.

---

## Vision (north star)

Combat should feel like a **high-quality fantasy raid arena**: realistic painted environments with soft fantasy charm — **not** elementary clay primitives or old-school RuneScape blocks.

| Layer | Target look |
|-------|-------------|
| **Sky** | Painted sky dome per zone (dawn forest, ice peaks, swamp dusk, volcano, celestial night, dungeon vault) |
| **Ground** | Tileable PBR-style albedo planes (moss, ice, mire, ash, starstone, flagstone) |
| **Scenery** | Cutout billboard props (trees, crystals, spires, pillars) with clean alpha — no studio-screen fringe |
| **Allies** | Soft gel champions (procedural / future GLB) |
| **Foes** | Hard-realm fantasy silhouettes — painted impostor cards per `enemyKind`, mesh fallback |
| **Tone** | Bright, vibrant mid-field; light atmospheric haze only (no mud-dark wash) |
| **UI** | Mode pages full-bright mode art; village hub keeps its own video loop treatment |

**Out of scope for ship path:** full 3D walkable village, Unreal-grade GI, dozens of lit NPCs.  
**In scope / raise until RSL-class:** combat arena + champion detail only.  
Godot companion deferred: `../Raid-of-the-Gel-Godot/`.

---

## Phased plan (current track)

### Phase 1 — Painted env kits ✅ DONE

**Goal:** Replace clay ground/sky/trees with zone texture kits.

| Item | Status | Notes |
|------|--------|--------|
| Folders `assets/battle/env/{zone}/` | ✅ | greenwild, crystal, shadowfen, volcanic, celestial, dungeon |
| `ground.jpg` + `sky.jpg` + `prop.jpg` per kit | ✅ | Unique hashes; dungeon ground no longer copies celestial |
| `resolveEnvKey` / `envUrls` / `theme.envKey` | ✅ | Campaign zones + dungeon/boss map |
| Textured ground plane + sky sphere | ✅ | Large plane, optional center pad |
| Prop billboards + chroma-key | ✅ | Soft key + despill + edge erode (v20) |
| BootScene preload env kits | ✅ | Warms browser cache for TextureLoader |
| Fix `isArena` before env load | ✅ | Was TDZ risk |

**Key files:**  
`src/ui/battleWorld3d.js`, `src/scenes/BootScene.js`, `assets/battle/env/**`, `index.html` cache `?v=`

---

### Phase 2 — Vibrancy & UI brightness ✅ DONE

**Goal:** No grey/dim veil over art or fight strip.

| Item | Status | Notes |
|------|--------|--------|
| Mode `paintModeBg` full opacity | ✅ | Removed ink wash + vignette (`sceneChrome.js` v3) |
| Campaign map dim layers | ✅ | Chapter select + hand-painted maps full bright |
| Summon radial dark wash | ✅ | Rings only |
| Combat exposure / lights | ✅ | ACES exposure ~1.35, stronger ambient/key/fill |
| Fog as light haze | ✅ | Farther near/far; fog color lerps toward sky |

**Key files:**  
`src/ui/sceneChrome.js`, `src/scenes/CampaignScene.js`, `src/scenes/SummonScene.js`, `battleWorld3d.js`

---

### Phase 3 — Enemy impostors & hard-realm death ✅ DONE (2026-07-14)

**Goal:** Foes match the painted arena quality; death is “solid collapse,” not gel melt.

| Item | Status | Notes |
|------|--------|--------|
| Kinds: beast, golem, humanoid, dragon, undead, plant, insect, elemental | ✅ | `gameData.ENEMY_POOLS` + bosses |
| Mesh silhouettes (procedural) | ✅ | Improved materials; fallback if impostor fails |
| Painted impostor plates `assets/battle/enemies/{kind}.jpg` | ✅ | 8 kinds, magenta-screen + chroma-key |
| Prefer impostor sprite when texture ready | ✅ | `createEnemyImpostorFigure` |
| Element tint on impostor / mesh | ✅ | Soft color multiply + hit flash |
| Solid death (fade / collapse, no puddle melt) | ✅ | `solidDeath()`; gels still melt |
| Boot preload enemy plates | ✅ | `BootScene` `enemy_*` keys |

**Kinds → art intent:**

| kind | Visual |
|------|--------|
| beast | Wolf / stag / hound silhouette |
| golem | Stone / crystal brute |
| humanoid | Bandit / knight / cultist |
| dragon | Drake / hatchling |
| undead | Wraith / ghoul |
| plant | Treant / vine mass |
| insect | Spider / beetle |
| elemental | Floating crystal / flame form |

---

### Phase 3b — Gel variety (allies + summons) ✅ DONE (2026-07-14)

**Goal:** 16 element gels differ in **design language and size** (not one recolored blob). Same art love as painted enemies.

| Item | Status | Notes |
|------|--------|--------|
| `GEL_PROFILES` per element | ✅ | size, bodyH/W, style, ornaments, eyes, float |
| Rarity size multiplier | ✅ | Common → Mythic scales up |
| Combat uses `assets/slimes/{el}.jpg` impostors | ✅ | dark-studio chroma-key cutouts |
| Procedural mesh fallback by style | ✅ | droplet / flame / chunk / spike / gem / … |
| `slime3d.js` portrait shapes match profiles | ✅ | ornaments + eye counts (void = 3) |
| UI portraits scale by element + rarity | ✅ | `sceneChrome.gelPortraitScale` |
| Summon result row spacing | ✅ | wider so lava/earth don’t crush wind/spirit |

**Size families (relative):**  
tiny: wind, spirit · small: poison, lightning · medium: water, ice, light · large: plant, storm, void · huge: earth, metal, lava

---

### Phase 4 — Combat FX & post ✅ DONE (2026-07-14)

| Item | Status | Notes |
|------|--------|--------|
| Quality tiers low/med/high | ✅ | Auto or `localStorage.sr_battle_quality`; shadows, exposure, motes, FX |
| Mild filmic grade | ✅ | ACES exposure by tier (no dark vignette) |
| World-space skill FX | ✅ | `skillFx` projectile/beam/melee/aoe/cloud/heal |
| Impact bursts + crit camera punch | ✅ | `impactBurst`, `cameraPunch` |
| BattleScene wires 3D FX first | ✅ | Falls back to Phaser 2D VFX |
| Boss / elite scale | ✅ | Epic+ foes larger; power≥280 |
| **Kind size hierarchy** | ✅ | insect &lt; humanoid &lt; beast &lt; plant &lt; dragon &lt; **golem** (rarity only nudges) |
| Arena lip polish | ✅ | Double torus + accent glow on formal arenas |

**Set quality manually (console):**  
`localStorage.setItem('sr_battle_quality','low'|'med'|'high')` then hard-refresh.

---

### Phase 5 — GLB / art pipeline ✅ DONE (infra, 2026-07-14)

**Goal:** Drop real 3D meshes without rewriting combat; Godot can share the same files.

| Item | Status | Notes |
|------|--------|--------|
| `assets/models/{gel,enemy,prop}/` | ✅ | Folders + README export guide |
| `gltfBridge.js` (ES module) | ✅ | GLTFLoader → plain geometry arrays |
| `modelPipeline.js` | ✅ | Prefetch, rebuild with combat THREE, tint |
| Prefer order | ✅ | **GLB → painted impostor → procedural** |
| BattleScene preload before spawn | ✅ | Silent no-op if no files |
| Kind / gel size still applied | ✅ | `ENEMY_KIND_SIZE` / `GEL_PROFILES` at spawn |
| Godot export notes | ✅ | `assets/models/README.md` |

**Drop-in examples:**  
`assets/models/gel/gel_base.glb`, `assets/models/enemy/enemy_golem.glb`  
Hard-refresh → console `[Models] preloaded N GLB pack(s)` when files exist.

**Placeholder GLBs generated** (`node scripts/make-placeholder-glbs.js`) so the pipeline loads real meshes; replace with Blender art anytime.

### Phase 6 — Portrait Tier B + combat bloom ✅ DONE (2026-07-14)

| Item | Status | Notes |
|------|--------|--------|
| Studio env map on portrait gels | ✅ | `slime3d.js` cube gradient env |
| Dual-layer core + shell | ✅ | Deeper “juicy gel” portraits |
| Restrained combat bloom | ✅ | Canvas dual-scale bloom on blit; med/high only |
| Real authored GLBs (Blender) | ⏳ | Replace placeholders in `assets/models/` |
| Portable path notes | ✅ | `WHERE_WE_SAVE.md` — relative assets only |

**Bloom:** `localStorage.sr_battle_quality = 'high'` for strongest glow; `'low'` disables.

### Phase 7 — Beautiful combat allies ✅ DONE (2026-07-14)

**Problem:** Color chroma on studio badges ate void/shadow/water body parts.

**Final approach — circular portrait billboards (no color key):**

| Context | Art | Mask |
|---------|-----|------|
| Roster / Summon / Hub | `assets/slimes/{el}.jpg` | Phaser circular mask |
| **Combat allies** | Same full badge art | **Soft circular alpha disc** (runtime canvas) |
| Combat foes | `assets/battle/enemies/{kind}.jpg` | Magenta chroma |

- Allies keep full painted beauty (eyes, stars, drips intact)  
- Soft element **glow halo** + bob + hit flash  
- Size still from `GEL_PROFILES` + rarity  
- Procedural mesh remains fallback if texture fails  
- Magenta flood-fill experiment in `assets/battle/gels/` is unused (holes on dark gels)

### Phase 8 — Champion stage theater ✅ DONE (2026-07-14)

| Item | Status | Notes |
|------|--------|--------|
| Rarity-glow stage plate + floor disc | ✅ | `ChampionDetailScene` |
| Larger live 3D gel portrait | ✅ | mode `3d` via slime3d |
| Drag-to-rotate yaw | ✅ | `SR_SLIME3D.addSpinYaw` / clear on leave |
| Hint “Drag gel to rotate” | ✅ | |

### Phase 9 — Summon reveal theater ✅ DONE (2026-07-14)

| Item | Status | Notes |
|------|--------|--------|
| Circle pulse before results | ✅ | Expanding rings + soft rarity flash |
| Staggered portrait pop-in | ✅ | Scale `Back.easeOut`, delay per unit |
| Rarity sparkles / rings under each | ✅ | Epic+ extra glow |
| Floating rarity tags | ✅ | Color from `rarityHex` |
| Best-pull headline | ✅ | Highest rarity highlighted |
| Busy lock during reveal | ✅ | No double-pull spam |
| Camera shake / flash on high rarity | ✅ | Epic+ / Legendary+ |

### Phase 10 — GLB packs ✅ DONE (2026-07-14)

| Item | Status | Notes |
|------|--------|--------|
| Distinct procedural GLBs per enemy kind | ✅ | `npm run models:placeholder` |
| Gel base + element GLBs | ✅ | `assets/models/gel/*` |
| Prefer painted impostors over GLB | ✅ | Keep best look; `SR_FORCE_ENEMY_GLB=1` to test meshes |
| Blender swap path | ✅ | Same filenames; drop real art anytime |
| Dev shards 20k each banner | ✅ | Boot grant; `localStorage.sr_dev_shards='0'` to disable |

**Console:** `SR_STATE.grantDevShards(SR_GAME_STATE, 20000)`

---


## Asset layout

```text
assets/battle/
  env/
    greenwild/   ground.jpg  sky.jpg  prop.jpg
    crystal/     …
    shadowfen/   …
    volcanic/    …
    celestial/   …
    dungeon/     …
  enemies/          # Phase 3 impostors
    beast.jpg … elemental.jpg
assets/models/          # Phase 5 GLB (optional)
  gel/     gel_base.glb  gel_{element}.glb
  enemy/   enemy_{kind}.glb
  prop/    prop_{zone}.glb
```

Prop/enemy JPGs use **solid magenta / hot-pink studio** backgrounds; runtime chroma-key builds RGBA.

---

## How to continue later

Phases **1–10 are shipped** on Phaser. Next work is polish / art drop-in, not redoing phase gates.

1. Read **this file** first (status + locked combat rules), then `GRAPHICS_3D_PLAN.md` if changing the 3D ceiling.  
2. Open the **Mac path** above (or Windows `G:\` twin) — not a Desktop copy.  
3. Serve from project root; hard-refresh; bump `?v=` on edited scripts in `index.html`.  
4. **Ship path:** bugfix + content completeness + host web build.  
5. **Fidelity path (RSL bar):** push **combat arena** and **champion detail stage** (lighting, materials, GLBs, VFX) — not full-3D hub.  
6. **Godot:** only after Phaser ships.  
7. Smoke: Campaign fight + Champion detail orbit; gel melt + foe solid death.

### Known pitfalls

| Issue | Fix |
|-------|-----|
| Empty green arena + only HP bars | Old DOM underlay bug — use **blit** path; hard-refresh; ensure `battle_world_3d` texture exists |
| Pink fringe on trees | Chroma despill/erode in `chromaKeyToTexture`; raise `alphaTest` |
| Dim mode pages | Do **not** reintroduce wash in `paintModeBg` |
| Blank first fight frames | Boot preload + TextureLoader async; textures pop in when ready |
| `file://` broken loads | Always use local HTTP server |
| Gel melt on hard foes | Route `solidEnemy` through collapse death, not `applyMeltDeform` |
| Gels huge / camera behind allies | Lane formation + diagonal cam in `battleWorld3d.js` (`LANE`, `camHome`) |
| Wrong project / Godot expected | Play **Phaser** for arena beauty; Godot is skeleton only |

---

## Script versions (reference)

Bump `?v=` in `index.html` when shipping visual changes:

| Script | Role |
|--------|------|
| `battleWorld3d.js` | Live arena, lane, blit, deaths, FX |
| `modelPipeline.js` / `gltfBridge.js` | Phase 5 GLB load + rebuild |
| `slime3d.js` | Portrait gel bake |
| `sceneChrome.js` | Mode bg, panels, chrome |
| `BootScene.js` | Preload env / enemy art |
| `BattleScene.js` | Combat HUD + world mount |
| `CampaignScene.js` / mode scenes | 2D presentation |

---

## Decision log (short)

| Date | Decision |
|------|----------|
| 2026-07 | Combat-only live 3D (RSL-style hybrid); hub stays 2D |
| 2026-07 | Painted-realism env kits over more primitive geometry |
| 2026-07 | Mode UIs full brightness (village hub separate treatment) |
| 2026-07 | Fantasy hard-realm enemies by zone (not slime/terrain names) |
| 2026-07 | Phase 3 = impostor cards per `enemyKind`, not full GLB yet |
| 2026-07 | Safari: blit Three → Phaser canvas (not DOM underlay) |
| 2026-07 | Diagonal BL→TR lane; allies/foes face across path |
| 2026-07 | Phaser = shippable presentation; Godot = optional rewrite skeleton |
| 2026-07-15 | Mac paths under `/Volumes/Maximus/…` |
| 2026-07-15 | **Option 1 locked:** ship Phaser hybrid; Godot after shippable |
| 2026-07-15 | **Fidelity bar:** arena + champion detail ≈ RSL class (hub stays 2D) |

---

*Maintain this file whenever a phase ships, the vision shifts, or the workspace machine path changes.*
