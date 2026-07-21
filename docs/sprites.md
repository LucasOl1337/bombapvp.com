# Sprites e personagem

SOMENTE ao criar, regenerar ou plugar personagem.

## Meta do jogo (nao invente kit de fighter)

| Acao | Slot | Regra |
| --- | --- | --- |
| Parado | `idle` | loop |
| Andar | `walk` (`run` se existir) | loop; 4 direcoes reais |
| Ultimate | `ultimate` (ou `cast`) | uma skill por personagem; `ultimate` tem prioridade se existir |
| Plantar bomba | `attack` | so gesto de corpo — **sem bomba no PNG** |
| Morte | `death` | hold no ultimo frame |

Bomba e entidade do mundo (`props.bomb`). PNG com bomba baked = double-draw.

## Naming (loader)

Em `Champions/<slug>/assets/animations/`:

```text
{idle|walk|run|cast|ultimate|attack|death}-{north|south|east|west}-{n}.png
north.png | south.png | east.png | west.png
```

Retrato: `Champions/<slug>/assets/portrait.png`.
Parser: `createChampionAssets` em `Champions/assets.ts`. Ordene frames pelo indice do filename de origem, nunca pela URL hasheada do Vite.

## Direcoes e alpha (retrabalho real)

- South / east / north / west precisam de arte **diferente** (frente, perfil, costas). West pode espelhar east se simetrico. Proibido copiar south para todas as dirs.
- Engine (`SpriteTrimCache`) so ignora pixel com **alpha === 0**. Fundo preto opaco vira caixote preto no tile.
- Key de fundo: fuzz baixo (~2%), flood a partir dos 4 cantos. Fuzz alto come armadura/cabelo escuro.
- Resize final tipico: 124×124 centrado (ou o `size` do Champion).

## O que entra no Git

- Finais em `Champions/<slug>/assets/` + codigo/testes + README/DESIGN/manifest/checksums/receitas.
- Brutos (video, bases opacas, frames temporarios) ficam locais em `experiments/` ou `rebuild/`; o `.gitignore` ja bloqueia binarios e libera so docs/manifests.
- Assets compartilhados da arena pertencem a `GameMechanics/assets/`; não duplique assets finais de Champion ali.

## Registrar no roster

1. Identidade em `Champions/membership.ts` (única fonte de slug/ID/skill ID).
2. Pasta `Champions/<slug>/` com `identity.ts`, `definition.ts`, `assets.ts` + PNGs finais.
3. Mecânica implementada exclusivamente em `GameMechanics/src/modules/skills/`.
4. Testes de conteúdo e mecânica em `GameMechanics/tests/`.

Detalhe estrutural: `Champions/README.md`.
