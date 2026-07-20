---
status: closed
type: grilling
assignee: root
parent: ../MAP.md
blocked_by: []
---

# Contrato público honesto do PvP

## Question

Qual é o comportamento exato que o CTA “Jogo online PvP” deve prometer e cumprir no primeiro release: quantidade mínima e máxima de humanos, preenchimento por bots, sala contínua ou partida fechada, início/espera, identidade do jogador e comportamento quando não há adversário humano?

## Resolution

O primeiro contrato é `duel-1v1-v1`: partida fechada com exatamente dois humanos. Com apenas um humano, a sessão permanece na fila; falha/indisponibilidade nunca inicia treino offline. Não há Completers, chat ou takeover no v1. O wire e o kernel preservam até quatro Assentos para evolução posterior, sem prometer esses modos agora. Decisão registrada em [Primeiro PvP online é um duelo 1v1](../../../docs/adr/0002-primeiro-pvp-online-e-duelo-1v1.md).
