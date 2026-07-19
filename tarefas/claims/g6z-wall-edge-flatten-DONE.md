# G6z DONE — wall / wallAlt edge flatten (shared face mean)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets`

## Problem

Post-G6u continuous walls still had opposite edge bias:
- `wall` edge L≈60.8 (brighter than inner)
- `wall-alt` edge L≈57.9 (darker than inner)

Checker `(x+y)%2` then painted a light/dark join lattice (field join |L39−L40| ≈6.9).

## Fix

`game-assets/_work/g6z_wall_edge_flatten.py`:

| Asset | Change |
| --- | --- |
| `wall.png` | Soft edge-band scale to shared face L; global mean-match |
| `wall-alt.png` | Same |

Interior masonry courses kept.

| Metric | Before | After |
| --- | --- | --- |
| wall edge−inner | 2.95 | 1.05 |
| wallAlt edge−inner | 1.60 | 1.52 |
| field join \|L39−L40\| | 6.89 | 2.44 |

Backup: `game-assets/_work/wip-backup-g6z/`

## Verify

- `_qa-wall-field.png` / cluster: continuous mass, soft courses  
- Live playtest: walls solid slabs; floors/lanes/crates/portals intact  
- game-assets vitest: **102 passed**

## Pack status (G6–G6z)

Main arena still **ready for owner commit** (no push without order).
