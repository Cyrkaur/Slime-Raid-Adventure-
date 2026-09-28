# Smoke checklist — after cache bumps

**Ship track:** `Slime-Raid-Phaser`  
**When:** after any `index.html` `?v=` bumps or first-hour / combat / equip changes.  
**Run:** `PLAY.command` or `npm start` → **hard-refresh** (Cmd+Shift+R).

---

## 1. Boot → Raid tutorial (new save)

- [ ] Intro dialogue + name
- [ ] **4 solo gel trials** in order (Water → Fire → Plant → Earth) — use each gel
- [ ] **CHOOSE YOUR EPIC** pick screen → only one gel remains (Epic Lv10)
- [ ] Hub opens with coach pointing at **Campaign**
- [ ] Campaign blocked until pick is done

## 2. Campaign first fight (solo Epic)

- [ ] Party is **one** gel; Whispering Glade feels moderate (not free)
- [ ] Pre-battle: power match-up, affinity tip
- [ ] Battle: painted gels + 3D arena (if GFX on)
- [ ] Skill bar works (single-target vs AOE do not mix)
- [ ] Win → results splash with **Spoils** chips (gold, shards, EXP, level-ups, gear)

## 3. First-win loop

- [ ] First campaign win: bonus gold/shards/jelly + Life relic
- [ ] Relic auto-equips when a free slot exists
- [ ] Champions → detail → Haven Life kit already on Epic
- [ ] Lead has weapon + chest from tutorial kit

## 4. Equip → evolve path

- [ ] Vault lists set progress / filter chips
- [ ] Equip a drop on a second gel from Champion sheet
- [ ] Train / clear until a gel hits level cap → **Evolve** modal opens
- [ ] Common 1★: fodder consume → purple star; Mythic gets ritual flourish

## 5. Regression quick hits

- [ ] Dungeon: multi-wave HUD (WAVE X/Y) if multi-wave dungeon
- [ ] Summon: banner + closable results
- [ ] Settings / GFX toggle still reachable from hub
- [ ] ⚙ **Sound** cycles volume / mute; combat hit + win sting after first click
- [ ] Offline: disconnect network — Phaser/Three still load from `vendor/`
- [ ] `npm test` green before sharing a build

---

## Desktop (C1–C3)

- [ ] `npm run desktop` opens a native window with gel app icon
- [ ] Game boots offline (no CDN needed if `vendor/` present)
- [ ] `npm run dist:mac` produces `dist/mac-arm64/Raid of the Gel.app`
- [ ] Open the `.app` → tutorial/hub loads
- [ ] `npm run pack:friend` produces `dist/Raid-of-the-Gel-mac.zip` with **HOW_TO_OPEN.txt**
- [ ] `npm run release:mac` = tests + friend zip (pre-itch check)

## Dev reset

Hub settings (or console): wipe save / `SR_STATE.resetGame()` then hard-refresh to re-test first-hour kit + coach.
