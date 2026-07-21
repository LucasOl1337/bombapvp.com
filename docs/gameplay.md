# Gameplay

SOMENTE ao alterar regras, controles, bots ou URL.

## Entrada e modos

A raiz e `/GameMechanics/` carregam `GameMechanics/src/browser/main.ts`. A landing oferece tres modos preservados por uma configuracao tipada:

- **Duelo local** (`mode=local`): P1 e P2 humanos no mesmo teclado.
- **Treino vs bot** (`mode=training`): P1 humano e P2 controlado pelo perfil escolhido.
- **Laboratorio de IA** (`mode=lab`): P1 e P2 controlados por perfis escolhidos; a partida usa a mesma GameMechanics dos outros modos e termina em `match-over`.

Use `p1=<slug|uuid>` e `p2=<slug|uuid>` para escolher os Champions. No treino, `bot=bomb|pingo|v1|v2|v3` escolhe o perfil de P2. No laboratorio, `bot1=<perfil>` e `bot2=<perfil>` escolhem os dois competidores. `char1`, `char2`, `control2=bot`, `p2=bot` e `bot=1` continuam como compatibilidade; um valor nomeado em `bot=<perfil>` tambem ativa corretamente o treino.

Use `skipSelect=1` para iniciar a configuracao da URL sem abrir a landing e `dev=1` para diagnosticos. A URL e apenas serializacao/deep-link; `GameMechanics/src/browser/match-mode.ts` e a fronteira de estado autoritativa do adaptador.

## Bots e laboratorio

Os perfis canonicos Bomb, Pingo, V1, V2 e V3 ficam em `Champions/bots.ts`. A identidade, personalidade, preferencias e conhecimento privado ficam em pastas versionadas sob `GameMechanics/content/bot-mastery/<bot>/`; o Champion escolhido pelo jogador continua autoritativo e nunca e substituido silenciosamente por uma preferencia. Cada slot resolve perfil e modelo uma vez antes da partida. Bots observam somente o snapshot congelado e produzem `GameCommand[]` comuns.

Tecnicas adquiridas sao dados declarativos validados com versoes exatas do schema, jogo, mecanicas, conteudo, Champion UUID e skill. O interpretador fechado pode emitir apenas comandos existentes; nao aceita callback, codigo, expressao, prompt ou import dinamico. Conhecimento stale/invalido fica inelegivel e o bot continua com a politica base. Hipoteses autorais, eventos mecanicamente observados e tecnicas promovidas permanecem separados.

O laboratorio mostra perfil, versao do modelo, maestria, tecnica selecionada, contagem de decisoes/eventos, fase/rodada/placar e resultado. O controle `Gravacao off/on` e explicitamente desligado por padrao; quando ativado, registra eventos estruturados append-only somente em memoria. `window.get_bot_lab_experience()` expoe uma copia readonly para observacao do laboratorio. Producao nao grava rede, banco ou `localStorage`.

Pausa e retomada usam o facade atual; `Reiniciar` repete a mesma seed, recria sink/memoria/PRNG e o transcript volta a ser reproduzivel, enquanto `Nova partida` avanca para uma nova seed deterministica. A velocidade 1x/2x/4x multiplica apenas quantos ticks fixos o adaptador consome por tempo de parede e nunca altera a duracao ou o estado interno de um tick.

Campanhas offline usam `GameMechanics/scripts/run-bot-mastery-campaign.ts`, segmentos JSONL single-writer e o mesmo driver/GameMechanics. O projetor numerico nunca grava o modelo: `project-bot-mastery-campaign.ts` reaplica gates e a curadoria revisada e uma mudanca normal de fonte. O primeiro ciclo esta documentado em `GameMechanics/training/bot-mastery-v1/`; somente `ranni.danger-blink.v1` passou a curadoria causal final.

O hostname mantem o contrato existente: `bombapvp.com` usa PT-BR e `bombpvp.com` usa EN.

## Controles

Controles: P1 usa `WASD`, `Q` e `Espaco`/`R` (`E` e alias); P2 usa setas, `O` e `I` (`P` e alias). `Esc` pausa, `T` reinicia e `M` alterna o som.

A simulacao usa ticks fixos de 20 ms. Bots recebem snapshot congelado e devolvem apenas comandos comuns da engine.

## Ranni: Ice Blink

Ao ativar, o corpo fisico congela imediatamente e permanece na origem durante a
canalizacao. O movimento controla uma projecao espectral separada, que ignora
paredes, caixas e bombas durante o trajeto. O teleporte so acontece ao concluir
com um segundo `R` ou ao final da janela de 2,5 segundos. A projecao se move a
metade da velocidade normal; a habilidade continua exigindo um destino final
valido.
