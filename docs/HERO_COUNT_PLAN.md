# Raid of the Gel: Hero Count Plan (Body Control)

Gameplan for how many heroes we build, what shapes they take, and how the pipeline gets from 48 named heroes at launch to 300+ over the roadmap. Companion to `HERO_DESIGN.md` and `HERO_ROSTER.md`. Written 2026-09-28. Planning doc only: **no tuned numbers or stats.** Every effort figure below is an **estimate** in relative units, not hours.

Names: the lineage names are the Phaser set the founder chose: **Tideborn, Emberkin, Stoneward, Zephyr, Bloomkin, Stormcore, Frostgel, Shade, Lumina, Steelgel, Venomkin, Prism, Magma, Tempest, Wisp, Abyss**. The `HERO_ROSTER.md` copy in this folder still uses the old codex names (Emberheart, Stonegut, ...). Read those as the Phaser names. The repo copy on `feat/3d-heroes` (commit `b948c32`) already uses the Phaser names.

---

## 0. The short version

- **Thesis.** A slime's power is **body control**: how precisely, how complexly, how stably it holds a shape, and what it can hold inside that shape. Commons are blobs. Better slimes don't become more human. They become **more themselves**: a hero shapes its body to suit its aim, its element, and its personality. For named heroes, all three come from the backstory.
- **Humanoid is one choice among many.** Of the 32 Legendary and Mythic legends, 5 get a biped (humanoid) signature form. The other 27 are beasts, birds, serpents, constructs, swarms, a rooted form, and one abstract form (§5).
- **Launch lean: 48 named heroes** (16 Epic, 16 Legendary, 16 Mythic, already in data) plus the 16 species lineages × 3 variants. **Year one: 128 named. Roadmap: about 304 named** plus 96 species looks, organized into 16 cultures in 4 alliances (§8).
- **Rigs.** We don't use one humanoid rig. We use **a small set of archetype rigs**: the existing 4 plus 5 new ones (quadruped, serpent, avian, construct, swarm), 1 rig variant (rooted), and 1 shape-key set (abstract). A per-hero hook deform sits on top. Evolution inside a stage is a shader and parameter change, not a new model (§9, §10).
- **Build order:** Cody finishes the current Epic batch first. Then come the stage renames plus the "mastery tells" shader, the species pseudopod stage, rig wave 1 (quadruped, construct, serpent), rig wave 2 (avian, swarm, rooted, abstract), and finally transcendent forms (§12).

---

## 1. Founder thesis, restated as design rules

1. **Control, not humanity.** The ladder measures four axes of control. None of them is "how human it looks."
   - **Precision:** how crisp the edges, points, and thin parts are.
   - **Complexity:** how many distinct parts it can form and move at once (arms, legs, wings, sub-bodies).
   - **Stability:** how long it holds a shape under stress (movement, hits, casting) before it sags back.
   - **Composition:** what it can hold and arrange inside itself. This runs from loose suspended bits, to sorted bands, to assembled hard parts, to two gels in one body.
2. **Shape follows aim.** A named hero's final form is the shape its story needs. The anvil that walked home is an anvil on legs. The thief who melted through bars is a pouring cat. The letter that arrived early is a flock of pages.
3. **Always a slime.** Every form keeps a gel core, a contact puddle or drip, visible interior matter, and eyes (HERO_DESIGN §1, §5). Even a crystal tower or a swarm reads as gel holding a shape.
4. **Species stay simple.** Common, Uncommon, and Rare stay on the species ladder: **blob → pseudopod → morph**.

---

## 2. Slime physics: the rules a player can read on sight

These rules make every form feel earned. A player who has seen ten slimes should be able to tell, without a tooltip, which one has more control and what it is straining to do.

### 2.1 Core laws
| # | Law | What the player sees | Why it matters |
|---|---|---|---|
| 1 | **Gel sags unless held.** A slime at rest relaxes into a dome. | On faint, stun, or sleep, every hero partly melts back toward a blob. Revive = the shape "stands back up." | Proves the shape is effort, not a costume. Also a free, readable hit and faint state. |
| 2 | **Thin is hard.** Thin limbs, sharp points, flat planes, holes, and gaps cost more control than round volumes. | Low rarity has stubby, rounded parts. High rarity has wings, blades, fingers, and see-through gaps. | Gives rarity a visible cause, not just a bigger size. |
| 3 | **Mass moves, it doesn't appear.** New parts come from somewhere. | When an arm or wing forms, the body visibly thins or dips. When a form collapses, the volume flows back. Big forms pull in element matter (sand, water, embers, stone). | Transformations look physical. |
| 4 | **Grounded unless the element floats.** | Every hero touches the floor through a gel foot or puddle. Hover is allowed only for elements whose gel is light (Wind, Spirit, Light, Storm, Void), and even then with a drip, tether, or shadow that links to the ground. | Keeps the "grounded" gate honest and makes floating special. |
| 5 | **Eyes live in the core.** | Low control: big eyes that drift and lag. High control: eyes seated deeper and steadier, and able to move to where the form needs them (a hound's head, a bell's crown). | Eye seating becomes a mastery tell, built on the v4 eye rig. |
| 6 | **The core glow is effort.** | A strained slime's core flickers or dims. A master's core is steady. | One glance reads "struggling" vs "effortless." |
| 7 | **Composition climbs in steps.** | Suspended bits drift at random → sorted into bands → assembled into hard parts (armor, tools, panes) → two different gels in one body with a clean boundary. | Gives Epic, Legendary, and Mythic a material story, not just a shape story. |
| 8 | **Hits cost definition.** | On a hit, the shape briefly softens (edges blur, a drip falls), then re-firms. Higher control re-firms faster. | Combat feedback that explains itself. |

### 2.2 Strain vs mastery tells (these are shader and rig parameters, not new models)
| Tell | Strain (low control / under stress) | Mastery (high control) |
|---|---|---|
| Edge firmness | Soft, rounded, edges wobble when holding a pose | Crisp edges with a thin wet bevel that stay put |
| Surface finish | Cloudier, duller, more drips at the lowest points | Glossy clearcoat, drips only where the design wants them |
| Core glow | Flicker, dimming on long holds | Steady, pulses only on intent (cast, attack) |
| Eye seating | Large lag and wobble, eyes drift toward the surface | Seated, small controlled lag, gaze locks cleanly |
| Jiggle | Whole-body jiggle on every move | Jiggle only in chosen soft zones (belly, hem, tail); hard parts stay rigid |
| Inclusions | Floating at random | Banded → assembled into parts → mixed gels |
| Contact puddle | Wide, spreading | Tight, neat, or a deliberate design feature (rain column, glass road) |

