# Port progress — Brother’s full game → multi-file

**Date:** 2026-07-08  
**Source:** `Single File/index-3.html` (~5215 lines, Raid of the Slimes v4.x)  
**Target:** modular `index.html` + `styles/` + `js/`

## Done

- [x] Extract full CSS → `styles/main.css`
- [x] Extract full HTML body → `index.html` (Campaign, Summon, combat modals, etc.)
- [x] Split JS by section into:
  - `js/data/constants.js`, `js/data/traits.js`
  - `js/state.js`
  - `js/systems/*` (slimes, progression, campaign, combat, alchemy, management, summon, artifacts, social)
  - `js/ui.js`, `js/main.js`
- [x] Keep `js/game.full.js` as unsplit backup of the entire script
- [x] Keep `Single File/index-3.html` as original reference
- [x] Syntax-check concatenated modules + full bundle (`node --check` OK)
- [x] Remove obsolete conflicting modules (old exploration/visuals stubs)

## How to verify

1. `python3 -m http.server 8000` from project root  
2. Open http://localhost:8000  
3. Confirm: Campaign energy bar, Summon tab, Manage, turn-based combat on stage enter, save/export

## If something breaks

- Load only monobundle temporarily: replace script tags in `index.html` with  
  `<script src="js/game.full.js"></script>`
- Or open `Single File/index-3.html` directly

## Not done (optional follow-ups)

- [ ] ES modules (`type="module"`) — currently classic globals (same as original)
- [ ] Re-merge any unique “our” map/party-only ideas on top of campaign
- [ ] Electron packaging
