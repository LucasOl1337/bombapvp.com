---
status: closed
type: research
assignee: root
parent: ../MAP.md
blocked_by: []
---

# Autoridade e runtime da partida

## Question

Onde deve viver a única simulação autoritativa e como o motor atual deve ser empacotado para que nenhum cliente possa decidir regras, sem duplicar gameplay nem exceder os limites de CPU, memória e ciclo de vida da infraestrutura escolhida?

## Resolution

A autoridade vive em um runtime isolado por partida, fora dos browsers, atrás de uma interface de simulação determinística e neutra de provedor. Clientes enviam apenas comandos. A extração do kernel será incremental e protegida por replays/hash de paridade; `GameApp` headless é somente oráculo transitório, não o dataplane final. O adaptador Durable Object pode ser implementado e testado com a conta atual, mas sua promoção a produção mundial depende de SLO regional; Container SAM ou compute dedicado continuam alternativas condicionadas a autorização. Decisão registrada em [Servidor autoritativo por partida](../../../docs/adr/0001-servidor-autoritativo-por-partida.md).
