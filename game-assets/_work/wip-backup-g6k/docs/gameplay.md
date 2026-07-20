# Gameplay e Lab

SOMENTE ao alterar launcher, arena, bots, Lab ou contrato de URL.

## Entrada e URL

- `src/main.ts` monta o launcher. Em `/arena/`, faca navegacao de documento completo (isola o ciclo de vida do jogo).
- `arena/index.html` carrega `src/original-game/main.ts` → resolve `LaunchRequest` → `GameApp`.
- Contrato: `/arena/?mode=<modo>&character=<uuid>`.
  - `training` → 1 bot, modo `classic`.
  - `continuous` → 3 bots, modo `endless`.
  - `lab` → 2 a 4 competidores contiguos (`model1`…`model4`).
- Offline: `bot=bomb|pingo|v1|v2|v3`. Defaults se omitido: Bomb no treino, V1 na sala continua (codec omite o param nesses defaults). Lab local: `bot-bomb`, `bot-pingo`, `bot-v1`…`bot-v3`.

## Ownership de codigo

| Area | Onde |
| --- | --- |
| Ciclo de rodada / placar / termino | `src/original-game/Engine/match-cycle.ts` |
| Topologia de explosao | `src/original-game/Engine/bomb-explosions.ts` |
| Power-ups | `src/original-game/Gameplay/powerups.ts` |
| Policies de bot | `bot-contracts.ts` / `bot-runtime.ts` + catalogs |
| Personagens | modulo vertical em `Champions/<slug>/` — ver `Champions/README.md` |
| Assets compartilhados | `game-assets/` via `game-assets/index.ts` |
| Fallback generico de sprite | `public/Assets/Characters/Animations/default-players/` |

Nao mantenha segunda implementacao de regras para testes, bots ou Lab: `GameApp` projeta o autoritativo.

## Contrato de explosao

- A explosao da bomba causa dano somente no tick em que a bomba detona.
- Nesse tick, o impacto considera as posicoes autoritativas antes e depois do movimento, evitando que cruzar a borda entre `updatePlayers` e `updateBombs` escape do hit.
- Os `FlameState` mantidos por `FLAME_DURATION_MS` sao apenas o rastro visual da explosao e nao causam dano residual.
- Um jogador que estava seguro no instante da detonacao pode atravessar os tiles ainda animados sem morrer.
- Escudo, protecao de spawn e imunidade de skill sao avaliados no impacto instantaneo; a mesma explosao nao tenta atingir novamente quando a protecao termina.

## Laboratorio

- Browser so fala com `/api/lab/models` e `/api/lab/decision` (Worker → broker Node local → 9Router). Chaves e segredo interno nunca no navegador.
- Local: `npm run lab:broker` e `npm run lab:tunnel`.
- Durante partida lab: `window.get_lab_telemetry()` devolve snapshot JSON de leitura.
- 1 request em voo por competidor remoto; lane libera ao abortar/encerrar rodada; respostas obsoletas descartadas. Reflexo local de fuga nao cria bomba/detonacao/skill.
- Cada decisao carrega `requestId` ecoado; cliente rejeita eco errado. Erros publicos: `status`, `code`, `requestId`, `Retry-After` (teto local 30s).

## Gates de bot (promocao)

- V3: gate documentado no teste exige 10 vitorias exclusivas consecutivas em arena simetrica (V1+V2+V3 mesma personagem). Floor de compatibilidade no teste pode ser menor — promocao e o gate de 10, nao o floor.
- V2: gate headless de melhoria estrita vs V1; nao promova sem reconquistar o criterio no motor atual.
