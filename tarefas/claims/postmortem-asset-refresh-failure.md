# Postmortem: game asset refresh failure (2026-07-19)

## What shipped (and was reverted)

Imagine-generated replacements for bomb, crates, flame, power-up icons; tournament-clean sprite tiles; arcane-citadel detail pass; HUD icons/frames; in-match HUD redesign. Reverted to pre-`6039ed5` game visuals (`62cfe1f` baseline for assets/HUD/theme).

## Why it looked terrible in production

1. **Wrong art register for a 2D grid bomber**  
   Crates/walls came out as **isometric 3D props** on a top-down procedural floor language. Silhouette and lighting disagreed with the arena (flat 2D tiles + 3D crates = “quadrados 3D num jogo 2D”).

2. **Black keyable backgrounds not stripped for sprites**  
   Bomb/crate masters kept **opaque black fields**. On the arena they read as black squares (“fundo preto bugado”), not clean alpha sprites. Power-up icons can sit on black; **world props cannot**.

3. **Style set never verified in-engine**  
   Side-by-side Imagine sheets ≠ 40px tile on the real canvas. No mandatory in-arena screenshot gate before merge. High-res “nice” art died at gameplay scale.

4. **Animation path broken**  
   Replacing `bomb.png` / `flame.png` without preserving the **anim-sheet contract** and draw path made the bomb feel static vs the old flame sheet.

5. **Tournament-clean forced to sprites too early**  
   Default theme was **procedural** (palette-coherent, flat). Swapping to unvalidated sprite pack broke the only map everyone plays (`continuous`).

6. **Parallel worktrees + cascade risk**  
   Five agents in parallel delivered assets without a single **adversarial visual review** on the live arena. Catalog drop-in made it easy to ship broken art without gameplay playtest.

7. **HUD redesign stacked on bad art**  
   New HUD layout was judged together with bad props; even a good HUD would look worse with broken bombs/crates.

## Process failures

| Gap | Should have been |
| --- | --- |
| No “must look good at TILE_SIZE” acceptance | Screenshot continuous arena before merge |
| No alpha/key check for world props | PIL/sharp: reject non-transparent corners |
| No orthographic top-down constraint for crates | Explicit “no isometric, top-down 2D only” |
| Sprite theme on by default | Optional theme behind flag until validated |
| Parallel ship without integration QA | One supervisor playtest checklist |

## What to keep for next attempt

- Launcher front-end (Codex) — not part of this revert’s asset failure
- Citadel-era assets that already worked (leave alone unless proven bad)
- Procedural tournament-clean as default until a **top-down** pack is proven in-engine

## Next attempt rules (hard)

1. Generate **top-down only** crates/walls/floors (no iso camera).  
2. World sprites: **transparent** bg; automated alpha check.  
3. Keep bomb **flame-anim-sheet** path green in a smoke test.  
4. Ship theme as `arenaTheme=` query first; promote default only after live playtest.  
5. One integration agent playtests continuous mode before deploy.
