# Handoff: PvP online global

Este é o ponto de entrada canônico para retomar o objetivo em uma sessão nova. Ele registra o estado do checkout em **2026-07-20**, sem substituir o [mapa Wayfinder](./MAP.md) nem as resoluções dos tickets.

## Segurança do checkout

- Repositório: `C:\Projetos\bombpvp`.
- Branch atual: `main`; HEAD observado: `866f77398220491312890f7361862babd4346f43`.
- O checkout está muito sujo e é compartilhado. Há alterações rastreadas e muitos arquivos não rastreados de online, personagens, bots e assets.
- Nunca usar `git clean`, `git reset --hard`, `git checkout --` ou `git stash`.
- Não assumir que uma alteração concorrente é descartável.
- Não fazer commit, push, deploy, configurar segredo, comprar plano ou alterar infraestrutura sem ordem explícita do dono.
- Push na `main` publica diretamente em `bombapvp.com` e `bombpvp.com`; não existe staging separado.

## Leitura mínima ao retomar

1. `AGENTS.md` e `INDEX.md`.
2. Este handoff.
3. [Mapa: PvP mundial e consolidação do próximo release](./MAP.md).
4. [Servidor autoritativo por partida](../../docs/adr/0001-servidor-autoritativo-por-partida.md).
5. [Primeiro PvP online é duelo 1v1](../../docs/adr/0002-primeiro-pvp-online-e-duelo-1v1.md).
6. Somente o ticket escolhido para a sessão; não carregar todos os tickets de novo.

## Estado honesto

Estimativa registrada com o dono:

- objetivo de produção completo: **aproximadamente 65%**;
- vertical local do duelo 1v1: **aproximadamente 80%**;
- validação real entre regiões/Internet: **aproximadamente 30%**;
- prontidão para publicar com segurança: **aproximadamente 55%**.

Esses percentuais não são métricas de CI. Eles separam implementação local de prova operacional real.

## Contrato já decidido

- Modo: `duel-1v1-v1`.
- Exatamente dois jogadores humanos.
- Nenhum bot, Completer, chat ou fallback offline silencioso.
- Um jogador sozinho permanece na fila.
- O servidor é a única autoridade; clientes enviam comandos, nunca snapshots.
- Uma simulação e um Durable Object por partida; matchmaking separado.
- Kernel/protocolo são provider-neutral. Durable Objects são o adaptador atualmente executável, não uma prova de latência mundial.
- Simulação a 60 Hz, input a 30 Hz e frames a 20 Hz.
- Upstream de gameplay: comando binário fixo de 16 bytes.
- Downstream: envelope binário com keyframe/delta, ack, resync e histórico limitado.
- Janela de reconexão: 10 segundos.
- Revisão atual de conteúdo: `duel-1v1-v1.2026-07-19.2`.

## O que já está implementado

- Launcher usa `mode=online&character=<uuid>` e entra na fila real.
- Preflight `/api/online` falha honestamente se o serviço ou segredo não estiver configurado; nenhuma partida offline é substituída.
- `OnlineMatchmakingRoom` mantém a fila 1v1 e emite tickets HMAC curtos, recíprocos e vinculados ao assento.
- `OnlineMatchRoom` valida tickets, cria a simulação por partida e aceita somente comandos do assento autenticado.
- Seed explícita e comum aos dois tickets determina a distribuição lógica da arena.
- Cliente suporta keyframe, delta, resync, ack de input e reconexão de 10 segundos com rotação de token confirmada por `match.ready.ack`.
- Ticket inicial e token-fallback só permanecem recuperáveis enquanto a geração seguinte de `match.ready` não foi confirmada pela conexão ativa; controles atrasados de conexão substituída são ignorados.
- O input do `GameApp` é enviado a 30 Hz e preserva pulsos de bomba/skill durante uma queda de transporte.
- A primeira hidratação do cliente usa o snapshot completo; frames seguintes usam `applyOnlineFrame`, preservam o cache estático da arena e só o invalidam quando caixas ou paredes de sudden death realmente mudam.
- O servidor distingue conclusão natural, forfeit, timeout de chegada e sobrecarga por `match.ended`.
- O frame final precede `match.ended`; o cliente aplica o resultado antes de `match.ended.ack`, e o servidor fecha após ACK ou fallback de 1 segundo.
- O launcher chama o modo de `Duelo online 1v1` / `Online 1v1 duel`.
- Roster lógico vem de `Champions/membership.ts`; não existe uma segunda lista manual no servidor.
- Skills dos oito personagens usam identidades leves e não puxam retratos para o Worker.
- O Worker usa áudio e visual headless e não empacota PNG, áudio, `definition.ts`, catálogos visuais ou `sound-manager.ts`.
- Bomb/Pingo e regressões de perigo/egress/flames foram corrigidos e testados antes desta consolidação.

