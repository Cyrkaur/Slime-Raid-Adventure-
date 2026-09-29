# Raid of the Gel: Hero Roster

Companion to `HERO_DESIGN.md`. This expands the founder's roster thesis into buildable designs: Common to Rare = **species** (one lineage look per element, 3 body variants). Epic and up = **named champions** with their own look and signature skill. Last updated 2026-09-28.

Sources: `Slime Adventure/js/data/lore.js` (`ELEMENT_LORE`, `RARITY_LORE`, `LEGENDARY_LEGENDS`, `MYTHIC_LEGENDS`, `REGION_LORE`, `BOSS_LORE`), `Slime Adventure/WORLD_AND_CHAMPIONS.md`, `Slime-Raid-Phaser/src/data/gameData.js` (`resolveFormTier`, `RARITY_LORE`), `HERO_DESIGN.md` §4 (gel properties), §5 (eyes), §8 (roster plan). Legendary and Mythic names, epithets, and bios are existing canon. The 16 Epic champions are new in this doc.

Terms: **silhouette hook** = the one shape that makes the hero readable as a black silhouette at fight size. Every hero keeps its element's gel material (HERO_DESIGN §4) and follows the eye rules (§5). No stats in this doc.

---

## 1. Roster structure

| Tier | Rarity | Count | Identity | 3D body | Built by |
|---|---|---|---|---|---|
| Species | Common, Uncommon, Rare | 16 lineages × 3 variants = 48 looks | Lineage (Tideborn, Emberheart, ...), generated names | Blob (Common/Uncommon), Morph (some Rare, evo 2+) | Kit system: element kit + variant preset |
| Epic champions | Epic | 16 (1 per element), **new** | Named, own bio and signature skill | **Morph** (Ascended at evo 3+, see §7) | Element kit + hero ornament set + hook deform + eye override, hand polish |
| Legendary legends | Legendary | 16 (1 per element), existing | Named legends of the Second/Third Age | **Ascended** (Humanoid at evo 5+, see §7) | Same, heavier hand authoring |
| Mythic legends | Mythic | 16 (1 per element), existing | Once-per-era, Shape-Bound | **Humanoid** (Shape-Bound) | Bespoke on the humanoid base, kit material |

Totals: 16 species lineages with 48 variants, plus **48 named heroes** (16 Epic, 16 Legendary, 16 Mythic).

---

## 2. Species (16 lineages × 3 variants)

Variants share the lineage's material and motion. They differ in body proportion and one or two element features, so a party of three Tideborn still reads as three slimes.

| Element (lineage) | a | b | c |
|---|---|---|---|
| Water (Tideborn) | Classic teardrop, a curl of wave on top that sloshes when it hops | Wide puddle-low body with a floating lily-pad cap and one trapped air bubble | Tall narrow droplet with a rain-streak surface and a tiny fish shadow swimming inside |
| Fire (Emberheart) | Round body with a three-lick flame tuft and a visible coal core | Squat body, flame crest swept back like a mohawk, ember sparks shed on landing | Pear-shaped, flame burns low around the base like a skirt, coal core pulses bright |
| Earth (Stonegut) | Dense dome with pebbles suspended in bands and a flat slate chip on top | Lumpy boulder shape with a moss patch and a sprouting grass tuft | Wide-bottomed, clay-cloudy gel with a flat slab of stone half-sunk into one side like a shield |
| Wind (Zephyrkin) | Near-clear teardrop tilted forward, white streaks swirling inside | Small hovering puff with two feather-shaped gel flicks at the sides | Spiral-twisted body like a soft-serve curl, the tip always trailing in a breeze |
| Plant (Bloomcore) | Round green body with a single sprout and two leaves on top | Mossy low mound with three tiny flowers and leaves suspended inside | Bulb shape like a flower bud, petals folded at the crown that open on cast |
| Lightning (Sparkcoil) | Pale yellow drop with a zigzag antenna and inner arcs | Round body with two static-charged hair spikes that stand up and twitch | Coiled body like a spring, arcs jumping between the coils |
| Ice (Frostlens) | Semi-frozen dome with a frost rim and one icicle point on top | Faceted-edged cube-ish body, softened corners, snowflake frozen in the core | Low wide body with an ice crust "shell" cracked on the back, cloudy core |
| Shadow (Umbrawisp) | Dark teardrop with smoky edges that trail on movement | Low slinking body with two pointed ear-wisps of smoke | Hooded-drop shape where the top folds over the eyes like a cowl |
| Light (Luminjelly) | Bright round body with a glowing core and iridescent film | Floating drop with a small ring of light hovering above | Star-shaped soft body (five rounded points), core glowing from center |
| Metal (Chromeblob) | Mercury dome with a mirror finish and a rivet-bead on top | Heavy low body with a gear-tooth ridge along the back | Bell-shaped body that rings when it lands, flat polished base |
| Poison (Venomgloop) | Murky dome with rising bubbles and a drip at the base | Lopsided body with a mushroom cap of gel and spore motes | Tall bubbling blob with a sickly glow and a pop-bubble on top every few beats |
| Crystal (Prismheart) | Clear body with one large facet crystal inside refracting color | Clear body with a crystal cluster growing out of the top | Round body with a ring of small crystals suspended like a belt |
| Lava (Magmacore) | Glowing core with dark crust patches, sagging viscously | Crust-heavy dome with glowing cracks and one smoke vent on top | Low spread body with a molten drip lip, cooled glass pebbles at the base |
| Storm (Tempestorb) | Dark blue-grey orb with a swirling cloud inside | Orb with a tiny lightning cloud floating above like a hat | Squashed body with a rain-streak skirt that drips upward then falls |
| Spirit (Wispling) | Ghostly drop fading to transparent at the edges, slow bob | Taller wisp with a flame-like trailing tail instead of a base | Round body with two faint arm-wisps and a soft inner glow |
| Void (Riftgel) | Near-black drop with a starfield inside | Irregular body whose outline slowly shifts between rounded shapes | Drop with a small dark ring orbiting it and a starfield swirl |

