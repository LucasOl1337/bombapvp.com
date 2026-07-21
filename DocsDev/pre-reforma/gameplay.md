# Gameplay

SOMENTE ao alterar arena, bots, controles ou contrato de URL.

## Entrada e URL

A raiz (`index.html`) e `/GameMechanics/` carregam `GameMechanics/src/browser/main.ts`. Nao existe launcher ou segunda engine.

Parametros aceitos:

- `p1=<slug|uuid>` — Champion do P1.
- `p2=<slug|uuid>` — Champion do P2.
- `char1=<slug|uuid>` e `char2=<slug|uuid>` — aliases de compatibilidade.
- `bot=bomb|pingo|v1|v2|v3` — ativa P2 bot e escolhe o perfil canonico; o Champion associado e selecionado quando P2 nao foi informado explicitamente.
- `control2=bot` — ativa P2 bot com o perfil padrao.
- `p2=bot` e `bot=1` — aliases legados; resolvem para o perfil padrao.
- `skipSelect=1` — inicia sem abrir a selecao de Champions.
- `dev=1` — abre diagnosticos do adaptador.

Os perfis preservados sao Bomb, Pingo, V1, V2 e V3. Sua identidade e associacao com Champion usam slug, UUID e skill ID estaveis em `Champions/bots.ts`, nunca indice numerico de roster.

## Ownership

| Area | Onde |
| --- | --- |
| Ciclo competitivo, explosoes, locomocao, power-ups e pressao | `GameMechanics/src/` |
| Skills executaveis | `GameMechanics/src/modules/skills/` |
| Bot deterministico e adaptacao para comandos | `GameMechanics/src/bots/` |
| Identidade canonica dos bots | `Champions/bots.ts` |
| Elenco, definicoes e apresentacao | `Champions/` |
| Assets compartilhados | `GameMechanics/assets/` |
| Adaptador jogavel | `GameMechanics/src/browser/` |
| Testes | `GameMechanics/tests/` |

## Controles locais

- P1: `WASD`, `Q` para bomba e `Espaco`/`R` para skill.
- P2 humano: setas, `O` para bomba e `I` para skill.
- `Esc`: pausa; `T`: reinicia; `M`: som.

A simulacao avanca em ticks fixos de 20 ms. Bots observam somente o snapshot congelado e produzem `GameCommand[]`; nao recebem acesso privilegiado ao kernel.
