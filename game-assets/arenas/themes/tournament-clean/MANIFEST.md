# Tournament Clean — theme tile pack

Default arena theme (`tournament-clean`). Warm beige limestone floor family, charcoal slab walls, warm brown classic crates. **Not** Citadel cyan/blue.

## Palette anchors (from `arena-theme-library.ts`)

| Role | Hex / notes |
|------|-------------|
| Floor base | `#d8d0c2` / alt `#cec5b7` |
| Floor lane | `#efe5d6` / alt `#e2d7c7` |
| Floor spawn | `#f7efe0` / alt `#eadfcd` + gold ring `#c49e4c` |
| Wall | outer `#26231f`, inner `#3a342e`, top `#5b534a`, accent `#d8c09a` |
| Crate | outer `#7b5937`, inner `#a67a4f`, band `#4f3822`, mark `#dfc299` |

## Files (128×128 PNG)

| File | Catalog id | Notes |
|------|------------|--------|
| `floor-base.png` | `arena.theme.tournament-clean.floor.base` | Quiet warm limestone, low noise center |
| `floor-lane.png` | `arena.theme.tournament-clean.floor.lane` | Brighter cream + restrained cross edge cuts |
| `floor-spawn.png` | `arena.theme.tournament-clean.floor.spawn` | Thin warm-gold spawn ring, open center |
| `wall.png` | `arena.theme.tournament-clean.wall` | Charcoal slab, top lip, sand accent line |
| `crate.png` | `arena.theme.tournament-clean.crate` | Warm wood + iron bands (RGBA, black-keyed) |

## Seam checks

2×2 composites (PIL):

- `_seam-floor-base.png`
- `_seam-floor-lane.png`
- `_seam-floor-spawn.png`
- `_seam-wall.png`
- `_seam-crate.png`

Floors received mild edge crossfade for tileability. Wall keeps structural top lip (higher edge delta is expected). Crate is an isolated prop (not a floor tile).

## Motif

- floorPattern: `dot`
- lanePattern: `cross`
- spawnPattern: `ring`
- wallStyle: `slab`
- crateStyle: `classic`

## Render mode

`renderMode: "sprite"` with `tilePaths` pointing at the catalog ids above.
