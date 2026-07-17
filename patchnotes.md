# Patch notes


<!-- safe-commit-audit:2026-07-17 -->
## Auditoria de patch — 2026-07-17

### Objetivo e janela

Este registro foi produzido antes do *safe commit* solicitado. A janela de atividade cobre as **500 horas anteriores a 2026-07-17T10:13:58-03:00**. A comparação usa o checkout deste PC e, quando disponível, as referências do GitHub atualizadas com `git fetch --prune`; nenhum deploy foi executado por esta auditoria.

### Estado comparativo PC ↔ GitHub

| Campo | Valor |
| --- | --- |
| Projeto | Bomba PvP |
| Checkout canônico | `C:\projetos\bombpvp` |
| Branch local | `main` |
| HEAD local auditado | `99f0b44b9181` (2026-07-17T05:22:23-03:00) |
| Origin | `https://github.com/LucasOl1337/bombapvp.com.git` |
| Upstream | `origin/main` |
| HEAD remoto observado | `418347d32cd2` |
| Divergência antes do safe commit | **2 atrás / 0 à frente** |
| Entradas alteradas locais | **22** (16 versionadas; 6 não rastreadas) |

**Classificação operacional:** Checkout canônico; worktrees paralelas foram inventariadas e serão conciliadas antes da publicação.

### Alterações locais ainda não consolidadas no snapshot

- `docs/gameplay.md                           |    2 +-`
- ` package-lock.json                          |   10 +`
- ` package.json                               |    1 +`
- ` src/app/catalog.ts                         |    7 +`
- ` src/app/state.ts                           |   36 +-`
- ` src/app/view.ts                            |  436 +++++++-`
- ` src/lab/competitors.ts                     |   42 +-`
- ` src/original-game/Engine/bot-pingo.ts      |  150 ++-`
- ` src/original-game/Engine/game-app.ts       |  221 ++++-`
- ` src/original-game/main.ts                  |   53 +-`
- ` src/styles.css                             | 1478 ++++++++++++++++++++++++++++`
- ` tests/app.test.ts                          |   43 +-`
- ` tests/bot-pingo-decision.test.mjs          |  336 +++++++`
- ` tests/bot-pingo-development.test.mjs       |   30 +`
- ` tests/ranni-bomb-egress-engine.test.mjs    |  229 ++++-`
- ` tests/rival-body-bomb-egress-unit.test.mjs |    3 +-`
- ` 16 files changed, 2931 insertions(+), 146 deletions(-)`

#### Arquivos não rastreados visíveis

- `.openai/`
- `src/app/arena-field.ts`
- `src/original-game/Engine/bot-catalog.ts`
- `src/original-game/Engine/bot-registry.ts`
- `tests/local-bot-registry.test.mjs`
- `tests/player-flame-occlusion-feedback.test.mjs`

#### Alterações já em stage antes desta auditoria

- Nenhuma alteração previamente em stage.

### Commits locais ainda ausentes do upstream

- Nenhum commit neste recorte.

### Commits do upstream ainda ausentes do checkout local

- `418347d` — 2026-07-17T07:14:01-03:00 — **LucasOl1337** — fix: keep lethal flames visible through players
- `8357929` — 2026-07-17T06:24:22-03:00 — **LucasOl1337** — fix: handle Ranni kick egress and remote threats

### Controles de segurança e concorrência

- A cópia canônica foi escolhida antes de integrar qualquer workspace paralelo.
- Worktrees, clones temporários, diretórios de deploy, caches e dependências aninhadas não são publicados como projetos independentes.
- Nenhum caminho cujo nome contenha o item da block list foi alterado, criado ou selecionado para stage por esta rotina.
- Segredos, credenciais, bancos de runtime, WAL/SHM, sessões de navegador, caches, `.env`, `.openai`, `.obsidian` e metadados locais devem permanecer fora do commit, salvo se já forem artefatos públicos intencionais e versionados.
- A publicação só pode ocorrer após conciliar divergência do upstream e executar os checks disponíveis do projeto.

### Resultado esperado do patch

1. Preservar o trabalho local útil sem apagar alterações de outros agentes.
2. Incorporar mudanças remotas compatíveis, resolvendo conflitos pela intenção comprovada em testes e histórico.
3. Criar um commit rastreável com data e estado.
4. Fazer push apenas para remoto com permissão de escrita e branch segura.
