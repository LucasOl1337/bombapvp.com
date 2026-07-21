# Decision 012 — egresso livre de bomba, janela letal da chama e interpolacao de render

Status: aceita

## Contexto

Tres defeitos de feel reportados no runtime novo em relacao ao jogo original:

1. Corpo fora do centro do pixel da bomba ficava preso nela: o egresso monotono
   (Decision 006) proibia aproximar/cruzar o centro do tile, e combinado com o
   lane assist (correcao transversal em direcao ao centro da bomba) e com
   obstaculos podia zerar toda saida — o jogador morria parado em cima da bomba.
2. A chama matava durante todo o `FLAME_DURATION_MS` (600 ms): quem andava para
   cima do rastro da explosao depois de ela acontecer morria, e a leitura visual
   (fog residual) nao distinguia perigo de cenario.
3. O render consumia a posicao crua do tick de 20 ms sem interpolacao, entao a
   movimentacao parecia travada em relacao a versao original.
4. Corpos vivos se bloqueavam: um jogador travava no outro e nao conseguia
   atravessar. No jogo original corpos de jogadores nunca bloqueiam movimento
   (`canOccupyPosition` so considera terreno e bombas).

## Decisao

- **Egresso livre (locomotion 3.1.0):** enquanto o corpo sobrepoe o tile da
  bomba no pre-state, qualquer movimento e legal — inclusive cruzar o centro.
  A reentrada continua bloqueada: ao limpar a sobreposicao por completo, a chave
  sai do conjunto de pre-overlap e a bomba vira obstaculo estatico. A funcao
  `isBombEgressMonotone` e o parametro `prePosition` de `isStaticallyValid`
  foram removidos.
- **Janela letal da chama (competitors 3.1.0):** `FLAME_LETHAL_GRACE_MS = 100`.
  Uma chama so mata enquanto fresca — `remainingMs > FLAME_DURATION_MS -
  FLAME_LETHAL_GRACE_MS` (`isFlameLethal`). Depois da janela, o tile continua
  queimando como VFX residual (fog) e atravessar e seguro. Chain reactions
  renovam `remainingMs` para `FLAME_DURATION_MS`, entao uma explosao nova no
  tile rearma a letalidade. O renderer desenha a fase residual mais fraca,
  menor e sem bloom aditivo para comunicar que nao mata.
- **Corpos nunca bloqueiam (locomotion 3.2.0, ordnance 3.2.0, skills 1.2.0):**
  corpos vivos se atravessam livremente, como no jogo original.
  `resolveMovementBatch` virou apenas o filtro de passo maximo do contrato;
  o plantio de bomba nao rejeita mais quando um rival sobrepoe o tile (o
  egresso geometrico de pre-overlap cobre a saida — a rejeicao
  `tile-occupied` agora so cobre bomba sobre bomba); a projecao e o landing
  do blink da Ranni ignoram corpos. O bot espelha apenas a ocupacao de tile
  por bomba e o compartilhamento de tile no mesmo tick.
- **Interpolacao de render (somente adaptador):** o browser interpola as
  posicoes entre os dois ultimos ticks do kernel com alpha = resto do
  acumulador / tick, usando `wrapDelta` (delta mais curto no toro). Saltos
  maiores que `LANE_CORRECTION_MAX` (blink, reset de rodada) snapam em vez de
  atravessar a arena. Nada disso entra no kernel: e apresentacao pura.

## Revisao

`mechanicsRevision` sobe para `mechanics-v3` (protocol.ts e match-config.ts):
egresso livre e janela letal mudam a semantica executavel da simulacao.
A interpolacao e apenas de apresentacao e nao afeta a revisao.
