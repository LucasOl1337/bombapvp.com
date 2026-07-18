# Game assets

Fonte raiz dos assets compartilhados do jogo. Esta pasta fica deliberadamente fora de `src/`.

## Ownership

- `arenas/`: tiles, temas e fontes visuais de cenários.
- `audio/`: efeitos sonoros compartilhados, agrupados por contexto.
- `effects/`: efeitos visuais reutilizáveis.
- `gameplay/`: sprites e ícones de mecânicas como bombas, caixas e power-ups.
- `marketing/`: imagens compartilhadas do launcher e da apresentação do jogo.
- `ui/`: elementos visuais de arena, launcher e identidade.

Assets privados de um personagem, inclusive suas animações e efeitos exclusivos, pertencem ao módulo desse personagem e não devem entrar aqui.

## Consumo

TypeScript deve importar `resolveGameAsset` e usar um `GameAssetId` estável. CSS deve consumir as variáveis expostas por `styles.css`. Isso mantém caminhos físicos encapsulados e permite reorganizar arquivos sem espalhar URLs pelo jogo.
