# Gameplay

SOMENTE ao alterar regras, controles, bots ou URL.

- A raiz e `/GameMechanics/` carregam `GameMechanics/src/browser/main.ts`.
- Use `p1=<slug|uuid>` e `p2=<slug|uuid>` para escolher Champions.
- Use `bot=bomb|pingo|v1|v2|v3` para controlar P2 com um perfil canonico.
- `char1`, `char2`, `control2=bot`, `p2=bot` e `bot=1` existem por compatibilidade.
- Use `skipSelect=1` para pular a selecao e `dev=1` para diagnosticos.

Controles: P1 usa `WASD`, `Q` e `Espaco`/`R`; P2 usa setas, `O` e `I`. `Esc` pausa, `T` reinicia e `M` alterna o som.

A simulacao usa ticks fixos de 20 ms. Bots recebem snapshot congelado e devolvem apenas comandos comuns da engine.
