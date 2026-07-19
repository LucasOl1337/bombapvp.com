# Indice

## Onde esta cada coisa

| Caminho | Conteudo |
| --- | --- |
| `src/app/` | Launcher: estado, catalogo e UI. |
| `src/matches/` | Contrato de launch request e adaptador de URL. |
| `src/lab/` | Cliente, runtime e telemetria do Laboratorio. |
| `src/original-game/` | Motor, bots e regras genericas da arena. |
| `Champions/` | Modulos verticais e assets privados dos personagens. |
| `game-assets/` | Assets compartilhados tipados (nao pertencem a um Champion). |
| `public/Assets/Characters/Animations/default-players/` | Sprites genericos de fallback do engine. |
| `arena/` | HTML isolado da gameplay. |
| `lab-broker/` | Broker Node local do Lab (chaves ficam aqui, nunca no browser). |
| `worker/` | Worker Cloudflare que faz proxy do Lab. |
| `tests/` | Contratos, UI e gates (ver `vitest.config.ts`). |
| `vite.config.ts`, `wrangler.jsonc` | Build multipagina e publicacao Cloudflare. |

## Quando ler

| Documento | Condicao |
| --- | --- |
| `README.md` | SOMENTE ao chegar sem contexto do produto ou da stack. |
| `docs/gameplay.md` | SOMENTE ao alterar launcher, arena, bots, Lab ou contrato de URL. |
| `docs/sprites.md` | SOMENTE ao criar, regenerar ou plugar personagem (sprites, alpha, plant, roster). |
| `docs/release.md` | SOMENTE ao alterar build, dominios ou publicacao. |
| `Champions/README.md` | SOMENTE ao mexer no modulo vertical de personagem. |
| `game-assets/README.md` | SOMENTE ao adicionar asset compartilhado. |
| `DocsDev/` | SOMENTE consulta historica pontual; nao e fonte de verdade. |
| `DocsDev/arquivados/` | NUNCA leia. |
