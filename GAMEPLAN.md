# Slime Adventure — Long-Term Gameplan

This document is a detailed, step-by-step roadmap for evolving **Slime Adventure** from its current state into a polished, engaging "whole game" experience (inspired by collector games like Raid Shadow Legends) while preserving all core mechanics.

The plan is designed so that **any future Grok session** (or human contributor) can pick it up, understand the current state, and do meaningful heavy lifting without needing the full conversation history.

---

## 1. Vision & Success Criteria

### Core Vision
- Keep the relaxing idle/collector soul (taming, breeding, AFK training, elemental strategy, exploration, endgame tower).
- Make it **feel like a real game**, not a text spreadsheet:
  - Strong visual identity for every slime (element + rarity).
  - Satisfying visual feedback and "ceremony" for key moments (new slime, battle results, progression).
  - Modern collector game polish: nice cards, animations, clear information hierarchy.
- Long-term target: Desktop application for Windows and macOS (one nice installable app).

### What "Whole Game" Means Here
- **Collection** feels premium (visual grid, detail views, rarity shine).
- **Exploration** has impact (animated results, new slime reveals).
- **Combat** has spectacle (visual team vs boss, elemental VFX, damage pop, win/loss drama).
- **Progression** is clear and motivating (bars, milestones, nice numbers).
- Everything stays cozy and not overwhelming.

### Non-Goals (for now)
- Not turning it into a high-production gacha with paid pulls.
- Not adding multiplayer or complex live service.
- Keep the single-player relaxing idle fantasy.

---

## 2. Current State (as of 2026-07-08)

- **Tech**: Browser-based (HTML + CSS + vanilla JS). Prefer `npm start` / local server (not raw `file://` for multi-file).
- **Architecture**: Multi-file split largely done:
  - `styles/main.css`, `js/data/*`, `js/state.js`, `js/ui.js`, `js/systems/*`, `js/main.js`
  - Legacy mirrors: `js/game.full.js`, `Single File/index-3.html` (reference only)
- **Gameplay systems live**:
  - Campaign stages (Raid-like manual/auto combat, energy, stars, sweeps)
  - Regional **non-slime** foes (bandits, beasts, cultists…)
  - Slimes: Common–Rare = **species types**; Epic+ = **unique champions** (sig skills + looks)
  - End battle modal: rewards + Raid-style damage/heal stats bars
  - Combat FX: floating numbers, skill callouts, hit flashes, arena shake (log optional/collapsed)
- **Save**: localStorage + Export/Import.

**Immediate focus**: climb the **Graphics Tier Ladder** (below) while keeping systems stable.

---

## 2b. Graphics Roadmap — Path Toward “Raid Feel” / 3D

Raid uses Unity + full 3D art pipelines. We climb in **tiers** so each step ships value in-browser before any engine rewrite.

### North Star
Combat should feel like a **stage**, not a spreadsheet: readable characters, a place that belongs to the region, spectacle on skills, then optional real 3D later.

### Tier 0 — Done (baseline polish)
| Target | Status |
|--------|--------|
| Raid-like turn combat UI | ✅ |
| Floating dmg/heal/crit + skill banners | ✅ |
| Result stats (dmg/taken/heal) | ✅ |
| Species vs champion identity | ✅ |
| Regional fantasy foes | ✅ |

### Tier 1 — Stylized stage combat ✅ largely shipped (2026-07-08)
**Goal**: 2.5D *feel* without 3D engine — depth, place, presence.

| Target | Status |
|--------|--------|
| Layered regional arenas | ✅ CSS scenic layers (sky/far/mid/ground/vignette/motes) |
| Themes | ✅ verdant, peaks, murk, scorched, celestial, dungeon, arena, void, boss, faction |
| Depth staging | ✅ Back-row enemies, front-row allies, floor shadows, perspective ground |
| Larger unit presence | ✅ Bigger cards/icons, depth shadows |
| Theme wiring | ✅ `runCombat(..., { chapterId / theme })` |
| Camera-ish motion | ✅ Intro zoom, arena shake; more focus FX optional later |

**Files**: `index.html` arena DOM, `styles/main.css` themes, `js/systems/combat.js` `setCombatArenaTheme`, callers in campaign/social/progression.

**Success**: First glance at a fight says “Verdant Wilds” vs “Void Tower” without reading the title.

