# Maximal 3D Graphics Plan — Phaser path

**Product tone:** soft gel collector / cozy raid (not RSL IP).  
**Current stack:** Phaser 3 (2D shell) + Three.js offscreen gel → canvas textures (`src/ui/slime3d.js`).  
**Companion max path:** `../Raid-of-the-Gel-Godot/` (native Forward+/Vulkan — true ceiling).

---

## Decision (locked 2026-07-14 / reaffirmed 2026-07-15 / art 2026-07-16)

**RSL-style hybrid — 3D only in showcase surfaces.**  
**Ship Phaser first; Godot deferred until shippable.**

**Art style lock (2026-07-16):** all **non–full-3D** art uses **painterly fantasy**  
(north star `assets/maps/greenwild.jpg`). Bible: [`docs/ART_STYLE.md`](docs/ART_STYLE.md).  
Full Blender GLB gels remain **V2 / opt-in**, not the default combat look.

| Area | Presentation | Art / fidelity bar |
|------|----------------|--------------------|
| Hub, lists, modes | 2D Phaser + plates | Painterly fantasy · strong UI |
| Combat gels / env / foes | Painted sprites + billboards | Painterly fantasy · form ladder |
| **Champion detail** | Combat plate / premium stage | **RSL champion preview class** |
| **Combat** | Live Three.js arena + Phaser HUD | **RSL combat arena class** |

Living checklist: [`docs/ARENA_VISION_AND_PROGRESS.md`](docs/ARENA_VISION_AND_PROGRESS.md)

### Shipped
- [x] Live 3D battle world (full arena: sky, hills, platform, runes, pillars, braziers, arch)
- [x] Cinematic multi-light + shadows + dust motes
- [x] Phaser skill bar / floats / AUTO on top
- [x] **Melt death** — gel structure collapse → droplets → liquid puddle
- [x] Fallback to 2.5D depth arena if WebGL/Three fails
- [x] **Painted-realism Phase 1–3** — zone env kits, full-bright mode UIs, enemy impostors  
  → living checklist: [`docs/ARENA_VISION_AND_PROGRESS.md`](docs/ARENA_VISION_AND_PROGRESS.md)

### Next polish
- [x] Combat FX + quality tiers + boss scale (Phase 4)
- [x] GLB model pipeline infrastructure (Phase 5 — drop files in `assets/models/`)
- [ ] Author hero GLBs (gel_base, enemy_*) in Blender / share with Godot
- [ ] Tier B portrait env maps for detail/summon
- [ ] Optional EffectComposer bloom if postprocessing CDN is added

---

## Honest ceiling (what “most beautiful” means here)

Phaser is a **2D game framework**. 3D only exists because we attach **Three.js**. Beauty is gated by:

| Constraint | Effect |
|------------|--------|
| Dual WebGL contexts (Phaser + Three) | Memory, context loss, mobile heat |
| Bake-to-texture (today) | Gorgeous *portraits*; combat is still 2.5D sprites on a perspective floor |
| Browser GPU variance | Must quality-tier (low/med/high) |
| No editor-native 3D pipeline | Art iteration slower than Godot/Unity |
| Real-time multi-unit SSS + heavy post | Expensive; fake SSS + bloom is the practical max |

**Phaser+Three “AAA-feeling” target (realistic max):**  
mobile-gacha quality — **live 3D combat stage** (4–10 gel figures, real lights, ground, hit VFX, bloom) + **rich Phaser/DOM HUD** + **badge JPGs only in lists**.  
Think: AFK Arena / RAID *presentation budget*, not Unreal cinematic.

**Beyond that ceiling** (console-grade materials, huge lit hubs, deferred stacks): **Godot 4 rewrite** (already scaffolded).

---

## Where you are now (Tier A)

| Piece | Status |
|-------|--------|
| Procedural wobbly gel sphere | Done (`MeshPhysicalMaterial`, ACES, multi-light) |
| Stream into Phaser as `slime3d_{el}` | Done |
| Detail + combat use 3D; hub lists use badge | Done |
| Arena | Pseudo-3D vanishing floor + JPG depth plates |
| Live multi-mesh combat scene | **Not yet** |
| GLB / custom topology per element | **Not yet** |
| Post stack (bloom, vignette, color grade) | **Not yet** (tone map only in bake) |

---

## Beauty ladder (Phaser-only)

### Tier A — Portrait gel (current) ★
Offscreen Three → animated canvas textures → Phaser images.  
**Look:** shiny liquid orbs, idle bob, element tint.  
**Cost:** low. **Impact:** high for detail/summon.

### Tier B — Cinematic portrait (max still-frame beauty)
Still bake pipeline, but **art-directed**:

