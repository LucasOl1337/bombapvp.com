---
status: closed
type: grilling
assignee: root
parent: ../MAP.md
blocked_by:
  - ./001-contrato-publico-do-pvp.md
  - ./002-autoridade-e-runtime-da-partida.md
---

# Sessão, reconexão e ciclo de assentos

## Question

Qual é o ciclo de vida de conexão, fila, assento, desconexão, janela de reconexão, substituição por bot, retorno do humano e término de sala, inclusive durante rodada, resultado e deploy de nova versão?

## Resolution

O contrato de `duel-1v1-v1` mantém exatamente dois humanos e dois assentos imutáveis. A fila só emite o par quando há dois jogadores; não existe bot, Completer, substituição offline, transferência de assento nem retorno do humano depois que a reserva expira.

### Sessão, assento e reconexão

1. O ticket HMAC inicial vincula `matchId`, `sessionId`, assento, personagens, revisão de conteúdo e seed. A primeira aceitação cria a Sessão lógica e reserva o Assento correspondente.
2. Até o cliente aplicar `match.ready` e o servidor receber `match.ready.ack`, somente o ticket inicial exato pode retomar aquela Sessão enquanto ela estiver sem conexão. A primeira aceitação fica registrada em memória e continua válida para esse replay idempotente até o deadline lógico, mesmo que o TTL original termine. O ACK vindo da conexão ativa aposenta o ticket; os caminhos armazenado e verificado passam então a rejeitá-lo, antes ou depois do TTL.
3. A reconexão usa `sessionId` e token opaco. Cada reanexação gira o token e conserva a credencial efetivamente apresentada como fallback até o `match.ready.ack` da conexão ativa. O ACK aposenta ticket e fallback, mantendo apenas o token atual; ACK atrasado de uma conexão substituída é ignorado. Se o novo `ready` ou seu ACK se perder, a credencial anterior continua recuperando a Sessão até o deadline.
4. A reserva dura exatamente 10.000 ms no servidor e no cliente. O timeout de chegada nunca pode truncar uma janela já iniciada: se a queda ocorrer aos 19 segundos, por exemplo, o pré-início só expira aos 29. Antes do runtime, expiração encerra como `peer-timeout`; depois do início, encerra como `forfeit` e dá vitória ao outro assento.
5. Na ausência detectada, o servidor neutraliza imediatamente os comandos do competidor vinculado ao assento sem libertá-lo. Uma conexão half-open também fica neutra após 250 ms sem novo comando; o próximo comando autenticado restaura o controle.

### Resultado e fechamento

- A transição terminal captura um frame final imediatamente, inclusive fora da cadência normal de 20 Hz. A ordem é `frame final` → `match.ended` → ACK de aplicação → fechamento `1000/match_ended`.
- O cliente aplica e exibe `completed`, `forfeit`, `peer-timeout` ou `server-overload` em PT-BR e EN antes de enviar `match.ended.ack`. O servidor aguarda o ACK por socket e usa um fallback limitado de 1 segundo se ele não chegar.
- O encerramento é selado exatamente uma vez na instância. Timers e scheduler são cancelados, closes tardios não reabrem a reserva e ticket/token algum reconecta depois do estado terminal.
- A reconexão do rival aparece como aviso compacto e não bloqueia a arena; frames do jogo ou o estado da própria conexão não apagam o aviso. Só a reconexão do rival o remove.

### Deploy de nova versão

Sessões, tokens, simulação e resultado terminal continuam em memória no Durable Object. Um deploy/restart pode desconectar os WebSockets e não há promessa de restaurar uma partida ativa nesta versão. Portanto, a política de release é **drain antes da troca de versão**: interromper novas admissões, esvaziar a fila, aguardar zero salas ativas e só então substituir o código. Se houver reinício forçado, a interrupção deve ser reportada honestamente; nunca se cria bot, partida offline ou retomada fictícia. Métricas e enforcement operacional desse drain pertencem aos gates de release, não a este host de sessão.

### Evidence

- Suíte focal final: 5 arquivos, 39 testes aprovados, cobrindo o ciclo fila → tickets reais → dois assentos → partida → frame final → resultado; reconexão pré/pós-início; expiração, rotação, aposentadoria e replay; ACK de `ready`/terminal; corrida de conexão substituída; quatro términos; UI PT-BR/EN.
- `npm run typecheck`: aprovado nos dois projetos TypeScript.
- `npm run test:ui`: 3 arquivos, 19 testes aprovados.
- `npm run test:gates`: 7 arquivos, 38 testes aprovados.
- `npm run check:cloudflare`: typecheck, build Vite e auditoria do Worker aprovados, sem publicar.
- Gate integral de release: `npm run check` aprovou 60 arquivos/543 testes de contratos, 3 arquivos/19 testes de UI, 7 arquivos/38 testes de gates, typecheck e build. O replay incidental de Ranni foi substituído por um cenário determinístico e o gate do Lee Sin foi alinhado ao pack curado real; revisão independente terminou sem achados acionáveis.
- Auditoria final do bundle após o hotfix: 68 inputs, 563.006 bytes e nenhum catálogo de mídia/apresentação.
- Revisões independentes de Standards e Spec terminaram sem achados acionáveis após o handshake de `ready`, vínculo do ACK à conexão de origem, aposentadoria de credenciais, fronteira de 10.000 ms e correções de vocabulário.
- O primeiro E2E real em produção detectou a mudança de compatibilidade da Cloudflare que entrega frames binários como `Blob` por padrão. O Worker passou a definir `binaryType = "arraybuffer"` antes de aceitar o socket, e o teste do host registra que essa configuração já existia no momento de `accept()`.
- O hotfix foi publicado como `a24cb929-a6c3-4c2b-8b87-0bb23f83032f`; a instalação final do secret criou a versão ativa `6ba3a3ad-df86-424a-b74f-149b5b7ce2b2`. O valor do secret não foi gravado nem exibido.
- Smoke de produção aprovou `available:true` nos dois domínios, matchmaking entre eles, os dois assentos com ACK de input, reconexão com rotação e retomada de frames, e término único por `forfeit` após dez segundos, sem erro de protocolo.
- Duas abas reais abriram a mesma arena Ranni vs Ranni em PT-BR/EN, permaneceram sem logs de browser e a aba sobrevivente exibiu `Victory by forfeit` ao expirar a Sessão do rival.

### Limits

- Ainda não há prova com dois browsers em máquinas e redes físicas distintas, restart do Durable Object, carga sustentada ou múltiplas regiões.
- Admissão, matchmaking, partida e reconexão estão ativos e foram provados em produção; isso ainda não constitui benchmark mundial nem prova de capacidade.
- O ACK terminal garante processamento na conexão saudável, mas o resultado não é persistido para recuperação após deploy/restart.
- O drain está decidido como pré-condição de release, mas ainda precisa de contagem observável de fila/salas e automação no gate operacional. Nesta publicação, novas admissões já estavam estruturalmente desativadas pela ausência do secret.
