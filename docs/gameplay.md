# Gameplay

- `src/main.ts` monta o launcher. Ao receber `/arena/`, faca navegacao de documento completo para isolar o ciclo de vida do jogo.
- `arena/index.html` carrega `src/original-game/main.ts`, que inicia `GameApp` e os assets originais.
- Preserve o contrato `/arena/?mode=<modo>&character=<uuid>`. `training` inicia 1 bot em `classic`; `continuous` inicia 3 bots em `endless`.
- `lab` recebe `model1` e `model2`, inicia P1/P2 na mesma `GameApp` autoritativa e aplica apenas decisoes validadas por `src/lab/controller.ts`.
- `training` e `continuous` continuam offline. O modo `lab` reutiliza apenas o input autoritativo de `NetCode/`; ele nao abre uma sessao multiplayer.
- Mantenha assets em `public/Assets/` e respeite maiusculas e minusculas nos caminhos publicados.
- O laboratorio usa somente `/api/lab/models` e `/api/lab/decision`: Worker -> broker Node local -> 9Router. Chaves e o segredo interno nunca chegam ao navegador.
- Rode o backend local com `npm run lab:broker` e o tunnel com `npm run lab:tunnel`. O bundle usa `dist/_app/` para nao colidir com `public/Assets/` no Windows/Cloudflare.
- Em producao, `LAB_BROKER_URL` aponta para `lab-broker.bombapvp.com` e `LAB_BROKER_SECRET` deve existir como secret do Worker com o mesmo valor local.
