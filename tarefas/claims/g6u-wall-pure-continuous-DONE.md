# G6u DONE — pure continuous wall (no perimeter rim / top lip)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets`

## Problem

G6k removed gold frames; G6n added masonry. Soft dark 4-edge rim + per-cell top lip still painted a sticker grid on multi-cell wall clusters (edge−inner mean ~46). Same class of defect as pre-G6t lanes.

## Fix

`game-assets/_work/g6u_wall_pure_continuous.py` rebuilt `wall.png` + `wall-alt.png`:

- Edge-to-edge charcoal running-bond masonry + grain (40px readable)
- **No** edge vignette, **no** BORDER/OUTER rectangle, **no** top lip, **no** bottom hairline
- **No** diagonal depth bias (would reintroduce tone checker when tiled)
- Softened mortar so courses read without hard lattice bars
- wallAlt: offset bond + brightness mean-match (G6p contract)

| Metric | Before | After |
| --- | --- | --- |
| wall edge−inner mean | ~46 | ~3.0 |
| wallAlt edge−inner mean | ~48 | ~1.6 |

Backup: `game-assets/_work/wip-backup-g6u/`

## Verify

- `_qa-wall-field.png` / `_preview40-wall-cluster.png`: continuous mass, soft courses only
- Live playtest `_playtest-training.png`: walls solid slabs; lanes/portals/crates intact
- game-assets vitest: **102 passed**

## Pack status (G6–G6u)

Main arena still **ready for owner commit** (no push without order).
