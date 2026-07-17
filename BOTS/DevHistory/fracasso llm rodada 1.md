# Fracasso LLM — Rodada 1

Data do encerramento: 2026-07-16

Status: **experimento encerrado como fracasso**

Escopo: primeira tentativa de usar uma LLM remota como cérebro de um bot em uma partida rápida de Bomba PvP, usando o Luna Leve (`cx/gpt-5.6-luna`) e bots determinísticos como adversários e controles.

## Veredito

Esta rodada não produziu um bot inteligente nem um controlador aceitável para o ritmo do Bomba PvP.

Foram obtidas melhorias reais de infraestrutura:

- menor latência de prompt;
- menos tokens de saída;
- mais chamadas concorrentes;
- descarte de respostas antigas;
- um executor local de 20 Hz;
- reflexos de segurança;
- telemetria de latência, ações e causas de morte;
- V2 com verificações de fuga e dash validado pela física real.

Essas melhorias não resolveram o problema principal. O Luna continuou tomando decisões táticas sobre estados com vários segundos de idade. O executor local apenas repetiu essas intenções antigas com maior frequência. O V2 conseguiu vencer esse oponente lento em algumas medições, mas continuou exibindo estratégia pobre e comportamentos que não correspondem a inteligência de jogo.

O julgamento visual do operador foi decisivo: mesmo quando o placar e os testes ficaram verdes, os bots ainda jogavam de forma ridícula, sem estratégia coerente. Portanto, esta rodada é registrada como fracasso, e não como sucesso técnico parcial apresentado como sucesso do bot.

## Objetivo original

O objetivo era criar bots capazes de:

- observar o estado recente da arena;
- decidir pelo menos 10 vezes por segundo em um jogo de pacing rápido;
- sobreviver às próprias bombas;
- perseguir, pressionar e prender adversários;
- usar bombas, detonações, movimento e skills com intenção;
- evoluir por rodadas mensuráveis contra V1, V2 e Luna Leve;
- demonstrar melhoria de comportamento, performance e habilidade.

O resultado não cumpriu esses requisitos. Frequência de execução local não se transformou em frequência de raciocínio, e vitórias contra um adversário lento não provaram boa estratégia.

## Linha do tempo das tentativas

