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

## Ultimate — **Command: Pull**

**Id:** `pendula-command-shockwave` (stable id; presentation name is Pull)  
**Cooldown:** 7500 ms  
**Channel:** **300 ms** wind-up (3× faster than the old 900 ms). **Release does not cancel** — once started, the cast always completes.  
**Release:** instant **enemy yank** toward Pendula + inward visual ring (Orianna-style)

### Logic

1. **Activate** → `channeling`, face aim dir, freeze velocity, Ball charges.
2. Channel always runs to completion (tap is enough; hold not required).
3. **Fire** at end of channel:
   - Center = Pendula tile.
   - For every **living enemy** with Chebyshev distance ≤ **4** from center (farthest first):
     - **Yank** to best free landing tile on the adjacent ring (through walls OK; landing must be free of solid/crate/bomb/player).
     - Fallback: step one tile closer if no free landing on inner rings.
     - Instant reposition — snappy/OP.
   - Spawn inward cyan/brass ring visual (~280 ms).
4. Enter **cooldown**.

### Why it’s distinct

- Not a self-dash/blink (Bee / Nix / Ranni).
- Not a damage beam (Nico).
- Not personal immunity surge (Crocodilo).
- **Enemy displacement**: yanks opponents into Pendula’s space — classic Orianna “Ball owns the zone” fantasy.

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
