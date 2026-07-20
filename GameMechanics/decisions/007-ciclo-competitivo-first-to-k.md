# Decision 007 — ciclo competitivo first-to-K

## Decisao

A partida usa fases deterministicas:

```text
round-start -> playing -> sudden-death -> round-over -> round-start | match-over
```

- Countdown inicial: 1200 ms.
- Protecao de spawn: 2200 ms a partir da abertura de playing.
- Intervalo de round-over: 1600 ms.
- Timeout entra em sudden death; nao produz empate.
- Eliminacao com um sobrevivente concede uma vitoria.
- Double KO nao concede vitoria.
- O primeiro competidor a atingir `targetRoundWins` encerra a partida depois do intervalo de round-over.

Todos os tempos sao multiplos do tick fixo de 20 ms.

## Barreiras

Match coordena transicoes por facts e escreve apenas o slice `match`. `round-reset` permite que Arena, Intent, Locomotion, Competitors, Ordnance, Pressure e Powerups restaurem seus proprios slices na mesma fronteira de fase.

A abertura de playing ocorre em `cycle`, antes de comandos. O mesmo tick arma protecao, aceita gameplay, avanca o clock e decrementa a protecao uma vez. Timer abre sudden death antes das fases de hazards. Round decide outcome e score depois de dano e pickups.

## Estado

Match persiste fase, numero da rodada, clocks, scores, outcome e vencedor da partida. Restore valida a estrutura e coerencia interna desses campos, sem reconstruir a historia completa da partida nem consultar slices de outros owners.

O tick raiz continua entre rodadas. Restart da facade cria um novo mundo por `program.initial(config)`.

## Consequencias

- Draws geram rodadas extras em vez de best-of-N fixo.
- Pressure fisico pertence ao modulo Pressure.
- Pausa e wall clock permanecem no adapter.
- Replay da mesma config e stream de comandos preserva estado e eventos.