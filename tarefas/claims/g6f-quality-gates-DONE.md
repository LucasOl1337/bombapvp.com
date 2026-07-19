# G6f DONE — tournament-clean quality gates + smoke

**Status:** complete (workspace; no commit/push)

## What changed

- Test: runtime tiles must be **128×128** PNG; crate **color type 6 (RGBA)**  
- Manual PIL QA re-run: crate corners alpha 0; floor seam deltas ~19  
- Dev smoke: Vite on `127.0.0.1:4173` → `/arena/` **200**

## Pack status (G6–G6f)

Main arena `tournament-clean` sprite pack is **candidate for live playtest**:

| Piece | State |
| --- | --- |
| Floor base/baseAlt | Seamless Voronoi cobble + checker |
| Lane/spawn | Family + contrast + gold ring |
| Wall | Textured charcoal framed |
| Crate | Orthographic RGBA |
| Engine | sprite + baseAlt draw |

## Needs attention

Human/in-browser continuous match hard-refresh on `:4173` before commit.
