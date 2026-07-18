# Killer Bee — bomber-actions (gameplay-aligned)

Lab pack aligned with **Bomba PvP** actions: move, plant bomb, Wing Dash ultimate.

**Does not replace** live assets. Sword-combat pack from the first experiment stays in the parent folder for possible future reuse.

## Gameplay → animation map

| In-game action | Animation pack | Engine slot (today) | Frames |
| --- | --- | --- | --- |
| Standing / hover | `idle-south` | `idle` | 4 |
| Walking | `walk-south` | `walk` | 8 |
| Place bomb | `bomb-plant-south` | not wired yet (candidate for `attack` or a future `plant` clip) | 6 |
| Ultimate Wing Dash | `cast-south` | `cast` | 4 |

Engine today picks: **death → skill/cast → walk-or-idle**. Bomb place has no dedicated sprite branch yet; the bomb-plant pack is ready for when you wire a plant feedback clip.

## Design rules (this pack)

- No sword **attacks** / melee slashes
- Blades may appear **sheathed** (cosmetic) only
- **Bomb plant is body-only** — never bake a bomb into the frames. The bomb is a separate world entity (`props.bomb`); baking one would double-draw on deploy.
- Cast = **wing energy + dash coil**, not a slash

## Archive

`_archive-plant-with-baked-bomb/` — first plant attempt with bomb drawn in the sprite. Kept only as a logic lesson; **do not ship**.

## Quick preview

- GIFs: `sheets/*-preview.gif`
- Sheets: `sheets/*-sheet-256.png`
- Source video: `video/walk-south.mp4`, `bomb-plant-south.mp4`, `cast-wing-dash.mp4`

## Honest notes

- **Walk:** readable stride; some frames still similar (video idle-ish gait).
- **Bomb plant:** crouch + empty hand reach toward floor (no prop). Game spawns the real bomb tile separately.
- **Cast:** strongest clip — wings glow and body coils into dash intent. Matches Wing Dash fantasy.
- **Idle:** interim, harvested from low-motion walk frames (not a dedicated idle video).
- Still **south-only** for this round.

## Sibling pack (kept)

Parent `../` still has the earlier **sword attack / combat** experiment (`attack-south`, etc.) intentionally preserved for later ideas — not for current bomb meta.
