# Publicacao

SOMENTE ao alterar build, dominios ou publicacao.

- Node.js 22+.
- `npm run check` — tipos, testes e build multipagina.
- `npm run check:cloudflare` — valida o pacote do Worker sem publicar.
- `npm run deploy:cloudflare` — publicacao manual (so com ordem do dono).
- Entradas Vite: `index.html` e `arena/index.html`.
- Assets servidos: `dist/`, configurado em `wrangler.jsonc`.
- Dominios do mesmo deploy: `bombapvp.com` e `bombpvp.com`.
- Lab em producao: `LAB_BROKER_URL` aponta para o broker; `LAB_BROKER_SECRET` e secret do Worker (nunca no repo).