| Commit | Tentativa | Resultado técnico | Por que não resolveu |
| --- | --- | --- | --- |
| `946c2f2` | Adicionar V1 e permitir até quatro bots no laboratório | Criou o controle determinístico e a comparação em salas maiores | Disponibilidade de oponentes não criou um protocolo forte de avaliação |
| `ba92c7a` | Adicionar telemetria detalhada | Expôs round-trip, tokens, cadência, ações, erros e estado do jogo | A telemetria mostrou a lentidão, mas não alterou a política |
| `b2eacb1` | Maximizar polling, enriquecer o snapshot e reduzir `max_tokens` | Removeu esperas intencionais, ampliou o estado enviado e pediu respostas menores | O gargalo dominante continuou sendo a inferência remota e a qualidade temporal da decisão |
| `7b2e9b7` | Remover o rate limit do Worker e manter o último input ativo | Eliminou 429 intencional e pausas artificiais entre comandos | Ausência de limite não significa baixa latência; a mesma ação podia permanecer ativa por segundos |
| `2e2ce13` | Adicionar a rota Luna Leve | Criou uma variante supostamente mais rápida para o laboratório | A rota continuou lenta demais para primitivas de um jogo rápido |
| `53d9041` | Transformar o HUD em console de observação | Facilitou comparar placar, ações, telemetria e tamanho da arena | Melhor visualização tornou o fracasso visível, mas não tornou os bots melhores |
| `2b67fbb` | Impedir fuga suicida logo após plantar bomba | Corrigiu uma condição determinística específica | Tratava um sintoma sem criar planejamento de horizonte longo |
| `0096c5f` | Usar duas lanes do Luna com respostas versionadas | Aumentou polling e impediu aplicação fora de ordem ou em outra rodada | Freshness mínima e ordenação não compensaram o round-trip de vários segundos |
| `8745cdf` | Reduzir raciocínio textual do Luna e pedir ação imediata | Mediana caiu de 6.635,5 ms para 4.169,5 ms; saída caiu de 195 para 111,5 tokens | Quatro segundos ainda equivalem a dezenas de mudanças relevantes na arena |
| `156c721` | Rastrear causas autoritativas de eliminação | Passamos a separar morte por adversário, própria bomba, sudden death e ambiente | Observabilidade explica a falha, mas não cria uma política melhor |
| `2dcbf5b` | Corrigir fuga entre bombas próprias no bot determinístico | Reduziu um caso específico de rota suicida | Era uma correção local; não havia planejamento global nem previsão do adversário |
| `6fb242f` | Escalonar quatro lanes do Luna em intervalos de 500 ms | Em simulação, cadência aplicada subiu de 0,8 para 1,4 decisão/s | Concorrência aumentou throughput, mas cada resposta continuou lenta e baseada em snapshot antigo |
| `9173dc1` | Criar motor híbrido de 20 Hz com reflexo de segurança | Movimento passou a ser reaplicado a 20 Hz e ataques puderam ser suprimidos em perigo | O motor repetia intenção velha; 20 ciclos/s foram confundidos com responsividade inteligente |
| `1a1691c` | Criar V2 com bomba de contato e fuga comprovada | Gate limitado mostrou melhora sobre V1 e zero self-deaths nas seeds testadas | O V2 ainda era uma coleção de heurísticas locais e virou um adversário fraco para avaliar a LLM |
| `59c3032` | Adicionar dash físico seguro ao V2 | Gate headless: 6/8 vitórias contra 2/8 do V1, 0 self-deaths e pedidos de dash iguais às ativações reais | O gate mediu resultado em poucas seeds, não qualidade estratégica nem generalização |

O commit `c5d7035`, que adicionou o V3 determinístico, ocorreu depois desta sequência. Ele não é evidência de que a Rodada 1 de LLM funcionou e deve ser avaliado como experimento separado.

## Evidências quantitativas

### Prompt e provider

| Métrica | Antes | Depois | Leitura correta |
| --- | ---: | ---: | --- |
| Mediana de round-trip | 6.635,5 ms | 4.169,5 ms | Melhora operacional de aproximadamente 37%, ainda incompatível com controle de 100 ms |
| Mediana de tokens de saída | 195 | 111,5 | Menos texto não garantiu melhor decisão |
| JSON válido | 4/4 | 4/4 | Formato correto não implica ação boa |
| `max_completion_tokens` solicitado | 120 | 120 | O 9Router chegou a reportar uso superior; o parâmetro não foi limite confiável |

### Concorrência e execução

| Métrica | Resultado | Leitura correta |
| --- | ---: | --- |
| Duas lanes, benchmark de 5 s | 4 decisões aplicadas | 0,8 decisão/s |
| Quatro lanes, benchmark de 5 s | 7 decisões aplicadas | 1,4 decisão/s, ainda muito abaixo de 10/s |
| Produção durante a rodada | aproximadamente 0,22–0,28 LLM/s | A maioria dos estados mudava muito antes da próxima resposta |
| Snapshot posterior em produção | aproximadamente 0,46 LLM/s e 4.489 ms médios | Throughput agregado melhor, mas latência individual continuou péssima |
| Executor local | aproximadamente 19,5–20,3 ciclos/s | Frequência de reaplicação, não frequência de decisões inteligentes |

### Falso positivo de placar

Em uma observação posterior à publicação do V2:

