# Agentes de jogo rapido: arquitetura para 10 ou mais decisoes por segundo

Data: 2026-07-16

Escopo: pesquisa tecnica alem do The Last Arrow para controle em tempo real, planejamento, inferencia assincrona e avaliacao multiagente no Bomba PvP

Metodo: fontes primarias — papers originais, documentacao oficial e source oficial — com inferencias para o projeto explicitamente separadas dos resultados publicados

## Conclusao executiva

Nao ha evidencia nas fontes consultadas de que uma LLM remota, gerando texto, seja uma boa malha de controle de 10 Hz. Os exemplos fortes em tempo real usam uma politica ou um planejador local e pequeno. O GT Sophy venceu pilotos de elite atuando a 10 Hz com uma politica neural sobre estado estruturado, nao com geracao remota de texto ([Nature, 2022](https://www.nature.com/articles/s41586-021-04357-7)). No benchmark atual deste repositorio, o Luna Leve entrega aproximadamente 0,22 a 0,28 resposta aplicada por segundo; concorrencia aumenta vazao, mas nao reduz uma resposta individual de quatro segundos para menos de 100 ms ([benchmark local](./2026-07-16-luna-light-latency.md)).

A arquitetura mais sustentada pelas fontes tem tres frequencias:

| Camada | Frequencia-alvo | Responsabilidade | Falha aceitavel |
| --- | ---: | --- | --- |
| Executor e reflexos | 20 Hz ou mais | Aplicar movimento, mascarar ilegalidades, interromper perigo imediato e confirmar execucao real | Continua jogando sem planner ou LLM |
| Planner/politica tatica local | 10 Hz ou mais, prazo de ate 100 ms | Escolher a proxima acao ou opcao curta usando o snapshot atual e um forward model | Mantem a ultima opcao valida ou cai no reflexo |
| Estrategista LLM assincrono | Conforme o round-trip | Sugerir objetivo, alvo, nivel de risco e macro-opcao; nunca controlar o frame diretamente | Conselho vencido e descartado sem parar o jogo |

Essa separacao nao e apenas uma analogia. A arquitetura ATLANTIS integrou um controlador reativo, um sequenciador e um deliberador assincrono; o planner fornecia conselho, nao controle direto, e podia desaparecer sem impedir a resposta a contingencias ([Gat, AAAI 1992](https://flownet.com/gat/papers/aaai92.pdf)). O framework de `options` formaliza a mesma separacao entre acoes primitivas e politicas fechadas que duram varios passos e podem ser interrompidas durante a execucao ([Sutton, Precup e Singh, 1999](https://www.sciencedirect.com/science/article/pii/S0004370299000521)).

SayCan oferece um paralelo moderno para LLM: o modelo pontua quais skills ajudam o objetivo, mas uma funcao de affordance pontua quais skills sao realmente executaveis no estado atual; a combinacao escolhe a macro-acao ([Ahn et al., 2022](https://arxiv.org/abs/2204.01691), [Google Research](https://research.google/blog/towards-helpful-robots-grounding-language-in-robotic-affordances/)). A inferencia para o Bomba PvP e deixar a LLM escolher entre `escape`, `collect`, `chase`, `trap` ou `zone-control`, enquanto motor e planner local determinam se e como a opcao pode ser executada.

## Evidencia mais proxima: Pommerman

Pommerman e um benchmark baseado em Bomberman com quatro agentes, cooperacao e competicao, observacao parcial e acoes simultaneas. Seus autores apontam planejamento, modelagem de adversarios e colegas, teoria de jogos e comunicacao como capacidades complementares, nao como uma unica politica textual ([Resnick et al., 2018](https://arxiv.org/abs/1809.07124)).

O caso mais acionavel e o agente vencedor da competicao NeurIPS 2018:

- cada agente tinha **100 ms para escolher uma acao**, exatamente 10 decisoes por segundo;
- havia seis acoes por agente e ate `6^4 = 1.296` combinacoes conjuntas por passo;
- a explosao ocorria apos dez passos, entao uma busca rasa comum nao enxergava a consequencia mais importante;
- os agentes primeiro e terceiro colocados usaram profundidade exata `L = 1` e depois um cenario deterministico pessimista com horizonte de ao menos dez passos;
- o cenario pessimista eliminava ramificacao distante e avaliava sobrevivencia por pares tempo-posicao alcancaveis.

Esses resultados e parametros estao no paper original [Real-time tree search with pessimistic scenarios](https://proceedings.mlr.press/v101/osogami19a.html). Outro agente de Pommerman combinou heuristica barata em todos os passos com busca limitada apenas em momentos especificos; a busca continuou viavel mesmo com forward model caro ([Zhou et al., FDG 2018](https://www.um.edu.mt/library/oar/handle/123456789/81996)). Um trabalho posterior mostrou que ate MCTS raso usado como demonstrador reduz suicidios e melhora aprendizado assincrono em Pommerman ([Kartal et al., 2019](https://arxiv.org/abs/1904.05759)).

### Inferencia para o Bomba PvP

O primeiro planner forte nao precisa ser uma rede neural nem MCTS profundo. Ele pode:

1. enumerar somente as acoes legais do bot no proximo passo;
2. simular exatamente o futuro proximo com o mesmo motor autoritativo;
3. depois do primeiro ou segundo passo, substituir o branching multiagente por uma ocupacao pessimista: o adversario pode estar em qualquer tile que alcance;
4. continuar o rollout ate alem do maior fusivel de bomba ou evento de sudden death relevante;
5. usar sobrevivencia como restricao primaria e, entre planos sobreviventes, pontuar ataque, espaco controlado, power-up e aproximacao;
6. executar apenas a primeira acao e recalcular no snapshot seguinte, no estilo receding horizon.

Isso evita a explosao `acoes^agentes^horizonte` e usa o que o Bomba PvP ja possui de mais valioso: regras conhecidas e um motor headless deterministico. Nao ha motivo inicial para aprender um world model aproximado. Model-predictive control e planners rolling-horizon passam a ser mais interessantes se o forward model ficar caro ou se a acao virar continua. PETS demonstra planejamento por trajetorias com modelo probabilistico e incerteza ([Chua et al., 2018](https://arxiv.org/abs/1805.12114)); iCEM reduz amostras para planejamento em tempo real e reaproveita informacao entre ciclos ([Pinneri et al., 2021](https://proceedings.mlr.press/v155/pinneri21a.html)). Para o jogo atual, a ideia transferivel e receding horizon com warm start, nao a necessidade de uma dinamica aprendida.

Em jogos, Rolling Horizon Evolutionary Algorithms seguem exatamente esse ciclo: otimizam uma sequencia no forward model, executam a primeira acao, deslocam o plano anterior como seed e replanejam no tick seguinte. A avaliacao de Gaina et al. inclui orcamento de 40 ms, equivalente a ate 25 ciclos por segundo ([Gaina et al., 2020](https://arxiv.org/abs/2003.12331)). Isso oferece um segundo caminho depois do planner pessimista: manter um pequeno conjunto de sequencias candidatas aquecidas entre ticks.

## Contrato recomendado entre as camadas

```text
GameApp autoritativa (20 Hz)
  -> snapshot versionado + previsao de perigo + mascaras
     -> executor/reflexo -> input autoritativo
     -> planner local (>=10 Hz) -> opcao tatica curta
     -> LLM assincrona -> conselho estrategico com precondicoes
```

Os contratos conceituais devem carregar identidade temporal, e nao apenas dados de jogo:

| Contrato | Campos minimos |
| --- | --- |
| `ObservationFrame` | `matchId`, `roundId`, `tick`, instante monotonicamente crescente, jogadores, arena, bombas, chamas, skills e previsao de perigo |
| `LegalActionMask` | movimento por direcao, bomba, detonacao e skill, cada item com legalidade derivada do motor |
| `StrategicAdvice` | tick de origem, objetivo, alvo, tolerancia a risco, precondicoes e condicao de expiracao |
| `TacticalOption` | tipo, alvo/direcao, tick inicial, prazo, condicao de sucesso, falha e interrupcao |
| `PrimitiveAction` | movimento continuo e pulsos unicos de bomba, detonacao e skill |

O arbitro deve aplicar, em ordem: regras fisicas e legalidade; reflexo contra morte imediata; opcao tatica local; conselho estrategico ainda aplicavel; fallback deterministico. O planner e a LLM nunca devem reimplementar colisao, alcance de skill ou explosao. Eles consultam ou simulam a mesma regra que executara a acao.

Nem toda camada precisa fazer polling. As Behavior Trees atuais da Unreal sao event-driven: mudancas no Blackboard acordam ou abortam ramos, evitando reavaliar a arvore inteira em todo frame ([Epic, Unreal Engine 5.8](https://dev.epicgames.com/documentation/en-us/unreal-engine/behavior-tree-in-unreal-engine---overview)). No Bomba PvP, o executor continua a 20 Hz, mas replanejamento caro e chamada LLM podem ser disparados por eventos como bomba nova, corredor fechado, alvo perdido, power-up revelado ou fim de opcao.

## Action masking: legalidade nao e preferencia

Invalid action masking tem justificativa de policy gradient e escala melhor que simplesmente punir acoes invalidas; no estudo original, penalidade por acao invalida teve dificuldade ate para descobrir a primeira recompensa quando o espaco cresceu ([Huang e Ontanon, 2020](https://arxiv.org/abs/2006.14171)). PettingZoo inclui `action_mask` na observacao e recomenda a mascara em vez de deixar a acao bater na parede sem efeito ([documentacao oficial](https://pettingzoo.farama.org/tutorials/custom_environment/3-action-masking/)). Unity ML-Agents tambem separa a frequencia de decisao da reaplicacao de acoes e fornece mascara para ramos discretos ([DecisionRequester](https://docs.unity.cn/Packages/com.unity.ml-agents%401.1/api/Unity.MLAgents.DecisionRequester.html), [Agent API](https://docs.unity.cn/Packages/com.unity.ml-agents%402.3/api/Unity.MLAgents.Agent.html)).

O precedente especifico tambem existe: o agente Skynet, segundo colocado entre os learning agents de Pommerman, combinou redes neurais com um modulo automatico de action pruning ([Gao et al., 2019](https://arxiv.org/abs/1905.01360), [codigo do agente](https://github.com/BorealisAI/pommerman-baseline)). O modulo compara o tempo minimo de fuga com a vida das bombas e evita plantar bomba quando a poda elimina todas as saidas. Essa e evidencia direta para calcular `bomb-safe-to-place` no motor antes de consultar uma politica.

Para nao ensinar covardia ao bot, convem separar duas coisas:

- `legalMask`: impossivel agora — parede, cooldown, falta de bomba, skill indisponivel;
- `riskForecast`: possivel, mas arriscado — ETA de chama, rota que fecha, exposicao a oponente.

Somente ilegalidades e morte comprovadamente inevitavel devem ser hard mask. Risco graduado entra no score, permitindo jogadas agressivas intencionais. A mesma mascara deve existir no treino, na inferencia e na validacao final; aplicar apenas depois que o modelo escolheu desperica capacidade e polui a telemetria.

## Inferencia assincrona e freshness

Concorrencia de requests resolve utilizacao e vazao, nao o prazo de uma decisao individual. O paper do vLLM reporta ganho de `2x` a `4x` em throughput no mesmo nivel de latencia, por gerenciamento de KV cache e scheduling ([Kwon et al., SOSP 2023](https://arxiv.org/abs/2309.06180)). A documentacao do Triton mostra que aumentar concorrencia pode elevar p95 pela fila, mesmo quando o throughput sobe; ela recomenda medir a curva de latencia versus vazao em vez de assumir que mais lanes sao sempre melhores ([guia de otimizacao](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/optimization.html)).

O problema de resposta velha e estrutural. A formulacao Real-Time Reinforcement Learning mostra que o MDP tradicional supoe incorretamente que o ambiente fica parado enquanto a acao e escolhida; no regime real-time, estado e acao continuam evoluindo durante a computacao ([Ramstedt e Pal, NeurIPS 2019](https://papers.neurips.cc/paper_files/paper/2019/hash/54e36c5ff5f6a1802925ca009f3ebb68-Abstract.html)). Portanto, ordenar respostas apenas pela chegada nao basta: uma resposta nova pode ter sido calculada sobre um estado mais antigo que outra.

Regras praticas para o laboratorio:

- requests levam `matchId`, `roundId`, `observationTick`, `requestId` e prazo;
- resposta de outra rodada, com precondicao falsa ou mais antiga que o conselho aplicado e descartada;
- nao existe fila ilimitada: uma lane tem no maximo um request em execucao e um estado mais recente aguardando, que substitui o anterior;
- cancelamento economiza trabalho, mas a correcao depende de rejeitar resposta velha mesmo quando o provider nao cancela;
- a LLM retorna macro-intencao compacta; a politica local retorna logits/acao estruturada, sem texto explicativo;
- TTFT, geracao, transporte, fila e idade do snapshot sao medidos separadamente.

Triton expoe contagem pendente, latencia fim a fim, tempo de fila e tempo de inferencia, inclusive quantis configuraveis ([metricas oficiais](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/metrics.html)). Esses mesmos conceitos devem existir na telemetria do laboratorio mesmo quando o provider for 9Router.

Se uma politica local for servida fora do processo do jogo, SEED RL demonstra inferencia centralizada com conexoes gRPC persistentes e batching de chamadas de muitos atores ([Espeholt et al., 2020](https://arxiv.org/abs/1910.06591)). Para quatro bots, centralizar pode amortizar overhead, mas batching so deve ser habilitado quando o p95 continuar abaixo do budget de 100 ms; o scheduler nao pode esperar um batch enquanto o tick vence.

## Ambiente multiagente para treino e avaliacao

PettingZoo define uma API `ParallelEnv` para acoes simultaneas, apropriada para uma arena em que ate quatro bots escolhem no mesmo tick ([documentacao oficial](https://pettingzoo.farama.org/)). Um wrapper fino sobre a `GameApp` headless permitiria treinar e comparar politicas sem criar uma segunda implementacao das regras:

- `reset(seed, roster, spawnPermutation)` inicia uma rodada deterministica;
- `observe(agent)` retorna o mesmo estado estruturado usado em producao e sua `action_mask`;
- `step(actionsByPlayer)` aplica todas as acoes sobre o mesmo snapshot, evitando vantagem pela ordem de iteracao;
- replay registra observacao, mascara, acao pedida, acao aplicada e resultado fisico.

Para evolucao, uma populacao de oponentes e mais robusta que treinar apenas contra a versao atual. COMBAT treinou continuamente contra partidas em Pommerman e produziu o melhor agente de aprendizado da competicao NeurIPS 2018 ([Peng et al., 2018](https://arxiv.org/abs/1812.07297)). A inferencia para o Bomba PvP e manter um league pequeno: V1, V2, planner atual, snapshots historicos fortes e algumas politicas exploratorias. Seeds e adversarios de validacao nao entram na selecao de hiperparametros.

## Telemetria e gates

Os numeros abaixo sao SLOs iniciais propostos para o Bomba PvP, nao resultados publicados:

| Grupo | Metrica | Gate inicial |
| --- | --- | ---: |
| Controle | ciclos autoritativos por segundo | `>= 20` |
| Tatica local | decisoes concluidas por segundo | `>= 10` por bot |
| Tatica local | latencia p95 / p99 | `<= 80 / 100 ms` |
| Freshness | idade observacao-ate-aplicacao p95 | `<= 100 ms` para a camada local |
| Assincrono | respostas obsoletas, canceladas e fila por lane | reportar separadamente; fila efetiva `<= 1` |
| Arbitro | hard masks, overrides de seguranca e fallbacks | contagem e taxa por 100 decisoes |
| Execucao | bombas, detonacoes e skills realmente iniciadas | evento do motor, nao apenas comando solicitado |
| Qualidade | vitorias, self-deaths, mortes de oponente, empates e duracao | por seed, lado, roster e numero de bots |
| Planejamento | nos/rollouts, profundidade exata, horizonte pessimista | p50, p95 e maximo por decisao |

O gate de qualidade deve alternar lado e spawn, incluir duelos e salas de tres/quatro bots, reservar seeds nunca vistos e comparar intervalos de confianca, nao apenas uma media. A ablacao minima e: reflexo sozinho; reflexo + planner; reflexo + politica local; cada variante com e sem conselho LLM. Isso revela se a LLM acrescenta inteligencia estrategica ou apenas correlaciona com uma camada local ja forte.

## Plano de implementacao sugerido

1. **Contrato e medicao:** versionar observacoes e acoes, separar comando solicitado de acao executada e medir p50/p95/p99, freshness e fila.
2. **Mascara canonica:** expor do motor uma unica fonte de legalidade para movimento, bombas, detonacao e skills; adicionar previsao de risco separada.
3. **Planner de 100 ms:** busca exata curta + rollout pessimista ate o horizonte dos explosivos; deadline estrito e fallback.
4. **Opcoes interrompiveis:** transformar `escape`, `collect`, `chase`, `trap`, `zone-control` e `wait` em opcoes com precondicoes e terminacao observaveis.
5. **Wrapper multiagente:** adaptar a `GameApp` headless a um contrato paralelo, com replay e seeds deterministas.
6. **Politica local aprendida:** somente depois de o planner produzir dados bons; destilar acao ou valor para inferencia abaixo de 100 ms.
7. **LLM estrategista:** condicionar objetivos/opcoes, nunca substituir a malha local; medir ganho por ablacao.

## O que evitar

- chamar aumento de lanes de aumento da frequencia de controle; ele aumenta throughput e pode aumentar a idade/fila;
- colocar uma LLM remota no caminho obrigatorio entre snapshot e movimento;
- buscar todas as combinacoes de quatro agentes por dez ou mais passos;
- duplicar fisica, colisao, fusivel ou alcance de skill dentro de cada bot;
- usar penalidade para ensinar ilegalidades que o motor ja conhece;
- contar `useSkill: true` como skill executada sem observar a transicao fisica;
- selecionar o melhor bot nas mesmas poucas seeds usadas para projeta-lo.

## Fontes primarias consultadas

| Tema | Fonte | Contribuicao usada |
| --- | --- | --- |
| Arquitetura hierarquica assincrona | [Gat, ATLANTIS, AAAI 1992](https://flownet.com/gat/papers/aaai92.pdf) | Planner como conselho assincrono; controlador reativo permanece operacional |
| Abstracao temporal | [Sutton, Precup e Singh, 1999](https://www.sciencedirect.com/science/article/pii/S0004370299000521) | Options fechadas, duradouras e interrompiveis |
| Bomberman multiagente | [Pommerman, 2018](https://arxiv.org/abs/1809.07124) | Quatro agentes, observacao parcial e necessidade de metodos complementares |
| Planejamento a 10 Hz | [Osogami e Takahashi, 2019](https://proceedings.mlr.press/v101/osogami19a.html) | 100 ms, busca curta e rollout pessimista alem do fusivel |
| Busca hibrida | [Zhou et al., 2018](https://www.um.edu.mt/library/oar/handle/123456789/81996) | Heuristica continua e busca apenas em momentos relevantes |
| MCTS como guia seguro | [Kartal et al., 2019](https://arxiv.org/abs/1904.05759) | Menos suicidios e melhor aprendizado em Pommerman |
| Action masking | [Huang e Ontanon, 2020](https://arxiv.org/abs/2006.14171) | Fundamentacao e vantagem sobre penalidade de acao invalida |
| Action pruning em Pommerman | [Skynet, 2019](https://arxiv.org/abs/1905.01360) | Rede neural combinada com poda deterministica de acoes perigosas |
| API de mascara/multiagente | [PettingZoo](https://pettingzoo.farama.org/tutorials/custom_environment/3-action-masking/) | Mascara na observacao e API paralela |
| Frequencia de decisao | [Unity ML-Agents](https://docs.unity.cn/Packages/com.unity.ml-agents%401.1/api/Unity.MLAgents.DecisionRequester.html) | Decisao desacoplada da reaplicacao da acao |
| Game AI event-driven | [Unreal Engine 5.8 Behavior Trees](https://dev.epicgames.com/documentation/en-us/unreal-engine/behavior-tree-in-unreal-engine---overview) | Eventos no Blackboard acordam/abortam ramos sem polling integral |
| LLM + affordances | [SayCan, 2022](https://arxiv.org/abs/2204.01691) | LLM escolhe skill de alto nivel; executor filtra o que e possivel |
| Controle neural a 10 Hz | [GT Sophy, Nature 2022](https://www.nature.com/articles/s41586-021-04357-7) | Politica local super-humana com estado estruturado |
| MPC e incerteza | [PETS, 2018](https://arxiv.org/abs/1805.12114) | Trajetorias e modelo probabilistico para planejamento |
| Planejamento real-time | [iCEM, 2021](https://proceedings.mlr.press/v155/pinneri21a.html) | Planejamento com menos amostras e warm start |
| Rolling horizon em jogos | [RHEA, 2020](https://arxiv.org/abs/2003.12331) | Executar a primeira acao, deslocar o plano e replanejar sob budget |
| Estado muda durante inferencia | [Real-Time RL, 2019](https://papers.neurips.cc/paper_files/paper/2019/hash/54e36c5ff5f6a1802925ca009f3ebb68-Abstract.html) | Versionar observacoes e rejeitar decisoes obsoletas |
| Serving LLM | [vLLM/PagedAttention, SOSP 2023](https://arxiv.org/abs/2309.06180) | Throughput maior sem alegar queda equivalente da latencia individual |
| Serving e observabilidade | [NVIDIA Triton](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/optimization.html) | Curva concorrencia-latencia e decomposicao de fila/inferencia |
| Inferencia centralizada | [SEED RL, 2020](https://arxiv.org/abs/1910.06591) | Streaming persistente e batching entre atores |
| Treino por populacao | [COMBAT/Pommerman, 2018](https://arxiv.org/abs/1812.07297) | Partidas continuas contra populacao de oponentes |

## Limites da transferencia

Pommerman usa passos discretos de 100 ms; o Bomba PvP combina grid logico com posicao em pixels, movimento reaplicado e skills proprias. Portanto, os numeros de profundidade nao devem ser copiados cegamente. O principio transferivel e limitar branching no futuro proximo, projetar perigos ate o horizonte causal e recalcular sempre. GT Sophy prova que 10 Hz pode bastar para desempenho excepcional em um dominio continuo, mas nao prova que qualquer politica, observacao ou latencia de 100 ms sera suficiente para este jogo. Os SLOs e gates acima precisam ser validados no laboratorio local.
