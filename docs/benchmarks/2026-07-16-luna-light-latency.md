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
