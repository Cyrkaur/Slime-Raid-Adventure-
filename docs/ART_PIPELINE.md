# Art pipeline — Painterly Fantasy (V1 ship)

**Style lock:** [`ART_STYLE.md`](./ART_STYLE.md) — **painterly fantasy** for all non–full-3D art.  
**Product:** 2D combat sprites + painterly env impostors; full Blender mesh gels = **V2 / opt-in**.

North star: `assets/maps/greenwild.jpg`.

## Form-control lore

Rarer gels hold more complex shapes. Most stay **blobby** with optional stubby nubs / soft blob-arms. Full humanoid limbs are not the default.

| Combat form | Who | Look |
|-------------|-----|------|
| **blob** | Common, Uncommon, most Rare | Soft gel mass, maybe tiny nubs |
| **morph** | Epic, ~1/3 of Rare | Clear blob-arm tentacles; still mostly blobby |
| **shaped** | Legendary, Mythic | Deliberate elemental silhouette; still a slime |

Code: `SR_ART.gelFormForUnit(unit)` + `DATA.resolveFormTier(slime)`.

## Canonical gel art

```
assets/battle/gels/combat/{element}_{form}_{a|b|c}.jpg
# e.g. water_blob_a.jpg, fire_morph_a.jpg, void_shaped_a.jpg
```

Legacy aliases: `{el}.jpg`, `{el}_{a|b|c}.jpg` → painterly blob.

| Field | Meaning |
|-------|---------|
| `element` | water … void (16) |
| `form` | blob · morph · shaped |
| `a` / `b` / `c` | Pose variants within a form |

- Background: solid **hot magenta** for chroma (`#FF00FF` family — **magentaOnly**)
- Full-body combat plate; most have no real legs
- Same pack for battle, hub, roster, detail, summon

Falldown: shaped → morph → blob → legacy a/b/c.

### Attack poses (combat strike)

```
assets/battle/gels/combat/{element}_{form}_{a|b|c}_attack.jpg
# e.g. water_blob_a_attack.jpg
# short stem: {element}_attack.jpg  (primary blob strike)
```

- Same identity as idle plate (element / form / variant); **action silhouette** for windup / lunge
- Runtime: `SR_ART.combatGelAttackPathCandidates` → `resolveGelAttackArt`
- Combat: preload with idle pack; `playAttackPose` / `restoreIdlePose` on gel impostors during skill / lunge
- Missing attack art **falls back to idle** (no blank sprite)

**Future (coming weeks):** attack plates for **every individual slime champion** (not only element/form category art shared across a roster). That is a large image set; V1 ships category identity first.

### Evolution art (star awaken / purple evo)

Each purple star step can eventually get its own plate. **V1 ships evo1** (first awaken):

```
assets/battle/gels/combat/{element}_{form}_{a|b|c}_evo1.jpg
# e.g. water_blob_a_evo1.jpg
# short: {element}_evo1.jpg
# later: …_evo2.jpg …_evoN.jpg  (one plate per evolution the slime can make)
```

| Field | Meaning |
|-------|---------|
| `evoN` | Visual for purpleStars / evolutionLevel ≥ N |
| Look | Same gel identity; **somewhat larger**, **somewhat more complex**, **somewhat more impressive** than base idle — not a full redesign |

- Runtime: `SR_ART.gelEvoLevel(unit)` + evo stems prepended in `combatGelPathCandidates` when evolved
- Missing evo art **falls back** to base idle (and form ladder)
- **Roadmap:** unique evo plate per star for each specific champion line (element × form × variant first; named exclusives later)

## Arena env kits

```
assets/battle/env/{zone}/
  ground.jpg          # soft floor plate (seamless-ish; no letterbox bars)
  sky.jpg
  prop.jpg … prop_e.jpg           # legacy / fallback tall props (magenta key)
  prop_green.jpg … prop_green_e   # green monostand pack (greenwild)
  prop_blue.jpg … prop_blue_e     # blue monostand pack (greenwild)
```

Zones: greenwild · crystal · shadowfen · volcanic · celestial · dungeon  

Ground: **one continuous painted floor** covering the whole view (no UV tile grid, no solid-green “beyond the pad,” no circular feather).  
Forest/wild stages: no formal stone arena ring. Formal lip only on dungeon/raid stone arenas.  
Forest props: **sporadic scatter** (clumps + gaps), not even rings.

### Forest monostand rule

Each tree battle picks **one** foliage palette (`theme.forestPalette`: `green` | `blue`) for the whole encounter:

| Palette | Look | Typical sources |
|---------|------|-----------------|
| `green` | Verdant monostand — green silhouettes only | Greenwild / forest depths (default) |
| `blue` | Blue-glow monostand — blue silhouettes only | Crystal/celestial kits; ~15% of greenwild stages as a full blue grove |

Runtime: `resolveForestPalette` + `SR_ART.envUrls(zone, { forestPalette })`.  
Variety = **branch silhouettes** within the pack, not mixed green/blue trees in one stand.

## Enemies

```
assets/battle/enemies/{kind}.jpg   # magenta key full-body, painterly fantasy
```

kinds: beast · golem · humanoid · dragon · undead · plant · insect · elemental

## UI chrome kit

```
assets/ui/
  panel.jpg              # nineslice frames only
  button.png             # transparent capsules (aspect-fit)
  button_danger.png
  title_banner.jpg       # fit, never full-width stretch
  currency_pill.png
  mode_chip.png          # floating travel chips (no dock bar)
```

Boot keys: `ui_panel`, `ui_button`, … — used by `SR_UI`.  
Buttons/chips use **fit/fillH** (preserve aspect + drop shadow). Panels use nineslice.  
No full-width dock plate behind hub controls.

## Cache bust

`SR_ART.ART_CACHE_VER` + BootScene `?srv=` + `index.html` script `?v=` — bump when replacing JPGs.

## Opt-in 3D (V2 experiments)

```js
localStorage.setItem('sr_use_gel_glb', '1');   // Blender GLB only (no sprite)
```

*Last updated: 2026-07-16 — style lock + form ladder + env layout notes*
