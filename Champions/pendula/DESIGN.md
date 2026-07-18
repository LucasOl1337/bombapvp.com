# Pendula — design (before art)

## Inspiration (LoL)

**Orianna, the Lady of Clockwork** — brass automaton ballerina + companion **Ball** that controls space rather than the body alone. Not a copy: bomb-arena translation.

## Identity

| Field | Value |
| --- | --- |
| Display name | **Pendula** |
| Slug | `pendula` |
| Accent | `gold` (brass / copper clockwork) |
| Personality | Precise, slightly uncanny doll-grace; the Ball is her “voice” |
| Visual hook | Porcelain-white and brass ballerina automaton; floating brass sphere; skirt of clock-hand plates; cyan-teal core light (Piltover/Zaun clockwork, not lava generic) |

## Existing ultimates (do not clone)

| Champion | Skill | Fantasy |
| --- | --- | --- |
| Ranni | Ice Blink | Phase / reposition + bomb egress |
| Killer Bee | Wing Dash | Linear dash |
| Nix Ember | Ember Vault | Short vault hop |
| Crocodilo | Emerald Surge | Channel immune + surge |
| Nico | Arcane Beam | Long-range line beam |

## Ultimate — **Command: Shockwave**

**Id:** `pendula-command-shockwave`  
**Cooldown:** 7500 ms  
**Channel:** 900 ms wind-up (cancel early → short CD 500 ms)  
**Release:** instant radial **bomb scatter** + visual ring

### Logic

1. **Activate** → `channeling`, face aim dir, freeze velocity, Ball “charges” at feet.
2. **Hold** until channel ends (or release at 0). No voluntary early fire required; full channel auto-fires.
3. **Fire** at end of channel:
   - Center = player tile.
   - For every bomb with Chebyshev distance ≤ **2** from center:
     - Push direction = unit vector away from center (cardinal preferred; if on center, use player facing).
     - Attempt move **1 tile** if free (not solid, not crate, not other bomb, not living player).
     - On success: `ownerCanPass = false`, clear body egress; optional tiny fuse penalty (−80 ms, floor 400).
   - Spawn world effect ring (visual only, ~320 ms).
4. Enter **cooldown**.

### Why it’s distinct

- Not a self-dash/blink (Bee / Nix / Ranni).
- Not a damage beam (Nico).
- Not personal immunity surge (Crocodilo).
- **Spatial bomb control**: rearranges the fuse puzzle for everyone — classic Orianna “Ball owns the zone” fantasy in bomb rules.

### Animation map

| Clip | Body language |
| --- | --- |
| idle | Ballerina stance, Ball bobbing near hip |
| walk | Precise doll steps; Ball trails slightly |
| cast | Conducting pose → Ball expands → shockwave pose |
| attack (plant) | Kneel / place gesture, Ball rises aside (no bomb in art) |

## Implementation notes

- Mutate `context.bombs[].tile` only after free-tile checks (mirror kick rules lightly).
- World effect type on `ChampionWorldEffect` union for ring draw.
- No engine hardcode of Pendula id outside Champions module.
