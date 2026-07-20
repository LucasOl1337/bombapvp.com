# Backlog: arena visual + HUD de partida

## Supervisor status — 2026-07-20 (ciclo NOVA PRIME)

| Goal | Status |
| --- | --- |
| N1 Tema procedural `nova-prime` como default | **done** — `Engine/visual/arena-design.ts` + `arena-theme-library.ts` |
| N2 Chão grid ultra-quieto / parede monolith / crate banded | **done** — renderers procedurais em `game-app.ts` |
| N3 Backdrop deep-space + moldura hairline | **done** — `buildBackdropCache` reescrito |
| N4 Bomba (sombra+halo+arco de fuse), chama (bloom aditivo), power-up (chip de vidro), anel de identidade por jogador | **done** |
| N5 HUD de vidro (painéis procedurais, sem 9-slice PNG), pips em losango, chip ULT warm | **done** |
| N6 Overlays (resultado/pause/cue/seleção) + página `/arena` (CSS glass/ciano) | **done** |
| N6b Overlays de perigo/preview arredondados + build de produção | **done / PASS** |
| N7 Gates: typecheck + `npm run test:full` | **PASS** (695 testes) |
| N8 Screenshots live (início, ação, cast, resultado, rollback `?arenaTheme=neon-bastion`) | **PASS** |

Rollback instantâneo: `?arenaTheme=neon-bastion` (ou qualquer tema legado) continua funcional; nenhum asset PNG removido. Sprites de campeões intocados.

## Supervisor status — 2026-07-19

| Goal | Status |
| --- | --- |
| G1–G5 first pass | **reverted** — postmortem |
| G6–G6e tile pack | **done** |
| G6f–G6g gates + live screenshot | **done / PASS** |
| G6h Spawn pad-only | **done** |
| G6i Top-down crate break | **done** |
| G6j Continuous lane (no sticker frames) | **done** — `g6j-lane-continuous-DONE.md` |
| G6k Continuous wall (no gold frames) | **done** — `g6k-wall-continuous-DONE.md` |
| G6l Floor baseAlt mean-match (no tone checker) | **done** — `g6l-floor-match-alt-DONE.md` |
| G6m Portal floor tile (dashed ring, no square) | **done** — `g6m-portal-tile-DONE.md` |
| G6n Wall masonry (readable courses @40px) | **done** — `g6n-wall-masonry-DONE.md` |
| G6o CrateAlt micro-variation | **done** — `g6o-crate-alt-DONE.md` |
| G6p WallAlt offset masonry checker | **done** — `g6p-wall-alt-DONE.md` |
| G6q Portal stronger dashed ring @40px | **done** — `g6q-portal-strong-DONE.md` |
| G6r Crate fill expand (pad 15→6) | **done** — `g6r-crate-fill-DONE.md` |
| G6s Floor 4-way base (alt2/alt3) | **done** — `g6s-floor-4way-DONE.md` |
| G6t Pure continuous lane (no edge darken) | **done** — `g6t-lane-pure-continuous-DONE.md` |
| G6u Pure continuous wall (no rim / top lip) | **done** — `g6u-wall-pure-continuous-DONE.md` |
| G6v Crate solid cell fill (pad 7→3) | **done** — `g6v-crate-solid-fill-DONE.md` |
| G6w Crate full-bleed (no soft perimeter) | **done** — `g6w-crate-fullbleed-DONE.md` |
| G6x Crate outer rim lift (no dark frame grid) | **done** — `g6x-crate-rim-lift-DONE.md` |
| G6y Floor alt edge flatten (no cell-edge tone grid) | **done** — `g6y-floor-edge-flatten-DONE.md` |
| G6z Wall/wallAlt edge flatten (shared face mean) | **done** — `g6z-wall-edge-flatten-DONE.md` |
| G6 quality gate (through G6z) | **PASS** — `g6-quality-gate-G6z-PASS.md` |

## Main arena (tournament-clean) — READY

Seamless cobble + 4-way mean-matched base variants (edge-flattened alts), pure continuous cream lanes, pure continuous masonry walls + wallAlt (edge-matched joins), strong portal dashed rings (≠ spawn solid), full-bleed crate + crateAlt (lifted outer rim, iron cross kept) + matched break FX, spawn rings only on pads. Live training screenshots green. Quality gate PASS — field-tile micro-polish exhausted.

## Optional next

- **Owner commit/push when ordered** (blocking for public)  
- Other themes; arcane-citadel flat floor-base  
- HUD frame wire-up if pending  
