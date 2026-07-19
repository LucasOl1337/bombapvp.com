# Recibo — Bomb Flame Blast v3

## Diagnostico

O sheet em producao tinha sido sobrescrito por **24 copias identicas** do `flame.png` estatico (384×256). A animacao nao existia. O overlay laranja de cells/connectors tinha voltado no `drawExplosionFeedback`.

## Correcao

1. Removidos de novo fills/borders/connectors do feedback de explosao.
2. Nova sheet 6×4 (24 frames, 256²) no estilo classico do jogo (nucleo ciano + fogo laranja organico), com progresso real ignicao→pico→dissipacao.
3. `flame-render` com leve overscale (1.12) para preencher o tile.

## Paths

- `game-assets/gameplay/bomb/explosion/flame-anim-sheet-v1.png`
- `game-assets/gameplay/bomb/explosion/flame.png`
- frames `.../frames/flame-anim-00.png` … `23.png`