**Next visual push → Tier 2**: champion portrait plates on field + skill-colored cast VFX + optional SFX.

### Tier 2 — Fight scene fidelity 🔄 largely shipped (2026-07-08)
| Target | Status |
|--------|--------|
| Full-body arena fighters | ✅ Slimes + foes by kind |
| Skill-colored VFX | ✅ Beams / slash / nova / aura / sparks |
| **Level A — pose animation** | ✅ CSS motion + multi-frame SVG poses |
| **Multi-frame fighter sprites** | ✅ Distinct idle/cast/attack/hit/heal/death drawings (slime + all foe kinds) |
| Attack dust + afterimage | ✅ |
| **Level C — camera + SFX** | ✅ focus / punch / ult + procedural WebAudio |
| **Level B — set dressing** | ✅ Theme props |
| Summon ceremony | ✅ Portrait + rarity shafts |
| Hand-painted PNG / Spine | ⬜ Optional art swap into same pose slots |
| **SFX toggle + file hooks** | ✅ Combat 🔊 button (saved); `assets/sfx/*.mp3` optional pack |
| Painted arena wash | ✅ Brush/paint overlay + richer theme skies |
| **Arena depth stage v2** | ✅ Horizon, floor grid/ring, light rays, clouds, platforms |
| **Raid ¾ camera layout** | ✅ Side-offset camera; allies front-left, enemies back-right on floor (not in sky) |
| Champion nameplate plate | ✅ Ornate Epic+ nameplate frame |
| Recorded SFX files | ⬜ Drop into `assets/sfx/` (see README) |

**Mute SFX**: combat UI **🔊 SFX** button, or `game.settings.sfx = false`.

**Next fidelity leaps**:
1. Drop real SFX files into `assets/sfx/`
2. Painted champion/foe PNG plates into pose slots
3. Expand `assets/stages/` (far/ground strips per chapter; optional Pixi TilingSprite)
4. **Tier 3** Three.js battlefield when combat rules freeze

### Meta shell / menu polish (idle-gacha HUD) 🔄 started 2026-07-09
Combat is a stage; the **out-of-combat game** should feel alive too (Raid/AFK Arena vibe).

| Target | Status |
|--------|--------|
| World ambient (sky, motes, gel blobs) | ✅ behind `.game` |
| Currency chips HUD | ✅ |
| Icon tabs + tab fade | ✅ |
| Hero banner shimmer + blobs | ✅ |
| Haven cards bounce + rarity glow | ✅ |
| Scenic panel backgrounds | ✅ campaign, summon, dungeon, manage, items, player, alchemy |
| Summon / dungeon living panels | ✅ |
| Rich hover tooltips (currency + inventory only) | ✅ trimmed — no tabs/slimes/patrol spam |
| Inventory grid tiles | ✅ |
| Campaign chapter scenic cards + themes | ✅ |
| Campaign vista banner | ✅ |
| Stage cards (sheen, chips, element accents) | ✅ |
| Glass modals + toast redesign | ✅ |
| Energy bar shimmer | ✅ |
| Side-scroll Wilds Patrol (AFK lane) | ✅ chapter-themed march, auto fights, offline gains |
| Continuous drawn stage tiles | ✅ `assets/stages/chN-mid.svg` + path; parallax via `--im-scroll` |
| Home “stage” combat preview widget | ✅ (Wilds Patrol) |
| Idle floaters on management lists | ✅ living mgmt rows + sheen |
| Summon ceremony polish | ✅ rays, sparks, staggered card pop |
| Summon modal always closable | ✅ pinned footer Continue + Esc + backdrop + ✕ |

### Tier 3 — Browser 2.5D / light 3D
| Target | Notes |
|--------|--------|
| Three.js or Babylon **combat scene** | Simple arena mesh + lights |
| Billboard or low-poly fighters | Or Spine/Live2D for 2.5D champs |
| Real camera | Orbit / punch-in on ultimates |
| Keep UI HTML overlay | HP bars, skills, auto — same systems |

**Success**: Fight scene is a 3D viewport; meta game can stay HTML.

### Tier 4 — Engine parity (Raid-class)
| Target | Notes |
|--------|--------|
| Godot or Unity rebuild of combat (or whole client) | Native/app store path |
| Hand-authored or purchased 3D characters | Full animation sets |
| Desktop/mobile packages | Electron may remain for prototype only |

**Success**: Product competes on *spectacle*; systems ported from current JS logic.

