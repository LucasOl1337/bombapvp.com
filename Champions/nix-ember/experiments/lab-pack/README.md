# Nix Ember

Lab character package for **Bomba PvP** (Grok experiment).
This raw review pack is not loaded directly by the live roster or `public/Assets`.

This is the canonical private root for the Nix Ember source package. `src/shared/grok-character-package.ts` validates it in place. The live Champion is registered by the module two levels above and loads curated assets from `../../assets/`; generated laboratory material belongs here, never under shared `game-assets/`.

| Field | Value |
| --- | --- |
| **Display name** | Nix Ember |
| **Slug** | `nix-ember` |
| **Accent** | ember orange on obsidian |
| **Role fantasy** | Compact bomb-saboteur spirit in volcanic-glass armor |

## Creative brief

Nix is a **bound ember wisp** sealed inside cracked obsidian plate. Soft ash-plume hair, glowing orange core-veins, empty gauntlets for planting, no melee weapons. Reads as a chibi top-down arena fighter in the same family as the live champions (cel-shaded, isolated on black), but with a hotter, more “volcanic glass” palette than Killer Bee’s gold/black.

**Personality of motion:** quick, coiled, springy — always ready to hop out of a bad blast lane and re-plant.

## Ultimate (exactly one)

| Field | Value |
| --- | --- |
| **Skill name** | Ember Vault |
| **Id (suggested)** | `nix-ember-vault` |
| **Fantasy (one line)** | Short vault hop that clears a bomb/flame tile line and lands Nix crouched, ready to plant again. |
| **Bomb-PvP role** | **Survival + reposition** (mobility ultimate), not a sword attack. |
| **Body language for `cast`** | Coil low → spring with ember wing-flare → mid-air stretch → land crouch. |
| **Cooldown fantasy** | ~7s (design only — not implemented). |

## Gameplay-compatible animation map

| In-game action | Clip folder | Engine slot (today) | Frames |
| --- | --- | --- | --- |
| Idle / hover | `selected/idle-south` | `idle` | 4 |
| Walk | `selected/walk-south` | `walk` | 8 |
| Ultimate Ember Vault | `selected/cast-south` | `cast` | 4 |
| Plant bomb | `selected/plant-south` | body-only plant (candidate `attack` or future `plant`) | 6 |

### Hard rules for this pack

1. **Plant frames never bake a bomb/fuse** — bomb is a world entity (`props.bomb`).
2. **Cast is Ember Vault**, not a melee slash kit.
3. Isolated character, flat **black** background, ~**124×124** game cells + `@256` review sizes.
4. South-primary experiment pack (enough to judge style + motion).

## Review aids

- Portrait: `portrait/nix-ember-portrait.png`
- Sheets: `sheets/*-sheet-256.png`
- Looping GIFs: `sheets/*-preview.gif`
- Source video: `video/*.mp4`
- Contact sheets: `frames/*-contact.png`
- Machine-readable inventory: `manifest.json`

## Non-goals

- Live roster wiring, skill hitboxes, bot AI, audio, full 4-dir sets.
