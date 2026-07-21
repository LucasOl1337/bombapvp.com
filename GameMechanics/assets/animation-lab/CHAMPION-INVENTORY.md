# Animation lab — inventory by Champion

Inventory generated from the Champion-bearing `manifest.json` files in this lab. The other lab folders are arena, bomb, HUD, hit or power-up effects and are intentionally excluded here.

`runtimeIntegration=false` means the candidate remains lab-only. `Descartado` entries are preserved as WIP/history and are not adoption targets.

## Crocodilo Arcano

- `idle alternativo` — `Integrado`, south only: [0710-crocodilo-idle-tidal](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0710-crocodilo-idle-tidal/manifest.json)

## Katarina

- `attack` — `Descartado`: [0510-katarina-attack-windup](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0510-katarina-attack-windup/manifest.json)
- `attack` — `Integrado`, south only: [0520-katarina-attack-cyan-key](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0520-katarina-attack-cyan-key/manifest.json)

## Killer Bee

- `walk/run` — `Descartado`: [0550-killer-bee-run-jetstep](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0550-killer-bee-run-jetstep/manifest.json)
- `walk/run` — `Integrado`, south run only: [0600-killer-bee-run-cyan-key](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0600-killer-bee-run-cyan-key/manifest.json)

## Lee Sin

- `hit reaction` — `Descartado`: [0445-lee-sin-hit-reaction](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0445-lee-sin-hit-reaction/manifest.json)
- `death` — `Descartado`: [0640-lee-sin-death-fall](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0640-lee-sin-death-fall/manifest.json)

## Madara

- `idle` — `Integrado`, south only: [0540-madara-idle-ritual](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0540-madara-idle-ritual/manifest.json)
- `ultimate` — `Integrado`, south only: [0630-madara-ultimate-fireball](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0630-madara-ultimate-fireball/manifest.json)

## Mirelle

- `death` — `Integrado`, south only: [0650-mirelle-death-safety](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0650-mirelle-death-safety/manifest.json)

## Nico

- `cast` — `Integrado`, south only: [0620-nico-cast-grimoire-safe](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0620-nico-cast-grimoire-safe/manifest.json)
- `ultimate alternativo` — `Integrado`, south only: [0750-nico-ultimate-shadow-grimoire](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0750-nico-ultimate-shadow-grimoire/manifest.json)

## Nix Ember

- `habilidade especial` — `Integrado como cast`, south only: [0435-nix-ember-ember-vault](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0435-nix-ember-ember-vault/manifest.json)

## Pendula

- `emote` — `Candidato`, runtime not integrated: [0700-pendula-emote-orbit](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0700-pendula-emote-orbit/manifest.json)
- `attack alternativo` — `Integrado`, south only: [0720-pendula-attack-gear-swish](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0720-pendula-attack-gear-swish/manifest.json)
- `death alternativo` — `Integrado`, south only: [0730-pendula-death-clockfall](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0730-pendula-death-clockfall/manifest.json)

## Ranni

- `vitória/derrota` — `Candidato`, runtime not integrated: [0500-ranni-victory-emote](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0500-ranni-victory-emote/manifest.json)

## Thresh

- `cast` — `Descartado`: [0610-thresh-cast-chain-recall](C:/Projetos/bombpvp/GameMechanics/assets/animation-lab/2026-07-21/0610-thresh-cast-chain-recall/manifest.json)

## Runtime limitations

All directly supported candidates above are installed as south-facing 124px sequences, with backups under `2026-07-21/_integration-backup/`. The existing `import.meta.glob` discovers them automatically; no loader or deterministic kernel change was needed.

`ranni-victory-emote` and `pendula-emote-orbit` remain lab-only because the runtime has no victory/emote playback state. `ultimate` assets are loaded by the catalog, but the current presentation path uses the ultimate sequence as the cast fallback; Nico's cast and ultimate candidates therefore cannot be selected independently until a dedicated ultimate presentation state exists.
