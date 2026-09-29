# Raid of the Gel: Hero Design

Living design doc for the slime heroes. Source of truth for art, 3D, and roster decisions. Last updated 2026-09-28.

## 1. Pillars
- Every hero is a slime first. Even the most humanoid form is still gel at the core.
- Heroes are 3D models in the 3D fight scene. The painted plates in `assets/slimes/` are the style reference and the fallback until each 3D form passes.
- Quality bar: AAA-adjacent stylized. Each hero must read as wet, living gel at fight distance and in close-up.
- Free assets only (CC0 first, CC-BY with credit). Every third-party piece is logged in `assets/models/CREDITS.md`.

## 2. Roster today
16 elements: Water, Fire, Earth, Plant, Lightning, Ice, Shadow, Light, Metal, Poison, Crystal, Lava, Storm, Wind, Spirit, Void.

Each element has 4 form tiers (from `resolveFormTier` in `src/data/gameData.js`):

| Form | Who gets it | Look |
|---|---|---|
| Blob | Common, Uncommon | Soft teardrop body, big baby eyes, one element feature |
| Morph | Epic, some Rare, evo 2+ | Blob plus two gel tentacle arms, defined eye shape, gel brow |
| Ascended | Legendary, Epic evo 3+ | Shaped torso, arms, element armor or crown pieces |
| Humanoid (shaped) | Mythic, Legendary evo 5+ | Near-humanoid gel figure with face, hands, drips; full element silhouette |

16 × 4 = 64 hero forms, plus 8 enemy archetypes (beast, golem, humanoid, dragon, undead, plant, insect, elemental).

## 3. How a hero is built (the kit system)
- **4 base bodies**, one per form, each with a shared rig, eye rig, and animation set: idle, move/hop, attack, cast, hit, faint.
- **Per-element kit** = slime material preset + motion settings + ornament set. Ornaments grow with the form (for example, Lava goes from an ember crest on the blob to horns and crust plates on the humanoid).
- **Generator**: a Blender Python script turns any element × form into a game-ready GLB with levels of detail. A new element or hero is a new kit, not new sculpts. Hand polish goes on top.
- **In game**: the fight picks the model by element and form. The sprite is the fallback.

## 4. Slime properties by element
The gel behaves differently per element, in both the material and the motion.

| Element | Gel look | Motion |
|---|---|---|
| Water | Clear, high transmission, magnifying | Fast, loose jiggle |
| Fire | Translucent orange, bright inner flicker | Quick, twitchy, flame licks at top |
| Earth | Dense, cloudy, pebbles suspended inside | Heavy, low bounce |
| Plant | Cloudy green, leaves and moss inside | Soft sway |
| Lightning | Pale yellow, crackling inner arcs | Jittery, snappy |
| Ice | Semi-frozen, frost rim, cloudy core | Stiff wobble |
| Shadow | Dark, smoky edges, low transmission | Slow, slinking |
| Light | Bright, glowing core, iridescent | Floaty, gentle |
| Metal | Mercury-like, mirror reflective | Heavy, slow settle |
| Poison | Murky, bubbling, sickly tint | Gurgling, uneven |
| Crystal | Clear gel with faceted crystals inside | Rigid, chimes on impact |
| Lava | Thick, glowing core, dark crust patches | Slow, viscous sag |
| Storm | Dark blue-grey, swirling cloud inside | Turbulent |
| Wind | Very clear, swirling streaks | Light, bouncy, drifting |
| Spirit | Ghostly, soft glow, fades at edges | Hovering, slow bob |
| Void | Near-black with starfield inside | Unsettling, slow pulses |

The exact material values live in the generator's kit files.

## 5. Eyes
- Every hero has eyes at every evolution level. Eyeless designs are for enemies only.
- Eyes float inside the gel just under the surface. They ride the squash and stretch with a slight lag and wobble.
- Stylized, not realistic: big dark pupils, one or two highlights, glossy surface. No realistic irises.
- The eyes do the acting: blink, look at target, squint to attack, go wide when hit, close or daze on faint.
- Element touches: Lava ember glow, Ice frost rim, Shadow slit pupils, Light white-gold, Metal polished bead, Water magnified through clear gel.
- Deliberate exceptions: Void and Spirit get one big eye or glowing slits, Crystal eyes are facets inside the crystal, Poison has several small eyes in the murk.
- Evolution shows in the eyes. Blob = big round baby eyes. Morph = defined shape plus gel brow. Ascended and Humanoid = glowing irises, runes around the eyes, optional third eye or crown.

