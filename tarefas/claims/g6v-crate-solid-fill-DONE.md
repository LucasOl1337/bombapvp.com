# G6v DONE — crate solid cell fill (pad 7→3)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

G6r left opaque pad≈7 / fill≈0.77 after aggressive soft_rim. Multi-crate fields showed cream floor seams between breakables (sticker grid at TILE_SIZE=40).

## Fix

`game-assets/_work/g6v_crate_solid_fill.py`:

| Asset | Change |
| --- | --- |
| `crate.png` | Expand body to pad=1, 1px edge feather → opaque pad≈3, fill≈0.85 |
| `crate-alt.png` | Re-derived micro-tint; tight mean-match |
| `crate-break-{0..3}.png` | Same expand so destroy FX matches intact size |

Corners α=0 kept. Soft rim only clears edge 0 and half-feathers edge 1 (no deep alpha eat).

Backup: `game-assets/_work/wip-backup-g6v/`

## Verify

| Metric | Before | After |
| --- | --- | --- |
| opaque pad (α>200) | ≈7 | ≈3 |
| fill α>200 | 0.77 | 0.85 |
| mean opaque crate/alt | — | 76.0 / 75.6 |

- Live playtest: crates solidly occupy cells; walls/lanes/portals intact  
- game-assets vitest: **102 passed**

## Pack status (G6–G6v)

Main arena still **ready for owner commit** (no push without order).