## Limite arquitetural ainda aberto

O servidor ainda usa `GameAppCharacterizationKernel`, apoiado no `GameApp` de aproximadamente 6.951 linhas. Ele funciona headless e não carrega mídia, mas o bundle ainda contém código de bots, HUD, i18n e apresentação porque a simulação e a UI continuam no mesmo módulo.

Não chamar esse adaptador de kernel puro nem fechar [Paridade do motor e de todos os personagens](./tickets/006-paridade-do-motor-e-personagens.md) enquanto cliente, servidor e testes não consumirem um kernel determinístico separado de DOM, canvas, áudio, bots e apresentação.

## Missão da próxima sessão

Resolver somente [Protocolo e orçamentos de rede](./tickets/004-protocolo-e-orcamentos-de-rede.md), seguindo a ordem já registrada no mapa. Não iniciar esse ticket a partir deste handoff; uma nova sessão deve primeiro ler o contrato do repositório, este arquivo, o mapa, os ADRs e somente então reivindicar o 004.

O ticket 005 está concluído: mesma Sessão e mesmo Assento por 10 segundos, input neutro durante ausência, ticket/token recuperáveis somente até o ACK da geração seguinte, frame final antes do término, dois ACKs de aplicação separados e política de drain antes de deploy. Não reabrir esse escopo sem uma regressão reproduzível.

Limites que continuam abertos para prova operacional:

- nenhum teste com WebSockets reais no `workerd`, dois browsers em máquinas distintas ou falhas de rede injetadas;
- nenhum teste de restart do Durable Object ou múltiplas regiões;
- resultado terminal não persistido após restart/deploy;
- drain decidido, mas ainda sem contagem observável de fila/salas e enforcement no gate de release.

## Protocolo de reinício

Execute primeiro, sem corrigir nada antes de ver o resultado:

```powershell
git status --short
npx vitest run tests/online-control-and-ticket.test.ts tests/online-worker.test.mjs tests/online-browser-client.test.ts tests/online-authoritative-match.test.ts tests/online-client-ui.test.ts --reporter=dot
npm run typecheck
npm run audit:online-worker-bundle
```

Depois dos testes novos da missão:

```powershell
npm run test:contracts
npm run test:ui
npm run test:gates
npm run check:cloudflare
```

`check:cloudflare` faz typecheck, build e auditoria do bundle; não publica.

## Último estado verde conhecido

