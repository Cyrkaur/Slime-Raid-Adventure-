# itch.io listing draft — Raid of the Gel

## Title

**Raid of the Gel**

## Short description

Soft gel champions. Hard geometry foes. A cozy Raid-like collector — offline, Mac & Windows.

## Tags

RPG · Strategy · Singleplayer · Offline · Fantasy · Collector · Turn-based · Casual

## Long description

**Raid of the Gel** is a single-player Raid-style gel collector set in the Softened Realms.

- **Raid-style tutorial:** fight with four gels, keep one as a true **Epic** bond  
- **Campaign trails** — gear, levels, and party growth  
- **SPD combat** in a live 3D arena — skills, affinity, set-bonus gear  
- **Vault · Summon · Evolve** — drop-only relics, star awaken  
- **Offline first** — no account, no live-ops gacha  

### Mac download

1. Unzip  
2. First time: right-click **Raid of the Gel.app** → Open  
3. Then double-click to play  

### Windows download

1. Unzip  
2. Double-click **Raid of the Gel.exe**  
3. If SmartScreen: More info → Run anyway  

## Files to upload

| Platform | File |
|----------|------|
| macOS | `dist/Raid-of-the-Gel-mac.zip` |
| Windows | `dist/Raid-of-the-Gel-windows.zip` |

## Build (dev Mac)

```bash
npm run pack:customers
# or full gate:
npm run release:all
```

## Pre-publish checklist

- [ ] Mac zip: open .app after Gatekeeper allow  
- [ ] Windows zip: run .exe (or test on a Windows PC)  
- [ ] Fresh Restart wipe works  
- [ ] Tutorial → Epic pick → campaign  
