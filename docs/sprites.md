# Sprites

SOMENTE ao criar ou integrar assets de Champion.

Guarde finais em `Champions/<slug>/assets/`.

Antes de gerar ou regenerar qualquer sprite com IA, siga obrigatoriamente
`docs/sprite-generation.md`.

Animacoes usam:

```text
{idle|walk|run|cast|ultimate|attack|death}-{north|south|east|west}-{n}.png
```

Estaticos usam `north.png`, `south.png`, `east.png` e `west.png`. O retrato e `portrait.png`.

Mantenha fundo transparente e direcoes visuais reais; west pode espelhar east quando a arte for simetrica. Frames de `attack` nao devem conter a bomba, pois ela e desenhada pela engine.

Registre identidade em `Champions/membership.ts`, conteudo em `Champions/<slug>/` e mecanica em `GameMechanics/src/modules/skills/`.

## Integracao do animation lab

Um manifest de Champion com `runtimeIntegration: true`, `runtimeAction` e
`runtimeDirection` e descoberto automaticamente pelo adaptador visual. Os frames
finais ainda precisam existir em `Champions/<slug>/assets/animations/`.

- `idle` toca parado; `walk`/`run` tocam em movimento.
- `ultimate`, `attack` e `cast` sao escolhidos para a habilidade, nessa prioridade.
- Um `cast` integrado tambem toca ao colocar bomba, mantendo-o acessivel quando o
  mesmo Champion possui `ultimate`.
- Uma sequencia integrada somente em `south` funciona como fallback para as outras
  direcoes ate existirem artes direcionais proprias.
- Build e testes falham se um manifest integrado apontar para uma sequencia ausente.
