# Indice

## Onde esta cada coisa

| Caminho | Conteudo |
| --- | --- |
| `GameMechanics/src/` | Unica engine executavel: contratos, kernel, regras, skills, bots e adaptador de browser. |
| `GameMechanics/content/` | Ponte explicita entre a engine e o conteudo canonico preservado. |
| `GameMechanics/assets/` | Assets compartilhados da arena, gameplay, HUD, marca e audio. |
| `GameMechanics/tests/` | Contratos e testes deterministas da engine. |
| `Champions/` | Elenco canonico, identidades estaveis, definicoes, apresentacao, perfis de bots e assets finais. |
| `index.html` | Entrada principal que carrega diretamente a GameMechanics. |
| `GameMechanics/index.html` | Entrada multipagina equivalente para desenvolvimento e compatibilidade. |
| `public/` | Favicons e metadados estaticos do site. |

Nao existe segunda engine, launcher legado, Lab, runtime online ou Worker neste tree.

## Quando ler

| Documento | Condicao |
| --- | --- |
| `README.md` | Ao chegar sem contexto do produto ou da stack. |
| `docs/gameplay.md` | Ao alterar arena, bots, controles ou contrato de URL. |
| `docs/sprites.md` | Ao criar, regenerar ou plugar Champion. |
| `docs/release.md` | Ao alterar build, dominios ou publicacao. |
| `Champions/README.md` | Ao alterar o conteudo canonico de Champion. |
| `GameMechanics/ARCHITECTURE.md` | Ao alterar ownership, kernel ou fronteiras da engine. |
