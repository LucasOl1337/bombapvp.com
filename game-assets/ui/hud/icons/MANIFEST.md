# HUD icons — match UI set (G3)

## Style contract

- High-detail **pixel art** tournament HUD emblem
- Pure **black** background (keyable)
- Shared **charcoal hex mechanical bezel** with **gold rivets** + gold rim
- Warm **gold / amber** accents (tournament premium); identity accents allowed (lime speed, magenta fuse, cyan/purple phase)
- **Solid filled** motifs, consistent stroke weight, uniform padding
- Readable at **32px** HUD slot size
- **No text / letters**

Distinct from world **power-up drop icons** (`gameplay/power-ups/icons/`, cyan-heavy Citadel family). These are HUD-slot icons for match panels (local power-up strip, skill ready, alive/dead).

## Catalog ids → files

| GameAssetId | File | Motif |
| --- | --- | --- |
| `ui.hud.icon.bomb` | `hud-icon-bomb.png` | Black bomb + amber fuse spark |
| `ui.hud.icon.flame` | `hud-icon-flame.png` | Orange/yellow fire flame |
| `ui.hud.icon.speed` | `hud-icon-speed.png` | Lime lightning bolt + gold rim |
| `ui.hud.icon.remote` | `hud-icon-remote.png` | Detonator + amber signal waves |
| `ui.hud.icon.shield` | `hud-icon-shield.png` | Steel heater shield + amber diamond |
| `ui.hud.icon.bomb-pass` | `hud-icon-bomb-pass.png` | Phase ghost bomb (cyan/magenta) |
| `ui.hud.icon.kick` | `hud-icon-kick.png` | Combat boot + impact burst |
| `ui.hud.icon.short-fuse` | `hud-icon-short-fuse.png` | Coiled fuse + magenta spark |
| `ui.hud.icon.ult-ready` | `hud-icon-ult-ready.png` | Gold charged star corona |
| `ui.hud.icon.alive` | `hud-icon-alive.png` | Gold vitality heart/check + life glow |
| `ui.hud.icon.dead` | `hud-icon-dead.png` | Charcoal skull + crimson sockets |

All masters: **512×512** PNG.

## Contact sheet

`_hud-icons-sheet.png` — 4×3 grid preview (last cell empty).

## Anchor

Edit-chained from `hud-icon-bomb.png` (hex bezel + gold rivets) so geometry matches across the set.

## Out of scope

- Does not replace `gameplay.power-up.*.icon` drop sprites.
- Does not wire `game-app` HUD draw paths (G2).
- No frames/9-slice (G4).
