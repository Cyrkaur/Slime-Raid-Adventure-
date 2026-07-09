# Combat SFX pack (optional)

Drop short audio files here to replace procedural tones:

| File | When it plays |
|------|----------------|
| `hit.mp3` | Damage land |
| `crit.mp3` | Critical hit |
| `cast.mp3` | Skill wind-up |
| `ult.mp3` | Unique / AoE cast |
| `heal.mp3` | Healing |
| `shield.mp3` | Shield skills |
| `death.mp3` | Unit defeated |
| `victory.mp3` | Fight won |
| `defeat.mp3` | Fight lost |
| `whoosh.mp3` | Attack swing |

Also accepts `.ogg` / `.wav` if you change `tryPlayCombatSfxFile` sources.

If a file is missing, the game falls back to built-in Web Audio tones.

Mute in combat UI: **🔊 SFX** button (saved in `game.settings.sfx`).