- V2 abriu 2–0 contra o Luna Leve;
- V2 registrou aproximadamente 57 `BOT/S` com 0,08 ms médios;
- Luna registrou aproximadamente 0,46 `LLM/S` com 4.489 ms médios;
- V2 tinha 2 kills e 0 deaths naquele momento;
- Luna tinha 0 kills e 2 deaths.

Isso não provou que o V2 era inteligente. Provou principalmente que um bot determinístico extremamente rápido consegue vencer uma LLM que controla primitivas com vários segundos de atraso. O placar comparou duas limitações diferentes e premiou a menos lenta.

## Sintomas observados

### Luna Leve

- Ficava parado ou mantinha a mesma direção por muito tempo.
- Reagia a bombas e inimigos depois de o estado relevante já ter mudado.
- Alternava comandos sem continuidade tática observável.
- Não demonstrava uma sequência estável de preparar, pressionar, prender e finalizar.
- Plantava ou deixava de plantar bombas sem um plano temporal verificável.
- Recebia informação detalhada, mas não conseguia transformá-la em controle rápido.
- A concorrência podia produzir várias respostas em voo, mas não tornava nenhuma resposta individual mais fresca.
- O reflexo local impedia algumas mortes, porém também mascarava a incapacidade do planejador de sobreviver por conta própria.

### V1 e V2

- Executavam muitas decisões por segundo, mas grande parte era repetição ou heurística reativa.
- Podiam entrar em loops locais e perseguir posições sem construir uma armadilha.
- O V2 observado nas primeiras builds se matava com frequência; correções posteriores reduziram isso nas amostras testadas, mas não provaram segurança geral.
- A bomba de contato e o dash eram capacidades isoladas, não partes de uma estratégia de vários passos.
- O dash seguro melhorou mobilidade e passou a usar a mesma projeção física do motor, mas uso correto de uma skill não equivale a jogo inteligente.
- Vencer o Luna Leve não era um benchmark forte porque o Luna quase não conseguia atuar no mesmo horizonte temporal.

## Principais causas do fracasso

### 1. A LLM foi colocada na camada errada

Tentamos fazer uma LLM remota escolher ações primitivas — direção, bomba, detonação e skill — em um jogo que exige reação da ordem de 50 a 100 ms. A rota entregava respostas da ordem de quatro a sete segundos.

Mesmo uma resposta semanticamente boa já chegava vencida.

### 2. Otimizamos throughput como se fosse latência

Quatro lanes aumentaram o número de respostas aplicadas por janela. Isso não reduziu o tempo de uma inferência individual. Mais respostas antigas não formam um controlador em tempo real.

O stagger, os números de sequência e o descarte de respostas de rodadas antigas foram necessários, mas serviram para tornar a concorrência correta, não inteligente.

### 3. O motor híbrido repetia intenção velha

O executor de 20 Hz melhorou a continuidade do movimento e a segurança. Porém, sua entrada estratégica ainda podia ter vários segundos de idade.

Reaplicar uma direção ruim 20 vezes por segundo produz movimento suave, não raciocínio rápido.

### 4. Segurança reativa foi confundida com planejamento

O reflexo conseguia substituir movimento e suprimir ataques em perigo iminente. Ele não escolhia objetivos, não previa ocupação adversária e não construía uma rota ofensiva.

Evitar uma morte imediata é uma restrição. Não é uma política completa.

### 5. Não existia um forward model tático

Os bots não comparavam de forma sistemática futuros possíveis para responder perguntas como:

- esta bomba cria uma armadilha ou só abre uma caixa?
- quais casas permanecem alcançáveis após cada explosão?
- onde o adversário pode estar quando o fusível terminar?
- esta perseguição fecha espaço ou apenas segue a posição atual?
- qual ação mantém sobrevivência sob o pior movimento plausível do inimigo?

Sem rollout ou busca temporal, a estratégia era uma sequência de decisões locais.

### 6. Faltavam opções persistentes e memória tática

Não havia um contrato robusto para manter e interromper planos como:

