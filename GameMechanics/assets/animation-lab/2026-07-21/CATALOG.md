# Catálogo do animation-lab — 21/07/2026

Inventário dos manifests presentes nesta rodada. As categorias abaixo normalizam nomes que vieram de sessões diferentes; cada pasta continua sendo a fonte de verdade do asset e do seu `manifest.json`.

Resumo: **70 manifests** — 59 Candidato, 5 Descartado, 6 Integrado.

## Bombas, explosões e pavio — 10

- `0210-bomb-smoke` — bomb-smoke — Candidato
- `0230-fuse-embers` — fuse-embers — Candidato
- `0315-bomb-core-flare` — bomb-core-flare — Candidato
- `0400-bomb-cinder-burst` — bomb-cinder-burst — Candidato
- `0440-bomb-arc-blast` — bomb-arc-blast — Candidato
- `0515-bomb-detonation-blossom` — bomb-detonation-blossom — Integrado
- `0545-bomb-core-rupture` — bomb-core-rupture — Candidato
- `0620-bomb-void-plume` — bomb-void-plume — Candidato
- `0652-bomb-gravity-knot` — bomb-gravity-knot — Candidato
- `0731-bomb-fission-core` — bomb-fission-core — Candidato

## Hit e impacto — 12

- `0135-shockwave-ring` — shockwave-ring — Candidato
- `0150-impact-cross` — impact-cross — Candidato
- `0220-collision-sparks` — collision-sparks — Candidato
- `0255-hit-slash` — hit-slash — Candidato
- `0325-hit-shield-break` — hit-shield-break — Candidato
- `0405-hit-ground-punch` — hit-ground-punch — Candidato
- `0445-hit-parry-clash` — hit-parry-clash — Candidato
- `0520-hit-recoil-burst` — hit-recoil-burst — Candidato
- `0555-hit-ricochet-shards` — hit-ricochet-shards — Candidato
- `0625-hit-armor-rattle` — hit-armor-rattle — Candidato
- `0700-hit-kinetic-slam` — hit-kinetic-slam — Integrado
- `0738-hit-prism-rebound` — hit-prism-rebound — Candidato

## Power-ups — 11

- `0200-powerup-flame` — powerup-flame — Candidato
- `0225-powerup-speed` — powerup-speed — Candidato
- `0300-powerup-shield` — powerup-shield — Candidato
- `0335-powerup-charge-orb` — powerup-charge-orb — Candidato
- `0410-powerup-portal-rift` — powerup-portal-rift — Candidato
- `0455-powerup-regen-pulse` — powerup-regen-pulse — Candidato
- `0525-powerup-chrono-tesseract` — powerup-chrono-tesseract — Candidato
- `0602-powerup-prism-ascension` — powerup-prism-ascension — Candidato
- `0631-powerup-echo-sigil` — powerup-echo-sigil — Candidato
- `0706-powerup-aegis-comet` — powerup-aegis-comet — Integrado
- `0747-powerup-void-anchor` — powerup-void-anchor — Candidato

## Feedback de arena — 9

- `0215-arena-danger-reticle` — arena-danger-reticle — Candidato
- `0305-arena-control-pulse` — arena-control-pulse — Candidato
- `0345-arena-rally-beacon` — arena-rally-beacon — Candidato
- `0415-arena-zone-gate-scan` — arena-zone-gate-scan — Candidato
- `0505-arena-capture-pulse` — arena-capture-pulse — Candidato
- `0530-arena-boundary-lock` — arena-boundary-lock — Candidato
- `0608-arena-hex-ownership-pulse` — arena-hex-ownership-pulse — Candidato
- `0638-arena-lane-wayfinder` — arena-lane-wayfinder — Candidato
- `0714-arena-sentinel-lattice` — arena-sentinel-lattice — Integrado

## Animações curtas de HUD — 10

- `0205-hud-confirmation` — hud-confirmation — Candidato
- `0235-hud-capture-lock` — hud-capture-lock — Candidato
- `0310-hud-streak-pop` — hud-streak-pop — Candidato
- `0350-hud-fuse-timer-warning` — hud-fuse-timer-warning — Candidato
- `0425-hud-carrier-crown-ping` — hud-carrier-crown-ping — Candidato
- `0510-hud-ability-ready-flare` — hud-ability-ready-flare — Candidato
- `0540-hud-meter-fill-tick` — hud-meter-fill-tick — Candidato
- `0614-hud-respawn-countdown-pips` — hud-respawn-countdown-pips — Candidato
- `0645-hud-damage-direction-wedge` — hud-damage-direction-wedge — Candidato
- `0725-hud-combo-chain-burst` — hud-combo-chain-burst — Integrado

## Personagens existentes — 18

WIP desta sessão separada; não entram na integração VFX desta rodada.

- `0435-nix-ember-ember-vault` — habilidade especial — Candidato
- `0445-lee-sin-hit-reaction` — hit reaction — Descartado
- `0500-ranni-victory-emote` — vitória/derrota — Candidato
- `0510-katarina-attack-windup` — ataque — Descartado
- `0520-katarina-attack-cyan-key` — ataque — Candidato
- `0540-madara-idle-ritual` — idle — Candidato
- `0550-killer-bee-run-jetstep` — walk/run — Descartado
- `0600-killer-bee-run-cyan-key` — walk/run — Candidato
- `0610-thresh-cast-chain-recall` — cast — Descartado
- `0620-nico-cast-grimoire-safe` — cast — Candidato
- `0630-madara-ultimate-fireball` — ultimate — Candidato
- `0640-lee-sin-death-fall` — death — Descartado
- `0650-mirelle-death-safety` — death — Candidato
- `0700-pendula-emote-orbit` — emote — Candidato
- `0710-crocodilo-idle-tidal` — idle alternativo — Candidato
- `0720-pendula-attack-gear-swish` — attack alternativo — Candidato
- `0730-pendula-death-clockfall` — death alternativo — Integrado
- `0750-nico-ultimate-shadow-grimoire` — ultimate alternativo — Candidato

## Integração global VFX

Os **52 VFX validados** estão carregados no runtime. A cada evento real, o adapter escolhe o próximo pack da categoria correspondente; assim todos podem ser testados em partidas sucessivas sem desenhar todos os efeitos sobrepostos no mesmo instante.

| Categoria | Packs | Evento visual |
|---|---:|---|
| Bomba | 10 | `bomb-exploded` |
| Hit | 12 | `crate-destroyed` |
| Power-up | 11 | `power-up-collected` |
| Arena | 9 | `pressure-warning` |
| HUD | 10 | `power-up-collected` |

As variantes de atlas são escolhidas na ordem `v4`, `v3`, `v2`, base. O `source-upscaled-2048.png` continua sendo fonte de arte; o jogo consome os atlases runtime 1024×1024, com 16 células 256×256. Personagens permanecem no carregador canônico de `Champions/` até cada animação ter um contrato direcional de gameplay.
