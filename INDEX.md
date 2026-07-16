# Indice

## Onde esta cada coisa

| Caminho | Conteudo |
| --- | --- |
| `src/app/` | Estado, catalogo e interface do launcher. |
| `src/original-game/` | Motor original, bots, personagens e regras da arena. |
| `public/Assets/` | Sprites, mapas, audio e demais assets do jogo. |
| `arena/` | Documento HTML isolado da gameplay. |
| `tests/` | Testes automatizados do launcher e das rotas. |
| `vite.config.ts` e `wrangler.jsonc` | Build multipagina e publicacao Cloudflare. |

## Quando ler

| Documento | Condicao |
| --- | --- |
| `README.md` | SOMENTE ao chegar sem contexto do produto ou da stack. |
| `docs/gameplay.md` | SOMENTE ao alterar launcher, selecao, arena, bots, personagens ou assets. |
| `docs/release.md` | SOMENTE ao alterar build, dominios ou publicacao. |
| `DocsDev/` | SOMENTE para consulta historica pontual; nao use como fonte de verdade. |
| `DocsDev/arquivados/` | NUNCA leia. |
