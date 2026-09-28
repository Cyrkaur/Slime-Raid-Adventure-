# UI polish audit — same feel everywhere

**Last updated:** 2026-07-22 (polish pass 2)  
**Gold standard:** `← Village` / ink panels / gold stroke / hover scale.

## Shared helpers (use everywhere)

| Helper | Use for |
|--------|---------|
| `addBackButton` | Navigation |
| `addTitle` | Mode titles |
| `addCurrencyStrip` | Economy HUD |
| `addButton` | Primary CTAs |
| `addInkPanel` | Cards / sheets |
| `addListRow` | Shop / vault / facility rows |
| `addMapPin` | Campaign location nodes |
| `addDetailSheet` | Stage detail + Battle CTA |
| `addHubNavChip` | Village travel |

---

## Status after this pass

| Screen | Shell | Body / cards | Notes |
|--------|-------|--------------|--------|
| Village | ✅ | ✅ | Chips + settings |
| Campaign chapters | ✅ | ✅ | `addInkPanel` cards |
| Campaign map pins | ✅ | ✅ | `addMapPin` + pulse |
| Campaign battle panel | ✅ | ✅ | `addDetailSheet` |
| Pre-battle | ✅ | ✅ | Back/title/start button |
| Dungeons | ✅ | ✅ | `addListRow` + boss ink cards |
| Champions roster | ✅ | ✅ | + currency strip |
| Champion detail | ✅ | ~ | Sheet ink earlier; CTAs ok |
| Vault | ✅ | ✅ | List rows |
| Great Hall | ✅ | ✅ | List rows |
| Workshop | ✅ | ✅ | List rows |
| Chronicle | ✅ | ✅ | Records ink panel |
| Market | ✅ | ✅ | Buttons |
| Eternity | ✅ | ✅ | Buttons |
| Alchemy | ✅ | ✅ | `addListRow` recipes + ink transmute footer |
| Summon | ✅ | ✅ | Ink banner cards + gold resource/result plates |
| Gear / evolve modals | ✅ | ✅ | Ink shells, gold ticks, `addButton` CTAs |
| Chronicle | ✅ | ✅ | Records ink + element chips |
| Battle HUD | — | own language | Combat-specific |

### Still lighter (optional next)

- [x] Summon banner cards to ink rows  
- [x] Alchemy recipe colors → ink + gold  
- [x] Gear/evolve modals onto ink shell  
- [x] Element chips on Chronicle  

---

## Definition of polished

1. Back + title (+ currency when relevant)  
2. Ink/charcoal fills (not green jade slabs)  
3. Gold (or rarity) strokes  
4. Hover scale / feedback  
5. Primary actions via `addButton` / `addListRow` / `addMapPin` / `addDetailSheet`  
