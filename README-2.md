# Slime Adventure

A cozy idle browser game inspired by *By the Grace of the Gods*. Build and manage a collection of elemental slimes (with Raid Shadow Legends-style visuals) across exploration, dungeons, party-building, and 5★ evolution.

**Current status (2026-07-02):** Phase 0 (modular refactor) complete. Phase 1 visuals/collection/popups/evolution ~80%. Resources always show nice centered popups (even when catching slime). Party up to ~30. Playable and savable. See GAMEPLAN.md + REFACTOR_PROGRESS.md.

## ✨ Features

- **Exploration** — Progressive node-based World Map (Greenwild Forest → Crystal Mountains → Shadowfen → Volcanic Wastes → Celestial Peaks). Clear nodes to unlock the next; auto-farm cleared content.
- **Elemental Combat** — 16 elements with rock-paper-scissors advantages. Dungeons + 6 Boss Raids that reward smart team building.
- **Slime Collection** — Common → Legendary rarities, traits system, evolution, fusion, and breeding.
- **AFK Progression** — Send slimes on timed Training Missions. Use Training Scrolls for bonus EXP. Slimes return with resources (Jelly) automatically.
- **Alchemy & Workshop** — Craft Battle Elixirs, Healing Salves, Fertility Potions, Explorer’s Tonics, and permanent power boosts. Upgrade your Refinery, Incubator, and Training Hall.
- **Research** — Low-cost normal research and high-reward Breakthrough Research using Catalysts.
- **Endgame** — Endless Void Tower (starts at Player Lv 90), Divine Convergence for permanent global power, and milestone rewards.
- **Records & Traits** — Detailed lifetime stats and a growing trait collection system.
- **Quality of Life** — Dark mode, full slime management filters/sort, bulk lock/unlock, collapsible sections, auto-save every 30s, localStorage persistence.

## 🎮 How to Play

1. Open `index.html` in any modern browser (double-click or serve locally).
2. **Explore** the Map tab first to tame your initial slimes and gather basic resources.
3. Use slimes in **Dungeons** and prepare teams for **Boss Raids** (match elements for big advantages).
4. **Manage** your collection: send on Training Missions, Breed, Evolve, Fuse.
5. Craft powerful tools in the **Alchemy** lab.
6. Invest **Stat Points** on the Player tab (Taming, Alchemy, Combat, etc.).
7. Push into late game with the **Eternity** tab (Void Tower + Divine Convergence).

### Controls & Tips
- Click nodes on the Map to explore (or farm cleared ones).
- Toggle **Auto Farm** on cleared nodes for passive gains.
- Higher difficulties on the Map give better rewards but require better matchups.
- Use consumables (Battle Elixir before bosses, Healing Salve for EXP, etc.).
- Lock valuable slimes so they aren’t accidentally fused.
- Leadership stat increases how many slimes you can send on training at once.
- Save manually or rely on the 30-second auto-save.

## 🗂️ Project Structure

The game is fully modular (Phase 0 complete). See `GAMEPLAN.md` and `REFACTOR_PROGRESS.md` for roadmap + detailed status.

```
Slime Adventure/
├── index.html                 # Thin shell (HTML + modals + script loads)
├── package.json
├── README-2.md (or README.md)
├── GAMEPLAN.md                # Long-term phased roadmap (read this first)
├── REFACTOR_PROGRESS.md       # Concrete completed work log + how to resume
├── styles/
│   └── main.css               # Slime visuals, rarity frames, grids, modals, dark
└── js/
    ├── main.js                # Init, tab switch, wiring
    ├── state.js               # game state, save/load, party, power calc, migrate
    ├── ui.js                  # Renders (haven/collection/inventory/detail), updateUI
    ├── visuals.js             # createSlimeVisual (frames, stars, mouths, eyes, badges), show*Modal/reveal
    ├── data/
    │   └── constants.js       # MAP_DATA, DUNGEON_*, BOSS_*, ELEMENT_CHART, TRAITS, etc.
    └── systems/
        ├── exploration.js     # doExplore, map, farm, auto, unlocks
        ├── combat.js          # runDungeon, boss fights, advantage
        ├── management.js      # evolve (to 5★), fuse, breed, party toggle, training, filters
        ├── alchemy.js
        └── progression.js
```

**How to launch (pick one):**

1. **Easiest (no install)**: Just double-click `index.html` in your file manager.
2. **Recommended for development**:
   ```bash
   npm install
   npm start
   ```
   Then open http://localhost:8080

---

**Important**: See `GAMEPLAN.md` (vision + phases) and `REFACTOR_PROGRESS.md` (what's done + resume instructions) first for any continuation work. They are the single source of truth for future sessions.

## 💾 Save Data

- Stored in `localStorage` under the key `slimeAdventureSave`.
- Dark mode preference also saved separately.
- **Export / Import**: Use the 📤 Export and 📥 Import buttons (top bar) to backup or transfer progress between browsers/devices. The data is a compact base64 string.
- **Reset**: There's a "Full Reset" button at the bottom of the Records tab (for testing).
- To reset manually: clear site data for the file or use browser devtools.

## 🛠️ Development

The codebase is split across logical files:

- `js/data/` – Game constants (elements, bosses, map nodes, traits, etc.)
- `js/visuals.js` – The new visual system (`createSlimeVisual`, element themes, rarity effects)
- `js/ui.js` – All rendering, modals (detail view, battle sequence), haven, etc.
- `js/systems/` – Core gameplay systems
- `index.html` + `styles/main.css` – Thin shell + styles

Key objects/functions to know:
- `game` state object
- `recalculateSlimePower(slime)`
- `ELEMENT_VISUALS` + `createSlimeVisual(slime)`
- `updateUI()`, `renderHaven()`, `showBattleSequence()`, etc.

To develop:
- Edit files in `js/` and `styles/`
- Refresh the page (or the local server)
- Always update REFACTOR_PROGRESS.md + GAMEPLAN.md after changes.

Future desktop app path: We can wrap this web app in **Electron** (or Tauri) with almost zero changes. The `index.html` becomes the renderer content. (Phase 4 later)

## 🚀 Future Ideas / Roadmap (not yet implemented)

- New regions / deeper map nodes
- More traits and trait synergy
- Slime personalities or visual variants
- Prestige / reincarnation layer
- Better mobile touch UX & offline progress simulation
- Export / import save strings
- Sound / music hooks (currently silent)
- Achievements system
- Leaderboards or community sharing (if hosted)

## 📜 Credits / Inspiration

- Inspired by the cozy monster-taming and idle elements of *By the Grace of the Gods*.
- Built as a relaxing, self-contained browser experience.

---

**Ready to play?** Double-click `index.html` or run:

```bash
# From this folder (macOS / any system with Python)
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

Enjoy taming slimes! 🐾

