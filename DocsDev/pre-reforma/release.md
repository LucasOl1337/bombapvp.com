# Publicacao

- Use Node.js 22 ou superior.
- Rode `npm run check` para validar tipos, testes e o build multipagina.
- Rode `npm run check:cloudflare` para validar o pacote do Worker sem publicar.
- Use `npm run deploy:cloudflare` para publicacao manual.
- Mantenha `index.html` e `arena/index.html` como entradas do Vite.
- Mantenha `dist/` como diretorio de assets servido por `wrangler.jsonc`.
