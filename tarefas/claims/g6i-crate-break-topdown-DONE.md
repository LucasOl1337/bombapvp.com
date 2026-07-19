# G6i DONE — top-down crate break frames (shared)

**Status:** complete (workspace; no commit/push)

## Why

Intact theme crate is orthographic top-down; break frames were an older mismatched set. Playtest follow-up: align destroy FX.

## What changed

`game-assets/gameplay/crates/break/crate-break-{0..3}.png` replaced with sequence chained from tournament-clean crate:

| Frame | Content |
| --- | --- |
| 0 | Cracked intact lid |
| 1 | Blend mid-collapse |
| 2 | Split into 4 panels |
| 3 | Debris planks + iron scraps |

- RGBA, corners alpha 0, 128×128  
- Legacy backup: `break/_legacy-pre-g6i/`  
- Shared asset (all themes) — matches main arena language  

## Verify

- Alpha corners OK  
- game-assets tests passed  

## Note

Arcane/other theme crates may still differ slightly from break style; main default tournament-clean is matched.
