# G6b DONE — tournament-clean cobble refine

**Status:** complete (workspace; no commit/push)  
**Parent:** G6 top-down pack  
**Scope:** replace/refine tiles under `game-assets/arenas/themes/tournament-clean/**` only  

## Why

G6 mock showed flat cream floor + mismatched smooth lanes; wall had top-only lip (directional). Postmortem-safe top-down crate kept.

## What changed

| Asset | Change |
| --- | --- |
| `floor-base.png` | Limestone **cobble** craft (was near-flat grain) + edge blend |
| `floor-lane.png` | Derived from cobble via PIL (brighten + thin frame) |
| `floor-spawn.png` | Derived from cobble + open gold ring (PIL) |
| `wall.png` | Full 4-edge framed charcoal block (non-directional) |
| `crate.png` | Unchanged (orthographic RGBA) |

## QA

- 40px mock: cohesive field, readable lanes/spawns, framed walls, crates pop  
- Crate alpha still clean  
- Seam: partial (cobble wrap imperfect; flagged in MANIFEST)  
- `vitest` game-assets: **96 passed**

## Out of scope

- Other themes, HUD, bomb/flame, commit/push  
