# Champion sprite pipeline (Grok / agentes)

Regras aprendidas ao integrar **Nix Ember** e experimentos de animação. Leia isto **antes** de gerar ou plugar um personagem novo.

## Modelo de jogo (não invente kit de ação)

Bomba PvP não é fighter de melee. Clips canônicos:

| Ação no jogo | Slot de animação | Notas |
| --- | --- | --- |
| Parado | `idle` | Loop |
| Andar | `walk` (e `run` se existir) | Loop; **4 direções** |
| Ultimate / skill | `cast` | One-shot ou loop curto no channel |
| Plantar bomba | `attack` (histórico do engine) | **Só gesto de corpo** |
| Morte | `death` | Hold no último frame |

- **Uma ultimate** por personagem (skill de movimento, controle de bomba ou sobrevivência — não kit de espada).
- **Plant nunca desenha bomba/pavio no PNG.** A bomba é entidade do mundo (`props.bomb`). Frame com bomba embutida = double-draw no deploy.

## Naming no disco (loader)

Arquivos em `Champions/<slug>/assets/animations/`:

```text
{idle|walk|run|cast|attack|death}-{north|south|east|west}-{n}.png
north.png | south.png | east.png | west.png   # estáticos
```

Retrato: `Champions/<slug>/assets/portrait.png`.

O parser é `createChampionAssets` em `Champions/assets.ts`. Ordenar frames pelo **índice do filename de origem**, nunca pela URL com hash do Vite.

## Direções (obrigatório no roster)

- **South / east / north / west** precisam de arte **realmente diferente** (frente, perfil, costas).
- **Proibido** copiar south para todas as dirs e chamar de “4 direções”.
- West pode ser **espelho horizontal** do east se o personagem for simétrico o suficiente.
- Gere bases por direção (image_edit a partir de um still canônico) e só então anime.

## Alpha / fundo (causa #1 de “quadrado preto” e visual “comido”)

O engine (`SpriteTrimCache`) só ignora pixels com **alpha === 0**.

| Errado | Certo |
| --- | --- |
| PNG com fundo preto **opaco** | Fundo **transparente** |
| Flood-fill / `-transparent black` com **fuzz alto (8–12%)** | Key só do **preto de fundo** com **fuzz baixo (~2%)** e flood-fill **a partir dos 4 cantos** |
| Comer armadura escura / cabelo preto no key | Conferir pixel central do corpo: **alpha = 1** e cor de armadura preservada |

Checklist pós-key (ImageMagick):

```text
mean alpha ~ 0.15–0.35 (personagem chibi em 124²)
corner alpha = 0
center body alpha = 1
```

Se o personagem “vira só fogo/olhos” no jogo, o key comeu a armadura escura — restaure backup e re-key com fuzz menor.

## Pipeline de geração recomendado

1. **Still canônico** hi-res (frente), identidade travada (edit-chain).
2. **Still N / E / W** a partir do canônico (perfil estrito / costas).
3. **Vídeo** (`image_to_video`) por direção: um motion simples, câmera fixa, fundo preto puro.
4. **Harvest** (`ffmpeg` fps=12) → escolher 4 idle + 8 walk (+ cast/attack).
5. **Key alpha** cuidadoso → resize centrado em **124×124** (ou o `size` do Champion).
6. Instalar em `Champions/<slug>/assets/`; material bruto fica em `Champions/<slug>/experiments/…`.

Não entregue no `assets/` frames de laboratório com fundo opaco ou resolução/video “sujo” sem passar pelo key.

## Módulo Champion (roster)

Seguir `Champions/README.md`:

1. `definition.ts` — id estável, nome, `roster.order`, skill id + cooldown, accent, textos.
2. `skill.ts` — adapter da ultimate (sem hardcode no `GameApp`).
3. `visuals.ts` — frames de cast durante channel, se precisar.
4. `assets.ts` + PNGs em `assets/`.
5. Registrar em `catalog.ts`, `runtime.ts`, `visual-runtime.ts`, `assets-catalog.ts`, `contracts.ts` (`CharacterId` / `CharacterSkillId`), `index.ts`.
6. Atualizar testes de catálogo/roster (`tests/character-catalog.test.ts`, `tests/champions-module.test.ts`, `tests/character-runtime-roster.test.mjs`).

Lab pack opcional: `experiments/lab-pack/` + validador em `src/shared/grok-character-package.ts` — **não** é o path que o engine carrega.

## Anti-padrões (Nix Ember / Killer Bee lab)

1. Ultimate de slash de espada quando o meta é bomba.
2. Bomba baked no plant.
3. South-only espelhado como “4 dirs”.
4. Fundo preto opaco → caixote preto no tile.
5. Fuzz alto no key → armadura sumiu, sprite “glitch”.
6. Ordenar frames pela URL hasheada do Vite.
7. Jogar experimento em `game-assets/` compartilhado (lá é só asset compartilhado tipado).

## Referências vivas

- Exemplo integrado: `Champions/nix-ember/`
- Lab source: `Champions/nix-ember/experiments/lab-pack/`
- Ownership geral: `Champions/README.md`, `docs/gameplay.md`
