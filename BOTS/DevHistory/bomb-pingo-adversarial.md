# Treino adversarial — Bomb vs Pingo

Data de início: 2026-07-16

Status: **em andamento**

## Organização

- A sessão `Treino adversarial — Bomb` é dona de `bot-bomb.ts` e dos testes `bot-bomb-*`.
- A sessão `Treino adversarial — Pingo` é dona de `bot-pingo.ts` e dos testes `bot-pingo-*`.
- As policies são independentes e não podem importar nem chamar V1, V2, V3 ou a policy rival.
- O `GameApp` aceita policies injetadas por jogador somente para que o harness neutro execute confrontos reais no mesmo motor.
- As duas sessões possuem heartbeat de dez minutos e trocam freeze, resultados, causas de morte e desafios antes de cada rodada.
- O dono autorizou explicitamente em 2026-07-16 integrar Bomb e Pingo ao treino/Lab e publicar em producao.

## Protocolo da liga

- Mesma personagem e capacidades em cada confronto.
- Três variantes: `standard`, `open-no-drops` e `sparse-breakables`.
- Cada caso é executado duas vezes, mantendo arena e seed e invertendo as policies entre as duas posições.
- As posições são sorteadas deterministicamente entre os quatro cantos a partir da seed e registradas no resultado.
- A suite de desenvolvimento usa seeds conhecidas; a suite reservada é gerada somente após freeze e nunca é usada para ajuste.
- Métricas: vitória, empate, duração, causa de morte, self-death, idle, stuck, maior streak preso, decisões e compute médio/p95/máximo.
- Um placar agregado não basta: especialização por arena, morte por sudden death e ociosidade invalidam uma alegação de força geral.

## Rodada v0 — diagnóstico, não promoção

O lote executou 72 partidas, 24 por variante, com lados espelhados e Ranni para ambos.

| Variante | Bomb | Pingo | Leitura |
| --- | ---: | ---: | --- |
| `standard` | 24 | 0 | Pingo morreu 24 vezes por sudden death; ambos permaneceram quase sempre ociosos. |
| `open-no-drops` | 0 | 24 | Bomb morreu 24 vezes para ataques do Pingo. |
| `sparse-breakables` | 17 | 7 | Pingo teve sete self-deaths. |
| Total | 41 | 31 | O agregado mascara especialização extrema. |

### Causas e custo

| Métrica | Bomb | Pingo |
| --- | ---: | ---: |
| Self-deaths | 0 | 7 |
| Mortes por adversário | 28 | 1 |
| Mortes por sudden death | 3 | 33 |
| Idle acumulado | 2.247.850 ms | 2.256.800 ms |
| Stuck acumulado | 121.750 ms | 106.150 ms |
| Maior streak preso | 1.650 ms | 400 ms |
| Decisões | 143.571 | 143.541 |
| Compute médio | 0,040 ms | 0,0155 ms |
| P95 observado | 0,335 ms | 0,132 ms |
| Máximo observado | 4,503 ms | 1,650 ms |

As sete autoeliminações do Pingo ocorreram em `sparse-breakables`:

- seed `0`, ordem `[Bomb, Pingo]`;
- seed `1`, ordem `[Pingo, Bomb]`;
- seed `2`, nas duas ordens;
- seed `3`, ordem `[Pingo, Bomb]`;
- seed `5`, ordem `[Bomb, Pingo]`;
- seed `10`, ordem `[Bomb, Pingo]`.

Depois do lote foi descoberto que a versão inicial do harness só alternava os dois spawns superiores. Por isso a v0 permanece evidência diagnóstica útil, mas **não é elegível para promoção**. A partir da v1, cada seed sorteia duas posições entre os quatro cantos e o par espelhado troca as policies nessas mesmas posições.

## Rodada v1 — development-v1-final

### Bomb v1 congelado

- ataque seguro mesmo quando o alvo ainda possui fuga;
- saída da bomba no mesmo frame;
- abertura de caixa adjacente somente com rota temporal de fuga;
- coleta prioritária de power-up defensivo visível;
- oito testes focais e typecheck verdes antes do freeze.

### Pingo v1 congelado

- fuga BFS temporal completa e reação em cadeia;
- alinhamento contínuo ao centro validado pela colisão real;
- fase de emergência Ranni quando não há tempo físico de limpar a casa;
- sudden death incorporado ao mapa temporal;
- abertura de fronteira quando caixas desconectam o adversário;
- nenhuma nova bomba durante o cooldown da fase de emergência;
- 20/20 testes focais, typecheck e suíte completa verdes antes do freeze.

