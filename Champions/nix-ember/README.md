# Nix Ember (live Champion module)

| Field | Value |
| --- | --- |
| **ID** | `9f3e2c1a-8b7d-4e6f-a0c1-2d3e4f5a6b7c` |
| **Ultimate** | Ember Vault (`nix-ember-vault`) |
| **Cooldown** | 7000 ms |
| **Role** | Survival hop over bomb/flame line |

## Layout

- `definition.ts` — roster identity
- `skill.ts` — Ember Vault mechanics
- `visuals.ts` — cast animation during vault
- `assets/` — portrait + directional animation frames
- `experiments/lab-pack/` — original Grok art pipeline (not loaded by engine)

## Notes

- Plant frames map to the engine `attack` clip (body-only, no baked bomb).
- South art is currently reused for N/E/W until full directional sheets exist.
