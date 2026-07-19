# Match HUD kit v2 — night + ember (readable at 40–52px strip heights)

## Contract
- Night fill `#0a0a0f` / `#121219`
- Ember accent `#ff5a1f`
- Modern flat esports chrome (not pixel-citadel, not mint cyan)
- **No lettering** in PNGs — game draws text
- World bomb/crate/tiles **not** part of this kit

## Chrome
| File | Catalog id | Role |
| --- | --- | --- |
| `panel-local-v1.png` | `ui.hud.chrome.local` | Local YOU strip |
| `panel-rival-v1.png` | `ui.hud.chrome.rival` | Rival compact slot |
| `panel-center-v1.png` | `ui.hud.chrome.center` | Timer / meta badge |
| `chip-ult-v1.png` | `ui.hud.chrome.ult` | ULT chip + pause chip fallback |

## Icons (`../icons/`)
| File | Catalog id |
| --- | --- |
| `icon-bomb-v1.png` | `ui.hud.icon.bomb` |
| `icon-flame-v1.png` | `ui.hud.icon.flame` |
| `icon-speed-v1.png` | `ui.hud.icon.speed` |

## Draw path
`src/original-game/Engine/game-app.ts` — `drawHudPanel` / skill slots / ULT / overlays.
Fallback to fillRect if images fail to load.
