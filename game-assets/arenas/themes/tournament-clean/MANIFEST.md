# Tournament Clean — top-down sprite tile pack (v5 hand-painted remake)

Default continuous arena (`tournament-clean`). Warm limestone cobble, beveled basalt blocks, hand-painted wood crates with iron cross-bands.

## Runtime files (256×256 — v5; eram 128×128 na v4)

| File | Catalog id | Notes |
|------|------------|--------|
| `floor-base.png` | `arena.theme.tournament-clean.floor.base` | Cobble hand-painted (IA) toroidal-seamless, grade → `#d8d0c2` |
| `floor-base-alt.png` | `…floor.base-alt` | Crop vizinho do mosaico 512; mean-matched |
| `floor-base-alt2.png` | `…floor.base-alt2` | 3º crop; mean-matched |
| `floor-base-alt3.png` | `…floor.base-alt3` | 4º crop; mean-matched; pick `(x+2y)%n` |
| `floor-lane.png` | `…floor.lane` | Lift cream 32% + brightness 1.05 sobre o base |
| `floor-spawn.png` | `…floor.spawn` | Cobble + anel ouro sólido `#c49e4c` redesenhado @256 |
| `floor-portal.png` | `…floor.portal` | Cobble + **2 anéis tracejados** ouro redesenhados @256 |
| `wall.png` | `…wall` | Bloco único de basalto com bevel (IA), full-frame |
| `wall-alt.png` | `…wall-alt` | Rotação 90°; mean-matched; checker via `(x+y)%2` |
| `crate.png` | `…crate` | Caixa de madeira hand-painted (IA), bandas de ferro em X, full-bleed RGBA |
| `crate-alt.png` | `…crate-alt` | Flip horizontal + micro-lift; checker via `(x+y)%2` |

## QA

| Gate | Result |
|------|--------|
| 2×2 seam — hard bar | PASS (stones wrap; no join bar) |
| Tone checker base vs alt | PASS — cell mean delta ≈0.3 (was ~12) |
| Floor alt edge−inner | PASS — alt/alt3 ≈0.5–0.6 (was ~4.8–5.0) |
| Landmark motif in all 4 quadrants | PARTIAL — two layouts alternate; no broken edge stones |
| Edge delta (base seed 45) | lr≈6.8, tb≈4.3 mean abs/channel |
| Top-down crate + alpha | PASS |
| Readable at TILE_SIZE=40 | PASS — `_preview-arena-mock.png` |
| Wall multi-cell continuous | PASS — edge−inner ~1; field join ~2.4 (was ~6.9); no per-cell rim/lip |
| Full pack quality gate (G6–G6z) | **PASS** — `tarefas/claims/g6-quality-gate-G6z-PASS.md` |

## Palette anchors

Floor `#d8d0c2` / `#cec5b7` family · lane cream lift · spawn gold `#c49e4c` · wall charcoal masonry edge-to-edge · crate warm brown (full-bleed, lifted outer rim).

## Render mode

`renderMode: "sprite"` + `tilePaths` in `arena-theme-library.ts`.

## v5 — remake hand-painted (IA) 256×256
- Bases 1024×1024 geradas por IA (Grok `image_gen`), prompts em `game-assets/_work/tile-remake/prompt-*.txt`
- Floor: seamless toroidal (roll + blend smoothstep na cruz central, band=96) → 512 → 4 crops 256 mean-matched
- Wall: bloco único com bevel (substitui masonry contínuo — leitura muito melhor de célula sólida)
- Crate: full-bleed RGBA com bandas de ferro em X; alt = flip + micro-lift
- Rings spawn/portal redesenhados proceduralmente (crisp @256, ouro `#c49e4c`)
- Script: `game-assets/_work/tile-remake/remake_tiles.py` (grava neste tema + `GameMechanics/assets/arena/tournament-clean/`)
- QA: seams 2×2 + arena mock @48px em `game-assets/_work/tile-remake/qa/`; screenshot ao vivo `live-game3.png`
- Testes: `tests/game-assets.test.ts`, `tests/asset-source-groups.test.ts`, `GameMechanics/tests/browser-visual-adapter.test.ts` — 125 PASS

## v4.1 — rigid fort walls + crate gold rim fix
- wall / wall-alt: dark basalt ironstone (not limestone cobble) for hard vs soft crate contrast
- crates: pure yellow left-edge rim removed (gold seam bug)
