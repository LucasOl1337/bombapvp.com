# Indice

## Onde esta cada coisa

| Caminho | Conteudo |
| --- | --- |
| `src/app/` | Estado, catalogo e interface do launcher. |
| `Champions/` | Modulos verticais e assets privados dos personagens, incluindo Nix Ember no roster ao vivo e seus pacotes-fonte de laboratorio. Consulte `Champions/README.md`. |
| `src/matches/` | Contrato puro de launch request e adaptador de URL entre launcher e arena. |
| `src/lab/` | Cliente, observacao, runtime, telemetria e adapters do Laboratorio. |
| `src/original-game/` | Motor original, bots e regras genericas da arena; consome Champions por adapters. |
| `src/original-game/Engine/match-cycle.ts` | Ciclo autoritativo puro de rodada, placar, cronometro e resultado. |
| `src/original-game/Engine/bomb-explosions.ts` | Resolucao autoritativa pura de alcance, bloqueios, caixas e reacoes em cadeia das explosoes. |
| `src/original-game/Gameplay/tile-key.ts` | Codec canonico da identidade textual de tiles, reexportado por `Arenas/arena.ts`. |
| `src/original-game/Engine/bot-contracts.ts` e `bot-runtime.ts` | Seam comum de policies e lifecycle dos bots locais/remotos. |
| `docs/benchmarks/` | Experimentos datados de latencia e performance dos bots. |
| `BOTS/CuriosidadesHistoricas.md` | Registro numerado de comportamentos emergentes e episodios memoraveis dos bots. |
| `BOTS/DevHistory/` | Post-mortems e historico das tentativas de desenvolvimento dos bots. |
| `game-assets/` | Assets compartilhados do jogo que nao pertencem a um Champion. |
| `public/Assets/Characters/Animations/default-players/` | Sprites genericos de fallback do engine. |
| `arena/` | Documento HTML isolado da gameplay. |
| `tests/` e `vitest.config.ts` | Contratos rapidos, testes de UI e gates longos separados por projeto. |
| `vite.config.ts` e `wrangler.jsonc` | Build multipagina e publicacao Cloudflare. |

## Quando ler

| Documento | Condicao |
| --- | --- |
| `README.md` | SOMENTE ao chegar sem contexto do produto ou da stack. |
| `docs/gameplay.md` | SOMENTE ao alterar launcher, selecao, arena, bots, personagens ou assets. |
| `docs/design-system.md` | Ao criar ou refatorar qualquer interface, HUD, animacao ou componente visual. |
| `docs/release.md` | SOMENTE ao alterar build, dominios ou publicacao. |
| `DocsDev/` | SOMENTE para consulta historica pontual; nao use como fonte de verdade. |
| `DocsDev/arquivados/` | NUNCA leia. |