Each tell maps to one generator or runtime parameter, so an evolution *inside* a stage (for example Epic evo 1 → 2) is a parameter step. The core one is a **definition** value from "melted" to "crisp," which also drives laws 1 and 8 at runtime.

### 2.3 What each element's gel can and can't do
Built on the gel table in HERO_DESIGN §4. "Can't" means can't without high control or help from another element. It is a natural limit that gives each element a shape personality.

| Element (lineage) | Easy | Hard (needs high control) | Natural limit / tell |
|---|---|---|---|
| Water (Tideborn) | Flow, split and rejoin, lenses, columns | Holding hard edges or flat planes | Edges round off if unattended; clearest gel, so eyes magnify |
| Fire (Emberkin) | Tall rising shapes, licks, crests | Low, heavy, wide shapes held for long | Tops flicker; strain = the flame shrinks |
| Earth (Stoneward) | Dense mass, carrying stone inclusions | Thin parts, fast shape change | Heavy settle; strain = pebbles slide down |
| Plant (Bloomkin) | Growing branches, rooting, petals | Fast movement, sharp metal-like edges | Growth is slow; mastery = blossoms on cue |
| Lightning (Stormcore) | Fast, jagged, spiky shapes, arcs | Holding still or smooth | Jitter never fully stops; strain = arcs misfire |
| Ice (Frostgel) | Hard edges, planes, points, stillness | Fast shape change, soft flow | Rigid; strain = frost cracks and a stiff wobble |
| Shadow (Shade) | Thin smoky edges, slipping through gaps | Crisp bright surfaces, solid mass | Edges smoke off; mastery = smoke that holds a line |
| Light (Lumina) | Hovering, emitting, halos, rays | Dense heavy mass | Too much mass dims it |
| Metal (Steelgel) | Mirror-hard plates, heavy tools | Fast change, thin flutter | Slow settle; strain = plates sag and lose mirror |
| Poison (Venomkin) | Bubbling, splitting into many small bodies, many eyes | Clean edges, a single hard shape | Bubbles pop at the surface; mastery = controlled drips |
| Crystal (Prism) | Facets, panes, rigid geometry | Soft organic curves, flex | Brittle; strain = visible cracks and chimes |
| Lava (Magma) | Crusting into hard shells, sagging mass, trails | Speed, thin parts | Viscous; strain = the crust cracks and glows |
| Storm (Tempest) | Churning volumes, clouds, hovering | Fine detail, stillness | Turbulent; mastery = the swirl turns on purpose |
| Wind (Zephyr) | Very light, streaming, trails, hovering | Mass, holding weight | Always drifting; strain = the shape blows apart |
| Spirit (Wisp) | Fading edges, hovering, faces inside, many tails | Solid contact, crisp outline | Fades at the edges by nature |
| Void (Abyss) | Holes, negative space, starfield, outline shifts | A stable outline at low control | Outline drifts; mastery = a clean, steady hole |

Rule for designers: a hero's signature form should use what its element does **easily** for its bulk, and show off **one "hard" feat** as proof of mastery (Ice holding a pendulum swing, Water holding a sharp oar blade, Shadow holding a clean knife line).

---

## 3. The body-control ladder

The stages are defined by control, not by how human the body looks. Current code names are in brackets.

| Stage | Control profile | What the player sees | What it unlocks (reasoned, no numbers) |
|---|---|---|---|
| **S0 Puddle** | None held | A spread puddle with eyes. Used for faint, sleep, and summon reveal only, never as a resting form. | None. A state, not a stage. |
| **S1 Blob** [blob] | Holds a dome and one element feature | Soft teardrop, baby eyes, one feature (HERO_DESIGN §2) | Basic attack with the whole body. Stats lean soft and durable, since a dome is the stable shape. |
| **S2 Pseudopod** [new] | Pushes out 1–2 temporary nubs and holds them briefly | Stubby gel nubs that form on attack or cast and melt back at rest. First sorting of inclusions. | Reach: the basic attack becomes an element-flavored strike, and the first element feature becomes active (a splash, a spark). |
| **S3 Morph** [morph] | Holds two gel arms, a defined face, and a brow | Blob plus two semi-shaped tentacle arms (existing morph base) | Two "tools", so a second active skill. Stances and poses become readable. |
| **S4 Shaped** [ascended] | Holds a torso and arms plus **assembled hard parts** (armor, crown, tool) | Existing ascended base plus the hero's hook fully formed | Hard parts carry the named hero's signature skill in its full visual form. Composition first affects combat reads (armor → defense, tool → a specific effect). |
| **S5 Signature Form** [was humanoid] | Holds the hero's **chosen archetype**: many parts, thin features, stable under stress | The hero's true shape: beast, bird, serpent, construct, swarm, rooted, abstract, or biped | The archetype adds a reasoned passive flavor (see below). Mastery tells at full. |
| **S6 Transcendent** [new] | Goes past one body: **split bodies, mixed gels, architectural scale, or form-shifting** | A second body, a two-material boundary, a structure-sized silhouette, or a form swap mid-fight | A battle-altering effect tied to the form (split targeting, a form swap, a field aura). Mythic top, or a special tier. |

**Archetype → reasoned gameplay flavor** (a direction for the combat pass, not numbers):
| Archetype | Body logic | Reasoned flavor |
|---|---|---|
| Biped | Hands free for tools; upright | Versatile tool and skill use; leadership or buff effects |
| Quadruped | Low, planted, pounces | Speed or turn-meter plays, pounce or execute, guarding a lane |
| Serpent | One long body; coils and trails | Multi-hit, bind or constrict, trails and zones along a path |
| Avian | Wings, lift | Turn-meter, evasion, acting early, aerial strikes |
| Construct | Hard parts held in gel | Defense, reflect, shields, armor-break |
| Swarm | Many small bodies around one core | Multi-target hits, split or shared damage, spreading effects |
| Rooted | Anchored base, branches | Sustain, heal over time, zone control |
| Abstract | Negative space, impossible geometry | Rule-bending: remove buffs, passives, or immunities |

