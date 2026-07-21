# Bomba PvP

Jogo competitivo de arena para navegador, com simulacao deterministica em TypeScript.

`GameMechanics/` e a unica engine executavel do repositorio. `Champions/` mantem o elenco canonico, identidades, metadados de apresentacao, perfis de bots e assets finais.

**Stack:** TypeScript, Vite e Vitest.

**Dominios:** `bombapvp.com` e `bombpvp.com` — mesmo build.

## Comandos

```text
npm run dev        # Vite local
npm run typecheck  # contratos TypeScript
npm test           # testes da GameMechanics
npm run build      # build de producao
npm run check      # typecheck + testes + build
```

A entrada raiz e `index.html`; o adaptador jogavel esta em `GameMechanics/src/browser/main.ts`.

Roteamento de leitura: `INDEX.md`.
