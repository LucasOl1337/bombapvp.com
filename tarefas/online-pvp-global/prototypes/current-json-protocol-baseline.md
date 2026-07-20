# Baseline do protocolo JSON preservado

Medição em 2026-07-19 sobre o motor consolidado no checkout, reproduzindo a proposta preservada em `_work`: simulação fixa, mensagem `host-snapshot` completa a 20 Hz e `guest-input` JSON a 60 Hz.

| Métrica | Resultado |
| --- | ---: |
| Snapshot mínimo | 7.680 bytes |
| Snapshot médio | 8.027 bytes |
| Snapshot máximo | 8.375 bytes |
| Download por jogador a 20 Hz | 156,77 KiB/s |
| Download por jogador por hora | 551,14 MiB |
| Mensagem de input | 177 bytes |
| Upload por jogador a 60 Hz | 10,37 KiB/s |
| Upload por jogador por hora | 36,46 MiB |
| Simulação Node, 4 bots | 0,9296 ms por fixed tick |

Esses valores não incluem overhead de WebSocket/TLS e, portanto, são um piso. O desenho full-snapshot JSON não satisfaz o destino do mapa; a decisão de protocolo deve avaliar estado incremental binário, keyframes espaçados, inputs por mudança/evento e heartbeat compacto.

Reproduzir:

```powershell
npx vite-node tarefas/online-pvp-global/prototypes/measure-current-json-protocol.ts
```