**Control axes → stat direction** (links only): stability ↔ defense and resistance; precision ↔ accuracy and crit; complexity ↔ number of skills and effects; composition ↔ elemental power and hybrid effects.

---

## 4. Rarity × evolution matrix

Evolution caps come from `RARITY_BASE_STARS` in `gameData.js`: Common 1, Uncommon 2, Rare 3, Epic 4, Legendary 5, Mythic 6 purple stars.

| Rarity | Who | Evo 0 (start) | Stage changes | Max body | vs today's `resolveFormTier` |
|---|---|---|---|---|---|
| Common | Species | Blob | Pseudopod at evo 1 | **Pseudopod** | Today: blob (evo 1 < 2). Adds pseudopod. |
| Uncommon | Species | Blob | Pseudopod at evo 1, Morph at evo 2 | **Morph** (soft, low tells) | Today: morph at evo 2. Same, with pseudopod in between. |
| Rare | Species | Pseudopod (replaces the 1-in-3 random morph) | Morph at evo 2; evo 3 = Morph with a first **assembled** inclusion (one held stone plate, one ice point) | **Morph+**, the species ceiling | Today: 1 in 3 start morph, all morph at evo 2. |
| Epic | Named | Morph + hook | Shaped at evo 3 (as today) | **Shaped** | Same stages. |
| Legendary | Named | Shaped + hook (existing ascended base) | **Signature Form at evo 5** (replaces "humanoid at evo 5") | **Signature Form** | The evo 5 swap goes to the hero's archetype, not always humanoid. |
| Mythic | Named | **Signature Form** | **Transcendent at evo 6** | **Transcendent** | Today: always humanoid. Now archetype, plus a new top stage. |
| (Option) Special tier | Named Legendary via fusion or event | — | Transcendent unlock | Transcendent | New. Founder decision (§13). |

- **Beyond humanoid** (Signature Form and Transcendent) is reserved for Legendary and Mythic. **Transcendent** is Mythic-only unless the founder opens a special tier.
- **Evolution inside a stage** (for example Epic evo 1 → 2, or Legendary evo 1 → 4) moves the mastery tells in §2.2: firmer edges, steadier core, seated eyes. It is not a model swap. So every evolution still shows visible progress.
- **The Legendary evo 5 moment.** A Legendary holds a "polite" shaped form for most of its life, then at full awakening reveals its true shape. The anvil gets legs; the thief pours into a cat. That's a great reveal, and it's cheaper, because evo 0–4 reuses the ascended base that R2 locks.
- **Do named heroes start higher than species of the same rarity?** Today they don't overlap (species are C/U/R, named are E/L/M). Once **named Rares** arrive in year one, I recommend **no stage skip**. A named Rare starts at Pseudopod like species Rares, but with its hook present from evo 0 and its mastery tells one notch firmer. The rule stays readable: **rarity sets the stage, the name sets the quality of control within it.** The alternative (named start one stage higher) is listed as a decision.

