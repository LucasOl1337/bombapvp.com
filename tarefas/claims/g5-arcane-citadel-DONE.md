# G5 DONE — Arcane Citadel detail pass

**Worker:** G5 subagent  
**Status:** complete  
**Scope touched:** `game-assets/arenas/themes/arcane-citadel/**` only  
**Catalog / library / other themes / HUD:** not modified  
**Commit/push:** none

## What changed

In-place upgrade of the existing 128×128 `arcane-citadel` sprite pack with more stone craft while keeping the cool blue-gray / rune readability family.

| Asset | Before | After |
| --- | --- | --- |
| `floor-base.png` | Near-flat diagonal (~992 B) | Carved blue-gray cobblestone, tileable |
| `floor-lane.png` | Riveted cyan brick frame | Brighter citadel slabs + cyan-steel frame |
| `floor-spawn.png` | Rune ring on flat field | Same ring language on carved stone, open center |
| `wall.png` | Nested metal plate | Carved stone wall lip + geometric inner face |
| `crate.png` | Warm wood + black iron | Cooler gunmetal iron, grain detail, RGBA no shadow |

## Backup

`game-assets/arenas/themes/arcane-citadel/_legacy-before-g5/` holds pre-G5 originals.

## Seam checks

Mandatory 2×2 composites written next to tiles:

- `_seam-floor-base.png` — field tile; soft joins OK, no hard seam bar  
- `_seam-floor-lane.png` — frame grid intentional for path read  
- `_seam-floor-spawn.png` — motif tile (not field)  
- `_seam-wall.png` — wall block (not field)

## Catalog

No catalog change required — same paths:

- `arena.theme.arcane-citadel.floor.base` → `floor-base.png`
- `arena.theme.arcane-citadel.floor.lane` → `floor-lane.png`
- `arena.theme.arcane-citadel.floor.spawn` → `floor-spawn.png`
- `arena.theme.arcane-citadel.wall` → `wall.png`
- `arena.theme.arcane-citadel.crate` → `crate.png`

## Manifest

See `game-assets/arenas/themes/arcane-citadel/MANIFEST-g5.md`.

## Out of scope (respected)

- tournament-clean theme  
- HUD icons / frames / layout  
- renderMode of other themes  
- git commit / push  

## Ready for merge review

Orchestrator can overlay this worktree path into main after visual QA in-game (sprite mode already on for `arcane-citadel`).
