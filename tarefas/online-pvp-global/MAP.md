# Mapa: PvP mundial e consolidação do próximo release

## Destination

Chegar a um release consolidado e reproduzível em que jogadores em computadores e redes diferentes consigam entrar no PvP público, compartilhar a mesma simulação autoritativa com latência justa e jogar com todos os personagens integrados. O destino só está alcançado quando correção, desempenho, consumo de dados, segurança, observabilidade, rollback e testes multi-região estiverem provados; commit, push e deploy continuam dependendo de ordem explícita do dono.

## Notes

- Este mapa inclui decisões **e execução**: após cada decisão necessária, a implementação e os gates correspondentes permanecem dentro do objetivo até a prova ponta a ponta.
- O checkout é compartilhado. Trabalho concorrente, arquivos não rastreados e novos personagens devem ser inventariados e consolidados sem `stash`, descarte ou reescrita destrutiva.
- `main` publica diretamente em `bombapvp.com` e `bombpvp.com`; não existe staging separado.
- A produção atual chama de PvP uma arena local contra bots. Não é permitido manter fallback silencioso que continue fazendo essa promessa falsa.
- Cloudflare Durable Objects e WebSockets são a infraestrutura já vinculada, mas a escolha final deve respeitar posicionamento regional, custo, limites e compatibilidade integral do motor.
- O mapa usa o tracker local Markdown porque o repositório não possui contrato de issue tracker configurado.
- Toda sessão nova deve começar pelo [handoff operacional](./HANDOFF.md), que registra o último estado verde, os riscos ativos e o único ticket recomendado para retomada.

## Decisions so far

- [Contrato público honesto do PvP](./tickets/001-contrato-publico-do-pvp.md): `duel-1v1-v1`, exatamente dois humanos, sem Completer, chat ou fallback silencioso; um humano sozinho permanece na fila.
- [Autoridade e runtime da partida](./tickets/002-autoridade-e-runtime-da-partida.md): uma simulação determinística, autoritativa e isolada por partida; browsers só enviam comandos, e o provedor do dataplane é escolhido por benchmark regional.
- [Sessão, reconexão e ciclo de assentos](./tickets/005-sessao-reconexao-e-assentos.md): a Sessão preserva o mesmo Assento humano por 10 segundos com input neutro, credenciais rotacionadas e aposentadas por ACK, término confirmado e deploy condicionado a drain de fila e salas ativas.

## Not yet specified

- Contas persistentes, ranking, progressão e histórico, caso o contrato do primeiro release determine que são necessários para identidade ou abuso.
- Expansão para infraestrutura fora da Cloudflare, caso as medições regionais provem que Durable Objects não atendem o orçamento de latência do público prioritário.
- Capacidade e orçamento mensal absolutos, que dependem do número esperado de jogadores simultâneos e do protocolo medido.
- Modos sociais posteriores, espectador e torneios; só serão graduados se forem necessários para o destino do próximo release.

## Out of scope

<!-- Nenhum limite adicional foi imposto antes de resolver o contrato público do modo. -->
