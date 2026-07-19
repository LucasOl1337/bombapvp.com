# G3 — HUD icons DONE

**Worker:** G3 subagent  
**Worktree:** `subagent-019f7ac7-82a3-7763-9639-6ee6968490b2`  
**Date:** 2026-07-19  
**No commit/push** (per contract).

## Delivered

### Icon files (`game-assets/ui/hud/icons/`)

| File | Size |
| --- | --- |
| `hud-icon-bomb.png` | 512² |
| `hud-icon-flame.png` | 512² |
| `hud-icon-speed.png` | 512² |
| `hud-icon-remote.png` | 512² |
| `hud-icon-shield.png` | 512² |
| `hud-icon-bomb-pass.png` | 512² |
| `hud-icon-kick.png` | 512² |
| `hud-icon-short-fuse.png` | 512² |
| `hud-icon-ult-ready.png` | 512² |
| `hud-icon-alive.png` | 512² |
| `hud-icon-dead.png` | 512² |
| `_hud-icons-sheet.png` | contact sheet |
| `MANIFEST.md` | style + id map |

### Catalog ids (`game-assets/catalog.ts`)

- `ui.hud.icon.bomb`
- `ui.hud.icon.flame`
- `ui.hud.icon.speed`
- `ui.hud.icon.remote`
- `ui.hud.icon.shield`
- `ui.hud.icon.bomb-pass`
- `ui.hud.icon.kick`
- `ui.hud.icon.short-fuse`
- `ui.hud.icon.ult-ready`
- `ui.hud.icon.alive`
- `ui.hud.icon.dead`

Existing ids untouched. World drop icons (`gameplay.power-up.*`) unchanged.

### Tests

- Extended `tests/game-assets.test.ts` resolve table + dedicated HUD icon size/path check.

## Style contract (one set)

- Warm tournament pixel emblems
- Shared charcoal **hex** bezel + **gold** rivets/rim
- Pure black keyable field
- Solid filled motifs; no lettering
- Edit-chained from bomb anchor for geometry cohesion
- Target legibility: 32px HUD slots

## Not touched (ownership)

- G2: `game-app` HUD layout / draw paths
- G1/G5: arena tiles
- G4: HUD frames
- Champions private art

## Wire later (G2 / integrator)

`resolveGameAsset("ui.hud.icon.*")` ready for local panel power-up strip, skill ready badge, rival alive/dead status.

## Defects / notes

- Alive icon uses soft green outer corona (status emphasis); still same hex geometry.
- Bomb-pass intentionally uses cyan/magenta phase language (identity accent) inside gold bezel.
- Source gens were JPG; masters delivered as 512 PNG LANCZOS (not true pixel-grid upsample — silhouette holds at 32px).