1. **Env map / HDRI** (soft studio or arena reflection) on physical materials  
2. **Fake subsurface** (thickness + transmission or dual-layer shell + inner core)  
3. **Element secondary FX** as child meshes (embers, crystals, mist rings) — not badge decals  
4. **Bake size** 512–768 + DPR-aware; cache static frames if idle  
5. **Rarity lighting presets** (Legendary: stronger rim + subtle particles in bake)  
6. Optional: **one high-res still** per element for summon reveal splash  

**Outcome:** badge-quality “hero shot” that still wobbles. Best ROI on current architecture.

### Tier C — Live Three combat viewport (max *interactive* beauty on Phaser)
Replace combat *sprites* with a **single full-screen (or stage) Three.js scene**:

```
┌─────────────────────────────────────┐
│  Three.js World (arena + gels + FX) │
│  camera orbit / fixed raid angle    │
├─────────────────────────────────────┤
│  Phaser (or HTML) HUD: HP, skills,  │
│  turn meter, toasts, result splash  │
└─────────────────────────────────────┘
```

**Must include:**

| System | Spec |
|--------|------|
| Shared gel factory | One module builds `SlimeFigure` (mesh + materials + anim) used by portrait *and* combat |
| Arena kit | Ground plane/mesh, sky/gradient dome, key+rim+fill lights, optional shadow map (1 light) |
| Unit layout | Player row / enemy row in world space; HP bars as CSS or Phaser overlay projected from 3D |
| Combat events → VFX | Attack lunge, impact flash, affinity burst, death dissolve, heal pulse |
| Post | `EffectComposer`: UnrealBloom (restrained), mild vignette, filmic grade |
| Performance | Cap 6–10 figures; LOD (low poly on mobile); `pixelRatio` clamp; quality tiers |
| Input | Raycast only if needed; otherwise UI stays 2D |

**Hard rules (from product direction):**

- No badge texture on gel mesh  
- No yellow “card ring” on 3D figures  
- No flat under-color disc  
- Rarity via rim light / particle density / material sheen, not UI chrome under the body  

**Outcome:** this is the **maximal beautiful Phaser product**. Above this, rewrite engine.

### Tier D — Hybrid hub theater (optional polish)
- Hub stays 2D village + dock  
- Enter mode: short Three **transition** (portal swirl) then 2D UI  
- Champion detail: **live** Three stage (mouse orbit) instead of streaming texture  
- Summon: live open capsule + gel materialize  

Do **after** Tier C is stable.

### Tier E — Art pipeline (beauty multiplier)
Procedural spheres cap out. Next step is assets:

1. Blender: soft body-ish gel base + element variants → **GLB**  
2. `GLTFLoader` in Three; material overrides per element  
3. Simple idle + attack clips (or procedural squash on top of GLB)  
4. Naming: `assets/models/gel_base.glb`, `gel_fire.glb`, … or one base + material packs  
5. Same GLBs later feed **Godot** if you dual-track  

---

## What will *not* pay off on Phaser

- Full 3D village with walking camera and dozens of NPCs  
- Per-pixel true SSS like offline renders  
- Heavy SSAO + SSR + volumetric fog on mid phones  
- Replacing all hub UI with 3D menus  
- Fighting dual-renderer bugs forever instead of shipping combat feel  

If those become requirements → **Godot**, not more Three hacks.

---

## Recommended plan (phased)

### Phase 0 — Decide product north star (1 day)
Pick **one**:

| Option | Path |
|--------|------|
| **P — Phaser max** | Execute Tier B → C → E below; Godot pauses or stays experimental |
| **G — Godot max** | Phaser freezes as reference; beauty budget goes to Godot Forward+ |
| **Dual** | Phaser ships Tier B now for users; Godot owns Tier C+ long-term |

*(Prior session chose G; revisit if you want Phaser-first beauty.)*

### Phase 1 — Tier B portrait glory (3–7 days) — **best next step either way**
Work only in `src/ui/slime3d.js` + boot registration:

- [ ] EnvMap (PMREM from small HDR or gradient cube)  
- [ ] Dual-layer gel (inner opaque core + outer clear coat / transmission)  
- [ ] Element particle/mesh accents (fire sparks, ice shards, plant leaves)  
- [ ] Raise SIZE to 512; quality flag for 256 mobile  
- [ ] Per-rarity light intensity presets when caller passes rarity  
- [ ] Document API: `getTextureKey(el)`, `warm(el)`, dispose on scene shutdown  

**Exit criteria:** Champion detail + battle figures look “premium gel” vs flat orbs; 60fps on M-series / mid iPhone with ≤8 figures streaming.

