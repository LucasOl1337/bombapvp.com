---
status: accepted
---

# Servidor autoritativo por partida

Cada partida online terá exatamente uma simulação autoritativa fora dos browsers. Clientes enviarão somente comandos validados; nunca poderão hospedar a partida nem enviar snapshots. Matchmaking e simulação serão módulos separados, e cada partida receberá identidade e runtime isolados para limitar latência, escala e blast radius.

O domínio profundo será uma interface de simulação determinística e independente do provedor. O `GameApp` atual servirá apenas como oráculo de caracterização durante uma extração incremental; cliente, servidor e testes deverão consumir o mesmo kernel antes do release. Durable Object por partida é o adaptador executável com a conta atual, mas não será promovido a runtime mundial sem benchmarks regionais. Cloudflare Container ou compute regional dedicado permanecem adaptadores possíveis caso a latência dos Durable Objects — especialmente para o Brasil — reprove os SLOs.

## Consequences

- O protocolo de gameplay deixa de aceitar a função `host` e mensagens `host-snapshot` vindas do cliente.
- A simulação usa IDs estáveis de personagem, revisão de conteúdo e seed explícita; renderização, áudio, DOM e assets visuais ficam fora do kernel.
- Nenhuma topologia singleton como `endless-pvp` poderá ser usada em produção.
- Escolher o provedor final do plano de dados depende de benchmark e de autorização do dono para infraestrutura/custo; essa incerteza não pode vazar para as regras do jogo.
