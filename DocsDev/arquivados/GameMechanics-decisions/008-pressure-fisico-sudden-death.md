# Decision 008 — pressure fisico deterministico

## Decisao

Sudden death fecha tiles em espiral para garantir pressao mecanica sem empate por timeout.

- `PRESSURE_INTERVAL_MS = 900`.
- `PRESSURE_FALL_MS = 340`.
- `warningAt(i) = i * 900`.
- `impactAt(i) = i * 900 + 340`.

O primeiro aviso ocorre ao entrar em sudden death. O caminho canonico percorre a arena 11×9 de fora para dentro, ignora solid base e contem 51 tiles: primeiro `(1,1)`, ultimo `(5,4)`.

## Ownership e estado

O modulo `pressure` possui apenas `pressure.closedTiles`. Caminho e alvo em queda sao derivados de Arena e do clock de Match; nao sao persistidos.

`round-reset` limpa `closedTiles`. Fora de sudden death, o sistema de pressure e no-op. Restore valida somente a estrutura pertencente ao slice: array, tiles dentro dos limites e ausencia de duplicatas.

## Barreiras

A ordem relevante e:

```text
timer -> protection -> pressure -> pressure-impact -> intent -> locomotion
      -> bombs -> explosion -> damage -> pickup -> round
```

Pressure publica `pressure-impact { roundNumber, pressureIndex, tile }`. Na fase seguinte, owners reagem ao mesmo pre-state:

- Pressure fecha o tile e emite aviso/fechamento.
- Arena remove crate existente.
- Ordnance força bomba no tile a detonar.
- Competitors elimina corpos vivos com overlap positivo.
- Locomotion e explosao tratam `arena.solid + pressure.closedTiles` como solid efetivo.

Um impacto precede movimento, portanto o corpo nao escapa no proprio tick. Chamas podem coexistir temporariamente com tile fechado.

## Snapshot

`snapshot.arena.solid` projeta o union efetivo. `snapshot.pressure.closing` e `pathLength` sao derivados. `closedTiles` nao e duplicado na API visual.

O comportamento e coberto por testes de calendario, espiral, crates, bombas, blast, movimento, eliminacao simultanea, reset e replay.