### Phase 2 — Extract shared figure factory (2–4 days)
- [ ] `SlimeFigure` class: create/dispose, setPose, playHit, playIdle  
- [ ] Portrait path: render figure to canvas texture (current)  
- [ ] Combat path: ready to parent figure into a world scene  
- [ ] Unit tests stay pure combat; visual smoke optional  

### Phase 3 — Tier C live battle viewport (1.5–3 weeks)
- [ ] `BattleWorld3D` module: scene, camera, lights, arena mesh  
- [ ] Mount Three canvas under/over Phaser game canvas; sync size to 1920×1080 + DPR  
- [ ] Spawn player/enemy figures from combat state  
- [ ] Hook `combat.js` events → animation/VFX  
- [ ] Phaser only draws HUD + result splash  
- [ ] Quality: Low (no bloom, no shadows), Med, High  
- [ ] Fallback: if WebGL fails, current 2.5D arena  

**Exit criteria:** one full campaign fight is *obviously* 3D; skills read clearly; no badge plates on bodies.

### Phase 4 — Detail orbit + summon theater (1 week)
- [ ] Champion detail: live figure + slow auto-rotate / drag  
- [ ] Summon: 2–3s Three sequence then roster card  

### Phase 5 — GLB pipeline (ongoing art)
- [ ] One hero gel GLB beats ten more shader tweaks  
- [ ] Keep procedural sphere as LOD0 / missing-asset fallback  
- [ ] Export settings shared with Godot import later  

### Phase 6 — Stop line
When Phase 3 is “good enough ship,” **do not** invent a second 3D engine inside Phaser. Further beauty → Godot materials, particles, animation trees.

---

## Technical sketch (Tier C mount)

```text
index.html
  Phaser.Game (#game)          → HUD scenes only in battle
  #battle-3d (canvas/WebGL)    → Three BattleWorld3D

BattleScene.create()
  hide deep floor sprites (or keep as low-end fallback)
  BattleWorld3D.mount(container, { width, height, dpr })
  BattleWorld3D.spawnTeam(allies, foes)
  combat.on('skill'|'hit'|'death', BattleWorld3D.fx)

BattleScene.update()
  // combat sim stays in JS; 3D is pure view
  BattleWorld3D.syncHp(state)

BattleScene.shutdown()
  BattleWorld3D.dispose()
```

**Perf budget (High tier, desktop):**  
~8 meshes × ~2k tris, 1 shadow map 1024, bloom half-res, 60fps @ 1080p.

---

## Parallel Godot track (true max)

| Godot advantage | Why it wins beauty |
|-----------------|--------------------|
| Single renderer | No Phaser/Three split |
| Forward+ / mobile renderer | Real lights, fog, GI probes |
| AnimationPlayer / import dock | GLB workflow first-class |
| GPUParticles3D | Hit FX without custom EffectComposer glue |
| Export desktop + mobile | Same project |

Use Phaser as **design + systems reference** (data, combat rules, hub IA).  
Do **not** re-implement max post-FX twice.

---

## Success metrics (beauty, not features)

1. **Silhouette:** gel reads as volume at 64px and 400px  
2. **Material:** specular + soft inner light, element color at a glance  
3. **Combat readability:** who acted / who got hit without reading logs  
4. **No cheap UI under 3D** (no rings, no color discs, no badge paste)  
5. **Frame time:** High tier ≥50fps on target laptop; Low tier playable on integrated GPU  

---

## Suggested decision for “plan in place”

| If goal is… | Do this |
|-------------|---------|
| Ship prettier game **this month** in browser | **Phase 1–3 (Phaser Tier B→C)** |
| Ship **most beautiful** gel raid possible | **Godot** as primary; Phaser Phase 1 only for parity screenshots |
| Both | Phase 1 on Phaser + Godot vertical slice; **one** combat VFX language documented and shared |

---

## File ownership (Phaser)

| Area | Files |
|------|--------|
| Gel portrait | `src/ui/slime3d.js` |
| Placement rules | `src/ui/sceneChrome.js` |
| Combat view | `src/scenes/BattleScene.js` → later `src/ui/battleWorld3d.js` |
| Detail stage | `src/scenes/ChampionDetailScene.js` |
| Boot bake | `src/scenes/BootScene.js` |
| Assets | `assets/slimes/*` badges; future `assets/models/*`, `assets/hdri/*` |

---

*Last updated: 2026-07-14 — plan document for maximal 3D on Phaser stack; Godot remains north star for beyond-browser-hybrid ceiling. Active arena painted-realism track: `docs/ARENA_VISION_AND_PROGRESS.md`.*
