# SwarmLedger — Bugs Práticos (bombpvp)

- **Projeto:** bombpvp (Bomba PvP)
- **Branch executor:** `swarm/bombpvp/bugs`
- **Branch coletor:** `swarm/bombpvp/bugs-integracao`
- **Coletor:** bombpvp - Coletor Bugs Praticos (separado; não usar coletor genérico)

## Histórico resumido (pré-perda de branch)

| Rodada | Status | Nota |
| --- | --- | --- |
| 001–004 | `precisa humano` | WIP alheio bloqueava edição |
| 005 | `corrigido` | Lab: `back-to-selection` voltava para character-selection em vez do laboratory. Fix chegou na `main` como `616779f` (branch do enxame e ledger foram removidos depois). |

---

## Rodada 006 — 2026-07-18

| Campo | Valor |
| --- | --- |
| **Status** | `precisa humano` (histórico; desbloqueado na consolidação) |
| **Bug escolhido** | (nenhum — rodada bloqueada na época) |
| **Fluxo** | n/a |
| **Branch** | `swarm/bombpvp/bugs` (recriada nesta rodada) |
| **Arquivos de fix** | nenhum |

### Entrega (época)

- Commit local: `c4648b9` (apenas o ledger)

---

## Coletor C001 — 2026-07-18

| Campo | Valor |
| --- | --- |
| **Branch coletor** | `swarm/bombpvp/bugs-integracao` |
| **Base** | `main` @ `616779f` |
| **Avaliado** | `swarm/bombpvp/bugs` (`c4648b9` = main + ledger) + este ledger |

### Classificação dos itens

| Item | Classificação | Ação do coletor |
| --- | --- | --- |
| Rodadas 001–004 (bloqueios históricos) | `precisa humano` (histórico) | Nenhuma consolidação de código |
| Rodada 005 — lab `back-to-selection` → laboratory | `pronto para consolidar` **já na main** | Código e teste em `616779f` |
| Rodada 006 — recriação branch + ledger | ledger `consolidado` | Cherry-pick → `02fcaaa` |
| WIP flame/player-body/citadel (na época) | na época `precisa humano` | Ver consolidação C002 |

---

## Consolidação C002 — 2026-07-18 (humano pediu merge de tudo no jogo)

| Campo | Valor |
| --- | --- |
| **Status** | `integrado` |
| **Branch produto** | `main` @ `8ccd405` (= `origin/main`) |
| **Working tree** | limpa |

### O que entrou no jogo (main + push)

| Origem | Conteúdo | Commits |
| --- | --- | --- |
| Enxame bugs | Lab revise → laboratory + testes | `616779f` |
| Enxame / coletor | Ledger + classificação | `02fcaaa`, `84d0265` |
| Agentes (hitbox / launcher) | player-body, flame-contact, flame-render, hud-format, marketing, citadel workshop | `3e73ba9` |
| Agentes (FX flame) | sheets arc-flare, sem HUD laranja sobre flame | `e3830ec`, `361af80` |
| Agentes + consolidação | frames flame, creative-workshop, receipts áudio | `8ccd405` |

### Branches do enxame

- `swarm/bombpvp/bugs-integracao` → alinhada com `main` (ff)
- `swarm/bombpvp/bugs` → merge de `main` (resolve ledger; sem WIP pendente)

### Evidência

- `npx vitest run` (flame-contact, player-body, app, game-assets, bomb-explosions): **127 passed**
- `git push origin main` → `8ccd405` publicado (Cloudflare a partir da main)

### Pendente

- Nenhum WIP local de agentes no momento da consolidação
- Próximas rodadas do executor podem caçar bugs novos com tree limpa
