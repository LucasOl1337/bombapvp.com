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
| **Status** | `precisa humano` |
| **Bug escolhido** | (nenhum — rodada bloqueada) |
| **Fluxo** | n/a |
| **Branch** | `swarm/bombpvp/bugs` (recriada nesta rodada) |
| **Arquivos de fix** | nenhum |

### Reprodução / diagnóstico

- **Passos:** `git branch --show-current` + `git status -sb` + `git branch -a`.
- **Esperado:** branch `swarm/bombpvp/bugs` existente, tree limpa (ou só trabalho deste enxame), ledger na raiz.
- **Observado:**
  1. Checkout estava na `main`; **não existia** `swarm/bombpvp/bugs` (nem remota).
  2. Ledger `SwarmLedger-bugs.md` ausente em todo o histórico atual do repo.
  3. Working tree suja com WIP de **outro assunto** (engine/assets: `game-app`, flame, player-body, citadel, testes, workshop, etc.).
  4. Fix da rodada 005 parece já estar na `main` (`616779f fix(app): lab revise returns to laboratory, not character select`).
- **Impacto:** não é seguro caçar/corrigir bug novo sem misturar com WIP alheio; `AGENTS.md` proíbe stash/reset/clean neste checkout.

### Ação do executor

1. Recriou `swarm/bombpvp/bugs` a partir de `main` (HEAD limpo de commits novos do enxame; WIP sujo viajou na working tree).
2. Recriou este ledger com histórico resumido + rodada 006.
3. **Não** editou código de produto.
4. Commit local **apenas** do ledger.

### Ação humana necessária

1. Isolar o WIP atual em branch(es) do assunto em andamento.
2. Deixar working tree limpa **ou** só com trabalho deste enxame.
3. Manter `swarm/bombpvp/bugs` (não apagar) e o ledger na raiz.
4. Próxima execução do executor: 1 bug de uso diário ainda não coberto (launcher, seleção, treino, plant/explodir, movimento, HUD, match flow — lab revise já coberto).

### Entrega

- Bug: bloqueado
- Arquivos: `SwarmLedger-bugs.md`
- Evidência: branch enxame inexistente + tree suja na recriação
- Branch: `swarm/bombpvp/bugs`
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
| Rodada 005 — lab `back-to-selection` → laboratory | `pronto para consolidar` **já na main** | Código e teste já estão em `616779f` na `main` e na base desta branch. **Não** foi necessário cherry-pick extra de produto. |
| Rodada 006 — recriação branch + ledger | `incompleto` (sem fix de produto) / ledger `consolidado` | Cherry-pick do ledger `c4648b9` → `02fcaaa` nesta branch. |
| WIP sujo na working tree (flame, player-body, citadel, view, etc.) | `fora de escopo` + `precisa humano` | **Não** integrado. Outro assunto; proibido misturar. |

### O que entrou em `bugs-integracao`

1. Base `main` (inclui fix 005).
2. Ledger do enxame (cherry-pick) + esta seção do coletor.
3. **Nenhum** commit de Performance / Landing / Visual / Ready To Ship / Documentação / Geral.

### O que ficou pendente

1. Isolar WIP alheio da working tree (bloqueia executor e polui validação).
2. Novos bugs de uso diário (launcher, seleção, treino, plant, HUD, match) — ainda sem entrega de produto além do lab revise.
3. Não apagar `swarm/bombpvp/bugs` nem o ledger na raiz.

### Evidência de teste

- `npx vitest run tests/app.test.ts` na working tree atual: **4 failed / 15 passed**.
- Falhas: `ReferenceError: CITADEL_BREACH_VISUALS is not defined` em `src/app/view.ts` (arquivo **modificado e não commitado** — WIP alheio, diff ~4 linhas + refs a marketing citadel).
- Código **commitado** do fix 005 está presente em HEAD (`state.ts` trata `bot-vs-bot-lab`; `app.test.ts` tem o caso de regressão do lab). Falha de suite **não** refuta o fix; reflete contaminação de WIP.
- Revalidar `tests/app.test.ts` com tree limpa após isolamento humano do WIP.

### Entrega do coletor

- Avaliado: branch bugs + ledger
- Consolidado: ledger + reconhecimento do fix 005 já na main/base
- Pendente / precisa humano: WIP alheio + ausência de novos fixes
- Branch: `swarm/bombpvp/bugs-integracao`
- Commits locais: `02fcaaa` (ledger do executor) + commit desta seção do coletor
- **Sem** push / PR / merge para `main`