Eyes follow HERO_DESIGN §5 per element (Crystal facets, Poison clusters, Spirit and Void single eye or slits). Blob = big round baby eyes. Morph variant of a species = the same variant plus two gel arms and a gel brow.

---

## 3. NEW Epic champions (Morph body)

Morph base: blob body plus two semi-shaped gel tentacle arms, defined eye shape, gel brow (HERO_DESIGN §2, Phaser `RARITY_LORE.Epic`). Each Epic keeps that base and adds one hook deform plus an ornament set.

### Water: Ferryman Pell
*"Who rowed the flood backward"*
**Bio:** In the Second Age, when a Void Crack split the Tidecall Coast and the sea rushed inland, Pell turned itself into a boat and ferried a whole hamlet over the flood, one trip at a time. It never charged a fare, only a story. Tideborn children still leave shells at river crossings "for Pell's toll."
**Role:** Support / Control.
**Signature skill:** *Last Crossing*: lifts one ally out of harm into a bubble that absorbs the next hit, and pulls the target's turn back.
**Visual (Morph):**
- **Hook:** lower body flares into a shallow flat-bottomed canoe hull, and the right arm ends in a broad oar blade.
- **Ornaments:** kelp-rope sash tied across the front; a tiny shell charm hanging from the rope.
- **Gel twist:** a visible waterline inside: lower half crystal clear, upper half full of small suspended bubbles.
- **Eyes:** round, magnified through the clear gel; gel brow shaped like a curling wave crest.
- **Idle:** slow rowing stroke with the oar arm, body rocking fore and aft on the stroke.

### Fire: Signal-Fire Brann
*"The hilltop that shouted"*
**Bio:** In the Age of Cracks, a hard-realm raid cut the signal chain along the Volcanic Wastes border. Brann climbed the dead signal hill and burned all night, loud and bright enough that every hamlet saw and fled in time. He has been proud and slightly hoarse ever since.
**Role:** Nuker / Burst.
**Signature skill:** *Beacon Roar*: a burst blast on one foe that also raises allies' turn meters.
**Visual (Morph):**
- **Hook:** sits inside an iron brazier-bowl collar ringing the upper body, with a tall narrow torch-cone flame rising from the top.
- **Ornaments:** soot-black iron bowl with four short legs welded on as decoration; a knotted signal rag tied to one arm.
- **Gel twist:** the flame cone is gel too: orange translucent at the base, brightening to pale yellow at the tip, with a bright flicker core.
- **Eyes:** ember glow, a thick gel brow shaped like two flame licks.
- **Idle:** "shouts" every few seconds: the torch cone flares taller, sparks puff, arms thrown wide.

### Earth: Waystone Hob
*"Who stood where the road forgot"*
**Bio:** In Greenwild, the old trails were drawn when the First Age tides still ran, and the hard-realm maps lost them. Hob stacked stones on its own head at every fork so lost Keepers could find the Primordial hum again. Some cairns in the forest are Hob's naps.
**Role:** Tank / Sustain.
**Signature skill:** *Cairn Guard*: taunts, then leaves a stone marker that shields the ally behind it.
**Visual (Morph):**
- **Hook:** a balanced cairn of three flat stones stacked on top of the head, each slightly off-center.
- **Ornaments:** moss on the stones; the arms end in flat stone mitts.
- **Gel twist:** pebbles suspended in clear horizontal strata bands, like a road cut.
- **Eyes:** small, deep-set, under a heavy gel brow studded with pebbles.
- **Idle:** keeps rebalancing the cairn: tiny wobble, then a steadying pat with one mitt.

### Wind: Kite-Runner Pip
*"Tied to nothing, late for everything"*
**Bio:** When hard-realm observation kites hung over the Stormmarch Ridges spying on Havens, Pip cut the tethers one by one and rode the kites down as sleds. Pip kept one tail ribbon as a trophy and never learned to stop.
**Role:** Speed / Debuff.
**Signature skill:** *Cut the Line*: fast hit that removes a buff and lowers the foe's speed.
**Visual (Morph):**
- **Hook:** a diamond kite-sail fin on the back plus a long streaming gel tail with bow-knots trailing behind.
- **Ornaments:** a frayed rope tether tied loosely at the waist, cut end dangling.
- **Gel twist:** very clear gel with white swirl streaks that flow toward the tail.
- **Eyes:** squinting grin eyes, gel brow swept back by wind.
- **Idle:** hovers a hand's width off the ground and bobs; the tail flutters in a slow figure-8.

