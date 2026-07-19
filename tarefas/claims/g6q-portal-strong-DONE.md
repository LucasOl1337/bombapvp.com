# G6q DONE — stronger portal dashed ring @40px

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

G6m portal dashes were too faint at mid-edges (incomplete parentheses). Wrap gates hard to read vs spawn pads.

## Fix

`floor-portal.png` regenerated (`game-assets/_work/g6q_portal_strong.py`):

- Longer thicker gold dashes (outer + inner echo rings)
- Clear N/E/S/W gaps — still open gate language, not solid spawn ring
- Small radial ticks for extra 40px read
- Backup: `game-assets/_work/wip-backup-g6q/`

## Verify

- `_qa-spawn-portal-lane40.png`: spawn = solid ring · portal = double dashed · lane = plain cream  
- Live playtest: 4 edge portals clearly dashed; spawn pads solid; rest of pack intact  
- game-assets vitest: **100 passed**

## Pack status (G6–G6q)

Main arena still **ready for owner commit** (no push without order).
