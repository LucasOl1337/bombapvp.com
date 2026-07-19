# Shared visual style contract — Citadel pixel-tech family

Applies to all **shared** runtime visuals under `game-assets/` that the catalog loads for arena, launcher chrome, and drops. Champion-private art under `Champions/` is out of scope.

## Must

- **Pixel / near-pixel read** at gameplay scale (clear silhouette at ~tile size).
- **Palette family:** dark gunmetal greys, pure or near-black field, neon **cyan**, **amber/orange**, optional **purple** / **lime** accent for ability identity.
- **No lettering** on props, icons, tiles, or chrome pieces (games localizes text).
- **One treatment per set:** solid/filled pixel forms, not mixed emoji-flat + hyper-detailed pixel in the same set.
- Power-up **icons:** centered emblem on black; mechanical bezel language shared across the set.
- World **props** (bomb, flame, crate): isolated subject, black or transparent keyable field, no full UI bezel (they sit on tiles).
- **Tiles:** seamless or edge-compatible; non-directional lighting where rotation may occur; no landmark motifs that break tiling.

## Must not

- Emoji-style soft-gradient flat icons as live catalog targets.
- Accidental text, watermarks, or brand logos baked into gameplay sprites.
- Half-updated theme where one tile is regenerated and siblings stay a mismatched art school without a keep decision.

## Anchors (canonical)

- Power-up icons v3 + Citadel trio under `gameplay/power-ups/icons/`
- Citadel shared blocks under `arenas/shared/citadel-*`
- HUD badges/meters under `ui/hud/`
