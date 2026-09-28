# Battle models (Phase 5 — GLB pipeline)

Drop **glTF Binary (`.glb`)** files here. Combat prefers GLB when present, then painted impostors, then procedural meshes.

## Layout

```text
assets/models/
  gel/
    gel_base.glb          # shared soft gel body (all elements tinted at runtime)
    gel_water.glb         # optional per-element hero mesh
    gel_fire.glb
    …
  enemy/
    enemy_base.glb        # optional fallback foe
    enemy_beast.glb
    enemy_golem.glb
    enemy_humanoid.glb
    enemy_dragon.glb
    enemy_undead.glb
    enemy_plant.glb
    enemy_insect.glb
    enemy_elemental.glb
  prop/
    prop_base.glb
    prop_greenwild.glb    # future 3D scenery (billboards still used if missing)
    …
```

## Blender export (Three.js + Godot shared)

| Setting | Value |
|---------|--------|
| Format | **glTF Binary (.glb)** |
| Transform | +Y up |
| Geometry | Apply modifiers; triangulate |
| Materials | Principled BSDF → export (runtime overrides color/emissive) |
| Animations | Idle optional (not required yet) |
| Scale | ~1–2 m tall character at origin, **feet on Z/Y = 0** |
| Origin | Centered XZ, feet on ground |

### Naming

- One mesh or small hierarchy is fine; all meshes are merged into the figure root.
- Avoid heavy transmission/SSS materials (browser combat uses MeshStandard).

### Godot companion

Same files import under `Raid-of-the-Gel-Godot` via the glTF importer. Prefer **meters**, Y-up, and keep a single material slot for element tinting.

## Runtime behavior

1. `gltfBridge.js` loads GLB → plain typed arrays  
2. `modelPipeline.js` rebuilds meshes with the combat `THREE` instance  
3. Element/kind **tint + emissive** applied in code  
4. **Size** still uses `GEL_PROFILES` / `ENEMY_KIND_SIZE` at spawn  

If no file exists, nothing breaks — impostor plates stay the default.

## Quick test

1. Export a simple blob as `gel/gel_base.glb`  
2. Hard-refresh game, enter combat  
3. Console: `[Models] preloaded N GLB pack(s)` and allies use the mesh  

---

*Part of `docs/ARENA_VISION_AND_PROGRESS.md` Phase 5.*
