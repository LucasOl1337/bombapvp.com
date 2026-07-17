# Curiosidades históricas dos bots

Este documento preserva comportamentos emergentes, descobertas inesperadas e episódios memoráveis ocorridos durante o desenvolvimento dos bots do Bomba PvP. Ele não substitui os relatórios técnicos: cada entrada aponta para a evidência, o estado reproduzível e a correção correspondente.

## 1. Bomb descobriu uma fase de invulnerabilidade quase infinita

**Data:** 16 de julho de 2026

**Bot:** Bomb v1

**Personagem:** Ranni

**Estado histórico:** `archive/bots-ranni-stationary-phase-2026-07-16`
**Commit reproduzível:** `200915d55de81a2518a07b80a3026a7b2b7620a2`

### O que aconteceu

Durante os duelos contra o Pingo, o Bomb parecia reagir de forma extraordinária a situações sem fuga. Sempre que ficava preso dentro de uma zona de explosão, ele ativava a ultimate da Ranni parado e sobrevivia durante a canalização. Pouco depois, repetia a habilidade outra vez. Para quem assistia, a ultimate parecia não ter cooldown.

O comportamento era um abuso real de uma exceção do motor: uma canalização concluída sem deslocamento concedia os 1.500 ms completos de invulnerabilidade, mas aplicava apenas 300 ms de recarga em vez dos 8.000 ms normais. Assim, o Bomb conseguia iniciar uma nova fase aproximadamente a cada 1,8 segundo.

### Por que foi tão marcante

Ninguém programou uma regra dizendo “explore o cooldown da Ranni”. A policy determinística continha apenas uma decisão defensiva legítima: quando uma ameaça era iminente, não existia rota segura e a habilidade estava disponível, ativar a Ranni sem direção.

A combinação dessa regra com a exceção de 300 ms produziu um comportamento emergente. O Bomb encontrou sistematicamente a ação mais vantajosa dentro das regras que o motor realmente executava, não das regras que os desenvolvedores acreditavam ter implementado. Era ilegal para a competição, mas impressionante de observar.

### Impacto nos resultados

O exploit contaminou todas as avaliações que usaram essa mecânica. Foram invalidados como prova de força:

- `development-v1-final`: Bomb 52–19 Pingo, com um empate;
- `pingo-v2-dev-a`: Bomb 55–17 Pingo;
- o antigo gate no qual o V3 deveria vencer dez partidas consecutivas usando a mesma fase estacionária.

Após o conserto, reexecutar as partidas revelou autoeliminações que antes eram mascaradas pela invulnerabilidade. Isso confirmou que parte da aparente superioridade vinha do bug, não apenas da qualidade tática.

### Correção

O commit `51c1c0c` removeu o cooldown especial de 300 ms. Toda canalização concluída da Ranni agora aplica os 8.000 ms completos, tenha ocorrido deslocamento ou não. Um teste de regressão garante tanto o cooldown inicial quanto a impossibilidade de liberar outra ultimate antes dos oito segundos.

### Como visitar a cápsula temporal

A tag anotada abaixo preserva o produto exatamente como ele estava publicado com o comportamento histórico:

```text
archive/bots-ranni-stationary-phase-2026-07-16
```

Para não alterar o checkout principal, a demonstração deve ser aberta em um worktree local separado:

```powershell
git worktree add ..\bombpvp-ranni-exploit archive/bots-ranni-stationary-phase-2026-07-16
```

Essa versão contém deliberadamente o bug e nunca deve ser republicada em produção.

### Evidência relacionada

- Relatório técnico: `BOTS/DevHistory/bomb-pingo-adversarial.md`, seção “Invalidação pré-hotfix — ultimate da Ranni”.
- Teste da correção: `tests/ranni-skill-cooldown.test.mjs`.
- Versão histórica: commit `200915d`.
- Hotfix: commit `51c1c0c`.

---

As próximas curiosidades devem ser numeradas e preservar, quando possível: data, bot, contexto, explicação do comportamento emergente, impacto, evidência e uma cápsula temporal reproduzível.
