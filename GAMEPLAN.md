# Raid of the Gel — Gameplan (ship track)

**Read this first.** One product goal. One critical path. Do not reopen done systems unless they block the path.

**Last updated:** 2026-08-25

---

## 0. Where we work

| Role | Path |
|------|------|
| **Ship track (edit this)** | `/Volumes/Maximus/Maximus Prime/Workspace-Grok_Build/projects/Slime-Raid-Phaser` |
| Windows same volume | `G:\Maximus Prime\Workspace-Grok_Build\projects\Slime-Raid-Phaser` |
| HTML classic (reference only) | `…/projects/Slime Adventure` |
| Godot (frozen) | `…/projects/Raid-of-the-Gel-Godot` |

Play: `PLAY.command` / `PLAY.bat` / `npm start` → `http://127.0.0.1:8090` · Desktop: `npm run desktop`  
Hard-refresh after `?v=` bumps. **Not** `file://`.

---

## 1. Goalpost (north star)

### One sentence

**Ship a single-player, installable Raid-like gel collector** where the first hour teaches combat, hands you an Epic bond, and the loop *fight → loot → gear → grow party → harder fights* is fun offline — cozy Softened Realms fantasy, not live-ops gacha.

### Player fantasy (must feel true)

| Pillar | Done? | Bar |
|--------|-------|-----|
| **Raid tutorial** | ✅ | 4 gel trials → pick 1 Epic → campaign unlocks |
| **Combat** | ✅ | Readable SPD fights, 3D arena, skills, affinity, gear sets matter |
| **Growth loop** | ✅~ | Gear vault, evolve stars, first-win buddy; keep midgame clear |
| **Village hub** | ✅ | 11 modes, ink UI, currencies |
| **Share / play** | ✅ | PLAY scripts + offline `vendor/` Phaser/Three |
| **Installable desktop** | ✅ | Electron shell + mac `.app` + friend zip |
| **Audio** | ~ | Procedural SFX live; real pack optional polish |
| **Store page** | ❌ | itch draft ready (`docs/ITCH_RELEASE.md`) — publish when you choose |

### Explicit non-goals (do not spend sessions here)

- Paid gacha / live-ops / accounts  
- Full RSL clone or new game modes for parity with HTML idle-march  
- Godot rewrite  
- Art flipbook VFX Phase D stretch until desktop ships  
- Steam achievements before installable build  

---

## 2. Critical path (only unfinished work that moves the goalpost)

Order is intentional. **Do the top incomplete item.**

| # | Track | Status | Exit criteria |
|---|--------|--------|----------------|
| **C0** | First-hour → midgame loop | **Done** | Tutorial → Epic → gw1 moderate → first-win buddy → equip/evolve path works |
| **C1** | **Desktop app shell** | **Done** | Electron `electron/main.js` + `npm run desktop` / `PLAY-DESKTOP.command`; local static server + window |
| **C2** | Desktop packaging | **Done** | App icons + `npm run dist:mac` → `.app` |
| **C3** | Shareable build | **Done** | Mac + Windows customer zips via `npm run pack:customers` |
| **C4** | Audio polish | Optional | Sample pack — only if playtesters ask |
| **C5** | Store listing | Optional | Upload both zips; copy in `docs/ITCH_RELEASE.md` |

**If blocked on C1:** fix only bugs that break the C0 loop (crash, empty party, magenta cutting silhouette, campaign gate wrong). Do not invent new systems.

### Optional polish queue (only after C1, or a true C0 blocker)

1. Remaining enemy chroma outliers (spot-fix, remake plate if needed).  
2. ~~Early party fill (3rd gel)~~ ✅ first-win Rare + 3rd Rare after 2 stage clears.  
3. ~~VFX boost + elemental statuses~~ ✅ · ~~painted FX pack~~ ✅ · ~~RSL combat chrome~~ ✅ (callout plate, status pills, turn strip, active nameplate).  
4. Real music pack / audio samples.  
5. Offline idle patrol parity with HTML classic.  
6. Optional: 4th gel / more FX flipbooks.

