# Agent notes — Slime-Raid-Phaser

## Art style (locked)

**Default for all non–full-3D art: painterly fantasy.**  
**Presentation (ship): sprites / painted impostors — not full 3D character models.**

- Bible: [`docs/ART_STYLE.md`](docs/ART_STYLE.md)
- Pipeline: [`docs/ART_PIPELINE.md`](docs/ART_PIPELINE.md) · `src/ui/artPipeline.js`
- North star: `assets/maps/greenwild.jpg`
- Runtime: `SR_ART.STYLE_ID === 'painterly-fantasy'`
- Runtime: `SR_ART.PRESENTATION === 'sprites'`
- Magenta-key cutouts for gels / props / enemies (`magentaOnly`)
- Combat gels: `assets/battle/gels/combat/*` plates on 3D stage (blit arena)
- Enemies: painted impostor cards; GLB only if `sr_force_enemy_glb=1`
- Gel forms: blob → morph → shaped by rarity (still slimes)
- Full GLB meshes = **V2 / opt-in only** (`sr_use_gel_glb=1`) — do not block game features on mesh art
- Champion detail: painted plate on live pedestal stage (not Blender hero meshes)

**Push the game first** (content, combat rules, progression, readability).  
Improve sprite plates and VFX; commission GLBs only when a hero unit needs mesh identity.

When generating art: match campaign-map brushwork; no kiddie chibi default; no multi-icon prop sheets; ground plates seamless-ish without letterbox bars.

**UI chrome:** `assets/ui/*.jpg` + `SR_UI` in `sceneChrome.js` (panels, buttons, dock, pills, titles). New HUD elements should use `addPanel` / `addButton` / `addUiPlate`, not raw flat rects.

## Serve

```bash
npm start   # http://127.0.0.1:8090
```

Bump `SR_ART.ART_CACHE_VER` and `index.html` script `?v=` after asset/JS swaps.
