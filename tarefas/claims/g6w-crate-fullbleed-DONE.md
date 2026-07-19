# G6w DONE — crate full-bleed cell fill

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

G6v soft_rim zeroed the full outer ring (edge α=0). At TILE_SIZE=40 multi-crate fields still showed cream floor hairlines between breakables.

## Fix

`game-assets/_work/g6w_crate_fullbleed.py`:

| Asset | Change |
| --- | --- |
| `crate.png` | Crop solid body (α>200), scale to 128×128, force α=255, corners α=0 only |
| `crate-alt.png` | Re-derived micro-tint; mean-matched |
| `crate-break-{0..3}.png` | Same full-bleed so destroy FX matches |

Silhouette stays via painted iron rim (not empty pad).

| Metric | Before (G6v) | After |
| --- | --- | --- |
| opaque pad | ≈3 | 0 |
| fill α>200 | 0.85 | 1.00 |
| pair join RGB (on black) | ~0 (gap) | wood ~68–94 |

Backup: `game-assets/_work/wip-backup-g6w/`

## Verify

- `_qa-crate-field.png`: solid wood mass, no cream seams  
- Live playtest: crates full cells; walls/lanes/portals intact  
- game-assets vitest: **102 passed**

## Pack status (G6–G6w)

Main arena still **ready for owner commit** (no push without order).
