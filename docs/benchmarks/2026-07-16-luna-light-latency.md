# Luna Leve: latencia do prompt de decisao imediata

Data: 2026-07-16  
Rota: `cx/gpt-5.6-luna`  
Endpoint: 9Router local OpenAI-compatible  
Amostra: quatro chamadas sequenciais por variante, mesmo snapshot representativo com cerca de 827 tokens de entrada

## Resultado

| Variante | Latencias (ms) | Mediana | Tokens de saida | Mediana | JSON valido |
| --- | --- | ---: | --- | ---: | ---: |
| Prompt anterior | 6869, 6402, 4943, 7724 | 6635,5 ms | 213, 253, 177, 155 | 195 | 4/4 |
| Acao imediata | 4392, 4152, 4187, 3091 | 4169,5 ms | 127, 96, 151, 82 | 111,5 | 4/4 |

Na amostra, pedir uma acao imediata reduziu a mediana de latencia em aproximadamente 37% e a mediana de tokens de saida em aproximadamente 43%, sem mudar a rota e sem enviar campos de reasoning/thinking/effort.

## Payload comparado

As duas variantes usaram o mesmo contrato JSON, `response_format: { "type": "json_object" }`, `stream: false` e `max_completion_tokens: 120`. A unica mudanca relevante foi acrescentar ao system prompt:

```text
Act immediately. Do not analyze, explain or plan.
```

O 9Router reportou em experimentos separados mais tokens de conclusao do que o valor solicitado em `max_completion_tokens`; por isso esse parametro nao deve ser usado como prova de limite efetivo. A telemetria retornada pelo provider continua sendo a fonte de verdade.

## Limites

Este e um experimento operacional curto, nao um SLA. Latencia de modelo e provider varia com carga, cache e infraestrutura. Repetir a mesma matriz antes de tomar decisoes futuras de roteamento.

## Cadencia das lanes do controlador

O benchmark deterministico de `tests/lab.test.ts` usa RTT fixo de 2.000 ms e uma janela de 5.000 ms. Ele mede decisoes efetivamente aplicadas pela interface publica `startLabController`, nao apenas requisicoes iniciadas.

| Controlador | Decisoes aplicadas em 5 s | Cadencia |
| --- | ---: | ---: |
| 2 lanes | 4 | 0,8 decisao/s |
| 4 lanes escalonadas em 500 ms | 7 | 1,4 decisao/s |

Na simulacao controlada, quatro lanes aumentaram a cadencia aplicada em 75%. O stagger e refeito no inicio de cada rodada, produzindo snapshots dos frames 0, 500, 1.000 e 1.500 em vez de quatro copias do mesmo estado. Depois disso, cada lane reinicia imediatamente ao receber uma resposta; nao existe espera intencional entre requisicoes.

## Arquitetura para controle em tempo real

A medicao em producao ficou em aproximadamente 0,22 a 0,28 resposta LLM aplicada por segundo, com round-trip medio entre 4 e 5 segundos. Aumentar lanes melhorou a vazao, mas nao transforma uma chamada remota lenta em controle de jogo de 10 Hz. A arquitetura passou a separar duas taxas:

| Camada | Frequencia | Responsabilidade |
| --- | ---: | --- |
| Planejador Luna | conforme o round-trip | Escolher direcao e intencoes de bomba, detonacao e skill |
| Motor local | 20 Hz (50 ms) | Reaplicar a intencao mais recente sobre o estado atual |
| Reflexo de seguranca | dentro do motor local | Substituir somente o movimento quando a casa atual/proxima esta em perigo iminente e suprimir ataques durante a fuga |

O benchmark deterministico do motor executa pelo menos 20 ciclos em 1 segundo. Competidores compartilham o mesmo snapshot por tick, e o danger map e reutilizado no mesmo frame. Bomba, detonacao e skill continuam sendo pulsos unicos originados pela LLM; uma bomba sem rota de fuga e cancelada antes de entrar no latch, e um override substitui o input autoritativo inteiro para remover pulsos pendentes. O reflexo local nunca cria um ataque. O HUD mostra `LLM/S`, `MOTOR/S` e `SAFE` separadamente, portanto 20 Hz de execucao nao e apresentado como 20 inferencias remotas por segundo.

### Referencias primarias

- [NVIDIA ACE](https://www.nvidia.com/en-au/geforce/news/nvidia-ace-autonomous-ai-companions-pubg-naraka-bladepoint/) descreve jogadores fazendo cerca de 8 a 13 microdecisoes por segundo e recomenda modelos pequenos locais para cognicao frequente, com modelos maiores na nuvem em menor frequencia.
- [HLA: LLM-Powered Hierarchical Language Agent](https://arxiv.org/abs/2312.15224) separa Slow Mind, Fast Mind e um Executor reativo para transformar macro-acoes em acoes atomicas em tempo real.
- [OpenAI Five](https://openai.com/index/openai-five/) observava cada quarto frame de Dota; o artigo tecnico reporta rollouts a 7,5 passos por segundo, usando uma politica local em vez de uma chamada LLM remota por passo.
- [Unity ML-Agents](https://unity-technologies.github.io/ml-agents/Learning-Environment-Design-Agents/) formaliza o ciclo observacao-decisao-acao por passos e recomenda escalonar o passo de decisao entre agentes.
- [Hierarchical Control in Multi-Agent Games](https://arxiv.org/abs/2606.20014) usa LLM como controlador estrategico e politicas RL especializadas para execucao reativa.
- [The Last Arrow](https://github.com/LucasOl1337/The-Last-Arrow/blob/main/Assets/ProjectPVP/Scripts/Runtime/Input/AiArenaFrameExecutor.cs) aplica o mesmo padrao no projeto de referencia: intencao estrategica de curta validade e executor local por frame com validacao de ameacas.
