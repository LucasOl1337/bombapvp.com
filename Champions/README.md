# Champions

Este é o módulo canônico dos personagens jogáveis do BombPVP. Cada personagem é um módulo vertical: identidade, metadados, skill, apresentação e assets ficam juntos na sua própria pasta.

## Estrutura

```text
Champions/
├── index.ts                 # API leve para launcher/catálogos
├── membership.ts            # fonte leve de slugs, IDs e skill IDs
├── catalog.ts               # projeção leve das definições descobertas
├── contracts.ts             # contratos públicos sem dependência do engine
├── runtime-contracts.ts     # estado e contrato genérico dos adapters
├── runtime.ts               # adaptadores de mecânica consumidos pelo engine
├── world-effects.ts         # união dos efeitos persistidos dos personagens
├── visual-runtime.ts        # adaptadores de apresentação/animação
├── assets.ts                # parser genérico dos bundles privados
├── assets-catalog.ts        # associação explícita ID → bundle pesado
├── ranni/
├── killer-bee/
├── crocodilo-arcano/
├── nico/
├── nix-ember/               # roster order 4 · Ember Vault
└── pendula/                 # roster order 5 · Command: Pull
```

Cada pasta de personagem contém:

- `definition.ts`: ID estável, nome, ordem do roster, slot padrão, textos, skill e cooldown;
- `skill.ts`: toda a mecânica exclusiva e seus hooks para o engine;
- `visuals.ts`: animação, preview, feedback e efeitos exclusivos;
- `assets.ts`: bundle tipado do retrato, sprites e efeitos privados;
- `assets/portrait.png`, `assets/animations/*.png` e `assets/effects/*.png`: arquivos físicos privados do personagem;
- `README.md`: mapa rápido do módulo.

Cada `skill.ts` deve expor o menor contexto estrutural que sua mecânica realmente usa. O `SkillContext` completo continua sendo fornecido pelo engine, mas não deve virar dependência acidental de testes e funções proprietárias.

## Limite de ownership

Código fora de `Champions/` pode fornecer serviços genéricos — colisão, grid, bombas, áudio, canvas, timers e contexto de skill — mas não deve conhecer IDs, nomes, cooldowns, desenhos ou regras de um personagem concreto. O engine chama `runtime.ts` e `visual-runtime.ts` por contratos genéricos; efeitos persistidos usam a união `ChampionWorldEffect` de `world-effects.ts`.

As policies de bot continuam no módulo de bots porque decidem *quando* usar uma capacidade. Elas importam IDs e constantes do Champion e não implementam a capacidade. A execução e as regras da capacidade continuam exclusivamente na pasta do personagem.

`public/Assets/Characters/Animations/default-players/` é o fallback genérico do engine. Não representa nenhum Champion canônico. `_legacy/` guarda material sem personagem canônico atribuído e nunca é importado em runtime.

Pacotes experimentais que pertencem inequivocamente a um personagem podem permanecer localmente em `Champions/<slug>/experiments/` ou `rebuild/`, mas o Git normal guarda apenas manifests, documentação, checksums, receitas e assets finais. Binários brutos ficam locais (ver `docs/sprites.md`). Nix Ember está no roster ao vivo; apenas seu `experiments/lab-pack/` permanece um pacote-fonte de revisão, cujo manifesto `notLiveRoster: true` indica que o runtime não carrega diretamente o material bruto do laboratório.

## APIs

- Aplicação/launcher: importar de `Champions/index.ts`.
- Membership canônico: `Champions/membership.ts` contém somente slug, ID e skill ID; não importa runtime ou assets.
- Engine de mecânicas: importar de `Champions/runtime.ts`.
- Render e animação: importar de `Champions/visual-runtime.ts`.
- Bundles pesados de sprites: o engine importa de `Champions/assets-catalog.ts`; o launcher não deve importar esse arquivo.
- Um personagem específico: importar do arquivo dentro da pasta proprietária.

`index.ts` não reexporta runtime ou apresentação: isso impede o launcher de carregar dependências do engine acidentalmente.

## Adicionando um personagem

**Antes de gerar arte ou frames**, leia `docs/sprites.md` (direções reais, alpha/transparente, plant sem bomba, naming do loader).

1. Adicione uma identidade em `membership.ts`; esse é o único registro raiz de pertença.
2. Crie `Champions/<slug>/` usando a estrutura acima.
3. Coloque retrato e animações finais dentro de `assets/` (PNG transparente; 4 dirs reais).
4. Exporte `CHAMPION_DEFINITION`, `CHAMPION_SKILL_ADAPTER`, `createChampionVisualAdapter` e `CHAMPION_ASSET_ENTRY` nos arquivos proprietários; as projeções raiz os descobrem sem misturar o launcher leve com bundles pesados.
5. Implemente a ultimate e os visuals na própria pasta.
6. Adicione testes do membership, contagem de assets e comportamento específico.
7. Confirme que nenhuma busca por nome/ID do novo personagem aparece no engine genérico.
