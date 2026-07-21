# Publicacao

SOMENTE ao alterar build ou publicacao.

Requer Node.js 22 ou superior.

```text
npm run check
```

O comando valida tipos, testes e build. As entradas Vite sao `index.html` e `GameMechanics/index.html`; o artefato fica em `dist/`.

Push na `main` publica o mesmo jogo em `bombapvp.com` e `bombpvp.com`. O repositorio nao contem staging separado nem segredo de deploy.
