# Sprites e personagem

SOMENTE ao criar, regenerar ou plugar personagem.

## Meta do jogo (nao invente kit de fighter)

| Acao | Slot | Regra |
| --- | --- | --- |
| Parado | `idle` | loop |
| Andar | `walk` (`run` se existir) | loop; 4 direcoes reais |
| Ultimate | `cast` | uma skill por personagem |
| Plantar bomba | `attack` | so gesto de corpo — **sem bomba no PNG** |
| Morte | `death` | hold no ultimo frame |

Bomba e entidade do mundo (`props.bomb`). PNG com bomba baked = double-draw.

## Naming (loader)

Em `Champions/<slug>/assets/animations/`:

```text
{idle|walk|run|cast|attack|death}-{north|south|east|west}-{n}.png
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
- Nao coloque experimento de personagem em `game-assets/` (la e so asset compartilhado tipado).

## Registrar no roster

1. Identidade em `Champions/membership.ts` (unica fonte de slug/ID/skill ID).
2. Pasta `Champions/<slug>/` com `definition.ts`, `skill.ts`, `visuals.ts`, `assets.ts` + PNGs.
3. Exports canonicos descobertos pelas projecoes; launcher importa so `Champions/index.ts` (leve).
4. Testes: `tests/character-catalog.test.ts`, `tests/champions-module.test.ts`, `tests/character-runtime-roster.test.mjs`.

Detalhe estrutural: `Champions/README.md`.
