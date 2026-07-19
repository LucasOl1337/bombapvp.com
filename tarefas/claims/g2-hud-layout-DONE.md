# G2 — HUD layout redesign — DONE

**Agent:** G2 worktree subagent  
**Scope:** in-match HUD presentation only (no tiles, no gameplay logic, no commit/push)  
**Date:** 2026-07-19

## Problem

4-player continuous / fullscreen HUD was a single 34px strip with every player jammed into side gutters (`B F S` strings + status + scores). Long champion names and stats overlapped/truncated into unreadable soup. Local player had no dedicated panel.

## Solution architecture

Two-row match HUD shared by **windowed and fullscreen**:

| Band | Y | H | Content |
| --- | --- | --- | --- |
| Top rivals + center | 4 | 28 | Rival compact slots L/R of isolated match meta |
| Local YOU panel | 36 | 38 | Status, icon+number power slots, ult chip |
| **Total HUD height** | 0 | **78** | Replaces 60 (windowed) / 34 (fullscreen) |

### Top row
- **Rivals only** (local seat excluded via `partitionHudPlayers`)
- 4p with local P1 → left `[P2][P3]`, right `[P4]`
- Each rival slot: `P#` + name ellipsis + `K# W#` / `W#` + ult/alive (`ULT RDY`, `ULT 3.2`, `CAST`, `DOWN`, danger)
- **No** jammed `B · F · S` string on rivals

### Center (isolated)
- Mode line: `R{n} · ENDLESS` or `R{n} · FT{wins}`
- Timer digits
- Sudden-death progress meter only (no extra SD text collision)

### Bottom — local panel (YOU / VOCÊ)
- Identity: `YOU` + champion name (ellipsis) + live status + score pips / endless K-W
- **Power slots as icon + number** (absolute bomb / flame / speed counts; extra acquired powers)
- Dedicated **ULT chip** (RDY / CAST / cooldown seconds) — not keybind soup
- Does **not** rely on a single `B 2 · F 3 · S 1` string for primary stats

## Layout numbers (source of truth)

| Constant | Value | File |
| --- | --- | --- |
| `HUD_HEIGHT` / `HUD_LAYOUT.height` | **78** | `PersonalConfig/config.ts`, `Engine/hud-format.ts` |
| `FULLSCREEN_HUD_HEIGHT` | **78** (was 34) | `Engine/game-app.ts` |
| `ARENA_OFFSET_Y` | `HUD_HEIGHT + 4` = **82** | `PersonalConfig/config.ts` |
| `topRowY` / `topRowHeight` | 4 / 28 | `HUD_LAYOUT` |
| `localPanelY` / `localPanelHeight` | 36 / 38 | `HUD_LAYOUT` |
| `centerWidth` / max | 160 / 180 | `HUD_LAYOUT` |
| `rivalSlotMinWidth` / max | 112 / 170 | `HUD_LAYOUT` |
| `rivalNameMax` / `localNameMax` | 12 / 18 | `HUD_LAYOUT` |
| Canvas | 960×690 | unchanged |

Arena playfield still scales from `getHudRenderHeight()` + padding; larger HUD shrinks available vertical space slightly but keeps the board playable (scale clamp unchanged).

## Ellipsis

- Pure helper `ellipsisText(text, max)` in `hud-format.ts`
- Single character `…` (not `...`)
- Example: `"Crocodilo Arcano"` @ 12 → `"Crocodilo A…"`
- Wired through `shortenCharacterName` / `getCharacterLabel`

## Files touched

| Path | Change |
| --- | --- |
| `src/original-game/Engine/hud-format.ts` | Layout constants, ellipsis, score line, partition, slot width, panel draw |
| `src/original-game/Engine/game-app.ts` | Unified `renderMatchHud`, rival slots, center meta, local panel, local power slots |
| `src/original-game/PersonalConfig/config.ts` | `HUD_HEIGHT` 60→78, `ARENA_OFFSET_Y` +4 |
| `tests/hud-format.test.ts` | **New** — 11 unit tests |

## Out of scope (per ownership)

- G3 HUD catalog icons (uses existing `assets.powerUps` or letter fallback)
- G4 frame 9-slices
- Arena tile art / regeneration
- Commit / push

## Verify

```
npx tsc --noEmit -p tsconfig.original-game.json   # clean
npx tsc --noEmit                                   # clean
npx vitest run tests/hud-format.test.ts --project=contracts-node
# ✓ 11 tests passed
```

## Local player resolution

`getMatchLocalPlayerId()`:
1. Online → `onlineLocalPlayerId`
2. Automation/webdriver → `automationControlledPlayer`
3. Else → `1` (P1)

## Notes for merge

- G3 may later swap letter/power-up icons for `ui.hud.icon.*` without layout changes.
- G4 frames can wrap the same panel rects (`rival-slot`, `local-panel`, `match-center`).
- `formatHudStatLine` remains exported for secondary/debug use; local primary path is icon slots.
