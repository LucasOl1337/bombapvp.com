# G1 — tournament-clean sprite tiles DONE

## Mission

Replace procedural default arena theme `tournament-clean` with detailed tile sprites, keeping the warm beige/charcoal/brown crate palette (no Citadel cyan/blue).

## What changed

### New assets — `game-assets/arenas/themes/tournament-clean/`

| File | Size | Mode | Role |
|------|------|------|------|
| `floor-base.png` | 128×128 | RGB | Warm limestone base (`#d8d0c2` family) |
| `floor-lane.png` | 128×128 | RGB | Brighter cream + cross edge cuts |
| `floor-spawn.png` | 128×128 | RGB | Cream floor + thin warm-gold ring |
| `wall.png` | 128×128 | RGB | Charcoal slab, top lip, sand accent |
| `crate.png` | 128×128 | RGBA | Warm brown wood crate, black-keyed alpha |
| `_seam-floor-base.png` | 256×256 | RGB | 2×2 seam composite |
| `_seam-floor-lane.png` | 256×256 | RGB | 2×2 seam composite |
| `_seam-floor-spawn.png` | 256×256 | RGB | 2×2 seam composite |
| `_seam-wall.png` | 256×256 | RGB | 2×2 seam composite |
| `_seam-crate.png` | 256×256 | RGBA | 2×2 seam composite |
| `MANIFEST.md` | — | — | Pack notes + palette anchors |

Generation path: `image_gen` floor-base → `image_edit` chain for lane/spawn/wall/crate → PIL resize 128, mild edge crossfade on floors, black-key crate alpha, PIL 2×2 seam composites.

### Catalog — `game-assets/catalog.ts`

Imports + ids:

- `arena.theme.tournament-clean.floor.base`
- `arena.theme.tournament-clean.floor.lane`
- `arena.theme.tournament-clean.floor.spawn`
- `arena.theme.tournament-clean.wall`
- `arena.theme.tournament-clean.crate`

### Theme library — `src/original-game/Arenas/arena-theme-library.ts`

**Only** the `tournament-clean` entry:

- `renderMode`: `"procedural"` → `"sprite"`
- `tilePaths` set to the five catalog ids above
- Palette / motif **unchanged**
- `pixellabDescription` updated to describe the sprite set

### Tests — `tests/game-assets.test.ts`

- New assertion: tournament-clean is sprite mode with correct `tilePaths` and `#d8d0c2` floorBase
- Catalog path table extended for the five new ids

## Verify

| Check | Result |
|-------|--------|
| Files on disk | OK (5 tiles + 5 seams + MANIFEST) |
| Catalog imports/ids | OK |
| Theme library sprite mode | OK |
| Seam 2×2 composites | OK (PIL) |
| `npx vitest run tests/game-assets.test.ts` | **102 passed** |

## Defects / notes

1. **Crate style**: isometric 3/4 wood crate on keyed black (RGBA). Arcane-citadel crate is flatter top-down; both are readable. If engine crops/fills tile rect strictly, consider a future top-down square face revision.
2. **Floor edge bevel**: individual tiles keep a soft slab frame; 2×2 composites show a light grid (intentional category read, similar to other clean floor packs). Mild PIL edge crossfade applied to floors.
3. **Wall seam score**: higher L-R / T-B delta than floors because of the structural top lip — expected for wall blocks, not floor-tiling.
4. **No commit/push** (per mission constraints).
5. Scope limited to tournament-clean assets + catalog entries + tournament-clean library block + minimal tests. No other themes, no HUD.

## Palette fidelity

Warm beige / charcoal / brown only — no cyan/blue Citadel accents on tiles.
