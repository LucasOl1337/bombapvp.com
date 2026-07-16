# Gameplay

- `src/main.ts` monta o launcher. Ao receber `/arena/`, faca navegacao de documento completo para isolar o ciclo de vida do jogo.
- `arena/index.html` carrega `src/original-game/main.ts`, que inicia `GameApp` e os assets originais.
- Preserve o contrato `/arena/?mode=<modo>&character=<uuid>`. `training` inicia 1 bot em `classic`; `continuous` inicia 3 bots em `endless`.
- Trate os dois modos atuais como partidas offline contra bots. Os modulos em `NetCode/` nao sao iniciados pelo bootstrap atual.
- Mantenha assets em `public/Assets/` e respeite maiusculas e minusculas nos caminhos publicados.
