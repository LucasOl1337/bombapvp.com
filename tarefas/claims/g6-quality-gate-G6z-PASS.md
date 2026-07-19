# G6 quality gate — PASS (through G6z)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets`  
**Date:** 2026-07-19

## Field-tile gates (must not notice the grid)

| Gate | Result |
| --- | --- |
| Floor base edge−inner | 1.60 PASS |
| Floor alt/alt2/alt3 edge−inner | 0.59 / 0.15 / 0.51 PASS |
| Floor 4-way mean spread | 0.59 PASS (no tone checker) |
| Floor field join @40 | ~2.2 PASS |
| Lane pure continuous edge−inner | 1.57 PASS |
| Lane−base contrast | +27 PASS (path readable) |
| Wall / wallAlt edge−inner | 1.05 / 1.52 PASS |
| Wall mean delta | 0.19 PASS |
| Wall multi-cell field join | 2.44 PASS (was ~6.9 pre-G6z, ~46 pre-G6u) |
| 2×2 cobble seam hard bar | PASS (toroidal stones) |

## Landmark / prop gates (not field tiles)

| Gate | Result |
| --- | --- |
| Spawn solid gold ring @40 | gold frac 0.62 PASS |
| Portal double dashed ≠ spawn | gold frac 0.57 PASS |
| Crate full-bleed fill | ≈1.00; corners α=0 PASS |
| CrateAlt mean-matched | op L 76.2 / 75.9 PASS |
| Break FX size-matched | PASS (G6w/G6x chain) |
| Top-down orthographic crates | PASS (no iso) |

## Live + contracts

| Gate | Result |
| --- | --- |
| Live training `_playtest-training.png` | green — continuous floor/lanes/walls; solid crates; landmarks clear |
| `tests/game-assets.test.ts` | **102 passed** |

## Intentional residual (do not “fix”)

- Iron cross-bands on crates → discrete breakable identity  
- Wall masonry courses → 40px slab read  
- Spawn/portal ring ei ~7 → landmark motif, single-cell only  

## Pack status

**tournament-clean G6–G6z READY for owner commit** (no push without order).  
Further main-arena tile micro-polish is diminishing returns; next work is commit or optional other themes / HUD.
