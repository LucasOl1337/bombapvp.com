# Backlog: arena visual + HUD de partida

## Supervisor status — MERGED 2026-07-19

| Goal | Status |
| --- | --- |
| G1 Tournament tiles+crates | **merged** — sprite mode default |
| G2 HUD layout (local panel + rivals) | **merged** — HUD 78px, YOU panel |
| G3 HUD icons | **merged** — 11 icons in catalog |
| G4 HUD chrome frames | **merged** — 7 frames in catalog (consume in draw still optional) |
| G5 Arcane Citadel detail | **merged** — tiles upgraded in place |

Details: `tarefas/claims/supervisor-g1-g5-merge-DONE.md` + per-goal `gN-*-DONE.md`.

## Verify

- typecheck OK  
- 132 tests (game-assets + hud-format) OK  

## Optional next goals

- Wire G4 frames into `drawHudPanel`  
- Wire `ui.hud.icon.*` explicitly in local HUD slots  
- G5b–e other themes (verdant, ember, skyfoundry, tidal)