- escapar até uma zona segura;
- coletar um power-up específico;
- controlar um corredor;
- preparar uma armadilha;
- perseguir por uma rota de interceptação;
- esperar um fusível antes de detonar.

O Luna devolvia comandos, não opções com precondição, objetivo, validade e condição de término.

### 7. Os gates premiavam o que era fácil medir

Os testes provaram invariantes úteis, mas estreitas:

- zero self-deaths em poucas seeds;
- uso real de skill;
- vitória contra V1;
- descarte de resposta antiga;
- cadência de lanes;
- frequência do motor local.

Eles não mediam adequadamente:

- tempo parado ou preso em loop;
- progresso territorial;
- criação de rotas de fuga futuras;
- conversão de bombas em pressão ou kills;
- qualidade de interceptação;
- consistência em seeds reservadas;
- desempenho em salas de três e quatro bots;
- força contra uma liga de oponentes diferentes;
- qualidade visual e coerência estratégica.

O gate de 6/8 do V2 foi ajustado e reexecutado nas mesmas poucas seeds durante o desenvolvimento. Isso permitiu overfitting de engenharia ao conjunto de avaliação.

### 8. O adversário de validação era fraco demais

V2 contra Luna Leve não respondia “o V2 joga bem?”. Respondia “qual dos dois sistemas defeituosos perde primeiro?”.

Uma LLM quase parada tornou pequenas heurísticas determinísticas suficientes para vencer. O resultado não generaliza para humanos, bots fortes ou partidas com mais jogadores.

### 9. Telemetria não era replay explicável

O HUD permitiu ver latência, cadência, último comando, mortes e placar. Ainda faltava uma trilha por decisão contendo:

- snapshot de origem;
- idade na aplicação;
- opções consideradas;
- ações mascaradas e motivo;
- previsão de perigo;
- objetivo tático ativo;
- ação pedida versus executada;
- consequência observada alguns ticks depois.

Sem isso, parte da análise continuou dependendo de observação visual manual.

## O que aprendemos de verdade

Apesar do fracasso, algumas conclusões ficaram bem sustentadas:

1. LLM remota textual não deve controlar primitivas no caminho crítico.
2. O Bomba PvP precisa de uma política ou planner local com prazo máximo de 100 ms.
3. O executor/reflexo deve continuar funcionando mesmo sem LLM.
4. A LLM pode ser útil como estrategista de baixa frequência, nunca como joystick.
5. Legalidade física deve vir do motor canônico, não de uma reimplementação dentro do bot.
6. `legalMask` e `riskForecast` precisam ser conceitos separados.
7. Ação solicitada e ação realmente executada devem ser medidas separadamente.
8. Throughput, latência, freshness e frequência do executor são métricas diferentes.
9. Seeds de desenvolvimento e validação precisam ser separadas.
10. Avaliação automática deve incluir replay e revisão qualitativa, não apenas placar.

## Abordagens que não devem ser repetidas

- Aumentar lanes e chamar isso de 10 decisões por segundo.
- Repetir uma intenção LLM antiga em alta frequência e chamar isso de bot híbrido inteligente.
- Usar um oponente lento como prova de força.
- Otimizar somente prompt e quantidade de tokens esperando resolver controle temporal.
- Adicionar heurísticas isoladas até um pequeno conjunto de seeds ficar verde.
- Contar pedido de skill como execução física.
- Duplicar colisão, alcance ou regras de bomba dentro de cada bot.
- Aceitar zero self-deaths em uma amostra pequena como prova de segurança geral.
- Avaliar inteligência apenas por kills, vitórias ou ações por segundo.

## Plano recomendado para uma nova tentativa

Este plano é uma proposta posterior ao fracasso. Nada nesta seção deve ser interpretado como já implementado ou validado.

### Fase 0 — Reconstruir a avaliação