**Code impact (for Cody later, not done here):** `resolveFormTier` gains `pseudopod`, `signature` (routed by the hero's `archetype` field), and `transcendent`. `humanoid` becomes the `biped` archetype of `signature`. `heroRoster.js` gains `archetype` per named hero. The `RARITY_LORE` bios need rewording away from "near-humanoid."

---

## 5. Signature archetypes for the 32 legends

Each form is drawn from the canon bio (`lore.js` `LEGENDARY_LEGENDS` and `MYTHIC_LEGENDS`) and keeps the hook, ornaments, and eyes in `HERO_ROSTER.md` §4–5, re-seated on the new body. Rules applied: **no more than 3 bipeds per 16** (≤20%), **no more than 3 of any archetype per 16**, and **the Legendary and Mythic of one element never share an archetype.**

### 5.1 Legendary (Shaped evo 0–4 → Signature Form at evo 5)
| Element | Legend | Signature archetype | Why this shape (from the backstory) | Hook carried over |
|---|---|---|---|---|
| Water | Maris of the Last Rain | **Avian (wader)**: a tall long-legged heron-like walker | She *walked* the dunes for forty nights and each step left a pool. Long legs make every step a pool. | Drip-curtain rain hat |
| Fire | Cinder-King Vorr | **Biped**: a broad upright furnace-king | "The forge melted; the fire stood up." Standing up *is* his story; he breaks chains with his hands. | Bellows shoulders, furnace chest, melting chains |
| Earth | Granny Bedrock | **Construct (seated)**: a boulder rocking chair with a gel upper body | She *sat* on a pass for three winters. She is furniture the army had to route around. | Rocking-chair base, moss shawl, stalagmite needles |
| Wind | The Unposted Letter | **Swarm**: a flock of page-shaped gel sheets around a sealed envelope core | News spreads; it arrives in pieces before the event. | Envelope flap and wax seal (the core) |
| Plant | Harvest-Saint Briar | **Rooted**: a living hedge-gate arch, rooted, with orchard and thorn branches | She grew two orchards *around* things. She becomes the hedge. | Bramble arch crown, orchard arm and thorn arm |
| Lightning | Arc of the Broken Bell | **Construct (bell)**: a floating bronze bell canopy with the gel body as the clapper | It "became the clapper of a bell that was not there." | Cracked bell and scorch-mark calendar ticks |
| Ice | Judge Stillwater | **Biped**: a very still, upright judge | A judge's authority is gesture and stillness (the raised, frozen gavel). Ice holds a stiff pose easily. | Icicle barrister wig, ice gavel |
| Shadow | Quiet-Knife Nox | **Quadruped (cat)**: a slinking cat whose body pours | Nox "melted through the bars." A thief cat that pours through gaps. | Trailing smoke scarf, umbra-blade tail or foreleg, note card |
| Light | Dawn-Herald Solenne | **Avian (herald bird)**: a rooster-like sunrise bird with the ray fan as tail and wings | A *herald of dawn* who refused a false sunrise. The bird that calls the true one. | Sunrise ray fan, clarion (as crest), third eye |
| Metal | Smith-Echo Korr | **Construct (anvil)**: an anvil torso on short mercury legs | "The anvil that walked home." | Anvil horn, sword-blank bundle |
| Poison | Apothecary Mire | **Swarm (vials)**: gel split across a hopping cluster of corked vials around a core flask | She tasted *every* toxin; each vial holds a piece of her. | Vial tower (becomes the swarm) and bandolier |
| Crystal | Mirror-Saint Lira | **Swarm (shards)**: an orbiting array of mirror shards around a clear core | She reflected a Void rift. Many mirrors catch every angle. | Mirror-shard wheel (expanded) |
| Lava | Glassroad Ember | **Serpent**: a long molten body whose tail cools into the glass road | She *laid a road* behind a fleeing Haven. Her body is the road. | Glass train that cools orange to black |
| Storm | Captain Squall | **Avian (storm petrel)**: a sea-storm bird with cloud-coat wings | She "became the wind that knew the reefs" and herded boats. A seabird leads boats. | Storm-cloud tricorn, lightning trim |
| Spirit | Lantern-Walker Ashen | **Quadruped (stag)**: a ghost stag with the lantern hanging from its antlers | A guide on spirit roads; the lost follow a light carried ahead of them. | Lantern with faint faces; the crook becomes antlers |
| Void | The Negotiated Hole | **Quadruped (hound)**: a hound-shaped hole on a leash of contract script | "Unmaking on a leash of trust." A leashed unmaking is a hound. | Gold seal ring (collar), script leash |

**Legendary mix:** Biped 2 · Quadruped 3 · Avian 3 · Construct 3 · Swarm 3 · Serpent 1 · Rooted 1.

### 5.2 Mythic (Signature Form at evo 0 → Transcendent at evo 6)
| Element | Legend | Signature archetype | Why this shape | Transcendent (S6) idea |
|---|---|---|---|---|
| Water | The First Rain That Had a Name | **Biped**: the lower body is a falling rain column | "One droplet decided to keep falling as a person." The bio asks for a person. | Splits into a rain shower of many small selves that rejoin |
| Fire | Heart-of-the-Second-Sun | **Serpent (comet)**: a star core leading a long streaming tail | A Soft Star that *fell*. Comet motion is its identity. | Black vacuum gel and white-hot star gel in one body (mixed gels) |
| Earth | World-Shelf | **Quadruped (colossus)**: a giant beast rising up with a plateau landscape on its back | "The continent that sat up." Land that gets up on all fours. | Architectural scale: the plateau becomes a battlefield feature |
| Wind | Breath-Between-Ages | **Avian (owl)**: a great silent owl whose wings are half-open doorways | "The silence after a door closes." Owls fly silently. | Becomes the draft through a floating doorway: the body is the empty frame plus moving air |
| Plant | Seed-of-the-Eternal-Garden | **Biped**: seed-husk cloak, root feet | Flowers pop up *where she steps*, so walking is the power. | Roots into a canopy tree for a turn, then walks out of it |
| Lightning | Syntax-of-Storms | **Swarm (glyphs)**: a body made of lightning glyphs that assemble into sentences | "A complete sentence." Words are many parts in order. | Rewrites itself mid-fight into a different sentence shape |
| Ice | Clock-That-Chose-Winter | **Construct (clock tower)**: a frosted clock body with a pendulum | "A clock that stopped at the moment a Haven would have fallen." | Time-frozen double: a second, frozen copy of itself |
| Shadow | Umbral-Treaty | **Biped**: a tall diplomat with a split robe | Night *negotiated and signed*. A signatory needs a hand and a quill. | Splits into lantern-lit and dark halves that act separately |
| Light | Candle-Against-the-Crack | **Construct (vessel/candle)**: a candle body with a wax-drip gel mantle and one flame | "A single candle held at the lip of a Void Crack." | Mixed gels: wax body and pure-flame gel with a clean line |
| Metal | Crown-That-Was-Tools | **Quadruped (multi-leg)**: a crown walking on tool legs (hammers, tongs, wrenches) | "The crown walked away." Tools become the legs that carry it. | Architectural: assembles a scrap wall or fort around the party |
| Poison | Cure-That-Wore-Fangs | **Serpent (cobra)**: a cobra body with a hood and fang drips | Medicine *and* venom. The snake is the medicine symbol with fangs. | Two-tone gel split: cure green and venom purple as separate bodies |
| Crystal | Prism-of-Unwritten-Maps | **Construct (tower/lighthouse)**: a crystal projector tower | "Projects maps of Havens that did not exist yet." A lighthouse that casts futures. | Projected maps become terrain on the arena floor |
| Lava | Hearth-of-the-Deep-Fault | **Quadruped (salamander)**: a heavy salamander with a hearth arch in its chest | "A fault that learned hospitality." A hearth beast warms the village. | Molten body and glass armor as mixed composition |
| Storm | Parliament-of-Clouds | **Swarm (council)**: a council of cloud bodies around a scepter core | "Clouds once held council." A council is many members. | Members vote: the swarm re-forms into one giant storm body |
| Spirit | Choir-of-the-Unmelted | **Serpent (procession)**: a long lantern-parade of wisps moving as one | "A choir of melted champions." A procession of many souls, like a parade dragon. | Separates into individual singers, then re-forms |
| Void | The Exception | **Abstract**: a floating accretion-disk ring with cupped hands around a Haven orb | "Unmaking that made an exception." It isn't shaped like anything; it's a rule with a hole in it. | The disk opens into a portal-shaped hole in the arena |

**Mythic mix:** Biped 3 · Quadruped 3 · Serpent 3 · Construct 3 · Swarm 2 · Avian 1 · Abstract 1.

**Across all 32:** Biped 5 (16%) · Quadruped 6 · Avian 4 · Construct 6 · Swarm 5 · Serpent 4 · Rooted 1 · Abstract 1. Within-element pairs all differ; the check was done row by row. Watch these in the lineup sheet: the Nox cat and Negotiated Hole hound (two Legendary quadrupeds, both dark); Maris and Squall (two Legendary birds, told apart by long wading legs vs wide sea wings).

Epics keep their `HERO_ROSTER.md` §3 designs. Their Shaped stage (evo 3+) carries the hook onto the ascended base, as that doc already plans.

---

## 6. The hero-creation formula (repeatable for hundreds)

Design any new hero with the same seven inputs, in this order:

| Step | Input | Decides | Source |
|---|---|---|---|
| 1 | **Element** | Gel look and motion, what's easy and hard to shape (§2.3) | Element kit |
| 2 | **Rarity** | Start and max stage, mastery-tell range (§4) | Matrix |
| 3 | **Backstory aim** (one verb: guard, carry, deliver, hide, spread, grow, lead, unmake) | Archetype (table below) | Bio |
| 4 | **Personality** (one or two words) | Posture, motion tempo, eye treatment, idle | Bio |
| 5 | **Culture / faction** | Ornament language: materials, motifs, colors (§8) | Culture sheet |
| 6 | **Archetype rig** (checked against quotas) | Base skeleton and animation set | Rig library |
| 7 | **Hero layer** | 1 hook deform + at most 3 ornaments + 1 gel twist (composition) + eye override + idle | Hand-authored |

**Aim → archetype (starting point, not a law):**
| Aim | Likely archetypes |
|---|---|
| Travel, deliver, scout | Avian, Serpent, Swarm |
| Guard, hold, endure | Construct, Quadruped (low and wide), Rooted |
| Carry, shelter, protect | Construct (vessel), Quadruped |
| Hide, infiltrate, steal | Quadruped (slink), Serpent, Abstract |
| Spread, many, gossip | Swarm |
| Grow, heal, anchor | Rooted, Biped |
| Lead, speak, bargain, craft | Biped, Swarm (council) |
| Unmake, bend rules | Abstract |

**Anti-lookalike rules (these scale to hundreds):**
1. **Hook registry.** Every named hero's hook is logged with a type (hat, crown, halo, back-wing, tail, arm-tool, body-shape, orbit, and so on) and a silhouette zone (head, back, arm, base, orbit). No two heroes of the **same rarity and element** share a type. No two heroes of the **same rarity and archetype** share type + zone.
2. **Archetype quotas.** Per rarity release: bipeds ≤20%. No archetype over a third of any one element's named heroes at that rarity. At full scale, every element has at least 5 different archetypes across its named heroes.
3. **Automated silhouette check.** The generator renders a black silhouette of every build from the fight camera (front and three-quarter). A script compares each new hero against all heroes of the same rarity, the same element, and the same archetype (for example by outline-overlap and contour-shape scores). It flags the closest pairs for human review. The flag threshold is tuned on the launch 48. **No number is set here.**
4. **Lineup sheets** per rarity, per element, and per archetype (HERO_DESIGN §6, `HERO_ROSTER.md` §6), regenerated automatically on every build.
5. **Physics compliance.** The hero's bulk uses its element's "easy" shapes and shows one "hard" feat (§2.3). Its mastery tells match its rarity.

**Hero card (the data shape a designer fills in):**
```
id, name, epithet, element, rarity, culture
aim (verb), personality (1–2 words)
archetype, stageFormsByEvo (from §4)
hook {type, zone, description}, ornaments[≤3], gelTwist, eyes, idle
signatureSkill {name, text}  (numbers: combat pass)
transcendentIdea (Mythic only)
```

---

## 7. How Raid: Shadow Legends does it (reference, verified where marked)

Checked 2026-09-28 by web search. Unverified points are marked **(unsure)**. The `docs/RSL_FIDELITY_ROADMAP.md` mentioned in the brief is also on the box at `/workspace/phaser-ship/slime-raid-phaser-ship/docs/`. It covers UI and battle presentation fidelity (nameplates, pedestals, summon FX) and has **no roster, faction, or duplicate guidance**, so nothing from it is used here.

| Topic | What RSL does | Source / confidence |
|---|---|---|
| Launch size | Soft launch June 2018; global launch Feb 28 2019 marketed as "over 300 collectible champions across 16 factions" with "entirely unique individual character models" | Plarium press release (Business Wire, 2019-03-01); MobyGames. Verified. |
| Growth | 457 champions by early 2020 (community forum count); about 1,020–1,034 by Sept 2026 | Reddit citing the Plarium forum (moderate); AyumiLove lists (verified as of their page) |
| Rarity pyramid today | Of about 1,020: Mythical 33, Legendary 374, Epic 294, Rare 228, Uncommon 72, Common 19 | AyumiLove "List of Champions by Rarity." Verified per that page. Note: RSL's widest tier is **Legendary**, not Epic, and Mythical is a thin cap. |
| Factions | 4 alliances: Telerians (Banner Lords, High Elves, Sacred Order, Barbarians), Gaellen Pact (Ogryn Tribes, Lizardmen, Skinwalkers, Orcs), The Corrupted (Demonspawn, Undead Hordes, Dark Elves, Knights Revenant), Nyresan Union (Dwarves, Shadowkin, Sylvan Watchers, Argonites). Faction sizes range from about 20 (Argonites) to about 92 (Sacred Order). | AyumiLove, games.gg. Alliances verified. The total is reported as 16 factions or as 14 depending on the source and how newer factions are counted **(unsure on the exact count)**. Dwarves were added about a year after launch (Reddit, moderate). |
| Roles | 4 roles: Attack, Defense, HP, Support | AyumiLove role list. Verified. |
| Affinities | 4 affinities: Magic, Force, Spirit, Void (Magic beats Spirit, Spirit beats Force, Force beats Magic; Void is neutral) | AyumiLove affinity list confirms the four. The beat cycle is common knowledge **(not re-verified in this pass)**. |
| Differences inside a faction | Rarity, role, affinity, skill kit, and a unique model and animation per champion | Press release (unique models and mocap at launch). Whether later champions share skeletons within body types: **(unsure)**. |
| Duplicates | (a) use as **skill "books"**: a duplicate of the same champion upgrades one of its skills; (b) **rank-up food**: fed to raise another champion's star rank; (c) **fusion**: time-limited events that fuse sets of specific champions (for example 4 Rares → 1 Epic, 4 Epics → 1 Legendary); (d) **Faction Guardians**: placing duplicates for faction-wide bonuses | Reddit, the Plarium forum, AyumiLove fusion guide, and a secondary wiki. (a)–(c) verified from multiple community sources; (d) is from a secondary source **(moderate)**. |
| Release cadence | New champions arrive continuously through events and fusions | **(unsure on the exact cadence)**; not verified here. |

**Reference options for our open duplicate decision (no recommendation locked):** skill-up from same-hero duplicates (RSL books); shard conversion (our current config placeholder); rank-up fodder (we already have fodder-based evolution in `fodderNeededForNextEvo`); fusion recipes (for example several named Epics of one culture → a Legendary); faction or culture guardian slots. Our own twist: **a duplicate could feed body control directly**, advancing the hero's mastery tells or unlocking a stage early. The founder decides (§13).

### What we copy from RSL, what we do differently
| Copy | Do differently |
|---|---|
| Hundreds of heroes over years, launching with a lean base | Launch at 48 named, not 300. Our pipeline, not a mocap studio, is the constraint. |
| Alliances of factions as the organizing layer, faction separate from combat type | Factions are **cultures with a body-control school** (§8), and element stays our combat axis (16 elements instead of 4 affinities) |
| 4 clear roles | Roles are linked (loosely, by reasoning) to archetype: construct → defense, rooted → sustain, and so on |
| Thin Mythic cap | We keep a pyramid with Epic widest, per the founder. RSL's widest tier is Legendary. |
| Several ways to use duplicates, including fusion events | Duplicates may feed **body control** itself (open) |
| Every champion reads as unique | Distinctness comes from **gel physics + archetype + hook + element material**, generated from rigs and kits, not a bespoke sculpt per hero |
| — | **Our twist:** progression is visible as control of the body. The player *sees* power as the precision, stability, and composition of the gel. |

---

## 8. Cultures and alliances (how 300+ heroes stay organized)

Proposal. Places are drawn from existing lore: `REGION_LORE` (Greenwild Forest, Crystal Mountains, Shadowfen Swamp, Volcanic Wastes, Celestial Peaks) and places named in the bios (Tidecall Coast, Stormmarch Ridges, Ironmere Foundries, Voidmarch Marches, Witch's Hollow, the spirit roads and grave-glades, Ember Peak). **Culture is a separate axis from element.** Each culture has 3–5 elements and a **shaping school**: a style of body control that biases its archetypes and ornament language.

| Alliance | Culture (home) | Main elements | Shaping school (bias) | Existing heroes that fit |
|---|---|---|---|---|
| **Haven League** (settled soft folk) | Greenwild Keepers (Greenwild Forest) | Plant, Earth, Water | Rooted, low quadrupeds; moss and wood | Waystone Hob, Mother Comb, Harvest-Saint Briar |
| | Ironmere Guild (Ironmere Foundries) | Metal, Fire, Lava | Constructs; tools as body parts | Shieldwright Brom, Smith-Echo Korr, Cinder-King Vorr |
| | Tidecall Ferrymen (Tidecall Coast) | Water, Storm, Wind | Vessels, waders, seabirds | Ferryman Pell, Maris, Captain Squall |
| | Dawn Choirs (Celestial Peaks) | Light, Spirit, Crystal | Avian, halos, bells | Hymn-Keeper Oriel, Dawn-Herald Solenne |
| **Wildgel Clans** (untamed) | Stormmarch Riders (Stormmarch Ridges) | Storm, Wind, Lightning | Avian and serpent; streaming forms | Kite-Runner Pip, Weathervane Odile |
| | Kilnborn (Volcanic Wastes, Ember Peak) | Lava, Fire, Earth | Heavy quadrupeds; crust armor | Dozing-Vent Murrow, Signal-Fire Brann, Glassroad Ember |
| | Frostlens Monastics (Crystal Mountains passes) | Ice, Crystal, Light | Constructs and still bipeds; panes and lenses | Archivist Rhee, Judge Stillwater, Geode-Scholar Tamsin |
| | Sparkwrights (thunder sanctums) | Lightning, Metal | Constructs with arcs; gadgets | Fuse-Wit Jax, Arc of the Broken Bell |
| **Hollow Courts** (night side) | Night Market (Shadowfen Swamp) | Shadow, Poison | Performer bipeds; slinking quadrupeds | Curtain-Call Mott, Quiet-Knife Nox |
| | Witch's Hollow (Shadowfen) | Poison, Plant | Vessels and swarms | Madam Gallwort, Apothecary Mire |
| | Grave-Glade Lanterns (spirit roads) | Spirit, Shadow | Wisps, processions, stags | Moth-Widow Ilse, Lantern-Walker Ashen |
| | Voidmarch Claimants (Voidmarch Marches) | Void, Crystal | Abstract and swarm; orbiting objects | The Lost-and-Found, The Negotiated Hole, Mirror-Saint Lira |
| **Old Gel** (primordial, mostly Mythic) | First Tide | Water, Wind, Plant | Elemental bodies (column, exhale, seed) | First Rain, Breath-Between-Ages, Seed-of-the-Eternal-Garden |
| | Starfallen | Fire, Light, Lightning | Celestial serpents and glyphs | Heart-of-the-Second-Sun, Candle-Against-the-Crack, Syntax-of-Storms |
| | Deep Fault | Earth, Lava, Metal, Ice | Colossi and constructs | World-Shelf, Hearth-of-the-Deep-Fault, Crown-That-Was-Tools, Clock-That-Chose-Winter |
| | Unwritten | Void, Shadow, Storm, Crystal, Poison, Spirit | Councils, treaties, abstractions | The Exception, Umbral-Treaty, Parliament-of-Clouds, Prism-of-Unwritten-Maps, Cure-That-Wore-Fangs, Choir-of-the-Unmelted |

That gives 16 cultures in 4 alliances, which matches RSL's structure at the alliance level. Culture sizes can differ, as RSL's factions do. Old Gel is small and Mythic-heavy by design. Culture opens the door to culture-themed content (a culture-war mode, culture guardians, culture fusion recipes) without committing to any of it here.

---

## 9. Rig plan: archetype rigs, not one humanoid rig

| Rig | Status | Used for | Notes |
|---|---|---|---|
| Blob | Exists (R1) | S1, S0 puddle state, faint | Squash rig |
| Morph | Locks in R2 | S2 pseudopod (nubs = shortened arms), S3 morph | Pseudopod = the morph rig with arms at low definition. **No new rig.** |
| Shaped (ascended) | Locks in R2 | S4 Epic evo 3+, Legendary evo 0–4 | Carries hooks |
| Biped (was humanoid) | Locks in R2 | 5 legends' signature forms; future bipeds | Renamed; one archetype among many |
| **Quadruped** | **New** | Nox, Ashen, Negotiated Hole, World-Shelf, Hearth, Crown | Parameter for 4–8 legs (Crown's tool legs) and body length |
| **Serpent** | **New** | Glassroad Ember, Heart-of-the-Second-Sun, Cure-That-Wore-Fangs, Choir | Spine chain with length and hood options; trails |
| **Avian** | **New** | Maris (wader), Solenne, Squall, Breath-Between-Ages | Wing chains plus a hover/stand switch; leg length parameter |
| **Construct** | **New** | Granny Bedrock, Arc, Korr, Clock, Candle, Prism | Rigid parts held by gel joints; a "vessel" mode (bell, candle, tower) |
| **Swarm** | **New** | The Unposted Letter, Mire, Lira, Syntax, Parliament | Leader core plus N instanced sub-bodies on a formation driver. Performance check needed. |
| Rooted | **Variant** of serpent chains | Briar (and future Plant/Earth heroes) | Anchored base plus branch chains |
| Abstract | **Shape-key set** on the blob lattice | The Exception | No new skeleton |

Each new rig gets the same 6 clips (idle, move, attack, cast, hit, faint), the v4 eye rig re-seated, and a **definition** parameter (melted to crisp) that drives the faint melt and hit softening. Heroes on a rig reuse its clips. The per-hero idle and the hook deform are the hand-authored layer.

**Future rigs (roadmap, only if the quotas demand them):** aquatic (fins, for more Water and Storm heroes), multi-head or multi-body (a Transcendent helper). Keep the library at **no more than about 12 rigs total**. More rigs means more animation sets to maintain.

---

## 10. Scale tiers and counts

### 10.1 Counts per tier
Species = generated lineage looks (C/U/R). Named = heroes with a bio, a signature skill, and a hero layer.

| | **T1 Launch (lean)** | **T2 Year one** | **T3 Roadmap (full)** |
|---|---|---|---|
| Elements | 16 | 16 | 16 (more elements possible; decision) |
| Species looks | 16 lineages × 3 = **48** | 16 × 4 = **64** | 16 × 6 = **96** |
| Named Rare | 0 | **32** (2 per element) | **80** (5 per element) |
| Named Epic | **16** (1 per element) | **48** (3) | **112** (7) |
| Named Legendary | **16** (1) | **32** (2) | **80** (5) |
| Named Mythic | **16** (1) | **16** (1) | **32** (2) |
| **Named total** | **48** | **128** | **304** |
| Shape | Flat (same count per rarity) | Pyramid: Epic widest | Pyramid: Epic widest, thin Mythic cap |

**Element split:** keep each element equal **per rarity** in every release, so summon odds per element stay fair and every element gets new heroes. Let **cultures** be uneven (Old Gel small, Haven League large). This is the same unevenness RSL's factions have, but on the culture axis, so combat balance by element is untouched.

### 10.2 How many duplicates this removes
Illustration only. Assumes every hero in a rarity is equally likely, ignores pity and banners, and counts duplicates of *specific* named heroes. The formula is standard: expected distinct = P × (1 − (1 − 1/P)^n), where P is the pool size.

| Rarity | Pulls at that rarity | T1 pool → expected duplicates | T2 pool → duplicates | T3 pool → duplicates |
|---|---|---|---|---|
| Epic | 20 | 16 → about **8.4** | 48 → about **3.5** | 112 → about **1.6** |
| Legendary | 10 | 16 → about **2.4** | 32 → about **1.3** | 80 → about **0.5** |
| Mythic | 3 | 16 → about 0.2 | 16 → about 0.2 | 32 → about 0.1 |
| Named Rare | 20 | — | 32 → about 5.0 | 80 → about 2.2 |

What this means: at launch, **about 4 in 10 of a player's first 20 Epic pulls are duplicates**, so the duplicate decision is urgent at T1. Year one cuts Epic duplicates by more than half; the roadmap cuts them by about 80%. Per element at T1, every Epic pull of one element is the same hero. At T2 there are 3 candidates, at T3 there are 7.

### 10.3 Content cadence (proposal)
- **One culture drop per release**, about every 6 weeks: **about 10 named heroes** (for example 3 Rare, 4 Epic, 2 Legendary, 1 Mythic in alternate drops), all from one or two cultures, plus 1 new species variant set when due.
- T1 → T2 = 80 new named heroes, which is **about 8 drops (about a year)**.
- T2 → T3 = 176 more, which is **about 17–18 drops (about two more years)**.
- A slower cadence (8 per release) stretches the roadmap; a faster one needs the §11 bottlenecks solved first.

---

## 11. Model math and production effort (estimate)

**All figures are relative estimates**, meant to compare options, not to schedule. Unit = the effort of one generated element × form pass including review, as in R3. The assumed weights are my estimate:

| Item | Est. units each | Why |
|---|---|---|
| New archetype rig (model + rig + 6 clips + eye seat + generator support) | 10 | The biggest fixed cost; paid once |
| Rig variant (rooted) | 4 | Reuses serpent chain tech |
| Abstract shape-key set | 3 | On the blob lattice |
| Element kit (material + motion + ornament set) | 3 | Already in R3 scope for all 16 |
| Species variant preset | 0.5 | Proportions plus 1–2 features |
| Generated species stage (review only) | 0.2 | Generator output |
| Named hero layer (hook deform, ornaments, gel twist, eye override, idle) | Rare 2 · Epic 3 · Legendary 4 · Mythic 5 | Hand polish grows with rarity |
| Extra stage per named hero | Rare 1 · Epic 1 · Legendary 2 · Mythic 2 | Legendary = archetype reveal; Mythic = transcendent |

### 11.1 Build counts
| | T1 Launch | T2 Year one | T3 Roadmap |
|---|---|---|---|
| Base rigs | 4 existing + **5 new** + 1 variant + 1 shape-key set | +1 (aquatic, if quotas need it) | +1 (multi-body) → about 11 total |
| Element kits | 16 | 16 | 16 (+ per new element) |
| Species variants | 48 | 64 | 96 |
| Species stage builds (blob, pseudopod, morph) | 144 | 192 | 288 |
| Named hero builds | 48 | 128 | 304 |
| Named stage builds (2 per hero) | 96 | 256 | 608 |
| **Total GLB stage builds** (each with LOD0/1/2) | **240** | **448** | **896** |

### 11.2 Relative effort
| | T1 Launch | T2 Year one (cumulative) | T3 Roadmap (cumulative) |
|---|---|---|---|
| Rigs | about 57 | about 67 | about 77 |
| Element kits (already planned in R3) | about 48 | about 48 | about 48 |
| Species | about 53 | about 71 | about 106 |
| Named layers + stages | about 272 | about 592 | about 1,392 |
| **Total** | **about 430 (index 1.0)** | **about 780 (about 1.8×)** | **about 1,620 (about 3.8×)** |
| Marginal cost per new named hero | about 5.7 (plus rig setup) | about 4.0 | about 4.5 (more Legendary and Mythic share) |

**Why it stays feasible:**
- **Fixed costs stop growing.** The rigs (about 57 at T1) are paid almost entirely at launch. T3 adds only about 20 more for 6× the named heroes.
- **The generator does the multiplying.** Element × archetype × stage × LOD is scripted, so 896 stage builds are exports, not sculpts.
- **In-stage evolution is free.** Mastery tells are parameters (§2.2), so there are 2 model stages per named hero, not 4–6.
- **The hero layer is the real work.** About 85% of the T3 total is named-hero layers. That's where the budget and people go, and it's the part that makes each hero worth pulling.

### 11.3 What stays manual, and the bottlenecks
| Automated | Manual | Bottleneck and mitigation |
|---|---|---|
| Kits, species variants, stage exports, LODs, budget checks (tris ≤10k, textures ≤1k), turntable renders, silhouette renders, lineup sheets, similarity flags | Concept and bio, hook design, hook deform polish, idle animation, eye override, final review against the gates | **Design throughput:** about 10 heroes per drop means about 10 hook designs. Mitigate with the hero-card formula (§6) and the culture sheets. |
| | Per-rig animation sets (once per rig) | **Rig quality:** a weak rig taxes every hero on it. Pilot each rig with one legend before batching. |
| | Signature skill design (combat pass) | **Combat design** can lag art. Keep `signature.stub` until tuned. |
| Silhouette similarity scoring | Judging flagged pairs | **Review load** grows with roster size. Only flagged pairs plus lineup sheets reach a human. |
| | | **Runtime:** swarm heroes (many instanced sub-bodies) and 900 GLBs need lazy loading per fight and a swarm instance budget. Measure in the rig wave that adds swarm. |
| | | **Asset licensing:** free-only rule. Ornaments must stay generator-made or CC0 as the count grows; log everything in CREDITS. |

---

## 12. Recommendation and phased build order

**Recommendation: launch with T1 (48 named + 48 species looks).** It is already designed and data-wired (`heroRoster.js`, commit `b948c32`), and it proves the body-control ladder and the archetype idea without adding heroes before launch. Commit to **T2 (128) as the year-one plan** and treat **T3 (about 304) as the roadmap**, released as culture drops. Solve duplicates before launch, because the T1 Epic duplicate rate is high (§10.2).

**Phases (after Cody's current Epic batch, the Epic champions on the morph body, R5b in `HERO_ROSTER.md`):**
| Phase | Scope | Why here | Review |
|---|---|---|---|
| **P0 (now)** | Cody finishes the Epic batch on morph as briefed. No change. | Don't disrupt work in flight; Epics don't depend on archetypes. | Existing sit |
| **P1 Data + stage names** | Add `archetype` to `heroRoster.js` (the §5 table); `resolveFormTier` gains `pseudopod`, `signature`, `transcendent`; reword the `RARITY_LORE` bios away from "near-humanoid." Small. | Unblocks every later phase | Tests plus one read |
| **P2 Physics tells + pseudopod** | Definition parameter, edge firmness, core glow, eye seating, faint melt, hit softening (§2); species pseudopod stage via the generator | Every existing hero gets visible in-stage evolution; cheap and high-impact | One sit: evo 0 → max strip per rarity |
| **P3 Rig wave 1** | Quadruped, Construct, Serpent, each piloted on one legend (suggested: Nox, Korr, Glassroad Ember), then batch the 16 legends on these rigs | Covers half the legends; three very different body logics | One sit per pilot, then a lineup |
| **P4 Rig wave 2** | Avian, Swarm (plus performance check), Rooted variant, Abstract; the remaining 11 legends, plus the 5 bipeds on the biped rig | Completes all 32 signature forms | Lineup of all 32 |
| **P5 Legendary reveal** | The evo 5 swap from the shaped body to the signature form, with a transition moment | Needs P3–P4 | One sit |
| **P6 Transcendent** | The 16 Mythic S6 forms (§5.2) | Highest polish, lowest pull volume | One sit |
| **P7 Year one** | Culture drops toward T2, starting with named Rares on the pseudopod and morph bodies | Pipeline proven | Per drop |

Until a form passes its gates, the painted plate stays as the fallback (HERO_DESIGN §1). So launch doesn't need all 32 signature forms in 3D if the founder accepts plates for Mythics and for Legendary evo 5 at first. See the decisions below.

---

## 13. Open decisions for the founder

1. **Duplicates** (urgent at T1): skill-up, shards, rank-up fodder, fusion, culture guardians, or **duplicates feed body control**. No recommendation locked (§7).
2. **Launch 3D scope:** must all 16 Mythic signature forms and the 16 Legendary evo 5 forms be 3D at launch, or can painted plates cover them while P3–P5 land?
3. **The 32 archetype picks** in §5: approve, or swap any (the humanoid cap stays ≤3 per 16).
4. **Named Rares** (year one): no stage skip (recommended) vs starting one stage higher than species Rares.
5. **Rare start:** replace the 1-in-3 random morph with pseudopod for all (recommended), or keep the random gifted Rare.
6. **Special tier:** allow Legendary to reach Transcendent through fusion or an event, or keep Transcendent Mythic-only.
7. **Pyramid shape:** Epic widest (the founder's lean, used here) vs RSL-style Legendary widest.
8. **Cultures:** approve the 4 alliances × 16 cultures in §8, or rename and reshape them.
9. **More elements:** stay at 16 for the roadmap, or add elements (each adds a kit, not a rig).
10. **Cadence:** about 10 heroes every about 6 weeks, or another rhythm.
