# G6y DONE — floor alt edge flatten (no cell-edge tone grid)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets`

## Problem

`floor-base-alt` / `floor-base-alt3` had brighter border rings (edge−inner ≈4.8–5.0 vs base ≈1.6). In the 4-way `(x+2y)%4` field this reintroduced a faint large-scale tone grid (game-tilesets §1).

## Fix

`game-assets/_work/g6y_floor_edge_flatten.py`:

| Asset | Change |
| --- | --- |
| `floor-base-alt.png` | Soft edge-band scale so border mean ≈ inner; re-mean-match to base |
| `floor-base-alt3.png` | Same |

| Metric | Before | After |
| --- | --- | --- |
| alt edge−inner | 4.79 | 0.59 |
| alt3 edge−inner | 4.95 | 0.51 |
| 4-way cell mean spread | ~0.57 | 0.57 |

Backup: `game-assets/_work/wip-backup-g6y/`

## Verify

- `_qa-floor-field-4way.png`: even tone, no edge ring grid  
- Live playtest: floor continuous; lanes/walls/crates/portals intact  
- game-assets vitest: **102 passed**

## Pack status (G6–G6y)

Main arena still **ready for owner commit** (no push without order).
