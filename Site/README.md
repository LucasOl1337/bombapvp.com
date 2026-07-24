# Site

Landing page e site institucional do Bomba PvP. **Isolado do runtime do jogo**: build,
`package.json` e `tsconfig.json` proprios; nada aqui entra no bundle de `GameMechanics/`.

## Rodar

```bash
cd Site
npm install
npm run dev      # http://localhost:4321
npm run build    # typecheck + build em Site/dist
npm run preview
```

## Estrutura

| Caminho | Conteudo |
| --- | --- |
| `index.html` | Landing (hero, preview, bento, elenco, precos, FAQ, CTA). |
| `champions.html` | Pagina de elenco com ultimate, cooldown e link de partida. |
| `guia.html` | Controles, modos, parametros de URL e perfis de IA. |
| `src/components/` | Secoes e componentes reutilizaveis. |
| `src/data/` | Conteudo tipado — champions e copy. |
| `src/styles/` | `base.css` (tokens/fundo), `glass.css` (primitivos), `sections.css`. |
| `src/ui/` | Template tag `html`, icones e interacoes. |
| `public/champions/` | Copias dos retratos de `Champions/<slug>/assets/portrait.png`. |

## Contrato de conteudo

`src/data/champions.ts` **espelha** `Champions/<slug>/definition.ts` (locale pt-BR) em vez de
importar o runtime — o site nao depende da engine. Ao alterar o elenco, atualize os dois lados.

Os retratos em `public/champions/` sao copias; regenere com:

```bash
cp ../Champions/<slug>/assets/portrait.png public/champions/<slug>.png
```

## Links para o jogo

`src/data/content.ts` define `arenaUrl`, `trainingUrl` e `labUrl` apontando para a raiz do
dominio (onde a arena e publicada). Em `npm run dev` do site esses links saem do escopo do
servidor de preview — rode `npm run dev` na raiz do repositorio para testar a arena.
