# Gameplay

- `src/main.ts` monta o launcher. Ao receber `/arena/`, faca navegacao de documento completo para isolar o ciclo de vida do jogo.
- `arena/index.html` carrega `src/original-game/main.ts`, que inicia `GameApp` e os assets originais.
- Preserve o contrato `/arena/?mode=<modo>&character=<uuid>`. `training` inicia 1 bot em `classic`; `continuous` inicia 3 bots em `endless`.
- `lab` recebe de `model1` a `model4` (no minimo dois slots contiguos), inicia todos na mesma `GameApp` autoritativa e aplica apenas decisoes LLM validadas por `src/lab/controller.ts`. O valor reservado `bot-v1` usa localmente o bot deterministico existente; salas podem misturar V1 e LLMs.
- `training` e `continuous` continuam offline. O modo `lab` reutiliza apenas o input autoritativo de `NetCode/`; ele nao abre uma sessao multiplayer.
- Mantenha assets em `public/Assets/` e respeite maiusculas e minusculas nos caminhos publicados.
- O laboratorio usa somente `/api/lab/models` e `/api/lab/decision`: Worker -> broker Node local -> 9Router. Chaves e o segredo interno nunca chegam ao navegador.
- Durante uma partida `lab`, `window.get_lab_telemetry()` retorna um snapshot JSON de leitura rapida por jogador: tempo de decisao (ultimo/medio/p95), cadencia, erros, estabilidade e intencoes de acao, latencia 9Router/transporte, tokens, abates, vitorias e upgrades atuais. O V1 mede computacao local; LLMs medem o round-trip completo.
- Rode o backend local com `npm run lab:broker` e o tunnel com `npm run lab:tunnel`. O bundle usa `dist/_app/` para nao colidir com `public/Assets/` no Windows/Cloudflare.
- Em producao, `LAB_BROKER_URL` aponta para `lab-broker.bombapvp.com` e `LAB_BROKER_SECRET` deve existir como secret do Worker com o mesmo valor local.
