# Sistemas pares e modulos verticais

## Question

Como dividir a gameplay sem criar um novo monolito ou centenas de interfaces?

## Decision

A simulacao possui um `WorldState` canonico, versionado e sem estado persistente
secreto. Um scheduler deterministico executa fases declaradas e nao contem regra
de gameplay.

Arena, movimento, bombas, explosoes, dano, pickups, habilidades e ciclo de
partida sao sistemas pares. Sistemas nao importam outros sistemas diretamente;
interagem apenas pelo estado canonico e por eventos deterministico-ordenados.

Cada mecanica, modo e Champion e um modulo vertical autocontido, registrado
estaticamente no build. Seu manifesto declara identidade e versao, sistemas e
fases, acesso ao estado, comandos, eventos, configuracao, assets e testes. O
registro valida conflitos de ownership.

Consistencia nao significa boilerplate: nao existem arquivos vazios
obrigatorios, plugin dinamico, event bus assincrono nem grande `switch` central.

## Consequences

- A topologia e a ordem da simulacao podem ser inspecionadas sem conhecer
  implementacoes escondidas.
- Browser, servidor, bots e replay adaptam o mesmo estado e os mesmos comandos;
  nenhum deles contem regras alternativas.
- Novos modulos seguem o mesmo protocolo e nao ganham caminhos privilegiados.
