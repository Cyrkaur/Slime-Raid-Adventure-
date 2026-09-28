# Raid of the Gel — Phaser Port (ship track)

Phaser 3 **depth/raid presentation** of Slime Adventure: hub modes, gel art, systems, **live Three.js combat**.

> Soft gel theme — not Raid Shadow Legends IP.  
> HTML classic reference: `../Slime Adventure/`

## Where files are (Mac today)

```
/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects/Slime-Raid-Phaser
```

Projects root: `/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects`  
Windows same volume: `G:\Maximus Prime\Workspace-Grok_Build\projects\Slime-Raid-Phaser`

**Living plan:** [`GAMEPLAN.md`](GAMEPLAN.md) · paths: [`WHERE_WE_SAVE.md`](WHERE_WE_SAVE.md)

## Play

```bash
cd "/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects/Slime-Raid-Phaser"
npm start
# → http://127.0.0.1:8090
```

Or double-click **`PLAY.command`** (Mac) / **`PLAY.bat`** (Windows).  
**One-click play (you)**

| OS | Double-click |
|----|----------------|
| **Mac** | **`Play Raid of the Gel.app`** |
| **Windows** | **`Play Raid of the Gel.vbs`** |
| Dev | `npm run desktop` |

**Customer packages (Mac + Windows)**

```bash
npm run pack:customers
```

| Output | Customer launches |
|--------|-------------------|
| `dist/Raid-of-the-Gel-mac.zip` | Double-click `.app` (right-click Open once) |
| `dist/Raid-of-the-Gel-windows.zip` | Double-click `.exe` |

Guide: [`SHARE.md`](SHARE.md). Do **not** open via `file://`.

Game **scales** to the window (design 1920×1080 FIT). ⚙ → Fullscreen.

**Goalpost:** installable single-player Raid-like gel collector — see [`GAMEPLAN.md`](GAMEPLAN.md) §1–2.

## Graphics docs

| Doc | What |
|-----|------|
| [`docs/ART_STYLE.md`](docs/ART_STYLE.md) | Locked painterly fantasy |
| [`docs/ART_PIPELINE.md`](docs/ART_PIPELINE.md) | Gel forms, chroma, cache |
| [`docs/ARENA_VISION_AND_PROGRESS.md`](docs/ARENA_VISION_AND_PROGRESS.md) | 3D arena status |
| [`GRAPHICS_3D_PLAN.md`](GRAPHICS_3D_PLAN.md) | Longer 3D ladder |

## Hub modes

Campaign · Dungeons · Champions · Summon · Vault · Great Hall · Alchemy · Workshop · Market · Eternity · Chronicle · Spar  

Parity inventory: `FEATURE_PARITY.md` (`npm run test:parity`).

## Layout

- `src/data/` — campaign, names, lore, gameData, worldSize  
- `src/systems/` — combat, gameState  
- `src/ui/` — art, battle3d, video bg, chrome, gear enhance  
- `src/scenes/` — hub modes + battle  
- `assets/` — videos, modes, gels, battle env, models  

## Tests

```bash
npm test
```
