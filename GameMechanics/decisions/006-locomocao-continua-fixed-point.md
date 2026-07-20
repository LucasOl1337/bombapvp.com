# Decision 006 — locomocao continua fixed-point

## Decisao

- O mundo usa 1024 unidades inteiras por tile e tick fixo de 20 ms.
- Posicao representa o centro do corpo; `tileOf(position)` e a unica derivacao de tile.
- Velocidade e o deslocamento inteiro aplicado no ultimo tick.
- A velocidade base e 64 unidades/tick: um tile em 16 ticks, ou 320 ms.
- O corpo e um AABB quadrado com half-extent 384. Contato exato nao conta como colisao ou dano.
- O corpo inteiro permanece dentro da arena; nao ha wrap.

## Lane assist

Movimento horizontal corrige Y e movimento vertical corrige X. A assistencia atua ate 460 unidades de offset, corrige no maximo 128 unidades por tick e libera avanco longitudinal ate offset 77. A correcao ocorre antes do avanco e nao permite corner cutting.

Uma direcao perpendicular bloqueada pode continuar a ultima direcao que ainda avanca. Uma reversao bloqueada permanece parada.

## Colisao simultanea

Todos os candidatos usam o mesmo pre-state contra bounds, solid, crates e bombas. Candidatos vivos sao resolvidos em lote: overlap final rejeita ambos; invasao de corpo estacionario ou rejeitado elimina o invasor; a resolucao repete ate estabilizar. Rejeitados mantem a posicao anterior e recebem velocidade zero.

Corpos mortos nao bloqueiam. O resultado nao depende de ordem de roster ou ID.

## Bombas e hazards

`place-bomb` usa `tileOf(position)` antes da locomocao. Um corpo que ja sobrepoe a bomba pode sair de forma monotona, mas nao se aproximar ou cruzar o centro; depois de sair, reentrada bloqueia.

Dano de chama usa overlap AABB positivo. Locomocao ocorre antes de explosao e dano.

## Estado e fronteiras

Restore valida a estrutura local de posicoes e velocidades: inteiros safe, bounds, direcao e limite de passo. Relacoes historicas ou entre slices nao sao reconstruidas. Snapshot expoe posicao, velocidade e tile derivado; interpolacao e conversao visual ficam no browser.