### Plant: Mother Comb
*"Who kept the bees through the dry scar"*
**Bio:** When a Greenwild Haven fell and became a dry scar, Mother Comb carried the last hive inside her gel across the ash. She grew a meadow wherever she rested. Bloomcores still hum when they meet her.
**Role:** Heal / Grow.
**Signature skill:** *Honey Hour*: heals the party over time and wakes a stunned ally.
**Visual (Morph):**
- **Hook:** body shaped like a straw bee skep: domed, with stacked horizontal ridge rings.
- **Ornaments:** clover-flower crown; small glowing pollen motes orbiting like bees.
- **Gel twist:** an amber honey core inside green gel, with hexagonal comb cells suspended in it.
- **Eyes:** soft round eyes, leaf-shaped gel brow.
- **Idle:** gentle humming sway; motes circle and dip into her body one at a time.

### Lightning: Fuse-Wit Jax
*"Genius on a short fuse"*
**Bio:** At a thunder sanctum, a hard-realm living theorem of lightning boxed in a Haven's metal spires. Jax rewired the spires on a dare in the middle of the storm, and the theorem struck itself. Jax has been banned from three workshops and invited back to all of them.
**Role:** Chain DPS.
**Signature skill:** *Rewire*: chain bolt that jumps between foes and hits harder on each foe with a debuff.
**Visual (Morph):**
- **Hook:** one tall coiled copper antenna spiral rising from the head, ending in a glowing ball.
- **Ornaments:** brass ring goggles pushed up on the gel brow; a coil of wire looped over one arm.
- **Gel twist:** pale yellow gel with arcs jumping between two floating copper beads inside.
- **Eyes:** one visibly bigger than the other (mad-genius look), bright highlights.
- **Idle:** jittery foot-tap bounce; the antenna ball sparks on every fourth beat.

### Ice: Archivist Rhee
*"Librarian of stopped moments"*
**Bio:** Rhee keeps the Frostlens monks' silent library in the Crystal Mountains, where each book is a moment frozen before it could go wrong. In the Age of Cracks, Rhee started lending those moments to Keepers in battle. Late returns are not forgiven.
**Role:** CC / Slow.
**Signature skill:** *Overdue*: freezes one foe and delays its next turn.
**Visual (Morph):**
- **Hook:** an oversized round ice lens held up in one arm like a magnifying glass, plus a tall pack of stacked ice slabs (frozen books) on the back.
- **Ornaments:** frost-rimed spines on the slabs; a small bookmark ribbon of frozen gel.
- **Gel twist:** semi-frozen shell with a frost rim; a cloudy core with a snowflake visible inside.
- **Eyes:** frost-rimmed; the eye behind the lens is magnified huge. Straight, stern gel brow.
- **Idle:** raises the lens, peers, lowers it, with a stiff wobble each time.

### Shadow: Curtain-Call Mott
*"The bow before the blackout"*
**Bio:** Mott played the night markets of Shadowfen. When the Shadow Lich's patrol came through, Mott took one last bow, snuffed every lantern at once, and walked the children out in the dark. The audience still claps when the lights go out.
**Role:** Assassin / Hex.
**Signature skill:** *Blackout*: stealth for a turn, then a strike that silences the foe's skills.
**Visual (Morph):**
- **Hook:** a drooping two-tailed stage hood of smoke gel with a bead at each tip.
- **Ornaments:** a pale half-mask (comedy face) floating on the gel surface; a smoky short cape flaring from the back.
- **Gel twist:** dark low-transmission gel whose edges smoke off into trailing wisps.
- **Eyes:** slit pupils, seen through the mask holes; arched theatrical gel brow.
- **Idle:** slow, grand bow with one arm sweeping; cape smoke rolls on the ground.

### Light: Hymn-Keeper Oriel
*"Sings the verse that does not dim"*
**Bio:** Oriel kept the altar in a Celestial Peaks temple. When a hard-realm envoy lied in the middle of a hymn, Oriel dimmed in front of the whole choir and the lie was out. Now Oriel sings in battle, and false buffs fall away.
**Role:** Cleanse / Smite.
**Signature skill:** *True Verse*: cleanses allies and removes one buff from each foe.
**Visual (Morph):**
- **Hook:** a floating ring of small bell-shaped gel droplets hovering above the head.
- **Ornaments:** a pleated gel choir ruff around the "neck" line; a tiny hymn-sheet scroll in one arm.
- **Gel twist:** bright glowing core with an iridescent film; the bell-drops share the core glow.
- **Eyes:** white-gold, open mouth in a sung "O"; soft rounded gel brow.
- **Idle:** floaty sway in time; the bell-drops chime one after another around the ring.

### Metal: Shieldwright Brom
*"The wall that polishes itself"*
**Bio:** Brom was the doorstop of the Ironmere Foundries until a hard-realm raid came through the gate. It rolled into the doorway and stayed there, reflecting every bolt back out. The foundry workers made it a shield and it has never stopped polishing it.
**Role:** Reflect / Armor.
**Signature skill:** *Polished Wall*: shields allies and reflects part of the next hit back.
**Visual (Morph):**
- **Hook:** the left arm flattens into a round mirror buckler wider than the body.
- **Ornaments:** a riveted visor band across the top of the head; a polishing rag tucked into a rivet.
- **Gel twist:** mercury-like mirror gel; the buckler is the most reflective surface.
- **Eyes:** polished bead eyes peeking under the visor band; flat blunt gel brow.
- **Idle:** buffs the buckler in small circles with the other arm, then a slow heavy settle.