### Decision rules
1. **Do not block gameplay systems on Tier 4.**
2. Prefer Tier 1–2 polish until champions, campaign, and economy feel finished.
3. Start Tier 3 only when combat rules are stable (skills, stats, AI).
4. Evaluate Tier 4 only if going commercial / desktop-first with art budget.

### Tracking
- Update this section’s ✅ when a tier target ships.
- Session notes: implement **one tier chunk per focused pass**, document files touched.

---

## 3. Recommended Project Architecture

### Folder Structure (Target)

```
Slime Adventure/
├── index.html                 # Thin shell (loads CSS + main JS)
├── package.json
├── README.md
├── GAMEPLAN.md                # This file
├── styles/
│   └── main.css
├── js/
│   ├── main.js                # Boot / init / wiring
│   ├── state.js               # game object, save/load, recalculateSlimePower
│   ├── visuals.js             # createSlimeVisual + element themes (already started)
│   ├── ui.js                  # render functions, modals, battle UI, updates
│   ├── data/
│   │   ├── constants.js       # elements, ELEMENT_CHART, bossData, MAP_DATA, TRAINING_MISSIONS, etc.
│   │   └── traits.js
│   └── systems/
│       ├── exploration.js
│       ├── combat.js
│       ├── management.js      # breeding, fusion, evolve, training missions
│       ├── alchemy.js
│       └── progression.js     # player level, milestones, void tower
├── electron/ (future)         # Desktop wrapper
│   └── main.js
└── assets/ (future)
    ├── images/
    └── audio/
```

### Tech Choices (for now)
- **Vanilla JS + CSS** (keep barrier low).
- ES modules where practical (or careful script order during transition).
- No heavy frameworks unless it clearly helps (later consideration: lightweight state lib?).
- For desktop: **Electron** + electron-builder (or electron-forge). This is the path of least resistance from a web game.

---

## 4. Phased Roadmap (Step-by-Step)

### Phase 0: Solid Foundation (Do this first)

**Goal**: Make the project easy and safe to work on for future sessions.

**Tasks**:
1. Finish splitting the remaining logic out of `index.html`.
   - Extract all constants → `js/data/constants.js`
   - Extract core game state + persistence → `js/state.js`
   - Extract all render/update functions → `js/ui.js`
   - Move remaining systems (exploration, combat logic, etc.) into `js/systems/`
2. Make `index.html` a clean shell that loads:
   - `styles/main.css`
   - `js/visuals.js`
   - `js/data/constants.js`
   - `js/state.js`
   - `js/ui.js`
   - `js/main.js` (init everything)
3. Update all internal references (remove duplicates, make sure functions are exported properly via window or modules).
4. Add basic error handling / logging in development.
5. Improve `package.json` scripts (add build step later if needed).
6. Make sure "open index.html" and `npm start` both work cleanly.
7. Update README.md to point developers to this GAMEPLAN.md.

**Success Criteria**:
- You can delete large chunks of the old inline script.
- Changing a visual or a system only touches 1-2 files.
- New contributors can run the game in < 2 minutes.

---

### Phase 1: Visual Identity & Collection (Highest "game feel" impact)

**Goal**: Slimes look and feel special. Collection screen is a joy.

**Tasks**:
1. **Improve `createSlimeVisual`** (in `js/visuals.js`):
   - Add more personality (different body shapes per rarity? subtle animation via CSS keyframes).
   - Support "on mission" state visually.
   - Add evolution indicator.
2. **Major Collection Upgrade**:
   - Turn the top "Haven" into a nicer grid or carousel.
   - Full "Collection" tab/screen with search, filters (element, rarity, has trait, level), sorting.
   - Click any slime → rich detail view (big visual + stats + traits as nice badges + history?).
3. **New Slime Acquisition Polish**:
   - Better "hatch" / reveal animation when taming.
   - Show previous best rarity or "first of this element" callouts.
4. **Global Visual Language**:
   - Consistent element color usage everywhere (borders, text, backgrounds).
   - Rarity "frames" or card styles applied to all relevant places (inventory items too?).
5. **Add simple progress bars** (player XP, slime XP in detail view).

**Success Criteria**:
- Opening the game feels like opening a collector game, not a spreadsheet.
- Every rarity tier looks dramatically different.

---

### Phase 2: Core Loops — Make Actions Feel Good

