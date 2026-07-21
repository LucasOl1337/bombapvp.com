# Decision 009 — power-ups e progressao unica

## Decisao

O modulo vertical `powerups` possui dois slices:

- `pickups`: itens visiveis ainda disponiveis;
- `progression`: `maxBombs` e `flameRange` por competidor.

`RosterEntry` guarda apenas identidade. Progression e a unica fonte mutavel dos upgrades. Uma bomba captura seu `flameRange` no placement, preservando causalidade sem consultar upgrades futuros.

O Slice 4A implementa somente `bomb-up` e `flame-up`, ambos limitados a 5.

## Plano de drops

O plano escondido e derivado de forma pura a partir de `roundSeed` e crates iniciais. Crates sao agrupadas por simetria central; escolhem-se `floor(pairCount * 65 / 100)` pares por hash inteiro deterministico. Tipos usam pesos `bomb-up: 5` e `flame-up: 4`.

O plano nao e persistido. Nao ha cursor de RNG, flags hidden/revealed/collected ou segunda fonte de verdade.

## Lifecycle

```text
pressure-impact -> damage -> pickup -> round
```

- Reset limpa pickups e restaura progression para 1/1.
- Pressure remove pickup visivel sem revelar drop escondido.
- Arena confirma crates realmente removidas e publica `crates-removed`.
- Na fase pickup, Powerups materializa drops liberados, resolve claims e escreve pickups + progression em conjunto.

Um drop pode ser revelado e coletado no mesmo tick. Um competidor eliminado em damage nao coleta.

## Claim simultaneo

1. O candidato precisa estar vivo, abaixo do cap e sobrepor o tile com area positiva.
2. Maior area vence.
3. Empate usa ordem de assentos da config.
4. Progression virtual e atualizada antes do proximo item do lote.
5. Competidor no cap nao consome nem bloqueia outro elegivel.

## Restore e snapshot

Restore valida a estrutura dos slices pertencentes ao modulo: tipos, ordem canonica e unicidade de pickups; ordem de assentos e caps de progression. Ele nao reconstrói historico de crates, claims ou drops entre slices.

Snapshot expoe somente power-ups visiveis e projeta progression junto aos competidores. Os assets locais sao consumidos apenas pelo adapter visual.

O comportamento e coberto por testes de plano deterministico, reveal, coleta, empate, caps, bomba/range, pressure, reset, replay e browser.