### Poison: Madam Gallwort
*"Hostess of the last-course cordial"*
**Bio:** Madam Gallwort runs a teahouse in Witch's Hollow, where Shadowfen secrets are traded for venom. When a hard-realm quartermaster tried to buy the Hollow, she served him tea. He left feeling fine. He is not fine.
**Role:** DoT / Weaken.
**Signature skill:** *Second Cup*: poison that gets stronger each turn the foe keeps it.
**Visual (Morph):**
- **Hook:** squat teapot body with a lid cap and knob on top, and the right arm curved into a pouring spout.
- **Ornaments:** a green-stained lace doily collar; herb sachets hanging from the lid rim.
- **Gel twist:** murky green gel with bubbles rising and popping at the lid.
- **Eyes:** a cluster of five small eyes arranged like tea leaves; a tiny arched gel brow over the cluster.
- **Idle:** tips forward and pours one drip from the spout; the body gurgles.

### Crystal: Geode-Scholar Tamsin
*"Who cracked herself open to read the mountain"*
**Bio:** In the mirror-caves of the Crystal Mountains, Tamsin split her own crust to show Keepers the prism-memory inside, the map of where the Gel froze mid-song. She keeps the crack open now. Mountain children play catch with her and lose.
**Role:** Hybrid mage.
**Signature skill:** *Split Reading*: hits one foe with an element matched to its weakness.
**Visual (Morph):**
- **Hook:** a rough dark rock crust shell covering the back half, split open at the front to reveal an amethyst crystal cluster.
- **Ornaments:** a tiny chalk-white scholar's tassel hanging from the crust edge.
- **Gel twist:** clear gel inside the crust with faceted crystals; the crust is matte rock, the gel stays wet.
- **Eyes:** facets inside the crystal cluster (per the Crystal rule), with a crust-edge brow.
- **Idle:** the crust halves close slightly and reopen like breathing; faint chime on each open.

### Lava: Dozing-Vent Murrow
*"Who napped through three eruptions and woke up for the fourth"*
**Bio:** Murrow slept at the foot of Ember Peak for most of the Second Age. When hard-realm drakes nested on the Volcanic Wastes road, Murrow finally woke, yawned, and the road was clear. Keepers let it sleep between fights.
**Role:** Heavy AoE.
**Signature skill:** *Rude Awakening*: AoE eruption that hits harder the longer Murrow has waited.
**Visual (Morph):**
- **Hook:** a huge hunched basalt crust hump on the back, like a sleeping turtle shell, with glowing cracks.
- **Ornaments:** a floppy nightcap of cooled pumice with a drip tassel.
- **Gel twist:** thick glowing core, dark crust patches; molten drips sag from the hump edge.
- **Eyes:** half-lidded sleepy ember-glow eyes, droopy gel brow.
- **Idle:** slow snore: the hump cracks glow brighter on each inhale and dim on exhale.

### Storm: Weathervane Odile
*"Who turned when the sky lied"*
**Bio:** Odile was the vane on a Stormmarch Ridges watchtower. When the Storm Sovereign's front bore down, the sky pointed one way and Odile turned the other, and the hamlets followed her to the calm side. She has been dramatic about it ever since.
**Role:** Weather control.
**Signature skill:** *Turn the Wind*: swaps the turn order of one ally and one foe.
**Visual (Morph):**
- **Hook:** a tall arrow weathervane spike rising from the head that spins.
- **Ornaments:** small cloud-puff epaulettes on both shoulders; a compass-letter band (N, E, S, W) around the spike base.
- **Gel twist:** dark blue-grey gel with a swirling cloud turning in the same direction as the vane.
- **Eyes:** brooding, heavy dramatic gel brow.
- **Idle:** the vane spins, stops, reverses; the body sulks with a turbulent shiver.

### Spirit: Moth-Widow Ilse
*"Who carries the names so nobody has to"*
**Bio:** Ilse walks the grave-glades of the spirit roads, collecting the names of champions who melted in the Age of Cracks. She pins each name to her wings so no Keeper has to carry it alone. Wisplings follow her like moths to a lamp.
**Role:** Revive / Utility.
**Signature skill:** *Pinned Name*: revives a fallen ally with part of its health.
**Visual (Morph):**
- **Hook:** two broad drooping moth-wing lobes of translucent gel from the back.
- **Ornaments:** small paper-slip name tags pinned along the wing edges; pressed-flower pins.
- **Gel twist:** ghostly gel with soft glow that fades to transparent at wing edges.
- **Eyes:** glowing slits (Spirit exception); soft sad gel brow.
- **Idle:** slow hovering bob; the wings fold and unfold once per bob.

