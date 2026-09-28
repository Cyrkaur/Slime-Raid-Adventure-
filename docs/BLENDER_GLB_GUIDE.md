# Models, Blender, and who makes the art

## Can Grok make the models?

| What | Can do here | Notes |
|------|-------------|--------|
| **Procedural combat gels** (multi-part, grounded) | ✅ Yes | Live in `battleWorld3d.js` — best look for materials/wobble/melt |
| **Generate GLB files with Node** | ✅ Yes | `npm run models:placeholder` → multi-part gels + enemy silhouettes |
| **Run Blender for you** | ✅ Yes (now installed) | `/Applications/Blender.app` — `npm run models:blender` |
| **AAA RSL-quality sculpted champions** | ❌ Not realistically alone | Needs human art direction, texturing, weeks of asset work |

**Bottom line:** I can build **good game-ready procedural creatures + solid GLB packs** and a full drop-in pipeline. I cannot replace a character artist for Raid-level catalog quality without Blender + art time.

## How to use generated GLBs

```bash
cd "/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects/Slime-Raid-Phaser"

# Node procedural GLBs (no Blender)
npm run models:placeholder

# Blender multi-part gels + enemies (preferred pack — v2 silhouettes)
npm run models:blender
```

Writes:

- `assets/models/gel/gel_base.glb`, `gel_{element}.glb` (all 16 elements + base)
- `assets/models/enemy/enemy_{kind}.glb` (beast, golem, dragon, …)

**v2 pack:** feet + wet skirt, cheeks/crown/arms, pupils, element ornaments (flames/shards/bolts/halo/wisps), coat sheen on Principled BSDF, distinct enemy kinds with planted feet.

### When combat uses GLBs (ship = almost never)

**Product lock (2026-07-28):** ship presentation is **sprites / painted impostors**.  
GFX quality only scales shadows, bloom, and FX budget — **not** mesh vs sprite.

| Mode | Gels | Enemies |
|------|------|---------|
| **Ship default (all GFX)** | Painted combat plates | Painted impostor cards |
| **Opt-in gel GLB** | `sr_use_gel_glb=1` or `SR_USE_GEL_GLB` | — |
| **Opt-in enemy GLB** | — | `sr_force_enemy_glb=1` |

Force gels always GLB (art pipeline tests only):

```js
localStorage.setItem('sr_use_gel_glb', '1');
```

Hub **GFX · HIGH** = better lights/shadows/FX — **not** “load Blender heroes.”

### Replace with real Blender art (later / V2)

1. Install Blender 4.x  
2. Model gel standing on **Y-up**, feet near **Y=0**, ~1.5 units tall  
3. Export **glTF Binary (.glb)**  
4. Overwrite the same path, e.g. `assets/models/gel/gel_fire.glb`  
5. Hard-refresh game  

Optional: run the sample script when Blender is installed:

```bash
blender --background --python scripts/blender_export_gel_example.py
```

(See `scripts/blender_export_gel_example.py` — generates a simple multi-sphere gel if present.)

## Recommended art path for RSL-class (while shipping the game)

1. **Default forever until V2 decision:** painterly combat gel plates + enemy cards  
2. Iterate **sprite** quality (forms, evo, attack poses, chroma) — biggest look ROI  
3. Keep GLB pipeline warm for optional hero units later  
4. Do **not** block features, balance, or content on full 3D character art  

When/if a hero needs a true mesh: model in Blender → drop `gel_{el}.glb` → opt-in flag.

## Paths

Mac: `/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects/Slime-Raid-Phaser`
