# G6x DONE — crate outer rim lift (no dark frame grid)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

G6w full-bleed pushed the painted dark iron outer frame to the cell edge. Multi-crate fields met dark+dark frames → heavy sticker grid. Iron cross-bands (identity) were fine; the outer rectangle was not.

## Fix

`game-assets/_work/g6x_crate_rim_lift.py`:

| Asset | Change |
| --- | --- |
| `crate.png` | Lift outer rim (≤6px) toward wood; preserve iron cross + mid-side plates |
| `crate-alt.png` | Re-derived micro-tint; mean-matched |
| `crate-break-{0..3}.png` | Same rim lift |

Corners α=0 kept. Full-bleed fill retained.

| Metric | Before | After |
| --- | --- | --- |
| edge0 luminance | 40.5 | 88.2 |
| inner opaque mean | ~75 | ~76 |

Backup: `game-assets/_work/wip-backup-g6x/`

## Verify

- `_qa-crate-field.png`: wood joins without near-black frame bars  
- Live playtest: crates full cells, softer perimeter; walls/lanes/portals intact  
- game-assets vitest: **102 passed**

## Pack status (G6–G6x)

Main arena still **ready for owner commit** (no push without order).
