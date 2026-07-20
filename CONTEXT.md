# Bomba PvP

Este contexto descreve a linguagem pública das partidas de Bomba PvP. Os termos existem para impedir que modos, participantes e ciclos diferentes sejam tratados como se fossem a mesma coisa.

## Language

**Kernel de gameplay**:
A simulacao deterministica canonica das regras de arena e da evolucao de uma partida, compartilhada por experiencias locais e online.
_Avoid_: GameApp, modo de teste, renderer, servidor

**Oraculo de caracterizacao**:
O comportamento observavel do jogo publico atual usado para especificar paridade; suas regras e ideias sao referencia, mas seu codigo e sua arquitetura nao sao reutilizados.
_Avoid_: codigo-base, implementacao canonica, motor a reaproveitar

**PvP online**:
Uma experiência em que pelo menos dois jogadores humanos, conectados pela rede, controlam competidores na mesma partida. Uma partida apenas contra bots não é PvP online.
_Avoid_: sala contínua offline, treino, bots locais

**Jogador**:
Uma pessoa que participa do produto e pode controlar um competidor durante uma partida.
_Avoid_: assento, competidor, conexão

**Competidor**:
A entidade ativa dentro da arena, controlada por um jogador ou por um Completer.
_Avoid_: usuário, conexão

**Assento**:
Uma posição disponível na composição da partida, ocupada por exatamente um competidor por vez.
_Avoid_: jogador, socket

**Completer**:
Um competidor controlado pelo jogo que ocupa temporariamente um assento sem jogador humano.
_Avoid_: jogador, usuário

**Sala**:
O grupo de assentos e participantes que compartilha a mesma sequência de rodadas.
_Avoid_: fila, partida, servidor

**Partida**:
A disputa contínua vivida pelos competidores de uma sala, composta por uma ou mais rodadas segundo o modo escolhido.
_Avoid_: sala, rodada

**Rodada**:
Um ciclo individual de arena que começa com competidores posicionados e termina com um resultado antes do próximo ciclo.
_Avoid_: partida

**Sessão do jogador**:
A participação lógica de um jogador no online, que pode sobreviver a uma troca temporária de conexão durante a janela de reconexão.
_Avoid_: WebSocket, assento, conta

**Duelo online 1v1 (`duel-1v1-v1`)**:
O primeiro contrato público do PvP online: exatamente dois jogadores humanos, um competidor por jogador, sem Completer, bot, chat ou fallback offline. Um jogador sozinho permanece na fila; a partida só começa quando os dois assentos humanos chegam ao servidor autoritativo.
_Avoid_: sala contínua, host no navegador, partida contra bot