**Goal**: Exploration and Combat stop being "text appears at bottom".

**Exploration**:
1. Create a dedicated `showExplorationResult()` modal/component (location flavor text + animated resource gains + new slime reveal if applicable).
2. Improve the Map tab:
   - Better node visuals (region-specific backgrounds/colors).
   - Subtle animations when nodes are cleared or auto-farmed.
   - Difficulty selector feels nicer.
3. Add floating resource popups or a "recent gains" area.

**Combat** (aligned with Graphics Tier 1–2):
1. ✅ Manual/auto Raid-style stage combat, floaters, result stats, skill callouts.
2. ✅ / 🔄 Tier 1 scenic arenas + depth staging (regional themes).
3. Tier 2: champion portraits on field, skill VFX colors, SFX.
4. Tier 3: optional Three.js battlefield viewport.
5. Boss prep screen: team power preview with visuals (still open).
6. Keep victory/defeat reward modal + stats as the post-fight ceremony.

**Management**:
- Nice animations for Breeding, Evolving, Fusing.
- Visual feedback when sending slimes on training (or when they return).

**Success Criteria**:
- Taming a slime, winning a boss, and completing a training mission all feel rewarding to watch.

---

### Phase 3: Content, Depth & Progression

**Tasks** (can be done in parallel with Phase 2):
1. More regions / map nodes with distinct flavor.
2. New traits, more alchemy recipes, new consumables.
3. Better Records / Achievements tab (visual collection of unlocked things).
4. Player milestones with nicer rewards.
5. Offline progress simulation (when you come back after hours).
6. Balance pass on economy and power curves (use the visual systems to make numbers feel better).
7. Optional: Slime "personalities" or small flavor text that appears in detail view.

---

### Phase 4: Desktop Application (Windows + macOS)

**Goal**: Turn the web game into a proper installed app.

**Recommended Path**: Electron (fastest to working desktop app).

**Steps**:
1. Create an `electron/` folder.
2. Add `electron/main.js` (basic BrowserWindow that loads the local `index.html` or a built version).
3. Add `preload.js` if needed for secure APIs later.
4. Update `package.json` with Electron dependencies + build scripts:
   - `npm run electron:start`
   - `npm run build:desktop` (produces installers)
5. Use `electron-builder` or `electron-forge` for packaging.
6. Handle save data properly (use `app.getPath('userData')` instead of just localStorage for better persistence).
7. Add app icons, window title, menu, etc.
8. Test on macOS (and Windows via CI or VM later).
9. Optional later: Auto-updater.

Alternative (lighter): Tauri (Rust + webview). Consider if bundle size becomes an issue.

**Success Criteria**:
- User can download and run a native app that feels like the web version + has native window behaviors.

---

### Phase 5: Advanced Polish & Features

- Sound design (Web Audio or simple files).
- Better art (actual SVG or PNG slimes per element/rarity — start with a few hero slimes).
- Accessibility (color contrast, keyboard navigation, reduced motion).
- Performance (large collections).
- Save cloud sync? (stretch)
- Steam / itch.io release preparation.
- Mobile-friendly version or PWA.

---

## 4.5 Grok (Conversational) vs Grok Build — Task Allocation

**Use Regular Grok (this chat) for:**
- High-level planning, game design, balancing, and feature ideation.
- Architecture decisions and detailed specs.
- Visual/UX polish (CSS, JS animations, modal designs, flavor text).
- Code review, small-to-medium implementations, and modular features.
- Documentation updates and creative direction.
- Quick wins and iterative improvements in Phases 0–3.

**Use Grok Build (CLI agent) for:**
- Large-scale refactoring and bulk file operations.
- Setting up Electron desktop wrapper (Phase 4), build pipelines, and packaging.
- Complex multi-file changes or performance optimizations.
- Automation, testing frameworks, or integrating heavier dependencies.

**Recommended Hybrid Workflow:**
1. Plan + design + targeted code with regular Grok.
2. Use Grok Build for execution on bigger structural changes or builds.
3. Always update this GAMEPLAN.md after work.

This leverages strengths: conversational depth + agentic coding power.

---

## 5. How Future Grok Sessions Should Work

