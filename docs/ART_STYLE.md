# Art style lock — Painterly Fantasy (default)

**Status:** LOCKED 2026-07-16 · **presentation reaffirmed 2026-07-28**  
**Scope:** All **non–full-3D** art in Slime-Raid-Phaser (and shared language for the wider slime game).

### Presentation mode (ship)

| Mode | Role |
|------|------|
| **`sprites`** (default) | Combat gels, foes, hub, detail — painted plates / impostors on a 3D stage |
| **`glb`** (V2 opt-in) | Full character meshes only when forced (`sr_use_gel_glb` / art tests) |

Three.js is still used for **arena camera, lighting, VFX, pedestal stage** — not for requiring authored hero meshes to ship.

| Surface | Style |
|---------|--------|
| Combat gel sprites | **Painterly fantasy** |
| Enemy combat cards | **Painterly fantasy** |
| Arena ground / sky / props | **Painterly fantasy** |
| Campaign maps, mode plates, badges | **Painterly fantasy** |
| Hub UI chrome / icons | **Painterly fantasy** UI kit (`assets/ui/`) |
| Full Blender / GLB meshes | **V2 / opt-in 3D** — not the ship path |

### UI chrome kit

Shared plates in `assets/ui/` (loaded as `ui_*` in BootScene, drawn via `SR_UI`):

| File | Use |
|------|-----|
| `panel.jpg` | Dialogs / cards only (nineslice frames) |
| `button.png` / `button_danger.png` | Individual CTAs (aspect-fit, transparent) |
| `title_banner.jpg` | Mode titles (fit, never full-width stretch) |
| `currency_pill.png` | Currency + name tags (per-pill) |
| `mode_chip.png` | Travel chips (floating, no dock bar) |
| `battle_load.jpg` | Full-screen battle entry load veil (painterly forest clearing) |

**Do not** stretch one wood plate into a full-width top/bottom bar behind controls.  
Each control is its own art with soft drop shadow so it pops over village video.

Code: `src/ui/sceneChrome.js` (`addPanel`, `addButton`, `addTitle`, `addCurrencyStrip`, `addHubNavChip`, …).

> If it is painted or generated for 2D / impostors / plates / billboards → **painterly fantasy**.  
> Do **not** ship kiddie chibi, flat cell-shade cartoon, or generic stock clip-art as new defaults.

---

## North star

**Primary reference:** `assets/maps/greenwild.jpg`  
Lush premium indie RPG / gacha campaign art — rich brushwork, soft atmospheric light, mature fantasy (not a children’s sticker book).

Secondary references once painted in-kit:

- `assets/battle/env/greenwild/{ground,sky,prop*}.jpg`
- `assets/battle/gels/combat/*_{blob,morph,shaped}_*.jpg`

---

## Visual pillars

1. **Painterly** — visible brush / oil-digital texture, soft edges, light that feels painted in (god rays, rim glow), not hard vector outlines.
2. **Fantasy premium** — verdant forests, crystal, void, lava, etc. read as a serious-cozy collector raid, not toy packaging.
3. **Readable silhouettes** — combat plates read at small size; strong shape + element color first.
4. **Magenta-key cutouts** for combat/prop cards — solid hot magenta studio BG (`#FF00FF` family). **Magenta-only chroma** (never green-key trees or cyan-key gels).
5. **Gel lore first** — slimes stay gels. Form control scales with rarity; not default humanoids.
6. **Forest monostands** — a battle forest is one foliage family, not a candy mix. Blue-tree battles are **mostly blue** trees (silhouette variety only); green-tree battles are **mostly green**. Occasional rare accent of another family is optional; random 50/50 green+blue stands are not.
7. **World size canon** — absolute heights in `src/data/worldSize.js` (`SR_WORLD_SIZE`). Size is **what the creature is**, not team side: a common blob is a little guy vs a stone golem; a mythic/boss gel can match knights or challenge big foes. Insects sit between blobs and people. Combat applies height once (root scale).

---

## Gel form ladder (lore = art)

| Form | Who | Look |
|------|-----|------|
| **blob** | Common, Uncommon, most Rare | Soft mass; optional stubby nubs; rarely tiny feet |
| **morph** | Epic, ~1/3 Rare | Clear soft blob-arm tentacles; still mostly blobby |
| **shaped** | Legendary, Mythic | Deliberate elemental silhouette (crests, thicker arms); **still a slime**, not bipedal humanoid by default |

Code: `SR_ART.gelFormForUnit` · `DATA.resolveFormTier` · paths under `assets/battle/gels/combat/`.

---

## What to generate / reject

### Generate (default prompts)

- Painterly fantasy digital painting, premium indie RPG creature / environment
- Soft glossy translucent gel (for slimes), rich moss greens / elemental color language
- Full body on solid hot-magenta for cutouts; arena floors as top-down **seamless-ish** plates (no letterbox bars)
- Single tall props (one tree per card), not icon sheets of many trees

### Reject / do not adopt as default

- Flat “mobile chibi” or 12yo cartoon ground tiles
- Multi-icon prop sheets (rows of tiny trees on one JPG)
- Cyan/green studio keys that destroy gel or foliage chroma
- Non-seamless mini-map scenes heavily UV-tiled into a grid on the arena floor
- Full humanoid slime bodies for common/rare combat art

---

## Pipeline home

| Concern | Doc / code |
|---------|------------|
| Paths, forms, cache | [`ART_PIPELINE.md`](./ART_PIPELINE.md) · `src/ui/artPipeline.js` |
| Arena layout / 3D blit | `src/ui/battleWorld3d.js` · [`ARENA_VISION_AND_PROGRESS.md`](./ARENA_VISION_AND_PROGRESS.md) |
| Full 3D mesh gels | V2 · [`BLENDER_GLB_GUIDE.md`](./BLENDER_GLB_GUIDE.md) · `GRAPHICS_3D_PLAN.md` |

**Runtime constant:** `SR_ART.STYLE_ID === 'painterly-fantasy'`  
**Cache:** bump `SR_ART.ART_CACHE_VER` + `index.html` script `?v=` when replacing JPGs.

---

## Prompt skeleton (new assets)

Use this shape unless the task needs a special case:

> Painterly fantasy digital painting, premium indie RPG style matching lush campaign map art.  
> [Subject]. Soft brushwork, atmospheric light, readable silhouette.  
> [If cutout:] solid pure hot-magenta chroma background (#FF00FF), full body centered, no letterbox bars.

For gels, append form rules (blob / morph / shaped) from the ladder above.

---

*Lock reaffirmed whenever new 2D art is commissioned: default = painterly fantasy.*
