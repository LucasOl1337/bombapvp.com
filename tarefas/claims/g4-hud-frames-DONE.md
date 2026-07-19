# G4 DONE — HUD chrome frames (9-slice)

**Worker:** G4 (Grok Build subagent)  
**Scope:** `game-assets/ui/hud/frames/**` + catalog ids `ui.hud.frame.*` only  
**Not touched:** `game-app` layout, arena tiles, Champions, commit/push

## Deliverables

### PNGs (`game-assets/ui/hud/frames/`)

| File | Size | 9-slice margin | Catalog id |
| --- | --- | --- | --- |
| `frame-rival-normal.png` | 512×160 | 24px | `ui.hud.frame.rival.normal` |
| `frame-rival-dead.png` | 512×160 | 24px | `ui.hud.frame.rival.dead` |
| `frame-rival-ult-ready.png` | 512×160 | 24px | `ui.hud.frame.rival.ult-ready` |
| `frame-local-normal.png` | 512×384 | 32px | `ui.hud.frame.local.normal` |
| `frame-local-dead.png` | 512×384 | 32px | `ui.hud.frame.local.dead` |
| `frame-local-ult-ready.png` | 512×384 | 32px | `ui.hud.frame.local.ult-ready` |
| `frame-match-center.png` | 512×160 | 24px | `ui.hud.frame.match-center` |

**Skipped:** `frame-rival-self.png` (local panel owns player highlight).

### Docs / review

- `MANIFEST.md` — margins, palette, 9-slice guide, catalog map  
- `contact-sheet-hud-frames.png` — all 7 frames  
- `_gen_frames.py` — deterministic regen

### Catalog

Wired in `game-assets/catalog.ts` only (imports + `GAME_ASSET_CATALOG` entries for the 7 ids above).

## Style checklist (game-ui-icons + game-asset-core)

| Default | Status |
| --- | --- |
| Blank text-ready panels | pass |
| Ornament in corners only | pass (L-bracket + rivets) |
| Uniform edges for 9-slice | pass (continuous gold rail, solid metal, no mid-edge bolts) |
| No lettering | pass |
| Geometry-identical state variants | pass (alpha mask match verified) |
| Dark charcoal + warm gold (tournament) | pass — not full Citadel cyan |
| One chrome contract | pass |

### States

- **normal** — warm gold rails / rivet cores  
- **dead** — ash metal, muted bronze  
- **ult-ready** — brighter gold + corner spark + outer rim boost  

Same silhouette within each size class.

## G2 consume hint

```ts
resolveGameAsset("ui.hud.frame.local.normal")
// 9-slice margin: rival/match-center = 24; local = 32
```

Do not hardcode paths under `ui/hud/frames/`.

## Verification

- PNGs written RGBA at documented sizes  
- Geometry mask identical across rival states and local states  
- Catalog ids present and import paths resolve to files  
- Vitest not runnable in this worktree (`vitest` package missing) — no code layout change to break game-app  

## Defects / deviations

None flagged. Frames are procedural pixel-tech chrome (PIL) for exact 9-slice geometry rather than freeform Imagine output (which fails uniform-edge guarantees).
