# Decision 011 — arena toroidal e layout classico

Status: aceita

## Decisao

O kernel adota o layout classico da arena 11x9 do jogo original e o wrap toroidal de corpos.

- Borda esparsa: linhas topo/base solidas em x par; colunas esquerda/direita solidas em y par; tiles impares da borda sao gaps abertos de wrap.
- 4 portais de wrap marcados: (0,4), (10,4), (5,0), (5,8) — nunca solidos (`WRAP_PORTAL_TILES`).
- 8 pilares interiores: sementes (3,3), (5,3), (2,4), (4,2) + espelhos centrais (7,5), (5,5), (8,4), (6,6).
- Spawn-safe: spawn + x±1 + um tile vertical em direcao ao centro. Strategic-open: cruz central + corredores dos portais, sem crates.
- Crates densos: interior elegivel recebe crate se for forcado — (2,3), (8,3), (2,5), (8,5) — ou se `hashToUnit(seed|minDas4VariantesD2|breakable) < 0.97`. A estrutura e fixa; so a selecao de crates usa a seed da rodada. O input do hash e a menor das 4 variantes refletidas da chave do tile, entao a decisao de crate e uniforme em D2; o conjunto final fecha sob o espelho central (pilares sao simetricos so no espelho central).
- Solid base: 24 tiles. Caminho de pressure: 75 tiles, primeiro (1,0), ultimo (6,4).

## Wrap toroidal

Corpos (somente players; bombas do kernel sao estaticas) vivem no toro [0, w*1024) x [0, h*1024):

- Apos integrar o movimento por eixo, a posicao e normalizada modulo a arena (`wrapPosition`). `wrapTile` e `wrapDelta` (delta mais curto atraves da costura) sao os primitivos compartilhados.
- Colisao AABB vs solid/crate/bomba e wrap-aware: o corpo perto da costura avalia os tiles de canto refletidos (`bodyOverlapsTileToroidal`). Metade do corpo < 1 tile, entao os <= 2x2 tiles de canto bastam.
- Velocidade reportada e o delta mais curto atraves da costura, consistente no wrap.
- Chamas NAO fazem wrap: o blast walk para no limite do grid (solid, crate ou borda).

## Restore

Posicoes fora da faixa sao normalizadas modulo o toro em vez de rejeitadas (locomotion e projecao do blink da Ranni). A validacao estrutural (inteiros seguros, contrato de velocidade, ordem de assentos) permanece estrita.

## Revisao

A mudanca de arena/wrap introduz `mechanics-v2` (protocol.ts e match-config.ts), depois consolidada em `mechanics-v3` pela Decision 012. O modulo locomotion sobe para 3.0.0, ordnance para 3.1.0 (blast para no grid), skills para 1.1.0 (projecao normalizada no restore).
