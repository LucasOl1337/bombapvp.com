# Oraculo comportamental, reescrita tecnica

## Question

O que da gameplay atual deve sobreviver na reconstrucao?

## Decision

O comportamento observavel, as regras, as ideias de design e o conteudo do jogo
publico sao o oraculo de caracterizacao. Codigo, arquitetura, tipos, linguagem,
acoplamentos e implementacoes antigas nao sao reutilizados.

O prototipo novo tambem nao recebe imunidade: cada parte permanece somente se
for a melhor fundacao para o destino confirmado. Diferencas intencionais em
relacao ao jogo publico devem ser explicitas e cobertas por teste.

## Consequences

- O legado pode ser lido para descobrir comportamento, nunca importado pelo
  runtime novo.
- Bugs conhecidos nao se tornam requisitos por acidente.
- Os tres modos atuais permanecem intactos ate seus gates de migracao.
