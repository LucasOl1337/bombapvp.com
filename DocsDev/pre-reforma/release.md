# Publicacao

SOMENTE ao alterar build, dominios ou publicacao.

- Node.js 22+.
- `npm run check` valida tipos, os testes da GameMechanics e o build Vite.
- Entradas Vite: `index.html` e `GameMechanics/index.html`.
- Artefato estatico: `dist/`.
- Dominios do mesmo build: `bombapvp.com` e `bombpvp.com`.
- O repositorio nao contem Worker, broker ou segredo de deploy.
- O fluxo conectado ao branch `main` publica o build estatico; push/deploy exige ordem explicita do dono.
