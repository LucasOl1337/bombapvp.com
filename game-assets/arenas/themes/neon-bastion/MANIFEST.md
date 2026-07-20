# Neon Bastion — top-down sprite tile pack (v1.0 quality-gate PASS)

Default continuous arena (`neon-bastion`). Night citadel: quiet indigo-slate slabs, basalt monolith walls with cyan rim-light, warm umber crates as the ONLY hot terrain category. Nex Dark identity: cyan = structure, ember = destructible/danger.

## Runtime files (128×128)

| File | Catalog id | Notes |
|------|------------|--------|
| `floor-base.png` | `arena.theme.neon-bastion.floor.base` | Toroidal value-noise slabs (2×2 large slabs/tile), hairline joints + cyan thread @ ~0.05 alpha |
| `floor-base-alt.png` | `…floor.base-alt` | Joint grid offset (32,32); mean-matched |
| `floor-base-alt2.png` | `…floor.base-alt2` | Joint grid offset (32,0); mean-matched |
| `floor-base-alt3.png` | `…floor.base-alt3` | Joint grid offset (0,32); mean-matched; pick `(x+2y)%n` |
| `floor-lane.png` | `…floor.lane` | Same-family lift → mean ≈ `#1d2434`; slightly stronger joint thread |
| `floor-spawn.png` | `…floor.spawn` | Floor + thin open cyan ring `rgba(94,220,255,0.85)` |
| `floor-portal.png` | `…floor.portal` | Floor + **double dashed** cyan ring (12/10 dashes, phase-shifted; ≠ spawn) |
| `wall.png` | `…wall` | Basalt monolith `#0d1119`, edge-to-edge (NO per-cell frame), cyan rim-light top edge only (4px falloff, peak α 0.18) |
| `wall-alt.png` | `…wall-alt` | Offset noise layout; mean-matched; checker via `(x+y)%2` |
| `crate.png` | `…crate` | Full-bleed RGBA: umber body `#4a2c1a`, panel `#8a4b24`, bands `#2b1a10`, ember sigil glow `#ffb46a` |
| `crate-alt.png` | `…crate-alt` | Micro-variant grain; mean-matched; checker via `(x+y)%2` |

## How floor-base is made

Toroidal (wrap-indexed lattice) value noise at cell 16 + cell 6 over `#151a26`; per-slab value offsets (±2) keep slabs quiet; joints are hairline darken + cyan thread at very low alpha so flames/telegraphs still burst over the floor. Alts reuse the generator with shifted joint grids and different seeds, then additive per-channel mean-match to base (checker < 1 per channel). Lane/spawn/portal derive from base for family match.

## QA

| Gate | Result |
|------|--------|
| 2×2 seam — hard bar | PASS — base lr≈6.0, tb≈6.2 (joint feature; precedent PASS was ≈6.8); wall lr≈0.45 |
| Tone checker base vs alts | PASS — 0.17 / 0.67 / 0.88 per-channel mean delta (< 1) |
| Lane vs base contrast | PASS — mean delta ≈9.4, same hue family (b>g>r preserved) |
| Wall darker than floor | PASS — luminance gap ≈10.2 |
| Wall multi-cell (3×3 field) | PASS — col std ≈0.37 (no lattice); rim line delta ≈18.4 (soft glow, top edge only, no hard bar) |
| Crate warm + full-bleed alpha | PASS — mean ≈(86,49,26); alpha min 255; alt checker ≈1.0 |
| Readable at TILE_SIZE=40 | PASS — `_preview-arena-mock.png` + `_preview40-*.png` |

## Palette anchors

Floor `#151a26` · lane `#1d2434` · wall `#0d1119` + cyan rim `#68ddff` · spawn/portal ring `rgba(94,220,255,~0.85)` · crate `#4a2c1a` / `#8a4b24` / `#2b1a10` + ember `#ffb46a`.

## Render mode

`renderMode: "sprite"` + `tilePaths` in `arena-theme-library.ts`.

## Showcase

`_playtest-mock.png` (1280×800) — page backdrop + HUD sketch + 11×9 arena + character/bomb sprites. Presentation only; not loaded by the runtime.

## Generator

`game-assets/_work/build_neon_bastion.py` (tiles + QA + arena mock) · `game-assets/_work/build_neon_bastion_playtest_mock.py` (showcase).