### Void: The Lost-and-Found
*"Everything it swallows, it returns (eventually)"*
**Bio:** In the Voidmarch Marches, things fall into cracks: keys, spoons, whole afternoons. One Riftgel started giving them back, a little late and slightly wrong. Havens near the Marches now keep a shelf for what it returns.
**Role:** Anti-everything.
**Signature skill:** *Returned Wrong*: steals one buff from a foe and later gives it to an ally.
**Visual (Morph):**
- **Hook:** a tall question-mark shaped stalk curling up from the head, with lost objects (key, spoon, button) orbiting the body.
- **Ornaments:** a paper claim-ticket stuck to the side; the orbiting objects are simple low-poly props.
- **Gel twist:** near-black gel with a starfield inside; the objects drift in and out of the starfield.
- **Eyes:** one big eye (Void exception) with a curious gel brow.
- **Idle:** slow pulse; spits out one object, looks at it, reabsorbs it.

---

## 4. Legendary legends (Ascended body)

Ascended base: shaped torso, arms, element armor or crown pieces. Eyes: glowing irises, runes around the eyes, optional third eye or crown (HERO_DESIGN §5). Names, epithets, and bios are canon from `LEGENDARY_LEGENDS`.

| Element | Legend | Epithet | Hook (silhouette) | Ornaments and gel twist | Eyes | Idle | Signature skill |
|---|---|---|---|---|---|---|---|
| Water | Maris of the Last Rain | Who taught a desert to weep | Wide-brimmed rain hat of gel with a constant drip curtain falling from the brim | Necklace of coin-shaped raindrops (she counts them); clear gel with a band of desert sand settling at the base | Magnified, blue glowing irises, a ring of ripple runes | Catches drops in her palm and counts them; a pool forms under her and never dries | *Forty Nights*: leaves healing pools under allies that cleanse on their turn |
| Fire | Cinder-King Vorr | The forge that chose a side | Bellows-plate shoulders and an open furnace chest showing a coal-heart | Broken chain links melting off both wrists; flame tufts at the bellows vents | Ember irises, hammer-mark runes | Coal-heart pulses; he opens a fist and a chain link melts off and drips away | *Chainbreaker*: burst hit that breaks the foe's shields and armor |
| Earth | Granny Bedrock | Who sat until the war ended | Lower body is a squat boulder rocking chair | Moss shawl over the shoulders; stalagmite knitting needles; mica spectacles | Small kind glowing irises behind the mica lenses | Knits, rocks slowly; one pebble falls off per rock | *Polite Detour*: taunts all foes and redirects hits aimed at allies to herself |
| Wind | The Unposted Letter | News that arrives before the event | Envelope body: a triangular flap forms a hood, with a wax seal on the chest | Loose page-shaped gel wings trailing; very clear gel with ink streaks | Glowing eyes through the envelope window, wind-script runes | The flap lifts in the breeze; pages flutter around and settle | *Arrives Early*: acts first and lowers a foe's defense before it moves |
| Plant | Harvest-Saint Briar | Mercy with thorns | Tall bramble arch crown arching behind the head like a garden gate | Right arm an orchard branch heavy with fruit, left arm a thorn vine; skirt of leaves | Green-gold irises, seed runes | Blossoms open on the arch, ripen to berries, drop | *Two Orchards*: heals allies and gives them a thorn counter |
| Lightning | Arc of the Broken Bell | Who rang the sky | A cracked bronze bell canopy floats over head and shoulders; the body hangs under it like the clapper | Scorch-mark calendar ticks on the bell rim; arcs crawl along the crack | Bright irises, lightning-glyph runes | Swings like a clapper and sparks when it nearly touches the bell | *Toll of the Tower*: chain bolt that bounces across every foe |
| Ice | Judge Stillwater | The pause that saved a city | Cascading icicle barrister wig framing both sides of the face | Ice gavel; a frozen bridge-plank breastplate | Frost-rimmed irises behind square frost spectacles | Raises the gavel and holds it (frozen), then taps it down gently | *Order in the Court*: freezes a foe mid-cast and delays its turn |
| Shadow | Quiet-Knife Nox | The apology written in umbra | A long smoky scarf wrapping the lower face and trailing far behind | Right forearm forms a curved umbra blade; a lock-pick ring at the hip; a paper note between two fingers | Violet slit pupils, one winking; umbra runes | Flips the note card between fingers; the scarf smokes | *Hire Better Locks*: ignores defense and strips a buff, leaving a "note" mark |
| Light | Dawn-Herald Solenne | Who refused a false sunrise | A fan of sunrise rays spread behind the shoulders | A light-gel clarion held up; iridescent gel robe folds | White-gold irises, sunrise runes, a third eye on the brow | Lifts the clarion; the ray fan pulses like a slow sunrise | *True Dawn*: cleanses allies, strips illusions and buffs, smites |
| Metal | Smith-Echo Korr | The anvil that walked home | Anvil-shaped torso: broad flat shoulders with a horn jutting forward | A bundle of unfinished sword blanks strapped to the back; mercury drips | Polished bead eyes with gold irises, rune stamps | Hammers a blank on its own shoulder; ringing tone | *Finish the Work*: gives allies armor and reflects part of the damage they take |
| Poison | Apothecary Mire | Dose carefully, win completely | A tall tower of corked vials stacked on the head like a hat | Vial bandolier; murky bubbling gel, each vial a different sickly tint | Several small glowing eyes, some behind tiny spectacles | Uncorks a vial, sniffs, grimaces, re-corks | *Tasted Every Toxin*: stacking poison that bursts after a delay |
| Crystal | Mirror-Saint Lira | Who showed the Void its own face | A wheel of broken mirror shards floating behind the head | Clear gel with facet crystals; a shard pendant at the chest | Facet eyes with a rune ring cut into the facets | The shard wheel rotates and catches light in flashes | *Show It Its Face*: reflects the foe's next skill back at it |
| Lava | Glassroad Ember | Who paved a retreat in fireglass | A long glass train spreading behind her on the ground like a road | Dark crust pauldrons; glowing core; the train cools from orange to black toward the tail | Ember irises, glass-crack runes | The train crackles and cools, then glows again from the waist | *Retreat Paved*: AoE burn that also speeds up allies |
| Storm | Captain Squall | Fleet without ships | Storm-cloud tricorn hat and a billowing cloud greatcoat | Lightning trim on the hat brim; swirling cloud gel inside the coat | Dramatic glowing irises, compass runes | Hand to brow, scanning the horizon; coat billows | *Knows the Reefs*: raises allies' turn meters and lowers foes' |
| Spirit | Lantern-Walker Ashen | Guide of the unmelted | A tall shepherd's crook staff with a hanging lantern | Faint gel faces inside the lantern glass; hooded robe fading at the hem | Glowing slits, soft rune ring | The lantern swings; faint wisps follow its light | *Walk Them Home*: revives a fallen ally |
| Void | The Negotiated Hole | Unmaking on a leash of trust | A clean circular hole through the chest, edged with a gold contract-seal ring | A leash of script links hanging from the ring; starfield gel | One big eye above the hole with a seal rune ring | The hole slowly dilates and contracts; a blank scroll unrolls from it | *Terms and Conditions*: erases a foe's buffs and passive for a while |

