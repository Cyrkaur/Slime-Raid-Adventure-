# Stage tiles — continuous drawn environments

Seamless **horizontal** SVG strips for Wilds Patrol (and later combat arenas).

| File | Chapter | Layer | Size |
|------|---------|-------|------|
| `ch1-mid.svg` | Verdant Wilds | mid / props | 720×160 |
| `ch1-path.svg` | Verdant Wilds | path | 720×48 |
| `ch2-mid.svg` | Peaks | mid | 720×160 |
| `ch3-mid.svg` | Murk | mid | 720×160 |
| `ch4-mid.svg` | Scorched | mid | 720×160 |
| `ch5-mid.svg` | Celestial | mid | 720×160 |

## Contract
- Width **720px** matches `IDLE_MARCH.tileW` and CSS `--im-tile`.
- Left edge must visually match right edge (repeat-x seamless).
- Soft cartoon / Tensura-adjacent shapes (blobs, simple trees, crystals) — not photoreal.
- Prefer SVG (crisp at any DPR); PNG/WebP can replace the same path later.

## Wiring
- CSS: `.im-mid` / `.im-path` use `background-image: url(…)` + `background-position: calc(var(--im-scroll) * -N)`.
- JS sets `--im-scroll` each frame in `idleMarch.js`.

## Next art steps
1. Hand-paint or export matching `chN-far.svg` / ground washes.
2. Optional Pixi `TilingSprite` using the same files.
3. Combat arena can reuse these as parallax mid layers.