1. Read this `GAMEPLAN.md` first.
2. Run the project (`npm start` or open `index.html`).
3. Check current state against the phases.
4. Pick the **highest priority unfinished task** in the earliest incomplete phase.
5. Implement cleanly in the right file.
6. Test the flow end-to-end (explore → tame → battle → etc.).
7. Update this GAMEPLAN.md with what was completed and any new notes.
8. When in doubt, ask the user for prioritization between phases/tasks.

**Coding Guidelines**:
- Keep core logic (numbers, state transitions) separate from presentation.
- New visuals should be built in `js/visuals.js` or small CSS additions.
- Prefer enhancing existing systems over rewriting them.
- Maintain save compatibility (add migration code if structure changes).
- Document any new important functions.

---

## 6. Quick Wins vs Big Projects

**High impact, relatively quick** (good for short sessions):
- More polish on `createSlimeVisual` and the detail modal.
- Better exploration result screen.
- Improve the battle animation sequence (more stages/VFX).
- Make the Map tab prettier.
- Add progress bars.

**Bigger efforts**:
- Full refactor into clean modules (Phase 0).
- Complete combat overhaul.
- Desktop Electron wrapper.

---

## 7. Risks & Principles

- **Don't break the fun** — always keep the existing systems working while adding visuals.
- **Cozy first** — flashy effects should feel good, not overwhelming or try-hard.
- **Incremental** — ship visible improvements often instead of one giant rewrite.
- **Desktop ready** — every decision should consider "will this work when wrapped in Electron?"

---

## 8. Starting Point Recommendation (for next session)

Current recommended starting task:

**Phase 0: Complete** (fully as of 2026-07-02).

- Full modular split done (index.html is thin shell, all systems in js/ + data + systems).
- Many reported bugs fixed: explore clicks, auto, rates, dungeon clicks/popups, dropdowns, party stale after fuse, import/export/save buttons, visible script text, shadowfen unlock flow.
- Major features added: full Party system (up to 30 via Leadership), combined Party Power, release/culling, multi-star evolution (1★-5★ with scaling reqs + power), front-and-center resource popups (always shown via showGainModal, chained reveals, no bottom resource toasts).

**Phase 1: Strong progress** (see REFACTOR_PROGRESS.md for full details).
- Visuals heavily upgraded (rarity frames matching shaped blobs with inset -5px, badges, element mouths/eyes/blink, on-mission, evolution stars, animations).
- Collection: Haven party-only grid + mini XP; management grid of Raid-style .collection-card with visuals/XP/rarity borders/stars/controls (no redundant text).
- Popups: Exploration + dungeons use nice centered modals with icons for all gains (even alongside slime tames). Slime reveal chained.
- Detail + UI: XP bars everywhere, trait badges, multi-star evo display, on-mission status.
- Small 07-02 polish: cross-region unlock (Shadowfen etc.) now reliably updates switcher buttons on clear.
- Global styles + progress started.

Next priority (per REFACTOR_PROGRESS): Finish remaining Phase 1 (more personality/faces/idle effects in createSlimeVisual, richer details, broader frame application, better reveal ceremony). Then Phase 2 (spectacle on explore/combat results).

See REFACTOR_PROGRESS.md "How to continue later" and wrap-up for exact resume steps.

---

**This document is the single source of truth for long-term direction.** Update it as the project evolves.

Let's make some cool slimes. 🐾

---

## 9. Phase 0 Progress (Updated by Grok Build)

**Completed (Phase 0 foundation):**
- Full modular extraction to match target architecture:
  - `js/data/constants.js`, `js/state.js`, `js/visuals.js`, `js/ui.js`, `js/main.js`
  - `js/systems/` (exploration.js, combat.js, management.js, alchemy.js, progression.js)
- `index.html` is now a clean thin shell (HTML structure + modals + ordered script loads + tiny bridge).
- All cross-calls via window.* exposure + init order safety.
- Bugs addressed during/after split: nodes, auto, dungeons, dropdowns, party sync, imports, no stray script text, etc.

**Current state (2026-07-02):**
- Project fully modular (all major logic out of index.html).
- Game runs cleanly via `index.html` or `npm start`.
- Later sessions added major gameplay on the solid base: Party + power (max ~30), 5★ evolution, resource popups always (front+center, chained), no bottom toasts, Raid-like collection cards + stars + XP bars.
- Minor polish: reliable region unlock visuals.
- See REFACTOR_PROGRESS.md for detailed timeline.

**Next after Phase 0**: Phase 1 completion then Phase 2.

*Last updated: 2026-07-02*