### Resultado autoritativo

O lote `development-v1-final` executou 72 partidas com novo prefixo de seeds, três variantes, sorteio entre quatro posições e lados espelhados.

| Variante | Bomb | Pingo | Empates |
| --- | ---: | ---: | ---: |
| `standard` | 20 | 3 | 1 |
| `open-no-drops` | 12 | 12 | 0 |
| `sparse-breakables` | 20 | 4 | 0 |
| **Total** | **52** | **19** | **1** |

| Métrica | Bomb | Pingo |
| --- | ---: | ---: |
| Self-deaths | 0 | 0 |
| Idle acumulado | 668.200 ms | 668.850 ms |
| Stuck acumulado | 777.700 ms | 832.650 ms |
| Maior streak preso | 1.950 ms | 20.400 ms |
| Decisões | 98.847 | 98.842 |
| Compute médio | 0,0440 ms | 0,0209 ms |
| P95 | 0,1682 ms | 0,1279 ms |
| Máximo | 1,6681 ms | 1,6821 ms |

Causas: Bomb teve 19 mortes por oponente e sobreviveu 53 vezes. Pingo teve 47 mortes por oponente, cinco por sudden death e sobreviveu 20 vezes. Os dois zeraram autoeliminação.

## Integração de produção

- O Treino contra bots oferece um seletor explícito entre Bomb v1 e Pingo v1 antes de abrir a arena.
- O AI Lab registra `bot-bomb` e `bot-pingo` como competidores locais independentes; Bomb × Pingo é a seleção inicial.
- Ambos usam Ranni no Lab e a telemetria mede decisões locais, placar e causas normalmente.
- V1, V2, V3 e perfis LLM continuam disponíveis.

## Próximo gate

1. Repetir todos os baselines de Bomb e Pingo após o hotfix da Ranni.
2. Evoluir Pingo contra as derrotas `standard` e `sparse-breakables`, preservando zero self-deaths.
3. Evoluir Bomb contra a paridade de `open-no-drops`, preservando zero self-deaths.
4. Gerar suite reservada somente quando ambos mostrarem força equilibrada nas três variantes.
5. Usar o reservado apenas para promoção; qualquer correção posterior exige uma nova suite reservada.

## Invalidação pré-hotfix — ultimate da Ranni

Em 2026-07-16 foi confirmado que concluir a ultimate da Ranni sem deslocamento concedia os 1.500 ms completos de canalização invulnerável, mas aplicava somente 300 ms de cooldown. O Bomb acionava sistematicamente esse caminho de emergência sem direção e podia repetir a invulnerabilidade aproximadamente a cada 1,8 segundo.

O comportamento foi emergente: a policy não continha uma regra para contornar o cooldown. Ela apenas aprendeu, por construção determinística, a acionar a fase estacionária sempre que não existia fuga segura. A combinação dessa decisão defensiva com a exceção de 300 ms no mecanismo compartilhado transformou a emergência em um ciclo quase contínuo de invulnerabilidade. Foi uma descoberta impressionante do espaço de regras, mas também uma vantagem ilegal que contaminou a avaliação.

O mecanismo compartilhado passou a cobrar os 8.000 ms completos após toda canalização concluída, com ou sem deslocamento. Um teste de regressão cobre o término sem movimento e garante que a habilidade não volta ao estado ocioso antes dos oito segundos.

Consequências para a liga:

- `development-v1-final` (Bomb 52–19 Pingo, um empate) deixa de ser evidência elegível para promoção;
- `pingo-v2-dev-a` (Bomb 55–17 Pingo) e seus diagnósticos também são pré-hotfix e inválidos para força;
- nenhuma comparação anterior pode sustentar superioridade do Bomb;
- ambos os bots precisam de novos baselines justos após a publicação e validação do hotfix.

### Cápsula temporal

A tag Git anotada `archive/bots-ranni-stationary-phase-2026-07-16` aponta para o commit publicado `200915d`, exatamente antes do hotfix. Ela preserva policy, motor, testes e integração daquele instante. Deve ser usada somente em checkout/worktree local para demonstração histórica; nunca deve ser publicada novamente em produção, pois contém o cooldown explorável.

O teste histórico do V3 que exigia dez vitórias consecutivas com a mesma fase estacionária também perdeu validade após o conserto. No estado pós-hotfix ele passa a verificar apenas a execução justa, posições balanceadas e ausência de autoeliminação; qualquer nova alegação de força do V3 precisa de um gate novo sob a mecânica corrigida.
