# G6l DONE — floor baseAlt mean-match (kill tone checkerboard)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

`floor-base-alt` was `Brightness(0.94)` of a different cobble → mean ~182 vs base ~194.  
In-engine `(x+y)%2` checker created a **light/dark checkerboard** (game-tilesets §1 fail: large-scale tone gradient).

## Fix

`game-assets/_work/g6l_floor_match_alt.py`:

| Asset | Change |
| --- | --- |
| `floor-base.png` | Finer toroidal cobble (~44 stones), softer grout, seed 45 |
| `floor-base-alt.png` | Different layout seed 87, **mean-matched** to base (delta ≈0.3) |
| `floor-lane.png` | Re-derived continuous cream lift (no sticker frame) |
| `floor-spawn.png` | Re-derived open gold ring |

Backup: `game-assets/_work/wip-backup-g6l/`

## Verify

- `_qa-floor-field.png`: even tone field, layout variation without brightness grid  
- Live `_playtest-training.png`: continuous lanes, solid walls, spawn pads, crates intact  
- game-assets vitest: **97 passed**

## Pack status (G6–G6l)

Main arena still **ready for owner commit** (no push without order).
