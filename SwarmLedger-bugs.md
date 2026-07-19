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

---

## Rodada 007 — 2026-07-18

| Campo | Valor |
| --- | --- |
| **Status** | `corrigido` |
| **Bug escolhido** | Launch offline: `character=` vazio / só espaços vira `""` em vez de ausente |
| **Fluxo** | treino / jogar / arena via URL (bookmarks, links, round-trip) |
| **Branch** | `swarm/bombpvp/bugs` |
| **Arquivos de fix** | `src/matches/launch-request.ts`, `tests/launch-request.test.ts` |

### Reprodução

- **Passos:**
  1. Abrir ou construir request com `mode=training&character=` ou `character=%20%20`.
  2. Passar por `launchRequestFromSearchParams` / `resolveLaunchRequest`.
  3. Serializar de volta com `launchRequestToSearchParams`.
- **Esperado:** personagem ausente (`null`); URL serializada **sem** parâmetro `character` (mesmo comportamento de omitir o campo).
- **Observado (antes):** `character` ficava `""`; serialize emitia `character=` e o token vazio poluía o contrato de launch (distinto de `null` no tipo e no round-trip).
- **Impacto:** URLs de treino/jogar compartilhadas ou geradas com placeholder vazio não normalizavam para o fallback canônico; inconsistência no request e no query string.

### Correção

- `normalizeCharacterId`: trim; vazio → `null`.
- Aplicado em `resolveLaunchRequest` no ramo offline.
- Teste de regressão: vazio, whitespace URL-encoded, resolve+serialize sem `character`.

### Evidência

- `npx vitest run tests/launch-request.test.ts tests/app.test.ts` → **30 passed**

### Entrega

- Bug: empty/whitespace character id treated as absent
- Arquivos: `src/matches/launch-request.ts`, `tests/launch-request.test.ts`, `SwarmLedger-bugs.md`
- Branch: `swarm/bombpvp/bugs`
- Commit local: (este commit)
- **Sem** push/PR/merge para main
- Nota: WIP residual de `game-assets/audio/workshop/` deixado intocado (outro assunto)

---

## Rodada 008 — 2026-07-18

| Campo | Valor |
| --- | --- |
| **Status** | `corrigido` |
| **Bug escolhido** | Lab game-launch: texto "Revisar personagem", linha " · Laboratório…", e `<img src="">` sem personagem |
| **Fluxo** | laboratório → iniciar match → tela Abrindo arena |
| **Branch** | `swarm/bombpvp/bugs` |
| **Arquivos de fix** | `src/app/view.ts`, `tests/app.test.ts` |

### Reprodução

- **Passos:**
  1. `/laboratorio` → Iniciar Bot vs Bot.
  2. Observar tela de game-launch.
- **Esperado:** sem personagem jogador; CTA de revisar a **configuração** do lab; escolha mostrando só o nome da experiência; sem imagem de personagem vazia.
- **Observado (antes):** botão "Revisar personagem" (não há personagem no lab), linha `" · Laboratório Bot vs Bot"`, portrait com `<img src="">`.
- **Impacto:** confunde o fluxo diário do lab (usuário procura personagem que não existe); a11y/perf com img vazia.

### Correção

- `renderGameLaunch`: se experiência é `bot-vs-bot-lab`, label "Revisar configuração" / "Review setup", choice só com nome do lab, portrait sem img se não há character.
- Offline (treino/jogar) inalterado: ainda usa `reviseLabel` e personagem · experiência.
- Teste de regressão no fluxo lab (atualiza botão e asserts de UI).

### Evidência

- `npx vitest run tests/app.test.ts` → **19 passed**

### Entrega

- Bug: lab launch copy/portrait
- Arquivos: `src/app/view.ts`, `tests/app.test.ts`, `SwarmLedger-bugs.md`
- Branch: `swarm/bombpvp/bugs`
- Commit local: (este commit)
- **Sem** push/PR/merge para main
- Audio workshop WIP intocado
