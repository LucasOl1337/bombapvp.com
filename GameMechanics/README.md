# GameMechanics

`GameMechanics` e o novo runtime deterministico das regras da partida. O objetivo e manter um kernel pequeno, previsivel e facil de testar, sem transportar para o hot path controles que pertencem apenas as fronteiras publicas.

## Contrato do kernel

- A simulacao avanca em passos fixos de **20 ms**.
- A mesma configuracao, estado inicial e sequencia de comandos devem produzir o mesmo estado e os mesmos eventos.
- O estado aceito pelo kernel e congelado; durante a simulacao, o hot path confia nesse estado e nos tipos do TypeScript.
- Validacao profunda acontece somente nas fronteiras publicas `initial(config)` e `restore(raw)`. APIs internas nao repetem validacoes estruturais a cada tick.
- Compatibilidade de replay/snapshot usa `mechanicsRevision = "mechanics-v1"`, revisao manual alterada quando uma mudanca altera a semantica da simulacao.

## Escopo

O modulo deve conter regras puras, tipos de estado e comando, restauracao validada, stepping deterministico e eventos mecanicos. Renderizacao, relogio de parede, rede, audio, persistencia e controle de bots ficam fora do kernel e o consomem por adaptadores.

Nao fazem parte do desenho: fingerprint FNV ou de topologia, tabelas de versao por modulo, historico do mundo, gate scores ou rituais de validacao. A seguranca vem de fronteiras claras, estado congelado, TypeScript e testes direcionados.

## Fronteira publica

A superficie publica deve permanecer curta:

1. criar uma partida com `initial(config)`, validando a configuracao uma vez;
2. restaurar um snapshot com `restore(raw)`, validando profundamente, congelando o resultado e verificando `WORLD_FORMAT_VERSION` e `mechanicsRevision`;
3. aplicar comandos para o proximo passo;
4. avancar exatamente um passo de 20 ms;
5. ler o novo estado congelado e os eventos emitidos.

Dados vindos de JSON, rede, storage ou versoes anteriores nunca entram diretamente no hot path: passam pelo `restore` publico. Testes cobrem essas fronteiras e o comportamento mecanico sem inserir validacao global no tick.

## Fronteira atual

A fronteira de implementacao e **exatamente**:

- skills de `Champions` no novo runtime;
- bots;
- audio;
- adaptador online.

Itens fora dessa lista nao devem ser apresentados como migrados ou garantidos pelo novo runtime.
