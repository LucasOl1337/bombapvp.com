# Identidade e configuracao canonicas

## Question

Como identificar inequivocamente uma simulacao antes de construir novas
mecanicas sobre o prototipo 1v1?

## Decision

`SeatId` e `CompetitorId` sao tipos opacos diferentes. Entradas textuais sao
normalizadas e validadas apenas na criacao de `MatchConfig`; comandos, eventos,
bombas, chamas, resultado e snapshots usam a identidade do Competidor.

`MatchConfig` e profundamente imutavel e contem seed, revisao executavel das
mecanicas, revisao de conteudo, duracao da rodada e dois a quatro Assentos com
ocupantes unicos. A implementacao rejeita revisao de mecanicas incompatível em
vez de produzir um replay com identidade falsa.

O preset local mapeia controles P1/P2 para Competidores sem levar esses labels
ao dominio. Quatro spawns canonicos permitem evolucao sem cristalizar o duelo.

## Evidence

- `npm run check:mechanics`: typecheck e 13/13 contratos focados.
- Revisao adversarial GPT-5.6 Sol: 9,4/10, sem finding bloqueante.
- `/GameMechanics/` no localhost: `prototype-0.2.0`, pausa e restart funcionais,
  estado reiniciado em 01:30 e console sem warning/error.
