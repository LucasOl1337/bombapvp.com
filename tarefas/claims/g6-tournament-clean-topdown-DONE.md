# G6 DONE — tournament-clean top-down tiles (postmortem-safe)

**Status:** complete (workspace only; no commit/push)  
**Scope:** `game-assets/arenas/themes/tournament-clean/**`, catalog ids, `tournament-clean` library entry, game-assets tests  
**Skill:** `game-tilesets` + `game-asset-core`  
**Why:** postmortem `postmortem-asset-refresh-failure.md` — prior G1 pack used **isometric** crates and shipped default too early.

## What changed

| Asset | Spec |
| --- | --- |
| `floor-base.png` | Seamless warm limestone, anonymous grain |
| `floor-lane.png` | Brighter cream + thin edge frame |
| `floor-spawn.png` | Open warm-gold ring on cream |
| `wall.png` | Charcoal slab + top lip + sand accent (no face/motif) |
| `crate.png` | **Orthographic top-down** wood lid, iron cross-bands, RGBA keyed |

### Wiring

- Catalog: `arena.theme.tournament-clean.{floor.base,floor.lane,floor.spawn,wall,crate}`
- Library: `tournament-clean` → `renderMode: "sprite"` + `tilePaths` (palette unchanged)
- Tests: sprite-mode assertion + path table rows

### QA

- Crate corners alpha 0; opaque black pixels 0  
- 2×2 seams written next to tiles  
- 40px arena mock: `_preview-arena-mock.png`  

## Out of scope

- Other themes (arcane-citadel, verdant, …)  
- Bomb/flame/HUD  
- git commit / push  

## Follow-up

Live playtest continuous arena after hard refresh. If contrast/readability fails in-engine, flip `renderMode` back to `procedural` without deleting assets.
