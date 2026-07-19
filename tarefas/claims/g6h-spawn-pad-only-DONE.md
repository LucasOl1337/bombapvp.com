# G6h DONE — spawn pad-only rings (fix polka-dots)

**Status:** complete (workspace; no commit/push)

## Problem (from G6g playtest)

Spawn floor sprite was painted on entire 3×3 corner bays → up to 36 gold rings on board.

## Fix

1. **Engine** (`game-app.ts`): `isSpawnPad` = exact tiles from `arena.config.spawnMap` only (not full bay).
2. **Asset** (`floor-spawn.png`): softer translucent gold ring (still readable on the 4 pads).

## Verify

- Playwright re-shot: `_playtest-training.png` — ~4 rings (one per spawn), clean cobble field  
- game-assets tests: **98 passed**

## Out of scope

commit/push