- suíte online final: 10 arquivos, 56 testes aprovados;
- `npm run check`: aprovado em 2026-07-19, incluindo typecheck, 60 arquivos/543 testes de contratos, 3 arquivos/19 testes de UI, 7 arquivos/38 testes de gates e build Vite;
- o replay incidental `ranni-opponent-bomb-trap` foi substituído por um cenário determinístico no gate de egress, e as expectativas do Lee Sin foram alinhadas ao pack curado real de 175 frames mais quatro sprites estáticos; revisão independente terminou sem achados;
- `npm run audit:online-worker-bundle`: 68 inputs, 564.161 bytes, sem mídia ou catálogo de apresentação;
- o hotfix de produção para a entrega binária do WebSocket foi publicado como `a24cb929-a6c3-4c2b-8b87-0bb23f83032f`; a troca final do secret criou a versão ativa `6ba3a3ad-df86-424a-b74f-149b5b7ce2b2`;
- smoke em `bombapvp.com` e `bombpvp.com`: launcher e `/arena/` responderam 200, PT-BR/EN renderizaram sem erros de console, e uma partida de treino abriu Ranni vs Bomb no canvas;
- `ONLINE_TICKET_SECRET` foi configurado diretamente no Cloudflare, sem persistir seu valor no checkout; o preflight responde `available:true` nos dois domínios e os guards HTTP sem upgrade continuam respondendo 426;
- o primeiro E2E real revelou que a compatibilidade Cloudflare atual entrega binários como `Blob` por padrão; o Worker agora define `binaryType = "arraybuffer"` antes de `accept()`, com regressão em `online-worker.test.mjs`;
- E2E WebSocket de produção aprovou dois domínios na mesma partida, inputs reconhecidos nos dois assentos, reconexão com rotação e retomada de frames/ACKs, e encerramento único por `forfeit` após dez segundos, sem erros de protocolo;
- E2E visual em duas abas aprovou arena Ranni vs Ranni nos dois idiomas, zero logs do browser e a tela EN `Victory by forfeit` após fechar o rival;
- o incidente de lag pós-ativação foi reproduzido: a rede entregava 20,06 frames/s com intervalo p50 de 49,8 ms, mas a ponte chamava `applyOnlineSnapshot` em todo frame e invalidava/reconstruía o canvas estático inteiro cerca de 20 vezes/s;
- o hotfix de render mantém a hidratação completa somente no primeiro frame e usa aplicação incremental depois dela; uma regressão prova que movimento não invalida o cache, enquanto caixa removida ainda invalida e atualiza o terreno;
- o hotfix foi publicado como `190b6ee7-9864-4d8c-9463-355613d9a0a6`; a restauração do secret gerou a versão final `7b693050-b188-4d8c-842c-db9287362a5e`, com `/api/online` novamente `available:true` nos dois domínios;
- E2E pós-hotfix carregou `/_app/arena-CUiZrVl6.js` em PT-BR e EN. Em 6 s de movimento sustentado, o Chrome mediu 1.002 frames (166,98 FPS no monitor de alta frequência), frame p95 de 8,4 ms, p99 de 12,7 ms, máximo de 49,9 ms, zero frames acima de 50 ms e zero long tasks; o jogador local percorreu 44,583 px até a colisão, sem resync nem logs de browser;
- `/api/lab/health` responde 530/1033 nos dois domínios, reproduzido diretamente em `lab-broker.bombapvp.com/health`: o túnel externo do broker está sem conexão ativa.

Ainda não foi provado: teste em duas máquinas e redes físicas distintas, restart de Durable Object, carga sustentada e benchmark multi-região.

## Mapa de arquivos do online

| Responsabilidade | Arquivos principais |
|---|---|
| Rotas, fila e sala Cloudflare | `worker/index.js`, `wrangler.jsonc` |
| Matchmaking/placement | `src/online/matchmaking/duel-queue.ts` |
| Tickets, sessão e seed | `src/online/session/match-ticket.ts`, `src/online/content-revision.ts` |
| Contratos e codecs | `src/online/protocol/contracts.ts`, `control-messages.ts`, `input-codec.ts`, `frame-envelope.ts`, `snapshot-codec.ts` |
| Clock e autoridade | `src/online/runtime/fixed-step-clock.ts`, `simulation-kernel.ts`, `authoritative-match.ts` |
| Adaptador transitório do motor | `src/online/game/game-app-characterization-kernel.ts`, `server-game-assets.ts` |
| Transporte do browser | `src/online/client/authoritative-duel-client.ts` |
| Ponte com o jogo e UX | `src/online/client/game-app-online-session.ts`, `src/original-game/main.ts`, `src/original-game/original-game.css` |
| Input/predição existentes | `src/original-game/Engine/game-app.ts`, `src/original-game/NetCode/online-sync.ts` |
| Launcher | `src/matches/launch-request.ts`, `src/matches/url-search-params.ts`, `src/app/state.ts`, `src/app/view.ts`, `src/app/catalog.ts` |
| Roster e skills | `Champions/membership.ts`, `Champions/runtime.ts`, `Champions/headless-visual-runtime.ts`, `Champions/*/identity.ts`, `Champions/*/skill.ts` |
| Gate do bundle | `scripts/audit-online-worker-bundle.mjs`, `package.json` |
| Testes | `tests/online-*.test.*`, `tests/online-game-input-rate.test.mjs`, `tests/engine-seat-lane.test.mjs` |

