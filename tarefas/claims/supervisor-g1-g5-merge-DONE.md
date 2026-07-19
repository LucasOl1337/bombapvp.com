# Supervisor merge — G1–G5 (2026-07-19)

## Parallel workers

| Goal | Worktree | Result |
| --- | --- | --- |
| G1 tournament tiles | `subagent-019f7ac7-8292-…` | DONE → merged |
| G2 HUD layout | `subagent-019f7ac7-8299-…` | DONE → merged |
| G3 HUD icons | `subagent-019f7ac7-82a3-…` | DONE → merged |
| G4 HUD frames | `subagent-019f7ac7-82a6-…` | DONE → merged |
| G5 arcane-citadel | `subagent-019f7ac7-82ad-…` | DONE → merged |

## Merged into `C:\projetos\bombpvp`

- Assets: `game-assets/arenas/themes/tournament-clean/**`, `arcane-citadel/**` (G5), `ui/hud/icons/**`, `ui/hud/frames/**`
- Code: `hud-format.ts`, `game-app.ts` HUD, `PersonalConfig/config.ts` (HUD 78px), `arena-theme-library.ts` (tournament-clean sprite)
- Catalog: tournament-clean + 11 icons + 7 frames
- Tests: `hud-format.test.ts` + expanded `game-assets.test.ts`
- Claims: `tarefas/claims/g1..g5-*-DONE.md`

## Verify (main workspace)

- `npm run typecheck` — exit 0
- `vitest` game-assets + hud-format — **132 passed**

## Follow-ups (optional, not blocking)

1. Draw G4 frames in `drawHudPanel` / local panel (assets catalogued; G2 still uses canvas fill panels)
2. Prefer `ui.hud.icon.*` over drop power-up sprites in local slots (slots already draw `assets.powerUps`)
3. Hard-refresh production/dev so Vite picks new tiles for continuous mode
4. No commit/push (owner order required)

## How to see in browser

Local: `npm run dev` → continuous arena (default theme tournament-clean sprites).  
Hard refresh if asset URLs cached.
