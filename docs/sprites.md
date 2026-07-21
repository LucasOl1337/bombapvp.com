# Sprites

SOMENTE ao criar ou integrar assets de Champion.

Guarde finais em `Champions/<slug>/assets/`.

Animacoes usam:

```text
{idle|walk|run|cast|ultimate|attack|death}-{north|south|east|west}-{n}.png
```

Estaticos usam `north.png`, `south.png`, `east.png` e `west.png`. O retrato e `portrait.png`.

Mantenha fundo transparente e direcoes visuais reais; west pode espelhar east quando a arte for simetrica. Frames de `attack` nao devem conter a bomba, pois ela e desenhada pela engine.

Registre identidade em `Champions/membership.ts`, conteudo em `Champions/<slug>/` e mecanica em `GameMechanics/src/modules/skills/`.
