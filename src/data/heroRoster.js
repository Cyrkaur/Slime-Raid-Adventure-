/* ===== Hero roster: species lineages + named Epic / Legendary / Mythic heroes =====
 * GENERATED from docs/HERO_ROSTER.md and Slime Adventure js/data/lore.js
 * (LEGENDARY_LEGENDS / MYTHIC_LEGENDS / ELEMENT_LORE copied verbatim).
 * Regenerate with tools/gen-hero-roster.js rather than hand-editing the data blocks.
 *
 * Common / Uncommon / Rare  = species: lineage + variant a/b/c + generated name.
 * Epic / Legendary / Mythic = one named hero per element (see getNamedHero).
 *
 * Founder decisions still open. Defaults live in HERO_ROSTER_CONFIG so they are
 * one-line changes:
 *   - lineageNames: 'codex' (Emberheart, Stonegut, Zephyrkin...) or 'phaser'
 *     (the older Phaser titles: Emberkin, Stoneward, Zephyr...).
 *   - duplicate named pulls: onDuplicateNamedHero() is the only hook.
 *     Placeholder policy converts the duplicate to shards; the shard values are
 *     untuned placeholders (0) until the founder sets them.
 */
(function (global) {
  'use strict';

  var HERO_ROSTER_CONFIG = {
    lineageNames: 'codex',
    namedRarities: ['Epic', 'Legendary', 'Mythic'],
    duplicatePolicy: 'shards',
    /** Placeholder, NOT tuned. Founder to set real values. */
    duplicateShardValue: { Epic: 0, Legendary: 0, Mythic: 0 },
    duplicateShardCurrency: 'slimeShards'
  };

  var ELEMENT_ORDER = ["Water","Fire","Earth","Wind","Plant","Lightning","Ice","Shadow","Light","Metal","Poison","Crystal","Lava","Storm","Spirit","Void"];

  /** Codex lineage titles and blurbs (Slime Adventure ELEMENT_LORE). */
  var CODEX_LINEAGES = {
    "Water": {
      "title": "Tideborn",
      "role": "Support / Control",
      "blurb": "Tideborn slimes remember every river that ever ran. They soothe allies, drown flame, and wash maps clean of ash.",
      "personality": "Curious, patient, sometimes flood-tempered.",
      "extended": "Tideborn gel is oldest after Spirit. Village midwives still bathe newborns in a drop of Tideborn dew for luck. In war they are the pulse between strikes — never the loudest, always the reason the party still stands."
    },
    "Fire": {
      "title": "Emberheart",
      "role": "Nuker / Burst",
      "blurb": "Emberhearts keep a core of living coal. Short lives in pure water; long legends in war.",
      "personality": "Bold, loud, fiercely loyal once bonded.",
      "extended": "Forge-towns barter Emberheart jelly like coin. A bonded Emberheart will burn a path for its Keeper even when the map says the path is stone."
    },
    "Earth": {
      "title": "Stonegut",
      "role": "Tank / Sustain",
      "blurb": "Stoneguts pack pebble and clay into armor-gel. They hold lines when the party would scatter.",
      "personality": "Stubborn, dry-humored, immovable.",
      "extended": "Stonegut champions sleep standing up. Miners say if you dig and hit something that laughs, you have found one."
    },
    "Wind": {
      "title": "Zephyrkin",
      "role": "Speed / Debuff",
      "blurb": "Almost weightless. Zephyrkin skim the battlefield and peel defenses before heavier champs land blows.",
      "personality": "Restless, joking, hard to pin down.",
      "extended": "Messengers used to carry Zephyrkin in sealed gourds. Half the letters arrived early; half arrived as confetti."
    },
    "Plant": {
      "title": "Bloomcore",
      "role": "Heal / Grow",
      "blurb": "Bloomcores photosynthesize luck. They root into Haven soil and turn exploration into harvest.",
      "personality": "Gentle until thorns, then very not gentle.",
      "extended": "A Haven without Bloomcore is a Haven that forgets spring. Their pollen can wake exhausted allies — or choke a hard-realm patrol that refused to leave the glade."
    },
    "Lightning": {
      "title": "Sparkcoil",
      "role": "Chain DPS",
      "blurb": "Sparkcoils store storms in a droplet. One wrong bounce and the whole wave lights up.",
      "personality": "Impulsive genius / chaos.",
      "extended": "Never store Sparkcoil gel near Chromeblobs unless you enjoy spontaneous forges. Keepers who bond them learn patience by force."
    },
    "Ice": {
      "title": "Frostlens",
      "role": "CC / Slow",
      "blurb": "Frostlens freeze time in their pupils. Perfect for locking a boss while the team repositions.",
      "personality": "Cool, exacting, secretly soft.",
      "extended": "Glacier monks meditate inside Frostlens rings. The lesson is always the same: stop the world, then choose."
    },
    "Shadow": {
      "title": "Umbrawisp",
      "role": "Assassin / Hex",
      "blurb": "Born where light gave up. Umbrawisps erase footprints and cut the threads of enemy skills.",
      "personality": "Quiet, theatrical, opportunistic.",
      "extended": "Umbrawisp loyalty is a rumor until it is a blade in a lich's back. They love Keepers who keep secrets and hate Keepers who monologue."
    },
    "Light": {
      "title": "Luminjelly",
      "role": "Cleanse / Smite",
      "blurb": "Luminjellies are portable sunrises. They unmask Shadow and Void and keep the Haven warm at night.",
      "personality": "Earnest, radiant, slightly preachy.",
      "extended": "Temple choirs keep a Luminjelly above the altar. If it dims during a hymn, the verse was a lie."
    },
    "Metal": {
      "title": "Chromeblob",
      "role": "Reflect / Armor",
      "blurb": "Chromeblobs temper gel with ore-memory. They ring like bells when struck and answer with shrapnel.",
      "personality": "Practical, blunt, craftsman-proud.",
      "extended": "A Chromeblob that trusts you will let you polish its face. A Chromeblob that does not will polish your ego with scrap."
    },
    "Poison": {
      "title": "Venomgloop",
      "role": "DoT / Weaken",
      "blurb": "Venomgloops are patient chemists. A single drip can end a long fight three turns later.",
      "personality": "Smug, clever, quarantine-required.",
      "extended": "Alchemists love them. Healers schedule them. Keepers who rush Venomgloop bonds often invent new words for regret."
    },
    "Crystal": {
      "title": "Prismheart",
      "role": "Hybrid mage",
      "blurb": "Prismhearts refract any element they touch. Collectors prize them; foes fear the rainbow burst.",
      "personality": "Curious, fragile-looking, actually diamond.",
      "extended": "In Crystal Mountains, children play \"catch the Prismheart.\" The Prismheart usually wins and keeps the ball."
    },
    "Lava": {
      "title": "Magmacore",
      "role": "Heavy AoE",
      "blurb": "Hotter than Fire, denser than Earth. Magmacores leave glass footprints and bad decisions.",
      "personality": "Slow burn, then catastrophe.",
      "extended": "Magmacore gel cools into black glass that still pulses if you hold it to your ear. Do not hold it too long."
    },
    "Storm": {
      "title": "Tempestorb",
      "role": "Weather control",
      "blurb": "Tempestorbs are small hurricanes with eyes. They set the tempo of whole waves.",
      "personality": "Moody, dramatic, dependable in crisis.",
      "extended": "Sailors nail Tempestorb charms to masts. The charms work best if you also know how to sail."
    },
    "Spirit": {
      "title": "Wispling",
      "role": "Revive / Soft utility",
      "blurb": "Wisplings remember champions who melted. They guide, soothe, and occasionally possess bad ideas.",
      "personality": "Melancholy, kind, uncanny.",
      "extended": "A Wispling that bonds a Keeper has chosen to stay in the Third Age. That choice is heavier than it looks."
    },
    "Void": {
      "title": "Riftgel",
      "role": "Anti-everything",
      "blurb": "Riftgels should not exist — and do anyway. They erase rules, including yours if poorly trained.",
      "personality": "Alien, hungry for meaning, oddly loyal.",
      "extended": "To bond a Riftgel is to argue with unmaking and win a temporary truce. Train them, or they train the map into holes."
    }
  };

  var HERO_ROSTER = {
    "Water": {
      "species": {
        "lineage": "Tideborn",
        "variants": {
          "a": "Classic teardrop, a curl of wave on top that sloshes when it hops",
          "b": "Wide puddle-low body with a floating lily-pad cap and one trapped air bubble",
          "c": "Tall narrow droplet with a rain-streak surface and a tiny fish shadow swimming inside"
        }
      },
      "epic": {
        "id": "water_epic_pell",
        "name": "Ferryman Pell",
        "epithet": "Who rowed the flood backward",
        "bio": "In the Second Age, when a Void Crack split the Tidecall Coast and the sea rushed inland, Pell turned itself into a boat and ferried a whole hamlet over the flood, one trip at a time. It never charged a fare, only a story. Tideborn children still leave shells at river crossings \"for Pell's toll.\"",
        "role": "Support / Control",
        "signature": {
          "name": "Last Crossing",
          "text": "Lifts one ally out of harm into a bubble that absorbs the next hit, and pulls the target's turn back.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "lower body flares into a shallow flat-bottomed canoe hull, and the right arm ends in a broad oar blade.",
          "ornaments": "kelp-rope sash tied across the front; a tiny shell charm hanging from the rope.",
          "gel": "a visible waterline inside: lower half crystal clear, upper half full of small suspended bubbles.",
          "eyes": "round, magnified through the clear gel; gel brow shaped like a curling wave crest.",
          "idle": "slow rowing stroke with the oar arm, body rocking fore and aft on the stroke."
        }
      },
      "legendary": {
        "id": "water_leg_maris_last",
        "name": "Maris of the Last Rain",
        "title": "Legendary Tideborn",
        "epithet": "Who taught a desert to weep",
        "bio": "When the Second Age nearly baked the southern marches dry, Maris rose from a single well and walked the dunes for forty nights. Each step left a pool that did not evaporate. Hard-realm cartographers still mark those pools as \"errors.\" Keepers who bond a Legendary Tideborn sometimes dream of Maris counting raindrops like coins. In battle she (or the gel that carries her echo) drowns siege engines and leaves the party breathing easier than the math allows.",
        "role": null,
        "signature": {
          "name": "Forty Nights",
          "text": "Leaves healing pools under allies that cleanse on their turn.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "Wide-brimmed rain hat of gel with a constant drip curtain falling from the brim",
          "ornaments": "Necklace of coin-shaped raindrops (she counts them); clear gel with a band of desert sand settling at the base",
          "eyes": "Magnified, blue glowing irises, a ring of ripple runes",
          "idle": "Catches drops in her palm and counts them; a pool forms under her and never dries"
        }
      },
      "mythic": {
        "id": "water_myth_first_rain",
        "name": "The First Rain That Had a Name",
        "title": "Mythic Tideborn",
        "epithet": "Primordial droplet, Shape-Bound hope",
        "bio": "Before names, water fell. One droplet decided to keep falling as a person. Mythic Tideborn are that decision wearing a Keeper's trust. When one Shape-Binds fully, rivers downstream change course toward the Haven for a year. Hard-realm scholars call it hydrology. Soft folk call it love with a watershed.",
        "role": null,
        "signature": {
          "name": "Watershed",
          "text": "Large party heal and a slow on all foes.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "Below the waist she is a continuous column of falling rain pouring into a puddle",
          "ornaments": "Hair of falling rain strands; the clearest gel in the roster, magnifying what is behind her",
          "eyes": "Magnified glowing irises, a droplet third eye on the brow",
          "idle": "Rain strands fall and rise back up in a loop; ripples spread from the puddle"
        }
      }
    },
    "Fire": {
      "species": {
        "lineage": "Emberheart",
        "variants": {
          "a": "Round body with a three-lick flame tuft and a visible coal core",
          "b": "Squat body, flame crest swept back like a mohawk, ember sparks shed on landing",
          "c": "Pear-shaped, flame burns low around the base like a skirt, coal core pulses bright"
        }
      },
      "epic": {
        "id": "fire_epic_brann",
        "name": "Signal-Fire Brann",
        "epithet": "The hilltop that shouted",
        "bio": "In the Age of Cracks, a hard-realm raid cut the signal chain along the Volcanic Wastes border. Brann climbed the dead signal hill and burned all night, loud and bright enough that every hamlet saw and fled in time. He has been proud and slightly hoarse ever since.",
        "role": "Nuker / Burst",
        "signature": {
          "name": "Beacon Roar",
          "text": "A burst blast on one foe that also raises allies' turn meters.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "sits inside an iron brazier-bowl collar ringing the upper body, with a tall narrow torch-cone flame rising from the top.",
          "ornaments": "soot-black iron bowl with four short legs welded on as decoration; a knotted signal rag tied to one arm.",
          "gel": "the flame cone is gel too: orange translucent at the base, brightening to pale yellow at the tip, with a bright flicker core.",
          "eyes": "ember glow, a thick gel brow shaped like two flame licks.",
          "idle": "\"shouts\" every few seconds: the torch cone flares taller, sparks puff, arms thrown wide."
        }
      },
      "legendary": {
        "id": "fire_leg_cinder_king",
        "name": "Cinder-King Vorr",
        "title": "Legendary Emberheart",
        "epithet": "The forge that chose a side",
        "bio": "Vorr was a village forge-fire that refused to go out when the raiders came. The forge melted; the fire stood up. He burned only the iron that would have become chains. A Legendary Emberheart that carries Vorr's coal-heart will never strike a bonded ally — and will never spare a cage.",
        "role": null,
        "signature": {
          "name": "Chainbreaker",
          "text": "Burst hit that breaks the foe's shields and armor.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "Bellows-plate shoulders and an open furnace chest showing a coal-heart",
          "ornaments": "Broken chain links melting off both wrists; flame tufts at the bellows vents",
          "eyes": "Ember irises, hammer-mark runes",
          "idle": "Coal-heart pulses; he opens a fist and a chain link melts off and drips away"
        }
      },
      "mythic": {
        "id": "fire_myth_heart_second",
        "name": "Heart-of-the-Second-Sun",
        "title": "Mythic Emberheart",
        "epithet": "A star that chose the ground",
        "bio": "A Soft Star fell and refused to go out. It cooled into Mythic Emberheart gel that still remembers vacuum and warmth. Shape-Bound, it walks like a forge that learned mercy. Its Inferno does not only burn foes — it burns the idea that the Haven was ever cold.",
        "role": null,
        "signature": {
          "name": "Burn the Cold",
          "text": "AoE inferno that also warms allies (cleanses freeze and slow).",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A streaming meteor-tail mane flowing back from the head",
          "ornaments": "A ring of black \"vacuum\" gel around a white-hot star core in the chest; broad forge-like build",
          "eyes": "Ember irises, star runes, a small star as a crown point",
          "idle": "The mane streams back even when still; the core flares on each breath"
        }
      }
    },
    "Earth": {
      "species": {
        "lineage": "Stonegut",
        "variants": {
          "a": "Dense dome with pebbles suspended in bands and a flat slate chip on top",
          "b": "Lumpy boulder shape with a moss patch and a sprouting grass tuft",
          "c": "Wide-bottomed, clay-cloudy gel with a flat slab of stone half-sunk into one side like a shield"
        }
      },
      "epic": {
        "id": "earth_epic_hob",
        "name": "Waystone Hob",
        "epithet": "Who stood where the road forgot",
        "bio": "In Greenwild, the old trails were drawn when the First Age tides still ran, and the hard-realm maps lost them. Hob stacked stones on its own head at every fork so lost Keepers could find the Primordial hum again. Some cairns in the forest are Hob's naps.",
        "role": "Tank / Sustain",
        "signature": {
          "name": "Cairn Guard",
          "text": "Taunts, then leaves a stone marker that shields the ally behind it.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "a balanced cairn of three flat stones stacked on top of the head, each slightly off-center.",
          "ornaments": "moss on the stones; the arms end in flat stone mitts.",
          "gel": "pebbles suspended in clear horizontal strata bands, like a road cut.",
          "eyes": "small, deep-set, under a heavy gel brow studded with pebbles.",
          "idle": "keeps rebalancing the cairn: tiny wobble, then a steadying pat with one mitt."
        }
      },
      "legendary": {
        "id": "earth_leg_granny_bedrock",
        "name": "Granny Bedrock",
        "title": "Legendary Stonegut",
        "epithet": "Who sat until the war ended",
        "bio": "Granny Bedrock sat on a mountain pass for three winters while hard armies tried to cross. They eventually built a road around her. The road is still called Polite Detour. Legendary Stoneguts with her patience turn arenas into walls and jokes into earthquakes.",
        "role": null,
        "signature": {
          "name": "Polite Detour",
          "text": "Taunts all foes and redirects hits aimed at allies to herself.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "Lower body is a squat boulder rocking chair",
          "ornaments": "Moss shawl over the shoulders; stalagmite knitting needles; mica spectacles",
          "eyes": "Small kind glowing irises behind the mica lenses",
          "idle": "Knits, rocks slowly; one pebble falls off per rock"
        }
      },
      "mythic": {
        "id": "earth_myth_world_shelf",
        "name": "World-Shelf",
        "title": "Mythic Stonegut",
        "epithet": "The continent that sat up",
        "bio": "Myths say a shelf of the world grew tired of being walked on without thanks. It stood as Mythic Earth gel. Shape-Bound World-Shelf champions make arenas feel smaller and Keepers feel taller. They do not rush. The map moves around them.",
        "role": null,
        "signature": {
          "name": "The Map Moves",
          "text": "Shields the party and pushes back foes' turn meters.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "Massive shoulders carrying a flat plateau landscape with tiny trees and a road",
          "ornaments": "Pebble strata in the torso; moss and grass on the plateau",
          "eyes": "Deep amber irises under a rock-ledge brow",
          "idle": "Slow breath; pebbles trickle off the plateau edge; tiny gel birds circle it"
        }
      }
    },
    "Wind": {
      "species": {
        "lineage": "Zephyrkin",
        "variants": {
          "a": "Near-clear teardrop tilted forward, white streaks swirling inside",
          "b": "Small hovering puff with two feather-shaped gel flicks at the sides",
          "c": "Spiral-twisted body like a soft-serve curl, the tip always trailing in a breeze"
        }
      },
      "epic": {
        "id": "wind_epic_pip",
        "name": "Kite-Runner Pip",
        "epithet": "Tied to nothing, late for everything",
        "bio": "When hard-realm observation kites hung over the Stormmarch Ridges spying on Havens, Pip cut the tethers one by one and rode the kites down as sleds. Pip kept one tail ribbon as a trophy and never learned to stop.",
        "role": "Speed / Debuff",
        "signature": {
          "name": "Cut the Line",
          "text": "Fast hit that removes a buff and lowers the foe's speed.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "a diamond kite-sail fin on the back plus a long streaming gel tail with bow-knots trailing behind.",
          "ornaments": "a frayed rope tether tied loosely at the waist, cut end dangling.",
          "gel": "very clear gel with white swirl streaks that flow toward the tail.",
          "eyes": "squinting grin eyes, gel brow swept back by wind.",
          "idle": "hovers a hand's width off the ground and bobs; the tail flutters in a slow figure-8."
        }
      },
      "legendary": {
        "id": "wind_leg_unposted_letter",
        "name": "The Unposted Letter",
        "title": "Legendary Zephyrkin",
        "epithet": "News that arrives before the event",
        "bio": "A Zephyrkin once delivered a warning of a Void Crack three days before the crack opened. Scholars still argue how. Poets do not. Legendary Wind champions that inherit the Letter can peel a foe's defense before the foe understands the joke.",
        "role": null,
        "signature": {
          "name": "Arrives Early",
          "text": "Acts first and lowers a foe's defense before it moves.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "Envelope body: a triangular flap forms a hood, with a wax seal on the chest",
          "ornaments": "Loose page-shaped gel wings trailing; very clear gel with ink streaks",
          "eyes": "Glowing eyes through the envelope window, wind-script runes",
          "idle": "The flap lifts in the breeze; pages flutter around and settle"
        }
      },
      "mythic": {
        "id": "wind_myth_breath_between",
        "name": "Breath-Between-Ages",
        "title": "Mythic Zephyrkin",
        "epithet": "The silence after a door closes",
        "bio": "Between the Second and Third Age, something exhaled. That breath never finished leaving. Mythic Wind gel is the unfinished exhale — and it chooses Keepers who leave doors open for strays.",
        "role": null,
        "signature": {
          "name": "Door Left Open",
          "text": "Removes all foe buffs and speeds up the party.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A floating arched doorway frame of wind streaks behind her, standing ajar",
          "ornaments": "Tall slender figure; robe tails stream sideways; the lower body thins into a long exhale ribbon",
          "eyes": "Closed calm eyes that open glowing on attack, wind runes",
          "idle": "A slow exhale: gel streaks drift from her mouth; the door swings a little"
        }
      }
    },
    "Plant": {
      "species": {
        "lineage": "Bloomcore",
        "variants": {
          "a": "Round green body with a single sprout and two leaves on top",
          "b": "Mossy low mound with three tiny flowers and leaves suspended inside",
          "c": "Bulb shape like a flower bud, petals folded at the crown that open on cast"
        }
      },
      "epic": {
        "id": "plant_epic_comb",
        "name": "Mother Comb",
        "epithet": "Who kept the bees through the dry scar",
        "bio": "When a Greenwild Haven fell and became a dry scar, Mother Comb carried the last hive inside her gel across the ash. She grew a meadow wherever she rested. Bloomcores still hum when they meet her.",
        "role": "Heal / Grow",
        "signature": {
          "name": "Honey Hour",
          "text": "Heals the party over time and wakes a stunned ally.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "body shaped like a straw bee skep: domed, with stacked horizontal ridge rings.",
          "ornaments": "clover-flower crown; small glowing pollen motes orbiting like bees.",
          "gel": "an amber honey core inside green gel, with hexagonal comb cells suspended in it.",
          "eyes": "soft round eyes, leaf-shaped gel brow.",
          "idle": "gentle humming sway; motes circle and dip into her body one at a time."
        }
      },
      "legendary": {
        "id": "plant_leg_harvest_saint",
        "name": "Harvest-Saint Briar",
        "title": "Legendary Bloomcore",
        "epithet": "Mercy with thorns",
        "bio": "Briar grew a orchard overnight around a starving Haven, then grew a second orchard of thorns around the raiders who came for it. Children still leave berry crowns on Bloomcore stones. A Legendary Plant champion with Briar's root-memory heals like spring and punishes like a hedge with opinions.",
        "role": null,
        "signature": {
          "name": "Two Orchards",
          "text": "Heals allies and gives them a thorn counter.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "Tall bramble arch crown arching behind the head like a garden gate",
          "ornaments": "Right arm an orchard branch heavy with fruit, left arm a thorn vine; skirt of leaves",
          "eyes": "Green-gold irises, seed runes",
          "idle": "Blossoms open on the arch, ripen to berries, drop"
        }
      },
      "mythic": {
        "id": "plant_myth_seed_eternal",
        "name": "Seed-of-the-Eternal-Garden",
        "title": "Mythic Bloomcore",
        "epithet": "Spring that cannot be scheduled",
        "bio": "The Eternal Garden is not a place on the map; it is a promise. Mythic Plant gel is a seed of that promise. Shape-Bound, it grows party strength like canopy. Enemies find their boots full of inconvenient flowers.",
        "role": null,
        "signature": {
          "name": "Inconvenient Flowers",
          "text": "Party heal over time and roots foes.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A split seed-husk worn as a hooded cloak, two halves framing the figure",
          "ornaments": "A sprout with two leaves growing from the crown; root tendrils for feet; leaves and seeds suspended in the gel",
          "eyes": "Green glowing irises, leaf runes",
          "idle": "Flowers pop up where she steps and close behind her"
        }
      }
    },
    "Lightning": {
      "species": {
        "lineage": "Sparkcoil",
        "variants": {
          "a": "Pale yellow drop with a zigzag antenna and inner arcs",
          "b": "Round body with two static-charged hair spikes that stand up and twitch",
          "c": "Coiled body like a spring, arcs jumping between the coils"
        }
      },
      "epic": {
        "id": "lightning_epic_jax",
        "name": "Fuse-Wit Jax",
        "epithet": "Genius on a short fuse",
        "bio": "At a thunder sanctum, a hard-realm living theorem of lightning boxed in a Haven's metal spires. Jax rewired the spires on a dare in the middle of the storm, and the theorem struck itself. Jax has been banned from three workshops and invited back to all of them.",
        "role": "Chain DPS",
        "signature": {
          "name": "Rewire",
          "text": "Chain bolt that jumps between foes and hits harder on each foe with a debuff.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "one tall coiled copper antenna spiral rising from the head, ending in a glowing ball.",
          "ornaments": "brass ring goggles pushed up on the gel brow; a coil of wire looped over one arm.",
          "gel": "pale yellow gel with arcs jumping between two floating copper beads inside.",
          "eyes": "one visibly bigger than the other (mad-genius look), bright highlights.",
          "idle": "jittery foot-tap bounce; the antenna ball sparks on every fourth beat."
        }
      },
      "legendary": {
        "id": "lightning_leg_arc_broken",
        "name": "Arc of the Broken Bell",
        "title": "Legendary Sparkcoil",
        "epithet": "Who rang the sky",
        "bio": "When a hard-realm siege tower approached a coastal Haven, a Sparkcoil climbed the tower and became the clapper of a bell that was not there. The tower fell as lightning. The Haven kept the scorch mark as a calendar. Legendary Lightning gel that remembers Arc chains doom across a wave like gossip.",
        "role": null,
        "signature": {
          "name": "Toll of the Tower",
          "text": "Chain bolt that bounces across every foe.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "A cracked bronze bell canopy floats over head and shoulders; the body hangs under it like the clapper",
          "ornaments": "Scorch-mark calendar ticks on the bell rim; arcs crawl along the crack",
          "eyes": "Bright irises, lightning-glyph runes",
          "idle": "Swings like a clapper and sparks when it nearly touches the bell"
        }
      },
      "mythic": {
        "id": "lightning_myth_syntax_storms",
        "name": "Syntax-of-Storms",
        "title": "Mythic Sparkcoil",
        "epithet": "Language of the sky",
        "bio": "Lightning is how the sky talks. Mythic Sparkcoil is a complete sentence. Shape-Bound, it speaks chain-bolts that rewrite turn order. Keepers who bond it learn to flinch less at good news arriving too fast.",
        "role": null,
        "signature": {
          "name": "Complete Sentence",
          "text": "Chain bolts that rewrite turn order.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A ring of glowing lightning glyphs orbiting the body, forming words",
          "ornaments": "Lanky figure; hair stands up as arcs; conductor's hands",
          "eyes": "Bright irises, glyph runes, a crackle third eye",
          "idle": "Writes in the air; glyphs flash and join the ring"
        }
      }
    },
    "Ice": {
      "species": {
        "lineage": "Frostlens",
        "variants": {
          "a": "Semi-frozen dome with a frost rim and one icicle point on top",
          "b": "Faceted-edged cube-ish body, softened corners, snowflake frozen in the core",
          "c": "Low wide body with an ice crust \"shell\" cracked on the back, cloudy core"
        }
      },
      "epic": {
        "id": "ice_epic_rhee",
        "name": "Archivist Rhee",
        "epithet": "Librarian of stopped moments",
        "bio": "Rhee keeps the Frostlens monks' silent library in the Crystal Mountains, where each book is a moment frozen before it could go wrong. In the Age of Cracks, Rhee started lending those moments to Keepers in battle. Late returns are not forgiven.",
        "role": "CC / Slow",
        "signature": {
          "name": "Overdue",
          "text": "Freezes one foe and delays its next turn.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "an oversized round ice lens held up in one arm like a magnifying glass, plus a tall pack of stacked ice slabs (frozen books) on the back.",
          "ornaments": "frost-rimed spines on the slabs; a small bookmark ribbon of frozen gel.",
          "gel": "semi-frozen shell with a frost rim; a cloudy core with a snowflake visible inside.",
          "eyes": "frost-rimmed; the eye behind the lens is magnified huge. Straight, stern gel brow.",
          "idle": "raises the lens, peers, lowers it, with a stiff wobble each time."
        }
      },
      "legendary": {
        "id": "ice_leg_judge_stillwater",
        "name": "Judge Stillwater",
        "title": "Legendary Frostlens",
        "epithet": "The pause that saved a city",
        "bio": "Stillwater froze a collapsing bridge mid-fall so citizens could finish crossing, then unfroze it into a gentle slide into the river. No one drowned. The bridge still complains in winter. Legendary Ice champions who carry the Judge stop bosses mid-sentence.",
        "role": null,
        "signature": {
          "name": "Order in the Court",
          "text": "Freezes a foe mid-cast and delays its turn.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "Cascading icicle barrister wig framing both sides of the face",
          "ornaments": "Ice gavel; a frozen bridge-plank breastplate",
          "eyes": "Frost-rimmed irises behind square frost spectacles",
          "idle": "Raises the gavel and holds it (frozen), then taps it down gently"
        }
      },
      "mythic": {
        "id": "ice_myth_clock_chose",
        "name": "Clock-That-Chose-Winter",
        "title": "Mythic Frostlens",
        "epithet": "Time, politely refused",
        "bio": "A clock in a glacier monastery stopped at the moment a Haven would have fallen — and the Haven did not fall. Mythic Ice gel is that stopped second, given will. Shape-Bound, it freezes boss ultimates mid-boast.",
        "role": null,
        "signature": {
          "name": "Stopped Second",
          "text": "Freezes a boss's ultimate mid-cast.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A frosted clock dial halo behind the head, hands stopped",
          "ornaments": "An icicle pendulum hanging from the belt; semi-frozen gel with a cloudy core",
          "eyes": "One eye frost-rimmed, the other with tiny clock hands",
          "idle": "The second hand ticks forward and back, never advancing"
        }
      }
    },
    "Shadow": {
      "species": {
        "lineage": "Umbrawisp",
        "variants": {
          "a": "Dark teardrop with smoky edges that trail on movement",
          "b": "Low slinking body with two pointed ear-wisps of smoke",
          "c": "Hooded-drop shape where the top folds over the eyes like a cowl"
        }
      },
      "epic": {
        "id": "shadow_epic_mott",
        "name": "Curtain-Call Mott",
        "epithet": "The bow before the blackout",
        "bio": "Mott played the night markets of Shadowfen. When the Shadow Lich's patrol came through, Mott took one last bow, snuffed every lantern at once, and walked the children out in the dark. The audience still claps when the lights go out.",
        "role": "Assassin / Hex",
        "signature": {
          "name": "Blackout",
          "text": "Stealth for a turn, then a strike that silences the foe's skills.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "a drooping two-tailed stage hood of smoke gel with a bead at each tip.",
          "ornaments": "a pale half-mask (comedy face) floating on the gel surface; a smoky short cape flaring from the back.",
          "gel": "dark low-transmission gel whose edges smoke off into trailing wisps.",
          "eyes": "slit pupils, seen through the mask holes; arched theatrical gel brow.",
          "idle": "slow, grand bow with one arm sweeping; cape smoke rolls on the ground."
        }
      },
      "legendary": {
        "id": "shadow_leg_quiet_knife",
        "name": "Quiet-Knife Nox",
        "title": "Legendary Umbrawisp",
        "epithet": "The apology written in umbra",
        "bio": "Nox was a thief who stole only from hard-realm supply lines and left Tideborn jelly for orphans. When captured, Nox melted through the bars and left a note: \"You should hire better locks — or better Keepers.\" Legendary Shadow gel with Nox's humor ends fights that speeches cannot.",
        "role": null,
        "signature": {
          "name": "Hire Better Locks",
          "text": "Ignores defense and strips a buff, leaving a \"note\" mark.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "A long smoky scarf wrapping the lower face and trailing far behind",
          "ornaments": "Right forearm forms a curved umbra blade; a lock-pick ring at the hip; a paper note between two fingers",
          "eyes": "Violet slit pupils, one winking; umbra runes",
          "idle": "Flips the note card between fingers; the scarf smokes"
        }
      },
      "mythic": {
        "id": "shadow_myth_umbral_treaty",
        "name": "Umbral-Treaty",
        "title": "Mythic Umbrawisp",
        "epithet": "Night that signed its name",
        "bio": "Night once negotiated with day for equal time. The signature was Mythic Shadow gel. Shape-Bound, the Umbral-Treaty ends fights in the space between lantern and dark. It keeps promises the way knives keep edges.",
        "role": null,
        "signature": {
          "name": "Between Lantern and Dark",
          "text": "Execute-style strike on a weakened foe.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A tall robed figure with a high stiff collar; the robe splits vertically into lantern-lit and deep-dark halves",
          "ornaments": "A quill-blade and a sealed scroll; a wax seal on the chest; smoky gel edges",
          "eyes": "Violet slit pupils, treaty runes",
          "idle": "Signs the air with the quill-blade; ink drips as shadow"
        }
      }
    },
    "Light": {
      "species": {
        "lineage": "Luminjelly",
        "variants": {
          "a": "Bright round body with a glowing core and iridescent film",
          "b": "Floating drop with a small ring of light hovering above",
          "c": "Star-shaped soft body (five rounded points), core glowing from center"
        }
      },
      "epic": {
        "id": "light_epic_oriel",
        "name": "Hymn-Keeper Oriel",
        "epithet": "Sings the verse that does not dim",
        "bio": "Oriel kept the altar in a Celestial Peaks temple. When a hard-realm envoy lied in the middle of a hymn, Oriel dimmed in front of the whole choir and the lie was out. Now Oriel sings in battle, and false buffs fall away.",
        "role": "Cleanse / Smite",
        "signature": {
          "name": "True Verse",
          "text": "Cleanses allies and removes one buff from each foe.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "a floating ring of small bell-shaped gel droplets hovering above the head.",
          "ornaments": "a pleated gel choir ruff around the \"neck\" line; a tiny hymn-sheet scroll in one arm.",
          "gel": "bright glowing core with an iridescent film; the bell-drops share the core glow.",
          "eyes": "white-gold, open mouth in a sung \"O\"; soft rounded gel brow.",
          "idle": "floaty sway in time; the bell-drops chime one after another around the ring."
        }
      },
      "legendary": {
        "id": "light_leg_dawn_herald",
        "name": "Dawn-Herald Solenne",
        "title": "Legendary Luminjelly",
        "epithet": "Who refused a false sunrise",
        "bio": "A hard-realm illusionist cast a fake dawn to panic a Haven into opening its gates. Solenne glowed true and the false sun cracked. The illusionist fled into a shadow that did not want him. Legendary Light champions of Solenne's line smite lies and warm beds equally.",
        "role": null,
        "signature": {
          "name": "True Dawn",
          "text": "Cleanses allies, strips illusions and buffs, smites.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "A fan of sunrise rays spread behind the shoulders",
          "ornaments": "A light-gel clarion held up; iridescent gel robe folds",
          "eyes": "White-gold irises, sunrise runes, a third eye on the brow",
          "idle": "Lifts the clarion; the ray fan pulses like a slow sunrise"
        }
      },
      "mythic": {
        "id": "light_myth_candle_against",
        "name": "Candle-Against-the-Crack",
        "title": "Mythic Luminjelly",
        "epithet": "Small flame, large refusal",
        "bio": "A single candle held at the lip of a Void Crack refused to go out for nine days. The candle was Mythic Light gel that had not yet admitted what it was. Shape-Bound, it is still that refusal — bright enough to make hard geometry blink.",
        "role": null,
        "signature": {
          "name": "Nine Days",
          "text": "Grants allies a shield that blocks one death.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "Slighter figure crowned by one tall candle flame on a wick",
          "ornaments": "Light gel dripping down the shoulders like wax; warm glowing core",
          "eyes": "White-gold irises, a third eye as the wick's glow",
          "idle": "The flame gutters as if in wind and relights, brighter"
        }
      }
    },
    "Metal": {
      "species": {
        "lineage": "Chromeblob",
        "variants": {
          "a": "Mercury dome with a mirror finish and a rivet-bead on top",
          "b": "Heavy low body with a gear-tooth ridge along the back",
          "c": "Bell-shaped body that rings when it lands, flat polished base"
        }
      },
      "epic": {
        "id": "metal_epic_brom",
        "name": "Shieldwright Brom",
        "epithet": "The wall that polishes itself",
        "bio": "Brom was the doorstop of the Ironmere Foundries until a hard-realm raid came through the gate. It rolled into the doorway and stayed there, reflecting every bolt back out. The foundry workers made it a shield and it has never stopped polishing it.",
        "role": "Reflect / Armor",
        "signature": {
          "name": "Polished Wall",
          "text": "Shields allies and reflects part of the next hit back.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "the left arm flattens into a round mirror buckler wider than the body.",
          "ornaments": "a riveted visor band across the top of the head; a polishing rag tucked into a rivet.",
          "gel": "mercury-like mirror gel; the buckler is the most reflective surface.",
          "eyes": "polished bead eyes peeking under the visor band; flat blunt gel brow.",
          "idle": "buffs the buckler in small circles with the other arm, then a slow heavy settle."
        }
      },
      "legendary": {
        "id": "metal_leg_smith_echo",
        "name": "Smith-Echo Korr",
        "title": "Legendary Chromeblob",
        "epithet": "The anvil that walked home",
        "bio": "Korr was an anvil blessed by a soft-blooded smith. When the smith died, the anvil stood up and finished the unfinished swords, then walked them to the Haven armory. Legendary Metal gel that rings with Korr answers every hit with craft and scrap.",
        "role": null,
        "signature": {
          "name": "Finish the Work",
          "text": "Gives allies armor and reflects part of the damage they take.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "Anvil-shaped torso: broad flat shoulders with a horn jutting forward",
          "ornaments": "A bundle of unfinished sword blanks strapped to the back; mercury drips",
          "eyes": "Polished bead eyes with gold irises, rune stamps",
          "idle": "Hammers a blank on its own shoulder; ringing tone"
        }
      },
      "mythic": {
        "id": "metal_myth_crown_was",
        "name": "Crown-That-Was-Tools",
        "title": "Mythic Chromeblob",
        "epithet": "Labor crowned itself",
        "bio": "Workers melted their tools into a crown for a soft queen who never asked for one. The crown walked away as Mythic Metal gel. Shape-Bound, it reflects armies and builds Havens out of scrap and spiteful excellence.",
        "role": null,
        "signature": {
          "name": "Spiteful Excellence",
          "text": "Reflects damage for the whole party.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A tall crown built from fused hammer heads, tongs, and wrenches",
          "ornaments": "A mercury mantle; fingers ending in small tool shapes",
          "eyes": "Gold irises, rivet runes",
          "idle": "Crown pieces rotate and click like gears"
        }
      }
    },
    "Poison": {
      "species": {
        "lineage": "Venomgloop",
        "variants": {
          "a": "Murky dome with rising bubbles and a drip at the base",
          "b": "Lopsided body with a mushroom cap of gel and spore motes",
          "c": "Tall bubbling blob with a sickly glow and a pop-bubble on top every few beats"
        }
      },
      "epic": {
        "id": "poison_epic_gallwort",
        "name": "Madam Gallwort",
        "epithet": "Hostess of the last-course cordial",
        "bio": "Madam Gallwort runs a teahouse in Witch's Hollow, where Shadowfen secrets are traded for venom. When a hard-realm quartermaster tried to buy the Hollow, she served him tea. He left feeling fine. He is not fine.",
        "role": "DoT / Weaken",
        "signature": {
          "name": "Second Cup",
          "text": "Poison that gets stronger each turn the foe keeps it.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "squat teapot body with a lid cap and knob on top, and the right arm curved into a pouring spout.",
          "ornaments": "a green-stained lace doily collar; herb sachets hanging from the lid rim.",
          "gel": "murky green gel with bubbles rising and popping at the lid.",
          "eyes": "a cluster of five small eyes arranged like tea leaves; a tiny arched gel brow over the cluster.",
          "idle": "tips forward and pours one drip from the spout; the body gurgles."
        }
      },
      "legendary": {
        "id": "poison_leg_apothecary_mire",
        "name": "Apothecary Mire",
        "title": "Legendary Venomgloop",
        "epithet": "Dose carefully, win completely",
        "bio": "Mire cured a plague by becoming the plague first — tasting every toxin until the cure was obvious. The village built a shrine and a quarantine. Both are still used. Legendary Poison champions of Mire end long fights three turns after the foe feels fine.",
        "role": null,
        "signature": {
          "name": "Tasted Every Toxin",
          "text": "Stacking poison that bursts after a delay.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "A tall tower of corked vials stacked on the head like a hat",
          "ornaments": "Vial bandolier; murky bubbling gel, each vial a different sickly tint",
          "eyes": "Several small glowing eyes, some behind tiny spectacles",
          "idle": "Uncorks a vial, sniffs, grimaces, re-corks"
        }
      },
      "mythic": {
        "id": "poison_myth_cure_wore",
        "name": "Cure-That-Wore-Fangs",
        "title": "Mythic Venomgloop",
        "epithet": "Medicine with a sense of humor",
        "bio": "The first cure for hard-shard fever was also a venom. Mythic Poison gel remembers both truths. Shape-Bound, it doses the battlefield until only the Haven's side can stand the aftertaste.",
        "role": null,
        "signature": {
          "name": "Aftertaste",
          "text": "Poisons all foes and heals allies by part of the poison damage.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A cobra-hood collar rising behind the head with two long fang drips",
          "ornaments": "A medicine spoon in one hand; murky gel with bubbles and a two-tone (cure green, venom purple) swirl",
          "eyes": "Several small eyes set in the hood",
          "idle": "Offers the spoon; the fangs drip; bubbles rise"
        }
      }
    },
    "Crystal": {
      "species": {
        "lineage": "Prismheart",
        "variants": {
          "a": "Clear body with one large facet crystal inside refracting color",
          "b": "Clear body with a crystal cluster growing out of the top",
          "c": "Round body with a ring of small crystals suspended like a belt"
        }
      },
      "epic": {
        "id": "crystal_epic_tamsin",
        "name": "Geode-Scholar Tamsin",
        "epithet": "Who cracked herself open to read the mountain",
        "bio": "In the mirror-caves of the Crystal Mountains, Tamsin split her own crust to show Keepers the prism-memory inside, the map of where the Gel froze mid-song. She keeps the crack open now. Mountain children play catch with her and lose.",
        "role": "Hybrid mage",
        "signature": {
          "name": "Split Reading",
          "text": "Hits one foe with an element matched to its weakness.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "a rough dark rock crust shell covering the back half, split open at the front to reveal an amethyst crystal cluster.",
          "ornaments": "a tiny chalk-white scholar's tassel hanging from the crust edge.",
          "gel": "clear gel inside the crust with faceted crystals; the crust is matte rock, the gel stays wet.",
          "eyes": "facets inside the crystal cluster (per the Crystal rule), with a crust-edge brow.",
          "idle": "the crust halves close slightly and reopen like breathing; faint chime on each open."
        }
      },
      "legendary": {
        "id": "crystal_leg_mirror_saint",
        "name": "Mirror-Saint Lira",
        "title": "Legendary Prismheart",
        "epithet": "Who showed the Void its own face",
        "bio": "Lira reflected a Void rift so the rift saw itself and flinched. The flinch lasted long enough for a Haven to evacuate. Crystal Mountains still hold a festival of broken mirrors in her honor. Legendary Crystal gel that carries Lira refracts every element into a sentence the foe cannot finish.",
        "role": null,
        "signature": {
          "name": "Show It Its Face",
          "text": "Reflects the foe's next skill back at it.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "A wheel of broken mirror shards floating behind the head",
          "ornaments": "Clear gel with facet crystals; a shard pendant at the chest",
          "eyes": "Facet eyes with a rune ring cut into the facets",
          "idle": "The shard wheel rotates and catches light in flashes"
        }
      },
      "mythic": {
        "id": "crystal_myth_prism_unwritten",
        "name": "Prism-of-Unwritten-Maps",
        "title": "Mythic Prismheart",
        "epithet": "Cartography of possibility",
        "bio": "A crystal that showed maps of Havens that did not exist yet. Those Havens were built. Mythic Crystal gel is that crystal, still projecting futures. Shape-Bound, it turns elements into options.",
        "role": null,
        "signature": {
          "name": "Unwritten Route",
          "text": "Changes her element to one that beats the target, then strikes.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A cape of faceted crystal panels projecting map lines onto the floor",
          "ornaments": "Clear gel with internal facets; a map-light projection on the arena floor",
          "eyes": "Facet eyes with projected rune lines",
          "idle": "The projected map shifts and redraws around her feet"
        }
      }
    },
    "Lava": {
      "species": {
        "lineage": "Magmacore",
        "variants": {
          "a": "Glowing core with dark crust patches, sagging viscously",
          "b": "Crust-heavy dome with glowing cracks and one smoke vent on top",
          "c": "Low spread body with a molten drip lip, cooled glass pebbles at the base"
        }
      },
      "epic": {
        "id": "lava_epic_murrow",
        "name": "Dozing-Vent Murrow",
        "epithet": "Who napped through three eruptions and woke up for the fourth",
        "bio": "Murrow slept at the foot of Ember Peak for most of the Second Age. When hard-realm drakes nested on the Volcanic Wastes road, Murrow finally woke, yawned, and the road was clear. Keepers let it sleep between fights.",
        "role": "Heavy AoE",
        "signature": {
          "name": "Rude Awakening",
          "text": "AoE eruption that hits harder the longer Murrow has waited.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "a huge hunched basalt crust hump on the back, like a sleeping turtle shell, with glowing cracks.",
          "ornaments": "a floppy nightcap of cooled pumice with a drip tassel.",
          "gel": "thick glowing core, dark crust patches; molten drips sag from the hump edge.",
          "eyes": "half-lidded sleepy ember-glow eyes, droopy gel brow.",
          "idle": "slow snore: the hump cracks glow brighter on each inhale and dim on exhale."
        }
      },
      "legendary": {
        "id": "lava_leg_glassroad_ember",
        "name": "Glassroad Ember",
        "title": "Legendary Magmacore",
        "epithet": "Who paved a retreat in fireglass",
        "bio": "When a Haven fled a hard army, Ember laid a road of cooling glass behind them — smooth for bare feet, murder for iron boots. The road is still too hot for horses. Legendary Lava champions of Ember turn arenas into calderas of second chances.",
        "role": null,
        "signature": {
          "name": "Retreat Paved",
          "text": "AoE burn that also speeds up allies.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "A long glass train spreading behind her on the ground like a road",
          "ornaments": "Dark crust pauldrons; glowing core; the train cools from orange to black toward the tail",
          "eyes": "Ember irises, glass-crack runes",
          "idle": "The train crackles and cools, then glows again from the waist"
        }
      },
      "mythic": {
        "id": "lava_myth_hearth_deep",
        "name": "Hearth-of-the-Deep-Fault",
        "title": "Mythic Magmacore",
        "epithet": "Anger that warms the village",
        "bio": "Deep faults dream of surface kitchens. Mythic Lava gel is a fault that learned hospitality. Shape-Bound, its eruption clears invaders and leaves glass roads home.",
        "role": null,
        "signature": {
          "name": "Glass Road Home",
          "text": "Big AoE eruption that shields allies after.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "The chest opens into a hearth arch with a glowing cooking pot inside",
          "ornaments": "A crust apron; a ladle in hand; glass pebble drips at the hem",
          "eyes": "Warm ember irises, hearth runes",
          "idle": "Stirs the pot in its chest with the ladle; sparks rise"
        }
      }
    },
    "Storm": {
      "species": {
        "lineage": "Tempestorb",
        "variants": {
          "a": "Dark blue-grey orb with a swirling cloud inside",
          "b": "Orb with a tiny lightning cloud floating above like a hat",
          "c": "Squashed body with a rain-streak skirt that drips upward then falls"
        }
      },
      "epic": {
        "id": "storm_epic_odile",
        "name": "Weathervane Odile",
        "epithet": "Who turned when the sky lied",
        "bio": "Odile was the vane on a Stormmarch Ridges watchtower. When the Storm Sovereign's front bore down, the sky pointed one way and Odile turned the other, and the hamlets followed her to the calm side. She has been dramatic about it ever since.",
        "role": "Weather control",
        "signature": {
          "name": "Turn the Wind",
          "text": "Swaps the turn order of one ally and one foe.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "a tall arrow weathervane spike rising from the head that spins.",
          "ornaments": "small cloud-puff epaulettes on both shoulders; a compass-letter band (N, E, S, W) around the spike base.",
          "gel": "dark blue-grey gel with a swirling cloud turning in the same direction as the vane.",
          "eyes": "brooding, heavy dramatic gel brow.",
          "idle": "the vane spins, stops, reverses; the body sulks with a turbulent shiver."
        }
      },
      "legendary": {
        "id": "storm_leg_captain_squall",
        "name": "Captain Squall",
        "title": "Legendary Tempestorb",
        "epithet": "Fleet without ships",
        "bio": "Squall herded fishing boats through a siege fog by becoming the wind that knew the reefs. Sailors toast \"the Captain\" even inland. Legendary Storm gel that remembers Squall sets the tempo of waves and the mood of skies.",
        "role": null,
        "signature": {
          "name": "Knows the Reefs",
          "text": "Raises allies' turn meters and lowers foes'.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "Storm-cloud tricorn hat and a billowing cloud greatcoat",
          "ornaments": "Lightning trim on the hat brim; swirling cloud gel inside the coat",
          "eyes": "Dramatic glowing irises, compass runes",
          "idle": "Hand to brow, scanning the horizon; coat billows"
        }
      },
      "mythic": {
        "id": "storm_myth_parliament_clouds",
        "name": "Parliament-of-Clouds",
        "title": "Mythic Tempestorb",
        "epithet": "Weather with a constitution",
        "bio": "Clouds once held council and elected a voice. Mythic Storm gel is the gavel. Shape-Bound, it legislates tempo: when the party moves, when the foe waits, when the sky agrees.",
        "role": null,
        "signature": {
          "name": "Motion Carried",
          "text": "Sets the turn order for the next round.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A council of cloud puffs seated along the shoulders, each with tiny eyes",
          "ornaments": "A rolled-lightning scepter; swirling cloud gel in the torso",
          "eyes": "Dramatic glowing irises; the cloud puffs have small eyes",
          "idle": "The cloud puffs bob in turn as if murmuring, then flash together to \"vote\""
        }
      }
    },
    "Spirit": {
      "species": {
        "lineage": "Wispling",
        "variants": {
          "a": "Ghostly drop fading to transparent at the edges, slow bob",
          "b": "Taller wisp with a flame-like trailing tail instead of a base",
          "c": "Round body with two faint arm-wisps and a soft inner glow"
        }
      },
      "epic": {
        "id": "spirit_epic_ilse",
        "name": "Moth-Widow Ilse",
        "epithet": "Who carries the names so nobody has to",
        "bio": "Ilse walks the grave-glades of the spirit roads, collecting the names of champions who melted in the Age of Cracks. She pins each name to her wings so no Keeper has to carry it alone. Wisplings follow her like moths to a lamp.",
        "role": "Revive / Utility",
        "signature": {
          "name": "Pinned Name",
          "text": "Revives a fallen ally with part of its health.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "two broad drooping moth-wing lobes of translucent gel from the back.",
          "ornaments": "small paper-slip name tags pinned along the wing edges; pressed-flower pins.",
          "gel": "ghostly gel with soft glow that fades to transparent at wing edges.",
          "eyes": "glowing slits (Spirit exception); soft sad gel brow.",
          "idle": "slow hovering bob; the wings fold and unfold once per bob."
        }
      },
      "legendary": {
        "id": "spirit_leg_lantern_walker",
        "name": "Lantern-Walker Ashen",
        "title": "Legendary Wispling",
        "epithet": "Guide of the unmelted",
        "bio": "Ashen walks spirit roads with a lantern made of memory. Champions who melted in old wars sometimes follow the light back into useful dreams. Keepers who bond Legendary Spirit gel sleep better — and wake with advice they did not ask for.",
        "role": null,
        "signature": {
          "name": "Walk Them Home",
          "text": "Revives a fallen ally.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "A tall shepherd's crook staff with a hanging lantern",
          "ornaments": "Faint gel faces inside the lantern glass; hooded robe fading at the hem",
          "eyes": "Glowing slits, soft rune ring",
          "idle": "The lantern swings; faint wisps follow its light"
        }
      },
      "mythic": {
        "id": "spirit_myth_choir_unmelted",
        "name": "Choir-of-the-Unmelted",
        "title": "Mythic Wispling",
        "epithet": "Every soft death that stayed helpful",
        "bio": "Not every melted champion is gone. Mythic Spirit gel is a choir of their unfinished kindness. Shape-Bound, it guides, revives will, and reminds Keepers why the work is worth the quiet hours.",
        "role": null,
        "signature": {
          "name": "Unfinished Kindness",
          "text": "Revives all fallen allies with part of their health.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A robe hem that splits into many trailing wisp tails",
          "ornaments": "Faint gel faces rising and sinking inside the robe; hands open",
          "eyes": "Glowing slits, choir runes",
          "idle": "The faces rise and sink as if singing; the tails sway"
        }
      }
    },
    "Void": {
      "species": {
        "lineage": "Riftgel",
        "variants": {
          "a": "Near-black drop with a starfield inside",
          "b": "Irregular body whose outline slowly shifts between rounded shapes",
          "c": "Drop with a small dark ring orbiting it and a starfield swirl"
        }
      },
      "epic": {
        "id": "void_epic_lost_and_found",
        "name": "The Lost-and-Found",
        "epithet": "Everything it swallows, it returns (eventually)",
        "bio": "In the Voidmarch Marches, things fall into cracks: keys, spoons, whole afternoons. One Riftgel started giving them back, a little late and slightly wrong. Havens near the Marches now keep a shelf for what it returns.",
        "role": "Anti-everything",
        "signature": {
          "name": "Returned Wrong",
          "text": "Steals one buff from a foe and later gives it to an ally.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "morph",
          "hook": "a tall question-mark shaped stalk curling up from the head, with lost objects (key, spoon, button) orbiting the body.",
          "ornaments": "a paper claim-ticket stuck to the side; the orbiting objects are simple low-poly props.",
          "gel": "near-black gel with a starfield inside; the objects drift in and out of the starfield.",
          "eyes": "one big eye (Void exception) with a curious gel brow.",
          "idle": "slow pulse; spits out one object, looks at it, reabsorbs it."
        }
      },
      "legendary": {
        "id": "void_leg_negotiated_hole",
        "name": "The Negotiated Hole",
        "title": "Legendary Riftgel",
        "epithet": "Unmaking on a leash of trust",
        "bio": "A Riftgel once agreed, in writing of absences, not to erase a Haven if the Haven fed it interesting rules to break elsewhere. The contract is kept in a box that is also a rumor. Legendary Void gel that carries the Hole is loyal in a way that scares theologians and delights tacticians.",
        "role": null,
        "signature": {
          "name": "Terms and Conditions",
          "text": "Erases a foe's buffs and passive for a while.",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "ascended",
          "hook": "A clean circular hole through the chest, edged with a gold contract-seal ring",
          "ornaments": "A leash of script links hanging from the ring; starfield gel",
          "eyes": "One big eye above the hole with a seal rune ring",
          "idle": "The hole slowly dilates and contracts; a blank scroll unrolls from it"
        }
      },
      "mythic": {
        "id": "void_myth_exception",
        "name": "The Exception",
        "title": "Mythic Riftgel",
        "epithet": "Unmaking that made an exception for you",
        "bio": "The Void does not grant exceptions. Mythic Void gel is the exception anyway — a hole that decided a Haven was interesting enough to spare. Shape-Bound, The Exception erases enemy rules while carefully not erasing the map that feeds it stories. Bonding it is the riskiest kindness in the Softened Realms.",
        "role": null,
        "signature": {
          "name": "Rule Erased",
          "text": "Removes one foe rule (passive, immunity, or shield).",
          "slot": null,
          "stub": true
        },
        "look": {
          "body": "humanoid",
          "hook": "A glowing-edged accretion-disk collar worn around the shoulders",
          "ornaments": "Hands cupped around a tiny glowing Haven orb; starfield gel body",
          "eyes": "One big eye in the face, the disk edge as a rune ring",
          "idle": "The disk slowly rotates; the hands shelter the orb"
        }
      }
    }
  };

  var RARITY_KEY = { Epic: 'epic', Legendary: 'legendary', Mythic: 'mythic' };
  var BY_ID = {};
  ELEMENT_ORDER.forEach(function (el) {
    ['epic', 'legendary', 'mythic'].forEach(function (k) {
      var h = HERO_ROSTER[el][k];
      h.element = el;
      h.rarity = k.charAt(0).toUpperCase() + k.slice(1);
      BY_ID[h.id] = h;
    });
  });

  function normEl(element) {
    var s = String(element || '');
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  /** Named hero for element × rarity, or null for Common/Uncommon/Rare. */
  function getNamedHero(element, rarity) {
    if (HERO_ROSTER_CONFIG.namedRarities.indexOf(rarity) < 0) return null;
    var row = HERO_ROSTER[normEl(element)];
    return row ? row[RARITY_KEY[rarity]] || null : null;
  }

  function getHeroById(id) { return (id && BY_ID[id]) || null; }

  function getLineage(element) {
    var row = HERO_ROSTER[normEl(element)];
    return row ? row.species : null;
  }

  /** Species variant look for a/b/c (null for unknown). */
  function getSpeciesVariant(element, variant) {
    var sp = getLineage(element);
    return sp ? sp.variants[String(variant || 'a').toLowerCase()] || null : null;
  }

  /** All named heroes (48), optionally filtered by rarity. */
  function listNamedHeroes(rarity) {
    return Object.keys(BY_ID).map(function (k) { return BY_ID[k]; })
      .filter(function (h) { return !rarity || h.rarity === rarity; });
  }

  /** Does this roster already own the named hero? */
  function findOwnedNamedHero(roster, heroId) {
    if (!heroId || !Array.isArray(roster)) return null;
    for (var i = 0; i < roster.length; i++) if (roster[i] && roster[i].heroId === heroId) return roster[i];
    return null;
  }

  /**
   * The one hook for duplicate named pulls. Called by performSummon when a pull
   * resolves to a named hero the player already owns.
   * Returns { keep: boolean, converted: {currency, amount} | null }.
   * Placeholder policy 'shards': do not add the copy; grant duplicateShardValue
   * (untuned, 0 by default) and count the dupe on the owned unit.
   */
  function onDuplicateNamedHero(state, pulled, owned) {
    var cfg = HERO_ROSTER_CONFIG;
    if (cfg.duplicatePolicy === 'keep') return { keep: true, converted: null };
    var amount = (cfg.duplicateShardValue && cfg.duplicateShardValue[pulled.rarity]) || 0;
    var cur = cfg.duplicateShardCurrency;
    if (state && state.resources && amount) state.resources[cur] = (state.resources[cur] || 0) + amount;
    if (owned) owned.namedDupes = (owned.namedDupes || 0) + 1;
    return { keep: false, converted: { currency: cur, amount: amount } };
  }

  var API = {
    HERO_ROSTER_CONFIG: HERO_ROSTER_CONFIG,
    HERO_ROSTER: HERO_ROSTER,
    CODEX_LINEAGES: CODEX_LINEAGES,
    ELEMENT_ORDER: ELEMENT_ORDER,
    getNamedHero: getNamedHero,
    getHeroById: getHeroById,
    getLineage: getLineage,
    getSpeciesVariant: getSpeciesVariant,
    listNamedHeroes: listNamedHeroes,
    findOwnedNamedHero: findOwnedNamedHero,
    onDuplicateNamedHero: onDuplicateNamedHero
  };

  global.SR_HERO_ROSTER = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : global);
