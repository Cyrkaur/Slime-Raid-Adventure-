# Customer downloads — Mac & Windows (one-click each)

## Build both customer zips (on this Mac)

```bash
cd "/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects/Slime-Raid-Phaser"
npm run pack:customers
```

Produces:

| File | Customer OS | How they launch |
|------|-------------|-----------------|
| **`dist/Raid-of-the-Gel-mac.zip`** | Mac (Apple Silicon) | Unzip → right-click **Raid of the Gel.app** → Open (once) → then double-click |
| **`dist/Raid-of-the-Gel-windows.zip`** | Windows 10/11 64-bit | Unzip → double-click **Raid of the Gel.exe** |

Also: `dist/CUSTOMER-DOWNLOADS.txt` (quick index).

Full release check: `npm run release:all` (tests + both packages + local launchers).

---

## What customers do

### Mac
1. Download `Raid-of-the-Gel-mac.zip`  
2. Unzip  
3. **First time:** right-click app → **Open** → Open (Gatekeeper)  
4. **After that:** double-click the gel-icon app  

### Windows
1. Download `Raid-of-the-Gel-windows.zip`  
2. Unzip  
3. Double-click **Raid of the Gel.exe**  
4. If SmartScreen appears: **More info** → **Run anyway**  

No installer, no account, works offline.

---

## You (developer) — one-click in the project folder

| OS | Double-click |
|----|----------------|
| Mac | **`Play Raid of the Gel.app`** |
| Windows | **`Play Raid of the Gel.vbs`** |

Refresh: `npm run launchers`

---

## itch.io

Upload both zips as platform downloads:

- macOS → `Raid-of-the-Gel-mac.zip`  
- Windows → `Raid-of-the-Gel-windows.zip`  

Listing copy: `docs/ITCH_RELEASE.md`

---

## Browser (optional)

Zip `index.html` + `src/` + `assets/` + `vendor/` + `PLAY.command` / `PLAY.bat`.  
Skip `node_modules` and `dist`. Friend runs PLAY (needs Python 3). Prefer desktop zips for customers.