---

## 5. Mythic legends (Humanoid Shape-Bound body)

Humanoid base: near-humanoid gel figure with face, hands, drips (HERO_DESIGN §2). **Gel read rules for every Mythic:** hair, cloth, and armor are all shaped gel (no hard cloth or hair cards); visible drips at hands and hem; the element's transmission and interior matter show through the torso; the feet melt into a small contact puddle. Names, epithets, and bios are canon from `MYTHIC_LEGENDS`.

| Element | Legend | Epithet | Hook (silhouette) | Ornaments and gel twist | Eyes | Idle | Signature skill |
|---|---|---|---|---|---|---|---|
| Water | The First Rain That Had a Name | Primordial droplet, Shape-Bound hope | Below the waist she is a continuous column of falling rain pouring into a puddle | Hair of falling rain strands; the clearest gel in the roster, magnifying what is behind her | Magnified glowing irises, a droplet third eye on the brow | Rain strands fall and rise back up in a loop; ripples spread from the puddle | *Watershed*: large party heal and a slow on all foes |
| Fire | Heart-of-the-Second-Sun | A star that chose the ground | A streaming meteor-tail mane flowing back from the head | A ring of black "vacuum" gel around a white-hot star core in the chest; broad forge-like build | Ember irises, star runes, a small star as a crown point | The mane streams back even when still; the core flares on each breath | *Burn the Cold*: AoE inferno that also warms allies (cleanses freeze and slow) |
| Earth | World-Shelf | The continent that sat up | Massive shoulders carrying a flat plateau landscape with tiny trees and a road | Pebble strata in the torso; moss and grass on the plateau | Deep amber irises under a rock-ledge brow | Slow breath; pebbles trickle off the plateau edge; tiny gel birds circle it | *The Map Moves*: shields the party and pushes back foes' turn meters |
| Wind | Breath-Between-Ages | The silence after a door closes | A floating arched doorway frame of wind streaks behind her, standing ajar | Tall slender figure; robe tails stream sideways; the lower body thins into a long exhale ribbon | Closed calm eyes that open glowing on attack, wind runes | A slow exhale: gel streaks drift from her mouth; the door swings a little | *Door Left Open*: removes all foe buffs and speeds up the party |
| Plant | Seed-of-the-Eternal-Garden | Spring that cannot be scheduled | A split seed-husk worn as a hooded cloak, two halves framing the figure | A sprout with two leaves growing from the crown; root tendrils for feet; leaves and seeds suspended in the gel | Green glowing irises, leaf runes | Flowers pop up where she steps and close behind her | *Inconvenient Flowers*: party heal over time and roots foes |
| Lightning | Syntax-of-Storms | Language of the sky | A ring of glowing lightning glyphs orbiting the body, forming words | Lanky figure; hair stands up as arcs; conductor's hands | Bright irises, glyph runes, a crackle third eye | Writes in the air; glyphs flash and join the ring | *Complete Sentence*: chain bolts that rewrite turn order |
| Ice | Clock-That-Chose-Winter | Time, politely refused | A frosted clock dial halo behind the head, hands stopped | An icicle pendulum hanging from the belt; semi-frozen gel with a cloudy core | One eye frost-rimmed, the other with tiny clock hands | The second hand ticks forward and back, never advancing | *Stopped Second*: freezes a boss's ultimate mid-cast |
| Shadow | Umbral-Treaty | Night that signed its name | A tall robed figure with a high stiff collar; the robe splits vertically into lantern-lit and deep-dark halves | A quill-blade and a sealed scroll; a wax seal on the chest; smoky gel edges | Violet slit pupils, treaty runes | Signs the air with the quill-blade; ink drips as shadow | *Between Lantern and Dark*: execute-style strike on a weakened foe |
| Light | Candle-Against-the-Crack | Small flame, large refusal | Slighter figure crowned by one tall candle flame on a wick | Light gel dripping down the shoulders like wax; warm glowing core | White-gold irises, a third eye as the wick's glow | The flame gutters as if in wind and relights, brighter | *Nine Days*: grants allies a shield that blocks one death |
| Metal | Crown-That-Was-Tools | Labor crowned itself | A tall crown built from fused hammer heads, tongs, and wrenches | A mercury mantle; fingers ending in small tool shapes | Gold irises, rivet runes | Crown pieces rotate and click like gears | *Spiteful Excellence*: reflects damage for the whole party |
| Poison | Cure-That-Wore-Fangs | Medicine with a sense of humor | A cobra-hood collar rising behind the head with two long fang drips | A medicine spoon in one hand; murky gel with bubbles and a two-tone (cure green, venom purple) swirl | Several small eyes set in the hood | Offers the spoon; the fangs drip; bubbles rise | *Aftertaste*: poisons all foes and heals allies by part of the poison damage |
| Crystal | Prism-of-Unwritten-Maps | Cartography of possibility | A cape of faceted crystal panels projecting map lines onto the floor | Clear gel with internal facets; a map-light projection on the arena floor | Facet eyes with projected rune lines | The projected map shifts and redraws around her feet | *Unwritten Route*: changes her element to one that beats the target, then strikes |
| Lava | Hearth-of-the-Deep-Fault | Anger that warms the village | The chest opens into a hearth arch with a glowing cooking pot inside | A crust apron; a ladle in hand; glass pebble drips at the hem | Warm ember irises, hearth runes | Stirs the pot in its chest with the ladle; sparks rise | *Glass Road Home*: big AoE eruption that shields allies after |
| Storm | Parliament-of-Clouds | Weather with a constitution | A council of cloud puffs seated along the shoulders, each with tiny eyes | A rolled-lightning scepter; swirling cloud gel in the torso | Dramatic glowing irises; the cloud puffs have small eyes | The cloud puffs bob in turn as if murmuring, then flash together to "vote" | *Motion Carried*: sets the turn order for the next round |
| Spirit | Choir-of-the-Unmelted | Every soft death that stayed helpful | A robe hem that splits into many trailing wisp tails | Faint gel faces rising and sinking inside the robe; hands open | Glowing slits, choir runes | The faces rise and sink as if singing; the tails sway | *Unfinished Kindness*: revives all fallen allies with part of their health |
| Void | The Exception | Unmaking that made an exception for you | A glowing-edged accretion-disk collar worn around the shoulders | Hands cupped around a tiny glowing Haven orb; starfield gel body | One big eye in the face, the disk edge as a rune ring | The disk slowly rotates; the hands shelter the orb | *Rule Erased*: removes one foe rule (passive, immunity, or shield) |