## 6. Quality gates (every form)
- **Silhouette distinct**: recognizable as a black silhouette at fight size, across elements and across forms.
- **Slime read**: looks like wet gel, never plastic or matte.
- **Eyes read**: close-up and fight-distance stills.
- **Beats the sprite**: side-by-side with the painted plate from the fight camera.
- **Grounded**: contact shadow, no floating.
- **Budget**: LOD0 at most 10k triangles, textures at most 1k, fight frame rate no more than 10% below the sprite build.
- **Animation**: all clips play in game without popping.
- `npm test` passes.

## 7. Build plan
| Run | Scope | Review |
|---|---|---|
| R1 | Water, Fire, Plant as blobs, with the new eyes | One sit |
| R2 | Same three through all 4 forms; locks the base bodies | One sit |
| R3 | Other 13 elements, all 4 forms, via generator plus polish | 64-form lineup sheet |
| R4 | Enemies, fusion looks, performance pass | One sit |

## 8. Hero roster plan (from the existing design, Grok Build sessions, July 2026)
Source docs: `Slime Adventure/WORLD_AND_CHAMPIONS.md`, `Slime Adventure/js/data/lore.js` (`LEGENDARY_LEGENDS`, `MYTHIC_LEGENDS`), `Slime-Raid-Adventure-/GAMEPLAN.md` ("Common–Rare = species types; Epic+ = unique champions, sig skills + looks").

- **Common to Rare = species.** One look per element lineage (Tideborn, Emberheart, Stonegut, ...), with 3 body variants for variety. Built by the kit system (blob and morph bodies).
- **Epic and up = unique champions** with their own signature skills and their own looks.
- **16 named Legendary legends**, one per element. Each is a singular character with a bio: Maris of the Last Rain (Water), Cinder-King Vorr (Fire), Granny Bedrock (Earth), The Unposted Letter (Wind), Harvest-Saint Briar (Plant), Arc of the Broken Bell (Lightning), Judge Stillwater (Ice), Quiet-Knife Nox (Shadow), Dawn-Herald Solenne (Light), Smith-Echo Korr (Metal), Apothecary Mire (Poison), Mirror-Saint Lira (Crystal), Glassroad Ember (Lava), Captain Squall (Storm), Lantern-Walker Ashen (Spirit), The Negotiated Hole (Void).
- **16 named Mythic legends**, Shape-Bound (humanoid gel) by default: The First Rain That Had a Name, Heart-of-the-Second-Sun, World-Shelf, Breath-Between-Ages, Seed-of-the-Eternal-Garden, Syntax-of-Storms, Clock-That-Chose-Winter, Umbral-Treaty, Candle-Against-the-Crack, Crown-That-Was-Tools, Cure-That-Wore-Fangs, Prism-of-Unwritten-Maps, Hearth-of-the-Deep-Fault, Parliament-of-Clouds, Choir-of-the-Unmelted, The Exception.

**Status gap:** these named legends live in the HTML classic's `lore.js`. They are not yet in the Phaser project's `src/data/`. Porting them (data, lore tab, summon odds, signature skills) is feature work; giving each one a unique 3D look is art work.

**3D implication:** species use the shared kit system. Every Legendary and Mythic legend gets a bespoke hand-authored design on the ascended or humanoid body: its own silhouette, ornaments, and eye treatment drawn from its bio. That is 32 named heroes with individual designs, on top of the 16 species lineages.

**Expanded roster:** see `HERO_ROSTER.md` (2026-09-28). It adds one new named Epic champion per element and gives every named hero a visual design and signature skill idea. New totals: 16 species lineages with 48 variants, plus 16 Epic champions, 16 Legendary, and 16 Mythic = **48 named heroes**.
