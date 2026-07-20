# Wayfinder

Guia curto para localizar trabalho relacionado ao novo runtime.

## Onde comecar

- Regras, estado, comandos, eventos, tick de 20 ms e restauracao: `GameMechanics/`.
- Decisoes arquiteturais do runtime: `GameMechanics/decisions/`.
- Skills em migracao para o novo runtime: `Champions/`.
- Bots, audio e online: procure os adaptadores que consomem comandos, snapshots e eventos de `GameMechanics`; esses componentes ficam fora do kernel.

## Como decidir onde uma mudanca pertence

Coloque em `GameMechanics` apenas codigo que precisa participar da simulacao deterministica. Uma funcao do kernel deve depender de estado e entradas explicitas, avancar em multiplos de 20 ms e produzir estado ou eventos sem I/O.

Mantenha fora do kernel:

- renderizacao e animacao;
- captura de teclado ou controle;
- Web Audio e escolha de assets;
- sockets, transporte e serializacao de protocolo;
- relogio de parede e agendamento;
- estrategia e orquestracao de bots.

Bots e adaptadores convertem suas entradas em comandos. Audio e apresentacao consomem eventos. O adaptador online valida snapshots externos pelo `restore` publico.

## Validacao

`initial(config)` valida a configuracao uma vez. Se os dados vieram de JSON, storage, rede ou outra versao, use `restore(raw)` para validacao profunda e congelamento. Se o estado ja cruzou uma dessas fronteiras, o hot path confia no TypeScript e nao repete a validacao global.

## Compatibilidade

Procure `mechanicsRevision` para identificar a revisao mecanica. A constante e manual e deve mudar apenas quando snapshots ou replays anteriores deixarem de ter a mesma semantica. Nao procure nem adicione hashes FNV, fingerprints de topologia, versoes por modulo, historico do mundo, gate scores ou rituais.

## Fronteira de trabalho

A fronteira atual e exatamente:

1. skills de `Champions` no novo runtime;
2. bots;
3. audio;
4. adaptador online.

Nao assuma que outros sistemas ja foram migrados. Ao ampliar a fronteira, atualize primeiro a decisao arquitetural e estes documentos.