---

## 6. Distinctness check

**Within each element, the three tiers differ:**

| Element | Epic hook (Morph) | Legendary hook (Ascended) | Mythic hook (Humanoid) | Distinct |
|---|---|---|---|---|
| Water | Canoe hull base + oar arm | Drip-curtain rain hat | Rain-column lower body | Yes |
| Fire | Brazier collar + torch cone | Bellows shoulders + furnace chest | Meteor-tail mane | Yes |
| Earth | Cairn stack on head | Boulder rocking chair base | Plateau landscape shoulders | Yes |
| Wind | Kite fin + streaming tail | Envelope flap hood | Floating doorway ajar | Yes |
| Plant | Skep-ridged dome body | Bramble arch crown | Seed-husk cloak + sprout | Yes |
| Lightning | Coiled antenna + goggles | Floating cracked bell canopy | Orbiting glyph ring | Yes |
| Ice | Held ice lens + book-slab pack | Icicle barrister wig + gavel | Clock dial halo + pendulum | Yes |
| Shadow | Two-tailed stage hood + mask | Long trailing smoke scarf | High-collar split robe | Yes |
| Light | Bell-drop ring above head | Sunrise ray fan | Candle flame head | Yes |
| Metal | Oversized mirror buckler arm | Anvil torso with horn | Tool crown | Yes |
| Poison | Teapot body + spout arm | Vial-tower hat | Cobra-hood collar | Yes |
| Crystal | Split geode crust shell | Mirror-shard wheel | Projector panel cape | Yes |
| Lava | Basalt sleeping hump | Trailing glass train | Chest hearth + pot | Yes |
| Storm | Spinning weathervane spike | Cloud tricorn + greatcoat | Cloud council on shoulders | Yes |
| Spirit | Drooping moth wings | Crook staff + lantern | Many-tailed wisp hem | Yes |
| Void | Question-mark stalk + orbiting objects | Circular chest hole + seal ring | Accretion-disk collar | Yes |

**Within each tier, no two heroes share a hook.** Checked all 16 hooks per column above: Epic has one halo-type hook (Oriel), one back-wing (Ilse), one back-shell (Tamsin) and one back-hump (Murrow), with wings, rock shell, and basalt hump reading as different silhouettes. Legendary has one hat-brim (Maris), one tricorn (Squall), and one vial-tower hat (Mire), which read as a wide flat brim, a three-point hat, and a tall stack. Mythic has one crown (Tools), one halo dial (Clock), one mane (Second Sun), and one collar each for Treaty (tall stiff), Fangs (cobra hood), and Exception (flat disk), all different outlines.

