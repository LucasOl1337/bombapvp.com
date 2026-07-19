# G6d DONE — baseAlt checker + solid wall

**Status:** complete (workspace; no commit/push)

## What changed

### Assets (`tournament-clean`)
- `floor-base-alt.png` — second seamless cobble (seed 86), slightly darker for checker
- `wall.png` — solid charcoal slab, full 4-edge sand frame (reads at 40px; no empty picture-frame center)

### Engine
- `ArenaThemeTilePaths.baseAlt?: GameAssetId`
- `GameAssets.floor.baseAlt` load path
- Floor draw: `(x+y)%2` picks `baseAlt` when present
- Catalog id `arena.theme.tournament-clean.floor.base-alt`
- Tests updated (97 passed)

## Why
- Single-tile cobble still repeated the same stone map every cell → baseAlt checker breaks motif (game-tilesets variations).
- Prior wall looked like hollow frames in the border ring.

## Out of scope
- Other themes baseAlt, commit/push