## Gates externos e bloqueios conhecidos

- `ONLINE_TICKET_SECRET` está configurado como secret do Cloudflare com entropia superior ao mínimo de 32 bytes; não existe valor de segredo no repositório.
- A conta observada não possui Workers Paid/Containers. Não comprar nem alterar plano sem autorização.
- Uma amostra de produção no runner que entrou pelo edge GRU mediu ACK de input p50 entre 157,8 e 161,5 ms e p95 entre 173,9 e 174,3 ms, com frames estáveis a 20,06 Hz. Isso ainda não identifica a localização física do Durable Object nem prova SLO entre duas redes/regiões distintas; `locationHint` sozinho continua insuficiente.
- Lee Sin está integrado logicamente e possui testes de skill, mas seus assets não têm proveniência/licença/manifest/checksums suficientes. Além disso, 22 de 46 grupos direcionais auditados eram byte-idênticos. Não graduar “todos os personagens prontos para release” sem corrigir ou obter aprovação explícita.
- O checkout compartilhado ainda não provou clone limpo/build reproduzível.
- Proteção de abuso da fila, métricas estruturadas, carga, canário e rollback ainda estão abertos.

Referências de infraestrutura já consultadas:

- <https://developers.cloudflare.com/durable-objects/reference/data-location/>
- <https://developers.cloudflare.com/containers/platform-details/placement/>
- <https://developers.cloudflare.com/containers/platform-details/architecture/>
- <https://developers.cloudflare.com/containers/platform-details/limits/>
- <https://developers.cloudflare.com/containers/examples/websocket/>
- <https://developers.cloudflare.com/containers/pricing/>

## Ordem sugerida de retomada

1. [Protocolo e orçamentos de rede](./tickets/004-protocolo-e-orcamentos-de-rede.md).
2. [Alocação regional e matchmaking justo](./tickets/003-alocacao-regional-e-matchmaking.md).
3. [Consolidação concorrente e build reproduzível](./tickets/008-consolidacao-e-build-reproduzivel.md).
4. [Paridade do motor e de todos os personagens](./tickets/006-paridade-do-motor-e-personagens.md).
5. [Segurança, abuso e compatibilidade](./tickets/007-seguranca-abuso-e-compatibilidade.md).
6. [Gates, observabilidade e release seguro](./tickets/009-gates-observabilidade-e-release.md).

Cada sessão deve resolver no máximo um ticket Wayfinder e atualizar este handoff somente quando o estado material mudar.

## Prompt para a próxima sessão

> Retome o PvP online global de `C:\Projetos\bombpvp`. Leia `AGENTS.md`, `INDEX.md` e `tarefas/online-pvp-global/HANDOFF.md`. Preserve integralmente o checkout compartilhado e não faça commit, push, deploy, stash, reset ou clean. Nesta sessão resolva somente o ticket “Protocolo e orçamentos de rede”: reivindique o ticket 004, rode primeiro o protocolo de reinício do handoff e siga seus critérios sem avançar para outro ticket. Não declare o kernel puro, não configure infraestrutura e não publique nada.
