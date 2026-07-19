# G6g DONE — live Playwright playtest (training + tournament-clean)

**Status:** complete (workspace; no commit/push)

## Method

- Vite: `http://127.0.0.1:4173`
- URL: `/arena/?mode=training&arenaTheme=tournament-clean`
- Tool: Playwright Chromium headless
- Artifact: `game-assets/arenas/themes/tournament-clean/_playtest-training.png`

## Visual findings (pass)

| Check | Result |
| --- | --- |
| Cobble floor at TILE_SIZE=40 | Readable stone craft, no flat beige void |
| baseAlt checker | Subtle field variation |
| Top-down crates | Clear wood lids, no isometric, no black square |
| Walls | Dark framed blocks, strong silhouette vs floor |
| Lanes | Slightly brighter cream routes |
| Spawn rings | Visible gold circles in corner bays |
| Characters / HUD / bombs | Composite cleanly over tiles |
| Page errors | None logged during capture |

## Notes (non-blocking)

- Spawn bays are 3×3 tiles so corner zones show multiple rings (engine layout, not tile defect).
- Crate break frames still use shared `gameplay.crate.break.*` (acceptable; style close enough).

## Conclusion

**Tournament-clean sprite pack G6–G6g is playtest-green for training mode.** Ready for owner commit when ordered.