- Registrar replay determinístico por tick.
- Separar seeds de desenvolvimento, validação e teste cego.
- Alternar lados, spawns, personagens e número de competidores.
- Manter uma liga com V1, V2, V3, snapshots históricos e políticas exploratórias.
- Adicionar métricas de loop, tempo parado, pressão, fuga, armadilha e eficiência de bomba.
- Exigir revisão visual de amostras antes de promover uma versão.

### Fase 1 — Criar contratos canônicos

- `ObservationFrame` versionado por partida, rodada e tick.
- `LegalActionMask` calculada pelo motor.
- `RiskForecast` com ETA de explosão e fechamento de rotas.
- `PrimitiveAction` com ação pedida, aceita e executada.
- `TacticalOption` com precondição, prazo, sucesso, falha e interrupção.
- `StrategicAdvice` com tick de origem, validade e condição de expiração.

### Fase 2 — Planner local de 100 ms

- Enumerar somente ações legais.
- Simular exatamente o primeiro passo com o motor autoritativo.
- Fazer busca curta e rollout pessimista até além do maior fusível relevante.
- Tratar sobrevivência como restrição primária.
- Pontuar pressão, espaço controlado, coleta, interceptação e eficiência de bomba.
- Executar apenas a primeira ação e replanejar, no estilo receding horizon.
- Manter fallback determinístico quando o deadline expirar.

### Fase 3 — Opções táticas persistentes

- Implementar `escape`, `collect`, `chase`, `intercept`, `trap`, `zone-control` e `wait`.
- Permitir interrupção imediata por perigo ou mudança de precondição.
- Evitar troca de objetivo a cada tick sem causa observável.

### Fase 4 — LLM somente como estrategista

- Enviar estado resumido e eventos relevantes, não exigir resposta por frame.
- Pedir objetivo, alvo, tolerância a risco e opção preferida.
- Aplicar conselho somente se ainda estiver fresco e suas precondições forem verdadeiras.
- Medir por ablação: planner sozinho versus planner com conselho LLM.
- Remover a LLM se ela não produzir ganho estatístico e qualitativo.

## Gates mínimos antes de chamar uma versão de melhoria

| Dimensão | Gate inicial sugerido |
| --- | --- |
| Executor | pelo menos 20 Hz |
| Planner local | pelo menos 10 decisões/s por bot |
| Latência do planner | p95 <= 80 ms e p99 <= 100 ms |
| Freshness local | p95 da observação à aplicação <= 100 ms |
| Segurança | zero self-deaths em conjunto amplo e reservado, com intervalo reportado |
| Generalização | melhora contra liga de adversários e seeds cegas |
| Robustez | duelos e partidas com três e quatro bots |
| Comportamento | redução mensurável de loops e tempo parado |
| Ofensiva | melhora de pressão, armadilhas e conversão de bombas em vantagem |
| LLM | ganho por ablação sobre o mesmo planner local |
| Qualidade | replay amostrado aprovado por revisão humana |

## Critério de encerramento da Rodada 1

A Rodada 1 está encerrada porque:

- não atingiu 10 decisões inteligentes por segundo;
- não produziu estratégia visualmente coerente;
- não demonstrou generalização;
- não provou segurança fora de amostras pequenas;
- confundiu melhorias de infraestrutura com melhoria de inteligência;
- usou oponentes e gates insuficientes para sustentar as conclusões iniciais.

O código e os benchmarks permanecem úteis como infraestrutura e evidência histórica. Eles não devem ser usados para afirmar que o bot LLM desta rodada funcionou.

## Referências internas

- `docs/benchmarks/2026-07-16-luna-light-latency.md`
- `docs/benchmarks/2026-07-16-fast-game-agent-research.md`
- `src/lab/controller.ts`
- `src/original-game/Engine/bot-ai.ts`
- `src/original-game/Engine/bot-v2.ts`
- `tests/lab.test.ts`
- `tests/bot-v2-evaluation.test.mjs`
