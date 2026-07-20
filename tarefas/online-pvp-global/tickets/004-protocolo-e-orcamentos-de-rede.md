---
status: open
type: prototype
assignee:
parent: ../MAP.md
blocked_by:
  - ./001-contrato-publico-do-pvp.md
  - ./002-autoridade-e-runtime-da-partida.md
assets:
  - ../prototypes/current-json-protocol-baseline.md
---

# Protocolo e orçamentos de rede

## Question

Qual protocolo versionado, cadência de simulação, frequência de inputs/snapshots, codificação full/delta e estratégia de previsão, reconciliação, interpolação e extrapolação atingem os limites explícitos de latência, jitter e bytes por jogador?

## Evidência de produção em 2026-07-20

Amostra de 12 segundos com dois clientes no mesmo runner, um por domínio público, passando pelo edge Cloudflare GRU:

- 245 frames por cliente, **20,06 Hz**;
- intervalo entre frames p50 **49,8 ms**, p95 **54,1–55,6 ms**, máximo **91,6–118,9 ms**;
- ACK exato do input p50 **157,8–161,5 ms**, p95 **173,9–174,3 ms**, máximo **220,2–242,1 ms**;
- 360/360 inputs reconhecidos em cada assento;
- 7 keyframes e 238 deltas por cliente;
- aproximadamente **5,32 kB/s** (**5,19 KiB/s**) downstream por cliente;
- nenhum erro de protocolo.

Essa amostra confirma a cadência e o orçamento de bytes, mas não é prova inter-regional: os dois clientes compartilhavam máquina e rede, e o sufixo GRU do `CF-RAY` identifica o edge de entrada, não a localização física do Durable Object.

## Incidente de apresentação encontrado

O lag extremo observado após a ativação não vinha de jitter sustentado do stream. A ponte `startOnlineDuelGame` expandia corretamente os deltas, mas enviava todos eles ao caminho pesado `GameApp.applyOnlineSnapshot`. Esse caminho recriava a arena e marcava o canvas estático como sujo em cada frame de rede, forçando a reconstrução completa de piso, paredes e caixas cerca de 20 vezes por segundo.

Correção publicada:

- snapshot completo somente na primeira hidratação;
- `applyOnlineFrame` para o estado contínuo;
- jogadores, bombas, chamas, power-ups, overlays e áudio continuam atualizados em todo frame;
- cache estático invalidado somente quando `breakableTiles` ou paredes de sudden death mudam;
- teste de regressão cobre frame de movimento sem invalidação e remoção de caixa com invalidação.

Validação pós-correção em produção, durante 6 segundos de movimento sustentado:

- 1.002 callbacks de `requestAnimationFrame`, **166,98 FPS** no monitor de alta frequência;
- frame time p95 **8,4 ms**, p99 **12,7 ms**, máximo **49,9 ms**;
- 4 frames acima de 25 ms, nenhum acima de 50 ms e nenhuma long task;
- 128 frames autoritativos recebidos no intervalo, zero resync e zero erro de console;
- deslocamento local de 44,583 px até colisão, confirmando captura e previsão do comando.

## Ainda aberto para fechar o ticket

- repetir ACK/jitter em duas máquinas e redes físicas distintas;
- medir pares Brasil–América do Norte, Brasil–Europa e intra-região;
- estabelecer limites de aceitação explícitos para p95/p99 e perda de frame;
- testar degradação controlada, perda, reorder, reconexão e carga concorrente;
- decidir com dados se 20 Hz downstream permanece suficiente ou se 30 Hz compensa o custo adicional.
