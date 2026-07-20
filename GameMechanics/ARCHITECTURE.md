# Arquitetura

## Visao geral

A partida e organizada em torno de um kernel deterministico de `GameMechanics`. O kernel recebe estado congelado e comandos, avanca um passo fixo de **20 ms** e devolve outro estado congelado com eventos. Integracoes observam esses eventos ou traduzem entradas externas; elas nao alteram as regras durante o tick.

```text
UI / bots / online
        |
        v
 comandos tipados
        |
        v
GameMechanics (tick fixo de 20 ms)
        |
        +--> estado congelado
        +--> eventos mecanicos --> audio / apresentacao / online
```

## Kernel

O kernel concentra somente semantica de jogo:

- tipos de configuracao, comando, estado e evento;
- criacao deterministica do estado inicial;
- aplicacao ordenada de comandos;
- atualizacao por tick fixo de 20 ms;
- restauracao publica de snapshots;
- `mechanicsRevision` manual.

Nao depende de DOM, canvas, Web Audio, sockets, relogio de parede ou armazenamento. Aleatoriedade, quando necessaria, faz parte do estado deterministico e nunca vem diretamente do ambiente.

## Validacao e desempenho

A validacao profunda pertence as fronteiras publicas. `initial(config)` valida a configuracao uma vez. `restore(raw)` trata snapshots como dados nao confiaveis, valida a estrutura, verifica `WORLD_FORMAT_VERSION` e `mechanicsRevision`, e congela o estado.

Depois dessa fronteira, o hot path confia no estado congelado e no TypeScript. O tick pode fazer apenas verificacoes locais exigidas pela propria regra; ele nao percorre novamente o grafo inteiro para provar invariantes ja estabelecidos.

## Compatibilidade

`mechanicsRevision` e a string manual `"mechanics-v1"`, alterada quando a semantica mecanica muda de modo incompativel. `WORLD_FORMAT_VERSION` permanece separado apenas para compatibilidade estrutural de `restore`. Nao existem fingerprint FNV ou de topologia, tabelas de versao por modulo, historico do mundo, gate scores nem rituais de promocao.

## Adaptadores

- **Champions:** skills entram no kernel como regras deterministicas e emitem eventos sem executar apresentacao ou I/O.
- **Bots:** leem uma visao do estado e produzem comandos; nao possuem caminho privilegiado para mutar a partida.
- **Audio:** traduz eventos mecanicos em som e pode descartar ou agrupar efeitos sem afetar o estado.
- **Online:** converte mensagens em comandos e snapshots; dados recebidos passam pelo `restore` publico antes de participar da simulacao.

## Fronteira atual

A fronteira atual e exatamente skills de `Champions` no novo runtime, bots, audio e adaptador online. O restante continua fora desta arquitetura ate migracao explicita. Documentacao e testes nao devem declarar cobertura alem dessa fronteira.