---

## 3. What already shipped (do not re-litigate)

Core stack and loop are **feature-complete enough to package**:

- Phaser 3 + Three combat blit · 1920×1080 FIT · `localStorage` saves · `npm test`  
- Hub 11 modes · campaign 10 chapters · dungeons multi-wave · vault gear + sets · star evolve  
- Combat: affinity, set bonuses, cast spool, VFX A–C + kit recipes, Raid power score, 250 HP pips  
- Raid tutorial · Haven kit · first-win buddy · mythic evolve flourish · offline vendor libs  
- Procedural audio bus + ⚙ Sound · UI ink parity · smoke checklist  
- Hero design (3D gels, forms, eyes, element properties): `docs/HERO_DESIGN.md`  
- Hero roster (species lineages, 48 named Epic / Legendary / Mythic heroes): `docs/HERO_ROSTER.md`, data in `src/data/heroRoster.js`  

Long inventory: git history + section “Shipped milestones” archive below if needed. **New sessions start at §2.**

### Shipped milestones (archive, skim only)

Stars/evolve · gear drops/enhance/2pc-4pc · pre-battle · multi-wave dungeons · trait synergies · vault filters · UI polish · chroma gelKey8/enemyKey8 · offline vendor · Raid tutorial · wolf teal plate · first-win Rare partner.

---

## 4. Session operating system

1. Open **this** `GAMEPLAN.md` §1–2 only.  
2. Work only in Slime-Raid-Phaser `src/` (+ `vendor/`, `electron/`, assets as needed).  
3. **Highest incomplete row in §2.**  
4. Ship small; bump `?v=` on touched scripts in `index.html`.  
5. `npm test` + hard-refresh smoke of the path you touched.  
6. Update §2 status when a track exits. Do not grow the roadmap sideways.

### Coding rules (short)

- Painterly fantasy plates; combat GLB = opt-in only.  
- Gear = drops; enhance separate; no craft in picker.  
- Stars fixed by rarity; purple via fodder at level cap.  
- Cozy single-player; no exploit work.

---

## 5. Success criteria (ship bar)

| Criterion | Status |
|-----------|--------|
| Landscape hub + modes | ✅ |
| Painted gels + live combat | ✅ |
| Raid tutorial → Epic solo → campaign | ✅ |
| Gear / evolve / party growth seed | ✅ |
| Offline engine libs (no CDN required) | ✅ |
| Shareable web play path | ✅ |
| **Installable desktop window** | ✅ `npm run desktop` + packaged `.app` |
| Icon + friend-proof package | ✅ icon + mac `.app` + HOW_TO zip · Win config ready |
| Real audio pack | Optional |
| itch/Steam | After desktop |

---

## 6. Related docs

| Doc | When |
|-----|------|
| `docs/SMOKE_CHECKLIST.md` | After cache bumps / release candidates |
| `docs/ART_STYLE.md` | Painting or chroma remakes |
| `docs/COMBAT_VFX_PLAN.md` | Only if combat VFX is the active C-item (it is not) |
| `SHARE.md` | Friend zip instructions |
| `FEATURE_PARITY.md` | Mode inventory (auto) |
| `docs/HERO_DESIGN.md` | 3D heroes: forms, eyes, gel by element, quality gates |
| `docs/HERO_ROSTER.md` | Named heroes and species looks (source for `src/data/heroRoster.js`) |

---

## 7. This week’s focus (auto)

**Customer one-click (both OS):** `npm run pack:customers`  
→ `dist/Raid-of-the-Gel-mac.zip` + `dist/Raid-of-the-Gel-windows.zip`

**Dev one-click:** Mac `Play Raid of the Gel.app` · Windows `Play Raid of the Gel.vbs`

**Critical path C0–C3 is complete.** Optional: itch publish, real audio pack.
