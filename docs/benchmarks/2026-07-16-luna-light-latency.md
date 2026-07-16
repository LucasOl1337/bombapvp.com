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
