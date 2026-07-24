# Patch Notes — bombpvp (bombapvp.com)

**Data:** 2026-07-24
**Estado do commit:** `(2026-07-24)+(merged-upstream) safe commit`
**Repositório:** https://github.com/LucasOl1337/bombapvp.com
**Branch:** `main`

---

## Resumo executivo

Este ciclo foi dominado por uma **reconciliação entre duas linhas de trabalho paralelas**
que evoluíram sobre a mesma base (`1c5fc80`) sem se enxergarem:

- **Linha remota (GitHub):** 6 commits mesclados via PR (#21 → #26) — laboratório de IA,
  bot mastery determinístico, Ice Blink da Ranni e o slice vertical completo do Zed.
- **Linha local (este PC):** trabalho não commitado sobre Ranni Ice Blink e apresentação
  dual-body, além de um site novo (`Site/`).

O clone local estava **6 commits atrás** do `origin/main`. A sincronização foi feita por
`stash + pull --rebase + stash pop`, gerando **8 arquivos em conflito**.

---

## Sincronização e resolução de conflitos

### Commits trazidos do GitHub

| Commit | Descrição |
|---|---|
| `dc5b0ba` | feat: rebuild Zed animations and Living Shadow (#26) |
| `df31474` | feat(Champions): add playable Zed Living Shadow vertical slice (#25) |
| `c7e3c6c` | feat(GameMechanics): add Zed Living Shadow mechanics (#24) |
| `360d884` | feat(GameMechanics): add deterministic bot mastery (#23) |
| `cfd534d` | feat(GameMechanics): integrate Ranni's wall-phasing Ice Blink (#22) |
| `90bb56e` | feat(GameMechanics): restore bot-vs-bot AI laboratory (#21) |

### Conflitos e como foram resolvidos

Foram 8 arquivos com conflito, sendo `main.ts` o mais severo (**37 hunks**):

| Arquivo | Hunks | Resolução |
|---|---|---|
| `GameMechanics/src/browser/main.ts` | 37 | upstream |
| `GameMechanics/tests/browser-visual-adapter.test.ts` | 3 | upstream |
| `GameMechanics/src/browser/styles.css` | 2 | upstream |
| `GameMechanics/src/modules/skills/index.ts` | 2 | upstream |
| `docs/gameplay.md` | 2 | upstream |
| `Champions/ranni/README.md` | 1 | upstream |
| `GameMechanics/src/browser/champion-animation-selection.ts` | 1 | upstream |
| `GameMechanics/tests/champion-animation-selection.test.ts` | 1 | upstream |

**Critério da decisão (importante):** a resolução *não* foi um "escolhe o remoto por
padrão". A investigação mostrou que o trabalho local sobre Ranni **já havia sido
incorporado e refinado** no PR #22, de forma mais geral:

- O local usava a constante específica `RANNI_ICE_BLINK_SKILL_ID` para decidir a projeção;
  o upstream generalizou isso para o conjunto `DUAL_BODY_PROJECTION_SKILL_IDS`, que
  contempla Ranni **e** Zed. O upstream é superconjunto.
- O local introduzia `holdFrameIndex` (pose fixa por índice de frame). O upstream
  **removeu deliberadamente** essa abordagem e possui um teste que a proíbe
  explicitamente: `expect(main).not.toContain("holdFrameIndex")` em
  `browser-visual-adapter.test.ts:276`. Manter o lado local quebraria a suíte.
- Todos os 6 arquivos que o git conseguiu auto-mesclar resolveram **idênticos ao HEAD**,
  confirmando que a linha local era um ancestral funcional da remota.

Dois refinamentos locais foram descartados por consequência dessa decisão e ficam
registrados aqui para eventual reintrodução consciente:

1. `holdFrameIndex` / `RANNI_FROZEN_ULTIMATE_FRAME` — pose congelada da ultimate.
   Rejeitado por contrato de teste do upstream.
2. Rótulo de acessibilidade do roster localizado
   (`isEnglish ? "P1 roster" : "Personagens do P1"`). O upstream mantém o rótulo fixo em
   inglês. É uma regressão pequena de i18n — vale reabrir como issue.

---

## Trabalho local preservado

- **`Site/`** — site novo e independente (Vite + TS), com `index.html`, `champions.html`,
  `guia.html`, `arena-preview`, assets de champions e favicons. Não conflita com o
  `GameMechanics/` e entra íntegro neste commit.
- **`output/`** — 2 artefatos de journey map (~0,1 MB).

---

## Verificação executada

Ao contrário de um "safe commit" às cegas, o resultado do merge foi validado:

```
npm run typecheck   → OK, sem erros (tsc --noEmit)
npm test            → 14 arquivos de teste, 224/224 testes passando (17,81s)
```

Isso inclui as suítes novas do upstream (`zed-living-shadow-presentation`,
`zed-sprite-assets`, `bot-mastery`, `browser-bot-drivers`) rodando sobre a árvore
mesclada.

---

## Comparação PC local × GitHub

| Antes | Depois |
|---|---|
| local 6 commits atrás de `origin/main` | local sincronizado com `origin/main` |
| 14 arquivos modificados sem commit | conflitos resolvidos, árvore limpa |
| `Site/` e `output/` não versionados | versionados |
| Zed ausente do clone local | Zed Living Shadow presente e testado |