**Cross-tier motif echoes to watch (allowed, different elements and tiers):** Oriel's bells (Epic Light) and Arc's bell (Legendary Lightning); Mire's vials (Legendary Poison) and Gallwort's teapot (Epic Poison) are both vessels, but one is a hat stack and one is a body shape. Keep them apart in the lineup sheet.

---

## 7. Implementation notes

### Porting to the Phaser project
- **Data file:** `src/data/heroRoster.js`, same IIFE / `global` pattern as `championNames.js` and `gameData.js`. Suggested shape:
  ```js
  HERO_ROSTER = {
    Water: {
      species: { lineage: 'Tideborn', variants: ['a','b','c'] },
      epic:      { id: 'water_epic_pell', name: 'Ferryman Pell', epithet: '...', bio: '...', role: '...', signature: { name: 'Last Crossing', text: '...' }, look: { hook: '...', kitOverrides: 'water_pell' } },
      legendary: { id: 'water_leg_maris', name: 'Maris of the Last Rain', ... },
      mythic:    { id: 'water_myth_firstrain', name: 'The First Rain That Had a Name', ... }
    }, ...
  };
  getNamedHero(element, rarity) // null for Common/Uncommon/Rare
  ```
  Copy Legendary and Mythic text verbatim from `lore.js` so the two projects stay in sync.
- **Summon rules:** Common/Uncommon/Rare pulls roll a lineage variant (a/b/c) and a generated name (`generateChampionName`, as now). **Epic, Legendary, and Mythic pulls resolve to that element's named hero** and skip the name generator (including the `Grand `/`Lord `/`Mythic ` prefixes). The odds tables and pity in `gameData.js` stay as they are. With one named hero per element per tier, duplicates will be common, so they need a sink (rank-up, bond, or shards). That is a design decision; this doc sets no numbers.
- **Lore tab:** for Epic+, show name, epithet, bio, role, and signature skill from `heroRoster.js`, then the lineage block. Species keep the lineage block plus the rarity bio.
- **Signature skill:** the named skill replaces or upgrades one slot of the element's A1/A2/A3 kit. Which slot, and the numbers, are for the combat pass.
- **Save data:** store `heroId` on the unit so a named hero survives renames and data edits.

### Issues found in the sources (flag before porting)
1. **Lineage titles differ between projects.** Codex (`lore.js`, WORLD doc) uses Tideborn, Emberheart, Stonegut, Zephyrkin, Bloomcore, Sparkcoil, Frostlens, Umbrawisp, Luminjelly, Chromeblob, Venomgloop, Prismheart, Magmacore, Tempestorb, Wispling, Riftgel. Phaser `ELEMENT_LORE` uses Emberkin, Stoneward, Zephyr, Bloomkin, Stormcore, Frostgel, Shade, Lumina, Steelgel, Venomkin, Prism, Magma, Tempest, Wisp, Abyss (only Tideborn matches). Legend titles like "Legendary Emberheart" assume the codex names. This doc uses the codex names.
2. **Rarity bios conflict.** Phaser `RARITY_LORE.Legendary` says "still slime-bodied, not humanoid" and Mythic "rarely near-humanoid", but `resolveFormTier` gives Legendary evo 5+ and all Mythics the humanoid body, and the codex calls Mythics "Shape-Bound by default." Update the Phaser bios to match.
3. **Form changes with evolution.** `resolveFormTier` moves Epic evo 3+ to Ascended and Legendary evo 5+ to Humanoid. Recommendation: each named hero keeps its hook and ornament set when it moves up a body (Pell's canoe hull and oar go onto the Ascended torso; Maris's rain hat goes onto the Humanoid). Budget one extra body pass per Epic and Legendary for this.
4. **Phaser code comment vs code:** the `resolveFormTier` comment says legacy humanoid/ascended "map to shaped", but the code returns `ascended` and `humanoid` as separate tiers. The code matches HERO_DESIGN; fix the comment.
5. The Phaser name bank includes `Ashen` (Fire) and `Briar` (Plant), which match parts of legend names (Lantern-Walker Ashen, Harvest-Saint Briar). Generated Common units could be named "Ashen". Low risk; consider removing those two entries.

### 3D production order
Named heroes come **after the kit system is locked** (HERO_DESIGN §7, end of R3), because each named hero is the element kit plus a hero layer, not a new sculpt.
1. **R5a, pilot:** Water, Fire, Plant named heroes in all three tiers (Pell, Brann, Mother Comb; Maris, Vorr, Briar; First Rain, Second Sun, Seed). This proves the hero layer: hook deform, ornament set, eye override, idle.
2. **R5b, Epic champions (13 remaining):** Morph body, the cheapest pass and the highest pull volume.
3. **R5c, Legendary legends (13 remaining):** Ascended body.
4. **R5d, Mythic legends (13 remaining):** Humanoid body, the most hand polish.
5. **R5e, form carry-over:** Epic hooks on Ascended, Legendary hooks on Humanoid (issue 3).

Every named hero passes the HERO_DESIGN §6 gates, plus: its hook reads in black silhouette next to the other two heroes of its element and next to the 15 others of its tier (lineup sheet per tier).
